import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVideoGenerationSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import FormData from "form-data";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const VEO3_API_BASE = "https://api.veo3api.ai/api/v1";
const VEO3_UPLOAD_BASE = "https://veo3apiai.redpandaai.co/api";

// Check API key credits
async function checkApiCredits(apiKey: string): Promise<number> {
  try {
    const response = await fetch('https://api.veo3api.ai/api/v1/common/credit', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const data = await response.json();
    console.log(`Remaining credits: ${data.data}`);
    return data.data || 0;
  } catch (error) {
    console.error('Failed to check API credits:', error);
    return 0;
  }
}

// Get best available API key with credits
async function getBestApiKey(): Promise<{ key: string; apiKeyId?: string } | null> {
  try {
    // First, try to get from database
    const storageInstance = await storage();
    const activeKeys = await storageInstance.getActiveApiKeys();
    
    for (const dbApiKey of activeKeys) {
      const credits = await checkApiCredits(dbApiKey.apiKey);
      
      // Update credits in database
      await storageInstance.updateApiKey(dbApiKey.id, {
        credits,
        lastChecked: new Date(),
        isActive: credits > 0
      });
      
      if (credits > 0) {
        return { key: dbApiKey.apiKey, apiKeyId: dbApiKey.id };
      }
    }
    
    // Fallback to environment variables
    const envKey = process.env.VEOAPI_KEY || process.env.VEO3_API_KEY;
    if (envKey && envKey !== "your-api-key") {
      const credits = await checkApiCredits(envKey);
      if (credits > 0) {
        return { key: envKey };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get user credits
  app.get("/api/credits", async (req, res) => {
    try {
      const userId = "default-user-id"; // For demo, use default user
      const storageInstance = await storage();
      const user = await storageInstance.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ credits: user.credits });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch credits" });
    }
  });

  // Upload image for image-to-video generation
  app.post("/api/upload-image", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      formData.append('uploadPath', 'images/user-uploads');

      const apiKeyData = await getBestApiKey();
      if (!apiKeyData) {
        return res.status(503).json({ message: "No API keys with credits available" });
      }

      const response = await fetch(`${VEO3_UPLOAD_BASE}/file-stream-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyData.key}`,
          ...formData.getHeaders(),
        },
        body: formData as any,
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(data.msg || 'Upload failed');
      }

      res.json({ downloadUrl: data.data.downloadUrl });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Generate video
  app.post("/api/generate-video", async (req, res) => {
    try {
      const userId = "default-user-id"; // For demo, use default user
      const storageInstance = await storage();
      const user = await storageInstance.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validatedData = insertVideoGenerationSchema.parse(req.body);
      
      // Calculate credits needed
      const baseCredits = validatedData.type === "image-to-video" ? 7 : 5;
      const hdCredits = validatedData.hdGeneration ? 2 : 0;
      const totalCredits = baseCredits + hdCredits;

      if (user.credits < totalCredits) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create video generation record  
      const generation = await storageInstance.createVideoGeneration({
        ...validatedData,
        userId,
      }, totalCredits);

      // Get API key with credits
      const apiKeyData = await getBestApiKey();
      if (!apiKeyData) {
        return res.status(503).json({ message: "No API keys with credits available" });
      }

      // Call Veo3 API
      const veoPayload: any = {
        prompt: validatedData.prompt,
        model: validatedData.model,
        aspectRatio: validatedData.aspectRatio,
      };

      if (validatedData.watermark) {
        veoPayload.watermark = validatedData.watermark;
      }

      if (validatedData.imageUrl) {
        veoPayload.imageUrls = [validatedData.imageUrl];
      }

      const response = await fetch(`${VEO3_API_BASE}/veo/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyData.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(veoPayload),
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        await storageInstance.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: data.msg || 'Generation failed',
        });
        throw new Error(data.msg || 'Generation failed');
      }

      // Update generation with task ID and deduct credits
      await storageInstance.updateVideoGeneration(generation.id, {
        taskId: data.data.taskId,
        status: "processing",
      });

      await storageInstance.updateUserCredits(userId, user.credits - totalCredits);

      res.json({ 
        taskId: data.data.taskId,
        generationId: generation.id,
        creditsUsed: totalCredits 
      });
    } catch (error) {
      console.error('Generation error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate video" });
    }
  });

  // Check video status
  app.get("/api/video-status/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      
      // Get API key with credits
      const apiKeyData = await getBestApiKey();
      if (!apiKeyData) {
        return res.status(503).json({ message: "No API keys with credits available" });
      }
      
      const response = await fetch(`${VEO3_API_BASE}/veo/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKeyData.key}`,
        },
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(data.msg || 'Failed to check status');
      }

      const storageInstance = await storage();
      const generation = await storageInstance.getVideoGenerationByTaskId(taskId);
      if (generation) {
        let status = "processing";
        let resultUrls = null;
        let errorMessage = null;
        let completedAt = null;

        if (data.data.successFlag === 1) {
          status = "completed";
          resultUrls = data.data.response?.resultUrls || [];
          completedAt = new Date();
        } else if (data.data.successFlag === -1) {
          status = "failed";
          errorMessage = data.data.errorMessage || "Generation failed";
        }

        await storageInstance.updateVideoGeneration(generation.id, {
          status,
          resultUrls,
          errorMessage,
          completedAt,
        });
      }

      res.json(data.data);
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ message: "Failed to check video status" });
    }
  });

  // Get 1080p video
  app.get("/api/get-1080p/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { index = 0 } = req.query;
      
      // Get API key with credits
      const apiKeyData = await getBestApiKey();
      if (!apiKeyData) {
        return res.status(503).json({ message: "No API keys with credits available" });
      }
      
      const response = await fetch(`${VEO3_API_BASE}/veo/get-1080p-video?taskId=${taskId}&index=${index}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKeyData.key}`,
        },
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(data.msg || 'Failed to get 1080p video');
      }

      const storageInstance = await storage();
      const generation = await storageInstance.getVideoGenerationByTaskId(taskId);
      if (generation) {
        await storageInstance.updateVideoGeneration(generation.id, {
          hdResultUrl: data.data.resultUrl,
        });
      }

      res.json({ resultUrl: data.data.resultUrl });
    } catch (error) {
      console.error('1080p fetch error:', error);
      res.status(500).json({ message: "Failed to get 1080p video" });
    }
  });

  // Get user's video generations
  app.get("/api/generations", async (req, res) => {
    try {
      const userId = "default-user-id"; // For demo, use default user
      const storageInstance = await storage();
      const generations = await storageInstance.getUserVideoGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error('Generations fetch error:', error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  // Admin Settings APIs
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const storageInstance = await storage();
      const settings = await storageInstance.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error('Settings fetch error:', error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/admin/settings", async (req, res) => {
    try {
      const { key, value } = req.body;
      const storageInstance = await storage();
      const setting = await storageInstance.setSetting(key, value);
      res.json(setting);
    } catch (error) {
      console.error('Settings save error:', error);
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  // Admin API Keys management
  app.get("/api/admin/api-keys", async (req, res) => {
    try {
      const storageInstance = await storage();
      const apiKeys = await storageInstance.getAllApiKeys();
      res.json(apiKeys);
    } catch (error) {
      console.error('API Keys fetch error:', error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post("/api/admin/api-keys", async (req, res) => {
    try {
      const storageInstance = await storage();
      const apiKeyData = req.body;
      
      // Create API key first
      const apiKey = await storageInstance.createApiKey(apiKeyData);
      
      // Immediately check credits for the new API key
      console.log(`Checking credits for new API key: ${apiKeyData.name}`);
      const credits = await checkApiCredits(apiKeyData.apiKey);
      
      // Update the API key with actual credits
      const updatedApiKey = await storageInstance.updateApiKey(apiKey.id, {
        credits,
        lastChecked: new Date(),
        isActive: credits > 0
      });
      
      console.log(`New API key "${apiKeyData.name}" has ${credits} credits`);
      res.json(updatedApiKey || apiKey);
    } catch (error) {
      console.error('API Key creation error:', error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.put("/api/admin/api-keys/:id", async (req, res) => {
    try {
      const storageInstance = await storage();
      const { id } = req.params;
      const updates = req.body;
      const apiKey = await storageInstance.updateApiKey(id, updates);
      
      if (!apiKey) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      res.json(apiKey);
    } catch (error) {
      console.error('API Key update error:', error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  app.delete("/api/admin/api-keys/:id", async (req, res) => {
    try {
      const storageInstance = await storage();
      const { id } = req.params;
      const success = await storageInstance.deleteApiKey(id);
      
      if (!success) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('API Key deletion error:', error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Toggle API key status
  app.put("/api/admin/api-keys/:id/toggle", async (req, res) => {
    try {
      const storageInstance = await storage();
      const { id } = req.params;
      const { isActive } = req.body;
      
      const apiKey = await storageInstance.updateApiKey(id, { isActive });
      
      if (!apiKey) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      res.json(apiKey);
    } catch (error) {
      console.error('API Key toggle error:', error);
      res.status(500).json({ message: "Failed to toggle API key" });
    }
  });

  // Check credits for all API keys
  app.post("/api/admin/check-credits", async (req, res) => {
    try {
      const storageInstance = await storage();
      const allApiKeys = await storageInstance.getAllApiKeys();
      
      for (const apiKey of allApiKeys) {
        const credits = await checkApiCredits(apiKey.apiKey);
        await storageInstance.updateApiKey(apiKey.id, {
          credits,
          lastChecked: new Date(),
          isActive: credits > 0 ? apiKey.isActive : false
        });
      }
      
      res.json({ success: true, message: "Credits checked for all API keys" });
    } catch (error) {
      console.error('Check credits error:', error);
      res.status(500).json({ message: "Failed to check credits" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

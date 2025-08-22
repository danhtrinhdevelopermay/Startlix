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

// Cache to avoid checking credits too frequently (cache for 5 minutes)
const creditCache = new Map<string, { credits: number; lastChecked: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Check API credits with caching
async function checkApiCreditsWithCache(apiKey: string): Promise<number> {
  const cacheKey = apiKey;
  const cached = creditCache.get(cacheKey);
  const now = Date.now();
  
  // Return cached value if still valid
  if (cached && (now - cached.lastChecked) < CACHE_DURATION) {
    return cached.credits;
  }
  
  // Check fresh credits
  const credits = await checkApiCredits(apiKey);
  creditCache.set(cacheKey, { credits, lastChecked: now });
  
  return credits;
}

// Get best available API key with credits using round-robin load balancing
let lastUsedApiKeyIndex = -1;
async function getBestApiKey(): Promise<{ key: string; apiKeyId?: string } | null> {
  try {
    const storageInstance = await storage();
    const activeKeys = await storageInstance.getActiveApiKeys();
    
    // If no active keys in database, check environment variables
    if (activeKeys.length === 0) {
      const envKey = process.env.VEOAPI_KEY || process.env.VEO3_API_KEY;
      if (envKey && envKey !== "your-api-key") {
        const credits = await checkApiCreditsWithCache(envKey);
        if (credits > 0) {
          return { key: envKey };
        }
      }
      return null;
    }
    
    // Check all keys and filter out those with 0 credits
    const validKeys = [];
    for (const dbApiKey of activeKeys) {
      const credits = await checkApiCreditsWithCache(dbApiKey.apiKey);
      
      // Update credits in database if cache was refreshed
      const cached = creditCache.get(dbApiKey.apiKey);
      if (cached && (Date.now() - cached.lastChecked) < 1000) { // Recently updated
        await storageInstance.updateApiKey(dbApiKey.id, {
          credits,
          lastChecked: new Date(),
          isActive: credits > 0
        });
      }
      
      if (credits > 0) {
        validKeys.push({ ...dbApiKey, currentCredits: credits });
      }
    }
    
    if (validKeys.length === 0) {
      return null;
    }
    
    // Round-robin load balancing among valid keys
    lastUsedApiKeyIndex = (lastUsedApiKeyIndex + 1) % validKeys.length;
    const selectedKey = validKeys[lastUsedApiKeyIndex];
    
    console.log(`Selected API key "${selectedKey.name}" with ${selectedKey.currentCredits} credits (${lastUsedApiKeyIndex + 1}/${validKeys.length})`);
    
    return { key: selectedKey.apiKey, apiKeyId: selectedKey.id };
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

// Auto refresh credits every 30 minutes for all API keys
let autoRefreshInterval: NodeJS.Timeout | null = null;

async function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  const refreshCredits = async () => {
    try {
      console.log('🔄 Auto-refreshing API key credits...');
      const storageInstance = await storage();
      const allApiKeys = await storageInstance.getAllApiKeys();
      
      for (const apiKey of allApiKeys) {
        try {
          const credits = await checkApiCredits(apiKey.apiKey);
          await storageInstance.updateApiKey(apiKey.id, {
            credits,
            lastChecked: new Date(),
            isActive: credits > 0 ? apiKey.isActive : false
          });
          
          // Clear cache
          creditCache.delete(apiKey.apiKey);
          
          console.log(`📊 "${apiKey.name}": ${credits} credits`);
        } catch (error) {
          console.error(`❌ Failed to check credits for "${apiKey.name}":`, error);
        }
      }
      
      const activeCount = allApiKeys.filter(k => k.credits > 0).length;
      console.log(`✅ Auto-refresh complete: ${activeCount}/${allApiKeys.length} keys active`);
    } catch (error) {
      console.error('❌ Auto-refresh failed:', error);
    }
  };
  
  // Run immediately, then every 2 minutes
  await refreshCredits();
  autoRefreshInterval = setInterval(refreshCredits, 2 * 60 * 1000);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Start auto refresh on server start
  startAutoRefresh();
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
      
      // Get ANY API key (even with 0 credits) for status checking
      // Status checking doesn't consume credits, just needs valid API key
      const storageService = await storage();
      const allApiKeys = await storageService.getAllApiKeys();
      
      if (allApiKeys.length === 0) {
        return res.status(503).json({ 
          message: "No API keys configured", 
          error: "NO_API_KEYS",
          details: "Please add at least one API key to check video status."
        });
      }
      
      // Use any available API key (prefer active ones but allow inactive)
      const apiKey = allApiKeys.find(key => key.isActive) || allApiKeys[0];
      console.log(`🔍 Using API key "${apiKey.name}" to check status for taskId ${taskId} (credits: ${apiKey.credits})`);
      
      const apiKeyData = { key: apiKey.apiKey, credits: apiKey.credits };
      
      const response = await fetch(`${VEO3_API_BASE}/veo/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKeyData.key}`,
        },
      });

      const data = await response.json();
      console.log(`🔍 VEO3 API Response for taskId ${taskId}:`, JSON.stringify(data, null, 2));
      
      if (data.code !== 200) {
        throw new Error(data.msg || 'Failed to check status');
      }

      const storageInstance = await storage();
      const generation = await storageInstance.getVideoGenerationByTaskId(taskId);
      
      // Handle case where VEO3 API returns null or incomplete data
      if (!data.data || data.data === null || typeof data.data.successFlag === 'undefined') {
        console.log(`⏳ Video ${taskId} still processing - VEO3 returned null/incomplete data`);
        // Video is still processing, return processing status
        res.json({
          successFlag: 0,
          status: "processing",
          message: "Video is still being processed. Please wait..."
        });
        return;
      }
      
      console.log(`✅ Video ${taskId} status check - successFlag: ${data.data.successFlag}`);
      
      if (generation) {
        let status = "processing";
        let resultUrls = null;
        let errorMessage = null;
        let completedAt = null;

        if (data.data.successFlag === 1) {
          status = "completed";
          resultUrls = data.data.response?.resultUrls || [];
          completedAt = new Date();
          console.log(`🎬 Video ${taskId} completed with ${resultUrls.length} result URLs`);
        } else if (data.data.successFlag === -1) {
          status = "failed";
          errorMessage = data.data.errorMessage || "Generation failed";
          console.log(`❌ Video ${taskId} failed: ${errorMessage}`);
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

  // Check credits for all API keys and update database
  app.post("/api/admin/check-credits", async (req, res) => {
    try {
      const storageInstance = await storage();
      const allApiKeys = await storageInstance.getAllApiKeys();
      const results = [];
      
      for (const apiKey of allApiKeys) {
        const credits = await checkApiCredits(apiKey.apiKey);
        const updatedApiKey = await storageInstance.updateApiKey(apiKey.id, {
          credits,
          lastChecked: new Date(),
          isActive: credits > 0 ? apiKey.isActive : false
        });
        
        // Clear cache to force fresh check next time
        creditCache.delete(apiKey.apiKey);
        
        results.push({
          id: apiKey.id,
          name: apiKey.name,
          credits,
          previousCredits: apiKey.credits,
          isActive: credits > 0 ? apiKey.isActive : false,
          status: credits > 0 ? 'active' : 'no_credits'
        });
        
        console.log(`API key "${apiKey.name}": ${apiKey.credits} → ${credits} credits`);
      }
      
      const activeKeys = results.filter(k => k.status === 'active').length;
      const totalCredits = results.reduce((sum, k) => sum + k.credits, 0);
      
      res.json({ 
        success: true, 
        message: `Credits updated for ${allApiKeys.length} API keys`,
        summary: {
          totalKeys: allApiKeys.length,
          activeKeys,
          totalCredits
        },
        results 
      });
    } catch (error) {
      console.error('Check credits error:', error);
      res.status(500).json({ message: "Failed to check credits" });
    }
  });
  
  // Get API keys summary for dashboard
  app.get("/api/admin/api-keys-summary", async (req, res) => {
    try {
      const storageInstance = await storage();
      const allApiKeys = await storageInstance.getAllApiKeys();
      
      const summary = {
        totalKeys: allApiKeys.length,
        activeKeys: allApiKeys.filter(k => k.isActive && k.credits > 0).length,
        inactiveKeys: allApiKeys.filter(k => !k.isActive).length,
        emptyKeys: allApiKeys.filter(k => k.credits === 0).length,
        totalCredits: allApiKeys.reduce((sum, k) => sum + k.credits, 0),
        lastChecked: allApiKeys.length > 0 ? Math.max(...allApiKeys.map(k => k.lastChecked ? new Date(k.lastChecked).getTime() : 0)) : null
      };
      
      res.json(summary);
    } catch (error) {
      console.error('API keys summary error:', error);
      res.status(500).json({ message: "Failed to get API keys summary" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

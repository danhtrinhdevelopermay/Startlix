import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVideoGenerationSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import FormData from "form-data";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const VEOAPI_KEY = process.env.VEOAPI_KEY || process.env.VEO3_API_KEY || "your-api-key";
const VEO3_API_BASE = "https://api.veo3api.ai/api/v1";
const VEO3_UPLOAD_BASE = "https://veo3apiai.redpandaai.co/api";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get user credits
  app.get("/api/credits", async (req, res) => {
    try {
      const userId = "default-user-id"; // For demo, use default user
      const user = await storage.getUser(userId);
      
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

      const response = await fetch(`${VEO3_UPLOAD_BASE}/file-stream-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VEOAPI_KEY}`,
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
      const user = await storage.getUser(userId);
      
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
      const generation = await storage.createVideoGeneration({
        ...validatedData,
        userId,
        creditsUsed: totalCredits,
      });

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
          'Authorization': `Bearer ${VEOAPI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(veoPayload),
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        await storage.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: data.msg || 'Generation failed',
        });
        throw new Error(data.msg || 'Generation failed');
      }

      // Update generation with task ID and deduct credits
      await storage.updateVideoGeneration(generation.id, {
        taskId: data.data.taskId,
        status: "processing",
      });

      await storage.updateUserCredits(userId, user.credits - totalCredits);

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
      
      const response = await fetch(`${VEO3_API_BASE}/veo/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VEOAPI_KEY}`,
        },
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(data.msg || 'Failed to check status');
      }

      const generation = await storage.getVideoGenerationByTaskId(taskId);
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

        await storage.updateVideoGeneration(generation.id, {
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
      
      const response = await fetch(`${VEO3_API_BASE}/veo/get-1080p-video?taskId=${taskId}&index=${index}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VEOAPI_KEY}`,
        },
      });

      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(data.msg || 'Failed to get 1080p video');
      }

      const generation = await storage.getVideoGenerationByTaskId(taskId);
      if (generation) {
        await storage.updateVideoGeneration(generation.id, {
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
      const generations = await storage.getUserVideoGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error('Generations fetch error:', error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

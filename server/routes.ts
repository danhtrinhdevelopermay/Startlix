import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { insertVideoGenerationSchema, insertUserSchema, insertRewardVideoSchema, insertVideoWatchHistorySchema, type User } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

// Extend session interface
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const VEO3_API_BASE = "https://api.veo3api.ai/api/v1";
const VEO3_UPLOAD_BASE = "https://veo3apiai.redpandaai.co/api";
const SEGMIND_API_BASE = "https://api.segmind.com/v1/topaz-video-upscale";

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

// Enhance video quality using FFmpeg
async function enhanceVideo(generationId: string, videoUrl: string, storageInstance: any) {
  try {
    console.log(`🎯 Starting FFmpeg video enhancement for generation ${generationId} with video: ${videoUrl}`);
    
    // Create unique filename for enhanced video
    const timestamp = Date.now();
    const inputFile = `/tmp/input_${timestamp}.mp4`;
    const outputFile = `/tmp/enhanced_${timestamp}.mp4`;
    const outputUrl = `/uploads/enhanced_${timestamp}.mp4`;
    const finalPath = path.join(process.cwd(), 'client', 'public', 'uploads', `enhanced_${timestamp}.mp4`);
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Download input video
    console.log(`📥 Downloading video from: ${videoUrl}`);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    fs.writeFileSync(inputFile, Buffer.from(videoBuffer));
    
    // Enhance video using FFmpeg with Lanczos upscaling and sharpening
    console.log(`🚀 Processing video with FFmpeg...`);
    const ffmpegCommand = `ffmpeg -i "${inputFile}" -vf "scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:1.0:5:5:0.0" -preset slow -crf 18 -c:v libx264 -c:a aac "${finalPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, (error: any, stdout: any, stderr: any) => {
        if (error) {
          console.error(`FFmpeg error: ${error}`);
          reject(error);
        } else {
          console.log(`✅ FFmpeg processing completed`);
          resolve(stdout);
        }
      });
    });
    
    // Clean up input file
    if (fs.existsSync(inputFile)) {
      fs.unlinkSync(inputFile);
    }
    
    // Update generation with enhanced video
    await storageInstance.updateVideoGeneration(generationId, {
      status: "completed",
      enhancementStatus: "completed",
      enhancedResultUrls: [outputUrl],
      enhancementCompletedAt: new Date(),
    });

    console.log(`✨ Video enhancement completed successfully for generation ${generationId}`);
    console.log(`Enhanced video URL: ${outputUrl}`);

  } catch (error) {
    console.error(`❌ Video enhancement failed for generation ${generationId}:`, error);
    
    // Update generation with enhancement failure
    await storageInstance.updateVideoGeneration(generationId, {
      status: "completed", // Original video is still available
      enhancementStatus: "failed",
      enhancementErrorMessage: error instanceof Error ? error.message : "Enhancement failed",
      enhancementCompletedAt: new Date(),
    });
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

// Authentication middleware
export function requireAuth(req: Request & { user?: User }, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Add user to request object middleware
export async function addUserToRequest(req: Request & { user?: User }, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    try {
      const storageInstance = await storage();
      const user = await storageInstance.getUser(req.session.userId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Start auto refresh on server start
  startAutoRefresh();
  
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  
  // Add user to request middleware
  app.use(addUserToRequest);
  // Auth endpoints
  app.post("/api/register", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const storageInstance = await storage();
      
      // Check if username already exists
      const existingUser = await storageInstance.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storageInstance.createUser(validatedData);
      
      // Log user in automatically
      req.session!.userId = user.id;
      
      res.status(201).json({ 
        user: { id: user.id, username: user.username, credits: user.credits } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      const storageInstance = await storage();
      const user = await storageInstance.validateUserPassword(username, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.session!.userId = user.id;
      
      res.json({ 
        user: { id: user.id, username: user.username, credits: user.credits } 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session?.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", async (req: Request & { user?: User }, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user) {
      res.json({ 
        user: { id: req.user.id, username: req.user.username, credits: req.user.credits } 
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  });

  // Get user credits  
  app.get("/api/credits", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (req.user) {
        res.json({ credits: req.user.credits });
      } else {
        res.status(404).json({ message: "User not found" });
      }
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

      const apiKeyData = await getBestApiKey();
      
      // If no API keys available, work in demo mode - save file locally
      if (!apiKeyData) {
        console.log('No API keys available, working in demo mode for image upload');
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const ext = path.extname(req.file.originalname);
        const filename = `image_${timestamp}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        
        // Write file to local storage
        fs.writeFileSync(filePath, req.file.buffer);
        
        // Return local URL
        const downloadUrl = `/uploads/${filename}`;
        console.log(`Image saved locally: ${downloadUrl}`);
        
        return res.json({ downloadUrl });
      }

      // Use VEO3 API if keys are available, with fallback to local storage
      try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype,
        });
        formData.append('uploadPath', 'images/user-uploads');

        console.log(`Uploading to VEO3 API: ${VEO3_UPLOAD_BASE}/file-stream-upload`);
        
        const headers = {
          'Authorization': `Bearer ${apiKeyData.key}`,
          ...formData.getHeaders(),
        };
        
        const response = await fetch(`${VEO3_UPLOAD_BASE}/file-stream-upload`, {
          method: 'POST',
          headers,
          body: formData as any,
        });

        const data = await response.json();
        console.log('VEO3 upload response:', data);
        
        if (data.code !== 200) {
          throw new Error(data.msg || 'VEO3 upload failed');
        }

        res.json({ downloadUrl: data.data.downloadUrl });
      } catch (veoError: any) {
        console.log('VEO3 upload failed, falling back to local storage:', veoError?.message || veoError);
        
        // Fallback to local storage
        const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const ext = path.extname(req.file.originalname);
        const filename = `image_${timestamp}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filePath, req.file.buffer);
        
        const downloadUrl = `/uploads/${filename}`;
        console.log(`Image saved locally as fallback: ${downloadUrl}`);
        
        res.json({ downloadUrl });
      }
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Generate video
  app.post("/api/generate-video", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const storageInstance = await storage();
      const user = req.user;
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validatedData = insertVideoGenerationSchema.parse(req.body);
      
      // Calculate credits needed
      const baseCredits = validatedData.type === "image-to-video" ? 7 : 5;
      const hdCredits = validatedData.hdGeneration ? 2 : 0;
      const totalCredits = baseCredits + hdCredits;

      // Get API key with credits - this will check VEO3 API credits, not local credits
      const apiKeyData = await getBestApiKey();
      if (!apiKeyData) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create video generation record  
      const generation = await storageInstance.createVideoGeneration({
        ...validatedData,
        userId: user.id,
      }, totalCredits);

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

      // Update generation with task ID (VEO3 API automatically deducts credits)
      await storageInstance.updateVideoGeneration(generation.id, {
        taskId: data.data.taskId,
        status: "processing",
      });

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
          resultUrls = data.data.response?.resultUrls || [];
          completedAt = new Date();
          console.log(`🎬 Video ${taskId} completed with ${resultUrls.length} result URLs`);
          
          // Check if this is a Veo3 Cao cấp model and needs enhancement
          if (generation.model === "veo3" && generation.enhancementStatus === "none" && resultUrls.length > 0) {
            // Start enhancement process
            status = "enhancing";
            await storageInstance.updateVideoGeneration(generation.id, {
              status,
              resultUrls,
              completedAt,
              enhancementStatus: "processing",
              enhancementStartedAt: new Date(),
            });
            
            // Trigger enhancement in background
            enhanceVideo(generation.id, resultUrls[0], storageInstance);
          } else {
            // No enhancement needed or already done
            status = "completed";
            await storageInstance.updateVideoGeneration(generation.id, {
              status,
              resultUrls,
              completedAt,
            });
          }
        } else if (data.data.successFlag === -1) {
          status = "failed";
          errorMessage = data.data.errorMessage || "Generation failed";
          console.log(`❌ Video ${taskId} failed: ${errorMessage}`);
          await storageInstance.updateVideoGeneration(generation.id, {
            status,
            errorMessage,
          });
        }
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
  app.get("/api/generations", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const storageInstance = await storage();
      const generations = await storageInstance.getUserVideoGenerations(req.user.id);
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

  // Test FFmpeg Enhancement endpoint
  app.post("/api/admin/test-segmind", async (req, res) => {
    try {
      const { videoUrl } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ message: "Video URL is required" });
      }

      console.log(`🎯 Testing FFmpeg enhancement with video: ${videoUrl}`);

      // Create unique filename for test
      const timestamp = Date.now();
      const inputFile = `/tmp/test_input_${timestamp}.mp4`;
      const outputFile = `/tmp/test_enhanced_${timestamp}.mp4`;
      const outputUrl = `/uploads/test_enhanced_${timestamp}.mp4`;
      const finalPath = path.join(process.cwd(), 'client', 'public', 'uploads', `test_enhanced_${timestamp}.mp4`);
      
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      try {
        // Download input video
        console.log(`📥 Downloading test video from: ${videoUrl}`);
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }
        const videoBuffer = await videoResponse.arrayBuffer();
        fs.writeFileSync(inputFile, Buffer.from(videoBuffer));
        
        // Enhance video using FFmpeg
        console.log(`🚀 Processing test video with FFmpeg...`);
        const ffmpegCommand = `ffmpeg -i "${inputFile}" -vf "scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:1.0:5:5:0.0" -preset ultrafast -crf 23 -c:v libx264 -c:a aac -t 10 "${finalPath}"`;
        
        await new Promise((resolve, reject) => {
          exec(ffmpegCommand, { timeout: 30000 }, (error: any, stdout: any, stderr: any) => {
            if (error) {
              console.error(`FFmpeg test error: ${error}`);
              reject(error);
            } else {
              console.log(`✅ FFmpeg test processing completed`);
              resolve(stdout);
            }
          });
        });
        
        // Clean up input file
        if (fs.existsSync(inputFile)) {
          fs.unlinkSync(inputFile);
        }
        
        res.json({
          success: true,
          message: "FFmpeg enhancement test successful",
          originalVideoUrl: videoUrl,
          enhancedVideoUrl: outputUrl,
          timestamp: new Date().toISOString(),
          enhancement: "2x upscale with Lanczos + sharpening"
        });
        
      } catch (processError: any) {
        // Clean up files on error
        if (fs.existsSync(inputFile)) {
          fs.unlinkSync(inputFile);
        }
        if (fs.existsSync(finalPath)) {
          fs.unlinkSync(finalPath);
        }
        
        throw processError;
      }

    } catch (error) {
      console.error('FFmpeg test error:', error);
      res.status(500).json({ 
        success: false,
        message: "FFmpeg enhancement test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Reward Videos API endpoints
  
  // Get all active reward videos
  app.get("/api/reward-videos", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      const storageInstance = await storage();
      const rewardVideos = await storageInstance.getAllActiveRewardVideos();
      res.json(rewardVideos);
    } catch (error) {
      console.error('Get reward videos error:', error);
      res.status(500).json({ message: "Failed to get reward videos" });
    }
  });

  // Get a specific reward video
  app.get("/api/reward-videos/:id", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      const { id } = req.params;
      const storageInstance = await storage();
      const rewardVideo = await storageInstance.getRewardVideo(id);
      
      if (!rewardVideo) {
        return res.status(404).json({ message: "Reward video not found" });
      }
      
      res.json(rewardVideo);
    } catch (error) {
      console.error('Get reward video error:', error);
      res.status(500).json({ message: "Failed to get reward video" });
    }
  });

  // Start watching a video (create/update watch history)
  app.post("/api/reward-videos/:id/start-watching", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      const { id: rewardVideoId } = req.params;
      const userId = req.user!.id;
      const storageInstance = await storage();
      
      // Check if video exists
      const rewardVideo = await storageInstance.getRewardVideo(rewardVideoId);
      if (!rewardVideo) {
        return res.status(404).json({ message: "Reward video not found" });
      }
      
      // Check if user already has a watch history for this video
      let watchHistory = await storageInstance.getVideoWatchHistory(userId, rewardVideoId);
      
      if (!watchHistory) {
        // Create new watch history
        watchHistory = await storageInstance.createVideoWatchHistory({
          userId,
          rewardVideoId,
          watchedSeconds: 0,
          isCompleted: false,
          rewardClaimed: false,
        });
      }
      
      res.json(watchHistory);
    } catch (error) {
      console.error('Start watching error:', error);
      res.status(500).json({ message: "Failed to start watching video" });
    }
  });

  // Update watching progress
  app.post("/api/reward-videos/:id/update-progress", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      const { id: rewardVideoId } = req.params;
      const { watchedSeconds } = req.body;
      const userId = req.user!.id;
      const storageInstance = await storage();
      
      if (typeof watchedSeconds !== 'number' || watchedSeconds < 0) {
        return res.status(400).json({ message: "Invalid watchedSeconds value" });
      }
      
      // Get existing watch history
      const watchHistory = await storageInstance.getVideoWatchHistory(userId, rewardVideoId);
      if (!watchHistory) {
        return res.status(404).json({ message: "Watch history not found. Start watching first." });
      }
      
      // Get the reward video to check duration
      const rewardVideo = await storageInstance.getRewardVideo(rewardVideoId);
      if (!rewardVideo) {
        return res.status(404).json({ message: "Reward video not found" });
      }
      
      // Check if video is completed (watched at least 90% of duration)
      const completionThreshold = rewardVideo.duration * 0.9;
      const isCompleted = watchedSeconds >= completionThreshold;
      
      // Update watch history
      const updates: any = { watchedSeconds };
      if (isCompleted && !watchHistory.isCompleted) {
        updates.isCompleted = true;
        updates.completedAt = new Date();
      }
      
      const updatedHistory = await storageInstance.updateVideoWatchHistory(watchHistory.id, updates);
      
      res.json(updatedHistory);
    } catch (error) {
      console.error('Update progress error:', error);
      res.status(500).json({ message: "Failed to update watching progress" });
    }
  });

  // Claim reward for completing a video
  app.post("/api/reward-videos/:id/claim-reward", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      const { id: rewardVideoId } = req.params;
      const userId = req.user!.id;
      const storageInstance = await storage();
      
      // Get watch history
      const watchHistory = await storageInstance.getVideoWatchHistory(userId, rewardVideoId);
      if (!watchHistory) {
        return res.status(404).json({ message: "Watch history not found" });
      }
      
      // Check if video is completed
      if (!watchHistory.isCompleted) {
        return res.status(400).json({ message: "Video not completed yet" });
      }
      
      // Check if reward already claimed
      if (watchHistory.rewardClaimed) {
        return res.status(400).json({ message: "Reward already claimed" });
      }
      
      // Get reward video
      const rewardVideo = await storageInstance.getRewardVideo(rewardVideoId);
      if (!rewardVideo) {
        return res.status(404).json({ message: "Reward video not found" });
      }
      
      // Get current user credits
      const user = await storageInstance.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Award credits
      const newCredits = user.credits + rewardVideo.creditsReward;
      await storageInstance.updateUserCredits(userId, newCredits);
      
      // Mark reward as claimed
      await storageInstance.updateVideoWatchHistory(watchHistory.id, { rewardClaimed: true });
      
      res.json({ 
        message: "Reward claimed successfully", 
        creditsEarned: rewardVideo.creditsReward,
        newCreditsBalance: newCredits 
      });
    } catch (error) {
      console.error('Claim reward error:', error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });

  // Get user's watch history
  app.get("/api/my-watch-history", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      const userId = req.user!.id;
      const storageInstance = await storage();
      const watchHistories = await storageInstance.getUserWatchHistories(userId);
      res.json(watchHistories);
    } catch (error) {
      console.error('Get watch history error:', error);
      res.status(500).json({ message: "Failed to get watch history" });
    }
  });

  // Admin endpoint to create reward videos
  app.post("/api/admin/reward-videos", async (req, res) => {
    try {
      const validatedData = insertRewardVideoSchema.parse(req.body);
      const storageInstance = await storage();
      const rewardVideo = await storageInstance.createRewardVideo(validatedData);
      res.status(201).json(rewardVideo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error('Create reward video error:', error);
      res.status(500).json({ message: "Failed to create reward video" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

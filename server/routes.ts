import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { db } from "./db";
import { insertVideoGenerationSchema, insertUserSchema, insertRewardVideoSchema, insertVideoWatchHistorySchema, type User, type ExternalApiKey, insertRewardClaimSchema, type RewardClaim, insertObjectReplacementSchema } from "@shared/schema";
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
const MODELSLAB_API_BASE = "https://modelslab.com/api/v6";
const MODELSLAB_API_KEY = "YP3Eius8kY2Vnh5qq8LJzMReG9hsfi1EyJRU5XwN8uac8P2EqPPu67Sv01MA";
const SEGMIND_API_BASE = "https://api.segmind.com/v1/topaz-video-upscale";
const PHOTAI_API_BASE = "https://prodapi.phot.ai/external/api/v2/user_activity";
const PHOTAI_API_KEY = "68a9325d0591f3b3f3563aba_b31009ca66406551632b_apyhitools";

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

// External API key authentication middleware
async function authenticateExternalApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (!apiKey.startsWith('stlix_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  try {
    const storageInstance = await storage();
    const externalApiKey = await storageInstance.getExternalApiKeyByKey(apiKey);
    
    if (!externalApiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!externalApiKey.isActive) {
      return res.status(401).json({ error: 'API key is deactivated' });
    }

    // Check monthly credit limit
    if (externalApiKey.creditsUsed >= externalApiKey.creditsLimit) {
      return res.status(429).json({ 
        error: 'Monthly credit limit exceeded',
        creditsUsed: externalApiKey.creditsUsed,
        creditsLimit: externalApiKey.creditsLimit
      });
    }

    (req as any).externalApiKey = externalApiKey;
    next();
  } catch (error) {
    console.error('External API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Get best available API key with credits using round-robin load balancing
let lastUsedApiKeyIndex = -1;
async function getBestApiKey(): Promise<{ key: string; apiKeyId?: string } | null> {
  try {
    console.log('🔍 Looking for API key with credits...');
    const storageInstance = await storage();
    const activeKeys = await storageInstance.getActiveApiKeys();
    console.log(`📋 Found ${activeKeys.length} active keys in database`);
    
    // If no active keys in database, check environment variables
    if (activeKeys.length === 0) {
      console.log('⚠️ No active keys in database, checking environment variables...');
      const envKey = process.env.VEOAPI_KEY || process.env.VEO3_API_KEY;
      if (envKey && envKey !== "your-api-key") {
        const credits = await checkApiCreditsWithCache(envKey);
        console.log(`🔋 Environment API key has ${credits} credits`);
        if (credits > 0) {
          console.log('✅ Using environment API key');
          return { key: envKey };
        }
      }
      console.log('❌ No valid environment API key found');
      return null;
    }
    
    // Check all keys and filter out those with 0 credits
    const validKeys = [];
    for (const dbApiKey of activeKeys) {
      const credits = await checkApiCreditsWithCache(dbApiKey.apiKey);
      console.log(`🔋 API key "${dbApiKey.name}" has ${credits} credits`);
      
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
    
    console.log(`✅ Found ${validKeys.length} valid keys with credits`);
    
    if (validKeys.length === 0) {
      console.log('❌ No valid keys with credits found');
      return null;
    }
    
    // Round-robin load balancing among valid keys
    lastUsedApiKeyIndex = (lastUsedApiKeyIndex + 1) % validKeys.length;
    const selectedKey = validKeys[lastUsedApiKeyIndex];
    
    console.log(`🎯 Selected API key "${selectedKey.name}" with ${selectedKey.currentCredits} credits (${lastUsedApiKeyIndex + 1}/${validKeys.length})`);
    
    return { key: selectedKey.apiKey, apiKeyId: selectedKey.id };
  } catch (error) {
    console.error('❌ Error getting API key:', error);
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
  
  // Configure PostgreSQL session store for persistent sessions
  const PgSession = ConnectPgSimple(session);
  
  // Session middleware with PostgreSQL store
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Allow HTTP for development and Render
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for better UX
      sameSite: 'lax' // More permissive for cross-origin
    },
    name: 'sessionId' // Custom session name
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

  // Mock function for LinkBulks API - replace with real API when available
  async function createLinkBulksLink(targetUrl: string): Promise<{ success: boolean; bypassUrl?: string; error?: string }> {
    try {
      // TODO: Replace this mock with actual LinkBulks API call
      // const response = await fetch('https://api.linkbulks.com/create', {
      //   method: 'POST',
      //   headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
      //   body: JSON.stringify({ url: targetUrl })
      // });
      
      // Mock response for now - generates a fake bypass URL
      const mockBypassUrl = `https://linkbulks.com/bypass/${Math.random().toString(36).substr(2, 8)}`;
      
      return { success: true, bypassUrl: mockBypassUrl };
    } catch (error) {
      return { success: false, error: 'Failed to create bypass link' };
    }
  }

  // Get credit - creates bypass link via LinkBulks
  app.post("/api/get-credit", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const storageInstance = await storage();
      
      // Create reward claim and get bypass link from LinkBulks
      const result = await storageInstance.createRewardClaim(req.user.id);
      
      res.json({
        success: true,
        bypassUrl: result.bypassUrl,
        message: "Link vượt đã được tạo! Hãy hoàn thành link để nhận 1 credit."
      });
    } catch (error) {
      console.error("Error creating reward claim:", error);
      res.status(500).json({ message: "Không thể tạo link vượt. Vui lòng thử lại." });
    }
  });

  // Get user's reward claims
  app.get("/api/reward-claims", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const storageInstance = await storage();
      const rewardClaims = await storageInstance.getRewardClaims(req.user.id);
      
      res.json(rewardClaims);
    } catch (error) {
      console.error('Get reward claims error:', error);
      res.status(500).json({ message: "Failed to fetch reward claims" });
    }
  });

  // Claim reward endpoint (visited after user completes bypass link)
  app.get("/api/claim-reward/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const storageInstance = await storage();
      
      const result = await storageInstance.claimReward(token);
      
      if (result.success) {
        // Redirect to success page or show success message
        res.send(`
          <html>
            <head>
              <title>Chúc mừng!</title>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                .success { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .success h1 { color: #4CAF50; margin-bottom: 20px; }
                .btn { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="success">
                <h1>🎉 Chúc mừng!</h1>
                <p>Bạn đã nhận được <strong>${result.rewardAmount} credit</strong>!</p>
                <p>Credit đã được cộng vào tài khoản của bạn.</p>
                <a href="/" class="btn">Về trang chủ</a>
              </div>
            </body>
          </html>
        `);
      } else {
        res.status(400).send(`
          <html>
            <head>
              <title>Link không hợp lệ</title>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                .error { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .error h1 { color: #f44336; margin-bottom: 20px; }
                .btn { background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="error">
                <h1>❌ Link không hợp lệ</h1>
                <p>Link này đã được sử dụng hoặc không tồn tại.</p>
                <a href="/" class="btn">Về trang chủ</a>
              </div>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      res.status(500).send(`
        <html>
          <head>
            <title>Lỗi hệ thống</title>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
              .error { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error h1 { color: #f44336; margin-bottom: 20px; }
              .btn { background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Lỗi hệ thống</h1>
              <p>Không thể xử lý yêu cầu. Vui lòng thử lại sau.</p>
              <a href="/" class="btn">Về trang chủ</a>
            </div>
          </body>
        </html>
      `);
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

      // Call STLix API
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

  // Generative Fill API
  app.post("/api/generative-fill", requireAuth, async (req: Request & { user?: User }, res: Response) => {
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
      
      // Ensure this is a generative fill request
      if (validatedData.type !== "generative-fill") {
        return res.status(400).json({ message: "Invalid request type" });
      }

      // Validate required fields for generative fill
      if (!validatedData.imageUrl || !validatedData.maskImageUrl || !validatedData.prompt) {
        return res.status(400).json({ 
          message: "Missing required fields: imageUrl, maskImageUrl, and prompt are required for generative fill" 
        });
      }

      // Credits for generative fill (similar to image-to-video)
      const totalCredits = 3; // Lower cost for generative fill

      // Create generation record  
      const generation = await storageInstance.createVideoGeneration({
        ...validatedData,
        userId: user.id,
      }, totalCredits);

      // Call ModelsLab API
      const modelsLabPayload = {
        key: MODELSLAB_API_KEY,
        prompt: validatedData.prompt,
        init_image: validatedData.imageUrl,
        mask_image: validatedData.maskImageUrl,
        strength: validatedData.strength || "1.0",
        samples: validatedData.samples || 1,
        model_id: validatedData.model || "lazymixv4-inpaint",
        steps: validatedData.steps || 31,
        scheduler: validatedData.scheduler || "DPMSolverMultistepScheduler"
      };

      console.log('🎨 Calling ModelsLab Generative Fill API with payload:', JSON.stringify(modelsLabPayload, null, 2));

      const response = await fetch(`${MODELSLAB_API_BASE}/images/inpaint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modelsLabPayload),
      });

      const data = await response.json();
      console.log('🎨 ModelsLab API Response:', JSON.stringify(data, null, 2));
      
      if (data.status !== "success") {
        await storageInstance.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: data.message || 'Generative fill failed',
        });
        throw new Error(data.message || 'Generative fill failed');
      }

      // Update generation with result URLs (ModelsLab returns immediate results)
      const resultUrls = data.output || [];
      await storageInstance.updateVideoGeneration(generation.id, {
        status: "completed",
        resultUrls,
        completedAt: new Date(),
      });

      res.json({ 
        generationId: generation.id,
        resultUrls,
        creditsUsed: totalCredits,
        status: "completed"
      });
    } catch (error) {
      console.error('Generative Fill error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate image" });
    }
  });

  // Object Replacement API (phot.ai integration)
  app.post("/api/object-replacement", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const storageInstance = await storage();
      const user = req.user;
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log('🔄 Object Replacement Request:', {
        body: req.body,
        user: user?.username,
        userId: user?.id
      });

      const validatedData = insertObjectReplacementSchema.parse(req.body);
      
      console.log('✅ Validation passed:', validatedData);
      
      // Credits for object replacement
      const totalCredits = 2; // Cost for object replacement
      
      // Check if user has enough credits
      if (user.credits < totalCredits) {
        return res.status(402).json({ 
          message: "Insufficient credits", 
          required: totalCredits, 
          available: user.credits 
        });
      }

      // Create object replacement record  
      const replacement = await storageInstance.createObjectReplacement({
        prompt: validatedData.prompt,
        fileName: validatedData.fileName,
        inputImageUrl: validatedData.inputImageUrl,
        maskImageBase64: validatedData.maskImageBase64,
        userId: user.id,
      });

      // Deduct credits from user
      await storageInstance.updateUserCredits(user.id, user.credits - totalCredits);

      // Get available PhotAI API keys
      const photaiKeys = await storageInstance.getPhotAIApiKeys();
      console.log(`🔑 Found ${photaiKeys.length} available PhotAI API keys`);
      
      if (photaiKeys.length === 0) {
        // Fallback to hardcoded API key if no keys configured
        console.log('⚠️ No PhotAI keys configured, using fallback key');
        const photAiPayload = {
          file_name: validatedData.fileName,
          prompt: validatedData.prompt,
          input_image_link: validatedData.inputImageUrl,
          mask_image: validatedData.maskImageBase64,
        };

        console.log('🔄 Calling phot.ai Object Replacer API with fallback key:', {
          file_name: photAiPayload.file_name,
          input_image_link: photAiPayload.input_image_link,
          mask_image: photAiPayload.mask_image.substring(0, 100) + '...'
        });

        const response = await fetch(`${PHOTAI_API_BASE}/object-replacer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': PHOTAI_API_KEY,
          },
          body: JSON.stringify(photAiPayload),
        });

        const data = await response.json();
        console.log('🔄 phot.ai API Response (fallback):', JSON.stringify(data, null, 2));
        
        if (!response.ok || data.error) {
          await storageInstance.updateObjectReplacement(replacement.id, {
            status: "failed",
            errorMessage: data.error || data.message || 'Object replacement failed',
          });
          // Refund credits
          await storageInstance.updateUserCredits(user.id, user.credits);
          throw new Error(data.error || data.message || 'Object replacement failed');
        }

        // Handle response
        if (data.status === "pending" && data.order_id) {
          await storageInstance.updateObjectReplacement(replacement.id, {
            status: "pending",
            errorMessage: JSON.stringify({ order_id: data.order_id, status: data.status, apiKeyUsed: "fallback" }),
          });

          res.json({
            replacementId: replacement.id,
            status: "pending",
            message: "Object replacement request submitted successfully",
            creditsUsed: totalCredits,
            order_id: data.order_id,
            apiKeyUsed: "fallback"
          });
          return;
        }
      }
      
      // Try each PhotAI API key until one works
      let lastError = null;
      let usedApiKey = null;
      
      for (const apiKeyRecord of photaiKeys) {
        if (apiKeyRecord.creditsUsed >= apiKeyRecord.creditsLimit) {
          console.log(`⚠️ PhotAI key "${apiKeyRecord.keyName}" has reached credit limit (${apiKeyRecord.creditsUsed}/${apiKeyRecord.creditsLimit})`);
          continue;
        }
        
        try {
          console.log(`🔑 Trying PhotAI key "${apiKeyRecord.keyName}" (${apiKeyRecord.creditsLimit - apiKeyRecord.creditsUsed} credits available)`);
          
          const photAiPayload = {
            file_name: validatedData.fileName,
            prompt: validatedData.prompt,
            input_image_link: validatedData.inputImageUrl,
            mask_image: validatedData.maskImageBase64,
          };

          console.log('🔄 Calling phot.ai Object Replacer API with payload:', {
            file_name: photAiPayload.file_name,
            input_image_link: photAiPayload.input_image_link,
            mask_image: photAiPayload.mask_image.substring(0, 100) + '...',
            apiKey: apiKeyRecord.keyName
          });

          const response = await fetch(`${PHOTAI_API_BASE}/object-replacer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKeyRecord.apiKey,
            },
            body: JSON.stringify(photAiPayload),
          });

          const data = await response.json();
          console.log(`🔄 phot.ai API Response (${apiKeyRecord.keyName}):`, JSON.stringify(data, null, 2));
          
          if (response.ok && !data.error) {
            // Success! Increment API key usage
            await storageInstance.incrementExternalApiKeyUsage(apiKeyRecord.id, 1);
            usedApiKey = apiKeyRecord;
            
            // Handle response
            if (data.status === "pending" && data.order_id) {
              await storageInstance.updateObjectReplacement(replacement.id, {
                status: "pending",
                errorMessage: JSON.stringify({ order_id: data.order_id, status: data.status, apiKeyUsed: apiKeyRecord.keyName }),
              });

              res.json({
                replacementId: replacement.id,
                status: "pending",
                message: "Object replacement request submitted successfully",
                creditsUsed: totalCredits,
                order_id: data.order_id,
                apiKeyUsed: apiKeyRecord.keyName
              });
              return;
            } else if (data.result_url || data.output_url || data.image_url) {
              // Immediate result
              const resultImageUrl = data.result_url || data.output_url || data.image_url;
              await storageInstance.updateObjectReplacement(replacement.id, {
                status: "completed",
                resultImageUrl,
                completedAt: new Date(),
              });

              res.json({ 
                replacementId: replacement.id,
                resultImageUrl,
                creditsUsed: totalCredits,
                status: "completed",
                apiKeyUsed: apiKeyRecord.keyName
              });
              return;
            }
          } else {
            lastError = data.error || data.message || 'Unknown API error';
            console.log(`❌ PhotAI key "${apiKeyRecord.keyName}" failed:`, lastError);
            continue;
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Network error';
          console.log(`❌ PhotAI key "${apiKeyRecord.keyName}" network error:`, lastError);
          continue;
        }
      }
      
      // If we get here, all API keys failed
      await storageInstance.updateObjectReplacement(replacement.id, {
        status: "failed",
        errorMessage: lastError || 'All PhotAI API keys failed',
      });
      // Refund credits
      await storageInstance.updateUserCredits(user.id, user.credits);
      throw new Error(lastError || 'All PhotAI API keys failed');

    } catch (error) {
      console.error('Object Replacement error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to replace object" });
    }
  });

  // Get user's object replacements
  app.get("/api/object-replacements", requireAuth, async (req: Request & { user?: User }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const storageInstance = await storage();
      let replacements = await storageInstance.getUserObjectReplacements(req.user.id);
      
      // Check status for pending replacements
      for (const replacement of replacements) {
        if ((replacement.status === "pending" || replacement.status === "processing") && replacement.id) {
          try {
            console.log(`🔍 Checking status for object replacement ${replacement.id}`);
            
            // Extract order_id from result or error message if stored
            let orderId = null;
            if (replacement.errorMessage && replacement.errorMessage.includes('"order_id"')) {
              try {
                const errorData = JSON.parse(replacement.errorMessage);
                orderId = errorData.order_id;
              } catch (e) {
                // Try to extract from different format
              }
            }
            
            if (orderId) {
              console.log(`🔍 Found order_id ${orderId} for replacement ${replacement.id}`);
              
              // Check status with phot.ai API - temporarily disabled due to incorrect endpoint
              console.log(`⚠️ Status checking temporarily disabled for order ${orderId}`);
              
              // For now, mark long-pending orders as failed to unblock users
              const createdTime = new Date(replacement.createdAt!).getTime();
              const currentTime = new Date().getTime();
              const timeDiffMinutes = (currentTime - createdTime) / (1000 * 60);
              
              if (timeDiffMinutes > 10) { // If pending for more than 10 minutes
                await storageInstance.updateObjectReplacement(replacement.id, {
                  status: "failed",
                  errorMessage: "Processing timeout - PhotAI API status checking endpoint unavailable",
                  completedAt: new Date(),
                });
                console.log(`⏰ Marked replacement ${replacement.id} as failed due to timeout`);
                continue;
              }
              
              // Status checking temporarily disabled until we find the correct PhotAI endpoint
              console.log(`📋 Replacement ${replacement.id} still pending - waiting for PhotAI response`);
            }
          } catch (error) {
            console.error(`❌ Error checking status for replacement ${replacement.id}:`, error);
          }
        }
      }
      
      // Fetch updated replacements
      replacements = await storageInstance.getUserObjectReplacements(req.user.id);
      
      res.json(replacements);
    } catch (error) {
      console.error('Error fetching object replacements:', error);
      res.status(500).json({ message: "Failed to fetch object replacements" });
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
          
          // Check if this is a STLix Cao cấp model and needs enhancement
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

  // Check VEO3 Premium model status
  app.get("/api/model-status/veo3-premium", async (req, res) => {
    try {
      const storageInstance = await storage();
      const setting = await storageInstance.getSetting("VEO3_PREMIUM_ENABLED");
      const isEnabled = setting?.value === "true";
      
      res.json({ 
        enabled: isEnabled,
        status: isEnabled ? "active" : "maintenance"
      });
    } catch (error) {
      console.error('Model status check error:', error);
      res.status(500).json({ message: "Failed to check model status" });
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

  // Admin endpoints for managing external API keys
  app.get("/api/admin/external-api-keys", async (req, res) => {
    try {
      const storageInstance = await storage();
      const externalApiKeys = await storageInstance.getUserExternalApiKeys('admin'); // Get all for admin view
      res.json(externalApiKeys);
    } catch (error) {
      console.error('Get external API keys error:', error);
      res.status(500).json({ message: "Failed to get external API keys" });
    }
  });

  app.post("/api/admin/external-api-keys", async (req, res) => {
    try {
      const { keyName, creditsLimit = 100, userId = null } = req.body;
      
      if (!keyName || typeof keyName !== 'string') {
        return res.status(400).json({ message: "keyName is required" });
      }
      
      const storageInstance = await storage();
      const externalApiKey = await storageInstance.createExternalApiKey({
        keyName,
        apiType: "veo3" as const,
        userId: userId || null,
        creditsLimit: Number(creditsLimit) || 100,
        isActive: true
      });
      
      res.status(201).json(externalApiKey);
    } catch (error) {
      console.error('Create external API key error:', error);
      res.status(500).json({ message: "Failed to create external API key" });
    }
  });

  app.patch("/api/admin/external-api-keys/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, creditsLimit, keyName } = req.body;
      
      const updates: any = {};
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof creditsLimit === 'number') updates.creditsLimit = creditsLimit;
      if (typeof keyName === 'string') updates.keyName = keyName;
      
      const storageInstance = await storage();
      const updatedKey = await storageInstance.updateExternalApiKey(id, updates);
      
      if (!updatedKey) {
        return res.status(404).json({ message: "External API key not found" });
      }
      
      res.json(updatedKey);
    } catch (error) {
      console.error('Update external API key error:', error);
      res.status(500).json({ message: "Failed to update external API key" });
    }
  });

  // PhotAI API Keys Management
  app.get("/api/admin/photai-api-keys", async (req, res) => {
    try {
      const storageInstance = await storage();
      // Get all PhotAI API keys using the dedicated method
      const photaiKeys = await storageInstance.getPhotAIApiKeys();
      res.json(photaiKeys);
    } catch (error) {
      console.error('Get PhotAI API keys error:', error);
      res.status(500).json({ message: "Failed to get PhotAI API keys" });
    }
  });

  app.post("/api/admin/photai-api-keys", async (req, res) => {
    try {
      const { keyName, apiKey, creditsLimit = 100 } = req.body;
      
      if (!keyName || typeof keyName !== 'string') {
        return res.status(400).json({ message: "keyName is required" });
      }
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ message: "apiKey is required" });
      }
      
      // Check if PhotAI API key is valid by testing it
      try {
        // Use the correct PhotAI endpoint for validation
        const testResponse = await fetch('https://prodapi.phot.ai/external/api/v2/user_activity', {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        });
        
        if (!testResponse.ok) {
          console.log(`PhotAI API key validation failed: ${testResponse.status} ${testResponse.statusText}`);
          return res.status(400).json({ message: `Invalid PhotAI API key - Status: ${testResponse.status}` });
        }

        const responseData = await testResponse.json();
        console.log('PhotAI API key validation successful:', responseData);
      } catch (error: any) {
        console.error('PhotAI API key validation error:', error);
        return res.status(400).json({ message: `Failed to validate PhotAI API key: ${error?.message || 'Unknown error'}` });
      }
      
      const storageInstance = await storage();
      // Store as external API key with metadata to identify as PhotAI
      const photaiApiKey = await storageInstance.createExternalApiKey({
        keyName: `[PhotAI] ${keyName}`,
        apiType: "photai" as const,
        userId: null,
        creditsLimit: Number(creditsLimit) || 100,
        isActive: true
      });
      
      // Override the generated API key with the actual PhotAI key
      await storageInstance.updateExternalApiKey(photaiApiKey.id, {
        apiKey: apiKey
      });
      
      res.status(201).json({ ...photaiApiKey, apiKey });
    } catch (error) {
      console.error('Create PhotAI API key error:', error);
      res.status(500).json({ message: "Failed to create PhotAI API key" });
    }
  });

  app.patch("/api/admin/photai-api-keys/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, creditsLimit, keyName } = req.body;
      
      const updates: any = {};
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof creditsLimit === 'number') updates.creditsLimit = creditsLimit;
      if (typeof keyName === 'string') updates.keyName = `[PhotAI] ${keyName}`;
      
      const storageInstance = await storage();
      const updatedKey = await storageInstance.updateExternalApiKey(id, updates);
      
      if (!updatedKey) {
        return res.status(404).json({ message: "PhotAI API key not found" });
      }
      
      res.json(updatedKey);
    } catch (error) {
      console.error('Update PhotAI API key error:', error);
      res.status(500).json({ message: "Failed to update PhotAI API key" });
    }
  });

  app.delete("/api/admin/photai-api-keys/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const storageInstance = await storage();
      const success = await storageInstance.deleteExternalApiKey(id);
      
      if (!success) {
        return res.status(404).json({ message: "PhotAI API key not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete PhotAI API key error:', error);
      res.status(500).json({ message: "Failed to delete PhotAI API key" });
    }
  });

  app.post("/api/admin/external-api-keys/:id/reset-usage", async (req, res) => {
    try {
      const { id } = req.params;
      
      const storageInstance = await storage();
      const updatedKey = await storageInstance.resetMonthlyUsage(id);
      
      if (!updatedKey) {
        return res.status(404).json({ message: "External API key not found" });
      }
      
      res.json(updatedKey);
    } catch (error) {
      console.error('Reset external API key usage error:', error);
      res.status(500).json({ message: "Failed to reset usage" });
    }
  });

  // External API endpoints
  // Text-to-video generation for external users
  app.post("/api/external/generate/text-to-video", authenticateExternalApiKey, async (req: Request & { externalApiKey?: ExternalApiKey }, res: Response) => {
    try {
      const { prompt, aspectRatio = "16:9", watermark } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt is required and must be a string' });
      }
      
      const externalApiKey = req.externalApiKey!;
      const creditsNeeded = 5; // Text-to-video costs 5 credits
      
      if (externalApiKey.creditsUsed + creditsNeeded > externalApiKey.creditsLimit) {
        return res.status(429).json({
          error: 'Insufficient credits',
          creditsUsed: externalApiKey.creditsUsed,
          creditsLimit: externalApiKey.creditsLimit,
          creditsNeeded
        });
      }
      
      const storageInstance = await storage();
      
      // Create video generation record
      const generation = await storageInstance.createVideoGeneration({
        userId: externalApiKey.userId,
        type: "text-to-video",
        prompt,
        aspectRatio,
        model: "veo3_fast",
        watermark,
        hdGeneration: false
      }, creditsNeeded);
      
      // Increment API key usage
      await storageInstance.incrementExternalApiKeyUsage(externalApiKey.id, creditsNeeded);
      
      // Get best internal API key for VEO3 API
      const internalApiKey = await getBestApiKey();
      if (!internalApiKey) {
        await storageInstance.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: "No API key with sufficient credits available"
        });
        return res.status(503).json({ error: 'Service temporarily unavailable' });
      }
      
      // Submit to VEO3 API
      try {
        const response = await fetch(`${VEO3_API_BASE}/text-to-video`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${internalApiKey.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: prompt,
            aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9",
            model: "veo3"
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'VEO3 API request failed');
        }
        
        await storageInstance.updateVideoGeneration(generation.id, {
          taskId: data.data.task_id,
          status: "processing"
        });
        
        res.json({
          success: true,
          taskId: data.data.task_id,
          generationId: generation.id,
          status: "processing",
          creditsUsed: creditsNeeded
        });
        
      } catch (error: any) {
        console.error('VEO3 API error:', error);
        await storageInstance.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: error.message
        });
        res.status(500).json({ error: 'Failed to submit video generation request' });
      }
      
    } catch (error: any) {
      console.error('External text-to-video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Image-to-video generation for external users
  app.post("/api/external/generate/image-to-video", authenticateExternalApiKey, upload.single('image'), async (req: Request & { externalApiKey?: ExternalApiKey }, res: Response) => {
    try {
      const { prompt, aspectRatio = "16:9" } = req.body;
      const imageFile = req.file;
      
      if (!imageFile) {
        return res.status(400).json({ error: 'image file is required' });
      }
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt is required and must be a string' });
      }
      
      const externalApiKey = req.externalApiKey!;
      const creditsNeeded = 8; // Image-to-video costs 8 credits
      
      if (externalApiKey.creditsUsed + creditsNeeded > externalApiKey.creditsLimit) {
        return res.status(429).json({
          error: 'Insufficient credits',
          creditsUsed: externalApiKey.creditsUsed,
          creditsLimit: externalApiKey.creditsLimit,
          creditsNeeded
        });
      }
      
      const storageInstance = await storage();
      
      // Create video generation record
      const generation = await storageInstance.createVideoGeneration({
        userId: externalApiKey.userId,
        type: "image-to-video",
        prompt,
        aspectRatio,
        model: "veo3_fast",
        hdGeneration: false
      }, creditsNeeded);
      
      // Increment API key usage
      await storageInstance.incrementExternalApiKeyUsage(externalApiKey.id, creditsNeeded);
      
      // Get best internal API key for VEO3 API
      const internalApiKey = await getBestApiKey();
      if (!internalApiKey) {
        await storageInstance.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: "No API key with sufficient credits available"
        });
        return res.status(503).json({ error: 'Service temporarily unavailable' });
      }
      
      try {
        // First upload the image
        const formData = new FormData();
        formData.append('file', imageFile.buffer, {
          filename: 'image.jpg',
          contentType: imageFile.mimetype
        });
        
        const uploadResponse = await fetch(`${VEO3_UPLOAD_BASE}/file/upload`, {
          method: "POST",
          body: formData as any
        });
        
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadData.message || 'Image upload failed');
        }
        
        const imageUrl = uploadData.data.url;
        
        // Update generation with image URL
        await storageInstance.updateVideoGeneration(generation.id, {
          imageUrl
        });
        
        // Submit image-to-video request
        const response = await fetch(`${VEO3_API_BASE}/image-to-video`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${internalApiKey.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: imageUrl,
            text: prompt,
            aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9",
            model: "veo3"
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'VEO3 API request failed');
        }
        
        await storageInstance.updateVideoGeneration(generation.id, {
          taskId: data.data.task_id,
          status: "processing"
        });
        
        res.json({
          success: true,
          taskId: data.data.task_id,
          generationId: generation.id,
          status: "processing",
          creditsUsed: creditsNeeded,
          imageUrl
        });
        
      } catch (error: any) {
        console.error('VEO3 API error:', error);
        await storageInstance.updateVideoGeneration(generation.id, {
          status: "failed",
          errorMessage: error.message
        });
        res.status(500).json({ error: 'Failed to submit video generation request' });
      }
      
    } catch (error: any) {
      console.error('External image-to-video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Check generation status for external users
  app.get("/api/external/status/:taskId", authenticateExternalApiKey, async (req: Request & { externalApiKey?: ExternalApiKey }, res: Response) => {
    try {
      const { taskId } = req.params;
      const externalApiKey = req.externalApiKey!;
      
      const storageInstance = await storage();
      const generation = await storageInstance.getVideoGenerationByTaskId(taskId);
      
      if (!generation) {
        return res.status(404).json({ error: 'Generation not found' });
      }
      
      // Ensure the generation belongs to this API key's user
      if (generation.userId !== externalApiKey.userId) {
        return res.status(404).json({ error: 'Generation not found' });
      }
      
      // If generation is still processing, check VEO3 API for updates
      if (generation.status === "processing") {
        const internalApiKey = await getBestApiKey();
        if (internalApiKey) {
          try {
            const response = await fetch(`${VEO3_API_BASE}/query/${generation.taskId}`, {
              headers: {
                "Authorization": `Bearer ${internalApiKey.key}`,
              },
            });
            
            const data = await response.json();
            
            if (response.ok && data.data?.status) {
              if (data.data.status === "completed" && data.data.output?.url) {
                await storageInstance.updateVideoGeneration(generation.id, {
                  status: "completed",
                  resultUrls: [data.data.output.url],
                  completedAt: new Date()
                });
                generation.status = "completed";
                generation.resultUrls = [data.data.output.url];
              } else if (data.data.status === "failed") {
                await storageInstance.updateVideoGeneration(generation.id, {
                  status: "failed",
                  errorMessage: data.data.message || "Generation failed"
                });
                generation.status = "failed";
                generation.errorMessage = data.data.message || "Generation failed";
              }
            }
          } catch (error) {
            console.error('Error checking VEO3 status:', error);
          }
        }
      }
      
      res.json({
        taskId: generation.taskId,
        status: generation.status,
        resultUrls: generation.resultUrls,
        errorMessage: generation.errorMessage,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt
      });
      
    } catch (error: any) {
      console.error('External status check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get API key usage stats for external users
  app.get("/api/external/usage", authenticateExternalApiKey, async (req: Request & { externalApiKey?: ExternalApiKey }, res: Response) => {
    try {
      const externalApiKey = req.externalApiKey!;
      
      res.json({
        creditsUsed: externalApiKey.creditsUsed,
        creditsLimit: externalApiKey.creditsLimit,
        creditsRemaining: externalApiKey.creditsLimit - externalApiKey.creditsUsed,
        lastUsed: externalApiKey.lastUsed,
        lastResetAt: externalApiKey.lastResetAt
      });
      
    } catch (error: any) {
      console.error('External usage check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import { type User, type InsertUser, type VideoGeneration, type InsertVideoGeneration, type ApiKey, type InsertApiKey, type Settings, type InsertSettings, type RewardVideo, type InsertRewardVideo, type VideoWatchHistory, type InsertVideoWatchHistory, type ExternalApiKey, type InsertExternalApiKey, type RewardClaim, type InsertRewardClaim, type DailyLinkUsage, type InsertDailyLinkUsage, type ObjectReplacement, type InsertObjectReplacement, type PhotoaiOperation, type InsertPhotaiOperation } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, videoGenerations, apiKeys, settings, rewardVideos, videoWatchHistory, externalApiKeys, rewardClaims, dailyLinkUsage, objectReplacements, photaiOperations } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByDeviceId(deviceId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  validateUserPassword(username: string, password: string): Promise<User | null>;
  checkDeviceRegistration(deviceId: string): Promise<{ canRegister: boolean; reason?: string }>;
  
  createVideoGeneration(generation: InsertVideoGeneration, creditsUsed?: number): Promise<VideoGeneration>;
  updateVideoGeneration(id: string, updates: Partial<VideoGeneration>): Promise<VideoGeneration | undefined>;
  getVideoGeneration(id: string): Promise<VideoGeneration | undefined>;
  getVideoGenerationByTaskId(taskId: string): Promise<VideoGeneration | undefined>;
  getUserVideoGenerations(userId: string): Promise<VideoGeneration[]>;
  
  // API Key methods
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getAllApiKeys(): Promise<ApiKey[]>;
  getActiveApiKeys(): Promise<ApiKey[]>;
  deleteApiKey(id: string): Promise<boolean>;
  
  // Settings methods
  getSetting(key: string): Promise<Settings | undefined>;
  setSetting(key: string, value: string): Promise<Settings>;
  getAllSettings(): Promise<Settings[]>;
  
  // Reward Video methods
  createRewardVideo(rewardVideo: InsertRewardVideo): Promise<RewardVideo>;
  getRewardVideo(id: string): Promise<RewardVideo | undefined>;
  getAllActiveRewardVideos(): Promise<RewardVideo[]>;
  updateRewardVideo(id: string, updates: Partial<RewardVideo>): Promise<RewardVideo | undefined>;
  
  // Video Watch History methods
  createVideoWatchHistory(watchHistory: InsertVideoWatchHistory): Promise<VideoWatchHistory>;
  updateVideoWatchHistory(id: string, updates: Partial<VideoWatchHistory>): Promise<VideoWatchHistory | undefined>;
  getVideoWatchHistory(userId: string, rewardVideoId: string): Promise<VideoWatchHistory | undefined>;
  getUserWatchHistories(userId: string): Promise<VideoWatchHistory[]>;
  
  // External API Key methods
  createExternalApiKey(apiKey: InsertExternalApiKey): Promise<ExternalApiKey>;
  getExternalApiKeyByKey(apiKey: string): Promise<ExternalApiKey | undefined>;
  updateExternalApiKey(id: string, updates: Partial<ExternalApiKey>): Promise<ExternalApiKey | undefined>;
  getUserExternalApiKeys(userId: string): Promise<ExternalApiKey[]>;
  incrementExternalApiKeyUsage(id: string, creditsUsed: number): Promise<ExternalApiKey | undefined>;
  resetMonthlyUsage(id: string): Promise<ExternalApiKey | undefined>;
  
  // Reward Claim methods (LinkBulks integration)
  createRewardClaim(userId: string): Promise<{ claimToken: string; bypassUrl: string; serviceUsed: string } | { error: string }>;
  claimReward(claimToken: string): Promise<{ success: boolean; userId?: string; rewardAmount?: number }>;
  getRewardClaims(userId: string): Promise<RewardClaim[]>;
  getDailyLinkUsageStats(): Promise<{ linkbulksUsed: number; link4mUsed: number; linkbulksLimit: number; link4mLimit: number; resetTime: string }>;
  
  // Object Replacement methods (phot.ai integration)
  createObjectReplacement(replacement: InsertObjectReplacement, userId: string): Promise<ObjectReplacement>;
  updateObjectReplacement(id: string, updates: Partial<ObjectReplacement>): Promise<ObjectReplacement | undefined>;
  getObjectReplacement(id: string): Promise<ObjectReplacement | undefined>;
  getUserObjectReplacements(userId: string): Promise<ObjectReplacement[]>;
  
  // Phot.AI Operations methods (general tools)
  createPhotaiOperation(operation: InsertPhotaiOperation, userId: string): Promise<PhotoaiOperation>;
  updatePhotaiOperation(id: string, updates: Partial<PhotoaiOperation>): Promise<PhotoaiOperation | undefined>;
  getPhotaiOperation(id: string): Promise<PhotoaiOperation | undefined>;
  getUserPhotaiOperations(userId: string): Promise<PhotoaiOperation[]>;
  
  // Get PhotAI API keys (shared by both object replacement and general operations)
  getPhotAIApiKeys(): Promise<ExternalApiKey[]>;
  deleteExternalApiKey(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoGenerations: Map<string, VideoGeneration>;
  private apiKeys: Map<string, ApiKey>;
  private settings: Map<string, Settings>;
  private rewardVideos: Map<string, RewardVideo>;
  private videoWatchHistories: Map<string, VideoWatchHistory>;
  private externalApiKeys: Map<string, ExternalApiKey>;
  private rewardClaims: Map<string, RewardClaim>;
  private dailyLinkUsage: Map<string, DailyLinkUsage>;
  private objectReplacements: Map<string, ObjectReplacement>;
  private photaiOperations: Map<string, PhotoaiOperation>;

  constructor() {
    this.users = new Map();
    this.videoGenerations = new Map();
    this.apiKeys = new Map();
    this.settings = new Map();
    this.rewardVideos = new Map();
    this.videoWatchHistories = new Map();
    this.externalApiKeys = new Map();
    this.rewardClaims = new Map();
    this.dailyLinkUsage = new Map();
    this.objectReplacements = new Map();
    this.photaiOperations = new Map();
    
    // Create a default user for demo purposes
    const defaultUser: User = {
      id: "default-user-id",
      username: "demo-user",
      password: "password",
      credits: 1,
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const user: User = { 
      ...insertUser, 
      id, 
      password: hashedPassword, 
      credits: 1,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async validateUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async updateUserCredits(userId: string, credits: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const updatedUser = { ...user, credits };
      this.users.set(userId, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async getUserByDeviceId(deviceId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.deviceId === deviceId);
  }

  async checkDeviceRegistration(deviceId: string): Promise<{ canRegister: boolean; reason?: string }> {
    if (!deviceId) {
      return { 
        canRegister: false, 
        reason: "Device fingerprint không hợp lệ. Vui lòng bật JavaScript và thử lại." 
      };
    }

    const existingUser = await this.getUserByDeviceId(deviceId);
    if (existingUser) {
      return { 
        canRegister: false, 
        reason: "Thiết bị này đã đăng ký tài khoản. Mỗi thiết bị chỉ được phép tạo một tài khoản duy nhất." 
      };
    }

    return { canRegister: true };
  }

  async createVideoGeneration(generation: InsertVideoGeneration, creditsUsed: number = 5): Promise<VideoGeneration> {
    const id = randomUUID();
    const taskId = randomUUID();
    const videoGeneration: VideoGeneration = {
      ...generation,
      id,
      taskId,
      userId: generation.userId || null,
      imageUrl: generation.imageUrl || null,
      maskImageUrl: generation.maskImageUrl || null,
      strength: generation.strength || null,
      samples: generation.samples || null,
      steps: generation.steps || null,
      scheduler: generation.scheduler || null,
      watermark: generation.watermark || null,
      hdGeneration: generation.hdGeneration || false,
      creditsUsed,
      status: "pending",
      resultUrls: null,
      hdResultUrl: null,
      errorMessage: null,
      apiKeyId: generation.apiKeyId || null,
      // Enhancement fields with default values
      enhancementStatus: "none",
      enhancedResultUrls: null,
      enhancementStartedAt: null,
      enhancementCompletedAt: null,
      enhancementErrorMessage: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.videoGenerations.set(id, videoGeneration);
    return videoGeneration;
  }

  async updateVideoGeneration(id: string, updates: Partial<VideoGeneration>): Promise<VideoGeneration | undefined> {
    const generation = this.videoGenerations.get(id);
    if (generation) {
      const updatedGeneration = { ...generation, ...updates };
      this.videoGenerations.set(id, updatedGeneration);
      return updatedGeneration;
    }
    return undefined;
  }

  async getVideoGeneration(id: string): Promise<VideoGeneration | undefined> {
    return this.videoGenerations.get(id);
  }

  async getVideoGenerationByTaskId(taskId: string): Promise<VideoGeneration | undefined> {
    return Array.from(this.videoGenerations.values()).find(
      (generation) => generation.taskId === taskId,
    );
  }

  async getUserVideoGenerations(userId: string): Promise<VideoGeneration[]> {
    return Array.from(this.videoGenerations.values())
      .filter((generation) => generation.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  // API Key methods
  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    const apiKey: ApiKey = {
      ...insertApiKey,
      id,
      credits: 0,
      isActive: insertApiKey.isActive ?? true,
      lastChecked: null,
      createdAt: new Date(),
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      const updatedApiKey = { ...apiKey, ...updates };
      this.apiKeys.set(id, updatedApiKey);
      return updatedApiKey;
    }
    return undefined;
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    return this.apiKeys.get(id);
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getActiveApiKeys(): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values())
      .filter((key) => key.isActive && key.credits > 0)
      .sort((a, b) => b.credits - a.credits); // Sort by credits desc
  }

  async deleteApiKey(id: string): Promise<boolean> {
    return this.apiKeys.delete(id);
  }

  // Settings methods
  async getSetting(key: string): Promise<Settings | undefined> {
    return this.settings.get(key);
  }

  async setSetting(key: string, value: string): Promise<Settings> {
    const setting: Settings = {
      id: randomUUID(),
      key,
      value,
      updatedAt: new Date(),
    };
    this.settings.set(key, setting);
    return setting;
  }

  async getAllSettings(): Promise<Settings[]> {
    return Array.from(this.settings.values());
  }

  // Reward Video methods
  async createRewardVideo(insertRewardVideo: InsertRewardVideo): Promise<RewardVideo> {
    const id = randomUUID();
    const rewardVideo: RewardVideo = {
      ...insertRewardVideo,
      id,
      description: insertRewardVideo.description || null,
      thumbnailUrl: insertRewardVideo.thumbnailUrl || null,
      creditsReward: insertRewardVideo.creditsReward ?? 1,
      isActive: insertRewardVideo.isActive ?? true,
      createdAt: new Date(),
    };
    this.rewardVideos.set(id, rewardVideo);
    return rewardVideo;
  }

  async getRewardVideo(id: string): Promise<RewardVideo | undefined> {
    return this.rewardVideos.get(id);
  }

  async getAllActiveRewardVideos(): Promise<RewardVideo[]> {
    return Array.from(this.rewardVideos.values())
      .filter((video) => video.isActive)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async updateRewardVideo(id: string, updates: Partial<RewardVideo>): Promise<RewardVideo | undefined> {
    const rewardVideo = this.rewardVideos.get(id);
    if (rewardVideo) {
      const updatedVideo = { ...rewardVideo, ...updates };
      this.rewardVideos.set(id, updatedVideo);
      return updatedVideo;
    }
    return undefined;
  }

  // Video Watch History methods
  async createVideoWatchHistory(insertWatchHistory: InsertVideoWatchHistory): Promise<VideoWatchHistory> {
    const id = randomUUID();
    const watchHistory: VideoWatchHistory = {
      ...insertWatchHistory,
      id,
      watchedSeconds: insertWatchHistory.watchedSeconds ?? 0,
      isCompleted: insertWatchHistory.isCompleted ?? false,
      rewardClaimed: insertWatchHistory.rewardClaimed ?? false,
      startedAt: new Date(),
      completedAt: null,
    };
    this.videoWatchHistories.set(id, watchHistory);
    return watchHistory;
  }

  async updateVideoWatchHistory(id: string, updates: Partial<VideoWatchHistory>): Promise<VideoWatchHistory | undefined> {
    const watchHistory = this.videoWatchHistories.get(id);
    if (watchHistory) {
      const updatedHistory = { ...watchHistory, ...updates };
      this.videoWatchHistories.set(id, updatedHistory);
      return updatedHistory;
    }
    return undefined;
  }

  async getVideoWatchHistory(userId: string, rewardVideoId: string): Promise<VideoWatchHistory | undefined> {
    return Array.from(this.videoWatchHistories.values()).find(
      (history) => history.userId === userId && history.rewardVideoId === rewardVideoId,
    );
  }

  async getUserWatchHistories(userId: string): Promise<VideoWatchHistory[]> {
    return Array.from(this.videoWatchHistories.values())
      .filter((history) => history.userId === userId)
      .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());
  }

  // External API Key methods
  async createExternalApiKey(insertApiKey: InsertExternalApiKey): Promise<ExternalApiKey> {
    const id = randomUUID();
    const apiKey = `stlix_${randomUUID().replace(/-/g, '')}`;
    const externalApiKey: ExternalApiKey = {
      ...insertApiKey,
      id,
      apiKey,
      userId: insertApiKey.userId || null,
      isActive: insertApiKey.isActive ?? true,
      creditsLimit: insertApiKey.creditsLimit ?? 100,
      creditsUsed: 0,
      lastUsed: null,
      createdAt: new Date(),
      lastResetAt: new Date(),
    };
    this.externalApiKeys.set(id, externalApiKey);
    return externalApiKey;
  }

  async getExternalApiKeyByKey(apiKey: string): Promise<ExternalApiKey | undefined> {
    return Array.from(this.externalApiKeys.values()).find(key => key.apiKey === apiKey);
  }

  async updateExternalApiKey(id: string, updates: Partial<ExternalApiKey>): Promise<ExternalApiKey | undefined> {
    const apiKey = this.externalApiKeys.get(id);
    if (apiKey) {
      const updatedApiKey = { ...apiKey, ...updates };
      this.externalApiKeys.set(id, updatedApiKey);
      return updatedApiKey;
    }
    return undefined;
  }

  async getUserExternalApiKeys(userId: string): Promise<ExternalApiKey[]> {
    return Array.from(this.externalApiKeys.values())
      .filter(apiKey => apiKey.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async incrementExternalApiKeyUsage(id: string, creditsUsed: number): Promise<ExternalApiKey | undefined> {
    const apiKey = this.externalApiKeys.get(id);
    if (apiKey) {
      const updatedApiKey = { 
        ...apiKey, 
        creditsUsed: apiKey.creditsUsed + creditsUsed,
        lastUsed: new Date()
      };
      this.externalApiKeys.set(id, updatedApiKey);
      return updatedApiKey;
    }
    return undefined;
  }

  async deleteExternalApiKey(id: string): Promise<boolean> {
    return this.externalApiKeys.delete(id);
  }

  async getPhotAIApiKeys(): Promise<ExternalApiKey[]> {
    return Array.from(this.externalApiKeys.values())
      .filter(apiKey => apiKey.keyName.startsWith('[PhotAI]'))
      .filter(apiKey => apiKey.isActive)
      .sort((a, b) => (b.creditsLimit - b.creditsUsed) - (a.creditsLimit - a.creditsUsed)); // Sort by available credits
  }

  async resetMonthlyUsage(id: string): Promise<ExternalApiKey | undefined> {
    const apiKey = this.externalApiKeys.get(id);
    if (apiKey) {
      const updatedApiKey = { 
        ...apiKey, 
        creditsUsed: 0,
        lastResetAt: new Date()
      };
      this.externalApiKeys.set(id, updatedApiKey);
      return updatedApiKey;
    }
    return undefined;
  }

  // Reward Claim methods (LinkBulks/Link4m integration)
  async createRewardClaim(userId: string): Promise<{ claimToken: string; bypassUrl: string; serviceUsed: string } | { error: string }> {
    // Check if credit system is available
    const canCreateLink = await this.canCreateRewardLink();
    if (!canCreateLink.allowed) {
      return { error: canCreateLink.reason };
    }

    // Generate unique claim token
    const claimToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Create claim URL that points to our claim endpoint
    // Support multiple hosting platforms
    let baseUrl: string;
    
    if (process.env.REPLIT_DOMAINS) {
      // Replit environment
      baseUrl = process.env.REPLIT_DOMAINS.split(',')[0];
    } else if (process.env.RENDER_EXTERNAL_URL) {
      // Render environment
      baseUrl = process.env.RENDER_EXTERNAL_URL.replace('https://', '').replace('http://', '');
    } else if (process.env.RAILWAY_STATIC_URL) {
      // Railway environment
      baseUrl = process.env.RAILWAY_STATIC_URL.replace('https://', '').replace('http://', '');
    } else if (process.env.VERCEL_URL) {
      // Vercel environment
      baseUrl = process.env.VERCEL_URL;
    } else if (process.env.APP_URL) {
      // Custom APP_URL environment variable
      baseUrl = process.env.APP_URL.replace('https://', '').replace('http://', '');
    } else {
      // Local development fallback
      baseUrl = 'localhost:5000';
    }
    
    const claimUrl = `https://${baseUrl}/api/claim-reward/${claimToken}`;
    
    // Determine which service to use based on daily limits
    const serviceToUse = await this.determineServiceToUse();
    let bypassUrl: string;
    
    try {
      if (serviceToUse === "linkbulks") {
        bypassUrl = await this.callLinkBulksAPI(claimUrl);
        await this.incrementDailyUsage("linkbulks");
      } else if (serviceToUse === "link4m") {
        bypassUrl = await this.callLink4mAPI(claimUrl);
        await this.incrementDailyUsage("link4m");
      } else {
        return { error: "Hệ thống nhận credit đã đạt giới hạn hàng ngày. Vui lòng thử lại vào ngày mai." };
      }
    } catch (error) {
      console.error(`Error calling ${serviceToUse} API:`, error);
      return { error: "Không thể tạo link vượt. Vui lòng thử lại sau." };
    }
    
    const id = randomUUID();
    const claim: RewardClaim = {
      id,
      userId,
      bypassUrl,
      claimToken,
      serviceUsed: serviceToUse,
      rewardAmount: 1,
      isClaimed: false,
      createdAt: new Date(),
      claimedAt: null,
    };
    
    this.rewardClaims.set(id, claim);
    return { claimToken, bypassUrl, serviceUsed: serviceToUse };
  }

  private async callLinkBulksAPI(destinationUrl: string): Promise<string> {
    try {
      const apiKey = process.env.LINKBULKS_API_KEY;
      if (!apiKey) {
        throw new Error('LINKBULKS_API_KEY not configured');
      }

      const encodedUrl = encodeURIComponent(destinationUrl);
      const apiUrl = `https://linkbulks.com/api?api=${apiKey}&url=${encodedUrl}&format=text`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`LinkBulks API failed: ${response.status}`);
      }
      
      const bypassUrl = await response.text();
      if (!bypassUrl.trim()) {
        throw new Error('LinkBulks API returned empty response');
      }
      
      return bypassUrl.trim();
    } catch (error) {
      console.error('Error calling LinkBulks API:', error);
      // Fallback to mock URL for development
      return `https://linkbulks.com/bypass/${Math.random().toString(36).substring(7)}`;
    }
  }

  async claimReward(claimToken: string): Promise<{ success: boolean; userId?: string; rewardAmount?: number }> {
    const claim = Array.from(this.rewardClaims.values()).find(c => c.claimToken === claimToken && !c.isClaimed);
    
    if (!claim) {
      return { success: false };
    }
    
    // Mark claim as used
    claim.isClaimed = true;
    claim.claimedAt = new Date();
    this.rewardClaims.set(claim.id, claim);
    
    // Add credits to user
    const user = await this.getUser(claim.userId);
    if (user) {
      await this.updateUserCredits(claim.userId, user.credits + claim.rewardAmount);
    }
    
    return { success: true, userId: claim.userId, rewardAmount: claim.rewardAmount };
  }

  async getRewardClaims(userId: string): Promise<RewardClaim[]> {
    const claims = Array.from(this.rewardClaims.values()).filter(claim => claim.userId === userId);
    return claims.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async getDailyLinkUsageStats(): Promise<{ linkbulksUsed: number; link4mUsed: number; linkbulksLimit: number; link4mLimit: number; resetTime: string }> {
    const usage = await this.getDailyUsage();
    
    // Calculate next reset time (midnight tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    return {
      linkbulksUsed: usage.linkbulksUsage,
      link4mUsed: usage.link4mUsage,
      linkbulksLimit: 2,
      link4mLimit: 10,
      resetTime: tomorrow.toISOString(),
    };
  }

  // Object Replacement methods (phot.ai integration)
  async createObjectReplacement(replacement: InsertObjectReplacement, userId: string): Promise<ObjectReplacement> {
    const id = randomUUID();
    const fullReplacement: ObjectReplacement = {
      ...replacement,
      id,
      userId,
      status: "pending",
      resultImageUrl: null,
      errorMessage: null,
      creditsUsed: 2,
      createdAt: new Date(),
      completedAt: null,
    };
    this.objectReplacements.set(id, fullReplacement);
    return fullReplacement;
  }

  async updateObjectReplacement(id: string, updates: Partial<ObjectReplacement>): Promise<ObjectReplacement | undefined> {
    const replacement = this.objectReplacements.get(id);
    if (replacement) {
      const updatedReplacement = { ...replacement, ...updates };
      this.objectReplacements.set(id, updatedReplacement);
      return updatedReplacement;
    }
    return undefined;
  }

  async getObjectReplacement(id: string): Promise<ObjectReplacement | undefined> {
    return this.objectReplacements.get(id);
  }

  async getUserObjectReplacements(userId: string): Promise<ObjectReplacement[]> {
    const replacements = Array.from(this.objectReplacements.values()).filter(replacement => replacement.userId === userId);
    return replacements.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  // Phot.AI Operations methods (general tools)
  async createPhotaiOperation(operation: InsertPhotaiOperation, userId: string): Promise<PhotoaiOperation> {
    const id = randomUUID();
    
    // Determine credits based on tool type
    const creditsMap: Record<string, number> = {
      "background-remover": 1,
      "background-replacer": 2,
      "image-extender": 1,
      "object-remover": 2,
      "text-to-art": 1,
      "text-to-art-image": 1,
      "upscaler": 1,
      "ai-photo-enhancer": 2,
      "ai-light-fix": 1,
      "old-photo-restoration": 2,
      "color-restoration": 1,
      "ai-photo-coloriser": 1,
      "ai-pattern-generator": 2,
    };
    
    const creditsUsed = creditsMap[operation.toolType] || 1;
    
    const fullOperation: PhotoaiOperation = {
      ...operation,
      id,
      userId,
      prompt: operation.prompt || null,
      maskImageBase64: operation.maskImageBase64 || null,
      backgroundPrompt: operation.backgroundPrompt || null,
      extendDirection: operation.extendDirection || null,
      upscaleMethod: operation.upscaleMethod || null,
      status: "pending",
      resultImageUrl: null,
      errorMessage: null,
      creditsUsed,
      createdAt: new Date(),
      completedAt: null,
    };
    this.photaiOperations.set(id, fullOperation);
    return fullOperation;
  }

  async updatePhotaiOperation(id: string, updates: Partial<PhotoaiOperation>): Promise<PhotoaiOperation | undefined> {
    const operation = this.photaiOperations.get(id);
    if (operation) {
      const updatedOperation = { ...operation, ...updates };
      this.photaiOperations.set(id, updatedOperation);
      return updatedOperation;
    }
    return undefined;
  }

  async getPhotaiOperation(id: string): Promise<PhotoaiOperation | undefined> {
    return this.photaiOperations.get(id);
  }

  async getUserPhotaiOperations(userId: string): Promise<PhotoaiOperation[]> {
    const operations = Array.from(this.photaiOperations.values()).filter(operation => operation.userId === userId);
    return operations.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.username, username));
    return results[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const results = await db.insert(users).values({ 
      ...insertUser, 
      password: hashedPassword,
      credits: 1 
    }).returning();
    return results[0];
  }

  async validateUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async updateUserCredits(userId: string, credits: number): Promise<User | undefined> {
    const results = await db.update(users).set({ credits }).where(eq(users.id, userId)).returning();
    return results[0];
  }

  async createVideoGeneration(generation: InsertVideoGeneration, creditsUsed: number = 5): Promise<VideoGeneration> {
    // Create full video generation object with all required fields
    const fullGeneration = {
      taskId: randomUUID(),
      userId: generation.userId,
      type: generation.type,
      prompt: generation.prompt,
      imageUrl: generation.imageUrl || null,
      aspectRatio: generation.aspectRatio || "16:9",
      model: generation.model || "veo3",
      watermark: generation.watermark || null,
      hdGeneration: generation.hdGeneration || false,
      creditsUsed,
      apiKeyId: generation.apiKeyId || null,
      status: "pending" as const,
    };
    
    const results = await db.insert(videoGenerations).values(fullGeneration).returning();
    return results[0];
  }

  async updateVideoGeneration(id: string, updates: Partial<VideoGeneration>): Promise<VideoGeneration | undefined> {
    const results = await db.update(videoGenerations).set(updates).where(eq(videoGenerations.id, id)).returning();
    return results[0];
  }

  async getVideoGeneration(id: string): Promise<VideoGeneration | undefined> {
    const results = await db.select().from(videoGenerations).where(eq(videoGenerations.id, id));
    return results[0];
  }

  async getVideoGenerationByTaskId(taskId: string): Promise<VideoGeneration | undefined> {
    const results = await db.select().from(videoGenerations).where(eq(videoGenerations.taskId, taskId));
    return results[0];
  }

  async getUserVideoGenerations(userId: string): Promise<VideoGeneration[]> {
    return await db.select().from(videoGenerations).where(eq(videoGenerations.userId, userId)).orderBy(desc(videoGenerations.createdAt));
  }

  // API Key methods
  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const results = await db.insert(apiKeys).values(insertApiKey).returning();
    return results[0];
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const results = await db.update(apiKeys).set(updates).where(eq(apiKeys.id, id)).returning();
    return results[0];
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return results[0];
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getActiveApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).where(and(eq(apiKeys.isActive, true))).orderBy(desc(apiKeys.credits));
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const results = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return results.length > 0;
  }

  // Settings methods
  async getSetting(key: string): Promise<Settings | undefined> {
    const results = await db.select().from(settings).where(eq(settings.key, key));
    return results[0];
  }

  async setSetting(key: string, value: string): Promise<Settings> {
    // Try to update first, if no rows affected, insert new
    const updateResults = await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key)).returning();
    
    if (updateResults.length > 0) {
      return updateResults[0];
    }
    
    // Insert new setting
    const insertResults = await db.insert(settings).values({ key, value }).returning();
    return insertResults[0];
  }

  async getAllSettings(): Promise<Settings[]> {
    return await db.select().from(settings);
  }

  // Reward Video methods
  async createRewardVideo(insertRewardVideo: InsertRewardVideo): Promise<RewardVideo> {
    const results = await db.insert(rewardVideos).values(insertRewardVideo).returning();
    return results[0];
  }

  async getRewardVideo(id: string): Promise<RewardVideo | undefined> {
    const results = await db.select().from(rewardVideos).where(eq(rewardVideos.id, id));
    return results[0];
  }

  async getAllActiveRewardVideos(): Promise<RewardVideo[]> {
    return await db.select().from(rewardVideos).where(eq(rewardVideos.isActive, true)).orderBy(desc(rewardVideos.createdAt));
  }

  async updateRewardVideo(id: string, updates: Partial<RewardVideo>): Promise<RewardVideo | undefined> {
    const results = await db.update(rewardVideos).set(updates).where(eq(rewardVideos.id, id)).returning();
    return results[0];
  }

  // Video Watch History methods
  async createVideoWatchHistory(insertWatchHistory: InsertVideoWatchHistory): Promise<VideoWatchHistory> {
    const results = await db.insert(videoWatchHistory).values(insertWatchHistory).returning();
    return results[0];
  }

  async updateVideoWatchHistory(id: string, updates: Partial<VideoWatchHistory>): Promise<VideoWatchHistory | undefined> {
    const results = await db.update(videoWatchHistory).set(updates).where(eq(videoWatchHistory.id, id)).returning();
    return results[0];
  }

  async getVideoWatchHistory(userId: string, rewardVideoId: string): Promise<VideoWatchHistory | undefined> {
    const results = await db.select().from(videoWatchHistory).where(
      and(eq(videoWatchHistory.userId, userId), eq(videoWatchHistory.rewardVideoId, rewardVideoId))
    );
    return results[0];
  }

  async getUserWatchHistories(userId: string): Promise<VideoWatchHistory[]> {
    return await db.select().from(videoWatchHistory).where(eq(videoWatchHistory.userId, userId)).orderBy(desc(videoWatchHistory.startedAt));
  }

  // External API Key methods
  async createExternalApiKey(insertApiKey: InsertExternalApiKey): Promise<ExternalApiKey> {
    const apiKey = `stlix_${randomUUID().replace(/-/g, '')}`;
    const fullApiKey = {
      ...insertApiKey,
      apiKey,
      userId: insertApiKey.userId || null,
      isActive: insertApiKey.isActive ?? true,
      creditsLimit: insertApiKey.creditsLimit ?? 100,
      creditsUsed: 0,
    };
    const results = await db.insert(externalApiKeys).values(fullApiKey).returning();
    return results[0];
  }

  async getExternalApiKeyByKey(apiKey: string): Promise<ExternalApiKey | undefined> {
    const results = await db.select().from(externalApiKeys).where(eq(externalApiKeys.apiKey, apiKey));
    return results[0];
  }

  async updateExternalApiKey(id: string, updates: Partial<ExternalApiKey>): Promise<ExternalApiKey | undefined> {
    const results = await db.update(externalApiKeys).set(updates).where(eq(externalApiKeys.id, id)).returning();
    return results[0];
  }

  async getUserExternalApiKeys(userId: string): Promise<ExternalApiKey[]> {
    return await db.select().from(externalApiKeys).where(eq(externalApiKeys.userId, userId)).orderBy(desc(externalApiKeys.createdAt));
  }

  async incrementExternalApiKeyUsage(id: string, creditsUsed: number): Promise<ExternalApiKey | undefined> {
    const results = await db.update(externalApiKeys)
      .set({ 
        creditsUsed: sql`credits_used + ${creditsUsed}`,
        lastUsed: new Date()
      })
      .where(eq(externalApiKeys.id, id))
      .returning();
    return results[0];
  }

  async resetMonthlyUsage(id: string): Promise<ExternalApiKey | undefined> {
    const results = await db.update(externalApiKeys)
      .set({ 
        creditsUsed: 0,
        lastResetAt: new Date()
      })
      .where(eq(externalApiKeys.id, id))
      .returning();
    return results[0];
  }

  async deleteExternalApiKey(id: string): Promise<boolean> {
    const results = await db.delete(externalApiKeys).where(eq(externalApiKeys.id, id));
    return (results.rowCount || 0) > 0;
  }

  async getPhotAIApiKeys(): Promise<ExternalApiKey[]> {
    return await db.select().from(externalApiKeys)
      .where(and(
        eq(externalApiKeys.apiType, 'photai'),
        eq(externalApiKeys.isActive, true)
      ))
      .orderBy(desc(sql`(credits_limit - credits_used)`)); // Sort by available credits
  }

  // Reward Claim methods (LinkBulks integration)
  async createRewardClaim(userId: string): Promise<{ claimToken: string; bypassUrl: string }> {
    // Generate unique claim token
    const claimToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Create claim URL that points to our claim endpoint
    // Support multiple hosting platforms
    let baseUrl: string;
    
    if (process.env.REPLIT_DOMAINS) {
      // Replit environment
      baseUrl = process.env.REPLIT_DOMAINS.split(',')[0];
    } else if (process.env.RENDER_EXTERNAL_URL) {
      // Render environment
      baseUrl = process.env.RENDER_EXTERNAL_URL.replace('https://', '').replace('http://', '');
    } else if (process.env.RAILWAY_STATIC_URL) {
      // Railway environment
      baseUrl = process.env.RAILWAY_STATIC_URL.replace('https://', '').replace('http://', '');
    } else if (process.env.VERCEL_URL) {
      // Vercel environment
      baseUrl = process.env.VERCEL_URL;
    } else if (process.env.APP_URL) {
      // Custom APP_URL environment variable
      baseUrl = process.env.APP_URL.replace('https://', '').replace('http://', '');
    } else {
      // Local development fallback
      baseUrl = 'localhost:5000';
    }
    
    const claimUrl = `https://${baseUrl}/api/claim-reward/${claimToken}`;
    
    // Call real LinkBulks API to create bypass link
    const bypassUrl = await this.callLinkBulksAPI(claimUrl);
    
    const fullRewardClaim = {
      userId,
      bypassUrl,
      claimToken,
      rewardAmount: 1,
      isClaimed: false,
    };
    
    await db.insert(rewardClaims).values(fullRewardClaim);
    return { claimToken, bypassUrl };
  }

  private async callLinkBulksAPI(destinationUrl: string): Promise<string> {
    try {
      const apiKey = process.env.LINKBULKS_API_KEY;
      if (!apiKey) {
        throw new Error('LINKBULKS_API_KEY not configured');
      }

      const encodedUrl = encodeURIComponent(destinationUrl);
      const apiUrl = `https://linkbulks.com/api?api=${apiKey}&url=${encodedUrl}&format=text`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`LinkBulks API failed: ${response.status}`);
      }
      
      const bypassUrl = await response.text();
      if (!bypassUrl.trim()) {
        throw new Error('LinkBulks API returned empty response');
      }
      
      return bypassUrl.trim();
    } catch (error) {
      console.error('Error calling LinkBulks API:', error);
      // Fallback to mock URL for development
      return `https://linkbulks.com/bypass/${Math.random().toString(36).substring(7)}`;
    }
  }

  async claimReward(claimToken: string): Promise<{ success: boolean; userId?: string; rewardAmount?: number }> {
    try {
      let claimResult: { success: boolean; userId?: string; rewardAmount?: number } = { success: false };
      
      await db.transaction(async (tx) => {
        // Get the claim
        const results = await tx.select().from(rewardClaims).where(
          and(eq(rewardClaims.claimToken, claimToken), eq(rewardClaims.isClaimed, false))
        );
        
        if (results.length === 0) {
          return;
        }
        
        const claim = results[0];
        
        // Mark claim as used
        await tx.update(rewardClaims)
          .set({ isClaimed: true, claimedAt: new Date() })
          .where(eq(rewardClaims.claimToken, claimToken));
        
        // Update user credits
        await tx.update(users)
          .set({ credits: sql`credits + ${claim.rewardAmount}` })
          .where(eq(users.id, claim.userId));
        
        claimResult = { success: true, userId: claim.userId, rewardAmount: claim.rewardAmount };
      });
      
      return claimResult;
    } catch (error) {
      console.error('Error claiming reward:', error);
      return { success: false };
    }
  }

  async getRewardClaims(userId: string): Promise<RewardClaim[]> {
    return await db.select().from(rewardClaims).where(eq(rewardClaims.userId, userId)).orderBy(desc(rewardClaims.createdAt));
  }

  // Object Replacement methods (phot.ai integration)
  async createObjectReplacement(replacement: InsertObjectReplacement, userId: string): Promise<ObjectReplacement> {
    const fullReplacement = {
      ...replacement,
      userId,
      status: "pending" as const,
      creditsUsed: 2,
    };
    const results = await db.insert(objectReplacements).values(fullReplacement).returning();
    return results[0];
  }

  async updateObjectReplacement(id: string, updates: Partial<ObjectReplacement>): Promise<ObjectReplacement | undefined> {
    const results = await db.update(objectReplacements).set(updates).where(eq(objectReplacements.id, id)).returning();
    return results[0];
  }

  async getObjectReplacement(id: string): Promise<ObjectReplacement | undefined> {
    const results = await db.select().from(objectReplacements).where(eq(objectReplacements.id, id));
    return results[0];
  }

  async getUserObjectReplacements(userId: string): Promise<ObjectReplacement[]> {
    return await db.select().from(objectReplacements).where(eq(objectReplacements.userId, userId)).orderBy(desc(objectReplacements.createdAt));
  }

  // Phot.AI Operations methods (general tools)
  async createPhotaiOperation(operation: InsertPhotaiOperation, userId: string): Promise<PhotoaiOperation> {
    // Determine credits based on tool type
    const creditsMap: Record<string, number> = {
      "background-remover": 1,
      "background-replacer": 2,
      "image-extender": 1,
      "object-remover": 2,
      "text-to-art": 1,
      "text-to-art-image": 1,
      "upscaler": 1,
      "ai-photo-enhancer": 2,
      "ai-light-fix": 1,
      "old-photo-restoration": 2,
      "color-restoration": 1,
      "ai-photo-coloriser": 1,
      "ai-pattern-generator": 2,
    };
    
    const creditsUsed = creditsMap[operation.toolType] || 1;
    
    const fullOperation = {
      ...operation,
      userId,
      prompt: operation.prompt || null,
      maskImageBase64: operation.maskImageBase64 || null,
      backgroundPrompt: operation.backgroundPrompt || null,
      extendDirection: operation.extendDirection || null,
      upscaleMethod: operation.upscaleMethod || null,
      status: "pending" as const,
      creditsUsed,
    };
    const results = await db.insert(photaiOperations).values(fullOperation).returning();
    return results[0];
  }

  async updatePhotaiOperation(id: string, updates: Partial<PhotoaiOperation>): Promise<PhotoaiOperation | undefined> {
    const results = await db.update(photaiOperations).set(updates).where(eq(photaiOperations.id, id)).returning();
    return results[0];
  }

  async getPhotaiOperation(id: string): Promise<PhotoaiOperation | undefined> {
    const results = await db.select().from(photaiOperations).where(eq(photaiOperations.id, id));
    return results[0];
  }

  async getUserPhotaiOperations(userId: string): Promise<PhotoaiOperation[]> {
    return await db.select().from(photaiOperations).where(eq(photaiOperations.userId, userId)).orderBy(desc(photaiOperations.createdAt));
  }
}

// Initialize storage with default user in database
async function initializeDbStorage(): Promise<DbStorage> {
  const storage = new DbStorage();
  
  // Create default user if not exists
  const existingUser = await storage.getUser("default-user-id");
  if (!existingUser) {
    // Insert default user directly into database with proper typing
    const hashedPassword = await bcrypt.hash("password", 10);
    await db.insert(users).values({
      id: "default-user-id" as const,
      username: "demo-user" as const,
      password: hashedPassword,
      credits: 1,
    }).onConflictDoNothing();
  }
  
  return storage;
}

// Export database storage instead of memory storage
let storage: DbStorage;

async function getStorage(): Promise<DbStorage> {
  if (!storage) {
    storage = await initializeDbStorage();
  }
  return storage;
}

export { getStorage as storage };

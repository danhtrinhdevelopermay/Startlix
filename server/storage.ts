import { type User, type InsertUser, type VideoGeneration, type InsertVideoGeneration, type ApiKey, type InsertApiKey, type Settings, type InsertSettings, type RewardVideo, type InsertRewardVideo, type VideoWatchHistory, type InsertVideoWatchHistory, type ExternalApiKey, type InsertExternalApiKey } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, videoGenerations, apiKeys, settings, rewardVideos, videoWatchHistory, externalApiKeys } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  validateUserPassword(username: string, password: string): Promise<User | null>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoGenerations: Map<string, VideoGeneration>;
  private apiKeys: Map<string, ApiKey>;
  private settings: Map<string, Settings>;
  private rewardVideos: Map<string, RewardVideo>;
  private videoWatchHistories: Map<string, VideoWatchHistory>;
  private externalApiKeys: Map<string, ExternalApiKey>;

  constructor() {
    this.users = new Map();
    this.videoGenerations = new Map();
    this.apiKeys = new Map();
    this.settings = new Map();
    this.rewardVideos = new Map();
    this.videoWatchHistories = new Map();
    this.externalApiKeys = new Map();
    
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
    const user: User = { ...insertUser, id, password: hashedPassword, credits: 1 };
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

  async createVideoGeneration(generation: InsertVideoGeneration, creditsUsed: number = 5): Promise<VideoGeneration> {
    const id = randomUUID();
    const taskId = randomUUID();
    const videoGeneration: VideoGeneration = {
      ...generation,
      id,
      taskId,
      userId: generation.userId || null,
      imageUrl: generation.imageUrl || null,
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

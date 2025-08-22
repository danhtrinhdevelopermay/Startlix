import { type User, type InsertUser, type VideoGeneration, type InsertVideoGeneration, type ApiKey, type InsertApiKey, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, videoGenerations, apiKeys, settings } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoGenerations: Map<string, VideoGeneration>;
  private apiKeys: Map<string, ApiKey>;
  private settings: Map<string, Settings>;

  constructor() {
    this.users = new Map();
    this.videoGenerations = new Map();
    this.apiKeys = new Map();
    this.settings = new Map();
    
    // Create a default user for demo purposes
    const defaultUser: User = {
      id: "default-user-id",
      username: "demo-user",
      password: "password",
      credits: 150,
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
    const user: User = { ...insertUser, id, password: hashedPassword, credits: 100 };
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
      credits: 100 
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
      credits: 150,
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

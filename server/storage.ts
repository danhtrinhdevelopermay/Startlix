import { type User, type InsertUser, type VideoGeneration, type InsertVideoGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  
  createVideoGeneration(generation: InsertVideoGeneration): Promise<VideoGeneration>;
  updateVideoGeneration(id: string, updates: Partial<VideoGeneration>): Promise<VideoGeneration | undefined>;
  getVideoGeneration(id: string): Promise<VideoGeneration | undefined>;
  getVideoGenerationByTaskId(taskId: string): Promise<VideoGeneration | undefined>;
  getUserVideoGenerations(userId: string): Promise<VideoGeneration[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoGenerations: Map<string, VideoGeneration>;

  constructor() {
    this.users = new Map();
    this.videoGenerations = new Map();
    
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
    const user: User = { ...insertUser, id, credits: 100 };
    this.users.set(id, user);
    return user;
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

  async createVideoGeneration(generation: InsertVideoGeneration): Promise<VideoGeneration> {
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
      status: "pending",
      resultUrls: null,
      hdResultUrl: null,
      errorMessage: null,
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
}

export const storage = new MemStorage();

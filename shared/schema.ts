import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  credits: integer("credits").notNull().default(10),
  deviceId: varchar("device_id", { length: 255 }), // Device fingerprint for preventing multiple accounts
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull().unique(),
  credits: integer("credits").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videoGenerations = pgTable("video_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  taskId: text("task_id").notNull().unique(),
  type: text("type").notNull(), // 'text-to-video', 'image-to-video', or 'generative-fill'
  prompt: text("prompt").notNull(),
  imageUrl: text("image_url"),
  maskImageUrl: text("mask_image_url"), // For generative fill
  strength: text("strength"), // For generative fill strength
  samples: integer("samples").default(1), // Number of images to generate
  steps: integer("steps").default(31), // Inference steps
  scheduler: text("scheduler"), // Sampling scheduler
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  model: text("model").notNull().default("veo3"),
  watermark: text("watermark"),
  hdGeneration: boolean("hd_generation").default(false),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'enhancing'
  resultUrls: text("result_urls").array(),
  hdResultUrl: text("hd_result_url"),
  errorMessage: text("error_message"),
  creditsUsed: integer("credits_used").notNull(),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  // Enhancement fields
  enhancementStatus: text("enhancement_status").default("none"), // 'none', 'processing', 'completed', 'failed'
  enhancedResultUrls: text("enhanced_result_urls").array(),
  enhancementStartedAt: timestamp("enhancement_started_at"),
  enhancementCompletedAt: timestamp("enhancement_completed_at"),
  enhancementErrorMessage: text("enhancement_error_message"),
});

export const rewardVideos = pgTable("reward_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration").notNull(), // duration in seconds
  creditsReward: integer("credits_reward").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const videoWatchHistory = pgTable("video_watch_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  rewardVideoId: varchar("reward_video_id").notNull().references(() => rewardVideos.id),
  watchedSeconds: integer("watched_seconds").notNull().default(0),
  isCompleted: boolean("is_completed").notNull().default(false),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// External User API Keys for public API access
export const externalApiKeys = pgTable("external_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyName: text("key_name").notNull(),
  apiKey: text("api_key").notNull().unique(),
  apiType: text("api_type").notNull().default("veo3"), // "veo3" or "photai"
  userId: varchar("user_id").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  creditsLimit: integer("credits_limit").notNull().default(100), // Monthly limit
  creditsUsed: integer("credits_used").notNull().default(0), // Used this month
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
  lastResetAt: timestamp("last_reset_at").defaultNow(), // For monthly reset
});

// Daily usage tracking for link shortening services
export const dailyLinkUsage = pgTable("daily_link_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull(), // Format: YYYY-MM-DD
  linkbulksUsage: integer("linkbulks_usage").notNull().default(0), // Max: 2 per day
  link4mUsage: integer("link4m_usage").notNull().default(0), // Max: 10 per day
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reward Claims for LinkBulks/Link4m integration - user claims credits via bypass links
export const rewardClaims = pgTable("reward_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bypassUrl: text("bypass_url").notNull(), // Link vượt từ LinkBulks hoặc Link4m
  claimToken: varchar("claim_token").notNull().unique(), // Unique token để claim credit
  serviceUsed: text("service_used").notNull().default("linkbulks"), // "linkbulks" hoặc "link4m"
  rewardAmount: integer("reward_amount").notNull().default(5), // Số credit thưởng
  isClaimed: boolean("is_claimed").notNull().default(false), // Đã claim chưa
  createdAt: timestamp("created_at").defaultNow(),
  claimedAt: timestamp("claimed_at"),
});

// Object Replacement operations using phot.ai
export const objectReplacements = pgTable("object_replacements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  prompt: text("prompt").notNull(), // Description of what to replace the masked area with
  inputImageUrl: text("input_image_url").notNull(),
  maskImageBase64: text("mask_image_base64").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  resultImageUrl: text("result_image_url"),
  errorMessage: text("error_message"),
  creditsUsed: integer("credits_used").notNull().default(2),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// General Phot.AI operations for all tools
export const photaiOperations = pgTable("photai_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  toolType: text("tool_type").notNull(), // 'background-remover', 'background-replacer', 'image-extender', etc.
  fileName: text("file_name").notNull(),
  prompt: text("prompt"), // Optional prompt for tools that need it
  inputImageUrl: text("input_image_url").notNull(),
  maskImageBase64: text("mask_image_base64"), // Optional for tools that need masks
  backgroundPrompt: text("background_prompt"), // For background replacer
  extendDirection: text("extend_direction"), // For image extender: 'up', 'down', 'left', 'right', 'all'
  upscaleMethod: text("upscale_method"), // For upscaler: 'x2', 'x4', 'x8'
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  resultImageUrl: text("result_image_url"),
  errorMessage: text("error_message"),
  creditsUsed: integer("credits_used").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  deviceId: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  credits: true,
  lastChecked: true,
  createdAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertVideoGenerationSchema = createInsertSchema(videoGenerations).omit({
  id: true,
  taskId: true,
  status: true,
  resultUrls: true,
  hdResultUrl: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
  creditsUsed: true,
}).extend({
  prompt: z.string().min(10, "Prompt must be at least 10 characters").max(500, "Prompt must be less than 500 characters"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  model: z.enum(["veo3", "veo3_fast", "lazymixv4-inpaint", "v51_inpainting", "realistic-vision-v6.0-b1-inpaint-n"]),
  // Generative Fill specific fields
  maskImageUrl: z.string().optional(),
  strength: z.string().optional(),
  samples: z.number().min(1).max(4).optional(),
  steps: z.number().min(10).max(50).optional(),
  scheduler: z.enum(["DPMSolverMultistepScheduler", "DPM++ 2M", "Euler", "Euler a"]).optional(),
});

export const insertRewardVideoSchema = createInsertSchema(rewardVideos).omit({
  id: true,
  createdAt: true,
});

export const insertVideoWatchHistorySchema = createInsertSchema(videoWatchHistory).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertExternalApiKeySchema = createInsertSchema(externalApiKeys).omit({
  id: true,
  apiKey: true,
  creditsUsed: true,
  lastUsed: true,
  createdAt: true,
  lastResetAt: true,
}).extend({
  apiType: z.enum(["veo3", "photai"]).default("veo3"),
});

export const insertDailyLinkUsageSchema = createInsertSchema(dailyLinkUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRewardClaimSchema = createInsertSchema(rewardClaims).omit({
  id: true,
  bypassUrl: true,
  claimToken: true,
  isClaimed: true,
  createdAt: true,
  claimedAt: true,
});

export const insertObjectReplacementSchema = createInsertSchema(objectReplacements).omit({
  id: true,
  userId: true, // Omit userId since it will be added by server
  status: true,
  resultImageUrl: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
  creditsUsed: true,
}).extend({
  fileName: z.string().min(1, "Tên file không được để trống"),
  prompt: z.string().min(5, "Prompt phải có ít nhất 5 ký tự").max(200, "Prompt phải có ít hơn 200 ký tự"),
  inputImageUrl: z.string().min(1, "URL ảnh không được để trống"), // Changed from .url() to allow relative URLs
  maskImageBase64: z.string().min(1, "Vui lòng vẽ mask trên ảnh"),
});

export const insertPhotaiOperationSchema = createInsertSchema(photaiOperations).omit({
  id: true,
  userId: true, // Omit userId since it will be added by server
  status: true,
  resultImageUrl: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
  creditsUsed: true,
}).extend({
  toolType: z.enum([
    "background-remover",
    "background-replacer", 
    "image-extender",
    "object-remover",
    "text-to-art",
    "text-to-art-image",
    "upscaler",
    "ai-photo-enhancer",
    "ai-light-fix",
    "old-photo-restoration",
    "color-restoration",
    "ai-photo-coloriser",
    "ai-pattern-generator"
  ]),
  fileName: z.string().min(1, "Tên file không được để trống"),
  prompt: z.string().optional(),
  inputImageUrl: z.string().min(1, "URL ảnh không được để trống"),
  maskImageBase64: z.string().optional(),
  backgroundPrompt: z.string().optional(),
  extendDirection: z.enum(["up", "down", "left", "right", "all"]).optional(),
  upscaleMethod: z.enum(["x2", "x4", "x8"]).optional(),
});

// API request schema for external API
export const externalApiGenerateSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters").max(500, "Prompt must be less than 500 characters"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  model: z.literal("stlix_fast"), // Only allow fast model for external API
  watermark: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertVideoGeneration = z.infer<typeof insertVideoGenerationSchema>;
export type VideoGeneration = typeof videoGenerations.$inferSelect;
export type InsertRewardVideo = z.infer<typeof insertRewardVideoSchema>;
export type RewardVideo = typeof rewardVideos.$inferSelect;
export type InsertVideoWatchHistory = z.infer<typeof insertVideoWatchHistorySchema>;
export type VideoWatchHistory = typeof videoWatchHistory.$inferSelect;
export type InsertExternalApiKey = z.infer<typeof insertExternalApiKeySchema>;
export type ExternalApiKey = typeof externalApiKeys.$inferSelect;
export type ExternalApiGenerate = z.infer<typeof externalApiGenerateSchema>;
export type InsertRewardClaim = z.infer<typeof insertRewardClaimSchema>;
export type RewardClaim = typeof rewardClaims.$inferSelect;
export type InsertObjectReplacement = z.infer<typeof insertObjectReplacementSchema>;
export type ObjectReplacement = typeof objectReplacements.$inferSelect;
export type InsertPhotaiOperation = z.infer<typeof insertPhotaiOperationSchema>;
export type PhotoaiOperation = typeof photaiOperations.$inferSelect;
export type InsertDailyLinkUsage = z.infer<typeof insertDailyLinkUsageSchema>;
export type DailyLinkUsage = typeof dailyLinkUsage.$inferSelect;

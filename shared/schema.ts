import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  credits: integer("credits").notNull().default(1),
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
  type: text("type").notNull(), // 'text-to-video' or 'image-to-video'
  prompt: text("prompt").notNull(),
  imageUrl: text("image_url"),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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
  model: z.enum(["veo3", "veo3_fast"]),
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

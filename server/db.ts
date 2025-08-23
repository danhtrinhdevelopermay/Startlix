import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for serverless environments
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with better settings for production
const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
};

export const pool = new Pool(connectionConfig);
export const db = drizzle({ client: pool, schema });

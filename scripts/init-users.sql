-- SQL script to initialize users and credits for production deployment
-- Run this on your production database to ensure users have credits

-- Create default demo user if not exists
INSERT INTO users (id, username, password, credits) 
VALUES (
  'default-user-id',
  'demo-user', 
  '$2b$10$Aq.MD4TCJFFAKr3EOPePhOESXKVPVUiAXkjS8Q1XCiFqFw4.hCFIO', 
  10
) ON CONFLICT (username) DO UPDATE SET credits = 10;

-- Create additional demo users for testing
INSERT INTO users (username, password, credits) 
VALUES (
  'danhtrinh2k10',
  '$2b$10$w663z9R4OK51lUtD0oL.TuWYc0vE8OiB9Wny5Kg.HP0j6dWOJfTpy',
  20
) ON CONFLICT (username) DO UPDATE SET credits = 20;

INSERT INTO users (username, password, credits) 
VALUES (
  'khanhbang',
  '$2b$10$4eRKBy/Q/6bNlqkga.muCOgigXOkg8YIIeDPCYXH/WSds6ENXDVRm',
  15
) ON CONFLICT (username) DO UPDATE SET credits = 15;

-- Grant extra credits to all existing users
UPDATE users SET credits = credits + 10 WHERE credits < 5;

-- Show final status
SELECT username, credits FROM users ORDER BY credits DESC;
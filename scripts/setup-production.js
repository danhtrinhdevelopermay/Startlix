#!/usr/bin/env node

// Script to initialize production database on Render
// Run this after deployment to ensure all users and data exist

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up production database...');

// Ensure we're in the right directory
process.chdir(path.dirname(__dirname));

try {
  // Push schema to production database
  console.log('📊 Pushing database schema...');
  execSync('npm run db:push -- --force', { stdio: 'inherit' });
  
  console.log('✅ Production setup completed!');
  console.log('📝 Next steps:');
  console.log('1. Login to your app');
  console.log('2. Go to Admin panel');
  console.log('3. Add your VEO3 API keys');
  console.log('4. Start creating videos!');
  
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
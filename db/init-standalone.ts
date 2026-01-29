#!/usr/bin/env tsx

/**
 * Standalone database initialization script
 * Run with: npm run db:init or tsx db/init-standalone.ts
 */

import { runDrizzleMigrations, testDatabaseConnection } from './drizzle-migrate';
import { closeDatabaseConnections } from './migrate';

async function main() {
  console.log('🚀 Starting database initialization...');
  
  try {
    // Test connection first
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to database. Check DATABASE_URL environment variable.');
    }
    
    console.log('✅ Database connection established');
    
    // Run database migrations
    await runDrizzleMigrations();
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await closeDatabaseConnections();
  }
}

main();
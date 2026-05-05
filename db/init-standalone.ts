#!/usr/bin/env tsx

/**
 * Standalone database migration script
 * Run with:
 *   npm run db:init
 *   npm run db:migrate
 *   npm run db:push
 *   tsx db/init-standalone.ts [auto|migrate|push]
 */

import {
  parseSchemaSyncMode,
  runDrizzleMigrations,
  testDatabaseConnection,
  type SchemaSyncMode,
} from './drizzle-migrate';
import { closeDatabaseConnections } from './migrate';

async function main() {
  const requestedMode = process.argv[2];
  const mode: SchemaSyncMode = requestedMode
    ? parseSchemaSyncMode(requestedMode)
    : 'auto';

  console.log(`🚀 Starting database initialization (${mode})...`);
  
  try {
    // Test connection first
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to database. Check DATABASE_URL environment variable.');
    }
    
    console.log('✅ Database connection established');
    
    // Run database migrations
    await runDrizzleMigrations({ mode });
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await closeDatabaseConnections();
  }
}

main();
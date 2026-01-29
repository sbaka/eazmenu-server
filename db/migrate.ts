import { pool } from './index';
import logger from '../logger';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Legacy database utilities
 * NOTE: Manual schema creation has been replaced with Drizzle migrations
 * These functions are kept for compatibility and testing purposes only
 */



/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gracefully close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database connections closed gracefully');
  } catch (error: any) {
    logger.warn(`Error closing database connections: ${error.message}`);
  }
}
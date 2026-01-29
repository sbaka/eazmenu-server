import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@eazmenu/shared";
import { config } from 'dotenv';

// Load environment variables from .env file (for local development)
// Railway and other cloud providers set environment variables directly
config({ override: false });

if (!process.env.DATABASE_URL) {
  console.error('Environment variables check:');
  console.error('NODE_ENV:', process.env.NODE_ENV);
  console.error('DATABASE_URL defined:', !!process.env.DATABASE_URL);
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure SSL for production/staging environments
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

// Use a standard PostgreSQL pool with SSL configuration for production/staging
// Optimized pool settings for better connection reuse
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (isProduction || isStaging) ? {
    rejectUnauthorized: false // Required for most cloud PostgreSQL providers
  } : false,
  // Connection pool optimization
  max: 10, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast on connection issues
});

// Warm up the connection pool on module load
pool.connect().then(client => {
  client.release();
  console.log('Database connection pool warmed up');
}).catch(err => {
  console.error('Failed to warm up connection pool:', err.message);
});

export const db = drizzle(pool, { schema });
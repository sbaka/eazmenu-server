import { defineConfig } from "drizzle-kit";
import { config } from 'dotenv';

// Load environment variables from .env.local file
config({ path: './.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./db/migrations",
  schema: "./node_modules/@sbaka/shared/dist/schema.js",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
});

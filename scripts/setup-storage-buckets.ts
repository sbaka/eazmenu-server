#!/usr/bin/env tsx
/**
 * Setup Supabase Storage Buckets
 *
 * This script creates the required storage buckets in Supabase for image uploads.
 * Run this once after setting up your Supabase project.
 *
 * Required buckets:
 * - menu-items: For menu item images
 * - restaurant-banners: For restaurant banner images
 * - restaurant-logos: For restaurant logo images
 *
 * Usage:
 *   npx tsx server/scripts/setup-storage-buckets.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BucketConfig {
  name: string;
  public: boolean;
  fileSizeLimit: number; // in bytes
  allowedMimeTypes: string[];
}

const BUCKETS: BucketConfig[] = [
  {
    name: 'menu-items',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  {
    name: 'restaurant-banners',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  {
    name: 'restaurant-logos',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
];

async function setupBuckets() {
  console.log('🚀 Setting up Supabase Storage buckets...\n');

  for (const config of BUCKETS) {
    console.log(`📦 Creating bucket: ${config.name}`);

    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error(`❌ Error checking buckets: ${listError.message}`);
      continue;
    }

    const bucketExists = existingBuckets?.some(b => b.name === config.name);

    if (bucketExists) {
      console.log(`   ✓ Bucket already exists: ${config.name}`);

      // Update bucket to ensure correct settings
      const { error: updateError } = await supabase.storage.updateBucket(config.name, {
        public: config.public,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes,
      });

      if (updateError) {
        console.error(`   ⚠️  Could not update bucket settings: ${updateError.message}`);
      } else {
        console.log(`   ✓ Bucket settings updated`);
      }
    } else {
      // Create bucket
      const { error: createError } = await supabase.storage.createBucket(config.name, {
        public: config.public,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes,
      });

      if (createError) {
        console.error(`   ❌ Error creating bucket: ${createError.message}`);
      } else {
        console.log(`   ✓ Bucket created successfully`);
      }
    }

    console.log(`   - Public: ${config.public}`);
    console.log(`   - File size limit: ${config.fileSizeLimit / (1024 * 1024)}MB`);
    console.log(`   - Allowed types: ${config.allowedMimeTypes.join(', ')}`);
    console.log('');
  }

  console.log('✅ Storage bucket setup complete!\n');
  console.log('📝 Next steps:');
  console.log('1. Run the RLS policies from shared/rls.sql for storage.objects table');
  console.log('2. Test image uploads in the admin panel');
}

// Run the setup
setupBuckets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });


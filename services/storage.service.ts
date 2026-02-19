import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import logger, { sanitizeError } from '../logger';

// =============================================================================
// STORAGE SERVICE
// =============================================================================

/**
 * Centralized service for managing file uploads to Supabase Storage.
 * Supports multiple bucket types with consistent upload/delete/URL operations.
 */

// Bucket type definitions
export const STORAGE_BUCKETS = {
  MENU_ITEMS: 'menu-items',
  RESTAURANT_BANNERS: 'restaurant-banners',
  RESTAURANT_LOGOS: 'restaurant-logos',
} as const;

export type StorageBucketType = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

// Allowed MIME types for images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

// Allowed file extensions for client-side validation
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;
export type AllowedExtension = typeof ALLOWED_EXTENSIONS[number];

// Extension to MIME type mapping
const EXTENSION_TO_MIME: Record<AllowedExtension, AllowedMimeType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

// File type validation result
interface FileTypeResult {
  mime: string;
  ext: string;
}

// Signed URL result
export interface SignedUrlResult {
  success: boolean;
  signedUrl?: string;
  token?: string;
  filePath?: string;
  publicUrl?: string;
  error?: string;
}

// Verify upload result
export interface VerifyUploadResult {
  success: boolean;
  exists?: boolean;
  error?: string;
}

// Upload result
export interface UploadResult {
  success: boolean;
  publicUrl?: string;
  filePath?: string;
  error?: string;
}

// Delete result
export interface DeleteResult {
  success: boolean;
  error?: string;
}

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy-initialized Supabase client
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client instance
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for file uploads');
    }
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
}

/**
 * Dynamically import file-type module (ESM)
 * Note: file-type v16.x exports fromBuffer, v17+ exports fileTypeFromBuffer
 */
async function getFileType(buffer: Buffer): Promise<FileTypeResult | undefined> {
  const fileType = await import('file-type');
  // Handle both v16 (fromBuffer) and v17+ (fileTypeFromBuffer) exports
  const fromBuffer = (fileType as any).fromBuffer || (fileType as any).fileTypeFromBuffer || (fileType as any).default?.fromBuffer;
  if (!fromBuffer) {
    throw new Error('Unable to find file-type buffer detection function');
  }
  return fromBuffer(buffer);
}

/**
 * Validate that the file buffer contains an allowed image type
 */
export async function validateImageType(buffer: Buffer): Promise<FileTypeResult | null> {
  const fileType = await getFileType(buffer);

  if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime as AllowedMimeType)) {
    return null;
  }

  return fileType;
}

/**
 * Generate a unique file path for storage
 * Pattern: {restaurantId}/{uniqueId}.{ext} for restaurant assets
 * Pattern: {prefix}-{uniqueId}.{ext} for menu items (legacy compatibility)
 */
export function generateFilePath(
  bucketType: StorageBucketType,
  extension: string,
  restaurantId?: number
): string {
  const uniqueId = nanoid(10);

  switch (bucketType) {
    case STORAGE_BUCKETS.RESTAURANT_BANNERS:
      if (!restaurantId) throw new Error('restaurantId required for banner uploads');
      return `${restaurantId}/banner-${uniqueId}.${extension}`;

    case STORAGE_BUCKETS.RESTAURANT_LOGOS:
      if (!restaurantId) throw new Error('restaurantId required for logo uploads');
      return `${restaurantId}/logo-${uniqueId}.${extension}`;

    case STORAGE_BUCKETS.MENU_ITEMS:
    default:
      return `menu-item-${uniqueId}.${extension}`;
  }
}

/**
 * Upload an image to Supabase Storage
 */
export async function uploadImage(
  buffer: Buffer,
  bucketType: StorageBucketType,
  restaurantId?: number
): Promise<UploadResult> {
  try {
    // Validate file type
    const fileType = await validateImageType(buffer);
    if (!fileType) {
      return {
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
      };
    }

    // Generate unique file path
    const filePath = generateFilePath(bucketType, fileType.ext, restaurantId);

    // Upload to Supabase
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(bucketType)
      .upload(filePath, buffer, {
        contentType: fileType.mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      logger.error(`Supabase upload error [${bucketType}]: ${sanitizeError(error)}`);

      // Check if the error is due to missing bucket
      const errorMessage = sanitizeError(error);
      if (errorMessage.includes('not exist') || errorMessage.includes('does not exist')) {
        return {
          success: false,
          error: `Storage bucket '${bucketType}' does not exist. Please run: npx tsx server/scripts/setup-storage-buckets.ts`,
        };
      }

      return {
        success: false,
        error: 'Failed to upload image',
      };
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(bucketType)
      .getPublicUrl(filePath);

    logger.info(`Image uploaded to ${bucketType}: ${filePath}`);

    return {
      success: true,
      publicUrl: urlData.publicUrl,
      filePath,
    };
  } catch (error) {
    logger.error(`Storage upload error: ${sanitizeError(error)}`);
    return {
      success: false,
      error: 'Failed to process upload',
    };
  }
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteImage(
  filePath: string,
  bucketType: StorageBucketType
): Promise<DeleteResult> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      // Supabase not configured, skip deletion
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Supabase not configured, skipping file deletion');
      }
      return { success: true };
    }

    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(bucketType)
      .remove([filePath]);

    if (error) {
      logger.error(`Error deleting file from ${bucketType}: ${sanitizeError(error)}`);
      return {
        success: false,
        error: 'Failed to delete image',
      };
    }

    logger.info(`Image deleted from ${bucketType}: ${filePath}`);
    return { success: true };
  } catch (error) {
    logger.error(`Storage delete error: ${sanitizeError(error)}`);
    return {
      success: false,
      error: 'Failed to delete image',
    };
  }
}

/**
 * Get the public URL for a file in storage
 *
 * Note: This assumes the bucket is set to PUBLIC in Supabase.
 * If using private buckets, use getSignedReadUrl() instead.
 */
export function getPublicUrl(
  filePath: string,
  bucketType: StorageBucketType
): string {
  if (!supabaseUrl) {
    // Fallback for local development
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3002}`;
    return `${baseUrl}/uploads/${bucketType}/${filePath}`;
  }

  const client = getSupabaseClient();
  const { data } = client.storage
    .from(bucketType)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Get a signed URL for reading a file (works with private buckets)
 * The URL is valid for 1 year by default.
 */
export async function getSignedReadUrl(
  filePath: string,
  bucketType: StorageBucketType,
  expiresIn: number = 60 * 60 * 24 * 365 // 1 year in seconds
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
      .from(bucketType)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      logger.error(`Error creating signed read URL: ${sanitizeError(error)}`);
      return { success: false, error: error.message };
    }

    return { success: true, signedUrl: data.signedUrl };
  } catch (error) {
    logger.error(`Error in getSignedReadUrl: ${sanitizeError(error)}`);
    return { success: false, error: 'Failed to create signed URL' };
  }
}

/**
 * Extract file path from a Supabase public URL
 */
export function extractFilePathFromUrl(
  imageUrl: string,
  bucketType: StorageBucketType
): string | null {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname;

    // URL format: /storage/v1/object/public/{bucket}/{filePath}
    const bucketPath = `/storage/v1/object/public/${bucketType}/`;
    const bucketIndex = pathname.indexOf(bucketPath);

    if (bucketIndex !== -1) {
      return pathname.substring(bucketIndex + bucketPath.length);
    }

    // Fallback: try to extract from end of pathname
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

    // Validate it looks like one of our files
    if (
      filename.startsWith('menu-item-') ||
      filename.startsWith('banner-') ||
      filename.startsWith('logo-')
    ) {
      // For restaurant images, we need the full path including restaurantId
      const parts = pathname.split('/');
      if (parts.length >= 2) {
        const lastTwoParts = parts.slice(-2).join('/');
        if (/^\d+\//.test(lastTwoParts)) {
          return lastTwoParts;
        }
      }
      return filename;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if Supabase storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}

/**
 * Validate file extension is allowed
 */
export function isValidExtension(extension: string): extension is AllowedExtension {
  return ALLOWED_EXTENSIONS.includes(extension.toLowerCase() as AllowedExtension);
}

/**
 * Get MIME type for a file extension
 */
export function getMimeTypeForExtension(extension: string): AllowedMimeType | null {
  const ext = extension.toLowerCase() as AllowedExtension;
  return EXTENSION_TO_MIME[ext] || null;
}

/**
 * Create a signed upload URL for direct frontend-to-Supabase uploads
 * The URL is valid for 1 hour (3600 seconds)
 *
 * Returns a long-lived signed read URL (1 year) for the publicUrl to support private buckets.
 */
export async function createSignedUploadUrl(
  bucketType: StorageBucketType,
  extension: string,
  restaurantId?: number
): Promise<SignedUrlResult> {
  try {
    // Validate extension
    if (!isValidExtension(extension)) {
      return {
        success: false,
        error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }

    // Generate unique file path
    const filePath = generateFilePath(bucketType, extension, restaurantId);

    // Get signed upload URL from Supabase
    const client = getSupabaseClient();
    const { data, error } = await client.storage
      .from(bucketType)
      .createSignedUploadUrl(filePath);

    if (error) {
      logger.error(`Supabase signed URL error [${bucketType}]: ${sanitizeError(error)}`);

      // Check if the error is due to missing bucket
      const errorMessage = sanitizeError(error);
      if (errorMessage.includes('not exist') || errorMessage.includes('does not exist')) {
        return {
          success: false,
          error: `Storage bucket '${bucketType}' does not exist. Please run: npx tsx server/scripts/setup-storage-buckets.ts`,
        };
      }

      return {
        success: false,
        error: 'Failed to create upload URL',
      };
    }

    // For private buckets, we use getPublicUrl which constructs the URL
    // The actual accessibility depends on bucket settings
    // If bucket is public: URL works directly
    // If bucket is private: URL won't work, but we'll create a signed URL after upload confirmation
    const { data: urlData } = client.storage
      .from(bucketType)
      .getPublicUrl(filePath);

    logger.info(`Signed upload URL created for ${bucketType}: ${filePath}`);

    return {
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      filePath,
      publicUrl: urlData.publicUrl,
    };
  } catch (error) {
    logger.error(`Signed URL creation error: ${sanitizeError(error)}`);
    return {
      success: false,
      error: 'Failed to create upload URL',
    };
  }
}

/**
 * Verify that a file was successfully uploaded to storage
 */
export async function verifyUploadExists(
  filePath: string,
  bucketType: StorageBucketType
): Promise<VerifyUploadResult> {
  try {
    const client = getSupabaseClient();

    // List files to check if the file exists
    // Extract directory and filename from path
    const lastSlashIndex = filePath.lastIndexOf('/');
    const folder = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : '';
    const filename = lastSlashIndex > 0 ? filePath.substring(lastSlashIndex + 1) : filePath;

    const { data, error } = await client.storage
      .from(bucketType)
      .list(folder, {
        limit: 1,
        search: filename,
      });

    if (error) {
      logger.error(`Supabase verify error [${bucketType}]: ${sanitizeError(error)}`);

      // Check if the error is due to missing bucket
      const errorMessage = sanitizeError(error);
      if (errorMessage.includes('not exist') || errorMessage.includes('does not exist')) {
        return {
          success: false,
          error: `Storage bucket '${bucketType}' does not exist. Please run: npx tsx server/scripts/setup-storage-buckets.ts`,
        };
      }

      return {
        success: false,
        error: 'Failed to verify upload',
      };
    }

    const exists = data && data.length > 0 && data.some(f => f.name === filename);

    logger.info(`Upload verification for ${bucketType}/${filePath}: ${exists ? 'exists' : 'not found'}`);

    return {
      success: true,
      exists,
    };
  } catch (error) {
    logger.error(`Upload verification error: ${sanitizeError(error)}`);
    return {
      success: false,
      error: 'Failed to verify upload',
    };
  }
}

// Export the storage service as an object for easier mocking in tests
export const StorageService = {
  uploadImage,
  deleteImage,
  getPublicUrl,
  getSignedReadUrl,
  extractFilePathFromUrl,
  validateImageType,
  generateFilePath,
  isStorageConfigured,
  isValidExtension,
  getMimeTypeForExtension,
  createSignedUploadUrl,
  verifyUploadExists,
  BUCKETS: STORAGE_BUCKETS,
  ALLOWED_EXTENSIONS,
};

export default StorageService;

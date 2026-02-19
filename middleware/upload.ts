import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import {
  StorageService,
  STORAGE_BUCKETS,
  StorageBucketType,
  validateImageType,
  extractFilePathFromUrl,
} from '../services/storage.service';
import logger, { sanitizeError } from '../logger';

// =============================================================================
// IMAGE UPLOAD MIDDLEWARE
// =============================================================================

/**
 * Multer configuration and middleware for handling image uploads to Supabase Storage.
 * Provides reusable upload handlers for different image types with size limits.
 */

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// Use memory storage for Supabase upload
const memoryStorage = multer.memoryStorage();

// Basic MIME type filter (additional magic byte validation happens after)
const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  }
};

/**
 * Create a multer upload instance with specified size limit
 */
function createMulterUpload(maxSizeMB: number) {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
      files: 1,
    },
  });
}

// Pre-configured multer instances for different upload types
export const uploadMenuItemImage = createMulterUpload(5);      // 5MB for menu items
export const uploadRestaurantBanner = createMulterUpload(5);   // 5MB for banners
export const uploadRestaurantLogo = createMulterUpload(5);     // 5MB for logos

/**
 * Factory to create upload-to-Supabase middleware for a specific bucket type
 */
export function createUploadMiddleware(bucketType: StorageBucketType) {
  return async function uploadToSupabase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const file = req.file;

      if (!file) {
        return next();
      }

      // Validate magic bytes
      const fileType = await validateImageType(file.buffer);
      if (!fileType) {
        res.status(400).json({
          message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
        });
        return;
      }

      // Get restaurantId from params or body for restaurant assets
      let restaurantId: number | undefined;
      if (bucketType !== STORAGE_BUCKETS.MENU_ITEMS) {
        restaurantId = parseInt(req.params.id as string) || parseInt(req.body.restaurantId as string);
        if (!restaurantId) {
          res.status(400).json({ message: 'Restaurant ID is required for this upload' });
          return;
        }
      }

      // Upload to Supabase
      const result = await StorageService.uploadImage(file.buffer, bucketType, restaurantId);

      if (!result.success) {
        res.status(500).json({ message: result.error || 'Failed to upload image' });
        return;
      }

      // Attach results to request for use in route handlers
      (req as any).uploadedImageUrl = result.publicUrl;
      (req as any).uploadedFilePath = result.filePath;
      (req as any).uploadedBucketType = bucketType;
      // Keep uploadedFileName for backward compatibility
      (req as any).uploadedFileName = result.filePath;

      next();
    } catch (error) {
      logger.error(`Upload middleware error: ${sanitizeError(error)}`);
      res.status(500).json({ message: 'Failed to process upload' });
    }
  };
}

// Pre-configured upload middlewares for different bucket types
export const validateAndUploadToSupabase = createUploadMiddleware(STORAGE_BUCKETS.MENU_ITEMS);
export const validateAndUploadBanner = createUploadMiddleware(STORAGE_BUCKETS.RESTAURANT_BANNERS);
export const validateAndUploadLogo = createUploadMiddleware(STORAGE_BUCKETS.RESTAURANT_LOGOS);

/**
 * Delete an uploaded file from Supabase Storage
 * @param filename - The file path or full URL
 * @param bucketType - The bucket to delete from (defaults to menu-items for backward compatibility)
 */
export async function deleteUploadedFile(
  filename: string,
  bucketType: StorageBucketType = STORAGE_BUCKETS.MENU_ITEMS
): Promise<void> {
  // If it's a URL, extract the file path
  let filePath = filename;
  if (filename.startsWith('http')) {
    const extracted = extractFilePathFromUrl(filename, bucketType);
    if (!extracted) {
      logger.warn(`Could not extract file path from URL: ${filename}`);
      return;
    }
    filePath = extracted;
  }

  const result = await StorageService.deleteImage(filePath, bucketType);
  if (!result.success) {
    logger.error(`Failed to delete file: ${result.error}`);
  }
}

/**
 * Get public URL for a file (backward compatibility)
 */
export function getImageUrl(
  filename: string,
  bucketType: StorageBucketType = STORAGE_BUCKETS.MENU_ITEMS
): string {
  return StorageService.getPublicUrl(filename, bucketType);
}

/**
 * Extract filename from URL (backward compatibility)
 */
export function getFilenameFromUrl(imageUrl: string): string | null {
  return extractFilePathFromUrl(imageUrl, STORAGE_BUCKETS.MENU_ITEMS);
}

// Re-export bucket types for convenience
export { STORAGE_BUCKETS };
export type { StorageBucketType };

import express from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware';
import { rateLimits } from '../security';
import {
  StorageService,
  STORAGE_BUCKETS,
  StorageBucketType,
} from '../services/storage.service';
import { storage } from '../storage';
import { db } from '@db';
import { categories, menuItems } from '@sbaka/shared';
import logger, { sanitizeError } from '../logger';
import { pendingUploads } from '../workers/orphan-cleanup';

// =============================================================================
// UPLOAD ROUTES
// =============================================================================

/**
 * Routes for direct-to-Supabase uploads using signed URLs.
 *
 * Flow:
 * 1. Frontend requests signed URL via POST /api/uploads/signed-url
 * 2. Frontend uploads directly to Supabase using the signed URL
 * 3. Frontend confirms upload via POST /api/uploads/confirm
 * 4. Server verifies file exists and updates the entity (restaurant/menu-item)
 *
 * Orphaned files (uploaded but never confirmed) are cleaned up by the orphan-cleanup worker.
 */

const router = express.Router();

// Request body schemas
const signedUrlRequestSchema = z.object({
  bucketType: z.enum(['menu-items', 'restaurant-banners', 'restaurant-logos']),
  extension: z.string().min(1).max(10),
  // Required for restaurant images, optional for menu items
  restaurantId: z.number().int().positive().optional(),
  // Required for menu items to validate category ownership
  categoryId: z.number().int().positive().optional(),
});

const confirmUploadSchema = z.object({
  filePath: z.string().min(1),
  bucketType: z.enum(['menu-items', 'restaurant-banners', 'restaurant-logos']),
  entityType: z.enum(['restaurant', 'menu-item']),
  entityId: z.number().int().nonnegative(), // Allow 0 for new menu items
  imageField: z.enum(['banner', 'logo', 'image']).optional(),
});

const cancelUploadSchema = z.object({
  filePath: z.string().min(1),
  bucketType: z.enum(['menu-items', 'restaurant-banners', 'restaurant-logos']),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate that user owns the restaurant
 */
async function validateRestaurantOwnership(
  restaurantId: number,
  userId: number
): Promise<boolean> {
  const restaurant = await storage.getRestaurantById(restaurantId);
  return restaurant?.merchantId === userId;
}

/**
 * Validate that user owns the category (and by extension, can create menu items in it)
 */
async function validateCategoryOwnership(
  categoryId: number,
  userId: number
): Promise<boolean> {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
    with: {
      restaurant: true,
    },
  });
  if (!category) return false;
  return category.restaurant.merchantId === userId;
}

/**
 * Get the bucket type from a string
 */
function getBucketType(bucket: string): StorageBucketType {
  switch (bucket) {
    case 'restaurant-banners':
      return STORAGE_BUCKETS.RESTAURANT_BANNERS;
    case 'restaurant-logos':
      return STORAGE_BUCKETS.RESTAURANT_LOGOS;
    case 'menu-items':
    default:
      return STORAGE_BUCKETS.MENU_ITEMS;
  }
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * Request a signed upload URL
 *
 * POST /api/uploads/signed-url
 * Body: { bucketType, extension, restaurantId?, categoryId? }
 *
 * Returns: { signedUrl, token, filePath, publicUrl }
 */
router.post(
  '/api/uploads/signed-url',
  authenticate,
  rateLimits.api,
  async (req, res) => {
    try {
      const parseResult = signedUrlRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: 'Invalid request',
          errors: parseResult.error.issues,
        });
      }

      const { bucketType, extension, restaurantId, categoryId } = parseResult.data;
      const bucket = getBucketType(bucketType);
      const userId = req.user!.id;

      // Validate ownership based on bucket type
      if (bucket === STORAGE_BUCKETS.RESTAURANT_BANNERS || bucket === STORAGE_BUCKETS.RESTAURANT_LOGOS) {
        if (!restaurantId) {
          return res.status(400).json({ message: 'restaurantId is required for restaurant images' });
        }

        const isOwner = await validateRestaurantOwnership(restaurantId, userId);
        if (!isOwner) {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (bucket === STORAGE_BUCKETS.MENU_ITEMS) {
        // For menu items, we need either restaurantId or categoryId for ownership validation
        if (categoryId) {
          const isOwner = await validateCategoryOwnership(categoryId, userId);
          if (!isOwner) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else if (restaurantId) {
          const isOwner = await validateRestaurantOwnership(restaurantId, userId);
          if (!isOwner) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }
        // If neither provided, we still allow it but the confirm step will validate
      }

      // Create signed URL
      const result = await StorageService.createSignedUploadUrl(
        bucket,
        extension,
        restaurantId
      );

      if (!result.success) {
        return res.status(500).json({ message: result.error });
      }

      // Track pending upload for orphan cleanup
      if (result.filePath) {
        pendingUploads.add(result.filePath, bucket, userId);
      }

      logger.info(`Signed URL created for user ${userId}: ${bucket}/${result.filePath}`);

      res.json({
        signedUrl: result.signedUrl,
        token: result.token,
        filePath: result.filePath,
        publicUrl: result.publicUrl,
      });
    } catch (error) {
      logger.error(`Error creating signed URL: ${sanitizeError(error)}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * Confirm a successful upload
 *
 * POST /api/uploads/confirm
 * Body: { filePath, bucketType, entityType, entityId, imageField? }
 *
 * Verifies the file exists in Supabase and updates the entity with the new image URL.
 * Also deletes the old image if replacing.
 */
router.post(
  '/api/uploads/confirm',
  authenticate,
  rateLimits.api,
  async (req, res) => {
    try {
      const parseResult = confirmUploadSchema.safeParse(req.body);
      if (!parseResult.success) {
        logger.error(`Upload confirm validation failed: ${JSON.stringify(parseResult.error.issues)}`);
        logger.debug(`Request body: ${JSON.stringify(req.body)}`);
        return res.status(400).json({
          message: 'Invalid request',
          errors: parseResult.error.issues,
        });
      }

      const { filePath, bucketType, entityType, entityId, imageField } = parseResult.data;
      const bucket = getBucketType(bucketType);
      const userId = req.user!.id;

      // Verify file exists in Supabase
      const verifyResult = await StorageService.verifyUploadExists(filePath, bucket);
      if (!verifyResult.success) {
        return res.status(500).json({ message: verifyResult.error });
      }
      if (!verifyResult.exists) {
        return res.status(400).json({ message: 'Upload not found. Please try uploading again.' });
      }

      // Generate a long-lived signed URL for private bucket support
      // This URL is valid for 1 year
      const signedUrlResult = await StorageService.getSignedReadUrl(filePath, bucket);
      if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
        // Fallback to public URL if signed URL fails (bucket might be public)
        logger.warn(`Failed to create signed read URL, falling back to public URL: ${signedUrlResult.error}`);
      }
      const imageUrl = signedUrlResult.signedUrl || StorageService.getPublicUrl(filePath, bucket);

      // Update entity based on type
      if (entityType === 'restaurant') {
        // Validate ownership
        const isOwner = await validateRestaurantOwnership(entityId, userId);
        if (!isOwner) {
          // Delete the uploaded file since we can't confirm it
          await StorageService.deleteImage(filePath, bucket);
          return res.status(403).json({ message: 'Access denied' });
        }

        // Get existing restaurant to check for old image
        const restaurant = await storage.getRestaurantById(entityId);
        if (!restaurant) {
          await StorageService.deleteImage(filePath, bucket);
          return res.status(404).json({ message: 'Restaurant not found' });
        }

        // Determine which field to update
        const field = imageField === 'logo' ? 'logoUrl' : 'bannerUrl';
        const oldUrl = field === 'logoUrl' ? restaurant.logoUrl : restaurant.bannerUrl;

        // Delete old image if exists
        if (oldUrl) {
          const oldFilePath = StorageService.extractFilePathFromUrl(oldUrl, bucket);
          if (oldFilePath) {
            await StorageService.deleteImage(oldFilePath, bucket);
            logger.info(`Deleted old ${field}: ${oldFilePath}`);
          }
        }

        // Update restaurant with new URL
        const updated = await storage.updateRestaurant(
          entityId,
          { [field]: imageUrl },
          userId
        );

        // Remove from pending uploads
        pendingUploads.remove(filePath);

        logger.info(`Restaurant ${entityId} ${field} updated by user ${userId}`);

        res.json({
          message: 'Upload confirmed',
          [field]: imageUrl,
          restaurant: updated,
        });
      } else if (entityType === 'menu-item') {
        // For menu items, entityId could be 0 for new items
        // In that case, we just confirm the upload and return the URL
        if (entityId === 0) {
          // Remove from pending uploads
          pendingUploads.remove(filePath);

          logger.info(`Menu item image upload confirmed for new item by user ${userId}`);

          res.json({
            message: 'Upload confirmed',
            imageUrl: imageUrl,
            filePath,
          });
          return;
        }

        // Validate ownership for existing menu item using direct DB query
        const menuItem = await db.query.menuItems.findFirst({
          where: eq(menuItems.id, entityId),
          with: {
            category: {
              with: {
                restaurant: true,
              },
            },
          },
        });
        if (!menuItem) {
          await StorageService.deleteImage(filePath, bucket);
          return res.status(404).json({ message: 'Menu item not found' });
        }

        if (menuItem.category.restaurant.merchantId !== userId) {
          await StorageService.deleteImage(filePath, bucket);
          return res.status(403).json({ message: 'Access denied' });
        }

        // Delete old image if exists
        if (menuItem.imageUrl) {
          const oldFilePath = StorageService.extractFilePathFromUrl(menuItem.imageUrl, bucket);
          if (oldFilePath) {
            await StorageService.deleteImage(oldFilePath, bucket);
            logger.info(`Deleted old menu item image: ${oldFilePath}`);
          }
        }

        // Update menu item with new URL
        const updated = await storage.updateMenuItem(entityId, { imageUrl: imageUrl });

        // Remove from pending uploads
        pendingUploads.remove(filePath);

        logger.info(`Menu item ${entityId} image updated by user ${userId}`);

        res.json({
          message: 'Upload confirmed',
          imageUrl: imageUrl,
          menuItem: updated,
        });
      } else {
        res.status(400).json({ message: 'Invalid entity type' });
      }
    } catch (error) {
      logger.error(`Error confirming upload: ${sanitizeError(error)}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * Cancel a pending upload
 *
 * POST /api/uploads/cancel
 * Body: { filePath, bucketType }
 *
 * Deletes the uploaded file from Supabase storage.
 */
router.post(
  '/api/uploads/cancel',
  authenticate,
  rateLimits.api,
  async (req, res) => {
    try {
      const parseResult = cancelUploadSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: 'Invalid request',
          errors: parseResult.error.issues,
        });
      }

      const { filePath, bucketType } = parseResult.data;
      const bucket = getBucketType(bucketType);

      // Delete the file
      const result = await StorageService.deleteImage(filePath, bucket);

      // Remove from pending uploads
      pendingUploads.remove(filePath);

      if (!result.success) {
        logger.warn(`Failed to delete cancelled upload: ${filePath}`);
        // Still return success since the user intended to cancel
      }

      logger.info(`Upload cancelled by user ${req.user!.id}: ${bucket}/${filePath}`);

      res.json({ message: 'Upload cancelled' });
    } catch (error) {
      logger.error(`Error cancelling upload: ${sanitizeError(error)}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

export default router;







import { StorageService, StorageBucketType } from '../services/storage.service';
import logger, { sanitizeError } from '../logger';

// =============================================================================
// ORPHAN CLEANUP WORKER
// =============================================================================

/**
 * Background worker to clean up orphaned uploads.
 *
 * Orphaned uploads occur when:
 * 1. User requests a signed URL but never completes the upload
 * 2. User uploads to Supabase but frontend crashes before calling confirm
 * 3. User closes browser/tab during upload process
 *
 * This worker tracks pending uploads and cleans up files that have been
 * pending for longer than the configured timeout (default: 1 hour).
 */

// Pending upload tracking
interface PendingUpload {
  filePath: string;
  bucketType: StorageBucketType;
  userId: number;
  createdAt: Date;
}

// In-memory store for pending uploads
// In production, consider using Redis or a database table for persistence
const pendingUploadsMap = new Map<string, PendingUpload>();

// Configuration
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ORPHAN_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Pending uploads manager
 */
export const pendingUploads = {
  /**
   * Add a new pending upload
   */
  add(filePath: string, bucketType: StorageBucketType, userId: number): void {
    pendingUploadsMap.set(filePath, {
      filePath,
      bucketType,
      userId,
      createdAt: new Date(),
    });
    logger.debug(`Pending upload added: ${filePath}`);
  },

  /**
   * Remove a pending upload (called when confirmed or cancelled)
   */
  remove(filePath: string): void {
    pendingUploadsMap.delete(filePath);
    logger.debug(`Pending upload removed: ${filePath}`);
  },

  /**
   * Get all pending uploads
   */
  getAll(): PendingUpload[] {
    return Array.from(pendingUploadsMap.values());
  },

  /**
   * Get orphaned uploads (older than timeout)
   */
  getOrphaned(timeoutMs: number = ORPHAN_TIMEOUT_MS): PendingUpload[] {
    const now = Date.now();
    return this.getAll().filter(
      (upload) => now - upload.createdAt.getTime() > timeoutMs
    );
  },

  /**
   * Get count of pending uploads
   */
  count(): number {
    return pendingUploadsMap.size;
  },

  /**
   * Clear all pending uploads (for testing)
   */
  clear(): void {
    pendingUploadsMap.clear();
  },
};

/**
 * Clean up orphaned uploads
 */
async function cleanupOrphanedUploads(): Promise<void> {
  const orphaned = pendingUploads.getOrphaned();

  if (orphaned.length === 0) {
    logger.debug('No orphaned uploads to clean up');
    return;
  }

  logger.info(`Cleaning up ${orphaned.length} orphaned upload(s)`);

  for (const upload of orphaned) {
    try {
      // Delete from Supabase storage
      const result = await StorageService.deleteImage(upload.filePath, upload.bucketType);

      if (result.success) {
        logger.info(`Orphaned upload cleaned: ${upload.bucketType}/${upload.filePath}`);
      } else {
        logger.warn(`Failed to clean orphan: ${upload.filePath} - ${result.error}`);
      }

      // Remove from tracking regardless of delete success
      pendingUploads.remove(upload.filePath);
    } catch (error) {
      logger.error(`Error cleaning orphan ${upload.filePath}: ${sanitizeError(error)}`);
      // Still remove from tracking to avoid infinite retry loops
      pendingUploads.remove(upload.filePath);
    }
  }
}

// Cleanup interval reference
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the orphan cleanup worker
 */
export function startOrphanCleanupWorker(): void {
  if (cleanupInterval) {
    logger.warn('Orphan cleanup worker already running');
    return;
  }

  logger.info(`Starting orphan cleanup worker (interval: ${CLEANUP_INTERVAL_MS / 1000}s, timeout: ${ORPHAN_TIMEOUT_MS / 1000}s)`);

  // Run immediately on start (delayed by 1 minute to let server stabilize)
  setTimeout(() => {
    cleanupOrphanedUploads().catch((error) => {
      logger.error(`Initial orphan cleanup failed: ${sanitizeError(error)}`);
    });
  }, 60 * 1000);

  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    cleanupOrphanedUploads().catch((error) => {
      logger.error(`Periodic orphan cleanup failed: ${sanitizeError(error)}`);
    });
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  cleanupInterval.unref();
}

/**
 * Stop the orphan cleanup worker
 */
export function stopOrphanCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Orphan cleanup worker stopped');
  }
}

/**
 * Manually trigger cleanup (for testing or admin actions)
 */
export async function triggerCleanup(): Promise<{ cleaned: number }> {
  const countBefore = pendingUploads.count();
  await cleanupOrphanedUploads();
  const countAfter = pendingUploads.count();
  return { cleaned: countBefore - countAfter };
}

export default {
  pendingUploads,
  startOrphanCleanupWorker,
  stopOrphanCleanupWorker,
  triggerCleanup,
};



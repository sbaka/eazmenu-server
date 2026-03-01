import { protocolManager } from "../services/order-lifecycle";
import logger from "../logger";

// Cleanup interval: check every 60 seconds
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Runs the cleanup logic for served orders using the Order Lifecycle Protocol system.
 * 
 * Each restaurant can have its own protocol configuration:
 * - 'default': Hide orders N minutes after served (configurable, default 10 min)
 * - 'quick_turn': Hide orders 5 minutes after served
 * - 'manual': No automatic cleanup, staff must manually reset tables
 * 
 * The cleanup cycle:
 * 1. Finds all served, non-hidden orders
 * 2. Groups them by restaurant and loads protocol config
 * 3. Applies protocol rules to determine which orders to hide
 * 4. Updates database and broadcasts events via Supabase Realtime
 * 5. Checks affected tables for reset conditions
 */
async function cleanupServedOrders(): Promise<void> {
  try {
    const result = await protocolManager.runCleanupCycle();

    if (result.hiddenCount > 0 || result.resetTables > 0) {
      logger.info(`Order cleanup: ${result.hiddenCount} orders hidden, ${result.resetTables} tables reset`);
    }
  } catch (error) {
    logger.error(`Order cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Starts the order cleanup worker.
 * Runs every 60 seconds to process served orders according to each restaurant's protocol.
 */
export function startOrderCleanupWorker(): void {
  if (cleanupIntervalId) {
    logger.warn('Order cleanup worker already running');
    return;
  }

  logger.info('Starting order cleanup worker with protocol system (interval: 60s)');

  // Run immediately on startup
  cleanupServedOrders();

  // Then run at regular intervals
  cleanupIntervalId = setInterval(cleanupServedOrders, CLEANUP_INTERVAL_MS);
}

/**
 * Stops the order cleanup worker.
 */
export function stopOrderCleanupWorker(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('Order cleanup worker stopped');
  }
}

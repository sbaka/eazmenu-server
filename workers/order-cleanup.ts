import { db } from "@db";
import { orders } from "@eazmenu/shared";
import { eq, and, lt, ne, sql } from "drizzle-orm";
import logger from "../logger";

// Cleanup interval: check every 60 seconds
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Orders are hidden 10 minutes after being served
const SERVED_EXPIRY_MS = 10 * 60 * 1000;

// Broadcast functions will be injected from websocket setup
let broadcastToTableFn: ((tableId: number, data: any) => void) | null = null;

/**
 * Set the broadcast function for notifying table clients.
 * Called from websocket.ts after setup.
 */
export function setOrderCleanupBroadcast(broadcastFn: (tableId: number, data: any) => void): void {
  broadcastToTableFn = broadcastFn;
}

/**
 * Runs the cleanup logic for served orders.
 * - Finds orders that were served more than 10 minutes ago and aren't hidden yet
 * - Marks them as hidden
 * - Broadcasts order_hidden event to affected tables
 * - If all orders at a table are now hidden, broadcasts table_reset
 */
async function cleanupServedOrders(): Promise<void> {
  try {
    const cutoffTime = new Date(Date.now() - SERVED_EXPIRY_MS);
    
    // Find orders to hide: served, not yet hidden, servedAt older than 10 min
    const ordersToHide = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'Served'),
        eq(orders.hidden, false),
        lt(orders.servedAt, cutoffTime)
      ),
      columns: {
        id: true,
        tableId: true,
        orderNumber: true,
      },
    });
    
    if (ordersToHide.length === 0) {
      return; // Nothing to clean up
    }
    
    logger.info(`Order cleanup: hiding ${ordersToHide.length} served orders`);
    
    // Group orders by tableId for efficient broadcasting
    const ordersByTable = new Map<number, Array<{ id: number; orderNumber: string }>>();
    
    for (const order of ordersToHide) {
      const tableOrders = ordersByTable.get(order.tableId) ?? [];
      tableOrders.push({ id: order.id, orderNumber: order.orderNumber });
      ordersByTable.set(order.tableId, tableOrders);
    }
    
    // Update all orders to hidden
    const orderIds = ordersToHide.map(o => o.id);
    await db
      .update(orders)
      .set({ hidden: true, updatedAt: new Date() })
      .where(sql`${orders.id} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`);
    
    // Broadcast to each affected table
    for (const [tableId, tableOrders] of ordersByTable) {
      // Broadcast individual order_hidden events
      for (const order of tableOrders) {
        if (broadcastToTableFn) {
          broadcastToTableFn(tableId, {
            type: 'order_hidden',
            orderId: order.id,
            orderNumber: order.orderNumber,
            reason: 'expired',
          });
        }
      }
      
      // Check if all orders at this table are now hidden/served
      const activeOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.tableId, tableId),
          eq(orders.hidden, false),
          ne(orders.status, 'Cancelled')
        ),
        columns: { id: true },
      });
      
      // If no active orders remain, broadcast table_reset
      if (activeOrders.length === 0 && broadcastToTableFn) {
        logger.info(`Order cleanup: all orders at table ${tableId} are complete, broadcasting table_reset`);
        broadcastToTableFn(tableId, {
          type: 'table_reset',
          tableId,
          message: 'All orders have been served and completed',
        });
      }
    }
  } catch (error) {
    logger.error(`Order cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Starts the order cleanup worker.
 * Runs every 60 seconds to hide orders served more than 10 minutes ago.
 */
export function startOrderCleanupWorker(): void {
  if (cleanupIntervalId) {
    logger.warn('Order cleanup worker already running');
    return;
  }
  
  logger.info('Starting order cleanup worker (interval: 60s, expiry: 10min)');
  
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

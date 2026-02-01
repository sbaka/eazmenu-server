import type { 
  OrderLifecycleProtocol, 
  RestaurantProtocolConfig,
  OrderForLifecycle,
  HideCheckResult,
  TableResetCheckResult
} from './protocol.interface';
import { DefaultProtocol } from './protocols/default.protocol';
import { QuickTurnProtocol } from './protocols/quick-turn.protocol';
import { ManualProtocol } from './protocols/manual.protocol';
import { SupabaseBroadcaster, supabaseBroadcaster } from './supabase-broadcaster';
import { db } from '@db';
import { restaurants, orders } from '@sbaka/shared';
import { eq, and, ne } from 'drizzle-orm';
import logger from '../../logger';

/**
 * Protocol Manager
 * 
 * Central registry and factory for order lifecycle protocols.
 * Handles loading restaurant-specific configurations and executing
 * protocol logic during the cleanup worker cycle.
 * 
 * @example
 * ```typescript
 * const manager = new ProtocolManager();
 * 
 * // Get protocol for a restaurant
 * const protocol = await manager.getProtocolForRestaurant(restaurantId);
 * 
 * // Check if orders should be hidden
 * const result = protocol.shouldHideOrder(order, config);
 * 
 * // Or run the full cleanup cycle
 * await manager.runCleanupCycle();
 * ```
 */
export class ProtocolManager {
  private protocols: Map<string, OrderLifecycleProtocol> = new Map();
  private broadcaster: SupabaseBroadcaster;
  private configCache: Map<number, { config: RestaurantProtocolConfig; cachedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache
  
  constructor(broadcaster?: SupabaseBroadcaster) {
    this.broadcaster = broadcaster ?? supabaseBroadcaster;
    this.registerBuiltInProtocols();
  }
  
  /**
   * Register all built-in protocols
   */
  private registerBuiltInProtocols(): void {
    this.register(new DefaultProtocol());
    this.register(new QuickTurnProtocol());
    this.register(new ManualProtocol());
  }
  
  /**
   * Register a custom protocol
   */
  register(protocol: OrderLifecycleProtocol): void {
    this.protocols.set(protocol.name, protocol);
    logger.debug(`Registered order lifecycle protocol: ${protocol.name}`);
  }
  
  /**
   * Get a protocol by name
   */
  getProtocol(name: string): OrderLifecycleProtocol {
    const protocol = this.protocols.get(name);
    if (!protocol) {
      logger.warn(`Unknown protocol "${name}", falling back to default`);
      return this.protocols.get('default')!;
    }
    return protocol;
  }
  
  /**
   * Get all registered protocol names
   */
  getAvailableProtocols(): string[] {
    return Array.from(this.protocols.keys());
  }
  
  /**
   * Get protocol configuration for a restaurant
   */
  async getRestaurantConfig(restaurantId: number): Promise<RestaurantProtocolConfig> {
    // Check cache first
    const cached = this.configCache.get(restaurantId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.config;
    }
    
    try {
      const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
        columns: {
          id: true,
          orderLifecycleProtocol: true,
          orderHideDelayMinutes: true,
        },
      });
      
      const config: RestaurantProtocolConfig = {
        restaurantId,
        protocol: (restaurant?.orderLifecycleProtocol as 'default' | 'quick_turn' | 'manual') ?? 'default',
        hideDelayMinutes: restaurant?.orderHideDelayMinutes ?? 10,
      };
      
      // Cache the config
      this.configCache.set(restaurantId, { config, cachedAt: Date.now() });
      
      return config;
    } catch (error) {
      logger.error(`Failed to load restaurant config for ${restaurantId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return default config on error
      return {
        restaurantId,
        protocol: 'default',
        hideDelayMinutes: 10,
      };
    }
  }
  
  /**
   * Clear cached configurations (useful after restaurant settings update)
   */
  clearCache(restaurantId?: number): void {
    if (restaurantId) {
      this.configCache.delete(restaurantId);
    } else {
      this.configCache.clear();
    }
  }
  
  /**
   * Check if a specific order should be hidden
   */
  async checkOrderForHiding(order: OrderForLifecycle): Promise<HideCheckResult> {
    const config = await this.getRestaurantConfig(order.restaurantId);
    const protocol = this.getProtocol(config.protocol);
    return protocol.shouldHideOrder(order, config);
  }
  
  /**
   * Check if a table should be reset
   */
  async checkTableForReset(
    tableId: number, 
    restaurantId: number,
    remainingOrders: OrderForLifecycle[]
  ): Promise<TableResetCheckResult> {
    const config = await this.getRestaurantConfig(restaurantId);
    const protocol = this.getProtocol(config.protocol);
    return protocol.shouldResetTable(tableId, remainingOrders);
  }
  
  /**
   * Execute order hidden callback
   */
  async executeOrderHiddenCallback(order: OrderForLifecycle): Promise<void> {
    const config = await this.getRestaurantConfig(order.restaurantId);
    const protocol = this.getProtocol(config.protocol);
    
    if (protocol.onOrderHidden) {
      await protocol.onOrderHidden(order, this.broadcaster);
    }
  }
  
  /**
   * Execute table reset callback
   */
  async executeTableResetCallback(tableId: number, restaurantId: number): Promise<void> {
    const config = await this.getRestaurantConfig(restaurantId);
    const protocol = this.getProtocol(config.protocol);
    
    if (protocol.onTableReset) {
      await protocol.onTableReset(tableId, this.broadcaster);
    }
  }
  
  /**
   * Get remaining active orders at a table
   */
  async getRemainingActiveOrders(tableId: number): Promise<OrderForLifecycle[]> {
    return await db.query.orders.findMany({
      where: and(
        eq(orders.tableId, tableId),
        eq(orders.hidden, false),
        ne(orders.status, 'Cancelled')
      ),
    }) as OrderForLifecycle[];
  }
  
  /**
   * Run a full cleanup cycle across all restaurants
   * This is called by the cleanup worker at regular intervals
   */
  async runCleanupCycle(): Promise<{ hiddenCount: number; resetTables: number }> {
    let hiddenCount = 0;
    let resetTables = 0;
    
    try {
      // Get all served, non-hidden orders
      const servedOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.status, 'Served'),
          eq(orders.hidden, false)
        ),
      }) as OrderForLifecycle[];
      
      if (servedOrders.length === 0) {
        return { hiddenCount: 0, resetTables: 0 };
      }
      
      // Group by restaurant to batch config lookups
      const ordersByRestaurant = new Map<number, OrderForLifecycle[]>();
      for (const order of servedOrders) {
        const list = ordersByRestaurant.get(order.restaurantId) ?? [];
        list.push(order);
        ordersByRestaurant.set(order.restaurantId, list);
      }
      
      // Track affected tables for reset checking
      const affectedTables = new Map<number, number>(); // tableId -> restaurantId
      
      // Process each restaurant's orders
      for (const [restaurantId, restaurantOrders] of ordersByRestaurant) {
        const config = await this.getRestaurantConfig(restaurantId);
        const protocol = this.getProtocol(config.protocol);
        
        // Skip manual protocol restaurants - they don't auto-hide
        if (config.protocol === 'manual') {
          continue;
        }
        
        for (const order of restaurantOrders) {
          const result = protocol.shouldHideOrder(order, config);
          
          if (result.shouldHide) {
            // Update order to hidden
            await db.update(orders)
              .set({ hidden: true, updatedAt: new Date() })
              .where(eq(orders.id, order.id));
            
            // Execute callback (broadcasts event)
            await this.executeOrderHiddenCallback(order);
            
            hiddenCount++;
            affectedTables.set(order.tableId, order.restaurantId);
            
            logger.debug(`Order ${order.id} hidden: ${result.reason}`);
          }
        }
      }
      
      // Check affected tables for reset
      for (const [tableId, restaurantId] of affectedTables) {
        const remaining = await this.getRemainingActiveOrders(tableId);
        const resetResult = await this.checkTableForReset(tableId, restaurantId, remaining);
        
        if (resetResult.shouldReset) {
          await this.executeTableResetCallback(tableId, restaurantId);
          resetTables++;
          logger.info(`Table ${tableId} reset: ${resetResult.message}`);
        }
      }
      
      if (hiddenCount > 0 || resetTables > 0) {
        logger.info(`Cleanup cycle complete: ${hiddenCount} orders hidden, ${resetTables} tables reset`);
      }
      
    } catch (error) {
      logger.error(`Error in cleanup cycle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return { hiddenCount, resetTables };
  }
}

// Singleton instance
export const protocolManager = new ProtocolManager();

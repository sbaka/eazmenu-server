import type { SupabaseBroadcaster } from './supabase-broadcaster';

/**
 * Minimal order data required for lifecycle decisions
 */
export interface OrderForLifecycle {
  id: number;
  orderNumber: string;
  tableId: number;
  restaurantId: number;
  status: 'Received' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';
  hidden: boolean;
  servedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Restaurant-specific protocol configuration
 */
export interface RestaurantProtocolConfig {
  restaurantId: number;
  protocol: 'default' | 'quick_turn' | 'manual';
  hideDelayMinutes: number;
}

/**
 * Result of checking if an order should be hidden
 */
export interface HideCheckResult {
  shouldHide: boolean;
  reason?: string;
}

/**
 * Result of checking if a table should be reset
 */
export interface TableResetCheckResult {
  shouldReset: boolean;
  message?: string;
}

/**
 * Order Lifecycle Protocol Interface
 * 
 * Implement this interface to create custom cleanup behaviors for orders.
 * Each protocol defines rules for:
 * - When orders should be hidden (removed from customer view)
 * - When tables should be reset (all orders complete)
 * 
 * Protocols are registered with the ProtocolManager and selected per-restaurant.
 * 
 * @example
 * ```typescript
 * class CustomProtocol implements OrderLifecycleProtocol {
 *   name = 'custom';
 *   
 *   shouldHideOrder(order, config) {
 *     // Custom logic here
 *     return { shouldHide: true, reason: 'custom_rule' };
 *   }
 *   
 *   shouldResetTable(tableId, remainingOrders) {
 *     return { shouldReset: remainingOrders.length === 0 };
 *   }
 * }
 * 
 * protocolManager.register('custom', new CustomProtocol());
 * ```
 */
export interface OrderLifecycleProtocol {
  /**
   * Unique identifier for this protocol
   */
  readonly name: string;
  
  /**
   * Human-readable description of this protocol's behavior
   */
  readonly description: string;
  
  /**
   * Default hide delay in minutes (can be overridden per-restaurant)
   */
  getDefaultHideDelayMinutes(): number;
  
  /**
   * Determines if an order should be hidden from customer view.
   * 
   * @param order - The order to check
   * @param config - Restaurant-specific configuration
   * @returns Whether to hide and the reason
   */
  shouldHideOrder(order: OrderForLifecycle, config: RestaurantProtocolConfig): HideCheckResult;
  
  /**
   * Determines if a table should be reset (all orders complete notification).
   * Called after orders are hidden.
   * 
   * @param tableId - The table ID to check
   * @param remainingActiveOrders - Orders that are still visible at this table
   * @returns Whether to reset and the message to display
   */
  shouldResetTable(tableId: number, remainingActiveOrders: OrderForLifecycle[]): TableResetCheckResult;
  
  /**
   * Optional hook called when an order is hidden.
   * Use for custom side effects (logging, analytics, notifications).
   * 
   * @param order - The order being hidden
   * @param broadcaster - Supabase broadcaster for sending realtime events
   */
  onOrderHidden?(order: OrderForLifecycle, broadcaster: SupabaseBroadcaster): Promise<void>;
  
  /**
   * Optional hook called when a table is reset.
   * Use for custom side effects.
   * 
   * @param tableId - The table being reset
   * @param broadcaster - Supabase broadcaster for sending realtime events
   */
  onTableReset?(tableId: number, broadcaster: SupabaseBroadcaster): Promise<void>;
}

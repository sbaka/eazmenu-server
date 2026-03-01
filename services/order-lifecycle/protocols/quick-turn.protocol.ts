import type {
  OrderLifecycleProtocol,
  OrderForLifecycle,
  RestaurantProtocolConfig,
  HideCheckResult,
  TableResetCheckResult
} from '../protocol.interface';
import type { SupabaseBroadcaster } from '../supabase-broadcaster';

/**
 * Quick Turn Order Lifecycle Protocol
 * 
 * Designed for fast-casual restaurants with high table turnover.
 * Orders are hidden 5 minutes after being served by default.
 * 
 * Use this for:
 * - Fast food restaurants
 * - Coffee shops
 * - Quick-service counters
 */
export class QuickTurnProtocol implements OrderLifecycleProtocol {
  readonly name = 'quick_turn';
  readonly description = 'Fast-casual cleanup: hide orders 5 minutes after served';

  getDefaultHideDelayMinutes(): number {
    return 5;
  }

  shouldHideOrder(order: OrderForLifecycle, config: RestaurantProtocolConfig): HideCheckResult {
    // Only hide served orders that aren't already hidden
    if (order.status !== 'Served' || order.hidden) {
      return { shouldHide: false };
    }

    if (!order.servedAt) {
      return { shouldHide: false };
    }

    // Quick turn uses shorter default (5 min) but respects restaurant override
    const hideDelayMs = (config.hideDelayMinutes || this.getDefaultHideDelayMinutes()) * 60 * 1000;
    const timeSinceServed = Date.now() - order.servedAt.getTime();

    if (timeSinceServed >= hideDelayMs) {
      return {
        shouldHide: true,
        reason: 'quick_turn_expired'
      };
    }

    return { shouldHide: false };
  }

  shouldResetTable(_tableId: number, remainingActiveOrders: OrderForLifecycle[]): TableResetCheckResult {
    const hasActiveOrders = remainingActiveOrders.some(
      order => !order.hidden && order.status !== 'Cancelled'
    );

    return {
      shouldReset: !hasActiveOrders,
      message: hasActiveOrders
        ? undefined
        : 'Table ready for next guest',
    };
  }

  // onOrderHidden is intentionally omitted — Supabase postgres_changes
  // automatically broadcasts the UPDATE (hidden=true) to all subscribers.

  async onTableReset(tableId: number, broadcaster: SupabaseBroadcaster): Promise<void> {
    await broadcaster.broadcastTableReset(
      tableId,
      'Table ready for next guest'
    );
  }
}

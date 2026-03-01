import type {
  OrderLifecycleProtocol,
  OrderForLifecycle,
  RestaurantProtocolConfig,
  HideCheckResult,
  TableResetCheckResult
} from '../protocol.interface';
import type { SupabaseBroadcaster } from '../supabase-broadcaster';

/**
 * Default Order Lifecycle Protocol
 * 
 * Time-based cleanup: orders are hidden N minutes after being served,
 * where N is configurable per-restaurant (default: 10 minutes).
 * 
 * This is the standard protocol suitable for most sit-down restaurants.
 */
export class DefaultProtocol implements OrderLifecycleProtocol {
  readonly name = 'default';
  readonly description = 'Time-based cleanup: hide orders N minutes after served (default: 10 min)';

  getDefaultHideDelayMinutes(): number {
    return 10;
  }

  shouldHideOrder(order: OrderForLifecycle, config: RestaurantProtocolConfig): HideCheckResult {
    // Only hide served orders that aren't already hidden
    if (order.status !== 'Served' || order.hidden) {
      return { shouldHide: false };
    }

    // Check if enough time has passed since serving
    if (!order.servedAt) {
      return { shouldHide: false };
    }

    const hideDelayMs = (config.hideDelayMinutes || this.getDefaultHideDelayMinutes()) * 60 * 1000;
    const timeSinceServed = Date.now() - order.servedAt.getTime();

    if (timeSinceServed >= hideDelayMs) {
      return {
        shouldHide: true,
        reason: `expired_after_${config.hideDelayMinutes || this.getDefaultHideDelayMinutes()}_minutes`
      };
    }

    return { shouldHide: false };
  }

  shouldResetTable(_tableId: number, remainingActiveOrders: OrderForLifecycle[]): TableResetCheckResult {
    // Reset table when no active (non-hidden, non-cancelled) orders remain
    const hasActiveOrders = remainingActiveOrders.some(
      order => !order.hidden && order.status !== 'Cancelled'
    );

    return {
      shouldReset: !hasActiveOrders,
      message: hasActiveOrders
        ? undefined
        : 'All orders have been served and completed',
    };
  }

  // onOrderHidden is intentionally omitted — Supabase postgres_changes
  // automatically broadcasts the UPDATE (hidden=true) to all subscribers.

  async onTableReset(tableId: number, broadcaster: SupabaseBroadcaster): Promise<void> {
    await broadcaster.broadcastTableReset(
      tableId,
      'All orders have been served and completed'
    );
  }
}

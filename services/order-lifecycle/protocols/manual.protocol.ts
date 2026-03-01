import type {
  OrderLifecycleProtocol,
  OrderForLifecycle,
  RestaurantProtocolConfig,
  HideCheckResult,
  TableResetCheckResult
} from '../protocol.interface';
import type { SupabaseBroadcaster } from '../supabase-broadcaster';

/**
 * Manual Order Lifecycle Protocol
 * 
 * No automatic cleanup - orders are only hidden when staff explicitly
 * triggers a table reset. This gives full control to restaurant staff.
 * 
 * Use this for:
 * - Fine dining with long service times
 * - Events or banquet settings
 * - Restaurants that want explicit control over table turnover
 * 
 * Note: Staff can trigger manual resets via the admin API endpoint
 * POST /api/tables/:tableId/reset
 */
export class ManualProtocol implements OrderLifecycleProtocol {
  readonly name = 'manual';
  readonly description = 'Staff-controlled: orders hidden only when staff resets table';

  getDefaultHideDelayMinutes(): number {
    // Manual protocol doesn't use time-based hiding
    // Return a large number to indicate "never" for automatic cleanup
    return Number.MAX_SAFE_INTEGER;
  }

  shouldHideOrder(_order: OrderForLifecycle, _config: RestaurantProtocolConfig): HideCheckResult {
    // Manual protocol never automatically hides orders
    // Staff must explicitly trigger hiding via API
    return {
      shouldHide: false,
      reason: 'manual_protocol_no_auto_hide'
    };
  }

  shouldResetTable(_tableId: number, _remainingActiveOrders: OrderForLifecycle[]): TableResetCheckResult {
    // Manual protocol never automatically resets tables
    // Staff must explicitly trigger reset via API
    return {
      shouldReset: false,
      message: 'Manual reset required by staff',
    };
  }

  // onOrderHidden is intentionally omitted — Supabase postgres_changes
  // automatically broadcasts the UPDATE (hidden=true) to all subscribers.

  /**
   * Called when staff manually resets a table via API
   */
  async onTableReset(tableId: number, broadcaster: SupabaseBroadcaster): Promise<void> {
    await broadcaster.broadcastTableReset(
      tableId,
      'Table has been reset by staff'
    );
  }
}

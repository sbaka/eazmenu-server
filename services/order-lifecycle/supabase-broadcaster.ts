import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import logger from '../../logger';

type RealtimeChannel = ReturnType<SupabaseClient['channel']>;

/**
 * Supabase Realtime Broadcaster
 * 
 * Handles broadcasting order lifecycle events that have no corresponding
 * database row change (e.g. table_reset) to connected clients via
 * Supabase Realtime Broadcast channels.
 * 
 * All order CRUD events (new_order, order_status_updated, order_hidden)
 * are handled automatically by Supabase postgres_changes — clients
 * subscribe to those directly and do NOT need explicit broadcasts.
 * 
 * Channel naming convention:
 * - `table:{tableId}` - For customer-facing events at a specific table
 */
export class SupabaseBroadcaster {
  private supabase: SupabaseClient | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscribedChannels: Set<string> = new Set();

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.warn('Supabase credentials not configured. Realtime broadcasts will be disabled.');
      return;
    }

    if (supabaseKey.startsWith('sb_publishable_')) {
      logger.warn('Supabase key is publishable; realtime broadcasts may fail. Prefer SUPABASE_SERVICE_ROLE_KEY.');
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      logger.info('Supabase broadcaster initialized');
    } catch (error) {
      logger.error(`Failed to initialize Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for a channel to be subscribed before returning
   */
  private async waitForSubscription(channel: RealtimeChannel, channelName: string): Promise<boolean> {
    return new Promise((resolve) => {
      // If already subscribed, resolve immediately
      if (this.subscribedChannels.has(channelName)) {
        resolve(true);
        return;
      }

      // Set a timeout to avoid hanging
      const timeout = setTimeout(() => {
        logger.warn(`Channel ${channelName} subscription timeout`);
        resolve(false);
      }, 5000);

      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.subscribedChannels.add(channelName);
          logger.debug(`Subscribed to broadcast channel: ${channelName}`);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          clearTimeout(timeout);
          this.subscribedChannels.delete(channelName);
          resolve(false);
        }
      });
    });
  }

  /**
   * Get or create a broadcast channel for a specific table
   */
  private async getTableChannel(tableId: number): Promise<RealtimeChannel | null> {
    if (!this.supabase) return null;

    const channelName = `table:${tableId}`;

    if (!this.channels.has(channelName)) {
      const channel = this.supabase.channel(channelName);
      this.channels.set(channelName, channel);
      await this.waitForSubscription(channel, channelName);
    } else if (!this.subscribedChannels.has(channelName)) {
      // Channel exists but not subscribed, wait for subscription
      const channel = this.channels.get(channelName)!;
      await this.waitForSubscription(channel, channelName);
    }

    return this.channels.get(channelName) ?? null;
  }

  /**
   * Broadcast a table_reset event to the table's customers.
   * This is the only event that requires an explicit broadcast because
   * table resets have no corresponding database row change.
   */
  async broadcastTableReset(tableId: number, message: string): Promise<void> {
    const channel = await this.getTableChannel(tableId);

    if (!channel) {
      logger.debug(`Skipping table_reset broadcast (no Supabase client)`);
      return;
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'table_reset',
        payload: {
          tableId,
          message,
          timestamp: Date.now(),
        },
      });
      logger.debug(`Broadcast table_reset for table ${tableId}`);
    } catch (error) {
      logger.error(`Failed to broadcast table_reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup all channels on shutdown
   */
  async cleanup(): Promise<void> {
    for (const [name, channel] of this.channels) {
      try {
        await channel.unsubscribe();
        this.subscribedChannels.delete(name);
        logger.debug(`Unsubscribed from channel: ${name}`);
      } catch (error) {
        logger.error(`Error unsubscribing from channel ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    this.channels.clear();
    this.subscribedChannels.clear();
    logger.info('Supabase broadcaster cleaned up');
  }
}

// Singleton instance for use across the application
export const supabaseBroadcaster = new SupabaseBroadcaster();

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import logger from '../../logger';

type RealtimeChannel = ReturnType<SupabaseClient['channel']>;

/**
 * Supabase Realtime Broadcaster
 * 
 * Handles broadcasting order lifecycle events (order_hidden, table_reset)
 * to connected clients via Supabase Realtime Broadcast channels.
 * 
 * Channel naming convention:
 * - `table:{tableId}` - For customer-facing events at a specific table
 * - `restaurant:{restaurantId}` - For admin/staff events at a restaurant
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
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.warn('Supabase credentials not configured. Realtime broadcasts will be disabled.');
      return;
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
   * Get or create a broadcast channel for a restaurant
   */
  private async getRestaurantChannel(restaurantId: number): Promise<RealtimeChannel | null> {
    if (!this.supabase) return null;
    
    const channelName = `restaurant:${restaurantId}`;
    
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
   * Broadcast an order_hidden event to the table's customers
   */
  async broadcastOrderHidden(
    tableId: number,
    orderId: number,
    orderNumber: string,
    reason: string = 'expired'
  ): Promise<void> {
    const channel = await this.getTableChannel(tableId);
    
    if (!channel) {
      logger.debug(`Skipping order_hidden broadcast (no Supabase client)`);
      return;
    }
    
    try {
      await channel.send({
        type: 'broadcast',
        event: 'order_hidden',
        payload: {
          orderId,
          orderNumber,
          reason,
          timestamp: Date.now(),
        },
      });
      logger.debug(`Broadcast order_hidden for order ${orderId} to table ${tableId}`);
    } catch (error) {
      logger.error(`Failed to broadcast order_hidden: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Broadcast a table_reset event to the table's customers
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
   * Broadcast a new order event to restaurant staff
   */
  async broadcastNewOrder(restaurantId: number, order: any): Promise<void> {
    const channel = await this.getRestaurantChannel(restaurantId);
    
    if (!channel) {
      logger.debug(`Skipping new_order broadcast (no Supabase client)`);
      return;
    }
    
    try {
      await channel.send({
        type: 'broadcast',
        event: 'new_order',
        payload: {
          order,
          timestamp: Date.now(),
        },
      });
      logger.debug(`Broadcast new_order for restaurant ${restaurantId}`);
    } catch (error) {
      logger.error(`Failed to broadcast new_order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Broadcast an order status update to both table customers and restaurant staff
   */
  async broadcastOrderStatusUpdate(
    tableId: number,
    restaurantId: number,
    order: any
  ): Promise<void> {
    // Notify customers at the table
    const tableChannel = await this.getTableChannel(tableId);
    if (tableChannel) {
      try {
        await tableChannel.send({
          type: 'broadcast',
          event: 'order_status_updated',
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            message: `Order ${order.orderNumber} is now ${order.status}`,
            timestamp: Date.now(),
          },
        });
      } catch (error) {
        logger.error(`Failed to broadcast order_status_updated to table: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Notify restaurant staff
    const restaurantChannel = await this.getRestaurantChannel(restaurantId);
    if (restaurantChannel) {
      try {
        await restaurantChannel.send({
          type: 'broadcast',
          event: 'order_status_updated',
          payload: {
            order,
            timestamp: Date.now(),
          },
        });
      } catch (error) {
        logger.error(`Failed to broadcast order_status_updated to restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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

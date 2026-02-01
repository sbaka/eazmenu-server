/**
 * Order Lifecycle Protocol System
 * 
 * This module provides an abstraction layer for managing order lifecycle events
 * (hiding, resetting tables) with pluggable protocol implementations.
 * 
 * Each restaurant can configure its own protocol, allowing for different
 * cleanup behaviors based on business needs.
 */

export type { OrderLifecycleProtocol, RestaurantProtocolConfig, OrderForLifecycle, HideCheckResult, TableResetCheckResult } from './protocol.interface';
export { ProtocolManager, protocolManager } from './protocol-manager';
export { SupabaseBroadcaster, supabaseBroadcaster } from './supabase-broadcaster';

// Protocol implementations
export { DefaultProtocol } from './protocols/default.protocol';
export { QuickTurnProtocol } from './protocols/quick-turn.protocol';
export { ManualProtocol } from './protocols/manual.protocol';

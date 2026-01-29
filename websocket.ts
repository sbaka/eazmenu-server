import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { tables, restaurants } from "@sbaka/shared";
import { db } from "@db";
import { eq, and } from "drizzle-orm";
import logger, { sanitizeError } from "./logger";
import { setOrderCleanupBroadcast, startOrderCleanupWorker, stopOrderCleanupWorker } from "./workers/order-cleanup";
import { verifySupabaseToken } from "./auth";

// Order status type from schema
type OrderStatus = 'Received' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number; // merchants.id from schema - ONLY set from validated JWT
  tableId?: number; // tables.id from schema
  restaurantId?: number; // restaurants.id from schema
  isAuthenticated?: boolean;
  lastPing?: number; // Changed to timestamp instead of Date
  isStaff?: boolean; // true if authenticated via JWT (staff), false for table auth (customer)
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws',
    // Allow all connections initially - auth happens after connection
    verifyClient: () => {
      return true;
    }
  });

  // Store connections by restaurant (userId) for broadcasting to staff
  const restaurantConnections: Record<number, AuthenticatedWebSocket[]> = {};
  
  // Store connections by table for customer notifications
  const tableConnections: Record<number, AuthenticatedWebSocket[]> = {};

  // Message handler functions
  // Staff authentication - validates JWT token
  async function handleAuthMessage(ws: AuthenticatedWebSocket, data: any, _req: IncomingMessage) {
    try {
      // Get JWT token from the auth message
      const token = data.token;
      
      if (!token) {
        ws.send(JSON.stringify({ 
          type: 'auth', 
          success: false, 
          error: 'No authorization token provided. Please log in first.' 
        }));
        return;
      }
      
      // Verify Supabase token and get merchant
      const merchant = await verifySupabaseToken(token);
      
      if (!merchant) {
        ws.send(JSON.stringify({ 
          type: 'auth', 
          success: false, 
          error: 'Invalid or expired token. Please log in again.' 
        }));
        return;
      }
      
      // Set userId from validated JWT
      ws.userId = merchant.id;
      ws.isAuthenticated = true;
      ws.isStaff = true;
      ws.lastPing = Date.now();
      
      if (!restaurantConnections[merchant.id]) {
        restaurantConnections[merchant.id] = [];
      }
      restaurantConnections[merchant.id].push(ws);
      
      logger.info(`Staff WebSocket authenticated for merchant ${merchant.id} via JWT`);
      ws.send(JSON.stringify({ type: 'auth', success: true, merchantId: merchant.id }));
    } catch (error) {
      logger.error(`JWT authentication error: ${sanitizeError(error)}`);
      ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Authentication failed' }));
    }
  }

  async function handleTableAuthMessage(ws: AuthenticatedWebSocket, data: any) {
    if (typeof data.tableId === 'number' && typeof data.restaurantId === 'number') {
      try {
        const table = await db.query.tables.findFirst({
          where: and(
            eq(tables.id, data.tableId),
            eq(tables.restaurantId, data.restaurantId)
          ),
        });
        
        if (table) {
          ws.tableId = data.tableId;
          ws.restaurantId = data.restaurantId;
          ws.isAuthenticated = true;
          ws.isStaff = false; // Customer connection
          ws.lastPing = Date.now();
          
          if (!tableConnections[data.tableId]) {
            tableConnections[data.tableId] = [];
          }
          tableConnections[data.tableId].push(ws);
          
          logger.info(`Customer WebSocket authenticated for table ${data.tableId}`);
          ws.send(JSON.stringify({ 
            type: 'table_auth', 
            success: true, 
            tableId: data.tableId,
            restaurantId: data.restaurantId
          }));
        } else {
          ws.send(JSON.stringify({ type: 'table_auth', success: false, error: 'Table not found or invalid restaurant' }));
        }
      } catch (error) {
        logger.error(`Table validation error: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ type: 'table_auth', success: false, error: 'Authentication failed' }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'table_auth', success: false, error: 'Invalid table authentication - tableId and restaurantId required' }));
    }
  }

  async function handleNewOrderMessage(ws: AuthenticatedWebSocket, data: any) {
    if (data.order?.id) {
      try {
        const restaurant = await db.query.restaurants.findFirst({
          where: eq(restaurants.id, ws.restaurantId!),
          columns: { merchantId: true }
        });
        
        if (restaurant) {
          broadcastToRestaurant(restaurant.merchantId, {
            type: 'new_order',
            order: data.order,
            tableId: ws.tableId,
          });
        }
        
        ws.send(JSON.stringify({ 
          type: 'order_received', 
          orderId: data.order.id,
          status: 'Received' as OrderStatus
        }));
      } catch (error) {
        logger.error(`Error broadcasting new order: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to notify restaurant staff' }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid order data' }));
    }
  }

  async function handleUpdateOrderStatusMessage(ws: AuthenticatedWebSocket, data: any) {
    if (data.order?.id && data.order.tableId && data.order.restaurantId) {
      try {
        const restaurant = await db.query.restaurants.findFirst({
          where: and(
            eq(restaurants.id, data.order.restaurantId),
            eq(restaurants.merchantId, ws.userId!)
          ),
          columns: { id: true, merchantId: true }
        });
        
        if (!restaurant) {
          ws.send(JSON.stringify({ type: 'error', message: 'Access denied - restaurant not found or not owned by merchant' }));
          return;
        }
        
        const validStatuses: OrderStatus[] = ['Received', 'Preparing', 'Ready', 'Served', 'Cancelled'];
        if (!validStatuses.includes(data.order.status as OrderStatus)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid order status' }));
          return;
        }
        
        broadcastToTable(data.order.tableId, {
          type: 'order_status_updated',
          orderId: data.order.id,
          status: data.order.status as OrderStatus,
          message: `Order ${data.order.orderNumber} is now ${data.order.status}`,
        });
        
        broadcastToRestaurant(ws.userId!, {
          type: 'order_status_updated',
          order: data.order,
        }, ws);
      } catch (error) {
        logger.error(`Error updating order status: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to update order status' }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid order data for status update - missing required fields' }));
    }
  }

  function handlePingMessage(ws: AuthenticatedWebSocket) {
    // Always respond to pings to keep connection alive during auth flow
    ws.lastPing = Date.now();
    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
  }

  // Set up interval to clean up stale connections
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAuthenticated && ws.lastPing) {
        // Terminate connections that haven't pinged in 45 seconds
        if (now - ws.lastPing > 45000) {
          logger.info('Terminating stale WebSocket connection');
          ws.terminate();
        }
      }
    });
  }, 30000); // Check every 30 seconds

  // Helper function to broadcast to all staff of a restaurant
  function broadcastToRestaurant(merchantId: number, data: any, excludeWs?: AuthenticatedWebSocket) {
    if (restaurantConnections[merchantId]) {
      const message = JSON.stringify(data);
      restaurantConnections[merchantId].forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs && client.isAuthenticated) {
          client.send(message);
        }
      });
    }
  }
  
  // Helper function to broadcast to all clients at a table
  function broadcastToTable(tableId: number, data: any) {
    if (tableConnections[tableId]) {
      const message = JSON.stringify(data);
      tableConnections[tableId].forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
          client.send(message);
        }
      });
    }
  }

  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    logger.info('WebSocket connection established');
    ws.lastPing = Date.now(); // Initialize last ping time

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Route messages to appropriate handlers
        // Handle ping first - always respond regardless of auth state
        if (data.type === 'ping') {
          handlePingMessage(ws);
        } else if (data.type === 'auth') {
          await handleAuthMessage(ws, data, req);
        } else if (data.type === 'table_auth') {
          await handleTableAuthMessage(ws, data);
        } else if (data.type === 'new_order' && ws.tableId && ws.restaurantId && ws.isAuthenticated) {
          await handleNewOrderMessage(ws, data);
        } else if (data.type === 'update_order_status' && ws.userId && ws.isAuthenticated && ws.isStaff) {
          // Only staff (session-authenticated) can update order status
          await handleUpdateOrderStatusMessage(ws, data);
        } else if (!ws.isAuthenticated) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Authentication required. Please send auth or table_auth message first.' 
          }));
          ws.close(1008, 'Authentication required');
        } else {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown message type: ${data.type}` 
          }));
        }
      } catch (error) {
        logger.error(`Error handling WebSocket message: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: sanitizeError(error)
        }));
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket connection closed');
      cleanupConnection(ws);
    });
    
    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${sanitizeError(error)}`);
      cleanupConnection(ws);
    });
  });

  // Helper function to clean up connections
  function cleanupConnection(ws: AuthenticatedWebSocket) {
    // Remove from restaurant connections
    if (ws.userId && restaurantConnections[ws.userId]) {
      restaurantConnections[ws.userId] = restaurantConnections[ws.userId].filter(
        connection => connection !== ws
      );
      if (restaurantConnections[ws.userId].length === 0) {
        delete restaurantConnections[ws.userId];
      }
    }
    // Remove from table connections
    if (ws.tableId && tableConnections[ws.tableId]) {
      tableConnections[ws.tableId] = tableConnections[ws.tableId].filter(
        connection => connection !== ws
      );
      if (tableConnections[ws.tableId].length === 0) {
        delete tableConnections[ws.tableId];
      }
    }
  }
  
  // Consolidated connection health check - single interval with consistent 45s timeout
  // (Removed duplicate 5-minute interval to prevent confusion)
  const connectionHealthInterval = setInterval(() => {
    const now = Date.now();
    const timeout = 45000; // 45 seconds - matches client ping interval + buffer
    
    // Check restaurant connections
    Object.keys(restaurantConnections).forEach(merchantId => {
      restaurantConnections[Number(merchantId)] = restaurantConnections[Number(merchantId)].filter(ws => {
        if (ws.readyState !== WebSocket.OPEN) {
          return false;
        }
        if (ws.lastPing && (now - ws.lastPing) > timeout) {
          logger.info(`Terminating stale restaurant connection for merchant ${merchantId}`);
          ws.terminate();
          return false;
        }
        return true;
      });
      
      if (restaurantConnections[Number(merchantId)].length === 0) {
        delete restaurantConnections[Number(merchantId)];
      }
    });
    
    // Check table connections
    Object.keys(tableConnections).forEach(tableId => {
      tableConnections[Number(tableId)] = tableConnections[Number(tableId)].filter(ws => {
        if (ws.readyState !== WebSocket.OPEN) {
          return false;
        }
        if (ws.lastPing && (now - ws.lastPing) > timeout) {
          logger.info(`Terminating stale table connection for table ${tableId}`);
          ws.terminate();
          return false;
        }
        return true;
      });
      
      if (tableConnections[Number(tableId)].length === 0) {
        delete tableConnections[Number(tableId)];
      }
    });
  }, 30000); // Check every 30 seconds

  // Initialize order cleanup worker with broadcastToTable function
  setOrderCleanupBroadcast(broadcastToTable);
  startOrderCleanupWorker();

  // Handle server shutdown
  server.on('close', () => {
    logger.info('Cleaning up WebSocket resources');
    clearInterval(cleanupInterval);
    clearInterval(connectionHealthInterval);
    stopOrderCleanupWorker();
    wss.close();
  });

  return {
    broadcastToRestaurant,
    broadcastToTable,
  };
}

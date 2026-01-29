import { Router } from "express";
import { eq, and, ne, or, inArray } from "drizzle-orm";
import { authenticate } from "../middleware";
import { getTableSessionId } from "../middleware/session";
import { storage } from "../storage";
import { rateLimits } from "../security";
import { tables, orders, restaurants, menuItems } from "@sbaka/shared";
import { db } from "@db";
import logger, { sanitizeError } from "../logger";

const router = Router();

// Get orders for a specific table (customer view)
// Returns active orders + same-session orders (including recently served)
router.get("/api/tables/:tableId/orders", rateLimits.orders, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    
    const sessionId = getTableSessionId(req);
    
    // Verify table exists
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId),
    });
    
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }
    
    // Query orders based on session:
    // - If sessionId matches, show all orders from this session (including served within 10 min)
    // - Otherwise, only show active non-hidden orders
    let tableOrders;
    
    if (sessionId) {
      // Same session: show session's orders OR active orders from others at the table
      tableOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.tableId, tableId),
          eq(orders.hidden, false),
          or(
            eq(orders.sessionId, sessionId), // Customer's own orders
            and(
              ne(orders.status, 'Served'), // Active orders from anyone
              ne(orders.status, 'Cancelled')
            )
          )
        ),
        with: {
          orderItems: {
            with: {
              menuItem: true,
            },
          },
        },
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      });
    } else {
      // No session: only show active, non-hidden orders
      tableOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.tableId, tableId),
          eq(orders.hidden, false),
          ne(orders.status, 'Served'),
          ne(orders.status, 'Cancelled')
        ),
        with: {
          orderItems: {
            with: {
              menuItem: true,
            },
          },
        },
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      });
    }
    
    // Mark which orders belong to this session for UI distinction
    const ordersWithOwnership = tableOrders.map(order => ({
      ...order,
      isOwnOrder: order.sessionId === sessionId,
    }));
    
    res.json(ordersWithOwnership);
  } catch (error) {
    logger.error(`Error fetching table orders: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Place an order (from customer) - PUBLIC ACCESS (no authentication required)
router.post("/api/orders", rateLimits.orders, async (req, res) => {
  try {
    const { restaurantId, tableId, items } = req.body;
    
    if (!restaurantId || !tableId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }
    
    // Validate items have required fields
    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ message: "Each item must have menuItemId and quantity >= 1" });
      }
    }
    
    // Get session ID for order ownership tracking
    const sessionId = getTableSessionId(req);
    
    // Verify table belongs to restaurant (security: prevent cross-restaurant orders)
    const table = await db.query.tables.findFirst({
      where: and(eq(tables.id, tableId), eq(tables.restaurantId, restaurantId)),
    });
    
    if (!table) {
      return res.status(404).json({ message: "Table not found or does not belong to restaurant" });
    }
    
    // Verify table is active (prevent orders on disabled tables)
    if (!table.active) {
      return res.status(403).json({ message: "Table is currently unavailable for orders" });
    }
    
    // SECURITY: Fetch actual menu item prices from database - DO NOT trust client prices
    const menuItemIds = items.map((item: any) => item.menuItemId);
    const dbMenuItems = await db.query.menuItems.findMany({
      where: inArray(menuItems.id, menuItemIds),
      with: {
        category: {
          columns: { restaurantId: true }
        }
      }
    });
    
    // Create a map for quick lookup
    const menuItemMap = new Map(dbMenuItems.map(item => [item.id, item]));
    
    // Validate all items exist and belong to this restaurant's menu
    const validatedItems: Array<{
      menuItemId: number;
      quantity: number;
      price: number; // Server-side price from DB
      notes?: string;
    }> = [];
    
    let serverCalculatedTotal = 0;
    
    for (const item of items) {
      const dbMenuItem = menuItemMap.get(item.menuItemId);
      
      if (!dbMenuItem) {
        return res.status(400).json({ 
          message: `Menu item ${item.menuItemId} not found` 
        });
      }
      
      // Verify item belongs to this restaurant via category
      if (dbMenuItem.category?.restaurantId !== restaurantId) {
        return res.status(400).json({ 
          message: `Menu item ${item.menuItemId} does not belong to this restaurant` 
        });
      }
      
      // Verify item is active (available for ordering)
      if (!dbMenuItem.active) {
        return res.status(400).json({ 
          message: `Menu item "${dbMenuItem.name}" is currently unavailable` 
        });
      }
      
      // Use server-side price, NOT client-provided price
      const serverPrice = parseFloat(String(dbMenuItem.price));
      const quantity = parseInt(item.quantity);
      
      validatedItems.push({
        menuItemId: item.menuItemId,
        quantity,
        price: serverPrice,
        notes: item.notes,
      });
      
      serverCalculatedTotal += serverPrice * quantity;
    }
    
    // Create order number (ORD + timestamp)
    const orderNumber = `ORD${Date.now().toString().slice(-6)}`;
    
    // Create order with items in a single transaction using server-calculated prices
    const order = await storage.createOrderWithItems({
      orderData: {
        orderNumber,
        tableId,
        restaurantId,
        status: "Received",
        total: serverCalculatedTotal,
        sessionId: sessionId ?? null,
      },
      orderItems: validatedItems,
    });
    
    // Fetch the complete order with items
    const completeOrder = await storage.getOrderWithItems(order.id);
    
    // Broadcast new order to restaurant staff via WebSocket
    const { broadcastToRestaurant, broadcastToTable } = global as any;
    if (broadcastToRestaurant) {
      // Get restaurant merchant ID for broadcasting
      const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
        columns: { merchantId: true }
      });
      
      if (restaurant) {
        broadcastToRestaurant(restaurant.merchantId, {
          type: 'new_order',
          order: completeOrder,
          tableId: tableId,
        });
      }
    }
    
    // Also broadcast to table so other customers at the table see the new order
    if (broadcastToTable) {
      broadcastToTable(tableId, {
        type: 'new_order',
        order: completeOrder,
      });
    }
    
    res.status(201).json(completeOrder);
  } catch (error) {
    logger.error(`Error creating order: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get orders for a restaurant (staff only)
router.get("/api/orders", authenticate, async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    
    // Validate restaurant ownership
    const restaurant = await db.query.restaurants.findFirst({
      where: and(eq(restaurants.id, restaurantId), eq(restaurants.merchantId, req.user!.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    
    const orders = await storage.getOrdersByRestaurantId(restaurantId, req.user!.id);
    res.json(orders);
  } catch (error) {
    logger.error(`Error fetching orders: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Update order status (staff only)
router.put("/api/orders/:id/status", authenticate, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Verify ownership - order's restaurant must belong to merchant
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { restaurant: true }
    });
    
    if (!order || order.restaurant.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    // Update order status (also sets servedAt if status is 'Served')
    const updated = await storage.updateOrderStatus(orderId, status, req.user!.id);
    if (!updated) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Get complete order with items
    const completeOrder = await storage.getOrderWithItems(orderId, req.user!.id);
    
    // Broadcast order status update to restaurant staff via WebSocket
    const { broadcastToRestaurant, broadcastToTable } = global as any;
    if (broadcastToRestaurant) {
      broadcastToRestaurant(req.user!.id, {
        type: 'order_status_updated',
        order: completeOrder,
      });
    }
    
    // Also broadcast to the table so customers see the status change
    if (broadcastToTable && order.tableId && completeOrder) {
      broadcastToTable(order.tableId, {
        type: 'order_status_updated',
        orderId: completeOrder.id,
        orderNumber: completeOrder.orderNumber,
        status: completeOrder.status,
        message: `Order ${completeOrder.orderNumber} is now ${completeOrder.status}`,
      });
    }
    
    res.json(completeOrder);
  } catch (error) {
    logger.error(`Error updating order status: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router; 
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import logger, { sanitizeError } from "./logger";
import { 
  rateLimits, 
  suspiciousActivityDetector,
  createProgressiveIPRateLimit 
} from "./security";
import { startOrderCleanupWorker, stopOrderCleanupWorker } from "./workers/order-cleanup";
import { supabaseBroadcaster } from "./services/order-lifecycle";

// Import all route modules
import {
  healthRoutes,
  dashboardRoutes,
  restaurantRoutes,
  categoryRoutes,
  menuItemRoutes,
  ingredientRoutes,
  tableRoutes,
  orderRoutes,
  customerRoutes,
  translationRoutes,
  translationAdapterRoutes,
  oauthRoutes,
  customerOnlyRoutes,
  analyticsRoutes,
  paymentsRoutes
} from "./routes/index";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply progressive IP-based rate limiting globally
  app.use(createProgressiveIPRateLimit());
  
  // Apply security middleware globally
  app.use(suspiciousActivityDetector);
  
  // Note: CSRF protection removed - using JWT Bearer tokens which are not vulnerable to CSRF
  
  // Apply specific rate limits to different endpoint types
  app.use('/api/orders', rateLimits.orders);
  app.use('/api/tables/qrcodes/all', rateLimits.heavy);
  app.use('/api/menu', rateLimits.customer);
  app.use('/api/customer/menu', rateLimits.customer);
  app.use('/api/customer/menu-data', rateLimits.customer);
  app.use('/api/restaurants/:restaurantId/translations', rateLimits.customer);
  
  // Set up authentication routes
  setupAuth(app);

  const httpServer = createServer(app);

  // Make Supabase broadcaster available globally for use in routes
  // This replaces the old WebSocket broadcastToRestaurant/broadcastToTable functions
  (global as any).supabaseBroadcaster = supabaseBroadcaster;
  
  // Start the order cleanup worker (uses protocol system for per-restaurant cleanup rules)
  startOrderCleanupWorker();


  // Add error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`${err.name}: ${err.message}`);
    if (err.stack) {
      logger.debug(err.stack);
    }
    
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
      message: sanitizeError(err)
    });
  });

  // Apply customer protection middleware to all API routes
  app.use('/api', customerOnlyRoutes);

  // Register all route modules
  app.use(healthRoutes);
  app.use(dashboardRoutes);
  app.use(restaurantRoutes);
  app.use(categoryRoutes);
  app.use(menuItemRoutes);
  app.use(ingredientRoutes);
  app.use(tableRoutes);
  app.use(orderRoutes);
  app.use(customerRoutes);
  app.use(translationRoutes);
  app.use(translationAdapterRoutes);
  app.use(oauthRoutes);
  app.use(analyticsRoutes);
  app.use(paymentsRoutes);
  
  // Graceful shutdown cleanup
  const cleanup = async () => {
    stopOrderCleanupWorker();
    await supabaseBroadcaster.cleanup();
  };
  
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  return httpServer;
}

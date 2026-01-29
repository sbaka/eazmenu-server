import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import logger, { sanitizeError } from "./logger";
import { config } from 'dotenv';
import { tableSessionMiddleware } from "./middleware/session";

// Load environment variables
config();

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Compression middleware for better performance
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://0.0.0.0:3000',
    'http://0.0.0.0:3001',
    'http://0.0.0.0:3002',
    'https://admin.eazmenu.com',
    'https://customer.eazmenu.com',
    'https://api.eazmenu.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Type'],
}));

// Rate limiting is now handled in routes.ts with more sophisticated per-session limits

// Cookie parser for session management
app.use(cookieParser());

// Table session middleware for customer order tracking
app.use(tableSessionMiddleware);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log only metadata - no response body to prevent PII/auth data leakage
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      logger.http(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database structure before starting server
  try {
    const { runDrizzleMigrations } = await import('./db/drizzle-migrate');
    await runDrizzleMigrations();
    logger.info('Database migrations completed successfully');
  } catch (error: any) {
    logger.error(`Failed to run database migrations: ${sanitizeError(error)}`);
    process.exit(1);
  }

  const server = await registerRoutes(app);

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

  // Serve static files for production
  if (process.env.NODE_ENV === 'production') {
    // Serve static assets
    app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
    app.use('/customer', express.static(path.join(__dirname, '../public/customer')));
    
    // Handle subdomain routing for SPAs
    app.get('*', (req, res) => {
      const subdomain = req.hostname.split('.')[0];
      
      // Skip API routes
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return res.status(404).json({ message: 'Not found' });
      }
      
      if (subdomain === 'admin') {
        res.sendFile(path.join(__dirname, '../public/admin/index.html'));
      } else if (subdomain === 'customer') {
        res.sendFile(path.join(__dirname, '../public/customer/index.html'));
      } else {
        // Default to customer app for main domain
        res.sendFile(path.join(__dirname, '../public/customer/index.html'));
      }
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? err.statusCode ?? 500;
    
    // Sanitize error messages in staging AND production
    const isProductionLike = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
    const message = isProductionLike
      ? (status < 500 ? err.message : "Internal Server Error")
      : err.message ?? "Internal Server Error";

    res.status(status).json({ message });
    
    // Log using Winston with appropriate levels
    if (status >= 500) {
      logger.error(`${err.name || 'Error'} ${status}: ${err.message}`);
      if (err.stack && process.env.NODE_ENV === "development") {
        logger.debug(err.stack);
      }
    } else {
      logger.warn(`${err.name || 'Error'} ${status}: ${err.message}`);
    }
  });

  // The server now only serves API endpoints
  // Frontend apps (admin/customer) run on their own Vite dev servers

  // Use PORT from environment variables with fallback
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
  // Bind to 0.0.0.0 by default so the app is reachable in containerized environments
  const host = process.env.HOST || "0.0.0.0";

  server.listen(port, host, () => {
    logger.info(`Server running on port ${port}`);
    if (app.get("env") === "development") {
      // In development we know we're on localhost, so this log line helps with testing
      logger.info(`WebSocket server available at ws://localhost:${port}/ws`);
    }
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        logger.error(`Error during server shutdown: ${sanitizeError(err)}`);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.warn('Forcefully shutting down after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();

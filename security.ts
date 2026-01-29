import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import logger from "./logger";

// In-memory store for session-based rate limiting
// In production, consider using Redis or database-backed storage
interface SessionRateTracker {
  requests: number;
  lastReset: number;
  blocked: boolean;
  blockUntil?: number;
}

// Maximum entries to prevent memory exhaustion (DoS protection)
const MAX_RATE_LIMIT_ENTRIES = 10000;

const sessionRateStore = new Map<string, SessionRateTracker>();
const ipRateStore = new Map<string, SessionRateTracker>();

// LRU-style eviction: remove oldest entries when at capacity
function evictOldestEntries(store: Map<string, SessionRateTracker>, maxEntries: number) {
  if (store.size <= maxEntries) return;
  
  // Convert to array, sort by lastReset (oldest first), and remove excess
  const entries = Array.from(store.entries())
    .sort((a, b) => a[1].lastReset - b[1].lastReset);
  
  const toRemove = store.size - maxEntries;
  for (let i = 0; i < toRemove; i++) {
    store.delete(entries[i][0]);
  }
  
  logger.warn(`Rate limit store evicted ${toRemove} old entries (cap: ${maxEntries})`);
}

// Cleanup function to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  // Clean up session store
  sessionRateStore.forEach((tracker, key) => {
    if (now - tracker.lastReset > oneHour) {
      sessionRateStore.delete(key);
    }
  });
  
  // Clean up IP store
  ipRateStore.forEach((tracker, key) => {
    if (now - tracker.lastReset > oneHour) {
      ipRateStore.delete(key);
    }
  });
}, 10 * 60 * 1000); // Clean up every 10 minutes

// Session-based rate limiting middleware
export function createSessionRateLimit(options: {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  blockDuration?: number;
}) {
  if (isDevelopment) {
    return noOpMiddleware;
  }
  
  const { windowMs, maxRequests, skipSuccessfulRequests = false, blockDuration = windowMs } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.sessionID;
    const userId = req.user?.id?.toString();
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Use session ID if available, fallback to user ID, then IP
    const identifier = sessionId || userId || clientIP;
    
    if (!identifier) {
      return next();
    }

    const now = Date.now();
    let tracker = sessionRateStore.get(identifier);

    if (!tracker) {
      // Evict oldest entries if at capacity before adding new one
      evictOldestEntries(sessionRateStore, MAX_RATE_LIMIT_ENTRIES);
      
      tracker = {
        requests: 0,
        lastReset: now,
        blocked: false
      };
      sessionRateStore.set(identifier, tracker);
    }

    // Reset window if expired
    if (now - tracker.lastReset > windowMs) {
      tracker.requests = 0;
      tracker.lastReset = now;
      tracker.blocked = false;
      delete tracker.blockUntil;
    }

    // Check if currently blocked
    if (tracker.blocked && tracker.blockUntil && now < tracker.blockUntil) {
      const remainingMs = tracker.blockUntil - now;
      logger.warn(`Rate limit exceeded for session ${identifier.substring(0, 8)}...`);
      
      return res.status(429).json({
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(remainingMs / 1000)
      });
    }

    // Clear block if expired
    if (tracker.blocked && tracker.blockUntil && now >= tracker.blockUntil) {
      tracker.blocked = false;
      delete tracker.blockUntil;
      tracker.requests = 0;
      tracker.lastReset = now;
    }

    // Increment request count
    tracker.requests++;

    // Check if limit exceeded
    if (tracker.requests > maxRequests) {
      tracker.blocked = true;
      tracker.blockUntil = now + blockDuration;
      
      logger.warn(`Session ${identifier.substring(0, 8)}... blocked for ${blockDuration}ms after ${tracker.requests} requests`);
      
      return res.status(429).json({
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(blockDuration / 1000)
      });
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - tracker.requests).toString(),
      'X-RateLimit-Reset': new Date(tracker.lastReset + windowMs).toISOString()
    });

    // Handle response completion for skipSuccessfulRequests
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        if (res.statusCode >= 400) {
          // Only count failed requests
          tracker.requests++;
        } else {
          // Decrement for successful requests
          tracker.requests = Math.max(0, tracker.requests - 1);
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// IP-based progressive rate limiting
export function createProgressiveIPRateLimit() {
  if (isDevelopment) {
    return noOpMiddleware;
  }
  
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: Request) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      let tracker = ipRateStore.get(clientIP);
      
      if (!tracker) {
        // Evict oldest entries if at capacity before adding new one
        evictOldestEntries(ipRateStore, MAX_RATE_LIMIT_ENTRIES);
        
        tracker = { requests: 0, lastReset: Date.now(), blocked: false };
        ipRateStore.set(clientIP, tracker);
        return 1000; // First-time IP gets higher limit
      }
      
      // Progressive reduction for repeat offenders
      const hoursSinceFirst = (Date.now() - tracker.lastReset) / (1000 * 60 * 60);
      if (hoursSinceFirst > 24) {
        return 1000; // Reset after 24 hours
      }
      
      // Reduce limit based on frequency of hits
      if (tracker.requests > 5000) return 100;
      if (tracker.requests > 2000) return 300;
      if (tracker.requests > 1000) return 500;
      return 1000;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again later' }
  });
}

// Skip rate limiting in development environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Log rate limiting status on startup
if (isDevelopment) {
  logger.warn('⚠️  Rate limiting is DISABLED in development environment');
} else {
  logger.info('✅ Rate limiting is ENABLED for production/staging environment');
}

// No-op middleware for development
const noOpMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

// API-specific rate limits for different endpoints
export const rateLimits = {
  // Authentication endpoints - strict limits
  auth: isDevelopment ? noOpMiddleware : rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Very strict for auth
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts, please try again later' },
    skipSuccessfulRequests: true // Only count failed attempts
  }),

  // API calls - moderate limits per session
  api: isDevelopment ? noOpMiddleware : createSessionRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200, // Per session
    skipSuccessfulRequests: false
  }),

  // File uploads/heavy operations - stricter limits
  heavy: isDevelopment ? noOpMiddleware : createSessionRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // Very limited for heavy ops
    blockDuration: 15 * 60 * 1000 // 15 minute block
  }),

  // Customer-facing endpoints - more lenient
  customer: isDevelopment ? noOpMiddleware : rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Per IP for customer endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' }
  }),

  // Order creation - balanced security and usability
  orders: isDevelopment ? noOpMiddleware : createSessionRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20, // Reasonable limit for placing orders
    skipSuccessfulRequests: true // Only count failed order attempts
  })
};

// Middleware to detect and block suspicious patterns
export function suspiciousActivityDetector(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  
  // Skip security scanning for static file paths (they're legitimate and may contain keywords)
  const isStaticFile = path.match(/\.(js|css|tsx|ts|jsx|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i) ||
                       path.startsWith('/src/') ||
                       path.startsWith('/node_modules/') ||
                       path.startsWith('/assets/');
  
  if (!isStaticFile) {
    // Detect suspicious patterns in non-static requests
    const suspiciousPatterns = [
      /\b(union|select|insert|delete|drop|exec|script)\b/i, // SQL injection attempts
      /\.\.\//g, // Path traversal
      /<script/i, // XSS attempts
      /eval\(/i, // Code injection
    ];
    
    const requestString = `${path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        logger.error(`Suspicious activity detected from IP ${clientIP}: ${pattern} in ${path}`);
        return res.status(400).json({ message: 'Invalid request' });
      }
    }
  }
  
  // Detect bot-like behavior
  if (!userAgent || userAgent.length < 10) {
    logger.warn(`Suspicious user agent from IP ${clientIP}: ${userAgent}`);
  }
  
  next();
}

// Input sanitization middleware
// REMOVED: This middleware was overly aggressive and corrupted legitimate data
// (e.g., stripping quotes from menu descriptions, breaking camelCase keys)
// Input validation is now handled by:
// 1. Zod schemas for each route (type-safe validation)
// 2. Drizzle ORM parameterized queries (SQL injection prevention)
// 3. React's built-in XSS protection for output encoding

// CSRF Protection using Double-Submit Cookie Pattern
// Combined with sameSite: 'strict' cookies for defense in depth
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Generate CSRF token for authenticated sessions
export function generateCsrfToken(_req: Request, res: Response): string {
  // Generate a new token
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  
  // Set as httpOnly cookie (prevents XSS from reading it)
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    path: '/',
  });
  
  return token;
}

// CSRF validation middleware for state-changing requests
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF for public customer endpoints (they use table session, not auth session)
  const publicPaths = [
    '/api/orders', // Customer order placement
    '/api/customer/', // Customer menu endpoints
  ];
  
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Skip if not authenticated (no session to protect)
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }
  
  // Get token from cookie and header
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;
  
  // Validate both tokens exist and match
  if (!cookieToken || !headerToken) {
    logger.warn(`CSRF token missing - cookie: ${!!cookieToken}, header: ${!!headerToken}, path: ${req.path}`);
    return res.status(403).json({ message: 'CSRF token missing' });
  }
  
  if (cookieToken !== headerToken) {
    logger.warn(`CSRF token mismatch for path: ${req.path}`);
    return res.status(403).json({ message: 'CSRF token invalid' });
  }
  
  next();
}
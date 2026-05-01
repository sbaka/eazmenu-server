import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Session cookie name for table-based ordering
const SESSION_COOKIE_NAME = 'tableSessionId';
const SESSION_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DEFAULT_VERIFIED_SESSION_TTL_MINUTES = 120;

interface VerifiedTableSession {
  restaurantId: number;
  tableId: number;
  verifiedAt: number;
  expiresAt: number;
}

const verifiedTableSessions = new Map<string, VerifiedTableSession>();

function getVerifiedSessionTtlMs(): number {
  const configured = Number(process.env.TABLE_ORDER_SESSION_TTL_MINUTES);
  const ttlMinutes = Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_VERIFIED_SESSION_TTL_MINUTES;

  return ttlMinutes * 60 * 1000;
}

function pruneExpiredVerifiedSessions(): void {
  const now = Date.now();
  verifiedTableSessions.forEach((session, sessionId) => {
    if (session.expiresAt <= now) {
      verifiedTableSessions.delete(sessionId);
    }
  });
}

setInterval(pruneExpiredVerifiedSessions, 10 * 60 * 1000);

/**
 * Middleware that ensures every customer request has a unique session ID.
 * This session ID is stored as an httpOnly cookie and linked to orders
 * to control visibility (same session sees full order history, new sessions
 * only see active orders).
 */
export function tableSessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  
  if (!sessionId) {
    // Generate new UUID session ID
    sessionId = uuidv4();
    
    // Set secure httpOnly cookie
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  
  // Attach sessionId to request for use in route handlers
  (req as any).tableSessionId = sessionId;
  
  next();
}

/**
 * Helper to extract tableSessionId from request
 */
export function getTableSessionId(req: Request): string | undefined {
  return (req as any).tableSessionId ?? req.cookies?.[SESSION_COOKIE_NAME];
}

export function refreshVerifiedTableSession(req: Request, restaurantId: number, tableId: number): VerifiedTableSession | null {
  const sessionId = getTableSessionId(req);
  if (!sessionId) {
    return null;
  }

  const now = Date.now();
  const verifiedSession = {
    restaurantId,
    tableId,
    verifiedAt: now,
    expiresAt: now + getVerifiedSessionTtlMs(),
  };

  verifiedTableSessions.set(sessionId, verifiedSession);
  return verifiedSession;
}

export function getVerifiedTableSession(req: Request): VerifiedTableSession | null {
  const sessionId = getTableSessionId(req);
  if (!sessionId) {
    return null;
  }

  const session = verifiedTableSessions.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    verifiedTableSessions.delete(sessionId);
    return null;
  }

  return session;
}

export function hasValidVerifiedTableSession(req: Request, restaurantId: number, tableId: number): boolean {
  const session = getVerifiedTableSession(req);
  return !!session && session.restaurantId === restaurantId && session.tableId === tableId;
}

/**
 * Helper to clear table session (e.g., when table is reset)
 */
export function clearTableSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

import { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { storage } from "./storage";
import { Merchant as SelectUser } from "@sbaka/shared";
import logger, { sanitizeError } from "./logger";

// Type for Supabase user - define our own interface since the package types are inconsistent
interface SupabaseUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities?: Array<{
    id: string;
    user_id: string;
    identity_data?: Record<string, unknown>;
    provider: string;
    created_at?: string;
    last_sign_in_at?: string;
  }>;
  created_at: string;
  updated_at?: string;
}

type UserIdentity = NonNullable<SupabaseUser['identities']>[number];

// Extend Express types for user
declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      supabaseUser?: SupabaseUser;
    }
  }
}

// Initialize Supabase admin client for server-side token verification
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

function isPublishableKey(key: string): boolean {
  return key.startsWith("sb_publishable_");
}

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  logger.info("Supabase client initialized for authentication", {
    keyType: isPublishableKey(supabaseKey) ? "publishable" : "service_or_secret",
  });
} else {
  logger.warn("Supabase environment variables not configured. Authentication will be disabled.");
}

if (supabaseUrl && supabaseServiceRoleKey) {
  if (isPublishableKey(supabaseServiceRoleKey)) {
    logger.error("SUPABASE_SERVICE_ROLE_KEY is misconfigured (publishable key). Admin auth operations are disabled.");
  } else {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    logger.info("Supabase admin client initialized");
  }
} else {
  logger.warn("SUPABASE_SERVICE_ROLE_KEY not configured. Admin auth operations are disabled.");
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  return supabaseAdmin;
}

/**
 * Profile data extracted from Supabase user metadata
 */
interface NormalizedProfile {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: string;
  username: string;
}

/**
 * Gets the primary authentication provider for the user.
 * Returns the OAuth provider if available, otherwise 'email'.
 */
function getPrimaryProvider(supabaseUser: SupabaseUser): string {
  // Check app_metadata first (most reliable source)
  const appProvider = supabaseUser.app_metadata?.provider as string | undefined;
  if (appProvider && appProvider !== 'email') {
    return appProvider;
  }

  // Check identities for OAuth providers
  const oauthProviders = ['google', 'azure', 'apple', 'github', 'facebook'];
  const oauthIdentity = supabaseUser.identities?.find(
    (identity: UserIdentity) => oauthProviders.includes(identity.provider)
  );

  return oauthIdentity?.provider ?? appProvider ?? 'email';
}

/**
 * Gets identity data from the primary identity provider.
 * Prioritizes OAuth providers over email provider since OAuth data is richer.
 */
function getIdentityData(supabaseUser: SupabaseUser): Record<string, unknown> {
  if (!supabaseUser.identities || supabaseUser.identities.length === 0) {
    return {};
  }

  const oauthProviders = ['google', 'azure', 'apple', 'github', 'facebook'];
  const oauthIdentity = supabaseUser.identities.find(
    (identity: UserIdentity) => oauthProviders.includes(identity.provider)
  );

  const primaryIdentity = oauthIdentity ?? supabaseUser.identities[0];
  return (primaryIdentity?.identity_data as Record<string, unknown>) ?? {};
}

/**
 * Normalizes Supabase user data into a consistent profile structure.
 * Handles differences between email-based users and OAuth users.
 */
function normalizeSupabaseProfile(supabaseUser: SupabaseUser): NormalizedProfile {
  const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
  const identityData = getIdentityData(supabaseUser);
  const provider = getPrimaryProvider(supabaseUser);

  // Email: prefer user.email (confirmed) over metadata
  const email = supabaseUser.email ?? null;

  // Full name / Display name: user_metadata is authoritative, then identity_data
  const displayName = (metadata.full_name as string | undefined)
    ?? (metadata.name as string | undefined)
    ?? (identityData.full_name as string | undefined)
    ?? (identityData.name as string | undefined)
    ?? null;

  // Avatar: user_metadata is authoritative, supports both avatar_url and picture
  const avatarUrl = (metadata.avatar_url as string | undefined)
    ?? (metadata.picture as string | undefined)
    ?? (identityData.avatar_url as string | undefined)
    ?? (identityData.picture as string | undefined)
    ?? null;

  // Username: explicit username > derived from email
  const explicitUsername = (metadata.username as string | undefined)
    ?? (metadata.user_name as string | undefined)
    ?? (identityData.username as string | undefined)
    ?? (identityData.user_name as string | undefined);
  
  const username = explicitUsername 
    ?? email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') 
    ?? 'user';

  return {
    email,
    displayName,
    avatarUrl,
    provider,
    username,
  };
}

/**
 * Checks if profile data has changed and needs to be synced
 */
function hasProfileChanged(
  merchant: SelectUser,
  profile: NormalizedProfile
): boolean {
  return (
    merchant.email !== profile.email ||
    merchant.displayName !== profile.displayName ||
    merchant.avatarUrl !== profile.avatarUrl ||
    merchant.provider !== profile.provider
  );
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Supabase Authentication middleware
 * Validates Supabase JWT and attaches user to request
 * Also syncs profile data from Supabase on each authentication
 */
export const authenticateSupabase: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      logger.error("Supabase is not configured");
      return res.status(500).json({ message: "Authentication service not configured" });
    }

    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    // Verify the JWT with Supabase
    const { data: { user: supabaseUser }, error } = await (supabase.auth as any).getUser(token);

    if (error || !supabaseUser) {
      logger.warn("Invalid or expired token", { error: error?.message });
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Store Supabase user for reference
    req.supabaseUser = supabaseUser;

    // Normalize profile data from Supabase
    const profile = normalizeSupabaseProfile(supabaseUser);

    // Find or create merchant based on Supabase user
    let merchant = await storage.getMerchantBySupabaseUserId(supabaseUser.id);

    if (!merchant) {
      // Create new merchant for this Supabase user
      merchant = await createMerchantFromSupabaseUser(supabaseUser, profile);
    } else if (hasProfileChanged(merchant, profile)) {
      // Sync profile data if it has changed
      logger.info(`Syncing profile for merchant ${merchant.id}`, { 
        oldEmail: merchant.email, 
        newEmail: profile.email,
        oldDisplayName: merchant.displayName,
        newDisplayName: profile.displayName 
      });
      merchant = await storage.updateMerchantProfile(merchant.id, {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        provider: profile.provider,
      });
    }

    if (!merchant) {
      logger.warn("Could not find or create merchant for Supabase user", { supabaseUserId: supabaseUser.id });
      return res.status(401).json({ message: "User account not found" });
    }

    // Attach merchant to request (same as old req.user)
    req.user = merchant;
    next();
  } catch (error) {
    logger.error(`Authentication error: ${sanitizeError(error)}`);
    return res.status(500).json({ message: "Authentication error" });
  }
};

/**
 * Optional Supabase authentication - doesn't fail if no token, just doesn't set user
 * Also syncs profile data if merchant exists
 */
export const optionalAuthenticateSupabase: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req);
    if (!token || !supabase) {
      return next();
    }

    const { data: { user: supabaseUser }, error } = await (supabase.auth as any).getUser(token);

    if (!error && supabaseUser) {
      req.supabaseUser = supabaseUser;
      
      let merchant = await storage.getMerchantBySupabaseUserId(supabaseUser.id);
      
      if (merchant) {
        // Sync profile if changed
        const profile = normalizeSupabaseProfile(supabaseUser);
        if (hasProfileChanged(merchant, profile)) {
          merchant = await storage.updateMerchantProfile(merchant.id, {
            email: profile.email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            provider: profile.provider,
          });
        }
        req.user = merchant ?? undefined;
      }
    }
    
    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

/**
 * Create a new merchant from Supabase user data with normalized profile
 */
async function createMerchantFromSupabaseUser(
  supabaseUser: SupabaseUser, 
  profile: NormalizedProfile
): Promise<SelectUser | undefined> {
  const email = supabaseUser.email;
  if (!email) {
    logger.warn("Supabase user has no email", { supabaseUserId: supabaseUser.id });
    return undefined;
  }

  // Generate unique username
  const baseUsername = profile.username;
  let username = baseUsername;
  let counter = 1;

  // Ensure unique username
  while (await storage.getMerchantByUsername(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  logger.info(`Creating new merchant for Supabase user ${supabaseUser.id}`, {
    username,
    displayName: profile.displayName,
    provider: profile.provider,
  });

  const merchant = await storage.createMerchant({
    username,
    supabaseUserId: supabaseUser.id,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    provider: profile.provider,
  });

  // Create default restaurant for the merchant
  const restaurantName = profile.displayName ?? username;
  const defaultRestaurant = await storage.createRestaurant({
    name: `${restaurantName}'s Restaurant`,
    address: "Default Address - Please Update",
    phone: null,
    email: profile.email,
    merchantId: merchant.id,
  });

  // Create default English language for the restaurant
  await storage.createLanguage({
    code: "en",
    name: "English",
    active: true,
    isPrimary: true,
    restaurantId: defaultRestaurant.id,
  });

  logger.info(`Created new merchant ${merchant.id} with restaurant ${defaultRestaurant.id}`);

  return merchant;
}

/**
 * Verify Supabase token and return user info (used by WebSocket)
 */
export async function verifySupabaseToken(token: string): Promise<SelectUser | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data: { user: supabaseUser }, error } = await (supabase.auth as any).getUser(token);

    if (error || !supabaseUser) {
      return null;
    }

    const merchant = await storage.getMerchantBySupabaseUserId(supabaseUser.id);

    return merchant ?? null;
  } catch {
    return null;
  }
}

export function setupAuth(app: Express) {
  // Trust proxy for production deployments
  app.set("trust proxy", 1);

  // GET /api/user - Get current authenticated user
  app.get("/api/user", authenticateSupabase, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // POST /api/logout - Clear any client-side state (Supabase handles actual logout)
  app.post("/api/logout", (_req: Request, res: Response) => {
    // With Supabase auth, logout is handled client-side by clearing the token
    // This endpoint exists for API consistency
    res.status(200).json({ message: "Logged out successfully" });
  });

  logger.info("Supabase authentication configured");
}

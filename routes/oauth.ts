import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../auth';
import logger from '../logger';
import { optionalAuthenticateSupabase } from '../auth';

const router = Router();

/**
 * GET /api/auth/oauth/status
 * Returns whether OAuth is configured and the current user's OAuth status
 * This endpoint works with optional auth - returns basic info if not authenticated
 */
router.get('/api/auth/oauth/status', optionalAuthenticateSupabase, async (req: Request, res: Response) => {
  const supabase = getSupabaseClient();
  const isConfigured = supabase !== null;
  
  logger.debug('OAuth status request', { 
    hasUser: !!req.user, 
    hasSupabaseUser: !!req.supabaseUser,
    userId: req.user?.id
  });
  
  // If user is authenticated (has valid JWT), return their status
  if (req.user) {
    const merchant = req.user;
    const supabaseUser = req.supabaseUser;
    
    // Get the linked provider from Supabase identities
    const linkedProviders: string[] = [];
    
    if (supabaseUser) {
      // Log raw identities for debugging
      logger.debug('Supabase user identities', {
        identities: supabaseUser.identities,
        appMetadata: supabaseUser.app_metadata,
        userMetadata: supabaseUser.user_metadata,
        email: supabaseUser.email,
        emailConfirmed: supabaseUser.email_confirmed_at,
      });
      
      // Try to get identities from the supabaseUser object first
      if (supabaseUser.identities && supabaseUser.identities.length > 0) {
        for (const identity of supabaseUser.identities) {
          logger.debug('Processing identity', { provider: identity.provider, id: identity.id });
          // Map Supabase provider names to our provider names
          if (identity.provider === 'google') {
            linkedProviders.push('google');
          } else if (identity.provider === 'azure') {
            linkedProviders.push('azure');
          } else if (identity.provider === 'email') {
            linkedProviders.push('email');
          }
        }
      }
      
      // If no identities found but user has confirmed email, check app_metadata for provider
      // Email/password users typically have app_metadata.provider = 'email'
      if (linkedProviders.length === 0) {
        const provider = supabaseUser.app_metadata?.provider;
        logger.debug('Falling back to app_metadata provider', { provider });
        if (provider === 'email') {
          linkedProviders.push('email');
        } else if (provider === 'google') {
          linkedProviders.push('google');
        } else if (provider === 'azure') {
          linkedProviders.push('azure');
        }
      }
      
      // Final fallback: if user has email_confirmed_at and no OAuth providers, assume email auth
      if (!linkedProviders.includes('email') && 
          !linkedProviders.includes('google') && 
          !linkedProviders.includes('azure') &&
          supabaseUser.email && 
          supabaseUser.email_confirmed_at) {
        logger.debug('Fallback: assuming email auth based on confirmed email');
        linkedProviders.push('email');
      }
    }
    
    logger.debug('OAuth status for user', { 
      userId: merchant.id, 
      supabaseUserId: merchant.supabaseUserId,
      linkedProviders,
      identitiesCount: linkedProviders.length,
      appMetadataProvider: supabaseUser?.app_metadata?.provider
    });
    
    return res.json({
      configured: isConfigured,
      linked: !!merchant.supabaseUserId,
      linkedProviders, // Array of actually linked providers
      hasPassword: linkedProviders.includes('email'),
      providers: isConfigured ? ['google', 'azure'] : []
    });
  }
  
  // Not authenticated - return basic config status
  return res.json({ 
    configured: isConfigured,
    linked: false,
    linkedProviders: [],
    hasPassword: false,
    providers: isConfigured ? ['google', 'azure'] : []
  });
});

export default router;

import { getCurrentUser } from '@/server/auth/session';
import { logger } from '@/server/logger';
import type { NextRequest } from 'next/server';
import { apiError } from '../http/envelope';
import { checkForBot } from './bot-detection';
import { checkRateLimit, type RateLimitTier } from './rate-limit';

/**
 * Ch.11 §16: Security Headers → Rate Limiter → Bot Detection →
 * Authentication → Authorization → Validation → Handler. Security Headers
 * apply globally (next.config.ts `headers()`, not per-request here).
 * Validation is the route-handler's job (route-handler.ts). This covers
 * rate-limit/bot/auth/authz — called first in every /api/v1 route; a
 * non-null return means "stop, respond with this", null means "proceed".
 */
export async function runSecurityChain(
  request: NextRequest,
  options: { tier: RateLimitTier; requireAuth?: boolean; requireAdmin?: boolean },
) {
  const correlationId = crypto.randomUUID();
  const route = new URL(request.url).pathname;

  const botCheck = checkForBot(request);
  if (botCheck.isBot) {
    logger.warn('security.bot_blocked', { route, correlationId, reason: botCheck.reason });
    return apiError('AUTHORIZATION_ERROR', 'Request blocked.', 403, correlationId);
  }

  const identifier =
    request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
  const rateLimit = await checkRateLimit(options.tier, identifier);
  if (!rateLimit.success) {
    logger.warn('security.rate_limited', { route, correlationId, tier: options.tier });
    return apiError('AUTHORIZATION_ERROR', 'Too many requests.', 429, correlationId);
  }

  if (options.requireAuth || options.requireAdmin) {
    const user = await getCurrentUser();
    if (!user) {
      return apiError('AUTHENTICATION_ERROR', 'Sign-in required.', 401, correlationId);
    }
    if (
      options.requireAdmin &&
      !user.roles.some((role) => role === 'administrator' || role === 'owner')
    ) {
      return apiError('AUTHORIZATION_ERROR', 'Administrator access required.', 403, correlationId);
    }
  }

  return null;
}

import type { NextRequest } from 'next/server';

/**
 * Ch.14/15: "Cloudflare Bot Fight Mode" is the primary control and runs at
 * the edge, before a request ever reaches this application (configured in
 * Phase 13, not here). This is a secondary, app-layer check: honor
 * Cloudflare's own verdict when the header is present (it always will be
 * in production, once Cloudflare is in front of Vercel), and fall back to
 * a minimal user-agent heuristic when it isn't (local dev, previews).
 */

const SUSPICIOUS_USER_AGENT_PATTERNS = [/^$/, /curl\//i, /python-requests/i, /^-$/];

export interface BotCheckResult {
  isBot: boolean;
  reason?: string;
}

export function checkForBot(request: NextRequest): BotCheckResult {
  const cfBotScore = request.headers.get('cf-bot-score');
  if (cfBotScore !== null) {
    const score = Number(cfBotScore);
    // Cloudflare: lower score = more likely automated. Threshold matches
    // Cloudflare's own documented "likely bot" range.
    if (!Number.isNaN(score) && score < 30) {
      return { isBot: true, reason: 'cloudflare_bot_score' };
    }
    return { isBot: false };
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  if (SUSPICIOUS_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    return { isBot: true, reason: 'suspicious_user_agent' };
  }

  return { isBot: false };
}

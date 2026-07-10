import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { checkForBot } from './bot-detection';

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest(new Request('http://localhost/api/v1/products', { headers }));
}

describe('checkForBot', () => {
  it('trusts a Cloudflare bot score below the threshold as a bot', () => {
    const result = checkForBot(requestWithHeaders({ 'cf-bot-score': '5' }));
    expect(result).toEqual({ isBot: true, reason: 'cloudflare_bot_score' });
  });

  it('trusts a Cloudflare bot score above the threshold as human', () => {
    const result = checkForBot(requestWithHeaders({ 'cf-bot-score': '80' }));
    expect(result.isBot).toBe(false);
  });

  it('does not fall through to the user-agent heuristic when Cloudflare header is present', () => {
    // Suspicious UA, but Cloudflare already vouched for it — CF's verdict wins.
    const result = checkForBot(
      requestWithHeaders({ 'cf-bot-score': '90', 'user-agent': 'curl/8.0' }),
    );
    expect(result.isBot).toBe(false);
  });

  it('falls back to a user-agent heuristic when no Cloudflare header is present', () => {
    const result = checkForBot(requestWithHeaders({ 'user-agent': 'curl/8.0' }));
    expect(result).toEqual({ isBot: true, reason: 'suspicious_user_agent' });
  });

  it('treats a normal browser user-agent as human with no Cloudflare header', () => {
    const result = checkForBot(
      requestWithHeaders({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }),
    );
    expect(result.isBot).toBe(false);
  });

  it('treats a missing user-agent as suspicious', () => {
    const result = checkForBot(new NextRequest(new Request('http://localhost/api/v1/products')));
    expect(result.isBot).toBe(true);
  });
});

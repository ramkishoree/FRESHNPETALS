import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Ch.14/15: HSTS, Referrer-Policy, Permissions-Policy,
 * X-Content-Type-Options, X-Frame-Options, COOP, CORP — applied globally
 * here (Ch.11 §16's "Security Headers" step of the chain). Content-Security-Policy
 * is NOT set here: it needs a fresh nonce per request (so `script-src` can
 * avoid 'unsafe-inline' without blocking Next's own hydration/RSC bootstrap
 * scripts), which a static next.config header can't generate — see
 * `proxy.ts`, which sets it per-request instead.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

// next/image's optimizer 400s on any remote host not explicitly
// allowlisted. Derived from the env var (not hardcoded to one project ref)
// so this keeps working if the Supabase project ever changes.
const supabaseHostname = process.env['NEXT_PUBLIC_SUPABASE_URL']
  ? new URL(process.env['NEXT_PUBLIC_SUPABASE_URL']).hostname
  : undefined;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
  // packages/* ship TypeScript source directly (no build step, see Phase 1
  // package.json "main"/"exports") — Next.js only runs its TS/JSX
  // transform on the app itself plus whatever's listed here.
  transpilePackages: [
    '@prana/core',
    '@prana/commerce',
    '@prana/identity',
    '@prana/operations',
    '@prana/ai',
  ],
  // ffmpeg-static's binary is resolved at runtime via a dynamic path
  // (fluent-ffmpeg calls setFfmpegPath with it), so Next's automatic
  // dependency tracer can't reliably detect it belongs in the deployed
  // function bundle — without this it works locally and 500s on Vercel
  // with "ffmpeg binary not available", the exact class of bug that's
  // hit this project before (turbo.json env stripping).
  outputFileTracingIncludes: {
    '/api/v1/admin/products/[id]/media': ['./node_modules/ffmpeg-static/**'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

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
  // Vercel's deployed function boundary defaults to this app's own
  // directory. pnpm's hoisted linker (see pnpm-workspace.yaml) places a
  // package in the closest common ancestor node_modules — for
  // dependencies used by only this app (e.g. sharp's own @img/* native
  // binaries) that's apps/web/node_modules, but for a dependency shared
  // by multiple workspace packages (e.g. sharp's detect-libc, semver)
  // that's the monorepo root's node_modules, outside this app's own
  // directory. Without this, Next's tracer still records the correct
  // (real, non-symlinked) path to those files, but Vercel silently drops
  // anything the trace references outside the function's root — this
  // widens that root to the whole monorepo so nothing gets dropped.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // sharp is already in Next's own default list of packages left external
  // (not bundled) on the server for exactly this "native binary" class of
  // package — declared explicitly rather than relying on the implicit
  // default, since Turbopack's handling of that default wasn't reliably
  // observable while debugging this.
  serverExternalPackages: ['sharp'],
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
  transpilePackages: ['@prana/core', '@prana/commerce', '@prana/identity', '@prana/operations'],
  // ffmpeg-static's binary is resolved at runtime via a dynamic path
  // (fluent-ffmpeg calls setFfmpegPath with it), so Next's automatic
  // dependency tracer can't reliably detect it belongs in the deployed
  // function bundle — without this it works locally and 500s on Vercel
  // with "ffmpeg binary not available", the exact class of bug that's
  // hit this project before (turbo.json env stripping).
  //
  // sharp's native addon and its libvips shared library are the same
  // class of bug, but reaching them is harder: they live two symlink hops
  // deep in pnpm's virtual store, which Next's tracer doesn't reliably
  // follow and which Vercel's own deploy packager actively rejects if you
  // try to include them by reaching into `.pnpm` from outside this app's
  // directory ("invalid deployment package... files in symlinked
  // directories" — a real, confirmed failure mode, not a hypothetical
  // one). The actual fix lives in scripts/vendor-sharp-native.mjs (this
  // package's `prebuild` script): it copies the real files — dereferenced,
  // not symlinks — into this app's own node_modules/@img before every
  // build, so they can be included the exact same simple way as
  // ffmpeg-static above, no reaching outside the app directory required.
  outputFileTracingIncludes: {
    '/api/v1/admin/products/[id]/media': [
      './node_modules/ffmpeg-static/**',
      './node_modules/sharp/**',
      './node_modules/@img/**',
    ],
    // Duplicate of the key above with a `*` instead of `[id]` — belt and
    // suspenders against the bracket syntax being interpreted as a glob
    // character class rather than a literal route segment by whichever
    // matcher actually resolves these keys at build time.
    '/api/v1/admin/products/*/media': [
      './node_modules/ffmpeg-static/**',
      './node_modules/sharp/**',
      './node_modules/@img/**',
    ],
    '/api/v1/admin/media/upload': ['./node_modules/sharp/**', './node_modules/@img/**'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

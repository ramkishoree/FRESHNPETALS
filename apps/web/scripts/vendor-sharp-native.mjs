#!/usr/bin/env node
/**
 * Copies sharp's platform-native packages (the `.node` addon and its
 * `libvips-cpp.so` shared library) into this app's own node_modules,
 * dereferencing pnpm's symlinks into real files.
 *
 * Why this exists: sharp's native binaries live two symlink hops deep in
 * pnpm's virtual store (apps/web/node_modules/sharp -> .pnpm store ->
 * sharp's own node_modules/@img/sharp-linux-x64 -> .pnpm store again for
 * the libvips shared library). Next's file tracer only reliably follows
 * the first hop, and Vercel's own default trace excludes sharp assuming
 * its image optimizer supplies it — the combination means the shared
 * library never makes it into the deployed function bundle
 * (ERR_DLOPEN_FAILED at runtime). Manually including it via glob patterns
 * that reach into `.pnpm` from outside this app's directory works locally
 * but Vercel's deploy packager rejects the resulting build ("invalid
 * deployment package... files in symlinked directories") — real files at
 * a normal, non-symlinked path inside this app avoid that rejection
 * entirely, and outputFileTracingIncludes can reference them the exact
 * same way it already does for ffmpeg-static.
 *
 * Runs as this package's `prebuild` script (before every `next build`),
 * so it's always in sync with whatever sharp version is actually
 * installed rather than a version pinned into next.config.ts. These two
 * packages have no resolvable "main" export (they're native-binary
 * bundles addressed by path, not `require()`d as modules), so this finds
 * them by scanning pnpm's virtual store for the versioned directory name
 * rather than trying to `require.resolve()` them.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');
const monorepoRoot = join(appRoot, '..', '..');
const pnpmStoreDir = join(monorepoRoot, 'node_modules', '.pnpm');
const require = createRequire(import.meta.url);

const PACKAGES = ['@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64'];

if (!existsSync(pnpmStoreDir)) {
  console.log('[vendor-sharp-native] No pnpm store found (not a pnpm install) — skipping.');
  process.exit(0);
}

// sharp's own package.json pins the exact version of each platform
// package it needs (e.g. @img/sharp-libvips-linux-x64 can be a different
// version than @img/sharp-linux-x64) — the pnpm store often holds more
// than one version side by side (Next.js's own bundled sharp pulls in an
// older one for its image optimizer), so this has to match the pinned
// version exactly rather than grabbing whichever one happens to exist.
const sharpMainFile = require.resolve('sharp', { paths: [appRoot] });
const sharpMarker = `${join('node_modules', 'sharp')}${'/'}`;
const sharpMarkerIndex = sharpMainFile.lastIndexOf(sharpMarker);
if (sharpMarkerIndex === -1) {
  throw new Error(`Could not locate sharp's package root from resolved path: ${sharpMainFile}`);
}
const sharpDir = sharpMainFile.slice(0, sharpMarkerIndex + sharpMarker.length - 1);
const sharpPackageJson = JSON.parse(readFileSync(join(sharpDir, 'package.json'), 'utf8'));
const pinnedVersions = sharpPackageJson.optionalDependencies ?? {};

for (const pkg of PACKAGES) {
  const pinnedVersion = pinnedVersions[pkg];
  if (!pinnedVersion) {
    console.log(`[vendor-sharp-native] ${pkg} not in sharp's optionalDependencies, skipping.`);
    continue;
  }

  // pnpm's store directory naming: "@scope/name" becomes "@scope+name@version".
  const storeDirName = `${pkg.replace('/', '+')}@${pinnedVersion}`;
  const sourceDir = join(pnpmStoreDir, storeDirName, 'node_modules', pkg);

  if (!existsSync(sourceDir)) {
    // Not installed for this platform (e.g. running on macOS locally,
    // not linux-x64) — nothing to vendor, sharp will fall back to
    // whatever native build IS available on this machine.
    console.log(`[vendor-sharp-native] ${pkg}@${pinnedVersion} not installed, skipping.`);
    continue;
  }

  const destDir = join(appRoot, 'node_modules', pkg);

  if (existsSync(destDir)) {
    console.log(`[vendor-sharp-native] ${pkg} already vendored, skipping.`);
    continue;
  }

  mkdirSync(dirname(destDir), { recursive: true });
  cpSync(sourceDir, destDir, { recursive: true, dereference: true });
  console.log(`[vendor-sharp-native] Copied ${pkg} -> ${destDir}`);
}

// Test-only stand-in for the `server-only` package. Next.js's own webpack
// config aliases `server-only` to a no-op when building the server bundle
// and leaves it throwing for the client bundle — that convention is a
// Next.js build-time mechanism, not something Vitest/Vite replicates, so
// vitest.config.ts aliases it here instead. Every test in this project runs
// as "server" code by definition (nothing here renders a browser bundle).
export {};

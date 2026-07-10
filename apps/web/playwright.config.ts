import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];
// Set when running against an already-deployed target (e.g. the deploy
// workflow's post-deploy smoke test) — in that case there's nothing to
// boot locally, `pnpm start` would just fail with EADDRINUSE-adjacent
// noise against a URL nothing local is listening on.
const remoteBaseUrl = process.env['PLAYWRIGHT_BASE_URL'];

export default defineConfig({
  testDir: '../../tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 4 } : {}),
  reporter: isCI
    ? [
        ['html', { open: 'never' }],
        ['github', {}],
      ]
    : 'list',
  use: {
    baseURL: remoteBaseUrl ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  ...(remoteBaseUrl
    ? {}
    : {
        webServer: {
          command: 'pnpm start',
          url: 'http://localhost:3000',
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      }),
});

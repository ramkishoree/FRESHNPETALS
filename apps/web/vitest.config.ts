import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'server-only': path.resolve(import.meta.dirname, 'tests/mocks/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Ch.17 §28 Coverage Exceptions — generated code, config, types, build scripts excluded.
      exclude: [
        'node_modules/**',
        '.next/**',
        'tests/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        'app/**/layout.tsx',
        'app/**/page.tsx',
        'components/ui/**',
      ],
    },
  },
});

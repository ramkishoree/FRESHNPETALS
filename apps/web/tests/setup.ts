import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Explicit unmount-and-clean-DOM between tests. RTL's automatic cleanup
// relies on a globally-available `afterEach` (Jest-style globals); this
// project runs Vitest without `test.globals`, so it wouldn't fire on its
// own and every render() in a file would pile up in the same document.
afterEach(() => {
  cleanup();
});

// jsdom implements no CSS Object Model media queries, so `matchMedia` is
// simply absent. Any component that asks whether the visitor prefers
// reduced motion throws on render without this. The stub reports "no
// preference", which is the majority case and the one worth exercising
// by default; a test that cares about the other branch overrides it.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

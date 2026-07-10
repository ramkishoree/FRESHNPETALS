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

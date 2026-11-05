// Vitest setup file — adds jest-dom's custom matchers (toBeInTheDocument, etc.)
// to every test file via `test.setupFiles` in vite.config.js.
//
// We're not running with `test.globals: true` (to keep `expect`/`describe`/
// `it` out of the global namespace, which the existing ESLint config doesn't
// declare), so jest-dom's matchers are registered explicitly against
// Vitest's `expect` rather than relying on jest-dom's auto-detection.
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Without `test.globals: true`, Testing Library can't auto-detect the test
// framework to register its own cleanup, so unmount rendered components
// after every test ourselves to avoid cross-test DOM leakage.
afterEach(() => {
  cleanup();
});

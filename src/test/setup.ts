// Runs before every test file.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});

// jsdom doesn't implement scrollTo; Dialog's scroll lock calls it, which would
// otherwise print a "Not implemented" warning on every dialog test.
window.scrollTo = () => {};

// ResizeObserver is deliberately left unstubbed: useContainerWidth guards on it
// being undefined and falls back to one measurement, and jsdom reports every
// element as 0 wide — so a component under test sees its narrow layout.

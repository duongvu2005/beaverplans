// Runs before every test file. Extends `expect` with jest-dom matchers
// (toBeInTheDocument, toHaveAttribute, ...) and unmounts whatever the previous
// component test rendered, so tests don't leak DOM nodes into one another.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});

// jsdom doesn't implement scrollTo; Dialog's scroll lock calls it, which would
// otherwise print a "Not implemented" warning on every dialog test.
window.scrollTo = () => {};

// jsdom doesn't implement ResizeObserver either, and useContainerWidth installs
// one. The hook already guards on `typeof ResizeObserver === 'undefined'` and
// falls back to its one-shot measurement, so leaving it undefined is a faithful
// test environment: jsdom reports every element as 0 wide, which is what a
// component under test should see — its narrow layout, with no resize tracking.

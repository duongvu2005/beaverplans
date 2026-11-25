import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { FONTS } from './src/font/font.js';
import { LOOK_FACES, SHARED_FACES, claimsFace, pickLookScript } from './src/font/preloadScript.js';

/**
 * Preloads the faces the first paint needs, for whichever look this visitor is in.
 *
 * Built from filenames rather than written into index.html by hand, because a
 * build content-hashes them and a hand-written tag would go stale on the next
 * font change.
 */
function preloadFonts(): Plugin {
    return {
        name: 'preload-fonts',
        transformIndexHtml: {
            order: 'post',
            handler(_html, ctx) {
                // A build has a bundle of content-hashed filenames. Dev has no
                // bundle: Vite serves the packages straight out of node_modules,
                // so the names come from fonts.css and carry no hash.
                const isDev = ctx.bundle === undefined;
                const files = isDev
                    ? devFontUrls()
                    : Object.keys(ctx.bundle ?? {}).map((file) => `/${file}`);

                // Every face of every look, not just the one this visitor is in:
                // the look can change after first paint, when the account
                // answers, and a face fetched at that point is already too late
                // for font-display: optional.
                const preload = files.filter(
                    (file) =>
                        claimsFace(SHARED_FACES, file) ||
                        FONTS.some((look) => claimsFace(LOOK_FACES[look], file)) ||
                        // A build inlines these as data URIs, so they never race
                        // and need no tag. Dev serves them as files, so there
                        // they do — without this, dev reports subset bugs
                        // production does not have.
                        (isDev && isInlinedInBuild(file)),
                );

                return [
                    ...preload.map((href) => ({
                        tag: 'link',
                        attrs: {
                            rel: 'preload',
                            as: 'font',
                            type: 'font/woff2',
                            href,
                            // Required even same-origin. Without it the preload
                            // lands in a different cache partition than the use
                            // and the font is fetched twice.
                            crossorigin: '',
                        },
                        // Appended, not prepended: the preload scanner reads the
                        // whole head at once, and prepending pushes the charset
                        // meta toward the 1024-byte limit.
                        injectTo: 'head' as const,
                    })),
                    {
                        tag: 'script',
                        children: pickLookScript(),
                        injectTo: 'head' as const,
                    },
                ];
            },
        },
    };
}

// Vite's default assetsInlineLimit; nothing below overrides it.
const INLINE_LIMIT = 4096;

/** Every woff2 fonts.css names, addressed the way the dev server serves it. */
function devFontUrls(): readonly string[] {
    const css = readFileSync(fileURLToPath(new URL('./src/fonts.css', import.meta.url)), 'utf8');
    const urls = [...css.matchAll(/url\(([^)]*\.woff2)\)/g)].map(([, url]) => url ?? '');
    return [...new Set(urls)].map((url) => `/node_modules/${url}`);
}

/** Whether a build would inline this face rather than emit it as a file. */
function isInlinedInBuild(url: string): boolean {
    const path = url.replace(/^\/node_modules\//, '');
    try {
        return (
            statSync(fileURLToPath(new URL(`./node_modules/${path}`, import.meta.url))).size <
            INLINE_LIMIT
        );
    } catch {
        return false;
    }
}

// https://vite.dev/config/
export default defineConfig({
    // Which faces belong to which look, and why latin-ext is among them, are in
    // src/font/preloadScript.ts.
    plugins: [react(), preloadFonts()],
    // Must stay in step with "paths" in tsconfig.app.json: tsc resolves @/ from
    // there, the bundler and vitest resolve it from here, and nothing checks
    // that the two agree.
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
        env: {
            TZ: 'America/New_York',
        },
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            // All of src/ is measured. This used to be an allowlist of
            // core/ + storage/, which encoded the old teaching boundary (the
            // pure domain was written test-first, the UI layer was not) rather
            // than a quality bar — so the UI could not appear in the report at
            // any percentage. That split is retired, so the default is now
            // "covered", and every omission below has to argue for itself.
            include: ['src/**'],
            exclude: [
                // Erased at compile time: no statements to cover.
                'src/core/types.ts',
                'src/storage/backend.ts',

                // The mount call. Anything assertable here is already asserted
                // by App's own tests.
                'src/main.tsx',

                // Config literals reading import.meta.env, and the module-level
                // singletons built from them. Constructing them under test
                // proves only that the constructors run; the classes they wire
                // together (CloudBackend, LocalBackend, Store) are tested
                // directly against fakes. Caveat: instance.ts's realtime
                // resubscribe callback is real logic living behind this line —
                // if it grows, it moves out of here rather than staying hidden.
                'src/storage/supabaseClient.ts',
                'src/storage/instance.ts',

                // Static SVG paths with no props but className. A test could
                // only re-type the path data.
                'src/components/shared/icons/*Icon.tsx',
                'src/components/shared/icons/Grip.tsx',

                // Test-only sample data, exercised by every test that imports it.
                'src/fixtures/**',
                'src/test/**',
            ],
        },
    },
});

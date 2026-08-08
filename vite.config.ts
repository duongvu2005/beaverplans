import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
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

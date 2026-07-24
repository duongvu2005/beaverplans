import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    test: {
        env: {
            TZ: 'America/New_York',
        },
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            include: [
                'src/core/**',
                'src/storage/**',
                'src/components/dndReorder.ts',
                'src/components/WeightDots.tsx',
                'src/components/ConfirmDialog.tsx',
            ],
            exclude: ['src/core/types.ts'],
        },
    },
});

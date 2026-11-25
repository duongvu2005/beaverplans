import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
// Not @fontsource's own CSS but a generated copy of it, with font-display
// switched to optional. Regenerating loses that edit — see fonts.css.
import './fonts.css';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';
import { CrashScreen } from '@/components/shell/CrashScreen';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { accountLocale } from '@/i18n/accountLocale';
import { FontProvider } from '@/font/FontProvider';
import { accountFont } from '@/font/accountFont';
import { supabase } from '@/storage/supabaseClient';
import { registerServiceWorker } from '@/utils/registerServiceWorker';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LocaleProvider account={accountLocale(supabase.auth)}>
            <FontProvider account={accountFont(supabase.auth)}>
                <ErrorBoundary fallback={() => <CrashScreen scope="app" />}>
                    <App />
                </ErrorBoundary>
            </FontProvider>
        </LocaleProvider>
        <Analytics />
        <SpeedInsights />
    </StrictMode>,
);

// After the render, so registration never competes with first paint.
if (import.meta.env.PROD) {
    registerServiceWorker(navigator.serviceWorker);
}

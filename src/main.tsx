import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts: font files come from @fontsource, but fonts.css is our
// own generated copy of their CSS with font-display switched to optional —
// see that file's header comment for why.
import './fonts.css';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

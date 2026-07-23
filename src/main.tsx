import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Touch dragging is handled by dnd-kit's PointerSensor, so no touch polyfill is
// needed here anymore.
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

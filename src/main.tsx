import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { enableDragDropTouch } from '@dragdroptouch/drag-drop-touch';

// Translates touch gestures into the same native drag events the tree uses, so
// dragging works on phones and tablets. No-op for mouse input.
enableDragDropTouch();
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

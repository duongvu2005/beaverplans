import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { enableDragDropTouch } from '@dragdroptouch/drag-drop-touch';

// Translates touch gestures into the same native drag events the tree uses, so
// dragging works on phones and tablets. No-op for mouse input.
//
// allowDragScroll is off: by default the polyfill scrolls the WINDOW once a drag
// comes within 10% of a viewport edge. Dragging toward the right edge scrolled
// the page sideways into empty space, and inside a dialog it scrolled the
// backdrop rather than the dialog's own content, which is never what is wanted.
enableDragDropTouch(document, document, { allowDragScroll: false });
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

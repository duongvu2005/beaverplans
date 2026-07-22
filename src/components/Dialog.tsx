import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dialog.module.css';

// Stack of open dialogs (topmost last). Only the topmost responds to Escape, so a
// dialog opened inside another (e.g. the weight sheet inside the task editor)
// closes just itself, not its parent. The stack doubles as the reference count
// for the body scroll lock, so a nested dialog closing does not unlock the page
// while its parent is still open.
const openDialogs: symbol[] = [];

// Page offset captured when the first dialog opened, restored when the last closes.
let lockedScrollY = 0;

function lockBodyScroll() {
    lockedScrollY = window.scrollY;
    document.body.style.top = `${-lockedScrollY}px`;
    document.body.classList.add('dialogOpen');
}

function unlockBodyScroll() {
    document.body.classList.remove('dialogOpen');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
}

type DialogProps = {
    open: boolean;
    onClose: () => void;
    labelledBy?: string;
    children: ReactNode;
};

export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const idRef = useRef(Symbol('dialog'));

    useEffect(() => {
        if (!open) return;
        const id = idRef.current;
        openDialogs.push(id);
        if (openDialogs.length === 1) {
            lockBodyScroll();
        }
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && openDialogs[openDialogs.length - 1] === id) {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            const i = openDialogs.indexOf(id);
            if (i !== -1) openDialogs.splice(i, 1);
            if (openDialogs.length === 0) {
                unlockBodyScroll();
            }
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className={styles.scrim} onClick={onClose}>
            <div
                ref={panelRef}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

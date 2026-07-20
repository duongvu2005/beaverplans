import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dialog.module.css';

// Stack of open dialogs (topmost last). Only the topmost responds to Escape, so a
// dialog opened inside another (e.g. the weight sheet inside the task editor)
// closes just itself, not its parent.
const openDialogs: symbol[] = [];

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

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dialog.module.css';

type DialogProps = {
    open: boolean;
    onClose: () => void;
    labelledBy?: string; // id of the element that titles the dialog
    children: ReactNode;
};

export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // While open: focus the panel, and let Escape close it.
    useEffect(() => {
        if (!open) return;
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
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

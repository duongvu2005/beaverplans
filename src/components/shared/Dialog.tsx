import { useInsertionEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { APP_CONTAINER_SELECTOR } from '@/hooks/useContainerWidth';
import styles from './Dialog.module.css';

function portalTarget(): HTMLElement {
    return document.querySelector<HTMLElement>(APP_CONTAINER_SELECTOR) ?? document.body;
}

// Topmost last. Only the topmost responds to Escape, and the depth doubles as
// the reference count for the body scroll lock.
const openDialogs: symbol[] = [];

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function lockBodyScroll() {
    document.documentElement.classList.add('dialogOpen');
}

function unlockBodyScroll() {
    document.documentElement.classList.remove('dialogOpen');
}

type DialogProps = {
    open: boolean;
    onClose: () => void;
    labelledBy?: string;
    children: ReactNode;
    // 'full' keeps the same docking — bottom sheet on phone, centered modal on
    // desktop — but fills nearly the whole screen.
    size?: 'default' | 'full';
    // Governs the scrim alone: Escape and the dialog's own close controls work
    // either way.
    closeOnScrimClick?: boolean;
};

export function Dialog({
    open,
    onClose,
    labelledBy,
    children,
    size = 'default',
    closeOnScrimClick = true,
}: DialogProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const idRef = useRef(Symbol('dialog'));
    // An insertion effect, so the opener is captured before a child's autoFocus moves activeElement.
    const openerRef = useRef<Element | null>(null);
    useInsertionEffect(() => {
        if (open) openerRef.current = document.activeElement;
    }, [open]);
    // Read through a ref so the effect below depends on `open` alone.
    const onCloseRef = useRef(onClose);
    useLayoutEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useLayoutEffect(() => {
        if (!open) return;
        const id = idRef.current;
        openDialogs.push(id);
        if (openDialogs.length === 1) {
            lockBodyScroll();
        }
        // An unconditional focus() here runs after a child's autoFocus and
        // silently undoes it.
        if (!panelRef.current?.contains(document.activeElement)) {
            panelRef.current?.focus();
        }
        const onKey = (e: KeyboardEvent) => {
            if (openDialogs[openDialogs.length - 1] !== id) return;
            if (e.key === 'Escape') {
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;
            const panel = panelRef.current;
            if (!panel) return;
            const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
            const first = items[0];
            const last = items[items.length - 1];
            if (!first || !last) {
                // Nothing to cycle through, so Tab has nowhere to go but out.
                e.preventDefault();
                panel.focus();
                return;
            }
            const active = document.activeElement;
            // The panel itself is contained by the panel, so backwards from it
            // counts as leaving; forwards from it falls into `first` unaided.
            const leaving = e.shiftKey
                ? active === first || active === panel || !panel.contains(active)
                : active === last || !panel.contains(active);
            if (leaving) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
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
            // The opener is routinely gone by now; focusing a detached node strands activeElement.
            const opener = openerRef.current;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, [open]);

    if (!open) return null;

    const panelClass = size === 'full' ? `${styles.panel} ${styles.panelFull}` : styles.panel;
    const scrimClass = size === 'full' ? `${styles.scrim} ${styles.scrimFull}` : styles.scrim;

    return createPortal(
        <div className={scrimClass} onClick={closeOnScrimClick ? onClose : undefined}>
            <div
                ref={panelRef}
                className={panelClass}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        portalTarget(),
    );
}

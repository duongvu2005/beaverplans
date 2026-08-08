import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { APP_CONTAINER_SELECTOR } from '@/hooks/useContainerWidth';
import styles from './Dialog.module.css';

// Where the overlay is portalled to. The app shell's own box, not <body>: the
// scrim is position: fixed, so its containing block is the nearest container —
// portalling into the shell keeps the overlay inside the app's box when the app
// is embedded in a wider page, and is identical to <body> when the app owns the
// whole page. It also gives the panel's own breakpoint an `app` container to
// query. Falls back to <body> when there is no shell (a Dialog rendered
// standalone in a test or a preview), which is the old behaviour exactly.
function portalTarget(): HTMLElement {
    return document.querySelector<HTMLElement>(APP_CONTAINER_SELECTOR) ?? document.body;
}

// Stack of open dialogs (topmost last). Only the topmost responds to Escape, so a
// dialog opened inside another (e.g. the weight sheet inside the task editor)
// closes just itself, not its parent. The stack doubles as the reference count
// for the body scroll lock, so a nested dialog closing does not unlock the page
// while its parent is still open.
const openDialogs: symbol[] = [];

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
    // 'default': today's height for every existing dialog. 'full': same
    // docking (bottom sheet on phone, centered modal on desktop) but tall
    // enough to fill nearly the whole screen — for content that wants to
    // dominate (AuthForm) without giving up the scrim/focus/Escape/scroll-lock
    // behavior a bare full-page div would have to reimplement.
    size?: 'default' | 'full';
    // true everywhere except AuthForm: a stray click while typing a
    // password shouldn't discard the form. Escape and the dialog's own
    // close/cancel controls still work either way — this only governs the
    // scrim.
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
    // Callers pass onClose as a fresh inline function on every render (e.g.
    // onClose={() => setRemoving(null)}). Reading it through a ref, rather
    // than putting it in the effect's dependency array, keeps the lock/unlock
    // effect tied to open/close only — not to onClose's identity, which would
    // otherwise re-run the effect (unlock, then immediately re-lock) on every
    // unrelated parent re-render while the dialog is still open.
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
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && openDialogs[openDialogs.length - 1] === id) {
                onCloseRef.current();
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
    }, [open]);

    if (!open) return null;

    const panelClass = size === 'full' ? `${styles.panel} ${styles.panelFull}` : styles.panel;
    // size="full" also opaques the scrim: this size is for content that is a
    // destination in its own right, and a translucent wash reads as "the app is
    // still there, behind glass" — the opposite of what a destination wants.
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

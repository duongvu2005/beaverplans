import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './AccountMenu.module.css';

function LockIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
    );
}

function SignOutIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
            <path d="M17 15l3-3-3-3" />
            <path d="M20 12H9" />
        </svg>
    );
}

type AccountMenuProps = {
    /** the trigger, rendered inside the anchor this menu positions against */
    trigger: ReactNode;
    open: boolean;
    onClose: () => void;
    onChangePassword: () => void;
    onSignOut: () => void;
    /** goes on the anchor, so the bar can hide the whole thing on a phone */
    className?: string;
};

/**
 * The desktop account dropdown: what the email chip in the top bar opens.
 *
 * Only two rows, because the desktop bar already carries the rest — Support and
 * the theme toggle are a click away in the open, so putting them in here too
 * would make the menu longer without making anything more reachable. The
 * phone's AccountSheet still holds all four: there is no bar there to carry
 * them. Nor does the panel name the account: the chip it hangs off is the
 * address, directly above, and repeating it is a whole row that tells you
 * something you are already looking at.
 *
 * Takes its trigger as a child rather than positioning against a ref the parent
 * hands over: the anchor and the panel have to share a positioning context for
 * `top: 100%` to mean anything, so owning both is what makes that true by
 * construction. Outside-click and Escape both close, and the click that closes
 * is not swallowed — dismissing a menu should not also cost you the click you
 * meant for whatever is underneath.
 */
export function AccountMenu({
    trigger,
    open,
    onClose,
    onChangePassword,
    onSignOut,
    className,
}: AccountMenuProps) {
    const anchorRef = useRef<HTMLDivElement>(null);
    // Read through a ref for the same reason Dialog does: callers pass a fresh
    // inline arrow every render, and depending on its identity would tear down
    // and reinstall these listeners on every unrelated parent re-render.
    const onCloseRef = useRef(onClose);
    useLayoutEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        // mousedown, not click: a click fires after the press has already moved
        // focus, which on a re-press of the trigger itself would close the menu
        // and then let the trigger's own onClick reopen it.
        function onPointer(e: MouseEvent) {
            if (!(e.target instanceof Node)) return;
            if (anchorRef.current?.contains(e.target) === true) return;
            onCloseRef.current();
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onCloseRef.current();
        }
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div
            className={className === undefined ? styles.anchor : `${styles.anchor} ${className}`}
            ref={anchorRef}
        >
            {trigger}
            {open && (
                <div className={styles.menu} role="menu">
                    <button
                        type="button"
                        role="menuitem"
                        className={styles.item}
                        onClick={onChangePassword}
                    >
                        <LockIcon />
                        Change password
                    </button>
                    <div className={styles.sep} role="separator" />
                    <button
                        type="button"
                        role="menuitem"
                        className={`${styles.item} ${styles.danger}`}
                        onClick={onSignOut}
                    >
                        <SignOutIcon />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

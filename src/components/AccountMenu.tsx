import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { ThemePref } from '../hooks/useTheme';
import { ThemePicker } from './ThemePicker';
import styles from './AccountMenu.module.css';

/* A person, not a gear. The panel behind this row is about who the account is —
   name, address, password — and a gear is the generic glyph for app preferences,
   which is the one thing in this menu it does NOT open (the theme sits above it).
   Head-and-shoulders matches UserIcon, the same mark the account chip already
   uses, redrawn on the 24 grid the rest of this menu is on. */
function PersonIcon() {
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
            <circle cx="12" cy="8.4" r="3.6" />
            <path d="M5.2 19.8a6.8 6.8 0 0 1 13.6 0" />
        </svg>
    );
}

function ShieldIcon() {
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
            <path d="M12 3l7 3v6c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6l7-3z" />
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
    themePref: ThemePref;
    onPickTheme: (pref: ThemePref) => void;
    /**
     * omitted for a guest trigger: there is nothing here for a guest to act on.
     * Data & privacy belongs to this group and not beside the theme, because a
     * guest's weeks never leave their browser — there is no custodian to ask for
     * a copy and nothing on a server to erase.
     */
    accountActions?: {
        onOpenSettings: () => void;
        onSignOut: () => void;
        onOpenData: () => void;
    };
    /** goes on the anchor, so the bar can hide the whole thing on a phone */
    className?: string;
};

/**
 * The account dropdown: what the email chip (or, signed out, the Guest chip)
 * opens.
 *
 * Light/Dark lives here rather than beside the tabs because it is a
 * preference about whoever is looking at the app, and that is exactly what
 * this menu is already the home for. It stays even for a guest — the trigger
 * just drops the two rows below it, since there is no account yet for
 * Change password or Sign out to act on. Support stays out in the bar: it
 * does not belong to any one account, signed in or not, so it has no reason
 * to be reachable only from this menu. The phone's AccountSheet still holds
 * everything: there is no bar there to carry it. Signed in, the panel also
 * doesn't name the account: the chip it hangs off is the address, directly
 * above, and repeating it is a whole row that tells you something you are
 * already looking at.
 *
 * Takes its trigger as a child rather than positioning against a ref the parent
 * hands over: the anchor and the panel have to share a positioning context for
 * `top: 100%` to mean anything, so owning both is what makes that true by
 * construction. Outside-click and Escape both close, and the click that closes
 * is not swallowed — dismissing a menu should not also cost you the click you
 * meant for whatever is underneath. Picking a theme deliberately does not
 * close the menu, so light and dark can be compared in place before you move on.
 */
export function AccountMenu({
    trigger,
    open,
    onClose,
    themePref,
    onPickTheme,
    accountActions,
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
                <div
                    className={
                        accountActions ? styles.menu : `${styles.menu} ${styles.menuCompact}`
                    }
                    role="menu"
                >
                    <ThemePicker pref={themePref} onPick={onPickTheme} className={styles.theme} />
                    {accountActions && (
                        <>
                            <div className={styles.sep} role="separator" />
                            <button
                                type="button"
                                role="menuitem"
                                className={styles.item}
                                onClick={accountActions.onOpenData}
                            >
                                <ShieldIcon />
                                Data &amp; privacy
                            </button>
                            <div className={styles.sep} role="separator" />
                            <button
                                type="button"
                                role="menuitem"
                                className={styles.item}
                                onClick={accountActions.onOpenSettings}
                            >
                                <PersonIcon />
                                Account settings
                            </button>
                            <div className={styles.sep} role="separator" />
                            <button
                                type="button"
                                role="menuitem"
                                className={`${styles.item} ${styles.danger}`}
                                onClick={accountActions.onSignOut}
                            >
                                <SignOutIcon />
                                Sign out
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

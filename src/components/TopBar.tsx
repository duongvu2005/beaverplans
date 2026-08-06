import { useState } from 'react';
import { AccountSheet } from './AccountSheet';
import { HeartIcon } from './HeartIcon';
import { UserIcon } from './UserIcon';
import { useTheme } from './useTheme';
import type { AuthUser } from './useAuth';
import styles from './TopBar.module.css';

export type View = 'plan' | 'stats' | 'archive';

const VIEWS: readonly View[] = ['plan', 'stats', 'archive'];

// PLACEHOLDER (2026-08-01): points at the repo until there is a real support
// destination to send people to. One line to change.
const SUPPORT_URL = 'https://github.com/duongvu2005/beaverplans/issues';

type TopBarProps = {
    view: View;
    onView: (view: View) => void;
    user: AuthUser | null;
    onOpenAuth: () => void;
    onSignOut: () => void;
};

/**
 * The app's chrome: which of the three views you are in, plus the utilities that
 * belong to the app rather than to any one week.
 *
 * The markup is the same at every width and only the CSS moves it, the way the
 * tab bar it replaces already did. On a desktop it is a 48px bar inset to
 * .pane's 24px, so the tabs and the week header share a left edge. On a phone
 * there is no bar at all: the same element becomes a floating pill at the bottom
 * holding the tabs and a fourth slot, and everything else in the bar folds into
 * the sheet behind that slot.
 */
export function TopBar({ view, onView, user, onOpenAuth, onSignOut }: TopBarProps) {
    const { theme, toggleTheme } = useTheme();
    const [sheetOpen, setSheetOpen] = useState(false);
    const themeLabel = theme === 'dark' ? 'Switch to light' : 'Switch to dark';

    return (
        <>
            <header className={styles.bar}>
                <div className={styles.inner}>
                    <span className={styles.mark}>
                        beaverplans<span className={styles.dot}>.</span>
                    </span>
                    <span className={styles.rule} aria-hidden="true" />

                    {/* Mono caps: in this app that means "moves you somewhere".
                        Sans sentence case, everywhere else, means "changes
                        something" — see docs/conventions.md. */}
                    <nav className={styles.tabs}>
                        {VIEWS.map((name) => (
                            <button
                                key={name}
                                type="button"
                                aria-current={view === name ? 'page' : undefined}
                                onClick={() => onView(name)}
                            >
                                {name}
                            </button>
                        ))}
                    </nav>

                    <span className={styles.grow} />

                    <a
                        className={styles.util}
                        href={SUPPORT_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="Support"
                    >
                        <HeartIcon />
                        <span className={styles.utilLabel}>Support</span>
                    </a>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={toggleTheme}
                        aria-label={themeLabel}
                        title={themeLabel}
                    >
                        <span className={styles.half} aria-hidden="true" />
                        <span className={styles.themeLabel}>
                            {theme === 'dark' ? 'Dark' : 'Light'}
                        </span>
                    </button>

                    <span className={styles.rule} aria-hidden="true" />

                    {/* A status readout, not a control — one word for where your
                        weeks are kept. The same slot carries Saved / Saving… /
                        Offline once there is a cloud to be out of sync with. */}
                    <span className={styles.guest}>
                        <i aria-hidden="true" />
                        <span
                            className={
                                user === null
                                    ? styles.guestLabel
                                    : `${styles.guestLabel} ${styles.guestEmail}`
                            }
                        >
                            {user === null ? 'Guest' : (user.email ?? 'Account')}
                        </span>
                    </span>
                    <button
                        type="button"
                        className={styles.btn}
                        onClick={user === null ? onOpenAuth : onSignOut}
                    >
                        {user === null ? 'Sign in' : 'Sign out'}
                    </button>

                    {/* Phone only: the fourth slot in the floating pill, which is
                        where the three controls above go when there is no bar. */}
                    <span className={styles.divider} aria-hidden="true" />
                    <button
                        type="button"
                        className={styles.you}
                        onClick={() => setSheetOpen(true)}
                        aria-label="Account"
                    >
                        <span>
                            <UserIcon />
                        </span>
                    </button>
                </div>
            </header>

            {sheetOpen && (
                <AccountSheet
                    theme={theme}
                    supportUrl={SUPPORT_URL}
                    user={user}
                    onClose={() => setSheetOpen(false)}
                    onToggleTheme={toggleTheme}
                    // Hand off, don't stack: AuthForm is a takeover, and leaving
                    // this sheet mounted behind it composites a second scrim and
                    // makes Escape land back here instead of on the board.
                    onSignIn={() => {
                        setSheetOpen(false);
                        onOpenAuth();
                    }}
                    onSignOut={onSignOut}
                />
            )}
        </>
    );
}

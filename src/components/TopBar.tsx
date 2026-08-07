import { useState } from 'react';
import { AccountMenu } from './AccountMenu';
import { AccountSheet } from './AccountSheet';
import { ChevronIcon } from './ChevronIcon';
import { HeartIcon } from './HeartIcon';
import { UserIcon } from './UserIcon';
import { useTheme } from '../hooks/useTheme';
import type { AuthUser } from '../hooks/useAuth';
import styles from './TopBar.module.css';

export type View = 'plan' | 'stats' | 'archive';

const VIEWS: readonly View[] = ['plan', 'stats', 'archive'];

// "Support" as in chip in, not as in help desk — this is the donation page,
// which is what the heart beside it has always meant.
const DONATE_URL = 'https://donations.amysteriousbeaver.com/';

type TopBarProps = {
    view: View;
    onView: (view: View) => void;
    user: AuthUser | null;
    onOpenAuth: () => void;
    onChangePassword: () => void;
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
export function TopBar({
    view,
    onView,
    user,
    onOpenAuth,
    onChangePassword,
    onSignOut,
}: TopBarProps) {
    const { theme, toggleTheme } = useTheme();
    // Two account surfaces, one per form factor, and only one is ever on
    // screen: the CSS hides the desktop chip on a phone and the phone's tab-bar
    // slot on a desktop, so these never race each other.
    const [sheetOpen, setSheetOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

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
                        href={DONATE_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="Support this project"
                    >
                        <HeartIcon />
                        <span className={styles.utilLabel}>Support</span>
                    </a>
                    <span className={styles.rule} aria-hidden="true" />

                    {/* One chip either way, so the bar never grows or shrinks
                        by a control's worth of width across signing in and
                        out. Signed out it reads "Guest" and opens a menu with
                        only Light/Dark in it (there is no account yet for
                        Change password or Sign out to act on) — Sign in sits
                        beside it as the actual thing to do. Signed in the
                        chip's label becomes the address and the same menu
                        gains those two rows. What drops down is a dropdown —
                        see AccountMenu — not the phone's sheet: a scrim over
                        the whole board is far too much weight for a chip's
                        worth of menu. */}
                    <AccountMenu
                        className={styles.acct}
                        open={menuOpen}
                        onClose={() => setMenuOpen(false)}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                        accountActions={
                            user === null
                                ? undefined
                                : {
                                      onChangePassword: () => {
                                          setMenuOpen(false);
                                          onChangePassword();
                                      },
                                      onSignOut: () => {
                                          setMenuOpen(false);
                                          onSignOut();
                                      },
                                  }
                        }
                        trigger={
                            <button
                                type="button"
                                className={
                                    // Signed in, the chip is the bar's last control, so
                                    // .acctSolo drops the margin .guest otherwise keeps
                                    // tight against the Sign in button that follows a
                                    // guest's chip instead.
                                    user === null
                                        ? `${styles.guest} ${styles.account}`
                                        : `${styles.guest} ${styles.account} ${styles.acctSolo}`
                                }
                                onClick={() => setMenuOpen((shown) => !shown)}
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                            >
                                <i aria-hidden="true" />
                                <span
                                    className={
                                        // "Guest" is the one static caps-and-tracked word
                                        // .guestLabel was built for; an email address isn't,
                                        // so only that case drops the uppercase treatment.
                                        user === null
                                            ? styles.guestLabel
                                            : `${styles.guestLabel} ${styles.guestEmail}`
                                    }
                                >
                                    {user === null ? 'Guest' : (user.email ?? 'Account')}
                                </span>
                                <ChevronIcon dir="down" />
                            </button>
                        }
                    />
                    {user === null && (
                        <button type="button" className={styles.btn} onClick={onOpenAuth}>
                            Sign in
                        </button>
                    )}

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
                    supportUrl={DONATE_URL}
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
                    // Same handoff. ChangePasswordDialog is an ordinary dialog
                    // and Dialog does stack, but a menu that stays open behind
                    // the thing it opened is a menu you have to dismiss twice.
                    onChangePassword={() => {
                        setSheetOpen(false);
                        onChangePassword();
                    }}
                    onSignOut={onSignOut}
                />
            )}
        </>
    );
}

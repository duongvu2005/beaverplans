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
                        href={DONATE_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="Support this project"
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

                    {/* Signed out this is a status readout, not a control — one
                        word for where your weeks are kept, with Sign in beside
                        it as the actual thing to do. The same slot carries
                        Saved / Saving… / Offline once there is a cloud to be
                        out of sync with.

                        Signed in the chip becomes the account menu's trigger and
                        the pair collapses to one control: your address is the
                        most specific label a menu about your account could
                        have, and signing out moves inside it. What drops down
                        is a dropdown — see AccountMenu — not the phone's sheet:
                        a scrim over the whole board is far too much weight for
                        two rows when there is a chip to hang them under. */}
                    {user === null ? (
                        <>
                            <span className={styles.guest}>
                                <i aria-hidden="true" />
                                <span className={styles.guestLabel}>Guest</span>
                            </span>
                            <button type="button" className={styles.btn} onClick={onOpenAuth}>
                                Sign in
                            </button>
                        </>
                    ) : (
                        <AccountMenu
                            className={styles.acct}
                            open={menuOpen}
                            onClose={() => setMenuOpen(false)}
                            onChangePassword={() => {
                                setMenuOpen(false);
                                onChangePassword();
                            }}
                            onSignOut={() => {
                                setMenuOpen(false);
                                onSignOut();
                            }}
                            trigger={
                                <button
                                    type="button"
                                    className={`${styles.guest} ${styles.account}`}
                                    onClick={() => setMenuOpen((shown) => !shown)}
                                    aria-haspopup="menu"
                                    aria-expanded={menuOpen}
                                >
                                    <i aria-hidden="true" />
                                    <span className={`${styles.guestLabel} ${styles.guestEmail}`}>
                                        {user.email ?? 'Account'}
                                    </span>
                                    <ChevronIcon dir="down" />
                                </button>
                            }
                        />
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

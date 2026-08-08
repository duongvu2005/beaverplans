import { useState } from 'react';
import { AccountMenu } from '@/components/account/AccountMenu';
import { AccountSheet } from '@/components/account/AccountSheet';
import { Avatar } from '@/components/account/Avatar';
import { ChevronIcon } from '@/components/shared/icons/ChevronIcon';
import { HeartIcon } from '@/components/shared/icons/HeartIcon';
import { UserIcon } from '@/components/shared/icons/UserIcon';
import { useTheme } from '@/hooks/useTheme';
import type { AuthUser } from '@/hooks/useAuth';
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
    onOpenSettings: () => void;
    onSignOut: () => void;
    /** signed in only — see AccountMenu's accountActions for why */
    onOpenData: () => void;
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
    onOpenSettings,
    onSignOut,
    onOpenData,
}: TopBarProps) {
    const { pref: themePref, setPref: setThemePref } = useTheme();
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
                        themePref={themePref}
                        onPickTheme={setThemePref}
                        accountActions={
                            user === null
                                ? undefined
                                : {
                                      onOpenSettings: () => {
                                          setMenuOpen(false);
                                          onOpenSettings();
                                      },
                                      onSignOut: () => {
                                          setMenuOpen(false);
                                          onSignOut();
                                      },
                                      onOpenData: () => {
                                          setMenuOpen(false);
                                          onOpenData();
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
                                // The visible label is a nickname, which on its own does
                                // not say WHICH account — so the address rides along in
                                // the accessible name and the tooltip. Not the only place
                                // it appears: Data & privacy states it in full.
                                title={user?.email}
                                aria-label={
                                    user === null
                                        ? undefined
                                        : `Account: ${user.username}${
                                              user.email === undefined ? '' : ` (${user.email})`
                                          }`
                                }
                            >
                                {/* A guest keeps the small dot: the cat is a picture OF
                                    somebody, and there is nobody yet. */}
                                {user === null ? (
                                    <i aria-hidden="true" />
                                ) : (
                                    <Avatar size={26} className={styles.avatar} />
                                )}
                                <span
                                    className={
                                        // "Guest" is the one static caps-and-tracked word
                                        // .guestLabel was built for; a chosen name isn't,
                                        // so only that case drops the uppercase treatment.
                                        user === null
                                            ? styles.guestLabel
                                            : `${styles.guestLabel} ${styles.guestName}`
                                    }
                                >
                                    {user === null ? 'Guest' : user.username}
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
                        {/* The span is a bordered circle framing the generic icon.
                            The avatar is already a circle of its own, so signed in
                            it replaces the span rather than sitting inside it —
                            nesting the two drew a ring inside a ring. */}
                        {user === null ? (
                            <span>
                                <UserIcon />
                            </span>
                        ) : (
                            <Avatar size={26} />
                        )}
                    </button>
                </div>
            </header>

            {sheetOpen && (
                <AccountSheet
                    themePref={themePref}
                    supportUrl={DONATE_URL}
                    user={user}
                    onClose={() => setSheetOpen(false)}
                    onPickTheme={setThemePref}
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
                    onOpenSettings={() => {
                        setSheetOpen(false);
                        onOpenSettings();
                    }}
                    onSignOut={onSignOut}
                    // Same handoff as the two rows above: the dialog is App's,
                    // and this sheet is gone before it appears.
                    onOpenData={() => {
                        setSheetOpen(false);
                        onOpenData();
                    }}
                />
            )}
        </>
    );
}

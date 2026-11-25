import type { GuidePref } from '@/hooks/useGuidePref';
import { AccountSheet } from '@/components/account/AccountSheet';
import { Avatar } from '@/components/account/Avatar';
import { HeartIcon } from '@/components/shared/icons/HeartIcon';
import { UserIcon } from '@/components/shared/icons/UserIcon';
import { PlanIcon } from '@/components/shared/icons/PlanIcon';
import { StatsIcon } from '@/components/shared/icons/StatsIcon';
import { WeeksIcon } from '@/components/shared/icons/WeeksIcon';
import { useCopy } from '@/i18n/localeContext';
import { useTheme } from '@/hooks/useTheme';
import type { AuthUser } from '@/hooks/useAuth';
import styles from './TopBar.module.css';

export type View = 'plan' | 'stats' | 'weeks';

const VIEWS: readonly View[] = ['plan', 'stats', 'weeks'];

/** The glyph each tab wears. Labels alone do not fit in Vietnamese, where the
 *  two shortest words are twice their English length. */
const TAB_ICONS: Record<View, (props: { className?: string }) => React.JSX.Element> = {
    plan: PlanIcon,
    stats: StatsIcon,
    weeks: WeeksIcon,
};

const DONATE_URL = 'https://donations.beaverplans.com/';

type TopBarProps = {
    view: View;
    onView: (view: View) => void;
    user: AuthUser | null;
    /** owned by App, because the board reads the same value */
    guidePref: GuidePref;
    onPickGuide: (pref: GuidePref) => void;
    onOpenAuth: () => void;
    onOpenAccountSettings: () => void;
    onSignOut: () => void;
    /** signed in only: a guest's weeks never leave this browser */
    onOpenData: () => void;
    /* Owned by App, not here: this menu is one variant of the same state that
       holds every screen it opens, so a handoff replaces rather than stacks. */
    settingsOpen: boolean;
    onOpenSettings: () => void;
    onCloseSettings: () => void;
};

/** The app's chrome: the three views, plus the utilities that belong to the app rather than to any one week. */
export function TopBar({
    view,
    onView,
    user,
    guidePref,
    onPickGuide,
    onOpenAuth,
    onOpenAccountSettings,
    onSignOut,
    onOpenData,
    settingsOpen,
    onOpenSettings,
    onCloseSettings,
}: TopBarProps) {
    const { topBar } = useCopy();
    const { pref: themePref, setPref: setThemePref } = useTheme();

    return (
        <>
            <header className={styles.bar}>
                <div className={styles.inner}>
                    <span className={styles.mark}>
                        beaverplans<span className={styles.dot}>.</span>
                    </span>
                    <span className={styles.rule} aria-hidden="true" />

                    {/* Mono caps means "moves you somewhere". */}
                    <nav className={styles.tabs}>
                        {VIEWS.map((name) => {
                            const Icon = TAB_ICONS[name];
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    aria-current={view === name ? 'page' : undefined}
                                    onClick={() => onView(name)}
                                >
                                    <Icon className={styles.tabIcon} />
                                    <span className={styles.tabLabel}>{topBar.views[name]}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <span className={styles.grow} />

                    <a
                        className={styles.util}
                        href={DONATE_URL}
                        target="_blank"
                        rel="noreferrer"
                        title={topBar.supportTitle}
                    >
                        <HeartIcon />
                        <span className={styles.utilLabel}>{topBar.support}</span>
                    </a>
                    <span className={styles.rule} aria-hidden="true" />

                    {/* Opens the sheet, same as the phone's slot below. */}
                    <button
                        type="button"
                        className={
                            // .acctSolo drops the margin that keeps a guest's chip tight against Sign in.
                            user === null
                                ? `${styles.guest} ${styles.account} ${styles.acct}`
                                : `${styles.guest} ${styles.account} ${styles.acct} ${styles.acctSolo}`
                        }
                        onClick={onOpenSettings}
                        aria-haspopup="dialog"
                        // The visible label is a nickname, so the address rides
                        // along to say which account this is.
                        title={user?.email}
                        aria-label={
                            user === null ? undefined : topBar.accountOf(user.username, user.email)
                        }
                    >
                        {user === null ? (
                            <i aria-hidden="true" />
                        ) : (
                            <Avatar size={26} className={styles.avatar} />
                        )}
                        <span
                            className={
                                // .guestName drops the caps treatment that
                                // .guestLabel gives the word "Guest".
                                user === null
                                    ? styles.guestLabel
                                    : `${styles.guestLabel} ${styles.guestName}`
                            }
                        >
                            {user === null ? topBar.guest : user.username}
                        </span>
                    </button>
                    {user === null && (
                        <button type="button" className={styles.btn} onClick={onOpenAuth}>
                            {topBar.signIn}
                        </button>
                    )}

                    {/* Phone only: the pill's fourth slot, where everything above
                        goes when there is no bar. */}
                    <span className={styles.divider} aria-hidden="true" />
                    <button
                        type="button"
                        className={styles.you}
                        onClick={onOpenSettings}
                        aria-label={topBar.account}
                    >
                        {user === null ? (
                            <span>
                                <UserIcon />
                            </span>
                        ) : (
                            <Avatar size={32} />
                        )}
                    </button>
                </div>
            </header>

            {settingsOpen && (
                <AccountSheet
                    themePref={themePref}
                    guidePref={guidePref}
                    onPickGuide={onPickGuide}
                    supportUrl={DONATE_URL}
                    user={user}
                    onClose={onCloseSettings}
                    onPickTheme={setThemePref}
                    // Each of these REPLACES this menu in App's one modal slot, so the sheet is never left mounted behind it.
                    onSignIn={onOpenAuth}
                    onOpenAccountSettings={onOpenAccountSettings}
                    onSignOut={onSignOut}
                    onOpenData={onOpenData}
                />
            )}
        </>
    );
}

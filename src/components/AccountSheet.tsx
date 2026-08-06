import type { Theme } from '../hooks/useTheme';
import type { AuthUser } from '../hooks/useAuth';
import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';
import styles from './WeekActionsSheet.module.css';

type AccountSheetProps = {
    theme: Theme;
    supportUrl: string;
    user: AuthUser | null;
    onClose: () => void;
    onToggleTheme: () => void;
    onSignIn: () => void;
    onSignOut: () => void;
};

/**
 * The phone's home for the top bar's right cluster.
 *
 * There is no top bar on a phone, so Support, the theme toggle and signing in
 * have nowhere to sit. They live behind the account slot in the floating tab
 * bar instead — the same rows-with-a-sentence shape as WeekActionsSheet, and
 * its stylesheet, because they are the same kind of list. Sign in itself is
 * NOT a row's worth of UI — it hands off to AuthForm, a full-screen takeover
 * owned by App, not a child of this sheet.
 */
export function AccountSheet({
    theme,
    supportUrl,
    user,
    onClose,
    onToggleTheme,
    onSignIn,
    onSignOut,
}: AccountSheetProps) {
    const titleId = 'account-sheet-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>You</div>
                <h3 id={titleId} className={shell.title}>
                    {user === null ? 'Guest' : (user.email ?? 'Account')}
                </h3>
            </div>
            <div className={styles.items}>
                <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                        onToggleTheme();
                        onClose();
                    }}
                >
                    <b>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</b>
                    <span>
                        Currently using the {theme} palette. The choice is remembered on this
                        device.
                    </span>
                </button>
                <a
                    className={styles.item}
                    href={supportUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}
                >
                    <b>Support</b>
                    <span>Report something broken, or ask for a hand.</span>
                </a>
                {user === null ? (
                    <button type="button" className={styles.item} onClick={onSignIn}>
                        <b>Sign in</b>
                        <span>Sync your weeks across devices.</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        className={styles.item}
                        onClick={() => {
                            onSignOut();
                            onClose();
                        }}
                    >
                        <b>Sign out</b>
                        <span>
                            You&rsquo;ll keep your weeks on this device too — sign back in anytime
                            to sync them again.
                        </span>
                    </button>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
            </div>
        </Dialog>
    );
}

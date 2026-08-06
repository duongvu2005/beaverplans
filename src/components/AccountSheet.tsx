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
    /** signed in only; hands off to the dialog the way onSignIn does */
    onChangePassword: () => void;
    onSignOut: () => void;
};

/**
 * The phone's home for the top bar's right cluster.
 *
 * There is no top bar on a phone, so Support, the theme toggle and the account
 * rows have nowhere to sit. They live behind the account slot in the floating
 * tab bar instead — the same rows-with-a-sentence shape as WeekActionsSheet,
 * and its stylesheet, because they are the same kind of list. The desktop's
 * equivalent is AccountMenu, a dropdown off the email chip, and it is
 * deliberately shorter: over there Support and the theme toggle are already
 * sitting in the open, so only the account rows need a menu at all.
 *
 * No row here is more than a handoff. Sign in opens AuthForm and Change
 * password opens ChangePasswordForm — both owned by App, neither a child of
 * this sheet, and the sheet closes before either appears rather than stacking
 * underneath it.
 */
export function AccountSheet({
    theme,
    supportUrl,
    user,
    onClose,
    onToggleTheme,
    onSignIn,
    onChangePassword,
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
                    <span>Chip in to keep beaverplans running. Entirely optional.</span>
                </a>
                {user === null ? (
                    <button type="button" className={styles.item} onClick={onSignIn}>
                        <b>Sign in</b>
                        <span>Sync your weeks across devices.</span>
                    </button>
                ) : (
                    <>
                        <button type="button" className={styles.item} onClick={onChangePassword}>
                            <b>Change password</b>
                            <span>
                                You&rsquo;ll confirm your current one first. Forgotten it? That
                                screen can email you a link instead.
                            </span>
                        </button>
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
                                You&rsquo;ll keep your weeks on this device too — sign back in
                                anytime to sync them again.
                            </span>
                        </button>
                    </>
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

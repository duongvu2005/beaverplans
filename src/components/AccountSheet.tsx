import type { ThemePref } from '@/hooks/useTheme';
import type { AuthUser } from '@/hooks/useAuth';
import { Dialog } from './Dialog';
import { ThemePicker } from './ThemePicker';
import shell from './dialogShell.module.css';
import styles from './WeekActionsSheet.module.css';

type AccountSheetProps = {
    themePref: ThemePref;
    supportUrl: string;
    user: AuthUser | null;
    onClose: () => void;
    onPickTheme: (pref: ThemePref) => void;
    onSignIn: () => void;
    /** signed in only; hands off to the dialog the way onSignIn does */
    onOpenSettings: () => void;
    onSignOut: () => void;
    /**
     * signed in only, and another handoff. A guest's weeks never leave this
     * browser, so there is nothing being held on their behalf to demand a copy
     * of or have erased.
     */
    onOpenData: () => void;
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
    themePref,
    supportUrl,
    user,
    onClose,
    onPickTheme,
    onSignIn,
    onOpenSettings,
    onSignOut,
    onOpenData,
}: AccountSheetProps) {
    const titleId = 'account-sheet-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            {/* The phone's chip is a bare circle with no room for a name beside
                it, so this header is where the name actually appears — with the
                address under it, since the name alone does not say which account
                you are in. */}
            <div className={shell.head}>
                <div className={shell.eyebrow}>You</div>
                <h3 id={titleId} className={shell.title}>
                    {user === null ? 'Guest' : user.username}
                </h3>
                {user?.email !== undefined && <p className={shell.sub}>{user.email}</p>}
            </div>
            <div className={styles.items}>
                {/* A control rather than a row, unlike everything below it: with
                    three options there is nothing for a single row to say. It also
                    does NOT close the sheet the way the old two-state row did —
                    picking a palette is a thing you compare, and closing on the
                    first press meant reopening the sheet to try the other one. */}
                <div className={styles.pickerRow}>
                    <b className={styles.pickerLabel}>Theme</b>
                    <ThemePicker pref={themePref} onPick={onPickTheme} />
                    <span className={styles.pickerNote}>
                        {themePref === 'system'
                            ? 'Following your device setting, and changing with it.'
                            : `Always ${themePref}, whatever your device is set to.`}
                    </span>
                </div>
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
                        <button type="button" className={styles.item} onClick={onOpenData}>
                            <b>Data &amp; privacy</b>
                            <span>
                                What we store for you, and how to take a copy of it or have it
                                deleted.
                            </span>
                        </button>
                        <button type="button" className={styles.item} onClick={onOpenSettings}>
                            <b>Account settings</b>
                            <span>Your username, email and password.</span>
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

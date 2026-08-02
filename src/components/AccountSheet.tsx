import type { Theme } from './useTheme';
import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';
import styles from './WeekActionsSheet.module.css';

type AccountSheetProps = {
    theme: Theme;
    supportUrl: string;
    onClose: () => void;
    onToggleTheme: () => void;
};

/**
 * The phone's home for the top bar's right cluster.
 *
 * There is no top bar on a phone, so Support, the theme toggle and (later)
 * signing in have nowhere to sit. They live behind the account slot in the
 * floating tab bar instead — the same rows-with-a-sentence shape as
 * WeekActionsSheet, and its stylesheet, because they are the same kind of list.
 */
export function AccountSheet({ theme, supportUrl, onClose, onToggleTheme }: AccountSheetProps) {
    const titleId = 'account-sheet-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>You</div>
                <h3 id={titleId} className={shell.title}>
                    Guest
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
                {/* Inert until Phase 6: the row says what an account will be for
                    rather than pretending to offer one. */}
                <button type="button" className={styles.item} disabled>
                    <b>Sign in</b>
                    <span>
                        Not yet — your weeks are kept on this device. Accounts arrive with cloud
                        sync.
                    </span>
                </button>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
            </div>
        </Dialog>
    );
}

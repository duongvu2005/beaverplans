import { Dialog } from '@/components/shared/Dialog';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from '@/components/shared/sheetShell.module.css';

type SignOutPendingDialogProps = {
    onStay: () => void;
    onSignOutAnyway: () => void;
};

/** Raised when signing out would throw away work the account has not got. */
export function SignOutPendingDialog({ onStay, onSignOutAnyway }: SignOutPendingDialogProps) {
    const { signOutPending } = useCopy();
    const titleId = 'sign-out-pending-title';
    return (
        <Dialog open onClose={onStay} labelledBy={titleId}>
            <div className={shell.head}>
                <h3 id={titleId} className={shell.title}>
                    {signOutPending.title}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <p className={shell.text}>{signOutPending.explain}</p>
                </div>
            </div>
            <div className={styles.items}>
                <button type="button" className={styles.item} onClick={onStay}>
                    <b>{signOutPending.stay}</b>
                    <span>{signOutPending.stayNote}</span>
                </button>
                <button
                    type="button"
                    className={`${styles.item} ${styles.danger}`}
                    onClick={onSignOutAnyway}
                >
                    <b>{signOutPending.signOut}</b>
                    <span>{signOutPending.signOutNote}</span>
                </button>
            </div>
        </Dialog>
    );
}

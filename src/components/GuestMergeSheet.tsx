import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';
import styles from './WeekActionsSheet.module.css';

type GuestMergeSheetProps = {
    onClose: () => void;
    onMerge: () => void;
    onDiscard: () => void;
};

/**
 * The phone's form of the guest-work prompt (see useGuestMigration for when it
 * is raised, GuestMergeDialog for the desktop's form of the same question).
 *
 * Rows with a sentence each, WeekActionsSheet's shape and its stylesheet,
 * because it is the same kind of list: every row is a real destination you tap
 * directly, and merging or discarding both happen on that tap — neither waits
 * behind a second confirm. The foot holds only the way out, since choosing is
 * what the rows are for. Closing without choosing is deliberately not a
 * cancellation: guest work is left exactly as it was, and this asks again on
 * the next fresh sign-in.
 */
export function GuestMergeSheet({ onClose, onMerge, onDiscard }: GuestMergeSheetProps) {
    const titleId = 'guest-merge-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>Welcome back</div>
                <h3 id={titleId} className={shell.title}>
                    Unsaved guest work found
                </h3>
            </div>
            <div className={styles.items}>
                <button type="button" className={styles.item} onClick={onMerge}>
                    <b>Merge into my plan</b>
                    <span>Added below what you already have, not combined with it.</span>
                </button>
                <button type="button" className={styles.item} onClick={onDiscard}>
                    <b>Discard guest work</b>
                    <span>Deletes what you planned as a guest, for good.</span>
                </button>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Decide later
                </button>
            </div>
        </Dialog>
    );
}

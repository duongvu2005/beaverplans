import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';
import styles from './GuestMergeDialog.module.css';

type GuestMergeDialogProps = {
    onClose: () => void;
    onMerge: () => void;
    onDiscard: () => void;
};

/**
 * The desktop's form of the guest-work prompt (see useGuestMigration for when
 * it is raised, GuestMergeSheet for the phone's form of the same question).
 *
 * An ordinary dialog, because at this width Dialog has already stopped docking
 * to the bottom edge and centered itself: rows you tap directly are a phone
 * idiom, and a centered modal that used them would be a sheet wearing the wrong
 * shape. So the explanation collapses into one paragraph and the choices become
 * three real buttons — which, at their natural width, already came so close to
 * filling the foot that stretching them to an equal share reads as intended
 * rather than as three buttons that happened to nearly fit.
 *
 * Decide later is the ghost rather than a Cancel, and means it: nothing is
 * discarded by closing, and the next fresh sign-in asks again.
 */
export function GuestMergeDialog({ onClose, onMerge, onDiscard }: GuestMergeDialogProps) {
    const titleId = 'guest-merge-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>Welcome back</div>
                <h3 id={titleId} className={shell.title}>
                    Unsaved guest work found
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <p className={shell.text}>
                        You planned some work as a guest before signing in. Merging adds it below
                        what you already have, without combining anything.
                    </p>
                </div>
            </div>
            <div className={`${shell.foot} ${styles.footSpan}`}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Decide later
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.danger}`}
                    onClick={onDiscard}
                >
                    Discard guest work
                </button>
                <button type="button" className={`${shell.btn} ${shell.primary}`} onClick={onMerge}>
                    Merge into my plan
                </button>
            </div>
        </Dialog>
    );
}

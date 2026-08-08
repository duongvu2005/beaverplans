import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';
import styles from './WeekActionsSheet.module.css';

type WeekActionsSheetProps = {
    /** the week these actions apply to, already formatted ("Jul 20 – Jul 26") */
    weekLabel: string;
    canMove: boolean;
    canEnd: boolean;
    /** the week holds work and is not frozen — nothing else can be cleared */
    canClear: boolean;
    /** the week is already in the archive: End week becomes Reopen */
    ended?: boolean;
    onClose: () => void;
    /** arm the stepper's move mode; the sheet closes first, it never stacks */
    onMove: () => void;
    /** hand off to the end-week confirm; likewise after the sheet is gone */
    onEnd: () => void;
    /** hand off to the reopen confirm; likewise */
    onReopen: () => void;
    /** hand off to the clear-board confirm; likewise */
    onClear: () => void;
};

/**
 * The narrow-screen home for the two actions that change a week as a whole.
 *
 * On a phone there is no room for Move work and End week beside the gauge, and
 * neither label explains itself — so both move in here, where each gets a
 * sentence. Picking either one closes the sheet before anything else opens, so
 * this is never the bottom of a stack.
 */
export function WeekActionsSheet({
    weekLabel,
    canMove,
    canEnd,
    canClear,
    ended,
    onClose,
    onMove,
    onEnd,
    onReopen,
    onClear,
}: WeekActionsSheetProps) {
    const titleId = 'week-actions-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>Week</div>
                <h3 id={titleId} className={shell.title}>
                    {weekLabel}
                </h3>
            </div>
            <div className={styles.items}>
                <button type="button" className={styles.item} disabled={!canMove} onClick={onMove}>
                    <b>Move this week&rsquo;s work</b>
                    <span>
                        Relabel the whole plan onto a different week. Nothing is finished or lost.
                    </span>
                </button>
                {ended ? (
                    <button type="button" className={styles.item} onClick={onReopen}>
                        <b>Reopen this week</b>
                        <span>
                            Take it back out of the archive so it can be edited again. You&rsquo;ll
                            be asked to confirm.
                        </span>
                    </button>
                ) : (
                    <button
                        type="button"
                        className={styles.item}
                        disabled={!canEnd}
                        onClick={onEnd}
                    >
                        <b>End week</b>
                        <span>
                            File it in your archive and start the next one. Unfinished tasks can
                            carry forward.
                        </span>
                    </button>
                )}
                {/* Below End week, and last, because the two are easy to reach for
                    interchangeably and only one of them keeps a record. Sitting
                    underneath, in the danger tone, is what says which is which. */}
                <button
                    type="button"
                    className={`${styles.item} ${styles.danger}`}
                    disabled={!canClear}
                    onClick={onClear}
                >
                    <b>Clear this board</b>
                    <span>
                        {ended
                            ? 'An archived week is frozen. Reopen it first, or delete it from the Archive tab.'
                            : 'Throw the whole week away without archiving it. Nothing is kept.'}
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

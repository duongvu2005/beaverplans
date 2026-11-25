import { Dialog } from '@/components/shared/Dialog';
import shell from '@/components/shared/dialogShell.module.css';
import styles from '@/components/shared/sheetShell.module.css';
import { useCopy } from '@/i18n/localeContext';

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

/** The narrow-screen home for the two actions that change a week as a whole. */
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
    const { common, weekActionsSheet } = useCopy();
    const titleId = 'week-actions-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{weekActionsSheet.eyebrow}</div>
                <h3 id={titleId} className={shell.title}>
                    {weekLabel}
                </h3>
            </div>
            <div className={styles.items}>
                <button type="button" className={styles.item} disabled={!canMove} onClick={onMove}>
                    <b>{weekActionsSheet.move}</b>
                    <span>{weekActionsSheet.moveNote}</span>
                </button>
                {ended ? (
                    <button type="button" className={styles.item} onClick={onReopen}>
                        <b>{weekActionsSheet.reopen}</b>
                        <span>{weekActionsSheet.reopenNote}</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        className={styles.item}
                        disabled={!canEnd}
                        onClick={onEnd}
                    >
                        <b>{weekActionsSheet.end}</b>
                        <span>{weekActionsSheet.endNote}</span>
                    </button>
                )}
                {/* Last, in the danger tone: unlike End week it keeps no record. */}
                <button
                    type="button"
                    className={`${styles.item} ${styles.danger}`}
                    disabled={!canClear}
                    onClick={onClear}
                >
                    <b>{weekActionsSheet.clear}</b>
                    <span>
                        {ended ? weekActionsSheet.clearNoteEnded : weekActionsSheet.clearNote}
                    </span>
                </button>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {common.cancel}
                </button>
            </div>
        </Dialog>
    );
}

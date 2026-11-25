import { Dialog } from '@/components/shared/Dialog';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from '@/components/shared/sheetShell.module.css';

type GuestMergeSheetProps = {
    onClose: () => void;
    onMerge: () => void;
    onDiscard: () => void;
};

/** The phone's form of the guest-work prompt. */
export function GuestMergeSheet({ onClose, onMerge, onDiscard }: GuestMergeSheetProps) {
    // One block shared with GuestMergeDialog: same question, two widths.
    const { guestMerge } = useCopy();
    const titleId = 'guest-merge-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{guestMerge.eyebrow}</div>
                <h3 id={titleId} className={shell.title}>
                    {guestMerge.title}
                </h3>
            </div>
            <div className={styles.items}>
                <button type="button" className={styles.item} onClick={onMerge}>
                    <b>{guestMerge.merge}</b>
                    <span>{guestMerge.mergeNote}</span>
                </button>
                <button type="button" className={styles.item} onClick={onDiscard}>
                    <b>{guestMerge.discard}</b>
                    <span>{guestMerge.discardNote}</span>
                </button>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {guestMerge.decideLater}
                </button>
            </div>
        </Dialog>
    );
}

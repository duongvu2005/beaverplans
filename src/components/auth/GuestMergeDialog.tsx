import { Dialog } from '@/components/shared/Dialog';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './GuestMergeDialog.module.css';

type GuestMergeDialogProps = {
    onClose: () => void;
    onMerge: () => void;
    onDiscard: () => void;
};

/** The desktop's form of the guest-work prompt. */
export function GuestMergeDialog({ onClose, onMerge, onDiscard }: GuestMergeDialogProps) {
    // One block shared with GuestMergeSheet: same question, two widths.
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
            <div className={shell.body}>
                <div className={shell.field}>
                    <p className={shell.text}>{guestMerge.explain}</p>
                </div>
            </div>
            <div className={`${shell.foot} ${styles.footSpan}`}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {guestMerge.decideLater}
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.danger}`}
                    onClick={onDiscard}
                >
                    {guestMerge.discard}
                </button>
                <button type="button" className={`${shell.btn} ${shell.primary}`} onClick={onMerge}>
                    {guestMerge.merge}
                </button>
            </div>
        </Dialog>
    );
}

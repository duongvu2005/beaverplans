import type { DateKey } from '@/core/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';

type GuestReopenDialogProps = {
    /** the weeks the merge cannot land on; never empty when this is rendered */
    weeks: ReadonlyArray<DateKey>;
    onClose: () => void;
    onConfirm: () => void;
};

/** The second half of the guest-work question: raised only when merging would land on an ended week. */
export function GuestReopenDialog({ weeks, onClose, onConfirm }: GuestReopenDialogProps) {
    const { locale } = useLocale();
    const { guestMerge } = useCopy();
    const named = weeks.map((weekStart) => weekRangeLabel(weekStart, locale)).join(', ');

    return (
        <ConfirmDialog
            eyebrow={guestMerge.eyebrow}
            title={guestMerge.reopenTitle}
            onClose={onClose}
            confirmLabel={guestMerge.reopenConfirm}
            onConfirm={onConfirm}
        >
            <p className={shell.text}>{guestMerge.reopenBody(named)}</p>
            <p className={shell.text}>{guestMerge.reopenNote}</p>
        </ConfirmDialog>
    );
}

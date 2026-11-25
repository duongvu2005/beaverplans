import { useCopy } from '@/i18n/localeContext';
import { ConfirmDialog } from './ConfirmDialog';
import shell from './dialogShell.module.css';
import styles from './CopyTextDialog.module.css';

type CopyTextDialogProps = {
    eyebrow: string;
    /** the text the clipboard write was refused for */
    text: string;
    onClose: () => void;
};

/** The fallback for a refused clipboard write: the text, on screen, selected. */
export function CopyTextDialog({ eyebrow, text, onClose }: CopyTextDialogProps) {
    const { common, copyTextDialog } = useCopy();

    return (
        <ConfirmDialog
            eyebrow={eyebrow}
            title={copyTextDialog.title}
            confirmLabel={common.done}
            onConfirm={onClose}
            onClose={onClose}
        >
            <p className={shell.text}>{copyTextDialog.body}</p>
            <textarea
                className={styles.box}
                readOnly
                value={text}
                aria-label={copyTextDialog.boxLabel}
                onFocus={(e) => e.currentTarget.select()}
            />
        </ConfirmDialog>
    );
}

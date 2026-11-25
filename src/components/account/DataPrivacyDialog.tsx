import { useState } from 'react';
import { Dialog } from '@/components/shared/Dialog';
import { CopyIcon } from '@/components/shared/icons/CopyIcon';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './DataPrivacyDialog.module.css';

function DownloadIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 4v11" />
            <path d="M8 11l4 4 4-4" />
            <path d="M5 19h14" />
        </svg>
    );
}

function UploadIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 15V4" />
            <path d="M8 8l4-4 4 4" />
            <path d="M5 19h14" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 7h16" />
            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
        </svg>
    );
}

function UserOffIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="10" cy="8" r="3.4" />
            <path d="M4 20c0-3.3 2.7-5.6 6-5.6 1 0 2 .2 2.8.6" />
            <path d="M15.5 17.5h5" />
        </svg>
    );
}

type DataPrivacyDialogProps = {
    /** how many weeks are stored, so the actions can say what they would act on */
    weekCount: number;
    onClose: () => void;
    onDownload: () => void;
    /** Produces the JSON for the clipboard; called again for the fallback box, so it must return the same text. */
    exportText: () => string;
    /** opens the import screen; this dialog closes first */
    onOpenImport: () => void;
    /** hands off to the erasure confirm; this dialog closes first */
    onClearAll: () => void;
    /** hands off to the account-deletion screen; this dialog closes first */
    onDeleteAccount: () => void;
};

/** What the app holds on someone's behalf, and the two things they can do about it: copy it or delete it. */
export function DataPrivacyDialog({
    weekCount,
    onClose,
    onDownload,
    exportText,
    onOpenImport,
    onClearAll,
    onDeleteAccount,
}: DataPrivacyDialogProps) {
    const { common, dataPrivacyDialog } = useCopy();
    // 'copied' on success, 'manual' when the browser refuses the write.
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
    const titleId = 'data-privacy-title';
    const empty = weekCount === 0;

    async function handleCopy() {
        const text = exportText();
        try {
            await navigator.clipboard.writeText(text);
            setCopyState('copied');
        } catch {
            // Refused, not broken — see .fallback in the CSS.
            setCopyState('manual');
        }
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{dataPrivacyDialog.eyebrow}</div>
                <h3 id={titleId} className={shell.title}>
                    {dataPrivacyDialog.title}
                </h3>
            </div>
            <div className={styles.body}>
                <p className={styles.actionsLabel}>
                    {empty
                        ? dataPrivacyDialog.nothingStored
                        : dataPrivacyDialog.weeksStored(weekCount)}
                </p>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.action}
                        disabled={empty}
                        onClick={onDownload}
                    >
                        <DownloadIcon />
                        {dataPrivacyDialog.download}
                    </button>
                    <button
                        type="button"
                        className={styles.action}
                        disabled={empty}
                        onClick={() => void handleCopy()}
                    >
                        <CopyIcon />
                        {dataPrivacyDialog.copy}
                        {copyState === 'copied' && (
                            <span className={styles.grow}>{dataPrivacyDialog.copied}</span>
                        )}
                    </button>

                    <button type="button" className={styles.action} onClick={onOpenImport}>
                        <UploadIcon />
                        {dataPrivacyDialog.importData}
                    </button>
                    <div className={styles.destructive}>
                        <p className={styles.dangerLabel}>{dataPrivacyDialog.dangerZone}</p>
                        <button
                            type="button"
                            className={`${styles.action} ${styles.danger}`}
                            disabled={empty}
                            onClick={onClearAll}
                        >
                            <TrashIcon />
                            {dataPrivacyDialog.deleteData}
                        </button>
                        {/* Never disabled. */}
                        <button
                            type="button"
                            className={`${styles.action} ${styles.danger}`}
                            onClick={onDeleteAccount}
                        >
                            <UserOffIcon />
                            {dataPrivacyDialog.deleteAccount}
                        </button>
                    </div>
                </div>

                {copyState === 'manual' && (
                    <div className={styles.fallback}>
                        <p className={styles.fallbackNote}>{dataPrivacyDialog.manualNote}</p>
                        <textarea
                            className={styles.fallbackBox}
                            readOnly
                            value={exportText()}
                            aria-label={dataPrivacyDialog.manualBoxLabel}
                            onFocus={(e) => e.currentTarget.select()}
                        />
                    </div>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {common.back}
                </button>
            </div>
        </Dialog>
    );
}

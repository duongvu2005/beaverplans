import { useState } from 'react';
import { Dialog } from '@/components/shared/Dialog';
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

function ClipboardIcon() {
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
            <rect x="8" y="4" width="12" height="16" rx="2" />
            <path d="M16 4V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1" />
            <path d="M8 8H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3" />
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

type DataPrivacyDialogProps = {
    /** the signed-in address, named in the notes so "your account" is concrete */
    email: string | undefined;
    /** how many weeks are stored, so the actions can say what they would act on */
    weekCount: number;
    onClose: () => void;
    onDownload: () => void;
    /**
     * Produces the JSON to put on the clipboard. Returned rather than written
     * here so this component owns no serializing — and so the fallback below has
     * the same text to show when the write is refused.
     */
    exportText: () => string;
    /** hands off to the erasure confirm; this dialog closes first */
    onClearAll: () => void;
};

/**
 * What the app is holding on someone's behalf, and the two things they are
 * entitled to do about it: take a copy, or have it deleted.
 *
 * This is deliberately one surface rather than loose rows in the account menu.
 * Export and delete are not utilities — they only mean anything BECAUSE the data
 * sits on a server this app controls, and that fact is the thing worth stating
 * before either button is offered. So the notes come first and the actions read
 * as consequences of them.
 *
 * Signed-in only, for the same reason: a guest's weeks never leave their own
 * browser, so there is no custodian to demand a copy from and nothing on a
 * server to erase. Offering a "your data" panel to someone whose data nobody
 * else has would imply a relationship that does not exist.
 *
 * One component for both form factors, unlike AccountMenu/AccountSheet: those
 * two differ in CONTENT, whereas this differs only in shape, and Dialog already
 * renders as a bottom sheet on a phone and a centered modal on a desktop.
 */
export function DataPrivacyDialog({
    email,
    weekCount,
    onClose,
    onDownload,
    exportText,
    onClearAll,
}: DataPrivacyDialogProps) {
    // 'idle' -> 'copied' on success, -> 'manual' when the browser refuses the
    // write. Three states rather than a boolean because a refusal is not the
    // absence of success: it needs its own visible outcome, not a button that
    // looks like nothing happened.
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
                <div className={shell.eyebrow}>Data &amp; privacy</div>
                <h3 id={titleId} className={shell.title}>
                    Your data
                </h3>
            </div>
            <div className={styles.body}>
                <div className={styles.notes}>
                    <p className={styles.note}>
                        Your plan is stored on this app&rsquo;s server under your account
                        {email === undefined ? '' : ` (${email})`}, so your weeks are available on
                        every device you sign in on.
                    </p>
                    <p className={styles.note}>
                        We store what you put into your plan — week dates, project and task names,
                        scheduled days, and what you&rsquo;ve ticked off. No tracking. No analytics.
                    </p>
                    <p className={styles.note}>
                        This browser also keeps a local copy so beaverplans opens instantly and
                        works offline. Signing out clears the local copy; your server data stays
                        intact.
                    </p>
                </div>

                <p className={styles.actionsLabel}>
                    {empty
                        ? 'Nothing stored yet'
                        : `${weekCount} week${weekCount === 1 ? '' : 's'} stored`}
                </p>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.action}
                        disabled={empty}
                        onClick={onDownload}
                    >
                        <DownloadIcon />
                        Download as JSON
                    </button>
                    <button
                        type="button"
                        className={styles.action}
                        disabled={empty}
                        onClick={() => void handleCopy()}
                    >
                        <ClipboardIcon />
                        Copy as JSON
                        {copyState === 'copied' && <span className={styles.grow}>Copied</span>}
                    </button>

                    <div className={styles.destructive}>
                        <p className={styles.dangerLabel}>Danger zone</p>
                        <button
                            type="button"
                            className={`${styles.action} ${styles.danger}`}
                            disabled={empty}
                            onClick={onClearAll}
                        >
                            <TrashIcon />
                            Delete all my data
                        </button>
                    </div>
                </div>

                {copyState === 'manual' && (
                    <div className={styles.fallback}>
                        <p className={styles.fallbackNote}>
                            This browser would not let the app write to your clipboard. Select the
                            text below and copy it yourself.
                        </p>
                        <textarea
                            className={styles.fallbackBox}
                            readOnly
                            value={exportText()}
                            aria-label="Your data as JSON"
                            onFocus={(e) => e.currentTarget.select()}
                        />
                    </div>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Close
                </button>
            </div>
        </Dialog>
    );
}

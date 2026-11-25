import { useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LIMITS } from '@/core/limits';
import type { Weeks } from '@/core/types';
import { useCopy } from '@/i18n/localeContext';
import { parseWeeks, type ImportFailure, type ImportResult } from '@/storage/importData';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './ImportDataDialog.module.css';

type ImportDataDialogProps = {
    onClose: () => void;
    /** hands the read weeks to the replace confirm; this dialog closes first */
    onImport: (weeks: Weeks) => void;
};

/** Getting a backup back INTO the app, from a file or from the clipboard. */
export function ImportDataDialog({ onClose, onImport }: ImportDataDialogProps) {
    const { common, importDataDialog } = useCopy();
    const reasons: Record<Exclude<ImportFailure, 'too-big'>, string> = importDataDialog.reasons;
    const [text, setText] = useState('');
    // A chosen file that could not be read at all: nothing to put in the box.
    const [unreadable, setUnreadable] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const boxId = useId();

    const result: ImportResult | null = unreadable
        ? { ok: false, reason: 'not-json' }
        : text.trim() === ''
          ? null
          : parseWeeks(text);

    function enter(next: string) {
        setUnreadable(false);
        setText(next);
    }

    async function loadFile(file: File | undefined) {
        if (file === undefined) return;
        try {
            enter(await file.text());
        } catch {
            setText('');
            setUnreadable(true);
        }
    }

    return (
        <ConfirmDialog
            title={importDataDialog.title}
            cancelLabel={common.back}
            onClose={onClose}
            actions={[
                {
                    label: importDataDialog.continueLabel,
                    onAction: () => {
                        if (result?.ok === true) onImport(result.weeks);
                    },
                    disabled: result?.ok !== true,
                },
            ]}
        >
            <div className={styles.route}>
                <span className={shell.label}>{importDataDialog.boxLabel}</span>
                <button
                    type="button"
                    className={styles.pick}
                    onClick={() => fileRef.current?.click()}
                >
                    {importDataDialog.chooseFile}
                </button>
            </div>
            <div className={styles.or}>{importDataDialog.or}</div>
            <div className={styles.route}>
                <label className={shell.label} htmlFor={boxId}>
                    {importDataDialog.placeholder}
                </label>
                <textarea
                    id={boxId}
                    className={styles.box}
                    value={text}
                    spellCheck={false}
                    onChange={(event) => enter(event.target.value)}
                />
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Reset so choosing the same file twice still fires.
                    event.target.value = '';
                    void loadFile(file);
                }}
            />
            {result !== null && !result.ok && (
                <p className={styles.bad} role="alert">
                    {result.reason === 'too-big'
                        ? importDataDialog.tooBig(
                              result.shape.projects,
                              result.shape.maxTasks,
                              result.shape.maxSubtasks,
                              LIMITS.projectsPerWeek,
                              LIMITS.tasksPerProject,
                              LIMITS.subtasksPerTask,
                          )
                        : reasons[result.reason]}
                </p>
            )}
            {result?.ok === true && (
                <p className={styles.good} role="status">
                    {importDataDialog.found(result.weeks.length)}
                </p>
            )}
        </ConfirmDialog>
    );
}

import { useState } from 'react';
import type { Project } from '@/core/types';
import { weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { LIMITS } from '@/core/limits';
import { parseProjects, type PasteFailure } from '@/storage/weekClipboard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import shell from '@/components/shared/dialogShell.module.css';
import check from '@/components/shared/checkbox.module.css';
import styles from './PastePlanDialog.module.css';

type PastePlanDialogProps = {
    /** how many more projects this week can take, so the dialog can refuse early */
    room: number;
    onClose: () => void;
    /** the caller mints ids and clears progress; this hands over what was read */
    onPaste: (projects: ReadonlyArray<Project>, keepProgress: boolean) => void;
};

/** Reads a copied plan off a pasted blob of text and puts its projects on the week you are looking at. */
export function PastePlanDialog({ room, onClose, onPaste }: PastePlanDialogProps) {
    const { locale } = useLocale();
    const { pastePlanDialog, projectView } = useCopy();
    // Annotated, so a new PasteFailure is a build error here; 'too-big' is excluded because it takes numbers.
    const reasons: Record<Exclude<PasteFailure, 'too-big'>, string> = pastePlanDialog.reasons;
    const [text, setText] = useState('');
    const [keepProgress, setKeepProgress] = useState(false);

    const result = text.trim() === '' ? null : parseProjects(text);
    const found = result?.ok === true ? result : null;
    const failure = result?.ok === false ? result : null;
    const tooMany = found !== null && found.projects.length > room;

    const taskCount =
        found === null ? 0 : found.projects.reduce((sum, project) => sum + project.tasks.length, 0);

    return (
        <ConfirmDialog
            // opened from ProjectView, so it wears that surface's eyebrow
            eyebrow={projectView.eyebrow}
            title={pastePlanDialog.title}
            onClose={onClose}
            actions={[
                {
                    label: pastePlanDialog.add,
                    onAction: () => found !== null && onPaste(found.projects, keepProgress),
                    disabled: found === null || tooMany,
                },
            ]}
        >
            <p className={shell.text}>{pastePlanDialog.intro}</p>
            <textarea
                className={styles.box}
                value={text}
                autoFocus
                placeholder={pastePlanDialog.placeholder}
                aria-label={pastePlanDialog.boxLabel}
                onChange={(e) => setText(e.target.value)}
            />

            {failure !== null && (
                <p className={styles.bad}>
                    {failure.reason === 'too-big'
                        ? pastePlanDialog.tooBig(
                              failure.shape.projects,
                              failure.shape.maxTasks,
                              failure.shape.maxSubtasks,
                              LIMITS.projectsPerWeek,
                              LIMITS.tasksPerProject,
                              LIMITS.subtasksPerTask,
                          )
                        : reasons[failure.reason]}
                </p>
            )}

            {found !== null && (
                <>
                    <p className={tooMany ? styles.bad : styles.good}>
                        {tooMany
                            ? pastePlanDialog.tooMany(
                                  found.projects.length,
                                  room,
                                  LIMITS.projectsPerWeek,
                              )
                            : pastePlanDialog.found(
                                  found.projects.length,
                                  taskCount,
                                  weekRangeLabel(found.weekStart, locale),
                              )}
                    </p>
                    {/* Off by default. */}
                    <label className={styles.keep}>
                        <input
                            type="checkbox"
                            className={check.box}
                            checked={keepProgress}
                            onChange={() => setKeepProgress((on) => !on)}
                        />
                        <span>
                            {pastePlanDialog.keepProgress}
                            <span className={styles.hint}>{pastePlanDialog.keepHint}</span>
                        </span>
                    </label>
                </>
            )}
        </ConfirmDialog>
    );
}

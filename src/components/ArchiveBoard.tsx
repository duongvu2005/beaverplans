import { useState } from 'react';
import type { DateKey, Project, WeekPlan, Weeks } from '../core/types';
import { removeWeek } from '../core/weeks';
import { weekRangeLabel } from '../core/dates';
import { ArchiveRow } from './ArchiveRow';
import { ArchiveQuickLook } from './ArchiveQuickLook';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyWeekDialog } from './CopyWeekDialog';
import shell from './dialogShell.module.css';
import styles from './ArchiveBoard.module.css';

// A week files under the year of its Monday, so one straddling New Year
// (Dec 28 2026 – Jan 03 2027) sits under 2026 — the year its own label leads with.
function yearOf(weekStart: DateKey): string {
    return weekStart.slice(0, 4);
}

type ArchiveBoardProps = {
    archive: Weeks;
    onChange: (updater: (current: Weeks) => Weeks) => void;
};

export function ArchiveBoard({ archive, onChange }: ArchiveBoardProps) {
    const [opened, setOpened] = useState<WeekPlan | null>(null);
    const [copying, setCopying] = useState<WeekPlan | null>(null);
    const [removing, setRemoving] = useState<WeekPlan | null>(null);
    const [clearingAll, setClearingAll] = useState(false);

    // Every year gets a heading, not only the ones after a change: labels carry
    // no year of their own, so an unlabelled first group would be undated.
    // archive is already sorted ascending (Weeks' rep invariant), so newest-first
    // display is a plain reverse, not a sort.
    const sorted = [...archive].reverse();
    const rows = sorted.map((entry, i) => {
        const year = yearOf(entry.weekStart);
        const previous = sorted[i - 1];
        return {
            entry,
            year,
            startsYear: previous === undefined || yearOf(previous.weekStart) !== year,
        };
    });

    function handleConfirmDelete() {
        if (!removing) return;
        const { weekStart } = removing;
        onChange((current) => removeWeek(current, weekStart));
        setRemoving(null);
    }

    function handleConfirmClearAll() {
        onChange(() => []);
        setClearingAll(false);
    }

    // The picker and its selection are real; the payload is not yet. Serializing
    // a project tree to text is its own design (day 26's copy/paste pair), so
    // until that exists this writes an empty string — swap the one line below
    // for the serializer and the rest of the flow is already wired.
    function handleCopy(projects: ReadonlyArray<Project>) {
        void projects;
        navigator.clipboard?.writeText('').catch(() => {});
        setCopying(null);
    }

    if (archive.length === 0) {
        return (
            <div className={styles.board}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>No archived weeks yet</p>
                    <p className={styles.emptyText}>
                        Ending a week on the Plan tab records it here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.board}>
            <div className={styles.head}>
                <span className={styles.count}>
                    {archive.length} week{archive.length === 1 ? '' : 's'}
                </span>
                <button
                    type="button"
                    className={styles.clearAll}
                    onClick={() => setClearingAll(true)}
                >
                    <span className={styles.clearIcon} aria-hidden="true">
                        ×
                    </span>
                    Clear all
                </button>
            </div>
            <div className={styles.list}>
                {rows.map(({ entry, year, startsYear }) => (
                    <div key={entry.weekStart} className={styles.group}>
                        {startsYear && <h3 className={styles.year}>{year}</h3>}
                        <ArchiveRow
                            entry={entry}
                            label={weekRangeLabel(entry.weekStart)}
                            onOpen={() => setOpened(entry)}
                            onCopy={() => setCopying(entry)}
                            onDelete={() => setRemoving(entry)}
                        />
                    </div>
                ))}
            </div>
            {opened && (
                <ArchiveQuickLook
                    entry={opened}
                    label={weekRangeLabel(opened.weekStart)}
                    onClose={() => setOpened(null)}
                    // Edit hands off to the editable WeekBoard; that flow is
                    // still being designed, so the button is inert for now.
                    onEdit={() => {}}
                />
            )}
            {copying && (
                <CopyWeekDialog
                    entry={copying}
                    label={weekRangeLabel(copying.weekStart)}
                    onClose={() => setCopying(null)}
                    onCopy={handleCopy}
                />
            )}
            {removing && (
                <ConfirmDialog
                    eyebrow="Archive"
                    title={`Delete ${weekRangeLabel(removing.weekStart)}?`}
                    confirmLabel="Delete"
                    confirmTone="danger"
                    onConfirm={handleConfirmDelete}
                    onClose={() => setRemoving(null)}
                >
                    <p className={shell.text}>
                        This permanently deletes the archived week. Your stats are calculated from
                        the archive, so they will change to match.
                    </p>
                </ConfirmDialog>
            )}
            {clearingAll && (
                <ConfirmDialog
                    eyebrow="Archive"
                    title="Delete every archived week?"
                    confirmLabel="Delete all"
                    confirmTone="danger"
                    onConfirm={handleConfirmClearAll}
                    onClose={() => setClearingAll(false)}
                >
                    <p className={shell.text}>
                        This permanently deletes all {archive.length} archived week
                        {archive.length === 1 ? '' : 's'}, emptying your stats along with them.
                    </p>
                </ConfirmDialog>
            )}
        </div>
    );
}

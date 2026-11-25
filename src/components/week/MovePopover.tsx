import { useState } from 'react';
import { Dialog } from '@/components/shared/Dialog';
import { dayStatusOf } from '@/core/dates';
import { canMoveSubtaskTo } from '@/core/projects';
import { WEEK } from '@/core/types';
import type { DateKey, DayOfWeek, Subtask } from '@/core/types';
import check from '@/components/shared/checkbox.module.css';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './moveUi.module.css';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';

type MovePopoverProps = {
    subtask: Subtask;
    taskName: string;
    projectName: string;
    weekStart: DateKey;
    today: DateKey;
    onMove: (toDay: DayOfWeek, markMissed: boolean) => void;
    onClose: () => void;
};

export function MovePopover({
    subtask,
    taskName,
    projectName,
    weekStart,
    today,
    onMove,
    onClose,
}: MovePopoverProps) {
    const { locale } = useLocale();
    const { common, movePopover } = useCopy();
    // pick-then-confirm: selecting a day only stages it; Move applies it
    const [picked, setPicked] = useState<DayOfWeek | null>(null);
    const [markMissed, setMarkMissed] = useState(true);
    const titleId = 'move-title';

    const assignedIndex = WEEK.indexOf(subtask.assignedDay);
    const fromPast = dayStatusOf(subtask.assignedDay, weekStart, today) === 'past';

    function confirm() {
        if (!picked) return;
        // addMissedDay needs the missed day to precede the new assigned day, so only
        // record it when the move actually goes forward of the day being vacated
        const willMark = markMissed && fromPast && WEEK.indexOf(picked) > assignedIndex;
        onMove(picked, willMark);
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{projectName || common.projectFallback}</div>
                <h3 id={titleId} className={shell.title}>
                    {taskName || common.taskFallback}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <div className={shell.label}>{movePopover.moveTo}</div>
                    <div className={styles.rail} role="group" aria-label={movePopover.railLabel}>
                        {WEEK.map((day) => {
                            const isCurrent = day === subtask.assignedDay;
                            // forward-only: not the current day, not on/before any missed
                            // day, and (in the live week) never into the past
                            const disabled =
                                isCurrent ||
                                !canMoveSubtaskTo(subtask, day) ||
                                dayStatusOf(day, weekStart, today) === 'past';
                            const cls = [
                                styles.pill,
                                isCurrent && styles.cur,
                                picked === day && styles.picked,
                            ]
                                .filter(Boolean)
                                .join(' ');
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={cls}
                                    disabled={disabled}
                                    aria-pressed={picked === day}
                                    title={isCurrent ? movePopover.currentDay : undefined}
                                    onClick={() => setPicked(day)}
                                >
                                    {dayName(day, locale, 'short')}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {fromPast && (
                    <label className={styles.miss}>
                        <input
                            type="checkbox"
                            className={`${check.box} ${styles.missBox}`}
                            checked={markMissed}
                            onChange={(e) => setMarkMissed(e.target.checked)}
                        />
                        <span>
                            {movePopover.markMissed(dayName(subtask.assignedDay, locale, 'short'))}
                        </span>
                    </label>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {common.cancel}
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary}`}
                    disabled={!picked}
                    onClick={confirm}
                >
                    {movePopover.move}
                </button>
            </div>
        </Dialog>
    );
}

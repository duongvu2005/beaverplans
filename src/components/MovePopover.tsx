import { useState } from 'react';
import { Dialog } from './Dialog';
import { dayStatusOf } from '../core/dates';
import { WEEK } from '../core/types';
import type { DateKey, DayOfWeek, Subtask } from '../core/types';
import check from './checkbox.module.css';
import shell from './dialogShell.module.css';
import styles from './moveUi.module.css';

const SHORT: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
};

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
    // pick-then-confirm: selecting a day only stages it; Move applies it
    const [picked, setPicked] = useState<DayOfWeek | null>(null);
    const [markMissed, setMarkMissed] = useState(true);
    const titleId = 'move-title';

    const assignedIndex = WEEK.indexOf(subtask.assignedDay);
    const latestMissedIndex = subtask.missedDays.reduce(
        (max, d) => Math.max(max, WEEK.indexOf(d)),
        -1,
    );
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
                <div className={shell.eyebrow}>{projectName || 'Project'}</div>
                <h3 id={titleId} className={shell.title}>
                    {taskName || 'Task'}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <div className={shell.label}>Move to</div>
                    <div className={styles.rail} role="group" aria-label="Move to which day">
                        {WEEK.map((day) => {
                            const idx = WEEK.indexOf(day);
                            const isCurrent = day === subtask.assignedDay;
                            // forward-only: not the current day, not on/before any missed
                            // day, and (in the live week) never into the past
                            const disabled =
                                isCurrent ||
                                idx <= latestMissedIndex ||
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
                                    title={isCurrent ? 'Currently on this day' : undefined}
                                    onClick={() => setPicked(day)}
                                >
                                    {SHORT[day]}
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
                        <span>Mark {SHORT[subtask.assignedDay]} as missed</span>
                    </label>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary}`}
                    disabled={!picked}
                    onClick={confirm}
                >
                    Move
                </button>
            </div>
        </Dialog>
    );
}

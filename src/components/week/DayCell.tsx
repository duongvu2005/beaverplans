import type { DayEntry } from '@/core/daySchedule';
import type { DateKey, DayOfWeek } from '@/core/types';
import { dayStatusOf, weekStatusOf } from '@/core/dates';
import { MoveIcon } from '@/components/shared/icons/MoveIcon';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import check from '@/components/shared/checkbox.module.css';
import styles from './DayCell.module.css';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';

type DayCellProps = {
    entry: DayEntry;
    day: DayOfWeek; // the weekday this cell is rendered under
    isMissed: boolean;
    weekStart: DateKey;
    today: DateKey;
    /** whether this week has been ended, and so is a frozen record */
    ended: boolean;
    compact?: boolean;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function DayCell({
    entry,
    day,
    isMissed,
    weekStart,
    today,
    ended,
    compact = false,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: DayCellProps) {
    const { locale } = useLocale();
    const { dayCell } = useCopy();
    const { subtask, taskName, projectName } = entry;
    // Two reasons a cell reads as missed: moved off this day (RECORDED in missedDays), or the week closed with it not done (not recorded: that would double-count).
    const showsMissed = isMissed || (ended && !subtask.isDone);
    // overdue = a live cell on a past day, not done, on a week still open. An
    // ended week is settled, so there is nothing left to reschedule.
    const isOverdue =
        !showsMissed &&
        !subtask.isDone &&
        weekStatusOf(weekStart, today) === 'current' &&
        dayStatusOf(subtask.assignedDay, weekStart, today) === 'past';
    const cellClass = [
        styles.cell,
        compact && styles.compact,
        subtask.isDone && !isMissed && styles.done,
        showsMissed && styles.missed,
        isOverdue && styles.overdue,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <li className={cellClass}>
            <input
                type="checkbox"
                className={showsMissed ? `${check.box} ${styles.missedCheck}` : check.box}
                checked={subtask.isDone && !isMissed}
                disabled={isMissed || ended}
                // The task name is a sibling div, not a label: nothing here can
                // wrap the checkbox without swallowing the action buttons too.
                aria-label={taskName}
                onChange={() => onToggleSubtask(subtask.id)}
            />
            {/* A mouse convenience, not the control itself: a button may not nest. */}
            <div className={styles.text} onClick={() => onEditSubtask(subtask.id)}>
                <div className={styles.eyebrow}>
                    <span className={styles.project}>{projectName}</span>
                    <span className={styles.weight} aria-label={dayCell.weightOf(subtask.weight)}>
                        {[1, 2, 3].map((n) => (
                            <span
                                key={n}
                                className={
                                    n <= subtask.weight ? `${styles.pip} ${styles.on}` : styles.pip
                                }
                            />
                        ))}
                    </span>
                </div>
                <button
                    type="button"
                    className={styles.task}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditSubtask(subtask.id);
                    }}
                >
                    {taskName}
                </button>
                {subtask.description && <span className={styles.desc}>{subtask.description}</span>}

                {showsMissed ? (
                    <div className={styles.tagRow}>
                        <span className={`${styles.cellTag} ${styles.missTag}`}>
                            {dayCell.missed}
                            {!compact &&
                                isMissed &&
                                dayCell.nowOn(dayName(subtask.assignedDay, locale, 'short'))}
                        </span>
                        {isMissed && (
                            <button
                                type="button"
                                className={compact ? styles.clearBtn : styles.clearPill}
                                aria-label={dayCell.clearMissedLabel}
                                title={dayCell.clearMissedTitle}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClearMissed(subtask.id, day);
                                }}
                            >
                                <CloseIcon />
                                {!compact && <span>{dayCell.clear}</span>}
                            </button>
                        )}
                    </div>
                ) : isOverdue ? (
                    <div className={styles.tagRow}>
                        <span className={`${styles.cellTag} ${styles.overdueTag}`}>
                            {dayCell.overdue}
                            {!compact && dayCell.reschedule}
                        </span>
                        <button
                            type="button"
                            className={compact ? styles.moveBtn : styles.movePill}
                            aria-label={dayCell.move}
                            title={dayCell.move}
                            onClick={(e) => {
                                e.stopPropagation();
                                onRequestMove(subtask.id);
                            }}
                        >
                            <MoveIcon />
                            {!compact && <span>{dayCell.moveShort}</span>}
                        </button>
                    </div>
                ) : null}
            </div>
        </li>
    );
}

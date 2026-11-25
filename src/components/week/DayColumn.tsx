import type { DateKey, DayOfWeek } from '@/core/types';
import type { DayDue, DaySchedule } from '@/core/daySchedule';
import type { DayProgress } from '@/core/progress';
import { DayCell } from './DayCell';
import { PointsStat } from '@/components/shared/PointsStat';
import { FlagIcon } from '@/components/shared/icons/FlagIcon';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import styles from './DayColumn.module.css';

type DayColumnProps = {
    daySchedule: DaySchedule;
    progress: DayProgress | undefined;
    /** what falls due on this day; empty when nothing does */
    due: DayDue['entries'];
    weekStart: DateKey;
    today: DateKey;
    /** whether this week has been ended, and so is a frozen record */
    ended: boolean;
    /** whether this week's board is frozen to edits (ended, or behind the archive bound) */
    readOnly?: boolean;
    onFocusDay: (day: DayOfWeek) => void;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function DayColumn({
    daySchedule,
    progress,
    due,
    weekStart,
    today,
    ended,
    readOnly = false,
    onFocusDay,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: DayColumnProps) {
    const { locale } = useLocale();
    const { common, dayColumn } = useCopy();
    return (
        <section className={styles.column}>
            <button
                type="button"
                className={styles.day}
                onClick={() => onFocusDay(daySchedule.day)}
                title={dayColumn.focusDay}
            >
                <span className={styles.dayLabel}>
                    <span className={styles.dayName}>
                        {dayName(daySchedule.day, locale, 'short')}
                    </span>
                    {due.length > 0 && (
                        <span
                            className={styles.due}
                            role="img"
                            aria-label={common.dueCount(due.length)}
                            title={dayColumn.dueList(due.map((entry) => entry.name).join(', '))}
                        >
                            <FlagIcon className={styles.flag} />
                            {due.length}
                        </span>
                    )}
                </span>
                <PointsStat done={progress?.done ?? 0} total={progress?.assigned ?? 0} />
            </button>
            {/* inert on the list only, not the day button above: choosing which
                day to look at is navigation, and survives the freeze. */}
            <ul className={styles.list} inert={readOnly}>
                {daySchedule.items.map((entry) => (
                    <DayCell
                        key={entry.subtask.id}
                        entry={entry}
                        day={daySchedule.day}
                        isMissed={daySchedule.day !== entry.subtask.assignedDay}
                        weekStart={weekStart}
                        today={today}
                        ended={ended}
                        compact={true}
                        onToggleSubtask={onToggleSubtask}
                        onEditSubtask={onEditSubtask}
                        onRequestMove={onRequestMove}
                        onClearMissed={onClearMissed}
                    />
                ))}
            </ul>
        </section>
    );
}

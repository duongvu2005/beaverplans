import type { DayDue, DayEntry } from '@/core/daySchedule';
import type { DateKey, DayOfWeek } from '@/core/types';
import { DayCell } from './DayCell';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import styles from './FocusedDay.module.css';

type FocusedDayProps = {
    day: DayOfWeek;
    items: ReadonlyArray<DayEntry>;
    /** what falls due on this day — not the same list as items */
    due: DayDue['entries'];
    isToday: boolean;
    weekStart: DateKey;
    today: DateKey;
    /** whether this week has been ended, and so is a frozen record */
    ended: boolean;
    /** whether this week's board is frozen to edits (ended, or behind the archive bound) */
    readOnly?: boolean;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function FocusedDay({
    day,
    items,
    due,
    isToday,
    weekStart,
    today,
    ended,
    readOnly = false,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: FocusedDayProps) {
    const { locale } = useLocale();
    const { focusedDay } = useCopy();
    const assigned = items.filter((entry) => entry.subtask.assignedDay === day);
    const doneCount = assigned.filter((entry) => entry.subtask.isDone).length;
    return (
        <div className={styles.card}>
            <p className={styles.head}>
                {dayName(day, locale, 'long')}
                {isToday ? focusedDay.today : ''}
            </p>
            <p className={styles.count}>
                {items.length === 0
                    ? focusedDay.nothingScheduled
                    : focusedDay.doneOf(doneCount, assigned.length)}
            </p>
            {/* Due today: not the same list as what is scheduled. */}
            {due.length > 0 && (
                <p className={styles.due}>{focusedDay.due(due.map((e) => e.name).join(', '))}</p>
            )}
            {items.length === 0 ? (
                <p className={styles.empty}>{focusedDay.empty}</p>
            ) : (
                <ul className={styles.list} inert={readOnly}>
                    {items.map((entry) => (
                        <DayCell
                            key={entry.subtask.id}
                            entry={entry}
                            day={day}
                            isMissed={entry.subtask.assignedDay !== day}
                            weekStart={weekStart}
                            today={today}
                            ended={ended}
                            onToggleSubtask={onToggleSubtask}
                            onEditSubtask={onEditSubtask}
                            onRequestMove={onRequestMove}
                            onClearMissed={onClearMissed}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

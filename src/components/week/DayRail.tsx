import type { DayOfWeek } from '@/core/types';
import type { DayProgress } from '@/core/progress';
import type { DayDue } from '@/core/daySchedule';
import styles from './DayRail.module.css';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { FlagIcon } from '@/components/shared/icons/FlagIcon';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';

/** Which reading each pill carries: how much of the day is done, or how much is on it. */
export type RailMode = 'progress' | 'count';

type DayRailProps = {
    byDay: ReadonlyArray<DayProgress>;
    /** what falls due on each day, in the same Mon→Sun order as byDay */
    due: ReadonlyArray<DayDue>;
    selectedDay: DayOfWeek;
    todayDay: DayOfWeek | undefined;
    mode: RailMode;
    onSelectDay: (day: DayOfWeek) => void;
    onBackToGrid: () => void;
};

export function DayRail({
    byDay,
    due,
    selectedDay,
    todayDay,
    mode,
    onSelectDay,
    onBackToGrid,
}: DayRailProps) {
    const { locale } = useLocale();
    const { common, weekView } = useCopy();
    return (
        <div className={styles.rail}>
            {byDay.map(({ day, assigned, done }) => {
                const dueHere = due.find((d) => d.day === day)?.entries ?? [];
                const classes = [
                    styles.pill,
                    day === todayDay && styles.today,
                    day === selectedDay && styles.selected,
                ]
                    .filter(Boolean)
                    .join(' ');
                return (
                    <button
                        key={day}
                        type="button"
                        className={classes}
                        aria-pressed={day === selectedDay}
                        onClick={() => (day === selectedDay ? onBackToGrid() : onSelectDay(day))}
                    >
                        <span className={styles.head}>
                            <span className={styles.letter}>{dayName(day, locale, 'letter')}</span>
                            {dueHere.length > 0 && (
                                // role="img" so the aria-label is exposed; the svg itself is aria-hidden.
                                <span role="img" aria-label={common.dueCount(dueHere.length)}>
                                    <FlagIcon className={styles.flag} />
                                </span>
                            )}
                        </span>
                        <span className={styles.slot}>
                            {mode === 'count' ? (
                                assigned > 0 && (
                                    <span
                                        className={styles.count}
                                        role="img"
                                        aria-label={weekView.taskCount(assigned)}
                                    >
                                        {assigned}
                                    </span>
                                )
                            ) : (
                                <ProgressBar done={done} total={assigned} className={styles.bar} />
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

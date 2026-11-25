import { useState } from 'react';
import type { DateKey, WeekPlan, Weeks } from '@/core/types';
import { overallProgress, progressByDay } from '@/core/progress';
import { addWeeks, weeksBetween } from '@/core/dates';
import { weekAt, weekStandingOf } from '@/core/weeks';
import { WeekSpark } from '@/components/shared/WeekSpark';
import type { SparkColumn } from '@/components/shared/sparkColumns';
import { ChevronIcon } from '@/components/shared/icons/ChevronIcon';
import { weekRangeLabel, weekSpanLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { WeekRow } from './WeekRow';
import styles from './WeekRow.module.css';
import listStyles from './WeekList.module.css';

// Below this many weeks a column is a DAY rather than a week.
const DAYS_UP_TO_WEEKS = 6;

// How many week-bars the chart will draw. The row's range, count and total still
// describe every week in the group.
const MAX_WEEK_COLUMNS = 20;

// One column per DAY across the span. The label is the Monday's date, blank in
// between; the key carries the week, since seven weekday keys cannot repeat.
function dayColumns(weeks: Weeks, from: DateKey, to: DateKey): ReadonlyArray<SparkColumn> {
    const columns: SparkColumn[] = [];
    for (let weekStart = from; weekStart <= to; weekStart = addWeeks(weekStart, 1)) {
        const days = progressByDay(weekAt(weeks, weekStart).projects);
        for (const [index, day] of days.entries()) {
            columns.push({
                key: `${weekStart}-${day.day}`,
                label: index === 0 ? weekStart.slice(8, 10) : '',
                assigned: day.assigned,
                done: day.done,
                unlived: true,
            });
        }
    }
    return columns;
}

// One column per week across the span, not per stored week. Stops at MAX_WEEK_COLUMNS.
function weekColumns(weeks: Weeks, from: DateKey, to: DateKey): ReadonlyArray<SparkColumn> {
    const columns: SparkColumn[] = [];
    for (
        let weekStart = from;
        weekStart <= to && columns.length < MAX_WEEK_COLUMNS;
        weekStart = addWeeks(weekStart, 1)
    ) {
        const { done, total } = overallProgress(weekAt(weeks, weekStart).projects);
        columns.push({
            key: weekStart,
            label: weekStart.slice(8, 10),
            assigned: total,
            done,
            unlived: true,
        });
    }
    return columns;
}

type UpcomingWeeksProps = {
    /** the upcoming weeks, ascending. Two or more — one week shows as itself. */
    weeks: Weeks;
    today: DateKey;
    onOpen: (entry: WeekPlan) => void;
    onCopy: (entry: WeekPlan) => void;
    onDelete: (entry: WeekPlan) => void;
};

/** Every week still to come, as one row that opens, drawn to MAX_WEEK_COLUMNS. */
export function UpcomingWeeks({ weeks, today, onOpen, onCopy, onDelete }: UpcomingWeeksProps) {
    const { locale } = useLocale();
    const { weekList, weekRow } = useCopy();
    const [open, setOpen] = useState(false);

    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    if (first === undefined || last === undefined) return null;

    // The unit follows the SPAN, not the number of stored weeks: gaps are drawn,
    // so the span is what decides how many columns there are.
    const spanWeeks = weeksBetween(last.weekStart, first.weekStart) + 1;
    const columns =
        spanWeeks <= DAYS_UP_TO_WEEKS
            ? dayColumns(weeks, first.weekStart, last.weekStart)
            : weekColumns(weeks, first.weekStart, last.weekStart);
    // From the weeks, not the drawn columns: the chart is capped, the total is not.
    const ahead = weeks.reduce(
        (sum, week) => {
            const { done, total } = overallProgress(week.projects);
            return { done: sum.done + done, total: sum.total + total };
        },
        { done: 0, total: 0 },
    );

    return (
        <>
            <div
                className={`${styles.row} ${listStyles.agg}`}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                aria-label={open ? weekList.collapse : weekList.expand}
                onClick={() => setOpen(!open)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(!open);
                    }
                }}
            >
                <div className={styles.pline1}>
                    <span className={styles.when}>
                        <span className={styles.date}>
                            {weekSpanLabel(first.weekStart, last.weekStart, locale)}
                        </span>
                        <span className={styles.sub}>{weekList.upcomingWeeks(weeks.length)}</span>
                    </span>
                    <span className={styles.stat}>
                        {ahead.done === 0 ? (
                            <>
                                <span className={styles.figMuted}>{ahead.total}</span>
                                <span className={styles.cap}>{weekRow.planned}</span>
                            </>
                        ) : (
                            <>
                                <span className={styles.figInk}>
                                    {ahead.done}
                                    <span className={styles.of}>/{ahead.total}</span>
                                </span>
                                <span className={styles.cap}>{weekRow.done}</span>
                            </>
                        )}
                    </span>
                </div>
                <div className={styles.pline2}>
                    <WeekSpark columns={columns} className={styles.spark} />
                    <span className={`${styles.actions} ${open ? listStyles.chevOpen : ''}`}>
                        <ChevronIcon dir="down" />
                    </span>
                </div>
            </div>
            {open &&
                [...weeks]
                    .reverse()
                    .map((entry) => (
                        <WeekRow
                            key={entry.weekStart}
                            entry={entry}
                            standing={weekStandingOf(entry, today)}
                            label={weekRangeLabel(entry.weekStart, locale)}
                            today={today}
                            onOpen={() => onOpen(entry)}
                            onCopy={() => onCopy(entry)}
                            onDelete={() => onDelete(entry)}
                        />
                    ))}
        </>
    );
}

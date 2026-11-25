import { useState, type ReactNode } from 'react';
import type { DayOfWeek, Project } from '@/core/types';
import { dueByDay, scheduleByDay } from '@/core/daySchedule';
import { progressByDay } from '@/core/progress';
import { todayInWeek } from '@/core/dates';
import { WeekGrid } from './WeekGrid';
import { DayRail, type RailMode } from './DayRail';
import { FocusedDay } from './FocusedDay';
import styles from './WeekView.module.css';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';

type WeekMode = 'grid' | 'focus';

type WeekViewProps = {
    projects: ReadonlyArray<Project>;
    weekStart: string;
    today: string;
    /** whether this week has been ended, and so is a frozen record */
    ended: boolean;
    /** whether this week's board is frozen to edits (the week has ended) */
    readOnly?: boolean;
    /** What to show INSTEAD of the days, when the week has nothing scheduled. */
    empty?: ReactNode;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function WeekView({
    projects,
    weekStart,
    today,
    ended,
    readOnly = false,
    empty,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: WeekViewProps) {
    const { locale } = useLocale();
    const { weekView } = useCopy();
    const todayDay = todayInWeek(weekStart);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay ?? 'mon');
    const [mode, setMode] = useState<WeekMode>('grid');
    /** Not persisted. */
    const [railMode, setRailMode] = useState<RailMode>('progress');

    const schedule = scheduleByDay(projects);
    const byDay = progressByDay(projects);
    const due = dueByDay(projects, weekStart);
    const focused = schedule.find((d) => d.day === selectedDay);

    function focusDay(day: DayOfWeek) {
        setSelectedDay(day);
        setMode('focus');
    }

    if (empty !== undefined) {
        return (
            <div className="weekView">
                <div className={styles.head}>
                    <span className={styles.eyebrow}>{weekView.eyebrow}</span>
                </div>
                {empty}
            </div>
        );
    }

    return (
        <div className="weekView" data-mode={mode}>
            <div className={styles.head}>
                <span className={styles.eyebrow}>{weekView.eyebrow}</span>
                {mode === 'grid' ? (
                    <span className={styles.line}>
                        {todayDay ? (
                            <>
                                <button
                                    type="button"
                                    className={styles.link}
                                    onClick={() => focusDay(todayDay)}
                                >
                                    {weekView.focusToday}
                                </button>
                                {weekView.orClickAnyDay}
                            </>
                        ) : (
                            weekView.clickAnyDay
                        )}
                    </span>
                ) : (
                    <span className={styles.line}>
                        {weekView.focusing}
                        <b>{dayName(selectedDay, locale, 'short')}</b>
                        {selectedDay === todayDay ? weekView.focusingToday : ''} ·{' '}
                        <button
                            type="button"
                            className={styles.link}
                            onClick={() => setMode('grid')}
                        >
                            {weekView.showAllDays}
                        </button>
                    </span>
                )}
                {/* Phone only. */}
                <button
                    type="button"
                    className={`${styles.link} ${styles.railToggle}`}
                    aria-pressed={railMode === 'count'}
                    onClick={() =>
                        setRailMode((shown) => (shown === 'count' ? 'progress' : 'count'))
                    }
                >
                    {railMode === 'count' ? weekView.showProgress : weekView.showCounts}
                </button>
            </div>
            <div className="weekGridPane">
                <WeekGrid
                    schedule={schedule}
                    due={due}
                    byDay={byDay}
                    weekStart={weekStart}
                    today={today}
                    ended={ended}
                    readOnly={readOnly}
                    onFocusDay={focusDay}
                    onToggleSubtask={onToggleSubtask}
                    onEditSubtask={onEditSubtask}
                    onRequestMove={onRequestMove}
                    onClearMissed={onClearMissed}
                />
            </div>
            <div className="focusPane">
                <DayRail
                    byDay={byDay}
                    due={due}
                    selectedDay={selectedDay}
                    todayDay={todayDay}
                    mode={railMode}
                    onSelectDay={setSelectedDay}
                    onBackToGrid={() => setMode('grid')}
                />
                <FocusedDay
                    day={selectedDay}
                    items={focused ? focused.items : []}
                    due={due.find((d) => d.day === selectedDay)?.entries ?? []}
                    isToday={selectedDay === todayDay}
                    weekStart={weekStart}
                    today={today}
                    ended={ended}
                    readOnly={readOnly}
                    onToggleSubtask={onToggleSubtask}
                    onEditSubtask={onEditSubtask}
                    onRequestMove={onRequestMove}
                    onClearMissed={onClearMissed}
                />
            </div>
        </div>
    );
}

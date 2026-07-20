import { useState } from 'react';
import type { DayOfWeek, Project } from '../core/types';
import { scheduleByDay } from '../core/daySchedule';
import { progressByDay } from '../core/progress';
import { todayInWeek } from '../core/dates';
import { WeekGrid } from './WeekGrid';
import { DayRail } from './DayRail';
import { FocusedDay } from './FocusedDay';
import styles from './WeekView.module.css';

type WeekMode = 'grid' | 'focus';

const SHORT: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
};

type WeekViewProps = {
    projects: ReadonlyArray<Project>;
    weekStart: string;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
};

export function WeekView({ projects, weekStart, onToggleSubtask, onEditSubtask }: WeekViewProps) {
    const schedule = scheduleByDay(projects);
    const byDay = progressByDay(projects);
    const todayDay = todayInWeek(weekStart);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay ?? 'mon');
    const [mode, setMode] = useState<WeekMode>('grid');
    const focused = schedule.find((d) => d.day === selectedDay);

    function focusDay(day: DayOfWeek) {
        setSelectedDay(day);
        setMode('focus');
    }

    return (
        <div className="weekView" data-mode={mode}>
            <div className={styles.head}>
                <span className={styles.eyebrow}>This week</span>
                {mode === 'grid' ? (
                    <span className={styles.line}>
                        {todayDay ? (
                            <>
                                <button
                                    type="button"
                                    className={styles.link}
                                    onClick={() => focusDay(todayDay)}
                                >
                                    Focus today
                                </button>
                                {' · or click any day to focus it'}
                            </>
                        ) : (
                            'click any day to focus it'
                        )}
                    </span>
                ) : (
                    <span className={styles.line}>
                        Focusing <b>{SHORT[selectedDay]}</b>
                        {selectedDay === todayDay ? ' (today)' : ''} ·{' '}
                        <button
                            type="button"
                            className={styles.link}
                            onClick={() => setMode('grid')}
                        >
                            show all days
                        </button>
                    </span>
                )}
            </div>
            <div className="weekGridPane">
                <WeekGrid
                    schedule={schedule}
                    onFocusDay={focusDay}
                    onToggleSubtask={onToggleSubtask}
                    onEditSubtask={onEditSubtask}
                />
            </div>
            <div className="focusPane">
                <DayRail
                    byDay={byDay}
                    selectedDay={selectedDay}
                    todayDay={todayDay}
                    onSelectDay={setSelectedDay}
                    onBackToGrid={() => setMode('grid')}
                />
                <FocusedDay
                    day={selectedDay}
                    items={focused ? focused.items : []}
                    isToday={selectedDay === todayDay}
                    onToggleSubtask={onToggleSubtask}
                    onEditSubtask={onEditSubtask}
                />
            </div>
        </div>
    );
}

import { useState } from 'react';
import type { DayOfWeek, Project } from '../core/types';
import { scheduleByDay } from '../core/daySchedule';
import { progressByDay } from '../core/progress';
import { todayInWeek } from '../core/dates';
import { WeekGrid } from './WeekGrid';
import { DayRail } from './DayRail';
import { FocusedDay } from './FocusedDay';

type WeekViewProps = {
    projects: ReadonlyArray<Project>;
    weekStart: string;
    onToggleSubtask: (subtaskId: string) => void;
};

export function WeekView({ projects, weekStart, onToggleSubtask }: WeekViewProps) {
    const schedule = scheduleByDay(projects);
    const byDay = progressByDay(projects);
    const todayDay = todayInWeek(weekStart);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay ?? 'mon');
    const focused = schedule.find((d) => d.day === selectedDay);
    return (
        <div className="weekView">
            <div className="weekGridPane">
                <WeekGrid schedule={schedule} onToggleSubtask={onToggleSubtask} />
            </div>
            <div className="focusPane">
                <DayRail
                    byDay={byDay}
                    selectedDay={selectedDay}
                    todayDay={todayDay}
                    onSelectDay={setSelectedDay}
                />
                <FocusedDay
                    day={selectedDay}
                    items={focused ? focused.items : []}
                    isToday={selectedDay === todayDay}
                    onToggleSubtask={onToggleSubtask}
                />
            </div>
        </div>
    );
}

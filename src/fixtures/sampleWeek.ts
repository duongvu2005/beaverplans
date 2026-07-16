import type { WeekPlan } from '../core/types';

/** Hand-built sample plan for rendering panes (day 11+) and derivation tests.
 *  Covers: project with/without deadline, a leaf task (isDone), subtasks across
 *  weekdays, done/undone mix, recorded misses, weights 1..3, descriptions. */
export const sampleWeek: WeekPlan = {
    weekStart: '2026-07-13', // a Monday
    projects: [
        {
            id: 'p1',
            name: 'software construction',
            deadline: '2026-08-01', // -> has a deadline pill
            tasks: [
                // leaf task: no subtasks, done/undone lives on the task itself
                { id: 't1', name: 'recursive data types', isDone: true, subtasks: [] },
                {
                    id: 't2',
                    name: 'week-grid derivation',
                    subtasks: [
                        { id: 's1', isDone: true, assignedDay: 'mon', missedDays: [], weight: 2 },
                        { id: 's2', isDone: false, assignedDay: 'wed', missedDays: [], weight: 1 },
                    ],
                },
            ],
        },
        {
            id: 'p2',
            name: 'beaverplans', // no deadline
            tasks: [
                {
                    id: 't3',
                    name: 'app shell',
                    description: 'topbar + view switcher',
                    subtasks: [
                        // assigned thu, but recorded missed on tue -> MISSED tag; weight 3
                        { id: 's3', isDone: false, assignedDay: 'thu', missedDays: ['tue'], weight: 3, description: 'wire the tabs' },
                        { id: 's4', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 },
                        { id: 's5', isDone: false, assignedDay: 'fri', missedDays: [], weight: 2 },
                    ],
                },
                {
                    id: 't4',
                    name: 'old-data importer',
                    subtasks: [
                        { id: 's6', isDone: true, assignedDay: 'thu', missedDays: [], weight: 1 },
                        { id: 's7', isDone: false, assignedDay: 'sat', missedDays: [], weight: 1 },
                    ],
                },
            ],
        },
        {
            id: 'p3',
            name: 'korean', // no deadline
            tasks: [
                {
                    id: 't5',
                    name: 'integrated korean chap1',
                    subtasks: [
                        // assigned sun, missed tue & wed -> multi-miss
                        { id: 's8', isDone: false, assignedDay: 'sun', missedDays: ['tue', 'wed'], weight: 1 },
                    ],
                },
            ],
        },
    ],
};

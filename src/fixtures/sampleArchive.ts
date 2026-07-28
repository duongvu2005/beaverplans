import type { Archive } from '../core/types';

/** Hand-built sample archive for rendering the archive pane and stats views.
 *  Six ended weeks, deliberately varied so the list and its derived numbers have
 *  something to show: completion ranging from a wiped-out week to a perfect one,
 *  weeks that are busy and weeks that are nearly idle, recorded misses, weights
 *  1..3, leaf tasks alongside tasks with subtasks, and projects that appear in
 *  some weeks but not others.
 *
 *  Entries are stored oldest-last but in no meaningful order — the archive's
 *  order is unspecified, and the pane sorts with archiveNewestFirst.
 *
 *  The four 2026 weeks run up to (but do not include) sampleWeek's 2026-07-20
 *  anchor. The two Dec 2025 weeks sit across a gap, so the list exercises its
 *  year divider the way a real archive would: a term's worth of use, a break,
 *  then a return.
 */
export const sampleArchive: Archive = [
    {
        weekStart: '2026-07-13', // a Monday — a strong week
        projects: [
            {
                id: 'a1p1',
                name: 'software construction',
                deadline: '2026-07-19',
                tasks: [
                    { id: 'a1t1', name: 'abstract data types', isDone: true, subtasks: [] },
                    {
                        id: 'a1t2',
                        name: 'rep invariants',
                        subtasks: [
                            {
                                id: 'a1s1',
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 2,
                            },
                            {
                                id: 'a1s2',
                                isDone: true,
                                assignedDay: 'tue',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
            {
                id: 'a1p2',
                name: 'beaverplans',
                tasks: [
                    {
                        id: 'a1t3',
                        name: 'archive row',
                        description: 'phone-first two-line layout',
                        subtasks: [
                            {
                                id: 'a1s3',
                                isDone: true,
                                assignedDay: 'wed',
                                missedDays: [],
                                weight: 3,
                            },
                            {
                                id: 'a1s4',
                                isDone: true,
                                assignedDay: 'thu',
                                missedDays: [],
                                weight: 2,
                            },
                            {
                                id: 'a1s5',
                                isDone: false,
                                assignedDay: 'sat',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        weekStart: '2026-07-06', // a Monday — a middling week, work slipping
        projects: [
            {
                id: 'a2p1',
                name: 'software construction',
                deadline: '2026-07-12',
                tasks: [
                    {
                        id: 'a2t1',
                        name: 'equality',
                        subtasks: [
                            {
                                id: 'a2s1',
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 1,
                            },
                            // slipped off tue twice before landing on thu, still undone
                            {
                                id: 'a2s2',
                                isDone: false,
                                assignedDay: 'thu',
                                missedDays: ['tue', 'wed'],
                                weight: 3,
                                description: 'observational equality',
                            },
                        ],
                    },
                ],
            },
            {
                id: 'a2p2',
                name: 'beaverplans',
                tasks: [
                    { id: 'a2t2', name: 'end-week flow', isDone: true, subtasks: [] },
                    {
                        id: 'a2t3',
                        name: 'merge trees',
                        subtasks: [
                            {
                                id: 'a2s3',
                                isDone: false,
                                assignedDay: 'fri',
                                missedDays: ['thu'],
                                weight: 3,
                            },
                        ],
                    },
                ],
            },
            {
                id: 'a2p3',
                name: 'korean',
                tasks: [
                    {
                        id: 'a2t4',
                        name: 'integrated korean chap3',
                        subtasks: [
                            {
                                id: 'a2s4',
                                isDone: true,
                                assignedDay: 'sun',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        weekStart: '2026-06-29', // a Monday — a bad week, almost nothing landed
        projects: [
            {
                id: 'a3p1',
                name: 'beaverplans',
                tasks: [
                    {
                        id: 'a3t1',
                        name: 'drag and drop',
                        description: 'migrate to dnd-kit',
                        subtasks: [
                            {
                                id: 'a3s1',
                                isDone: false,
                                assignedDay: 'wed',
                                missedDays: ['mon', 'tue'],
                                weight: 3,
                            },
                            {
                                id: 'a3s2',
                                isDone: false,
                                assignedDay: 'fri',
                                missedDays: ['thu'],
                                weight: 2,
                            },
                        ],
                    },
                ],
            },
            {
                id: 'a3p2',
                name: 'korean',
                tasks: [
                    {
                        id: 'a3t2',
                        name: 'integrated korean chap2',
                        subtasks: [
                            {
                                id: 'a3s3',
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 1,
                            },
                            {
                                id: 'a3s4',
                                isDone: false,
                                assignedDay: 'sat',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        weekStart: '2026-06-22', // a Monday — small and perfect, everything done
        projects: [
            {
                id: 'a4p1',
                name: 'software construction',
                tasks: [
                    { id: 'a4t1', name: 'static checking', isDone: true, subtasks: [] },
                    {
                        id: 'a4t2',
                        name: 'testing',
                        subtasks: [
                            {
                                id: 'a4s1',
                                isDone: true,
                                assignedDay: 'tue',
                                missedDays: [],
                                weight: 2,
                            },
                            {
                                id: 'a4s2',
                                isDone: true,
                                assignedDay: 'thu',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        weekStart: '2025-12-22', // a Monday — winter break, barely used
        projects: [
            {
                id: 'a5p1',
                name: 'korean',
                tasks: [
                    {
                        id: 'a5t1',
                        name: 'vocab review',
                        subtasks: [
                            {
                                id: 'a5s1',
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 1,
                            },
                            {
                                id: 'a5s2',
                                isDone: false,
                                assignedDay: 'sun',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        weekStart: '2025-12-15', // a Monday — finals, the busiest week here
        projects: [
            {
                id: 'a6p1',
                name: '6.102 final',
                deadline: '2025-12-18T09:00',
                tasks: [
                    {
                        id: 'a6t1',
                        name: 'review readings',
                        subtasks: [
                            {
                                id: 'a6s1',
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 3,
                            },
                            {
                                id: 'a6s2',
                                isDone: true,
                                assignedDay: 'tue',
                                missedDays: [],
                                weight: 3,
                            },
                            {
                                id: 'a6s3',
                                isDone: true,
                                assignedDay: 'wed',
                                missedDays: [],
                                weight: 2,
                            },
                        ],
                    },
                    { id: 'a6t2', name: 'past exams', isDone: true, subtasks: [] },
                ],
            },
            {
                id: 'a6p2',
                name: 'korean final',
                deadline: '2025-12-19',
                tasks: [
                    {
                        id: 'a6t3',
                        name: 'oral practice',
                        subtasks: [
                            {
                                id: 'a6s4',
                                isDone: true,
                                assignedDay: 'thu',
                                missedDays: [],
                                weight: 2,
                            },
                            {
                                id: 'a6s5',
                                isDone: false,
                                assignedDay: 'fri',
                                missedDays: [],
                                weight: 3,
                            },
                            {
                                id: 'a6s6',
                                isDone: false,
                                assignedDay: 'sat',
                                missedDays: ['fri'],
                                weight: 2,
                            },
                        ],
                    },
                ],
            },
        ],
    },
];

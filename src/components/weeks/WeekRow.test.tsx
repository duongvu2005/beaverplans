import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekRow } from './WeekRow';
import type { WeekPlan, WeekStanding } from '@/core/types';

// A Wednesday well after the fixture week, so the fixture reads as fully lived.
const TODAY = '2026-07-29';

/*
 * Testing strategy
 *     partition on standing: ended | live | upcoming | open
 *     partition on interaction target: date button | spark button | copy | delete
 *     property checked: only the clicked action's callback fires, never onOpen
 *       as a side effect of clicking copy/delete
 *     rendering: label, done/total, and rounded percentage all show correctly
 */

function samplePlan(): WeekPlan {
    return {
        weekStart: '2026-07-13',
        ended: true,
        projects: [
            {
                id: 'p1',
                name: 'Project',
                tasks: [
                    {
                        id: 't1',
                        name: 'Task',
                        subtasks: [
                            {
                                id: 's1',
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 2,
                            },
                            {
                                id: 's2',
                                isDone: false,
                                assignedDay: 'tue',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

function planFor(weekStart: string): WeekPlan {
    return { ...samplePlan(), weekStart, ended: false };
}

// The same plan with every subtask unticked, for the week nobody has touched.
function nothingDone(entry: WeekPlan): WeekPlan {
    return {
        ...entry,
        projects: entry.projects.map((p) => ({
            ...p,
            tasks: p.tasks.map((t) => ({
                ...t,
                subtasks: t.subtasks.map((sub) => ({ ...sub, isDone: false })),
            })),
        })),
    };
}

function renderStanding(standing: WeekStanding, entry: WeekPlan, today = TODAY) {
    render(
        <WeekRow
            entry={entry}
            standing={standing}
            label="Jul 13 – 19"
            today={today}
            onOpen={() => {}}
            onCopy={() => {}}
            onDelete={() => {}}
        />,
    );
}

describe('WeekRow standings', () => {
    it('covers ended: an accent percentage, and the done count on the sub line', () => {
        renderStanding('ended', samplePlan());
        expect(screen.getByText('67%')).toBeInTheDocument();
        expect(screen.getByText('complete')).toBeInTheDocument();
        expect(screen.getByText('2/3 done')).toBeInTheDocument();
    });

    it('covers live: a count rather than a verdict', () => {
        renderStanding('live', planFor('2026-07-27'));
        expect(screen.queryByText('67%')).not.toBeInTheDocument();
        expect(screen.getByText('/3')).toBeInTheDocument();
        expect(screen.getByText('this week')).toBeInTheDocument();
    });

    it('covers upcoming with nothing done: the weight planned, nothing graded', () => {
        renderStanding('upcoming', nothingDone(planFor('2026-08-03')));
        expect(screen.queryByText('67%')).not.toBeInTheDocument();
        expect(screen.getByText('planned')).toBeInTheDocument();
        expect(screen.getByText('upcoming')).toBeInTheDocument();
    });

    // Ticking work in a week not yet reached is odd but not forbidden, and the
    // bars show it — so the figure must not report a total they contradict.
    it('covers upcoming with work already done: the figure counts it', () => {
        renderStanding('upcoming', planFor('2026-08-03'));
        expect(screen.queryByText('planned')).not.toBeInTheDocument();
        expect(screen.getByText('/3')).toBeInTheDocument();
        expect(screen.getByText('upcoming')).toBeInTheDocument();
    });

    it('covers open: a percentage, but stated rather than awarded', () => {
        renderStanding('open', planFor('2026-07-13'));
        expect(screen.getByText('67%')).toBeInTheDocument();
        expect(screen.getByText('not ended')).toBeInTheDocument();
    });
});

describe('WeekRow', () => {
    it('renders the label, done count, and rounded percentage', () => {
        render(
            <WeekRow
                entry={samplePlan()}
                standing="ended"
                label="Jul 13 – 19"
                today={TODAY}
                onOpen={() => {}}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        expect(screen.getByText('Jul 13 – 19')).toBeInTheDocument();
        expect(screen.getByText('2/3 done')).toBeInTheDocument();
        expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('covers date button: clicking it calls onOpen', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        render(
            <WeekRow
                entry={samplePlan()}
                standing="ended"
                label="Jul 13 – 19"
                today={TODAY}
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        await user.click(screen.getByRole('button', { name: /open week/i }));

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    // The row is a div with role="button", so the keyboard activation a real
    // <button> gives for free is written out here. Space also has to
    // preventDefault, or activating a row scrolls the page under it.
    it.each(['{Enter}', ' '])('opens from the keyboard with %s', async (key) => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        render(
            <WeekRow
                entry={samplePlan()}
                standing="ended"
                label="Jul 13 – 19"
                today={TODAY}
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        screen.getByRole('button', { name: /open week/i }).focus();
        await user.keyboard(key);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    // Any other key must fall through, or the row swallows Tab and traps focus.
    it('an unrelated key does not open it', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        render(
            <WeekRow
                entry={samplePlan()}
                standing="ended"
                label="Jul 13 – 19"
                today={TODAY}
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        screen.getByRole('button', { name: /open week/i }).focus();
        await user.keyboard('a');

        expect(onOpen).not.toHaveBeenCalled();
    });

    it('covers copy button: calls onCopy only, not onOpen', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        const onCopy = vi.fn();
        render(
            <WeekRow
                entry={samplePlan()}
                standing="ended"
                label="Jul 13 – 19"
                today={TODAY}
                onOpen={onOpen}
                onCopy={onCopy}
                onDelete={() => {}}
            />,
        );

        await user.click(screen.getByRole('button', { name: /copy week/i }));

        expect(onCopy).toHaveBeenCalledTimes(1);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('covers delete button: calls onDelete only, not onOpen', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        const onDelete = vi.fn();
        render(
            <WeekRow
                entry={samplePlan()}
                standing="ended"
                label="Jul 13 – 19"
                today={TODAY}
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={onDelete}
            />,
        );

        await user.click(screen.getByRole('button', { name: /delete week/i }));

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onOpen).not.toHaveBeenCalled();
    });
});

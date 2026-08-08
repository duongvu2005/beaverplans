import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveRow } from './ArchiveRow';
import type { WeekPlan } from '../core/types';

/*
 * Testing strategy
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

describe('ArchiveRow', () => {
    it('renders the label, done count, and rounded percentage', () => {
        render(
            <ArchiveRow
                entry={samplePlan()}
                label="Jul 13 – 19"
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
            <ArchiveRow
                entry={samplePlan()}
                label="Jul 13 – 19"
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        await user.click(screen.getByRole('button', { name: /open archived week/i }));

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    // The row is a div with role="button", so the keyboard activation a real
    // <button> gives for free has to be written out — and if it regresses, an
    // archived week becomes unreachable without a mouse, silently. Space also
    // has to preventDefault, or activating a row scrolls the page under it.
    it.each(['{Enter}', ' '])('opens from the keyboard with %s', async (key) => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        render(
            <ArchiveRow
                entry={samplePlan()}
                label="Jul 13 – 19"
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        screen.getByRole('button', { name: /open archived week/i }).focus();
        await user.keyboard(key);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    // Any other key must fall through, or the row swallows Tab and traps focus.
    it('an unrelated key does not open it', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        render(
            <ArchiveRow
                entry={samplePlan()}
                label="Jul 13 – 19"
                onOpen={onOpen}
                onCopy={() => {}}
                onDelete={() => {}}
            />,
        );

        screen.getByRole('button', { name: /open archived week/i }).focus();
        await user.keyboard('a');

        expect(onOpen).not.toHaveBeenCalled();
    });

    it('covers copy button: calls onCopy only, not onOpen', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        const onCopy = vi.fn();
        render(
            <ArchiveRow
                entry={samplePlan()}
                label="Jul 13 – 19"
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
            <ArchiveRow
                entry={samplePlan()}
                label="Jul 13 – 19"
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyWeekDialog } from './CopyWeekDialog';
import type { Project, WeekPlan } from '../core/types';

/*
 * Testing strategy
 *     partition on project count: none | one | several
 *     partition on selection: all (initial) | some excluded | none left
 *     partition on outcome: Copy clicked | Cancel clicked
 *     partition on task count: one (singular label) | several (plural label)
 */

function project(id: string, name: string, taskCount: number): Project {
    return {
        id,
        name,
        tasks: Array.from({ length: taskCount }, (_, i) => ({
            id: `${id}-t${i}`,
            name: `Task ${i}`,
            isDone: false,
            subtasks: [],
        })),
    };
}

const week: WeekPlan = {
    weekStart: '2026-07-06',
    projects: [project('p1', 'software construction', 2), project('p2', 'beaverplans', 1)],
};

function renderDialog(entry: WeekPlan = week) {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
        <CopyWeekDialog
            entry={entry}
            label="Jul 06 – Jul 12"
            onClose={onClose}
            onCopy={onCopy}
        />,
    );
    return { onCopy, onClose };
}

// The names of the projects handed to onCopy by its last call.
function copiedNames(onCopy: ReturnType<typeof vi.fn>): string[] {
    const projects = onCopy.mock.calls.at(-1)?.[0] as ReadonlyArray<Project>;
    return projects.map((p) => p.name);
}

// A checkbox is named "<project>, <n> tasks"; match on the project part rather
// than pinning the count into every query.
function box(projectName: string) {
    return screen.getByRole('checkbox', { name: new RegExp(`^${projectName},`) });
}

describe('CopyWeekDialog', () => {
    it('covers several projects: titles the week and lists every project, all checked', () => {
        renderDialog();

        expect(screen.getByRole('heading', { name: 'Copy Jul 06 – Jul 12' })).toBeInTheDocument();
        const boxes = screen.getAllByRole('checkbox');
        expect(boxes).toHaveLength(2);
        expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    });

    it('covers task count: singular for one task, plural for several', () => {
        renderDialog();

        expect(screen.getByText('2 tasks')).toBeInTheDocument();
        expect(screen.getByText('1 task')).toBeInTheDocument();
    });

    it('covers initial selection: Copy passes every project, in the week’s own order', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(copiedNames(onCopy)).toEqual(['software construction', 'beaverplans']);
    });

    it('covers some excluded: an unchecked project is left out of the payload', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(box('software construction'));
        await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(copiedNames(onCopy)).toEqual(['beaverplans']);
    });

    it('covers re-checking: a project unchecked then checked again is copied', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(box('beaverplans'));
        await userEvent.click(box('beaverplans'));
        await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(copiedNames(onCopy)).toEqual(['software construction', 'beaverplans']);
    });

    it('covers none left: Copy is disabled once every project is unchecked', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(box('software construction'));
        await userEvent.click(box('beaverplans'));

        const copy = screen.getByRole('button', { name: 'Copy' });
        expect(copy).toBeDisabled();
        await userEvent.click(copy);
        expect(onCopy).not.toHaveBeenCalled();
    });

    it('covers no projects: explains there is nothing to copy and disables Copy', () => {
        renderDialog({ weekStart: '2026-07-06', projects: [] });

        expect(screen.getByText('This week has no projects to copy.')).toBeInTheDocument();
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
    });

    it('covers Cancel: closes without copying', async () => {
        const { onCopy, onClose } = renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onCopy).not.toHaveBeenCalled();
    });
});

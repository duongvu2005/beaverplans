import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyPlanDialog } from './CopyPlanDialog';
import type { Project } from '@/core/types';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

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

const week: ReadonlyArray<Project> = [
    project('p1', 'software construction', 2),
    project('p2', 'beaverplans', 1),
];

function renderDialog(projects: ReadonlyArray<Project> = week) {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
        <CopyPlanDialog
            projects={projects}
            eyebrow="Archive"
            title="Copy Jul 06 – Jul 12"
            onClose={onClose}
            onCopy={onCopy}
        />,
    );
    return { onCopy, onClose };
}

// The names onCopy was handed by its last call.
function copiedNames(onCopy: ReturnType<typeof vi.fn>): string[] {
    const projects = onCopy.mock.calls.at(-1)?.[0] as ReadonlyArray<Project>;
    return projects.map((p) => p.name);
}

// A checkbox is named "<project>, <n> tasks", matched on the project part.
function box(projectName: string) {
    return screen.getByRole('checkbox', { name: new RegExp(`^${projectName},`) });
}

describe('CopyPlanDialog', () => {
    it('covers several projects: titles the copy and lists every project, all checked', () => {
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

        await userEvent.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(copiedNames(onCopy)).toEqual(['software construction', 'beaverplans']);
    });

    it('covers some excluded: an unchecked project is left out of the payload', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(box('software construction'));
        await userEvent.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(copiedNames(onCopy)).toEqual(['beaverplans']);
    });

    it('covers re-checking: a project unchecked then checked again is copied', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(box('beaverplans'));
        await userEvent.click(box('beaverplans'));
        await userEvent.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(copiedNames(onCopy)).toEqual(['software construction', 'beaverplans']);
    });

    it('covers none left: Copy is disabled once every project is unchecked', async () => {
        const { onCopy } = renderDialog();

        await userEvent.click(box('software construction'));
        await userEvent.click(box('beaverplans'));

        const copy = screen.getByRole('button', { name: en.copyPlanDialog.copy });
        expect(copy).toBeDisabled();
        await userEvent.click(copy);
        expect(onCopy).not.toHaveBeenCalled();
    });

    it('covers no projects: explains there is nothing to copy and disables Copy', () => {
        renderDialog([]);

        expect(screen.getByText(en.copyPlanDialog.empty)).toBeInTheDocument();
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.getByRole('button', { name: en.copyPlanDialog.copy })).toBeDisabled();
    });

    it('covers Cancel: closes without copying', async () => {
        const { onCopy, onClose } = renderDialog();

        await userEvent.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onCopy).not.toHaveBeenCalled();
    });

    // eyebrow, title and the project names are props, so they stay English
    // while the dialog's own words move.
    it('covers vi: the dialog names its own chrome and leaves the props alone', async () => {
        const onCopy = vi.fn();
        renderIn(
            'vi',
            <CopyPlanDialog
                projects={week}
                eyebrow="Archive"
                title="Copy Jul 06 – Jul 12"
                onClose={() => {}}
                onCopy={onCopy}
            />,
        );

        expect(screen.getByText(viCatalog.copyPlanDialog.projects)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: viCatalog.copyPlanDialog.deselectAll }),
        ).toBeInTheDocument();
        expect(screen.getByText(viCatalog.copyPlanDialog.taskCount(2))).toBeInTheDocument();
        expect(
            screen.getByRole('checkbox', {
                name: viCatalog.copyPlanDialog.projectLabel(
                    'software construction',
                    viCatalog.copyPlanDialog.taskCount(2),
                ),
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('Copy Jul 06 – Jul 12')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: en.copyPlanDialog.deselectAll })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: viCatalog.copyPlanDialog.copy }));
        expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('covers vi: the empty case', () => {
        renderIn(
            'vi',
            <CopyPlanDialog
                projects={[]}
                eyebrow="Archive"
                title="Copy Jul 06 – Jul 12"
                onClose={() => {}}
                onCopy={vi.fn()}
            />,
        );

        expect(screen.getByText(viCatalog.copyPlanDialog.empty)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: viCatalog.copyPlanDialog.copy })).toBeDisabled();
    });
});

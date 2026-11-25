import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PastePlanDialog } from './PastePlanDialog';
import { printProjects } from '@/storage/weekClipboard';
import { LIMITS } from '@/core/limits';
import type { Project } from '@/core/types';
import { renderIn } from '@/test/locale';
import { weekRangeLabel } from '@/i18n/dateCopy';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

describe('PastePlanDialog', () => {
    /*
     * Testing strategy
     *     partition on the pasted text: empty | not a copied plan | a copied
     *         plan that fits | a copied plan with more projects than there is room
     *     partition on the checkbox: left off (the default) | turned on
     *
     * The dialog neither remints ids nor clears progress — it reports what it
     * read and which box is ticked, and WeekBoard does both. What is pinned here
     * is that the commit is BLOCKED until there is something valid to commit,
     * and that the checkbox reaches the caller unchanged.
     */
    const SAMPLE: ReadonlyArray<Project> = [
        {
            id: 'p1',
            name: 'Thesis',
            tasks: [{ id: 't1', name: 'Read Chapter 4', isDone: true, subtasks: [] }],
        },
    ];
    const COPIED = printProjects('2026-08-03', SAMPLE);

    // Annotated: LIMITS is `as const`, so the default alone would infer the
    // literal 50 and refuse the room = 0 case below.
    function open(room: number = LIMITS.projectsPerWeek) {
        const onPaste = vi.fn();
        render(<PastePlanDialog room={room} onClose={() => {}} onPaste={onPaste} />);
        return {
            onPaste,
            user: userEvent.setup(),
            box: screen.getByLabelText(en.pastePlanDialog.boxLabel),
        };
    }

    it('covers empty: nothing to add, and no complaint about it either', () => {
        open();
        expect(screen.getByRole('button', { name: en.pastePlanDialog.add })).toBeDisabled();
        expect(screen.queryByText(en.pastePlanDialog.reasons['not-json'])).toBeNull();
    });

    it('covers text that is not a copied plan: says so, stays disabled', async () => {
        const { user, box } = open();

        await user.click(box);
        await user.paste('just some words');

        expect(screen.getByText(en.pastePlanDialog.reasons['not-json'])).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.pastePlanDialog.add })).toBeDisabled();
    });

    it('covers a valid plan: summarises what was found before committing anything', async () => {
        const { user, box, onPaste } = open();

        await user.click(box);
        await user.paste(COPIED);

        expect(screen.getByText(/1 project, 1 task, copied from/i)).toBeInTheDocument();
        expect(onPaste).not.toHaveBeenCalled();
    });

    it('covers committing with the checkbox left off', async () => {
        const { user, box, onPaste } = open();

        await user.click(box);
        await user.paste(COPIED);
        await user.click(screen.getByRole('button', { name: en.pastePlanDialog.add }));

        expect(onPaste).toHaveBeenCalledWith(SAMPLE, false);
    });

    it('covers committing with the checkbox turned on', async () => {
        const { user, box, onPaste } = open();

        await user.click(box);
        await user.paste(COPIED);
        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('button', { name: en.pastePlanDialog.add }));

        expect(onPaste).toHaveBeenCalledWith(SAMPLE, true);
    });

    it('covers more projects than there is room for: refused with the count', async () => {
        const { user, box } = open(0);

        await user.click(box);
        await user.paste(COPIED);

        expect(screen.getByText(/room for 0/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.pastePlanDialog.add })).toBeDisabled();
    });

    // The failure prose is reached by typing rather than by a prop, so a
    // hard-coded reason would render in English mid-flow.
    it('covers vi: the chrome and a failure reason are both Vietnamese', async () => {
        const onPaste = vi.fn();
        renderIn(
            'vi',
            <PastePlanDialog room={LIMITS.projectsPerWeek} onClose={() => {}} onPaste={onPaste} />,
        );
        const user = userEvent.setup();

        expect(screen.getByText(viCatalog.pastePlanDialog.intro)).toBeInTheDocument();
        const box = screen.getByLabelText(viCatalog.pastePlanDialog.boxLabel);
        expect(screen.getByRole('button', { name: viCatalog.pastePlanDialog.add })).toBeDisabled();

        await user.click(box);
        await user.paste('just some words');

        expect(screen.getByText(viCatalog.pastePlanDialog.reasons['not-json'])).toBeInTheDocument();
        expect(screen.queryByText(en.pastePlanDialog.reasons['not-json'])).toBeNull();
    });

    it('covers vi: the summary of a valid plan, dates included', async () => {
        const onPaste = vi.fn();
        renderIn(
            'vi',
            <PastePlanDialog room={LIMITS.projectsPerWeek} onClose={() => {}} onPaste={onPaste} />,
        );
        const user = userEvent.setup();

        await user.click(screen.getByLabelText(viCatalog.pastePlanDialog.boxLabel));
        await user.paste(COPIED);

        // One project, one task — the count the English inflects and this does not.
        expect(
            screen.getByText(
                viCatalog.pastePlanDialog.found(1, 1, weekRangeLabel('2026-08-03', 'vi')),
            ),
        ).toBeInTheDocument();
    });
});

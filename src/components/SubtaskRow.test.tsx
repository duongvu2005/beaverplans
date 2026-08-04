import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubtaskRow } from './SubtaskRow';
import type { Subtask } from '../core/types';

describe('SubtaskRow', () => {
    /*
     * Testing strategy
     *     partition on description: present (shown in the note input, and
     *         passed to WeightChip as its sheet label) | absent (note input
     *         empty, WeightChip sheet heading has no label)
     *     interaction: typing in the note field -> onSetNote(id, value);
     *         clicking Remove -> onRemove(id); changing weight via the
     *         fine-pointer control (WeightDots, already unit-tested on its own)
     *         -> onSetWeight(id, newWeight), confirming the wiring through
     *         WeightChip
     */

    function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
        return {
            id: 's1',
            isDone: false,
            assignedDay: 'mon',
            missedDays: [],
            weight: 1,
            ...overrides,
        };
    }

    const noop = () => {};

    it('covers description present: shown in the note input and used as the sheet label', async () => {
        const user = userEvent.setup();
        render(
            <SubtaskRow
                subtask={makeSubtask({ description: 'bring markers' })}
                onSetWeight={noop}
                onSetNote={noop}
                onRemove={noop}
            />,
        );
        expect(screen.getByDisplayValue('bring markers')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Weight:/ }));

        expect(screen.getByRole('heading', { name: 'Weight — bring markers' })).toBeInTheDocument();
    });

    it('covers description absent: note input empty, sheet heading has no label', async () => {
        const user = userEvent.setup();
        render(
            <SubtaskRow
                subtask={makeSubtask()}
                onSetWeight={noop}
                onSetNote={noop}
                onRemove={noop}
            />,
        );
        expect(screen.getByPlaceholderText('add a note (optional)')).toHaveValue('');

        await user.click(screen.getByRole('button', { name: /Weight:/ }));

        expect(screen.getByRole('heading', { name: 'Weight' })).toBeInTheDocument();
    });

    it('covers typing a note: calls onSetNote(id, value)', async () => {
        const user = userEvent.setup();
        const onSetNote = vi.fn();
        render(
            <SubtaskRow
                subtask={makeSubtask()}
                onSetWeight={noop}
                onSetNote={onSetNote}
                onRemove={noop}
            />,
        );

        await user.type(screen.getByPlaceholderText('add a note (optional)'), 'x');

        expect(onSetNote).toHaveBeenCalledWith('s1', 'x');
    });

    it('covers clicking Remove: calls onRemove(id)', async () => {
        const user = userEvent.setup();
        const onRemove = vi.fn();
        render(
            <SubtaskRow
                subtask={makeSubtask()}
                onSetWeight={noop}
                onSetNote={noop}
                onRemove={onRemove}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Remove subtask' }));

        expect(onRemove).toHaveBeenCalledWith('s1');
    });

    it('covers changing weight via the fine-pointer control: calls onSetWeight(id, newWeight)', async () => {
        const user = userEvent.setup();
        const onSetWeight = vi.fn();
        render(
            <SubtaskRow
                subtask={makeSubtask({ weight: 1 })}
                onSetWeight={onSetWeight}
                onSetNote={noop}
                onRemove={noop}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Hard' }));

        expect(onSetWeight).toHaveBeenCalledWith('s1', 3);
    });
});

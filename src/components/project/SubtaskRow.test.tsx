import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubtaskRow, SubtaskRowPreview } from './SubtaskRow';
import type { Subtask } from '@/core/types';
import styles from './SubtaskRow.module.css';
import { en } from '@/i18n/en';

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
        expect(screen.getByPlaceholderText(en.subtaskRow.notePlaceholder)).toHaveValue('');

        await user.click(screen.getByRole('button', { name: /Weight:/ }));

        expect(screen.getByRole('heading', { name: en.weightDots.label })).toBeInTheDocument();
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

        await user.type(screen.getByPlaceholderText(en.subtaskRow.notePlaceholder), 'x');

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

        await user.click(screen.getByRole('button', { name: en.subtaskRow.removeLabel }));

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

        await user.click(screen.getByRole('radio', { name: en.common.weights.hard }));

        expect(onSetWeight).toHaveBeenCalledWith('s1', 3);
    });
});

describe('SubtaskRowPreview', () => {
    /*
     * Testing strategy
     *
     * Same guard as TaskRowPreview's, for the editor's own drag: the clone is
     * only in the DOM mid-drag, so the test renders the row and the clone and
     * diffs them rather than dragging anything.
     *
     * A subtask clone is always the thing the pointer picked up — nothing
     * carries subtasks the way a project carries tasks — so unlike TaskRow there
     * is no un-grabbed case to cover.
     *
     * partition on description: absent (empty note input) | present (shown, and
     *     handed to WeightChip as its label)
     * partition on weight: 1 | 3, which is what the chip's pips read from
     */

    // The only attributes the live row may have and the clone may not: dnd-kit's
    // handle wiring, the transform it animates, and the readOnly standing in for
    // the callbacks. The hover-state class is stripped too — see .grabbed.
    const DRAG_ONLY = [
        'style',
        'readonly',
        'role',
        'tabindex',
        'aria-disabled',
        'aria-roledescription',
        'aria-describedby',
    ];

    /** The clone's one sanctioned difference: the class turning hover state on. */
    function grabbedClass(): string {
        const value = styles.grabbed;
        if (value === undefined) throw new Error('SubtaskRow.module.css has no .grabbed');
        return value;
    }

    function shapeOf(root: HTMLElement): string {
        const clone = root.cloneNode(true);
        if (!(clone instanceof HTMLElement)) throw new Error('not an element');
        for (const node of [clone, ...clone.querySelectorAll('*')]) {
            for (const attribute of DRAG_ONLY) node.removeAttribute(attribute);
            node.classList.remove(grabbedClass());
        }
        return clone.outerHTML;
    }

    function rendered(container: HTMLElement): HTMLElement {
        const node = container.firstElementChild;
        if (!(node instanceof HTMLElement)) throw new Error('nothing rendered');
        return node;
    }

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

    /** The same subtask through both components, as comparable markup. */
    function shapes(subtask: Subtask): { row: string; preview: string } {
        const live = render(
            <SubtaskRow subtask={subtask} onSetWeight={noop} onSetNote={noop} onRemove={noop} />,
        );
        const row = shapeOf(rendered(live.container));
        live.unmount();

        const clone = render(<SubtaskRowPreview subtask={subtask} />);
        return { row, preview: shapeOf(rendered(clone.container)) };
    }

    it('covers a subtask with a note: the clone renders the row it stands in for', () => {
        const { row, preview } = shapes(makeSubtask({ description: 'bring markers', weight: 3 }));
        expect(preview).toBe(row);
    });

    it('covers a subtask with no note: same shape, chip and delete and all', () => {
        const { row, preview } = shapes(makeSubtask());
        expect(preview).toBe(row);
    });

    it('covers the readouts a shape comparison cannot see: the note', () => {
        render(<SubtaskRowPreview subtask={makeSubtask({ description: 'bring markers' })} />);
        expect(screen.getByDisplayValue('bring markers')).toBeInTheDocument();
    });

    // shapeOf strips the grabbed class, so without this it could vanish and every
    // comparison above would still pass.
    it('covers grabbed: the clone is marked hovered', () => {
        const { container } = render(<SubtaskRowPreview subtask={makeSubtask()} />);
        expect(rendered(container)).toHaveClass(grabbedClass());
    });

    it('covers inertness: the clone carries no drag handle and takes no typing', () => {
        const { container } = render(<SubtaskRowPreview subtask={makeSubtask()} />);
        expect(container.querySelector('[aria-roledescription="sortable"]')).toBeNull();
        expect(screen.getByPlaceholderText(en.subtaskRow.notePlaceholder)).toHaveAttribute(
            'readonly',
        );
    });
});

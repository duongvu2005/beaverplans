import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';
import { en } from '@/i18n/en';

describe('ConfirmDialog', () => {
    /*
     * Testing strategy
     *     partition on optional props: eyebrow present | absent
     *     partition on confirmLabel: given | defaulted
     *     partition on interaction: Cancel click | confirm click | Escape key
     *     partition on action shape: single confirmLabel/onConfirm | actions
     *       array (multiple named buttons, e.g. carry-forward vs clear)
     *     partition on action tone: defaulted (primary) | ghost
     *     partition on requireTyped: absent | present and unmatched | present
     *       and matched (exactly, in another case, with surrounding spaces)
     */

    const gated = (onConfirm: () => void) => (
        <ConfirmDialog
            title="Clear all"
            onConfirm={onConfirm}
            onClose={() => {}}
            requireTyped={{ value: 'Duong' }}
        >
            <p>This cannot be undone.</p>
        </ConfirmDialog>
    );

    const confirmButton = () => screen.getByRole('button', { name: en.confirmDialog.confirm });

    it('covers requireTyped absent: no field, and the action is live', () => {
        render(
            <ConfirmDialog title="Clear all" onConfirm={() => {}} onClose={() => {}}>
                <p>body</p>
            </ConfirmDialog>,
        );
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(confirmButton()).toBeEnabled();
    });

    it('covers requireTyped present and empty: the action is held', () => {
        render(gated(() => {}));
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(confirmButton()).toBeDisabled();
    });

    it('covers requireTyped present and unmatched', async () => {
        const user = userEvent.setup();
        render(gated(() => {}));
        await user.type(screen.getByRole('textbox'), 'Duon');
        expect(confirmButton()).toBeDisabled();
    });

    it('covers requireTyped matched exactly, and fires', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(gated(onConfirm));
        await user.type(screen.getByRole('textbox'), 'Duong');
        expect(confirmButton()).toBeEnabled();
        await user.click(confirmButton());
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('covers a match in another case and with surrounding spaces', async () => {
        const user = userEvent.setup();
        render(gated(() => {}));
        await user.type(screen.getByRole('textbox'), '  dUONG  ');
        expect(confirmButton()).toBeEnabled();
    });

    it('covers the name being shown, so the gate is a transcription not a memory test', () => {
        render(gated(() => {}));
        const { typeToConfirmLead, typeToConfirmRest } = en.confirmDialog;
        const shown = screen.getByText('Duong');
        // Bolded, because the whole point is that it be spotted and copied.
        expect(shown.tagName).toBe('B');
        expect(shown.closest('label')).toHaveTextContent(
            `${typeToConfirmLead}Duong${typeToConfirmRest}`.trim(),
        );
    });

    it('covers eyebrow present: renders title, eyebrow, and children', () => {
        render(
            <ConfirmDialog
                title="Clear missed"
                eyebrow="Draft essay"
                onConfirm={() => {}}
                onClose={() => {}}
            >
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        expect(
            screen.getByRole('heading', { name: en.dayCell.clearMissedTitle }),
        ).toBeInTheDocument();
        expect(screen.getByText('Draft essay')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('covers eyebrow absent: still renders title and children', () => {
        render(
            <ConfirmDialog title="Clear missed" onConfirm={() => {}} onClose={() => {}}>
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        expect(
            screen.getByRole('heading', { name: en.dayCell.clearMissedTitle }),
        ).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('covers confirmLabel defaults to "Confirm" when not given', () => {
        render(
            <ConfirmDialog title="Clear missed" onConfirm={() => {}} onClose={() => {}}>
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        expect(screen.getByRole('button', { name: en.confirmDialog.confirm })).toBeInTheDocument();
    });

    it('covers clicking Cancel calls onClose, not onConfirm', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        render(
            <ConfirmDialog title="Clear missed" onConfirm={onConfirm} onClose={onClose}>
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        await user.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('covers clicking the confirm button calls onConfirm, not onClose', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        render(
            <ConfirmDialog
                title="Clear missed"
                confirmLabel="Clear"
                onConfirm={onConfirm}
                onClose={onClose}
            >
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        await user.click(screen.getByRole('button', { name: 'Clear' }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('covers pressing Escape calls onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <ConfirmDialog title="Clear missed" onConfirm={() => {}} onClose={onClose}>
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('covers actions: renders one button per action, alongside Cancel', () => {
        render(
            <ConfirmDialog
                title="End week"
                onClose={() => {}}
                actions={[
                    { label: 'Carry unfinished forward', onAction: () => {} },
                    { label: 'Clear everything', onAction: () => {}, tone: 'ghost' },
                ]}
            >
                <p>What should happen to unfinished tasks?</p>
            </ConfirmDialog>,
        );

        expect(screen.getByRole('button', { name: en.common.cancel })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Carry unfinished forward' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear everything' })).toBeInTheDocument();
    });

    it('covers actions: clicking one action calls only its own onAction', async () => {
        const user = userEvent.setup();
        const carryForward = vi.fn();
        const clearEverything = vi.fn();
        const onClose = vi.fn();
        render(
            <ConfirmDialog
                title="End week"
                onClose={onClose}
                actions={[
                    { label: 'Carry unfinished forward', onAction: carryForward },
                    { label: 'Clear everything', onAction: clearEverything, tone: 'ghost' },
                ]}
            >
                <p>What should happen to unfinished tasks?</p>
            </ConfirmDialog>,
        );

        await user.click(screen.getByRole('button', { name: 'Clear everything' }));

        expect(clearEverything).toHaveBeenCalledTimes(1);
        expect(carryForward).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });
});

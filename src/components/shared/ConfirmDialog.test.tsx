import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
    /*
     * Testing strategy
     *     partition on optional props: eyebrow present | absent
     *     partition on confirmLabel: given | defaulted
     *     partition on interaction: Cancel click | confirm click | Escape key
     *     partition on action shape: single confirmLabel/onConfirm | actions
     *       array (multiple named buttons, e.g. carry-forward vs clear)
     *     partition on action tone: defaulted (primary) | ghost
     *
     * Dialog portals its content to document.body, so this also exercises that
     * the portal + Escape-key stack in Dialog.tsx work under jsdom.
     */

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

        expect(screen.getByRole('heading', { name: 'Clear missed' })).toBeInTheDocument();
        expect(screen.getByText('Draft essay')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('covers eyebrow absent: still renders title and children', () => {
        render(
            <ConfirmDialog title="Clear missed" onConfirm={() => {}} onClose={() => {}}>
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        expect(screen.getByRole('heading', { name: 'Clear missed' })).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('covers confirmLabel defaults to "Confirm" when not given', () => {
        render(
            <ConfirmDialog title="Clear missed" onConfirm={() => {}} onClose={() => {}}>
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
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

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

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

        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
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

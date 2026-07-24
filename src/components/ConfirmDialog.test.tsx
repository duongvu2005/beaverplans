import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
    /*
     * Testing strategy
     *     partition on optional props: eyebrow/label present | absent
     *     partition on confirmLabel: given | defaulted
     *     partition on interaction: Cancel click | confirm click | Escape key
     *
     * Dialog portals its content to document.body, so this also exercises that
     * the portal + Escape-key stack in Dialog.tsx work under jsdom.
     */

    it('covers eyebrow and label present: renders title, eyebrow, label, and children', () => {
        render(
            <ConfirmDialog
                title="Clear missed"
                eyebrow="Draft essay"
                label="Heads up"
                onConfirm={() => {}}
                onClose={() => {}}
            >
                <p>Are you sure?</p>
            </ConfirmDialog>,
        );

        expect(screen.getByRole('heading', { name: 'Clear missed' })).toBeInTheDocument();
        expect(screen.getByText('Draft essay')).toBeInTheDocument();
        expect(screen.getByText('Heads up')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('covers eyebrow and label absent: still renders title and children', () => {
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
});

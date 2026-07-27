import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

describe('Dialog', () => {
    /*
     * Testing strategy
     *     partition on open: false (renders nothing) | true
     *     portal: content renders under document.body, not inside the local
     *         render container
     *     partition on interaction: click the scrim | click inside the panel
     *         | Escape key
     *     partition on nesting: a single open dialog | two simultaneously open
     *         dialogs (only the topmost responds to Escape)
     *     scroll lock: locked once the first dialog opens; a nested dialog
     *         closing must not unlock the page while the other is still open
     */

    it('covers open false: renders nothing', () => {
        render(
            <Dialog open={false} onClose={() => {}}>
                <p>content</p>
            </Dialog>,
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('covers open true: portals into document.body, not the local container', () => {
        const { container } = render(
            <Dialog open onClose={() => {}}>
                <p>content</p>
            </Dialog>,
        );
        expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
        expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
        expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('covers clicking the scrim: calls onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose}>
                <p>content</p>
            </Dialog>,
        );

        await user.click(screen.getByRole('dialog').parentElement!);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('covers clicking inside the panel: does not call onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose}>
                <p>content</p>
            </Dialog>,
        );

        await user.click(screen.getByText('content'));

        expect(onClose).not.toHaveBeenCalled();
    });

    it('covers Escape with a single open dialog: calls onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose}>
                <p>content</p>
            </Dialog>,
        );

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('covers Escape with two nested open dialogs: only the topmost (opened later) one closes', async () => {
        // Mirrors real usage (e.g. the weight sheet inside the task editor): the
        // outer dialog opens first, and only later does the user open a second
        // dialog nested inside it -- a separate effect run after the outer's.
        // Mounting both "open" in the same initial render would instead fire the
        // child's effect before the parent's (React's bottom-up commit order),
        // which is not how two dialogs actually come to be open at once.
        const user = userEvent.setup();
        const onCloseOuter = vi.fn();
        const onCloseInner = vi.fn();

        function Wrapper({ innerOpen }: { innerOpen: boolean }) {
            return (
                <Dialog open onClose={onCloseOuter}>
                    <p>outer</p>
                    <Dialog open={innerOpen} onClose={onCloseInner}>
                        <p>inner</p>
                    </Dialog>
                </Dialog>
            );
        }

        const { rerender } = render(<Wrapper innerOpen={false} />);
        rerender(<Wrapper innerOpen={true} />);

        await user.keyboard('{Escape}');

        expect(onCloseInner).toHaveBeenCalledTimes(1);
        expect(onCloseOuter).not.toHaveBeenCalled();
    });

    it('covers scroll lock: set on open, and survives a nested dialog closing while the outer stays open', () => {
        function Wrapper({ innerOpen }: { innerOpen: boolean }) {
            return (
                <Dialog open onClose={() => {}}>
                    <p>outer</p>
                    <Dialog open={innerOpen} onClose={() => {}}>
                        <p>inner</p>
                    </Dialog>
                </Dialog>
            );
        }

        const { rerender, unmount } = render(<Wrapper innerOpen={true} />);
        expect(document.documentElement.classList.contains('dialogOpen')).toBe(true);

        rerender(<Wrapper innerOpen={false} />);
        expect(document.documentElement.classList.contains('dialogOpen')).toBe(true);

        unmount();
        expect(document.documentElement.classList.contains('dialogOpen')).toBe(false);
    });
});

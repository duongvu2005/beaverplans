import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
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
     *     partition on closeOnScrimClick: default (true) | false
     *     partition on nesting: a single open dialog | two simultaneously open
     *         dialogs (only the topmost responds to Escape)
     *     scroll lock: locked once the first dialog opens; a nested dialog
     *         closing must not unlock the page while the other is still open
     *     partition on initial focus: panel takes it | a child claimed it first
     *         (autoFocus), in which case the panel must not steal it back
     *     partition on Tab: forward from the last focusable | backward from the
     *         first | backward from the panel itself | a panel with nothing
     *         focusable in it
     *     partition on Tab with two open dialogs: only the topmost traps
     *     partition on restore: opener still in the document | opener removed
     *         while the dialog was open | a child autoFocused over the opener
     *         before the dialog could record it
     */

    // Focus-order assertions need a focusable outside the dialog to escape to,
    // or "focus stayed inside" is vacuously true.
    function Opener({ children }: { children?: ReactNode }) {
        return (
            <>
                <button>opener</button>
                {children}
            </>
        );
    }

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

    it('covers closeOnScrimClick={false}: clicking the scrim does not call onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} closeOnScrimClick={false}>
                <p>content</p>
            </Dialog>,
        );

        await user.click(screen.getByRole('dialog').parentElement!);

        expect(onClose).not.toHaveBeenCalled();
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
        // The outer dialog must open in its own commit. Mounting both "open" at
        // once fires the child's effect first (React commits bottom-up), which is
        // not the order two dialogs actually come to be open in.
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

    it('covers initial focus: the panel takes it when no child claims it', () => {
        render(
            <Dialog open onClose={() => {}}>
                <button>ok</button>
            </Dialog>,
        );

        expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('covers initial focus: a child with autoFocus keeps it', () => {
        // The panel's focus() runs in a layout effect, which fires after React
        // applies a child's autoFocus in the same commit.
        render(
            <Dialog open onClose={() => {}}>
                <input autoFocus aria-label="field" />
            </Dialog>,
        );

        expect(screen.getByLabelText('field')).toHaveFocus();
    });

    it('covers Tab from the last focusable: wraps to the first, does not leave the dialog', async () => {
        const user = userEvent.setup();
        render(
            <Opener>
                <Dialog open onClose={() => {}}>
                    <button>first</button>
                    <button>last</button>
                </Dialog>
            </Opener>,
        );

        screen.getByRole('button', { name: 'last' }).focus();
        await user.tab();

        expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    });

    it('covers Shift+Tab from the first focusable: wraps to the last', async () => {
        const user = userEvent.setup();
        render(
            <Opener>
                <Dialog open onClose={() => {}}>
                    <button>first</button>
                    <button>last</button>
                </Dialog>
            </Opener>,
        );

        screen.getByRole('button', { name: 'first' }).focus();
        await user.tab({ shift: true });

        expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
    });

    it('covers Shift+Tab from the panel itself: wraps to the last focusable', async () => {
        // The panel holds focus on open, so backwards from it steps straight
        // into the page behind the scrim.
        const user = userEvent.setup();
        render(
            <Opener>
                <Dialog open onClose={() => {}}>
                    <button>first</button>
                    <button>last</button>
                </Dialog>
            </Opener>,
        );

        await user.tab({ shift: true });

        expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
    });

    it('covers a disabled control: skipped, so Tab does not park on it', async () => {
        const user = userEvent.setup();
        render(
            <Opener>
                <Dialog open onClose={() => {}}>
                    <button>first</button>
                    <button disabled>disabled</button>
                </Dialog>
            </Opener>,
        );

        screen.getByRole('button', { name: 'first' }).focus();
        await user.tab();

        expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    });

    it('covers a panel with nothing focusable: Tab keeps focus on the panel', async () => {
        const user = userEvent.setup();
        render(
            <Opener>
                <Dialog open onClose={() => {}}>
                    <p>content</p>
                </Dialog>
            </Opener>,
        );

        await user.tab();

        expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('covers Tab with two nested open dialogs: only the topmost traps', async () => {
        const user = userEvent.setup();

        function Wrapper({ innerOpen }: { innerOpen: boolean }) {
            return (
                <Dialog open onClose={() => {}}>
                    <button>outer</button>
                    <Dialog open={innerOpen} onClose={() => {}}>
                        <button>inner first</button>
                        <button>inner last</button>
                    </Dialog>
                </Dialog>
            );
        }

        const { rerender } = render(<Wrapper innerOpen={false} />);
        rerender(<Wrapper innerOpen={true} />);

        screen.getByRole('button', { name: 'inner last' }).focus();
        await user.tab();

        expect(screen.getByRole('button', { name: 'inner first' })).toHaveFocus();
    });

    it('covers close: focus returns to whatever had it when the dialog opened', () => {
        function Wrapper({ open }: { open: boolean }) {
            return (
                <Opener>
                    <Dialog open={open} onClose={() => {}}>
                        <button>ok</button>
                    </Dialog>
                </Opener>
            );
        }

        const { rerender } = render(<Wrapper open={false} />);
        const opener = screen.getByRole('button', { name: 'opener' });
        opener.focus();

        rerender(<Wrapper open={true} />);
        expect(opener).not.toHaveFocus();

        rerender(<Wrapper open={false} />);
        expect(opener).toHaveFocus();
    });

    it('covers close: restores the opener even when a child autoFocused over it', () => {
        // A child's autoFocus lands before the dialog's own layout effect runs,
        // so capturing the opener there would record the input inside the dialog.
        function Wrapper({ open }: { open: boolean }) {
            return (
                <Opener>
                    <Dialog open={open} onClose={() => {}}>
                        <input autoFocus aria-label="field" />
                    </Dialog>
                </Opener>
            );
        }

        const { rerender } = render(<Wrapper open={false} />);
        const opener = screen.getByRole('button', { name: 'opener' });
        opener.focus();

        rerender(<Wrapper open={true} />);
        expect(screen.getByLabelText('field')).toHaveFocus();

        rerender(<Wrapper open={false} />);
        expect(opener).toHaveFocus();
    });

    it('covers close: an opener removed while the dialog was open is not refocused', () => {
        // A confirm dialog that deletes a row unmounts the very button that
        // opened it, and focus() on a detached node silently does nothing.
        function Wrapper({ open, withOpener }: { open: boolean; withOpener: boolean }) {
            return (
                <>
                    {withOpener && <button>opener</button>}
                    <Dialog open={open} onClose={() => {}}>
                        <button>ok</button>
                    </Dialog>
                </>
            );
        }

        const { rerender } = render(<Wrapper open={false} withOpener />);
        screen.getByRole('button', { name: 'opener' }).focus();

        rerender(<Wrapper open={true} withOpener />);
        rerender(<Wrapper open={true} withOpener={false} />);
        rerender(<Wrapper open={false} withOpener={false} />);

        expect(document.activeElement).toBe(document.body);
    });
});

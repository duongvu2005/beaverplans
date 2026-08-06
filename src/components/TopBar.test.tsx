import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';

describe('TopBar', () => {
    /*
     * Testing strategy
     *     partition on the current view: each of the three
     *     partition on the theme: light | dark, and across a remount
     *     partition on the account sheet: closed | open | dismissed
     *     partition on the user: signed out (Guest + Sign in) | signed in
     *         (the chip is the menu button, and the account rows exist)
     *     cross-cutting: the markup is the same at every width, so what the
     *         phone shows is the same DOM the desktop bar shows
     */

    const SIGNED_IN = { id: 'u1', email: 'you@example.com' };

    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset.theme;
    });

    it('marks the current view and only that one', () => {
        render(
            <TopBar
                view="stats"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: 'stats' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(screen.getByRole('button', { name: 'plan' })).not.toHaveAttribute('aria-current');
    });

    it('reports the view you picked', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={onView}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'archive' }));
        expect(onView).toHaveBeenCalledWith('archive');
    });

    it('the theme toggle flips the document attribute the palette keys off', async () => {
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        expect(document.documentElement.dataset.theme).toBe('light');
        await user.click(screen.getByRole('button', { name: 'Switch to dark' }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        // and the control now offers the way back, rather than repeating itself
        expect(screen.getByRole('button', { name: 'Switch to light' })).toBeInTheDocument();
    });

    it('the choice survives a remount, which is the whole point of storing it', async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Switch to dark' }));
        unmount();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('the account slot opens the sheet the phone folds the right cluster into', async () => {
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        expect(screen.queryByRole('dialog')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        // the three things the bar carries on a desktop, all reachable here
        expect(within(sheet).getByText('Switch to dark')).toBeInTheDocument();
        expect(within(sheet).getByRole('link', { name: /support/i })).toBeInTheDocument();
        expect(within(sheet).getByText('Sign in')).toBeInTheDocument();

        await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('picking the theme from the sheet closes it and applies the change', async () => {
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Account' }));
        await user.click(within(screen.getByRole('dialog')).getByText('Switch to dark'));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('signing in is reachable from both the bar and the sheet', async () => {
        const onOpenAuth = vi.fn();
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={onOpenAuth}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        // in the bar
        await user.click(screen.getByText('Sign in').closest('button')!);
        expect(onOpenAuth).toHaveBeenCalledTimes(1);

        // and in the sheet
        await user.click(screen.getByRole('button', { name: 'Account' }));
        await user.click(
            within(screen.getByRole('dialog')).getByText('Sign in').closest('button')!,
        );
        expect(onOpenAuth).toHaveBeenCalledTimes(2);
    });

    it('signed in the chip replaces Guest and opens the dropdown, not a dialog', async () => {
        const rendered = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        expect(screen.queryByText('Guest')).not.toBeInTheDocument();
        // Signed in there is no bar Sign in/Sign out button at all — both live
        // behind the chip now.
        expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();

        const chip = screen.getByRole('button', { name: /you@example\.com/ });
        expect(chip).toHaveAttribute('aria-expanded', 'false');
        await rendered.click(chip);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(chip).toHaveAttribute('aria-expanded', 'true');
        // a menu under a chip, not a modal over the board
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('the dropdown closes on Escape and on a click outside it', async () => {
        const rendered = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                onOpenAuth={vi.fn()}
                onChangePassword={vi.fn()}
                onSignOut={vi.fn()}
            />,
        );
        const chip = screen.getByRole('button', { name: /you@example\.com/ });

        await rendered.click(chip);
        await rendered.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).toBeNull();

        await rendered.click(chip);
        await rendered.click(screen.getByRole('button', { name: 'stats' }));
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('the dropdown carries the two account actions, each closing it', async () => {
        const onChangePassword = vi.fn();
        const onSignOut = vi.fn();
        const rendered = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                onOpenAuth={vi.fn()}
                onChangePassword={onChangePassword}
                onSignOut={onSignOut}
            />,
        );
        const chip = screen.getByRole('button', { name: /you@example\.com/ });

        await rendered.click(chip);
        await rendered.click(screen.getByRole('menuitem', { name: 'Change password' }));
        expect(onChangePassword).toHaveBeenCalledTimes(1);
        // hands off rather than stacking: the menu is gone before the screen
        // App owns can appear
        expect(screen.queryByRole('menu')).toBeNull();

        await rendered.click(chip);
        await rendered.click(screen.getByRole('menuitem', { name: 'Sign out' }));
        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('the phone sheet carries the same account rows, only when signed in', async () => {
        const onChangePassword = vi.fn();
        const onSignOut = vi.fn();
        const rendered = userEvent.setup();
        const { rerender } = render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onChangePassword={onChangePassword}
                onSignOut={onSignOut}
            />,
        );
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        // nothing to change the password OF as a guest
        expect(within(screen.getByRole('dialog')).queryByText('Change password')).toBeNull();
        await rendered.click(
            within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
        );

        rerender(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                onOpenAuth={vi.fn()}
                onChangePassword={onChangePassword}
                onSignOut={onSignOut}
            />,
        );
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        await rendered.click(within(sheet).getByText('Change password').closest('button')!);
        expect(onChangePassword).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();

        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        await rendered.click(
            within(screen.getByRole('dialog')).getByText('Sign out').closest('button')!,
        );
        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

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
     *     cross-cutting: the markup is the same at every width, so what the
     *         phone shows is the same DOM the desktop bar shows
     */

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

    it('signed in shows the email instead of Guest, and signing out is reachable from both', async () => {
        const onSignOut = vi.fn();
        const authUser = { id: 'u1', email: 'you@example.com' };
        const rendered = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={authUser}
                onOpenAuth={vi.fn()}
                onSignOut={onSignOut}
            />,
        );
        expect(screen.getByText('you@example.com')).toBeInTheDocument();
        expect(screen.queryByText('Guest')).not.toBeInTheDocument();

        // in the bar
        await rendered.click(screen.getByRole('button', { name: 'Sign out' }));
        expect(onSignOut).toHaveBeenCalledTimes(1);

        // and in the sheet
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).getByText('you@example.com')).toBeInTheDocument();
        await rendered.click(within(sheet).getByText('Sign out').closest('button')!);
        expect(onSignOut).toHaveBeenCalledTimes(2);
        // the sheet's Sign out also closes it, unlike Cancel-less rows elsewhere
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

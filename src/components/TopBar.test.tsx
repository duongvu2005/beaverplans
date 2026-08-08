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

    const SIGNED_IN = { id: 'u1', email: 'you@example.com', username: 'duong' };

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
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
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
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
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
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(document.documentElement.dataset.theme).toBe('light');
        // guest or not, the chip is what opens the theme control now
        await user.click(screen.getByRole('button', { name: 'Guest' }));
        await user.click(screen.getByRole('button', { name: 'Dark' }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        // and the control now shows Dark as the picked side, rather than
        // repeating a "switch to" verb the way a single toggle button did
        expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('the choice survives a remount, which is the whole point of storing it', async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Guest' }));
        await user.click(screen.getByRole('button', { name: 'Dark' }));
        unmount();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('the guest chip opens a menu with only the theme in it', async () => {
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Guest' }));
        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('button', { name: 'Light' })).toBeInTheDocument();
        expect(within(menu).getByRole('button', { name: 'Dark' })).toBeInTheDocument();
        // nothing to change the password of, sign out of, or hold data for
        expect(within(menu).queryByRole('menuitem')).toBeNull();
    });

    it('the account slot opens the sheet the phone folds the right cluster into', async () => {
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(screen.queryByRole('dialog')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        // the things the bar carries on a desktop, all reachable here
        expect(within(sheet).getByRole('group', { name: 'Theme' })).toBeInTheDocument();
        expect(within(sheet).getByRole('link', { name: /support/i })).toBeInTheDocument();
        expect(within(sheet).getByText('Sign in')).toBeInTheDocument();

        await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('picking the theme from the sheet applies it and deliberately stays open', async () => {
        const user = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const group = within(screen.getByRole('dialog')).getByRole('group', { name: 'Theme' });
        await user.click(within(group).getByRole('button', { name: 'Dark' }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        // comparing palettes means staying put — the two-state row used to close
        expect(screen.getByRole('dialog')).toBeTruthy();
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
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
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
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
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
                onOpenSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
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
        const onOpenSettings = vi.fn();
        const onSignOut = vi.fn();
        const rendered = userEvent.setup();
        render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                onOpenAuth={vi.fn()}
                onOpenSettings={onOpenSettings}
                onSignOut={onSignOut}
                onOpenData={vi.fn()}
            />,
        );
        const chip = screen.getByRole('button', { name: /you@example\.com/ });

        await rendered.click(chip);
        await rendered.click(screen.getByRole('menuitem', { name: 'Account settings' }));
        expect(onOpenSettings).toHaveBeenCalledTimes(1);
        // hands off rather than stacking: the menu is gone before the screen
        // App owns can appear
        expect(screen.queryByRole('menu')).toBeNull();

        await rendered.click(chip);
        await rendered.click(screen.getByRole('menuitem', { name: 'Sign out' }));
        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('the phone sheet carries the same account rows, only when signed in', async () => {
        const onOpenSettings = vi.fn();
        const onSignOut = vi.fn();
        const rendered = userEvent.setup();
        const { rerender } = render(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={null}
                onOpenAuth={vi.fn()}
                onOpenSettings={onOpenSettings}
                onSignOut={onSignOut}
                onOpenData={vi.fn()}
            />,
        );
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        // nothing to change the password OF as a guest
        expect(within(screen.getByRole('dialog')).queryByText('Account settings')).toBeNull();
        await rendered.click(
            within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
        );

        rerender(
            <TopBar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                onOpenAuth={vi.fn()}
                onOpenSettings={onOpenSettings}
                onSignOut={onSignOut}
                onOpenData={vi.fn()}
            />,
        );
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        await rendered.click(within(sheet).getByText('Account settings').closest('button')!);
        expect(onOpenSettings).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();

        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        await rendered.click(
            within(screen.getByRole('dialog')).getByText('Sign out').closest('button')!,
        );
        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    /*
     * Data & privacy, which unlike the theme is gated on being signed in: a
     * guest's weeks never leave their browser, so nothing is held on their
     * behalf to take a copy of or have erased.
     *   partition on surface: the desktop menu | the phone sheet
     *   partition on the user: guest (absent from both) | signed in (present)
     */

    function renderBar(overrides: Partial<Parameters<typeof TopBar>[0]> = {}) {
        const props = {
            view: 'plan' as const,
            onView: vi.fn(),
            user: null,
            onOpenAuth: vi.fn(),
            onOpenSettings: vi.fn(),
            onSignOut: vi.fn(),
            onOpenData: vi.fn(),
            ...overrides,
        };
        render(<TopBar {...props} />);
        return { ...props, user: userEvent.setup() };
    }

    /*
     * The chip's identity, which is a name now rather than an address:
     *   partition on the user: guest (the word Guest, no avatar) | signed in
     *     (username + avatar, address still in the accessible name)
     */

    it('signed in: the chip shows the username, not the address', () => {
        renderBar({ user: SIGNED_IN });
        const chip = screen.getByRole('button', { name: /^Account: duong/ });
        expect(chip).toHaveTextContent('duong');
        expect(chip).not.toHaveTextContent('you@example.com');
    });

    // A nickname alone does not say WHICH account, which matters to anyone with
    // two — so the address rides along where assistive tech and a tooltip find it.
    it('the address stays reachable from the chip without being displayed', () => {
        renderBar({ user: SIGNED_IN });
        const chip = screen.getByRole('button', { name: 'Account: duong (you@example.com)' });
        expect(chip).toHaveAttribute('title', 'you@example.com');
    });

    it('a guest chip reads Guest and carries no avatar', () => {
        renderBar();
        const chip = screen.getByRole('button', { name: 'Guest' });
        expect(chip.querySelector('svg')).not.toHaveClass(/cat/);
    });

    // Not a CSS test — jsdom applies no stylesheet, and asserting on a hashed
    // module class would be brittle. It guards the STRUCTURAL precondition two
    // CSS rules silently depend on: `.account svg:last-child` sets the caret's
    // 13px size and its open-state rotate, and both were written as :last-child
    // only because an unscoped `.account svg` caught the avatar too — turning
    // the cat upside down on every menu open and clamping it to 13px whatever
    // size prop it was passed (see TopBar.module.css). Append any icon after
    // the chevron and both rules move onto it, reviving both bugs against a
    // stylesheet no one edited. That is what this fails on.
    it('the chevron is the last icon in the chip, which is what the caret CSS targets', () => {
        renderBar({ user: SIGNED_IN });
        const chip = screen.getByRole('button', { name: /^Account: duong/ });
        const icons = [...chip.querySelectorAll('svg')];

        // avatar first, caret last — the caret is the 16-box chevron, the
        // avatar the 100-box drawing, so neither needs a hashed class to spot
        expect(icons).toHaveLength(2);
        expect(icons.at(-1)).toHaveAttribute('viewBox', '0 0 16 16');
        expect(icons[0]).toHaveAttribute('viewBox', '0 0 100 100');
    });

    it('the phone sheet header names the person, with the address beneath', async () => {
        const { user } = renderBar({ user: SIGNED_IN });
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).getByRole('heading', { name: 'duong' })).toBeInTheDocument();
        expect(within(sheet).getByText('you@example.com')).toBeInTheDocument();
    });

    it('the menu opens Data & privacy and closes on the way out', async () => {
        const { user, onOpenData } = renderBar({ user: SIGNED_IN });

        await user.click(screen.getByRole('button', { name: /you@example\.com/ }));
        await user.click(screen.getByRole('menuitem', { name: /data & privacy/i }));
        expect(onOpenData).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('a guest is offered no data panel at all, on either surface', async () => {
        const { user } = renderBar();

        await user.click(screen.getByRole('button', { name: 'Guest' }));
        expect(
            within(screen.getByRole('menu')).queryByRole('menuitem', { name: /data & privacy/i }),
        ).toBeNull();
        await user.keyboard('{Escape}');

        await user.click(screen.getByRole('button', { name: 'Account' }));
        expect(within(screen.getByRole('dialog')).queryByText('Data & privacy')).toBeNull();
    });

    it('the phone sheet carries the same row, and hands off rather than stacking', async () => {
        const { user, onOpenData } = renderBar({ user: SIGNED_IN });
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');

        await user.click(within(sheet).getByText('Data & privacy').closest('button')!);
        expect(onOpenData).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

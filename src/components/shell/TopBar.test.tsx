import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { TopBar } from './TopBar';
import { en } from '@/i18n/en';

/**
 * TopBar is controlled: App owns whether the settings menu is open, because it
 * shares one modal slot with every screen the menu opens. This holds that one
 * bit, so these tests still exercise the chip opening the menu.
 */
function Bar(
    props: Omit<
        Parameters<typeof TopBar>[0],
        'settingsOpen' | 'onOpenSettings' | 'onCloseSettings'
    >,
) {
    const [settingsOpen, setSettingsOpen] = useState(false);
    // App holds the menu in the same slot as every screen it opens, so opening
    // one replaces the menu. TopBar no longer closes itself; this stands in.
    const replacing = (handoff: () => void) => () => {
        setSettingsOpen(false);
        handoff();
    };
    return (
        <TopBar
            {...props}
            settingsOpen={settingsOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onCloseSettings={() => setSettingsOpen(false)}
            onOpenAuth={replacing(props.onOpenAuth)}
            onOpenAccountSettings={replacing(props.onOpenAccountSettings)}
            onOpenData={replacing(props.onOpenData)}
        />
    );
}

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
            <Bar
                view="stats"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: en.topBar.views.stats })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(screen.getByRole('button', { name: en.topBar.views.plan })).not.toHaveAttribute(
            'aria-current',
        );
    });

    it('reports the view you picked', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={onView}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Weeks' }));
        expect(onView).toHaveBeenCalledWith('weeks');
    });

    it('the theme toggle flips the document attribute the palette keys off', async () => {
        const user = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(document.documentElement.dataset.theme).toBe('light');
        // guest or not, the chip is what opens the theme control
        await user.click(screen.getByRole('button', { name: en.topBar.guest }));
        await user.click(screen.getByRole('button', { name: en.themePicker.options.dark }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        // the control shows Dark as the picked side, not a "switch to" verb
        expect(screen.getByRole('button', { name: en.themePicker.options.dark })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('the choice survives a remount, which is the whole point of storing it', async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: en.topBar.guest }));
        await user.click(screen.getByRole('button', { name: en.themePicker.options.dark }));
        unmount();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('the guest chip opens the sheet, the same one the phone slot opens', async () => {
        const user = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: en.topBar.guest }));

        // One list of rows rather than two that have to be kept in step.
        expect(screen.queryByRole('menu')).toBeNull();
        const sheet = screen.getByRole('dialog');
        expect(
            within(sheet).getByRole('group', { name: en.themePicker.label }),
        ).toBeInTheDocument();
        // nothing to change the password of, sign out of, or hold data for
        expect(within(sheet).queryByText(en.accountSheet.data)).toBeNull();
    });

    it('the account slot opens the sheet the phone folds the right cluster into', async () => {
        const user = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(screen.queryByRole('dialog')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        // the things the bar carries on a desktop, all reachable here
        expect(
            within(sheet).getByRole('group', { name: en.themePicker.label }),
        ).toBeInTheDocument();
        expect(within(sheet).getByRole('link', { name: /support/i })).toBeInTheDocument();
        expect(within(sheet).getByText('Sign in')).toBeInTheDocument();

        await user.click(within(sheet).getByRole('button', { name: en.common.close }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('picking the theme from the sheet applies it and deliberately stays open', async () => {
        const user = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const group = within(screen.getByRole('dialog')).getByRole('group', {
            name: en.themePicker.label,
        });
        await user.click(within(group).getByRole('button', { name: en.themePicker.options.dark }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        // comparing palettes means staying put — picking a side leaves it open
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('signing in is reachable from both the bar and the sheet', async () => {
        const onOpenAuth = vi.fn();
        const user = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={onOpenAuth}
                onOpenAccountSettings={vi.fn()}
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

    it('signed in the chip replaces Guest and opens the sheet', async () => {
        const rendered = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );
        expect(screen.queryByText(en.topBar.guest)).not.toBeInTheDocument();
        // signed in, both Sign in and Sign out live behind the chip
        expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();

        const chip = screen.getByRole('button', { name: /you@example\.com/ });
        await rendered.click(chip);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('the chip carries the account rows, each handing off rather than stacking', async () => {
        const onOpenAccountSettings = vi.fn();
        const onSignOut = vi.fn();
        const rendered = userEvent.setup();
        render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={onOpenAccountSettings}
                onSignOut={onSignOut}
                onOpenData={vi.fn()}
            />,
        );
        const chip = screen.getByRole('button', { name: /you@example\.com/ });
        const row = (name: string) =>
            within(screen.getByRole('dialog')).getByText(name).closest('button')!;

        await rendered.click(chip);
        await rendered.click(row(en.accountSheet.accountSettings));
        expect(onOpenAccountSettings).toHaveBeenCalledTimes(1);
        // the sheet goes before App's screen comes, rather than stacking
        expect(screen.queryByRole('dialog')).toBeNull();

        await rendered.click(chip);
        await rendered.click(row(en.accountSheet.signOut));
        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('the phone sheet carries the same account rows, only when signed in', async () => {
        const onOpenAccountSettings = vi.fn();
        const onSignOut = vi.fn();
        const rendered = userEvent.setup();
        const { rerender } = render(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={onOpenAccountSettings}
                onSignOut={onSignOut}
                onOpenData={vi.fn()}
            />,
        );
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        // nothing to change the password OF as a guest
        expect(
            within(screen.getByRole('dialog')).queryByText(en.accountSheet.accountSettings),
        ).toBeNull();
        await rendered.click(
            within(screen.getByRole('dialog')).getByRole('button', { name: en.common.close }),
        );

        rerender(
            <Bar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={onOpenAccountSettings}
                onSignOut={onSignOut}
                onOpenData={vi.fn()}
            />,
        );
        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        await rendered.click(
            within(sheet).getByText(en.accountSheet.accountSettings).closest('button')!,
        );
        expect(onOpenAccountSettings).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();

        await rendered.click(screen.getByRole('button', { name: 'Account' }));
        await rendered.click(
            within(screen.getByRole('dialog'))
                .getByText(en.accountSheet.signOut)
                .closest('button')!,
        );
        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    /*
     * Data & privacy, which unlike the theme is gated on being signed in.
     *   partition on surface: the desktop menu | the phone sheet
     *   partition on the user: guest (absent from both) | signed in (present)
     */

    function renderBar(overrides: Partial<Parameters<typeof Bar>[0]> = {}) {
        const props = {
            view: 'plan' as const,
            onView: vi.fn(),
            user: null,
            guidePref: 'yes' as const,
            onPickGuide: vi.fn(),
            onOpenAuth: vi.fn(),
            onOpenAccountSettings: vi.fn(),
            onSignOut: vi.fn(),
            onOpenData: vi.fn(),
            ...overrides,
        };
        render(<Bar {...props} />);
        return { ...props, user: userEvent.setup() };
    }

    /*
     * The chip's identity, a name rather than an address:
     *   partition on the user: guest (the word Guest, no avatar) | signed in
     *     (username + avatar, address still in the accessible name)
     */

    it('signed in: the chip shows the username, not the address', () => {
        renderBar({ user: SIGNED_IN });
        const chip = screen.getByRole('button', { name: /^Account: duong/ });
        expect(chip).toHaveTextContent('duong');
        expect(chip).not.toHaveTextContent(en.authForm.emailPlaceholder);
    });

    // A nickname alone does not say which account, so the address rides along
    // where assistive tech and a tooltip find it.
    it('the address stays reachable from the chip without being displayed', () => {
        renderBar({ user: SIGNED_IN });
        const chip = screen.getByRole('button', { name: 'Account: duong (you@example.com)' });
        expect(chip).toHaveAttribute('title', 'you@example.com');
    });

    it('a guest chip reads Guest and carries no avatar', () => {
        renderBar();
        const chip = screen.getByRole('button', { name: en.topBar.guest });
        // the dot, not a portrait — a guest has no avatar to show
        expect(chip.querySelector('svg')).toBeNull();
        expect(chip.querySelector('i')).toBeInTheDocument();
    });

    // The caret went with the dropdown, and so did the two `svg:last-child`
    // rules that sized and rotated it. Both would have landed on the avatar,
    // clamping the cat to 13px, so this pins the chip to one icon.
    it('the avatar is the only icon in the chip', () => {
        renderBar({ user: SIGNED_IN });
        const chip = screen.getByRole('button', { name: /^Account: duong/ });
        const icons = [...chip.querySelectorAll('svg')];

        expect(icons).toHaveLength(1);
        expect(icons[0]).toHaveAttribute('viewBox', '0 0 100 100');
    });

    it('the phone sheet header names the person, with the address beneath', async () => {
        const { user } = renderBar({ user: SIGNED_IN });
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).getByRole('heading', { name: 'duong' })).toBeInTheDocument();
        expect(within(sheet).getByText(en.authForm.emailPlaceholder)).toBeInTheDocument();
    });

    it('the chip opens Data & privacy and closes on the way out', async () => {
        const { user, onOpenData } = renderBar({ user: SIGNED_IN });

        await user.click(screen.getByRole('button', { name: /you@example\.com/ }));
        await user.click(
            within(screen.getByRole('dialog')).getByText(en.accountSheet.data).closest('button')!,
        );
        expect(onOpenData).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('a guest is offered no data panel at all, on either surface', async () => {
        const { user } = renderBar();

        await user.click(screen.getByRole('button', { name: en.topBar.guest }));
        expect(within(screen.getByRole('dialog')).queryByText(en.accountSheet.data)).toBeNull();
        await user.click(
            within(screen.getByRole('dialog')).getByRole('button', { name: en.common.close }),
        );

        await user.click(screen.getByRole('button', { name: 'Account' }));
        expect(within(screen.getByRole('dialog')).queryByText(en.accountSheet.data)).toBeNull();
    });

    it('the phone sheet carries the same row, and hands off rather than stacking', async () => {
        const { user, onOpenData } = renderBar({ user: SIGNED_IN });
        await user.click(screen.getByRole('button', { name: 'Account' }));
        const sheet = screen.getByRole('dialog');

        await user.click(within(sheet).getByText(en.accountSheet.data).closest('button')!);
        expect(onOpenData).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // What is pinned is that the tab labels come from the catalog, not that
    // they are those particular words.
    it('covers vi: the tabs, the chip and the utilities are all named', () => {
        renderIn(
            'vi',
            <Bar
                view="plan"
                onView={vi.fn()}
                user={null}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: viCatalog.topBar.views.plan })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(
            screen.getByRole('button', { name: viCatalog.topBar.views.weeks }),
        ).toBeInTheDocument();
        expect(screen.getByText(viCatalog.topBar.guest)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: viCatalog.topBar.signIn })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: en.topBar.views.plan })).toBeNull();
    });

    it('covers vi: the account chip names the account in the accessible label', () => {
        renderIn(
            'vi',
            <Bar
                view="plan"
                onView={vi.fn()}
                user={SIGNED_IN}
                guidePref="yes"
                onPickGuide={vi.fn()}
                onOpenAuth={vi.fn()}
                onOpenAccountSettings={vi.fn()}
                onSignOut={vi.fn()}
                onOpenData={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: viCatalog.topBar.accountOf(SIGNED_IN.username, SIGNED_IN.email),
            }),
        ).toBeInTheDocument();
    });
});

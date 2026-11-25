import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import type { AuthUser } from '@/hooks/useAuth';
import { AccountSheet } from './AccountSheet';

const USER: AuthUser = { id: 'u1', email: 'you@example.com', username: 'duong' };

function defaults(overrides: Partial<Parameters<typeof AccountSheet>[0]> = {}) {
    return {
        themePref: 'system' as const,
        supportUrl: 'https://example.com/support',
        user: USER,
        onClose: vi.fn(),
        onPickTheme: vi.fn(),
        guidePref: 'yes' as const,
        onPickGuide: vi.fn(),
        onSignIn: vi.fn(),
        onOpenAccountSettings: vi.fn(),
        onSignOut: vi.fn(),
        onOpenData: vi.fn(),
        ...overrides,
    };
}

function setup(overrides: Partial<Parameters<typeof AccountSheet>[0]> = {}) {
    const props = defaults(overrides);
    render(<AccountSheet {...props} />);
    return { ...props, user: userEvent.setup() };
}

const sheet = () => screen.getByRole('dialog');
const row = (name: string | RegExp) => within(sheet()).getByText(name).closest('button');

describe('AccountSheet', () => {
    /*
     * Testing strategy
     *   partition on the viewer: guest (one row, no account actions) | signed in
     *   partition on themePref: system (follows the device) | a fixed palette,
     *     since the note under the control names which
     *   every row is a handoff, so each reports and nothing is decided here
     */

    it('signed in: heads with the name and the address under it', () => {
        setup();
        expect(sheet()).toHaveTextContent('duong');
        expect(sheet()).toHaveTextContent(en.authForm.emailPlaceholder);
    });

    it('guest: heads with Guest, and offers only signing in', () => {
        setup({ user: null });
        expect(sheet()).toHaveTextContent(en.topBar.guest);
        expect(within(sheet()).queryByText(en.accountSheet.signOut)).toBeNull();
        expect(within(sheet()).queryByText(en.accountSheet.accountSettings)).toBeNull();
        expect(within(sheet()).queryByText(en.accountSheet.data)).toBeNull();
    });

    // This sheet is a guest's only route to the language on a phone.
    it('guest: the language picker sits under the theme', () => {
        setup({ user: null });

        expect(
            within(sheet()).getByRole('group', { name: en.languagePicker.label }),
        ).toBeInTheDocument();
    });

    it('signed in: language is left to Account settings', () => {
        setup();

        expect(within(sheet()).queryByRole('group', { name: en.languagePicker.label })).toBeNull();
    });

    // The one control here that is not a handoff.
    it('picking a theme reports it and does not close the sheet', async () => {
        const { user, onPickTheme, onClose } = setup({ themePref: 'system' });
        await user.click(
            within(sheet()).getByRole('button', { name: en.themePicker.options.dark }),
        );

        expect(onPickTheme).toHaveBeenCalledWith('dark');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('the account rows hand off', async () => {
        const { user, onOpenData, onOpenAccountSettings } = setup();
        await user.click(row(en.accountSheet.data)!);
        await user.click(row(en.accountSheet.accountSettings)!);

        expect(onOpenData).toHaveBeenCalledTimes(1);
        expect(onOpenAccountSettings).toHaveBeenCalledTimes(1);
    });

    // The only row that also closes: there is nothing behind it to come back to.
    it('signing out closes the sheet on the way', async () => {
        const { user, onSignOut, onClose } = setup();
        await user.click(row(en.accountSheet.signOut)!);

        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    /*
     * Walks the two blocks it reads across to — topBar for Support,
     * dataPrivacyDialog for the row that opens it — and asserts the English is
     * gone: a Vietnamese-only assertion also passes against a component that
     * never reads the catalog.
     */
    it('renders in Vietnamese under a vi provider', () => {
        const copy = viCatalog.accountSheet;
        renderIn('vi', <AccountSheet {...defaults({ themePref: 'light' })} />);

        expect(sheet()).toHaveTextContent(copy.eyebrow);
        expect(sheet()).toHaveTextContent(copy.signOutNote);
        expect(sheet()).toHaveTextContent(copy.accountSettings);
        expect(sheet()).toHaveTextContent(viCatalog.topBar.support);
        expect(sheet()).toHaveTextContent(viCatalog.accountSheet.data);
        expect(sheet()).toHaveTextContent(viCatalog.themePicker.label);
        // The username is the user's own and is never translated.
        expect(sheet()).toHaveTextContent('duong');

        expect(sheet()).not.toHaveTextContent(en.accountSheet.accountSettings);
        expect(sheet()).not.toHaveTextContent(en.accountSheet.data);
    });

    // The guide follows the language exactly: signed in it lives in Account
    // settings, and this sheet is a guest's only route to it on a phone.
    it('offers a guest the guide switch, after the language', () => {
        setup({ user: null });

        const control = within(sheet()).getByRole('switch', { name: en.guideToggle.label });
        expect(
            within(sheet()).getByText(en.languagePicker.label).compareDocumentPosition(control),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('keeps the guide switch out of the signed-in sheet', () => {
        setup();

        expect(within(sheet()).queryByRole('switch')).toBeNull();
    });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { AuthError } from '@/hooks/authError';
import { AccountSettings } from './AccountSettings';

function defaults(overrides: Partial<Parameters<typeof AccountSettings>[0]> = {}) {
    return {
        username: 'duong',
        email: 'you@example.com',
        onClose: vi.fn(),
        onSaveUsername: vi.fn(() => Promise.resolve()),
        onChangePassword: vi.fn(),
        onChangeEmail: vi.fn(),
        guidePref: 'yes' as const,
        onPickGuide: vi.fn(),
        ...overrides,
    };
}

function setup(overrides: Partial<Parameters<typeof AccountSettings>[0]> = {}) {
    const props = defaults(overrides);
    render(<AccountSettings {...props} />);
    return { ...props, user: userEvent.setup() };
}

const panel = () => screen.getByRole('dialog');
const field = () => within(panel()).getByLabelText(en.authForm.usernameLabel);
const save = () => within(panel()).getByRole('button', { name: /^Sav/ });

describe('AccountSettings', () => {
    /*
     * Testing strategy
     *   partition on the username draft: unchanged (Save inert) | changed |
     *     blank/whitespace (still inert — there is no valid empty username)
     *   partition on the save: resolves (reports saved) | rejects (reports why)
     *   the credential rows hand off rather than editing in place
     *   editing after an outcome clears it, so no stale "Saved." survives
     */

    it('seeds the field with the current username', () => {
        setup();
        expect(field()).toHaveValue('duong');
    });

    it('unchanged: Save is inert', () => {
        setup();
        expect(save()).toBeDisabled();
    });

    it('whitespace only: still inert', async () => {
        const { user } = setup();
        await user.clear(field());
        await user.type(field(), '   ');
        expect(save()).toBeDisabled();
    });

    it('trailing whitespace alone is not a change', async () => {
        const { user } = setup();
        await user.type(field(), '  ');
        expect(save()).toBeDisabled();
    });

    it('a real change saves the trimmed value and says so', async () => {
        const { user, onSaveUsername } = setup();
        await user.clear(field());
        await user.type(field(), '  beaver  ');
        await user.click(save());

        expect(onSaveUsername).toHaveBeenCalledWith('beaver');
        expect(await within(panel()).findByText(en.accountSettings.saved)).toBeInTheDocument();
    });

    it('a failed save reports the reason rather than claiming success', async () => {
        const onSaveUsername = vi.fn(() => Promise.reject(new Error('Name already taken.')));
        const { user } = setup({ onSaveUsername });
        await user.clear(field());
        await user.type(field(), 'beaver');
        await user.click(save());

        expect(await within(panel()).findByRole('alert')).toHaveTextContent('Name already taken.');
        expect(within(panel()).queryByText(en.accountSettings.saved)).toBeNull();
    });

    it('editing again clears the previous outcome', async () => {
        const { user } = setup();
        await user.clear(field());
        await user.type(field(), 'beaver');
        await user.click(save());
        expect(await within(panel()).findByText(en.accountSettings.saved)).toBeInTheDocument();

        await user.type(field(), 's');

        expect(within(panel()).queryByText(en.accountSettings.saved)).toBeNull();
    });

    it('shows the current address, and its row hands off', async () => {
        const { user, onChangeEmail } = setup();
        expect(panel()).toHaveTextContent(en.authForm.emailPlaceholder);
        await user.click(
            within(panel()).getByRole('button', { name: en.accountSettings.changeEmail }),
        );
        expect(onChangeEmail).toHaveBeenCalledTimes(1);
    });

    it('no address on the account: says so instead of rendering a blank row', () => {
        setup({ email: undefined });
        expect(panel()).toHaveTextContent(en.accountSettings.noEmail);
    });

    it('the password row hands off rather than editing in place', async () => {
        const { user, onChangePassword } = setup();
        await user.click(within(panel()).getByRole('button', { name: /password/i }));
        expect(onChangePassword).toHaveBeenCalledTimes(1);
    });

    it('the avatar row is present and inert', () => {
        setup();
        expect(panel()).toHaveTextContent(/avatar/i);
        expect(within(panel()).queryByRole('button', { name: /avatar/i })).toBeNull();
    });

    it('Back reports to the caller, which reopens the sheet this came from', async () => {
        const { user, onClose } = setup();
        await user.click(within(panel()).getByRole('button', { name: /^back$/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // This panel is the only way to change the language while signed in, so its
    // presence is asserted here; what the control DOES is LanguagePicker's suite.
    it('carries the language picker', () => {
        setup();
        expect(
            within(panel()).getByRole('group', { name: en.languagePicker.label }),
        ).toBeInTheDocument();
    });

    /*
     * LanguagePicker reads its own block, so it renders Vietnamese whether or
     * not this panel does — hence the panel's own strings, and the English
     * asserted gone.
     */
    it('renders in Vietnamese under a vi provider', () => {
        const copy = viCatalog.accountSettings;
        renderIn('vi', <AccountSettings {...defaults()} />);

        expect(panel()).toHaveTextContent(copy.eyebrow);
        expect(panel()).toHaveTextContent(copy.title);
        expect(panel()).toHaveTextContent(copy.avatarSub);
        // Reads across to authForm, so this proves the borrow as well.
        expect(
            within(panel()).getByLabelText(viCatalog.authForm.usernameLabel),
        ).toBeInTheDocument();
        expect(within(panel()).getByRole('button', { name: copy.changeEmail })).toBeInTheDocument();
        expect(
            within(panel()).getByRole('group', { name: viCatalog.languagePicker.label }),
        ).toBeInTheDocument();

        expect(panel()).not.toHaveTextContent(en.accountSettings.title);
        expect(panel()).not.toHaveTextContent('Everyone gets the cat');
        expect(
            within(panel()).queryByRole('button', { name: en.accountSettings.changeEmail }),
        ).toBeNull();
    });

    // The one refusal useAuth raises here. It arrives as an identity, not a
    // sentence, and gets its words at this end.
    it('a refusal from the hook is named in the language on screen', async () => {
        const onSaveUsername = vi.fn(() => Promise.reject(new AuthError('blank-username')));
        renderIn('vi', <AccountSettings {...defaults({ onSaveUsername })} />);
        const user = userEvent.setup();

        await user.clear(within(panel()).getByLabelText(viCatalog.authForm.usernameLabel));
        await user.type(within(panel()).getByLabelText(viCatalog.authForm.usernameLabel), 'beaver');
        await user.click(within(panel()).getByRole('button', { name: /^Đang lưu|^Lưu/ }));

        expect(await within(panel()).findByRole('alert')).toHaveTextContent(
            viCatalog.authForm.failures['blank-username'],
        );
    });

    it('offers the guide switch under the language', () => {
        setup();

        const controls = within(panel()).getAllByRole('switch');
        expect(controls).toHaveLength(1);
        expect(controls[0]).toHaveAccessibleName(en.guideToggle.label);
        expect(controls[0]).toHaveAttribute('aria-checked', 'true');
        // after the language, which is the other account-side preference
        expect(
            within(panel())
                .getByText(en.languagePicker.label)
                .compareDocumentPosition(controls[0]!),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it.each([
        ['yes', 'no'],
        ['no', 'yes'],
    ] as const)('reports the guide flipped from %s to %s', async (pref, next) => {
        const { onPickGuide, user } = setup({ guidePref: pref });

        await user.click(within(panel()).getByRole('switch'));

        expect(onPickGuide).toHaveBeenCalledWith(next);
    });
});

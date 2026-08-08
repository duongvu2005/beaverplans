import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSettings } from './AccountSettings';

function setup(overrides: Partial<Parameters<typeof AccountSettings>[0]> = {}) {
    const props = {
        username: 'duong',
        email: 'you@example.com',
        onClose: vi.fn(),
        onSaveUsername: vi.fn(() => Promise.resolve()),
        onChangePassword: vi.fn(),
        onChangeEmail: vi.fn(),
        ...overrides,
    };
    render(<AccountSettings {...props} />);
    return { ...props, user: userEvent.setup() };
}

const panel = () => screen.getByRole('dialog');
const field = () => within(panel()).getByLabelText('Username');
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

    // The resting state: nothing to save until something changes.
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
        expect(await within(panel()).findByText('Saved.')).toBeInTheDocument();
    });

    it('a failed save reports the reason rather than claiming success', async () => {
        const onSaveUsername = vi.fn(() => Promise.reject(new Error('Name already taken.')));
        const { user } = setup({ onSaveUsername });
        await user.clear(field());
        await user.type(field(), 'beaver');
        await user.click(save());

        expect(await within(panel()).findByRole('alert')).toHaveTextContent('Name already taken.');
        expect(within(panel()).queryByText('Saved.')).toBeNull();
    });

    // A "Saved." sitting under a field being retyped is a claim about text that
    // is no longer what was saved.
    it('editing again clears the previous outcome', async () => {
        const { user } = setup();
        await user.clear(field());
        await user.type(field(), 'beaver');
        await user.click(save());
        expect(await within(panel()).findByText('Saved.')).toBeInTheDocument();

        await user.type(field(), 's');

        expect(within(panel()).queryByText('Saved.')).toBeNull();
    });

    it('shows the current address, and its row hands off', async () => {
        const { user, onChangeEmail } = setup();
        expect(panel()).toHaveTextContent('you@example.com');
        await user.click(within(panel()).getByRole('button', { name: 'Change email' }));
        expect(onChangeEmail).toHaveBeenCalledTimes(1);
    });

    it('no address on the account: says so instead of rendering a blank row', () => {
        setup({ email: undefined });
        expect(panel()).toHaveTextContent('Not set');
    });

    it('the password row hands off rather than editing in place', async () => {
        const { user, onChangePassword } = setup();
        await user.click(within(panel()).getByRole('button', { name: /password/i }));
        expect(onChangePassword).toHaveBeenCalledTimes(1);
    });

    // Shown rather than hidden, so the panel does not read as one that will never
    // support an avatar — but it is not a button, because there is nothing to press.
    it('the avatar row is present and inert', () => {
        setup();
        expect(panel()).toHaveTextContent(/avatar/i);
        expect(within(panel()).queryByRole('button', { name: /avatar/i })).toBeNull();
    });

    it('Close reports to the caller', async () => {
        const { user, onClose } = setup();
        await user.click(within(panel()).getByRole('button', { name: /^close$/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

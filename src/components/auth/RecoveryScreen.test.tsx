import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { RecoveryScreen } from './RecoveryScreen';

function defaults(overrides: Partial<Parameters<typeof RecoveryScreen>[0]> = {}) {
    return {
        onUpdatePassword: vi.fn(() => Promise.resolve()),
        onDone: vi.fn(),
        onCancel: vi.fn(() => Promise.resolve()),
        ...overrides,
    };
}

describe('RecoveryScreen', () => {
    /*
     * Testing strategy
     *   partition on the pair: too short | mismatched | valid
     *   both refusals are reported before anything is called out: the session is
     *     live, so an unchecked update would go through
     *
     * What App does with onDone/onCancel — releasing the hard gate, signing out
     * — is covered in App.test.tsx, which owns that flow.
     */

    const newPassword = () => screen.getByLabelText(en.changePasswordForm.newLabel);
    const confirm = () => screen.getByLabelText(en.authForm.confirmPasswordLabel);
    const submit = () => screen.getByRole('button', { name: en.recoveryScreen.submit });

    it('too short: says so and does not update', async () => {
        const user = userEvent.setup();
        const props = defaults();
        render(<RecoveryScreen {...props} />);

        await user.type(newPassword(), 'abc');
        await user.type(confirm(), 'abc');
        await user.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent(en.authForm.passwordTooShort);
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
    });

    it('mismatched: says so and does not update', async () => {
        const user = userEvent.setup();
        const props = defaults();
        render(<RecoveryScreen {...props} />);

        await user.type(newPassword(), 'beaverplans');
        await user.type(confirm(), 'beaverplan');
        await user.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent(
            en.changePasswordForm.newPasswordsDontMatch,
        );
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
    });

    it('a matching pair updates and reports done', async () => {
        const user = userEvent.setup();
        const props = defaults();
        render(<RecoveryScreen {...props} />);

        await user.type(newPassword(), 'beaverplans');
        await user.type(confirm(), 'beaverplans');
        await user.click(submit());

        expect(props.onUpdatePassword).toHaveBeenCalledWith('beaverplans');
        expect(props.onDone).toHaveBeenCalledTimes(1);
    });

    // One line by design: a wrapped subtitle pushes the form down and undoes the
    // anchored header.
    it('the subtitle does not restate the title', () => {
        render(<RecoveryScreen {...defaults()} />);

        expect(screen.getByText(en.recoveryScreen.title)).toBeInTheDocument();
        expect(en.recoveryScreen.subtitle).not.toContain(en.recoveryScreen.title);
    });

    /*
     * The borrows from authForm and changePasswordForm are proven too, and the
     * English is asserted gone: Vietnamese-only assertions also pass against a
     * component that never reads the catalog.
     */
    it('renders in Vietnamese under a vi provider', () => {
        const copy = viCatalog.recoveryScreen;
        renderIn('vi', <RecoveryScreen {...defaults()} />);

        expect(screen.getByRole('heading', { name: copy.title })).toBeInTheDocument();
        expect(screen.getByText(copy.subtitle)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: copy.submit })).toBeInTheDocument();
        expect(screen.getByLabelText(viCatalog.changePasswordForm.newLabel)).toBeInTheDocument();
        expect(screen.getByLabelText(viCatalog.authForm.confirmPasswordLabel)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(viCatalog.authForm.atLeast6)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: viCatalog.common.cancel })).toBeInTheDocument();

        expect(screen.queryByText(en.recoveryScreen.title)).toBeNull();
        expect(screen.queryByRole('button', { name: en.recoveryScreen.submit })).toBeNull();
        expect(screen.queryByLabelText(en.changePasswordForm.newLabel)).toBeNull();
    });
});

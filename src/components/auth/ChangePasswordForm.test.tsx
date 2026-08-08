import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordForm } from './ChangePasswordForm';

// The real widget loads a script from hCaptcha and renders in an iframe, which
// jsdom cannot do and which would make every test here a network test. The
// stand-in keeps the one thing the dialog's logic depends on — that a token
// arrives via onVerify, and only when something solves it — as a button the
// test can click.
vi.mock('@hcaptcha/react-hcaptcha', () => ({
    default: ({ onVerify }: { onVerify: (token: string) => void }) => (
        <button type="button" onClick={() => onVerify('captcha-token')}>
            solve captcha
        </button>
    ),
}));

describe('ChangePasswordForm', () => {
    /*
     * Testing strategy
     *     partition on the stage shown: form | changed | sent
     *     partition on validation: current empty | new too short | new !=
     *         confirm | no captcha token | all satisfied
     *     partition on the re-auth answer: confirmed | wrong password |
     *         failed to ask (verify throws)
     *     partition on the update: succeeds | throws
     *     partition on the exit: Cancel | Done (after changed) |
     *         Got it (after sent)
     *
     * The captcha widget is mocked (see above); "solve captcha" standing in for
     * it is the only thing in these tests that is not the real component.
     */

    function setup(overrides: Partial<Parameters<typeof ChangePasswordForm>[0]> = {}): {
        user: ReturnType<typeof userEvent.setup>;
        props: Parameters<typeof ChangePasswordForm>[0];
    } {
        const props = {
            email: 'you@example.com',
            onVerifyPassword: vi.fn().mockResolvedValue(true),
            onUpdatePassword: vi.fn().mockResolvedValue(undefined),
            onResetPassword: vi.fn().mockResolvedValue(undefined),
            onClose: vi.fn(),
            ...overrides,
        };
        const user = userEvent.setup();
        render(<ChangePasswordForm {...props} />);
        return { user, props };
    }

    /** what to type; confirm defaults to whatever `next` is (i.e. no typo) */
    type FillIn = { current?: string; next?: string; confirm?: string };

    /** fill the three fields and solve the captcha — the happy-path preamble */
    async function fillIn(
        user: ReturnType<typeof userEvent.setup>,
        { current = 'old-password', next = 'new-password', confirm }: FillIn = {},
    ) {
        confirm ??= next;
        if (current !== '') await user.type(screen.getByLabelText('Current password'), current);
        if (next !== '') await user.type(screen.getByLabelText('New password'), next);
        if (confirm !== '') await user.type(screen.getByLabelText('Confirm new password'), confirm);
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
    }

    function submit(user: ReturnType<typeof userEvent.setup>) {
        return user.click(screen.getByRole('button', { name: 'Update password' }));
    }

    it('covers all satisfied: verifies the current password, then updates', async () => {
        const { user, props } = setup();
        await fillIn(user);
        await submit(user);

        // the gate runs FIRST, and with the current password — not the new one
        expect(props.onVerifyPassword).toHaveBeenCalledWith('old-password', 'captcha-token');
        expect(props.onUpdatePassword).toHaveBeenCalledWith('new-password');
        expect(screen.getByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    });

    it('covers wrong password: says so, and never reaches the update', async () => {
        const onVerifyPassword = vi.fn().mockResolvedValue(false);
        const { user, props } = setup({ onVerifyPassword });
        await fillIn(user);
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent('Current password is incorrect.');
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
        // still on the form, so it can be retried
        expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    });

    it('covers failed to ask: reports the real problem, not a wrong password', async () => {
        const onVerifyPassword = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
        const { user, props } = setup({ onVerifyPassword });
        await fillIn(user);
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch');
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
    });

    it('covers update throws: surfaces the message and stays on the form', async () => {
        const onUpdatePassword = vi
            .fn()
            .mockRejectedValue(
                new Error('New password should be different from the old password.'),
            );
        const { user } = setup({ onUpdatePassword });
        await fillIn(user);
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent('should be different');
        expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    });

    it('covers current empty: asks for it before anything else', async () => {
        const { user, props } = setup();
        await fillIn(user, { current: '' });
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent('Enter your current password.');
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers new too short: rejects before spending a re-auth', async () => {
        const { user, props } = setup();
        await fillIn(user, { next: 'short' });
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent('at least 6 characters');
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers new != confirm: catches the typo locally', async () => {
        const { user, props } = setup();
        await fillIn(user, { next: 'new-password', confirm: 'new-passwrod' });
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent("Those passwords don't match.");
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers no captcha token: asks for it rather than calling with none', async () => {
        const { user, props } = setup();
        await user.type(screen.getByLabelText('Current password'), 'old-password');
        await user.type(screen.getByLabelText('New password'), 'new-password');
        await user.type(screen.getByLabelText('Confirm new password'), 'new-password');
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent("Confirm you're human first.");
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers sent: the forgotten-password escape hatch emails the account', async () => {
        const { user, props } = setup();
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(screen.getByRole('button', { name: 'Forgot your current password?' }));

        expect(props.onResetPassword).toHaveBeenCalledWith('you@example.com', 'captcha-token');
        expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
        expect(screen.getByText(/you@example\.com/)).toBeInTheDocument();
        // it is an escape from the gate, so it must not have touched the password
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
    });

    it('covers the exits: Cancel, and the button on each outcome panel', async () => {
        const { user, props } = setup();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        await fillIn(user);
        await submit(user);
        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });
});

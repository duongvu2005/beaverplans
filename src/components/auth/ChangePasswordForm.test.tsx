import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordForm } from './ChangePasswordForm';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

// hCaptcha never loads in jsdom; the stub hands a token to onVerify the way the
// real widget does, and only when something solves it.
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
        if (current !== '')
            await user.type(screen.getByLabelText(en.changePasswordForm.currentLabel), current);
        if (next !== '')
            await user.type(screen.getByLabelText(en.changePasswordForm.newLabel), next);
        if (confirm !== '')
            await user.type(screen.getByLabelText(en.changePasswordForm.confirmNewLabel), confirm);
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
    }

    function submit(user: ReturnType<typeof userEvent.setup>) {
        return user.click(screen.getByRole('button', { name: en.changePasswordForm.submit }));
    }

    it('covers all satisfied: verifies the current password, then updates', async () => {
        const { user, props } = setup();
        await fillIn(user);
        await submit(user);

        // the gate runs FIRST, and with the current password — not the new one
        expect(props.onVerifyPassword).toHaveBeenCalledWith('old-password', 'captcha-token');
        expect(props.onUpdatePassword).toHaveBeenCalledWith('new-password');
        expect(
            screen.getByRole('heading', { name: en.changePasswordForm.changedTitle }),
        ).toBeInTheDocument();
    });

    it('covers wrong password: says so, and never reaches the update', async () => {
        const onVerifyPassword = vi.fn().mockResolvedValue(false);
        const { user, props } = setup({ onVerifyPassword });
        await fillIn(user);
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent(en.changePasswordForm.currentIncorrect);
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
        // still on the form, so it can be retried
        expect(
            screen.getByRole('heading', { name: en.changePasswordForm.title }),
        ).toBeInTheDocument();
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
        expect(
            screen.getByRole('heading', { name: en.changePasswordForm.title }),
        ).toBeInTheDocument();
    });

    it('covers current empty: asks for it before anything else', async () => {
        const { user, props } = setup();
        await fillIn(user, { current: '' });
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent(en.changePasswordForm.enterCurrent);
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers new too short: rejects before spending a re-auth', async () => {
        const { user, props } = setup();
        await fillIn(user, { next: 'short' });
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent(en.authForm.atLeast6);
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers new != confirm: catches the typo locally', async () => {
        const { user, props } = setup();
        await fillIn(user, { next: 'new-password', confirm: 'new-passwrod' });
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent(
            en.changePasswordForm.newPasswordsDontMatch,
        );
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers no captcha token: asks for it rather than calling with none', async () => {
        const { user, props } = setup();
        await user.type(screen.getByLabelText(en.changePasswordForm.currentLabel), 'old-password');
        await user.type(screen.getByLabelText(en.changePasswordForm.newLabel), 'new-password');
        await user.type(
            screen.getByLabelText(en.changePasswordForm.confirmNewLabel),
            'new-password',
        );
        await submit(user);

        expect(screen.getByRole('alert')).toHaveTextContent(en.authForm.humanFirst);
        expect(props.onVerifyPassword).not.toHaveBeenCalled();
    });

    it('covers sent: the forgotten-password escape hatch emails the account', async () => {
        const { user, props } = setup();
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(screen.getByRole('button', { name: en.changePasswordForm.forgotCurrent }));

        expect(props.onResetPassword).toHaveBeenCalledWith('you@example.com', 'captcha-token');
        expect(
            screen.getByRole('heading', { name: en.authForm.checkYourEmail }),
        ).toBeInTheDocument();
        expect(screen.getByText(/you@example\.com/)).toBeInTheDocument();
        // it is an escape from the gate, so it must not have touched the password
        expect(props.onUpdatePassword).not.toHaveBeenCalled();
    });

    it('covers the exits: Cancel, and the button on each outcome panel', async () => {
        const { user, props } = setup();
        await user.click(screen.getByRole('button', { name: en.common.cancel }));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        await fillIn(user);
        await submit(user);
        await user.click(screen.getByRole('button', { name: en.common.done }));
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    // Three password labels that have to stay distinguishable from one another
    // in translation, and the outcome panel behind them.
    it('covers vi: the three fields and the panel that follows them', async () => {
        renderIn(
            'vi',
            <ChangePasswordForm
                email="you@example.com"
                onVerifyPassword={vi.fn().mockResolvedValue(true)}
                onUpdatePassword={vi.fn().mockResolvedValue(undefined)}
                onResetPassword={vi.fn().mockResolvedValue(undefined)}
                onClose={vi.fn()}
            />,
        );
        const user = userEvent.setup();
        const { authForm, changePasswordForm, common } = viCatalog;

        expect(screen.getByRole('heading', { name: changePasswordForm.title })).toBeInTheDocument();
        await user.type(screen.getByLabelText(changePasswordForm.currentLabel), 'old-password');
        await user.type(screen.getByLabelText(changePasswordForm.newLabel), 'new-password');
        await user.type(screen.getByLabelText(changePasswordForm.confirmNewLabel), 'new-password');
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(screen.getByRole('button', { name: changePasswordForm.submit }));

        expect(
            await screen.findByRole('heading', { name: changePasswordForm.changedTitle }),
        ).toBeInTheDocument();
        expect(screen.getByText(changePasswordForm.changedBody)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: common.done })).toBeInTheDocument();
        // Two of them: the corner close button carries it as an aria-label and
        // the foot repeats it as visible text.
        expect(screen.getAllByRole('button', { name: authForm.backToWeek })).toHaveLength(2);
    });
});

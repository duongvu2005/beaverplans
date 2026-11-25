import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from './AuthForm';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

// hCaptcha never loads in jsdom; the stub hands a token to onVerify the way the
// real widget does.
vi.mock('@hcaptcha/react-hcaptcha', () => ({
    default: ({ onVerify }: { onVerify: (token: string) => void }) => (
        <button type="button" onClick={() => onVerify('captcha-token')}>
            solve captcha
        </button>
    ),
}));

describe('AuthForm — the confirmation-pending screen', () => {
    /*
     * Testing strategy — the rest of this form is covered through App.test.tsx.
     * Only reachable here: the dead end a signup lands in when the confirmation
     * mail never arrives, and the resend that gets out of it.
     *
     *   partition on the press: with no captcha solved (arms it) | with one
     *       (sends) | during the cooldown (refused by the button itself)
     *   partition on the outcome: sent | the server refuses
     *   partition on the copy: says the mail is away | must NOT say whether the
     *       address had an account, which is what this whole screen conceals
     *
     * The cooldown is asserted on a fake clock — a real 60s wait, otherwise.
     */

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Signs up, so the form is showing its "check your email" state. */
    async function pending(
        onResendConfirmation: (email: string, token: string) => Promise<void> = () =>
            Promise.resolve(),
    ) {
        const resend = vi.fn(onResendConfirmation);
        const onSubmit = vi.fn().mockResolvedValue({ confirmationRequired: true });
        render(
            <AuthForm
                initialMode="signup"
                onCancel={vi.fn()}
                onSubmit={onSubmit}
                onResendConfirmation={resend}
            />,
        );
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        await user.type(screen.getByLabelText(en.authForm.emailLabel), 'new@example.com');
        await user.type(screen.getByLabelText(en.authForm.usernameLabel), 'duong');
        await user.type(screen.getByLabelText(en.authForm.passwordLabel), 'hunter2');
        await user.type(screen.getByLabelText(en.authForm.confirmPasswordLabel), 'hunter2');
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(screen.getByRole('button', { name: en.authForm.submits.signup }));

        expect(await screen.findByText(en.authForm.checkYourEmail)).toBeInTheDocument();
        return { user, resend };
    }

    const resendButton = () => screen.getByRole('button', { name: /Send it again/ });

    it('offers a resend, with no captcha in the way until it is pressed', async () => {
        await pending();

        expect(resendButton()).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'solve captcha' })).not.toBeInTheDocument();
    });

    it('the first press reveals the captcha and sends nothing', async () => {
        const { user, resend } = await pending();

        await user.click(resendButton());

        expect(screen.getByRole('button', { name: 'solve captcha' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(en.authForm.resendArmed);
        expect(resend).not.toHaveBeenCalled();
    });

    it('the second press, with the captcha solved, sends to the address on screen', async () => {
        const { user, resend } = await pending();

        await user.click(resendButton());
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(resendButton());

        expect(resend).toHaveBeenCalledWith('new@example.com', 'captcha-token');
    });

    it('says the mail is away without saying whether there was an account', async () => {
        const { user } = await pending();

        await user.click(resendButton());
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(resendButton());

        const notice = await screen.findByText(/^Sent/);
        expect(notice).toHaveTextContent('check your spam folder');
        expect(notice.textContent).not.toMatch(/already|registered|exists|new account/i);
    });

    it('counts down before allowing another, then re-enables itself', async () => {
        const { user } = await pending();

        await user.click(resendButton());
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(resendButton());

        expect(screen.getByRole('button', { name: 'Send it again in 60s' })).toBeDisabled();

        await vi.advanceTimersByTimeAsync(60_000);

        expect(screen.getByRole('button', { name: en.authForm.sendAgain })).toBeEnabled();
    });

    it('reports a rate limit and stays pressable once it clears', async () => {
        const { user } = await pending(() => Promise.reject(new Error('For security purposes…')));

        await user.click(resendButton());
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(resendButton());

        expect(await screen.findByRole('alert')).toHaveTextContent('For security purposes…');
        expect(resendButton()).toBeEnabled(); // no cooldown started — nothing was sent
    });

    it('"Use a different email" returns to the form with the address kept', async () => {
        const { user } = await pending();

        await user.click(screen.getByRole('button', { name: en.authForm.useDifferentEmail }));

        expect(screen.getByLabelText(en.authForm.emailLabel)).toHaveValue('new@example.com');
        expect(screen.queryByText(en.authForm.checkYourEmail)).not.toBeInTheDocument();
    });

    /*
     * Title, subtitle, submit label and switch line are four records keyed by
     * AuthMode, so a mode left hard-coded stays invisible until someone switches
     * into it. Walking all three is what catches that.
     */
    it('covers vi: every mode names itself from the catalog', async () => {
        renderIn(
            'vi',
            <AuthForm
                initialMode="signin"
                onCancel={vi.fn()}
                onSubmit={vi.fn()}
                onResendConfirmation={vi.fn()}
            />,
        );
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const { authForm } = viCatalog;

        expect(screen.getByRole('heading', { name: authForm.titles.signin })).toBeInTheDocument();
        expect(screen.getByText(authForm.subtitles.signin)).toBeInTheDocument();
        expect(screen.getByText(authForm.switches.signin.prompt)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: authForm.forgotPassword })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: authForm.switches.signin.action }));
        expect(screen.getByRole('heading', { name: authForm.titles.signup })).toBeInTheDocument();
        expect(screen.getByText(authForm.subtitles.signup)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: authForm.submits.signup })).toBeInTheDocument();
        expect(screen.getByLabelText(authForm.usernameLabel)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: authForm.switches.signup.action }));
        await user.click(screen.getByRole('button', { name: authForm.forgotPassword }));
        expect(screen.getByRole('heading', { name: authForm.titles.reset })).toBeInTheDocument();
        expect(screen.getByText(authForm.subtitles.reset)).toBeInTheDocument();

        expect(screen.queryByText(en.authForm.subtitles.signin)).toBeNull();
    });

    // The validation errors share one channel, so one of them proves it. This is
    // the first check, so it is reachable without solving anything.
    it('covers vi: a validation error speaks Vietnamese', async () => {
        renderIn(
            'vi',
            <AuthForm
                initialMode="signin"
                onCancel={vi.fn()}
                onSubmit={vi.fn()}
                onResendConfirmation={vi.fn()}
            />,
        );
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        await user.click(screen.getByRole('button', { name: viCatalog.authForm.submits.signin }));

        expect(screen.getByRole('alert')).toHaveTextContent(viCatalog.authForm.enterEmail);
    });
});

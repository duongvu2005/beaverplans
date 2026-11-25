import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeEmailForm } from './ChangeEmailForm';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

// hCaptcha never loads in jsdom; the stub hands a token to onVerify the way the
// real widget does. Without it every test stops at "Confirm you're human first."
vi.mock('@hcaptcha/react-hcaptcha', () => ({
    default: ({ onVerify }: { onVerify: (token: string) => void }) => (
        <button type="button" onClick={() => onVerify('captcha-token')}>
            solve captcha
        </button>
    ),
}));

describe('ChangeEmailForm', () => {
    /*
     * Testing strategy — two things this screen can get wrong. It can claim the
     * address changed, when the request only sends a link and the account keeps
     * its old address until that link is opened. And it can let the change
     * through on a live session alone: only the NEW address is mailed, so the
     * old inbox is not a second gate and the password is the only one.
     *
     *   partition on the entry: blank | no @ | @ at an edge | the address
     *       already on the account | a valid new one
     *   partition on the password: missing | wrong | right
     *   partition on the captcha: unsolved | solved
     *   partition on the outcome: the mail is away | the request is refused
     *   partition on the success copy: names the new address | names the old one
     *       as the one that still signs you in | does not promise a second link
     */

    type Verify = (password: string, captchaToken: string) => Promise<boolean>;
    type Update = (email: string) => Promise<void>;

    function setup(
        overrides: {
            onVerifyPassword?: Verify;
            onUpdateEmail?: Update;
        } = {},
    ) {
        const onVerifyPassword = vi.fn<Verify>(
            overrides.onVerifyPassword ?? (() => Promise.resolve(true)),
        );
        const onUpdateEmail = vi.fn<Update>(overrides.onUpdateEmail ?? (() => Promise.resolve()));
        const onClose = vi.fn();
        render(
            <ChangeEmailForm
                email="old@example.com"
                onVerifyPassword={onVerifyPassword}
                onUpdateEmail={onUpdateEmail}
                onClose={onClose}
            />,
        );
        return { user: userEvent.setup(), onVerifyPassword, onUpdateEmail, onClose };
    }

    const field = () => screen.getByLabelText(en.changeEmailForm.newLabel);
    const password = () => screen.getByLabelText(en.authForm.passwordLabel);
    const send = () => screen.getByRole('button', { name: en.changeEmailForm.submit });
    const solveCaptcha = () => screen.getByRole('button', { name: 'solve captcha' });

    it.each([
        { covers: 'blank', type: '', want: en.changeEmailForm.enterNew },
        { covers: 'no @', type: 'nope', want: en.changeEmailForm.notAnEmail },
        {
            covers: '@ leading',
            type: '@example.com',
            want: en.changeEmailForm.notAnEmail,
        },
        {
            covers: '@ trailing',
            type: 'someone@',
            want: en.changeEmailForm.notAnEmail,
        },
        {
            covers: 'the address already on the account',
            type: 'old@example.com',
            want: en.changeEmailForm.alreadyYours,
        },
    ])('refuses to send for $covers, without reaching the server', async ({ type, want }) => {
        const { user, onVerifyPassword, onUpdateEmail } = setup();

        if (type !== '') await user.type(field(), type);
        await user.type(password(), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(screen.getByRole('alert')).toHaveTextContent(want);
        expect(onVerifyPassword).not.toHaveBeenCalled();
        expect(onUpdateEmail).not.toHaveBeenCalled();
    });

    it('refuses without a password, without reaching the server', async () => {
        const { user, onVerifyPassword, onUpdateEmail } = setup();

        await user.type(field(), 'new@example.com');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(screen.getByRole('alert')).toHaveTextContent(en.authForm.enterPasswordToConfirm);
        expect(onVerifyPassword).not.toHaveBeenCalled();
        expect(onUpdateEmail).not.toHaveBeenCalled();
    });

    it('refuses without a solved captcha, without reaching the server', async () => {
        const { user, onVerifyPassword, onUpdateEmail } = setup();

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'hunter2');
        await user.click(send());

        expect(screen.getByRole('alert')).toHaveTextContent(en.authForm.humanFirst);
        expect(onVerifyPassword).not.toHaveBeenCalled();
        expect(onUpdateEmail).not.toHaveBeenCalled();
    });

    // The security property of the whole screen. Only the new address is mailed,
    // so nothing downstream re-checks who asked for the change.
    it('does not ask for the change when the password is wrong', async () => {
        const { user, onUpdateEmail } = setup({ onVerifyPassword: () => Promise.resolve(false) });

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'wrong');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(await screen.findByRole('alert')).toHaveTextContent(en.authForm.passwordIncorrect);
        expect(onUpdateEmail).not.toHaveBeenCalled();
        expect(field()).toHaveValue('new@example.com');
    });

    it('verifies the password before asking for the change, not after', async () => {
        const calls: string[] = [];
        const { user } = setup({
            onVerifyPassword: () => {
                calls.push('verify');
                return Promise.resolve(true);
            },
            onUpdateEmail: () => {
                calls.push('update');
                return Promise.resolve();
            },
        });

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(await screen.findByText(en.changeEmailForm.sentTitle)).toBeInTheDocument();
        expect(calls).toEqual(['verify', 'update']);
    });

    it('trims the address before sending it', async () => {
        const { user, onUpdateEmail } = setup();

        await user.type(field(), '  new@example.com  ');
        await user.type(password(), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(onUpdateEmail).toHaveBeenCalledWith('new@example.com');
    });

    it('reports the mail as sent, not the address as changed', async () => {
        const { user } = setup();

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(await screen.findByText(en.changeEmailForm.sentTitle)).toBeInTheDocument();
        // The panel as a whole — lead, address and hints are separate elements.
        const sent = screen.getByRole('status');
        expect(sent).toHaveTextContent(en.authForm.sentLinkTo);
        expect(sent).toHaveTextContent('new@example.com');
        // The old address is named for one reason only: it is what still signs
        // you in until the link is opened.
        expect(sent).toHaveTextContent(/continue signing in with/);
        expect(sent).toHaveTextContent('old@example.com');
        expect(screen.queryByText(/Saved/)).not.toBeInTheDocument();
    });

    // One link is sent, to the new address. Copy asking for two would strand
    // people waiting on mail that never comes.
    it('does not promise a link to the old address', async () => {
        const { user } = setup();

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(await screen.findByText(en.changeEmailForm.sentTitle)).toBeInTheDocument();
        expect(screen.queryByText(/Confirmation links/)).not.toBeInTheDocument();
        expect(screen.queryByText(/open\s*both/i)).not.toBeInTheDocument();
    });

    it('keeps the form, and the typed address, when the request is refused', async () => {
        const { user } = setup({
            onUpdateEmail: () => Promise.reject(new Error('Email rate limit exceeded')),
        });

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(send());

        expect(await screen.findByRole('alert')).toHaveTextContent('Email rate limit exceeded');
        expect(field()).toHaveValue('new@example.com');
        expect(send()).toBeEnabled();
    });

    it('spends the captcha token on a failed attempt, so the next press re-solves', async () => {
        const { user, onVerifyPassword } = setup({
            onVerifyPassword: () => Promise.resolve(false),
        });

        await user.type(field(), 'new@example.com');
        await user.type(password(), 'wrong');
        await user.click(solveCaptcha());
        await user.click(send());
        expect(await screen.findByRole('alert')).toHaveTextContent(en.authForm.passwordIncorrect);

        await user.click(send());

        expect(screen.getByRole('alert')).toHaveTextContent(en.authForm.humanFirst);
        expect(onVerifyPassword).toHaveBeenCalledTimes(1);
    });

    /*
     * The success state is the half that has to say the change has NOT happened
     * yet, naming the new address and the old one in the same breath. Both of
     * those sentences are catalog functions.
     */
    it('covers vi: the form and the state that follows it', async () => {
        const onVerifyPassword = vi.fn<Verify>(() => Promise.resolve(true));
        const onUpdateEmail = vi.fn<Update>(() => Promise.resolve());
        renderIn(
            'vi',
            <ChangeEmailForm
                email="old@example.com"
                onVerifyPassword={onVerifyPassword}
                onUpdateEmail={onUpdateEmail}
                onClose={vi.fn()}
            />,
        );
        const user = userEvent.setup();
        const { authForm, changeEmailForm, common } = viCatalog;

        expect(screen.getByRole('heading', { name: changeEmailForm.title })).toBeInTheDocument();
        expect(
            screen.getByText(changeEmailForm.currentlyUsing('old@example.com')),
        ).toBeInTheDocument();

        await user.type(screen.getByLabelText(changeEmailForm.newLabel), 'new@example.com');
        await user.type(screen.getByLabelText(authForm.passwordLabel), 'hunter2');
        await user.click(screen.getByRole('button', { name: 'solve captcha' }));
        await user.click(screen.getByRole('button', { name: changeEmailForm.submit }));

        expect(
            await screen.findByRole('heading', { name: changeEmailForm.sentTitle }),
        ).toBeInTheDocument();
        expect(screen.getByText(authForm.sentLinkTo)).toBeInTheDocument();
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
        expect(
            screen.getByText(changeEmailForm.untilConfirmed('old@example.com')),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: common.done })).toBeInTheDocument();
    });

    it('covers vi: an account with no address falls back to a translated stand-in', () => {
        renderIn(
            'vi',
            <ChangeEmailForm
                email={undefined}
                onVerifyPassword={() => Promise.resolve(true)}
                onUpdateEmail={() => Promise.resolve()}
                onClose={vi.fn()}
            />,
        );

        expect(
            screen.getByText(
                viCatalog.changeEmailForm.currentlyUsing(viCatalog.changeEmailForm.notSet),
            ),
        ).toBeInTheDocument();
    });
});

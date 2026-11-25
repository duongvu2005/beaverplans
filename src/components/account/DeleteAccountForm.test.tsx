import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAccountForm } from './DeleteAccountForm';
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

describe('DeleteAccountForm', () => {
    /*
     * Testing strategy — the password gate is the whole point: a live session
     * only proves the browser was left signed in.
     *
     *   partition on the password: missing | wrong | right
     *   partition on the captcha: unsolved | solved
     *   partition on the delete itself: succeeds | the server refuses
     *   partition on the warning copy: 1 week (singular) | several (plural)
     *
     * There is no success case to assert on screen: deleting signs the browser
     * out, and App unmounts this. What IS asserted is that the delete ran.
     */

    type Verify = (password: string, captchaToken: string) => Promise<boolean>;
    type Delete = () => Promise<void>;

    function setup(
        overrides: {
            weekCount?: number;
            onVerifyPassword?: Verify;
            onDeleteAccount?: Delete;
        } = {},
    ) {
        const onVerifyPassword = vi.fn<Verify>(
            overrides.onVerifyPassword ?? (() => Promise.resolve(true)),
        );
        const onDeleteAccount = vi.fn<Delete>(
            overrides.onDeleteAccount ?? (() => Promise.resolve()),
        );
        const onClose = vi.fn();
        render(
            <DeleteAccountForm
                weekCount={overrides.weekCount ?? 3}
                onVerifyPassword={onVerifyPassword}
                onDeleteAccount={onDeleteAccount}
                onClose={onClose}
            />,
        );
        return { user: userEvent.setup(), onVerifyPassword, onDeleteAccount, onClose };
    }

    const submit = () => screen.getByRole('button', { name: en.deleteAccountForm.submit });
    const solveCaptcha = () => screen.getByRole('button', { name: 'solve captcha' });

    it('names the week count, so you can tell what is going', () => {
        setup();
        expect(screen.getByText(/permanently deletes your account and all 3 weeks/)).toBeTruthy();
    });

    it('says "the 1 week" rather than "all 1 weeks"', () => {
        setup({ weekCount: 1 });
        expect(screen.getByText(/deletes your account and the 1 week/)).toBeTruthy();
    });

    it('refuses without a password, and never reaches the server', async () => {
        const { user, onVerifyPassword, onDeleteAccount } = setup();

        await user.click(solveCaptcha());
        await user.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent(
            en.authForm.enterPasswordToConfirm,
        );
        expect(onVerifyPassword).not.toHaveBeenCalled();
        expect(onDeleteAccount).not.toHaveBeenCalled();
    });

    it('refuses without a solved captcha', async () => {
        const { user, onVerifyPassword } = setup();

        await user.type(screen.getByLabelText(en.authForm.passwordLabel), 'hunter2');
        await user.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent(en.authForm.humanFirst);
        expect(onVerifyPassword).not.toHaveBeenCalled();
    });

    it('does not delete when the password is wrong', async () => {
        const { user, onDeleteAccount } = setup({
            onVerifyPassword: () => Promise.resolve(false),
        });

        await user.type(screen.getByLabelText(en.authForm.passwordLabel), 'wrong');
        await user.click(solveCaptcha());
        await user.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent(en.authForm.passwordIncorrect);
        expect(onDeleteAccount).not.toHaveBeenCalled();
    });

    it('deletes once the password is confirmed', async () => {
        const { user, onVerifyPassword, onDeleteAccount } = setup();

        await user.type(screen.getByLabelText(en.authForm.passwordLabel), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(submit());

        expect(onVerifyPassword).toHaveBeenCalledWith('hunter2', 'captcha-token');
        expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it('reports a refusal from the server rather than closing on it', async () => {
        const { user, onClose } = setup({
            onDeleteAccount: () => Promise.reject(new Error('no account to delete')),
        });

        await user.type(screen.getByLabelText(en.authForm.passwordLabel), 'hunter2');
        await user.click(solveCaptcha());
        await user.click(submit());

        expect(await screen.findByRole('alert')).toHaveTextContent('no account to delete');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('"Keep my account" backs out without touching anything', async () => {
        const { user, onClose, onDeleteAccount } = setup();

        await user.click(screen.getByRole('button', { name: en.deleteAccountForm.keepAccount }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onDeleteAccount).not.toHaveBeenCalled();
    });

    /*
     * The warning is the one entry where English inflects (`the 1 week` /
     * `all 3 weeks`) and Vietnamese does not, so both counts are walked.
     */
    it('covers vi: the warning names the account and the count', () => {
        renderIn(
            'vi',
            <DeleteAccountForm
                weekCount={3}
                onVerifyPassword={() => Promise.resolve(true)}
                onDeleteAccount={() => Promise.resolve()}
                onClose={vi.fn()}
            />,
        );
        const { authForm, deleteAccountForm } = viCatalog;

        expect(screen.getByRole('heading', { name: deleteAccountForm.title })).toBeInTheDocument();
        expect(screen.getByText(deleteAccountForm.warning(3))).toBeInTheDocument();
        // Read across from authForm, which owns the shared field furniture.
        expect(screen.getByLabelText(authForm.passwordLabel)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: deleteAccountForm.submit })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: deleteAccountForm.keepAccount }),
        ).toBeInTheDocument();

        expect(screen.queryByText(/permanently deletes/)).toBeNull();
    });

    it('covers vi: one week reads the same as many', () => {
        renderIn(
            'vi',
            <DeleteAccountForm
                weekCount={1}
                onVerifyPassword={() => Promise.resolve(true)}
                onDeleteAccount={() => Promise.resolve()}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText(viCatalog.deleteAccountForm.warning(1))).toBeInTheDocument();
    });
});

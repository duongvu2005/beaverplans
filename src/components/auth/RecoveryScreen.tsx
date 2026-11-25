import { useState, type SubmitEvent } from 'react';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import authStyles from './AuthForm.module.css';
import page from './RecoveryScreen.module.css';

type RecoveryScreenProps = {
    onUpdatePassword: (password: string) => Promise<void>;
    // Called after a successful password update — clears the recovering flag
    // so App's hard gate releases into the normal signed-in app.
    onDone: () => void;
    // Signs out and clears the recovering flag; async because signing out can fail.
    onCancel: () => Promise<void>;
};

/** Lands here when a password-reset link is followed, as a hard gate before the app. */
export function RecoveryScreen({ onUpdatePassword, onDone, onCancel }: RecoveryScreenProps) {
    const { common, authForm, changePasswordForm, recoveryScreen } = useCopy();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const titleId = 'recovery-screen-title';
    const formId = 'recovery-form';

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        if (password.length < 6) {
            setError(authForm.passwordTooShort);
            return;
        }
        if (password !== confirmPassword) {
            setError(changePasswordForm.newPasswordsDontMatch);
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onUpdatePassword(password);
            onDone();
        } catch (err) {
            setError(err instanceof Error ? err.message : authForm.somethingWrong);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel() {
        setCancelling(true);
        setError(null);
        try {
            await onCancel();
        } catch (err) {
            setError(err instanceof Error ? err.message : authForm.somethingWrong);
        } finally {
            setCancelling(false);
        }
    }

    return (
        <div className={page.page}>
            <div className={authStyles.wrap}>
                <div className={authStyles.head}>
                    <h1 id={titleId} className={authStyles.title}>
                        {recoveryScreen.title}
                    </h1>
                    <p className={authStyles.subtitle}>{recoveryScreen.subtitle}</p>
                </div>
                <form
                    id={formId}
                    className={authStyles.form}
                    onSubmit={handleSubmit}
                    aria-labelledby={titleId}
                    noValidate
                >
                    <div className={shell.field}>
                        <label className={shell.label} htmlFor="recovery-password">
                            {changePasswordForm.newLabel}
                        </label>
                        <input
                            id="recovery-password"
                            className={authStyles.input}
                            type="password"
                            autoComplete="new-password"
                            placeholder={authForm.atLeast6}
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className={shell.field}>
                        <label className={shell.label} htmlFor="recovery-confirm">
                            {authForm.confirmPasswordLabel}
                        </label>
                        <input
                            id="recovery-confirm"
                            className={authStyles.input}
                            type="password"
                            autoComplete="new-password"
                            placeholder={changePasswordForm.confirmNewPlaceholder}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                    {error !== null && (
                        <p className={authStyles.error} role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        className={`${shell.btn} ${shell.primary} ${authStyles.submit}`}
                        disabled={submitting || cancelling}
                    >
                        {submitting ? authForm.oneMoment : recoveryScreen.submit}
                    </button>
                </form>
                <div className={authStyles.foot}>
                    <button
                        type="button"
                        className={authStyles.guest}
                        onClick={() => void handleCancel()}
                        disabled={submitting || cancelling}
                    >
                        {cancelling ? recoveryScreen.cancelling : common.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
}

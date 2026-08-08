import { useState, type SubmitEvent } from 'react';
import shell from '@/components/shared/dialogShell.module.css';
import authStyles from './AuthForm.module.css';
import page from './RecoveryScreen.module.css';

type RecoveryScreenProps = {
    onUpdatePassword: (password: string) => Promise<void>;
    // Called after a successful password update — clears the recovering flag
    // so App's hard gate releases into the normal signed-in app.
    onDone: () => void;
    // Called from Cancel (or Escape-equivalent — there's no Dialog here, so
    // there's no backdrop to click, just the one button): signs out and
    // clears the recovering flag, landing back on the signed-out app with the
    // password untouched. Returns a Promise, unlike onDone, because signing
    // out can fail (see useAuth's cancelRecovery) and this screen needs to
    // know that rather than silently doing nothing.
    onCancel: () => Promise<void>;
};

/**
 * Lands here when a password-reset email link is followed: Supabase signs
 * you in with a live "recovery" session, so without this hard gate (see
 * App.tsx) the app would drop you straight into your account having never
 * actually set a new password. Reuses AuthForm's login-card chrome
 * (AuthForm.module.css) rather than its own stylesheet — same reasoning the
 * old app had for its RecoveryScreen. No captcha: a session already exists,
 * so there's nothing to prove here that signing in didn't already prove.
 */
export function RecoveryScreen({ onUpdatePassword, onDone, onCancel }: RecoveryScreenProps) {
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
            setError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError("Those passwords don't match.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onUpdatePassword(password);
            onDone();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
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
            setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
        } finally {
            setCancelling(false);
        }
    }

    return (
        <div className={page.page}>
            <div className={authStyles.wrap}>
                <div className={authStyles.head}>
                    <h1 id={titleId} className={authStyles.title}>
                        Choose a new password
                    </h1>
                    <p className={authStyles.subtitle}>Choose a new password for your account.</p>
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
                            New password
                        </label>
                        <input
                            id="recovery-password"
                            className={authStyles.input}
                            type="password"
                            autoComplete="new-password"
                            placeholder="at least 6 characters"
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className={shell.field}>
                        <label className={shell.label} htmlFor="recovery-confirm">
                            Confirm password
                        </label>
                        <input
                            id="recovery-confirm"
                            className={authStyles.input}
                            type="password"
                            autoComplete="new-password"
                            placeholder="re-enter it"
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
                        {submitting ? 'One moment…' : 'Set new password'}
                    </button>
                </form>
                <div className={authStyles.foot}>
                    <button
                        type="button"
                        className={authStyles.guest}
                        onClick={() => void handleCancel()}
                        disabled={submitting || cancelling}
                    >
                        {cancelling ? 'Canceling…' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
}

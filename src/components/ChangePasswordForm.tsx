import { useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Dialog } from './Dialog';
import { CloseIcon } from './CloseIcon';
import { EyeIcon, EyeOffIcon } from './EyeIcon';
import { useContainerWidth } from '../hooks/useContainerWidth';
import shell from './dialogShell.module.css';
import styles from './AuthForm.module.css';

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY;

// Same threshold and reason as AuthForm: hCaptcha's "normal" widget is a fixed
// 303px, and below a ~370px container its own compact layout is the only thing
// that does not force a sideways scroll.
const CAPTCHA_COMPACT_BELOW = 370;

type ChangePasswordFormProps = {
    /** the signed-in account's address — where a reset link would go */
    email: string;
    /** re-auth gate: true if the password is right, false if it is wrong */
    onVerifyPassword: (password: string, captchaToken: string) => Promise<boolean>;
    onUpdatePassword: (password: string) => Promise<void>;
    onResetPassword: (email: string, captchaToken: string) => Promise<void>;
    onClose: () => void;
};

/** form: filling it in · changed: it worked · sent: a reset link went out instead */
type Stage = 'form' | 'changed' | 'sent';

/**
 * Change the password of the account you are already signed in to, reached
 * from the account menu.
 *
 * Same screen as signing in, signing up and recovering — AuthForm's stylesheet,
 * AuthForm's one top-anchored column, AuthForm's size="full" Dialog, the way
 * RecoveryScreen already borrows them. Typing a password is typing a password:
 * a fourth surface with its own idea of what that looks like would be four
 * variations on one job.
 *
 * Two things make it more than a form. First, the change is gated on the
 * CURRENT password (see useAuth's verifyPassword) — a live session only proves
 * the browser was left signed in. Second, someone who cannot produce that
 * password is not stuck: a link in the foot, beside Cancel, emails them a
 * reset link instead — under the fields rather than under the one field it
 * concerns, so the three password rows keep an even rhythm. Both paths end on
 * a panel that says what happened, because a screen that just closes leaves
 * you wondering whether it did anything.
 *
 * The captcha is not ceremony. This project enforces captcha protection on the
 * password grant and on password recovery alike — verified against the live
 * endpoints — so both of this screen's actions need a token, and both spend it.
 */
export function ChangePasswordForm({
    email,
    onVerifyPassword,
    onUpdatePassword,
    onResetPassword,
    onClose,
}: ChangePasswordFormProps) {
    const [stage, setStage] = useState<Stage>('form');
    const [current, setCurrent] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);
    const [wrapRef, containerWidth] = useContainerWidth<HTMLDivElement>();
    const titleId = 'change-password-title';
    const compactCaptcha = containerWidth !== null && containerWidth < CAPTCHA_COMPACT_BELOW;

    // Read off the element the dark palette keys on rather than calling
    // useTheme(), which owns state and writes localStorage — same reasoning as
    // AuthForm, which only reads the value too.
    const captchaTheme =
        document.documentElement.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const);

    // Every attempt spends its token, success or failure alike, so a resubmit
    // never carries a stale one.
    function spendCaptcha() {
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
    }

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        // Checked here rather than with `required`/`minLength`, so every problem
        // reports through the one sentence-above-the-button channel instead of
        // the browser's native validation bubble.
        if (current === '') {
            setError('Enter your current password.');
            return;
        }
        if (password.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError("Those passwords don't match.");
            return;
        }
        if (captchaToken === null) {
            setError("Confirm you're human first.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const confirmed = await onVerifyPassword(current, captchaToken);
            if (!confirmed) {
                setError('Current password is incorrect.');
                return;
            }
            await onUpdatePassword(password);
            setStage('changed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
        } finally {
            spendCaptcha();
            setBusy(false);
        }
    }

    // The way out for someone who cannot produce their current password: the
    // emailed link lands on RecoveryScreen, which sets one without needing it.
    async function handleSendReset() {
        if (captchaToken === null) {
            setError("Confirm you're human first.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onResetPassword(email, captchaToken);
            setStage('sent');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
        } finally {
            spendCaptcha();
            setBusy(false);
        }
    }

    function passwordField(
        id: string,
        label: string,
        autoComplete: 'current-password' | 'new-password',
        placeholder: string | undefined,
        value: string,
        onChange: (v: string) => void,
        options: { autoFocus?: boolean; extra?: ReactNode } = {},
    ) {
        return (
            <div className={shell.field}>
                <label className={shell.label} htmlFor={id}>
                    {label}
                </label>
                <div className={styles.pwWrap}>
                    <input
                        id={id}
                        className={styles.input}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={autoComplete}
                        placeholder={placeholder}
                        autoFocus={options.autoFocus}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <button
                        type="button"
                        className={styles.reveal}
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
                {options.extra}
            </div>
        );
    }

    // Both endings are the same shape — a heading, a sentence, and one button
    // out — so they are one panel with different words, not two near-copies.
    function outcome(title: string, subtitle: ReactNode, dismissLabel: string) {
        return (
            <>
                <div className={styles.head}>
                    <h1 id={titleId} className={styles.title}>
                        {title}
                    </h1>
                    <p className={styles.subtitle}>{subtitle}</p>
                </div>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary} ${styles.submit}`}
                    onClick={onClose}
                    autoFocus
                >
                    {dismissLabel}
                </button>
            </>
        );
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId} size="full">
            <div className={shell.body}>
                <div className={styles.wrap} ref={wrapRef}>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Back to your week"
                    >
                        <CloseIcon />
                    </button>

                    {stage === 'changed' &&
                        outcome(
                            'Password changed',
                            "Your password has been updated. You're all set.",
                            'Done',
                        )}
                    {stage === 'sent' &&
                        outcome(
                            'Check your email',
                            <>
                                We&rsquo;ve sent a reset link to {email}. Open it to set a new one.
                            </>,
                            'Got it',
                        )}

                    {stage === 'form' && (
                        <>
                            <div className={styles.head}>
                                <h1 id={titleId} className={styles.title}>
                                    Change password
                                </h1>
                                <p className={styles.subtitle}>Confirm your current one first.</p>
                            </div>
                            <form className={styles.form} onSubmit={handleSubmit} noValidate>
                                {passwordField(
                                    'current-password',
                                    'Current password',
                                    'current-password',
                                    undefined,
                                    current,
                                    setCurrent,
                                    { autoFocus: true },
                                )}
                                {passwordField(
                                    'new-password',
                                    'New password',
                                    'new-password',
                                    'at least 6 characters',
                                    password,
                                    setPassword,
                                )}
                                {passwordField(
                                    'confirm-new-password',
                                    'Confirm new password',
                                    'new-password',
                                    're-enter it',
                                    confirmPassword,
                                    setConfirmPassword,
                                    {
                                        // Under the last field and right-aligned,
                                        // the same shape sign-in uses for its own
                                        // Forgot password — it used to sit in the
                                        // foot, which put it below Cancel and read
                                        // as a third dialog action rather than as a
                                        // footnote on the fields.
                                        extra: (
                                            <button
                                                type="button"
                                                className={`${styles.link} ${styles.forgot}`}
                                                onClick={() => void handleSendReset()}
                                                disabled={busy}
                                            >
                                                Forgot your current password?
                                            </button>
                                        ),
                                    },
                                )}
                                <div className={styles.captcha}>
                                    <HCaptcha
                                        ref={captchaRef}
                                        sitekey={HCAPTCHA_SITEKEY}
                                        theme={captchaTheme}
                                        size={compactCaptcha ? 'compact' : 'normal'}
                                        onVerify={(token) => setCaptchaToken(token)}
                                        onExpire={() => setCaptchaToken(null)}
                                    />
                                </div>
                                {error !== null && (
                                    <p className={styles.error} role="alert">
                                        {error}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    className={`${shell.btn} ${shell.primary} ${styles.submit}`}
                                    disabled={busy}
                                >
                                    {busy ? 'One moment…' : 'Update password'}
                                </button>
                            </form>
                        </>
                    )}

                    <div className={styles.foot}>
                        <button type="button" className={styles.guest} onClick={onClose}>
                            {stage === 'form' ? 'Cancel' : 'Back to your week'}
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

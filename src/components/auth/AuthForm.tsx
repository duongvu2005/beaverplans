import { useEffect, useRef, useState, type SubmitEvent, type ReactNode } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Dialog } from '@/components/shared/Dialog';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { EyeIcon, EyeOffIcon } from '@/components/shared/icons/EyeIcon';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './AuthForm.module.css';

export type AuthMode = 'signin' | 'signup' | 'reset';

// confirmationRequired: a signup that left no session. Sign-in and reset always resolve it false.
type AuthOutcome = { confirmationRequired: boolean };

type AuthFormProps = {
    initialMode: AuthMode;
    onCancel: () => void;
    onSubmit: (
        mode: AuthMode,
        email: string,
        password: string,
        /** collected on signup only; empty string for the other two modes */
        username: string,
        captchaToken: string,
    ) => Promise<AuthOutcome>;
    /** Send the confirmation email again. Resolves whether or not anything was sent. */
    onResendConfirmation: (email: string, captchaToken: string) => Promise<void>;
};

const USERNAME_MAX = 24;

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY;

// Supabase refuses a second confirmation mail to the same address inside its own
// minimum interval. Erring long: a press too early comes back as an error.
const RESEND_COOLDOWN_SECONDS = 60;

// hCaptcha's "normal" widget is a fixed 303px wide; under a ~370px container it
// overflows the panel's padding.
const CAPTCHA_COMPACT_BELOW = 370;

const SWITCH_TO: Record<AuthMode, AuthMode> = {
    signin: 'signup',
    signup: 'signin',
    reset: 'signin',
};

/** Sign-in / create-account / reset-password. Owns its own mode and field state. */
export function AuthForm({ initialMode, onCancel, onSubmit, onResendConfirmation }: AuthFormProps) {
    const { authForm } = useCopy();
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    // Set once a signup succeeds without establishing a session. App leaves the
    // dialog open in that case, and this replaces the form with the notice.
    const [signupPending, setSignupPending] = useState(false);
    // 'armed' is the captcha showing but not yet solved.
    const [resendState, setResendState] = useState<'idle' | 'armed' | 'sending' | 'sent'>('idle');
    const [resendError, setResendError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const captchaRef = useRef<HCaptcha>(null);
    const [wrapRef, containerWidth] = useContainerWidth<HTMLDivElement>();
    const titleId = 'auth-form-title';
    const formId = 'auth-form';
    const compactCaptcha = containerWidth !== null && containerWidth < CAPTCHA_COMPACT_BELOW;

    // Read from the attribute, not useTheme(), so there is one source of truth.
    const captchaTheme =
        document.documentElement.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const);

    useEffect(() => {
        if (cooldown === 0) return;
        const tick = setInterval(() => setCooldown((left) => Math.max(0, left - 1)), 1000);
        return () => clearInterval(tick);
    }, [cooldown]);

    async function handleResend() {
        if (captchaToken === null) {
            setResendState('armed');
            setResendError(authForm.resendArmed);
            return;
        }
        setResendState('sending');
        setResendError(null);
        try {
            await onResendConfirmation(email, captchaToken);
            setResendState('sent');
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch (err) {
            setResendState('idle');
            setResendError(err instanceof Error ? err.message : authForm.resendFailed);
        } finally {
            captchaRef.current?.resetCaptcha();
            setCaptchaToken(null);
        }
    }

    function switchMode(next: AuthMode) {
        setMode(next);
        // Email is deliberately left alone — a mode switch is a correction, not
        // a retype. Everything else resets.
        setUsername('');
        setConfirmPassword('');
        setShowPassword(false);
        setError(null);
        setNotice(null);
        setSignupPending(false);
        setResendState('idle');
        setResendError(null);
        setCooldown(0);
        setCaptchaToken(null);
        captchaRef.current?.resetCaptcha();
    }

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        // All checked here, never via `required`/`minLength` — the form is
        // noValidate, so no native bubble fires for anything missed.
        if (email.trim() === '') {
            setError(authForm.enterEmail);
            return;
        }
        if (mode === 'signup' && username.trim() === '') {
            setError(authForm.pickUsername);
            return;
        }
        if (mode !== 'reset' && password === '') {
            setError(authForm.enterPassword);
            return;
        }
        if (mode === 'signup' && password.length < 6) {
            setError(authForm.passwordTooShort);
            return;
        }
        if (mode === 'signup' && password !== confirmPassword) {
            setError(authForm.passwordsDontMatch);
            return;
        }
        if (captchaToken === null) {
            setError(authForm.humanFirst);
            return;
        }
        setSubmitting(true);
        setError(null);
        setNotice(null);
        try {
            const outcome = await onSubmit(mode, email, password, username, captchaToken);
            if (mode === 'reset') {
                // Non-committal on purpose: confirming or denying that the
                // address has an account would let this form enumerate them.
                setNotice(authForm.resetLinkSent);
            } else if (mode === 'signup' && outcome.confirmationRequired) {
                setSignupPending(true);
            }
            // Otherwise App closes the whole dialog — nothing else to show here.
        } catch (err) {
            setError(err instanceof Error ? err.message : authForm.somethingWrong);
        } finally {
            // The attempt spends the token, success or failure alike.
            captchaRef.current?.resetCaptcha();
            setCaptchaToken(null);
            setSubmitting(false);
        }
    }

    function passwordField(
        id: string,
        label: string,
        placeholder: string | undefined,
        value: string,
        onChange: (v: string) => void,
        extra?: ReactNode,
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
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <button
                        type="button"
                        className={styles.reveal}
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label={showPassword ? authForm.hidePassword : authForm.showPassword}
                        aria-pressed={showPassword}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
                {extra}
            </div>
        );
    }

    // captchaRef holds one widget, so only ever one of these may be on screen.
    function captchaWidget() {
        return (
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
        );
    }

    const resendLabel =
        cooldown > 0
            ? authForm.sendAgainIn(cooldown)
            : resendState === 'sending'
              ? authForm.sending
              : authForm.sendAgain;

    const switchTo = SWITCH_TO[mode];
    const switchCopy = authForm.switches[mode];

    return (
        <Dialog open onClose={onCancel} labelledBy={titleId} size="full" closeOnScrimClick={false}>
            <div className={shell.body}>
                <div className={styles.wrap} ref={wrapRef}>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onCancel}
                        aria-label={authForm.continueAsGuest}
                    >
                        <CloseIcon />
                    </button>
                    <div className={styles.head}>
                        <h1 id={titleId} className={styles.title}>
                            {signupPending ? authForm.checkYourEmail : authForm.titles[mode]}
                        </h1>
                        {!signupPending && (
                            <p className={styles.subtitle}>{authForm.subtitles[mode]}</p>
                        )}
                    </div>
                    {signupPending ? (
                        // role="status" wraps all three lines so the whole
                        // message is announced, not just the last to appear.
                        <div className={styles.pending} role="status">
                            <p className={styles.pendingLead}>{authForm.sentLinkTo}</p>
                            <p className={styles.pendingEmail}>{email}</p>
                            <p className={styles.pendingHint}>{authForm.openLinkToFinish}</p>
                            {resendState === 'armed' && captchaWidget()}
                            {/* Says the mail is on its way, never that an account was found. */}
                            {resendState === 'sent' && resendError === null && (
                                <p className={styles.notice} role="status">
                                    {authForm.resendSent}
                                </p>
                            )}
                            {resendError !== null && (
                                <p className={styles.error} role="alert">
                                    {resendError}
                                </p>
                            )}
                            <button
                                type="button"
                                className={`${shell.btn} ${shell.ghost} ${styles.submit} ${styles.pendingBack}`}
                                disabled={cooldown > 0 || resendState === 'sending'}
                                onClick={() => void handleResend()}
                            >
                                {resendLabel}
                            </button>
                            <button
                                type="button"
                                className={`${styles.link} ${styles.pendingSwap}`}
                                onClick={() => switchMode('signup')}
                            >
                                {authForm.useDifferentEmail}
                            </button>
                        </div>
                    ) : (
                        <form
                            id={formId}
                            className={styles.form}
                            onSubmit={handleSubmit}
                            noValidate
                        >
                            <div className={shell.field}>
                                <label className={shell.label} htmlFor="auth-email">
                                    {authForm.emailLabel}
                                </label>
                                <input
                                    id="auth-email"
                                    className={styles.input}
                                    type="email"
                                    autoComplete="email"
                                    placeholder={authForm.emailPlaceholder}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            {mode === 'signup' && (
                                <div className={shell.field}>
                                    <label className={shell.label} htmlFor="auth-username">
                                        {authForm.usernameLabel}
                                    </label>
                                    <input
                                        id="auth-username"
                                        className={styles.input}
                                        type="text"
                                        autoComplete="nickname"
                                        maxLength={USERNAME_MAX}
                                        placeholder={authForm.usernamePlaceholder}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            )}
                            {mode !== 'reset' &&
                                passwordField(
                                    'auth-password',
                                    authForm.passwordLabel,
                                    mode === 'signup' ? authForm.atLeast6 : undefined,
                                    password,
                                    setPassword,
                                    mode === 'signin' ? (
                                        <button
                                            type="button"
                                            className={`${styles.link} ${styles.forgot}`}
                                            onClick={() => switchMode('reset')}
                                        >
                                            {authForm.forgotPassword}
                                        </button>
                                    ) : undefined,
                                )}
                            {mode === 'signup' &&
                                passwordField(
                                    'auth-confirm',
                                    authForm.confirmPasswordLabel,
                                    undefined,
                                    confirmPassword,
                                    setConfirmPassword,
                                )}
                            {captchaWidget()}
                            {error !== null && (
                                <p className={styles.error} role="alert">
                                    {error}
                                </p>
                            )}
                            {notice !== null && (
                                <p className={styles.notice} role="status">
                                    {notice}
                                </p>
                            )}
                            <button
                                type="submit"
                                className={`${shell.btn} ${shell.primary} ${styles.submit}`}
                                disabled={submitting}
                            >
                                {submitting ? authForm.oneMoment : authForm.submits[mode]}
                            </button>
                        </form>
                    )}
                    <div className={styles.foot}>
                        {/* No "back to sign in" while pending: opening the
                            confirmation link signs the browser in by itself. */}
                        {!signupPending && (
                            <p className={styles.switch}>
                                {switchCopy.prompt}{' '}
                                <button
                                    type="button"
                                    className={styles.link}
                                    onClick={() => switchMode(switchTo)}
                                >
                                    {switchCopy.action}
                                </button>
                            </p>
                        )}
                        <button type="button" className={styles.guest} onClick={onCancel}>
                            {authForm.keepPlanningAsGuest}
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

import { useRef, useState, type SubmitEvent, type ReactNode } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Dialog } from './Dialog';
import { CloseIcon } from './CloseIcon';
import { EyeIcon, EyeOffIcon } from './EyeIcon';
import { useContainerWidth } from '../hooks/useContainerWidth';
import shell from './dialogShell.module.css';
import styles from './AuthForm.module.css';

export type AuthMode = 'signin' | 'signup' | 'reset';

// confirmationRequired is only ever true for a signup that didn't leave the
// browser with a session (Supabase requires email confirmation, or the
// address already has a confirmed account — the two are deliberately
// indistinguishable). signin/reset always resolve it false.
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
};

// Long enough to be a name, short enough for the account chip not to have to
// ellipsize it in the common case.
const USERNAME_MAX = 24;

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY;

// hCaptcha's "normal" widget is a fixed 303px wide. It fits inside the panel's
// padding down to a ~370px container; below that its own "compact" layout is
// the only thing that does not force a sideways scroll.
const CAPTCHA_COMPACT_BELOW = 370;

const TITLE: Record<AuthMode, string> = {
    signin: 'Sign in',
    signup: 'Create your account',
    reset: 'Reset your password',
};

// One line each at the column's width: a subtitle that wraps pushes the form
// down and undoes the point of anchoring the header in the first place.
const SUBTITLE: Record<AuthMode, string> = {
    signin: 'Welcome back.',
    signup: 'Your weeks, on every device you use.',
    reset: "We'll email you a link to set a new one.",
};

const SUBMIT_LABEL: Record<AuthMode, string> = {
    signin: 'Sign in',
    signup: 'Create account',
    reset: 'Send reset link',
};

// The mode switch reads as a sentence with the accent on the verb, rather than
// as one long underlined link — that shape is reserved for actual buttons.
const SWITCH: Record<AuthMode, { prompt: string; action: string; to: AuthMode }> = {
    signin: { prompt: 'No account?', action: 'Create one', to: 'signup' },
    signup: { prompt: 'Already have one?', action: 'Sign in', to: 'signin' },
    reset: { prompt: 'Remembered it?', action: 'Back to sign in', to: 'signin' },
};

/**
 * Sign-in / create-account / reset-password, styled as its own destination
 * rather than a generic dialog: one top-anchored column with a corner close
 * button instead of a header and footer bar. On phone the Dialog it lives in
 * fills the screen (size="full"); on desktop that same prop resolves back to
 * an ordinary centered modal (see Dialog.module.css). Owns its own mode/field
 * state; the parent only hears about it through onCancel and onSubmit.
 */
export function AuthForm({ initialMode, onCancel, onSubmit }: AuthFormProps) {
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
    // Set once a signup succeeds without establishing a session — replaces
    // the form with a "check your email" notice instead of closing (App
    // leaves the dialog open in that case; see App.tsx's handleAuthSubmit).
    // Following the confirmation link signs the browser in automatically
    // (Supabase's own redirect), so this screen has nothing to hand back to
    // — no "sign in" affordance, just what to expect and the guest escape.
    const [signupPending, setSignupPending] = useState(false);
    const captchaRef = useRef<HCaptcha>(null);
    const [wrapRef, containerWidth] = useContainerWidth<HTMLDivElement>();
    const titleId = 'auth-form-title';
    const formId = 'auth-form';
    const compactCaptcha = containerWidth !== null && containerWidth < CAPTCHA_COMPACT_BELOW;

    // Read straight off the element the dark palette itself keys on, rather
    // than calling useTheme(): that hook owns state and writes localStorage, so
    // a second instance here would be a second source of truth for a value this
    // component only reads. The attribute is kept current by the one instance
    // that does own it.
    const captchaTheme =
        document.documentElement.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const);

    function switchMode(next: AuthMode) {
        setMode(next);
        // Email survives a mode switch on purpose (a typo becomes a correction,
        // not a retype) but the username does not: the only mode that asks for
        // one is signup, so carrying it into sign-in and back would just be
        // stale text in a field nobody saw.
        setUsername('');
        setConfirmPassword('');
        setShowPassword(false);
        setError(null);
        setNotice(null);
        setSignupPending(false);
        setCaptchaToken(null);
        captchaRef.current?.resetCaptcha();
    }

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        // All checked here — never via `required`/`minLength` — so every
        // problem reports through the same sentence-under-the-button channel
        // instead of the browser's own native validation bubble.
        if (email.trim() === '') {
            setError('Enter your email.');
            return;
        }
        if (mode === 'signup' && username.trim() === '') {
            setError('Pick a username.');
            return;
        }
        if (mode !== 'reset' && password === '') {
            setError('Enter your password.');
            return;
        }
        if (mode === 'signup' && password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (mode === 'signup' && password !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }
        // Checked here rather than by disabling the button: a permanently grey
        // CTA is the first thing you see on this screen and reads as broken,
        // where a sentence on submit tells you what is actually missing.
        if (captchaToken === null) {
            setError("Confirm you're human first.");
            return;
        }
        setSubmitting(true);
        setError(null);
        setNotice(null);
        try {
            const outcome = await onSubmit(mode, email, password, username, captchaToken);
            if (mode === 'reset') {
                // Deliberately non-committal: confirming or denying that the
                // address has an account would let this form enumerate them.
                setNotice('If that email has an account, a reset link is on its way.');
            } else if (mode === 'signup' && outcome.confirmationRequired) {
                setSignupPending(true);
            }
            // Otherwise (signin, or a signup that established a session
            // immediately) App closes the whole dialog — nothing else to
            // show here.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
        } finally {
            // Every attempt spends the token, success or failure alike — reset
            // unconditionally so a resubmit (or, for signin/signup, the dialog
            // closing) never leaves a stale one behind.
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
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
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

    const switchTo = SWITCH[mode];

    return (
        <Dialog open onClose={onCancel} labelledBy={titleId} size="full" closeOnScrimClick={false}>
            <div className={shell.body}>
                <div className={styles.wrap} ref={wrapRef}>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onCancel}
                        aria-label="Continue as guest"
                    >
                        <CloseIcon />
                    </button>
                    <div className={styles.head}>
                        <h1 id={titleId} className={styles.title}>
                            {signupPending ? 'Check your email' : TITLE[mode]}
                        </h1>
                        {!signupPending && <p className={styles.subtitle}>{SUBTITLE[mode]}</p>}
                    </div>
                    {signupPending ? (
                        // Its own block rather than borrowing .head's subtitle
                        // slot: that slot's rhythm is built for a one-line
                        // tagline sitting tight under the title, and three
                        // separate thoughts inheriting it read as one clump.
                        // The address stays out of the sentence above it —
                        // inline, a long one wrapped mid-word and left an
                        // awkward gap. role="status" wraps all three lines so a
                        // screen reader announces the whole message, and it is
                        // deliberately not the green .notice treatment: nothing
                        // has succeeded yet, the email still has to be opened.
                        <div className={styles.pending} role="status">
                            <p className={styles.pendingLead}>We sent a confirmation link to</p>
                            <p className={styles.pendingEmail}>{email}</p>
                            <p className={styles.pendingHint}>
                                Open the link to finish creating your account. You'll be signed in
                                automatically.
                            </p>
                            {/* The only thing there is to press here — everything
                                else waits on the inbox. Ghost, not primary: the
                                emailed link is the real next step, and a filled
                                CTA would be pointing at the wrong one. Returns to
                                the form with the address still in it, so a typo
                                is a correction rather than a retype. */}
                            <button
                                type="button"
                                className={`${shell.btn} ${shell.ghost} ${styles.submit} ${styles.pendingBack}`}
                                onClick={() => switchMode('signup')}
                            >
                                Use a different email
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
                                    Email
                                </label>
                                <input
                                    id="auth-email"
                                    className={styles.input}
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            {/* "Username", not "Name": the latter reads as a demand
                                for a real one, and this is only ever a display
                                label. After the email, not before it — the address
                                is the thing that actually creates the account, and
                                leading with this makes the form look like it is
                                asking for a profile. */}
                            {mode === 'signup' && (
                                <div className={shell.field}>
                                    <label className={shell.label} htmlFor="auth-username">
                                        Username
                                    </label>
                                    <input
                                        id="auth-username"
                                        className={styles.input}
                                        type="text"
                                        autoComplete="nickname"
                                        maxLength={USERNAME_MAX}
                                        placeholder="what should we call you?"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            )}
                            {mode !== 'reset' &&
                                passwordField(
                                    'auth-password',
                                    'Password',
                                    // The rule, stated before you can break it —
                                    // but only where it applies. On sign-in the
                                    // password already exists; the minimum is not
                                    // news, it is just noise in the field.
                                    mode === 'signup' ? 'at least 6 characters' : undefined,
                                    password,
                                    setPassword,
                                    mode === 'signin' ? (
                                        <button
                                            type="button"
                                            className={`${styles.link} ${styles.forgot}`}
                                            onClick={() => switchMode('reset')}
                                        >
                                            Forgot password?
                                        </button>
                                    ) : undefined,
                                )}
                            {mode === 'signup' &&
                                passwordField(
                                    'auth-confirm',
                                    'Confirm password',
                                    undefined,
                                    confirmPassword,
                                    setConfirmPassword,
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
                                {submitting ? 'One moment…' : SUBMIT_LABEL[mode]}
                            </button>
                        </form>
                    )}
                    <div className={styles.foot}>
                        {/* No "back to sign in" here: opening the confirmation
                            link signs the browser in automatically (Supabase's
                            redirect), so there is nothing this screen needs to
                            hand off to — only the guest escape stays. */}
                        {!signupPending && (
                            <p className={styles.switch}>
                                {switchTo.prompt}{' '}
                                <button
                                    type="button"
                                    className={styles.link}
                                    onClick={() => switchMode(switchTo.to)}
                                >
                                    {switchTo.action}
                                </button>
                            </p>
                        )}
                        <button type="button" className={styles.guest} onClick={onCancel}>
                            Keep planning as a guest
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

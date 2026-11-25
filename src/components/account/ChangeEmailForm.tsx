import { useRef, useState, type SubmitEvent } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Dialog } from '@/components/shared/Dialog';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { EyeIcon, EyeOffIcon } from '@/components/shared/icons/EyeIcon';
import { authErrorText } from '@/hooks/authError';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from '@/components/auth/AuthForm.module.css';

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY;

// hCaptcha's "normal" widget is a fixed 303px wide; under a ~370px container it
// overflows the panel's padding. Same threshold as AuthForm.
const CAPTCHA_COMPACT_BELOW = 370;

type ChangeEmailFormProps = {
    /** the address currently on the account */
    email: string | undefined;
    /** re-auth gate: true if the password is right, false if it is wrong */
    onVerifyPassword: (password: string, captchaToken: string) => Promise<boolean>;
    /** Ask for the change. Resolves when the confirmation mail is away, not when the address has changed. */
    onUpdateEmail: (email: string) => Promise<void>;
    onClose: () => void;
};

/** Move the account to a different address. Nothing changes until the emailed link is opened. */
export function ChangeEmailForm({
    email,
    onVerifyPassword,
    onUpdateEmail,
    onClose,
}: ChangeEmailFormProps) {
    const { authForm, changeEmailForm, common } = useCopy();
    const [next, setNext] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [error, setError] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);
    const [wrapRef, containerWidth] = useContainerWidth<HTMLDivElement>();
    const compactCaptcha = containerWidth !== null && containerWidth < CAPTCHA_COMPACT_BELOW;

    const trimmed = next.trim();
    const titleId = 'change-email-title';

    // Read from the attribute, not useTheme(), so there is one source of truth.
    const captchaTheme =
        document.documentElement.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const);

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        if (trimmed === '') {
            setError(changeEmailForm.enterNew);
            return;
        }
        // Shallow on purpose; the real check is whether the link arrives.
        if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
            setError(changeEmailForm.notAnEmail);
            return;
        }
        if (trimmed === email) {
            setError(changeEmailForm.alreadyYours);
            return;
        }
        if (password === '') {
            setError(authForm.enterPasswordToConfirm);
            return;
        }
        if (captchaToken === null) {
            setError(authForm.humanFirst);
            return;
        }
        setStatus('sending');
        setError(null);
        try {
            const confirmed = await onVerifyPassword(password, captchaToken);
            if (!confirmed) {
                setError(authForm.passwordIncorrect);
                return;
            }
            await onUpdateEmail(trimmed);
            setStatus('sent');
        } catch (err) {
            setError(authErrorText(err, authForm.failures, changeEmailForm.couldNotSend));
        } finally {
            // Every attempt spends its token, success or failure alike.
            captchaRef.current?.resetCaptcha();
            setCaptchaToken(null);
            setStatus((s) => (s === 'sending' ? 'idle' : s));
        }
    }

    if (status === 'sent') {
        return (
            <Dialog
                open
                onClose={onClose}
                labelledBy={titleId}
                size="full"
                closeOnScrimClick={false}
            >
                <div className={shell.body}>
                    <div className={styles.wrap} ref={wrapRef}>
                        <button
                            type="button"
                            className={styles.close}
                            onClick={onClose}
                            aria-label={authForm.backToWeek}
                        >
                            <CloseIcon />
                        </button>
                        <div className={styles.head}>
                            <h1 id={titleId} className={styles.title}>
                                {changeEmailForm.sentTitle}
                            </h1>
                        </div>
                        <div className={`${styles.pending} ${styles.pendingTight}`} role="status">
                            <p className={styles.pendingLead}>{authForm.sentLinkTo}</p>
                            <p className={styles.pendingEmail}>{trimmed}</p>
                            <p className={styles.pendingHint}>
                                {changeEmailForm.openEmailToFinish}
                            </p>
                            <p className={styles.pendingHint}>
                                {changeEmailForm.untilConfirmed(
                                    email ?? changeEmailForm.emailYouHaveNow,
                                )}
                            </p>
                        </div>
                        <div className={styles.foot}>
                            <button
                                type="button"
                                className={`${shell.btn} ${shell.primary} ${styles.submit} ${styles.pendingDone}`}
                                onClick={onClose}
                            >
                                {common.done}
                            </button>
                        </div>
                    </div>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId} size="full" closeOnScrimClick={false}>
            <div className={shell.body}>
                <div className={styles.wrap} ref={wrapRef}>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label={authForm.backToWeek}
                    >
                        <CloseIcon />
                    </button>
                    <div className={styles.head}>
                        <h1 id={titleId} className={styles.title}>
                            {changeEmailForm.title}
                        </h1>
                        <p className={styles.subtitle}>
                            {changeEmailForm.currentlyUsing(email ?? changeEmailForm.notSet)}
                        </p>
                    </div>
                    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
                        <div className={shell.field}>
                            <label className={shell.label} htmlFor="change-email-next">
                                {changeEmailForm.newLabel}
                            </label>
                            <input
                                id="change-email-next"
                                className={styles.input}
                                type="email"
                                autoComplete="email"
                                autoFocus
                                placeholder={changeEmailForm.newPlaceholder}
                                value={next}
                                onChange={(e) => {
                                    setNext(e.target.value);
                                    setError(null);
                                }}
                            />
                        </div>
                        <div className={shell.field}>
                            <label className={shell.label} htmlFor="change-email-password">
                                {authForm.passwordLabel}
                            </label>
                            <div className={styles.pwWrap}>
                                <input
                                    id="change-email-password"
                                    className={styles.input}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder={changeEmailForm.passwordPlaceholder}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className={styles.reveal}
                                    onClick={() => setShowPassword((shown) => !shown)}
                                    aria-label={
                                        showPassword ? authForm.hidePassword : authForm.showPassword
                                    }
                                    aria-pressed={showPassword}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
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
                            disabled={status === 'sending'}
                        >
                            {status === 'sending' ? authForm.sending : changeEmailForm.submit}
                        </button>
                    </form>
                    <div className={styles.foot}>
                        <button type="button" className={styles.guest} onClick={onClose}>
                            {changeEmailForm.keepCurrent}
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

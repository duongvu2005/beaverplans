import { useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Dialog } from '@/components/shared/Dialog';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { EyeIcon, EyeOffIcon } from '@/components/shared/icons/EyeIcon';
import { authErrorText } from '@/hooks/authError';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { useCopy } from '@/i18n/localeContext';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './AuthForm.module.css';

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY;

// hCaptcha's "normal" widget is a fixed 303px wide; under a ~370px container it
// overflows the panel's padding. Same threshold as AuthForm.
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

/** Change the password of the signed-in account, gated on the current one. */
export function ChangePasswordForm({
    email,
    onVerifyPassword,
    onUpdatePassword,
    onResetPassword,
    onClose,
}: ChangePasswordFormProps) {
    const { authForm, changePasswordForm, common } = useCopy();
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

    // Read from the attribute, not useTheme(), so there is one source of truth.
    const captchaTheme =
        document.documentElement.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const);

    // The attempt spends its token, success or failure alike.
    function spendCaptcha() {
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
    }

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        // All checked here, never via `required`/`minLength` — the form is
        // noValidate, so no native bubble fires for anything missed.
        if (current === '') {
            setError(changePasswordForm.enterCurrent);
            return;
        }
        if (password.length < 6) {
            setError(changePasswordForm.newTooShort);
            return;
        }
        if (password !== confirmPassword) {
            setError(changePasswordForm.newPasswordsDontMatch);
            return;
        }
        if (captchaToken === null) {
            setError(authForm.humanFirst);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const confirmed = await onVerifyPassword(current, captchaToken);
            if (!confirmed) {
                setError(changePasswordForm.currentIncorrect);
                return;
            }
            await onUpdatePassword(password);
            setStage('changed');
        } catch (err) {
            setError(authErrorText(err, authForm.failures, authForm.somethingWrong));
        } finally {
            spendCaptcha();
            setBusy(false);
        }
    }

    // The emailed link lands on RecoveryScreen, which sets a password without
    // asking for the current one.
    async function handleSendReset() {
        if (captchaToken === null) {
            setError(authForm.humanFirst);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onResetPassword(email, captchaToken);
            setStage('sent');
        } catch (err) {
            setError(err instanceof Error ? err.message : authForm.somethingWrong);
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
                        aria-label={showPassword ? authForm.hidePassword : authForm.showPassword}
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

                    {stage === 'changed' &&
                        outcome(
                            changePasswordForm.changedTitle,
                            changePasswordForm.changedBody,
                            common.done,
                        )}
                    {stage === 'sent' &&
                        outcome(
                            authForm.checkYourEmail,
                            changePasswordForm.sentBody(email),
                            changePasswordForm.gotIt,
                        )}

                    {stage === 'form' && (
                        <>
                            <div className={styles.head}>
                                <h1 id={titleId} className={styles.title}>
                                    {changePasswordForm.title}
                                </h1>
                                <p className={styles.subtitle}>{changePasswordForm.subtitle}</p>
                            </div>
                            <form className={styles.form} onSubmit={handleSubmit} noValidate>
                                {passwordField(
                                    'current-password',
                                    changePasswordForm.currentLabel,
                                    'current-password',
                                    undefined,
                                    current,
                                    setCurrent,
                                    { autoFocus: true },
                                )}
                                {passwordField(
                                    'new-password',
                                    changePasswordForm.newLabel,
                                    'new-password',
                                    authForm.atLeast6,
                                    password,
                                    setPassword,
                                )}
                                {passwordField(
                                    'confirm-new-password',
                                    changePasswordForm.confirmNewLabel,
                                    'new-password',
                                    changePasswordForm.confirmNewPlaceholder,
                                    confirmPassword,
                                    setConfirmPassword,
                                    {
                                        extra: (
                                            <button
                                                type="button"
                                                className={`${styles.link} ${styles.forgot}`}
                                                onClick={() => void handleSendReset()}
                                                disabled={busy}
                                            >
                                                {changePasswordForm.forgotCurrent}
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
                                    {busy ? authForm.oneMoment : changePasswordForm.submit}
                                </button>
                            </form>
                        </>
                    )}

                    <div className={styles.foot}>
                        <button type="button" className={styles.guest} onClick={onClose}>
                            {stage === 'form' ? common.cancel : authForm.backToWeek}
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

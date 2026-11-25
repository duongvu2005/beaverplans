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

type DeleteAccountFormProps = {
    /** the signed-in account's address, named so "your account" is concrete */
    /** how many weeks go with it, so the warning can be specific */
    weekCount: number;
    /** re-auth gate: true if the password is right, false if it is wrong */
    onVerifyPassword: (password: string, captchaToken: string) => Promise<boolean>;
    /** deletes the account and everything under it, then signs this browser out */
    onDeleteAccount: () => Promise<void>;
    onClose: () => void;
};

/** Delete the account itself, gated on the current password. */
export function DeleteAccountForm({
    weekCount,
    onVerifyPassword,
    onDeleteAccount,
    onClose,
}: DeleteAccountFormProps) {
    const { authForm, deleteAccountForm } = useCopy();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);
    const [wrapRef, containerWidth] = useContainerWidth<HTMLDivElement>();
    const titleId = 'delete-account-title';
    const compactCaptcha = containerWidth !== null && containerWidth < CAPTCHA_COMPACT_BELOW;

    // Read from the attribute, not useTheme(), so there is one source of truth.
    const captchaTheme =
        document.documentElement.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const);

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        if (password === '') {
            setError(authForm.enterPasswordToConfirm);
            return;
        }
        if (captchaToken === null) {
            setError(authForm.humanFirst);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const confirmed = await onVerifyPassword(password, captchaToken);
            if (!confirmed) {
                setError(authForm.passwordIncorrect);
                return;
            }
            await onDeleteAccount();
            // No setState past here on the success path: deleting signs the
            // browser out, which takes this screen off the tree with it.
        } catch (err) {
            setError(authErrorText(err, authForm.failures, authForm.somethingWrong));
        } finally {
            // Every attempt spends its token, success or failure alike.
            captchaRef.current?.resetCaptcha();
            setCaptchaToken(null);
            setBusy(false);
        }
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
                            {deleteAccountForm.title}
                        </h1>
                        <p className={styles.lead}>{deleteAccountForm.warning(weekCount)}</p>
                    </div>
                    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
                        <div className={shell.field}>
                            <label className={shell.label} htmlFor="delete-account-password">
                                {authForm.passwordLabel}
                            </label>
                            <div className={styles.pwWrap}>
                                <input
                                    id="delete-account-password"
                                    className={styles.input}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    autoFocus
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
                            className={`${shell.btn} ${shell.danger} ${styles.submit}`}
                            disabled={busy}
                        >
                            {busy ? deleteAccountForm.deleting : deleteAccountForm.submit}
                        </button>
                    </form>
                    <div className={styles.foot}>
                        <button type="button" className={styles.guest} onClick={onClose}>
                            {deleteAccountForm.keepAccount}
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

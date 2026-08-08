import { useState } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './AccountSettings.module.css';

type ChangeEmailFormProps = {
    /** the address currently on the account */
    email: string | undefined;
    onClose: () => void;
};

/**
 * Change the address on the account — UI ONLY, deliberately not wired.
 *
 * The form and its validation are real; the submit is not. Doing this properly
 * needs more than a `supabase.auth.updateUser({ email })` call:
 *
 *   - the new address must be added to the project's redirect allow-list in the
 *     Supabase dashboard, or the confirmation link bounces;
 *   - by default Supabase mails BOTH addresses, and the change only lands once
 *     the link in the NEW one is opened — so the account keeps the old address
 *     until then, and the UI has to say so rather than reporting success;
 *   - the old address staying valid in the meantime is a security property worth
 *     keeping, which means this flow has a pending state to design, not just a
 *     request to fire.
 *
 * So this ships as the shape of the screen with the request left out. It says so
 * on the button rather than pretending — a form that silently does nothing is
 * worse than one that admits it is not finished.
 */
export function ChangeEmailForm({ email, onClose }: ChangeEmailFormProps) {
    const [next, setNext] = useState('');
    const [error, setError] = useState<string | null>(null);

    const trimmed = next.trim();

    function handleSubmit() {
        // Validated for real, so the finished version inherits the checks rather
        // than needing them written from scratch.
        if (trimmed === '') {
            setError('Enter the new address.');
            return;
        }
        if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
            setError("That doesn't look like an email address.");
            return;
        }
        if (trimmed === email) {
            setError('That is already the address on your account.');
            return;
        }
        setError(null);
    }

    return (
        <ConfirmDialog
            eyebrow="Account"
            title="Change email"
            onClose={onClose}
            actions={[
                {
                    label: 'Not available yet',
                    onAction: handleSubmit,
                    disabled: true,
                },
            ]}
        >
            <p className={shell.text}>
                Your weeks are filed under your account, not your address, so changing it moves
                nothing — you would just sign in with the new one from then on.
            </p>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="settings-email">
                    New email
                </label>
                <div className={styles.editRow}>
                    <input
                        id="settings-email"
                        className={styles.input}
                        type="email"
                        autoComplete="email"
                        placeholder={email ?? 'you@example.com'}
                        value={next}
                        onChange={(e) => {
                            setNext(e.target.value);
                            setError(null);
                        }}
                    />
                </div>
                <span
                    className={error === null ? styles.note : `${styles.note} ${styles.error}`}
                    role={error === null ? 'status' : 'alert'}
                >
                    {error ??
                        'Currently ' +
                            (email ?? 'not set') +
                            '. You would confirm the new one by email.'}
                </span>
            </div>
            <p className={shell.text}>
                This screen is not finished: the confirmation-email side still has to be set up
                before it can actually change anything.
            </p>
        </ConfirmDialog>
    );
}

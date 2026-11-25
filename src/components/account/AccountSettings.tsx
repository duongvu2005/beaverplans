import { useState } from 'react';
import type { GuidePref } from '@/hooks/useGuidePref';
import { authErrorText } from '@/hooks/authError';
import { Dialog } from '@/components/shared/Dialog';
import { ChevronIcon } from '@/components/shared/icons/ChevronIcon';
import { useCopy } from '@/i18n/localeContext';
import { Avatar } from './Avatar';
import { LanguagePicker } from './LanguagePicker';
import { FontPicker } from './FontPicker';
import { GuideToggle } from './GuideToggle';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './AccountSettings.module.css';

// Matches the signup field, so a name accepted there is never rejected here.
const USERNAME_MAX = 24;

type AccountSettingsProps = {
    username: string;
    email: string | undefined;
    onClose: () => void;
    /** resolves on success; rejects with a message to show under the field */
    onSaveUsername: (username: string) => Promise<void>;
    /** hands off to ChangePasswordForm, which owns its own re-auth */
    onChangePassword: () => void;
    /** hands off to the change-email flow */
    onChangeEmail: () => void;
    guidePref: GuidePref;
    onPickGuide: (pref: GuidePref) => void;
};

/** Everything about the account itself, in one place. */
export function AccountSettings({
    username,
    email,
    onClose,
    onSaveUsername,
    onChangePassword,
    onChangeEmail,
    guidePref,
    onPickGuide,
}: AccountSettingsProps) {
    const { common, authForm, accountSettings, accountSheet, guideToggle } = useCopy();
    const [draft, setDraft] = useState(username);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [message, setMessage] = useState<string | null>(null);
    const titleId = 'account-settings-title';

    const trimmed = draft.trim();
    const changed = trimmed !== username && trimmed !== '';

    async function handleSaveUsername() {
        setStatus('saving');
        setMessage(null);
        try {
            await onSaveUsername(trimmed);
            setStatus('saved');
            setMessage(accountSettings.saved);
        } catch (err) {
            setStatus('error');
            setMessage(authErrorText(err, authForm.failures, accountSettings.couldNotSave));
        }
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{accountSettings.eyebrow}</div>
                <h3 id={titleId} className={shell.title}>
                    {accountSettings.title}
                </h3>
            </div>
            <div className={styles.body}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="settings-username">
                        {authForm.usernameLabel}
                    </label>
                    <div className={styles.editRow}>
                        <input
                            id="settings-username"
                            className={styles.input}
                            type="text"
                            autoComplete="nickname"
                            maxLength={USERNAME_MAX}
                            value={draft}
                            onChange={(e) => {
                                setDraft(e.target.value);
                                // Any edit invalidates the last outcome.
                                setStatus('idle');
                                setMessage(null);
                            }}
                        />
                        <button
                            type="button"
                            className={styles.save}
                            disabled={!changed || status === 'saving'}
                            onClick={() => void handleSaveUsername()}
                        >
                            {status === 'saving' ? accountSettings.saving : common.save}
                        </button>
                    </div>
                    <span
                        className={
                            status === 'saved'
                                ? `${styles.note} ${styles.saved}`
                                : status === 'error'
                                  ? `${styles.note} ${styles.error}`
                                  : styles.note
                        }
                        role={status === 'error' ? 'alert' : 'status'}
                    >
                        {message}
                    </span>
                </div>

                <LanguagePicker />

                <FontPicker />

                <div className={styles.guide}>
                    <span className={styles.guideText}>
                        <span className={styles.guideLabel}>{guideToggle.label}</span>
                        <span className={styles.guideNote}>{accountSheet.guideNote}</span>
                    </span>
                    <GuideToggle pref={guidePref} onPick={onPickGuide} />
                </div>

                <div className={styles.rows}>
                    <button
                        type="button"
                        className={styles.row}
                        onClick={onChangeEmail}
                        aria-label={accountSettings.changeEmail}
                    >
                        <span className={styles.rowText}>
                            <span className={styles.rowTitle}>{authForm.emailLabel}</span>
                            <span className={styles.rowSub}>
                                {email ?? accountSettings.noEmail}
                            </span>
                        </span>
                        <ChevronIcon dir="right" />
                    </button>
                    <button type="button" className={styles.row} onClick={onChangePassword}>
                        <span className={styles.rowText}>
                            <span className={styles.rowTitle}>{authForm.passwordLabel}</span>
                            <span className={styles.rowSub}>{accountSettings.passwordSub}</span>
                        </span>
                        <ChevronIcon dir="right" />
                    </button>
                    <div className={`${styles.row} ${styles.soon}`}>
                        <Avatar size={26} />
                        <span className={styles.rowText}>
                            <span className={styles.rowTitle}>{accountSettings.avatar}</span>
                            <span className={styles.rowSub}>{accountSettings.avatarSub}</span>
                        </span>
                        <span className={styles.soonTag}>{accountSettings.soon}</span>
                    </div>
                </div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {common.back}
                </button>
            </div>
        </Dialog>
    );
}

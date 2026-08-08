import { useState } from 'react';
import { Dialog } from './Dialog';
import { ChevronIcon } from './ChevronIcon';
import { Avatar } from './Avatar';
import shell from './dialogShell.module.css';
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
};

/**
 * Everything about the account itself, in one place.
 *
 * Replaces a Change password row sitting alone in the account menu: once there
 * are three or four of these, a menu listing them all is a menu you scroll, and
 * each one needs a sentence that a menu row has no room for.
 *
 * Two groups, split by whether a change has to prove who you are. A username is a
 * display label — no re-auth, no email, so it is edited in place and saved right
 * here. A password and an address are credentials: both need their own focused
 * flow, so those are rows that hand off. The theme deliberately does NOT live
 * here; it is a preference about whoever is looking at the screen rather than
 * about the account, and it stays in the menu and sheet where it already was.
 */
export function AccountSettings({
    username,
    email,
    onClose,
    onSaveUsername,
    onChangePassword,
    onChangeEmail,
}: AccountSettingsProps) {
    const [draft, setDraft] = useState(username);
    // 'idle' until something is submitted, so the field is quiet on open rather
    // than pre-announcing a success or failure that has not happened.
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
            setMessage('Saved.');
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Could not save that. Try again.');
        }
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>Account</div>
                <h3 id={titleId} className={shell.title}>
                    Settings
                </h3>
            </div>
            <div className={styles.body}>
                {/* A <label> around the whole block would make its accessible name
                    the concatenation of the caption, the note AND the Save button.
                    So the label wraps only the caption and points at the input. */}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="settings-username">
                        Username
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
                                // Any edit invalidates the last outcome — leaving
                                // "Saved." under a field being retyped claims
                                // something about text that is no longer saved.
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
                            {status === 'saving' ? 'Saving…' : 'Save'}
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
                        {message ?? 'What the app calls you. Only you see it.'}
                    </span>
                </div>

                <div className={styles.rows}>
                    <button
                        type="button"
                        className={styles.row}
                        onClick={onChangeEmail}
                        aria-label="Change email"
                    >
                        <span className={styles.rowText}>
                            <span className={styles.rowTitle}>Email</span>
                            <span className={styles.rowSub}>{email ?? 'Not set'}</span>
                        </span>
                        <ChevronIcon dir="right" />
                    </button>
                    <button type="button" className={styles.row} onClick={onChangePassword}>
                        <span className={styles.rowText}>
                            <span className={styles.rowTitle}>Password</span>
                            <span className={styles.rowSub}>
                                You&rsquo;ll confirm your current one first.
                            </span>
                        </span>
                        <ChevronIcon dir="right" />
                    </button>
                    {/* Shown rather than hidden: a settings panel with no mention of
                        an avatar reads as one that will never have it. The Avatar
                        beside it is the current one, so the row shows what it is
                        offering to change. */}
                    <div className={`${styles.row} ${styles.soon}`}>
                        <Avatar size={26} />
                        <span className={styles.rowText}>
                            <span className={styles.rowTitle}>Avatar</span>
                            <span className={styles.rowSub}>Everyone gets the cat for now.</span>
                        </span>
                        <span className={styles.soonTag}>Soon</span>
                    </div>
                </div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Close
                </button>
            </div>
        </Dialog>
    );
}

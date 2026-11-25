import type { ThemePref } from '@/hooks/useTheme';
import type { GuidePref } from '@/hooks/useGuidePref';
import type { AuthUser } from '@/hooks/useAuth';
import { Dialog } from '@/components/shared/Dialog';
import { useCopy } from '@/i18n/localeContext';
import { LanguagePicker } from './LanguagePicker';
import { FontPicker } from './FontPicker';
import { ThemePicker } from './ThemePicker';
import { GuideToggle } from './GuideToggle';
import shell from '@/components/shared/dialogShell.module.css';
import styles from '@/components/shared/sheetShell.module.css';

type AccountSheetProps = {
    themePref: ThemePref;
    guidePref: GuidePref;
    supportUrl: string;
    user: AuthUser | null;
    onClose: () => void;
    onPickTheme: (pref: ThemePref) => void;
    onPickGuide: (pref: GuidePref) => void;
    onSignIn: () => void;
    /** signed in only; hands off to the dialog the way onSignIn does */
    onOpenAccountSettings: () => void;
    onSignOut: () => void;
    /** signed in only; hands off to the data and privacy dialog */
    onOpenData: () => void;
};

/** The phone's home for the top bar's right cluster. */
export function AccountSheet({
    themePref,
    guidePref,
    supportUrl,
    user,
    onClose,
    onPickTheme,
    onPickGuide,
    onSignIn,
    onOpenAccountSettings,
    onSignOut,
    onOpenData,
}: AccountSheetProps) {
    const { common, topBar, themePicker, guideToggle, languagePicker, fontPicker, accountSheet } =
        useCopy();
    const titleId = 'account-sheet-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{accountSheet.eyebrow}</div>
                <h3 id={titleId} className={shell.title}>
                    {user === null ? topBar.guest : user.username}
                </h3>
                {user?.email !== undefined && <p className={shell.sub}>{user.email}</p>}
            </div>
            <div className={styles.items}>
                <div className={styles.pickerRow}>
                    <b className={styles.pickerLabel}>{themePicker.label}</b>
                    <ThemePicker pref={themePref} onPick={onPickTheme} />
                </div>
                {/* Guest only. */}
                {user === null && (
                    <>
                        <div className={styles.pickerRow}>
                            <b className={styles.pickerLabel}>{languagePicker.label}</b>
                            <LanguagePicker caption={false} />
                        </div>
                        <div className={styles.pickerRow}>
                            <b className={styles.pickerLabel}>{fontPicker.label}</b>
                            <FontPicker caption={false} />
                        </div>
                        <div className={styles.pickerRow}>
                            <div className={styles.switchLine}>
                                <b className={styles.pickerLabel}>{guideToggle.label}</b>
                                <GuideToggle pref={guidePref} onPick={onPickGuide} />
                            </div>
                            <span className={styles.pickerNote}>{accountSheet.guideNote}</span>
                        </div>
                    </>
                )}
                <a
                    className={styles.item}
                    href={supportUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}
                >
                    <b>{topBar.support}</b>
                    <span>{accountSheet.supportNote}</span>
                </a>
                {user === null ? (
                    <button type="button" className={styles.item} onClick={onSignIn}>
                        <b>{topBar.signIn}</b>
                        <span>{accountSheet.signInNote}</span>
                    </button>
                ) : (
                    <>
                        <button type="button" className={styles.item} onClick={onOpenData}>
                            <b>{accountSheet.data}</b>
                            <span>{accountSheet.dataNote}</span>
                        </button>
                        <button
                            type="button"
                            className={styles.item}
                            onClick={onOpenAccountSettings}
                        >
                            <b>{accountSheet.accountSettings}</b>
                            <span>{accountSheet.accountSettingsNote}</span>
                        </button>
                        <button
                            type="button"
                            className={styles.item}
                            onClick={() => {
                                onSignOut();
                                onClose();
                            }}
                        >
                            <b>{accountSheet.signOut}</b>
                            <span>{accountSheet.signOutNote}</span>
                        </button>
                    </>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {common.close}
                </button>
            </div>
        </Dialog>
    );
}

import { readStoredText, recoveryFilename } from '@/storage/recovery';
import { downloadText } from '@/utils/downloadText';
import { useCopy } from '@/i18n/localeContext';
import styles from './CrashScreen.module.css';

type CrashScreenProps = {
    /** 'app': nothing rendered, so a reload is the only way on. 'view': one pane failed, so switching tabs is the way out. */
    readonly scope: 'app' | 'view';
};

/** What an ErrorBoundary shows once something below it has thrown. */
export function CrashScreen({ scope }: CrashScreenProps) {
    const { crashScreen } = useCopy();
    const stored = readStoredText();
    // A bordered strip with nothing in it is a rule under the body, so the one
    // case that offers neither button drops the foot entirely.
    const hasFoot = stored !== null || scope === 'app';

    function handleDownload() {
        if (stored === null) return;
        downloadText(recoveryFilename(new Date()), stored, 'application/json');
    }

    return (
        <div className={scope === 'app' ? `${styles.crash} ${styles.full}` : styles.crash}>
            <div className={styles.panel}>
                <div className={styles.head}>
                    <h2 className={styles.title}>
                        {scope === 'app' ? crashScreen.appTitle : crashScreen.viewTitle}
                    </h2>
                </div>
                <div className={styles.body}>
                    <p className={styles.text}>
                        {scope === 'app' ? crashScreen.appBody : crashScreen.viewBody}
                    </p>
                    {stored !== null && <p className={styles.text}>{crashScreen.offerCopy}</p>}
                </div>
                {hasFoot && (
                    <div className={styles.foot}>
                        {stored !== null && (
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.ghost}`}
                                onClick={handleDownload}
                            >
                                {crashScreen.download}
                            </button>
                        )}
                        {scope === 'app' && (
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.primary}`}
                                onClick={() => window.location.reload()}
                            >
                                {crashScreen.reload}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

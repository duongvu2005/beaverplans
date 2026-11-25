import { useId } from 'react';
import { LOCALES, type Locale } from '@/i18n/locale';
import { useCopy, useLocale } from '@/i18n/localeContext';
import segmented from './segmented.module.css';
import styles from './pickerField.module.css';

type LanguagePickerProps = {
    /** whether to draw the caption; off where the host already names the control */
    caption?: boolean;
    className?: string;
};

/** The app's language, as one segmented control. Must sit below the provider. */
export function LanguagePicker({ caption = true, className }: LanguagePickerProps) {
    const { locale, setLocale } = useLocale();
    const { languagePicker } = useCopy();
    const labelId = useId();

    const NAMES: Record<Locale, string> = {
        en: languagePicker.english,
        vi: languagePicker.vietnamese,
    };

    // Named by the caption where there is one and by aria-label where there is
    // not, never both; the group stays named either way.
    const row = (
        <div
            className={
                caption || className === undefined ? segmented.row : `${segmented.row} ${className}`
            }
            role="group"
            aria-labelledby={caption ? labelId : undefined}
            aria-label={caption ? undefined : languagePicker.label}
        >
            {LOCALES.map((option) => (
                <button
                    key={option}
                    type="button"
                    className={
                        locale === option ? `${segmented.btn} ${segmented.on}` : segmented.btn
                    }
                    aria-pressed={locale === option}
                    aria-label={languagePicker.choose(NAMES[option])}
                    onClick={() => {
                        // Re-picking the current one writes nothing.
                        if (locale !== option) setLocale(option);
                    }}
                >
                    {NAMES[option]}
                </button>
            ))}
        </div>
    );

    if (!caption) return row;

    return (
        <div className={className === undefined ? styles.field : `${styles.field} ${className}`}>
            <span className={styles.label} id={labelId}>
                {languagePicker.label}
            </span>
            {row}
        </div>
    );
}

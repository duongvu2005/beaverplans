import type { ThemePref } from '@/hooks/useTheme';
import { useCopy } from '@/i18n/localeContext';
import styles from './segmented.module.css';

// Segment order, which is layout; the words come from the catalog.
const OPTIONS: ReadonlyArray<ThemePref> = ['light', 'dark', 'system'];

type ThemePickerProps = {
    pref: ThemePref;
    onPick: (pref: ThemePref) => void;
    className?: string;
};

/** Light / Dark / System, as one segmented control. Shows the preference, not the resolved theme. */
export function ThemePicker({ pref, onPick, className }: ThemePickerProps) {
    const { themePicker } = useCopy();
    // Annotated so a fourth preference fails the build rather than rendering a
    // blank segment; the catalog is a plain object and cannot enforce that.
    const labels: Record<ThemePref, string> = themePicker.options;

    return (
        <div
            className={className === undefined ? styles.row : `${styles.row} ${className}`}
            role="group"
            aria-label={themePicker.label}
        >
            {OPTIONS.map((option) => (
                <button
                    key={option}
                    type="button"
                    className={pref === option ? `${styles.btn} ${styles.on}` : styles.btn}
                    aria-pressed={pref === option}
                    onClick={() => {
                        // Re-picking the current one writes nothing.
                        if (pref !== option) onPick(option);
                    }}
                >
                    {labels[option]}
                </button>
            ))}
        </div>
    );
}

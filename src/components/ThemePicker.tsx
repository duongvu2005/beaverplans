import type { ThemePref } from '../hooks/useTheme';
import styles from './ThemePicker.module.css';

const OPTIONS: ReadonlyArray<{ value: ThemePref; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'Auto' },
];

type ThemePickerProps = {
    pref: ThemePref;
    onPick: (pref: ThemePref) => void;
    className?: string;
};

/**
 * Light / Dark / System, as one segmented control.
 *
 * Shared by the desktop menu and the phone sheet rather than written twice: with
 * two options a single "Switch to dark" row worked, but three states cannot be a
 * toggle — cycling through them makes you press a button up to three times to
 * reach the one you want, and never says what the other two are.
 *
 * Shows the PREFERENCE, not the resolved theme: someone on System with a dark OS
 * needs System lit, not Dark, or the control would claim they had picked a fixed
 * palette they can then never appear to leave.
 */
export function ThemePicker({ pref, onPick, className }: ThemePickerProps) {
    return (
        <div
            className={className === undefined ? styles.row : `${styles.row} ${className}`}
            role="group"
            aria-label="Theme"
        >
            {OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className={pref === option.value ? `${styles.btn} ${styles.on}` : styles.btn}
                    aria-pressed={pref === option.value}
                    onClick={() => {
                        // Re-picking the current one is a no-op rather than a
                        // state write, so the menu it lives in does not flicker.
                        if (pref !== option.value) onPick(option.value);
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

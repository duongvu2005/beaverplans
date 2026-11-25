import { useId } from 'react';
import { FONTS, type FontPref } from '@/font/font';
import { useFont } from '@/font/fontContext';
import { useCopy } from '@/i18n/localeContext';
import segmented from './segmented.module.css';
import field from './pickerField.module.css';
import styles from './FontPicker.module.css';

// CSS module lookups are `string | undefined` under noUncheckedIndexedAccess,
// so the class list is filtered rather than interpolated.
const FACE_CLASS: Record<FontPref, string | undefined> = {
    modern: styles.modern,
    classic: styles.classic,
};

function classes(...names: readonly (string | undefined)[]): string {
    return names.filter((name): name is string => name !== undefined).join(' ');
}

type FontPickerProps = {
    /** whether to draw the caption; off where the host already names the control */
    caption?: boolean;
    className?: string;
};

/** Modern / Classic, as one segmented control. Must sit below the provider. */
export function FontPicker({ caption = true, className }: FontPickerProps) {
    const { font, setFont } = useFont();
    const { fontPicker } = useCopy();
    // Annotated so a third look fails the build rather than rendering a blank
    // segment; the catalog is a plain object and cannot enforce that.
    const labels: Record<FontPref, string> = fontPicker.options;
    const labelId = useId();

    // Named by the caption where there is one and by aria-label where there is
    // not, never both.
    const row = (
        <div
            className={
                caption || className === undefined ? segmented.row : `${segmented.row} ${className}`
            }
            role="group"
            aria-labelledby={caption ? labelId : undefined}
            aria-label={caption ? undefined : fontPicker.label}
        >
            {FONTS.map((option) => (
                <button
                    key={option}
                    type="button"
                    className={classes(
                        segmented.btn,
                        FACE_CLASS[option],
                        font === option ? segmented.on : undefined,
                    )}
                    aria-pressed={font === option}
                    onClick={() => {
                        // Re-picking the current one writes nothing.
                        if (font !== option) setFont(option);
                    }}
                >
                    {labels[option]}
                </button>
            ))}
        </div>
    );

    if (!caption) return row;

    return (
        <div className={className === undefined ? field.field : `${field.field} ${className}`}>
            <span className={field.label} id={labelId}>
                {fontPicker.label}
            </span>
            {row}
        </div>
    );
}

import type { GuidePref } from '@/hooks/useGuidePref';
import { useCopy } from '@/i18n/localeContext';
import styles from './GuideToggle.module.css';

type GuideToggleProps = {
    pref: GuidePref;
    onPick: (pref: GuidePref) => void;
    className?: string;
};

/** The guide, on or off, as a switch. The row it sits in has to carry the label. */
export function GuideToggle({ pref, onPick, className }: GuideToggleProps) {
    const { guideToggle } = useCopy();
    const on = pref === 'yes';

    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={guideToggle.label}
            className={className === undefined ? styles.track : `${styles.track} ${className}`}
            onClick={() => onPick(on ? 'no' : 'yes')}
        >
            <span className={styles.knob} aria-hidden="true" />
        </button>
    );
}

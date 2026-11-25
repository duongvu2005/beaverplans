import type { DateKey } from '@/core/types';
import { weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import styles from './WeekRef.module.css';

type WeekRefProps = {
    /** the week being named, a Monday */
    weekStart: DateKey;
    onView: (weekStart: DateKey) => void;
};

/** A week named inside prose, which takes you to it. */
export function WeekRef({ weekStart, onView }: WeekRefProps) {
    const { locale } = useLocale();
    const { weekRef } = useCopy();
    const label = weekRangeLabel(weekStart, locale);
    return (
        <button
            type="button"
            className={styles.ref}
            onClick={() => onView(weekStart)}
            aria-label={weekRef.goTo(label)}
            title={weekRef.goTo(label)}
        >
            {label}
        </button>
    );
}

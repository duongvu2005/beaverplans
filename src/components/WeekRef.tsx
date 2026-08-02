import type { DateKey } from '../core/types';
import { weekRangeLabel } from '../core/dates';
import styles from './WeekRef.module.css';

type WeekRefProps = {
    /** the week being named, a Monday */
    weekStart: DateKey;
    onView: (weekStart: DateKey) => void;
};

/**
 * A week named inside prose, which takes you to it.
 *
 * A button and not a link: there is no router and so no URL to point at. It
 * carries a dotted underline at rest rather than a link's solid one — enough to
 * say the words are a control, not so much that a sentence with one in it reads
 * as a wall of links — and goes solid and terracotta on hover or focus.
 *
 * Where it lands may well be a week you cannot edit; the header there says so
 * itself, so nothing needs to be withheld here.
 */
export function WeekRef({ weekStart, onView }: WeekRefProps) {
    const label = weekRangeLabel(weekStart);
    return (
        <button
            type="button"
            className={styles.ref}
            onClick={() => onView(weekStart)}
            aria-label={`Go to ${label}`}
            title={`Go to ${label}`}
        >
            {label}
        </button>
    );
}

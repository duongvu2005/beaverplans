import type { Progress } from '../core/progress';
import styles from './PointsStat.module.css';

type PointsStatProps = Progress & { showPoint?: boolean };

// Renders nothing when there's nothing to report (total 0), same as an empty
// day column shows no stat at all.
export function PointsStat({ done, total, showPoint = false }: PointsStatProps) {
    if (total === 0) return null;
    return (
        <span className={styles.stat}>
            {done}/{total} {showPoint && `pts`}
        </span>
    );
}

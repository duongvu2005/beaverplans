import type { Progress } from '@/core/progress';
import styles from './PointsStat.module.css';

type PointsStatProps = Progress;

export function PointsStat({ done, total }: PointsStatProps) {
    if (total === 0) return null;
    return (
        <span className={styles.stat}>
            {done}/{total}
        </span>
    );
}

import { percentOf } from '../core/math';
import type { Progress } from '../core/progress';
import styles from './ProgressBar.module.css';

type ProgressBarProps = Progress & {
    className?: string;
};

export function ProgressBar({ done, total, className }: ProgressBarProps) {
    if (total === 0) return null;
    const pct = percentOf(done, total);
    return (
        <span className={className ? `${styles.bar} ${className}` : styles.bar}>
            <span className={styles.fill} style={{ width: `${pct}%` }} />
        </span>
    );
}

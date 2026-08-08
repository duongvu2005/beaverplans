import { percentOf } from '@/core/math';
import type { Progress } from '@/core/progress';
import styles from './ProgressBar.module.css';

type ProgressBarProps = Progress & {
    className?: string;
    alwaysShow?: boolean;
};

export function ProgressBar({ done, total, className, alwaysShow = false }: ProgressBarProps) {
    if (total === 0 && !alwaysShow) return null;
    const pct = percentOf(done, total);
    return (
        <span className={className ? `${styles.bar} ${className}` : styles.bar}>
            <span className={styles.fill} style={{ width: `${pct}%` }} />
        </span>
    );
}

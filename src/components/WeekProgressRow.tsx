import { percentOf } from '../core/math';
import type { Progress } from '../core/progress';
import { ProgressBar } from './ProgressBar';
import styles from './WeekProgressRow.module.css';

type WeekProgressRowProps = {
    progress: Progress;
    onEndWeek: () => void;
};

export function WeekProgressRow({ progress, onEndWeek }: WeekProgressRowProps) {
    const pct = Math.round(percentOf(progress.done, progress.total));
    return (
        <div className={styles.row}>
            <ProgressBar {...progress} className={styles.progress} />
            <span className={styles.pct}>
                {progress.done}/{progress.total} · {pct}%
            </span>
            <button type="button" className={styles.endWeek} onClick={onEndWeek}>
                End week
                <span className={styles.endWeekIcon}>↺</span>
            </button>
        </div>
    );
}

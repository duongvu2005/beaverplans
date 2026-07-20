import { Grip } from './Grip';
import { CloseIcon } from './CloseIcon';
import { WeightDots } from './WeightDots';
import type { Subtask } from '../core/types';
import styles from './SubtaskRow.module.css';

type SubtaskRowProps = {
    subtask: Subtask;
    onSetWeight: (id: string, weight: number) => void;
    onSetNote: (id: string, note: string) => void;
    onRemove: (id: string) => void;
};

export function SubtaskRow({ subtask, onSetWeight, onSetNote, onRemove }: SubtaskRowProps) {
    return (
        <div className={styles.row}>
            <Grip className={styles.grip} />
            <input
                className={styles.subnote}
                value={subtask.description ?? ''}
                placeholder="add a note (optional)"
                onChange={(e) => onSetNote(subtask.id, e.target.value)}
            />
            <WeightDots weight={subtask.weight} onChange={(w) => onSetWeight(subtask.id, w)} />
            <button
                type="button"
                className={styles.iconBtn}
                aria-label="Remove subtask"
                title="Remove"
                onClick={() => onRemove(subtask.id)}
            >
                <CloseIcon />
            </button>
        </div>
    );
}

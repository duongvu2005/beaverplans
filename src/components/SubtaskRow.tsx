import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grip } from './Grip';
import { CloseIcon } from './CloseIcon';
import { WeightChip } from './WeightChip';
import type { Subtask } from '../core/types';
import styles from './SubtaskRow.module.css';

type SubtaskRowProps = {
    subtask: Subtask;
    onSetWeight: (id: string, weight: number) => void;
    onSetNote: (id: string, note: string) => void;
    onRemove: (id: string) => void;
};

export function SubtaskRow({ subtask, onSetWeight, onSetNote, onRemove }: SubtaskRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subtask.id, data: { type: 'subtask', day: subtask.assignedDay } });

    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={isDragging ? `${styles.row} ${styles.dragging}` : styles.row}
        >
            <span
                ref={setActivatorNodeRef}
                className={styles.gripHandle}
                title="Drag to reorder, or move to another day"
                aria-label="Drag to reorder subtask"
                {...attributes}
                {...listeners}
            >
                <Grip className={styles.grip} />
            </span>
            <input
                className={styles.subnote}
                value={subtask.description ?? ''}
                placeholder="add a note (optional)"
                onChange={(e) => onSetNote(subtask.id, e.target.value)}
            />
            <WeightChip
                weight={subtask.weight}
                onChange={(w) => onSetWeight(subtask.id, w)}
                label={subtask.description || undefined}
            />
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

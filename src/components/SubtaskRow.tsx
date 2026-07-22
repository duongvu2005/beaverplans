import { Grip } from './Grip';
import { CloseIcon } from './CloseIcon';
import { WeightChip } from './WeightChip';
import type { Subtask } from '../core/types';
import type { SubtaskDnd } from './useSubtaskDnd';
import styles from './SubtaskRow.module.css';

type SubtaskRowProps = {
    subtask: Subtask;
    dnd: SubtaskDnd;
    onSetWeight: (id: string, weight: number) => void;
    onSetNote: (id: string, note: string) => void;
    onRemove: (id: string) => void;
};

export function SubtaskRow({ subtask, dnd, onSetWeight, onSetNote, onRemove }: SubtaskRowProps) {
    const { hint, draggingId } = dnd;
    const isRowHint = hint?.kind === 'row' && hint.id === subtask.id;
    const rowClass = [
        styles.row,
        draggingId === subtask.id && styles.dragging,
        isRowHint && hint.pos === 'before' && styles.dropBefore,
        isRowHint && hint.pos === 'after' && styles.dropAfter,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={rowClass}
            data-drag-row
            onDragOver={(e) => dnd.overRow(e, subtask.assignedDay, subtask.id)}
            onDrop={(e) => dnd.dropRow(e, subtask.assignedDay, subtask.id)}
        >
            <span
                className={styles.gripHandle}
                draggable
                onDragStart={(e) => dnd.start(e, subtask.id)}
                onDragEnd={dnd.end}
                title="Drag to reorder, or move to another day"
                aria-label="Drag to reorder subtask"
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

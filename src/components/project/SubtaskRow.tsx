import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, Ref } from 'react';
import { Grip } from '@/components/shared/icons/Grip';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { WeightChip } from './WeightChip';
import type { Subtask } from '@/core/types';
import { LIMITS } from '@/core/limits';
import { useCopy } from '@/i18n/localeContext';
import styles from './SubtaskRow.module.css';

type Sortable = ReturnType<typeof useSortable>;

/** Everything the editor row has and its drag clone must not: a second `useSortable` under the same id registers a duplicate node. */
type SubtaskRowLive = {
    readonly rootRef: Ref<HTMLDivElement>;
    readonly style: CSSProperties;
    readonly dragging: boolean;
    readonly gripRef: Ref<HTMLSpanElement>;
    readonly gripAttributes: Sortable['attributes'];
    readonly gripListeners: Sortable['listeners'];
    readonly onSetWeight: (id: string, weight: number) => void;
    readonly onSetNote: (id: string, note: string) => void;
    readonly onRemove: (id: string) => void;
};

type RowProps = {
    subtask: Subtask;
    /** absent in the drag clone, which renders this same markup inert */
    live?: SubtaskRowLive;
};

/** The markup both the live row and its drag clone are made of. */
function Row({ subtask, live }: RowProps) {
    const { subtaskRow } = useCopy();
    const gripProps = live === undefined ? {} : { ...live.gripAttributes, ...live.gripListeners };

    return (
        <div
            ref={live?.rootRef}
            style={live?.style}
            className={[
                styles.row,
                live?.dragging && styles.dragging,
                // the one place clone and row are allowed to differ — see .grabbed
                live === undefined && styles.grabbed,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <span
                ref={live?.gripRef}
                className={styles.gripHandle}
                title={subtaskRow.dragTitle}
                aria-label={subtaskRow.dragLabel}
                {...gripProps}
            >
                <Grip className={styles.grip} />
            </span>
            <input
                className={styles.subnote}
                value={subtask.description ?? ''}
                maxLength={LIMITS.descriptionLength}
                placeholder={subtaskRow.notePlaceholder}
                readOnly={live === undefined}
                onChange={(e) => live?.onSetNote(subtask.id, e.target.value)}
            />
            <WeightChip
                weight={subtask.weight}
                onChange={(w) => live?.onSetWeight(subtask.id, w)}
                label={subtask.description || undefined}
            />
            <button
                type="button"
                className={styles.iconBtn}
                aria-label={subtaskRow.removeLabel}
                title={subtaskRow.removeTitle}
                onClick={() => live?.onRemove(subtask.id)}
            >
                <CloseIcon />
            </button>
        </div>
    );
}

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

    return (
        <Row
            subtask={subtask}
            live={{
                rootRef: setNodeRef,
                style: { transform: CSS.Transform.toString(transform), transition },
                dragging: isDragging,
                gripRef: setActivatorNodeRef,
                gripAttributes: attributes,
                gripListeners: listeners,
                onSetWeight,
                onSetNote,
                onRemove,
            }}
        />
    );
}

/** The floating clone of a subtask being dragged, for `DragOverlay`. */
export function SubtaskRowPreview({ subtask }: { subtask: Subtask }) {
    return <Row subtask={subtask} />;
}

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, Ref } from 'react';
import { isTaskDone } from '@/core/projects';
import { LIMITS } from '@/core/limits';
import { taskProgress } from '@/core/progress';
import type { DateKey, Task } from '@/core/types';
import { Grip } from '@/components/shared/icons/Grip';
import { EditIcon } from '@/components/shared/icons/EditIcon';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { ArrowRightIcon } from '@/components/shared/icons/ArrowRightIcon';
import { PointsStat } from '@/components/shared/PointsStat';
import type { TreeKeysApi } from './useTreeKeys';
import { type GuideApi, cuesEditTask, cuesTaskName } from './guide';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { deadlineLabel } from '@/i18n/dateCopy';
import { deadlineTone } from '@/core/deadline';
import styles from './TaskRow.module.css';
import check from '@/components/shared/checkbox.module.css';
import cue from '@/components/shared/cue.module.css';

type Sortable = ReturnType<typeof useSortable>;

/** Everything the row has and its drag clone must not: a second `useSortable` under the same id registers a duplicate node. */
type TaskRowLive = {
    readonly projectId: string;
    readonly rootRef: Ref<HTMLLIElement>;
    readonly style: CSSProperties;
    readonly dragging: boolean;
    readonly gripRef: Ref<HTMLSpanElement>;
    readonly gripAttributes: Sortable['attributes'];
    readonly gripListeners: Sortable['listeners'];
    readonly onEditTask: (taskId: string) => void;
    readonly onToggleTask: (taskId: string) => void;
    readonly onRenameTask: (taskId: string, name: string) => void;
    readonly onRemoveTask: (taskId: string) => void;
    readonly treeKeys: TreeKeysApi;
    /** absent unless the onboarding guide is running — see GuideApi */
    readonly guide?: GuideApi;
};

type RowProps = {
    task: Task;
    weekStart: DateKey;
    today: DateKey;
    /** whether the week on screen has ended, and so is a frozen record */
    frozen: boolean;
    /** absent in the drag clone, which renders this same markup inert */
    live?: TaskRowLive;
    /** clone only: this row is what the pointer picked up — see .grabbed */
    grabbed?: boolean;
};

/** The markup both the live row and its drag clone are made of. */
function Row({ task, weekStart, today, frozen, live, grabbed = false }: RowProps) {
    const { taskRow } = useCopy();
    const { locale } = useLocale();

    const undated = task.subtasks.length === 0;
    const done = isTaskDone(task);
    // undefined for both "none set" and "set but no longer parseable"
    const deadline = task.deadline ? deadlineLabel(task.deadline, locale) : undefined;
    const tone = task.deadline
        ? deadlineTone({ deadline: task.deadline, weekStart, today, isDone: done, frozen })
        : 'quiet';
    const gripProps = live === undefined ? {} : { ...live.gripAttributes, ...live.gripListeners };

    const guide = live?.guide;
    const nameCued = cuesTaskName(guide, task.id);
    const editCued = cuesEditTask(guide, task.id);
    // The assign-days nudge points at the same control as the guide's step three,
    // so it waits its turn while any earlier step is running.
    const assignMuted = guide !== undefined && !editCued;

    return (
        <li
            ref={live?.rootRef}
            style={live?.style}
            className={[
                styles.row,
                live?.dragging && styles.dragging,
                // the one place clone and row are allowed to differ — see .grabbed
                grabbed && styles.grabbed,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className={styles.top}>
                <span
                    ref={live?.gripRef}
                    className={styles.gripHandle}
                    title={taskRow.dragTitle}
                    aria-label={taskRow.dragLabel}
                    {...gripProps}
                >
                    <Grip className={styles.grip} />
                </span>
                <input
                    type="checkbox"
                    className={check.box}
                    checked={done}
                    readOnly={live === undefined}
                    // The name is the sibling input's value, not a label, so nothing
                    // names this otherwise.
                    aria-label={task.name}
                    onChange={() => live?.onToggleTask(task.id)}
                />
                <div className={styles.main}>
                    <input
                        ref={(el) => {
                            live?.treeKeys.register(task.id, el);
                        }}
                        className={[
                            styles.name,
                            done && styles.done,
                            cue.fieldSlot,
                            nameCued && cue.field,
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        value={task.name}
                        maxLength={LIMITS.nameLength}
                        placeholder={taskRow.namePlaceholder}
                        readOnly={live === undefined}
                        onChange={(e) => live?.onRenameTask(task.id, e.target.value)}
                        onFocus={() => guide?.onNameFocus(task.id)}
                        onBlur={() => guide?.onNameBlur(task.id)}
                        onKeyDown={(e) => {
                            if (live !== undefined) {
                                live.treeKeys.onKeyDown(
                                    { kind: 'task', id: task.id, projectId: live.projectId },
                                    e,
                                );
                            }
                        }}
                    />
                </div>
                {undated ? (
                    // Dropped on phone rows, which have no width for it.
                    assignMuted ? null : (
                        <span className={styles.assignHint} title={taskRow.assignTitle}>
                            {taskRow.assignDays}
                            <ArrowRightIcon className={styles.arrow} />
                        </span>
                    )
                ) : (
                    <PointsStat {...taskProgress(task)} />
                )}
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={[
                            styles.iconBtn,
                            undated && styles.assignCta,
                            undated && assignMuted && cue.muted,
                            editCued && cue.target,
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        onClick={() => live?.onEditTask(task.id)}
                        aria-label={taskRow.editTask}
                        title={taskRow.editTitle}
                    >
                        <EditIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label={taskRow.deleteTask}
                        onClick={() => live?.onRemoveTask(task.id)}
                    >
                        <CloseIcon />
                    </button>
                </div>
            </div>
            {deadline && <span className={`${styles.deadline} ${styles[tone]}`}>{deadline}</span>}
        </li>
    );
}

type TaskRowProps = {
    task: Task;
    projectId: string;
    weekStart: DateKey;
    today: DateKey;
    /** whether the week on screen has ended, and so is a frozen record */
    frozen: boolean;
    onEditTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveTask: (taskId: string) => void;
    treeKeys: TreeKeysApi;
    /** absent unless the onboarding guide is running — see GuideApi */
    guide?: GuideApi;
};

export function TaskRow({
    task,
    projectId,
    weekStart,
    today,
    frozen,
    onEditTask,
    onToggleTask,
    onRenameTask,
    onRemoveTask,
    treeKeys,
    guide,
}: TaskRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, data: { type: 'task', projectId } });

    return (
        <Row
            task={task}
            weekStart={weekStart}
            today={today}
            frozen={frozen}
            live={{
                projectId,
                rootRef: setNodeRef,
                style: { transform: CSS.Transform.toString(transform), transition },
                dragging: isDragging,
                gripRef: setActivatorNodeRef,
                gripAttributes: attributes,
                gripListeners: listeners,
                onEditTask,
                onToggleTask,
                onRenameTask,
                onRemoveTask,
                treeKeys,
                guide,
            }}
        />
    );
}

type TaskRowPreviewProps = {
    task: Task;
    weekStart: DateKey;
    today: DateKey;
    frozen: boolean;
    /** Whether the pointer picked up THIS row, as opposed to the project carrying it. */
    grabbed: boolean;
};

/** The floating clone of a task row, for `DragOverlay`. Carries the deadline caption so it matches the row's height. */
export function TaskRowPreview({ task, weekStart, today, frozen, grabbed }: TaskRowPreviewProps) {
    return (
        <Row task={task} weekStart={weekStart} today={today} frozen={frozen} grabbed={grabbed} />
    );
}

import { useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    type Modifier,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { Dialog } from './Dialog';
import { buildTask } from '../core/buildTask';
import { canMoveSubtaskTo } from '../core/projects';
import { parseDeadline } from '../core/deadline';
import { WEEK } from '../core/types';
import type { Task, Subtask, DayOfWeek } from '../core/types';
import { newId } from '../utils/newId';
import styles from './TaskEditor.module.css';
import subStyles from './SubtaskRow.module.css';
import { SubtaskRow } from './SubtaskRow';
import { Grip } from './Grip';
import shell from './dialogShell.module.css';
import {
    addSubtaskOn as addSubtaskToDraft,
    moveSubtaskInDraft,
    removeSubtask as removeSubtaskFromDraft,
    removeSubtasksOnDay,
    setSubtaskNote as setNoteInDraft,
    setSubtaskWeight as setWeightInDraft,
} from '../core/subtaskDraft';
import { beforeIdForDrop } from './dndReorder';

type TaskEditorProps = {
    task: Task;
    projectName: string;
    onClose: () => void;
    onSave: (nextTask: Task) => void;
};

const DAY_INITIAL: Record<DayOfWeek, string> = {
    mon: 'M',
    tue: 'T',
    wed: 'W',
    thu: 'T',
    fri: 'F',
    sat: 'S',
    sun: 'S',
};

const DAY_SHORT: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
};

const DAY_NAME: Record<DayOfWeek, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
};

// Keep the dragged clone under the cursor. Revealing the empty day groups at
// drag start shifts the measured rect downward, which would otherwise leave the
// clone below the pointer. Horizontal never shifts, so the grip stays exactly
// where it was grabbed; only the vertical is re-pinned to the cursor.
const pinRowToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
    if (draggingNodeRect === null || activatorEvent === null) {
        return transform;
    }
    const coords = getEventCoordinates(activatorEvent);
    if (coords === null) {
        return transform;
    }
    return {
        ...transform,
        y: transform.y + (coords.y - draggingNodeRect.top) - draggingNodeRect.height / 2,
    };
};

type DayGroupProps = {
    day: DayOfWeek;
    subtasks: Subtask[];
    hidden: boolean;
    isFirst: boolean;
    dragging: boolean;
    droppable: boolean;
    over: boolean;
    onAddSubtask: (day: DayOfWeek) => void;
    onSetWeight: (id: string, weight: number) => void;
    onSetNote: (id: string, note: string) => void;
    onRemove: (id: string) => void;
};

// One weekday's own drop zone: its label, its subtasks and its add button. Every
// day is always mounted so a subtask can be moved onto a day it does not yet
// occupy; unused days are hidden until a drag begins. `over` is the whole-day
// highlight, driven by the day the drag is currently over (tracked in the parent)
// rather than this droppable's own hit test, so the day lights up even while the
// cursor is over one of its rows.
function DayGroup({
    day,
    subtasks,
    hidden,
    isFirst,
    dragging,
    droppable,
    over,
    onAddSubtask,
    onSetWeight,
    onSetNote,
    onRemove,
}: DayGroupProps) {
    const { setNodeRef } = useDroppable({ id: `day:${day}`, data: { type: 'day', day } });
    const groupClass = [
        styles.daygroup,
        hidden && styles.dayHidden,
        isFirst && styles.dayFirst,
        dragging && (droppable ? styles.dayOpen : styles.dayBlocked),
        over && droppable && styles.dayOver,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div ref={setNodeRef} className={groupClass}>
            <div className={styles.daylabel}>{DAY_NAME[day]}</div>
            <SortableContext
                items={subtasks.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
            >
                {subtasks.map((s) => (
                    <SubtaskRow
                        key={s.id}
                        subtask={s}
                        onSetWeight={onSetWeight}
                        onSetNote={onSetNote}
                        onRemove={onRemove}
                    />
                ))}
            </SortableContext>
            <button type="button" className={styles.addsub} onClick={() => onAddSubtask(day)}>
                + add subtask on {DAY_SHORT[day]}
            </button>
        </div>
    );
}

export function TaskEditor({ task, projectName, onClose, onSave }: TaskEditorProps) {
    const stored = task.deadline ?? '';
    const seed = parseDeadline(stored).ok ? stored : ''; // ignore a corrupt stored value
    const [date, setDate] = useState(seed.slice(0, 10));
    const [time, setTime] = useState(seed.length > 10 ? seed.slice(11, 16) : '');
    const [description, setDescription] = useState(task.description ?? '');
    const [subtasks, setSubtasks] = useState<readonly Subtask[]>(task.subtasks);
    const [activeId, setActiveId] = useState<string | null>(null);
    // The day the drag is currently over, for the whole-day highlight.
    const [overDay, setOverDay] = useState<DayOfWeek | null>(null);
    // Live copy of the draft while a subtask is dragged, reordered on every
    // dragover so the day groups open a gap; committed to the draft on drop.
    const [preview, setPreviewState] = useState<readonly Subtask[] | null>(null);
    const previewRef = useRef<readonly Subtask[] | null>(null);
    const titleId = 'task-editor-title';

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function setPreview(next: readonly Subtask[] | null) {
        previewRef.current = next;
        setPreviewState(next);
    }

    const activeDays = new Set(subtasks.map((s) => s.assignedDay));

    function toggleDay(day: DayOfWeek) {
        setSubtasks((current) =>
            current.some((s) => s.assignedDay === day)
                ? removeSubtasksOnDay(current, day)
                : addSubtaskToDraft(current, day, newId()),
        );
    }

    function addSubtaskOn(day: DayOfWeek) {
        setSubtasks((current) => addSubtaskToDraft(current, day, newId()));
    }

    function removeSubtask(id: string) {
        setSubtasks((current) => removeSubtaskFromDraft(current, id));
    }

    function setSubtaskWeight(id: string, weight: number) {
        setSubtasks((current) => setWeightInDraft(current, id, weight));
    }

    function setSubtaskNote(id: string, note: string) {
        setSubtasks((current) => setNoteInDraft(current, id, note));
    }

    function handleSave() {
        const deadline = date ? (time ? `${date}T${time}` : date) : undefined;
        onSave(buildTask(task, { description, subtasks, deadline }));
    }

    function handleDragStart(event: DragStartEvent) {
        const id = String(event.active.id);
        setActiveId(id);
        setOverDay(subtasks.find((s) => s.id === id)?.assignedDay ?? null);
    }

    // Tracks the day under the cursor for the highlight, and relocates the
    // subtask when it crosses into another day so that day opens a gap.
    // Reordering within a day is left to dnd-kit; touching state there would
    // fight its animation and loop.
    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (over === null) {
            return;
        }
        const overData = over.data.current as
            { type: 'subtask' | 'day'; day: DayOfWeek } | undefined;
        if (overData === undefined) {
            return;
        }
        const base = previewRef.current ?? subtasks;
        const activeId = String(active.id);
        const dragged = base.find((s) => s.id === activeId);
        if (dragged === undefined) {
            return;
        }
        if (!canMoveSubtaskTo(dragged, overData.day)) {
            setOverDay(null); // an illegal day never highlights
            return;
        }
        setOverDay(overData.day);
        if (dragged.assignedDay === overData.day) {
            return; // same day: dnd-kit handles the gap
        }
        const destIds = base.filter((s) => s.assignedDay === overData.day).map((s) => s.id);
        const overId = overData.type === 'subtask' ? String(over.id) : null;
        setPreview(
            moveSubtaskInDraft(
                base,
                activeId,
                overData.day,
                beforeIdForDrop(destIds, activeId, overId),
            ),
        );
    }

    // Commit the arrangement the user is already looking at: the preview (or the
    // real draft, for a same-day reorder) has already placed the subtask in its
    // destination day, so the landing spot is read from THERE. destIds therefore
    // includes the dragged id, making beforeIdForDrop a same-container arrayMove
    // whose result matches the gap dnd-kit animated — this is what stops a
    // cross-day drop from floating above the row it was dropped under.
    function handleDragEnd(event: DragEndEvent) {
        const id = activeId;
        const over = event.over;
        const base = previewRef.current ?? subtasks;
        setActiveId(null);
        setOverDay(null);
        setPreview(null);
        if (id === null || over === null) {
            return;
        }
        const overData = over.data.current as
            { type: 'subtask' | 'day'; day: DayOfWeek } | undefined;
        if (overData === undefined) {
            return;
        }
        const dragged = base.find((s) => s.id === id);
        if (dragged === undefined || !canMoveSubtaskTo(dragged, overData.day)) {
            return;
        }
        const destIds = base.filter((s) => s.assignedDay === overData.day).map((s) => s.id);
        const overId = overData.type === 'subtask' ? String(over.id) : null;
        setSubtasks(
            moveSubtaskInDraft(base, id, overData.day, beforeIdForDrop(destIds, id, overId)),
        );
    }

    const display = preview ?? subtasks;
    const activeSubtask = subtasks.find((s) => s.id === activeId) ?? null;
    const dragging = activeId !== null;
    const activeDaysInOrder = WEEK.filter((day) => activeDays.has(day));
    const visibleDays = dragging ? WEEK : activeDaysInOrder;
    const firstVisibleDay = visibleDays[0];

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{projectName || 'Project'}</div>
                <h3 id={titleId} className={shell.title}>
                    {task.name || 'Task'}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <label className={shell.label} htmlFor="task-deadline">
                        Deadline
                    </label>
                    <div className={styles.deadrow}>
                        <input
                            id="task-deadline"
                            type="date"
                            className={styles.date}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                        <input
                            type="time"
                            className={styles.time}
                            value={time}
                            disabled={!date}
                            onChange={(e) => setTime(e.target.value)}
                        />
                    </div>
                </div>

                <div className={shell.field}>
                    <label className={shell.label}>Days</label>
                    <div
                        className={styles.days}
                        role="group"
                        aria-label="Days to work on this task"
                    >
                        {WEEK.map((day) => {
                            const on = activeDays.has(day);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={on ? `${styles.day} ${styles.on}` : styles.day}
                                    aria-pressed={on}
                                    title={DAY_NAME[day]}
                                    aria-label={DAY_NAME[day]}
                                    onClick={() => toggleDay(day)}
                                >
                                    {DAY_INITIAL[day]}
                                </button>
                            );
                        })}
                    </div>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        modifiers={[pinRowToCursor]}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => {
                            setActiveId(null);
                            setOverDay(null);
                            setPreview(null);
                        }}
                    >
                        <div className={styles.subs} hidden={visibleDays.length === 0}>
                            {WEEK.map((day) => {
                                const daySubtasks = display.filter((s) => s.assignedDay === day);
                                return (
                                    <DayGroup
                                        key={day}
                                        day={day}
                                        subtasks={daySubtasks}
                                        hidden={!dragging && daySubtasks.length === 0}
                                        isFirst={day === firstVisibleDay}
                                        dragging={dragging}
                                        droppable={
                                            activeSubtask === null ||
                                            canMoveSubtaskTo(activeSubtask, day)
                                        }
                                        over={overDay === day}
                                        onAddSubtask={addSubtaskOn}
                                        onSetWeight={setSubtaskWeight}
                                        onSetNote={setSubtaskNote}
                                        onRemove={removeSubtask}
                                    />
                                );
                            })}
                        </div>
                        <DragOverlay dropAnimation={null}>
                            {activeSubtask === null ? null : (
                                <div className={styles.dragOverlay}>
                                    <div className={subStyles.row}>
                                        <span className={subStyles.gripHandle}>
                                            <Grip className={subStyles.grip} />
                                        </span>
                                        <input
                                            className={subStyles.subnote}
                                            value={activeSubtask.description ?? ''}
                                            placeholder="add a note (optional)"
                                            readOnly
                                        />
                                    </div>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>

                    <p className={styles.note}>
                        Pick the days you&rsquo;ll work on this &mdash; each becomes a checkbox that
                        day. The dots set how much each one counts.
                    </p>
                </div>

                <div className={shell.field}>
                    <label className={shell.label} htmlFor="task-note">
                        Note
                    </label>
                    <textarea
                        id="task-note"
                        className={styles.textarea}
                        value={description}
                        placeholder="a note for the whole task (optional)"
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary}`}
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>
        </Dialog>
    );
}

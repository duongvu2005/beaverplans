import { useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MouseSensor,
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
import { Dialog } from '@/components/shared/Dialog';
import { buildTask } from '@/core/buildTask';
import { canMoveSubtaskTo } from '@/core/projects';
import { LIMITS, subtaskRoom } from '@/core/limits';
import { parseDeadline } from '@/core/deadline';
import { WEEK } from '@/core/types';
import type { Task, Subtask, DayOfWeek } from '@/core/types';
import { newId } from '@/utils/newId';
import styles from './TaskEditor.module.css';
import { SubtaskRow, SubtaskRowPreview } from './SubtaskRow';
import shell from '@/components/shared/dialogShell.module.css';
import {
    addSubtaskOn as addSubtaskToDraft,
    removeSubtask as removeSubtaskFromDraft,
    removeSubtasksOnDay,
    setSubtaskNote as setNoteInDraft,
    setSubtaskWeight as setWeightInDraft,
} from '@/core/subtaskDraft';
import { subtaskDragOver, subtaskDropCommit } from './dndReorder';
import { TOUCH_HOLD, QuietWhileTypingTouchSensor } from './dragSensors';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';

type TaskEditorProps = {
    task: Task;
    projectName: string;
    onClose: () => void;
    onSave: (nextTask: Task) => void;
};

// The data attached to each day/subtask droppable, so a drop can tell what it
// hit. Named once so the two casts below and the useDroppable call cannot drift.
type DayDropData = { type: 'day'; day: DayOfWeek } | { type: 'subtask'; day: DayOfWeek };

// Keep the dragged clone under the cursor: revealing the empty day groups at drag start shifts the measured rect.
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

// One weekday's drop zone. Every day is always mounted so a subtask can move onto a day it does not yet occupy; unused days are hidden until a drag begins.
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
    const { locale } = useLocale();
    const { taskEditor } = useCopy();
    const { setNodeRef } = useDroppable({
        id: `day:${day}`,
        data: { type: 'day', day } satisfies DayDropData,
    });
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
            <div className={styles.daylabel}>{dayName(day, locale, 'long')}</div>
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
                {taskEditor.addSubtaskOn(dayName(day, locale, 'short'))}
            </button>
        </div>
    );
}

export function TaskEditor({ task, projectName, onClose, onSave }: TaskEditorProps) {
    const { locale } = useLocale();
    const { common, taskEditor } = useCopy();
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
    const sensors = useSensors(
        // Split for the same reason as ProjectList's — see the note there.
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(QuietWhileTypingTouchSensor, { activationConstraint: TOUCH_HOLD }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const titleId = 'task-editor-title';

    // Both add paths refuse at the cap by returning the draft they were given; turning a day OFF is never refused.
    function toggleDay(day: DayOfWeek) {
        setSubtasks((current) =>
            current.some((s) => s.assignedDay === day)
                ? removeSubtasksOnDay(current, day)
                : subtaskRoom(current) === 0
                  ? current
                  : addSubtaskToDraft(current, day, newId()),
        );
    }

    function addSubtaskOn(day: DayOfWeek) {
        setSubtasks((current) =>
            subtaskRoom(current) === 0 ? current : addSubtaskToDraft(current, day, newId()),
        );
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

    function setPreview(next: readonly Subtask[] | null) {
        previewRef.current = next;
        setPreviewState(next);
    }

    function handleDragStart(event: DragStartEvent) {
        const id = String(event.active.id);
        setActiveId(id);
        setOverDay(subtasks.find((s) => s.id === id)?.assignedDay ?? null);
    }

    // Tracks the day under the cursor, and relocates the subtask when it crosses into another day. Same-day reordering is left to dnd-kit.
    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (over === null) {
            return;
        }
        const overData = over.data.current as DayDropData | undefined;
        if (overData === undefined) {
            return;
        }
        const base = previewRef.current ?? subtasks;
        const overId = overData.type === 'subtask' ? String(over.id) : null;
        const result = subtaskDragOver(base, String(active.id), overData.day, overId);
        switch (result.kind) {
            case 'ignore':
                return;
            case 'blocked':
                setOverDay(null); // an illegal day never highlights
                return;
            case 'sameDay':
                setOverDay(result.day);
                return;
            case 'moved':
                setOverDay(result.day);
                setPreview(result.preview);
                return;
        }
    }

    // Commit the arrangement already on screen: the landing spot is read from the preview.
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
        const overData = over.data.current as DayDropData | undefined;
        if (overData === undefined) {
            return;
        }
        const overId = overData.type === 'subtask' ? String(over.id) : null;
        const next = subtaskDropCommit(base, id, overData.day, overId);
        if (next !== null) {
            setSubtasks(next);
        }
    }

    function handleSave() {
        const deadline = date ? (time ? `${date}T${time}` : date) : undefined;
        onSave(buildTask(task, { description, subtasks, deadline }));
    }

    const display = preview ?? subtasks;
    const activeSubtask = subtasks.find((s) => s.id === activeId) ?? null;
    const dragging = activeId !== null;
    const activeDays = new Set(subtasks.map((s) => s.assignedDay));
    const activeDaysInOrder = WEEK.filter((day) => activeDays.has(day));
    const visibleDays = dragging ? WEEK : activeDaysInOrder;
    const firstVisibleDay = visibleDays[0];

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{projectName || common.projectFallback}</div>
                <h3 id={titleId} className={shell.title}>
                    {task.name || common.taskFallback}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <div className={styles.deadlineHead}>
                        <label className={shell.label} htmlFor="task-deadline">
                            {taskEditor.deadline}
                        </label>
                        {date && (
                            <button
                                type="button"
                                className={styles.clearDeadline}
                                onClick={() => {
                                    setDate('');
                                    setTime('');
                                }}
                            >
                                {taskEditor.clear}
                            </button>
                        )}
                    </div>
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
                    <label className={shell.label}>{taskEditor.days}</label>
                    <div className={styles.days} role="group" aria-label={taskEditor.daysLabel}>
                        {WEEK.map((day) => {
                            const on = activeDays.has(day);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={on ? `${styles.day} ${styles.on}` : styles.day}
                                    aria-pressed={on}
                                    title={dayName(day, locale, 'long')}
                                    aria-label={dayName(day, locale, 'long')}
                                    onClick={() => toggleDay(day)}
                                >
                                    {dayName(day, locale, 'letter')}
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
                        {/* The floating clone, rendered by the component it
                            stands in for — see SubtaskRowPreview. */}
                        <DragOverlay className={styles.overlay} dropAnimation={null}>
                            {activeSubtask === null ? null : (
                                <div className={styles.dragOverlay}>
                                    <SubtaskRowPreview subtask={activeSubtask} />
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>

                    <p className={styles.note}>
                        {subtaskRoom(subtasks) === 0
                            ? taskEditor.subtaskLimit(LIMITS.subtasksPerTask)
                            : taskEditor.daysHint}
                    </p>
                </div>

                <div className={shell.field}>
                    <label className={shell.label} htmlFor="task-note">
                        {taskEditor.note}
                    </label>
                    <textarea
                        id="task-note"
                        className={styles.textarea}
                        value={description}
                        maxLength={LIMITS.descriptionLength}
                        placeholder={taskEditor.notePlaceholder}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {common.cancel}
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary}`}
                    onClick={handleSave}
                >
                    {common.save}
                </button>
            </div>
        </Dialog>
    );
}

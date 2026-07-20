import { useState } from 'react';
import { Dialog } from './Dialog';
import { buildTask } from '../core/buildTask';
import { parseDeadline } from '../core/deadline';
import { WEEK } from '../core/types';
import type { Task, Subtask, DayOfWeek } from '../core/types';
import { newId } from '../utils/newId';
import styles from './TaskEditor.module.css';
import { SubtaskRow } from './SubtaskRow';

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

const DAY_NAME: Record<DayOfWeek, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
};

function makeSubtask(day: DayOfWeek): Subtask {
    return { id: newId(), isDone: false, assignedDay: day, missedDays: [], weight: 1 };
}

export function TaskEditor({ task, projectName, onClose, onSave }: TaskEditorProps) {
    const stored = task.deadline ?? '';
    const seed = parseDeadline(stored).ok ? stored : ''; // ignore a corrupt stored value
    const [date, setDate] = useState(seed.slice(0, 10));
    const [time, setTime] = useState(seed.length > 10 ? seed.slice(11, 16) : '');
    const [description, setDescription] = useState(task.description ?? '');
    const [subtasks, setSubtasks] = useState<readonly Subtask[]>(task.subtasks);
    const titleId = 'task-editor-title';

    const activeDays = new Set(subtasks.map((s) => s.assignedDay));

    function toggleDay(day: DayOfWeek) {
        setSubtasks((current) =>
            current.some((s) => s.assignedDay === day)
                ? current.filter((s) => s.assignedDay !== day)
                : [...current, makeSubtask(day)],
        );
    }

    function addSubtaskOn(day: DayOfWeek) {
        setSubtasks((current) => [...current, makeSubtask(day)]);
    }

    function removeSubtask(id: string) {
        setSubtasks((current) => current.filter((s) => s.id !== id));
    }

    function setSubtaskWeight(id: string, weight: number) {
        setSubtasks((current) => current.map((s) => (s.id === id ? { ...s, weight } : s)));
    }

    function setSubtaskNote(id: string, note: string) {
        setSubtasks((current) => current.map((s) => (s.id === id ? { ...s, description: note } : s)));
    }

    function handleSave() {
        const deadline = date ? (time ? `${date}T${time}` : date) : undefined;
        onSave(buildTask(task, { description, subtasks, deadline }));
    }

    const activeDaysInOrder = WEEK.filter((day) => activeDays.has(day));

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={styles.head}>
                <div className={styles.eyebrow}>{projectName || 'Project'}</div>
                <h3 id={titleId} className={styles.title}>
                    {task.name || 'Task'}
                </h3>
            </div>
            <div className={styles.body}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="task-deadline">
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

                <div className={styles.field}>
                    <label className={styles.label}>Days</label>
                    <div className={styles.days} role="group" aria-label="Days to work on this task">
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

                    {activeDaysInOrder.length > 0 && (
                        <div className={styles.subs}>
                            {activeDaysInOrder.map((day) => (
                                <div key={day} className={styles.daygroup}>
                                    <div className={styles.daylabel}>{DAY_NAME[day]}</div>
                                    {subtasks
                                        .filter((s) => s.assignedDay === day)
                                        .map((s) => (
                                            <SubtaskRow
                                                key={s.id}
                                                subtask={s}
                                                onSetWeight={setSubtaskWeight}
                                                onSetNote={setSubtaskNote}
                                                onRemove={removeSubtask}
                                            />
                                        ))}
                                    <button
                                        type="button"
                                        className={styles.addsub}
                                        onClick={() => addSubtaskOn(day)}
                                    >
                                        + add another
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className={styles.note}>
                        Pick the days you&rsquo;ll work on this &mdash; each becomes a checkbox that
                        day. The dots set how much each one counts.
                    </p>
                </div>

                <div className={styles.field}>
                    <label className={styles.label} htmlFor="task-note">
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
            <div className={styles.foot}>
                <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={handleSave}>
                    Save
                </button>
            </div>
        </Dialog>
    );
}

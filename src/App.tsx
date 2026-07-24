import { useState } from 'react';
import type { DayOfWeek, Task, WeekPlan } from './core/types';
import {
    addMissedDay,
    addProject,
    addTask,
    moveSubtask,
    removeMissedDay,
    removeProject,
    removeTask,
    replaceTask,
    reorderProject,
    reorderTask,
    setProjectName,
    setTaskName,
    toggleSubtask,
    toggleTask,
} from './core/projects';
import { todayKey } from './core/dates';
import { newId } from './utils/newId';
import { sampleWeek } from './fixtures/sampleWeek';
import { ProjectView } from './components/ProjectView';
import { WeekView } from './components/WeekView';
import { TaskEditor } from './components/TaskEditor';
import { MovePopover } from './components/MovePopover';
import { ConfirmDialog } from './components/ConfirmDialog';
import shell from './components/dialogShell.module.css';
import './App.css';

type View = 'plan' | 'stats' | 'archive';
type Clearing = {
    subtaskId: string;
    day: DayOfWeek;
    taskName: string;
    projectName: string;
};

const SHORT: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
};

// Locate a subtask by id, returning it with its parent task's name for labels.
function findSubtask(plan: WeekPlan, subtaskId: string) {
    for (const project of plan.projects) {
        for (const task of project.tasks) {
            const subtask = task.subtasks.find((s) => s.id === subtaskId);
            if (subtask) return { subtask, taskName: task.name, projectName: project.name };
        }
    }
    return undefined;
}

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [plan, setPlan] = useState<WeekPlan>(sampleWeek);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [movingSubtaskId, setMovingSubtaskId] = useState<string | null>(null);
    const [clearing, setClearing] = useState<Clearing | null>(null);

    const today = todayKey();

    const editingProject = editingTaskId
        ? plan.projects.find((p) => p.tasks.some((t) => t.id === editingTaskId))
        : undefined;
    const editingTask = editingProject?.tasks.find((t) => t.id === editingTaskId);

    const moving = movingSubtaskId ? findSubtask(plan, movingSubtaskId) : undefined;

    function handleEditTask(taskId: string) {
        setEditingTaskId(taskId);
    }

    function handleEditSubtask(subtaskId: string) {
        const task = plan.projects
            .flatMap((p) => p.tasks)
            .find((t) => t.subtasks.some((s) => s.id === subtaskId));
        if (task) setEditingTaskId(task.id);
    }

    function handleCloseEditor() {
        setEditingTaskId(null);
    }

    function handleSaveTask(nextTask: Task) {
        setPlan((current) => replaceTask(current, nextTask.id, nextTask));
        setEditingTaskId(null);
    }

    function handleToggleTask(taskId: string) {
        setPlan((current) => toggleTask(current, taskId));
    }

    function handleToggleSubtask(subtaskId: string) {
        setPlan((current) => toggleSubtask(current, subtaskId));
    }

    function handleRequestMove(subtaskId: string) {
        setMovingSubtaskId(subtaskId);
    }

    function handleMove(toDay: DayOfWeek, markMissed: boolean) {
        const id = movingSubtaskId;
        if (!id) return;
        setPlan((current) => {
            const found = findSubtask(current, id);
            if (!found) return current;
            const fromDay = found.subtask.assignedDay;
            const moved = moveSubtask(current, id, toDay);
            return markMissed ? addMissedDay(moved, id, fromDay) : moved;
        });
        setMovingSubtaskId(null);
    }

    function handleRequestClear(subtaskId: string, day: DayOfWeek) {
        const found = findSubtask(plan, subtaskId);
        setClearing({
            subtaskId,
            day,
            taskName: found?.taskName ?? '',
            projectName: found?.projectName ?? '',
        });
    }

    function handleConfirmClear() {
        if (!clearing) return;
        setPlan((current) => removeMissedDay(current, clearing.subtaskId, clearing.day));
        setClearing(null);
    }

    function handleAddProject() {
        setPlan((current) => addProject(current, newId()));
    }

    function handleAddTask(projectId: string) {
        setPlan((current) => addTask(current, projectId, newId()));
    }

    function handleRenameTask(taskId: string, name: string) {
        setPlan((current) => setTaskName(current, taskId, name));
    }

    function handleRenameProject(projectId: string, name: string) {
        setPlan((current) => setProjectName(current, projectId, name));
    }

    function handleRemoveProject(projectId: string) {
        setPlan((current) => removeProject(current, projectId));
    }

    function handleRemoveTask(taskId: string) {
        setPlan((current) => removeTask(current, taskId));
    }

    function handleReorderProject(projectId: string, beforeProjectId: string | null) {
        setPlan((current) => reorderProject(current, projectId, beforeProjectId));
    }

    function handleReorderTask(taskId: string, destProjectId: string, beforeTaskId: string | null) {
        setPlan((current) => reorderTask(current, taskId, destProjectId, beforeTaskId));
    }

    return (
        <>
            <nav className="tabs">
                <button
                    aria-current={view === 'plan' ? 'page' : undefined}
                    onClick={() => setView('plan')}
                >
                    plan
                </button>
                <button
                    aria-current={view === 'stats' ? 'page' : undefined}
                    onClick={() => setView('stats')}
                >
                    stats
                </button>
                <button
                    aria-current={view === 'archive' ? 'page' : undefined}
                    onClick={() => setView('archive')}
                >
                    archive
                </button>
            </nav>
            <main className="pane">
                {view === 'plan' && (
                    <div className="plan-layout">
                        <ProjectView
                            projects={plan.projects}
                            onReorderProject={handleReorderProject}
                            onReorderTask={handleReorderTask}
                            onEditTask={handleEditTask}
                            onToggleTask={handleToggleTask}
                            onAddProject={handleAddProject}
                            onAddTask={handleAddTask}
                            onRenameProject={handleRenameProject}
                            onRenameTask={handleRenameTask}
                            onRemoveProject={handleRemoveProject}
                            onRemoveTask={handleRemoveTask}
                        />
                        <WeekView
                            projects={plan.projects}
                            weekStart={plan.weekStart}
                            today={today}
                            onToggleSubtask={handleToggleSubtask}
                            onEditSubtask={handleEditSubtask}
                            onRequestMove={handleRequestMove}
                            onClearMissed={handleRequestClear}
                        />
                    </div>
                )}
                {view === 'stats' && <div>stats pane</div>}
                {view === 'archive' && <div>archive pane</div>}
            </main>
            {editingTask && editingProject && (
                <TaskEditor
                    task={editingTask}
                    projectName={editingProject.name}
                    onClose={handleCloseEditor}
                    onSave={handleSaveTask}
                />
            )}
            {moving && (
                <MovePopover
                    subtask={moving.subtask}
                    taskName={moving.taskName}
                    projectName={moving.projectName}
                    weekStart={plan.weekStart}
                    today={today}
                    onMove={handleMove}
                    onClose={() => setMovingSubtaskId(null)}
                />
            )}
            {clearing && (
                <ConfirmDialog
                    eyebrow={clearing.projectName || 'Project'}
                    title={clearing.taskName || 'Task'}
                    label="Clear missed"
                    confirmLabel="Clear"
                    onConfirm={handleConfirmClear}
                    onClose={() => setClearing(null)}
                >
                    <p className={shell.text}>
                        {SHORT[clearing.day]} will no longer count as a missed day for this subtask.
                        The subtask itself is unaffected.
                    </p>
                </ConfirmDialog>
            )}
        </>
    );
}

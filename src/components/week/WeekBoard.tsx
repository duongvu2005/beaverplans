import { useState } from 'react';
import type { DayOfWeek, Task, WeekPlan } from '@/core/types';
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
    setProjectDeadline,
    setProjectName,
    setTaskName,
    toggleSubtask,
    toggleTask,
} from '@/core/projects';
import { todayKey } from '@/core/dates';
import { isEnded } from '@/core/weeks';
import { newId } from '@/utils/newId';
import { ProjectView } from '@/components/ProjectView';
import { WeekView } from './WeekView';
import { TaskEditor } from '@/components/TaskEditor';
import { ProjectEditor } from '@/components/ProjectEditor';
import { MovePopover } from './MovePopover';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import shell from '@/components/shared/dialogShell.module.css';

type Clearing = {
    subtaskId: string;
    day: DayOfWeek;
    projectName: string;
};
type Removing =
    | { kind: 'project'; id: string; name: string; taskCount: number }
    | { kind: 'task'; id: string; name: string; projectName: string; subtaskCount: number };

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

type WeekBoardProps = {
    plan: WeekPlan;
    onChange: (updater: (current: WeekPlan) => WeekPlan) => void;
};

export function WeekBoard({ plan, onChange }: WeekBoardProps) {
    const readOnly = isEnded(plan);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
    const [movingSubtaskId, setMovingSubtaskId] = useState<string | null>(null);
    const [clearing, setClearing] = useState<Clearing | null>(null);
    const [removing, setRemoving] = useState<Removing | null>(null);

    const today = todayKey();

    const editingProject = editingTaskId
        ? plan.projects.find((p) => p.tasks.some((t) => t.id === editingTaskId))
        : undefined;
    const editingTask = editingProject?.tasks.find((t) => t.id === editingTaskId);

    const deadlineProject = editingDeadlineId
        ? plan.projects.find((p) => p.id === editingDeadlineId)
        : undefined;

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
        onChange((current) => replaceTask(current, nextTask.id, nextTask));
        setEditingTaskId(null);
    }

    function handleEditDeadline(projectId: string) {
        setEditingDeadlineId(projectId);
    }

    function handleCloseDeadlineEditor() {
        setEditingDeadlineId(null);
    }

    function handleSaveDeadline(deadline: string | undefined) {
        const projectId = editingDeadlineId;
        if (!projectId) return;
        onChange((current) => setProjectDeadline(current, projectId, deadline));
        setEditingDeadlineId(null);
    }

    function handleToggleTask(taskId: string) {
        onChange((current) => toggleTask(current, taskId));
    }

    function handleToggleSubtask(subtaskId: string) {
        onChange((current) => toggleSubtask(current, subtaskId));
    }

    function handleRequestMove(subtaskId: string) {
        setMovingSubtaskId(subtaskId);
    }

    function handleMove(toDay: DayOfWeek, markMissed: boolean) {
        const id = movingSubtaskId;
        if (!id) return;
        onChange((current) => {
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
            projectName: found?.projectName ?? '',
        });
    }

    function handleConfirmClear() {
        if (!clearing) return;
        onChange((current) => removeMissedDay(current, clearing.subtaskId, clearing.day));
        setClearing(null);
    }

    function handleAddProject() {
        onChange((current) => addProject(current, newId()));
    }

    function handleAddTask(projectId: string) {
        onChange((current) => addTask(current, projectId, newId()));
    }

    function handleRenameTask(taskId: string, name: string) {
        onChange((current) => setTaskName(current, taskId, name));
    }

    function handleRenameProject(projectId: string, name: string) {
        onChange((current) => setProjectName(current, projectId, name));
    }

    function handleRemoveProject(projectId: string) {
        const project = plan.projects.find((p) => p.id === projectId);
        if (!project) return;
        if (project.tasks.length === 0) {
            onChange((current) => removeProject(current, projectId));
            return;
        }
        setRemoving({
            kind: 'project',
            id: projectId,
            name: project.name,
            taskCount: project.tasks.length,
        });
    }

    function handleRemoveTask(taskId: string) {
        const project = plan.projects.find((p) => p.tasks.some((t) => t.id === taskId));
        const task = project?.tasks.find((t) => t.id === taskId);
        if (!project || !task) return;
        if (task.subtasks.length === 0) {
            onChange((current) => removeTask(current, taskId));
            return;
        }
        setRemoving({
            kind: 'task',
            id: taskId,
            name: task.name,
            projectName: project.name,
            subtaskCount: task.subtasks.length,
        });
    }

    function handleConfirmRemove() {
        if (!removing) return;
        if (removing.kind === 'project') {
            onChange((current) => removeProject(current, removing.id));
        } else {
            onChange((current) => removeTask(current, removing.id));
        }
        setRemoving(null);
    }

    function handleReorderProject(projectId: string, beforeProjectId: string | null) {
        onChange((current) => reorderProject(current, projectId, beforeProjectId));
    }

    function handleReorderTask(taskId: string, destProjectId: string, beforeTaskId: string | null) {
        onChange((current) => reorderTask(current, taskId, destProjectId, beforeTaskId));
    }

    return (
        <>
            {/* `inert` is the read-only gate for every button, checkbox, drag
                handle and click-to-edit in the board — but not for the day
                pickers (DayRail, DayColumn's day header): those only change
                which day you're LOOKING at, never the plan, so they stay live
                on a frozen board. ProjectView and each day's task list carry
                `inert` themselves rather than one blanket wrapper here, so
                that navigation can sit outside it.

                The edits were already no-ops for an ended plan (putWeek refuses
                an ended entry) — this only stops them being offered. */}
            <div className="plan-layout" data-ended={readOnly || undefined}>
                <ProjectView
                    projects={plan.projects}
                    readOnly={readOnly}
                    onReorderProject={handleReorderProject}
                    onReorderTask={handleReorderTask}
                    onEditTask={handleEditTask}
                    onEditDeadline={handleEditDeadline}
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
                    ended={readOnly}
                    readOnly={readOnly}
                    onToggleSubtask={handleToggleSubtask}
                    onEditSubtask={handleEditSubtask}
                    onRequestMove={handleRequestMove}
                    onClearMissed={handleRequestClear}
                />
            </div>
            {editingTask && editingProject && (
                <TaskEditor
                    task={editingTask}
                    projectName={editingProject.name}
                    onClose={handleCloseEditor}
                    onSave={handleSaveTask}
                />
            )}
            {deadlineProject && (
                <ProjectEditor
                    project={deadlineProject}
                    onClose={handleCloseDeadlineEditor}
                    onSave={handleSaveDeadline}
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
                    title="Clear this missed day?"
                    confirmLabel="Clear"
                    onConfirm={handleConfirmClear}
                    onClose={() => setClearing(null)}
                >
                    <p className={shell.text}>
                        {SHORT[clearing.day]} will no longer count as a missed day for this subtask.
                        Everything else remains unchanged.
                    </p>
                </ConfirmDialog>
            )}
            {removing && (
                <ConfirmDialog
                    eyebrow={
                        removing.kind === 'task' ? removing.projectName || 'Project' : 'Project'
                    }
                    title={`Delete ${removing.kind} "${removing.name || 'Untitled'}"?`}
                    confirmLabel="Delete"
                    confirmTone="danger"
                    onConfirm={handleConfirmRemove}
                    onClose={() => setRemoving(null)}
                >
                    <p className={shell.text}>
                        {removing.kind === 'project'
                            ? `This will permanently delete the project and its ${removing.taskCount} task${removing.taskCount === 1 ? '' : 's'}.`
                            : `This will permanently delete the task and its ${removing.subtaskCount} subtask${removing.subtaskCount === 1 ? '' : 's'}.`}
                    </p>
                </ConfirmDialog>
            )}
        </>
    );
}

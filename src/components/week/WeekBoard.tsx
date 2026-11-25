import { useState } from 'react';
import type { DayOfWeek, Project, Task, WeekPlan } from '@/core/types';
import {
    addMissedDay,
    addProject,
    addProjects,
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
import { todayKey, weekStartOf } from '@/core/dates';
import { weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { projectRoom, taskRoom } from '@/core/limits';
import { printProjects, withFreshIds, withoutProgress } from '@/storage/weekClipboard';
import { isEnded } from '@/core/weeks';
import { welcomeCue, welcomeStep } from '@/core/welcome';
import { TWO_PANE_MIN_WIDTH, useAppWidthUnder } from '@/hooks/useContainerWidth';
import type { GuideApi } from '@/components/project/guide';
import { newId } from '@/utils/newId';
import { ProjectView } from '@/components/project/ProjectView';
import { useTreeKeys } from '@/components/project/useTreeKeys';
import { WeekView } from './WeekView';
import { WeekWelcome, type WelcomeMode } from './WeekWelcome';
import { TaskEditor } from '@/components/project/TaskEditor';
import { ProjectEditor } from '@/components/project/ProjectEditor';
import { PastePlanDialog } from '@/components/project/PastePlanDialog';
import { MovePopover } from './MovePopover';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CopyPlanDialog } from '@/components/shared/CopyPlanDialog';
import { CopyTextDialog } from '@/components/shared/CopyTextDialog';
import shell from '@/components/shared/dialogShell.module.css';
import { dayName } from '@/i18n/dateCopy';

type Clearing = {
    subtaskId: string;
    day: DayOfWeek;
    projectName: string;
};
type Removing =
    | { kind: 'project'; id: string; name: string; taskCount: number }
    | { kind: 'task'; id: string; name: string; projectName: string; subtaskCount: number };

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
    /** Whether the onboarding guide is still wanted. Defaults to on: a caller
     * that has not thought about it should not silently lose the guide. */
    guideEnabled?: boolean;
    /** The guide's way out: never offer it again. Required — omitted, it leaves
     * a Skip button that renders, takes a click and does nothing. */
    onSkipGuide: () => void;
};

export function WeekBoard({ plan, onChange, guideEnabled = true, onSkipGuide }: WeekBoardProps) {
    const { locale } = useLocale();
    const { common, topBar, weekBoard } = useCopy();
    const readOnly = isEnded(plan);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
    const [movingSubtaskId, setMovingSubtaskId] = useState<string | null>(null);
    const [clearing, setClearing] = useState<Clearing | null>(null);
    const [removing, setRemoving] = useState<Removing | null>(null);
    const [pasting, setPasting] = useState(false);
    const [copying, setCopying] = useState(false);
    /** the text to select by hand, set only when the browser refused the write */
    const [manualCopy, setManualCopy] = useState<string | null>(null);
    /** Whether Get started has been pressed. Not stored: it outlives a week
     * change but not a reload. */
    const [latched, setLatched] = useState(false);
    /** The name field the caret is in, if any. Names store per keystroke, so
     * without this the guide counts a name as given on its first character. */
    const [editingNameId, setEditingNameId] = useState<string | null>(null);

    const today = todayKey();

    const editingProject = editingTaskId
        ? plan.projects.find((p) => p.tasks.some((t) => t.id === editingTaskId))
        : undefined;
    const editingTask = editingProject?.tasks.find((t) => t.id === editingTaskId);

    const deadlineProject = editingDeadlineId
        ? plan.projects.find((p) => p.id === editingDeadlineId)
        : undefined;

    const moving = movingSubtaskId ? findSubtask(plan, movingSubtaskId) : undefined;

    const currentWeek = plan.weekStart === weekStartOf(new Date());

    // An ended week's guide would offer three actions its frozen board cannot
    // perform, so it keeps the empty grid instead.
    const welcome = readOnly ? undefined : welcomeStep(plan.projects, editingNameId ?? undefined);

    const guiding = currentWeek && guideEnabled;

    // Under, not "not at least": the walkthrough hides the Projects section, so
    // it takes a real measurement. An unmeasurable container keeps the wide board.
    const singleColumn = useAppWidthUnder(TWO_PANE_MIN_WIDTH);
    const walkthrough = welcome !== undefined && guiding && singleColumn;
    // Derived, not an initial state, so it holds when the week under the board changes.
    const started = latched || plan.projects.length > 0;
    const mode: WelcomeMode = !walkthrough ? 'full' : started ? 'guided' : 'explainer';

    // Undefined unless actually guiding, so the tree keeps its shape in the
    // other three cases: wide, frozen, or still on the explainer.
    const guide: GuideApi | undefined =
        welcome !== undefined && walkthrough && started
            ? {
                  cue: welcomeCue(welcome),
                  onNameFocus: setEditingNameId,
                  // Guarded against a blur arriving after focus has moved on to the next field.
                  onNameBlur: (id) =>
                      setEditingNameId((current) => (current === id ? null : current)),
              }
            : undefined;

    // The guide's one button, wired to whichever action its step is about. A blank row of the right kind takes the press instead of a second row being added.
    function handleAdvance() {
        if (welcome === undefined) return;
        if (welcome.step === 'days') {
            setEditingTaskId(welcome.taskId);
        } else if (welcome.unnamed !== undefined) {
            treeKeys.focus(welcome.unnamed);
        } else if (welcome.step === 'project') {
            handleAddProject();
        } else {
            handleAddTask(welcome.projectId);
        }
    }

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

    // Both creations focus the row they make. The caps are checked here too, because keyboard shortcuts reach these handlers directly; refusing adds nothing and focuses nothing.
    function handleAddProject() {
        if (projectRoom(plan.projects) === 0) return;
        const id = newId();
        onChange((current) => addProject(current, id));
        treeKeys.focus(id);
    }

    function handleAddTask(projectId: string) {
        handleInsertTask(projectId, null);
    }

    // afterTaskId null appends; anything else is that append followed by a move into place, read from the siblings WITHOUT the new task.
    function handleInsertTask(projectId: string, afterTaskId: string | null) {
        const project = plan.projects.find((p) => p.id === projectId);
        if (project === undefined || taskRoom(project) === 0) return;
        const id = newId();
        onChange((current) => {
            const added = addTask(current, projectId, id);
            if (afterTaskId === null) return added;
            const siblings = (added.projects.find((p) => p.id === projectId)?.tasks ?? []).filter(
                (task) => task.id !== id,
            );
            const index = siblings.findIndex((task) => task.id === afterTaskId);
            return reorderTask(added, id, projectId, siblings[index + 1]?.id ?? null);
        });
        treeKeys.focus(id);
    }

    // Ids are reminted: a pasted copy of an archived week would otherwise put the same node in two weeks, which Weeks' rep invariant forbids.
    function handlePastePlan(projects: ReadonlyArray<Project>, keepProgress: boolean) {
        const prepared = withFreshIds(keepProgress ? projects : withoutProgress(projects), newId);
        onChange((current) => addProjects(current, prepared));
        setPasting(false);
    }

    // Copies the plan as it stands, ticks and all; paste decides whether to keep the progress.
    async function handleCopyPlan(projects: ReadonlyArray<Project>) {
        const text = printProjects(plan.weekStart, projects);
        setCopying(false);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            setManualCopy(text);
        }
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

    const treeKeys = useTreeKeys({
        projects: plan.projects,
        onInsertTask: handleInsertTask,
        onAddProject: handleAddProject,
        onRemoveProject: handleRemoveProject,
        onRemoveTask: handleRemoveTask,
    });

    return (
        <>
            {/* `inert` is the read-only gate for the board; the day pickers stay live on a frozen board because they only change which day you are looking at. */}
            {pasting && (
                <PastePlanDialog
                    room={projectRoom(plan.projects)}
                    onClose={() => setPasting(false)}
                    onPaste={handlePastePlan}
                />
            )}
            {copying && (
                <CopyPlanDialog
                    projects={plan.projects}
                    eyebrow={topBar.views.plan}
                    title={weekBoard.copyTitle(weekRangeLabel(plan.weekStart, locale))}
                    onClose={() => setCopying(false)}
                    onCopy={(projects) => void handleCopyPlan(projects)}
                />
            )}
            {manualCopy !== null && (
                <CopyTextDialog
                    eyebrow={topBar.views.plan}
                    text={manualCopy}
                    onClose={() => setManualCopy(null)}
                />
            )}
            <div className="plan-layout" data-ended={readOnly || undefined}>
                {mode !== 'explainer' && (
                    <ProjectView
                        projects={plan.projects}
                        weekStart={plan.weekStart}
                        today={today}
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
                        onCopyPlan={() => setCopying(true)}
                        onPastePlan={() => setPasting(true)}
                        treeKeys={treeKeys}
                        guide={guide}
                    />
                )}
                <WeekView
                    projects={plan.projects}
                    weekStart={plan.weekStart}
                    today={today}
                    ended={readOnly}
                    readOnly={readOnly}
                    empty={
                        welcome && (
                            <WeekWelcome
                                welcome={welcome}
                                guiding={guiding}
                                mode={mode}
                                onAdvance={handleAdvance}
                                onStart={() => setLatched(true)}
                                onSkip={onSkipGuide}
                            />
                        )
                    }
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
                    eyebrow={clearing.projectName || common.projectFallback}
                    title={weekBoard.clearMissedTitle}
                    confirmLabel={weekBoard.clearMissedConfirm}
                    onConfirm={handleConfirmClear}
                    onClose={() => setClearing(null)}
                >
                    <p className={shell.text}>
                        {weekBoard.clearMissedBody(dayName(clearing.day, locale, 'short'))}
                    </p>
                </ConfirmDialog>
            )}
            {removing && (
                <ConfirmDialog
                    eyebrow={
                        removing.kind === 'task'
                            ? removing.projectName || common.projectFallback
                            : common.projectFallback
                    }
                    title={
                        removing.kind === 'project'
                            ? weekBoard.deleteProjectTitle(removing.name || common.untitled)
                            : weekBoard.deleteTaskTitle(removing.name || common.untitled)
                    }
                    confirmLabel={common.delete}
                    confirmTone="danger"
                    onConfirm={handleConfirmRemove}
                    onClose={() => setRemoving(null)}
                >
                    <p className={shell.text}>
                        {removing.kind === 'project'
                            ? weekBoard.deleteProjectBody(removing.taskCount)
                            : weekBoard.deleteTaskBody(removing.subtaskCount)}
                    </p>
                </ConfirmDialog>
            )}
        </>
    );
}

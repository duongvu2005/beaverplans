/**
 * Pure operations on the project tree (Project -> Task -> Subtask) held by a
 * WeekPlan. Every producer takes a WeekPlan and returns a new one, copying only
 * the nodes on the path to the change; everything else is shared by reference.
 */

import { isValidWeekStart } from './dates';
import { parseDeadline } from './deadline';
import { moveBefore } from './list';
import { toNFC } from './text';
import type { WeekPlan, Project, Task, Subtask, DayOfWeek } from './types';
import { WEEK } from './types';

// Create (producers)

/**
 * Add a new project to plan.
 *
 * @param plan the current plan
 * @param projectId the id of the new project, must be a new unique id
 * @returns a new plan with an empty project (name = '', no tasks) appended to the
 *          end of its projects, and everything else about the plan unchanged
 */
export function addProject(plan: WeekPlan, projectId: string): WeekPlan {
    const newProject: Project = {
        id: projectId,
        name: '',
        tasks: [],
    };
    return {
        ...plan,
        projects: [...plan.projects, newProject],
    };
}

/**
 * Append whole projects to a plan.
 *
 * @param plan the current plan
 * @param projects the projects to append, each valid and carrying ids used
 *        nowhere in plan (nor in any other week — see Weeks' rep invariant)
 * @returns a new plan with the same weekStart and ended, and projects appended
 *          to the end of plan.projects in the order given. Appending none
 *          returns an equal plan.
 */
export function addProjects(plan: WeekPlan, projects: ReadonlyArray<Project>): WeekPlan {
    return { ...plan, projects: [...plan.projects, ...projects] };
}

/**
 * Add a new task to a project.
 *
 * @param plan the current plan
 * @param projectId the id of the project to add a task to
 * @param taskId the id of the new task, must be a new unique id
 * @returns a new plan with the same weekStart and projects, except for the project
 *          with id projectId, where an empty task (name = '', no subtasks, isDone = false)
 *          is appended to its tasks. If no project has id projectId, the returned plan has
 *          the same projects (no task is added)
 */
export function addTask(plan: WeekPlan, projectId: string, taskId: string): WeekPlan {
    const newTask: Task = {
        id: taskId,
        name: '',
        isDone: false,
        subtasks: [],
    };
    return {
        ...plan,
        projects: plan.projects.map((project) =>
            project.id === projectId ? { ...project, tasks: [...project.tasks, newTask] } : project,
        ),
    };
}

// Remove (producers)
/**
 * Remove a project from the plan.
 *
 * @param plan the current plan
 * @param projectId the id of the project to remove
 * @returns a new plan with the same weekStart, and the same projects in the same
 *          order but without the one whose id is projectId. If no project has that
 *          id, the projects are unchanged.
 */
export function removeProject(plan: WeekPlan, projectId: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.filter((p) => p.id !== projectId),
    };
}

/**
 * Remove a task from the plan.
 *
 * @param plan the current plan
 * @param taskId the id of the task to remove
 * @returns a new plan with the same weekStart. The project containing the task
 *          with id taskId has that task removed, its remaining tasks kept in the
 *          same order; all other projects are unchanged. If no task has that id,
 *          the projects are unchanged.
 */
export function removeTask(plan: WeekPlan, taskId: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map((project) => {
            const tasks = project.tasks.filter((task) => task.id !== taskId);
            return tasks.length === project.tasks.length ? project : { ...project, tasks };
        }),
    };
}

// Modify (producers)
/**
 * Replace a task with a new version of it.
 *
 * @param plan the current plan
 * @param taskId the id of the task to replace
 * @param nextTask the replacement task
 * @returns a new plan with the same weekStart. If nextTask.id equals taskId and a
 *          task with that id exists, that task is replaced by nextTask, keeping its
 *          position among its siblings; the containing project and everything else
 *          in the plan is unchanged. If nextTask.id does not equal taskId, or no
 *          task has id taskId, the projects are unchanged.
 */
export function replaceTask(plan: WeekPlan, taskId: string, nextTask: Task): WeekPlan {
    return updateTaskById(plan, taskId, (task) => (taskId === nextTask.id ? nextTask : task));
}

/**
 * Change the name of a project.
 *
 * @param plan the current plan
 * @param projectId the id of the project to change the name
 * @param projectName the new name of the project
 * @returns a new plan with the same weekStart. The project with id projectId
 *          has its new name set to projectName in NFC; everything else in the plan
 *          is unchanged. If no project has that id, the projects are unchanged.
 */
export function setProjectName(plan: WeekPlan, projectId: string, projectName: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map((project) =>
            project.id === projectId ? { ...project, name: toNFC(projectName) } : project,
        ),
    };
}

/**
 * Set a project's deadline.
 *
 * @param plan the current plan
 * @param projectId the id of the project to change the deadline
 * @param deadline the new deadline, or undefined to clear it
 * @returns a new plan with the same weekStart. The project with id projectId has its
 *          deadline set to deadline when parseDeadline accepts it, else has no deadline
 *          (an undefined or unparseable deadline clears any previous value); everything
 *          else in the plan is unchanged. If no project has that id, the projects are
 *          unchanged.
 */
export function setProjectDeadline(
    plan: WeekPlan,
    projectId: string,
    deadline: string | undefined,
): WeekPlan {
    const deadlineIsValid = deadline !== undefined && parseDeadline(deadline).ok;
    return {
        ...plan,
        projects: plan.projects.map((project) => {
            if (project.id !== projectId) return project;
            const { deadline: _current, ...rest } = project;
            return { ...rest, ...(deadlineIsValid ? { deadline } : {}) };
        }),
    };
}

/**
 * Change the name of a task.
 *
 * @param plan the current plan
 * @param taskId the id of the task to change the name
 * @param taskName the new name of the task
 * @returns a new plan with the same weekStart. The task with id taskId
 *          has its new name set to taskName in NFC; everything else in the plan
 *          is unchanged. If no task has that id, the projects are unchanged.
 */
export function setTaskName(plan: WeekPlan, taskId: string, taskName: string): WeekPlan {
    return updateTaskById(plan, taskId, (task) => ({ ...task, name: toNFC(taskName) }));
}

/**
 * Toggle a subtask's completion.
 *
 * @param plan the current plan
 * @param subtaskId the id of the subtask to toggle completion
 * @returns a new plan with the same weekStart. The subtask with id subtaskId has
 *          its isDone flipped; everything else in the plan is unchanged.
 *          If no subtask has that id, the projects are unchanged.
 */
export function toggleSubtask(plan: WeekPlan, subtaskId: string): WeekPlan {
    return updateSubtaskById(plan, subtaskId, (s) => ({ ...s, isDone: !s.isDone }));
}

/**
 * Toggle a task's completion.
 *
 * @param plan the current plan
 * @param taskId the id of the task to toggle
 * @returns a new plan with the same weekStart. For the task with id taskId: if it
 *          has no subtasks, its isDone is set to the opposite of its current value;
 *          if it has subtasks, every subtask's isDone is set to a single target —
 *          false if all subtasks are currently done, true otherwise (so a
 *          partially-done task becomes fully done). Everything else in the plan is
 *          unchanged. If no task has that id, the projects are unchanged.
 */
export function toggleTask(plan: WeekPlan, taskId: string): WeekPlan {
    return updateTaskById(plan, taskId, (task) => {
        const target = !isTaskDone(task);
        if (!task.subtasks.length) {
            return { ...task, isDone: target };
        }
        return {
            ...task,
            subtasks: task.subtasks.map((s) => ({ ...s, isDone: target })),
        };
    });
}

/**
 * Reassign a subtask to a different weekday.
 *
 * @param plan the current plan
 * @param subtaskId the id of the subtask to reassign
 * @param toDay the weekday to reassign the subtask to. Requires toDay to be
 *        strictly after every day in the subtask's missedDays, in weekday order
 *        (mon < tue < ... < sun); when missedDays is empty, any toDay is allowed.
 * @returns a new plan with the same weekStart in which the subtask with id
 *          subtaskId has assignedDay set to toDay and everything else (including
 *          missedDays) unchanged. If no subtask has that id, the projects are
 *          unchanged.
 */
export function moveSubtask(plan: WeekPlan, subtaskId: string, toDay: DayOfWeek): WeekPlan {
    return updateSubtaskById(plan, subtaskId, (s) => ({ ...s, assignedDay: toDay }));
}

/**
 * Record a weekday as missed for a subtask.
 *
 * @param plan the current plan
 * @param subtaskId the id of the subtask
 * @param day the weekday to record as missed. Requires day to be strictly before
 *        the subtask's assignedDay in weekday order (mon < tue < ... < sun).
 * @returns a new plan with the same weekStart in which the subtask with id
 *          subtaskId has day added to its missedDays. If day is already present,
 *          the subtask is unchanged (no duplicate is added). Everything else is
 *          unchanged. If no subtask has that id, the projects are unchanged.
 */
export function addMissedDay(plan: WeekPlan, subtaskId: string, day: DayOfWeek): WeekPlan {
    return updateSubtaskById(plan, subtaskId, (s) => ({
        ...s,
        missedDays: s.missedDays.includes(day) ? s.missedDays : [...s.missedDays, day],
    }));
}

/**
 * Clear a recorded missed day from a subtask.
 *
 * @param plan the current plan
 * @param subtaskId the id of the subtask
 * @param day the weekday to remove from the subtask's missedDays
 * @returns a new plan with the same weekStart in which the subtask with id
 *          subtaskId no longer has day in its missedDays. If day was not present,
 *          the subtask is unchanged. Everything else is unchanged. If no subtask
 *          has that id, the projects are unchanged.
 */
export function removeMissedDay(plan: WeekPlan, subtaskId: string, day: DayOfWeek): WeekPlan {
    return updateSubtaskById(plan, subtaskId, (s) => ({
        ...s,
        missedDays: s.missedDays.filter((missed) => missed !== day),
    }));
}

/**
 * Move a project to a different position among the plan's projects.
 *
 * @param plan  the current plan
 * @param projectId  the id of the project to move
 * @param beforeProjectId  the id of the project that the moved project should end
 *        up immediately in front of, or null to move it to the end
 * @returns  a new plan with the same weekStart, holding the same projects, each
 *           unchanged, with the project whose id is projectId positioned
 *           immediately before the project whose id is beforeProjectId (or last,
 *           when beforeProjectId is null) and every other project in its original
 *           relative order. If no project has id projectId, if beforeProjectId is
 *           neither null nor the id of a project in the plan, or if
 *           beforeProjectId equals projectId, the projects keep their original
 *           order.
 */
export function reorderProject(
    plan: WeekPlan,
    projectId: string,
    beforeProjectId: string | null,
): WeekPlan {
    return {
        ...plan,
        projects: moveBefore(plan.projects, projectId, beforeProjectId),
    };
}

/**
 * Move a task to a different position, within its own project or into another one.
 *
 * @param plan  the current plan
 * @param taskId  the id of the task to move
 * @param destProjectId  the id of the project the task should end up in; may be the
 *        project that already holds it
 * @param beforeTaskId  the id of a task in the project with id destProjectId that the
 *        moved task should end up immediately in front of, or null to move it to the
 *        end of that project's tasks
 * @returns  a new plan with the same weekStart in which the task with id taskId,
 *           itself unchanged and carrying all of its subtasks, appears exactly once:
 *           in the project with id destProjectId, immediately before the task with id
 *           beforeTaskId, or last among that project's tasks when beforeTaskId is
 *           null. Every other task keeps its original relative order within its
 *           project, and every project other than the source and the destination is
 *           unchanged. The projects are unchanged if no task has id taskId, if no
 *           project has id destProjectId, if beforeTaskId equals taskId, or if
 *           beforeTaskId is neither null nor the id of a task in the destination
 *           project.
 */
export function reorderTask(
    plan: WeekPlan,
    taskId: string,
    destProjectId: string,
    beforeTaskId: string | null,
): WeekPlan {
    const projects = reorderTaskIn(plan.projects, taskId, destProjectId, beforeTaskId);
    // Same array back means nothing moved; callers compare plans by reference.
    return projects === plan.projects ? plan : { ...plan, projects };
}

/**
 * reorderTask over a bare project list.
 *
 * @param projects  any valid project list (every entry satisfies isValidProject)
 * @param taskId  the id of the task to move
 * @param destProjectId  the id of the project the task should end up in; may be
 *        the project that already holds it
 * @param beforeTaskId  the id of a task in the project with id destProjectId that
 *        the moved task should end up immediately in front of, or null to move it
 *        to the end of that project's tasks
 * @returns  a new list in which the task with id taskId, itself unchanged and
 *           carrying all of its subtasks, appears exactly once: in the project
 *           with id destProjectId, immediately before the task with id
 *           beforeTaskId, or last among that project's tasks when beforeTaskId is
 *           null. Every other task keeps its original relative order within its
 *           project, and every project other than the source and the destination
 *           is the same instance. Returns the given list itself — same reference —
 *           if no task has id taskId, if no project has id destProjectId, if
 *           beforeTaskId equals taskId, or if beforeTaskId is neither null nor the
 *           id of a task in the destination project.
 */
export function reorderTaskIn(
    projects: ReadonlyArray<Project>,
    taskId: string,
    destProjectId: string,
    beforeTaskId: string | null,
): ReadonlyArray<Project> {
    const destProject = projects.find((project) => project.id === destProjectId);
    const movedTask = projects
        .flatMap((project) => project.tasks)
        .find((task) => task.id === taskId);
    if (destProject === undefined || movedTask === undefined || beforeTaskId === taskId) {
        return projects;
    }

    const destinationMissing =
        beforeTaskId !== null && !destProject.tasks.some((task) => task.id === beforeTaskId);
    if (destinationMissing) {
        return projects;
    }

    return projects.map((project) => {
        const isSource = project.tasks.some((task) => task.id === taskId);
        if (!isSource && project.id !== destProjectId) {
            return project;
        }
        const withoutMoved = project.tasks.filter((task) => task.id !== taskId);
        return {
            ...project,
            tasks:
                project.id === destProjectId
                    ? moveBefore([...withoutMoved, movedTask], taskId, beforeTaskId)
                    : withoutMoved,
        };
    });
}

// Accessors (observers)
/**
 * Determine whether a task is done.
 *
 * @param task any valid task (satisfies isValidTask)
 * @returns true iff either:
 *          - the task has subtasks and every one of them is done, or
 *          - the task has no subtasks and its isDone is true
 */
export function isTaskDone(task: Task): boolean {
    return task.subtasks.length === 0
        ? (task.isDone ?? false) // ?? false: unreachable for a valid leaf
        : task.subtasks.every((s) => s.isDone);
}

/**
 * Determine whether a project is done.
 *
 * @param project any valid project (satisfies isValidProject)
 * @returns true iff the project has at least one task and every one of them is
 *          done. False for a project with no tasks: there is no work to have
 *          completed.
 */
export function isProjectDone(project: Project): boolean {
    return project.tasks.length > 0 && project.tasks.every(isTaskDone);
}

/**
 * Determine whether a subtask may be reassigned to a given day.
 *
 * moveSubtask's precondition on toDay, made checkable.
 *
 * @param subtask any subtask
 * @param day the candidate day to move subtask to
 * @returns true iff day is strictly after every day in subtask.missedDays, in
 *          weekday order (mon < tue < ... < sun). True when missedDays is empty.
 */
export function canMoveSubtaskTo(subtask: Subtask, day: DayOfWeek): boolean {
    const target = WEEK.indexOf(day);
    return subtask.missedDays.every((missed) => WEEK.indexOf(missed) < target);
}

/**
 * Check whether a subtask is well-formed.
 *
 * @param subtask any subtask
 * @returns true iff the subtask satisfies all of:
 *          - assignedDay is one of the seven weekdays, and so is every entry of
 *            missedDays. The type says DayOfWeek, but this is the trust boundary
 *            for persisted JSON, where the value need not be one.
 *          - missedDays has no duplicate days
 *          - every day in missedDays is strictly before assignedDay in weekday
 *            order (mon < tue < ... < sun) — a subtask only slips forward, so its
 *            live day stays ahead of every day it has missed. (This implies
 *            assignedDay is not itself in missedDays.)
 *          - weight is 1, 2, or 3
 */
export function isValidSubtask(subtask: Subtask): boolean {
    const validWeights = [1, 2, 3];
    if (!validWeights.includes(subtask.weight)) {
        return false;
    }
    // Before the ordering check below, which reads indexes: indexOf returns -1
    // for a non-weekday, and -1 passes every comparison there vacuously.
    if (!WEEK.includes(subtask.assignedDay)) {
        return false;
    }
    if (subtask.missedDays.some((missed) => !WEEK.includes(missed))) {
        return false;
    }
    if (subtask.missedDays.length !== new Set(subtask.missedDays).size) {
        return false;
    }
    const indexOfAssigned = WEEK.indexOf(subtask.assignedDay);
    if (subtask.missedDays.some((missed) => WEEK.indexOf(missed) >= indexOfAssigned)) {
        return false;
    }
    return true;
}

/**
 * Check whether a task is well-formed.
 *
 * @param task any task
 * @returns true iff the task satisfies both:
 *          - every subtask is a valid subtask
 *          - isDone is a boolean when subtasks is empty, and undefined when
 *            subtasks is non-empty
 */
export function isValidTask(task: Task): boolean {
    const isLeaf = task.subtasks.length === 0;
    const storesDone = typeof task.isDone === 'boolean';
    if (isLeaf !== storesDone) {
        return false;
    }
    return task.subtasks.every((s) => isValidSubtask(s));
}

/**
 * Check whether a project is well-formed.
 *
 * @param project any project
 * @returns true iff every task in the project is a valid task
 */
export function isValidProject(project: Project): boolean {
    return project.tasks.every((task) => isValidTask(task));
}

/**
 * Every node id in a plan.
 *
 * @param plan any plan
 * @returns the id of every project, task, and subtask in the plan, in tree order,
 *          with duplicates kept — so a caller can test uniqueness by comparing the
 *          length against a Set of the same ids.
 */
export function idsOf(plan: WeekPlan): ReadonlyArray<string> {
    return plan.projects.flatMap((project) => [
        project.id,
        ...project.tasks.flatMap((task) => [task.id, ...task.subtasks.map((s) => s.id)]),
    ]);
}

/**
 * Check whether a plan is well-formed.
 *
 * @param plan any plan
 * @returns true iff the plan satisfies both:
 *          - weekStart is a valid week-start (isValidWeekStart)
 *          - every project is a valid project
 *          - all ids across the projects, tasks, and subtasks are unique
 */
export function isValidPlan(plan: WeekPlan): boolean {
    const validWeekStart = isValidWeekStart(plan.weekStart);
    const allIds = idsOf(plan);
    const idsUnique = allIds.length === new Set(allIds).size;
    return validWeekStart && idsUnique && plan.projects.every((project) => isValidProject(project));
}

// Helpers
// Applies f to the one task whose id is taskId, or returns plan unchanged when
// no task matches. f is called at most once.
function updateTaskById(plan: WeekPlan, taskId: string, f: (task: Task) => Task): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map((project) => {
            let projectChanged = false;
            const tasks = project.tasks.map((task) => {
                if (task.id !== taskId) {
                    return task;
                }
                projectChanged = true;
                return f(task);
            });
            return projectChanged ? { ...project, tasks } : project;
        }),
    };
}

// Applies f to the one subtask whose id is subtaskId, or returns plan unchanged
// when no subtask matches. f is called at most once.
function updateSubtaskById(
    plan: WeekPlan,
    subtaskId: string,
    f: (s: Subtask) => Subtask,
): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map((project) => {
            let projectChanged = false;
            const tasks = project.tasks.map((task) => {
                let taskChanged = false;
                const subtasks = task.subtasks.map((s) => {
                    if (s.id !== subtaskId) {
                        return s;
                    }
                    taskChanged = true;
                    return f(s);
                });
                if (!taskChanged) {
                    return task;
                }
                projectChanged = true;
                return { ...task, subtasks };
            });
            return projectChanged ? { ...project, tasks } : project;
        }),
    };
}

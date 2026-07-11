/**
 * Pure operations on the project tree (Project -> Task -> Subtask) held by a
 * WeekPlan. Every producer takes a WeekPlan and returns a new WeekPlan with the
 * edit applied, mutating nothing (structural sharing: only the nodes on the path
 * to the change are copied; everything else is shared by reference).
 *
 * Functions are grouped by the user action they back (create / remove / modify).
 */

import type { WeekPlan, Project, Task, Subtask, DayOfWeek } from "./types";

// Create (producers)

/**
 * Add a new project to plan.
 * 
 * @param plan the current plan
 * @param projectId the id of the new project, must be a new unique id
 * @returns a new plan with the same weekStart and projects, plus an empty
 *          project (name = '', no tasks) appended to the end
 */
export function addProject(plan: WeekPlan, projectId: string): WeekPlan {
    const newProject: Project = {
        id: projectId,
        name: '',
        tasks: []
    };
    return {
        weekStart: plan.weekStart,
        projects: [...plan.projects, newProject]
    };
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
        subtasks: []
    };
    return {
        ...plan,
        projects: plan.projects.map(project => 
            project.id === projectId
                ? { ...project, tasks: [...project.tasks, newTask] }
                : project
        )
    };
}

/**
 * Add a new subtask to a task.
 * 
 * @param plan the current plan
 * @param taskId the id of the task to add a subtask to
 * @param subtaskId the id of the new subtask, must be a new unique id
 * @param assignedDay the day in the week assigned to the subtask
 * @returns a new plan with the same weekStart and projects, except for the project
 *          that has a task with id taskId, where a new subtask assigned to assignedDay
 *          (no missed days, isDone = false, weight = 1) is appended to its subtasks, and
 *          that task no longer has an isDone field (doneness is now derived from its
 *          subtasks). If no task has id taskId, the returned plan has the same projects
 *          (no subtask is added).
 */
export function addSubtask(plan: WeekPlan, taskId: string, subtaskId: string, assignedDay: DayOfWeek): WeekPlan {
    const newSubtask: Subtask = {
        id: subtaskId,
        isDone: false,
        assignedDay: assignedDay,
        missedDays: [],
        weight: 1
    };
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                if (task.id !== taskId) {
                    return task;
                }
                projectChanged = true;
                const { isDone: _isDone, ...taskWithoutDone } = task;
                return { ...taskWithoutDone, subtasks: [...task.subtasks, newSubtask] };
            });
            return projectChanged ? {...project, tasks} : project;
        })
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
        projects: plan.projects.filter(p => p.id !== projectId)
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
        projects: plan.projects.map(project => {
            const tasks = project.tasks.filter(task => task.id !== taskId);
            return tasks.length === project.tasks.length ? project : { ...project, tasks};
        })
    };
}

/**
 * Remove a subtask from the plan.
 *
 * @param plan the current plan
 * @param subtaskId the id of the subtask to remove
 * @returns a new plan with the same weekStart. The task containing the subtask
 *          with id subtaskId has that subtask removed, its remaining subtasks
 *          kept in the same order; the containing project and all other projects
 *          and tasks are unchanged. If removing the subtask leaves the task with
 *          none, the task's isDone is restored to false (doneness is stored again
 *          for a leaf task). If no subtask has that id, the projects are unchanged.
 */
export function removeSubtask(plan: WeekPlan, subtaskId: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                if (!task.subtasks.some(s => s.id === subtaskId)) {
                    return task;
                }
                projectChanged = true;
                const subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                return subtasks.length === 0
                    ? { ...task, subtasks, isDone: false }
                    : { ...task, subtasks };
            });
            return projectChanged ? { ...project, tasks } : project;
        })
    };
}

// Modify (producers)
/**
 * Change the name of a project.
 * 
 * @param plan the current plan
 * @param projectId the id of the project to change the name
 * @param projectName the new name of the project
 * @returns a new plan with the same weekStart. The project with id projectId
 *          has its new name set to projectName; everything else in the plan is unchanged
 *          If no project has that id, the projects are unchanged.
 */
export function setProjectName(plan: WeekPlan, projectId: string, projectName: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map(project =>
            project.id === projectId ? { ...project, name: projectName } : project
        )
    };
}

/**
 * Change the name of a task.
 * 
 * @param plan the current plan
 * @param taskId the id of the task to change the name
 * @param taskName the new name of the task
 * @returns a new plan with the same weekStart. The task with id taskId
 *          has its new name set to taskName; everything else in the plan
 *          is unchanged. If no task has that id, the projects are unchanged.
 */
export function setTaskName(plan: WeekPlan, taskId: string, taskName: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                if (task.id !== taskId) {
                    return task;
                }
                projectChanged = true;
                return { ...task, name: taskName };
            });
            return projectChanged ? { ...project, tasks } : project;
        })
    };
}

/**
 * Change the description of a task.
 * 
 * @param plan the current plan
 * @param taskId the id of the task to change the description
 * @param taskDescription the new description of the task
 * @returns a new plan with the same weekStart. The task with id taskId has its
 *          description set to taskDescription (stored as given, including an empty
 *          string); everything else in the plan is unchanged. If no task has that
 *          id, the projects are unchanged.
 */
export function setTaskDescription(plan: WeekPlan, taskId: string, taskDescription: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                if (task.id !== taskId) {
                    return task;
                }
                projectChanged = true;
                return { ...task, description: taskDescription };
            })
            return projectChanged ? { ...project, tasks } : project;
        })
    };
}

/**
 * Change the description of a subtask.
 * 
 * @param plan the current plan
 * @param subtaskId the id of the subtask to change the description
 * @param subtaskDescription the new description of the subtask
 * @returns a new plan with the same weekStart. The subtask with id subtaskId has
 *          its description set to subtaskDescription (stored as given, including an
 *          empty string); everything else in the plan is unchanged. If no subtask
 *          has that id, the projects are unchanged.
 */
export function setSubtaskDescription(plan: WeekPlan, subtaskId: string, subtaskDescription: string): WeekPlan {
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                let taskChanged = false;
                const subtasks = task.subtasks.map(s => {
                    if (s.id !== subtaskId) {
                        return s;
                    }
                    taskChanged = true;
                    return { ...s, description: subtaskDescription };
                });
                if (!taskChanged) {
                    return task;
                }
                projectChanged = true;
                return { ...task, subtasks };
            });
            return projectChanged ? { ...project, tasks } : project;
        })
    };
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
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                let taskChanged = false;
                const subtasks = task.subtasks.map(s => {
                    if (s.id !== subtaskId) {
                        return s;
                    }
                    taskChanged = true;
                    return { ...s, isDone: !s.isDone };
                });
                if (!taskChanged) {
                    return task;
                }
                projectChanged = true;
                return { ...task, subtasks };
            });
            return projectChanged ? { ...project, tasks } : project;
        })
    };
}

/**
 * Toggle a task's completion.
 *
 * A task's completion is derived from its subtasks when it has any (done iff all
 * subtasks are done), and stored in its own isDone field when it has none. So this
 * function acts differently on the two: a leaf task's isDone is flipped directly,
 * while a task with subtasks has all of its subtasks set to a single target.
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
    return {
        ...plan,
        projects: plan.projects.map(project => {
            let projectChanged = false;
            const tasks = project.tasks.map(task => {
                if (task.id !== taskId) {
                    return task;
                }
                projectChanged = true;
                // toggle task's completion
                if (!task.subtasks.length) {
                    return { ...task, isDone: !(task.isDone ?? false) }
                }
                const allDone = task.subtasks.every(s => s.isDone);
                return {
                    ...task,
                    subtasks: task.subtasks.map(s => ({ ...s, isDone: !allDone }))
                };
            });
            return projectChanged ? { ...project, tasks } : project;
        })
    }
}

// Validators (observers)
/**
 * Check whether a subtask is well-formed.
 * 
 * @param subtask any subtask
 * @returns true iff the subtask satisfies both:
 *          - missedDays has no duplicate days and does not contain assignedDay
 *          - weight is 1, 2, or 3
 */
export function isValidSubtask(subtask: Subtask): boolean {
    const validWeights = [1, 2, 3];
    if (!validWeights.includes(subtask.weight)) {
        return false;
    }
    if (subtask.missedDays.length !== new Set(subtask.missedDays).size) {
        return false;
    }
    if (subtask.missedDays.includes(subtask.assignedDay)) {
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
    return task.subtasks.every(s => isValidSubtask(s));
}

/**
 * Check whether a project is well-formed.
 * 
 * @param project any project
 * @returns true iff every task in the project is a valid task
 */
export function isValidProject(project: Project): boolean {
    return project.tasks.every(task => isValidTask(task));
}

/**
 * Check whether a plan is well-formed.
 * 
 * @param plan any plan
 * @returns true iff the plan satisfies both:
 *          - every project is a valid project
 *          - all ids across the projects, tasks, and subtasks are unique
 */
export function isValidPlan(plan: WeekPlan): boolean {
    const allIds = plan.projects.flatMap((project) => [
        project.id,
        ...project.tasks.flatMap((task) => [task.id, ...task.subtasks.map((s) => s.id)]),
    ]);
    const idsUnique = allIds.length === new Set(allIds).size;
    return idsUnique && plan.projects.every((project) => isValidProject(project));
}

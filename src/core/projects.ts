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
        projects: plan.projects.map(project => {
            if (project.id === projectId) {
                return { ...project, tasks: [...project.tasks, newTask] };
            }
            return project;
        })
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
            if (!project.tasks.some(task => task.id === taskId)) {
                return project;
            }
            return {
                ...project,
                tasks: project.tasks.map(task => {
                    if (task.id === taskId) {
                        const { isDone: _isDone, ...taskWithoutDone } = task;
                        return {
                            ...taskWithoutDone,
                            subtasks: [...task.subtasks, newSubtask]
                        };
                    }
                    return task;
                })
            };
        })
    };
}

// Remove (producers)
export function removeProject(_plan: WeekPlan, _projectId: string): WeekPlan {
    throw new Error('unimplemented');
}

export function removeTask(_plan: WeekPlan, _taskId: string): WeekPlan {
    throw new Error('unimplemented');
}

export function removeSubtask(_plan: WeekPlan, _subtaskId: string): WeekPlan {
    throw new Error('unimplemented');
}

// Modify (producers)
export function setProjectName(_plan: WeekPlan, _projectId: string, _projectName: string): WeekPlan {
    throw new Error('unimplemented');
}

export function setTaskName(_plan: WeekPlan, _taskId: string, _taskName: string): WeekPlan {
    throw new Error('unimplemented');
}

export function setTaskDescription(_plan: WeekPlan, _taskId: string, _taskDescription: string): WeekPlan {
    throw new Error('unimplemented');
}

export function setSubtaskDescription(_plan: WeekPlan, _subtaskId: string, _subtaskDescription: string): WeekPlan {
    throw new Error('unimplemented');
}

export function toggleTask(_plan: WeekPlan, _taskId: string): WeekPlan {
    throw new Error('unimplemented');
}

export function toggleSubtask(_plan: WeekPlan, _subtaskId: string): WeekPlan {
    throw new Error('unimplemented');
}

// Validators (observers)
export function isValidProject(_project: Project): boolean {
    throw new Error('unimplemented');
}

export function isValidTask(_task: Task): boolean {
    throw new Error('unimplemented');
}

export function isValidSubtask(_subtask: Subtask): boolean {
    throw new Error('unimplemented');
}

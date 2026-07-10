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
export function addProject(_plan: WeekPlan, _projectId: string): WeekPlan {
    throw new Error('unimplemented');
}

export function addTask(_plan: WeekPlan, _projectId: string, _taskId: string): WeekPlan {
    throw new Error('unimplemented');
}

export function addSubtask(_plan: WeekPlan, _taskId: string, _subtaskId: string, _assignedDay: DayOfWeek): WeekPlan {
    throw new Error('unimplemented');
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

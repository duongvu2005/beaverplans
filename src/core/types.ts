export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DateKey = string;  // YYYY-MM-DD

export type Project = {
    readonly id: string;
    readonly name: string;
    readonly tasks: ReadonlyArray<Task>;
    readonly deadline?: string;
};

export type Task = {
    readonly id: string;
    readonly name: string;
    readonly isDone?: boolean;  // only need this if task has no subtask
    readonly subtasks: ReadonlyArray<Subtask>;
    readonly deadline?: string;
    readonly description?: string;
};

export type Subtask = {
    readonly id: string;
    readonly isDone: boolean;
    readonly assignedDay: DayOfWeek;
    readonly missedDays: ReadonlyArray<DayOfWeek>;
    readonly weight: number;
    readonly description?: string;
};

export type WeekPlan = {
    readonly weekStart: DateKey;
    readonly projects: ReadonlyArray<Project>;
}

export type Archive = ReadonlyArray<WeekPlan>;
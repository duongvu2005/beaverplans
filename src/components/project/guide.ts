import type { WelcomeCue } from '@/core/welcome';

/** What the project tree needs to take part in the onboarding guide. Absent whenever the guide is not running. */
export type GuideApi = {
    /** the one control to mark; every other accent affordance goes quiet */
    readonly cue: WelcomeCue;
    /** A name field took focus; its name stops counting toward advancing the guide until it blurs. */
    readonly onNameFocus: (id: string) => void;
    readonly onNameBlur: (id: string) => void;
};

/** Whether the guide is pointing at this project's name field. */
export function cuesProjectName(guide: GuideApi | undefined, projectId: string): boolean {
    return guide?.cue.kind === 'projectName' && guide.cue.projectId === projectId;
}

/** Whether the guide is pointing at this task's name field. */
export function cuesTaskName(guide: GuideApi | undefined, taskId: string): boolean {
    return guide?.cue.kind === 'taskName' && guide.cue.taskId === taskId;
}

/** Whether the guide is pointing at this project's "+ add task". */
export function cuesAddTask(guide: GuideApi | undefined, projectId: string): boolean {
    return guide?.cue.kind === 'addTask' && guide.cue.projectId === projectId;
}

/** Whether the guide is pointing at this task's editor button. */
export function cuesEditTask(guide: GuideApi | undefined, taskId: string): boolean {
    return guide?.cue.kind === 'editTask' && guide.cue.taskId === taskId;
}

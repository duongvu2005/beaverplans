import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, Ref } from 'react';
import type { DateKey, Project } from '@/core/types';
import { projectProgress } from '@/core/progress';
import { isProjectDone } from '@/core/projects';
import { LIMITS, taskRoom } from '@/core/limits';
import { TaskRow, TaskRowPreview } from './TaskRow';
import type { TreeKeysApi } from './useTreeKeys';
import { type GuideApi, cuesAddTask, cuesProjectName } from './guide';
import { Grip } from '@/components/shared/icons/Grip';
import { DeadlineIcon } from '@/components/shared/icons/DeadlineIcon';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { deadlineLabel } from '@/i18n/dateCopy';
import { deadlineTone } from '@/core/deadline';
import styles from './ProjectCard.module.css';
import cue from '@/components/shared/cue.module.css';
import { ProgressBar } from '@/components/shared/ProgressBar';

type Sortable = ReturnType<typeof useSortable>;

/** `TaskRowLive`'s counterpart one level up — see the note there for why. */
type ProjectCardLive = {
    readonly rootRef: Ref<HTMLElement>;
    readonly style: CSSProperties;
    readonly dragging: boolean;
    readonly gripRef: Ref<HTMLSpanElement>;
    readonly gripAttributes: Sortable['attributes'];
    readonly gripListeners: Sortable['listeners'];
    /** the task list as its own drop target, so a task can land in an empty project */
    readonly listRef: Ref<HTMLUListElement>;
    readonly onEditTask: (taskId: string) => void;
    readonly onEditDeadline: (projectId: string) => void;
    readonly onToggleTask: (taskId: string) => void;
    readonly onAddTask: (projectId: string) => void;
    readonly onRenameProject: (projectId: string, name: string) => void;
    readonly onRenameTask: (taskId: string, name: string) => void;
    readonly onRemoveProject: (projectId: string) => void;
    readonly onRemoveTask: (taskId: string) => void;
    readonly treeKeys: TreeKeysApi;
    /** absent unless the onboarding guide is running — see GuideApi */
    readonly guide?: GuideApi;
};

type CardProps = {
    project: Project;
    weekStart: DateKey;
    today: DateKey;
    /** whether the week on screen has ended, and so is a frozen record */
    frozen: boolean;
    /** absent in the drag clone, which renders this same markup inert */
    live?: ProjectCardLive;
};

/** The markup both the live card and its drag clone are made of. */
function Card({ project, weekStart, today, frozen, live }: CardProps) {
    const { projectCard } = useCopy();
    const { locale } = useLocale();

    const taskIds = project.tasks.map((task) => task.id);
    const done = isProjectDone(project);
    const full = taskRoom(project) === 0;
    // undefined for both "none set" and "set but no longer parseable"
    const deadline = project.deadline ? deadlineLabel(project.deadline, locale) : undefined;
    const tone = project.deadline
        ? deadlineTone({ deadline: project.deadline, weekStart, today, isDone: done, frozen })
        : 'quiet';
    const gripProps = live === undefined ? {} : { ...live.gripAttributes, ...live.gripListeners };

    const guide = live?.guide;
    const nameCued = cuesProjectName(guide, project.id);
    const addTaskCued = cuesAddTask(guide, project.id);

    const list = (
        <ul ref={live?.listRef} className={styles.list}>
            {project.tasks.map((task) =>
                live === undefined ? (
                    <TaskRowPreview
                        key={task.id}
                        task={task}
                        weekStart={weekStart}
                        today={today}
                        frozen={frozen}
                        // carried by the card the pointer grabbed, not grabbed itself
                        grabbed={false}
                    />
                ) : (
                    <TaskRow
                        key={task.id}
                        task={task}
                        projectId={project.id}
                        weekStart={weekStart}
                        today={today}
                        frozen={frozen}
                        onEditTask={live.onEditTask}
                        onToggleTask={live.onToggleTask}
                        onRenameTask={live.onRenameTask}
                        onRemoveTask={live.onRemoveTask}
                        treeKeys={live.treeKeys}
                        guide={live.guide}
                    />
                ),
            )}
        </ul>
    );

    return (
        <section
            ref={live?.rootRef}
            style={live?.style}
            className={[
                styles.card,
                live?.dragging && styles.dragging,
                // the one place clone and card are allowed to differ — see .grabbed
                live === undefined && styles.grabbed,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className={styles.header}>
                <div className={styles.top}>
                    <span
                        ref={live?.gripRef}
                        className={styles.gripHandle}
                        title={projectCard.dragProject}
                        aria-label={projectCard.dragProject}
                        {...gripProps}
                    >
                        <Grip className={styles.grip} />
                    </span>
                    <div className={styles.main}>
                        <input
                            ref={(el) => {
                                live?.treeKeys.register(project.id, el);
                            }}
                            className={[
                                styles.name,
                                done && styles.done,
                                cue.fieldSlot,
                                nameCued && cue.field,
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            value={project.name}
                            maxLength={LIMITS.nameLength}
                            placeholder={projectCard.namePlaceholder}
                            readOnly={live === undefined}
                            onChange={(e) => live?.onRenameProject(project.id, e.target.value)}
                            onFocus={() => guide?.onNameFocus(project.id)}
                            onBlur={() => guide?.onNameBlur(project.id)}
                            onKeyDown={(e) => {
                                if (live !== undefined) {
                                    live.treeKeys.onKeyDown({ kind: 'project', id: project.id }, e);
                                }
                            }}
                        />
                    </div>
                    <ProgressBar {...projectProgress(project)} className={styles.bar} />
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label={projectCard.setDeadline}
                            title={projectCard.setDeadline}
                            onClick={() => live?.onEditDeadline(project.id)}
                        >
                            <DeadlineIcon />
                        </button>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label={projectCard.deleteProject}
                            onClick={() => live?.onRemoveProject(project.id)}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                </div>
                {deadline && (
                    <span className={`${styles.deadline} ${styles[tone]}`}>{deadline}</span>
                )}
            </div>
            {live === undefined ? (
                list
            ) : (
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    {list}
                </SortableContext>
            )}
            {/* At the cap the button becomes the message. */}
            <button
                type="button"
                className={addTaskCued ? `${styles.addTask} ${cue.target}` : styles.addTask}
                disabled={full}
                onClick={() => live?.onAddTask(project.id)}
            >
                <span className={styles.spacer} />
                {full ? (
                    projectCard.taskLimit(LIMITS.tasksPerProject)
                ) : (
                    <>
                        <span className={styles.plus}>+</span>
                        {projectCard.addTask}
                    </>
                )}
            </button>
        </section>
    );
}

type ProjectCardProps = {
    project: Project;
    weekStart: DateKey;
    today: DateKey;
    /** whether the week on screen has ended, and so is a frozen record */
    frozen: boolean;
    onEditTask: (taskId: string) => void;
    onEditDeadline: (projectId: string) => void;
    onToggleTask: (taskId: string) => void;
    onAddTask: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
    treeKeys: TreeKeysApi;
    /** absent unless the onboarding guide is running — see GuideApi */
    guide?: GuideApi;
};

export function ProjectCard({
    project,
    weekStart,
    today,
    frozen,
    onEditTask,
    onEditDeadline,
    onToggleTask,
    onAddTask,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
    treeKeys,
    guide,
}: ProjectCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: project.id, data: { type: 'project' } });
    // The task list is a drop target in its own right, so a task can be dropped
    // into a project that has no tasks yet, or onto the empty space at the end.
    const { setNodeRef: setListRef } = useDroppable({
        id: `list:${project.id}`,
        data: { type: 'list', projectId: project.id },
    });

    return (
        <Card
            project={project}
            weekStart={weekStart}
            today={today}
            frozen={frozen}
            live={{
                rootRef: setNodeRef,
                style: { transform: CSS.Transform.toString(transform), transition },
                dragging: isDragging,
                gripRef: setActivatorNodeRef,
                gripAttributes: attributes,
                gripListeners: listeners,
                listRef: setListRef,
                onEditTask,
                onEditDeadline,
                onToggleTask,
                onAddTask,
                onRenameProject,
                onRenameTask,
                onRemoveProject,
                onRemoveTask,
                treeKeys,
                guide,
            }}
        />
    );
}

type ProjectCardPreviewProps = {
    project: Project;
    weekStart: DateKey;
    today: DateKey;
    frozen: boolean;
};

/** The floating clone of a project being dragged, for `DragOverlay`. */
export function ProjectCardPreview({ project, weekStart, today, frozen }: ProjectCardPreviewProps) {
    return <Card project={project} weekStart={weekStart} today={today} frozen={frozen} />;
}

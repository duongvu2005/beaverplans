import { useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MouseSensor,
    closestCorners,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { DateKey, Project } from '@/core/types';
import { LIMITS, projectRoom } from '@/core/limits';
import { ProjectCard, ProjectCardPreview } from './ProjectCard';
import { TaskRowPreview } from './TaskRow';
import { beforeIdForDrop, taskDragOver, taskDropCommit } from './dndReorder';
import { TOUCH_HOLD, QuietWhileTypingTouchSensor } from './dragSensors';
import type { TreeKeysApi } from './useTreeKeys';
import type { GuideApi } from './guide';
import { useCopy } from '@/i18n/localeContext';
import styles from './ProjectList.module.css';
import cue from '@/components/shared/cue.module.css';

// The data attached to each draggable/droppable so a drop can tell what it hit.
type TreeDragData =
    { type: 'project' } | { type: 'task'; projectId: string } | { type: 'list'; projectId: string };

type ActiveDrag = { kind: 'project' | 'task'; id: string };

function dragType(node: { data: { current?: unknown } }): TreeDragData['type'] | undefined {
    return (node.data.current as TreeDragData | undefined)?.type;
}

// Resolve collisions against only the droppables that fit what is dragged: without this, closestCorners hands a project drag the nested task inside a card.
const collisionForTree: CollisionDetection = (args) => {
    const activeType = dragType(args.active);
    const allowed: ReadonlyArray<TreeDragData['type']> =
        activeType === 'project' ? ['project'] : ['task', 'list'];
    return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => {
            const type = (container.data.current as TreeDragData | undefined)?.type;
            return type !== undefined && allowed.includes(type);
        }),
    });
};

type ProjectListProps = {
    projects: ReadonlyArray<Project>;
    weekStart: DateKey;
    today: DateKey;
    /** whether the week on screen has ended, and so is a frozen record */
    frozen: boolean;
    onReorderProject: (projectId: string, beforeProjectId: string | null) => void;
    onReorderTask: (taskId: string, destProjectId: string, beforeTaskId: string | null) => void;
    onEditTask: (taskId: string) => void;
    onEditDeadline: (projectId: string) => void;
    onToggleTask: (taskId: string) => void;
    onAddTask: (projectId: string) => void;
    onAddProject: () => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
    treeKeys: TreeKeysApi;
    /** absent unless the onboarding guide is running — see GuideApi */
    guide?: GuideApi;
};

export function ProjectList({
    projects,
    weekStart,
    today,
    frozen,
    onReorderProject,
    onReorderTask,
    onEditTask,
    onEditDeadline,
    onToggleTask,
    onAddTask,
    onAddProject,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
    treeKeys,
    guide,
}: ProjectListProps) {
    const { projectList } = useCopy();
    const [active, setActive] = useState<ActiveDrag | null>(null);
    // A live copy of the ordering, to preview a task moving into a DIFFERENT project. Same-project reordering is left to dnd-kit: touching state there loops.
    const [preview, setPreviewState] = useState<ReadonlyArray<Project> | null>(null);
    const previewRef = useRef<ReadonlyArray<Project> | null>(null);

    const sensors = useSensors(
        // Mouse: a small distance, so clicking a grip or typing is never a drag.
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        // Touch asks for a hold instead, and declines one while a field has
        // focus — see dragSensors.
        useSensor(QuietWhileTypingTouchSensor, { activationConstraint: TOUCH_HOLD }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function setPreview(next: ReadonlyArray<Project> | null) {
        previewRef.current = next;
        setPreviewState(next);
    }

    function reset() {
        setActive(null);
        setPreview(null);
    }

    function handleDragStart(event: DragStartEvent) {
        setActive({
            kind: dragType(event.active) === 'task' ? 'task' : 'project',
            id: String(event.active.id),
        });
    }

    // Only relocates a task when it crosses into another project, so the
    // destination list opens a gap. Guarded to fire once per crossing.
    function handleDragOver(event: DragOverEvent) {
        const { active: dragged, over } = event;
        if (over === null || dragType(dragged) !== 'task') {
            return;
        }
        const overData = over.data.current as TreeDragData | undefined;
        if (overData === undefined || overData.type === 'project') {
            return;
        }
        const base = previewRef.current ?? projects;
        const overId = overData.type === 'task' ? String(over.id) : null;
        // null when the task has not crossed out of its own project
        const next = taskDragOver(base, String(dragged.id), overData.projectId, overId);
        if (next !== null) {
            setPreview(next);
        }
    }

    // Commit the arrangement already on screen: the landing spot is read from the preview, not recomputed.
    function handleDragEnd(event: DragEndEvent) {
        const dragged = active;
        const over = event.over;
        const tree = previewRef.current ?? projects;
        reset();
        if (dragged === null || over === null) {
            return;
        }
        const overData = over.data.current as TreeDragData | undefined;

        if (dragged.kind === 'project') {
            const overProjectId =
                overData?.type === 'project' ? String(over.id) : overData?.projectId;
            if (overProjectId === undefined) {
                return;
            }
            onReorderProject(
                dragged.id,
                beforeIdForDrop(
                    tree.map((p) => p.id),
                    dragged.id,
                    overProjectId,
                ),
            );
            return;
        }

        const overId = overData?.type === 'task' ? String(over.id) : null;
        const landing = taskDropCommit(tree, dragged.id, overId);
        if (landing === null) {
            return;
        }
        onReorderTask(dragged.id, landing.destProjectId, landing.beforeId);
    }

    const shown = preview ?? projects;
    const overlayTask =
        active?.kind === 'task'
            ? projects.flatMap((project) => project.tasks).find((task) => task.id === active.id)
            : undefined;
    const overlayProject =
        active?.kind === 'project'
            ? projects.find((project) => project.id === active.id)
            : undefined;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionForTree}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={reset}
        >
            <SortableContext
                items={shown.map((project) => project.id)}
                strategy={verticalListSortingStrategy}
            >
                <div>
                    {shown.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            weekStart={weekStart}
                            today={today}
                            frozen={frozen}
                            onEditTask={onEditTask}
                            onEditDeadline={onEditDeadline}
                            onToggleTask={onToggleTask}
                            onAddTask={onAddTask}
                            onRenameProject={onRenameProject}
                            onRenameTask={onRenameTask}
                            onRemoveProject={onRemoveProject}
                            onRemoveTask={onRemoveTask}
                            treeKeys={treeKeys}
                            guide={guide}
                        />
                    ))}
                    {/* At the cap the control states the limit. */}
                    <button
                        type="button"
                        className={
                            guide?.cue.kind === 'addProject'
                                ? `${styles.addProject} ${cue.target}`
                                : styles.addProject
                        }
                        disabled={projectRoom(projects) === 0}
                        onClick={onAddProject}
                    >
                        {projectRoom(projects) === 0
                            ? projectList.projectLimit(LIMITS.projectsPerWeek)
                            : projectList.addProject}
                    </button>
                </div>
            </SortableContext>
            {/* The floating clone of whatever is being dragged. */}
            <DragOverlay className={styles.overlay} dropAnimation={null}>
                {overlayTask !== undefined && (
                    <ul className={styles.overlayList}>
                        <TaskRowPreview
                            task={overlayTask}
                            weekStart={weekStart}
                            today={today}
                            frozen={frozen}
                            grabbed
                        />
                    </ul>
                )}
                {overlayProject !== undefined && (
                    <ProjectCardPreview
                        project={overlayProject}
                        weekStart={weekStart}
                        today={today}
                        frozen={frozen}
                    />
                )}
            </DragOverlay>
        </DndContext>
    );
}

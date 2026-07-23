import { useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
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
import type { Project } from '../core/types';
import { isTaskDone, reorderTask } from '../core/projects';
import { ProjectCard } from './ProjectCard';
import { Grip } from './Grip';
import { beforeIdForDrop } from './dndReorder';
import styles from './ProjectList.module.css';
import cardStyles from './ProjectCard.module.css';
import taskStyles from './TaskRow.module.css';
import check from './checkbox.module.css';

// The data attached to each draggable/droppable so a drop can tell what it hit.
type TreeDragData =
    { type: 'project' } | { type: 'task'; projectId: string } | { type: 'list'; projectId: string };

type ActiveDrag = { kind: 'project' | 'task'; id: string };

function dragType(node: { data: { current?: unknown } }): TreeDragData['type'] | undefined {
    return (node.data.current as TreeDragData | undefined)?.type;
}

// Resolve collisions against only the droppables that make sense for what is
// being dragged: a project must land among projects, a task among task rows and
// the list drop zones. Without this, closestCorners hands a project drag the
// nested task inside a card, so the project list never opens a gap. The dragged
// item stays in its own hit test on purpose — that is what lets it be dropped
// back onto its starting slot (e.g. a project returning to the top of the list).
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
    onReorderProject: (projectId: string, beforeProjectId: string | null) => void;
    onReorderTask: (taskId: string, destProjectId: string, beforeTaskId: string | null) => void;
    onEditTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    onAddTask: (projectId: string) => void;
    onAddProject: () => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function ProjectList({
    projects,
    onReorderProject,
    onReorderTask,
    onEditTask,
    onToggleTask,
    onAddTask,
    onAddProject,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
}: ProjectListProps) {
    const [active, setActive] = useState<ActiveDrag | null>(null);
    // A live copy of the ordering, used to preview a task moving into a DIFFERENT
    // project so its list opens a gap. Same-project reordering is left to dnd-kit,
    // which opens the gap itself; touching state there would fight its animation
    // and loop. The preview is the source of truth for the drop (see handleDragEnd).
    const [preview, setPreviewState] = useState<ReadonlyArray<Project> | null>(null);
    const previewRef = useRef<ReadonlyArray<Project> | null>(null);

    const sensors = useSensors(
        // A small drag threshold so clicking a grip, or typing in a name field,
        // is never mistaken for the start of a drag.
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
        const activeId = String(dragged.id);
        const base = previewRef.current ?? projects;
        const destProjectId = overData.projectId;
        const fromProjectId = base.find((project) =>
            project.tasks.some((task) => task.id === activeId),
        )?.id;
        if (destProjectId === fromProjectId) {
            return; // same project: dnd-kit handles the gap
        }
        const destIds = base.find((p) => p.id === destProjectId)?.tasks.map((t) => t.id) ?? [];
        const overId = overData.type === 'task' ? String(over.id) : null;
        const before = beforeIdForDrop(destIds, activeId, overId);
        setPreview(
            reorderTask({ weekStart: '', projects: base }, activeId, destProjectId, before)
                .projects,
        );
    }

    // Commit the arrangement the user is already looking at. The preview (or the
    // real plan, for a same-project drag) has already placed the task in its
    // destination project, so the landing spot is read from THERE, not recomputed
    // against the real tree. destIds therefore includes the dragged id, making
    // beforeIdForDrop a same-container arrayMove whose result matches the gap
    // dnd-kit animated — this is what fixes the cross-project "jump to first" bug.
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

        const home = tree.find((project) => project.tasks.some((task) => task.id === dragged.id));
        if (home === undefined) {
            return;
        }
        const overId = overData?.type === 'task' ? String(over.id) : null;
        const destIds = home.tasks.map((task) => task.id);
        onReorderTask(dragged.id, home.id, beforeIdForDrop(destIds, dragged.id, overId));
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
                            onEditTask={onEditTask}
                            onToggleTask={onToggleTask}
                            onAddTask={onAddTask}
                            onRenameProject={onRenameProject}
                            onRenameTask={onRenameTask}
                            onRemoveProject={onRemoveProject}
                            onRemoveTask={onRemoveTask}
                        />
                    ))}
                    <button type="button" className={styles.addProject} onClick={onAddProject}>
                        + add project
                    </button>
                </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
                {overlayTask !== undefined && (
                    <ul className={styles.overlayList}>
                        <li className={taskStyles.row}>
                            <span className={taskStyles.gripHandle}>
                                <Grip className={taskStyles.grip} />
                            </span>
                            <input
                                type="checkbox"
                                className={check.box}
                                checked={isTaskDone(overlayTask)}
                                readOnly
                            />
                            <input
                                className={taskStyles.name}
                                value={overlayTask.name}
                                placeholder="Task…"
                                readOnly
                            />
                        </li>
                    </ul>
                )}
                {overlayProject !== undefined && (
                    <section className={cardStyles.card}>
                        <div className={cardStyles.header}>
                            <span className={cardStyles.gripHandle}>
                                <Grip className={cardStyles.grip} />
                            </span>
                            <input
                                className={cardStyles.name}
                                value={overlayProject.name}
                                placeholder="Project name…"
                                readOnly
                            />
                        </div>
                    </section>
                )}
            </DragOverlay>
        </DndContext>
    );
}

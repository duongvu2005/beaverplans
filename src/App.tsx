import { useState } from 'react';
import { ProjectView } from './components/ProjectView';
import { WeekView } from './components/WeekView';
import { sampleWeek } from './fixtures/sampleWeek';
import { newId } from './utils/newId';
import './App.css';
import type { WeekPlan } from './core/types';
import {
    addProject,
    addTask,
    removeProject,
    removeTask,
    setProjectName,
    setTaskName,
    toggleSubtask,
    toggleTask,
} from './core/projects';
import { TaskEditor } from './components/TaskEditor';

type View = 'plan' | 'stats' | 'archive';

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [plan, setPlan] = useState<WeekPlan>(sampleWeek);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

    const editingProject = editingTaskId
        ? plan.projects.find((p) => p.tasks.some((t) => t.id === editingTaskId))
        : undefined;
    const editingTask = editingProject?.tasks.find((t) => t.id === editingTaskId);

    function handleEditTask(taskId: string) {
        setEditingTaskId(taskId);
    }

    function handleCloseEditor() {
        setEditingTaskId(null);
    }

    function handleEditSubtask(subtaskId: string) {
        const task = plan.projects
            .flatMap((p) => p.tasks)
            .find((t) => t.subtasks.some((s) => s.id === subtaskId));
        if (task) setEditingTaskId(task.id);
    }

    function handleToggleTask(taskId: string) {
        setPlan((current) => toggleTask(current, taskId));
    }

    function handleToggleSubtask(subtaskId: string) {
        setPlan((current) => toggleSubtask(current, subtaskId));
    }

    function handleAddProject() {
        setPlan((current) => addProject(current, newId()));
    }

    function handleAddTask(projectId: string) {
        setPlan((current) => addTask(current, projectId, newId()));
    }

    function handleRenameTask(taskId: string, name: string) {
        setPlan((current) => setTaskName(current, taskId, name));
    }

    function handleRenameProject(projectId: string, name: string) {
        setPlan((current) => setProjectName(current, projectId, name));
    }

    function handleRemoveProject(projectId: string) {
        setPlan((current) => removeProject(current, projectId));
    }

    function handleRemoveTask(taskId: string) {
        setPlan((current) => removeTask(current, taskId));
    }
    return (
        <>
            <nav className="tabs">
                <button
                    aria-current={view === 'plan' ? 'page' : undefined}
                    onClick={() => setView('plan')}
                >
                    plan
                </button>
                <button
                    aria-current={view === 'stats' ? 'page' : undefined}
                    onClick={() => setView('stats')}
                >
                    stats
                </button>
                <button
                    aria-current={view === 'archive' ? 'page' : undefined}
                    onClick={() => setView('archive')}
                >
                    archive
                </button>
            </nav>
            <main className="pane">
                {view === 'plan' && (
                    <div className="plan-layout">
                        <ProjectView
                            projects={plan.projects}
                            onEditTask={handleEditTask}
                            onToggleTask={handleToggleTask}
                            onAddProject={handleAddProject}
                            onAddTask={handleAddTask}
                            onRenameProject={handleRenameProject}
                            onRenameTask={handleRenameTask}
                            onRemoveProject={handleRemoveProject}
                            onRemoveTask={handleRemoveTask}
                        />
                        <WeekView
                            projects={plan.projects}
                            weekStart={plan.weekStart}
                            onToggleSubtask={handleToggleSubtask}
                            onEditSubtask={handleEditSubtask}
                        />
                    </div>
                )}
                {view === 'stats' && <div>stats pane</div>}
                {view === 'archive' && <div>archive pane</div>}
            </main>
            {editingTask && editingProject && (
                <TaskEditor
                    task={editingTask}
                    projectName={editingProject.name}
                    onClose={handleCloseEditor}
                />
            )}
        </>
    );
}

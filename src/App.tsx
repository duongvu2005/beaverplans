import { useState } from 'react';
import { ProjectList } from './components/ProjectList';
import { WeekGrid } from './components/WeekGrid';
import { sampleWeek } from './fixtures/sampleWeek';

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

type View = 'plan' | 'stats' | 'archive';

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [plan, setPlan] = useState<WeekPlan>(sampleWeek);

    function handleToggleTask(taskId: string) {
        setPlan((current) => toggleTask(current, taskId));
    }

    function handleToggleSubtask(subtaskId: string) {
        setPlan((current) => toggleSubtask(current, subtaskId));
    }

    function handleAddProject() {
        setPlan((current) => addProject(current, crypto.randomUUID()));
    }

    function handleAddTask(projectId: string) {
        setPlan((current) => addTask(current, projectId, crypto.randomUUID()));
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
                        <ProjectList
                            projects={plan.projects}
                            onToggleTask={handleToggleTask}
                            onAddProject={handleAddProject}
                            onAddTask={handleAddTask}
                            onRenameProject={handleRenameProject}
                            onRenameTask={handleRenameTask}
                            onRemoveProject={handleRemoveProject}
                            onRemoveTask={handleRemoveTask}
                        />
                        <WeekGrid projects={plan.projects} onToggleSubtask={handleToggleSubtask} />
                    </div>
                )}
                {view === 'stats' && <div>stats pane</div>}
                {view === 'archive' && <div>archive pane</div>}
            </main>
        </>
    );
}

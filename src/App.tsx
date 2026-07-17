import { useState } from 'react';
import { ProjectList } from './components/ProjectList';
import { sampleWeek } from './fixtures/sampleWeek';

import './App.css';
import type { WeekPlan } from './core/types';
import { toggleTask } from './core/projects';

type View = 'plan' | 'stats' | 'archive';

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [plan, setPlan] = useState<WeekPlan>(sampleWeek);

    function handleToggleTask(taskId: string) {
        setPlan(current => toggleTask(current, taskId));
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
                    <div>
                        {' '}
                        <ProjectList projects={plan.projects} onToggleTask={handleToggleTask} />
                    </div>
                )}
                {view === 'stats' && <div>stats pane</div>}
                {view === 'archive' && <div>archive pane</div>}
            </main>
        </>
    );
}

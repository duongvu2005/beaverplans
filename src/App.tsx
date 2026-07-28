import { useState } from 'react';
import type { Archive, WeekPlan } from './core/types';
import { archiveWeek, carryUnfinished } from './core/archive';
import { nextWeekStart } from './core/dates';
import { overallProgress } from './core/progress';
import { sampleWeek } from './fixtures/sampleWeek';
import { WeekBoard } from './components/WeekBoard';
import { ArchiveBoard } from './components/ArchiveBoard';
import { StatsBoard } from './components/StatsBoard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WeekProgressRow } from './components/WeekProgressRow';
import shell from './components/dialogShell.module.css';
import './App.css';

type View = 'plan' | 'stats' | 'archive';

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [plan, setPlan] = useState<WeekPlan>(sampleWeek);
    const [archive, setArchive] = useState<Archive>([]);
    const [confirmingEndWeek, setConfirmingEndWeek] = useState(false);

    const overall = overallProgress(plan.projects);
    const hasUnfinished = overall.done < overall.total;

    function handleEndWeek() {
        if (plan.projects.length === 0) return;
        setConfirmingEndWeek(true);
    }

    function handleConfirmEndWeek(keepUnfinished: boolean) {
        const newWeekStart = nextWeekStart(plan.weekStart);
        setArchive((current) => archiveWeek(current, plan));
        setPlan(
            keepUnfinished
                ? carryUnfinished(plan, newWeekStart)
                : { weekStart: newWeekStart, projects: [] },
        );
        setConfirmingEndWeek(false);
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
                    <>
                        <WeekProgressRow progress={overall} onEndWeek={handleEndWeek} />
                        <WeekBoard plan={plan} onChange={setPlan} />
                    </>
                )}
                {view === 'stats' && <StatsBoard />}
                {view === 'archive' && <ArchiveBoard archive={archive} onChange={setArchive} />}
            </main>
            {confirmingEndWeek && hasUnfinished && (
                <ConfirmDialog
                    eyebrow="End week"
                    title="Some tasks aren't finished yet"
                    onClose={() => setConfirmingEndWeek(false)}
                    actions={[
                        {
                            label: 'Clear all',
                            onAction: () => handleConfirmEndWeek(false),
                            tone: 'danger',
                        },
                        {
                            label: 'Carry forward',
                            onAction: () => handleConfirmEndWeek(true),
                        },
                    ]}
                >
                    <p className={shell.text}>
                        This records the week in your archive. Unfinished tasks can carry forward
                        into next week, or be cleared along with everything else.
                    </p>
                </ConfirmDialog>
            )}
            {confirmingEndWeek && !hasUnfinished && (
                <ConfirmDialog
                    eyebrow="End week"
                    title="Everything's done — nice work"
                    confirmLabel="End week & start fresh"
                    onConfirm={() => handleConfirmEndWeek(false)}
                    onClose={() => setConfirmingEndWeek(false)}
                >
                    <p className={shell.text}>
                        This records the week in your archive and starts a fresh board.
                    </p>
                </ConfirmDialog>
            )}
        </>
    );
}

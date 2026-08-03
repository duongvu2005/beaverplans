import { useState } from 'react';
import type { DateKey, WeekPlan, Weeks } from './core/types';
import {
    FIRST_WEEK_START,
    LAST_WEEK_START,
    dateKeyForDay,
    monthAndDay,
    nextWeekStart,
    todayKey,
    weekStartOf,
} from './core/dates';
import {
    canEndWeek,
    carryForward,
    earliestActiveWeek,
    endWeek,
    endedWeeks,
    isEmptyWeek,
    isEnded,
    moveWeek,
    putWeek,
    weekAt,
} from './core/weeks';
import { newId } from './utils/newId';
import { overallProgress } from './core/progress';
import { sampleWeek } from './fixtures/sampleWeek';
import { sampleArchive } from './fixtures/sampleArchive';
import { WeekBoard } from './components/WeekBoard';
import { ArchiveBoard } from './components/ArchiveBoard';
import { StatsBoard } from './components/StatsBoard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WeekHeader } from './components/WeekHeader';
import { WeekRef } from './components/WeekRef';
import { TopBar, type View } from './components/TopBar';
import shell from './components/dialogShell.module.css';
import './App.css';
import { useWeeks } from './components/useWeeks';

// The fixtures are hand-listed in reading order; folding putWeek over them sorts
// them and enforces the collection's invariants from the first render.
const _seedWeeks: Weeks = [sampleWeek, ...sampleArchive].reduce<Weeks>(putWeek, []);

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [weeks, setWeeks] = useWeeks();
    const currentWeek = weekStartOf(new Date());
    // Always the literal current week, whether it holds work, is empty, or has
    // already been ended — weeks may interleave now, so there is no archive
    // boundary to land in front of instead. If older work is still open, the
    // header note below points at it rather than the app silently jumping there.
    const [viewing, setViewing] = useState<DateKey>(currentWeek);
    const [confirmingEndWeek, setConfirmingEndWeek] = useState(false);

    const plan = weekAt(weeks, viewing);
    const overall = overallProgress(plan.projects);
    const hasUnfinished = overall.done < overall.total;
    const archive = endedWeeks(weeks);
    const ended = isEnded(plan);
    const empty = isEmptyWeek(plan);
    const canMove = !empty && !ended;
    const canEnd = canEndWeek(weeks, viewing, currentWeek);
    // The oldest week still waiting to be ended — no longer a gate on ending
    // (any open week may be ended on its own), just what the header note below
    // points you at when it sits behind the week on screen.
    const queueHead = earliestActiveWeek(weeks, currentWeek);
    // Carrying forward lands on the following week; if that week is already
    // ended (frozen), carryForward is a no-op, so the option is hidden rather
    // than offered and silently doing nothing.
    const carryDestination = nextWeekStart(viewing);
    const carryBlocked = isEnded(weekAt(weeks, carryDestination));

    // Prose for whichever state the viewed week is in. Absent on an ordinary live
    // week — there the controls speak for themselves and a line of explanation
    // every time would be noise. Move mode writes its own; see WeekHeader.
    //
    // Wherever a note names a week that is not the one on screen, it names it
    // with a WeekRef and the name takes you there: the sentence explaining why
    // this week is stuck is also the way to the week it is stuck behind.
    const headerNote = ended ? (
        <>
            Ended {monthAndDay(dateKeyForDay(viewing, 'sun'))} · filed in your archive. Nothing on
            this board can change.
        </>
    ) : canEnd && viewing !== currentWeek ? (
        <>
            This week is over. <b>End it</b> to file it in your archive and start the next one.
        </>
    ) : queueHead < viewing ? (
        <>
            <WeekRef weekStart={queueHead} onView={setViewing} /> is still open.
        </>
    ) : empty ? (
        <>Nothing planned yet — add a project to start the week.</>
    ) : undefined;

    // A week named on another tab. Setting the week without the tab would leave
    // the click looking like it did nothing, so the two move together — this is
    // the only way any view but Plan changes which week is being looked at.
    function handleOpenWeek(weekStart: DateKey) {
        setViewing(weekStart);
        setView('plan');
    }

    function handlePlanChange(updater: (current: WeekPlan) => WeekPlan) {
        setWeeks((current) => putWeek(current, updater(weekAt(current, viewing))));
    }

    // The one reason moveWeek can refuse an armed destination that is reachable
    // from the UI — arming only starts when canMove is true, so the source
    // itself is never the problem. Shown in place of the destination note so a
    // blocked target explains itself instead of Move silently declining to
    // commit.
    function moveBlockReason(destination: DateKey): string | undefined {
        if (!isEmptyWeek(weekAt(weeks, destination))) return 'This week already has work in it.';
        return undefined;
    }

    function handleMoveWork(from: DateKey, to: DateKey) {
        // moveWeek returns its argument untouched when the move is not one the
        // model allows, which is exactly when the view should not follow.
        const moved = moveWeek(weeks, from, to);
        if (moved === weeks) return;
        setWeeks(moved);
        setViewing(to);
    }

    // The Archive tab is handed only the ended weeks, so its updater runs on that
    // subset and the active weeks are put back untouched.
    function handleArchiveChange(updater: (current: Weeks) => Weeks) {
        setWeeks((current) =>
            updater(endedWeeks(current)).reduce<Weeks>(
                putWeek,
                current.filter((week) => !isEnded(week)),
            ),
        );
    }

    function handleEndWeek() {
        if (!canEndWeek(weeks, viewing, currentWeek)) return;
        setConfirmingEndWeek(true);
    }

    // Ending records the week whole; carrying forward is a separate copy on top of
    // it, which is why the two buttons differ by one call and not by a flag deep in
    // the producer. The default destination is the following week.
    function handleConfirmEndWeek(keepUnfinished: boolean) {
        setWeeks((current) => {
            const ended = endWeek(current, viewing, currentWeek);
            return keepUnfinished
                ? carryForward(ended, viewing, carryDestination, newId)
                : ended;
        });
        setViewing(carryDestination);
        setConfirmingEndWeek(false);
    }

    return (
        <>
            <TopBar view={view} onView={setView} />
            <main className="pane">
                {view === 'plan' && (
                    <>
                        <WeekHeader
                            weekStart={viewing}
                            today={todayKey()}
                            progress={overall}
                            canMove={canMove}
                            canEnd={canEnd}
                            ended={ended}
                            note={headerNote}
                            minWeekStart={FIRST_WEEK_START}
                            maxWeekStart={LAST_WEEK_START}
                            destinationBlockedReason={moveBlockReason}
                            onView={setViewing}
                            onMoveWork={handleMoveWork}
                            onEndWeek={handleEndWeek}
                        />
                        <WeekBoard plan={plan} onChange={handlePlanChange} />
                    </>
                )}
                {view === 'stats' && <StatsBoard archive={archive} onOpenWeek={handleOpenWeek} />}
                {view === 'archive' && (
                    <ArchiveBoard archive={archive} onChange={handleArchiveChange} />
                )}
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
                        ...(carryBlocked
                            ? []
                            : [{ label: 'Carry forward', onAction: () => handleConfirmEndWeek(true) }]),
                    ]}
                >
                    <p className={shell.text}>
                        {carryBlocked
                            ? "This records the week in your archive. Next week is already ended, so unfinished tasks will be cleared along with everything else."
                            : 'This records the week in your archive. Unfinished tasks can carry forward into next week, or be cleared along with everything else.'}
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

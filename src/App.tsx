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
    isAfterArchive,
    isEmptyWeek,
    isEnded,
    lastEndedWeek,
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

// The fixtures are hand-listed in reading order; folding putWeek over them sorts
// them and enforces the collection's invariants from the first render.
const seedWeeks: Weeks = [sampleWeek, ...sampleArchive].reduce<Weeks>(putWeek, []);

export default function App() {
    const [view, setView] = useState<View>('plan');
    const [weeks, setWeeks] = useState<Weeks>(seedWeeks);
    const currentWeek = weekStartOf(new Date());
    const [viewing, setViewing] = useState<DateKey>(() =>
        earliestActiveWeek(seedWeeks, currentWeek),
    );
    const [confirmingEndWeek, setConfirmingEndWeek] = useState(false);

    const plan = weekAt(weeks, viewing);
    const overall = overallProgress(plan.projects);
    const hasUnfinished = overall.done < overall.total;
    const archive = endedWeeks(weeks);
    // Any week still open may have its plan relabelled, past ones included; only a
    // frozen week and an empty one are dead. Where it may LAND is moveWeek's
    // business — see moveBlockReason below.
    const ended = isEnded(plan);
    const empty = isEmptyWeek(plan);
    const canMove = !empty && !ended;
    const canEnd = canEndWeek(weeks, viewing, currentWeek);
    // TEMPORARY (2026-08-01). A week at or before the last ended one cannot be
    // planned, because putWeek would store an active entry before an ended one
    // and break Weeks' ended-come-first clause. weekAt hands back a blank,
    // un-ended plan for any week with no entry, so without this the board offers
    // a fully live board for every gap inside the archive and every week before
    // it — and an edit there produces a collection isValidWeeks rejects, which
    // is also the validator for stored JSON.
    //
    // This is a UI guard over a domain hole, which is backwards, and the
    // restriction it imposes is real: you cannot record a week you forgot to
    // plan at the time. Both go away when the ended-come-first clause is
    // dropped; see the note on isValidWeeks.
    const plannable = isAfterArchive(weeks, viewing);
    const archiveBound = lastEndedWeek(weeks);
    // The week the queue is waiting on. Naming it is what lets the header say
    // WHY End week is dead somewhere else, instead of just greying out.
    const queueHead = earliestActiveWeek(weeks, currentWeek);

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
    ) : !plannable ? (
        <>
            This week sits behind your archive. Everything up to{' '}
            {archiveBound === undefined ? (
                ''
            ) : (
                <WeekRef weekStart={archiveBound} onView={setViewing} />
            )}{' '}
            is settled, so it can be read but not planned.
        </>
    ) : empty ? (
        <>Nothing planned yet — add a project to start the week.</>
    ) : !canEnd && queueHead < viewing ? (
        <>
            End <WeekRef weekStart={queueHead} onView={setViewing} /> first — weeks are archived
            oldest first.
        </>
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

    // The two reasons moveWeek can refuse an armed destination that are
    // reachable from the UI — arming only starts when canMove is true, so the
    // source itself is never the problem. Shown in place of the destination
    // note so a blocked target explains itself instead of Move silently
    // declining to commit.
    function moveBlockReason(destination: DateKey): string | undefined {
        if (!isAfterArchive(weeks, destination)) return 'This week sits behind your archive.';
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
        const next = nextWeekStart(viewing);
        setWeeks((current) => {
            const ended = endWeek(current, viewing, currentWeek);
            return keepUnfinished ? carryForward(ended, viewing, next, newId) : ended;
        });
        setViewing(next);
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
                        <WeekBoard plan={plan} onChange={handlePlanChange} readOnly={!plannable} />
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

import { useState } from 'react';
import type { DateKey, WeekPlan, Weeks } from '@/core/types';
import {
    FIRST_WEEK_START,
    LAST_WEEK_START,
    dateKeyForDay,
    monthAndDay,
    nextWeekStart,
    todayKey,
    weekRangeLabel,
    weekStartOf,
} from '@/core/dates';
import {
    canEndWeek,
    carryForward,
    clearWeek,
    earliestActiveWeek,
    endWeek,
    reopenWeek,
    endedWeeks,
    isEmptyWeek,
    isEnded,
    moveWeek,
    putWeek,
    weekAt,
} from '@/core/weeks';
import { exportFilename, exportJson } from '@/storage/exportData';
import { downloadText } from '@/utils/downloadText';
import { newId } from '@/utils/newId';
import { overallProgress } from '@/core/progress';
import { WeekBoard } from '@/components/WeekBoard';
import { ArchiveBoard } from '@/components/ArchiveBoard';
import { StatsBoard } from '@/components/StatsBoard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataPrivacyDialog } from '@/components/DataPrivacyDialog';
import { GuestMergeDialog } from '@/components/GuestMergeDialog';
import { GuestMergeSheet } from '@/components/GuestMergeSheet';
import { WeekHeader } from '@/components/WeekHeader';
import { WeekRef } from '@/components/WeekRef';
import { TopBar, type View } from '@/components/TopBar';
import { AuthForm, type AuthMode } from '@/components/AuthForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { AccountSettings } from '@/components/AccountSettings';
import { ChangeEmailForm } from '@/components/ChangeEmailForm';
import { RecoveryScreen } from '@/components/RecoveryScreen';
import { useAuth } from '@/hooks/useAuth';
import { useGuestMigration } from '@/hooks/useGuestMigration';
import { useIsDesktop } from '@/hooks/useContainerWidth';
import shell from '@/components/dialogShell.module.css';
import './App.css';
import { useWeeks } from '@/hooks/useWeeks';

export default function App() {
    const auth = useAuth();
    const [view, setView] = useState<View>('plan');
    const [authOpen, setAuthOpen] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [changingEmail, setChangingEmail] = useState(false);
    const [weeks, setWeeks, weeksLoaded] = useWeeks(auth.epoch);
    const guestMigration = useGuestMigration(auth.user?.id, weeksLoaded, setWeeks);
    // The guest-work prompt is the one place two form factors want different
    // markup rather than different styling, so the choice is made here instead
    // of inside one component that tried to be both.
    const isDesktop = useIsDesktop();
    const currentWeek = weekStartOf(new Date());
    // Always the literal current week, whether it holds work, is empty, or has
    // already been ended — weeks may interleave now, so there is no archive
    // boundary to land in front of instead. If older work is still open, the
    // header note below points at it rather than the app silently jumping there.
    const [viewing, setViewing] = useState<DateKey>(currentWeek);
    const [confirmingEndWeek, setConfirmingEndWeek] = useState(false);
    const [confirmingReopen, setConfirmingReopen] = useState(false);
    const [confirmingClearBoard, setConfirmingClearBoard] = useState(false);
    const [confirmingClearAll, setConfirmingClearAll] = useState(false);
    const [dataOpen, setDataOpen] = useState(false);

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
    ) : queueHead !== undefined && queueHead < viewing ? (
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
            return keepUnfinished ? carryForward(ended, viewing, carryDestination, newId) : ended;
        });
        setViewing(carryDestination);
        setConfirmingEndWeek(false);
    }

    // No flash bar yet, so the only feedback a download gives is the browser's own.
    // That is the strongest signal available and arguably the right one anyway —
    // it is the thing the person asked for, appearing. Copy has its own in-place
    // "Copied", inside the dialog where the button is.
    function handleExportData() {
        const now = new Date();
        downloadText(exportFilename(now), exportJson(weeks, now), 'application/json');
    }

    function handleConfirmClearBoard() {
        setWeeks((current) => clearWeek(current, viewing));
        setConfirmingClearBoard(false);
    }

    function handleConfirmClearAll() {
        setWeeks([]);
        setConfirmingClearAll(false);
    }

    // Reopening leaves the viewed week where it is: you are looking at the week
    // you want back, and it stays under you — only its frozen-ness changes.
    function handleConfirmReopen() {
        setWeeks((current) => reopenWeek(current, viewing));
        setConfirmingReopen(false);
    }

    // signin closes the dialog on success; reset doesn't (AuthForm shows its
    // own non-committal notice and stays put). signup closes it only when
    // Supabase hands back a live session immediately — when email
    // confirmation is required instead, the dialog stays open and AuthForm
    // switches to its own "check your email" state — see AuthForm.tsx.
    async function handleAuthSubmit(
        mode: AuthMode,
        email: string,
        password: string,
        username: string,
        captchaToken: string,
    ): Promise<{ confirmationRequired: boolean }> {
        if (mode === 'signin') {
            await auth.signIn(email, password, captchaToken);
            setAuthOpen(false);
            return { confirmationRequired: false };
        } else if (mode === 'signup') {
            const sessionEstablished = await auth.signUp(email, password, username, captchaToken);
            if (sessionEstablished) setAuthOpen(false);
            return { confirmationRequired: !sessionEstablished };
        } else {
            await auth.resetPassword(email, captchaToken);
            return { confirmationRequired: false };
        }
    }

    if (auth.loading) {
        return null;
    }

    if (auth.recovering) {
        return (
            <RecoveryScreen
                onUpdatePassword={auth.updatePassword}
                onDone={auth.clearRecovering}
                onCancel={auth.cancelRecovery}
            />
        );
    }

    // Auth resolving only settles which backend is active — a sign-in/out
    // still has to reload from that backend, and without this extra gate the
    // outgoing backend's weeks (e.g. guest data, right after signing in)
    // would render for a moment before the real ones swap in.
    if (!weeksLoaded) {
        return null;
    }

    return (
        <>
            <TopBar
                view={view}
                onView={setView}
                user={auth.user}
                onOpenAuth={() => setAuthOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onSignOut={() => void auth.signOut()}
                onOpenData={() => setDataOpen(true)}
            />
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
                            onReopenWeek={() => setConfirmingReopen(true)}
                            canClear={!ended && !isEmptyWeek(plan)}
                            onClearBoard={() => setConfirmingClearBoard(true)}
                        />
                        <WeekBoard plan={plan} onChange={handlePlanChange} />
                    </>
                )}
                {view === 'stats' && <StatsBoard archive={archive} onOpenWeek={handleOpenWeek} />}
                {view === 'archive' && (
                    <ArchiveBoard
                        archive={archive}
                        onChange={handleArchiveChange}
                        onOpenWeek={handleOpenWeek}
                    />
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
                            : [
                                  {
                                      label: 'Carry forward',
                                      onAction: () => handleConfirmEndWeek(true),
                                  },
                              ]),
                    ]}
                >
                    <p className={shell.text}>
                        {carryBlocked
                            ? 'This records the week in your archive. Next week is already ended, so unfinished tasks will be cleared along with everything else.'
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
            {/* The whole weight of the reopen decision sits here rather than in
                the button, which is deliberately the quietest control on the
                header. Mis-ending a week is an easy slip and has to be
                fixable — so the copy permits that plainly first, and only then
                makes the case for leaving a finished week alone. */}
            {confirmingReopen && (
                <ConfirmDialog
                    eyebrow={weekRangeLabel(viewing)}
                    title="Rewriting history?"
                    confirmLabel="Reopen week"
                    onConfirm={handleConfirmReopen}
                    onClose={() => setConfirmingReopen(false)}
                >
                    <p className={shell.text}>
                        Ended the week by mistake, or forgot to log something? Reopen it and make it
                        right. Just remember: your archive is most valuable when it reflects how
                        things actually went ;{')'}
                    </p>
                </ConfirmDialog>
            )}
            {confirmingClearBoard && (
                <ConfirmDialog
                    eyebrow={weekRangeLabel(viewing)}
                    title="Clear this board?"
                    confirmLabel="Clear the board"
                    confirmTone="danger"
                    onConfirm={handleConfirmClearBoard}
                    onClose={() => setConfirmingClearBoard(false)}
                >
                    <p className={shell.text}>
                        Removes every project on this week, finished or not. Other weeks and your
                        archive are untouched — and unlike ending the week, this keeps no record of
                        what was here.
                    </p>
                </ConfirmDialog>
            )}
            {/* Signed-in only, like the row that opens it: there is no server-held
                copy of a guest's weeks to hand over or erase. */}
            {dataOpen && auth.user !== null && (
                <DataPrivacyDialog
                    email={auth.user.email}
                    weekCount={weeks.length}
                    onClose={() => setDataOpen(false)}
                    onDownload={handleExportData}
                    exportText={() => exportJson(weeks, new Date())}
                    // Hands off rather than stacking a confirm on top of the panel
                    // it was opened from, the same way every other row in the
                    // account surfaces does.
                    onClearAll={() => {
                        setDataOpen(false);
                        setConfirmingClearAll(true);
                    }}
                />
            )}
            {/* Named by what it costs rather than by the button that opened it. The
                panel behind it offers two ways to keep a copy first, and this copy
                says so plainly: it is the one action in the app with nothing
                behind it. */}
            {confirmingClearAll && (
                <ConfirmDialog
                    eyebrow="Data &amp; privacy"
                    title="Delete every week?"
                    confirmLabel="Delete everything"
                    confirmTone="danger"
                    onConfirm={handleConfirmClearAll}
                    onClose={() => setConfirmingClearAll(false)}
                >
                    <p className={shell.text}>
                        This deletes all {weeks.length} of your weeks from the server, planned and
                        archived alike, on every device you are signed in on. Your account and
                        sign-in stay exactly as they are — only the weeks go.
                    </p>
                    <p className={shell.text}>
                        There is no undo. If you have not taken a copy yet, cancel and do that
                        first.
                    </p>
                </ConfirmDialog>
            )}
            {authOpen && (
                <AuthForm
                    initialMode="signin"
                    onCancel={() => setAuthOpen(false)}
                    onSubmit={handleAuthSubmit}
                />
            )}
            {/* Signed-in only, like the row that opens it. Both of the flows it
                hands off to are owned here rather than nested inside it, for the
                same reason every other handoff in this app is: a panel left
                mounted behind the thing it opened is a panel you dismiss twice. */}
            {settingsOpen && auth.user !== null && (
                <AccountSettings
                    username={auth.user.username}
                    email={auth.user.email}
                    onClose={() => setSettingsOpen(false)}
                    onSaveUsername={auth.updateUsername}
                    onChangePassword={() => {
                        setSettingsOpen(false);
                        setChangingPassword(true);
                    }}
                    onChangeEmail={() => {
                        setSettingsOpen(false);
                        setChangingEmail(true);
                    }}
                />
            )}
            {changingEmail && auth.user !== null && (
                <ChangeEmailForm email={auth.user.email} onClose={() => setChangingEmail(false)} />
            )}
            {/* Owned here rather than by the panel it is opened from, the same
                way AuthForm is: that panel closes on the way. The email is a
                precondition, not something the screen copes with being absent —
                and signing out while it is open takes auth.user away, which is
                what closes it. */}
            {changingPassword && auth.user?.email !== undefined && (
                <ChangePasswordForm
                    email={auth.user.email}
                    onVerifyPassword={auth.verifyPassword}
                    onUpdatePassword={auth.updatePassword}
                    onResetPassword={auth.resetPassword}
                    onClose={() => setChangingPassword(false)}
                />
            )}
            {guestMigration.pendingMerge &&
                (isDesktop ? (
                    <GuestMergeDialog
                        onClose={guestMigration.decideLater}
                        onMerge={guestMigration.confirmMerge}
                        onDiscard={guestMigration.discardGuestWork}
                    />
                ) : (
                    <GuestMergeSheet
                        onClose={guestMigration.decideLater}
                        onMerge={guestMigration.confirmMerge}
                        onDiscard={guestMigration.discardGuestWork}
                    />
                ))}
        </>
    );
}

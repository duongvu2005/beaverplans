import { useRef, useState } from 'react';
import type { DateKey, WeekPlan, Weeks } from '@/core/types';
import {
    FIRST_WEEK_START,
    LAST_WEEK_START,
    dateKeyForDay,
    nextWeekStart,
    todayKey,
    weekPhaseOf,
    weekStartOf,
} from '@/core/dates';
import { monthAndDay, weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
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
import { WeekBoard } from '@/components/week/WeekBoard';
import { WeekList } from '@/components/weeks/WeekList';
import { StatsBoard } from '@/components/stats/StatsBoard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataPrivacyDialog } from '@/components/account/DataPrivacyDialog';
import { ImportDataDialog } from '@/components/account/ImportDataDialog';
import { GuestMergeDialog } from '@/components/auth/GuestMergeDialog';
import { GuestMergeSheet } from '@/components/auth/GuestMergeSheet';
import { GuestReopenDialog } from '@/components/auth/GuestReopenDialog';
import { SignOutPendingDialog } from '@/components/auth/SignOutPendingDialog';
import { WeekHeader } from '@/components/week/WeekHeader';
import { WeekRef } from '@/components/shared/WeekRef';
import { TopBar, type View } from '@/components/shell/TopBar';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';
import { CrashScreen } from '@/components/shell/CrashScreen';
import { AuthForm, type AuthMode } from '@/components/auth/AuthForm';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { AccountSettings } from '@/components/account/AccountSettings';
import { ChangeEmailForm } from '@/components/account/ChangeEmailForm';
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { RecoveryScreen } from '@/components/auth/RecoveryScreen';
import { useAuth } from '@/hooks/useAuth';
import { useGuestMigration } from '@/hooks/useGuestMigration';
import { useGuidePref } from '@/hooks/useGuidePref';
import { accountGuide } from '@/hooks/accountGuide';
import { supabase } from '@/storage/supabaseClient';
import { useIsDesktop } from '@/hooks/useContainerWidth';
import { usePublishScrollbarWidth } from '@/hooks/usePublishScrollbarWidth';
import shell from '@/components/shared/dialogShell.module.css';
import './App.css';
import { useWeeks } from '@/hooks/useWeeks';

/** Module scope, not inside App: `useGuidePref` needs one that never changes
 * identity, and a hook importing the client would drag it into every test. */
const GUIDE_ACCOUNT = accountGuide(supabase.auth);

/**
 * Which dialog is up, if any. A variant carries what its dialog needs, so "open
 * with nothing to show" is unrepresentable.
 */
type Modal =
    | { readonly kind: 'auth' }
    /** the menu behind the account chip, which every screen below opens from */
    | { readonly kind: 'settings' }
    | { readonly kind: 'accountSettings' }
    | { readonly kind: 'changeEmail' }
    | { readonly kind: 'changePassword' }
    | { readonly kind: 'deleteAccount' }
    | { readonly kind: 'data' }
    | { readonly kind: 'import' }
    /** Weeks read off a chosen file, waiting on the replace confirm. */
    | { readonly kind: 'confirmImport'; readonly weeks: Weeks }
    | { readonly kind: 'clearAll' }
    | { readonly kind: 'clearBoard' }
    | { readonly kind: 'endWeek' }
    | { readonly kind: 'reopen' };

export default function App() {
    const auth = useAuth();
    const { locale } = useLocale();
    // Must go on the app's scroll container: the bar outside it pads by what
    // this publishes.
    const paneRef = usePublishScrollbarWidth();
    const { app, common, dataPrivacyDialog } = useCopy();
    const [view, setView] = useState<View>('plan');
    const [modal, setModal] = useState<Modal | null>(null);
    const [weeks, setWeeks, weeksLoaded] = useWeeks(auth.epoch);
    // Owned here, not in TopBar as the theme is: two subtrees read it.
    const { pref: guidePref, setPref: setGuidePref } = useGuidePref(GUIDE_ACCOUNT);
    const guestMigration = useGuestMigration(auth.user?.id, weeksLoaded, setWeeks);
    const isDesktop = useIsDesktop();
    const currentWeek = weekStartOf(new Date());
    const [viewing, setViewing] = useState<DateKey>(currentWeek);
    // Out of Modal: a flush lands long after the click that started it, so a
    // Modal variant would close whatever was opened in between.
    // Raised only when signing out would lose work — see signOutWhenSynced.
    const [signOutBlocked, setSignOutBlocked] = useState(false);
    // A flush can take seconds, and the sheet closes over it: without this a
    // second Sign out starts a second one.
    const signingOut = useRef(false);

    const plan = weekAt(weeks, viewing);
    const overall = overallProgress(plan.projects);
    const hasUnfinished = overall.done < overall.total;
    // Stats measure closed-out weeks only, so they keep the ended filter the
    // week list no longer applies.
    const archive = endedWeeks(weeks);
    const today = todayKey();
    // The preference is the whole answer: anything ANDed with it here would
    // make turning the guide back on do nothing for whoever tried.
    const guideEnabled = guidePref === 'yes';
    const ended = isEnded(plan);
    const empty = isEmptyWeek(plan);
    const canMove = !empty && !ended;
    const canEnd = canEndWeek(weeks, viewing, currentWeek);
    const queueHead = earliestActiveWeek(weeks, currentWeek);
    // Undefined on every week but the one being lived — that alone gates the
    // day-phase note below to the current week.
    const phase = weekPhaseOf(viewing, todayKey());
    // carryForward is a no-op onto an ended week, so the option is hidden
    // rather than offered and silently doing nothing.
    const carryDestination = nextWeekStart(viewing);
    const carryBlocked = isEnded(weekAt(weeks, carryDestination));

    // Undefined on a week with nothing to say. Move mode writes its own note
    // over this one; see WeekHeader.
    const headerNote = ended ? (
        <>{app.endedNote(monthAndDay(dateKeyForDay(viewing, 'sun'), locale))}</>
    ) : canEnd && viewing !== currentWeek ? (
        <>
            {app.weekOverLead}
            <b>{app.weekOverAction}</b>
            {app.weekOverRest}
        </>
    ) : queueHead !== undefined && queueHead < viewing ? (
        <>
            {app.queueOpenLead}
            <WeekRef weekStart={queueHead} onView={setViewing} />
            {app.queueOpenRest}
        </>
    ) : phase !== undefined ? (
        <>{app.weekPhase[phase.phase](phase.daysLeft)}</>
    ) : empty ? (
        <>{app.emptyNote}</>
    ) : viewing > currentWeek ? (
        // The one week with work in it that no branch above speaks for:
        // weekPhaseOf answers for the current week alone.
        <>{app.futureNote}</>
    ) : undefined;

    function handleOpenWeek(weekStart: DateKey) {
        setViewing(weekStart);
        setView('plan');
    }

    function handlePlanChange(updater: (current: WeekPlan) => WeekPlan) {
        setWeeks((current) => putWeek(current, updater(weekAt(current, viewing))));
    }

    // Only the destination can block a move reachable from the UI: arming
    // requires canMove, so moveWeek's other refusals cannot be hit here.
    function moveBlockReason(destination: DateKey): string | undefined {
        if (!isEmptyWeek(weekAt(weeks, destination))) return app.moveBlockedHasWork;
        return undefined;
    }

    function handleMoveWork(from: DateKey, to: DateKey) {
        // moveWeek returns its argument untouched when the model refuses.
        const moved = moveWeek(weeks, from, to);
        if (moved === weeks) return;
        setWeeks(moved);
        setViewing(to);
    }

    function handleEndWeek() {
        if (!canEndWeek(weeks, viewing, currentWeek)) return;
        setModal({ kind: 'endWeek' });
    }

    // endWeek records the week whole; the carry is a separate copy on top of it.
    function handleConfirmEndWeek(keepUnfinished: boolean) {
        setWeeks((current) => {
            const ended = endWeek(current, viewing, currentWeek);
            return keepUnfinished ? carryForward(ended, viewing, carryDestination, newId) : ended;
        });
        setViewing(carryDestination);
        setModal(null);
    }

    async function handleSignOut() {
        if (signingOut.current) return;
        signingOut.current = true;
        try {
            if (!(await auth.signOutWhenSynced())) setSignOutBlocked(true);
        } finally {
            signingOut.current = false;
        }
    }

    function handleExportData() {
        const now = new Date();
        downloadText(exportFilename(now), exportJson(weeks, now), 'application/json');
    }

    function handleConfirmClearBoard() {
        setWeeks((current) => clearWeek(current, viewing));
        setModal(null);
    }

    function handleConfirmImport(incoming: Weeks) {
        // The copy comes first: it is what lets the user walk back replacing everything.
        handleExportData();
        setWeeks(incoming);
        setModal(null);
    }

    function handleConfirmClearAll() {
        setWeeks([]);
        setModal(null);
    }

    function handleConfirmReopen() {
        setWeeks((current) => reopenWeek(current, viewing));
        setModal(null);
    }

    // Leaving the dialog open is how AuthForm is told to show its own state —
    // "check your email" for a pending signup, its notice for reset.
    async function handleAuthSubmit(
        mode: AuthMode,
        email: string,
        password: string,
        username: string,
        captchaToken: string,
    ): Promise<{ confirmationRequired: boolean }> {
        if (mode === 'signin') {
            await auth.signIn(email, password, captchaToken);
            setModal(null);
            return { confirmationRequired: false };
        } else if (mode === 'signup') {
            const sessionEstablished = await auth.signUp(email, password, username, captchaToken);
            if (sessionEstablished) setModal(null);
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

    // auth settling only picks the backend. Without this second gate the
    // outgoing backend's weeks — guest data, right after signing in — render
    // for a moment before the real ones arrive.
    if (!weeksLoaded) {
        return null;
    }

    return (
        <>
            <TopBar
                view={view}
                onView={setView}
                user={auth.user}
                guidePref={guidePref}
                onPickGuide={setGuidePref}
                onOpenAuth={() => setModal({ kind: 'auth' })}
                settingsOpen={modal?.kind === 'settings'}
                onOpenSettings={() => setModal({ kind: 'settings' })}
                onCloseSettings={() => setModal(null)}
                onOpenAccountSettings={() => setModal({ kind: 'accountSettings' })}
                onSignOut={() => void handleSignOut()}
                onOpenData={() => setModal({ kind: 'data' })}
            />
            <main className="pane" ref={paneRef}>
                {/* ErrorBoundary is sticky, so the key is what clears a caught
                    error: switching tabs remounts it. */}
                <ErrorBoundary key={view} fallback={() => <CrashScreen scope="view" />}>
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
                                onReopenWeek={() => setModal({ kind: 'reopen' })}
                                canClear={!ended && !isEmptyWeek(plan)}
                                onClearBoard={() => setModal({ kind: 'clearBoard' })}
                            />
                            <WeekBoard
                                plan={plan}
                                onChange={handlePlanChange}
                                guideEnabled={guideEnabled}
                                onSkipGuide={() => setGuidePref('no')}
                            />
                        </>
                    )}
                    {view === 'stats' && (
                        <StatsBoard archive={archive} onOpenWeek={handleOpenWeek} />
                    )}
                    {view === 'weeks' && (
                        <WeekList
                            weeks={weeks}
                            today={today}
                            onChange={setWeeks}
                            onOpenWeek={handleOpenWeek}
                        />
                    )}
                </ErrorBoundary>
            </main>
            {modal?.kind === 'endWeek' && hasUnfinished && (
                <ConfirmDialog
                    eyebrow={app.endWeekEyebrow}
                    title={app.endUnfinishedTitle}
                    onClose={() => setModal(null)}
                    actions={[
                        {
                            label: app.clearAllLabel,
                            onAction: () => handleConfirmEndWeek(false),
                            tone: 'danger',
                        },
                        ...(carryBlocked
                            ? []
                            : [
                                  {
                                      label: app.carryForward,
                                      onAction: () => handleConfirmEndWeek(true),
                                  },
                              ]),
                    ]}
                >
                    <p className={shell.text}>
                        {carryBlocked ? app.endUnfinishedBodyBlocked : app.endUnfinishedBody}
                    </p>
                </ConfirmDialog>
            )}
            {modal?.kind === 'endWeek' && !hasUnfinished && (
                <ConfirmDialog
                    eyebrow={app.endWeekEyebrow}
                    title={app.endDoneTitle}
                    confirmLabel={app.endDoneConfirm}
                    onConfirm={() => handleConfirmEndWeek(false)}
                    onClose={() => setModal(null)}
                >
                    <p className={shell.text}>{app.endDoneBody}</p>
                </ConfirmDialog>
            )}
            {modal?.kind === 'reopen' && (
                <ConfirmDialog
                    eyebrow={weekRangeLabel(viewing, locale)}
                    title={app.reopenTitle}
                    confirmLabel={app.reopenConfirm}
                    onConfirm={handleConfirmReopen}
                    onClose={() => setModal(null)}
                >
                    <p className={shell.text}>{app.reopenBody}</p>
                </ConfirmDialog>
            )}
            {modal?.kind === 'clearBoard' && (
                <ConfirmDialog
                    eyebrow={weekRangeLabel(viewing, locale)}
                    title={app.clearBoardTitle}
                    confirmLabel={app.clearBoardConfirm}
                    confirmTone="danger"
                    onConfirm={handleConfirmClearBoard}
                    onClose={() => setModal(null)}
                >
                    <p className={shell.text}>{app.clearBoardBody}</p>
                </ConfirmDialog>
            )}
            {modal?.kind === 'data' && auth.user !== null && (
                <DataPrivacyDialog
                    weekCount={weeks.length}
                    onClose={() => setModal({ kind: 'settings' })}
                    onDownload={handleExportData}
                    exportText={() => exportJson(weeks, new Date())}
                    onOpenImport={() => setModal({ kind: 'import' })}
                    onClearAll={() => setModal({ kind: 'clearAll' })}
                    onDeleteAccount={() => setModal({ kind: 'deleteAccount' })}
                />
            )}
            {modal?.kind === 'import' && (
                <ImportDataDialog
                    onClose={() => setModal({ kind: 'data' })}
                    onImport={(incoming) => setModal({ kind: 'confirmImport', weeks: incoming })}
                />
            )}
            {modal?.kind === 'clearAll' && auth.user !== null && (
                <ConfirmDialog
                    eyebrow={dataPrivacyDialog.eyebrow}
                    title={app.clearAllTitle}
                    confirmLabel={app.clearAllConfirm}
                    confirmTone="danger"
                    onConfirm={handleConfirmClearAll}
                    cancelLabel={common.back}
                    onClose={() => setModal({ kind: 'data' })}
                    requireTyped={{ value: auth.user.username }}
                >
                    <p className={shell.text}>{app.clearAllBody(weeks.length)}</p>
                </ConfirmDialog>
            )}
            {modal?.kind === 'confirmImport' && auth.user !== null && (
                <ConfirmDialog
                    eyebrow={dataPrivacyDialog.eyebrow}
                    title={app.importTitle}
                    confirmLabel={app.importConfirm}
                    confirmTone="danger"
                    onConfirm={() => handleConfirmImport(modal.weeks)}
                    cancelLabel={common.back}
                    onClose={() => setModal({ kind: 'data' })}
                    requireTyped={{ value: auth.user.username }}
                >
                    <p className={shell.text}>{app.importBody(modal.weeks.length, weeks.length)}</p>
                </ConfirmDialog>
            )}
            {modal?.kind === 'auth' && (
                <AuthForm
                    initialMode="signin"
                    onCancel={() => setModal(null)}
                    onSubmit={handleAuthSubmit}
                    onResendConfirmation={auth.resendConfirmation}
                />
            )}
            {modal?.kind === 'accountSettings' && auth.user !== null && (
                <AccountSettings
                    username={auth.user.username}
                    email={auth.user.email}
                    onClose={() => setModal({ kind: 'settings' })}
                    guidePref={guidePref}
                    onPickGuide={setGuidePref}
                    onSaveUsername={auth.updateUsername}
                    onChangePassword={() => setModal({ kind: 'changePassword' })}
                    onChangeEmail={() => setModal({ kind: 'changeEmail' })}
                />
            )}
            {modal?.kind === 'changeEmail' && auth.user !== null && (
                <ChangeEmailForm
                    email={auth.user.email}
                    onClose={() => setModal({ kind: 'accountSettings' })}
                    onVerifyPassword={auth.verifyPassword}
                    onUpdateEmail={auth.updateEmail}
                />
            )}
            {/* Deleting signs the browser out, so auth.user goes null and this
                branch unmounts itself. Hence no "done" panel. */}
            {modal?.kind === 'deleteAccount' && auth.user?.email !== undefined && (
                <DeleteAccountForm
                    weekCount={weeks.length}
                    onVerifyPassword={auth.verifyPassword}
                    onDeleteAccount={auth.deleteAccount}
                    onClose={() => setModal({ kind: 'data' })}
                />
            )}
            {/* The email is a precondition, not something the screen copes with
                being absent; signing out takes auth.user away and closes it. */}
            {modal?.kind === 'changePassword' && auth.user?.email !== undefined && (
                <ChangePasswordForm
                    email={auth.user.email}
                    onVerifyPassword={auth.verifyPassword}
                    onUpdatePassword={auth.updatePassword}
                    onResetPassword={auth.resetPassword}
                    onClose={() => setModal({ kind: 'accountSettings' })}
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
            {signOutBlocked && (
                <SignOutPendingDialog
                    onStay={() => setSignOutBlocked(false)}
                    onSignOutAnyway={() => {
                        setSignOutBlocked(false);
                        void auth.signOut();
                    }}
                />
            )}
            {/* Follows Merge, never shown beside the prompt above: confirmMerge
                clears pendingMerge before this can be raised. */}
            {guestMigration.pendingReopen.length > 0 && (
                <GuestReopenDialog
                    weeks={guestMigration.pendingReopen}
                    onClose={guestMigration.cancelReopen}
                    onConfirm={guestMigration.confirmReopen}
                />
            )}
        </>
    );
}

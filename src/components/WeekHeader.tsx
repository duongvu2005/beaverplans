import { useState, type ReactNode } from 'react';
import type { DateKey } from '../core/types';
import type { Progress } from '../core/progress';
import { percentOf } from '../core/math';
import { addWeeks, monthAndDay, weekRangeLabel, weeksBetween } from '../core/dates';
import { relativeWeekName } from './weekLabels';
import { ChevronIcon } from './ChevronIcon';
import { WeekActionsSheet } from './WeekActionsSheet';
import styles from './WeekHeader.module.css';

type WeekHeaderProps = {
    /** the week being viewed, a Monday */
    weekStart: DateKey;
    today: DateKey;
    /** weighted effort for the viewed week */
    progress: Progress;
    /** whether the viewed week's plan may be relabelled onto another week at all */
    canMove: boolean;
    /** whether the viewed week is the one the queue will let you end */
    canEnd: boolean;
    /** the week is frozen in the archive: nothing below it can change */
    ended?: boolean;
    /** why the week reads as it does; omitted on an ordinary live current week */
    note?: ReactNode;
    /** earliest week the arrows may reach */
    minWeekStart: DateKey;
    /** latest week the arrows may reach, as a destination or as a view */
    maxWeekStart: DateKey;
    /** why `weekStart` cannot receive the moved work, or undefined if it can */
    destinationBlockedReason: (weekStart: DateKey) => string | undefined;
    onView: (weekStart: DateKey) => void;
    /** commit: take the work on `from` and put it on `to` */
    onMoveWork: (from: DateKey, to: DateKey) => void;
    onEndWeek: () => void;
    /** un-end the viewed week, putting it back on the live board */
    onReopenWeek: () => void;
};

/**
 * The plan view's header: which week you are looking at, how far through it you
 * are, what you can do to it, and a line of prose saying why.
 *
 * One block rather than the two rows it replaces — the gauge is the block's
 * baseline, spanning the full width, and the note underneath explains the state
 * the buttons can only signal by being grey. Below the container's narrow
 * breakpoint the two actions collapse into one control that opens
 * WeekActionsSheet; the arrows, the readout and Today never change.
 */
export function WeekHeader({
    weekStart,
    today,
    progress,
    canMove,
    canEnd,
    ended,
    note,
    minWeekStart,
    maxWeekStart,
    destinationBlockedReason,
    onView,
    onMoveWork,
    onEndWeek,
    onReopenWeek,
}: WeekHeaderProps) {
    // null = idle; a DateKey = armed, aimed at that week. One value carries both
    // "are we moving" and "where to", so the two can never disagree.
    const [destination, setDestination] = useState<DateKey | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const armed = destination !== null;

    // DateKey is zero-padded YYYY-MM-DD, so string order is chronological.
    const currentWeek = addWeeks(weekStart, -weeksBetween(weekStart, today));

    // While armed the stepper aims the destination instead of the viewed week —
    // which is why the whole block changes colour first. It starts aimed at the
    // source, so the first arrow press in EITHER direction is the first real
    // choice; committing is dead until one is made.
    const shown = destination ?? weekStart;
    const aimedAtSource = destination === weekStart;
    const pct = Math.round(percentOf(progress.done, progress.total));

    // Only a real, off-source destination can be blocked — aimedAtSource has
    // its own message below, and the source itself is never the problem
    // (canMove already gated whether arming was possible at all).
    const blockedReason = armed && !aimedAtSource ? destinationBlockedReason(shown) : undefined;

    function step(delta: number) {
        const next = addWeeks(shown, delta);
        if (next < minWeekStart || next > maxWeekStart) return;
        if (armed) setDestination(next);
        else onView(next);
    }

    function handleToday() {
        if (armed) setDestination(null);
        else onView(currentWeek);
    }

    function handleMove() {
        if (destination === null) {
            setDestination(weekStart);
            return;
        }
        onMoveWork(weekStart, destination);
        setDestination(null);
    }

    const moveLabel = armed
        ? aimedAtSource
            ? 'Pick a week to move this work onto'
            : blockedReason
              ? `Cannot move here: ${blockedReason}`
              : `Move this week's work onto ${weekRangeLabel(shown)}`
        : canMove
          ? "Move this week's work to another week"
          : "This week's work cannot be moved";

    // While armed the block speaks for itself and outranks whatever the caller
    // had to say about the week underneath.
    const shownNote = armed
        ? aimedAtSource
            ? 'The arrows now pick where this work goes.'
            : (blockedReason ?? `Move this week's work onto ${weekRangeLabel(shown)}.`)
        : note;

    return (
        <>
            <div
                className={styles.head}
                data-mode={armed ? 'armed' : ended ? 'ended' : undefined}
                data-armed={armed}
            >
                <div className={styles.nav}>
                    <button
                        type="button"
                        className={`${styles.arrow} ${styles.prev}`}
                        onClick={() => step(-1)}
                        disabled={shown <= minWeekStart}
                        aria-label={armed ? 'Earlier destination' : 'Previous week'}
                    >
                        <ChevronIcon dir="left" />
                    </button>
                    <span className={styles.read}>
                        <span className={styles.name} data-now={!armed && shown === currentWeek}>
                            {armed ? 'Move to' : relativeWeekName(shown, today)}
                        </span>
                        <span className={styles.date}>{weekRangeLabel(shown)}</span>
                    </span>
                    <button
                        type="button"
                        className={styles.arrow}
                        onClick={() => step(1)}
                        disabled={shown >= maxWeekStart}
                        aria-label={armed ? 'Later destination' : 'Next week'}
                    >
                        <ChevronIcon dir="right" />
                    </button>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.ghost} ${styles.today}`}
                        onClick={handleToday}
                        disabled={!armed && weekStart === currentWeek}
                        title={
                            armed
                                ? 'Leave move mode, change nothing'
                                : 'Jump back to the current week'
                        }
                    >
                        {armed ? 'Cancel' : 'Today'}
                    </button>
                </div>

                {/* All three actions are always in the DOM; the container query
                    decides which are shown, the same way the tab bar swaps ends
                    of the screen without changing its markup. */}
                <div className={styles.acts}>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.move}`}
                        onClick={handleMove}
                        disabled={armed ? aimedAtSource || blockedReason !== undefined : !canMove}
                        // the visible label abbreviates to "Move → Aug 03"; spell
                        // it out for the accessible name rather than leaving that
                        // to collapse
                        aria-label={moveLabel}
                        title={moveLabel}
                    >
                        {armed ? `Move → ${monthAndDay(shown)}` : 'Move work'}
                    </button>
                    {/* One slot, two jobs: an ended week's only whole-week action
                        is getting it back, so Reopen takes End week's place rather
                        than sitting beside it as a second permanent button. The
                        two labels are held to one width (see .end in the CSS) so
                        the row does not reflow as you step across the boundary. */}
                    <button
                        type="button"
                        className={`${styles.btn} ${ended ? styles.reopen : styles.end}`}
                        onClick={ended ? onReopenWeek : onEndWeek}
                        // Dead while armed: a move in progress is a modal state,
                        // and archiving the week out from under it would commit
                        // one decision while another is still being aimed.
                        disabled={armed || (!ended && !canEnd)}
                    >
                        {ended ? 'Reopen…' : 'End week'}
                    </button>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.manage}`}
                        onClick={() => setSheetOpen(true)}
                        // An ended week has exactly one action left, and it is
                        // in the sheet — so this stays live for it.
                        disabled={!canMove && !canEnd && !ended}
                    >
                        Manage
                    </button>
                </div>

                <div className={styles.gauge}>
                    <span className={styles.track}>
                        <span className={styles.fill} style={{ width: `${pct}%` }} />
                    </span>
                    <span className={styles.pct}>
                        <span className={styles.count}>
                            {progress.done}/{progress.total} ·{' '}
                        </span>
                        {pct}%
                    </span>
                </div>

                {shownNote && <p className={styles.note}>{shownNote}</p>}
            </div>

            {sheetOpen && (
                <WeekActionsSheet
                    weekLabel={weekRangeLabel(weekStart)}
                    canMove={canMove}
                    canEnd={canEnd}
                    ended={ended}
                    onClose={() => setSheetOpen(false)}
                    // Both handlers dismiss the sheet FIRST and then do the thing,
                    // so at most one layer is ever open: arming just changes this
                    // block, and ending hands off to the confirm dialog with the
                    // sheet already gone.
                    onMove={() => {
                        setSheetOpen(false);
                        handleMove();
                    }}
                    onEnd={() => {
                        setSheetOpen(false);
                        onEndWeek();
                    }}
                    onReopen={() => {
                        setSheetOpen(false);
                        onReopenWeek();
                    }}
                />
            )}
        </>
    );
}

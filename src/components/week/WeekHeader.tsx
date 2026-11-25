import { useState, type ReactNode } from 'react';
import type { DateKey } from '@/core/types';
import type { Progress } from '@/core/progress';
import { percentOf } from '@/core/math';
import { addWeeks, weeksBetween } from '@/core/dates';
import { monthAndDay, weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { relativeWeekName } from './weekLabels';
import { ChevronIcon } from '@/components/shared/icons/ChevronIcon';
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
    /** the week holds work and is not frozen — nothing else can be cleared */
    canClear: boolean;
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
    /** hand off to the clear-board confirm */
    onClearBoard: () => void;
};

/** The plan view's header: which week you are looking at, how far through it you are, and what you can do to it. */
export function WeekHeader({
    weekStart,
    today,
    progress,
    canMove,
    canEnd,
    canClear,
    ended,
    note,
    minWeekStart,
    maxWeekStart,
    destinationBlockedReason,
    onView,
    onMoveWork,
    onEndWeek,
    onReopenWeek,
    onClearBoard,
}: WeekHeaderProps) {
    const { locale } = useLocale();
    const { common, weekHeader, weekLabels } = useCopy();
    // null = idle; a DateKey = armed, aimed at that week.
    const [destination, setDestination] = useState<DateKey | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const armed = destination !== null;

    // DateKey is zero-padded YYYY-MM-DD, so string order is chronological.
    const currentWeek = addWeeks(weekStart, -weeksBetween(weekStart, today));

    // While armed the stepper aims the destination; committing is dead until an arrow has moved it off the source.
    const shown = destination ?? weekStart;
    const aimedAtSource = destination === weekStart;
    const pct = Math.round(percentOf(progress.done, progress.total));

    // Only a real, off-source destination can be blocked: aimedAtSource has its
    // own message below, and canMove already gated arming on the source.
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
            ? weekHeader.pickDestination
            : blockedReason
              ? weekHeader.blocked(blockedReason)
              : weekHeader.moveOnto(weekRangeLabel(shown, locale))
        : canMove
          ? weekHeader.canMove
          : weekHeader.cannotMove;

    const shownNote = armed
        ? aimedAtSource
            ? weekHeader.armedHint
            : (blockedReason ?? weekHeader.moveOntoNote(weekRangeLabel(shown, locale)))
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
                        aria-label={armed ? weekHeader.prevDestination : weekHeader.prevWeek}
                    >
                        <ChevronIcon dir="left" />
                    </button>
                    <span className={styles.read}>
                        <span className={styles.name} data-now={!armed && shown === currentWeek}>
                            {armed ? weekHeader.moveTo : relativeWeekName(shown, today, weekLabels)}
                        </span>
                        <span className={styles.date}>{weekRangeLabel(shown, locale)}</span>
                    </span>
                    <button
                        type="button"
                        className={styles.arrow}
                        onClick={() => step(1)}
                        disabled={shown >= maxWeekStart}
                        aria-label={armed ? weekHeader.nextDestination : weekHeader.nextWeek}
                    >
                        <ChevronIcon dir="right" />
                    </button>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.ghost} ${styles.today}`}
                        onClick={handleToday}
                        disabled={!armed && weekStart === currentWeek}
                        title={armed ? weekHeader.cancelTitle : weekHeader.todayTitle}
                    >
                        {armed ? common.cancel : weekHeader.today}
                    </button>
                </div>

                {/* All three actions are always in the DOM; the container query
                    decides which are shown. */}
                <div className={styles.acts}>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.move}`}
                        onClick={handleMove}
                        disabled={armed ? aimedAtSource || blockedReason !== undefined : !canMove}
                        // the visible label abbreviates to "Move → Aug 03"
                        aria-label={moveLabel}
                        title={moveLabel}
                    >
                        {armed
                            ? weekHeader.moveToDate(monthAndDay(shown, locale))
                            : weekHeader.moveWork}
                    </button>
                    {/* One slot, two jobs: Reopen takes End week's place on an ended week. */}
                    <button
                        type="button"
                        className={`${styles.btn} ${ended ? styles.reopen : styles.end}`}
                        onClick={ended ? onReopenWeek : onEndWeek}
                        // Dead while armed: ending would archive the week out
                        // from under a move still being aimed.
                        disabled={armed || (!ended && !canEnd)}
                    >
                        {ended ? weekHeader.reopen : weekHeader.endWeek}
                    </button>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.manage}`}
                        onClick={() => setSheetOpen(true)}
                        // An ended week has exactly one action left, and it is
                        // in the sheet — so this stays live for it.
                        disabled={!canMove && !canEnd && !ended && !canClear}
                    >
                        {weekHeader.manage}
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
                    weekLabel={weekRangeLabel(weekStart, locale)}
                    canMove={canMove}
                    canEnd={canEnd}
                    ended={ended}
                    onClose={() => setSheetOpen(false)}
                    // Every handler dismisses the sheet FIRST, so at most one
                    // layer is ever open.
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
                    canClear={canClear}
                    onClear={() => {
                        setSheetOpen(false);
                        onClearBoard();
                    }}
                />
            )}
        </>
    );
}

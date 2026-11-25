import type { DateKey, WeekPlan, WeekStanding } from '@/core/types';
import { overallProgress, progressByDay } from '@/core/progress';
import { percentOf } from '@/core/math';
import { WeekSpark } from '@/components/shared/WeekSpark';
import { weekdayColumns, withDayStatus } from '@/components/shared/sparkColumns';
import { CopyIcon } from '@/components/shared/icons/CopyIcon';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import { useCopy, useLocale } from '@/i18n/localeContext';
import styles from './WeekRow.module.css';

type WeekRowProps = {
    entry: WeekPlan;
    standing: WeekStanding;
    label: string;
    /** today, for placing the week's days against it. Ignored on an ended week. */
    today: DateKey;
    onOpen: () => void;
    onCopy: () => void;
    onDelete: () => void;
};

/** One week in the list, in whichever of the four standings it is in. */
export function WeekRow({ entry, standing, label, today, onOpen, onCopy, onDelete }: WeekRowProps) {
    const { locale } = useLocale();
    const { weekRow, common } = useCopy();
    const overall = overallProgress(entry.projects);
    const pct = Math.round(percentOf(overall.done, overall.total));
    const columns = weekdayColumns(progressByDay(entry.projects), locale);
    // An ended week is a closed record: nothing more will land in it, so its
    // unlived days are not "not yet" and are drawn like any other.
    const days = standing === 'ended' ? columns : withDayStatus(columns, entry.weekStart, today);

    return (
        <div
            className={`${styles.row} ${standing === 'live' ? styles.live : ''}`}
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen();
                }
            }}
            aria-label={weekRow.open(label)}
        >
            <div className={styles.pline1}>
                <span className={styles.when}>
                    <span className={styles.date}>{label}</span>
                    <span className={`${styles.sub} ${standing === 'live' ? styles.now : ''}`}>
                        {standing === 'ended'
                            ? common.doneOf(overall.done, overall.total)
                            : standing === 'live'
                              ? weekRow.thisWeek
                              : standing === 'upcoming'
                                ? weekRow.upcoming
                                : weekRow.notEnded}
                    </span>
                </span>
                <span className={styles.stat}>
                    {standing === 'ended' ? (
                        <>
                            <span className={styles.pctBig}>{pct}%</span>
                            <span className={styles.cap}>{weekRow.complete}</span>
                        </>
                    ) : standing === 'live' ? (
                        <>
                            <span className={styles.figInk}>
                                {overall.done}
                                <span className={styles.of}>/{overall.total}</span>
                            </span>
                            <span className={styles.cap}>{weekRow.done}</span>
                        </>
                    ) : standing === 'upcoming' && overall.done === 0 ? (
                        <>
                            <span className={styles.figMuted}>{overall.total}</span>
                            <span className={styles.cap}>{weekRow.planned}</span>
                        </>
                    ) : standing === 'upcoming' ? (
                        // The figure counts rather than reporting a total the chart contradicts.
                        <>
                            <span className={styles.figInk}>
                                {overall.done}
                                <span className={styles.of}>/{overall.total}</span>
                            </span>
                            <span className={styles.cap}>{weekRow.done}</span>
                        </>
                    ) : (
                        <>
                            <span className={styles.figInk}>{pct}%</span>
                            <span className={styles.cap}>{weekRow.done}</span>
                        </>
                    )}
                </span>
            </div>
            <div className={styles.pline2}>
                <WeekSpark columns={days} className={styles.spark} />
                {/* Siblings of the row's own click target, not nested inside it —
                    stopPropagation keeps their clicks from also opening the row. */}
                <span className={styles.actions}>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy();
                        }}
                        aria-label={weekRow.copy(label)}
                    >
                        <CopyIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        aria-label={weekRow.remove(label)}
                    >
                        <CloseIcon />
                    </button>
                </span>
            </div>
        </div>
    );
}

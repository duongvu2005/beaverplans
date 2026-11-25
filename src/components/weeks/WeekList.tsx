import { useState } from 'react';
import type { DateKey, Project, WeekPlan, Weeks } from '@/core/types';
import { removeWeek, upcomingWeeks, weekStandingOf } from '@/core/weeks';
import { weekStartOfKey } from '@/core/dates';
import { weekRangeLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { printProjects } from '@/storage/weekClipboard';
import { WeekRow } from './WeekRow';
import { UpcomingWeeks } from './UpcomingWeeks';
import { WeekQuickLook } from './WeekQuickLook';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CopyPlanDialog } from '@/components/shared/CopyPlanDialog';
import { CopyTextDialog } from '@/components/shared/CopyTextDialog';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './WeekList.module.css';

// A week files under the year of its Monday, so one straddling New Year sits
// under the older year.
function yearOf(weekStart: DateKey): string {
    return weekStart.slice(0, 4);
}

// How many weeks a year's future needs before it collapses into one row.
// Collapsing one row into one row buys nothing; two and up is worth a row.
const COLLAPSE_FROM = 2;

/** One row of the list: a single week, or the collapsed stand-in for a year's weeks still to come. */
type ListItem =
    | { readonly kind: 'week'; readonly year: string; readonly entry: WeekPlan }
    | { readonly kind: 'upcoming'; readonly year: string; readonly weeks: Weeks };

// Ascending weeks to ascending year groups. Weeks in a group stay ascending.
function byYear(weeks: Weeks): ReadonlyArray<{ year: string; weeks: Weeks }> {
    const groups: Array<{ year: string; weeks: WeekPlan[] }> = [];
    for (const week of weeks) {
        const year = yearOf(week.weekStart);
        const last = groups[groups.length - 1];
        if (last !== undefined && last.year === year) last.weeks.push(week);
        else groups.push({ year, weeks: [week] });
    }
    return groups;
}

type WeekListProps = {
    weeks: Weeks;
    /** The DateKey of today: the only clock this pane reads. */
    today: DateKey;
    onChange: (updater: (current: Weeks) => Weeks) => void;
    /** show one week on the plan board (switches tab as well as week) */
    onOpenWeek: (weekStart: DateKey) => void;
};

/** Every week the planner knows about, newest first, in one list. */
export function WeekList({ weeks, today, onChange, onOpenWeek }: WeekListProps) {
    const { locale } = useLocale();
    const { weekList, common } = useCopy();
    const currentWeek = weekStartOfKey(today);
    const [opened, setOpened] = useState<WeekPlan | null>(null);
    const [copying, setCopying] = useState<WeekPlan | null>(null);
    const [removing, setRemoving] = useState<WeekPlan | null>(null);
    const [clearingAll, setClearingAll] = useState(false);
    /** the text to select by hand, set only when the browser refused the write */
    const [manualCopy, setManualCopy] = useState<string | null>(null);

    // The weeks still to come collapse per YEAR, so a year heading can sit above everything filed under it.
    const upcoming = [...byYear(upcomingWeeks(weeks, currentWeek))]
        .reverse()
        .flatMap<ListItem>(({ year, weeks: ofYear }) =>
            ofYear.length >= COLLAPSE_FROM
                ? [{ kind: 'upcoming', year, weeks: ofYear }]
                : // newest-first, like the rest of the list — a year group is
                  // ascending, and below the threshold its weeks are shown whole
                  [...ofYear].reverse().map((entry) => ({ kind: 'week', year, entry })),
        );

    // weeks is sorted ascending (Weeks' rep invariant), so newest-first is a
    // plain reverse, not a sort.
    const lived = weeks
        .filter((week) => week.weekStart <= currentWeek)
        .reverse()
        .map<ListItem>((entry) => ({ kind: 'week', year: yearOf(entry.weekStart), entry }));

    const items = [...upcoming, ...lived];
    const rows = items.map((item, i) => ({
        item,
        startsYear: i === 0 || items[i - 1]?.year !== item.year,
    }));

    function handleConfirmDelete() {
        if (!removing) return;
        const { weekStart } = removing;
        onChange((current) => removeWeek(current, weekStart));
        setRemoving(null);
    }

    function handleConfirmClearAll() {
        onChange(() => []);
        setClearingAll(false);
    }

    async function handleCopy(projects: ReadonlyArray<Project>) {
        if (!copying) return;
        const text = printProjects(copying.weekStart, projects);
        setCopying(null);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            setManualCopy(text);
        }
    }

    if (weeks.length === 0) {
        return (
            <div className={styles.board}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{weekList.emptyTitle}</p>
                    <p className={styles.emptyText}>{weekList.emptyText}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.board}>
            <div className={styles.head}>
                <span className={styles.count}>{weekList.weekCount(weeks.length)}</span>
                <button
                    type="button"
                    className={styles.clearAll}
                    onClick={() => setClearingAll(true)}
                >
                    <span className={styles.clearIcon} aria-hidden="true">
                        ×
                    </span>
                    {weekList.clearAll}
                </button>
            </div>
            <div className={styles.list}>
                {rows.map(({ item, startsYear }) => (
                    <div
                        key={item.kind === 'week' ? item.entry.weekStart : `ahead-${item.year}`}
                        className={styles.group}
                    >
                        {startsYear && <h3 className={styles.year}>{item.year}</h3>}
                        {item.kind === 'upcoming' ? (
                            <UpcomingWeeks
                                weeks={item.weeks}
                                today={today}
                                onOpen={setOpened}
                                onCopy={setCopying}
                                onDelete={setRemoving}
                            />
                        ) : (
                            <WeekRow
                                entry={item.entry}
                                standing={weekStandingOf(item.entry, today)}
                                label={weekRangeLabel(item.entry.weekStart, locale)}
                                today={today}
                                onOpen={() => setOpened(item.entry)}
                                onCopy={() => setCopying(item.entry)}
                                onDelete={() => setRemoving(item.entry)}
                            />
                        )}
                    </div>
                ))}
            </div>
            {opened && (
                <WeekQuickLook
                    entry={opened}
                    label={weekRangeLabel(opened.weekStart, locale)}
                    onClose={() => setOpened(null)}
                    onView={() => {
                        setOpened(null);
                        onOpenWeek(opened.weekStart);
                    }}
                />
            )}
            {copying && (
                <CopyPlanDialog
                    projects={copying.projects}
                    eyebrow={weekList.eyebrow}
                    title={weekList.copyTitle(weekRangeLabel(copying.weekStart, locale))}
                    onClose={() => setCopying(null)}
                    onCopy={(projects) => void handleCopy(projects)}
                />
            )}
            {manualCopy !== null && (
                <CopyTextDialog
                    eyebrow={weekList.eyebrow}
                    text={manualCopy}
                    onClose={() => setManualCopy(null)}
                />
            )}
            {removing && (
                <ConfirmDialog
                    eyebrow={weekList.eyebrow}
                    title={weekList.deleteTitle(weekRangeLabel(removing.weekStart, locale))}
                    confirmLabel={common.delete}
                    confirmTone="danger"
                    onConfirm={handleConfirmDelete}
                    onClose={() => setRemoving(null)}
                >
                    <p className={shell.text}>{weekList.deleteBody}</p>
                </ConfirmDialog>
            )}
            {clearingAll && (
                <ConfirmDialog
                    eyebrow={weekList.eyebrow}
                    title={weekList.clearAllTitle}
                    confirmLabel={weekList.clearAllConfirm}
                    confirmTone="danger"
                    requireTyped={{ value: String(weeks.length) }}
                    onConfirm={handleConfirmClearAll}
                    onClose={() => setClearingAll(false)}
                >
                    <p className={shell.text}>{weekList.clearAllBody(weeks.length)}</p>
                </ConfirmDialog>
            )}
        </div>
    );
}

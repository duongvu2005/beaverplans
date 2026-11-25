/**
 * Pure operations on Weeks, the collection of every week the planner knows about
 * (see the ADT writeup on Weeks in types.ts). Weeks abstracts a map from a
 * week-start Monday to that week's plan.
 *
 * Three rules run through the whole file:
 *   - An untouched week is EMPTY, not missing. weekAt is total — it answers for
 *     every week, stored or not — and putWeek stores no entry for an empty plan.
 *   - An ended week is frozen. No producer here writes to one; only removeWeek
 *     can discard it whole.
 *   - Producers are total. An operation whose arguments do not describe
 *     something it can do returns the collection unchanged rather than throwing.
 *
 * Everything that depends on where "now" is takes currentWeek — the week-start of
 * the week containing today — as an argument rather than reading the clock.
 */

import { isValidWeekStart, weekStatusOf } from './dates';
import { idsOf, isTaskDone, isValidPlan } from './projects';
import type { DateKey, Project, WeekPlan, WeekStanding, Weeks } from './types';

// Observers

/**
 * Whether a week holds nothing worth storing.
 *
 * @param plan any plan
 * @returns true iff the plan has no projects
 */
export function isEmptyWeek(plan: WeekPlan): boolean {
    return plan.projects.length === 0;
}

/**
 * Whether a week has been ended, and so belongs to the archive.
 *
 * @param plan any plan
 * @returns plan.ended
 */
export function isEnded(plan: WeekPlan): boolean {
    return plan.ended;
}

/**
 * The plan for one week.
 *
 * @param weeks any Weeks
 * @param weekStart the week to read, a DateKey that is a Monday
 * @returns the entry stored for weekStart, or — when no entry is stored — an
 *          empty, un-ended plan for that week. An untouched week is empty, not
 *          missing, so this never fails to answer.
 */
export function weekAt(weeks: Weeks, weekStart: DateKey): WeekPlan {
    return (
        weeks.find((week) => week.weekStart === weekStart) ?? {
            weekStart,
            ended: false,
            projects: [],
        }
    );
}

/**
 * The archive: the weeks that have been ended.
 *
 * @param weeks any Weeks
 * @returns the entries of weeks with ended true, in the same relative order — so
 *          the result is itself sorted ascending by weekStart
 */
export function endedWeeks(weeks: Weeks): Weeks {
    return weeks.filter(isEnded);
}

/**
 * Where a week stands, for a list that shows ended and active weeks together.
 *
 * weekStatusOf answers on time alone; this folds in the ended flag, which is
 * what separates a week you closed out from one you simply lived through.
 *
 * @param plan any plan
 * @param today the DateKey of today
 * @returns 'ended' when plan.ended, whatever the date — a week ended early is
 *          still ended, and the model cannot produce an ended future week
 *          anyway. Otherwise by position: 'live' for the week containing today,
 *          'upcoming' for one still to come, 'open' for one lived through and
 *          never ended.
 */
export function weekStandingOf(plan: WeekPlan, today: DateKey): WeekStanding {
    if (isEnded(plan)) return 'ended';
    const status = weekStatusOf(plan.weekStart, today);
    if (status === 'current') return 'live';
    return status === 'future' ? 'upcoming' : 'open';
}

/**
 * The weeks that are still to come.
 *
 * Not necessarily consecutive: an untouched week is stored as nothing, so a
 * future with gaps in it is ordinary rather than exceptional.
 *
 * @param weeks any Weeks
 * @param currentWeek the week-start of the week containing today, a Monday
 * @returns the entries starting strictly after currentWeek, in the same relative
 *          order — so the result is itself sorted ascending by weekStart
 */
export function upcomingWeeks(weeks: Weeks, currentWeek: DateKey): Weeks {
    return weeks.filter((week) => week.weekStart > currentWeek);
}

/**
 * The oldest week still waiting to be ended, if any. NOT the week the app opens
 * on — that is always the literal current week; this only feeds the nudge.
 *
 * @param weeks any Weeks
 * @param currentWeek the week-start of the week containing today, a Monday
 * @returns the weekStart of the earliest active (not ended) entry that is not in
 *          the future, or undefined when there is none — because every entry is
 *          ended, every active entry is still to come, or nothing is stored
 */
export function earliestActiveWeek(weeks: Weeks, currentWeek: DateKey): DateKey | undefined {
    // weeks is sorted ascending, so the first match is the earliest.
    const waiting = weeks.find((week) => !isEnded(week) && week.weekStart <= currentWeek);
    return waiting?.weekStart;
}

/**
 * Whether a week may be ended. An older week still open does not block a newer
 * one; earliestActiveWeek does not gate this.
 *
 * @param weeks any Weeks
 * @param weekStart the week in question
 * @param currentWeek the week-start of the week containing today, a Monday
 * @returns true iff all of: weeks holds an entry at weekStart, that entry is not
 *          already ended, and weekStart is no later than currentWeek — a week you
 *          have not lived cannot be closed out
 */
export function canEndWeek(weeks: Weeks, weekStart: DateKey, currentWeek: DateKey): boolean {
    const plan = weekAt(weeks, weekStart);
    return !isEmptyWeek(plan) && !isEnded(plan) && weekStart <= currentWeek;
}

/**
 * Check whether a collection of weeks is well-formed. This is Weeks' checkRep
 * (see types.ts) and also the validator for untrusted stored JSON.
 *
 * @param weeks any Weeks
 * @returns true iff all of:
 *          - weekStart strictly increases from each entry to the next, which
 *            forbids both a wrong order and two entries for the same week
 *          - no entry is empty (isEmptyWeek)
 *          - every entry is a valid plan (isValidPlan)
 *          - no id appears twice across the whole collection, not merely twice
 *            within one entry
 *          Ended and active entries may interleave in any order: an ended week's
 *          position carries no meaning beyond its own weekStart.
 */
export function isValidWeeks(weeks: Weeks): boolean {
    for (const [index, week] of weeks.entries()) {
        const previous = weeks[index - 1];
        if (previous !== undefined && previous.weekStart >= week.weekStart) {
            return false;
        }
        if (isEmptyWeek(week) || !isValidPlan(week)) {
            return false;
        }
    }
    const allIds = weeks.flatMap(idsOf);
    return allIds.length === new Set(allIds).size;
}

// Producers

/**
 * Store a plan as its week's entry.
 *
 * The one place Weeks' rep invariant is maintained, and the chokepoint every
 * edit to a week's tree passes through — so the ended guard here freezes an
 * ended week against every producer in projects.ts at once.
 *
 * @param weeks any Weeks
 * @param plan the plan to store, under its own weekStart
 * @returns a new collection identical to weeks except at plan.weekStart, where:
 *          the entry is plan if the plan has projects, and there is no entry if it
 *          has none — so storing an empty plan deletes that week. Every other entry
 *          is unchanged and shared by reference. When weeks already holds an ENDED
 *          entry at plan.weekStart the collection is returned unchanged, including
 *          when plan is empty: an ended week can be neither rewritten nor pruned
 *          out of existence. endWeek sets the flag by other means.
 */
export function putWeek(weeks: Weeks, plan: WeekPlan): Weeks {
    if (isEnded(weekAt(weeks, plan.weekStart))) {
        return weeks;
    }
    return writeWeek(weeks, plan);
}

/**
 * putWeek without the ended guard: the raw upsert-and-prune. Only the producers
 * that set the flag itself may write to an ended week through this.
 */
function writeWeek(weeks: Weeks, plan: WeekPlan): Weeks {
    const rest = weeks.filter((week) => week.weekStart !== plan.weekStart);
    if (isEmptyWeek(plan)) {
        return rest;
    }
    const following = rest.findIndex((week) => week.weekStart > plan.weekStart);
    const at = following === -1 ? rest.length : following;
    return [...rest.slice(0, at), plan, ...rest.slice(at)];
}

/**
 * Delete a week's entry.
 *
 * @param weeks any Weeks
 * @param weekStart the week to delete
 * @returns a new collection holding every entry of weeks except one whose
 *          weekStart is weekStart, in the same relative order; equal in contents
 *          to weeks when no entry has that weekStart
 */
export function removeWeek(weeks: Weeks, weekStart: DateKey): Weeks {
    return weeks.filter((week) => week.weekStart !== weekStart);
}

/**
 * Empty a week's board, keeping the week itself. A stored entry is never empty,
 * so this leaves no entry behind; unlike removeWeek it is refused on an ended one.
 *
 * @param weeks any Weeks
 * @param weekStart the week to empty
 * @returns a new collection identical to weeks but with no entry at weekStart;
 *          or weeks unchanged when that entry is ended
 */
export function clearWeek(weeks: Weeks, weekStart: DateKey): Weeks {
    return putWeek(weeks, { ...weekAt(weeks, weekStart), projects: [] });
}

/**
 * Relabel a week: move a whole plan onto a different week, unchanged.
 *
 * Nothing is stripped on the way: missedDays name weekdays rather than dates, so
 * the whole week's frame travels with the plan and only the label changes.
 *
 * @param weeks any Weeks
 * @param from the week whose plan is moving
 * @param to the week it should move to; may be earlier or later than from
 * @returns a new collection in which from has no entry and to's entry is from's
 *          plan with weekStart set to to, everything else about it unchanged. The
 *          collection is returned unchanged when the move is not one the model
 *          allows: from holds no work, from has been ended (an ended week is
 *          frozen), to already holds work, or to is not a valid week-start.
 */
export function moveWeek(weeks: Weeks, from: DateKey, to: DateKey): Weeks {
    const source = weekAt(weeks, from);
    // A stored entry is never empty, so this also rejects an ended destination
    // and the case to === from.
    const destinationTaken = !isEmptyWeek(weekAt(weeks, to));
    if (isEmptyWeek(source) || isEnded(source) || destinationTaken || !isValidWeekStart(to)) {
        return weeks;
    }
    return putWeek(removeWeek(weeks, from), { ...source, weekStart: to });
}

/**
 * Close a week out: record it in the archive exactly as it stands, finished and
 * unfinished work alike. Carrying the unfinished part onward is a separate step
 * (carryForward), which copies — this entry is never edited again.
 *
 * @param weeks any Weeks
 * @param weekStart the week to end
 * @param currentWeek the week-start of the week containing today, a Monday
 * @returns a new collection identical to weeks except that the entry at weekStart
 *          has ended true, or weeks unchanged when canEndWeek(weeks, weekStart,
 *          currentWeek) is false
 */
export function endWeek(weeks: Weeks, weekStart: DateKey, currentWeek: DateKey): Weeks {
    if (!canEndWeek(weeks, weekStart, currentWeek)) {
        return weeks;
    }
    return writeWeek(weeks, { ...weekAt(weeks, weekStart), ended: true });
}

/**
 * Re-open an ended week, putting it back on the live board. The mirror of
 * endWeek, with no gate beyond the flag: every ended week is one already lived.
 *
 * @param weeks any Weeks
 * @param weekStart the week to re-open
 * @returns a new collection identical to weeks except that the entry at
 *          weekStart has ended false and every other field of it unchanged;
 *          or weeks unchanged when there is no entry at weekStart or its
 *          entry is not ended
 */
export function reopenWeek(weeks: Weeks, weekStart: DateKey): Weeks {
    const week = weekAt(weeks, weekStart);
    if (!isEnded(week)) return weeks;
    return writeWeek(weeks, { ...week, ended: false });
}

/**
 * Copy a week's unfinished work onto a later week.
 *
 * The source is left untouched, so an ended week may be carried from. Both copies
 * then exist at once, which is why every carried node is given a new id; a miss
 * names a weekday slot, which is why missedDays is cleared rather than carried
 * into a week with its own separate Tuesday.
 *
 * @param weeks any Weeks
 * @param from the week whose unfinished work is being carried
 * @param to the destination week; a valid week-start strictly later than from
 * @param newId a factory returning a fresh unique id on each call. Not
 *        deterministic.
 * @returns a new collection identical to weeks except at to, whose entry becomes
 *          its existing projects followed by a copy of from's unfinished ones —
 *          each project keeping only its undone tasks, each of those keeping only
 *          its undone subtasks with missedDays cleared, and a project left with no
 *          task dropped. Every copied project, task and subtask carries a new id;
 *          all their other fields are unchanged. Projects are appended, never
 *          matched against the ones already there, so two same-named projects may
 *          end up side by side. weeks is returned unchanged when to is not a valid
 *          week-start, is not strictly later than from, or is ended, and when from
 *          has no unfinished work to carry.
 */
export function carryForward(weeks: Weeks, from: DateKey, to: DateKey, newId: () => string): Weeks {
    const destination = weekAt(weeks, to);
    if (!isValidWeekStart(to) || to <= from || isEnded(destination)) {
        return weeks;
    }
    const carried = unfinishedProjects(weekAt(weeks, from), newId);
    if (carried.length === 0) {
        return weeks;
    }
    return putWeek(weeks, {
        ...destination,
        projects: [...destination.projects, ...carried],
    });
}

/**
 * The undone half of a plan's work, re-identified so it can coexist with the
 * original. See carryForward, its only caller, for what "undone" keeps.
 */
function unfinishedProjects(plan: WeekPlan, newId: () => string): ReadonlyArray<Project> {
    const carried: Project[] = [];
    for (const project of plan.projects) {
        // Filter before minting, so a project that turns out to be fully done
        // consumes no ids on its way to being dropped.
        const tasks = project.tasks
            .filter((task) => !isTaskDone(task))
            .map((task) => ({
                ...task,
                id: newId(),
                subtasks: task.subtasks
                    .filter((subtask) => !subtask.isDone)
                    .map((subtask) => ({ ...subtask, id: newId(), missedDays: [] })),
            }));
        if (tasks.length > 0) {
            carried.push({ ...project, id: newId(), tasks });
        }
    }
    return carried;
}

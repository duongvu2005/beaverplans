/**
 * Pure operations on Weeks, the collection of every week the planner knows about
 * (see the ADT writeup on Weeks in types.ts). Weeks abstracts a map from a
 * week-start Monday to that week's plan, so the vocabulary here is map
 * vocabulary: weekAt reads, putWeek writes, removeWeek deletes.
 *
 * Three rules run through the whole file:
 *   - An untouched week is EMPTY, not missing. weekAt is total — it answers for
 *     every week, stored or not — and putWeek stores no entry for an empty plan.
 *     Together these make a week you merely looked at leave no trace.
 *   - An ended week is frozen. No producer here writes to one, so the archived
 *     record of a week cannot be rewritten after the fact; only removeWeek can
 *     discard it whole. See the Weeks writeup in types.ts.
 *   - Producers are total. Following projects.ts, an operation whose arguments do
 *     not describe something it can do returns the collection unchanged rather
 *     than throwing.
 *
 * Everything that depends on where "now" is takes currentWeek — the week-start of
 * the week containing today — as an argument rather than reading the clock.
 */

import { isValidWeekStart } from './dates';
import { idsOf, isTaskDone, isValidPlan } from './projects';
import type { DateKey, Project, WeekPlan, Weeks } from './types';

// Observers

/**
 * Whether a week holds nothing worth storing.
 *
 * Emptiness is judged on projects alone: a project with no tasks is NOT empty,
 * because adding a project is a deliberate act and pruning it would delete work
 * in progress out from under the user.
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
 * The oldest week still waiting to be ended, if any. NOT the week the app
 * opens on — the app always opens on the literal current week regardless of
 * this function's answer; this is what the header note nudges you toward
 * when that queue head isn't the week already on screen.
 *
 * Ending weeks is a queue worked oldest first, and a week that was never touched
 * has no entry, so it cannot block the queue.
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
 * Whether a week may be ended.
 *
 * Any week you have actually lived may be closed out on its own — ending is no
 * longer restricted to the oldest still-open week. earliestActiveWeek remains
 * useful (it names the week worth nudging you toward), it just no longer gates
 * this.
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
 * This is the one place the rep invariant is maintained: it replaces rather than
 * duplicates an existing entry, inserts so that weekStart stays increasing, and
 * stores no entry at all for an empty plan.
 *
 * It is also the single chokepoint through which every edit to a week's tree
 * reaches the collection, which is what lets one guard here freeze every ended
 * week against every producer in projects.ts at once.
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
 * putWeek without the ended guard: the raw upsert-and-prune. Private, because the
 * only writes that may land on an ended week are the ones that set the flag in the
 * first place.
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
 * Relabel a week: move a whole plan onto a different week, unchanged.
 *
 * This is the "this plan belongs on a different week" operation, and it loses
 * nothing. Because missedDays name weekdays rather than dates, the entire week's
 * frame travels together and every subtask's assigned day, recorded misses,
 * completion and id stay exactly as they were. Only the label changes. (Contrast
 * ending a week, which sweeps individual subtasks into a week that has its own
 * separate day structure, and so must strip their misses.)
 *
 * A plan may move out of any week that is still open and onto any free week at
 * all, in either direction and however far, regardless of where the archive sits.
 * The clock does not come into it either — moveWeek does not take currentWeek.
 *
 * The only two refusals left are about frozen records: the source may not be
 * ended, and the destination may not already hold work — which, since a stored
 * entry is never empty, also rejects an ended destination and the case to === from
 * without a separate check.
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
 * Close a week out: record it in the archive exactly as it stands.
 *
 * The entry is frozen whole, finished and unfinished work alike, so the archived
 * week reports what that week actually looked like rather than only its successes.
 * Carrying the unfinished part onward is a separate step (carryForward), which
 * copies rather than moves — this entry is never edited again.
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
 * Re-open an ended week, putting it back on the live board.
 *
 * The mirror of endWeek, and like endWeek it writes through the private upsert
 * rather than putWeek: putWeek's guard exists precisely so that no ordinary
 * producer can touch an ended week, so the flag may only be cleared by
 * something that means to.
 *
 * Unlike ending, this takes no currentWeek and has no gate beyond the flag
 * itself. Ending is refused for a week you have not lived yet; every ended
 * week is by definition one you already lived, so there is nothing left to
 * check.
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
 * The source is left untouched, so this may be applied to a week that has already
 * been ended — which is the point: the record keeps the whole week, and the live
 * board gets a fresh copy of what is left to do. Because both copies then exist at
 * once, every carried node is given a new id, and each carried subtask's
 * missedDays is cleared: a miss names a weekday slot, so carrying it over would be
 * a false claim about the destination week's own Tuesday.
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

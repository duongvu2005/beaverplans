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
 * @returns true iff the plan's ended is true; false when it is false or absent
 */
export function isEnded(plan: WeekPlan): boolean {
    return plan.ended === true;
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
    return weeks.find((week) => week.weekStart === weekStart) ?? { weekStart, projects: [] };
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
 * The last week that has been ended, which is the boundary the archive reaches to.
 *
 * @param weeks any Weeks
 * @returns the weekStart of the latest ended entry, or undefined when none has been
 *          ended. Because the ended entries come first, everything after this week
 *          is still open, and everything at or before it is settled.
 */
export function lastEndedWeek(weeks: Weeks): DateKey | undefined {
    return endedWeeks(weeks).at(-1)?.weekStart;
}

/**
 * Whether a week lies beyond the archive, and so is still yours to plan.
 *
 * @param weeks any Weeks
 * @param weekStart the week in question
 * @returns true iff weekStart is strictly after every ended week — trivially true
 *          when nothing has been ended
 */
export function isAfterArchive(weeks: Weeks, weekStart: DateKey): boolean {
    const bound = lastEndedWeek(weeks);
    return bound === undefined || weekStart > bound;
}

/**
 * The week the app should open on: the oldest week still waiting to be ended.
 *
 * Ending weeks is a queue worked oldest first, and a week that was never touched
 * has no entry, so it cannot block the queue.
 *
 * @param weeks any Weeks
 * @param currentWeek the week-start of the week containing today, a Monday
 * @returns the weekStart of the earliest active (not ended) entry that is not in
 *          the future, or currentWeek when there is none — because every entry is
 *          ended, every active entry is still to come, or nothing is stored
 */
export function earliestActiveWeek(weeks: Weeks, currentWeek: DateKey): DateKey {
    // weeks is sorted ascending, so the first match is the earliest.
    const waiting = weeks.find((week) => !isEnded(week) && week.weekStart <= currentWeek);
    return waiting?.weekStart ?? currentWeek;
}

/**
 * Whether a week may be ended.
 *
 * Weeks are ended oldest first, so that none silently escapes being counted: the
 * app opens on the earliest active week, and that is the only week this allows you
 * to close out.
 *
 * @param weeks any Weeks
 * @param weekStart the week in question
 * @param currentWeek the week-start of the week containing today, a Monday
 * @returns true iff all of: weeks holds an entry at weekStart, that entry is not
 *          already ended, weekStart is no later than currentWeek — a week you have
 *          not lived cannot be closed out — and weekStart is the earliest active
 *          week
 */
export function canEndWeek(weeks: Weeks, weekStart: DateKey, currentWeek: DateKey): boolean {
    const plan = weekAt(weeks, weekStart);
    return (
        !isEmptyWeek(plan) &&
        !isEnded(plan) &&
        // Implied by the clause below, since earliestActiveWeek never answers with
        // a future entry — stated anyway, because it is the rule, not a corollary.
        weekStart <= currentWeek &&
        weekStart === earliestActiveWeek(weeks, currentWeek)
    );
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
 *          - no ended entry follows an active one: once an entry is active, every
 *            later entry is active too
 */
export function isValidWeeks(weeks: Weeks): boolean {
    let seenActive = false;
    for (const [index, week] of weeks.entries()) {
        const previous = weeks[index - 1];
        if (previous !== undefined && previous.weekStart >= week.weekStart) {
            return false;
        }
        if (isEmptyWeek(week) || !isValidPlan(week)) {
            return false;
        }
        if (isEnded(week) && seenActive) {
            return false;
        }
        seenActive = seenActive || !isEnded(week);
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
 * A plan may move out of any week that is still open and onto any free week after
 * the last ended one, in either direction and however far. The clock does not come
 * into it — only the archive does. Landing after every ended week is what keeps the
 * collection's ended-come-first invariant, and it is the weakest rule that does:
 * the whole span from the last ended week to the end of the calendar is reachable,
 * which is every week you could still be planning.
 *
 * The source needs no such rule. The invariant guarantees every active entry
 * already lies after every ended one, so a week with work to move is always past
 * the bound.
 *
 * @param weeks any Weeks
 * @param from the week whose plan is moving
 * @param to the week it should move to; may be earlier or later than from
 * @returns a new collection in which from has no entry and to's entry is from's
 *          plan with weekStart set to to, everything else about it unchanged. The
 *          collection is returned unchanged when the move is not one the model
 *          allows: from holds no work, from has been ended (an ended week is
 *          frozen), to already holds work, to is not a valid week-start, or to is
 *          not strictly after every ended week.
 */
export function moveWeek(weeks: Weeks, from: DateKey, to: DateKey): Weeks {
    const source = weekAt(weeks, from);
    // A stored entry is never empty, so this also rejects an ended destination
    // and the case to === from.
    const destinationTaken = !isEmptyWeek(weekAt(weeks, to));
    if (
        isEmptyWeek(source) ||
        isEnded(source) ||
        destinationTaken ||
        !isValidWeekStart(to) ||
        !isAfterArchive(weeks, to)
    ) {
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
export function carryForward(
    weeks: Weeks,
    from: DateKey,
    to: DateKey,
    newId: () => string,
): Weeks {
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

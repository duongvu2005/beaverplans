import type { Project, Subtask, Task, WeekPlan, Weeks } from './types';
import { isEmptyWeek } from './weeks';

/**
 * Three-way merge of two divergent copies of a Weeks collection.
 *
 * The shape of the problem: two devices both started from the same synced
 * state (`base`), then edited independently. `ours` is this device's copy,
 * `theirs` is what came back from the server. A three-way merge can tell an
 * edit from a non-edit — a two-way one cannot, which is why last-write-wins
 * has to throw one side away.
 *
 * Deliberately clock-free. There is no timestamp anywhere in this module and
 * none is wanted: `ours` has never been written anywhere, so it has no
 * position on any timeline, and the only clock that could rank it against
 * `theirs` is the client's, which lies. Everything here is decided by
 * comparing trees against `base`, which is exact. Where that leaves a genuine
 * tie, this device wins — see mergeScalar.
 *
 * Nodes are matched by id at every level, which is sound because ids come
 * from crypto.randomUUID() at the UI call site: two devices can never
 * independently mint the same id. Weeks are matched by weekStart.
 */

/**
 * Structural equality, treating an absent key and an explicitly-undefined one
 * as the same (Task.deadline and friends are optional, and a value that has
 * round-tripped through JSON loses its undefined keys).
 *
 * @param a any value
 * @param b any value
 * @returns true iff a and b have the same structure and primitive leaves,
 *          independent of object key order
 */
function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
        const defined = (o: object) =>
            Object.keys(o).filter((k) => (o as Record<string, unknown>)[k] !== undefined);
        const keysA = defined(a);
        const keysB = defined(b);
        return (
            keysA.length === keysB.length &&
            keysA.every((k) =>
                deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
            )
        );
    }
    return false;
}

/**
 * Three-way merge of one field that has no children.
 *
 * @param base the field's value at the last common state
 * @param ours this device's value
 * @param theirs the other device's value
 * @returns theirs when only they changed it, ours when only we did or when
 *          both made the same change, and — when both changed it differently,
 *          which no comparison can adjudicate — ours. This is the one
 *          arbitrary decision in the module: the local device is the one with
 *          a user looking at it, so it keeps what is on screen.
 */
function mergeScalar<T>(base: T, ours: T, theirs: T): T {
    if (deepEqual(ours, theirs)) {
        return ours;
    }
    if (deepEqual(ours, base)) {
        return theirs;
    }
    if (deepEqual(theirs, base)) {
        return ours;
    }
    return ours;
}

/**
 * Three-way merge of a list of nodes identified by a key.
 *
 * Order follows ours: entries keep this device's relative order, and nodes
 * only the other device has are appended. Reorder-against-reorder therefore
 * resolves the same way every other tie does.
 *
 * @param base the list at the last common state
 * @param ours this device's list
 * @param theirs the other device's list
 * @param keyOf the node's identity; must be unique within each list
 * @param mergeOne merges one node present and differing on all three sides
 * @param mergeBothAdded merges a key both sides introduced, with no ancestor
 *        to compare against. Unreachable where the key is a node id, since
 *        crypto.randomUUID() cannot collide across devices — but weeks are
 *        keyed by weekStart, and two devices really can both start the same
 *        week. Defaults to ours.
 * @returns one entry per key that survives, where a key is dropped iff the
 *          side that deleted it did not also have the other side edit it —
 *          and on a delete-against-edit, the deleting side wins when that
 *          side is ours and the edit survives when it is theirs. A key absent
 *          from base is an addition and is always kept.
 */
function mergeKeyed<T>(
    base: ReadonlyArray<T>,
    ours: ReadonlyArray<T>,
    theirs: ReadonlyArray<T>,
    keyOf: (item: T) => string,
    mergeOne: (base: T, ours: T, theirs: T) => T,
    mergeBothAdded: (ours: T, theirs: T) => T = (item) => item,
): ReadonlyArray<T> {
    const baseByKey = new Map(base.map((item) => [keyOf(item), item]));
    const oursByKey = new Map(ours.map((item) => [keyOf(item), item]));
    const theirsByKey = new Map(theirs.map((item) => [keyOf(item), item]));
    const merged: T[] = [];

    for (const item of ours) {
        const key = keyOf(item);
        const inBase = baseByKey.get(key);
        const inTheirs = theirsByKey.get(key);

        if (inBase === undefined) {
            merged.push(inTheirs === undefined ? item : mergeBothAdded(item, inTheirs));
        } else if (inTheirs === undefined) {
            // They deleted it. Keep it only if we had edited it since base —
            // an untouched node we still hold is just the delete not yet
            // applied here, not a competing opinion.
            if (!deepEqual(item, inBase)) {
                merged.push(item);
            }
        } else if (deepEqual(item, inBase)) {
            merged.push(inTheirs); // only they changed it
        } else if (deepEqual(inTheirs, inBase)) {
            merged.push(item); // only we changed it
        } else if (deepEqual(item, inTheirs)) {
            merged.push(item); // both made the same change
        } else {
            merged.push(mergeOne(inBase, item, inTheirs));
        }
    }

    for (const item of theirs) {
        const key = keyOf(item);
        // Already handled above if we hold it; dropped if base held it, since
        // then its absence from ours is our deletion.
        if (!oursByKey.has(key) && !baseByKey.has(key)) {
            merged.push(item);
        }
    }

    return merged;
}

/**
 * Merge one subtask that both sides changed differently.
 *
 * Not decomposed into fields, and that is forced rather than chosen:
 * isValidSubtask requires every entry of missedDays to fall strictly before
 * assignedDay, so taking assignedDay from one side and missedDays from the
 * other can produce a subtask the rep invariant rejects. assignedDay and
 * missedDays are two halves of one history and move together — and once they
 * do, the rest of the node is small enough that splitting it buys nothing.
 *
 * @param base the subtask at the last common state (unused: no field of a
 *        subtask is merged independently, so there is nothing to compare)
 * @param ours this device's subtask
 * @param theirs the other device's subtask (likewise unused)
 * @returns ours
 */
function mergeSubtask(base: Subtask, ours: Subtask, theirs: Subtask): Subtask {
    void base;
    void theirs;
    return ours;
}

/**
 * Merge one task that both sides changed differently.
 *
 * @param base the task at the last common state
 * @param ours this device's task
 * @param theirs the other device's task
 * @returns a task whose scalar fields are each merged independently and whose
 *          subtasks are merged by id, with isDone reconciled against the
 *          result: isValidTask demands a task store isDone exactly when it has
 *          no subtasks, so a merge that changes whether the task is a leaf has
 *          to add or drop the flag in the same step.
 */
function mergeTask(base: Task, ours: Task, theirs: Task): Task {
    const subtasks = mergeKeyed(
        base.subtasks,
        ours.subtasks,
        theirs.subtasks,
        (subtask) => subtask.id,
        mergeSubtask,
    );
    const deadline = mergeScalar(base.deadline, ours.deadline, theirs.deadline);
    const description = mergeScalar(base.description, ours.description, theirs.description);
    const merged: Task = {
        id: ours.id,
        name: mergeScalar(base.name, ours.name, theirs.name),
        subtasks,
        ...(deadline !== undefined && { deadline }),
        ...(description !== undefined && { description }),
    };
    if (subtasks.length > 0) {
        return merged; // has subtasks, so isDone must be absent
    }
    // A leaf must carry the flag. It may be undefined on every side (all three
    // had subtasks, and the merge removed the last one), so false is the floor.
    return { ...merged, isDone: mergeScalar(base.isDone, ours.isDone, theirs.isDone) ?? false };
}

/**
 * Merge one project that both sides changed differently.
 *
 * @param base the project at the last common state
 * @param ours this device's project
 * @param theirs the other device's project
 * @returns a project with each scalar field merged independently and its tasks
 *          merged by id. Nothing in isValidProject couples a project's own
 *          fields, so they need no reconciliation against each other.
 */
function mergeProject(base: Project, ours: Project, theirs: Project): Project {
    const deadline = mergeScalar(base.deadline, ours.deadline, theirs.deadline);
    return {
        id: ours.id,
        name: mergeScalar(base.name, ours.name, theirs.name),
        tasks: mergeKeyed(base.tasks, ours.tasks, theirs.tasks, (task) => task.id, mergeTask),
        ...(deadline !== undefined && { deadline }),
    };
}

/**
 * Merge one week that both sides changed differently.
 *
 * @param base the plan at the last common state
 * @param ours this device's plan
 * @param theirs the other device's plan, for the same weekStart
 * @returns a plan whose ended flag and projects are merged independently of
 *          each other. The flag cannot conflict: it is a boolean over a common
 *          ancestor, so "both sides changed it" necessarily means both changed
 *          it to the same value. An ended week may therefore gain projects
 *          here — that is correct, since work recorded on the other device
 *          before it learned the week had ended really was part of that week.
 *          putWeek's freeze is not involved: this builds a collection rather
 *          than writing through it.
 */
function mergePlan(base: WeekPlan, ours: WeekPlan, theirs: WeekPlan): WeekPlan {
    return {
        weekStart: ours.weekStart,
        ended: mergeScalar(base.ended, ours.ended, theirs.ended),
        projects: mergeKeyed(
            base.projects,
            ours.projects,
            theirs.projects,
            (project) => project.id,
            mergeProject,
        ),
    };
}

/** Every id in a project's subtree, the unit at which a collision is resolved. */
function idsOfProject(project: Project): ReadonlyArray<string> {
    return [
        project.id,
        ...project.tasks.flatMap((task) => [task.id, ...task.subtasks.map((s) => s.id)]),
    ];
}

/**
 * Drop any project whose subtree repeats an id already used earlier in the
 * collection.
 *
 * Weeks is the only level with an invariant spanning its siblings — ids are
 * unique across the WHOLE collection, not merely within a week — so it is the
 * only level whose merge needs a repair pass, in the same way a task's
 * isDone has to be reconciled after its subtasks are merged.
 *
 * It earns its keep on move-against-edit: if the other device relabelled a
 * week that this one edited, the edit is kept at the old weekStart and the
 * move arrives as a new week holding the very same nodes. Resolving toward the
 * earlier week keeps this device's edit and discards the move, which is how
 * every other tie here resolves.
 *
 * @param weeks entries sorted by weekStart
 * @returns the same entries with duplicate-id projects removed, keeping the
 *          first occurrence
 */
function dropRepeatedIds(weeks: ReadonlyArray<WeekPlan>): ReadonlyArray<WeekPlan> {
    const seen = new Set<string>();
    return weeks.map((week) => {
        const kept = week.projects.filter((project) => {
            const ids = idsOfProject(project);
            if (ids.some((id) => seen.has(id))) {
                return false;
            }
            for (const id of ids) {
                seen.add(id);
            }
            return true;
        });
        return kept.length === week.projects.length ? week : { ...week, projects: kept };
    });
}

/**
 * Reconcile two copies of a Weeks that diverged from a common ancestor.
 *
 * Known limitations, both deliberate:
 *  - A week relabelled by moveWeek on one device while the other edited it at
 *    its old weekStart loses one of the two. The merge sees a deletion and an
 *    unrelated addition, not a move; recognising it would mean inferring the
 *    move from id overlap, which is rename detection and can misfire. Which
 *    side loses follows the usual rule: this device's change is the one kept.
 *  - Both devices ending the same week and carrying forward produces two
 *    copies of the unfinished work in the destination week. carryForward mints
 *    fresh ids, so the two copies are genuinely distinct additions and no
 *    invariant is violated.
 *
 * @param base the last state both devices agreed on; any valid Weeks
 * @param ours this device's current state; any valid Weeks
 * @param theirs the other device's state; any valid Weeks
 * @returns a valid Weeks (isValidWeeks) combining both sides: every change
 *          made on exactly one side is kept, a change made on both sides in
 *          the same way is kept once, and a genuine disagreement resolves to
 *          ours. Weeks left with no projects are dropped, since Weeks holds no
 *          empty entry, and the result is sorted by weekStart.
 */
export function mergeWeeks(base: Weeks, ours: Weeks, theirs: Weeks): Weeks {
    const merged = mergeKeyed(
        base,
        ours,
        theirs,
        (week) => week.weekStart,
        mergePlan,
        // Both devices started the same week from nothing: merge them against
        // an empty ancestor, so each side's projects read as additions.
        (ourWeek, theirWeek) =>
            mergePlan(
                { weekStart: ourWeek.weekStart, ended: false, projects: [] },
                ourWeek,
                theirWeek,
            ),
    );
    const sorted = [...merged].sort((a, b) =>
        a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0,
    );
    // Order matters: sort first so "the earlier week keeps the id" is
    // well-defined, then prune, since dropping a repeat can empty a week.
    return dropRepeatedIds(sorted).filter((week) => !isEmptyWeek(week));
}

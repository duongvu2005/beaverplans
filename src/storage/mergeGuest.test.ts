import { describe, it, expect } from 'vitest';
import { decideMigration, endedCollisions, mergeGuestWeeks } from './mergeGuest';
import { isValidWeeks, weekAt } from '@/core/weeks';
import type { DateKey, Project, Task, WeekPlan, Weeks } from '@/core/types';

const JUL06 = '2026-07-06';
const JUL13 = '2026-07-13';
const JUL20 = '2026-07-20';

function leafTask(id: string, isDone: boolean): Task {
    return { id, name: id, subtasks: [], isDone };
}

function project(id: string, tasks: Task[]): Project {
    return { id, name: id, tasks };
}

// A one-project week whose every id is prefixed, so two weeks built with
// different prefixes satisfy collection-wide id uniqueness.
function week(weekStart: DateKey, prefix: string, ended: boolean = false): WeekPlan {
    return {
        weekStart,
        ended,
        projects: [project(`${prefix}-p`, [leafTask(`${prefix}-t`, false)])],
    };
}

// Ids are minted in a fixed, inspectable order.
function counter(): () => string {
    let n = 0;
    return () => `new-${++n}`;
}

describe('mergeGuestWeeks', () => {
    /*
     * Testing strategy
     *   partition on guestWeeks: empty | one week
     *   partition on the target weekStart in cloudWeeks: no entry | active entry | ended entry
     *   partition on guestWeeks length: one week | multiple weeks
     *   cross-cutting: ids of every carried node are freshly minted (never reused
     *     from either side); result satisfies isValidWeeks
     */

    it('no guest weeks: cloudWeeks unchanged', () => {
        const cloud: Weeks = [week(JUL13, 'c')];
        expect(mergeGuestWeeks(cloud, [], counter())).toEqual(cloud);
    });

    it('a guest week at a weekStart the cloud has no entry for: stored as-is (re-identified)', () => {
        const result = mergeGuestWeeks([], [week(JUL13, 'g')], counter());
        expect(weekAt(result, JUL13).projects).toHaveLength(1);
        expect(weekAt(result, JUL13).ended).toBe(false);
        expect(isValidWeeks(result)).toBe(true);
    });

    it('a guest week whose weekStart already has an active cloud entry: guest projects appended after', () => {
        const cloud: Weeks = [week(JUL13, 'c')];
        const result = mergeGuestWeeks(cloud, [week(JUL13, 'g')], counter());
        const merged = weekAt(result, JUL13);
        expect(merged.projects.map((p) => p.id)).toEqual(['c-p', 'new-1']);
        expect(merged.ended).toBe(false);
    });

    it('a guest week whose weekStart already has an ENDED cloud entry: dropped, cloud untouched', () => {
        const cloud: Weeks = [week(JUL13, 'c', true)];
        const result = mergeGuestWeeks(cloud, [week(JUL13, 'g')], counter());
        expect(result).toEqual(cloud);
    });

    it('the same collision with reopenEnded: the week reopens and takes the work', () => {
        const cloud: Weeks = [week(JUL13, 'c', true)];
        const result = mergeGuestWeeks(cloud, [week(JUL13, 'g')], counter(), true);
        const merged = weekAt(result, JUL13);
        expect(merged.projects.map((p) => p.id)).toEqual(['c-p', 'new-1']);
        expect(merged.ended).toBe(false);
        expect(isValidWeeks(result)).toBe(true);
    });

    // Reopening is for weeks the merge actually lands on. An ended week the
    // guest has nothing for is not in the merge's way and stays as it is.
    it('reopenEnded leaves an ended week the guest has no work for alone', () => {
        const cloud: Weeks = [week(JUL13, 'c', true)];
        const result = mergeGuestWeeks(cloud, [week(JUL20, 'g')], counter(), true);
        expect(weekAt(result, JUL13).ended).toBe(true);
    });

    it('every carried project/task gets a fresh id, never one from either side', () => {
        const cloud: Weeks = [week(JUL13, 'c')];
        const result = mergeGuestWeeks(cloud, [week(JUL13, 'g')], counter());
        const carried = weekAt(result, JUL13).projects[1];
        expect(carried?.id).toBe('new-1');
        expect(carried?.tasks[0]?.id).toBe('new-2');
        expect(carried?.id).not.toBe('g-p');
        expect(carried?.tasks[0]?.id).not.toBe('g-t');
    });

    it('multiple guest weeks are each folded in, in order', () => {
        const cloud: Weeks = [week(JUL13, 'c')];
        const guest: Weeks = [week(JUL06, 'g1'), week(JUL13, 'g2'), week(JUL20, 'g3')];
        const result = mergeGuestWeeks(cloud, guest, counter());
        expect(result.map((w) => w.weekStart)).toEqual([JUL06, JUL13, JUL20]);
        expect(weekAt(result, JUL13).projects.map((p) => p.id)).toEqual(['c-p', 'new-3']);
        expect(isValidWeeks(result)).toBe(true);
    });
});

describe('endedCollisions', () => {
    /*
     * Testing strategy
     *   partition on the cloud entry at a guest weekStart: absent | active |
     *       ended
     *   partition on the guest week's projects: some | none
     *   partition on how many collide: none | one | several
     */

    function emptyWeek(weekStart: DateKey): WeekPlan {
        return { weekStart, ended: false, projects: [] };
    }

    it('no guest weeks: nothing collides', () => {
        expect(endedCollisions([week(JUL13, 'c', true)], [])).toEqual([]);
    });

    it('a weekStart the cloud has no entry for: nothing to collide with', () => {
        expect(endedCollisions([], [week(JUL13, 'g')])).toEqual([]);
    });

    it('an ACTIVE cloud entry: the merge lands there, so it is not reported', () => {
        expect(endedCollisions([week(JUL13, 'c')], [week(JUL13, 'g')])).toEqual([]);
    });

    it('an ended cloud entry the guest has work for: reported', () => {
        expect(endedCollisions([week(JUL13, 'c', true)], [week(JUL13, 'g')])).toEqual([JUL13]);
    });

    // Nothing of the guest's would be dropped, so there is nothing to ask about.
    it('an ended cloud entry the guest has NO projects for: not reported', () => {
        expect(endedCollisions([week(JUL13, 'c', true)], [emptyWeek(JUL13)])).toEqual([]);
    });

    it('several collisions come back in the guest collection order', () => {
        const cloud: Weeks = [week(JUL06, 'c1', true), week(JUL13, 'c2'), week(JUL20, 'c3', true)];
        const guest: Weeks = [week(JUL06, 'g1'), week(JUL13, 'g2'), week(JUL20, 'g3')];
        expect(endedCollisions(cloud, guest)).toEqual([JUL06, JUL20]);
    });
});

describe('decideMigration', () => {
    it('no local data: none, regardless of cloud', () => {
        expect(decideMigration(true, false)).toBe('none');
        expect(decideMigration(false, false)).toBe('none');
    });

    it('local data, empty cloud: auto', () => {
        expect(decideMigration(true, true)).toBe('auto');
    });

    it('local data, non-empty cloud: prompt', () => {
        expect(decideMigration(false, true)).toBe('prompt');
    });
});

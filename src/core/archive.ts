import type { Archive, WeekPlan } from "./types";

/**
 * Records plan as a newly-archived week.
 *
 * @param archive the current archive
 * @param plan the week being ended; requires plan.weekStart is not already
 *        the weekStart of any entry in archive
 * @returns a new archive containing every entry of archive plus plan, in
 *          unspecified order
 */
export function archiveWeek(archive: Archive, plan: WeekPlan): Archive {
    return [...archive, plan];
}

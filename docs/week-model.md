# The week model

How a plan knows which week it is for, and how the app tells when that week has passed.

## weekStart

A `WeekPlan` carries a **`weekStart`**: the `DateKey` (`YYYY-MM-DD`) of the Monday its
week begins on. That one date pins the plan to the calendar. Each subtask has an
`assignedDay` (`mon` to `sun`), read as a weekday within the `weekStart` week, so the same
subtask lands on a different calendar date depending on the anchor.

`weekStart` being a real Monday is part of the plan's rep invariant. **`isValidWeekStart`**
requires a well-formed `YYYY-MM-DD` date that falls on a Monday, and `isValidPlan` enforces it.

## weekStatusOf

**`weekStatusOf(weekStart, today)`** compares the two weeks, not the two dates: **`current`**
if they are the same week, **`past`** if the plan's week is earlier, **`future`** if later.
Both arguments normalize to their week-start first, so a plan stays `current` through the
Sunday six days after its Monday, and a `weekStart` one calendar day after today is still a
`future` week.

## Ending a week

The app holds one **`Weeks`** collection, not a single plan: every week the user has ever
touched is an entry in it, each carrying its own `weekStart` and an optional **`ended`**
flag. Absent (or `false`) means active; `true` means the week is closed and frozen —
**`isEnded`** is the one reader, since both states mean "not ended."

**`canEndWeek(weeks, weekStart, currentWeek)`** is the end-week gate: the entry must
exist, not already be ended, and be the *earliest* active week — ending them out of order
would strand an older one, invisible to stats and permanently the landing week.
**`endWeek`** then sets `ended: true` and changes nothing else: the archived record is
exactly what the week looked like, unfinished work included, not just its finished half.

Carrying unfinished work forward is a separate step, **`carryForward`**, which copies —
never moves — the ended entry's undone tasks onto a new active entry at
**`nextWeekStart(weekStart)`**, each with a fresh id. The source stays frozen and
untouched; ending and carrying are two independent producers, composed by the caller.

Once ended, a week is terminal: no unlock, no editing. `putWeek` — the single chokepoint
every edit passes through — refuses to write anything onto an ended entry, which is what
makes the freeze hold across the whole tree of producers at once.

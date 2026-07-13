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

## Rollover

A `past` plan is stale: its week has ended and it should roll forward. **`nextWeekStart(weekStart)`**
gives the following Monday, the anchor a rollover re-points the plan to.

-- Hard size limits on a week's projects.
--
-- These are the guarantee, not the user-facing limit. src/core/limits.ts caps a
-- week at 50 projects and says so in the UI; these sit far above that on purpose.
-- The two answer different threats: the client cap stops a runaway loop or an
-- oversized paste and can explain itself, while this one stops someone with a
-- valid session scripting upsert, where nothing client-side applies at all.
--
-- The headroom between them is load-bearing. The bulk paths (carryForward,
-- mergeGuest, importLegacy) deliberately may exceed the client cap rather than
-- drop work someone already did, so a week can legitimately arrive above 50. If
-- these ceilings sat at the client cap, that week would fail to write with no
-- path back -- a silent sync failure instead of a limit.
--
-- No per-user row-count cap: that needs a trigger running on every insert, and
-- there is no reason yet to think week count is the dimension that runs away.

alter table planner_weeks
    add constraint planner_weeks_projects_is_array
        check (jsonb_typeof(projects) = 'array'),
    -- The case is not decoration. Postgres does not promise an order across
    -- constraints, so this one has to be total on its own: without it,
    -- jsonb_array_length reaches a non-array first and the write fails as a
    -- function error (22023) rather than a check violation (23514), leaving the
    -- constraint above unable to ever fire.
    add constraint planner_weeks_projects_count
        check (jsonb_array_length(
            case when jsonb_typeof(projects) = 'array' then projects else '[]'::jsonb end
        ) <= 200),
    -- octet_length over the text form rather than pg_column_size: this is the
    -- length of the JSON a person could count themselves, where pg_column_size
    -- reports the size of the stored datum and moves with how Postgres chooses
    -- to compress it. A limit nobody can predict is one nobody can design against.
    add constraint planner_weeks_projects_size
        check (octet_length(projects::text) <= 1048576);

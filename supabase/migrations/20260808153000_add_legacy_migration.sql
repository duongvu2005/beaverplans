-- One-shot per-user import: old_planner_state -> planner_weeks.
--
-- The old app stays live at old.beaverplans.com, so there is no single switch
-- moment for 3k people. Each user's data moves the first time THEY sign in to
-- beaverplans; anything they write in the old app afterwards stays there.

-- null = never imported, and the only thing that means that. Deliberately not
-- derived from "has planner_weeks rows": a user who imports and then clears
-- every week would look unimported and get their deleted data resurrected.
-- A timestamp rather than a boolean costs the same and doubles as the
-- migration-progress log (`where migrated_at is null` is how many are left).
alter table old_planner_state
    add column migrated_at timestamptz;

-- Takes weeks already converted client-side by importLegacy.ts, so the tested
-- TypeScript converter stays the only definition of the old format.
--
-- security invoker: RLS applies as the caller, so this cannot touch another
-- user's rows and needs no hand-rolled ownership check. search_path is pinned
-- for the same linter reason as set_updated_at().
create function migrate_old_planner(weeks jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    claimed integer;
    written integer;
begin
    -- Claim BEFORE writing. The predicate and the write are one statement, so
    -- two devices signing in together cannot both pass it -- the loser updates
    -- zero rows and raises below, leaving the winner's import untouched. Same
    -- discipline as adoptLegacySession.js spending the legacy token: take the
    -- single-use thing first, then act on it.
    update public.old_planner_state
       set migrated_at = now()
     where user_id = auth.uid()
       and migrated_at is null;
    get diagnostics claimed = row_count;

    -- Also the "no legacy row at all" case: a user who never used the old app
    -- matches nothing here, so they can never be marked, and nothing is
    -- invented for them.
    if claimed = 0 then
        raise exception 'already migrated, or no legacy row'
            using errcode = 'no_data_found';
    end if;

    insert into public.planner_weeks (user_id, week_start, ended, projects)
    select auth.uid(),
           (week->>'weekStart')::date,
           coalesce((week->>'ended')::boolean, false),
           coalesce(week->'projects', '[]'::jsonb)
      from jsonb_array_elements(weeks) as week
    -- Legacy never clobbers work already done in beaverplans. Someone who used
    -- both keeps the new app's version of a shared week.
    on conflict (user_id, week_start) do nothing;
    get diagnostics written = row_count;

    return written;
end;
$$;

-- The whole function body is one transaction, so a failure anywhere leaves
-- migrated_at null and the next sign-in retries cleanly. Nothing half-imports.

-- anon is revoked explicitly, not just via public: Supabase's default
-- privileges grant execute on new public functions to anon outright, and
-- revoking public does not remove an explicit grant. Verified against
-- supabase/postgres -- with only the public revoke, anon reached the function
-- body. It could achieve nothing there (auth.uid() is null, so it claims no
-- row), but that is the old `grant all on planner_state to anon` argument
-- again: safe only because a second control happens to hold.
revoke execute on function migrate_old_planner(jsonb) from public, anon;
grant execute on function migrate_old_planner(jsonb) to authenticated;

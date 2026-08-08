-- The old planner's store: one row per user, the whole plan as JSON.
--
-- Reproduced here from the original project (kwpxpfgnlqwdxlkdglyl) so this
-- project can host old.beaverplans.com after the consolidation. The columns
-- match that production table exactly -- the old app's code is not being
-- restructured, so the schema cannot move. Renamed from planner_state only to
-- say out loud which site owns it; the old app's four call sites change with it.

create table old_planner_state (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    tasks      jsonb not null default '[]'::jsonb,
    archives   jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now(),
    week_start date  -- the Monday the board is anchored to; null = current week
);

-- No updated_at trigger, unlike planner_weeks: the old app writes the column
-- itself on every upsert (planner/src/storage.js), and a trigger would silently
-- override a live app's value for no benefit.

alter table old_planner_state enable row level security;

create policy "read own state"
    on old_planner_state for select
    to authenticated
    using (auth.uid() = user_id);

create policy "insert own state"
    on old_planner_state for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "update own state"
    on old_planner_state for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "delete own state"
    on old_planner_state for delete
    to authenticated
    using (auth.uid() = user_id);

-- The original had `grant all on planner_state to anon`, which was safe only
-- because RLS happened to be enabled -- one `disable row level security` from
-- exposing every user's data. anon gets nothing here; the old app reads this
-- table only while signed in.
grant select, insert, update, delete on old_planner_state to authenticated;

-- One row per user per week.

-- Stamps the write time server-side. The client never sends updated_at
-- (see weekPlanToRow), so this is the only writer.
-- search_path is pinned because Supabase's linter flags functions without one;
-- now() still resolves, since pg_catalog is always implicitly first.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table planner_weeks (
    user_id     uuid not null references auth.users(id) on delete cascade,
    week_start  date not null,
    ended       boolean not null default false,
    projects    jsonb not null default '[]'::jsonb,
    updated_at  timestamptz not null default now(),
    primary key (user_id, week_start)
);

-- The insert arm is not redundant with the column default: it also overrides an
-- updated_at supplied by a client.
create trigger planner_weeks_set_updated_at
    before insert or update on planner_weeks
    for each row
    execute function set_updated_at();

alter table planner_weeks enable row level security;

-- `to authenticated` on every policy: guests never reach the cloud (they run on
-- LocalBackend), so anon should not even evaluate these. Without the clause
-- anon is still locked out — auth.uid() is null, and null = user_id is null,
-- never true — but saying it outright is cheaper to read than that argument.
create policy "read own weeks"
    on planner_weeks for select
    to authenticated
    using (auth.uid() = user_id);

create policy "insert own weeks"
    on planner_weeks for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "update own weeks"
    on planner_weeks for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "delete own weeks"
    on planner_weeks for delete
    to authenticated
    using (auth.uid() = user_id);

grant select, insert, update, delete on planner_weeks to authenticated;

-- Realtime. CloudBackend ignores the event payload and re-pulls, so the default
-- replica identity (the primary key) is enough: user_id rides in the PK, which
-- is what the client-side user_id filter needs on DELETE. Nothing here wants
-- `replica identity full`, which would only widen the WAL.
alter publication supabase_realtime add table planner_weeks;

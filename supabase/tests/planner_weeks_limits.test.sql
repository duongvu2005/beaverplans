-- pgTAP tests for the planner_weeks size limits (migration 20260809200000).
-- Run with `npm run test:db` (supabase start must be running).
--
-- Everything runs in ONE transaction that rolls back at the end, so the fixtures
-- never persist.
--
-- These run as `authenticated` with a jwt claim rather than as postgres. A
-- superuser bypasses RLS but NOT check constraints, so postgres would prove the
-- limits work -- it just would not prove they apply to the caller these exist
-- for. Running as the real role tests both at once.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

-- --- fixtures -------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
    ('11111111-1111-1111-1111-111111111111',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- --- the constraints exist ------------------------------------------------

select has_check('public', 'planner_weeks', 'planner_weeks has check constraints');

select col_has_check('public', 'planner_weeks', 'projects',
    'the caps are on projects, the column that can actually run away');

-- --- the ordinary case still writes ---------------------------------------
-- Stated first: a limit that also blocks normal use is a bug, and this is the
-- assertion that would catch it.

select lives_ok($$
    insert into planner_weeks (user_id, week_start, ended, projects)
    values ('11111111-1111-1111-1111-111111111111', '2026-08-03', false,
            '[{"id":"p1","name":"Thesis","tasks":[]}]'::jsonb)
$$, 'an ordinary week writes');

-- A week well past the client cap of 50 but under the ceiling. This is the case
-- the headroom exists for: carryForward and mergeGuest may produce it, and it
-- must not fail to sync.
select lives_ok($$
    insert into planner_weeks (user_id, week_start, ended, projects)
    values ('11111111-1111-1111-1111-111111111111', '2026-08-10', false,
            (select jsonb_agg(jsonb_build_object('id', 'p' || i, 'name', 'p', 'tasks', '[]'::jsonb))
               from generate_series(1, 120) i))
$$, 'a week over the client cap but under the ceiling still writes');

-- --- the count ceiling ----------------------------------------------------

select lives_ok($$
    insert into planner_weeks (user_id, week_start, ended, projects)
    values ('11111111-1111-1111-1111-111111111111', '2026-08-17', false,
            (select jsonb_agg(jsonb_build_object('id', 'p' || i, 'name', 'p', 'tasks', '[]'::jsonb))
               from generate_series(1, 200) i))
$$, 'exactly 200 projects is allowed -- the cap is inclusive');

select throws_ok($$
    insert into planner_weeks (user_id, week_start, ended, projects)
    values ('11111111-1111-1111-1111-111111111111', '2026-08-24', false,
            (select jsonb_agg(jsonb_build_object('id', 'p' || i, 'name', 'p', 'tasks', '[]'::jsonb))
               from generate_series(1, 201) i))
$$, '23514', null, '201 projects is refused');

-- An update is the path the app actually takes -- CloudBackend upserts -- so the
-- ceiling has to hold there too, not only on insert.
select throws_ok($$
    update planner_weeks
       set projects = (select jsonb_agg(jsonb_build_object('id', 'p' || i, 'name', 'p', 'tasks', '[]'::jsonb))
                         from generate_series(1, 201) i)
     where week_start = '2026-08-03'
$$, '23514', null, 'growing an existing week past the ceiling is refused too');

-- --- the size ceiling -----------------------------------------------------
-- 200 projects is legal by count, so a payload that is refused here can only be
-- refused for its size.

select throws_ok($$
    insert into planner_weeks (user_id, week_start, ended, projects)
    values ('11111111-1111-1111-1111-111111111111', '2026-08-31', false,
            (select jsonb_agg(jsonb_build_object('id', 'p' || i, 'name', repeat('x', 20000), 'tasks', '[]'::jsonb))
               from generate_series(1, 100) i))
$$, '23514', null, 'a payload over 1 MB is refused even at a legal project count');

-- --- the shape ------------------------------------------------------------

select throws_ok($$
    insert into planner_weeks (user_id, week_start, ended, projects)
    values ('11111111-1111-1111-1111-111111111111', '2026-09-07', false,
            '{"not":"a list"}'::jsonb)
$$, '23514', null, 'projects must be a json array');

select * from finish();
rollback;

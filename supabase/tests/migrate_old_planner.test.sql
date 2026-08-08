-- pgTAP tests for the one-shot legacy import (migration 20260808153000).
-- Run with `npm run test:db` (supabase start must be running).
--
-- Everything here runs in ONE transaction that rolls back at the end, so the
-- fixtures never persist. That is also why the concurrency guard is not tested
-- here -- proving two sessions cannot both import needs two connections. See
-- supabase/tests/race.sh.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

-- --- fixtures -------------------------------------------------------------
-- u1: legacy data, nothing in beaverplans yet -- the ordinary case.
-- u2: no legacy row at all -- someone who only ever used beaverplans.
-- u3: legacy data AND a week already worked on in beaverplans.
insert into auth.users (id) values
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222'),
    ('33333333-3333-3333-3333-333333333333');

insert into old_planner_state (user_id, tasks, archives, week_start) values
    ('11111111-1111-1111-1111-111111111111', '[]'::jsonb, '[]'::jsonb, '2026-08-03'),
    ('33333333-3333-3333-3333-333333333333', '[]'::jsonb, '[]'::jsonb, '2026-08-03');

insert into planner_weeks (user_id, week_start, ended, projects) values
    ('33333333-3333-3333-3333-333333333333', '2026-08-03', false,
     '[{"id":"kept","name":"KEEP ME","tasks":[]}]'::jsonb);

-- --- schema ---------------------------------------------------------------

select has_column('public', 'old_planner_state', 'migrated_at',
    'the migration marker exists');

select col_is_null('public', 'old_planner_state', 'migrated_at',
    'migrated_at is nullable -- null is what "never imported" means');

select has_function('public', 'migrate_old_planner', array['jsonb'],
    'the import rpc exists');

-- --- privileges -----------------------------------------------------------
-- Supabase default privileges grant execute on new public functions to anon
-- outright, so `revoke from public` alone leaves anon able to call it. This
-- assertion is what catches that regression.

select ok(
    not has_function_privilege('anon', 'public.migrate_old_planner(jsonb)', 'execute'),
    'anon cannot execute the rpc');

select ok(
    has_function_privilege('authenticated', 'public.migrate_old_planner(jsonb)', 'execute'),
    'authenticated can execute the rpc');

-- --- the ordinary import, as a real signed-in user ------------------------

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is(
    migrate_old_planner('[
        {"weekStart":"2026-08-03","ended":false,"projects":[{"id":"p1","name":"A","tasks":[]}]},
        {"weekStart":"2026-07-27","ended":true,"projects":[]}
    ]'::jsonb),
    2,
    'importing two weeks reports two rows written');

select is(
    (select count(*) from planner_weeks
      where user_id = '11111111-1111-1111-1111-111111111111'),
    2::bigint,
    'both weeks landed');

select is(
    (select ended from planner_weeks
      where user_id = '11111111-1111-1111-1111-111111111111'
        and week_start = '2026-07-27'),
    true,
    'an archived week arrives already ended');

select is(
    (select migrated_at is not null from old_planner_state
      where user_id = '11111111-1111-1111-1111-111111111111'),
    true,
    'the user is marked migrated');

select throws_ok(
    $$ select migrate_old_planner('[{"weekStart":"2026-06-01","ended":false,"projects":[]}]'::jsonb) $$,
    'P0002',
    'already migrated, or no legacy row',
    'a second import is refused -- the flag is final');

-- --- a user who never used the old app ------------------------------------

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select throws_ok(
    $$ select migrate_old_planner('[{"weekStart":"2026-08-03","ended":false,"projects":[]}]'::jsonb) $$,
    'P0002',
    'already migrated, or no legacy row',
    'no legacy row means nothing is invented for them');

-- --- RLS: one user's data is invisible to another -------------------------

select is(
    (select count(*) from planner_weeks
      where user_id = '11111111-1111-1111-1111-111111111111'),
    0::bigint,
    'RLS hides another user''s weeks');

select is(
    (select count(*) from old_planner_state
      where user_id = '11111111-1111-1111-1111-111111111111'),
    0::bigint,
    'RLS hides another user''s legacy row');

-- --- legacy never clobbers work already done in beaverplans ---------------

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is(
    migrate_old_planner('[
        {"weekStart":"2026-08-03","ended":false,"projects":[{"id":"old","name":"CLOBBER","tasks":[]}]},
        {"weekStart":"2026-07-20","ended":true,"projects":[]}
    ]'::jsonb),
    1,
    'only the week beaverplans did not already have is written');

select is(
    (select projects->0->>'name' from planner_weeks
      where user_id = '33333333-3333-3333-3333-333333333333'
        and week_start = '2026-08-03'),
    'KEEP ME',
    'the week already worked on in beaverplans survives the import');

select * from finish();
rollback;

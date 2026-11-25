-- pgTAP tests for self-service account deletion (migration 20260809120000).
-- Run with `npm run test:db` (supabase start must be running).
--
-- Everything runs in ONE transaction that rolls back at the end, so the fixtures
-- never persist.
--
-- The point of the exercise is that security definer switches RLS OFF inside the
-- function, so every "cannot touch someone else's account" assertion below is
-- testing the auth.uid() predicate and nothing else. That is why these run as
-- `authenticated` with a jwt claim, never as postgres: a superuser bypasses RLS,
-- so a test that passes as postgres proves nothing about either.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

-- --- fixtures -------------------------------------------------------------
-- u1: an account with data in both per-user tables -- the ordinary case.
-- u2: a bystander, whose account and data must survive u1 deleting theirs.
insert into auth.users (id, instance_id, aud, role, email) values
    ('11111111-1111-1111-1111-111111111111',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1@example.com'),
    ('22222222-2222-2222-2222-222222222222',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u2@example.com');

insert into planner_weeks (user_id, week_start, ended, projects) values
    ('11111111-1111-1111-1111-111111111111', '2026-08-03', false, '[]'::jsonb),
    ('11111111-1111-1111-1111-111111111111', '2026-07-27', true, '[]'::jsonb),
    ('22222222-2222-2222-2222-222222222222', '2026-08-03', false, '[]'::jsonb);

insert into old_planner_state (user_id, tasks, archives) values
    ('11111111-1111-1111-1111-111111111111', '[]'::jsonb, '[]'::jsonb);

-- --- schema and privileges ------------------------------------------------

select has_function('public', 'delete_own_account', array[]::text[],
    'the delete rpc exists');

select is(
    (select prosecdef from pg_proc
      where oid = 'public.delete_own_account()'::regprocedure),
    true,
    'it is security definer -- without that it cannot reach auth.users at all');

select ok(
    not has_function_privilege('anon', 'public.delete_own_account()', 'execute'),
    'anon cannot execute the rpc');

select ok(
    has_function_privilege('authenticated', 'public.delete_own_account()', 'execute'),
    'authenticated can execute the rpc');

-- --- deleting your own account, as a real signed-in user ------------------

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select lives_ok(
    $$ select delete_own_account() $$,
    'a signed-in user can delete their own account');

reset role;

select is(
    (select count(*) from auth.users
      where id = '11111111-1111-1111-1111-111111111111'),
    0::bigint,
    'the account row is gone');

select is(
    (select count(*) from planner_weeks
      where user_id = '11111111-1111-1111-1111-111111111111'),
    0::bigint,
    'their weeks cascade with it');

select is(
    (select count(*) from old_planner_state
      where user_id = '11111111-1111-1111-1111-111111111111'),
    0::bigint,
    'their legacy row cascades with it');

-- --- the blast radius stops at the caller ---------------------------------
-- The assertion that matters most: RLS is off inside the body, so only the
-- auth.uid() predicate keeps this from being a delete of the whole table.

select is(
    (select count(*) from planner_weeks
      where user_id = '22222222-2222-2222-2222-222222222222'),
    1::bigint,
    'a bystander''s weeks are untouched');

-- --- a caller with no account behind their claim --------------------------
-- u1's own jwt, replayed after their account is gone: nothing left to match, so
-- the function refuses rather than reporting a deletion that did not happen.

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select throws_ok(
    $$ select delete_own_account() $$,
    'P0002',
    'no account to delete',
    'a claim with no account behind it is refused, not silently accepted');

reset role;

select * from finish();
rollback;

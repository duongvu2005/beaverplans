-- Self-service account deletion.
--
-- Supabase exposes no client-side delete on purpose: auth.admin.deleteUser needs
-- the service key, which must never reach a browser. The two ways round that are
-- an Edge Function holding the key, or this -- a security definer function that
-- deletes exactly one row, the caller's own. The second needs no new deployment
-- target, which is what decides it for an app with no server of its own.
--
-- security definer means RLS does NOT apply inside the body, so auth.uid() is the
-- only thing standing between a caller and someone else's account. It sits in the
-- delete's own where clause rather than in a check before it, so there is no
-- window between establishing the identity and acting on it, and no way to reach
-- the delete having skipped the test.

create function delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    deleted integer;
begin
    delete from auth.users where id = auth.uid();
    get diagnostics deleted = row_count;

    -- Not the security boundary -- an unauthenticated caller has a null
    -- auth.uid(), `id = null` matches nothing, and the grant below keeps anon out
    -- of the body entirely. This only turns a silent no-op into an answer, so the
    -- client can tell "deleted" from "nothing happened and you are still signed
    -- in".
    if deleted = 0 then
        raise exception 'no account to delete'
            using errcode = 'no_data_found';
    end if;
end;
$$;

-- planner_weeks and old_planner_state both reference auth.users(id) on delete
-- cascade, so a user's rows go with the row above in one statement. Any table
-- added later that stores per-user data MUST carry that cascade too: without it,
-- deleting an account fails on the foreign key rather than taking the data along.

-- anon is revoked explicitly, not just via public: Supabase's default privileges
-- grant execute on new public functions to anon outright, and revoking public
-- does not remove an explicit grant. Same trap that hid the anon grant on
-- migrate_old_planner.
revoke execute on function delete_own_account() from public, anon;
grant execute on function delete_own_account() to authenticated;

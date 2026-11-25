#!/usr/bin/env bash
# Concurrency test for migrate_old_planner: two devices signing in at once must
# produce exactly one import.
#
# Not a pgTAP test because pgTAP runs everything in a single transaction, and
# this needs two real connections racing. Run with `npm run test:db:race`
# (supabase start must be running).
set -euo pipefail

CONTAINER=supabase_db_beaverplans
USER_ID=44444444-4444-4444-4444-444444444444

if ! docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    echo "FAIL: $CONTAINER is not running -- start it with: npx supabase start"
    exit 1
fi

psql() { docker exec -i "$CONTAINER" psql -U postgres -q "$@"; }

cleanup() {
    psql -c "delete from auth.users where id = '$USER_ID';" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

psql -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id) values ('$USER_ID');
insert into old_planner_state (user_id, tasks, archives, week_start)
values ('$USER_ID', '[]'::jsonb, '[]'::jsonb, '2026-08-03');
SQL

# A claims the flag and then holds its transaction open, so B is guaranteed to
# arrive while the claim is uncommitted -- the exact interleaving that a naive
# check-then-write would get wrong.
psql <<SQL >/tmp/race-a.out 2>&1 &
begin;
set local role authenticated;
set local request.jwt.claim.sub = '$USER_ID';
select migrate_old_planner('[{"weekStart":"2026-08-03","ended":false,"projects":[{"id":"a","name":"FROM A","tasks":[]}]}]'::jsonb);
select pg_sleep(3);
commit;
SQL
A_PID=$!

sleep 1

psql <<SQL >/tmp/race-b.out 2>&1 || true
begin;
set local role authenticated;
set local request.jwt.claim.sub = '$USER_ID';
select migrate_old_planner('[{"weekStart":"2026-08-03","ended":false,"projects":[{"id":"b","name":"FROM B","tasks":[]}]}]'::jsonb);
commit;
SQL

wait $A_PID

weeks=$(psql -tAc "select count(*) from planner_weeks where user_id = '$USER_ID';")
winner=$(psql -tAc "select projects->0->>'name' from planner_weeks where user_id = '$USER_ID';")
b_refused=$(grep -c "already migrated" /tmp/race-b.out || true)

fail=0
[ "$weeks" = "1" ] || { echo "FAIL: expected 1 week, got $weeks"; fail=1; }
[ "$winner" = "FROM A" ] || { echo "FAIL: expected A to win, got '$winner'"; fail=1; }
[ "$b_refused" -ge 1 ] || { echo "FAIL: B was not refused; it saw:"; cat /tmp/race-b.out; fail=1; }

if [ "$fail" = "0" ]; then
    echo "ok - B blocked on A's claim, then was refused; exactly one import (A's)"
    echo "Result: PASS"
else
    echo "Result: FAIL"
fi
exit "$fail"

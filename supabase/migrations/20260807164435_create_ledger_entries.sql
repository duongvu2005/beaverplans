-- The donation hub's ledger: every donation in and every expense out, for
-- donations.beaverplans.com. Reproduced from the original project so this one
-- can host it after the consolidation.
--
-- Two changes from the original, both deliberate:
--   * fee / net are gone. PayPal fees reach the balance as their own monthly
--     'out' row, so a per-donation fee column was a second representation of
--     the same money -- summing it would double-count. Dropping it also drops
--     the temptation: `net` in particular looked computable and was not.
--   * the projects table is gone. One row, read by one lookup in the SePay
--     webhook, now hardcoded there.

create table ledger_entries (
    id           uuid primary key default gen_random_uuid(),
    occurred_at  timestamptz not null default now(),  -- when the money moved
    direction    text not null check (direction in ('in', 'out')),
    source       text not null,                        -- 'kofi' | 'bidv' | vendor
    description  text,                                 -- safe, generic public label
    amount       numeric(14,2) not null,               -- gross, original currency
    currency     text not null default 'VND',
    -- Nullable on purpose: the Ko-fi webhook leaves it null for an unrecognised
    -- currency, which records the donation without counting it toward the
    -- balance until someone backfills the conversion. not null would lose it.
    amount_vnd   numeric(16,2),
    external_id  text unique,                          -- webhook dedup key
    raw_content  text,                                 -- PRIVATE: donor name / phone / email
    ref_code     text,                                 -- transaction reference, safe to show
    donor_name   text,                                 -- only filled when the donor opted public
    message      text,                                 -- reserved for a supporter wall
    project      text,                                 -- free tag; no FK since projects is gone
    is_public    boolean not null default true,
    created_at   timestamptz not null default now()    -- when the row was written
);

create index ledger_entries_occurred_at_idx on ledger_entries (occurred_at);

alter table ledger_entries enable row level security;

-- No policy for anon or authenticated, so the base table is unreadable with the
-- public key -- that is what keeps raw_content private. The webhooks write with
-- the service_role key, which bypasses RLS entirely.
grant select, insert, update on ledger_entries to service_role;

-- The only thing the browser reads. Safe columns only: raw_content, donor_name,
-- message and is_public are excluded. Left as a security-definer view (the
-- Postgres default) on purpose -- it is owned by postgres and so bypasses the
-- base table's RLS. Setting security_invoker = on would make anon inherit the
-- deny and silently return zero rows.
create view public_ledger as
    select occurred_at, direction, source, description,
           amount, currency, amount_vnd, project, ref_code
    from ledger_entries
    where is_public = true
    order by occurred_at desc;

grant select on public_ledger to anon;

-- Summary cards. An aggregate rather than a client-side sum: totalling in the
-- browser means selecting every row, and PostgREST caps a response at 1000, so
-- the balance would start quietly under-reporting once the ledger got that long.
create view public_ledger_totals as
    select
        coalesce(sum(amount_vnd) filter (where direction = 'in'), 0)  as donations_vnd,
        coalesce(sum(amount_vnd) filter (where direction = 'out'), 0) as expenses_vnd
    from ledger_entries
    where is_public = true;

grant select on public_ledger_totals to anon;

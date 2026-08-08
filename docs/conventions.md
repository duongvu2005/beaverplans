# Conventions

Coding conventions for beaverplans. Conventions drawn from
[MIT 6.102](https://web.mit.edu/6.102/www/sp26/) note the relevant reading; the rest are
project choices.

## Folder layout & import direction — project convention

```
src/
  core/          pure domain logic. NO React, NO storage, NO DOM imports. ever.
                 one small, spec'd module per domain concern — e.g. dates.ts,
                 deadline.ts, projects.ts (the project/task/subtask tree),
                 progress.ts (progress math), types.ts (domain types, no
                 functions) — each with a colocated test file.
  storage/       persistence layer. Depends on core/, never the reverse. One
                 `Backend` interface (see Storage, below) with one or more
                 implementations behind it, plus a facade that picks which is
                 active.
  components/    the React layer. Depends on core/ and storage/, never the
                 reverse. See architecture.md for the current component tree,
                 state ownership, and props flow — kept there rather than
                 here because it is a living diagram, not a fixed convention.
```

Tests are **colocated**: `x.ts` sits next to `x.test.ts` (`x.tsx` next to `x.test.tsx`
in `components/`).

One-way dependency rule: `core/` depends on nothing else in `src/`. It is pure and
independently testable, so it may not import from any layer added later. `storage/`
depends on `core/` only. `components/` may depend on both. Each layer may depend on
layers before it in this list, never after.

## Specifications — 6.102 readings 04–05

Every exported function carries a spec comment. A spec is a precondition (what the caller
must guarantee) plus a postcondition (what the function guarantees back), written
declaratively — *what*, not *how* — and never mentioning the implementation/rep. The
course phrases these as `requires` / `effects`; we fold them into this template:

```ts
/**
 * One-sentence summary of WHAT (not how).
 *
 * @param x  requirement on x (precondition). If none, say "any".
 * @returns  postcondition, phrased so a client could test it.
 * @throws   condition under which it throws. Omit this line entirely if it never throws.
 */
```

Two project-wide defaults that specs assume silently — annotate a function only when it
**breaks** the default:

- Functions do not mutate their arguments. Note it only when one does.
- Functions are deterministic. Note it only when one is not (uses randomness, reads the
  clock, or returns any-valid-result rather than a pinned-down value).

## Abstract Data Types — 6.102 readings 06–07

An ADT (a type whose invariant is stronger than its structural shape — for example,
"every id in this tree is globally unique") carries three things as a comment directly
above the type:

```ts
// Abstraction function:
//   AF(rep) = plain-language description of what a value of this rep represents
// Rep invariant:
//   the properties every value of this type must satisfy
//   checkRep = <validator function>, which tests this whole invariant.
// Safety from rep exposure:
//   why a client holding a reference to this value's fields cannot break the RI
```

`checkRep` is a plain function (there are no classes in `core/`), named `isValid<Type>`
and returning a boolean rather than throwing, so it doubles as a test oracle: assert it
on a producer's output inside tests. It is never called on a production code path —
constructing an invalid value directly (bypassing the producers) is a bug the type
system does not catch, and `checkRep` is how tests catch it instead.

Immutability is what keeps "safety from rep exposure" a short argument: every field is
`readonly`, every array is a `ReadonlyArray`, and producers never mutate their input —
they return a new value, sharing unchanged substructure by reference. For an ADT built
this way, the safety argument is usually one sentence: readonly fields, readonly
children, producers return new values.

## Testing — 6.102 reading 02

Test-first, always: write the spec, write the tests, watch them **fail**, then implement to
green. A test that never failed proves nothing.

Design the suite by **partitioning the input space** into disjoint, complete, nonempty
subdomains, and include **boundary values** as their own single-element subdomains (bugs
cluster at boundaries). Document the partition in a `Testing strategy` comment at the top of
the `describe`, and name each test for the subdomain(s) it covers:

```ts
describe("clamp", () => {
  /*
   * Testing strategy
   *
   * partition on x vs [lo, hi]:
   *   x < lo; x = lo; lo < x < hi; x = hi; x > hi
   * partition on bounds:
   *   lo = hi
   */

  it("covers x < lo", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  // ...
});
```

### Database tests — project convention

Schema, row-level security, and any SQL function are tested too, with
[pgTAP](https://pgtap.org/) — a test framework that runs inside Postgres. Tests live in
`supabase/tests/*.sql` and need the local stack up (`npx supabase start`):

```
npm run test:db
```

A pgTAP file plans a number of assertions, runs them, and rolls back, so fixtures never
persist:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select has_column('public', 'my_table', 'my_column', 'the column exists');
select throws_ok($$ select my_function('bad') $$, 'P0002', 'refused', 'bad input is refused');

select * from finish();
rollback;
```

Test policies and grants **as the role a browser actually uses**, not as the superuser
running the file — `set local role authenticated` plus `set local request.jwt.claim.sub`
makes `auth.uid()` resolve, so RLS applies for real. A privilege assertion that passes as
`postgres` proves nothing, because superusers bypass RLS.

Anything needing two connections at once cannot be a pgTAP test, since the whole file is one
transaction. Those go in a shell script beside it (`supabase/tests/race.sh`, run with
`npm run test:db:race`).

## TypeScript — project convention

- `strict: true` and `noUncheckedIndexedAccess: true` are on. `arr[i]` and `obj[key]` are
  `T | undefined` — handle the miss, do not paper over it.
- No `any`.
- No `!` non-null assertion without an adjacent comment justifying why it is safe.
- Immutable by default: domain data is `readonly`; state updates return new objects rather
  than mutating in place.

## Comments — project convention

A comment is written for someone reading the file cold, with no memory of how it came to
look that way. Two kinds earn their place:

- **What the code does**, where the names alone do not carry it — a non-obvious invariant,
  a precondition the caller must respect, why a branch is unreachable, why a `!` is safe.
- **Why this shape and not the obvious one** — name the alternative a reader would reach
  for and what rules it out.

Everything else belongs in `docs/`, in the commit message, or nowhere:

- **Change narration.** "This previously did X", "no longer gates Y", "used to be a
  `Record`". That is a note to whoever reviewed the change. A later reader does not know
  what X was and cannot tell whether the note is still true.
- **Status and dates.** "Currently", "for now", "as of today". Code is in the present
  tense; a comment claiming otherwise goes stale in silence.
- **Restating a good name.** If the comment and the identifier say the same thing, delete
  the comment.

Note that "no longer" is fine when it describes *runtime* state — "a session that is no
longer current", "the day will no longer count as missed". The rule is about the history
of the code, not the history of the data.

The test: delete the comment and ask what a stranger loses. If what they lose is context
about how the project got here rather than about the code in front of them, it belongs in
`docs/` — `known-issues.md` for a hazard, this file for a rule.

## Storage — 6.102 reading 08

`storage/` exposes one interface (`Backend`) and one or more implementations behind it,
plus a facade that picks which implementation is active and delegates every call to it.
The rest of the app is written against the interface, never against a concrete backend.

Every `Backend` read is synchronous, answered from an in-memory cache; the only
asynchronous method is `load()`, which populates that cache once. This is a deliberate
choice, not an accident of the first implementation — the app renders synchronously off
whatever is in memory, and `load()` is the one explicit place a caller has to wait.
Record that choice as a comment on the interface itself when you add a second
implementation, so it can't quietly reintroduce an async read.

Test a `Backend` implementation against an injected fake of whatever it wraps (a narrow
interface covering only the methods actually used — not the real browser API or a real
network client), so the suite runs without a browser and can hit failure partitions
(corrupt stored data, a write that throws) a real store can't be coerced into on demand.

## Type in the interface — project convention

Two families, two jobs. The tokens in `index.css` say which face is which; this says what
each one *means* on a control.

- **Mono, uppercase (`--mono`)** — navigation. A control in mono caps moves you somewhere
  and changes nothing: the app's three tabs, the day rail, weekday headers, section
  eyebrows.
- **Sans, sentence case (`--sans`)** — action. A control that changes something is sans:
  every button in a dialog, in the week header, in the top bar's right cluster.

The split is worth keeping because the two kinds of control sit inches apart — the tab row
and the week header's buttons are 24px away from each other — and because it means a
reader never has to click a thing to find out whether it is safe. When adding a control,
pick the family from what the control does, not from what looks good in the row.

## Terminology — project convention

The three levels have fixed names in code:

| name         | meaning                                          |
|--------------|--------------------------------------------------|
| **Project**  | top-level item: title + deadline                 |
| **Task**     | child of a project, schedulable                  |
| **Subtask**  | one day-slice of a task: `{ day, done, missed }` |

So `Project.tasks: Task[]` and `Task.subtasks: Subtask[]`. Use these names consistently;
do not reintroduce ambiguous ones like "item" or "slot".

## Git — project convention

- Commit message says **what** changed, not how.
- Stage files explicitly rather than committing everything blindly.

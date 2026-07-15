# Conventions

Coding conventions for beaverplans. Conventions drawn from
[MIT 6.102](https://web.mit.edu/6.102/www/sp26/) note the relevant reading; the rest are
project choices.

## Folder layout & import direction — project convention

```
src/
  core/          pure domain logic. NO React, NO storage, NO DOM imports. ever.
    math.ts      + math.test.ts
    types.ts     (domain types; no functions)
  storage/       persistence layer. Depends on core/, never the reverse.
    backend.ts       the Backend interface: load, get/set the week plan and
                     archive, reset. Implementation-independent specs.
    localBackend.ts  LocalBackend implements Backend over an injected
                     KeyValueStore (a narrow slice of the Web Storage API),
                     so the real localStorage or a fake can be supplied.
                     + localBackend.test.ts
```

Tests are **colocated**: `x.ts` sits next to `x.test.ts`.

One-way dependency rule: `core/` depends on nothing else in `src/`. It is pure and
independently testable, so it may not import from any layer added later. Later layers may
depend on `core/`, never the reverse. (Other directories will be documented here when they
exist.)

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

## TypeScript — project convention

- `strict: true` and `noUncheckedIndexedAccess: true` are on. `arr[i]` and `obj[key]` are
  `T | undefined` — handle the miss, do not paper over it.
- No `any`.
- No `!` non-null assertion without an adjacent comment justifying why it is safe.
- Immutable by default: domain data is `readonly`; state updates return new objects rather
  than mutating in place.

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

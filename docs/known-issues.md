# Known issues

A record of bugs whose cause has been traced, kept after they are fixed. A fix that no test
can assert is only ever "not reproducing".

Each entry gives the symptom, a repro, the cause, the fix, and the regression risk. Status
is **fixed**, **watching** (fixed, but nothing would fail if it came back), or **open**.

It also carries **hazards**: things review has established no test can catch, which have
not gone wrong yet. They are here rather than in a code comment because the comment would
sit in the file that is correct, and the mistake happens in the one that changes.

Companion documents: [architecture.md](./architecture.md) for the React layer,
[conventions.md](./conventions.md) for coding rules.

---

## Unpainted band flashes over the dialog on open

**Status:** watching — fixed 2026-07-27.

**Symptom.** Opening a dialog painted a flat gray band over roughly the bottom third of the
viewport for one frame. The band covered the dialog itself and was a color that appears
nowhere in the token palette, distinct from the scrim's translucent wash.

**Repro.** Reduce the board to one project holding one task with undone subtasks, narrow
the viewport below 640px so the dialog takes its bottom-sheet layout, then open that task's
delete confirmation. Deterministic on the first open after the board shrinks, intermittent
afterward.

**Cause.** The scroll lock was `body.dialogOpen { position: fixed }`. Taking `<body>` out of
flow leaves `<html>` with no in-flow content, so the document height collapsed to `0` on
every open and sprang back on every close:

| | closed | open |
| --- | --- | --- |
| `html` height | 957 | **0** |
| `body` position | static | fixed |
| `body` top | 0 | `-scrollY` |

That invalidates the whole document twice per open/close cycle. With a full-viewport scrim
rasterizing for the first time in the same frame, the compositor could present before the
new tiles were ready, leaving the region with no layer behind it showing through.

Layout was correct on every sampled frame — `body`, `#root` and the scrim each measured
exactly the viewport height throughout. That excluded a gap, a stray element, and the
`z-index` tie between the scrim and the phone tab bar.

**Fix.** Lock the scroll container rather than unmooring the body
([`Dialog.module.css`](../src/components/shared/Dialog.module.css)):

```css
html.dialogOpen {
    overflow-y: hidden;
}
```

`<html>` keeps its height and `<body>` stays in flow, so the scroll offset is never
disturbed and the save/restore the old lock performed on close is no longer needed.

**Not the cause.** React `StrictMode` double-invokes the lock effect in development, a real
lock → unlock → lock cycle on every open. A `MutationObserver` recorded all six attribute
writes at one identical timestamp, inside a single synchronous commit, with no paint
between them.

**Regression risk.** The symptom is a compositor artifact and no unit test can catch it; the
cause is testable, by asserting that opening a dialog leaves `document.documentElement`
geometry unchanged. `position: fixed` on the body is the conventional scroll-lock recipe and
the one older iOS Safari required, so reaching for it again reintroduces the band.

**iOS.** Locking `<html>`'s overflow is honored from iOS Safari 15.4, and the scrim carries
`overscroll-behavior: contain` so a scroll reaching the end of the sheet does not chain to
the page. Unverified on a physical device.

---

## Hazard: the realtime resubscribe handler is not reachable by any test

**Status:** open, accepted — recorded 2026-08-08.

**What.** [`storage/instance.ts`](../src/storage/instance.ts) binds the Realtime channel and
re-fetches on every `SUBSCRIBED`, not only on a row event. That is real recovery logic with
a real failure mode: while the socket was down no event could arrive, and the ones fired
meanwhile are gone for good, so without the re-fetch a slept laptop stays stale until it is
reloaded.

**Why nothing covers it.** The callback is welded to the module-level `supabase` singleton
this file exists to construct, so there is no seam to inject a fake through. The file is
excluded from coverage in [`vite.config.ts`](../vite.config.ts) with that reason written in.

**The risk.** Every other name on that exclusion list is there because it has no behaviour —
static SVG, a mount call, types erased at compile time. This one is there despite having
behaviour, so it is the single place where "excluded" and "nothing to test" have come apart.
A future edit to the callback inherits the exclusion silently.

**What to do about it.** Nothing now — the callback is four lines and the binding it needs is
genuinely at the composition root. But it must not grow in place: anything more than "an
event happened, go look" moves into a testable module first, the way `RemoteWatcher` is
already injected into `CloudBackend` for exactly this reason.

---

## Hazard: both week panes hang off one container-query name

**Status:** open, accepted — recorded 2026-08-08.

**What.** [`App.css`](../src/App.css) renders `.weekGridPane` and `.focusPane` both, always;
which one is visible is decided entirely by `@container app (…)` rules. Drop or rename the
`app` container on the root element and neither rule matches, so **both panes render at
once** — the full seven-column grid and the focus pane stacked, every subtask control on
screen twice.

**Why nothing covers it.** jsdom applies no stylesheet, so it already shows both. The broken
state is indistinguishable from the normal test environment, which means no assertion can
tell them apart — including one written specifically to try.

**The risk.** Low likelihood, loud symptom, and a single point of failure with nothing
guarding it. The container name is also load-bearing in JS:
[`useContainerWidth.ts`](../src/hooks/useContainerWidth.ts) measures the same
`[data-app-container]` box, so the two would break together and for one reason.

**What to do about it.** Know this before refactoring the container root. If the panes ever
stop being purely CSS-selected, the honest fix is to choose between them in the component —
`useIsDesktop` already does exactly that for the guest-merge prompt — rather than to render
both and hide one.

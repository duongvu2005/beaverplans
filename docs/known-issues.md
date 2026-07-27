# Known issues

A record of bugs whose cause has been traced, kept after they are fixed. A fix that no test
can assert is only ever "not reproducing".

Each entry gives the symptom, a repro, the cause, the fix, and the regression risk. Status
is **fixed**, **watching** (fixed, but nothing would fail if it came back), or **open**.

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
([`Dialog.module.css`](../src/components/Dialog.module.css)):

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

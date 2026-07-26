# Architecture

How the running app is put together: who owns which piece of state, what each component
computes, what it hands to which child, and what it renders. Domain rules live in `core/`;
this document covers the React layer on top of it.

Companion documents: [conventions.md](./conventions.md) for coding rules,
[week-model.md](./week-model.md) for the week and day model.

## Contents

Everything below is covered in this order.

```
App                              owns plan: WeekPlan, view, open-dialog ids
│
├── Plan view
│   ├── ProjectView              heading only, spreads props
│   │   └── ProjectList          maps projects, add-project button, owns
│   │       │                    project/task drag-and-drop
│   │       └── ProjectCard      one project: name, deadline, progress bar, task list
│   │           └── TaskRow      one task: checkbox, name, points stat, actions
│   │
│   └── WeekView                 owns selectedDay + mode, derives the schedule
│       ├── WeekGrid             7 columns
│       │   └── DayColumn        one day's heading (+ points stat) and cells
│       │       └── DayCell      one scheduled subtask
│       ├── DayRail              7 weekday pills with progress
│       └── FocusedDay           one day in full
│           └── DayCell          same component, not compact
│
└── Overlay system
    ├── Dialog                   base: portal, scrim, focus, Escape stack
    ├── TaskEditor               owns a draft of the task being edited, and
    │   │                        subtask drag-and-drop within that draft
    │   └── SubtaskRow           one draft subtask
    │       └── WeightChip       pips, opens a sheet on coarse pointers
    │           └── WeightDots   fine-pointer variant
    ├── ProjectEditor            one project's deadline, with a clear affordance
    ├── MovePopover              owns picked day + mark-missed
    └── ConfirmDialog            Dialog plus a standard foot; reused for clearing
                                 a missed day and for delete-with-children confirms

Progress display (presentation, not domain logic)
    PointsStat                   "n/total" text, optional "pts" suffix
    ProgressBar                  a filled bar, width = percent
    both take the same {done, total} shape core/progress already returns

Drag and drop (dnd-kit)
    ProjectList                  DndContext + SortableContext for projects and tasks
    TaskEditor                   DndContext + SortableContext for subtasks in the draft
    dndReorder                   shared pure helper: dnd-kit's drop event -> the
                                  beforeId the core reorder producers take

Kit          Grip, CloseIcon, EditIcon, MoveIcon, DeadlineIcon
Shared CSS   checkbox, rowKit, dialogShell, moveUi
```

Four components own state: `App`, `WeekView`, `TaskEditor`, and `ProjectList` (its own
drag-and-drop). Everything else is a function of its props.

## State ownership

There is exactly one source of truth for user data: the `WeekPlan` held by `App`. Every
edit goes through a pure producer in `core/projects.ts`, which returns a new plan.

Every hand-off is drawn, with labels, in the
[props flow diagram](./diagrams/props-flow.svg) further down.

The four state owners hold four different kinds of state, and the distinction is the
point:

**`App` owns user data.** The plan is what gets saved. Everything below edits it by calling
a callback, never directly.

**`WeekView` owns view state.** Which day you are looking at, and grid versus focus mode.
This is not user data: it does not need saving, does not belong in the plan, and no other
part of the app needs to read it.

**`TaskEditor` owns a draft.** While it is open, its copy of the subtasks and the plan
disagree, which is exactly what makes Cancel work. It is the one place no producer from
`projects.ts` runs: every one of them is typed over `WeekPlan`, and the editor holds a
detached list of subtasks. It does still use `core/`, calling `parseDeadline` when it opens
and `buildTask` when it saves.

Note that both approaches to editing exist in the app on purpose. Name fields in
`ProjectCard` and `TaskRow` are controlled inputs that run a producer per keystroke, with
no draft, because there is nothing to cancel. A dialog that edits several fields at once
needs a draft so Cancel can revert all of them together.

**`ProjectList` owns drag-and-drop state**, via [dnd-kit](https://dndkit.com): which
item is active, and a live `preview` array of projects used only while a task is
dragged across a project boundary — same-project reordering is left entirely to
dnd-kit, which opens the gap itself, because touching state there would fight its
animation and loop. `TaskEditor` owns the identical shape (`activeId` + a preview array
of subtasks) for dragging within its draft. Both feed the same pure helper,
`dndReorder.beforeIdForDrop`, which turns "what the pointer is over" into the `beforeId`
the core reorder producers (`reorderProject`, `reorderTask`, and the draft-local
subtask move) actually take. Neither owner reorders eagerly on every `dragover`: only a
*cross*-container move touches `preview`, and the commit in `onDragEnd` reads the
landing spot from that preview (or the untouched list, for a same-container drag) so
what gets committed always matches what the user was already looking at.

`ProjectList` also runs a custom `collisionDetection` (`closestCorners`, filtered to the
draggable's own kind) so a project drag only ever resolves against other projects and a
task drag only against task rows and project drop zones — without it, a nested task row
would swallow a project drop before the project list itself got a chance to open a gap.
`TaskEditor`'s drag-over handler additionally gates each candidate day through
`canMoveSubtaskTo`, so a subtask can never preview a landing on a day the miss rule
forbids — the same rule `MovePopover` applies to its day pills.

## Component tree

```mermaid
flowchart TD
    App --> ProjectView --> ProjectList --> ProjectCard --> TaskRow
    ProjectCard --> ProgressBar1["ProgressBar"]
    TaskRow --> PointsStat1["PointsStat"]
    App --> WeekView
    WeekView --> WeekGrid --> DayColumn --> DayCell
    DayColumn --> PointsStat2["PointsStat"]
    WeekView --> DayRail
    WeekView --> FocusedDay --> DayCell2["DayCell"]
    App --> TaskEditor --> SubtaskRow --> WeightChip --> WeightDots
    App --> ProjectEditor
    App --> MovePopover
    App --> ConfirmDialog
    TaskEditor -.-> Dialog
    ProjectEditor -.-> Dialog
    MovePopover -.-> Dialog
    ConfirmDialog -.-> Dialog
    WeightChip -.-> Dialog2["Dialog"]
```

`DayCell` appears twice on purpose: the same component renders both a cell in the 7 column
grid (with `compact`) and a row in the focused single-day view.

`Dialog` is drawn with dashed edges because it is a wrapper, not a child. Everything modal
renders through it, and it is what puts the panel in a portal on `document.body`.

## Derivation and hand-off

What each component computes, and what it passes to which specific child. Components that
compute nothing are worth noting as such: a pure pass-through is a design choice, not an
omission.

![Props flow with derivations](./diagrams/props-flow.svg)

The same information follows in text, one block per component, in tree order — text is
the source of truth where the two disagree. The diagram covers `ProjectEditor` and the
`MovePopover`/`ConfirmDialog` overlays as their own column; drag-and-drop ownership and
the `PointsStat`/`ProgressBar` components are noted in its footer rather than drawn as
boxes, to keep it readable.

Unlike the callbacks below, drag-and-drop needs nothing threaded down from a parent:
every draggable or droppable component calls dnd-kit's own hooks (`useSortable` /
`useDroppable`) directly with just its own id and a small `data` tag saying what kind of
node it is (`ProjectCard`, `TaskRow`, `SubtaskRow` each do this). `ProjectList` and
`TaskEditor` own the `DndContext` those hooks register into, but that context is
ambient, not a prop — so it is left out of the blocks below the same way an ordinary
React context would be.

### App

```
owns       view, plan, editingTaskId, editingDeadlineId, movingSubtaskId,
           clearing, removing
computes   today            = todayKey()
           editingProject   = the project whose tasks contain editingTaskId
           editingTask      = that project's task with editingTaskId
           deadlineProject  = plan.projects.find(p => p.id === editingDeadlineId)
           moving           = findSubtask(plan, movingSubtaskId)
                              -> { subtask, taskName, projectName }
passes     projects, 11 callbacks                          -> ProjectView
           projects, weekStart, today, 4 callbacks         -> WeekView
           editingTask, editingProject.name                -> TaskEditor
           deadlineProject                                 -> ProjectEditor
           moving.*, weekStart, today                      -> MovePopover
           clearing.*                                      -> ConfirmDialog (clear)
           removing.*                                      -> ConfirmDialog (delete)
```

Dialogs are driven by a stored id, not a boolean. `App` looks the id up in the *current*
plan each render and renders the dialog only when the lookup succeeds, so a stale id
renders nothing rather than rendering against missing data.

`findSubtask` is a local helper that walks the tree for a subtask id and returns it with
its parent names, which the dialogs need for their headings.

`ConfirmDialog` is instantiated twice with different driving state (`clearing` and
`removing`), never both at once — they share a component, not an identity.

### ProjectView

```
receives   projects, 11 callbacks                          from App
computes   nothing
passes     all of it, unchanged, via {...props}            -> ProjectList
```

It exists only to add the "Projects" heading. Worth knowing so you do not go looking for
logic here.

### ProjectList

```
receives   projects, 11 callbacks                          from ProjectView
owns       active drag id, a preview project order (cross-project task drags only)
computes   nothing (see Drag and drop, below)
uses here  onAddProject                                    (the add-project button)
passes     project, 8 callbacks, one per project            -> ProjectCard
```

### ProjectCard

```
receives   project, 8 callbacks                            from ProjectList
computes   projectProgress(project)                        -> ProgressBar
uses here  onRenameProject, onRemoveProject, onAddTask, onEditDeadline
passes     task, projectId, onEditTask, onToggleTask,
           onRenameTask, onRemoveTask, one per task        -> TaskRow
```

### TaskRow

```
receives   task, projectId, 4 callbacks                    from ProjectCard
computes   isTaskDone(task)     the checkbox state
           undated              task has no subtasks
           taskProgress(task)   -> PointsStat, skipped when undated
passes     nothing (leaf)
```

A task with no subtasks is a leaf and stores its own `isDone`. A task with subtasks derives
doneness from them, which is why the checkbox reads `isTaskDone(task)` and not
`task.isDone`. `undated` drives the nudge toward assigning days.

### WeekView

The only non-root component that both owns state and derives values.

```
receives   projects, weekStart, today, 4 callbacks         from App
owns       selectedDay, mode
computes   schedule = scheduleByDay(projects)     7 days, each with its entries
           byDay    = progressByDay(projects)     per-day assigned and done weight
           todayDay = todayInWeek(weekStart)      undefined if not the current week
           focused  = schedule entry for selectedDay
passes     schedule, byDay, weekStart, today,
           onFocusDay + 4 callbacks                        -> WeekGrid
           byDay, selectedDay, todayDay,
           onSelectDay, onBackToGrid                       -> DayRail
           focused.items, selectedDay, isToday,
           weekStart, today, 4 callbacks                   -> FocusedDay
```

`schedule` and `byDay` are recomputed every render rather than stored. Both are pure and
cheap, and deriving them means they can never fall out of sync with the plan.

`todayDay` being `undefined` on a past or future week is what suppresses the "Focus today"
affordance there.

Both panes always render; `data-mode` plus CSS decides which is visible.

### WeekGrid

```
receives   schedule, byDay, weekStart, today, 5 callbacks  from WeekView
computes   nothing
passes     one daySchedule, progress = byDay[i], weekStart, today,
           5 callbacks, one per day                        -> DayColumn
```

### DayColumn

```
receives   daySchedule, progress, weekStart, today, 5 callbacks   from WeekGrid
computes   isMissed = daySchedule.day !== entry.subtask.assignedDay   per entry
uses here  onFocusDay                                      (the day heading, with
           progress -> PointsStat, shown when the day has any assigned weight)
passes     entry, day, isMissed, weekStart, today,
           compact = true, 4 callbacks                     -> DayCell
```

`isMissed` is the important one. A subtask appears on its assigned day and on every day it
missed, so this flag tells the cell which of the two it is being rendered as.

### DayCell

```
receives   entry, day, isMissed, weekStart, today,
           compact, 4 callbacks              from DayColumn or FocusedDay
computes   isOverdue = not missed, not done, week is current,
                       and the assigned day is past
passes     nothing (leaf)
```

`isOverdue` is gated on the week being current, so browsing a past week does not light up
every unfinished cell.

### DayRail

```
receives   byDay, selectedDay, todayDay,
           onSelectDay, onBackToGrid                       from WeekView
computes   pct = percentOf(done, assigned)                 per day
passes     nothing (leaf)
```

Clicking the already-selected pill calls `onBackToGrid`, so the rail doubles as the way out
of focus mode.

### FocusedDay

```
receives   day, items, isToday, weekStart, today,
           4 callbacks                                     from WeekView
computes   assigned  = items whose assignedDay is this day  (ghosts excluded)
           doneCount = done ones among those
passes     entry, day, isMissed, weekStart, today,
           4 callbacks, compact omitted                    -> DayCell
```

The count measures `assigned`, not `items`: ghosts of subtasks that slipped away from this
day should not inflate its workload.

### TaskEditor

```
receives   task, projectName, onClose, onSave              from App
owns       date, time, description, subtasks               the draft
computes   seed             = task.deadline, ignored unless parseDeadline says ok
           activeDays       = set of assignedDays in the draft
           activeDaysInOrder = WEEK filtered to those, so groups stay Mon..Sun
passes     subtask, onSetWeight, onSetNote, onRemove       -> SubtaskRow
on save    buildTask(task, { description, subtasks, deadline }) -> onSave
```

`buildTask` is the pure function that decides leaf versus parent, drops a blank
description, and refuses to store an unparseable deadline. On open, a stored deadline that
does not parse is ignored rather than shown, so a corrupt value cannot be silently
rewritten by opening and saving.

Its five draft handlers, `toggleDay`, `addSubtaskOn`, `removeSubtask`, `setSubtaskWeight`
and `setSubtaskNote`, duplicate logic that exists as producers, for the typing reason given
under State ownership.

### SubtaskRow

```
receives   subtask, onSetWeight, onSetNote, onRemove       from TaskEditor
computes   nothing
passes     weight, onChange,
           label = subtask.description or undefined        -> WeightChip
```

### WeightChip and WeightDots

```
WeightChip   receives weight, onChange, label              from SubtaskRow
             owns     open        the sheet
             passes   weight, onChange                     -> WeightDots

WeightDots   owns     hint        which level is hovered or focused
```

Two presentations of one control. `WeightDots` is the fine-pointer version: three radio
segments with a hover hint. `WeightChip` shows the same pips as a button that opens a bottom
sheet on coarse pointers, with named options and what each counts for. CSS decides which is
visible; both call the same `onChange`.

### ProjectEditor

```
receives   project, onClose, onSave                        from App
owns       date, time                                       the draft
computes   seed = project.deadline, ignored unless parseDeadline says ok
on save    date ? (time ? `${date}T${time}` : date) : undefined -> onSave
passes     nothing (leaf)
```

The same shape as `TaskEditor`'s deadline field, deliberately: a stored deadline that
does not parse is ignored on open rather than shown, so a corrupt value cannot be
silently rewritten by opening and saving. Unlike `TaskEditor`, there is nothing else to
draft, so `App` skips the id-lookup dance and passes the `Project` directly.

### MovePopover

```
receives   subtask, taskName, projectName,
           weekStart, today, onMove, onClose               from App
owns       picked, markMissed
computes   assignedIndex, latestMissedIndex
           fromPast   = the current assigned day is in the past
           disabled   per day: is current, or at/before latest missed,
                      or past within the live week
           willMark   markMissed and fromPast and the move goes forward
passes     nothing (leaf)
```

The disabled rule mirrors `moveSubtask`'s precondition, so an illegal move cannot be
expressed rather than being rejected after the fact. Pick-then-confirm is deliberate:
selecting a day only stages it, and Move applies it.

### Dialog

```
receives   open, onClose, labelledBy, children
owns       a module-level stack of open dialog ids, plus this dialog's id
computes   whether this dialog is topmost, for Escape
```

Only the topmost dialog responds to Escape. That is what lets the weight sheet open inside
the task editor and close by itself without dismissing the editor underneath. Clicking the
scrim closes; clicks inside the panel stop propagating so they do not.

That same stack doubles as the reference count for the background scroll lock: the page is
locked when the stack goes from empty to one and unlocked only when it returns to empty, so
a nested dialog closing cannot unlock the page while its parent is still open. The lock is
`position: fixed` on the body rather than `overflow: hidden`, because iOS Safari ignores the
latter and keeps rubber-banding; the scroll position is captured on lock and restored on
unlock, since fixing the body would otherwise jump the page to the top.

### ConfirmDialog

Pure composition: `Dialog` plus the standard head, body and Cancel/Confirm foot. Callers
supply the wording and the body content as children. Computes nothing.

## How an edit travels

Worth tracing once, because every interaction follows this path. Ticking a subtask checkbox
in the week grid:

1. `DayCell` fires `onToggleSubtask(subtask.id)`. It knows the id and nothing else.
2. The callback passes untouched through `DayColumn`, `WeekGrid`, `WeekView`.
3. `App.handleToggleSubtask` runs `setPlan(current => toggleSubtask(current, subtaskId))`.
4. `toggleSubtask` locates the subtask by id and returns a new plan, sharing every unchanged
   node by reference.
5. React re-renders. `WeekView` recomputes `schedule` and `byDay` from the new projects, so
   the grid, the rail percentages and the project tree all update together from one edit.

Note what is absent: nothing was looked up by array index, and nothing was mutated.

## Rendered shape

What each component actually puts on the page. Reading these blocks:

- `element.class` is the tag plus its CSS-module class name.
- `[.a .b]` are classes applied conditionally.
- `(if x)` marks a subtree that only renders under a condition.
- `-> handler` names the callback an element fires.

### App

```
nav.tabs                        plan | stats | archive
main.pane
└── div.plan-layout             (if view === 'plan')
    ├── ProjectView
    └── WeekView
TaskEditor                      (if editingTask)
ProjectEditor                   (if deadlineProject)
MovePopover                     (if moving)
ConfirmDialog                   (if clearing)     -- clear a missed day
ConfirmDialog                   (if removing)     -- delete confirmation
```

### ProjectView and ProjectList

```
div.projectView
├── div.head > span.eyebrow     "Projects"
└── ProjectList
    ├── ProjectCard *           one per project
    └── button.addProject       -> onAddProject
```

### ProjectCard

```
section.card
├── div.header
│   ├── span.gripHandle > Grip              drag handle (dnd-kit)
│   ├── input.name                          -> onRenameProject, controlled
│   ├── ProgressBar                         projectProgress(project)
│   └── div.actions
│       ├── button.iconBtn > DeadlineIcon   -> onEditDeadline
│       └── button.iconBtn > CloseIcon      -> onRemoveProject
├── ul.list                                 also a drop target (useDroppable)
│   └── TaskRow *
└── button.addTask                          -> onAddTask
```

### TaskRow

```
li.row
├── span.gripHandle > Grip              drag handle (dnd-kit)
├── input[checkbox].box                 -> onToggleTask, checked = isTaskDone(task)
├── input.name                          -> onRenameTask, controlled
├── button.assignHint                   (if undated) "assign days"
├── PointsStat                          (if not undated) taskProgress(task)
└── div.actions
    ├── button.iconBtn [.assignCta]     -> onEditTask
    └── button.iconBtn > CloseIcon      -> onRemoveTask
```

### WeekView

```
div.weekView [data-mode=grid|focus]
├── div.head > span.line        "Focus today" / "Focusing Wed, show all days"
├── div.weekGridPane
│   └── WeekGrid
└── div.focusPane
    ├── DayRail
    └── FocusedDay
```

### WeekGrid and DayColumn

```
div.grid
└── section.column *                    7 of them
    ├── button.day                      -> onFocusDay
    │   ├── span.dayName
    │   └── PointsStat                  progress[i], with "pts" suffix
    └── ul.list
        └── DayCell *   compact
```

### DayCell


```
li.cell [.compact .done .missed .overdue]
├── input[checkbox].box [.missedCheck]  -> onToggleSubtask
│                                          disabled + unchecked when isMissed
└── div.text                            -> onEditSubtask
    ├── div.eyebrow
    │   ├── span.project
    │   └── span.weight > span.pip x3   [.on] for pips <= weight
    ├── div.task
    ├── span.desc                       (if subtask.description)
    └── div.tagRow                      exactly one of:
        ├── missed:  span.missTag + button.clearBtn|clearPill  -> onClearMissed
        ├── overdue: span.overdueTag + button.moveBtn|movePill -> onRequestMove
        └── neither: nothing
```

A missed ghost is a historical record, so its checkbox is disabled and reads unchecked
regardless of whether the subtask was later completed elsewhere. `compact` shortens labels
and swaps pill buttons for icon buttons; it is passed by `DayColumn` and omitted by
`FocusedDay`, so the grid and the focus view can never drift apart.

### DayRail

```
div.rail
└── button.pill [.today .selected] *    7 of them
    ├── span.letter                     M T W T F S S
    └── span.bar > span.fill            width = percent
```

### FocusedDay

```
div.card
├── p.head                              "Wednesday, today"
├── p.count                             "2 of 5 done" | "nothing scheduled"
└── ul.list | p.empty
    └── DayCell *                       not compact
```

### TaskEditor

```
Dialog
├── div.head        eyebrow = project name, h3 = task name
├── div.body
│   ├── field: Deadline
│   │   └── div.deadrow > input[date] + input[time]   time disabled until date set
│   ├── field: Days
│   │   ├── div.days > button.day [.on] x7            -> toggleDay
│   │   ├── div.subs                                  (if any active day)
│   │   │   └── div.daygroup *                        one per active day
│   │   │       ├── div.daylabel
│   │   │       ├── SubtaskRow *                      that day's subtasks
│   │   │       └── button.addsub                     -> addSubtaskOn(day)
│   │   └── p.note
│   └── field: Note > textarea
└── div.foot        Cancel -> onClose | Save -> handleSave
```

### SubtaskRow

```
div.row
├── span.gripHandle > Grip              drag handle (dnd-kit)
├── input.subnote                       -> onSetNote
├── WeightChip                          -> onSetWeight
└── button.iconBtn > CloseIcon          -> onRemove
```

### WeightChip

```
span.wrap
├── span.fine > WeightDots              fine pointers
├── button.chip > pips                  coarse pointers, opens the sheet
└── Dialog                              (if open)
    └── div.sheet
        ├── div.grab + h4 + p.sheetSub
        └── button.opt [.optSel] x3     Easy / Medium / Hard
```

### ProjectEditor

```
Dialog
├── div.head        eyebrow = "Project", h3 = project name
├── div.body
│   └── field: Deadline
│       ├── button.clearDeadline        (if date) "Clear"
│       └── div.deadrow > input[date] + input[time]   time disabled until date set
└── div.foot        Cancel -> onClose | Save -> handleSave
```

### MovePopover

```
Dialog
├── div.head
├── div.body
│   ├── field: Move to
│   │   └── div.rail > button.pill [.cur .picked] x7   disabled when illegal
│   └── label.miss                      (if fromPast) "Mark Tue as missed"
└── div.foot        Cancel | Move (disabled until a day is picked)
```

## Drag and drop

[dnd-kit](https://dndkit.com) throughout (`@dnd-kit/core` + `@dnd-kit/sortable`),
replacing an earlier hand-rolled native-HTML5-DnD implementation. Two independent drag
systems exist, matching the two containers that own drag state (see State ownership):
`ProjectList` for projects and tasks, `TaskEditor` for subtasks within its draft. Each
sets up its own `DndContext` with a `PointerSensor` (5px activation distance, so
clicking a grip or typing in a name field is never mistaken for the start of a drag)
and a `KeyboardSensor` (`sortableKeyboardCoordinates`, for accessible reordering).
Touch is native to dnd-kit's pointer sensor — no separate polyfill.

Only the grip is a drag handle: each draggable component (`ProjectCard`, `TaskRow`,
`SubtaskRow`) calls `useSortable({ id, data: { type, ... } })` itself and spreads the
returned `attributes`/`listeners` onto the grip's `span`, via `setActivatorNodeRef` so
the drag originates from the grip while the whole row still moves. The `data` tag is
what a drop target reads back to know what it caught.

`ProjectList` runs a custom `collisionDetection` (`closestCorners`, filtered to the
dragged item's own kind — a project only collides with projects, a task only with task
rows and project drop zones) so a project drag can't resolve against a task nested
inside a card before the project list itself gets a chance to open a gap.

Both owners share the same commit pattern:

- **`onDragOver`** only touches state on a *cross*-container move (a task crossing into
  a different project, a subtask crossing into a different day) — same-container
  reordering is left entirely to dnd-kit's own animation, because writing state there
  would fight it and loop. A cross-container move updates a `preview` array so the
  destination visibly opens a gap before the drop.
- **`onDragEnd`** commits by reading the landing spot from that preview (or the
  untouched list, for a same-container drag) — never by recomputing against the live
  plan — and calls `dndReorder.beforeIdForDrop` to turn "the id under the pointer" into
  the single `beforeId | null` the core producers (`reorderProject`, `reorderTask`, and
  the draft-local subtask move) take. Reading from the preview instead of the plan is
  what keeps the committed order matching what the user was already looking at.
- **`DragOverlay`** renders a floating copy of the dragged row/card so it doesn't jump
  or clip against the container it's leaving.

Cross-day drags in the editor are additionally refused when the missed-day rule
forbids them (`canMoveSubtaskTo`, checked on every `dragOver`), so an illegal move
cannot be expressed rather than being rejected after the fact. That mirrors the rule
`MovePopover` applies to its own day pills.

## Where things are not wired yet

Kept current so the gaps are visible rather than surprising.

- **Stats and archive** are placeholder panes.
- **Nothing persists.** `App` seeds from a fixture; the storage layer exists and is tested
  but is not connected to the UI.
- **Days/Projects segmented toggle and per-subtask notes** on the mobile day-rail view
  are not built (tracked as the Phase D mop-up in `plan/plan.md`).

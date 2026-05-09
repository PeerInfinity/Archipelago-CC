# Loops Module — Queue States

This document explains the state machine that drives the Loops module's
action queue. It describes the underlying state flags, the named states
they combine into, the methods and events that transition between them,
and the per-state behaviors (button labels, auto-start gates, etc.).

**Source:** `frontend/modules/loops/loopState.js`
**Related:** `frontend/modules/loops/loopUI.js` (button wiring),
`frontend/modules/loops/eventCoordinator.js` (auto-resume from `waiting`)

---

## State flags

The queue's state is encoded in three boolean fields on `LoopState`,
plus a separate "step mode" flag that overlays on top of the running
state.

| Flag | Set by | Cleared by | Meaning |
|---|---|---|---|
| `isProcessing` | `_beginProcessing` (called by `startProcessing` / `resumeProcessing`) | `stopProcessing`, queue-completion in `_completeCurrentAction`, OOM reset pause path | The animation-frame loop is active; actions are being ticked. |
| `isPaused` | `setPaused(true)`, OOM reset pause path, `_pauseAfterStep` | `setPaused(false)`, `step()` from paused | User explicitly paused (or the system paused us as a step's terminal event). Suppresses several auto-start paths. |
| `_queueCompleted` | Queue-end branch in `_completeCurrentAction` (no `autoRestartQueue`) | `_resetLoop`, `_beginProcessing`, `resetForNewRules` | The queue ran past its last action without auto-restart. Distinguishes "completed" from "idle" (both have `!isProcessing && !isPaused`). |
| `_stepMode` (overlay) | `step()` | `_pauseAfterStep`, OOM reset pause path, queue-end branch | Single-action step is in flight. Forces the pause path on completion or OOM regardless of `autoRestartQueue`. |

`stopProcessing()` only clears `isProcessing`. `_queueCompleted` and
`isPaused` are managed independently — that's why post-stop state
depends on what was set before the stop.

---

## Derived (named) states

`getProcessingState()` collapses the three flags into one of five
labels, used by the UI to pick button labels.

```
if isProcessing            → 'running'
if isPaused                → 'paused'
if _queueCompleted:
  if autoResumeOnNewAction → 'waiting'
  else                     → 'completed'
otherwise                  → 'idle'
```

| State | `isProcessing` | `isPaused` | `_queueCompleted` | Pause-button label | Step-button enabled? |
|---|---|---|---|---|---|
| **idle** | false | false | false | "Start" | only if `queueLen > 0` |
| **running** | true | false | * | "Pause" | no |
| **paused** | false | true | * | "Resume" | only if `queueLen > 0` |
| **completed** | false | false | true | "Restart" | only if `queueLen > currentActionIndex` (new actions appended past the end) |
| **waiting** | false | false | true | "Restart" (with `autoResumeOnNewAction`) | same as completed |

Notes:
- Mathematical overlap (e.g., `isProcessing && isPaused`) is not
  intentionally constructed; the order in `getProcessingState` makes
  `running` win if it ever happens.
- `waiting` differs from `completed` only in the `autoResumeOnNewAction`
  flag and the auto-resume hook in `eventCoordinator.js`.

---

## Transition entry points

Anything that changes the state flags goes through one of these methods
(or a small number of inline mutations in `_processFrame` /
`_completeCurrentAction`).

| Method | Sets `isProcessing` | Sets `isPaused` | Sets `_queueCompleted` | Resets `currentActionIndex`? |
|---|---|---|---|---|
| `startProcessing` | true | (unchanged) | false | yes (→ 0) |
| `resumeProcessing` | true | (unchanged) | false | no |
| `stopProcessing` | false | (unchanged) | (unchanged) | no |
| `setPaused(true)` | false (via `stopProcessing`) | true | (unchanged) | no |
| `setPaused(false)` | true (via `startProcessing`, plus `_resetLoop` if `_shouldResetOnResume`) | false | false (via `_resetLoop`) | yes (→ 0) |
| `step()` (from idle) | true (via `startProcessing`) | (unchanged) | false | yes (→ 0) |
| `step()` (from paused) | true (via `resumeProcessing`) | false | false | no |
| `step()` (from completed-with-new) | true (via `resumeProcessing`) | (unchanged) | false | no |
| `_pauseAfterStep` | false (via `stopProcessing`) | true | (unchanged) | no |
| `_resetLoop` | (unchanged) | (unchanged) | false | yes (→ 0) |
| `restartFromStart({autoStart:true})` | true (via `startProcessing` if queue non-empty) | false | false (via `_resetLoop`) | yes (→ 0) |
| `restartFromStart({autoStart:false})` | false (via `stopProcessing` if running) | true | false (via `_resetLoop`) | yes (→ 0) |
| `clearQueue` | false (via `stopProcessing` if running) | (unchanged) | false | yes (→ 0) |
| `_completeCurrentAction` (queue-end, no autoRestart) | false | false | true | (sets to past-end) |
| `_completeCurrentAction` (queue-end, autoRestart) | (unchanged) | (unchanged) | (unchanged) | yes (→ 0) |
| `resetForNewRules` | false (via `stopProcessing`) | false | false | yes (→ 0 via `_resetActionsProgress`) |

`_completeCurrentAction` also clears `_stepMode` in the queue-end branch
(step mode is irrelevant once the queue ends).

---

## State transition diagram

Solid arrows are user-driven (button clicks); dashed are system-driven
(per-frame logic, OOM, queue completion). Auto-resume from `waiting` is
handled in `eventCoordinator.js` on `gameState:pathUpdated`.

```
                 addAction              addAction
        ┌──── (auto-start) ─────┐  ┌── (auto-resume from waiting,
        │                       │  │   handled in eventCoordinator)
        │                       ▼  ▼
   ┌─ idle ──── Start ──────► running ──── Pause ──► paused
   │    ▲           ▲          │ │ │                   │
   │    │           │          │ │ │      Resume       │
   │    │ resetForNewRules     │ │ └───── (Step) ◄─────┘
   │    │                      │ │
   │    │              (queue end, no autoRestart)
   │    │                      │ ▼
   │    │                  completed ──── Restart ──► running
   │    │                      │                (via setPaused(false)
   │    │  pathUpdated +       │                 → _resetLoop +
   │    │  autoResumeOnNewAct  │                  startProcessing)
   │    │                      ▼
   │    │                  waiting ─── pathUpdated ──► running
   │    │                                    (resumeProcessing)
   │    │
   │    └─── (any state) ─── resetForNewRules
   │
   └─── (Step button) ──► running for one action ──► paused (via _pauseAfterStep)

   running ─── OOM, !autoRestart  ─► paused (via _resetLoop + pause branch)
   running ─── OOM,  autoRestart  ─► running from index 0
   running ─── step + OOM         ─► paused (step forces pause path)
```

---

## Per-state observable behavior

### Auto-start when an action is added (`queueAction`, line 352)

```js
if (!this.isProcessing && !this.isPaused && !this._queueCompleted) {
  this.startProcessing();
}
```

| Source state | Behavior |
|---|---|
| idle | auto-start fires |
| paused | no auto-start (gated by `!isPaused`) |
| running | no auto-start (already running) |
| completed | no auto-start *here* (gated by `!_queueCompleted`) |
| waiting | no auto-start *here* — `eventCoordinator.js` handles it via `gameState:pathUpdated` → `resumeProcessing()` |

### Auto-start when an action is removed (`removeAction`, line 361)

Removal is two-stage:

1. If the removed action is the one currently being processed, call
   `stopProcessing()` first. If the removed action precedes the current
   one, decrement `currentActionIndex` to keep the same action selected.
2. Then check:
   ```js
   if (!this.isProcessing && updatedQueue.length > 0 && !this.isPaused) {
     if (this.currentActionIndex >= updatedQueue.length) {
       this.currentActionIndex = 0;
     }
     this.startProcessing();
   }
   ```

| Source state | Behavior |
|---|---|
| running, removed current action | stop, then restart from `currentActionIndex` (now pointing at what was the next action). If the removed action was the last, snaps to index 0. |
| running, removed a different action | no stop, no restart; queue keeps running |
| idle (queue had items) | restart |
| paused | stay paused (gated) |
| completed | **restart** (no `!_queueCompleted` check) |
| waiting | **restart** (no `!_queueCompleted` check) |

The completed/waiting rows are an asymmetry with `addAction`, which
*does* gate on `!_queueCompleted`. Removing an action from a completed
queue silently re-runs it; adding one does not. See "Known
asymmetries" below.

### `step()` behavior

`step()` runs exactly one queued action, then transitions to paused.

| Source state | Path | Notes |
|---|---|---|
| idle | `startProcessing()` (resets `currentActionIndex` to 0) | Step from idle starts at the queue's first action. |
| paused | `isPaused = false`, then `resumeProcessing()` | Preserves `currentActionIndex` — picks up where the pause left off. |
| completed/waiting (`queueLen > currentActionIndex`) | `resumeProcessing()` | Picks up at the new action appended past the end (not index 0). |
| completed/waiting (`queueLen <= currentActionIndex`) | no-op | UI flips the button label to "Reset" — see below. |
| running | no-op (returns early) | |
| empty queue | no-op | |

Step mode is enforced by `_stepMode = true` set before processing
starts. The flag forces:

- `_completeCurrentAction` → `_pauseAfterStep` (instead of moving on)
- OOM reset → pause path (instead of autoRestart-continue)

Step mode is cleared when either of those terminal events fires.

### Step button "Reset" variant

In `completed` or `waiting` state with no actions past
`currentActionIndex` (the queue ran to the end and nothing has been
appended since), the Step button label flips to **"Reset"** and the
click handler calls `restartFromStart({ autoStart: false })` instead
of `step()`. The reset refills mana, snaps the queue to index 0,
clears `_queueCompleted`, and lands paused. This mirrors the
"OOM reset, no autoRestart" shape but is user-triggered.

### `restartFromStart({ autoStart })`

Public method used by both the Restart button (`autoStart: true`,
default) and the Step button's Reset variant (`autoStart: false`).
Body:

1. `stopProcessing()` if running.
2. `_resetLoop()` — refills mana, resets action progress, sets
   `currentActionIndex = 0`, clears `_queueCompleted`.
3. Publishes `loopState:queueUpdated` for full UI refresh.
4. Branch on `autoStart`:
   - `true`: `isPaused = false`; if queue non-empty, `startProcessing()`
     (publishes `pauseStateChanged`); else publish `pauseStateChanged`
     for the empty-queue case.
   - `false`: `isPaused = true`; publish `pauseStateChanged`.

### `setPaused(false)` from paused

```js
setPaused(false):
  isPaused = false
  if queue.length > 0:
    if _shouldResetOnResume(queue):  // currentActionIndex past end OR all actions completed
      _resetLoop()                    // mana refill, progress reset, index → 0
    startProcessing()                 // resets index → 0 again
  publish pauseStateChanged
```

So Resume from a "paused at end of queue" state acts like Restart:
mana is refilled and the queue runs from index 0.

### Substrate delegation (running sub-state)

When the current action's source region is a maze substrate region
with `manaEnabled`, `_processFrame` parks: it stores
`_delegatedAction = currentAction`, publishes
`loops:substrateActionBegan`, and stops scheduling animation frames.
The substrate panel walks tile-by-tile, deducts mana per tile, and
publishes `loops:substrateActionCompleted` when done (or when an OOM
reset cleared the path). `_handleSubstrateActionCompleted` then either
runs the normal completion flow (and re-schedules a frame) or stops
processing (interrupted walk).

While parked: `isProcessing` is still true, but no animation frames are
scheduled. The state reads as `running` from the UI's perspective.

---

## Settings that influence transitions

Three boolean settings on `LoopState` change how the per-frame logic
and event handlers respond to completion / OOM / new actions. They
are persisted via `displaySettingsManager` and surfaced as checkboxes
in the loops panel.

### `autoRestartQueue`

Default: `false`. Setter: `setAutoRestartQueue(autoRestart)` — sets
the flag and publishes `loopState:autoRestartChanged`. No state-flag
changes happen on toggle; the setting only affects future completion
and OOM events.

Effects:

| Trigger | `autoRestartQueue = false` | `autoRestartQueue = true` |
|---|---|---|
| Queue runs past its last action (in `_completeCurrentAction`, line 1216) | `currentAction = null`, `isProcessing = false`, `_queueCompleted = true` → state becomes `completed` (or `waiting`) | `currentActionIndex = 0`, `_resetActionsProgress()` → queue keeps running from index 0 |
| OOM reset (in `_maybeResetForOOM`) | Pause path: `isPaused = true`, `stopProcessing()` → state becomes `paused` | Continue path: re-schedule animation frame → state stays `running` |
| `_completeCurrentAction` reaches an explore action that should repeat | New explore action appended; queue continues either way | Same |

Note: `_stepMode = true` overrides `autoRestartQueue = true` in both
the queue-end and OOM branches — step mode forces the pause path so
the step's terminal event is "queue stops" regardless of the toggle.

### `autoResumeOnNewAction`

Default: `false`. Setter: `setAutoResumeOnNewAction(autoResume)` —
sets the flag only (no event, no state change).

Effects:

| Trigger | `autoResumeOnNewAction = false` | `autoResumeOnNewAction = true` |
|---|---|---|
| `getProcessingState()` while `_queueCompleted = true` | returns `'completed'` | returns `'waiting'` |
| `gameState:pathUpdated` fires while in `completed`/`waiting` (handled in `eventCoordinator._handlePathUpdated`) | re-render only, no state change | if state is `'waiting'` AND `queueLen > currentActionIndex`: `resumeProcessing()` → state becomes `running` |

In the `waiting` → `running` auto-resume, `resumeProcessing()`
preserves `currentActionIndex` (it doesn't snap to 0). Combined with
the `queueLen > currentActionIndex` gate, this means auto-resume
picks up at the newly appended action, not at the start.

### `autoRestartQueue` and `autoResumeOnNewAction` are mutually exclusive

The two checkboxes in the loops panel UI (`loopUI.js:317-348`) enforce
mutual exclusion: enabling one disables the other (with a
corresponding `setSetting` write to persist). The flags are not
mutually exclusive at the `LoopState` level — both can technically be
true simultaneously if set programmatically, in which case
`autoRestartQueue` wins (the queue-end branch hits first and prevents
`_queueCompleted` from ever becoming true, so the `waiting` state is
never reached).

### `autoRemoveCompleted`

Default: `false`. Setter: `setAutoRemoveCompleted(enabled)` — sets
the flag, and when enabling, immediately calls
`removeCompletedActions()` to prune the queue.

This setting affects queue *contents* rather than state transitions
directly, but it can cascade into transitions because removing the
current action triggers the `removeAction` auto-restart logic
described earlier. `eventCoordinator` calls `removeCompletedActions()`
on these events when the flag is set:

- `loopState:queueCompleted` (line 216)
- `loopState:actionCompleted` (line 251)
- `gameState:itemsChanged` and related state-snapshot updates (lines 272, 324)

Removed actions: `locationCheck` actions for already-checked locations,
`explore` actions for fully-explored regions (all locations and exits
discovered).

---

## Known asymmetries

Behaviors that are inconsistent across paths, not load-bearing for
current functionality but flagged so future changes can converge them.

1. **`addAction` vs `removeAction` auto-start in completed state.**
   `addAction` (line 352) gates on `!_queueCompleted` and skips
   auto-start. `removeAction` (line 404) does not gate on
   `_queueCompleted` and *will* auto-restart from index 0 when an
   action is removed from a completed queue. The two paths probably
   should agree.

2. **`_completeCurrentAction` queue-end vs OOM ordering in
   `_processFrame`.** The OOM check follows completion. After fixing
   the step-mode-completion-then-OOM quirk (so OOM still fires when
   step pause stopped processing), the only remaining skip-OOM case is
   `_queueCompleted`. See `_processFrame` JSDoc for the full
   per-frame contract.

3. **`stopProcessing` doesn't clear `isPaused`.** Calling
   `stopProcessing` from the paused state is a no-op (gated on
   `isProcessing`), but if a future caller stops processing while
   `isPaused` is true, the queue stays in paused state. This is the
   intended behavior — pause is an orthogonal user-driven flag — but
   easy to miss when reading `stopProcessing` in isolation.

---

## See also

- `_processFrame` JSDoc (`loopState.js`) — per-frame contract and the
  helper split for substrate delegation, frame-clock priming, action
  progress, completion, OOM reset, and progress publish.
- `CC/docs/plans/loops-module-untangling.md` — refactor plan; item #3
  documents the OOM-after-step-completion fix (resolved).

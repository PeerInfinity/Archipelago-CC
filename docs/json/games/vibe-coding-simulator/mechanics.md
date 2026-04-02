# Vibe Coding Simulator — Mechanics

Detailed documentation of the simulation engine mechanics.

## Time Model

The simulation tracks time in simulated minutes. Real time is scaled by `timeScale` (default 60x) and the current speed multiplier (1x/2x/5x/10x). Each frame, the engine advances by `dtReal * timeScale * speedMultiplier / 60` simulated minutes.

Credits refresh every 24 simulated hours. Review budget (8 hours) also resets daily.

## Task Lifecycle

```
Created → RUNNING → PENDING_REVIEW → COMPLETED (accepted)
                  → PENDING_REVIEW → CANCELLED (rejected)
                  → CANCELLED (cancelled by player)
```

### Task Types and Subtasks

Each task type has a fixed sequence of subtask phases:

| Task Type | Subtasks |
|-----------|----------|
| Implement | investigating → reading code → planning → implementing → testing |
| Write Doc / Evaluate Doc / Write Tests | investigating → reading code → writing |
| Merge Conflict Resolve | investigating → resolving conflict → testing |

Each subtask has a randomized duration: `baseTaskDuration * durationMult * exp(gauss(0, durationLogSigma))`, with a minimum of 1 minute. Merge/retest subtasks use `mergeTaskDurationScale` (0.5x) of the base duration.

The duration multiplier is `depsNotMetMultiplier ^ unmetDepLayers`, where `unmetDepLayers` is the depth of the longest chain of unmet upstream dependencies. For example, if C depends on B depends on A, and neither A nor B has passed manual review, C has 2 unmet layers and tasks take 4x longer (2^2). The layer count is shown as ⏳N on the feature card.

### Task Execution

Tasks advance minute by minute. Each simulated minute:

1. Credits are consumed at `creditRate` per minute
2. The fractional minute accumulator advances by `dt`
3. When a full minute elapses:
   - Skip-testing is checked (if flagged, jumps to end)
   - A random quality event may occur (see Events below)
4. When `elapsedMinutes >= totalDuration`:
   - The agent rolls to catch negative events (see Agent Rewind below)
   - If no rewind, the task finishes

### Task Completion

On finishing, the task enters `PENDING_REVIEW` status (or `COMPLETED` if auto-accept is on). The agent provides a self-report of success or failure, which may be inaccurate — see [Formulas](formulas.md#reported-success).

When accepted, the task's results are applied to the feature's hidden completeness values. When rejected, the work is discarded.

## Event System

### Random Quality Events

Each simulated minute, each running task has an `eventProbability` (8%) chance of a random event. Events are positive with `eventPositiveWeight` (60%) probability, negative otherwise. Each event carries a quality delta of `eventQualityDelta` (0.05), positive or negative.

Events accumulate into `pendingQuality` on the task, which influences the outcome formulas when the task is accepted.

### Outcome Events

At task creation, a single "outcome" event is pre-rolled and placed at a random minute in the timeline. This represents the overall trajectory of the work. The quality delta is drawn from `uniform(-outcomeEventQualityRange, +outcomeEventQualityRange)` (default range: 0.15). It's positive if the delta is >= 0, negative otherwise.

Outcome events use distinct descriptions (e.g., "Key insight led to clean solution" vs. "Fundamental approach has a flaw") and appear as bold italic text in the review log.

### Event Types

| Type | Description | Color | Quality Impact |
|------|-------------|-------|----------------|
| `quality` | Random per-minute event | Green/Red | +/- 0.05 |
| `outcome` | Pre-rolled task outcome | Green/Red | +/- 0.00 to 0.15 |
| `step` | Subtask transition | White | None |
| `rewind` | Rewind marker | White | None |

## Review and Supervision

### Review Mechanics

Expanding a task card starts the review process. The review progress bar advances at `reviewSpeedMultiplier` (2x) the task's speed, but cannot pass the task's current progress.

As the review bar passes event positions on the timeline:
- Event markers appear on the progress bar (green or red dots)
- Event descriptions appear in the expanded log
- The "First Issue" rewind button becomes enabled when a negative event is revealed

When review reaches 100%, a summary line appears describing the overall quality in vague terms (e.g., "Work looks excellent — significant improvement expected").

Both task review and manual testing consume the daily review budget (8 hours). Only one review can be active at a time — starting a new review cancels the current one.

### Review Bar Visibility

The review progress bar is visible on collapsed task cards when any review progress has been made. Event markers on the main progress bar only appear up to the reviewed position, even when collapsed.

Expanding a completed or cancelled task card shows the event log at whatever review state was reached, but does not advance the review further.

### Auto-Rewind

When enabled, the auto-rewind option automatically triggers a "First Issue" rewind whenever the review progress crosses a negative event. This happens during `_tickReview` — the engine compares the previous and current `reviewMinute` and checks for newly-revealed negative events in that range.

## Rewind

### Player Rewind

Three rewind options are available for running and pending review tasks (disabled for accepted/rejected tasks):

- **First Issue** — rewinds to the start of the step containing the earliest negative event
- **One Step** — rewinds to the start of the previous step
- **Start** — rewinds to minute 0

Rewinding:
1. Removes all quality and outcome events after the rewind point (step events are preserved)
2. If the outcome event was removed, re-rolls it at a random position in the remaining timeline
3. Recalculates `pendingQuality` from surviving events
4. Resets elapsed time and review progress to the rewind point
5. Adds a neutral "rewind" event to the log
6. If the task was in `PENDING_REVIEW`, reverts it to `RUNNING`

The task then replays from the rewind point, generating fresh random events.

### Agent Rewind

At task completion, the engine rolls `sideEffectRate` (25%) chance of a regression, then `regressionCatchRate` (60%) chance the agent notices it. If both succeed and there are negative events on the timeline, the agent rewinds to the earliest negative event — identical to the player pressing "First Issue."

## Merge Conflicts

When multiple running tasks of the same type target the same feature, a merge conflict entry is created. The merge conflict tracks all source task IDs and waits until all source tasks finish.

If a new task is started for the same feature/type while a merge conflict exists (even if the merge resolve is already in progress or completed but not accepted), the existing merge is reset to pending and the new task is added to its sources.

To resolve a merge conflict, the player clicks "Resolve," which starts a merge resolve task (with shorter subtask durations). The resolve task takes the higher of the current code completeness and branch completeness, then applies the universal outcome formula.

## Manual Review

Manual review creates a task card in the task list that advances only while expanded, using the same expand-to-review mechanic as agent task review. It requires the feature to have both code and tests, and uses the review budget.

### Event Generation

When a manual review starts, events are pre-generated based on the feature's completeness gaps:

- For each of doc, code, and tests: `Math.ceil((1 - completeness) * 10)` potential events
- The first event per category is guaranteed to appear; remaining events have a 50% chance
- Events are placed at random positions across the review timeline
- Each event has a descriptive text identifying the type of issue found

### Review Progress

- The review progress bar (purple) advances at `reviewSpeedMultiplier` speed while the card is expanded
- As the bar crosses event positions, issues are revealed in the event log with their category (Doc/Code/Tests)
- Discovered issues are immediately reflected on the feature card's D/C/T badges (red border) and issue counts
- Expanding a different task pauses the manual review; re-expanding resumes it

### Completion

When review reaches 100% or the review budget is exhausted:
- If all three completeness values are >= 1.0, the feature passes
- Otherwise, the feature's `manualReviewIssues` records the discovered issue counts per category
- The feature card shows the issue counts and the M badge reflects the result

A feature's dependencies are considered met when it passes manual review. The win condition is all features passing manual review.

## Test Workflow

The test workflow runs automated tests across all features. It takes `testWorkflowDuration` simulated minutes and produces a pass percentage for each feature that has both code and tests.

The test result formula: `min(code, test) / max(code, test)`, chained with upstream features' results. Features without code or tests show no result.

### Auto-Test

When the auto-test option is enabled, the test workflow is automatically started whenever code or test changes are accepted (from Implement, Write Tests, or Merge Resolve tasks) and no workflow is currently running. A `_testsDirty` flag tracks whether changes have been made since the last workflow run.

## Task Pruning

Completed, cancelled, and failed tasks are pruned when their count exceeds 100, removing the oldest first (by `completedAt`). A counter card at the bottom of the task list shows how many tasks have been cleared. Tasks that are superseded merge conflict markers (FAILED status) are hidden from the task list entirely.

## Cross-Feature Side Effects

When code is implemented or a merge conflict is resolved, there's a `sideEffectRate` (25%) chance of a side effect on another feature. With `sideEffectUpstreamWeight` (75%) probability, the affected feature is an upstream dependency; otherwise, it's random. The side effect changes the target's code completeness by up to `sideEffectMaxChange` (0.25) in either direction.

Side effects are hidden — they aren't logged or reported to the player.

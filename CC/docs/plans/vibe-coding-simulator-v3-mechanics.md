# Vibe Coding Simulator — V3 Mechanics: Event-Based Tasks & Review

## Overview

V3 replaces the "roll all outcomes at completion" model with a minute-by-minute event system. Events happen during task execution and are revealed through a review/supervision mechanic.

## Event-Based Task Execution

### Time tracking
- Game tracks time in 1 simulated minute intervals
- Each task step has a minimum duration of 1 minute
- Maximum one event per minute per task

### Events during tasks
- Each minute, each running task has a probability of a random event
- Events can be positive (green) or negative (red)
- Events have a text description and a quality impact value
- The accumulated effect of all events determines the task's final outcome
- End results should be similar in distribution to the V2 formulas

### Event types
- **Quality positive**: "Found a better approach", "Reused existing pattern" — improves outcome
- **Quality negative**: "Introduced subtle bug", "Misread spec" — worsens outcome
- **Step transitions**: "Finished reading code, starting implementation" — mundane, always shown

## Accept/Reject

- Completed tasks don't auto-apply their changes
- Player must click **Accept** to apply or **Reject** to discard
- **Auto-accept checkbox** at top of Tasks column applies changes immediately
- Accepting applies the accumulated quality changes to the feature's completeness
- Rejecting discards them (time and credits still spent)

## Task Review / Supervision

### Expanding task cards
- Task cards are expandable (one at a time)
- Expanding a task card starts the review/supervision process
- Collapsing pauses the review (can resume later)

### Review progress bar
- A second progress bar appears above the main task progress bar
- Advances at **2x the speed** of the main bar
- Cannot pass the position of the main bar
- For completed tasks, the main bar is at 100%, so review can catch up

### Event reveal
- As the review bar passes event positions, events are revealed:
  - Green marks appear on the progress bar for positive events
  - Red marks appear for negative events
  - Text description appears in the expanded log area
- Step transitions are also shown in the log

### Rewind
- **Rewind to first negative**: returns task to the start of the step containing the first negative event, re-rolls all events from that point
- **Rewind one step**: returns to the start of the current/previous step
- **Return to start**: rewinds the entire task
- Rewinding re-rolls events with different random outcomes
- Task continues from the rewind point

### Review limits
- Player can only do one review at a time (task review or manual feature test)
- Starting a new review cancels the current one
- **8 hours of manual review per day** limit, tracked in toolbar
- Review time counts against this limit

## Task Card Ordering

- Task cards maintain creation order — completed tasks stay in place
- No reordering when tasks complete or change status

## Location Checks

- Archipelago location check awarded when code completeness reaches 100%
- Docs and tests at 100% are NOT required for the location check
- Reporting mechanics (test results, manual testing) unchanged

## Toolbar Addition

- Review hours remaining: progress bar showing hours left out of 8h daily budget
- Positioned to the right of the Credits bar
- Resets each simulated day

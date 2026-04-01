# Vibe Coding Simulator

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=vibecoding)**

A project management simulation where you oversee AI coding agents working on a software project. Each feature in your project's dependency graph is a location to complete. Agents are unreliable — their work has hidden quality values that you can only discover through review, testing, and manual inspection.

## Overview

You manage a team of AI agents building a software project. The project is structured as a dependency graph where each node is a feature. For each feature you need to:

1. **Write a planning doc** — establishes the quality ceiling for implementation
2. **Implement the code** — quality bounded by the doc quality
3. **Write tests** — quality bounded by the doc quality
4. **Pass a manual review** — reveals whether all three areas are truly complete

The catch: you can't see the actual quality numbers. Agents report success or failure, but they're only right about half the time. You discover the truth through automated test workflows, manual testing, and reviewing agent work.

## How to Play

### Starting Tasks

Select a feature from the Features column and click the action badges (D/C/T/M) to assign agent tasks:

- **D** — Write or evaluate the planning doc
- **C** — Implement or debug the code
- **T** — Write or debug tests
- **M** — Manual test (requires code and tests to exist)

Multiple agents can work on the same feature simultaneously, but this creates merge conflicts that must be resolved.

### Reviewing Agent Work

Click a task card to expand it and begin reviewing. The review progress bar (purple) advances at 2x the task's speed. As the review bar passes events on the timeline:

- **Green markers** appear for positive events (good decisions, clean approaches)
- **Red markers** appear for negative events (bugs introduced, wrong assumptions)
- Event descriptions appear in the expanded log

When review reaches 100%, you get a vague summary of the overall work quality.

### Accept and Reject

Completed tasks enter "pending review" status. You must accept or reject them:

- **Accept** applies the agent's changes to the feature's hidden completeness values
- **Reject** discards the work (time and credits are still spent)
- **Auto-accept** checkbox skips the review step

### Rewind

If you spot a negative event during review, you can rewind the task:

- **First Issue** — rewind to the step containing the earliest negative event
- **Step** — rewind one step back
- **Start** — rewind the entire task

Rewinding clears events after the rewind point and re-rolls them with different random outcomes. The agent may also catch issues on its own at task completion and rewind automatically.

### Information Sources

| Source | What it reveals | Reliability |
|--------|----------------|-------------|
| Agent self-report | Whether the agent thinks it succeeded | ~50% accurate |
| Task review | Individual events during the task | Ground truth (for reviewed portion) |
| Test workflow | Pass/fail percentage per feature | Reflects actual code/test quality |
| Manual test | Which area (doc/code/tests) needs work | Ground truth, progressive reveal |

### Winning

A feature is complete when it passes a manual test — all three completeness values (doc, code, tests) must reach 100%. Overall progress is the fraction of features that have passed manual testing.

## Resources and Budgets

- **Credits** — 960 per day (16 hours of agent time). Each minute of agent work costs 1 credit. Refreshes daily.
- **Review budget** — 8 hours per day. Reviewing tasks and manual testing both consume this budget.
- **Speed controls** — 1x, 2x, 5x, 10x simulation speed plus pause.

## Key Mechanics

- [Task System and Events](mechanics.md) — how tasks execute, the event system, review and rewind
- [Formulas and Configuration](formulas.md) — completeness formulas, probability tables, tuning constants

## Archipelago Integration

Each feature in the dependency graph corresponds to a node in a DepGraph world. Completing a feature (passing manual test) checks the corresponding Archipelago location. Features have upstream dependencies — a feature whose dependencies aren't all complete takes twice as long to work on.

The dependency structure comes from the DepGraph preset loaded into the Region Graph module, which provides both the visual graph and the game data for the simulation.

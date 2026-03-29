# Vibe Coding Simulator — Planning Document

## Vision

A game that simulates the experience of managing an AI-assisted coding project. The player gives prompts to a simulated Claude, manages resources (time, compute, API credits, context windows), and makes strategic decisions about task prioritization, branching, and autonomy levels. The game tracks progress through a real dependency graph of features and tests.

The game has two modes of use:
- **As an Archipelago apworld** — regions are features on a dependency graph, locations are subfeatures/phases, items are "understanding" that unlocks dependent work
- **As a project management interface** — loadable with real data from the SWFRecomp-CC Flash project (and potentially other projects)

The Archipelago connection is optional. The interface should work standalone for projects that don't have pre-built dependency data.

See also: [Original brainstorm](../../chats/vibe%20coding%20simulator.md)

---

## Data Model

### Core Entities

**Feature** — A high-level unit of work, corresponding to a planning document in the SWFRecomp project. Maps to a **region** in Archipelago.

**Phase** — A discrete step within a feature. Maps to a **location** in Archipelago. Phases have their own status and can independently block/unblock other phases.

**Test** — A verifiable check that exercises one or more features. Test status is derived from the implementation status of the subfeatures it covers. Tests are grouped by feature category.

**Dependency** — A directed edge in the graph. A phase or feature may *require* another (hard prerequisite) or *complement* another (related, more efficient together, but not strictly ordered).

**Blocker** — A cross-cutting issue that prevents progress on multiple features. Distinct from dependencies: a dependency is resolved by completing the prerequisite, while a blocker is a deeper architectural or infrastructure constraint.

### Relationships

```
Feature 1──* Phase
Feature 1──* Test  (via feature_categories)
Phase   *──* Phase (dependencies, across features)
Blocker 1──* Feature (blocks)
```

### Archipelago Mapping

| Game Concept | Archipelago Concept |
|---|---|
| Feature | Region |
| Phase | Location |
| "Understanding" of a phase | Item (received on check) |
| Inspiration from another player | Item (received from multiworld) |
| Phase dependency | Access rule |
| Blocker | Access rule (possibly with hints) |

The logic works similarly to the DepGraph apworld: checking a location requires both the event item and the regular item for each dependency. Options can relax this to require only one dependency instead of all.

---

## Data Sources (SWFRecomp-CC)

The SWFRecomp-CC project at `~/CC/SWFRecomp-CC` has unusually rich data for this purpose.

### Already Available

| Source | Location | Content |
|---|---|---|
| Test results | `ruffle-tests/results.json` | Per-test status, line counts, timing. 562/619 passing (90.8%) |
| Feature categories | `ruffle-tests/tests/swfs/avm1/_investigation/feature_categories.json` | Test → feature category mapping (~20 categories) |
| Blocker summary | `ruffle-tests/tests/swfs/avm1/_investigation/BLOCKER_SUMMARY.md` | 9 numbered blockers, mapped to plans, with resolution dates |
| Completed plans | `_investigation/complete/` | 75+ plans with phase structure, test lists, implementation details |
| Incomplete plans | `_investigation/incomplete/` | 11+ plans with explicit blocking/dependency info |
| Blocked plans | `_investigation/blocked/` | Plans with identified external blockers |
| Session notes | `_investigation/SESSION_NOTES.md` | Historical progression (pass rates per session, per-fix descriptions) |
| Commit history | 2,243 commits | 552 "Update test results" commits with before/after pass counts |

### Needs Recovery (from git history)

- Historical blocking info for completed plans (removed when plans moved to `complete/`)
- Dependencies between completed plans that were resolved during implementation
- Unblocking order — which completions enabled which other work

Key commit for historical blocker data: `2984402c` (2026-03-13 BLOCKER_SUMMARY snapshot).

### Needs Inference (from code analysis)

- Dependencies between completed plans where blocking info was never explicitly documented
- Implicit ordering from which functions/features a plan's code calls

---

## Plan Metadata Format

Each plan document will get a machine-readable metadata section in a YAML-in-HTML-comment block, placed after the existing `<!-- TESTS: -->` header.

### Schema

```yaml
<!-- PLAN_META
id: PLAN_NAME                    # matches filename without .md
status: complete|incomplete|blocked
phases:
  - id: 1
    name: "Human-readable phase name"
    status: complete|incomplete|blocked|not_started
    blocked_by:                  # optional, per-phase blockers
      - plan: OTHER_PLAN
        phases: [1, 2]
dependencies:                    # what this plan needs from other plans
  - plan: OTHER_PLAN
    phases: [1, 2, 3]           # optional — omit for whole-plan dependency
    type: requires|complements   # hard prerequisite vs related work
    reason: "Why this dependency exists"
blockers:                        # cross-cutting issues from BLOCKER_SUMMARY
  - blocker: 7
    reason: "Brief description"
-->
```

### Design Decisions

- **YAML in HTML comment** — machine-parseable, invisible in rendered markdown, consistent with existing `<!-- TESTS: -->` convention
- **`dependencies` vs `blockers`** — separated because they have different resolution paths. Dependencies are resolved by completing other plans. Blockers are deeper architectural issues.
- **Phase-level granularity** — dependencies can target specific phases, matching real data (e.g., SOUND_DURATION needs SOUND_LOADING phases 1-3, not all phases)
- **`type` field** — `requires` (hard dependency) vs `complements` (related work, better together, like RUNTIME_TRANSFORM_GPU and RUNTIME_CXFORM_GPU)

---

## DepGraph Integration

### Target Format

The DepGraph apworld accepts a simple JSON format:

```json
{
  "title": "SWFRecomp Vibe Coding Simulator",
  "nodes": {
    "SOUND_LOADING.1": {
      "label": "Sound Loading: loadSound()",
      "description": "Implement loadSound() with embedded data",
      "depends_on": []
    },
    "SOUND_LOADING.2": {
      "label": "Sound Loading: onLoad dispatch",
      "depends_on": ["SOUND_LOADING.1"]
    },
    "SOUND_DURATION_POSITION.1": {
      "label": "Sound Duration: getPosition()",
      "depends_on": ["SOUND_LOADING.1", "SOUND_LOADING.2", "SOUND_LOADING.3"]
    }
  }
}
```

Each **phase** becomes a node. Internal phase ordering (phase 2 depends on phase 1 within the same plan) and cross-plan dependencies both become the same kind of edge.

### Node Granularity

With ~86 plans and ~3-5 phases each, expect roughly 250-400 nodes. DepGraph's current node limit is 100, but this will be raised to 1000 to accommodate this and other projects.

### DepGraph Features We Use

- **Entrance rule modes** — default `relaxed_items` matches our design: require all event items (all deps implemented) but only one regular item (understanding/inspiration from one dep)
- **DAG validation** — topological sort rejects cycles, which also validates our dependency graph
- **Custom graph files** — DepGraph already supports loading external JSON files
- Also supports DOT and CSV formats, plus converter scripts (`tasklist_to_depgraph.py`, `taskipelago_to_depgraph.py`)

### Extraction Pipeline

PLAN_META (in plan docs) → extraction script → DepGraph JSON

The extraction script reads all plan files, parses their `PLAN_META` blocks, and outputs a single JSON file in the format above. Internal phase dependencies (phase N depends on phase N-1) are generated automatically. Cross-plan dependencies come from the `dependencies` field in PLAN_META.

---

## Milestones

### Milestone 1: DepGraph Dataset

The minimum viable deliverable. Produce a dataset that can plug into the DepGraph apworld.

**Steps:**
1. Standardize plan metadata format (defined above)
2. Add `PLAN_META` blocks to incomplete/blocked plans (data already in prose)
3. Recover historical dependency data for completed plans from git history
4. Fill gaps by analyzing code dependencies
5. Write extraction script: plan docs → DepGraph JSON
6. Validate graph: check for cycles, verify all referenced plans exist
7. Test with DepGraph apworld

### Milestone 2: Project Status Interface

A UI showing current project state — test results, plan status, blocking relationships. Usable with real SWFRecomp data.

### Milestone 3: Simulation Engine

The core game loop — giving prompts to simulated Claude, time passing, success/failure rolls, regressions. Resource management (credits, compute, context windows).

### Milestone 4: Archipelago Integration

Full apworld with regions, locations, items, and logic derived from the dependency graph. Client that connects the simulation to an Archipelago multiworld.

### Milestone 5: Generalization

Support for projects other than SWFRecomp. Data collection tools, test framework integration, dependency graph construction from scratch.

---

## Design Decisions

### Test Simulation

The game tracks **phase completion percentage**, not individual test pass/fail. Individual test results are *simulated* from that percentage. Since the real tests report line match counts (not just pass/fail), the game can simulate partial line match rates based on the completion percentage of the relevant features and phases. This keeps the internal model simple while producing realistic-looking test output.

### Phase Sizing

Use the phase structure from the actual planning documents as-is. The SWFRecomp plans already break work into phases at a natural granularity — sized by implementation coherence, not game design. This avoids artificial splitting or merging.

### Archipelago Logic / Relaxed Requirements

Following the DepGraph apworld's default: require all event items (all dependencies must actually be implemented) but only one normal item (you only need "understanding"/inspiration from one dependency). This means the simulated Claude can't attempt blocked work, but the player doesn't need multiworld items from every prerequisite — just one source of insight is enough to get started.

### Game Loop: Real-Time with Claude Instances

The game is **real-time**. When the player assigns a task to a Claude instance, a progress bar appears. The player can:
- Start multiple Claude instances working in parallel
- Do other management tasks while waiting
- Cancel a task or give updated instructions mid-execution

Options:
- **Progress bar visibility** — can be hidden, making task duration unpredictable (harder mode)
- **Claude getting stuck** — a random event where Claude consumes time and tokens without progress. The player needs to recognize this and intervene (cancel, redirect, provide hints)

### Claude Task Types and Failure Modes

Each action the simulated Claude performs has a random chance of failure. V1 focuses on the simplest failure modes:

| Task | Success | Failure |
|---|---|---|
| Write code for a phase | Phase completion % increases | No progress, or regression in related phases |
| Write/update planning doc | Document becomes accurate | Missing or inaccurate information in doc |
| Check blocked status of a plan | Correct blocked/unblocked report | False positive (says blocked when it isn't) or false negative |
| Investigate remaining work | Accurate list of what's left | Missing features from list, or hallucinated features that don't exist |

**Deferred to later versions:**
- Context degradation (error rate increasing over long conversations)
- Model selection (different models with different strengths/weaknesses)
- Autonomy level (humorous/serious consequences of too much autonomy)
- Ralph loops and advanced automation

### Example Project

The Flash/SWFRecomp project will be the primary real dataset, but it's too large for initial development. A smaller example will also be created — preferably a subset of the Flash data if an appropriate one can be found, otherwise a fictional ~10-feature project. The extraction pipeline will target the Flash data as the first real-world test regardless.

### Regression Model

About **1 in 4 commits** introduces a regression (estimated from real SWFRecomp data). When a regression occurs, it follows a proximity gradient:
- **Most likely**: regression in the current phase being worked on
- **Less likely**: regression in a related/adjacent phase
- **Rare**: regression in an apparently unrelated feature

This mirrors real experience — most bugs are local, but occasionally a change breaks something surprising. The 1/4 rate and proximity distribution are tunable game balance parameters.

### Document Accuracy

Deferred from V1. The idea of using real planning documents with algorithmically simulated mistakes is appealing but complex. For V1, planning documents are either accurate or not yet written — no partial accuracy tracking. This simplifies the game model significantly while still allowing the core "investigate → plan → implement" loop.

### Multi-Instance Resource Model

Simulates a Claude subscription model:
- **5-hour usage limit** per rolling period (maps to real Claude Pro limits)
- **Weekly credit cap** on top of the rolling limit
- Running one instance rarely hits the limit; multiple instances can burn through credits fast

Strategic tradeoffs beyond credits:
- **Merge conflicts** — parallel instances working on related features risk conflicting changes
- **Wasted work** — two instances may independently attempt the same fix if the player isn't careful about task assignment (e.g., telling one to fix a bug and another to implement a feature that touches the same code)
- **Safe parallelism** — one instance on docs while another works on code is low-risk, mirroring real experience

### Task Duration and Time Scale

The game runs at approximately **1 minute of simulated time per second of real time** (tunable).

Task duration in V1 is **flat** — all tasks take roughly the same base simulated time. Future versions could scale by LOC estimate from the real plans. However, actual completion time is highly variable — see Task Progress Model below.

### Task Progress Model

A Claude task's progress bar has **one section per subtask**: initial testing, reading code, planning, implementing, regression tests, fixing regressions. Each subtask takes a random amount of time, distributed on a **log scale** — tasks can randomly take orders of magnitude more or less time than expected.

The **regression testing / fixing cycle** is also variable. After implementing, Claude runs some regression tests. If it finds a regression, it attempts a fix, then tests again. The number of these cycles is random. This could be simulated with the same system that handles normal regressions (rolling for whether a regression occurred, then rolling for whether Claude's chosen tests would catch it), or it could be simplified in V1 to a fixed random number of fix cycles.

The game shows a brief **status label** for the current subtask, giving the player information to act on without revealing the internal random state.

This creates strategic decisions:
- **Cancel and retry** — sometimes it's better to abandon a slow task and restart, hoping for a faster run
- **Redundant instances** — assigning the same task to two instances and accepting whichever finishes first (at the cost of credits)
- **Recognizing "stuck"** — a task that's been on the same subtask for a long time might be stuck, or might just be working on a hard part. The player has no way to know for certain

### Credit Accounting

Credits are consumed **continuously** as Claude instances run. Canceling a stuck task is not free — the credits spent so far are gone. This makes the cancel-and-retry decision a genuine cost/benefit calculation, not a free reset.

### Merge Conflict Resolution

When parallel Claude instances produce conflicting changes, the player must assign a Claude instance to resolve the merge conflict. This is itself a task that can randomly fail, potentially introducing regressions. This makes parallel work a genuine risk/reward tradeoff, not just a resource cost.

### Testing Infrastructure

Two ways to run tests, mirroring the real project:

**Claude's inline testing** — Each Claude instance runs tests as part of its work:
- Initial baseline tests at the start
- Implementation-phase spot checks
- Regression tests before committing
- Variable thoroughness: sometimes Claude runs many regression tests and finds nothing; sometimes runs few and catches a regression early

The player can **end Claude's regression testing early** and commit what's there, saving time at the risk of shipping regressions.

**Test workflow (CI)** — The player can trigger a full test suite run separately:
- Runs in the background (simulating GitHub Actions)
- Full suite takes ~10 simulated minutes
- Each individual test takes ~15 simulated seconds
- **V1: one workflow run at a time** — the player must choose whether to wait for the current run to finish, or cancel it and start a new one

Strategic tradeoffs:
- Running the workflow frequently catches regressions early but takes time
- Running it rarely means regressions compound before being discovered
- Ending Claude's regression testing early and using the workflow instead can be more efficient — but the workflow results come later
- **Wait for results?** — the player can assign Claude new tasks before workflow results arrive, but risks building on top of undiscovered regressions
- **Cancel and re-run?** — if Claude just committed, the current workflow run is testing stale code. Cancel and restart, or wait for it to finish and then run again?

V1 only supports running the full test suite. Future versions may allow selecting subsets and choosing parallelism levels (10/20/30 processes).

---

## Open Questions

- **Smaller example selection**: Need to evaluate whether a coherent ~10-feature subset of the Flash data exists (e.g., the rendering pipeline: transforms → cxform → drawing API → masks → bitmaps), or whether a fictional example is cleaner.
- **Log-scale distribution specifics**: What distribution for subtask durations? Log-normal? Power law? Needs to feel unpredictable but not absurd. Playtesting will determine this.
- **Inline regression simulation detail**: Should V1 fully simulate whether Claude's chosen regression tests would catch a given regression (using the test-to-feature mapping)? Or simplify to a flat probability that Claude catches its own regressions before committing?

# Vibe Coding Simulator — Planning Document

## Vision

A game that simulates the experience of managing an AI-assisted coding project. The player gives prompts to a simulated Claw, manages resources (time, compute, API credits, context windows), and makes strategic decisions about task prioritization, branching, and autonomy levels. The game tracks progress through a real dependency graph of features and tests.

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

The core game loop — giving prompts to simulated Claw, time passing, success/failure rolls, regressions. Resource management (credits, compute, context windows).

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

Following the DepGraph apworld's default: require all event items (all dependencies must actually be implemented) but only one normal item (you only need "understanding"/inspiration from one dependency). In the simulator, features whose upstream dependencies haven't passed manual testing are not blocked — but tasks for them take twice as long. The player can work ahead at a cost.

### Game Loop: Real-Time with Claw Instances

The game is **real-time**. When the player assigns a task to a Claw instance, a progress bar appears. The player can:
- Start multiple Claw instances working in parallel
- Do other management tasks while waiting
- Cancel a task or give updated instructions mid-execution

Options:
- **Progress bar visibility** — can be hidden, making task duration unpredictable (harder mode)
- **Claw getting stuck** — a random event where Claw consumes time and tokens without progress. The player needs to recognize this and intervene (cancel, redirect, provide hints)

### Completeness Model

Each feature has three hidden completeness values, each from 0.0 to 1.0:

- **Document completeness** — how complete/accurate the planning doc is
- **Code completeness** — how much of the feature is correctly implemented
- **Test completeness** — how thorough the test coverage is

**Constraints:**
- Code completeness cannot meaningfully exceed document completeness (you can't implement what isn't planned)
- Test completeness cannot exceed document completeness (you can't test what isn't planned)

**Hidden state:** The player never sees these values directly. They see Claw's reports (which may be optimistic) and test results (which are limited by test completeness). The player must invest time to reduce uncertainty.

### Universal Outcome Formula

The same formula is used for document reevaluation, code re-implementation, and test re-implementation. Given current completeness `c` (0.0 to 1.0) relative to the target ceiling (1.0 for docs, doc completeness for code/tests):

```
c_rel = current / ceiling

P(reduce)      = 1/4                 — lose up to 50% of current value
P(nothing)     = 1/4                 — no change
P(improve)     = (1 - c_rel) / 2    — gain up to 50% of the gap to ceiling
P(match ceil)  = c_rel / 2          — jump directly to ceiling
```

At c_rel = 0.5: 25/25/25/25. At c_rel = 0.1: 25/25/45/05. At c_rel = 0.9: 25/25/05/45.

The "reduce" probability is constant — there's always a risk of making things worse. But the balance between "incremental improvement" and "jump to ceiling" shifts: when far from the ceiling, small improvements are more likely; when close, jumping to ceiling becomes more likely.

### Claw Task Types

**Write Planning Doc** — Creates the planning doc for a feature. Prerequisite for implementation and test writing.
- 50% chance of success (100% completeness)
- 50% chance of partial result (25–75% completeness, uniformly distributed)

**Evaluate Planning Doc** — Reviews and potentially improves an existing planning doc.
- Uses the universal outcome formula with ceiling = 1.0
- Can both improve and worsen the doc

**Implement Feature** — Implements code based on the planning doc. Requires a planning doc to exist.
- During investigation phase: 25% chance of triggering a free document reevaluation (using the universal formula). This simulates Claw noticing the plan is incomplete.
- First implementation (code completeness = 0): 25% chance code matches doc completeness exactly, 75% chance code is 25–75% of doc completeness (uniform)
- Re-implementation (code completeness > 0): Uses the universal outcome formula with ceiling = doc completeness

**Write Tests** — Creates tests for a feature. Requires a planning doc to exist.
- Same mechanics as Implement Feature, including the 25% chance of doc reevaluation during investigation
- Test completeness ceiling is doc completeness
- First attempt and re-attempt use the same formulas as code implementation

**Resolve Merge Conflict** — Resolves a merge conflict from parallel work on the same feature.
- The "current value" is the higher completion of the two branches being merged
- Uses the universal outcome formula with that value
- Can cause regressions

### Manual Testing

A special player action (not a Claw task) that reveals hidden quality information.

- Takes **1 simulated hour** per feature
- **Blocks the player** from starting new actions during this time (running Claw instances and workflows continue)
- Two levels of information:
  - **First manual test**: Reveals whether anything is incomplete for this feature (yes/no)
  - **Follow-up manual test** (same 1-hour cost): Reveals *which* of docs/code/tests is the problem, but not how incomplete

This is the only way to get ground truth about feature quality. The strategic decision is whether to invest the time.

### Archipelago Integration

Location checks for a feature are awarded after the feature passes the manual test — meaning all three completeness values (doc, code, tests) are at 100%.

### Cross-Feature Side Effects

Any task that modifies code completeness in one feature has a **25% chance** to affect another feature's code completeness. When triggered:

- The change is a **random amount between -25% and +25%** (can improve or regress)
- Clamped to [0%, 100%], but **NOT limited by the target's doc completeness**
- **75% chance** the affected feature is upstream in the dependency chain
- **25% chance** the affected feature is unrelated

This is **hidden** — the player doesn't know a side effect occurred until tests are run or manual testing is performed. Side effects model the reality that code changes can have unexpected consequences elsewhere — sometimes fixing a bug in one area accidentally fixes (or breaks) something upstream.

### Example Project

The TaskFlow fictional project (20-node dependency graph representing a task management web app) is the primary dev/test example. The Flash/SWFRecomp project (368 nodes from 98 plans) is the real-world dataset.

**Deferred to later versions:**
- Context degradation (error rate increasing over long conversations)
- Model selection (different models with different strengths/weaknesses)
- Autonomy level (humorous/serious consequences of too much autonomy)
- Ralph loops and advanced automation

### Multi-Instance Resource Model

Simulates a Claw subscription model:
- **5-hour usage limit** per rolling period (maps to real Claw Pro limits)
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

A Claw task's progress bar has **one section per subtask**: initial testing, reading code, planning, implementing, regression tests, fixing regressions. Each subtask takes a random amount of time, distributed on a **log scale** — tasks can randomly take orders of magnitude more or less time than expected.

The **regression testing / fixing cycle** is also variable. After implementing, Claw runs some regression tests. If it finds a regression, it attempts a fix, then tests again. The number of these cycles is random. This could be simulated with the same system that handles normal regressions (rolling for whether a regression occurred, then rolling for whether Claw's chosen tests would catch it), or it could be simplified in V1 to a fixed random number of fix cycles.

The game shows a brief **status label** for the current subtask, giving the player information to act on without revealing the internal random state.

This creates strategic decisions:
- **Cancel and retry** — sometimes it's better to abandon a slow task and restart, hoping for a faster run
- **Redundant instances** — assigning the same task to two instances and accepting whichever finishes first (at the cost of credits)
- **Recognizing "stuck"** — a task that's been on the same subtask for a long time might be stuck, or might just be working on a hard part. The player has no way to know for certain

### Credit Accounting

Credits are consumed **continuously** as Claw instances run. Canceling a stuck task is not free — the credits spent so far are gone. This makes the cancel-and-retry decision a genuine cost/benefit calculation, not a free reset.

### Merge Conflict Resolution

When parallel Claw instances produce conflicting changes, the player must assign a Claw instance to resolve the merge conflict. This is itself a task that can randomly fail, potentially introducing regressions. This makes parallel work a genuine risk/reward tradeoff, not just a resource cost.

### Testing Infrastructure

Two ways to run tests, mirroring the real project:

**Claw's inline testing** — Each Claw instance runs tests as part of its work:
- Initial baseline tests at the start
- Implementation-phase spot checks
- Regression tests before committing
- Variable thoroughness: sometimes Claw runs many regression tests and finds nothing; sometimes runs few and catches a regression early

The player can **end Claw's regression testing early** and commit what's there, saving time at the risk of shipping regressions.

**Test workflow (CI)** — The player can trigger a full test suite run separately:
- Runs in the background (simulating GitHub Actions)
- Full suite takes ~10 simulated minutes
- Each individual test takes ~15 simulated seconds
- **V1: one workflow run at a time** — the player must choose whether to wait for the current run to finish, or cancel it and start a new one

Strategic tradeoffs:
- Running the workflow frequently catches regressions early but takes time
- Running it rarely means regressions compound before being discovered
- Ending Claw's regression testing early and using the workflow instead can be more efficient — but the workflow results come later
- **Wait for results?** — the player can assign Claw new tasks before workflow results arrive, but risks building on top of undiscovered regressions
- **Cancel and re-run?** — if Claw just committed, the current workflow run is testing stale code. Cancel and restart, or wait for it to finish and then run again?

V1 only supports running the full test suite. Future versions may allow selecting subsets and choosing parallelism levels (10/20/30 processes).

---

### Test Result Display

Automated test results are shown as a percentage per feature. The displayed value is:

```
if code_completeness <= test_completeness:
    display = code_completeness / test_completeness
else:
    display = test_completeness / code_completeness
```

When code is less complete than tests, the tests accurately report what's missing. When code is more complete than tests, the tests can't tell — they report their own incompleteness as if it were a code problem. The player can't distinguish between "code is bad" and "tests are incomplete" from the test results alone.

### Regression Interaction with Tests

Assigning a task to improve tests has the same 25% chance to trigger a document reevaluation as a task to improve code. This simulates discovering doc issues while investigating test failures.

---

## Open Questions

- **Log-scale distribution specifics**: What distribution for subtask durations? Log-normal? Power law? Needs to feel unpredictable but not absurd. Playtesting will determine this.

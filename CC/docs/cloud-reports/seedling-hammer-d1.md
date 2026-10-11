# Seedling HAMMER-PHASE — slice D1: the solver's progress emitter

Slice `seedling-hammer-d1` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-11), on the
progress display: *"Both, plus extras"*. This slice is the solver half; the JS arc (`seedling-js-planning-5`) builds the
worker → page transport and the `flashPanel` display against the D0 schema.

| | |
|---|---|
| Start SHA | `dd6ae2e379` (= `origin/main` at the fetch; ≥ `dd6ae2e379`, ancestor checked) |
| Head | the commit carrying this report. D0 `4cbf8e7` · D1 `3538c98` · D2 `b9938b0` · D3 `e42eea4` · D4 `76166b3` + `e4bbc38` |
| Branch | `claude/seedling-hammer-d1-8smupq` (the harness names it; the brief's `seedling-hammer-d1`). Nothing went to `main` |
| Dev servers | `serve-nocache.py 9573` for head (PID 660) and `9574` for the pristine base worktree (PID 1972). Both were killed by PID at the end, and the worktree was removed |
| Verdicts | **W0 PASS · D0 PASS · D1 PASS · D2 PASS (overhead not resolvable on this box, §D2) · D3 PASS · D4 PASS** (after a CI fix-up, §D4) |

## The one thing to know first

**The stream is only as live as the solver's ask density.** The hook is called at fixed points, never on a timer.
The page's 1 Hz throttle therefore cannot post more often than the solver reaches a count point, and some stretches
reach none for over a second:
- the L40 leg (675 t, ~24 s) makes 276 hook calls, and its longest gap is **1.2 s**, inside the kill-chaser stance
  scan;
- the far L40 totem part (a refusal) went **3.5 s** with no call at all.

The JS arc should show "last update N s ago" rather than assume a steady cadence. Adding count points inside those
scans is possible (they are already `kill-chaser` / `detour` fine sites), but that is a solver decision for the planner.

## W0 — the base (PASS)

The BEFORE was measured at a **pristine worktree of `dd6ae2e`** with its own server. The first BEFORE ran in the
working tree and was killed by PID once the prototype edits landed there, so it is not quoted.

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-d1-8smupq origin/main` | `dd6ae2e379` |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. `bulletml-dodge` was `-`, so `git submodule update --init` → `7423ee86` |
| identity block | `SEEDLING_PORT=9574 bash scripts/procgen/identity-block.sh .` at the base worktree | non-`#` md5 **`3a48647f548c821267c3e60cf0ddc496`** (ENEMY `afdc6d1a`, guard `a6d18d49`, battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `712f0ead` exit 0, reference ALL 7 + 5 MATCH). ⚠ The generated-set row needs a Python venv, and the worktree has none. It was re-run alone with the primary venv activated → `OK`, and that value is the one in the md5 |
| the six `--check`s | inside the block | all exit 0 (above) |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted | **605**, `ec857f0ad361491f4a7735994b2322ab` |
| surface / constants / entities / profile | each `--check` | GREEN **265** · PASS **5,623** · PASS 535 · PASS 138 |
| roster | `fixtures/tapes/index.json` `.tapes` | **274** |
| bounded vitest BEFORE | every non-slow test file naming `withSolveDeadline`, `shouldStop`, `fineCheckpoints`, `solveAnytime` or `spaceTimeReach` (11), plus `solverBot`, plus `tapeRunner` | **927/927** |

`jsRuntimeSolverCalibration.slow.test.js` also names them. It is in the slow tier, so it was not run (⚖ 52).

## D0 — the schema (PASS; `4cbf8e7`, pushed before the emitter was committed)

`docs/json/developer/procgen/seedling-solve-progress.md`, v1:

```
{ v: 1,
  segment: { name, index, level, pass?, outcome },
  tree:    { key, role, label, attempts, successes, rejections: { <reason>: n }, active, children: [ … ] },
  tiles:   { level, tile: 16, cols, rows, cells: [ [col, row, reached, firstTick], … ] } | null,
  budget:  { asks: { <site>: n }, work: { <unit>: n } } }
```

What changed from v0, and why (the doc's §5):
- **`segment.index` and `segment.outcome`.** One solve is several `solveSegment`s (anytime passes, two-pass
  discovery), and the solver does not know pass names. `index` lets the caller map a segment to its pass, and `outcome`
  marks the last snapshot.
- **`tree.key` is a role path** (`segment/goal#0/walk/climb/rung:kill/arm:chaser`): unique in the tree and stable
  across snapshots.
- **More roles.** `walk`, `verb`, `climb` and `search` were added, and there is no `strike-cycle`. The strike cycles
  live inside `execKillByPress` (C2's), so the press arm's work is counted as the searches it makes
  (`search:escape-free`, `approach`, `fight`).
- **`tiles` can be `null`, and is kept per level.** There is nothing to show before the first preview, and a segment
  can cross a level.
- **`budget.limit` is the caller's.** The budget (`budgetWork`) belongs to `solveAnytime`.
- **`work.shouldStop`** counts calls to the caller's `shouldStop`. That is the JS arc's work unit
  (`createWorkClock`), measured where it is spent.
- **Rejection keys** are the solver's own words, never invented: an error `code`, a search `bound`, a named code, or
  the deciding clause with every number written `#`.
- **The tile unit is the previewed player state**: `previewWalk`'s samples and `spaceTimeReach`'s kept states. Every
  corridor, stall, detour and dash candidate is certified by a preview, both already carry an absolute tick, and
  counting an expansion alone would leave plain walks blank.

⚠ The worked example came from the emitter as prototyped in the working tree (uncommitted at D0). The brief's
*"before writing the emitter"* could not hold literally, because the brief also asks for an example from a real solve.
The doc was committed and pushed alone, before the emitter was. No field came back from the planner, so v1 is the
draft as published.

## D1 — the emitter (PASS; `3538c98`)

Every count point in `solverBot.js` is `activeProgress !== null` first, so **with no hook each one is a single null
check**.

| count point | file:function | one count is |
|---|---|---|
| deadline site ask | `solverBot.js:deadlineReached`, `:fineDeadlineReached` (now `askDeadline` after the tap); the `walk` check in `solveSegmentUnder`'s `viewOf.advance` (its guard is `activeDeadline !== null \|\| activeProgress !== null`) | an ask point reached, with or without a deadline → `budget.asks[site]` |
| `shouldStop` call | `solverBot.js:askDeadline` | a call to the caller's `shouldStop` → `work.shouldStop` |
| tick | `viewOf.advance` | a driven tick → `work.ticks`, `segment.level` |
| segment | `solverBot.js:solveSegment` → `solveProgress.progressSegment` (takes `onProgress`; `solveSegmentDeadlined` is the old body) | one `solveSegment` |
| goal | `solveSegmentUnder`, the goal loop | one goal (`goal#<index>`) |
| walk | `walkTo` = a wrapper around `walkToUnder` | one walk |
| verb | `walkToUnder`, the frontier branch (enter before the stance walk, leave after `records.push`) | one frontier strategy applied |
| climb | `climbLadder` = a wrapper around `climbLadderUnder` | one climb |
| rung | `climbLadderUnder`: `progressRung` at each rung's start (avoid, dodge ×3 arms, pull, time, bait, kill, detour); `rowFor` → `progressRow` (the carried refusal tallied once by identity; `extra.arm`) | one rung asked / its rejection |
| arm | `rowFor`'s `extra.arm`; `execKill` (press, chaser), at the caller of `execKillByPress` / `execKillByChaser` | one arm tried |
| search | `pressEscapeOnce`'s `traced` (`escape-<phase>`), `deriveApproach` (`approach`), `deriveFight`'s `done` (`fight`) | one space-time search; its `bound` is the rejection; `expansions` → `work.expansions` |
| tiles | `previewWalk`'s return (`progressPreview`); `spaceTimeReach`'s new `onNode` (null by default) at the three callers | a previewed / kept state at its absolute run tick |
| readers | `solveSegmentUnder` | `waypointsPlanned`, `replans`, `dashesPressed`, read at `peek()` |

- **Untouched functions.** No count point sits inside `spinnerFightForecast`, `spinnerForecastWithPress`,
  `deriveStrike`, `execKillByPress`, `execClearTag`, `pendingEarnedClears`, push/block planning, chaser leash pricing
  or `planSwordDash`.
- **The emitter's other properties.** `solveProgress.js` reads no clock and swallows a hook's throw. A snapshot is
  built fresh on each `peek()`. `withSolveProgress` nests and is re-exported from `solverBot`. `installSolveProgress`
  (added in D3) installs for a whole process.
- **The probe.** `scripts/procgen/probe-seedling-solve-progress.mjs` takes `--tape`, `--goal`, `--residue`,
  `--every`, `--out`, `--deadline=never`, `--hook=peek|silent|none`, `--repeat` and `--compare`. It runs a
  `twoPassSolve` of a fixture's staging, which is `async` only for its game oracle. The probe's oracle throws
  synchronously, so no `await` is reached and the synchronous installs cover every pass.

## D2 — evidence (PASS; `b9938b0`)

Three streams under `seedling-hammer-d1-evidence/`, **360 KB** together. Each was solved under a never-tripping deadline
with fine checkpoints, the page's budgeted pass:

| stream | solve | hook calls | lines | final snapshot | `peek()` median / max | longest gap between calls |
|---|---|---|---|---|---|---|
| `l18-hammer-escape-kill.jsonl` | `r9-solve-18` residue 21 → exit (176,112): **445 t, 3 segments** (kill-lock discovered then measured), press kill, 15 escape searches (1 `exhausted`) | 1,441 | 58 (every 25th) | **1,949 B** | 0.044 / 0.408 ms | 61 ms |
| `l40-climb-kill-chaser.jsonl` | `r5-l40-part5` staging → totem part (160,640): **675 t**, avoid → pull (passed over) → time → bait → kill/chaser | 276 | 93 (every 3rd) | **2,983 B** | 0.045 / 0.275 ms | **1,195 ms** |
| `l3-plain-walk.jsonl` | `r8-solve-3` → exit (128,48): **245 t** | 21 | 22 (every call) | **922 B** | 0.019 / 0.157 ms | 44 ms |

Across the timing runs, `peek()` was 0.05–0.17 ms median and ≤ 0.61 ms max. In L18, `work.shouldStop` = 64 = 18
`walk` + 37 `hammer-escape` + 9 `sword-dash` asks.

**Overhead** (scratch driver, `twoPassSolve` in-process). The four modes were interleaved over 5 rounds (L40: 3) with
the order rotated, and run at **base** and at **head**. The identity BEFORE block was running on the same 4 cores:

| solve | base, no hook | head, no hook | head, silent hook | head, peek every 50 | n |
|---|---|---|---|---|---|
| L6 (~50 ms) | 49 (min 37) | 51 (+4%; min 36) | 62 (+28%; min 36) | 46 (−7%; min 36) | 40 |
| L18 | 6,437 (min 5,877) | 6,286 (−2.3%) | 6,558 (+1.9%) | 6,268 (−2.6%) | 10 |
| L40 | 23,120 (min 21,929) | 25,914 (+12%; min 21,202) | 24,909 (+7.7%; min 21,413) | 24,868 (+7.6%; min 20,474) | 3 |

Medians in ms, with the change against base.

**What this measures:**
- **The box's noise exceeds the target.** Head no-hook runs the same instructions as base apart from the null checks,
  yet it reads −2% to +12% against base.
- **The minimums are flat.** Every mode's minimum lies within ±7% of base's, and L6's minimums are all 36–37 ms.
- **The 2% target is not shown.** A silent hook under 2% can be neither confirmed nor ruled out here. The largest
  structured cost is the tile loop in `progressPreview`, one `Map` operation per previewed sample.
- **A clean A/B needs a quiet box.** It is listed in the residue.

## D3 — the pins (PASS; `e42eea4`)

`frontend/modules/seedlingDemo/solveProgress.test.js`, **13/13** (~55 s):
- **Byte-identity.** For L18 residue 21, L6 and L3: no hook, a hook that peeks at every call, a silent hook and a
  throwing hook give the same perTick, trace, records, transitions, dashes, waypoints, replans, passes and persistence.
  Under a never-tripping fine deadline the same holds, and the three segments' `work.shouldStop` sums to the caller's
  own count of `shouldStop` calls. Each segment's Σ `asks` equals its `work.shouldStop`.
- **Structure.** Keys are role paths, and role and label are stable per key. Within a segment, keys never vanish and
  attempts, successes and rejections never fall. A tile's `reached` never falls and its `firstTick` never rises. L6's
  climb is `avoid, pull, time, bait`, and every rung rejection key matches a `rejected[].why` in the trace.
- **Clone safety.** Every snapshot of L6's stream survives `structuredClone`. Mutating it (tree, rejections, children,
  budget, segment, cells) leaves the next `peek()` byte-equal. ⚠ The first cut asserted inside the hook, and the
  emitter swallows a hook's throws by design, so that row could not fail. It now records in the hook and asserts after
  the solve.
- **The install.** `solveSegment({onProgress})`, the `solverBot` re-export, nesting, `installSolveProgress` and its
  idempotent uninstall.
- **`progressReason`.**

Mutations, each run and caught:
- (m1) the observer cuts the preview it is handed: the L6 and L18 identity rows go red;
- (m2) `reach` keeps the latest tick: both `firstTick` rows go red;
- (m3) `snapshotOf` hands out the live `asks`: the clone row goes red.

⚠ m1 was first a 0.001 px nudge to each sample, and no row caught it, because a calm room's decisions do not move.

**Process-wide, under a silent hook** (`scripts/procgen/seedling-solve-progress-hook.mjs`, a node preload):
- **The run.** `NODE_OPTIONS=--import=…/seedling-solve-progress-hook.mjs bash identity-block.sh .` at head.
- **Every row equals AFTER** (non-`#` md5 `3a48647f…`), including **`solve-seedling-r9-campaign --check`
  `712f0ead…` exit 0**.
- **The hook really ran.** The preload's exit log shows 66 node processes that called the hook, **683,495 calls**;
  the r9-campaign `--check` alone made **13,497**.
- ⚠ **The generated-set row.** It was refused by the box lock in that run, because both AFTER blocks ran at once and
  wanted the browser. Re-run alone under the hook, it reads `OK` (722 hook calls).

## D4 — records (PASS; `76166b3`, `e4bbc38`)

- `seedling-bot-log.md` § *Seedling hammer-phase D1 — the solver's progress emitter*.
- `seedling-bot.md`: a paragraph at the end of the driver section, linking `seedling-solve-progress.md`.
- Surface census: `--write`, then `--check` GREEN **265**. The changes are line numbers, plus `solveProgress.js` in
  the `run:level`, `run:world`, `world:width` and `world:height` rows' file lists (the tile map reads them) and in the
  closure family.
- Constants `--check` PASS **5,623**, 0 moved. Entities 535, profile 138, roster 274.
- The reference regenerated (`generate-procgen-reference.mjs`): the doc joins `README_ORDER` after
  `seedling-solver-surface.md`, and the probe and the preload join the instruments index (0 findings). `--check`:
  ALL 7 + 5 MATCH. `check-procgen-docs.mjs`: ALL CHECKS PASSED. `--help` and a bare import are inert on both new
  scripts.
- **Bounded vitest AFTER** (24 files): the W0 set (11), `tapeRunner`, `solveProgress`, `boxLock`,
  `seedlingConstantsCensus`, `procgenDocs/generated`, `entityBlocks`, and the tests that list `scripts/procgen`
  (`checkProcgenHelp`, `gateRoster`, `argvHelp`, `seedlingSolverSurface`, `docLinks`, `reachClosure`,
  `standingValues`). Result: **1246/1249**.
  - `docLinks` (2 rows): the corpus census moves by exactly this slice's two new links (`doc` 274 → 276, corpus 356 →
    358). The pin was re-recorded with its changelog row; the base reads 15/15.
  - `standingValues` › F1 *"a gate that sleeps past the deadline is KILLED"*: **red at the base too** (re-run at the
    `dd6ae2e` worktree). It is environmental, because this container does not reap the killed group's grandchild. Not
    this slice's.
  - tapeRunner pairs 605 `ec857f0a…`, unchanged.
- **CI.** JS Unit Tests at the D1 head (run `38154579939`): **31 failed / 19,705 over 4 files**.
  - `seedlingSolverSurface` and `docLinks` were already fixed in D4.
  - `procgenDocs/docsRender.test.js` (the rendered-link census 356 → 358, the same two links) and
    `quickLaunch/generated.test.js` were in no local list. The second needs
    `node scripts/quicklaunch/generate-docs-index.mjs`, a second generator over the docs tree.
  - Both were fixed in `e4bbc38`; the four files are 131/131 locally.
  - **CI at the final head was still running when this report was written.** Read it with
    `node scripts/procgen/ci-vitest-summary.mjs <head> --wait` (⚖ 52: the suite number is CI's).
- **Identity block AFTER** at head (`SEEDLING_PORT=9573`, venv active): **row for row equal to BEFORE**, md5
  `3a48647f548c821267c3e60cf0ddc496`.

## Deltas (base → head)

- **New:** `solveProgress.js`, `solveProgress.test.js`, the probe, the preload, the schema doc, and the evidence.
- **`solverBot.js`:** the count points, plus `walkTo`, `climbLadder` and `solveSegment` split into a wrapper and its
  old body (`walkToUnder`, `climbLadderUnder`, `solveSegmentDeadlined`), and `deadlineReached`'s body moved to
  `askDeadline`.
- **`spaceTimeReach.js`:** `onNode` (null by default).
- **Generated records:** the surface census (lines, plus the new file), the procgen reference (README index,
  `docsIndex.js`, `instruments.js`, the `architecture.md` region), quickLaunch's `docsIndex.js`, and the two
  doc-corpus link pins.
- **Moved: no committed artifact, no identity row, no tape, no trace.** Nothing was edited in AS3, wasm, gitlinks,
  rules, `jsRuntime*`, the worker or `flashPanel`.

## What the brief got wrong (measured)

- *"Commit and push it before writing the emitter"* together with *"one worked example from a real solve"*: a real
  solve's snapshot needs the emitter. The emitter was prototyped first, and the doc was committed and pushed alone
  before the emitter's commit.
- *"`solveSegment`/`solveAnytime` accept `onProgress`"*: `solveAnytime` is in `jsRuntimeSolver.js`, which is the JS
  arc's (read only here). It needs no edit. It runs its passes synchronously, so `withSolveProgress(hook, () =>
  solveAnytime(…))` covers them, and `segment.index` names the pass (residue).
- *"the work units the solver already counts"*: the deadline asks happen only under an installed deadline. Without one,
  the site counts in `asks` still appear (the ask points are reached), and `work.shouldStop` is 0. The three hammer
  sites and `time` are asked only from inside a search that is handed a `shouldStop`, so without a deadline they are
  absent from `asks`.
- *"C1's harvest went red on exactly these"* (`boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`,
  `entityBlocks`): those were green. The rows that went red for a new doc were `docLinks`,
  `procgenDocs/docsRender` and `quickLaunch/generated`.
- *"no hook = within noise; a hook that never peeks under 2%"*: neither is resolvable on a shared 4-core box. Identical
  code read −2% to +12% (§D2).
- The roster is 274 and tapeRunner pairs are 605 here; C1 quoted 266 / 589. This is a measurement of today's base, not
  a contradiction.

## Residue

- **For the JS arc** (the half that consumes this):
  - Install with `withSolveProgress(hook, () => solveAnytime(…))` in the worker, or thread `onProgress` through
    `solveFromTape` to `solveSegment`.
  - `segment.index` counts each `solveSegment` from 0 under one install. Skipped passes call no `solveSegment`, so
    map an index to a pass by the passes that actually ran, or install per pass with `{pass}`.
  - Read the clock in the hook, and about once a second call `peek()` and post
    `{type:'solve-progress', solveId, snapshot}`.
  - `budget.limit` is the page's to add (`{shouldStop: budgetWork}`). `work.shouldStop` is cumulative per segment,
    while the worker's work clock is cumulative per attempt, so sum over the segments for the meter.
  - Expect gaps of 1–3.5 s with no hook call (see *the one thing to know first*), and say so on the page rather than
    freeze silently.
  - A snapshot is 1–3 KB. `peek()` is ≤ 0.6 ms.
- **For the planner:**
  - CI at the final head (after `e4bbc38`), JS Unit Tests: the read is owed. Expected: green except any pre-existing
    rows.
  - CI dispatch was not attempted (the C1 session got 403). If wanted: `seedling-full-tier.yml` on this branch. The
    solver's default path is byte-identical, so no page leg should move.
  - **The overhead A/B on a quiet box**, if the 2% bound must be shown. The cheapest change to try is a typed array per
    level in place of the `Map` in `reach`.
  - **Hook density inside long scans** (kill-chaser stance scan, detour via set): each of these loops already asks
    `fineDeadlineReached` when fine checkpoints are on. Under a never-tripping fine deadline, the L40 leg still made
    only 276 calls, so the gap is where no site is asked at all. A count point there is a solver-side follow-up.
  - `standingValues` F1 is red on this container at the base too: environmental.
- **Tree:** clean. Scratch, not committed: the BEFORE and AFTER logs, the hooked identity log and its hook log, the
  vitest JSONs, the timing driver and its rows, and the downloaded CI log (all under the session scratchpad).

# seedling-hammer-panel-route: the plan in hand's tile path on the solve-progress stream

Slice `seedling-hammer-panel-route` (Opus, cloud, observation-only). Planner: `seedling-hammer-phase-planning-5`. ⚖ The user, 2026-11-11 (the hammer replan): *"Panel route data (Recommended)"*.

## 1. SHAs

- Start (base): `bc0f06a6501704277081a8426bae71150ca6ff29` (`origin/main`, "train: seedling-lab-touch-fix 050d2e4c90")
- Branch: `claude/seedling-panel-route-data-ggfg88`
- Code: `8aa060a77e` (the stamp, the recorder, the rows). Docs: `bec267ae70` (the schema, the regenerated index). The head is this report's commit, which follows them.
- No planner follow-up arrived during the slice. I followed only the brief.

## 2. The answer first

The tap writes a `route` onto each posted snapshot's `best` (the plan in hand), and a `passRoutes` entry for the other passes that landed a plan. Here is the final post from the real L4 kit leg (`jsRuntimeSolveProgress.test.js`, WITNESSES[1]: dashless 254 t, then full 227 t, which became `best`):

```json
"best": {
  "ok": true, "ticks": 227, "pass": "full",
  "route": { "level": 4,
             "cells":  [[1,1],[1,2],[1,3],[1,4],[2,4],[3,4],[3,3],[4,3],[4,2]],
             "dashes": [[1,1],[1,2],[1,3],[3,4],[3,3],[4,2]] },
  "passRoutes": { "dashless": { "level": 4, "cells": [...], "dashes": [] } }
}
```

The exact shape:

```
best.route      = { level: int, cells: [[col,row], …], dashes: [[col,row], …] | null, thinned?: int }
best.passRoutes = { <pass name>: <route> , … }    // optional; only passes OTHER than best.pass that landed a plan
```

- `route` is present only while `best.ok`. A refusal in hand has no route.
- `best.ok`, `best.ticks` and `best.pass` keep their bytes and come first, in that order.
- `thinned` is present only on a route that went over the cap (§4). No real route has needed it.
- `dashes` is `null` only for a plan whose presses were not recorded. A plan built without a hook installed is the only case, so on the worker stream it is always an array.

**Version: `v` stays 2.** I did not bump `SOLVE_PROGRESS_VERSION`, against the brief; the measured reason is in §7. This follows the precedent for tap stamps: S3's `best`, `request` and `budget.*` were added without a bump. The panel needs nothing for this. I read `origin/seedling-solver-panel-view`, and `seedlingSolveWatch.js` / `seedlingSolveWatchView.js` gate on no `v` anywhere.

**What js needs to know to wire `routeOf`:** `routeOf = (snap) => snap?.best?.route ?? null`.

- It is the **plan in hand**, and that can be an earlier pass's plan than `segment.pass`.
- Its `level` is the **arrival's** level: the route is cut at the plan's first level change. `_drawRoute`'s level guard against `tiles.level` is the right guard.
- `cells` and `dashes` are on the same 16 px grid as `tiles.cells`.
- `_drawRoute` returns early for fewer than 2 cells. That is fine: a 1-cell route is an arrival already on its goal tile.

## 3. Where the waypoints come from, and the cost

- **Positions: already computed.** Every plan `solveFromTape` returns carries `plan.expected`, one `{level, x, y, deaths}` row per tick, with row 0 as the arrival. It is the recorder's trajectory, the one the page's walker checks tick by tick. `x, y` is `run.state` of the same point the tile map bins (`solveProgress.reach`), so `cells` uses `floor(x/16), floor(y/16)`. Only tile changes are kept, so the route is the waypoints, not every tick.
- **Dash presses: added, beside the plan.** The plan does not carry the presses. `solveSegment` counts them internally (`dashTicks`, `dashes.count`), but `solveFromTape` returns neither. So the harness recorder (`jsRuntimeSolver.recordingRun`, the proxy that already writes `expected`) now also reads `run.progress('slashInfo').state.slashDashed` before and after each advance, and records a false → true change. That is the same test `solveSegment` uses for `dashesPressed`. ⚠ **This is an edit in the solver's harness (`jsRuntimeSolver.js`), not in `solverBot.js`.** It is contained three ways:
  - It runs only while a progress hook is installed. `activeProgress !== null` is read once per recorder, so with no hook the recorder is unchanged.
  - The ticks go into a module WeakMap keyed by the plan object (`planDashTicks(plan)`), never onto the plan. The plan's fields, its JSON and the structured clone the worker posts are the same bytes either way (pinned, §5).
  - `slashInfo` is a pure getter (`levelRun.slashInfoNow` builds a fresh object), so the reads change no state.
- **Validated against the solver's own count.** I replayed the four D1 legs in node (a scratch probe, not committed) and got recorder count = `out.dashes.count`: L18 7 = 7, L40 3 = 3, L6 0 = 0, L3 0 = 0. On the worker's L4 leg the final segment's `dashesPressed` is 6, and the route has 6 dash tiles. The row pins that the route has dashes iff `dashesPressed > 0`, and no more dash tiles than presses.
- **Cost per pass.** `planRoute` runs once per plan, in `onPass`; a WeakMap means a plan kept as `best` over several passes is routed once (`tap.stats.routes`). It took 6–31 µs per route on the measured legs, averaged over 200 calls each: L6 6.0, L3 10.6, L40 12.8, L18 31.4 µs. Each post deep-copies the `best` stamp (`structuredClone`, at most ~400 B of route) so no two posts share arrays. The recorder adds two `slashInfo` reads per driven tick, under a hook only.
- There is no re-simulation; nothing is replayed in the tap.

## 4. The bound, and the largest measured route

- **Bound:** `ROUTE_MAX_CELLS = 256`. A longer route is thinned evenly to 256 cells, keeping the first (the arrival) and the last, and `thinned` holds the count before. `dashes` is not thinned; it is at most the plan's press count.
- **Measured** (cells / bytes of `JSON.stringify(route)`):

| leg | ticks | levels | cells | dashes | bytes |
|---|---|---|---|---|---|
| L40 kill rung (`r5-l40-part5`), the largest | 679 | 40 | **44** | 3 | **401** |
| L18 hammer room (`r9-solve-18`, residue 21) | 367 | 18 → 19 | 23 | 6 | 209 |
| L3 plain walk (`r8-solve-3`) | 245 | 3 → 4 | 16 | 0 | 129 |
| L6 ladder (`r8-solve-6`; also the worker leg) | 288–294 | 6 → 7 | 15 | 0 | 127 |
| L4 kit, hold + shove (worker leg) | 227 | 4 | 9 | 6 | 122 |

The cap is about 6× the largest real route. `passRoutes` adds at most one more route per other pass; there are 2 passes today.

- **Cross-level rule:** keep the cells before the plan's first level change. Three of the five legs change level at their end (the exit tick): 18 → 19, 6 → 7, 3 → 4. Why: the tile map is the level the segment searched, and the view draws a route only on that level, so a second level's cells would be drawn over the wrong room.

## 5. Byte-identity evidence

- **`jsRuntimeSolveProgress.test.js` PANEL-ROUTE rows** (new, ×2: the L6 bare and L4 kit worker legs, solved with and without a subscriber). They pin these as equal:
  - each result plan's `v8.serialize`, wall-clock keys stripped recursively and Maps/Sets included;
  - every `pass` message's answer;
  - each attempt's `work` total;
  - the end `runDigest`.
  - The pre-existing row 1 there still pins the request, the plans' JSON and the session's `perTick` on/off.
  - **Mutant:** I put the dash ticks ON the plan (`plan.dashTicks = …`). Both rows went red, and the code was restored (cmp-checked).
- **`solveProgress.test.js`** (the §6 contract, D1/RK/TC2/PR's pinned md5s and totals): **58/58**, 93 s. The solver emitter is untouched.
- **`batch-seedling-acceptance.mjs 2>/dev/null | md5sum` = `abb206c88de25e7ba1874510d493ce85`**, the same as the brief's, at the code commit.
- **Generators:** `generate-procgen-reference.mjs --check`: ALL 7 MODULES AND 5 REGIONS MATCH (after regenerating `procgenDocs/generated/docsIndex.js` and `procgen/README.md`, whose word counts my doc edits moved). `generate-docs-index.mjs --check`: current (195 docs). `census-seedling-solver-surface.mjs --check`: GREEN, 371 rows. I needed no `--write`.

## 6. Files, rows, bounded runs

Files changed:
- `frontend/modules/seedlingDemo/solveProgressTap.js`: `planRoute`, `ROUTE_MAX_CELLS`, `ROUTE_TILE`, the `dashTicksOf` option, the `route` / `passRoutes` stamping in `onPass`, a per-post copy of `best`, and `stats.routes`.
- `frontend/modules/seedlingDemo/jsRuntimeSolver.js`: the recorder's hook-only dash record, `planDashTicks`, and the import of `activeProgress` (`solveProgress.js` has no imports, so there is no cycle).
- `frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js`: passes `dashTicksOf: planDashTicks` to the tap.
- `frontend/modules/seedlingDemo/solveProgressTap.test.js`: 7 rows and the r1–r6 mutant list. I ran each mutant; each reds 1–3 rows.
- `frontend/modules/seedlingDemo/jsRuntimeSolveProgress.test.js`: 2 rows (route + byte-identity, on real legs).
- `docs/json/developer/procgen/seedling-solve-progress.md`: §6 pins, and §7's table row plus *The route*.
- `docs/json/developer/procgen/seedling-bot.md`: one sentence in the solve-progress paragraph.
- `docs/json/developer/procgen/README.md` and `frontend/modules/procgenDocs/generated/docsIndex.js`: regenerated.

Bounded vitest runs, all from the repo root, by path:

| run | result |
|---|---|
| `npx vitest run frontend/modules/seedlingDemo/solveProgressTap.test.js frontend/modules/seedlingDemo/jsRuntimeSolveProgress.test.js` | 58/58 (42 + 16) |
| `npx vitest run frontend/modules/seedlingDemo/solveProgress.test.js` | 58/58 |
| `npx vitest run` over the seven other `jsRuntimeSolve*.test.js` (Service, Solver, Anytime, EventGoal, ForkRun, LimitOff, ShouldStop) | 7 files, 111/111 |

Per ruling 52, the suite number comes from CI at the pushed SHA and is not measured here.

## 7. What the brief got wrong (measured)

1. **"Bump `SOLVE_PROGRESS_VERSION`" conflicts with "existing fields keep their bytes".** `v` is on every snapshot. TC2's pinned stream md5 (`solveProgress.test.js`, `streamOf()`) hashes each snapshot minus `frame`/`caches`/`churn`, so `v` is in the pinned bytes, and the RK row asserts `x.v === 2`. A bump would move pinned bytes, and they would have to be re-recorded. Also, `SOLVE_PROGRESS_VERSION` is the solver emitter's version, while `route` is a tap stamp. The schema doc's precedent (S3) adds tap stamps without a bump ("no consumer gates on `v`"), and the panel branch gates on no `v`. I kept `v: 2`. If the planner wants a version signal anyway, a tap-side one (for example `best.routeV`) would not touch pinned bytes. Say so and I'll add it.
2. **"End = the goal tile."** For an exit goal the plan's last row on the arrival's level is the tile before the exit: the exit tick lands on the next level. On L18 (exit (176,112), tile (11,7)) the route ends at (10,7). I did not append a synthetic goal tile. The view already has the goal ✕ (`goalTileOf`).
3. **"If the plan does not carry per-tick positions, find what does."** It does carry them (`plan.expected`). What it lacks is the **dash presses**, so the edit was a press record in the harness recorder (§3), kept beside the plan and pinned byte-identical. It is not a position record.
4. **(b) `frame.label` was not done.** `frame` is the solver emitter's field (`solveProgress.frameOf`), not the tap's. A label would be a new solver-side field on every snapshot, outside this slice's "tap only" lane, and the panel already derives "trying now" from the tree (`tryingNowOf`). If wanted, it is a separate small slice.

## 8. Residue

- The measurement probe for §4's L18/L40/L3 rows (node, `twoPassSolve` plus a recording `makeRun`) lived in the session scratchpad and was not committed. `probe-seedling-solve-progress.mjs --hook=tap` does not print routes: its `twoPassSolve` returns no `expected`.
- `passRoutes` has two passes today (`dashless`, `full`). A held retry's tap is a new tap, so a retry's routes start empty, like its `best` stamp.
- When the `seedling-solve-progress-hook.mjs` preload is used (the identity block under a hook), the recorder's dash reads are on. They are reads only, and the plan is unchanged; the acceptance md5 is unchanged at the default (no preload).
- js's follow-up (not mine): `routeOf`'s one line, the dash marker and its row in `flashPanel/`.

# seedling-slowsolve-check — the slowest page solve, and a feature check that shows its dash pass cut and uncut

Slice of the HAMMER-PHASE planner (`seedling-hammer-phase-planning`), local, Opus. Branch `seedling-slowsolve-check`,
built on `solve-progress-auto` (it lands after that slice). Evidence:
[`seedling-slowsolve-check-evidence/`](./seedling-slowsolve-check-evidence/). Full write-up: `seedling-bot-log.md`
§ SLOWSOLVE.

## The user's question, answered (D1)

*"These sessions have been reporting solves that take over a minute to complete, but when I tested in the frontend
page, I didn't encounter any solves that took more than a few seconds."*

The minute-long numbers are node runs with no work budget. The producers (`view-solve.mjs`, `d1-leg.mjs`) call
`solveSegment` in place, on stagings and legs at the hardest spot in the game (L40's chest behind the spinners), and
the numbers are often summed over many residues (the L18 sweep's ~110 s is 45 solves of a few seconds each). The
page caps every solve attempt at 640 work units, gives the optional dash pass only the first 85, retries at most 3
times, and has a 300 s backstop. A solve that would take minutes is therefore cut (about 14 s per attempt on this box)
and the walk declines. Every page solve that completes takes under 6 s: in the CI divergence sweep, 730 completed
solves have a median of 143 ms and a max of 5.9 s. The route a person plays rarely reaches L40's chest.

| workload | start | budget / cut | outcome | time |
|---|---|---|---|---|
| node: staging A (L40 chest) | staging | none | REFUSED at t1.7–3k | 60–130 s |
| node: legs 397 / 414 (L40 chest) | re-staged leg | none | REFUSED | 123–155 s (742 s in one variant) |
| node: the L18 sweep | 45 residues | none | mixed | ~110–175 s summed |
| page: L40 chest from L39 / L43 | arrival, 4 items | 641/640 per attempt, ×4 | REFUSED | ~14 s per attempt, 77–97 s |
| page: L32 Bob Boss (sweep max) | leg | inside 640 | SOLVED | 5.9 s (wasm) |
| page: L18 with the sword | entry from L16 | 56/640 | SOLVED | 4.4 s |
| page: L12 leg 108 | entry from L0 | 36 + 51, dash pass cut by window | SOLVED | 1.6 s |
| page: L6 demo | entry from L5 | 15/640 | SOLVED | 1.2 s |

## The check (D2)

**`seedling-dash-window`.** ⚖ The user, via the planner: "the longest solve that actually completes", "an example that
isn't a boss fight", and "a version with the time limits extended, for the optional parts … like dashing".

- **Target:** leg 108, L12 from L0's door (16, 80) to the teleporter (432, 352), sword in hand. The five longer
  non-boss solves (418, 385, 408, 168, 404) cannot be staged by the panel; the log says why for each.
  - Leg 168 (the same goal from L95's lower door) cannot be held on seedling_playthrough: the region glue moves the
    arrival to (16, 80).
- **Window 85 (the default):** the dashless pass ships a 561-tick walk (36 units). The full pass is REFUSED at
  `sword-dash` with limit `window` (51 units).
- **Window 0:** the full pass SOLVES at 202 units and ships a 328-tick walk (−42%), for about 2 s more of solving.
  Budget 2560 changes nothing (202 < 640).
- **How to run it by hand:** open the **Tutorials** panel → **Feature checks** → *Seedling: the solver's dash pass,
  cut by its window and then given the time* → Play (or Do it step by step). It loads seedling_playthrough, grants the
  sword through the Inventory panel, and stages the solve twice. Watch the Solve Progress view: the tree, the tiles
  reached, and the work meter against "upgrade window 85" and then "upgrade window 640".
- **Walk row** `feature-check-seedling-dash-window`, manual batch `feature-checks`. JS runtime, so no WebGPU.
  - Local: PASSED 3 of 3 at the build tip, 70.7–71.4 s, and 74.6 s at the rebased tip `f7ac384b1c`; headroom 13%.
  - CI (run 38842923532): PASSED in 49.0 s; headroom 9%.
  - The last step waits for the solve's FINAL note and the crossing to L33. No "progress for N s" fallback was
    needed: the whole walk fits.
- **Status** is `ready`. The planner and the user decide whether to keep it.

### Panel changes (js-6's OK, conditions met)

All in `flashPanel/seedlingSolveDemo.js` and `FlashPanelUI.stageSolveDemo`:
- `l12-dash-cut` with `needs` (held AND slotted, never written by the panel).
- **New behaviour:** a demo walk honours `flashPanel.seedlingSolverUpgradeWindowWork`, as the playback controller's
  walks do.
- A demo whose arrival the region glue moved is refused by name. Without this, the check once passed falsely on a
  7-tick solve from (432, 368).
- The stale L18 "20–45 s" comment now carries the page's measurement.

Pins in `seedlingSolveDemo.test.js`:
- The default push leaves the L6 demo's request byte-identical (a real worker solve), and window 0 is stamped `null`.
- Mutants m1 (push +1), m2 (flag-only needs) and m3 (x-only moved) all go red.
- No defaults moved, and no new setting.

### Leg 108's request, page vs sweep (condition 3)

The sweep's request comes from CI run 38841057409 on main `506581c32e` (wasm).

- **Equal:** `staging.boot` (12, 16, 80), `seam.items`, `inventory_slots` [0], `primary`, `save`, `persistence`,
  `grants`, `solverGoal`, `budgetWork` 640 and `upgradeWindowWork` 85. The sweep ships the same 561-tick plan, with
  the full pass cut at `sword-dash`.
- **Different, all structural (JS vs wasm):**
  - `name`;
  - `passes` (omitted on JS);
  - `rng`;
  - the seam's shape (`items.hitsMax` vs `hits_max`; `beam`, `cutscene`, `menu_state`, `rock_set` and `secondary`
    absent on JS);
  - `seam.time` (4800 / 4899);
  - `pins` order;
  - `source` (by id vs 116 inline records);
  - the `live` digest shape.
- Table: `leg108-request-diff.txt`.

## Residues (named, not fixed)

1. The JS runtime has no budget setting. `seedlingWasmSolverBudgetWork` is wasm-only, and the JS page reads only
   `?solverBudgetWork=`.
2. A sword given as the `Main.hasSword` flag alone (seedling_atlas) gets no slot. Sword-dash is unavailable and the
   full pass is SKIPPED.
3. seedling_playthrough's region glue places an arrival by the region the player left. A demo there can stage only
   the start-side entry, and a second staging needs a reload.
4. `presets/seedling_playthrough/AP_1/` is not the canonical seed-1 preset (`AP_14089154938208861744`). The early
   probes used it; every number above was re-measured on the canonical one.

## Gates run here

- Bounded vitest, 220 tests over 10 files: `seedlingSolveDemo`, `seedlingSolveProgress{,Modes}`,
  `flashPanelSolverBudgetSettings`, `tutorials/`, `testBatches`, `testWebgpu`, `procgenDocs/generated`,
  `procgenDocs/docLinks`, `quickLaunch/generated`.
- `generate-procgen-reference.mjs --check` and `generate-docs-index.mjs`.
- `feature-checks` locally and on CI.
- No pytest, no unfiltered vitest, no sweep (defaults untouched).
- The other gates js-6 named (probes, JSUT, test-templates) are left to the harvest.

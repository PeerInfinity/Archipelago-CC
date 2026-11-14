# Seedling hammer-phase — L41 PUNCHER LADDER (L40 Totem Part 64,144)

Slice `seedling-hammer-l41-puncher-ladder` (Opus, cloud). Planner: `seedling-hammer-phase-planning-8`.
No planner follow-up arrived during the slice, so none was followed.

## 1. Commits

- **Start:** `4c3afd9b32` (`origin/hammer-harvest-wave2`, which is main `39e8a29f7f` TRAIN 104 plus the wave-2 OFF switches).
- **Branch:** `claude/seedling-l41-puncher-ladder-s6erdq`.
- **Commits:**
  - `c7497a95` the switch and its rows;
  - `274ebe18` docs and the regenerated reference;
  - the report commit (this file plus the evidence directory) is the head.

## 2. The answer first

- **Switch:** `solverBot.KILL_HIT_BODY` (`SEEDLING_KILL_HIT_BODY=1`, `withKillHitBody`). It ships **OFF**.
- **The one thing to know first:** the refusal was not a missing puncher rung. The kill rung never asked about the puncher.
  - The removal chooser ranks bodies by distance from the AIM.
  - Here every body "admits a corridor", because AVOID's re-plan already admits one with every volume standing.
  - So the chooser's top pick was `spinner@192,128`, about 650 px away beside the goal.
  - BAIT and KILL both reasoned about that spinner and refused. The chaser arm, which already reads the hit's order, never ran.
  - ON, the kill rung takes the body the probe actually hit when the chooser's top pick is not on the hit.
- **Results:**
  - **Leg** `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144`, ON, solves **hitless, 1,316 t, 0 deaths**.
  - **Game witness (p4g production engine):** the game ended `done`. The game's end equals the model's (72.23, 151.56), and there were 0 room hits.
  - **But the result depends on the arrival clock.** At 42 of 71 arrival clocks the leg solves. At the other 29, the next wall is `spinner@192,160`'s 13 px hammer line, which is the L40 spinner wall another slice owns.
- **OFF identity:** acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base, with my change OFF, and with it ON.

## 3. The reproduction (measured)

- **Leg list at the base:**
  - Command: `seedling-divergence-legs.mjs --presets=seedling_playthrough`, giving 923 legs.
  - The L41 leg is id **855** (the witness report called it 868; the BK2 landing moved the ids).
  - The L42 control is id 857.
- **Sweep:**
  - Command: `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=480000 --page=seedling_bot_ap_p4g --capture-requests`, both legs.
  - Leg 855 `failed`; leg 857 `done` (1,239 t). Rows are in `sweep/sweep.rows.jsonl.gz`.
- **Node solve of the captured request** (`tools/solvecap.mjs` / the witness's `legwitness.mjs`): it refused in 2.3 s (19 work units). The climb, rung by rung, all at t0 from (936,104):
  - The hit: `chaser:puncher@816,128` at (840.3,120.5), inside leash 80 (d = 9).
  - **avoid:** the danger-forbidden corridor still probes dangerous at the same point.
  - **time:** the aim is 865 px away, and `MOVER_RANGE` is 48 px.
  - **bait:** "`spinner@192,128` is a Spinner: a billiard…" — the wrong body.
  - **kill:** "`spinner@192,128` is a live Spinner, and the press arm refused…" — the wrong body. The chaser arm was never reached.
  - **narrow:** the corridor is dangerous on the puncher at (839.2,122.3).
  - **detour:** `DETOUR_VIA_BOUND` (3,479 vias).
  - **forced-hit:** no forced hit was proven.
- **Why the spinner.** In `chooseBodyToRemove`, removing any one body's volume admits a corridor, because the full-volume plan already admits one. So the list is the whole roster, sorted by distance to (64,144), and the head is `spinner@192,128`.
- **Is a hitless line in the model?** Yes. The kill rung pointed at the puncher (a throwaway experiment, then the switch) gives 1,316 t, 0 hits.
  - The plan's verbs are `hold`, `kill`, `walk`.
  - The chaser arm kills `puncher@816,128` around t100, then the walk continues to the totem.

## 4. Design and change; OFF identity

- **Design:** this is a target fix, not a new rung. The kill rung already has the right arm (the chaser arm, which reads `interceptOrder(removable, hit)`). It was gated behind the chooser's top pick.
  - `killHitBodyOf(removable, hit)`: if the top pick is not among `hit.sources`, and the first entry of `interceptOrder` is, return that body. Otherwise return `null`.
  - ON, the kill rung's `target` is that body. The rung's arms then route as for any target: a chaser goes to the chaser arm, a spinner to the press arm.
  - BAIT is unchanged.
  - No constants, levels or coordinates appear in the logic.
- **Change** (`solverBot.js`):
  - one new block after `withAwakeBossFirst`: the `KILL_HIT_BODY` switch, `withKillHitBody` and `killHitBodyOf`;
  - one call site, the kill rung's `const target = …`, which becomes three lines.
  - The switch's `retargets` array records one row per retarget (measurement).
- **Channel:** `SEEDLING_KILL_HIT_BODY` is in `SOLVER_ENV_NAMES`. The decision runs in the **solve worker** (solverBot inside it), not on the page's main thread, so it needs no `pageSolverEnvSwitchOn`.
- **Acceptance md5** (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

| run | md5 |
|---|---|
| base `4c3afd9b32` | `391322d681b7aa0229d94b3f6906d024` |
| this change, OFF | `391322d681b7aa0229d94b3f6906d024` |
| this change, `SEEDLING_KILL_HIT_BODY=1` | `391322d681b7aa0229d94b3f6906d024` |

The switch moves no acceptance row.

## 5. Rows and bounded vitest runs

| file | tier | rows | result |
|---|---|---|---|
| `hammerKillHitBody.test.js` | default | 2: the switch ships OFF and the channel carries it; `killHitBodyOf`'s cases (retarget, head on the hit, the hit names no admitted body, empty list, no sources) | 2 passed |
| `hammerKillHitBody.train.test.js` | train | 3: leg 855 OFF refuses EXHAUSTED on the puncher, with BAIT and KILL naming `spinner@192,128`; leg 855 ON retargets spinner → puncher and solves; the plan re-driven on a fresh run reaches (64,144) ±16 with 0 hits and 0 deaths; leg 857 (the L42 control) is solved OFF, and ON its plan is byte-identical (sha1 of the solution) | 3 passed (21 s) |
| `solverEnvChannel.test.js` | default | the name table | 11 passed |
| `frontend/modules/procgenDocs/` | default | the link-census pins, after regenerating | 8 files, 493 passed |

- **Fixtures:** `fixtures/hammer-l41-puncher-ladder/leg85{5,7}-*-request.json.gz`. Each is the p4g page's own solve request at the base (OFF arm, `seam.time` 5507 / 5455), with the atlas records cut to level 40 (the BK2-APPROACH-ORDER shape), about 10 KB each.
- **Generators:**
  - `census-seedling-solver-surface.mjs --write`: 373 rows, unchanged; `--check` GREEN.
  - `generate-procgen-reference.mjs`: after the docs edit it rewrote `README.md` and `procgenDocs/generated/docsIndex.js`; `--check` says ALL MATCH.
  - `generate-docs-index.mjs`: current.
- **Not run:** unfiltered vitest, pytest, `standing-values --write`.

## 6. Game witness (p4g)

All runs used `--page=seedling_bot_ap_p4g --solver-env=SEEDLING_KILL_HIT_BODY=1`, the production wasm engine, one fresh page per leg.

| run | leg | arrival `seam.time` | end | detail |
|---|---|---|---|---|
| ON #1 | 855 | 5478 | `failed` | The solver refused `spinner@192,160`'s HAMMER at (315.1,88.3), horizon 789 (phase 25/45). No game play happened. |
| ON #2 | 855 | 5515 | **`done`** | 1,316 t, one plan; verbs `hold`, `kill`, `walk`; no divergence, 0 recoveries; game end = expected end (72.2296, 151.5578), deaths 0; `roomHits` max 0 over 1,711 samples |
| ON | 857 (control) | 5496 | `done` | 1,239 t; the same plan as OFF |

- **The arrival clock decides between those outcomes, so I measured it in node.**
  - Input: the ON #2 request with only `seam.time` moved, 5460–5530 (`clock/clock-{off,on}.txt`).
  - **OFF:** 71 of 71 refuse on `puncher@816,128`.
  - **ON:** 42 of 71 solve hitless (always 1,316 t). 29 of 71 refuse on `spinner@192,160`'s hammer.
  - The refusing clocks are 5473, 5475–5479, 5481–5485, 5487–5491, 5493–5494, 5518, 5520–5524 and 5526–5530.
  - At 5478, node reproduces ON #1's refusal exactly. The second retarget there is `spinner@192,144` → `spinner@192,160`, and the press arm refuses.
- Rows: `sweep/sweep-on.rows.jsonl.gz`, `sweep/sweep-on2.rows.jsonl.gz`.

## 7. Census: which seed-1 legs the change can move

- **Puncher rooms.** The map has six punchers, mapped to rooms with the subregion partition (`tools/puncher-census.mjs`, `census/puncher-census.txt`). 139 of the 923 legs have a puncher in their region or link chain:

| region | punchers | legs |
|---|---|---|
| `level_12__r0c19` | `puncher@416,256` (behind `bosslock@416,240`/`@432,240`) | 77 |
| `level_40__r26c13` | `puncher@128,624` | 38 |
| `level_40__r0c53` | `puncher@816,128` | 12 |
| `level_26__r2c4` | `puncher@32,208`, `puncher@80,168` | 6 |
| `level_53__r2c2` | `puncher@136,96` | 6 |

- **Measured.** I captured the 22 other legs of the L40 r0c53, L26 and L53 rooms on the page, OFF (`sweep/sweep-census.rows.jsonl.gz`), and solved each captured request in node OFF and ON (`census/census-solve-{off,on}.txt`).
  - **14 solved OFF and solve identically ON:** the same ticks, end and hits. 13 of them see no retarget at all.
  - **Leg 361** (the 14th) (`level_40__r0c53 <- in_L41_0_160 -> location:L40 flag 7: wandlock@208,128 cleared`) records 2 retargets ON (`bob@304,144` → `puncher@816,128`). Its plan digest is `2fb573c74605` in both arms (`census/leg361-digest.txt`). The retarget falls in a climb whose answer is not the plan.
  - **2 have no request:** 273 and 276 (L26 rocklock) failed before any solve on the page.
  - **2 refuse identically ON** on L53's walls, unrelated to the puncher:
    - 900: an anytime deadline;
    - 901: a clear-tag count waiting on `[jellyfish…, puncher@136,96, …]`.
  - 4 legs were skipped by the leg list (goal-is-a-staged-event): 856, 858, 859 and 860.
- **Where else it can move.** It can only move a climb whose chooser top pick is off the hit while the hit names an admitted body. In the measured set that happened only in the r0c53 room.
- **Not measured here** (each needs a page sweep):
  - the 77 L12 legs and the 38 L40 r26c13 legs;
  - non-puncher rooms (the switch is not puncher-specific: any chaser or spinner hit qualifies).
  - The acceptance batch, which is unmoved ON, is the only whole-set measure I took. A full sweep with `--solver-env=SEEDLING_KILL_HIT_BODY=1` is the next measurement. I did not dispatch it, because B1 puts bulk sweeps after hours.

## 8. What the brief got wrong (measured)

- **The ladder is not "exhausted on the puncher".** Its rungs never asked about the puncher:
  - BAIT and KILL reasoned about `spinner@192,128`, about 650 px away, beside the goal.
  - The defect is target selection, not a missing rung or a model gap. No fidelity hand-over is owed for this wall.
- **Leg ids moved.** The brief and the witness report named leg 868. At the base it is **855** (the L42 leg is 857, formerly 870).
- **"Solved hitless" holds only on some arrival clocks.** Behind the puncher is the L40 spinner wall (`spinner@192,160`'s hammer line), at 29 of 71 clocks.

## 9. Residue and hand-overs

- **To the L40 spinner-walls slice:** leg 855 ON at `seam.time` 5478 (and the 28 other clocks listed in §6) refuses as follows: "contact: the combat ladder is EXHAUSTED … `spinner:spinner@192,160` (a live Spinner's HAMMER at (328.0,94.5) at horizon 789 — the exact 13 px `collideLine` at Game.time 6550 (phase 25/45, angle 200.0°))". The press arm refused the retargeted `spinner@192,160` at t263.
  - Reproduce with `tools/solvecap.mjs <ON #2 capture> all 5478` and `SEEDLING_KILL_HIT_BODY=1`.
  - The capture is not committed (1 MB with the full atlas). The fixture `leg855-…` is the OFF arm's request at 5507, which solves ON. Change its `seam.time` to 5478 to reproduce.
- **For the flip decision:** run a whole seed-1 sweep with the switch ON against an OFF sweep (§7), especially the L12 and L40 r26c13 puncher rooms.
- **Scratch:** the tools under the evidence directory (`solvecap.mjs`, `puncher-census.mjs`) are measurement instruments, not producers.
- **What I did not touch:** `contactFidelity.js`, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `flashPanel/*`, `worlds/`, the exporter, AS3, wasm, and gitlinks.
- **Git hygiene:** no `git stash`, no push to `main`, no force-push.

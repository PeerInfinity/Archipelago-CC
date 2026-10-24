# Seedling fidelity SOLVECOST: solver wall-clock (D1 profile · D2 broad phases · D2b the axe arm's work unit · D3 census)

**Slice:** `seedling-fidelity-solvecost`, an Opus build session in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-6`), wave 12 (model coverage), region SOLVECOST.

| | |
|---|---|
| Started from | **`dd6ae2e379`** (the brief's base; the harness branch already pointed there) |
| Head | the commit that adds this report (the last one on the branch); the code head is **`12121ba`**, the records head **`6bc91f9`** |
| Harness branch | `claude/seedling-solvecost-profile-wk9at0` (`seedling-fidelity-solvecost` was never created or pushed) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (byte-identical, ships ON) · D2b PASS, shipped OFF, ⛔ STOP for the default flip (movers below) · D3 PASS (with one measured "no": L98 → L99)** |
| Commits | `01e1a76` D2 · `12121ba` D2b · `595bdb6` constants census · `6bc91f9` records (log, `seedling-bot.md`, reference, profile rows) · this report |

## The one thing to know first

**Dash planning was slow because of what each preview asks the room, not because of the dash search.** On survey
step 177, `planSwordDash` was 91.6 % of the solve. But 80 % of all self time sat in three linear scans of static
geometry, run by the preview's physics step:
- `collidesSolid` + `liveRectOf`: every solid of L12, once per pixel of travel;
- the nearest-tile scan: every walkable tile, once per tick.

Indexing them is byte-identical by construction. It cuts the L12 solves **5.8–12.7×**, and it speeds up the
dashless solves B actually runs by the same factor. B's slow legs never call `planSwordDash`.

Second: **L98 → L99 does not stop being budget-bound, and speed was never why.** With no budget at all, in node with
the live inventory, both arrivals refuse: *"kill: no side of iceturret@104,24 is reachable … the combat ladder is
EXHAUSTED"*. That costs 31,559 and 24,730 work units, ~11 s. The budget only hid which refusal it was. Its units are
`axe-dodge` asks at ~0.3 ms each, which is what D2b is about.

## W0, at `dd6ae2e` (pristine primary tree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9633 bash scripts/procgen/identity-block.sh .` | non-`#` md5 `05da98cf…`. Every row in the table below. The reference row read **4 DIFFER**: five submodules were never initialised by the bootstrap (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine). After `git submodule update --init` of those five, `generate-procgen-reference --check` reads **ALL 7 + 5 MATCH** at the base. Environment, not code |
| six `--check`s | the block's producer loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, **all exit 0** |
| other identity rows | the block | maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, level pre/post `e28c1e5d`/`fb1a59e5`, generated set OK |
| bounded vitest BEFORE | 68 files: the brief's whole list, plus every test naming a function D2 touches (`collidesSolid`, `plannerBlockerAt`, `nearestWalkableTile*`, `pitTiles`, `lethalTerrainTiles`, `resolveTerrainState`, `solidBoxesForMover`) | **3,256 / 3,256** |
| tapeRunner pairs | `status\tfullName` of `tapeRunner.test.js`, sorted | **605**, `ec857f0ad361491f4a7735994b2322ab` |
| surface / constants / profile / entities | the four `--check`s | GREEN **265** · PASS **5,623** · PASS **138** (both JSONs) · PASS **535** |
| roster | `fixtures/tapes/index.json` | **274** tapes |

## D1 — the profile (PASS)

`node --cpu-prof` on the solve, analysed by inclusive (once per sample) and self time per function.

**Survey step 177** (L12 (592,16) → teleporter@0,352, SOLVED 1269 t; it was step 134/175 before the rules arc
inserted step 76). 245 s on this box with W0 running beside it:

| inclusive | share | | self | share |
|---|---|---|---|---|
| `walkTo` | 96.5 % | | `collidesSolid` (levelWorld) | **37.5 %** |
| `planSwordDash` | **91.6 %** | | `liveRectOf` | **28.5 %** |
| `previewWalk` | 91.2 % | | `resolveTerrainState` (the nearest-tile scan, inlined) | **14.0 %** |
| `levelRun.previewStepper` step | 84.3 % | | GC | 3.1 % |
| `collidesSolid` | 65.1 % | | `stepV2` | 2.1 % |
| `planWaypoints` (the keylock stance search) | 4.7 % | | everything else | < 2 % each |

After D2 (43.8 s), `planSwordDash` is still 79 % of the solve. Its self time is now spread out: GC 16 %, `stepV2` 10 %,
`collidesSolid`'s candidate loop 9 %, the indexed nearest-tile pass 7 %, `assertNormalizedLiveOpts` 4.5 %,
`pull.pushBody` 4.6 %, `camera.onScreen` 4.3 %.

**B's last solves** (battery 38108807480, job 114379914551, logical-links B). B ends at +900 s while solving
"Level 012 - Chest" from the L24 arrival (+782.7 s, no answer by +900). B's pass rows show that its big legs are
**dashless**: `L12 dashless 2570t w283/1`, `L32 dashless 1049t w38/49`, `L16 dashless 854t w257/1`. The full pass trips
the 85-unit window at its first ask on every leg whose dashless pass spent more than 85 units. So B's wall-clock is
dashless solving, which never calls `planSwordDash`, and it pays the same three scans. I reproduced two of B's legs
in node (inventory reconstructed from B's checks: sword, shield, Red/Green keys, torch, fire):

| leg (B) | node reproduction | base | head |
|---|---|---|---|
| L12 r0c19 (16,80) → pit (36,43) → L21 (B: 133 s on CI, `2570t w283/1`) | **`2570 t`, work `283/1` — B's own row** | 55.2 s | **6.9 s** (8.0×) |
| L12 r40c4 (32,704) → Level 012 - Chest (B's last, unfinished) | 3,122 t dashless, work 324/1 | 39.3 s | **5.9 s** (6.7×) |

**L98 → L99** (sweep-4 legs 745 and 748, both "ran out of 640, then 2560 work units"). In node with the live
inventory (from the merged row: slots `[0,1,3,2]`, the 13 items) I reproduced the live refusal **word for word**:
643 then 2,563 units. The wall-clock is small: 1.2–3.1 s per attempt. Asked by site, with a never-tripping counter:

| pass (from 112,176) | `axe-dodge` | `kill-chaser` | `detour` | `walk` |
|---|---|---|---|---|
| dashless | **10,864** | 1,248 | 333 | 17 |
| full | **17,512** | 1,248 | 320 | 17 |

Unbudgeted it **refuses** (iceturret@104,24, no reachable side): 31,559 units from (112,176), 24,730 from (96,112).

⛔ **No hot path is hammer-owned.** `deriveStrike`, the spinner forecasts and `spaceTimeReach.js` do not appear above
0.5 % in either profile. The iceturret refusal behind L98 → L99 is a KILL-arm question (`KILL_ARM_POLICY.Turret` is
the hammer arc's). I hand it over as a finding; I made no edit there.

## D2 — the broad phases (PASS, byte-identical, ON) — `01e1a76`

All in `levelWorld.js`, inside functions nobody else in wave 12 owns:

- **`SOLID_GRID`** (`solidGridFor` / `solidCandidates`): a static 32 px grid over the solids whose live rect can only
  be `s.rect` or none. A crusher, a turret, a rope (`shrunkRect`) or a pushable (`now.rect`) can occupy a box the build
  never gave it, so those four are always candidates. `rectsOverlap` is strict, so any overlap has an interior point,
  and that point lies in a cell both rects touch. The candidates therefore include every entry that can answer. They
  are visited in **ascending list order**, so the first hit, and its identity (two callers compare blockers by
  identity), is the linear loop's. `liveRectOf` reads only maps and sets, so skipping it for an entry skips no side
  effect. Used by `collidesSolid` and by both of `plannerBlockerAt`'s loops (its solids, and its walkable-tile terrain
  probe). The terrain loop replicates the one throw the linear loop could raise (a non-iterable `noHazards`) by
  coercing the first tile up front.
- **`NEAREST_TILE_INDEX`** (`nearestTileScanIndexed`): the linear pass's answer depends only on the tiles at the
  minimum distance. `best` is the first of them in scan order. `tie` is the first later one at that distance with a
  different `t`. The indexed pass scans the open bridges first (the head of the list, unchanged). It then takes the
  walkable tiles whose centre is within `R` of the probe on both axes, using the scan's own float subtraction, in the
  linear pass's **reverse** order. It accepts the answer only when `bestDist < R²`, so every tile left out is strictly
  farther than the answer. Otherwise `R` doubles, and beyond the level's extent it falls back to the linear pass.
  `beforeTypeFlip` keeps the linear pass.
- **`pitTiles` / `lethalTerrainTiles`** filter once per built world and return a fresh `.slice()` per read, so no two
  callers alias. A built world's tiles are never rewritten in place: a Bulb's write is a `withTileWrites` overlay with
  its own lists.

**Witness:** `levelWorldBroadPhase.test.js` compares ON and OFF probe by probe. It covers every atlas level × 3 role
sets, 250 seeded probes per world: random boxes, boxes on cell boundaries and boxes on entity edges, under random open
activators, moved and removed pushables, broken rocks, pulled ropes, the first-tick flip, open bridges, `noclip` and
`noHazards`. That is 87,000 probes per query, with hits on more than a fifth of them and exact nearest-tile ties on
more than a twentieth. A wider scratch run (`equiv.mjs`, 1,500 probes per world) gave 522,000 per query and **0
mismatches**: 207,789 solid hits, 199,052 planner hits, 59,904 ties.

**Mutants** (predicted, made by copy + restore, restored md5 `cc096e14` both times):

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | nearest-tile candidates sorted ascending | red on ties | red (`0 near 256,32`, …) |
| m2 | `pushableId` dropped from the dynamic families | red on moved pushables | red |
| m3 | the getter returns its cached array without `.slice()` | red on identity | red (`0 pitTiles`, …) |
| m4 | `solidCandidates` unsorted | red (first hit changes) | red |

## D2b — `AXE_DODGE_ASK_PER_PREVIEW` (OFF; ⛔ STOP for the flip) — `12121ba`

The AXE arm (`axeStall`) asks `deadlineReached('axe-dodge')` once per **stall length**. Most stall lengths are priced
by the rest-length screen's arithmetic (`axeHitsPlayer` over shifted samples) with no preview at all. Its work unit is
therefore ~0.3 ms where the rest of the ladder's is a preview. ON asks once per preview: each `certified` walk and the
screen's own rest-length preview. OFF keeps every ask exactly where it was. The added `if (tripped) return null`
checks can only fire after an ON ask, because OFF's only trip returns at once. No committed solve passes
`shouldStop`, so no tape, `--check` or trace can move either way. ON changes only where a **budgeted** solve trips.
That is a behaviour change, hence OFF.

**Witness:** `solverAxeAsk.test.js` solves route step 128 (L61, `axe-l61-reach-l62`) with a counting `shouldStop`:
the **same 284-tick keys**, `axe-dodge` **6,416 OFF → 1,184 ON**, every other site's count equal (`detour` 145,
`sword-dash` 153). Mutant "ON also asks per stall length" (predicted red: ON ≥ OFF) → red, 7,600 vs 6,416.

**The movers, ON** (the brief's rule: the whole bounded set with the flag ON):
- bounded vitest ON (79 files: W0's 68 + `levelWorldBroadPhase`, `solverAxeAsk` + every test naming `axe-dodge`,
  `AXE_DODGE`, `budgetWork`, `shouldStop`, `spinningaxe` or `axeStall`): **3,495 / 3,505**. The 10 reds:
  - `solverAxeAsk` "ships OFF": by construction.
  - `seedlingConstantsCensus` ×8: the census had not been re-written yet when ON ran. They are green at OFF after
    `595bdb6`, so not ON's.
  - `jsRuntimeSolveService` "the BACKSTOP": **not ON's.** It passes 3/3 alone with ON, and alone on the OFF head and
    on the base. It is a timing control: the row needs an L12 solve to outlast a 300 ms backstop, D2 made that solve
    much shorter, and under the parallel run the timer lost. See *JS arc*.
- the JS arc's calibration slow suite (`jsRuntimeSolverCalibration.slow.test.js`, the unit pins), ON: **5 / 5**.
  None of its legs asks `axe-dodge`.
- sweep-4's 16 budget-bound exit legs, node, live inventory, shipped budget (640, retry 2560), ON vs OFF:

| leg | key (region ← door → goal) | OFF | ON |
|---|---|---|---|
| 525 | `level_61__r0c7 <- in_L60_160_80 -> teleporter_224_96` | budget (axe-dodge) | **SOLVED 462 t** (749 units) |
| 529 | `level_61__r0c7 <- in_L63_0_96 -> teleporter_0_160` | budget (axe-dodge) | **refused by name**: EXHAUSTED, spinning axe |
| 530 | `level_61__r0c7 <- in_L63_0_96 -> teleporter_112_0` | budget (axe-dodge) | **refused by name**: EXHAUSTED, spinning axe |
| 597 | `level_71__r0c6 <- in_L72_0_256 -> teleporter_96_0` | budget (axe-dodge) | **refused by name**: EXHAUSTED, spinning axe (2,424 units) |
| 630 | `level_75 <- in_L71_96_0 -> teleporter_64_0` | budget (axe-dodge) | **refused by name**: EXHAUSTED, spinning axe |
| 768 | `level_103 <- in_L104_144_128 -> teleporter_304_144` | budget (axe-dodge) | **refused by name**: EXHAUSTED, spinning axe |
| 748 | `level_98 <- in_L99_112_112 -> stairsup_112_112` | budget (axe-dodge) | **refused by name**: iceturret@104,24 |
| 745 | `level_98 <- in_L93_112_80 -> stairsup_112_112` | budget (kill-chaser, then axe-dodge) | budget (its dashless pass needs 3,158) |
| 765 | `level_103 <- in_L102_0_96 -> teleporter_0_64` | budget (**phase-dodge**) | budget (LADDER2's copy of the same ask, not touched) |
| 754 | `level_101__r4c2 <- in_L100_288_96 -> stairsup_48_96` | refused (EXHAUSTED) | refused (same words), 2,561 → 1,596 units |
| 389 / 393 / 395 | `level_40__r23c29 <- in_L39_144_0 -> pit_5_21/22/23` | SOLVED 982 / 968 / 927 t | unchanged |
| 619 / 620 | `level_72` ← L71 / ← L73 | SOLVED 793 / 788 t (on the retry) | unchanged |
| 782 | `level_107__r0c2 <- in_L108_0_32 -> teleporter_0_48` | SOLVED 387 t (on the retry) | unchanged |

⚠ The six legs that SOLVE in node at OFF (L40 ×3, L72 ×2, L107) are budget-bound in the live sweep. My staging is
the arrival plus the leg's items, keys and granted flags. The page's arrival also carries the game's own state
(clock, RNG, live bodies), which my staging does not. Those six are the CI dispatch's to answer, not mine.

⛔ **STOP: the flip is the user's.** It moves no committed artifact. It moves where budgeted live solves trip, and
the table is the measured list.

## D3 — the census (PASS)

All numbers are base (`dd6ae2e`, a detached worktree) against head (`12121ba`, the code head), interleaved on one
quiet box, each in a fresh process. **Every row compared byte-identical**: survey rows by md5 with `ms` stripped,
legs by plan or refusal md5 plus work units on both attempts.

| solve | answer | base | head | × |
|---|---|---|---|---|
| survey step 177 — L12 corridor (592,16) → teleporter@0,352 | SOLVED 1269 t, row `90657075` | 231.7 s | **40.1 s** | 5.8 |
| survey step 43 — L12 → pit@576,688 → L21 | SOLVED 2364 t, row `a2854532` | 221.4 s | **33.3 s** | 6.6 |
| survey step 142 — L12 Witch → Progressive Sword → teleporter@0,352 | SOLVED 1705 t, row `3bcbc98d` | 261.0 s | **45.0 s** | 5.8 |
| survey step 135 — L12 → teleporter@592,0 → L37 | SOLVED 925 t, row `db283081` | 54.3 s | **5.0 s** | 10.9 |
| survey step 156 — L12 → teleporter@32,848 → L83 (CI: 544 s) | REFUSED, row `bed2555a` | 616.6 s | **105.6 s** | 5.8 |
| B: L12 (16,80) → pit (36,43) | 2570 t, 283/1 units | 55.2 s | **6.9 s** | 8.0 |
| B: L12 (32,704) → Level 012 - Chest (B's last) | 3122 t, 324/1 units | 39.3 s | **5.9 s** | 6.7 |
| the 16 budget-bound legs (above), budget mode | all identical | 2.5–20.2 s | 1.9–12.3 s | 1.04–4.6 |

Per budget-bound leg (seconds, process wall, base → head): L40 389 9.0 → 2.0 · 393 7.6 → 1.9 · 395 8.7 → 1.9 ·
L61 525 4.4 → 2.4 · 529 4.3 → 2.2 · 530 3.5 → 2.1 · L71 597 16.9 → 7.3 · L72 619 20.2 → 12.3 · 620 4.2 → 3.6 ·
L75 630 6.5 → 5.0 · L98 745 5.0 → 3.3 · 748 5.2 → 2.7 · L101 754 5.6 → 2.8 · L103 765 6.7 → 5.2 · 768 8.3 → 5.5 ·
L107 782 2.5 → 2.4.

**Whether L98 → L99 stops being budget-bound: no.** D2 leaves its work units unchanged (643 / 2,563, by construction:
a unit is a `shouldStop` ask, and D2 asks nothing new). With no budget it refuses anyway. With D2b ON, (96,112)
reaches that refusal by name inside the retry, and (112,176) stays budget-bound.

### The survey / sweep rows this moves

- **Survey verdicts: none**, and none can move: D2 is byte-identical and the survey runs no budget (its only bound is
  the 1500 s per-step `--timeout`). Run 38107331670 has no TIMEOUT row, so no row was waiting on wall-clock. Only
  `ms` moves, ~6× on every L12 step: L12 holds the survey's five slowest steps (156, 187, 142, 43, 177).
- **Sweep verdicts at the default: none** by construction. The budget is work units, and D2 changes no ask.
- **With D2b ON**: the 16-leg table above.
- **Live B**: the same plans and the same units, with its L12 solves 6.7–8× faster. B ended on its 900 s walk budget
  inside the L12 chest solve, which takes 39 s base / 5.9 s head here (×3–4 on CI). So B should get past sphere 4.4.
  That is a prediction, not a measurement: B needs the browser battery.

### The CI dispatches for the planner

1. **Survey, the identity check:** `seedling-survey.yml` on `claude/seedling-solvecost-profile-wk9at0`,
   `-f through=end -f route=full`. Expect 167 SOLVED / 53 REFUSED, row for row by (level, goal, boot) against
   38107331670, and much lower `ms` on every L12 step. The cheaper re-run is
   `-f through=end -f route=full -f only=43,57,74,80,135,142,156,177,187 -f base_run=38107331670`.
2. **B:** `seedling-probe.yml` on the branch, `-f battery=standard`. Expect B's legs row-identical to 38108807480
   through "Level 012 - Chest", 0 divergences, then further progress (the walk budget, not a refusal, should end it
   later).
3. **The budget-bound legs at the default:** `seedling-divergence-sweep.yml` on the branch, `-f mode=inv
   -f producer=solver -f keys="<K>"` with `<K>` =
   `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_0_160|level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_22|level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_112_0|level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_23|level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0|level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96|level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144|level_61__r0c7 <- in_L60_160_80 -> exit:out_teleporter_224_96|level_72 <- in_L71_304_96 -> exit:out_teleporter_176_0|level_75 <- in_L71_96_0 -> exit:out_teleporter_64_0|level_72 <- in_L73_32_144 -> exit:out_teleporter_0_256|level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112|level_107__r0c2 <- in_L108_0_32 -> exit:out_teleporter_0_48|level_71__r0c6 <- in_L72_0_256 -> location:Level 071 - Chest|level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_21|level_103 <- in_L102_0_96 -> exit:out_teleporter_0_64|level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112`
   (sweep-4's 17 budget-bound legs: the 16 exits above and the L71 chest). Expect
   the same verdicts as sweep-4 and lower per-leg `ms`.
4. **D2b ON has no dispatch input.** `contact_fidelity` sets only `CONTACT_FIDELITY`. To A/B the axe ask on the page,
   the JS arc would wire a hook (see below). Otherwise the user can rule on the node table.

## The JS arc: pins that move, and what to wire

- **No unit pin moves at the default.** D2 changes no `shouldStop` ask, so every work count is identical (16 legs + 2 B
  legs + the calibration suite, measured).
- **`jsRuntimeSolveService.test.js` "the BACKSTOP"** is a timing control on an L12 solve against a 300 ms backstop.
  It passes alone, 3/3 at head, but it went red once under a 79-file parallel run because the solve is now much
  shorter. Re-pin it to a solve that cannot finish in 300 ms on any box, or to a smaller backstop. I did not edit it
  (JS-arc file).
- **Optional wiring:** a page / worker setter for `solverBot.AXE_DODGE_ASK_PER_PREVIEW` (the KILLLOCK / contact-hook
  pattern), if the planner wants a live A/B before the user rules. No new `SolverRefusal.obstacle.kind`, no staging or
  result field, no contract change.

## Handed to the hammer arc

- `level_98 -> level_99__r2c7` (both arrivals) refuses unbudgeted at the **iceturret@104,24 kill: "no side … is
  reachable"** (`KILL_ARM_POLICY.Turret`, `chooseBodyToRemove`'s family). That refusal, not the budget, is L98 → L99's
  wall. Measured in node with the live inventory; the command is `leg.mjs` (scratch, quoted in *Residue*). No edit
  made.

## Deltas

| | before | after |
|---|---|---|
| identity rows (maze … generated set) | W0 | **identical** (AFTER at `595bdb6`, every row) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 | **identical**, exit 0 |
| reference | ALL 7 + 5 MATCH (with submodules) | read 2 DIFFER at `595bdb6` (the census doc region, before regeneration) → **ALL 7 + 5 MATCH** at `6bc91f9` |
| bounded vitest | 68 files, 3,256 / 3,256 | 79 files (W0's 68 + 11), **3,505 / 3,505** |
| tapeRunner pairs | 605, `ec857f0a` | **605, `ec857f0a`** |
| surface | GREEN 265 | GREEN 265 |
| constants | PASS 5,623 | **PASS 5,675** (+52, all `structural`: the index functions, `TILE_BUCKET`, `SOLID_CELL`, `SOLID_KEY_OFFSET`, the two candidate loops; `nearestTileScan`'s row → `nearestTileScanLinear`) |
| profile / entities | 138 / 535 | 138 / 535 |
| tapes | 274 | 274 (no tape recorded or moved) |

## What the brief got wrong (measured)

1. **"~200 s of its 219 s is `planSwordDash` (dash planning)" is true as attribution and wrong as a diagnosis.** The
   dash search is not the cost; the room queries each preview makes are. 80 % of self time is three static-geometry
   scans, and the fix is in `levelWorld.js`, not in the candidate search. Pruning dash candidates would also have
   moved every trace's `scanned` count, and so the producer `--check`s.
2. **B's wall is not dash planning.** B's big legs are dashless passes: the full pass trips the 85-unit window at its
   first ask (`L12 dashless 2570t w283/1`).
3. **"L98 → L99 … both arrivals are budget-bound (work units)" is true, but it is not a cost item.** Each attempt takes
   1–3 s of wall-clock. Unbudgeted it refuses by name (the iceturret kill). Its units are `axe-dodge` asks.
4. **"Budget-bound legs elsewhere (L40, L61, L71, L72, L75, L101, L103, L107) … the same family":** in node, with the
   live items, keys and flags, L40 ×3, L72 ×2 and L107 **solve** within the budget. L61, L71, L75, L98 and L103 are
   cut at `axe-dodge` (one L103 at `phase-dodge`), and L101 refuses by name. They are two different families.
5. The L12 corridor is survey step **177** at 38107331670 (the brief's 134/175 are pre-step-76 ids).
6. The bootstrap's `READY` does not init five submodules, so the identity block's reference row reads 4 DIFFER at a
   pristine base.

## Residue

- **`phase-dodge`** (LADDER2's rung) asks per stall length exactly as the axe arm did. A sibling flag would likely
  unbind leg 765. Not built: it was not in this slice's measured need.
- **`planSwordDash` re-simulates the accepted prefix for every candidate.** A window at walk-offset `a` replays ticks
  `[0, a)` identically, which is about half of every candidate's preview. Sharing the prefix needs snapshotable
  forecasts (the arrow, chaser, spit and grenade forecasts are closures). It is the next lever and is byte-identical
  in principle; not built.
- After D2, GC is 16 % of step 177's profile. `assertNormalizedLiveOpts` is 4.5 %; a bag cache would not hit, because
  the hottest caller spreads a fresh literal per probe (the levelWorld note).
- `R8_NORMALIZE_LIVE_BATCH.leverNotTaken` (a per-world pre-filter on `liveRectOf`'s arms, "not measured, so not
  claimed") is now superseded by a measured, different lever: a spatial pre-filter. The R8 record stays as history.
- D2b's trip path (`if (tripped) return null` after a `certified` call) has no trip witness. The step-128 row never
  trips.
- The node leg staging (`leg.mjs`) is mine: arrival + items + slots + keys + granted flags, through the calibration
  suite's `stageItems` / `arrivalSolveRequest` / `solveAnytime`. It reproduces the live words for L98 and B's
  `2570t w283/1` exactly, but it is not the page's staging (L40 / L72 / L107).

## Byte-inertia

- D2: the identity block row for row, the six producers, tapeRunner's 605 pairs, five survey rows and 18 budgeted legs
  (plan or refusal md5 plus work units), and 87,000 ON/OFF probes per query in the committed row.
- D2b: OFF is the shipped state, with the ask sequence unchanged. ON moves no committed artifact (no committed solve
  passes `shouldStop`).

## Rows to BANK

- **constants census PASS 5,675** (was 5,623), at `6bc91f9`.
- identity rows unchanged from W0. Reference ALL 7 + 5 MATCH at `6bc91f9`.
- new tests: `levelWorldBroadPhase.test.js` (2), `solverAxeAsk.test.js` (2).
- new switches: `levelWorld.SOLID_GRID` and `levelWorld.NEAREST_TILE_INDEX` (ON); `solverBot.AXE_DODGE_ASK_PER_PREVIEW`
  (OFF).
- the profile tool and the leg runner are scratch (not committed). Their commands: `node --cpu-prof --cpu-prof-dir=…
  scripts/procgen/survey-seedling-route.mjs --step=177 --through=end --route=full`. The leg runner stages as
  `jsRuntimeSolverCalibration.slow.test.js`'s `leg()` does, plus `stageSaveArrays` keys and the granted persistence
  flags.

## CI at the last head

- `6bc91f9` (records head, the last code-bearing head): JavaScript Unit Tests run **38158918422 success** — vitest
  (unfiltered) **19,708 / 19,708**, slow battery **253 / 253** (`node scripts/procgen/ci-vitest-summary.mjs 6bc91f9`).
- `595bdb6` (before the records): run 38155598759 **failure, 2 reds**, both owed records, fixed in `6bc91f9`:
  `seedlingConstantsCensus` "(v) the profile rows" (`--profile-rows` must precede `--write`) and the procgen
  reference `--check` (the census doc region changed the docs index).
- This report's own commit adds one Markdown file; its run is the planner's to read at harvest.

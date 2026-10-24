# Seedling fidelity STEPOFF2: a sub-pixel step-off, true names for the doors it cannot open, and L3's pocket with the Sword

**Slice:** `seedling-fidelity-stepoff2`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`), wave 5.

⚖ **The user** (2026-10-05): *"The first priority is to expand the model to include everything in the game."*

| | |
|---|---|
| Started from | `origin/main` @ **`f90c4eee46`** |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-stepoff2-0ryrky` (no local `seedling-fidelity-stepoff2`: the harness branch IS the slice branch, created from `origin/main`) |
| Commits | D1–D3 **`f761a6d`** · D4 `7a2c2e3` · this report |
| Dev servers | `serve-nocache.py 9340` (this tree), `9341` (the pristine BEFORE worktree `/home/user/Archipelago-CC-wt-stepoff2-base` @ `f90c4ee`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (L66 declines by a new name, not a solve) · D3 PASS · D4 PASS** |

## The one thing to know first

**A latched door is now crossed in 5–14 ticks, not 32–41, and a door the solver cannot step off says why.**

- The solver holds ONE direction until the player box first clears the door's rect, then walks straight back. On L87 that is exactly the game's own minimum from STEP-OFF D1: 10 ticks up, crossing on t13.
- Six solver plans were played on the game (L87, L106, L17 stairs, L12, L65, L3 with the Sword). All six cross on the model's tick with 0 px error.
- The 48 `closed` refusals were three different facts. They now read:
  - `closed`: a walled pocket (6);
  - `hazard-floor`: every way off crosses water without the Conch or lava without the dark suit (25). Six of seven sampled open with that item;
  - `inside-solid`: the boot is inside a lock, tree or rock, which is named (9).
- **No JS-arc pin goes red at this head.** L37's refusal leads with `hazard-floor` and keeps the `closed — the run stands LATCHED …` clause their rows quote; that clause is still true without the dark suit.

## W0 (at `f90c4ee`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9341 bash scripts/procgen/identity-block.sh .` in a **pristine worktree** at `f90c4ee` (`new-worktree.sh --with-wasm stepoff2-base f90c4ee`; it needed `git config extensions.worktreeConfig true` first, and the submodules finished by hand with `git -c protocol.file.allow=always submodule update --init` because the mirrors' `file` transport is refused) | log saved; every row below. ⚠ Its `generated set` row needs a Python with the headless deps, which a worktree lacks, so it printed the install hint. Re-run with the primary venv activated: **`OK`** |
| ⚠ a discarded first run | the same block, started in THIS tree | killed (PIDs 852/1874): I edited `solverBot.js` while it ran, so it was no baseline. Nothing of it is quoted. |
| six `--check`s (+ campaign) | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1` + `r9-campaign 56bb3724`, **all exit 0** |
| reference | the block's last row | ALL 7 + 5 MATCH |
| tapeRunner | inside the bounded vitest | **501/501**; sorted `(fullName, status)` md5 **`77b6e695203c65e9288f0bae8d60315b`** |
| surface / constants / entities / profile | the four `--check`s in the worktree | **GREEN 198** · **PASS 4,968** · **PASS 518** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **222** |
| bounded vitest BEFORE | 26 files: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `fidelityStepOff`, `solverBot`, `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `tapeRunner`, `wasmArrival`, `jsRuntimeWalker`, `jsRuntimeSolver` | **26 files / 1,412 tests, all green** |

## The census first: where L12, L65 and L66 come from

The brief's rows come from the JS arc's 337-leg re-count. **That census is not in this tree** (no report, script or fixture names `out_teleporter_40_688`). Two things were measured instead:
- **Every game landing is latched on its door only in L3, L37, L87 and L102.** Each door's `(to, playerx, playery)` was booted. L24 → L12 lands at (40,704): the box is at y 710–715 and the door rect at 688–704, so the arrival is not latched. L68 → L65 and L70 → L66 are the same: each lands one tile below its door.
- **The rows reproduce from a boot ON the door.** That is the region binding's `entrance_spawn` fallback (the L34 case STEP-OFF named). `census-seedling-stepoff.mjs --on-doors` boots on every door of the map, alongside every game landing and every committed preset arrival (351 resolved). That gives 628 boots and **280 latched (boot, door) rows**, and it contains `12|40|688`, `65|184|64` and `66|72|64`.

## D1 — the minimal step-off (PASS)

**Measured, before.** STEP-OFF's `stepOffCellFor` walks to the nearest ring cell's centre. It takes 26 ticks, and the plan is 32–33 t at the five `crosses` arrivals and up to 41 t at the on-door boots. It tries tile centres only. A door that straddles two tiles (L12 x 40, L65 x 184) has no standable centre beside it, so it refused `closed`.

**The change** (`solverBot.js`, `f761a6d`):
- **`stepOffMinimalFor(run, index, tolerance)`** (exported) previews each direction with the run's own stepper (`run.previewStepper()`). It uses `chooseHeld` toward an aim 16 px past the clearing line on that axis, the same choice the drive makes, for at most `STEP_OFF_MAX_TICKS` = 60.
  - The answer is the first tick the post-move box is off the rect (`rectsOverlap(playerBoxAt(...))`, the latch's own test).
  - A direction is rejected by name if the box never clears (a wall or the map edge), or the stepper falls, crosses, dies, or enters water without `canSwim` or lava without `hasDarkSuit`.
  - Cardinals come first; the diagonals are tried only when no cardinal clears.
- **`stepOffIfLatched`** takes the cheapest candidate whose transit the danger probe clears (`previewWalk` stopped on the same "off" test, then `probeSamples`, the solve's own predicate).
  - It drives exactly the preview's keys for exactly its ticks.
  - A run that ends still on the rect, crosses or falls refuses as a model/preview disagreement.
  - The trace row is `step-off` with `dir` and `ticks`. The record's `stepOff` gains `dir`, and `to` is now the first off position (sub-pixel).
- **`returnOntoDoor`**: the walk back is straight back. It uses `chooseHeld` toward the door's centre, previewed first; it is accepted only when the preview crosses within 60 ticks with no danger. It is then driven, and the crossing must be this door's level and arrival. The trace row is `walk` with `back: true`.
  - Why not the planner: asked from a sub-pixel stance, its A\* start node is the tile under the player, which beside L83's door is cliffside0's. Measured: L83 went from SOLVES 28 t to a no-corridor refusal under the first cut. That is mutant m5.
- **The tile-centre ring (`stepOffCellFor`) stays as the fallback.**

**The game witness.** `fixtures/stepoff-oracle.json` was re-recorded with `SEEDLING_PORT=9340 node scripts/procgen/probe-seedling-stepoff.mjs --record` (p4f): **ALL CHECKS PASSED**, md5 `68cc1c48…` → **`6f490fd108a399c3a1d91f2cc97d1872`**.

| arm | plan | game |
|---|---|---|
| the nine D1 arms (STAND/SHORT/MIN × L87, L106, L17 stairs) | — | **byte-identical** to STEP-OFF's recording |
| SOLVER-L87-teleporter | up 10 t + back = **13 t** (was 32) | **t13 → L88**, 14 obs, worst 0 px. This is D1's MIN arm exactly (`nMin` 10, t13) |
| SOLVER-L106-teleporter | down 9 t, **12 t** (was 33) | **t12 → L101**, worst 0 px |
| SOLVER-L17-stairs | down 9 t, **12 t** (was 33) | **t12 → L16**, worst 0 px (the stairs witness) |

**The edge rule needed no separate re-measure.** Every solver arm stops the instant the box is off the rect, by 0.05 to 0.2 px (`every solver arm's step-off ends with the box OFF the rect by less than one pixel`). The game crossing on the model's tick at a teleporter and at a stairs door is that measurement.

⚠ **SOLVER-L17-stairs' end status counts 1 hit, and the hit is L16's.** The plan crosses at t12 into L16 at (120,56), inside `arrowtrap@112,32`'s lane. Played on with a 12-tick idle tail (a scratch copy of the probe), the game stands the player at the arrival from t12 to t17 and knocks it back from t18. The probe reads `hits` after the tape's latch, so the count is the next room's. All 13 observations match the model to 0 px. It is pinned by name (`POST_CROSSING_HITS`). The model's own tail refuses at t20 by name: L16's `bob@192,80` on-screen question inside the camera shake band.

## D2 — the opened rooms, and the names (PASS)

| boot | door | BEFORE | AFTER | witness |
|---|---|---|---|---|
| L12 (40,688) | `teleporter@40,688` → L24 | `closed` | **12 t** (down 9) | **game: t12 → L24, worst 0 px** |
| L65 (184,64) | `teleporter@184,64` → L68 | `closed` | **12 t** (down 9) | **game: t12 → L68, worst 0 px** |
| L66 (72,64) | `teleporter@72,64` → L70 | `closed` | **`inside-solid`**: the box is inside `bosslock@72,64` | the door is under the boss lock, so no step-off can open it. A new true name, not a solve |
| L12 (168,368), L27, L47, L107 (304,176) | 4 more | `closed` | 12 t each | node |
| L32 `stairs@72,136` | | the ring walk's re-planned corridor failed | 12 t | node |
| L83 `teleporter@32,64` | | 28 t | 12 t (left 9; the straight walk back) | node |

**The new names** (`obstacle.kind`, and the words lead with them):
- **`hazard-floor`** (25 rows). Every way off the rect crosses water without the Conch or lava without the dark suit, and the words name which.
  - Measured with the item: L0 (240,0), L52 (0,112), L5 stairs, L89 (160,304) and L115 (64,144) **solve with the Conch** (13–17 t, no death), and L37's stairs **solves with the dark suit** (13 t).
  - L91 (16,144) does not: with the Conch the waterfall current pins the box to the rect (y 157). It is residue.
  - ⚠ The message keeps STEP-OFF's clause `closed — the run stands LATCHED on <door> in level L and no standable cell next to it can be walked to`. It is still true without the item, and `jsRuntimeArrivalOnDoor` / `wasmArrivalComposite` quote it (see *For the JS arc*).
- **`inside-solid`** (9 rows). The boot's box overlaps a solid and every direction stalls where it started. The words name the solid: `bosslock@72,64` (L66), `magicallock@128,0` (L34), `burnabletree@32,128` (L24 ×2), `breakablerockghost@0,64` (L3), `lock@48,112` (L5), `lock@112,112` (L98), `finaldoor@112,0` (L113 ×2).
- **`closed`** (6 rows bare, 3 with the Sword). A walled pocket. The words now end `Considered: …` with every direction's reason and any refused break.

## D3 — L3's pocket with the Sword (PASS)

**The change.** When neither the minimal step-off nor a ring cell works, `stepOffIfLatched` looks for a breakable rock whose box touches the door's ring:
- `resolveBreakStrategy(run, {id})` decides first, with its own two guards (the primary slot must fire the sword; `rockBreaksUnder`). A refusal there joins `considered` and nothing is pressed.
- The swing must reach from the live position (`swingReaches`): a latched run has nowhere else to stand.
- Then `STRATEGY_EXECUTORS.break` runs with no stance, the record is pushed (`strategy: 'break'`), and the step-off is asked again of the world the break changed. Once per segment.

**Measured.**
- **With the Sword:** break `breakablerock@96,112` from the door (t0–21), step off up 9 t, walk back, **L11 in 34 t, no death**. Trace verbs `[break, step-off, walk]`.
- **Game: SOLVER-L3-pocket-sword t34 → L11, 35 obs, worst 0 px.**
- **Bare:** `closed`, and `considered` holds `break breakablerock@96,112 — the run's primary slot holds NOTHING …`. 0 ticks spent.
- With the Sword the census also opens L0 `teleporter@304,176` (33 t) and L0 `teleporter@80,96` (32 t).

## Mutants (predicted first; copy → edit → run → copy back, `solverBot.js` md5 `42b053a3…` restored each time)

| mutant | predicted | measured (`fidelityStepOff`, 42 rows) |
|---|---|---|
| m3 `stepOffMinimalFor` offers no candidate | 18: 9 crosses rows, L37's name, the nMin row, the sub-pixel row, the Sword row, 6 SOLVER arms | **18** ⚠ The first measurement read 15. The game-vs-model row iterated STEP-OFF's three doors only, so STEPOFF2's three witnesses were never compared: a hole. It was fixed (`it.each` over all six), and then 18 |
| m4 the D3 break never tried | 4 (+1 once the L3 witness row joined) | **5** |
| m5 walk back via `walkTo` | the L83 row | **1** (L83) |

## D4 — the census before → after (PASS)

`node scripts/procgen/census-seedling-stepoff.mjs --on-doors [--sword]` is a new instrument: node only, no box, exit 0. BEFORE was run in the pristine worktree with the file copied in and then removed.

| | BEFORE `f90c4ee` | AFTER | AFTER + Sword |
|---|---|---|---|
| latched (boot, door) rows | 280 | 280 | 280 |
| SOLVES | 225 | **232** | **235** |
| `closed` | 48 | **6** | **3** |
| `hazard-floor` / `inside-solid` | — | 25 / 9 | 25 / 9 |
| other named refusals | 7 | 8 | 8 |
| solved ticks, mean / max | 32.6 / 41 | **12.3 / 14** | 12.5 / 34 (L3 with the break) |

- **Every BEFORE solve still solves, and each is shorter.** The (before → after) tick pairs over the 225 are (33→12)×133, (32→13)×61, (32→12)×25, and six singletons from 24–41 to 11–14.
- The step-off axes used: down 95, up 63, left 38, right 36. No diagonal was ever needed.
- **The "other" row that moved:** L74 `teleporter@288,144` went from `closed` to *"the walk back onto the door did not cross within 60 ticks — the preview said it would"*. It is residue 1.
- L38 → L37 now crosses and is then refused by L37's build (a tag-cleared fallrock), as any arrival there is.

**The JS arc's composites probe D** (the latched legs; measured through `solveSegment` from the same boots):

| leg | BEFORE | AFTER |
|---|---|---|
| house door L86 `teleporter@48,64` → L0 | 32 t (cell (56,56), 26 t) | **13 t** (up 10) |
| L2 `stairs@48,16` → L0 | 33 t | **12 t** (down 9) |
| L3 `teleporter@64,0` → L2 | 33 t | **12 t** (down 9) |
| S5 L87 → L88 | 32 t | **13 t** (up 10) |
| S5 L102 → L107 | 33 t | **12 t** (left 9) |

⚠ None of these lengths is pinned in this tree: the probe's D legs assert `cross` with producer `solver` and verbs `step-off, walk`. Those still hold, and the trace verbs are unchanged.

| Row | W0 (`f90c4ee`) | head | movers |
|---|---|---|---|
| identity log | md5 `5bf10815…` (with the `generated set` row from the venv re-run, `OK`) | **`5bf108151ad7a075428d0ff20f15240e`**, byte-identical (`cmp` clean) | **none** |
| producer `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1` `56bb3724`, all exit 0 | **identical**, all exit 0 | none: no producer's segment aims at a door its arrival is latched on |
| tapeRunner | 501, md5 `77b6e695…` | **501, md5 `77b6e695…`** | none |
| roster | 222 | **222** | none: the witnesses live in the oracle, not the roster |
| surface | GREEN 198 | **GREEN 198** (`--write` → `--check`) | 19 site-count drifts on existing rows (`run:state`, `run:world`, `world:solids`, `world:teleporters`, `state:fall`, `state:x/y`, `rectsOverlap`, `TILE_SIZE`, `HITBOX`, `PhysicsV2Error`, `playerBoxAt`, `distanceRectPoint`, `SLASH_REACH` …). No new row, nothing unclassified |
| constants / entities / profile | 4,968 / 518 / 138 | **4,968 / 518 / 138** | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration | instruments **350 → 351** (`census-seedling-stepoff.mjs`, `check-procgen-help --in-place --only=` ALL PASS; the probe re-checked too) |
| bounded vitest | 26 files / 1,412 | **26 files / 1,423, all green** | `fidelityStepOff` 31 → 42 |
| `boxLock` | green | **green** | no new box-taking instrument (the census is node-only; the probe was already `guarded`) |

## For the JS arc: pins, fields and words

**Pins red at my head: none.** Run in the bounded suite at the head and green: `jsRuntimeArrivalOnDoor` 20, `wasmArrivalComposite` 14, `jsRuntimeWalker` 11, `jsRuntimeSolver` 14, `wasmArrival` 29, `jsRuntimeDeclarations` 6, `seedlingCanCross` 17.

⚠ The first cut did redden two of theirs, both on L37 now reading `hazard-floor`:
- `jsRuntimeArrivalOnDoor` *"S5 — a closed pocket fails by NAME … 37|576|144, solver ON"*;
- `wasmArrivalComposite` *"a CLOSED pocket is the SOLVER's named refusal"*.

Rather than leave their rows red, the words keep the `closed — …` clause (still true). **What to wire:** re-pin those rows on `obstacle.kind` (`'hazard-floor'`, `floors: ['lava']`) when you next touch them. L3 bare stays `closed`.

**Optional new fields** (nothing removed, no signature moved):
- **`records[].stepOff`** gains `dir` (`'up'|'down'|'left'|'right'` or a diagonal, absent on the ring-cell fallback). `to` is the first OFF position (sub-pixel), not a cell centre.
- **The trace:**
  - `step-off` rows carry `dir`, `ticks`, `to`;
  - the walk back is a `walk` row with `back: true`, `path: [centre]`;
  - a D3 `break` row carries `for: 'step-off'`.
- **A latched solve can hold a `break` record before its `reach-exit` record** (L3 with the Sword). `records[0]` is not always the crossing.
- **`SolverRefusal.obstacle.kind`** can be `hazard-floor` (`floors`), `inside-solid` (`solids`) or `closed`, all with `considered`.

**Stale docblocks** (their catchers still red under the mutations, only the plan lengths moved): `wasmArrivalComposite.test.js`'s and `jsRuntimeArrivalOnDoor.test.js`'s comments quoting 32–33 t / "steps off to the nearest standable cell".

**CANCROSS's `solverStamp` moves** (`solverBot.js` changed), so derived rules read STALE until re-derived. That is the intended behaviour. With this head, L3's pocket → `can` with `inventory: [sword]`, and L37's stairs → `can` with the dark suit.

## Deltas

- `frontend/modules/seedlingDemo/solverBot.js`: `stepOffMinimalFor` + `STEP_OFF_MAX_TICKS` (exported), `stepOffIfLatched` (minimal first, D3 break, the three names), `returnOntoDoor`, and the `reach-exit` call.
- `fidelityStepOff.js`: `STEPOFF2_DOORS`, `stepOffStagingAt(boot, items)`, and `stepOffSolverArms` over both sets.
- `fidelityStepOff.test.js`: 31 → 42 rows; the mutation list (m3–m5); `POST_CROSSING_HITS`.
- `fixtures/stepoff-oracle.json` re-recorded (15 arms).
- `probe-seedling-stepoff.mjs` (docblock only).
- New: `scripts/procgen/census-seedling-stepoff.mjs`.
- `seedling-solver-surface.json` (re-written).
- Docs: `seedling-bot.md` (the arrival-latch paragraph) and `seedling-bot-log.md` (the STEPOFF2 entry, four trap candidates). The regenerated reference: `README.md`, `architecture.md`, `generated/docsIndex.js`, `generated/instruments.js`.

## What the brief got wrong (measured)

1. **"L12 `out_teleporter_40_688`, L65 and L66 refuse `closed` where a sub-pixel step-off would open them."** Two of three are right.
   - L66's door is under `bosslock@72,64`. Its boot is inside the lock's solid and no direction moves the box at all, so it declines by the new name `inside-solid`.
   - None of the three is a game landing. Each lands one tile below its door, unlatched. The rows exist only for a boot ON the door (the binding's `entrance_spawn` fallback).
2. **"The JS arc measured 31 solved by step-off, 13 closed by name."** That census is not in this tree, so it could not be re-run row by row. Its population differs from this slice's 280 rows: here 48 `closed` BEFORE, and the brief's 13 is a subset I cannot identify.
3. **"The JS arc's composites probe D pins latched-plan lengths (32–33 t)."** In this tree the probe pins `cross` / producer / verbs, not lengths. The five D legs measured 32–33 → 12–13 t (table above).
4. **"the rock can be broken to make a step-off cell."** No cell is needed to swing. The swing reaches the rock from the door itself (as `r9-solve-3` does), and the rock's tile then becomes the step-off's way up.
5. **"Re-measure the edge rule … if any case is ambiguous."** None was. The six solver arms stop 0.05–0.2 px off the rect, and the game crosses each on the model's tick, a teleporter and a stairs door among them.

## Residue

1. **L74 `teleporter@288,144`** (an on-door boot): the up step-off works, but the straight walk back does not cross within 60 ticks although its preview did. `fallrock@288,144` sits on the door (a frontier name in the old refusal). The preview stepper and the run disagree about it, so this is a model/preview gap to read next.
2. **L91 `teleporter@16,144`**: `hazard-floor` (water) without the Conch, and with it the waterfall current pins the box on the rect. The name is necessary, not sufficient, there.
3. **The water/lava rejection is conservative.** A step-off of a few ticks over water would not drown (11 cumulative ticks), but `drownTimer` is never reset, so the slice did not spend it.
4. **L16's arrival hit** (SOLVER-L17-stairs, post-crossing; `arrowtrap@112,32`). The model's tail refuses at t20 by name (camera shake band); the game knocks the player back at t18.
5. **89 `teleporter@208,0`** (water) still refuses through the ring fallback's A\* start-tile error, unchanged from BEFORE: the fallback runs after the minimal candidates all read water.

## Byte-inertia

- **No committed tape, expectation or declaration moved.** tapeRunner's 501 `(name, status)` pairs are md5-identical, the roster is still 222, and `campaign-frontier.json` was not touched.
- **No AS3, wasm, gitlink or rules edit.** No JS-arc file was edited (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the worker, and their tests).
- **Stayed out of** SLOTS' region (`inventorySlotsFor`, useItem/equips, the staging items block, `execBurn`/`runFire`). D3 calls `resolveBreakStrategy` and `execBreak` unchanged. Also out of FRONTIER2's (`census-seedling-campaign.mjs`, `surveyRoute.js`, `campaign-frontier.json`, `campaignChain`).
- **The oracle re-record is a fixture, not a roster tape.** Its nine D1 arms came back byte-identical, and its SOLVER arms are the solver's plans (the D2/D3 witnesses the brief asks for).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used.
- **Tree dirt:**
  - `git config extensions.worktreeConfig true` (required by `new-worktree.sh`).
  - The BEFORE worktree `/home/user/Archipelago-CC-wt-stepoff2-base` (branch `stepoff2-base`) is left in place, its server on 9341.
  - A scratch probe copy was placed at `scripts/procgen/zz-tmp-probe-tail.mjs` for the L16 tail and removed; nothing staged.
- **Box:** the probe took the box once (record) and once more (the tail), with no other browser work alongside.

## The rows the coordinator must BANK

- identity log md5: BEFORE **`5bf108151ad7a075428d0ff20f15240e`** (pristine `f90c4ee` worktree; `generated set` re-run with the venv: `OK`); AFTER **`5bf108151ad7a075428d0ff20f15240e`** (head `7a2c2e3`, the primary venv active): **byte-identical** (`cmp` clean) to BEFORE with its `generated set` row taken from the venv re-run
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` + campaign `56bb3724fd0ed3dda184e6e7d6d5d27c`, all exit 0 (BEFORE; AFTER **identical**)
- counts: tapeRunner **501** (md5 `77b6e695203c65e9288f0bae8d60315b`, unmoved), roster **222**, surface **GREEN 198**, constants **4,968**, entities 518, profile 138, instruments **351**
- `stepoff-oracle.json` md5 **`6f490fd108a399c3a1d91f2cc97d1872`** (15 arms; the nine D1 arms byte-identical to `68cc1c48…`'s)
- the census: 280 latched rows, BEFORE 225 / 48 closed → AFTER 232 / 6 closed / 25 hazard-floor / 9 inside-solid; with the Sword 235 / 3 closed
- **for the JS arc:** D1–D3 = **`f761a6d`** (`stepOffMinimalFor` exported; `records[].stepOff.dir`; `obstacle.kind` `hazard-floor`/`inside-solid`)

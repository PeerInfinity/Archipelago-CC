# SEEDLING FIDELITY — FRONTIER3: the frontier's solids with no strategy row, and the planner's pixel-mask collision

Session `seedling-fidelity-frontier3` (Opus, cloud), planner `seedling-fidelity-planning-3`, wave 6 (model coverage).

| | |
|---|---|
| start SHA | `88a7e4daa4291545b6b9a112591affb94cdfe77f` (origin/main at checkout; 3 CI-only commits past the brief's `9527592ac4`, which is an ancestor) |
| head | the commit that adds this report (child of `2b38b75d04`) |
| harness branch | `claude/frontier3-solids-pixelmask-9sl1cm` (the harness branch IS the slice branch) |
| commits | D2 `93d13ab` · D3 `b2c4072` · D4 `2b38b75` · this report |
| dev servers | `serve-nocache.py 9390` (this tree), `9391` (a scratch worktree, `/home/user/f3wt`, used to develop and to record the witnesses while the identity block ran here) |
| verdicts | **D1 PASS · D2 PASS (the fine-lattice half behind a flag, OFF: STOP for a licence) · D3 PASS (crusher: named STOP) · D4 PASS** |

## The one thing to know first

**Most of the list was not a missing verb. The frontier names the NEAREST entity on the edge of the reachable
component, so the sweep's "Σ unserved by obstacle" ranks whatever scenery stood closest to the cut.**

- The L62 planttorch rows (Σ13), L95 bonetorch and L87 cliffside rows were the 16 px A\* lattice having no node
  where the player fits. L62's corridor is two tiles wide and `planttorch@120,152` sits half a tile off the grid,
  so both node centres (x 120, x 136) hit it and the 8 px gaps beside it (x 116, x 140) are clear.
- `pixelmask:building6` was not "a mask read as its bounding box". The planner has used the real mask since R2.
  The reach-exit walked at its trigger's CENTRE, (120,72), which is inside the mask; the player stands in a
  13 px niche below it.
- The fix for the door (`exitAimFor`) is on and byte-inert. The lattice fix (`FINE_LATTICE`) is behind
  `FINE_LATTICE_ROSTER_WIDE = false`, because turning it on moves **one row of the identity block**: the enemy
  census's generated `lavatrap@corridor` goes REFUSED → SOLVED (153 t). That flip needs the user's licence.

## W0 (at `88a7e4d`, primary tree, before any edit; `SEEDLING_PORT=9390`)

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9390 bash scripts/procgen/identity-block.sh .` (venv active, clean tree) | log md5 **`5bf108151ad7a075428d0ff20f15240e`** (= FRONTIER2's bank) |
| six `--check`s | the block's producer loop | `405d9c4b…` · `8e7a43be…` · `33d20889…` · `35456fbc…` · `6cd35fe1…` · `56bb3724…`, **all exit 0** |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / profile / entities | the four `--check`s | **GREEN 198** (md5 `e80fdf309b196fd6d04a8a5eba4ecf35`) · **PASS 4,977** · **PASS 138** (both JSONs) · **PASS 518** |
| roster | `fixtures/tapes/index.json` | **227** |
| bounded vitest BEFORE | 41 files (below) | **41 files / 2,122 tests, all green** |
| tapeRunner | sorted `(fullName, status)` pairs, `name\tstatus\n` | **511/511**, md5 `0ce826422e03bda48b1733c7bd18a08f` |

The bounded set: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`,
`ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `decisionTrace`, `entityBlocks`,
`solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`,
`lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, and every test that `grep -a` finds reading
what I touched (`OBSTACLE_STRATEGIES`, the refusal sentences, `surveyFamily`, the tags): `seedlingPlaythroughOverlay`,
`breakVerb`, `combat`, `enemyDamage`, `fidelityBurn`, `fidelityL14`, `fidelityWatcher`, `procgenWeigh`,
`r5Acceptance`, `r5Totem`, `solverBot`, `surveyFamily`; plus the solve paths `tapeRunner`, `seedlingDivergenceSweep`,
`fidelityStepOff`, `fidelitySlots`, `jsRuntimeSolver`, `wasmArrival`, `jsRuntimeWalker`, `surveyRoute`, `botDriverV2`.
AFTER adds `fidelityFrontier3`. `activators`, `finalDoorL113` and `seedlingSemantics` (they name the tags) were run
at head too: 103/103.

**Instruments used** (scratch, not committed):
- `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` → 799 legs.
- `probe-seedling-divergence-sweep.mjs --ids=0 --dump=…` on 9390 → the delivered set and name map.
- A node bare runner. It is `seedling-divergence-bare.mjs --one`'s request path, unchanged, but it prints the full
  refusal and `obstacle`; the committed script cuts the text at 400 characters.

The full 799-leg bare pass was stopped at 372 rows: the L40 legs each hit the 120 s timeout and starved the identity
block. The census below is the **257 legs of the 15 rooms the brief lists**.

## D1 — every class, classified (PASS)

Measured on the node bare census (no inventory) and the route survey (the `r8-solve-11` staging), with the room
maps rendered from `plannerObstacleAt` at 2–4 px and the AS3 read for each class.

| class | rooms (legs) | verdict | evidence |
|---|---|---|---|
| `solid:planttorch` | L62 (9), L112 (1) | **(a) planner over-claim** on L62: the 16 px lattice has no node in the pit-maze corridor. On L112 it is misattributed (see `rocklock`). `PlantTorch` itself is scenery: `type = "Solid"`, a 16×16 box, no `hit`. | L62 map: corridor x 112–144, torch at x 120–136. 8 px lattice nodes at x 116 and x 140 are clear. With the 8 px retry, all 8 L62 legs get past it. |
| `pixelmask:building6` | L62 → L64 (1) | **(a) planner over-claim: the AIM**. The trigger centre (120,72) is inside the mask; the clear player positions in the trigger are x 114–126, y 74–81. | Door census over the whole map: the **only** trigger whose centre box hits a mask. The other nine blocked centres are solids with verbs or gates. |
| `pixelmask:cliffside1` / `cliffside0` | L87 (8 + 1), L12 (2) | **(a)** on L87: the top-left pocket leaves by a 5 px column (x 50–54) beside `cliffside1@48,32`; no 16 px node centre is clear there. **Misattributed** on L12: the boot (40,872) is inside `magicallock@32,864` (ARRIVAL's region). | L87 map at 2 px; L12 `A* start tile (2,54) … solid magicallock`. |
| `solid:bonetorch` | L95 (8) | **(a)** the lattice gap (8 px retry: 8/8 solve, 566–598 t). | census flag ON. |
| `solid:crusher` | L42 (1) | **(b) a verb, documented and not a solver executor**: `bait`. | `r5Totem.L42_PART4`: two crushers plug a 2-tile corridor. It is a six-bait PURSUIT (each park re-arms a lane across the escape); only crusher A's W/S/E chain was ever driven. **STOP** (named work order). |
| `solid:rocklock` | L112 (1 + 1 survey) | **(b/c) an ENCOUNTER gate**, not an item: `rocklock@112,16 {tset 0, tag 1}` has no presser in L112. `FinalBoss`'s `dead` arm opens it (`Button.activateAll(null, 0, true)` and `setPersistence(tag+1)`). | `FinalBoss.as` dead arm; `levelRun`'s transcription; `world.finalBosses` holds `finalboss@64,96`. L26's rocklock is a kill-lock (`tset -1`). |
| `solid:finaldoor` | L113 (10 legs, 1 survey step) | **(c) an ITEM gate**: all 16 Seal parts (the last slot filled) **and** the Watcher's L114 tag 0 cleared, on approach. The model already steps it (`r6-final-door`). Of the 10 legs, 8 boot INSIDE the door: the L115-return arrivals (112,16) and (128,16), where the door is already removed in the game (ARRIVAL). | `FinalDoor.update`; `levelRun.stepFinalDoorsNow`. |
| `solid:dungeonspire`, `solid:ruinedpillar` | L113 (4 + 4), L93 (survey) | **Misattributed scenery.** In L113 the boot is inside `finaldoor` (above). In L93 the corridor is cut by the **spear bridge tile (7,13)** (`t = 29`) and by lethal floor. | L93 tile dump; `bridgeTiles [[7,13]]`. |
| `solid:tree` | L0 (1), L89 (3) | **Misattributed**: the start or goal tile is WATER without the Conch, so the A\* refuses the end point (`lethal-terrain Water (t=1)`). `Tree.hit` is empty, so a tree has no verb. The walker crossed 2 of them: it wades out inside the 11-tick drown budget. Not this region (ARRIVAL/TERRAIN). | `A* start tile (15,1) … lethal-terrain Water`. |
| `solid:bonetorch2` | L63 (2) | **A true wall, misattributed**: L63's "#2" door is across a pit band from the arrival pocket. | L63 map. |
| `pixelmask:cliffside2` | L112 (1) | Misattributed: the boot is inside `rocklock`. | `A* start tile (7,1) … solid rocklock`. |
| `pixelmask:building8` | L66 (1) | Misattributed: the real obstacle is `bosslock@72,64` (keylock, needs the boss key). It stands in building8's doorway, and the frontier flood meets the mask first. | Door census: L66 tp1's centre is a `bosslock`. Residue. |
| `solid:cover` | L38 (2 + 2 named buttonroom) | **(b) a responder** (`hold`). Its group's `button@80,192` is weighed only by the fire-family block → effectively a **Fire gate** (R2_BLOCKED's L38 row). | `hold`'s own refusal names it after the row. |
| `solid:grasslock` | L28 (1) | **(b) a responder** (`GrassLock extends Lock`, bare `super`) → `hold`. Its button republishes and no block reaches it, so it seals by name. | leg 291 after the row. |
| `solid:rock` + `pixelmask:opentree` | L65 (survey ×2) | **(b) misattributed**: plain `Rock` is scenery. The pocket's door is `pushableblockspear@176,128`, moved by ANY weapon press along the facing (`Player.as:1121`'s relative arm, which returns before `moveTypes`). No solver verb press-pushes a fire-family block (`resolveShoveStrategy` refuses it by name). | L65 map; `pushables.js`'s relative-arm note. Residue. |

## D2 — the planner asks where the mask lets the player stand (PASS; the lattice half is a STOP for a licence)

**The change** (`solverBot.js`, `93d13ab`):
- **`exitAimFor(world, index, opts)`** (exported). It returns the trigger centre unless the centre box is blocked by
  a **pixelmask**. Then it returns the nearest integer point whose box overlaps the trigger and is clear for the
  planner (ties: lower y, then lower x).
  - Only the reach-exit walk uses it. The step-off's walk back (`returnOntoDoor`) keeps the centre STEPOFF2 witnessed.
  - A centre blocked by a solid is left alone, so the frontier still names the lock, tree or door.
  - Before this, such a centre always refused at `planTilePath`, so no solve can move. L62: (120,72) → **(120,74)**.
- **`FINE_LATTICE` = 8.** When `identifyAndSelect` refuses (no frontier verb applies), `walkTo` asks the same plan
  once more on the 8 px lattice, under the grant. Otherwise the refusal stands, unchanged.
  - The AVOID rung re-plans on the lattice the walk used (`climbLadder`'s new `lattice`, default the old).
  - The walk row carries `lattice: 8` (only then).
  - `solveSegment`'s result gains the optional `fineLatticeWalks` (only when non-empty).
- **The grant:** `solveSegment`'s optional `fineLattice`, defaulted to `FINE_LATTICE_ROSTER_WIDE = false`. The same
  shape as `economies` / `ECONOMIES_ROSTER_WIDE`.

**Why the flag.** With the retry always on (the first measurement), the identity block moved on exactly one row:

```
ENEMY census default   68466067906ea0bbd27f3cd6eadba5e7  ->  d8c2f110f2cff63666d0efe542a71e9a
| `lavatrap` | LavaTrap | … | **REFUSED** | - |   ->   | **SOLVED** | 153 |      (CHAMBER arm 21/3/2 -> 22/2/2)
```

That is a generated room's `lavatrap@corridor` chamber row, solved through a gap the 16 px lattice missed. The six
`--check`s, the tapes and the expectations did not move. Per the brief, it is OFF until licensed. **The mover list,
flag ON: that one row.**

**Witnesses** (`plan-seedling-frontier3-witness.mjs`, the survey's `r8-solve-11` staging re-pointed at the arrival;
recorded with `check-seedling-bot-differential --record --only=…` on 9391, p4f headless; then the default mode
**ALL CHECKS PASSED**; JS model vs game: **0 level mismatches, worst 0 px**):

| tape | plan | game |
|---|---|---|
| `frontier3-l62-door-niche` | L62 from the L64 arrival → `teleporter@112,64`, **12 t**, aim (120,74). This is the J2 walker's 12 t. No fine-lattice walk. | 13 obs; the last L62 observation (120, 81.75) overlaps the trigger, clear of the mask |
| `frontier3-l87-pocket` | L87 from the L92 arrival → `teleporter@0,144` (L89), with the grant: one fine-lattice walk (6 waypoints) after the frontier refused | 188 obs; 12 observations climb the column at x 52.91 |

**Mutants** (predicted, then made by copy + restore in the worktree; md5 restored `18b8f8efaa31fed94b2abb47f47765fe`):

| mutant | predicted | measured |
|---|---|---|
| M1 `exitAimFor` always returns the centre | 2 red (the aim row; the L62 12 t solve) | **2 red** |
| M2 the retry never fires, even granted | 1 red (L87 with the grant) | **1 red** |
| M5 `FINE_LATTICE_ROSTER_WIDE = true` | 1 red (the OFF control) + the ENEMY census → `d8c2f110…` | **1 red**; census measured above |

## D3 — rows and named gates (PASS; the crusher is a named STOP)

**The change** (`b2c4072`):
- **`OBSTACLE_STRATEGIES` gains three rows.** No existing row was reordered or reworded.
  - `'solid:grasslock': 'hold'` and `'solid:cover': 'hold'`: both are `Activators` responders.
  - `'solid:crusher': 'bait'`: selected and **not registered**, so the refusal is the computed work order. The
    catalog pin's pending list is now `['bait', 'wand']`.
- **`obstacleGateFor(run, obstacle)`** (exported) is asked only for an obstacle with no row, so it changes the words
  of a refusal, never a solve:
  - `finaldoor` → *"ITEM-GATE (finaldoor@112,0): …"*;
  - `rocklock` with a `FinalBoss` in the room and no presser → *"ENCOUNTER-GATE (rocklock@112,16): … finalboss@64,96's
    death …"*. Elsewhere (L26's kill-lock) the gate names `totalEnemies() == 0` and the activator roster that omits
    RockLock.
  - The refusal's `considered` gains an `item-gate` / `encounter-gate` row. `surveyFamily` files both as `ITEM-GATE —` /
    `ENCOUNTER-GATE —`. Its witnesses are survey steps 235 and 234.
- Scenery with no verb in the game (`planttorch`, `bonetorch(2)`, `dungeonspire`, `ruinedpillar`, `tree`, `rock`)
  stays rowless.
- **Not done, by measurement:** a `rocklock → hold` row. RockLock is outside the activator roster
  (`activators.js:69`), so `hold` cannot find its opener and the kill-lock refinement cannot see its `tset`.

**The cover row's reach**, measured on every leg of the four cover rooms (L38, L39, L41, L110; 14 legs) before
and after:
- 6 solved before, 6 solved after, ticks identical.
- L38's four refusals become `hold`'s named one. Two of them (338, 340) were `proximity-hazard:buttonroom` rows: the
  registered cover now sorts ahead of the rowless buttonroom (see "for PROXIMITY").

**Mutants:** M3 `obstacleGateFor` → null: predicted 3 red (L112, L113, the unit row), measured **3**. M4 the grasslock
row removed: predicted 1, measured **1**.

**Witnesses:** none. Every D3 change is a refusal; a refusal is not game evidence.

## D4 — census (PASS)

**The sweep legs, node bare, 257 legs of the 15 listed rooms** (scratch `sub-before` / `sub-after-off` / `sub-after`):

| | solved | refused | unresolved* |
|---|---|---|---|
| BEFORE (`88a7e4d`) | 156 | 94 | 7 |
| AFTER, default (flag off) | **157** (+527 L62 → L64) | 93 | 7 |
| AFTER, flag ON | **173** (+527, L87 ×8, L95 ×8) | 77 | 7 |

\* the 7 L12 location legs whose name is not in the name map ("Level 012 - Witch", …), the same both sides.

Either way: **no leg solved before and not after, and no solved leg's ticks or verbs moved.**

By class (legs; before → default → flag ON):

| class before | n | default | flag ON |
|---|---|---|---|
| `pixelmask:building6` VERB-MISSING | 1 | **SOLVED** | SOLVED |
| `solid:planttorch` VERB-MISSING | 9 | same | 8 → LADDER (`darktrap@112,208` / `turret@232,…`), 1 same (L112, inside the rocklock) |
| `pixelmask:cliffside1` | 8 | same | 7 SOLVED, 1 same (L12 ARRIVAL) |
| `pixelmask:cliffside0` | 2 | same | 1 SOLVED, 1 same (L12 ARRIVAL) |
| `solid:bonetorch` | 8 | same | **8 SOLVED** |
| `solid:finaldoor` | 10 | **ITEM-GATE** | ITEM-GATE |
| `solid:rocklock` | 1 | **ENCOUNTER-GATE** | same |
| `solid:crusher` | 1 | **`bait` SELECTED-NOT-REGISTERED** | same |
| `solid:cover` | 2 | `hold`'s named refusal | same |
| `solid:grasslock` | 1 | `hold`'s named seal | same |
| `solid:tree` ×4, `ruinedpillar` ×4, `dungeonspire` ×4, `bonetorch2` ×2, `cliffside2`, `building8` | 16 | same (misattributed; D1) | same |

**The route survey** (`--through=end --only=108,129,131,162,164,214,234,235`, `--timeout=1500`):

| step | room | BEFORE | AFTER (default) | AFTER (flag ON) |
|---|---|---|---|---|
| 108 | L42 | VERB-MISSING `crusher` | **VERB-SELECTED-NOT-REGISTERED `bait`** | same |
| 129 | L62 | VERB-MISSING `planttorch` (goal tile in `building6`) | VERB-MISSING `planttorch`, the aim now (120,74) and the cut the lattice gap | **LADDER** (`darktrap@112,208`) |
| 131 | L62 | VERB-MISSING `planttorch` | same | **LADDER** (`darktrap@112,208`) |
| 162, 164 | L65 | VERB-MISSING `rock` / `opentree` | same | same |
| 214 | L93 | VERB-MISSING `dungeonspire` | same | same |
| 234 | L112 | VERB-MISSING `rocklock` | **ENCOUNTER-GATE** | same |
| 235 | L113 | VERB-MISSING `finaldoor` | **ITEM-GATE** | same |

The survey's other 228 steps were not re-run: no change reaches them except through these classes.

## Records (D4, `2b38b75`)

- **`seedling-bot-log.md`** — the FRONTIER3 entry, with three trap candidates:
  1. the frontier names the NEAREST entity, not the cut;
  2. a per-pixel collider asked at tile centres is a tile collider;
  3. a door can be standable in a niche its centre is not.
- **`seedling-bot.md`** — a paragraph on where the planner asks the mask.
- **The reference regenerated:** instruments 357 files with the new script, the docs index, the architecture region.
  `generate-procgen-reference --check` MATCH; `check-procgen-docs` ALL PASS.
- **Roster** 227 → **229**, pinned with names in `tapeEnvelope`, `observationTolerance` and `dialogueAutoAdvance`.
  `tapeIndexManifest` is green (the index is regenerated by `generate-tape-index.mjs`). `r8Acceptance` exposure is
  unchanged (measured: neither witness ends in a bridged-enemy room).
- **Surface:** `--write`, classified, `--check` **GREEN 199**.
  - `+ world:finalBosses` (seedling/constant, read by `obstacleGateFor`);
  - site-count drift on `run:level/state/world`, `world:pressers/teleporters`, `import rectsOverlap/TILE_SIZE/playerBoxAt`.
- **Constants** PASS 4,977, unchanged. Profile 138 and entities 518 are not touched.
- **No new box-taking instrument.** The witness script is node-only, and the recording went through the existing
  `check-seedling-bot-differential`.

## The JS arc's pins that move, and what it must wire

**No JS-arc pin moves.** In the bounded set at head: `jsRuntimeSolver`, `wasmArrival`, `jsRuntimeWalker`,
`seedlingDivergenceSweep` and `jsRuntimeDeclarations` are all green. `solveSegment` / `twoPassSolve` /
`PendingDeclaration` / `createRunForStaging` keep their contracts. There is no new `SolverRefusal.obstacle.kind`.

To wire:
1. **`fineLattice`** is an optional `solveSegment` input. When the user licenses the ENEMY-census move, either flip
   `FINE_LATTICE_ROSTER_WIDE`, or pass `fineLattice: true` from the worker's solve request. That is +16 solved legs in
   this census.
2. **`fineLatticeWalks`** is an optional result field, `{tick, what, aim, waypoints, refused}` per walk, present only
   when a fine-lattice walk was planned.
3. **The new refusal sentences** — `ITEM-GATE (id): …`, `ENCOUNTER-GATE (id): …`, `Strategy 'bait' is SELECTED but
   not registered` — and the `considered` rows `item-gate` / `encounter-gate`. The divergence sweep's classifier
   may want them as families.

**For PROXIMITY** (shared table): the `solid:cover` row sorts a registered cover ahead of the rowless
`proximity-hazard:buttonroom` on L38 legs 338/340. Their text moves from *"Obstacle: proximity-hazard:buttonroom … No
strategy row"* to `hold`'s *"no REACHABLE stance inside button@80,192"*. If PROXIMITY registers `buttonroom`, the two
compete by distance as usual. Whoever merges later re-measures those two legs.

## Deltas

| row | before | after |
|---|---|---|
| identity block | `5bf108151ad7a075428d0ff20f15240e` | **`5bf108151ad7a075428d0ff20f15240e`** (flag off, at the D2+D3 code), byte-identical. Flag ON: `ea10a811…` (the ENEMY census row only) |
| six `--check`s | as W0 | identical (both measurements) |
| tapeRunner | 511, `0ce82642…` | **515**, `4bda845e9800ef30f3d21025664be4c4`: the 511 unchanged, plus 4 passed (two per witness: JS = game exactly; stepping = runTape) |
| roster | 227 | **229** |
| surface | GREEN 198, `e80fdf30…` | **GREEN 199**, `8e219100b65e1e523654944d2f187726` |
| constants / profile / entities | 4,977 / 138 / 518 | unchanged |
| bounded vitest | 41 files / 2,122 | **42 files / 2,141**, all green (+13 `fidelityFrontier3`, +4 `tapeRunner`, +2 `tapeIndexManifest` per-tape rows; `surveyFamily`'s new asserts sit in an existing row) |

## What the brief got wrong (measured)

1. **"`pixelmask:building6` … a pixel mask read as its bounding box."** Not so. The planner reads the real mask
   (`plannerBlockerAt`, since R2). The over-claim was the AIM: the reach-exit walked at the trigger centre, which is
   inside the mask.
2. **"planttorch — burnable? breakable?"** Neither. `PlantTorch` is scenery with no `hit`. Its Σ13 is 9 L62 legs where
   the cut is the 16 px lattice (and the door aim) plus 1 L112 leg that boots inside the rocklock. Ranking by the
   NAMED obstacle ranks the nearest scenery.
3. **"rocklock — an item."** It is an ENCOUNTER: L112's rocklock opens on the Owl's death. L26's is a kill-lock.
4. **"`pixelmask:cliffside0` Σ9 (L12, L87)."** The L12 rows boot inside `magicallock@32,864` (ARRIVAL's region,
   misattributed). The L87 rows are the lattice gap.
5. **"Survey: `solid:rock` + `pixelmask:opentree` (L65), `solid:dungeonspire` (L93)."** Both are misattributed. L65's
   door is `pushableblockspear@176,128` (a press-push verb the solver lacks). L93's cut is the spear bridge tile (7,13)
   and lethal floor.
6. **"`solid:finaldoor` ×10 — walker crossed 4."** 8 of the 10 legs boot INSIDE the door: the L115-return arrivals,
   where the game has already removed it (ARRIVAL). From outside it is a true ITEM gate.
7. **"`solid:tree` ×4 (walker crossed 2)."** The end points are on water without the Conch. A tree has no verb
   (`Tree.hit` is empty).
8. **The base.** main was `88a7e4d`, 3 CI-only commits past `9527592ac4`.

## Residue

- **The flag.** `FINE_LATTICE_ROSTER_WIDE` stays off until the user licenses the ENEMY-census move (one generated row,
  REFUSED → SOLVED 153 t).
- **L62's corridor**: with the fine lattice, the walks reach `darktrap@112,208` (a static Enemy in the one-tile
  corridor; kill refused by §11.4) or `turret@232,…`. Combat ladder; no wave-6 region owns darktrap.
- **L42's crusher**: `bait` needs a solver executor that searches choreographies against `stepCrusher`, the
  `r5Totem.L42_PART4` pursuit. Named, not built.
- **L65**: a press-push verb for `pushableblockspear` (any weapon, the relative arm, one tile along the facing) is the
  door. Adding `solid:pushableblockspear → shove` without it would turn its refusals into "failed to apply" and reorder
  frontiers that solve today, so it is not added.
- **L93**: the spear bridge tile is a terrain verb, outside `solid:*`.
- **L66**: `bosslock@72,64` hides behind building8's mask in the frontier flood. Re-scanning with masks transparent on
  the refusal path would name it.
- **ARRIVAL/TERRAIN hand-offs**: boots inside `finaldoor`, `rocklock` and `magicallock`, and end points on water
  without the Conch.
- **The full 799-leg sweep** was not re-run (the stop is above). The 15 listed rooms' 257 legs are the census.
- **`check-procgen-help`** was not re-run in a throwaway worktree. `--help` on the new script prints and writes
  nothing (md5 of its tapes checked), and a bare import does no work.

## Byte-inertia

- **Identity block:** at the full D2+D3 code with the flag off, `5bf108151ad7a075428d0ff20f15240e`, byte-identical
  to base, all six `--check`s with it.
- **The witness script `--check`:** both tapes byte-identical on re-derive (`d29f0de8…` and `9db3d1b7…`).
- **Committed tapes and expectations:** none moved. tapeRunner's existing 511 pairs are unchanged.
- **Not done:** no AS3, wasm, gitlink or rules edit; no `standing-values --write`, no `pytest`, no unfiltered vitest;
  no `git stash`; nothing pushed to `main`.

## Rows to BANK

- identity block **`5bf108151ad7a075428d0ff20f15240e`** (flag off); flag-ON mover: `ENEMY census default` → `d8c2f110f2cff63666d0efe542a71e9a` (one row).
- tapeRunner **515** `4bda845e9800ef30f3d21025664be4c4`; roster **229** (`frontier3-l62-door-niche`, `frontier3-l87-pocket`).
- surface GREEN **199** `8e219100b65e1e523654944d2f187726` · constants PASS 4,977 · profile 138 · entities 518.
- bounded vitest **42 files / 2,141**.
- witnesses: tapes `d29f0de870ade6b7dd6d5d839a7cd249` / `9db3d1b75a10fceb12ec3c875e6dbc90`, expectations `d4e8f30561db7d5d6ac55474cde380e4` / `18dbaabf0c0268c5b2bbfb2e3430bfe1`.
- census (257 legs): 156 → 157 (default) / 173 (flag ON), 0 regressions; survey steps 108/234/235 re-familied.

# Seedling fidelity MISCRES — REMBODY's residue, leg 785's work, three unowned rows

| | |
|---|---|
| Session | `seedling-fidelity-miscres` (planner `seedling-fidelity-planning-12`, wave 29) |
| Start SHA | `e8d85de8d1` (`fidelity-harvest/firepush` = main `f9342f25b8` + FIREPUSH, its three keys OFF) |
| Code head | `a74db571` (code: D1 `6b392584`, D3 `9e5328fd` + its order `07cdaaa3`, the FAMILY_BLOCKS row `deac83fd`, a test pin `45174fe9`; `a74db571` = the log + `docsIndex.js`). This report is the commit after it |
| Harness branch | `claude/seedling-fidelity-miscres-fu31cg` (local `seedling-fidelity-miscres`; nothing pushed elsewhere) |
| Port | 9730 (this tree, server PID 628); 9731 for the ON-arm probe battery (a scratch worktree, the three literals flipped) |
| Verdicts | **W0 PASS · D1 PASS (`forecastCorpseFade` witnessed at 0 px on p4g; `nonChaserRemovalBlocks` unwitnessed, named) · D2 STOP (the fix is a budget: handed to the JS arc with the numbers) · D3 PASS (opentree and owl pinned; leg 650 fixed behind `phaseDodgeArrivalStall`) · Movers: STOP for a licence (list below)** |
| Switches | `forecastCorpseFade`, `nonChaserRemovalBlocks`, `phaseDodgeArrivalStall` — all **OFF**; OFF is byte-identical by construction |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-miscres-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `movers/`) |

## The one thing to know first

**Two of the three "residues" were the arrival clock.** Leg 785 (L107) and IGFADE's leg 650 (L76) both flip between
done and failed because their answer is a function of `staging.seam.time`, and both spend the page's budget in the same
place: the dodge rung's phase arm (`phase-dodge`), one 89×8 stall scan = 712 units. In L76 the cause is a planner blind
spot that is now fixed behind `phaseDodgeArrivalStall` (the doorstep stall stands in a type-31 tile's range, and standing
there turns the tile; a stall at the walk's start does not): 18/61 → 61/61 clocks solve inside 640 units, and the 18
clocks that already solved keep their plans. In L107 it is
not a planner gap I can find: 12/61 clocks solve at 731 units (> 640), and the rest are the room's honest refusal at
7,656 units a pass. That one is a budget: STOP, handed to the JS arc.

## W0 (PASS) — `evidence/w0/`

| row | command | result |
|---|---|---|
| base | `git checkout -B seedling-fidelity-miscres e8d85de8d1`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0; server PID 628 on 9730 |
| identity block | `SEEDLING_PORT=9730 bash scripts/procgen/identity-block.sh .` (`w0/identity-before.txt`) | file md5 **`161dab658ab243a98241f743a78f9157`**: maze `57e07d21`, **acceptance `481b7a1c`**, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK; the six `--check`s battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0; reference: 4 differ (the environmental `bulletml-dodge` rows, as every slice since SKINSWING). ⚠ The acceptance row is NOT FIREPUSH's `933c14f7`: it reproduces as `481b7a1c` on a second run (deterministic), so the wave-28 main under this base moved it, not this slice |
| tapeRunner pairs | the `tapeRunner.test.js` rows of the bounded run, `status\tfullName` sorted (`w0/taperunner-pairs.txt`) | **635 / 635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** = FIREPUSH's published file |
| surface / constants / entities / profile | each `--check` (`w0/censuses.txt`) | GREEN **347** · PASS **6,911** · PASS 566 · PASS 138 (both) |
| roster | `fixtures/tapes/index.json` `.tapes` | **289** |
| bounded vitest BEFORE | 167 files (`w0/bounded-files.txt`): the brief's list ∪ REMBODY's chaser/drill set ∪ FIREPUSH's and SEARCHGAPS' file lists ∪ the region's own tests by name (`drill`, `wallFlyer`, `iceTurret`, `chasers`, `fidelityIgneous`/`Igfade`, `finalBossFight`, `fidelityMasks`, `levelWorld`, the skins). ⚠ Built by name, not by a grep of every touched function: the `entityBlocks` red below is what a grep for `entities('igneousTiles')` would have predicted | **5,081 rows: 5,080 pass, 1 FAIL at the base** — `seedlingAtlasArm.test.js` (`Cannot find module '../bulletml-dodge/…'`, the uninitialised submodule; environmental). Sorted rows md5 `0c0b9270…` (`w0/rows-before.txt`) |
| slow L32 | `npx vitest run --config vitest.slow.config.js fidelityL32ArenaPrefix.slow.test.js` | 5 / 5 (and 5 / 5 with the three keys ON) |

## D1 — REMBODY's residue (PASS; two switches, both OFF) — `6b392584`

### W0: what is still dropped at once

REMBODY's table, re-read at this base. The game: `World.remove` queues, `updateLists` drains after `World.update`, so a
body removed in its own update is still in its type list for every entity that updates after it this frame. Update order
is the reverse of the add order (`addUpdate` prepends): wallflyers (`Game.as:2415`) and drills (`:2290`) update BEFORE
every chaser (`:2276-2301`), and the model steps them above the chasers in `advance` (`stepWallFlyersNow` →
`stepDrillsNow` → … → `stepIceTurretsNow` → … → `stepChasersNow`), so a removal in those families this tick is read by the
chasers stepped later the same tick.

| removal | readers stepped after it this tick (model) | before | ON |
|---|---|---|---|
| drill fade (`drill.js`, `stepDrillsNow`) | later drills (`drillEnemyBodiesTest`), every chaser (`drillWallsNow`) | dropped at once | **a wall for the rest of the tick** (`nonChaserRemovalBlocks`) |
| wallflyer fade (`stepWallFlyersNow`) | the drills' hop test (`drillEnemyBodiesTest`) | dropped | a wall (same key) |
| ice turret corpse removal (`stepIceTurretsNow`) | the chasers (`chaserStaticEnemyBoxesNow`) | dropped | a wall (same key) |
| a cloned corpse in `chaserForecastNow` (any class but a BobSoldier) | the forecast's later clones | **never removed** (a wall to the end of the forecast) | **faded and removed as live** (`forecastCorpseFade`), a wall to the end of its removal tick under `removedBodyBlocks` |
| a cloned body in its "die" in the forecast | — | never reached `destroy` | its own copy of the anim reaches `destroy`, then fades |

### The change (`levelRun.js`, `contactFidelity.js`)

- `forecastCorpseFade`: the clone carries its own copy of the "die" Spritemap; the graphic half's `Bob.endAnim` sets
  `destroy` (a forecast kill keeps its `dyingAt` schedule); the destroy branch runs `Mobile.death`'s fade on screen and
  removes at alpha ≤ 0, adding to `removedThisFrame`.
- `nonChaserRemovalBlocks`: `stampRemovedThisTick` writes `removedTick` on the body where its family's step removes it (ON
  only, outside a ceremony); `removedThisTickStillBlocks` keeps it in `drillWallsNow`, `drillEnemyBodiesTest` (drills and
  wallflyers) and `chaserStaticEnemyBoxesNow` (turrets) on that tick only.
- OFF: no stamp is written, `removedThisTickStillBlocks` is false, the clone keeps the old fields: byte-identical.
- **Digest.** No new map; `removedTick` is a field of the drill / wallflyer / turret state (ON only), read only on the tick
  it is written. Nothing the escape reads was added. `levelRunStateDigest` is green.

### The witness (p4g, SKINSWING's recording; `evidence/d1/forecast-corpse-probe.mjs`)

`skinswing-l71-resite` (L71 (80,208), FIGHT ×300, the game's own recording): the forecast seeded at tick *s*, stepped beside
the live run (which IS the game at 0 px with `removedBodyBlocks` ON), the tape's sword presses mirrored through the
forecast's own `hit(id, playerPos)` (a live body whose `hits` rose that tick):

| seed | OFF (first tick > 0.01 px) | ON |
|---|---|---|
| t50, t55, t58, t62 | **t64** (1.164 px; 10.49 px by t80) | **0 px through t94**; the first departure is t95, the room's restart (the player dies), which no forecast follows |
| t0, t30 (the kills happen inside the forecast) | t64 | t64 — the forecast's OWN kill schedule (`dyingAt + removalTicks`) removes a tick late: residue, below |
| t63, t70, t90 (after the removals) | t95 | t95 |

⚠ Without the mirrored presses both arms leave the live run at t66: the t65 press hits both survivors (`ht30`), which a
forecast is never told about. My first probe read that as a fade error.

### Rows (`fidelityMiscRes.test.js`, D1: 10)

ships OFF ×2 · the t58 seed (ON 0 px to t94, OFF t64 at 1.164 px) · the t50..t62 seeds · the live run unchanged ON
(0 px, 300 ticks) · the five DRILLKILL p4g recordings ON = the game · the drill removal's stamp = its tick ON, none OFF.

### Mutants (predicted first; copy + edit + run + restore)

| mutant | predicted | measured |
|---|---|---|
| m1 the forecast's fade dropped | the t58 row red | **2 red** (the t58 row and the seeds row) |
| m2 the clone's "die" anim never reaches `destroy` | nothing red | **1 red** — the t50 seed clones bodies still in "die", so that arm IS witnessed (I read only the t58 seed) |
| m3 `removedThisTickStillBlocks` ignores the tick (a removed body is a wall forever) | the drill rows red | **0 red** — no recording has a mover sweep into a dead drill's box: `nonChaserRemovalBlocks` has no discriminating row (named) |

## D2 — leg 785 (STOP: the fix is a budget) — `ef58e50f`, `evidence/d2/`

Captured at this base by a local sweep (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
--page=seedling_bot_ap_p4g --keys=<785's key> --capture-requests`): failed, *"ran out of 640, then 2560 work units on its
held retry … at the `walk` site"*. Replayed in node with a counting progress hook (`d2/sites.mjs`), the stock
`replay-seedling-solve-request.mjs --seam-time-sweep=-30..30`, and a 1e9 budget where the cost itself was wanted:

| request | what | where the units go |
|---|---|---|
| request 0 (640), all 61 clocks 5564..5624 | budget-out | dashless 641 (**632 at `phase-dodge`**), full 1 (`walk` is just where the full pass trips with the attempt's budget gone) |
| request 1 (2,560), clocks 5600..5611 (**12 / 61**) | **SOLVED**, dodge + walk, 387..390 t | dashless **731** (712 at `phase-dodge` = one full 89×8 stall scan, then its `partial`) |
| request 1, the other 49 clocks | budget-out at `phase-dodge` (2,562) | — |
| unbudgeted, a solving clock (5605) | SOLVED | 731 dashless + 817 full (window) = 1,548 |
| unbudgeted, refusing clocks (5594, 5640) | **REFUSED**: the combat ladder exhausted on `beamtower@208,120`'s beam (avoid / dodge / bent / time / bait / kill / forced-hit) | **7,656 per pass** (7,120 = ten full stall scans; 529 `detour`); both passes 15,312 |
| FIREPUSH's three keys ON | the same numbers (731 / 7,656) | — |

So the CI flip (`done` in FIREPUSH's B1, `failed` elsewhere) is the arrival clock landing in the 12-tick window, on the
held retry. FIREPUSH's shape (the pulser, the fire block, the latching publisher): its latched-wait arm is not reached by
this leg's answers — the solving plans are dodge + walk (no hold) and the refusal is the beam's — and FIREPUSH's three keys
ON give the same numbers. **Hypothesis refuted before an edit:** the stall bound (`PHASE_DODGE_RUNG.period` 90, the chain's) is not too
short for L107's two beam towers (`rate 2`, `speed 0.5`): their cycle is **52 ticks** (`d2/beamperiod.mjs`). A stall at the
walk's start (D3's fix) does not help here either (10,949 units, still refused).

**Hand-over to the JS arc (the budget is theirs):** the first request's 640 is below the leg's 731-unit solve, so 785 can
only solve on the held retry; a refusal by name needs 7,656 units for the dashless pass alone. No solver change here.

## D3 — three unowned rows (PASS) — `9e5328fd`, `evidence/d3/`

### `ENTITY_CLASSES.opentree` "Solid" vs the game's "Tree" — a pinned fact

`OpenTree extends Tree`, whose ctor writes `type = "Tree"` (`Scenery/Tree.as:24`); `OpenTree.as` never re-types it. What
reads the type:
- the model's `collideLineSolid` filters pixelmasks by `type === 'Solid'` AND exempts `as3 === 'OpenTree'` (MASKS,
  witnessed: `mask-l65-opentree`);
- `collidesSolid`, `collidesBlast`, `collidesArrowCover` and `solidBoxesForBlast` test every pixelmask whatever its type,
  and each AS3 list they mirror carries "Tree" (`Mobile.solids`, `IceTurretBlast`/`Arrow`/`TurretSpit`/`LavaBall`);
- the AS3 readers that ask "Solid" without "Tree" (`Chest`, `Pole`, `Pull`, the locks, `Crusher`, `Stick`, `BossTotemShot`,
  `Droplet`): opentrees stand in L12, L27, L65 only, and no such reader's box meets one (±1 px; L12's nearest is
  `bosslock@80,656`, 16 px from `opentree@32,672`); L65's `Droplet` is cosmetic.
→ nothing moves; the row keeps "Solid". (The arrow's `hitTypes` ledger would report "Solid" for an opentree; no arrow
trap shares a room with one.)

### The owl's `Game.talkingPic` — a pinned fact, a skin hand-over

`talkingPic` is read only by `Game.render`'s talk box (`Game.as:1726-1735`). `FinalBoss.update`'s `if (!started)` sets
`talking`, `talkingText = "EEEEP!"`, `talkingPic`, `freezeObjects` every frame until `Input.released(keys[6])` — and that
IS modelled (`finalBossFight.introFreeze`, `levelRun`'s `introRelease`; pinned on a staged L112 run: frozen at (72,104)
for five ticks, started after a primary release). `run.talkingNow` does not name the owl: render only → the JS skin's
(below). The "L112 Owl ×2 unbound boss kills" of js doorless-legs are the goal binding (js's); the kill's AP row exists
(`AP_REPORT_ROWS` 'Owl').

### IGFADE's leg 650 — the arrival clock (`phaseDodgeArrivalStall`, OFF)

At this base the key `level_76 <- in_L77_0_32 -> exit:out_teleporter_0_80` is leg **637** (IGFADE's 650), and it FAILS
(budget-out at `phase-dodge`, captured at seam 5603). IGFADE's node driver solved it (556 t) because it applies the sweep's
`seamTime` only under `SEAM_TIME`: it solved at the fresh runtime's clock. Measured on the page's own request:

| arm | clocks solving (of 61, 5573..5633) | cost |
|---|---|---|
| OFF, 640 | **18** (5573..5590) | 128..170 units; the rest budget out at `phase-dodge` |
| OFF, 2,560 | 25 | — |
| OFF unbudgeted, seam 5603 | REFUSED on `lavachain@128,64` | **11,726** units |
| OFF with `igneousLava` OFF | SOLVED (728 t) | 184 units |
| **ON, 640** | **61** | ≤ 479 units; the captured request: dashless 727 t (183 units), full 706 t; the 18 clocks OFF solves: **the same plans** |

**Why.** The phase arm stalls at the chain's doorstep and up to 7 offsets earlier (step 4): 28 samples. In L76 those
stances stand within range of the type-31 tile (8,6), the tile right by the chain's danger point, and a player in range is
what drives the tile's clock: every stall long enough to shift the chain's phase turns the tile to lava. The game is
modelled right; the planner only asked stances where waiting is fatal. ON, in a room holding a type-31 tile
(`run.entities('igneousTiles')`), a stall at the walk's start (`at = 0`) is the SECOND candidate: right after the doorstep
offset, before the earlier ones. **The order was measured, three ways** (the captured request; `d3/seam637-on*.jsonl`):
- FIRST (`9e5328fd`): 61/61 solve, 94 units at 5603 — but at 5587..5590, where OFF already solved (full 553 t), it plans
  722 t: the start stall pre-empts a short doorstep stall;
- LAST: 806 units at 5603, over the first request's 640;
- **SECOND (`07cdaaa3`, shipped): 61/61 inside 640 (max 479), and all 18 clocks OFF solves keep OFF's plans exactly.**

**Rows** (`fidelityMiscRes.test.js`, D3: 6): opentree ×2, owl ×1, leg 637 ×3 (OFF budget-out at `phase-dodge`; ON both
passes solve inside 640: 727 t at 183 units / 706 t at 269; ships OFF), on `fixtures/miscres/leg637-l76-request.json.gz`
(the page's captured request, 87 KB).

**Mutants** (on both orders): m4 the insertion dropped → 1 red (the ON row), as predicted; m5 the igneous gate dropped →
0 red, as predicted (L76 holds the tiles; the gate is what bounds the movers, named, not pinned).

## The movers (all three keys ON) — STOP for a licence

| measurement | OFF | ON | movers |
|---|---|---|---|
| route survey, FULL, local (`survey-seedling-route.mjs --through=end --route=full`, env keys `=0` vs `=1`, concurrently; at `9e5328fd`, the FIRST order) | 239 steps: 186 SOLVED / 53 REFUSED | the same | **0** — verdict, ticks, hits and refusal text equal by (level, goals, boot, occurrence) (`movers/survey-full-{off,on}.txt`, md5 `095a12ba…` both) |
| the 15 survey steps in type-31 rooms (174..217, L71/74/76/77/78/85/99), re-run ON at `07cdaaa3` (the shipped order) | as the full OFF | the same | **0** |
| leg 637 (L76), the captured request, 61 clocks (`d3/seam637*.jsonl`) | 18 solve at 640 | **61** solve at 640 | **+43 clocks** failed → solved; the 18 OFF solves keep their plans |
| keyed sweep, local (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g --contact-fidelity=<arm>`, the 57 legs of the 7 type-31 rooms; arm A = the 62 defaults, arm B = A + the three; ×1 per arm; B re-run on the shipped order) | A: 51 done / 5 failed / 1 skipped | B: 52 / 4 / 1 | **1: leg 637 failed → done**. (B on the first order also moved 636 635 → 677 t; replayed on its captured requests that was the arrival clock (9737: OFF = ON), but at 9775 the key does plan 729 t where OFF plans 635, under either order — a tick mover at some clocks, named.) `movers/sweep-igneous-{A,B,B2}.txt` |
| probes standard, local, ON (scratch worktree, port 9731, the three literals flipped) | — | **11 / 11 ALL CHECKS PASSED** on the first order (logical-links 24, vanilla-map 23, arrival-composites 95, midroom-replan 10, restart-route 18, restart-warp 28, adopt 51, obstacle-events 22, generated-playback 35, loop-restart 30, seal-delivery 6); re-run on the shipped order (`07cdaaa3` in the worktree): **11 / 11 again, logical-links 25** (`movers/probe-battery-standard-on*.txt`) | 0 (logical-links' 25th check is conditional: *"B took no Restart in its budget"*, the 900 s walk reaching 16/48 with vitest sharing the box) |
| bounded vitest (168 files = the BEFORE 167 + `fidelityMiscRes`) | OFF: 5,100 rows; equal to BEFORE but the 3 new `contactFidelityHook` rows (one per key) and **`entityBlocks` D2 ×2 red at `9e5328fd`** (the new `entities('igneousTiles')` read was not in `FAMILY_BLOCKS`: fixed in `deac83fd`, 30/30) | ON (env): 5 red, listed below | — |
| identity block (OFF, at `a74db571`'s code) | `161dab65…` | — | **0**: byte-equal to W0, every row and the six `--check`s |

### The dispatches the planner should run (this branch, `claude/seedling-fidelity-miscres-fu31cg`)

The arms (`evidence/movers/contact-fidelity-arms.txt`): **A** = the 62 default-ON keys at this base; **B** = A +
`nonChaserRemovalBlocks,forecastCorpseFade,phaseDodgeArrivalStall`. (⚠ the input turns every unlisted key OFF.)
1. `seedling-survey.yml` `through=end route=full`, on this branch and on a scratch branch off it with the three literals
   flipped (the workflow has no switch input). Compare by (level, goal, boot). Expected: 0 movers, as measured locally.
2. `seedling-divergence-sweep.yml`, `capture_requests=true`, arms A and B, **×2 each**:
   - `keys=` `movers/leg-keys-igneous.joined.txt` (57 legs, L71/74/76/77/78/85/99) — where `phaseDodgeArrivalStall` acts;
     expected: leg 637 failed → done in B, the rest equal or a phase-arm leg that now solves;
   - `keys=` `movers/leg-keys-forecast.joined.txt` (216 legs, the 26 chaser-pair rooms) — `forecastCorpseFade`;
   - `keys=` `movers/leg-keys-nonchaser.joined.txt` (88 legs, L22/25/28/40/91/98) — `nonChaserRemovalBlocks`.
   Decide any mover on its captured request (`replay-seedling-solve-request.mjs --seam-time-sweep=-30..30`), never on one
   row; list every `producer:walker` row that moves (the walker was not edited).
3. `seedling-probe.yml battery=standard` on the scratch flip commit.
4. For leg 785 (no change here): `keys=<785's key>`, `seam_census=-30..30`, `capture_requests=true` — expected 12/61 on the
   held retry, as measured.

## The JS arc

- **D2 hand-over (theirs: the deadline and the worker budget):** leg 785 needs 731 units to solve on its solving clocks
  (the first request's budget is 640) and 7,656 units for the dashless pass's refusal by name on the others.
- **To wire:** nothing. No new staging/result field, no `SolverRefusal.obstacle.kind`, no `solveSegment` / `twoPassSolve` /
  `PendingDeclaration` / `createRunForStaging` change, no walker edit. `run.drills.bodies`, `run.wallFlyers.bodies` and the
  turret entities may carry `removedTick` with `nonChaserRemovalBlocks` ON (a field added, none renamed);
  `seedlingSkinRenderer.test` / `seedlingRoomBodySkin.test` green OFF.
- **Skin (G4b-dialogue):** `run.talkingNow` could name the Owl's intro (`source: 'owlIntro'`, "EEEEP!", `FinalBoss.as:89-91`)
  — render only, so not done here.
- Pins that move OFF: none. ON (a flip): `contactFidelity.test.js`'s defaults row and this slice's three "ships OFF" rows.

## Handed to the hammer arc

Nothing. No hammer-owned function was edited (`chaserForecastNow` is not on the list; the phase arm is LADDER2's).

## Deltas

- New switches (OFF): `forecastCorpseFade`, `nonChaserRemovalBlocks`, `phaseDodgeArrivalStall`
  (`SEEDLING_FORECAST_CORPSE_FADE`, `SEEDLING_NON_CHASER_REMOVAL_BLOCKS`, `SEEDLING_PHASE_DODGE_ARRIVAL_STALL` `=0|1`).
- `levelRun.js`: `chaserForecastNow` (clone + destroy branch + graphic half), `drillWallsNow`, `drillEnemyBodiesTest`,
  `stepDrillsNow`, `stepWallFlyersNow`, `stepIceTurretsNow`, `chaserStaticEnemyBoxesNow`, two helpers.
- `solverBot.js`: the phase arm's stall candidates (`ats`).
- `fidelityMiscRes.test.js` (16 rows); `fixtures/miscres/leg637-l76-request.json.gz`; `contactFidelity.test.js`'s defaults
  row (+3 OFF keys).
- Surface GREEN 347 (re-recorded twice: line moves, +1 `run.entities('igneousTiles')` read and +1 switch site in
  `solverBot.js`); constants **6,914** (+3 literals; one classified: `step|hee10ba2a|0|1`).
- `entityBlocks.js` `FAMILY_BLOCKS` `igneousTiles.solverReads` += `solverBot`, and its row in `seedling-solver-surface.md`.
- `seedling-bot-log.md`: the MISCRES entry.

## What the brief got wrong (measured)

1. *"leg 785 … a work-unit deadline at `walk`"*: the deadline the refusal NAMES is `walk`, but that is the full pass
   tripping with 1 unit left; **632 of the dashless pass's 641 units are at `phase-dodge`**.
2. *"IGFADE's leg-650 arrival clock (read IGFADE's report: the residue it names)"*: IGFADE's report names no leg-650
   clock residue (its residue is the walk check's missing fade, and L74/L71's spans). What is real is the leg's arrival
   clock dependence, measured here, and it is not IGFADE's switch (`igneousDeadFrames` OFF answers the same).
3. Leg ids: 650 is **637** at this base (match by key).
4. *"the forecast never fades a plain corpse"* is half of it: a cloned body in its "die" never reached `destroy` either
   (mutant m2 has a witness through the t50 seed).

## Residue

- **The forecast's own kills** (`hit` → `dyingAt + removalTicks`) are removed one tick after the live run would (seeds
  t0/t30: both arms leave the game at t64). Under `forecastCorpseFade` the faithful arm would stage a forecast kill as live
  does (the "die" anim, then the fade); it touches the strike policy's preview kill, so it was not widened into D1.
- `nonChaserRemovalBlocks` is unwitnessed (no recording reaches it). Also not covered: the player's own collision with an
  ice turret corpse removed this frame (the player updates last; "Solid" in its list), and the corridor body forecast's
  clones (it reads removals at build time).
- The model's family order puts drills before ice turrets; the game updates ice turrets (`:2296`) before drills
  (`:2290`) and the puncher (`:2301`) before both. Pre-existing, named.
- Leg 785: no planner gap found; the budget (JS) or a cheaper phase scan (a search change that would move L75/L103) is
  what is left.

## Byte-inertia

By construction: every new branch is behind a key that is OFF, and OFF writes no field and adds no candidate. Measured OFF:
the identity block file md5 `161dab65…` = W0's (all rows, the six `--check`s); tapeRunner 635 rows unchanged (inside the
bounded run, all pass); bounded vitest = BEFORE plus the new rows; the full route survey's OFF arm; constants 0 drift
after the classification; surface line moves and the two named reads.

**The bounded reds with the three keys ON** (`movers/vitest-rows-on.txt`):
1. `contactFidelity.test.js` › the shipped defaults (an artefact of the env arm; a flip re-pins it).
2. `dashShape.test.js` › "the defaults add no field" (any off-default env switch reds it; IGFADE measured the same).
3. `seedlingAtlasArm.test.js` (red at the base: the uninitialised `bulletml-dodge` submodule).
4. `fidelityRemBody.test.js` › *"OFF: the live step moves the survivor 1.164 px past the forecast (which holds its
   corpses)"* — it pins the forecast holding its corpses, which `forecastCorpseFade` changes: **a flip re-pins it** (with
   the key ON and `removedBodyBlocks` OFF the forecast reads the removal tick as live does).
5. my own stamp row's OFF arm inherited the env key: fixed (`45174fe9`, it names the key).
After the order change the 17 bounded files that reach the phase arm or the igneous tiles were re-run: ON 630 / 631 (the
defaults pin only), OFF 631 / 631.

## CI on this branch

| head | `JavaScript Unit Tests` |
|---|---|
| `9e5328fd` (D3) | superseded by the next push (cancelled) |
| `deac83fd` (the FAMILY_BLOCKS row) | vitest (unfiltered) **22,617 passed / 0 failed**; slow 268 / 268 |
| `45174fe9` (the stamp row's pin) | run 40119694221 **success**: vitest 22,617 / 0 failed; slow 268 / 268 |
| `07cdaaa3` (the order) | superseded by `a74db571`'s push |
| **`a74db571`** (the log + `docsIndex.js`; the LAST code-bearing head) | run 40125292826 **success**: vitest (unfiltered) **22,617 passed / 0 failed**; slow 268 / 268 |
| this report's commit | `CC/` only: the path filter runs no `JavaScript Unit Tests` |

## Rows to BANK

- `fidelityMiscRes.test.js` (16 rows) and `fixtures/miscres/leg637-l76-request.json.gz`.
- The fact: **a solver answer that flips between CI repeats can be a function of the arrival clock** — 785: 12/61 clocks;
  637: 18/61 (OFF) — census the captured request across `seam.time` first.
- The fact: **an Igneous tile turns under a stall stance in its range**, so a stall's position is part of a phase dodge.
- The keyed-sweep derivation `movers/miscres-rooms.mjs` (re-derive at any base; rules re-key legs).

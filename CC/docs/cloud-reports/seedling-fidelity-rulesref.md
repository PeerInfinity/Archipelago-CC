# Seedling fidelity RULESREF — three walk-model refusals the rules arc exposed

Wave 32, planner `seedling-fidelity-planning-14`. Session `seedling-fidelity-rulesref`.

- **Start:** main `1e17f44738` (85 default-ON keys, as the brief says; the file is the truth).
- **Head:** see the last section (the report is the last commit).
- **Harness branch:** `claude/seedling-fidelity-rulesref-a70wgx`.
- **Evidence:** `seedling-fidelity-rulesref-evidence/`.

| D | verdict | switch (all ship OFF) | what changed |
|---|---|---|---|
| D1 L53 puncher | **STOP** (hand-over to hammer) | `punchGateTimed` | The walk's gate times the punch; a walk beside a pinned puncher leaves along one axis. Step 79 walks 560 t hitless, then refuses inside the hammer's press-kill dwell. |
| D2 L63 spear block | **STOP** (hand-over to rules) | `spearBridgeVerb` | The real cut is the spear BRIDGE (2,9), not the block. With the bridge verb, the block route resolves; step 161 then meets `darktrap@128,272`, which no stance below it can light. |
| D3 L66 doorway | **PASS** | `fineFrontierFlood` (+ `spearBridgeVerb`) | Step 163 SOLVED (230 t, 0 hits), game-witnessed at 0 px. Leg 579's arrival solves in 87 t (model). |

Bonus mover: **L93 step 211 goes REFUSED → SOLVED** (362 t, 0 hits) under `spearBridgeVerb`. This is FRONTIER3's other
spear-bridge cut.

## W0 — the base

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/seedling-fidelity-rulesref-a70wgx 1e17f44738`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `identity-block.sh .` in a detached worktree of the base, venv active, its own server (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`. Rows md5 **`47648037`** |
| six `--check`s | in the block | battery `da331da7` **exit 1** · d2-chain `8be1a293` **exit 1** · l18 `b8d8452a` **exit 1** · tail `35456fbc` exit 0 · r9-l3 `6cd35fe1` exit 0 · r9-campaign `e69370f6` **exit 1**. ⚠ Four reds AT THE BASE, the same digests on an idle box and again at my head (e.g. `r8-solve-11 trace … DRIFT`). They are not this slice's. See "What the brief got wrong". |
| reference | in the block | 4 DIFFER: registry/capabilities and their two regions (the known box artifact) |
| surface / constants / entities / profile | each `--check` | GREEN **353** · PASS **6,952** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` (`tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | the brief's list + `bridges`, `blockRoute`, `solverBot`, the surface/constants tests (81 files) | **2,135 / 2,135** (`vitest-before.txt`) |
| bounded vitest BEFORE, extra | every test naming a function or field I touch (`deriveBlockRoute`, `OBSTACLE_STRATEGIES`, `frontierExecutor`, `chaserDanger`, `swordTickAt`, `bridgeTiles`, `openBridges`, `runSpear`, `FINE_LATTICE`, …; 20 files) | **749 / 749** (`vitest-before-extra.txt`) |

⚠ My first BEFORE run was contaminated (it started on my tree and I edited mid-run). I killed it and re-banked in a
detached worktree of the base. The numbers above are the worktree's.

## D2 — L63: the spear block, and the bridge behind it (`spearBridgeVerb`)

**Measured.** Survey step 161 (L63 visit 3, arrival (128,288), goal `teleporter@32,304`) refuses *"Obstacle:
solid:pushableblockspear (pushableblockspear@112,96). Strategy 'shove' failed to apply"*. I asked the block-route
search directly. It refused before searching, with SF3's proof: *"(40,312) is not reachable from (136,296) even with every
pushable removed, every breakable rock broken (0 live) and every lock open"*. An obstacle map of the room shows the cut:
tile (2,9) is `solid:tile:Bridge`, the spear bridge, on the one-tile column down to the exit. The frontier skipped it
because `identifyAndSelect` drops every `tile:*` blocker as a wall.

**The game.** `Player.as:1116-1119`: `genericHit`'s `e is Tile` arm runs `bridgeOpeningTimer--` only under `t == "Spear"`.
`Tile.as:343-365`: a Bridge stays Solid until its timer has rendered down to 0. The model has stepped this since R4
(`bridges.js`, game-probed by `probe-seedling-bridge.mjs`: one press, walkable 60 on-screen frames later), and
`botDriverV2.runSpear` has a `bridge` arm. Only the solver had no row. (`PushableBlockSpear` itself: a sword press gives
`spearDirection == -1`, so `p = (0,0)` and the block stays. That matches the committed `pushblock-l65-sword-press`
control.)

**The change (ON).**
- `identifyAndSelect`: a closed bridge blocker (`blocker.bridgeId`) joins the frontier as `solid:bridge`, id
  `bridge@tx,ty`.
- `OBSTACLE_STRATEGIES['solid:bridge'] → 'bridge'` (its own wrapped, switch-gated row). `frontierExecutor('bridge')` →
  `execBridge`, and `resolveObstacleStrategy` → `resolveBridgeStrategy`.
- `resolveBridgeStrategy`: a floor cell one or two tiles behind the bridge on each axis. Its spear rect
  (`spearHitRect` + `pressRectTouches`) must touch the tile from every point within `SPEAR_STANCE_SLACK`. It must reach no
  other non-inert press responder (`auditPress`), and must be reachable (16 px, then 8 px). The nearest one wins. No spear
  gives `held: false`, refused by name.
- `execBridge`: settle, check the reach where the walk stopped, select the spear slot, `runSpear({bridge, facing})` (face
  tap, unfrozen press, wait until `openBridges` holds it), then select the old slot again.
- `deriveBlockRoute`: `spearOpenableBridges` opens, in the search's base bag, every bridge the run holds a spear for. The
  SF3 proof and the goal tests then see the room the bridge verb will make. The walk meets the bridge on the frontier after
  the pushes.

**Result.** Step 161 resolves the block: four W thrusts, from (152,104), (120,104), (104,104) and (88,104), the last
sinking it at (3,6). It then refuses on a third wall, which the brief did not name: **`darktrap@128,272` (tag 4)** sits on
(8,17), the one-tile column straight above the arrival. Its contact is a 16x16 `Enemy` body (`SandTrap.as:31`), so it
cannot be passed hitless. Only a lit pole kills it, and no stance below it puts the spear on `lightpole@112,272`: I checked
every box clear of the trap with y ≥ 289 against the pole, facing W and N, and none touches it. The ON refusal text is the
TIME rung's, ending on a pit-edge start tile (*"A* start tile (7,18) … pit"*). That text is messy residue; the wall is the
trap.

⚠ **Why the trap is there in visit 3 (hand-over to the rules arc).** In visit 2 (step 157) the solver kills this very
trap with the light arm (press t469, dying t472) and leaves L63 at t504. A DarkTrap is removed only after
`deathCounter` 30 plus the 14-frame die animation (`DARKTRAP_LIGHT_DEATH`). `SandTrap.removed()` is what writes
`setPersistence(4, false)`, and that happens after the door. Step 157's replay earns only {63,1} and {63,7}. So {63,4} is
never written, and visit 3's arrival is sealed hitlessly. This is a route/staging question (wait out the removal in
visit 2, or the region rule), not a walk-model one.

**Witness.** The bridge thrust is witnessed by D3's tape (L66's bridge, the same verb). No D2 tape: step 161 does not
solve.

## D3 — L66: the half-tile doorway (`fineFrontierFlood`)

**Measured.** Step 163 (L66 from the L65 arrival (128,144) → `teleporter@72,64` → L70) and leg 579 refuse with *"A* goal
tile (5,4) in level 66 — for (80,72) — is not walkable: pixelmask building8"*. The room, on a 4 px obstacle map:
`building8`'s door notch is x 72–87, and `bosslock@72,64` (16x16) fills it, with the teleporter on the same cell. The 16 px
node centres beside the walk's component (x 72, x 88) hit the MASK, so the frontier held only scenery (`building8`, two
`dungeonspire`s): "No strategy row exists". FRONTIER3's 8 px retry also fails, because the 8 px goal tile (10,9) is the
LOCK. Behind all this, the arrival's own corridor is cut by L66's spear bridge (7,9), so D3 needs D2's verb.

**The change (ON).**
- `identifyAndSelect`: the frontier flood is a function of its pitch. When the 16 px frontier has no actionable entry, or
  the 16 px plan failed on a masked goal tile (matched on the planner's own message), the frontier is flooded again at
  `FINE_LATTICE`. If that frontier has an actionable entry, it is this round's frontier. The masked-goal arm is measured:
  from leg 579's arrival (64,80) the coarse frontier holds L66's bridge, which is actionable but not on the way. Without
  the arm the walk opens the bridge first (271 t); with it the walk takes the door (87 t).
- `deriveKeylockStance`: once every 16 px cell has failed, it asks the lock's 8 px cells (`keylockCandidates` takes a
  pitch), planned on the 8 px lattice.

**Witness (p4g, headless).** `rulesref-l66-door` is step 163 planned with `spearBridgeVerb` + `fineFrontierFlood` ON, on
the survey's own staging. Its run: equip the spear at t0, a W thrust from the arrival (bridge open t64), the old slot back,
the doorway's 8 px column, the key line (lock open t228), and the teleporter to L70 at t230. 0 hits; it earns {66,0}.
- `check-seedling-bot-differential --record --only=rulesref-l66-door`, then the same without `--record`: **ALL CHECKS
  PASSED**. The game equals the committed oracle, `save.time` 8857 = the model's, and `hits` 0 = 0.
- Model vs oracle: **231/231 observations, worst |Δ| 0**, transitions equal.
- Producer `scripts/procgen/plan-seedling-rulesref-witness.mjs`: `--from-view=<survey boot view>` writes the tape, and
  `--check` re-derives it from the committed tape's own header (byte-identical) and asserts the mechanism (bridge before
  lock, L70, no hit).
- Roster **289 → 290**, pinned by name: tape index, `dialogueAutoAdvance`, `observationTolerance` (count and swapped,
  measured), `tapeEnvelope`. `r8Acceptance` finds no new enemy exposure.

## D1 — L53: the puncher (`punchGateTimed`)

**Measured.** Step 79 (L53 from (48,144) → `teleporter@144,240` → L54) refuses at the walk's decision gate at t120:
*"the danger map forbids (104.7,120.1) — chaser:puncher@136,96 (inside leash 80 (d=11.1), box grown 1 px/tick x 0 + pad
8)"*. The solver had broken `breakablerock@112,128` with its dashed walk to the stance (104,120). The puncher came to meet
the player. The gate (`dangerNow`, live bodies) priced it with `threatPad` 8, while the transit probe prices the same body
by the forecast's punch (U10 D2).

**Game witness first (p4g, headless).** `probe-seedling-chaser-mobiles.mjs --class=Puncher --player-hits --record` on the
solver's 120-tick prefix plus an 80-tick idle stand. The recording is
`fixtures/chaser-witness/rulesref-d1-l53-stall.json`; the tape is in the evidence.
- 201 sampled ticks. The model's puncher equals the game's at every tick (position, velocity, `hits`, `hits_timer`;
  **worst |Δ| 0**), and the clock shift is [0].
- The puncher, hit once by the dash, **stalls at (107.97,109.94)**, its bottom edge 0.17 px above the player's box top.
  **The game bills nothing: player `hits` 0 for all 201 samples.**
- So the pad refused a box that the game, and the forecast, leave alone. The puncher is not a "pass by timing" problem
  here. After one dash hit it is pinned.

**The change (ON).**
- `dangerNow` (the gate a walk opens with, `timedSword`): in a room with a live chaser whose class has an `attack` row
  (`chasers.chaserHasAttack`, imported through the `solverView` door), it hands `dangerAt` the chaser forecast stepped one
  tick (`punchTickAt`, exported; the `SWORD_GATE_TIMED` shape). `chaserDanger` prices a body whose forecast row carries
  `punch` as the transit arm does: the punch box on its wind-up tick, then the bare body unless its own gate refuses the
  contact. There is no pad.
- `walkTo`: when every hit source of a corridor probe is an attack chaser, the same aim is asked once as an axis-aligned
  walk (`manhattan` + `holdOneAxis`) and probed by the same predicate. A clean probe makes it this attempt's corridor.
  Measured in the model: the controller's diagonal first tick (RIGHT+UP) moves 0.8 px up into the pinned body and is hit at
  t122, while RIGHT alone slides out hitless (the puncher follows).

**Result.** Step 79 now walks **560 ticks hitless**: both rocks broken, the player at (122.3,158.5). It then refuses
inside the **hammer arc's press-kill dwell**: *"chaser kill (puncher@136,96) by press: puncher@136,96 is still in the world
after the whole 166-tick bound (0 guard step(s)); it stands at (115.6,119.4), 39.7 px from the player"*. In the model the
puncher is pinned there, so it never comes to the stance. That region (`execKillByPress`, its dwell) is ⛔ hammer-owned, so
**STOP and hand over** (below).

An experiment I removed: a "break stance tail" (pricing the break's swing as the stance walk's `stand` tail). It moved
nothing on step 79, even with a 60-tick tail, so it is not in the commits.

## Mutants (predicted first; made by copy and restore; md5 restored OK)

| mutant | change | predicted | killed by `fidelityRulesref.test.js` |
|---|---|---|---|
| M1 | drop the bridge frontier entry | "bridge alone", "both ON" | **3**: those two and "ON with no spear" (miss: no bridge is named, so no by-name refusal) |
| M2 | `spearOpenableBridges` returns the bag | D2 "ON: four W thrusts" | 1, as predicted |
| M3 | the punch-timed arm off in `chaserDanger` | D1 "timed gate clears it" | 1, as predicted |
| M4 | `goalMasked` never true | "leg 579" | 1, as predicted |
| M5 | no 8 px keylock candidates | "both ON", "leg 579" | 2, as predicted |

## Movers

### Route survey, local, full route (`--through=end --route=full`), OFF vs all three ON

`survey-full-{off,on}.rows.txt`. OFF reproduces the newest CI baseline's counts (191/44).

| step | room | OFF | ON | key |
|---|---|---|---|---|
| 79 | L53 → L54 | REFUSED at the gate (t120, pad 8) | REFUSED in the hammer's press-kill dwell (t560, 0 hits) | `punchGateTimed` |
| 157 | L63 → L65 | SOLVED 504 t | SOLVED **497 t** (0 hits; same clears) | `spearBridgeVerb` |
| 161 | L63 → L65 | REFUSED "shove failed to apply" (plan time) | REFUSED: block route found, the darktrap seals the arrival | `spearBridgeVerb` |
| **163** | L66 → L70 | REFUSED (goal tile under `building8`) | **SOLVED 230 t**, 0 hits, earns {66,0} | `fineFrontierFlood` + `spearBridgeVerb` |
| **211** | L93 → L98 | REFUSED (`dungeonspire` frontier; the bridge (7,13) cuts it) | **SOLVED 362 t**, 0 hits | `spearBridgeVerb` |
| 214 | L100 | REFUSED (pixelmask `cliffside0`) | REFUSED: *"no REACHABLE stance for a swing at breakablerock@128,144"* | `fineFrontierFlood` |

Totals: **191 SOLVED / 44 REFUSED → 193 / 42.** Each key was attributed alone on 157, 211 and 214.
The ON arm was re-run on the final code (after the masked-goal arm landed). It is identical to the first ON run, row for
row (`survey-full-on.rows.txt` is the final one). So the masked-goal arm moves no survey step; it is measured on leg 579's
arrival only (87 t vs 271 t, model).

### Bounded vitest

- **AFTER, defaults (keys OFF), 102 files** (BEFORE's 101 plus `fidelityRulesref`): **2,916 / 2,917** at the final head, with `rosterCategories.test.js` added
  (`vitest-after.txt`). The one red is `rosterCategories`' LIVE composite row: *"expected 229 to be 230"*, the tape count of
  the new witness's tier. It moves only with the coordinator's `standing-values --write` (⛔ not run here). It is the same
  red U13–U15 left for the bank, and my branch's CI shows it too (below). The first AFTER run
  measured 2 reds in `entityBlocks.test.js`: the `openBridges` family's `solverReads` must now name `solverBot`. I fixed it
  in `entityBlocks.js` and the solver-surface doc table (commit `a76be3cb`).
- **ON (all three via env), 102 files**: 7 reds (`vitest-on.txt`).
  - 2 are the defaults pins, expected under env: `contactFidelity.test.js` "the shipped defaults", and my leg-579 test's OFF
    arm. The latter is fixed: it now names its switches.
  - **5 are real movers, all `punchGateTimed`:** `solveProgress.test.js`'s L40 kill-rung pins (hammer RK / TC2 / PR). The
    asks and `shouldStop` total go 167 → 183 (372 → 390 in the PR row), plus one snapshot digest. L40 holds two punchers,
    and the gate now steps the forecast. A flip owes these re-pins. I attributed each key alone: `spearBridgeVerb` and
    `fineFrontierFlood` move none of the 58 rows.

### Probes (`seedling-probe.yml battery=standard`), local, defaults flipped ON (uncommitted, restored after)

The battery has no switch input; the page reads the defaults. So I flipped all three defaults in the working tree only,
ran the eleven probes on my port, and restored the file.

| probe | OFF (PASS/FAIL) | ON (PASS/FAIL) | rows that differ |
|---|---|---|---|
| wasm-logical-links `--only=B,R` | 25/0 | 25/0 | none. B ends on the local budget at the same place in both arms (sphere 6.4, 18/48, into L39), short of CI's L40 Boss Key 2 (a slower box) |
| wasm-vanilla-map | 23/0 | 23/0 | none |
| wasm-arrival-composites | 95/0 | 95/0 | none |
| wasm-midroom-replan `--only=D` | 10/0 | 10/0 | none |
| restart-route `--only=W,J` | 18/0 | 18/0 | none |
| restart-warp `--only=W,J` | 28/0 | 28/0 | none |
| wasm-adopt | 51/0 | 51/0 | plan lengths only: H N=145→141, P N=225→224, R L13 N=72→73 (all ON PLAN) |
| obstacle-events `--only=W,J` | 22/0 | 22/0 | none |
| wasm-generated-playback | 35/0 | 35/0 | P: 1 recovery → 2 recoveries before the planned failure (PASS both) |
| loop-restart | 30/0 | 30/0 | none |
| seal-delivery `--only=A` | 6/0 | 6/0 | none |

All 11 are ALL CHECKS PASSED in both arms (`probes-{off,on}/`). The adopt and playback differences are single samples
from live-seam plans, and I did not attribute them. A CI repeat on the flip branch should say whether they follow the keys
or the seam.

### Committed tapes and producer `--check`s

None move. The identity block's rows are equal BEFORE and AFTER (md5 `47648037`), including the six producer digests, and
the four producer reds are the base's own. OFF is byte-identical by construction: every new arm is behind its key.

## CI dispatches for the planner (I get 403 on `workflow_dispatch`)

All on branch `claude/seedling-fidelity-rulesref-a70wgx`.
1. **Survey A/B:** `seedling-survey.yml` with `--through=end --route=full`, once with
   `contact_fidelity=<the 85 default-ON keys>,spearBridgeVerb,fineFrontierFlood,punchGateTimed` and once at the defaults.
   Expect the six rows above. If the survey workflow takes no switch input, use a flip commit on a scratch branch.
2. **Keyed sweep ×2 per arm** (`seedling-divergence-sweep.yml`, `capture_requests=true`). The keys were derived at my base,
   with `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 918 legs:
   - bridge rooms L61/L63/L66/L93, 46 legs: `keys=` the contents of `sweep-keys-bridge.txt`;
   - puncher rooms L12/L26/L40/L53, 135 legs: `keys=` the contents of `sweep-keys-puncher.txt`;
   - ON arm: `contact_fidelity=<the 85 default-ON keys>,spearBridgeVerb,fineFrontierFlood,punchGateTimed`. ⚠ The input
     turns every unlisted key OFF. OFF arm: the 85 alone.
   - `fineFrontierFlood` is general (any frontier with no actionable entry, or any masked goal tile), so a **full sweep A/B**
     (no `keys=`) is the honest bound for it. Watch every `producer:walker` row too: none of my changes touch the walker.
3. **Probes:** `seedling-probe.yml battery=standard` on a scratch branch whose three defaults are flipped ON, against the
   same battery at the defaults.

## What the JS arc must wire

- A new **`SolverRefusal.obstacle` shape**: `{kind: 'solid', tag: 'bridge', id: 'bridge@tx,ty'}` (from
  `resolveBridgeStrategy` / `execBridge`). The kind is unchanged ("solid"); the tag and id are new.
- A new **verb record**: `{verb: 'bridge', target, bridge: {tx, ty}, dir, weapon: 'spear', slot, restoredSlot, from,
  pressTick, ticks}`. It selects the spear slot (`ctx.equip`) and restores it, as `burn` and the spear push do, so the
  solver's `equips` carry two rows per bridge (here t0 slot 3, t64 slot 0).
- No signature or contract change to `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`. No
  walker function was touched.

## Hand-overs

- **Hammer arc (D1).** With `punchGateTimed` ON, step 79's last refusal is inside `execKillByPress`'s dwell. It waits 166
  ticks for `puncher@136,96`, which the model keeps pinned at (115.6,119.4) (velocity non-zero, position fixed against the
  walls), 39.7 px from the player at (122.3,158.5). Two questions for the hammer arc: whether a pinned chaser that cannot
  reach the stance should be killed at all on that corridor, and whether the dwell should refuse earlier by name. Replay:
  survey step 79 with `SEEDLING_PUNCH_GATE_TIMED=1`.
- **Rules arc (D2).** Step 161's arrival (L63 (128,288)) is sealed hitlessly by `darktrap@128,272` (tag 4). The visit-2
  kill (step 157) lands 32 ticks before the door, and the trap's removal, which writes {63,4}, comes after it. Either the
  route waits out the removal in visit 2, or the region rule for that arrival needs the trap's clear.

## What the brief got wrong (measured)

- **D2 is not the spear block's gap.** The block is moved by the existing spear-thrust route (PUSHBLOCK, wave 11) once the
  room connects. The cut is the spear BRIDGE (2,9), a terrain tile the frontier dropped as a wall. FRONTIER3's
  *"moved by ANY weapon press"* is wrong for this class: a sword gives `spearDirection == -1`, and the committed
  `pushblock-l65-sword-press` control says so. The refusal is in **L63**, not L65 (survey step 161, the arrival (128,288)
  from L65's `teleporter@128,0`).
- **D3 also needs the bridge.** L66's arrival corridor is cut by a second spear bridge (7,9), so the doorway alone does not
  solve step 163.
- **D1: "no dodge policy" was not the whole gap.** The puncher here is pinned after one dash hit, and the game bills
  nothing beside it. The refusal was the gate's pad, and then the controller's diagonal tick.
- **W0's six `--check`s are not all green at the base.** battery, d2-chain, l18 and r9-campaign exit 1 at `1e17f44738`
  (detached worktree, idle box, same digests at my head). The planner should confirm on CI.

## Residue

- Step 161 ON ends on the TIME rung's pit-edge start tile (*"A* start tile (7,18) … pit"*). The text names the symptom,
  not the darktrap.
- Step 214 (L100) ON moves from a mask refusal to a rock-swing stance refusal (`breakablerock@128,144`). The 8 px frontier
  found a rock whose 16 px swing stances do not plan. That is a stance-lattice question for the break verb.

## Byte-inertia

OFF is byte-identical: the identity block's rows are equal (md5 `47648037`), the six producer digests are equal, and the
bounded AFTER set at the defaults is green. The tapeRunner pairs go 635 `88fc7df4` → **637 `9318088a`**; the only
difference is the new tape's two rows, both passing (`tape-runner-pairs-after.txt`). The only committed artifacts that move are additive: the witness tape and
its expectation, the chaser-witness fixture, the tape index, the roster pins (+1 by name), the surface census (+1 row, and
`bridgeTiles` now read by solverBot), the constants census (15 rows re-anchored, 0 new), the reference
(instruments/docsIndex counts), and the docs.

## Rows to BANK

- Roster **290** tapes (+`rulesref-l66-door`). Surface census **354** rows.
- The game witnesses: `rulesref-l66-door` (231 obs, 0 px) and `fixtures/chaser-witness/rulesref-d1-l53-stall` (201
  samples, 0 px, 0 hits).
- The survey movers above, as the ON arm's expectation for the CI A/B.

## Commits

- `e93a7141` D2: the bridge verb and the block route (`spearBridgeVerb`)
- `8d58bbd1` D3: the 8 px frontier flood and keylock cells (`fineFrontierFlood`), the witness producer, tape, expectation
  and roster pins
- `01752b89` D1: the timed gate and the axis-aligned departure (`punchGateTimed`), the chaser witness, the tests, the
  surface/constants censuses
- `a76be3cb` D2 records: `openBridges`' `solverReads` (`entityBlocks` + the surface doc)
- `c1743c86` tests: leg 579's OFF arm names its switches
- `5324f745` records: bot-log entry, `seedling-bot.md`, the reference regenerated
- the report and its evidence (this commit, the head)

**CI at `5324f745`** (`JavaScript Unit Tests`, run 40378649624): suite 23,066 / 23,067; slow battery 269 / 269. The one
red is `rosterCategories.test.js`' LIVE composite row (229 vs 230), the standing-values bank owed for the new tape (see
Bounded vitest). The report commit changes only `CC/docs/`.

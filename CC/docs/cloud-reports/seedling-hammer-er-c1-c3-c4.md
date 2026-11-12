# Cloud report: `seedling-hammer-er-c1-c3-c4`: three solver gaps the game allows

Planner: `seedling-hammer-phase-planning-6`. ⚖ Slice approved by the user on 2026-11-12 (the hammer replan). Landing it
still needs the user's own SHA-bound OK.

## 1. SHAs

- **Base:** `origin/hammer-stack-trio` = `83374e3de33ffe5f8ef1aa82f02f3d2dbc356511`. That is main `fe98f37f22` plus the
  YETI-TALK merge and the kill-lock flip (`KILLLOCK_CHASER_REWIND` and `KILLLOCK_LINE_STANCE` ON by default).
- **Branch:** `claude/seedling-solver-er-gaps-m6mwa5`.
- **Head:** the commit that carries this report (the trailer `Cloud-Slice: seedling-hammer-er-c1-c3-c4`). The code
  commits under it are `3e5da2f8` (c1), `aa3aec95` (c3) and `11adb942` (rows and census).
- Planner follow-ups received: none. No scheduled-trigger notification arrived during the slice.

## 2. The answer

| item | switch (lands OFF) | ON, measured |
|---|---|---|
| **c1** L12 chest, no Shield | `UNHELD_LOCK_NEXT_DOOR` (`SEEDLING_UNHELD_LOCK_NEXT_DOOR=1`) | **SOLVED, hitless.** Bare goal: 1,753 t, 0 hits. seedling_er survey step 84: REFUSED → **SOLVED 2,472 t, 0 hits**. **Game witness PASS** on wasm p4g (writes `12:4`, `12:2`, `12:9`, 1 seal, `12:10` never written) |
| **c3** L40 pit, Sword only | `CHASER_PASS` (`SEEDLING_CHASER_PASS=1`) | **Partial.** `puncher@128,624` is passed **hitless** (a 442-tick fork-certified prefix through via (216,680)). The leg still REFUSES after that, in the **bait arm**, on a corridor Bob that the room's kill region has already removed. That bait-arm defect is handed over (§9) |
| **c4** L99 lavarunner kill-lock | none (no build) | **Vanilla stop: solved by the base's defaults** (survey step 222, 477 t, 0 hits). The switch that reaches it is `KILLLOCK_CHASER_REWIND`, not `KILLLOCK_LINE_STANCE`. **The seedling_er stop is still REFUSED**: a *west* arrival, which in the model never reaches the lava the runners are pinned in. That is a rules/geometry question, unwitnessed (§9) |

**The one thing to know first:** c1 is done and the game confirms it. c3's pass works, but the leg will not solve
until the bait arm stops baiting a body that is already gone. The **same bait defect** also ends the L99 east
sword-only probe (§3.1). One fix there would move both.

Acceptance md5, OFF (both switches at their defaults): base `391322d681b7aa0229d94b3f6906d024` and head
`391322d681b7aa0229d94b3f6906d024`. Identical.

## 3. The reproduction (measured at the base, before any change)

Tools: `survey-seedling-route.mjs --through=end` (vanilla and `--preset=seedling_er`), plus a node driver over the
witness probe's own staging and solver call (`probe-seedling-er-landings.mjs`: `landingStaging` + `solveFrom` =
the survey's `twoPassSolve`).

### 3.1 c4 first

- **Vanilla survey step 222** (`L99 visit 1`, staged at L99 (96,112), goal `reach-exit (48,96)->L100`). The brief's
  "#216" sits at position 222 at this base.

  | switches | verdict |
  |---|---|
  | base defaults (REWIND ON, LINE_STANCE ON) | **SOLVED 477 t, 0 hits**, 3 passes; verbs `kill(lock@80,96)`, walk, `dodge(lavachain@80,64)`, walk |
  | both `=0` | REFUSED: *"kill: the count is still waiting on [lavarunner@192,64, lavarunner@160,32, lavarunner@176,64] and no stance derives"* (the old stop) |
  | `KILLLOCK_CHASER_REWIND=0` only (LINE_STANCE alone) | REFUSED (the same) |
  | `KILLLOCK_LINE_STANCE=0` only (REWIND alone) | **SOLVED 384 t, 0 hits** |

- **seedling_er survey step 39** (`L99 visit 1`, staged at L99 **(32,96)**, the L100 side; goal `reach-exit
  (112,112)->L16`; held: Sword, Green Key, 4 seals): **REFUSED on the base defaults** and with both switches `=0`.
  ON, the refusal is *"lavarunner@… is PINNED from here … it is a line stance's (KILLLOCK_LINE_STANCE)"* × 3, then
  *"at line stance (120,88)/(120,72)/(120,56): applied 4 strategies [kill(lock@80,96) ×4] and the corridor still does
  not plan"*. The line stances lie past the room's east side, and the walk to them needs the lock this kill opens.
- **Isolation in the model.** Node, post-sword latch, Sword only unless noted:

  | arrival → goal | held | verdict |
  |---|---|---|
  | west (32,96) → (112,112) | Sword | REFUSED 0.27 s (pinned, as above) |
  | west (32,96) → (112,112) | + vanilla's late kit | REFUSED 0.30 s (the same) |
  | east (96,112) → (48,96) | + late kit | **SOLVED 477 t** (the survey's answer) |
  | east (96,112) → (48,96) | Sword | REFUSED 55 s: *"bait (lavarunner@160,32): the dwell's condition (lavarunner@160,32 has left the world — the room's own kill region removed it) is ALREADY TRUE"* |

  A hand walk on the model from the west arrival stops at x ≈ 102 on y 88, and at x ≈ 71 on y 120. In the room's
  walkable map the lavarunners stand in lava tiles (cols 8–12), and the west pocket ends at the cliffside at tile
  (6,5). So from the west, no sword stance reaches a runner in the model.

### 3.2 c1

- seedling_er survey step 84 (`L12 visit 3`): REFUSED, *"apitem (320,816) contact -> touch: shieldlocknorm@288,704
  needs `Player.hasShield`, which this run does not hold"*.
- The probe's staging (L12 (16,80); Sword, Fire, Red Key), with the bare goal `collect-placement (320,816)`: REFUSED in
  **0.27 s**, *"chest (320,816) stance -> touch: shieldlocknorm@288,704 needs `Player.hasShield` … The item is a
  SUB-ORDER the macro layer owes"*.
- The same staging with the witness's three sub-goals: **SOLVED 1,754 t**; verbs `kill(puncher@416,256)`, walk,
  `burn(burnabletree@480,640)`, walk, walk, chest. This matches rules-6's numbers.

### 3.3 c3

- seedling_er survey step 50 (`L40 visit 1`): REFUSED, *"reach-pit (14,27)->L43: the combat ladder is EXHAUSTED …
  chaser:puncher@128,624 (inside leash 80 (d=7.8)…)"*.
- The probe's staging (L40 (320,592), Sword only): the same, in **6.4 s**. The kill arm's refusal is TIMING: *"20
  candidate(s) where puncher@128,624 outlives the ceiling or lands on the player first"*.
- **The two gaps, separated.** From the same boot holding the **Dark Sword**, the solver SOLVES in 660 t:
  `kill(puncher@128,624)`, then `narrow(bob@192,480)`. The witness's hand pass (down the stairs' column, west on row
  42, up column 8) replays on the model in 391 t with 0 hits. So the plain-Sword gap is the puncher's kill timing, and
  passing it costs nothing.

## 4. Design and change

### c1: `UNHELD_LOCK_NEXT_DOOR` (`solverBot.js`, on the solve worker's thread; no main-thread read)

**Where the order comes from.** No macro-layer change is needed. The frontier (`identifyAndSelect`) already ranks
actionable doors and re-floods after each order. The defect is that a door whose resolver answers `held: false` is
still returned as the round's order, and its verb then refuses. The fix is generic: ON, such a door is a wall for the
pick. The rest of the actionable frontier is resolved in order (`nextPastUnheldLock`, the L12KEYLINE
`nextPastSealedLock` shape), and the first door that binds (and is not `held: false` itself) becomes the order. Its
`rejected` row names the unheld door and its item. The loop's re-flood then derives the sub-goal order by itself.
Measured, L12: round 1 picks `keylock(bosslock@416,240)`; round 2 (t770), with the Shield lock still nearest, picks
`burn(burnabletree@480,640)`. That is exactly the logic's path. No level, coordinate or item name is read.

**The second hunk, same switch.** walkTo's `continue` after a frontier order also advances its `attempt` counter, so
two rounds left the chest-stance walk no re-plan. Its first drive refusal was then fatal: *"the re-planned corridor
failed too"*. The sub-goal run spends exactly one re-plan (`walk, walk, chest`). ON, the one re-plan is counted in
corridors driven and lost (`corridorsRefuted`), not in attempts. OFF, it is unread.

Hunks: the switch block after `SEALED_LOCK_NEXT_ON_FRONTIER`, `nextPastUnheldLock` after `nextPastReentry`, one call
site in `identifyAndSelect`, and the counter at walkTo's re-plan refusal. `solverEnvChannel` gains
`SEEDLING_UNHELD_LOCK_NEXT_DOOR`.

### c3: `CHASER_PASS` (`solverBot.js`, on the solve worker's thread)

**Pass, not kill.** The danger map prices a chaser as its leash, which is a bound and not a hit. ON, the ladder gets a
**last** rung, asked only where it would refuse EXHAUSTED and only when every danger source is a chaser. It never
shadows a cheaper rung. The candidates, in order:

1. the walk's own corridor;
2. one-via re-plans through the walkable tile centres within 96 px of a source body, farthest from the bodies first,
   at most 24 of them.

Each candidate is driven on the segment's fork (`fork`, the replay the crusher and lane rungs use), with the walk's
strike policy. It is admitted only if the fork takes **no hit** and **does not die**. A whole walk is replayed and
returned as `forced` (the arrow-lane shape). A one-via walk is admitted as a **prefix**: it is cut at the first
waypoint past the via where every passed body is beyond its own `aggro.range` + 16, replayed, and the walk re-plans
from there (the kill rung's world-edit return). A live replay that bills a hit the fork did not bill `fail`s by name.
The same re-plan counter as c1 applies when this switch is ON.

**Why a prefix.** Measured: the whole-walk candidates through the vias passed the puncher, and then the drive near the
pit fell into a *neighbouring* pit tile (14,30) on the way to (14,27). The drive's crossing-identity check refutes that
correctly (it is a different pit). A clearance-volume variant (re-plans keeping 64/48/40/32 px off the body) was tried
first and dropped: no plan keeps even 32 px. The room forces passing beside the body, as the witness does (8 px off in
column 8).

Hunks: the switch block, `chaserPassWalk` before `certifyLaneWalk`, the rung before the EXHAUSTED refusal, and the
counter condition. `solverEnvChannel` gains `SEEDLING_CHASER_PASS`.

### c4: no build

On the vanilla stop, the defaults already solve it (§3.1). On the ER stop, the line stances need the lock they would
open, and in the model the west pocket reaches no stance at all. A stance rung cannot fix that. It is a question for
the rules (§9).

### OFF identity

`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`: base `391322d681b7aa0229d94b3f6906d024`,
head `391322d681b7aa0229d94b3f6906d024`. Re-measured after each code commit.

## 5. Rows and bounded vitest runs

- `frontend/modules/seedlingDemo/hammerErGaps.test.js` (default tier, 4 tests, ≈15 s):
  - the switches (OFF by default, names in `SOLVER_ENV_NAMES`, the via bounds);
  - c1 OFF: the Shield-lock SUB-ORDER refusal;
  - c1 ON: the two rerouted orders, the six verbs and 1,753 ticks; **replayed on a fresh tape stepper**, 0 hits,
    writes `12:4` then `12:2`, no `12:10`, ending at the game witness's own (328.71104419062124, 834.5630671688936);
  - c3 OFF: EXHAUSTED on `puncher@128,624`, with no `pass` line.
- `frontend/modules/seedlingDemo/hammerErGaps.train.test.js` (train tier, ≈3 min): c3 ON. The only admitted pass is via
  (216,680), 442 ticks at t0; the walk's own corridor is hit at t265; the leg refuses in the bait arm on a Bob already
  gone; the refusal's first 442 ticks replay hitless on a fresh run.
- `frontend/modules/seedlingDemo/hammerErGapsLegs.js`: the shared staging/solve/replay helpers (the probe's own).
- **Bounded runs (by path):**
  - `npx vitest run frontend/modules/seedlingDemo/hammerErGaps.test.js`: 1 file, 4 tests, all pass.
  - Every non-slow/train/calib test file that names `SOLVER_ENV_NAMES` or the solver-surface census: 30 files,
    **380 tests, all pass** (`solverEnvChannel`, `seedlingSolverSurface`, `hammerNewLocks`, `hammerL53Killlock`,
    the procgenDocs pair, and 25 hammer/fidelity files).
  - `npx vitest run --config vitest.train.config.js frontend/modules/seedlingDemo/hammerErGaps.train.test.js`:
    1 file, 1 test, **passes** (291 s).
- **Regenerated, then checked:**
  - `census-seedling-solver-surface.mjs --write`, then `--check` GREEN (372 rows; the surface JSON moved by site
    counts only);
  - `generate-procgen-reference.mjs`, then `--check`: *ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH*;
  - `generate-docs-index.mjs`, then `--check` OK;
  - `census-seedling-constants.mjs --check`: PASS (0 new, 0 moved).
- Not run, by rule: the unfiltered vitest, `pytest`, `standing-values --write`, and any whole-game walk.

## 6. Game witness

**c1, ON, on the game.** `probe-seedling-er-landings.mjs` was run as a scratch copy with one change: the c1 tape is
solved from the **bare goal** with `SEEDLING_UNHELD_LOCK_NEXT_DOOR=1`, not from the three hand sub-goals. Its imports
were made absolute so it runs from the scratchpad. The tracked probe is unchanged. Run: `--only=c1-l12-chest
--no-model`, dev server `scripts/serve-nocache.py 8000`, wasm `seedling_bot_ap_p4g`, delivered set
`seedling-vanilla-record-5aeefc3c`, headless logic-only, under the box lock:

```
ROW {"tape":"c1-l12-chest", … "observations":1754, "held":{"items":["hasFire","hasSword"],"keys":[0]},
     "planVerbs":["kill(puncher@416,256)","walk","burn(burnabletree@480,640)","walk","walk","chest"],
     "levels":[12],"wrote":["12:2","12:4","12:9"],"maxHits":0,"seals":1,"respawns":0,
     "final":{"t":1753,"x":328.71104419062124,"y":834.5630671688936,"level":12}}
PASS: c1-l12-chest: the game ran the tape to its end on the delivered set — 1754 obs
PASS: c1-l12-chest: Sword, Fire, Red Key, no Shield: the Red Key lock opens, the tree burns, the chest gives its seal; the Shield lock is never written
ALL CHECKS PASSED
```

c3 has no game witness of the pass prefix on its own (the leg does not solve). c4 needed none (no build).

## 7. Census: which seed-1 divergence-sweep legs the change can move

The leg list was rebuilt at the base (`seedling-divergence-legs.mjs`: 936 legs). No full sweep ran here; that would
need the browser at 936 legs. The reasons below are mechanical:

- **`UNHELD_LOCK_NEXT_DOOR`** is asked only when the frontier's chosen door resolves `held: false`. OFF, such a leg
  ends in *"needs `Player.X`, which this run does not hold"* / *"SUB-ORDER"*. Seed-1's AP route holds the Shield at L12's
  chest leg (`level_12__r42c28 <- in_L83_32_64 -> location:Level 012 - Chest`, sphere 4.8: Sword, Red Key, Shield,
  Green Key, Fire), so c1's own door does not arise there. The legs it can move are those whose refusal today is that
  text. The seedling_er route is where it measurably moves: step 84.
- **`CHASER_PASS`** is asked only where a walk's ladder is EXHAUSTED with chaser-only sources. c3's leg at this base,
  re-derived by key after R-A5's re-key, is **`level_40__r26c13 <- in_L43_176_464 -> exit:out_pit_4_20`** (arrival
  (320,592), sphere 5.3). Its sibling `level_40__r26c13 <- in_L39_144_0 -> exit:out_pit_4_20` arrives at (480,896)
  and meets the same pocket only if its corridor does. Seed-1 holds the plain Sword there (Shield and Fire too), so
  the puncher's kill timing is the same as c3's. On those legs the switch can turn EXHAUSTED into the bait-arm refusal
  (§9) until that is fixed. The rules-6 fix gating three L40 edges on flag 12 is not on this base, so these keys may
  move again when it lands.
- c4: no change. The vanilla L99 legs (`level_99__r2c4 <- in_L100_48_96 -> exit:out_stairsup_48_96`,
  `level_99__r2c7 <- in_L98_112_112 -> exit:out_stairsdown_112_112`) do not walk the r2c7↔r2c4 link, which is a
  logical link and not a door leg.

## 8. What the brief got wrong (measured)

1. *"Question: does `KILLLOCK_LINE_STANCE` (now ON on the base) reach it?"* No, it is **`KILLLOCK_CHASER_REWIND`**.
   LINE_STANCE alone refuses; REWIND alone solves it (384 t); both together solve it in 477 t (§3.1).
2. *"vanilla survey #216"*: at this base the L99 visit is survey step **222** (route positions shift by base).
3. c4 is two stops, not one. The vanilla stop is solved by the defaults. The seedling_er stop is a **west** arrival
   (32,96), where the runners are out of any sword stance in the model. Its refusal is now the line-stance one, not
   "no stance derives".
4. c3 is two gaps, not one (as rules-6's report also says): the puncher, and the corridor Bobs. The brief's "pass rung
   vs a kill" covers the first. The second measured as a **bait-arm defect** (stale target), not a missing 3-hit
   stance. With the Dark Sword the Bob is taken by `narrow`.

## 9. Residue and hand-overs

- **The bait arm baits a body already removed (solver, next hammer slice).** The refusal is *"bait (bob@224,496): the
  dwell's condition (bob@224,496 has left the world — the room's own kill region removed it) is ALREADY TRUE before a
  tick is spent"*. Rows:
  - c3 ON: the node driver after the pass (173 s); survey step 50 ON at `--timeout=600`; the train row pins it.
  - L99 east (96,112) → (48,96), Sword only, base defaults: 55 s, `lavarunner@160,32`.

  In both, the target left the world by the room's kill region (a pit, lava) between choosing and dwelling. The
  generic fix is a world edit, re-plan, not a refusal. That fix then decides whether c3 solves outright. ER step 50 ON
  also needs more than the survey's 120 s bound today (TIMEOUT at 120 s), because of that arm's spend.
- **c4 seedling_er, a rules question (rules-6 / the ER planner).** The logic says `level_99__r2c4 -> level_99__r2c7` =
  Sword or Ghost Spear. In the model the west pocket (x ≤ ≈102 on row 5, the cliffside at (6,5)) reaches no sword stance
  on runners standing in lava. **UNWITNESSED in the game.** The witness asked for: from L99 (32,96) holding the Sword,
  can a player open `lock@80,96` (kill all three lavarunners)? If not, the rule needs `r2c7`'s side, or more.
- **c3 game witness:** owed once the leg solves (after the bait fix). Then the probe's c3 row can be re-pointed at the
  bare goal with `CHASER_PASS=1`, as c1's was here.
- No fidelity model, `botDriverV*`, flashPanel, rules, AS3, wasm or gitlink file was touched. The `solverBot.js` hunks
  are new functions and one call site each, plus the walk's re-plan counter line.
- Dev server: started by this slice on :8000 for the witness (none was running), and stopped by PID at the end.

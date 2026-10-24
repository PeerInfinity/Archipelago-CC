# Seedling fidelity ARROWLANE — an armed arrow lane, crossed and billed

| | |
|---|---|
| Slice | `seedling-fidelity-arrowlane`, wave 18 (model coverage), planner `seedling-fidelity-planning-8` |
| Start SHA | `d1fbfeffc2` (= main: wave 17 harvested OFF) |
| Head | `6def5fdedd` (code and records; this report is the commit after it) |
| Harness branch | `claude/seedling-fidelity-arrowlane-qwppaa` |
| Switch | `CONTACT_FIDELITY.arrowLaneCrossing`, **OFF** (`SEEDLING_ARROW_LANE_CROSSING=0\|1`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (built OFF, byte-identical; STOP for the flip) · D3 PASS (measured: a missing rung, not the forced-hit budget)** |

## The one thing to know first

**The lane stops refusing. The Bobs and the camera band are what refuse next.** With the switch ON, every L16 leg
that the armed lane refused now gets past the lane. Only **leg 210** goes from failed to solved: back down the stairs, 6
ticks, no hit. That is the game's own answer (D1 recorded it). The other 15 L16 legs that move still refuse, but now
for a new, named reason:

- **From L17 (8 legs: 209, 211–214, 216, 217; 215 now meets the pushable block, below).** The arrival stands inside
  the lane, so the volley at t6 is forced: every input that stays in the room takes it. The game bills it too, at t6, at
  0 px. After the hit, the camera band leaves `bob@192,80` or `bob@208,32` at the screen edge. `levelRun` then refuses
  to guess their on-screen state (⚖ cosmetic RNG). The arm refuses by name: `ARROWLANE … the model refuses to step it`.
- **From L15 (to the pits, 6 legs: 202–205, 207, 208).** The lane is no longer the wall. AVOID gets past `bob@48,96`
  through the lanes and then meets the Bobs that ring the pits (`bob@208,32`, `@192,80`, `@224,96`). With no weapon,
  no rung clears them (D3). Leg 201 (to the stairs) is certified on the fork and meets the camera band at t160.

The arm never runs ahead of a no-hit option. A **start** inside a lane is the only case it takes up front, because
OFF refuses there at the walk's gate before any rung runs. Otherwise it is the ladder's **last** rung, below PULL (a
sworded walk silences L16's lanes with the rope and takes no hit) and FORCED-HIT.
⚠ The first cut engaged up front for an aim inside a lane too. It cost survey steps 18, 26 and 37 (the rope's PULL,
pre-empted). The local survey caught it (planning-6's lesson); the shipped version moves none of the three.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `d1fbfeffc2` | `session_bootstrap.sh --seedling` → `READY`, node v22.22.0. Server PID 509 on port 9684; base worktree `/home/user/base-wt` (submodules symlinked), served on 9685 |
| CI baselines | `survey-seedling-shards.mjs --fetch=38926053841`; `gh run download 38926058850 -n divergence-merged` | both fetched; the 17 failing L16 legs confirmed by KEY (`evidence/legs/census-base.txt`) |
| identity block (venv on) | `SEEDLING_PORT=9685 bash scripts/procgen/identity-block.sh .` in the base worktree | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | the same block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `6b1bf15c`, all exit 0 |
| surface / constants | `census-seedling-solver-surface.mjs --check`, `census-seedling-constants.mjs --check` | GREEN 308 · PASS 6,000 |
| bounded vitest BEFORE | 208 files (`evidence/w0/bounded-files.txt`): the brief's standing list, CORRIDOR's 154, and every test naming `KNOWN_STRATEGY_VERBS`, `CONTACT_FIDELITY_KEYS`, `forcedHits`, `armedArrowTraps`, `arrowLane`, `climbLadder`, `walkTo` or `contactFidelity` | 6,409 passed / **2 red** / 10 skipped. Both reds are environment artifacts: `loopBlockBuilder` and `generated --check`. The cloud checkout lacks the non-Seedling submodules, so the substrate registry reads differently; the same 4 generated files differ at base |
| hammer workloads | RE's lab drivers (`evidence/hammer/`), normalized by RE's `norm.py` | staging A sword `82834f24`, ghost `fcac3f47`; legs 397 `b90f7720`, 414 `314c6324`; leg 108 (sword) `9e27846e`; L18 sweep `de6f6e4e`; C2's ghost staging `1ca7eed5` |

## The census — every armed-trap room

`evidence/legs/trap-levels.json`: arrow traps stand in L4, L5, L8, L16 and L67. Only **L16** (three, `shoot=1`) and
**L67** (`arrowtrap@48,48`, `shoot=1`) are armed from the first tick. L4, L5 and L8 are armed by a button.

- **Sweep legs in those rooms:** 33 by key (L4 4, L5 5, L8 4, L16 19, L67 1).
- **Survey steps:** 4 (L4), 5 (L5), 8 (L8), 18, 26, 37 (L16), 132 (L67).

## D1 — the game witness (PASS)

`probe-seedling-chaser-mobiles.mjs --class=Bob --player-hits --record` (p4f headless, port 9684). Each tape boots
`new Game(16, 112, 48)`, which is the arrival from L17, with sphere 0's items. Each witness also checks the room's
seven Bobs at every sample: 56, 56 and 45 comparisons, worst |Δ| 0.

| witness | keys | game | model |
|---|---|---|---|
| `arrowlane-l16-arrival-stand` | none ×7 | t6 `hits` 1, `hits_timer` 19, (120, 51.25) | the same; `playerHits` t6 `arrowtrap@112,32#0.1` |
| `arrowlane-l16-arrival-right` | right ×7 | t6 hit, knocked to (130.83653815843095, 53.33808913255339) | the same digits; t6 `#0.2` |
| `arrowlane-l16-arrival-down` | down ×6 | stairs to L17 at t6, (56, 56), no hit | the same |

**What the game admits with this inventory** (sphere 0: no sword, no shield):

- **A hit taken.** The volley that is already falling lands at t6 on any player who stays in the column. Arrows are not
  dodgeable (⚖), and this lane is not escapable either. The three lanes `[98,110)`, `[114,126)` and `[130,142)` leave
  4-px gaps, narrower than the player's box.
- **Leaving by the stairs** before the volley lands: leg 210.
- **Not available:** shield cover (`hasShield` false). Disarming needs the rope `rope@32,16` (tSet 0) struck by the
  player's attack (`Player.as:99` lists `Rope` among its hitables; `RopeStart.hit()` latches the group, and
  `activate XOR shootDefault` turns the three traps off). That needs a weapon, and the model already does it: the
  ladder's PULL rung (`execPull`, R9 slice L16), which survey steps 18, 26 and 37 use. **No new staging or obstacle
  field is needed for disarm**, so there is nothing to hand to the JS arc.

`fidelityArrowLane.test.js` replays all three witnesses at 0 px: the player's position, `hits`, `hits_timer` and the
Bobs.

## D2 — the crossing arm (PASS; built OFF)

**Change.** `arrowLaneCrossing.js` (new) and hooks inside `solverBot.solveSegment`:

- **Engagement (`laneCrossingFor`).** The arm engages only where the geometry forces a crossing. There are three cases:
  - `start`: the player's box is in an armed lane now;
  - `aim`: the aim's box is in an armed lane;
  - `separated`: the walk's own planner plans the aim without the lanes, and plans nothing with them forbidden.
- **Two refusal sites change:**
  1. **`walkToUnder`'s gate** (`refuseDanger` at the walk's start, `the danger map forbids (120,56) — arrowLane:…`).
     Only `start` engages here. The walk's exclusion becomes a `LaneCrossingExcept`, which sets aside the lanes and
     every arrow of their traps (`<trap>#<volley>.<i>`) from the gate, the corridor probe, every rung's certificate and
     AVOID's volumes.
  2. **The ladder's EXHAUSTED refusal.** A new last rung, `arrow-lane`, sits below FORCED-HIT. It handles `aim` and
     `separated`, and is never asked inside a walk that already engaged. It re-plans the corridor with the lanes set
     aside. Another danger on that corridor climbs one inner ladder with the same exclusion.
- **The certificate (`certifyLaneWalk`).** The corridor is driven on a fork (`fork()`, called as-is) exactly as the
  live drive drives it. It is undashed: `planSwordDash` is not asked for an engaged walk, so it is not called at all.
  The certificate is admitted only if all three hold:
  - every new `playerHits` row is an arrow of an engaged trap;
  - nothing dies;
  - the hits fit `FORCED_HITS`' budget (per crossing, per segment, `hitsMax − 1 − margin`).
  Anything else refuses by name: `ARROWLANE — the corridor crosses an ARMED lane (<why>: <lanes>; arrows are not
  dodged, they are billed) and the crossing is not admitted: <reason>`, with `obstacle: {kind: 'danger', id: <lane>}`.
- **The bill (`settleLaneWalk`).** The live drive (or, for the rung, the fork's keys replayed) must bill the fork's rows
  key for key. Otherwise it fails loudly (the fork is not this run). The segment's existing `forcedHits` gets a row
  `{candidate: 'arrow-lane', proof: {lane, lanes, ids}, billed, ticks, damage}`.
- **Shared tables, rows added only:**
  - `KNOWN_STRATEGY_VERBS` + `'arrow-lane'` (above `pace`, which MOVINGWAIT pins last);
  - `CONTACT_FIDELITY` + `arrowLaneCrossing` (last key);
  - `FAMILY_BLOCKS.armedArrowTraps.solverReads` + `arrowLaneCrossing` (and its doc table).

**Mutants** (predicted, then made by copy and restore, on `fidelityArrowLane.test.js`):

| mutant | predicted | result |
|---|---|---|
| M1 `LaneCrossingExcept.has` drops the arrow-prefix branch | the exclusion row red | caught: that row, **and** leg 211's row (its arrows climb the ladder) |
| M2 `admitLaneCrossing` drops the death check | the admission row red | caught |
| M3 the walk does not install the exclusion | the ON rows for legs 210 and 211 red (the gate refuses) | caught: both |

The files were restored and checked with `cmp`.

### The movers ON — sweep legs (node, `drivers/leg.mjs`, the sweep row's inventory and `seamTime`, matched by KEY)

**Head OFF equals base on all 33 armed-room legs. Head ON moves 16, all in L16:**

| leg (key, `level_16__r1c1 <- …`) | base | ON |
|---|---|---|
| 210 `in_L17_32_48 -> exit:out_stairsdown_112_64` | failed (gate: lane) | **solved, 6 t, `down` ×6, no hit** |
| 209, 211, 212, 213, 214, 216, 217 (`in_L17_32_48` → stairsup / pits) | failed (gate: lane) | refused `ARROWLANE … (start: arrowtrap@112,32) … the model refuses to step it — levelRun: whether bob bob@208,32 \| bob@192,80 is on screen at tick 7–8 depends on … Game.shake's jiggle` |
| 215 `in_L17_32_48 -> exit:out_pit_8_3` | failed (gate: lane) | refused: `no corridor … Obstacle: solid:pushableblock (pushableblock@256,80) … Strategy 'shove' failed` (= leg 206's wall, from the other door) |
| 201 `in_L15_144_16 -> exit:out_stairsdown_112_64` | failed (EXHAUSTED: `bob@48,96`; AVOID: goal tile in the lane) | refused `ARROWLANE … (aim: arrowtrap@112,32) … bob@176,16 … tick 160 … Game.shake` |
| 202, 203, 204, 205, 207, 208 (`in_L15_144_16` → pits) | failed (EXHAUSTED: `bob@48,96`) | failed (EXHAUSTED: the inner climb meets `bob@208,32` / `bob@192,80` at the pits; D3) |
| 200, 206, 218 | done / failed (shove) / done | unchanged |

L4 (4 legs), L5 (5), L8 (4) and L67 (1): **all unchanged ON.** Those rooms' traps are button-armed, or the walk never
enters the lane.

### The movers ON — the route survey (`survey-seedling-route.mjs --through=end --route=full --only=4,5,8,18,26,37,132`)

| step | OFF | ON |
|---|---|---|
| 4, 5, 8 (L4, L5, L8) | SOLVED 255 / 403 / 827 | = |
| 18, 26, 37 (L16, post-sword) | SOLVED 124 / 655 / 655 (PULL silences the lanes, 0 hits) | **=** (the rung sits below PULL) |
| 132 (L67, `bosskey@48,64` under `arrowtrap@48,48`) | REFUSED (EXHAUSTED; AVOID: goal tile in the lane) | REFUSED, new reason: `ARROWLANE (aim: arrowtrap@48,48) … the fork's drive is refuted — … waypoint 5 (56,152): not reached within 400 ticks; stalled at (200.37,135.63)`: the lane-free corridor's drive stalls, a walker/planner disagreement |

⚠ The rest of the survey cannot move. The switch acts only in a room whose `armedArrowTraps` is non-empty (an empty
room returns at `armedLanesOf`). The 7 steps above are every survey step in an armed-trap room.

### The movers ON — identity, producers, bounded vitest, hammer

| row | OFF (head) | ON |
|---|---|---|
| identity block | **= base on every row** | **= base except the ENEMY census** `36b59445 → 626fa69a`: its `arrowtrap@corridor` row stays REFUSED, and its reason moves from the ladder's EXHAUSTED refusal to `ARROWLANE …` (`evidence/w0/enemy-{off,on}.txt`) |
| six producer `--check`s | = base (exit 0, same md5) | **= base** (exit 0, same md5); no committed tape moves |
| bounded vitest (209 files) | before the fix: 4 red (the 2 artifacts + `contactFidelity` defaults pin + `entityBlocks` FAMILY_BLOCKS). Fixed in `ece6d862`. AFTER (head OFF): 6,763 passed, 1 red (`generated --check`, the environment artifact; `evidence/w0/vitest-after-off.txt`) | 6,755 passed, **7 red**: the 2 artifacts, the same 2 pins (now fixed), and **3 movers**, listed below |
| hammer (A sword / ghost, 397, 414, 108, L18 sweep, C2 ghost) | = base | **= base**: `82834f24 fcac3f47 b90f7720 314c6324 9e27846e de6f6e4e 1ca7eed5` |

**The 3 bounded reds ON** (each a pin of the refusal the arm replaces; none is a byte artifact of a tape):

1. **`fidelityF7` "CONTROL: without {16,0} the same leg still refuses, by the old name".** That control is the L16
   arrival from L17 at (120,56). ON it refuses `ARROWLANE … camera band` instead of at the gate.
2. **`solverBot.test` slice 10 "a REFUSED segment carries the queries".** The L15 → stairs climb from `r8-solve-10`'s
   pre-sword block. ON it ends in the `arrow-lane` rung's named refusal, not EXHAUSTED.
3. **`axeDodgeAskHook` "the default adds no field".** Any non-default switch set stamps the request's
   `contactFidelity`. This is an artifact of running the whole set with an env switch ON, and it clears once the
   default itself flips.

The flip owes those rows re-pins: pin F7's control and slice 10 OFF (their subject is the old refusal, not the lane),
plus the defaults pins (`contactFidelity.test.js`, `fidelityArrowLane.test.js`'s "ships OFF").

### STOP — the flip

`evidence/flip/arrowLaneCrossing-flip.patch` sets the default and its two pins. The movers are listed above. There
is **no `producer:walker` row**: the walker (`botDriverV2.drive`) is called through its existing signature, and none of
its code changed.

## D3 — `bob@48,96` and what blocks after the lane (PASS: measured; nothing to fix in this region)

From L15's arrival (40,72), ON:

- **The lane is no longer the wall.** AVOID's A* used to fail on the goal tile ("is not walkable: danger:arrowtrap@…").
  With the lanes set aside (the `arrow-lane` rung's inner climb), AVOID routes round `bob@48,96` and through the lanes.
  It then probes dangerous at (199.2,40.8): `bob@208,32` beside the pits. Legs 205 and 208 meet `bob@192,80`.
- **The forced-hit depth is not the wall; a rung is missing.** I lifted `FORCED_HITS.nodeBudget` 2,000 → 60,000 on leg
  202 (`evidence/d3/forced-hit-depth.txt`). Depth 3 then completes, and **all 46,656 three-tick prefixes are hitless (0
  leaves)**. No hit is forced from this state, so a larger budget proves nothing.
- **What would clear these Bobs** (sphere 0: no sword, no shield):
  - BAIT says no body's straight-line removal admits a corridor;
  - KILL has no weapon;
  - DETOUR finds no clean corridor within 2 vias (64 previews, its 500-leg plan bound spent).
- **The missing rung:** a priced body-contact crossing (a Bob's hit billed as an arrow is billed here), or the room's
  own weapon. L16's lanes kill Bobs, the way L5's do (`ARROW_KILL_PLAN`), so a "bait a chaser into an armed lane" arm
  would also work. Both are larger than this slice's region. **Queued, not built.**
- **Leg 201's** certificate meets the camera band at t160, after the arrow hit by the stairs.

## The survey/sweep rows this moves, and the dispatches to confirm them

- **Sweep A/B (no code edit):** `seedling-divergence-sweep.yml` on branch `claude/seedling-fidelity-arrowlane-qwppaa`.
  - **ON arm:** `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,arrowLaneCrossing`.
  - **OFF control:** the same without `arrowLaneCrossing` (or empty = the defaults).
  - **Expect:** key `level_16__r1c1 <- in_L17_32_48 -> exit:out_stairsdown_112_64` failed → done (6 t); the other 15
    L16 keys above still failed with the new reasons; nothing else moves beyond run noise. Repeat the L16 keys ×2.
- **Seam census on the L16 keys:** the same workflow with `capture_requests` + `seam_census=-3..3`. The 6-tick stairs
  exit races the t6 volley, so confirm that its answer does not flip with the arrival clock.
- **Survey A/B:** `seedling-survey.yml` has no `contact_fidelity` input, so it needs a scratch branch with
  `evidence/flip/arrowLaneCrossing-flip.patch` applied. Run `through=end`, `route=full`,
  `only=4,5,8,18,26,37,132`, `base_run=38926053841`. **Expect** = 38926053841 except step 132's refusal text.
- **The witness on CI (if wanted):** `seedling-probe.yml`, `probes=probe-seedling-chaser-mobiles.mjs`,
  `args=--class=Bob --player-hits --witness=arrowlane-l16-arrival-stand` (and `-right`, `-down`). Expect PASS, worst 0.

## The JS arc — pins that move, and what to wire

- **No contract change.** No new staging field, result field, `SolverRefusal.obstacle.kind` or `tapeFormat` change.
  The new refusals use `obstacle: {kind: 'danger', id: <trap>}`.
- **What moves ON:** the segment's existing optional `forcedHits` can now carry a row with
  `candidate: 'arrow-lane'` and `proof: {lane, lanes, ids}`, in place of the forced-hit rung's
  `{proven, depth, nodes, …}`. Any reader that assumes `proof.proven` should read `candidate` first.
- **Wiring:** `contact_fidelity=` carries the new key like the rest (`CONTACT_FIDELITY_KEYS` gained a last row).
- **Capture:** made at the defaults only.

## To the hammer arc

Information only; nothing in its region was edited:

- `planSwordDash` and `corridorDashRescue` are **not called** by the arm. An engaged lane walk is driven undashed.
- `fork()` is called as-is; its closure is untouched.
- The ARMED-lane volume that feeds `deriveRefuge` and the strike's transit safety is **unchanged**: the arm sets lanes
  aside only inside an engaged walk's own exclusion.
- All seven hammer workloads equal base, ON and OFF.

## Deltas

- `frontend/modules/seedlingDemo/arrowLaneCrossing.js` (new) and `fidelityArrowLane.test.js` (new, 10 rows).
- `solverBot.js`: the walk's start engagement, the undashed walk, the certificate and the bill, and the `arrow-lane`
  rung; all inert OFF.
- `contactFidelity.js` (+1 key), `decisionTrace.js` (+1 verb), `entityBlocks.js` (+1 reader) and their doc row.
- `seedling-solver-surface.json` rewritten (308 rows, GREEN).
- 3 witness fixtures: `fixtures/chaser-witness/arrowlane-l16-arrival-{stand,right,down}.json`.
- The log entry, and the docs index regenerated.
- No tape, no producer digest, no gitlink, no AS3, no wasm.

## What the brief got wrong (measured)

1. **"(a) The lane forbids the GOAL before any rung runs."** True for leg 201 (AVOID's A*: the stairs tile is in the
   lane). For the L17 legs (215 and the rest), the walk's **start** is in the lane: the player arrives at (120,56)
   inside `arrowtrap@112,32`'s lane, and the gate refuses before any rung.
2. **"the trap's activator (disarm)"** is the rope, and it needs a weapon. The model already disarms with it (PULL); no
   JS-arc field is needed.
3. **"the forced-hit search gave up at depth 3"** is not a budget wall: with the budget lifted, depth 3 is fully
   hitless (D3).
4. **"ArrowTrap.shoot drops 3 arrows every 10 ticks"**: the period is **11** (`ARROW_TRAP.volleyPeriodTicks`, already
   banked).

## Residue

- **The camera band after a forced arrow hit** is now L16's main wall (9 legs plus 201). From the L17 arrival every
  in-room input takes the t6 hit, and `bob@192,80` / `bob@208,32` sit inside the band
  (`evidence/d3/arrival-variants.txt`). ⚖ The jiggle's value is not modelled. A stance rule that keeps the Bobs out of
  the band is not reachable from this arrival.
- **The Bobs that ring the pits** (D3's missing rung: a priced body crossing, or an arrow-lane bait).
- **Step 132's stall** (L67): the lane-free corridor's drive stalls at (200.37,135.63). A walker/planner disagreement,
  not a lane fact.
- **The `separated` and `aim` checks use the danger map's own lane rect** (to the level's floor, with no cover). A lane
  cut short by cover may look like a separation it is not. The fork certificate is still the run's real arrows.
- **Environment:** the 4 generated reference files differ at base in this checkout (missing non-Seedling submodules).
  Only the docs index was regenerated here: `docsIndex.js` and the README region, kept selectively.

## Byte-inertia

OFF is byte-identical:

- the identity block (every row);
- the six `--check`s;
- 33/33 armed-room sweep legs in node (head OFF = base: ok, ticks, end, message);
- the 7 survey steps;
- the seven hammer workloads;
- the bounded vitest set, with no new red after `ece6d862`'s pins.

Survey OFF at head = CI 38926053841 on the 7 armed-room steps (verdict and ticks).

## Rows to BANK

- `contactFidelity` + `arrowLaneCrossing` (OFF).
- `KNOWN_STRATEGY_VERBS` + `arrow-lane`.
- `FAMILY_BLOCKS.armedArrowTraps` reader + `arrowLaneCrossing`.
- Witnesses `arrowlane-l16-arrival-{stand,right,down}`.
- Identity ON: ENEMY `626fa69a` (one row's reason). Everything else = base.
- Hammer answers = base.
- Trap candidates:
  - "an arrival inside an armed lane is a forced hit, and the hit's shake strands the room's edge bodies in the camera
    band";
  - "an arm that engages ahead of the ladder pre-empts a no-hit rung (PULL)": the local survey caught it.

# Seedling fidelity BEAMLANE — a corridor along a BeamTower's band rides the band-to-band lane at the towers' live y (`beamLaneWalk`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-beamlane` (planner `seedling-fidelity-planning-12`, wave 29) |
| Start SHA | `06eb406065` (= main `06eb406065`, FIREPUSH ON, 65 default-ON keys) |
| Code head | `2f5b8b9a` (CI `JavaScript Unit Tests` green: 22,696 / 0 failed, slow 268 / 268); the records and this report are the commits after it |
| Harness branch | `claude/seedling-beamlane-l107-ucd3ju` (nothing pushed elsewhere) |
| Port | 9733 (and 8000 for the probe battery, whose probes ignore `SEEDLING_PORT`) |
| Verdicts | **W0 PASS · D1 PASS behind `beamLaneWalk` (OFF) · D2 PASS (p4g, 0 px, 11/11 clocks) · D3 PASS (no other room moves; L103 has no lane, named) · Movers: STOP for a licence** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-beamlane-evidence/`; the fixture `frontend/modules/seedlingDemo/fixtures/beamlane-witness/cap785.jsonl.gz` |

## The one thing to know first

**ON, leg 785 solves at every arrival clock inside the first request's 640 units (93/93 clocks 5564..5656, 122–128 units;
OFF 0/61), and the solver's own plans reach L102 on the game at 0 px.** The lane is a STEERED WALK, not a search: one
preview per corridor, its aim read off the towers' live `y` each tick (the timeline `phaseHazardHit` already prices). No
other survey step or sweep leg moves. L103 is the brief's other beam corridor and it has no lane (its corridor runs inside
the band row and the space between its bands is Pit); ON it refuses where OFF does, with the lane's reason named.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `06eb406065`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9733 bash scripts/procgen/identity-block.sh .` at a pristine detached worktree of `06eb406065` (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `481b7a1c`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| generated set | in the block | NOT MEASURED in either tree: BEFORE refused by the box lock (my sweep held it); AFTER refused by the venv (playwright 1.56 vs the pin 1.63). Environmental, named |
| reference | in the block | 4 DIFFER: the known box artifact (registry/capabilities/two substrate regions) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **347** · PASS **6,911** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` from the vitest JSON (`evidence/tape-runner-pairs.txt`) | **635**, md5 **`e164838673a48b38ce187093c363edb2`** |
| bounded vitest BEFORE | 87 files at the worktree (`evidence/vitest-files.txt`: the brief's list + every test naming `previewWalk`, `phaseHazardHit`, `phaseHazardCanReach`, `PHASE_DODGE_RUNG`, `CONTACT_FIDELITY_KEYS`, `beamtower`/`BeamTower`, `phase-dodge`, + `tapeRunner`, `fidelityApBosses`) + `fidelityL32ArenaPrefix.slow` | **3,180 / 3,180**; slow **5 / 5** |
| the gap, reproduced | 785's request captured at THIS base (local sweep, p4g, inv, seam 5626; `--capture-requests`), replayed `--seam-time-sweep=-30..30` | request 0 (640): **0/61**; request 1 (2,560): **12/61** (5600..5611), 1,548 units each, the rest budget-out at `phase-dodge` — the brief's numbers. The js capture (`e8d85de8d1`) replays the same 12/61 here |

## D1 — the lane lever (PASS, behind `beamLaneWalk`, OFF)

`contactFidelity.js`: `beamLaneWalk` (OFF; `SEEDLING_BEAM_LANE_WALK=0|1`).

- **`dangerMap.phaseBeamTowerAt(run, h, clock, tick)`** — a tower at update `u = tick − V` of the visit, whether or not it
  fires: its pre-bob `y`, its side, its firing rect, and `band(d)` (side `d`'s rect at that `y`). Same ctor-at-V, same
  `Game.time` as `phaseHazardHit`'s timeline; `null` where that would widen by the bob (no visit clock, no `Game.time`).
- **`previewWalk`'s `steer`** (opt-in; `null` keeps every caller byte-identical): `(state, wp, tick, intermediate) => true | {x, y}`,
  asked once per transit tick — `true` = waypoint reached, a point = `chooseHeld`'s aim this tick.
- **`solverBot.beamLaneSteer`** — per tick, the horizontal bands (sides 0/2 the tower's `rate` visits) over the player's x,
  read at `tick + 1` (the update that tests the box this tick's keys move), split the column into open centre-y intervals
  (box `[y−2, y+3]`, inclusive tests: a band blocks `[top−3, bottom+2]`).
  - AIM: a waypoint within a band's REACH (zone ± `BEAM_BOB_SPAN`) is aimed into a BOUNDED lane beside it first, else the
    nearer side; others keep their own interval. An aim is taken only on FLOOR (`plannerObstacleAt`, every 4 px over the x
    span of the waypoint's incoming and outgoing legs); none → unsteered.
  - CROSSING: a band between the player's interval and the aim's is crossed only when it does not fire over the crossing
    (`BEAM_LANE_RUNG`: gate within 6 px, 0.6 px/tick + 2 ticks), else the aim holds the player in its interval.
- **The PHASE arm** (fidelity LADDER2's): when every reason is a beam tower's beam, ONE steered preview before the stall
  grid (one `phase-dodge` deadline ask, one preview counted). Certified by the same `probeSamples`. A lane whose only
  danger is a non-phase source on a walk no sample of which a beam hits (`hitsPhase`) is driven up to that danger and
  returned `partial` — the arm's own progress rule (L107: `crusher@32,0`'s sight lane in the exit shaft, which the OFF
  stall plans walk through the same way). A crossing before the corridor's last leg is refused; a crossing on it returns
  `{forced: {transition}}` (FORCEDHIT's shape: `walkTo` returns the arrival). Anything else falls through to the stall grid,
  and its reason is appended to the refusal (`…; and the band-to-band lane: …`). The dodge row carries `lane: {ticks,
  walked, towers}` (no `stall`).

**Measured** (`fidelityBeamLane.test.js`; `evidence/d1-census-i0.jsonl`, `-i1.jsonl`): 785's request at this base, ON:
request 0 **93/93** clocks 5564..5656 (the js range and mine) solve, **122–128 units** (dashless 18–21); request 1 the same
93/93. Every plan replays to L102 on the model with zero hits.

**Mutants** (predicted first; copy + restore; `evidence/mutants.txt`):
- M1 — no bob-reach widening in the aim: predicted the 5643 solve row fails (the measured 5643..5652 refusal) and the
  reach row may survive. **Killed as predicted** (5643 red; reach row green — the gate holds the lane there).
- M2 — the crossing gate always open: predicted ≥ 1 solve row fails. **Killed**: 5643, 5656.
- M3 — D3b's early-crossing guard removed: predicted ON ≠ OFF on 776's captured requests. **Survived** on every capture I
  hold (5591, 6846, 6839: ON ≡ OFF byte-identically over 63–501 clocks each): the failing B1/B2 runs were not captured,
  and request 0 at another seam does not reach the state they reached. The guard is held by the sweep (below), not a row.

## D2 — the game witness (PASS, p4g, 0 px)

`evidence/witness.mjs` (the js lane probe's game loop, verbatim, with the solver's own ON plan as the keys): per clock,
solve 785's request 0 ON, fold the plan into a tape (`buildStagedTape`, the request's staging), replay on the model and on the
game (p4g, headless logic-only, a fresh page per tape). At 11 clocks (5564, 5580, 5594, 5599, 5605, 5612, 5622, 5640, 5643,
5652, 5656): **44/44 checks** — work ≤ 640, the model reaches L102 with 0 hits, **the game reaches L102, its stream equal to
the model's (first differing row −1)** (`evidence/witness-785.txt`, `.json`). Re-run on the final code (`2f5b8b9a`): the
93 replayed answers are byte-identical, so the witnessed plans are the shipped ones.

## D3 — the other beam corridors (PASS: nothing else moves; L103 has no lane)

BeamTower rooms (atlas census): **L103** (`208,248` d2 r4 s0.25; `144,200` d0 r2 s0.5), **L104** (`16,56` r1), **L105**
(`48,40` r1), **L107** (the pair), **L108** (four, r4 s0.25).

- **L103, survey step 221.** No lane: the corridor (296,152)→(200,152)→(200,248)→(104,248)… runs INSIDE
  `beamtower@208,248`'s band row, and the space between its two bands is a Pit row. Measured cuts: the first fell into the
  Pit at (184,200) (aim checked at its ends only), the second cut across it after reaching (200,248) at the lane's y — hence
  the floor test over both legs. ON now refuses where OFF does (the beam at (103.0,247.5)), with *"and the band-to-band lane:
  the lane walk meets hazard:beamtower@208,248 … at (102.3,247.7)"*. The honest lever there is a timed pass ALONG the band
  (the stall grid's question), not a lane.
- **Leg 776 (L105)**, found by the sweep: see D3b in Movers.

## Movers (STOP for a licence)

**Route survey** (local, node; `--through=end --route=full --only=221,222,223,227,228` — every step in a BeamTower room, which
is the only place the arm can run: it needs every reason to be a beam tower's beam). OFF vs ON (`evidence/survey-*.json`):
221 REFUSED → REFUSED (text gains the lane clause), 222 SOLVED 261 t → same, 223 SOLVED 416 t → same, 227 REFUSED (crusher,
not a beam) → same, 228 REFUSED (lavatrap) → same. **0 verdict movers; 1 text mover (221).**

**Keyed sweep** (local, p4g, inv; the 18 legs of L103/L104/L105/L107/L108 derived at this base, `evidence/beam-leg-keys.txt`;
`--contact-fidelity` = the 65 default-ON keys (A) or those + `beamLaneWalk` (B)):

| leg | A1 | A2 | B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 |
|---|---|---|---|---|---|---|---|---|---|---|
| 785 `level_107 <- in_L108_0_32 -> 0_48` | F | F | **d** | **d** | **d** | **d** | **d** | **d** | **d** | **d** |
| 776 `level_105 <- in_L104_0_16 -> 80_144` | d | d | F | F | F | d | d | d | F | d |
| 788 `level_108__r11c8 <- in_L109_0_112` | F | d | F | F | F | d | F | F | F | F |
| the other 15 | = | = | = | = | = | = | = | = | = | = |

(B1–B2: D1 + D3; B3–B4: + the early-crossing refusal; B5–B8: the final code, `2f5b8b9a`.)
- **785: failed → done, every ON run.** The slice's target.
- **776: the D3b fix, then noise.** B1/B2 failed ON with *"…reach-exit toward (88,152) in level 104"* — the steered walk left
  by L105's arrival door; B3 with *"… in level 106"* — it crossed into L106 and kept planning L105's exit there. D3b: a
  lane walk truncated by a crossing before its corridor's last leg is refused, and a crossing on the last leg returns the
  transition (`forced`). On the final code B5/B6/B8 are done; **B7's failure is not the key**: its own captured request
  replayed in node answers ON ≡ OFF byte-identically (answer `09b270681e82`, trace `cff57895f2f3`, work 199: the arrival
  puts the player at (201.3,86.7) on a Pit tile, *"A* start tile (12,5) … is not walkable"*). 776's ON ≡ OFF also holds on
  B5's capture over 501 clocks (6439..6939).
- **788: arrival-build noise in both arms** (*"the model refused to build level 108 from the arrival"*).

**Probes, standard, ON** (local, the literal flipped in a scratch edit, restored; server on 8000): **11/11 ALL CHECKS
PASSED**, `arrival-composites` included (`evidence/probe-battery-standard-on.txt`).

**Bounded vitest ON** (`SEEDLING_BEAM_LANE_WALK=1`, the 88 files): **3,188 / 3,190**, the two reds are the defaults pins a
flip re-pins: `contactFidelity.test.js > the shipped defaults: all three ON` and `fidelityBeamLane.test.js > ships OFF`.
tapeRunner pairs 635 `e1648386` (= W0). Slow file ON 5 / 5.

**The CI dispatches to confirm** (planner):
1. `seedling-survey.yml` on `claude/seedling-beamlane-l107-ucd3ju`, `--through=end --route=full`, OFF and ON (ON: the env
   `SEEDLING_BEAM_LANE_WALK=1`, or the literal flipped on a scratch branch). Expect: one text mover, step 221.
2. `seedling-divergence-sweep.yml` on the branch, `keys=` the 18 keys in `evidence/beam-leg-keys.txt`, ×2 per arm:
   `contact_fidelity=` the 65 default-ON keys (A) and those + `beamLaneWalk` (B) — `evidence/cf-on.txt` holds B's list. Add
   `capture_requests` so a 776 failure can be replayed. Expect: 785 failed → done; nothing else key-driven.
3. `seedling-divergence-sweep.yml` full (all legs) A vs B, ×1 (the arm can only run in beam rooms, so this is the check of
   that claim).
4. `seedling-probe.yml battery=standard` with `beamLaneWalk` ON.

## The JS arc

- Nothing to wire: no staging/result field, no new `SolverRefusal.obstacle.kind`, no `run.*` field reshaped (the surface
  re-derive is site counts of existing members only: `run.gameTime`, `level`, `ticksCompleted`, `world`, `worldFor`).
- `previewWalk` gained an OPT-IN option (`steer`); `drive`/`chooseHeld`/`hasArrived` are untouched; `producer:walker` rows
  cannot move (the walker never passes `steer`).
- A flip re-pins `contactFidelity.test.js`'s defaults table and `fidelityBeamLane.test.js`'s "ships OFF" row (both listed
  above). No committed tape and no producer `--check` moves (the six `--check` md5s are identical OFF; the arm cannot run on
  a committed tape: none crosses a BeamTower room with the key on).

## Handed to the hammer arc

Nothing: no hammer function touched.

## What the brief got wrong (measured)

- *"L103 (survey step 221) … does the lane help?"* — No: L103 has no lane. Its walkable row IS the band row, the space
  between the bands is Pit. The lever there is a timed pass along the band.
- *"acceptance = 61/61 clocks solve inside 640 units on the replayed request"* — met with room: 93/93 at 122–128 units, so
  the 2,560 retry is never asked.
- The brief named the lane as a change to the PHASE arm only; the sweep showed the arm also needs a crossing contract (a
  steered walk can find another door), which the stall arm never needed because it drives only its stall prefix.

## Residue

- **The lane's floor test is the planner's** (`plannerObstacleAt`): what the planner calls floor. A lane over water a swim
  item allows is floor; nothing in the five rooms measures that.
- **The crossing gate's speed bound** (0.6 px/tick) is a conservative constant, not derived per state; the certification
  catches an under-estimate (it never certifies a hit), so a wrong bound costs a refusal, not a knock.
- **A lane walk that finishes all its waypoints without a crossing** returns through the stall arm's executor (`wps` from
  its last waypoint): the next drive to that waypoint is unsteered. Never reached in the five rooms (785's lane ends in the
  crusher partial; the others do not engage).
- **L103 refuses** (survey 221, sweep 768/771): the timed pass along `beamtower@208,248`'s band is the model work there.
- **776 / B7's arrival** puts the player on a Pit tile (A* start not walkable): an arrival-state refusal independent of
  this key, worth its own capture.
- `generated set` row unmeasured (environmental, both trees).

## Byte-inertia (OFF)

identity AFTER at `2f5b8b9a` = W0 on every measured row (`evidence/identity-after.txt`); censuses = W0 except the surface
(re-derived, `--write`, site counts only: 205,068 → 205,069 bytes, 347 rows; `evidence/censuses-after.txt`); tapeRunner pairs 635 `e1648386` = W0; bounded vitest AFTER **3,190 / 3,190**
(88 files: W0's 87 + `fidelityBeamLane`); slow 5 / 5; `generate-procgen-reference --check` = W0's 4 (after regenerating the
docs index for the bot-log entry). 785's OFF answers are those of W0's replay.

## Rows to BANK

- `fidelityBeamLane.test.js` (9 rows): ships OFF; OFF 640-unit budget-out at `phase-dodge`; ON at 6 clocks ≤ 640 and the
  plan reaches L102 with 0 hits on the model; the bob-reach aim at 5643 t229.
- The game witness: `evidence/witness.mjs` (11/11 clocks at 0 px), re-runnable at any head (`SEEDLING_PORT=… node …`).
- Trap candidates (in the bot-log entry): an accumulated bob makes the arrival clock a property of the whole visit; a
  waypoint free NOW can be in the band's reach later; a steered waypoint moves the next leg's start; a `crossed`
  truncation is an arrival only at the corridor's own end.

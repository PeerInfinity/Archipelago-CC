# Seedling fidelity PITPORT — a live teleporter on a Pit tile is crossed, not refused

Slice `seedling-fidelity-pitport`, wave 26 (model coverage after R7), planner `seedling-fidelity-planning-10`.

| | |
|---|---|
| Start SHA | `3ac4f7751d` (= main), as briefed |
| Harness branch | `claude/pit-teleporter-crossing-laurt0` (the brief's local name was not used; only the harness branch is pushed) |
| Commits | D2 `22429c71` · D1 `7b995f2c` · census/reference `f5e0f8fe` · records + this report (the head) |
| Dev server | `serve-nocache.py 9718` over the checkout; a pristine detached worktree at `3ac4f7751d` for every BEFORE; a third worktree at the head with the default flipped ON, served on 9719, for the game-side ON probe (never committed) |
| Switch | `CONTACT_FIDELITY.pitTeleporterCrossing`, **OFF** (`SEEDLING_PIT_TELEPORTER_CROSSING=0\|1` for node) |
| Verdicts | **W0 PASS · D1 PASS (six game witnesses, 0 px) · D2 PASS (switch OFF, byte-inert; STOP for the flip with the mover list below)** |

## The one thing to know first

**The game always takes a LIVE door over its Pit, and the model already agreed: only the walker's door lookup
refused.** `Teleporter.update()` has no fall guard and the doors update before the player, so a door fires on the
tick after the box first overlaps it; the pit edge's probe point lies inside the box, and each pit door is its own
tile, so the overlap can never come later than the edge. Six p4g witnesses (S, N, W, E, diagonal, and a shut control)
replay at 0 px with the switch either way. With the switch ON the lookup admits the door — and **no survey step
SOLVES yet**: each of the three refused steps (139, 159 at L43; 222 at L100) now refuses on the NEXT obstacle (a
fallrock, the wand pickup, the cliffsides). L58 after the Yeti's talk is admitted too, then stalls on a planner
defect (an A* edge clipping the Yeti's Solid by 0.07 px), handed over below.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `3ac4f7751d`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9718 bash scripts/procgen/identity-block.sh .` (venv on), on the base tree | log md5 **`e484c3b22d5c5b3940b1112e458a8a1b`** (= YETI's bank): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, killgate `7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | "4 GENERATED MODULE(S)/REGION(S) DIFFER" — the box artifact (no `bulletml-dodge` checkout), as YETI/WATCHERTALK named |
| surface / constants / entities / profile | each `--check` | GREEN **343** · PASS **6,894** · PASS **566** · PASS **138** |
| roster | `generate-tape-index.mjs --check` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` from a `--reporter=json` run of `tapeRunner.test.js` | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 103 files (below), base worktree | **3,781 passed, 5 skipped**; 2 files red = the box artifact (`seedlingGenRoomDoors`, `seedlingGenRoomReroll`: `../bulletml-dodge/src/game/tracks.js` missing / a duplicate maze registry) — red at the head too, not this slice's |
| route survey | `survey-seedling-route.mjs --through=end --route=full`, base worktree | **243 steps: 187 SOLVED / 52 REFUSED / 2 NO-EDGE / 2 NO-ARRIVAL** (my local baseline; the brief's CI baselines are 254 steps) |

The bounded set: the brief's standing list (`apReportBosses` has no file of that name: `fidelityApBosses` and
`fidelityApFlip`), plus every non-slow test naming `findExit`, `plannerObstacleAt`, `isWalkableTile`,
`unmodelled-pit-teleporter`, `pitTiles`, `exitAimFor`, `REFUSAL_BY_NAME`, `CONTACT_FIDELITY_KEYS`, the pit door's words
or the Yeti witnesses, plus `fidelityYeti`, `fidelityHousekeep`, `fidelityStepOff`, `tapeRunner`,
`seedlingSolverSurface`, `seedlingConstantsCensus`. AFTER adds `fidelityPitPort` (104 files). The list is
`/tmp`-local; its derivation is the sentence above.

### The order on the game (AS3 @ `ccdf189776`)

- `Teleporter.update()` (`Teleporter.as:89-118`): `checkDeactivated()`; a deactivated door returns; otherwise
  `collide("Player", x, y)` → `if (!playerTouching) FP.world = new Game(to, …)`. **No fall guard.** `playerTouching`
  is set only by `check()` (a new `Game`'s first frame: the arrival latch) and cleared when the box leaves.
- The player is added at `Game.as:2040`, the doors at `:2169`, and `addUpdate` prepends: **the doors update before
  the player**, testing the position the previous tick left.
- `Player.checkFallingInPit()` (`Player.as:745-771`): once `fallInPit`, 20 frames of `alpha -= 0.05`, then
  `FP.world = new Game(fallthrough…)` or `die()` → `restartLevel()` → `new Game(level, playerPosition)`.
- The pit edge reads `nearestToPoint("Tile", x, y + checkOffsetY)` (`checkOffsetY` = 1): a point INSIDE the 4x5 box
  `[x-2, x+2) × [y-2, y+3)`. Each pit door's 16x16 rect IS its tile. So the first tick the edge can see the pit is
  never earlier than the first tick the box overlaps the door, and the door, updating first, swaps the world while the
  fall (if it began that tick) still has 19 frames to go. Only a door that **cannot fire** loses: a shut one, or one
  the run arrived latched on.
- The JS physics already transcribes this order (`playerPhysicsV2.step` step 0); its own "a teleporter fired while a
  pit transport was in flight" throw is unreachable on these doors for the same geometric reason.

### The pit doors in the atlas (census, every level built)

| level | door | → | pit tile | tag | room | arrivals onto it |
|---|---|---|---|---|---|---|
| 43 (`Dungeon4/Boss.oel`) | `teleporter@144,64` | L37 | (9,4) | -1 | a 3x3 ring of floor; no fallthrough | none |
| 58 (`DeadBoss.oel`) | `teleporter@80,16` | L46 | (5,1) | 1 (the Yeti's; shut on a fresh room) | water but an island; no fallthrough | none |
| 100 (`Dungeon8/2.oel`) | `teleporter@288,96` | L101 | (18,6) | -1 | a 3x3 floor ring inside a field of pits; no fallthrough | none |

Exactly three, the same in the patched (delivered) document. No other teleporter rect overlaps any pit tile. No
room's door arrives on one (the step-off table's synthetic `43|144|64` / `100|288|96` rows are the only latched
starts).

## D1 — the game witnesses (PASS)

`scripts/procgen/probe-seedling-pit-doors.mjs` (box lock; headless logic-only; p4g; port 9718), staging
`r8-solve-11`'s block re-pointed at the room (as YETI staged L58); `--out` writes `fixtures/pitdoor-witness/`.
Run: `probe-seedling-pit-doors.mjs --host=http://localhost:9718 --out=…` → **ALL CHECKS PASSED** (18 checks).

| witness | approach | ticks | game | model |
|---|---|---|---|---|
| `l43-south` | the solver's own `reach-exit` (switch ON), L43 booted at the L40 stairs' arrival with tags 0/4/5 cleared (wand, lock, totem) | 370 | first on the door t359, **crosses to L37 t360** | 0 px every tick |
| `l43-north` | round the ring to (9,3), then DOWN onto the door | 422 | t411 → **t412** | 0 px |
| `l100-west` | the solver's `reach-exit`, booted at (10,6) in the door's corridor | 50 | t39 → **t40** | 0 px |
| `l100-east` | round the ring to (19,6), then LEFT onto it | 106 | t95 → **t96** | 0 px |
| `l58-east` | `{58,0}`/`{58,1}` cleared at the boot; up the island to (6,2), then DIAGONALLY (up-left, corner first) | 148 | t137 → **t138** | 0 px |
| `l58-shut-east` | the same walk with the door SHUT (no clears; up beside the Yeti) | 191 | **no crossing; the Pit takes the player, respawn t150** at (64,104) | 0 px |

With YETI's `talk` (straight up from the island, crosses t202) and `shut` (the Pit, respawn), every approach side and
both door states are witnessed. Every model replay is checked with the switch ON and OFF (`runTape` is the physics:
identical).

## D2 — the model and the walker (PASS; switch OFF, STOP for the flip)

**Change** (`22429c71`):
- `contactFidelity.js`: `pitTeleporterCrossing: false`, `SEEDLING_PIT_TELEPORTER_CROSSING=0|1`; the defaults pin row.
- `botDriverV2.js` (the walker, ⚠ JS-arc review):
  - new export `liveDoorPitTile(level, index)`: under the switch, the Pit tile under `teleporters[index]` when the door
    is LIVE and stands on its own pit tile; `null` otherwise (always `null` OFF);
  - `findExit(level, exit, { latched })`: the PIT throw is skipped for a live door the run is not latched on (the new
    optional third argument; the walker's leg loop passes `run.state.latched`). The DEACTIVATED throw is unchanged and
    comes first;
  - `plannerObstacleAt`'s pit arm skips `liveDoorPitTile(level, allowTeleporter)` — ONE tile, only while the plan's
    allowed exit is that door. L100's ring of pits stays forbidden.
- `solverBot.js`: `findExitNamed(level, exit, latched)` passes `run.state.latched`; its naming is unchanged, so a
  LATCHED pit door keeps `unmodelled-pit-teleporter` (the door cannot fire; the pit takes the player).
- `fidelityYeti.test.js`: the after-talk refusal row names `pitTeleporterCrossing: false` explicitly.

No new obstacle kind, no `REFUSAL_BY_NAME` row, no run field, no per-visit map (no digest question: the switch reads
the live `world.teleporters[i].deactivated` and `state.latched`, both already run state). No signature change to
`solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging`.

**Measured** (`fidelityPitPort.test.js`, 16 rows):

| case | OFF | ON |
|---|---|---|
| planner at L43's door centre, allowed exit = the door | `pit` | **null** |
| … allowed exit = the stairs, or none | `pit` | `pit` |
| L100: the door centre / (16,4) / (20,6) beside it | pit / pit / pit | **null** / pit / pit |
| L58 fresh build (door shut) | `pit` | `pit` (`liveDoorPitTile` null) |
| `l43-south` / `l100-west` / `l58-east` stagings, `reach-exit` | `unmodelled-pit-teleporter` | **SOLVED → L37 / L101 / L46**; L43's and L100's plan IS the witness tape, key for key; L58's is 98 t (YETI's `revisit` crossed at t98) |
| L58 shut (`l58-shut-east` staging) | DEACTIVATED | DEACTIVATED |
| latched on the L43 / L100 door | `unmodelled-pit-teleporter` | `unmodelled-pit-teleporter` |
| L58: the Yeti's talk then the door | `unmodelled-pit-teleporter` | talk, then **the walk stalls** at (56.83,55.93) on `yeti@56,56` (the next gap) |

**Mutants** (predicted first; copy and restore; `botDriverV2.js` md5 identical after):

| mutant | predicted | measured |
|---|---|---|
| M1: `liveDoorPitTile` ignores `deactivated` | 1 red (the planner row) | **1 red** |
| M2: the planner exemption removed (lookup admits, planner forbids) | 3–4 red | **4 red** (planner, ON solves, the L58 next-gap row, the producer row) |
| M3: the latch ignored | 1 red (the latched row) | **1 red** |
| M4: EVERY pit exempt when the allowed exit is a pit door | 1–3 red | **0 red — survived.** The planner row probed L43 only (one pit). Added the L100 ring rows → **1 red** |

## The movers (before → after) — and the CI dispatches

| surface | OFF (head) | ON |
|---|---|---|
| route survey, local, all 243 steps (`--through=end --route=full`) | not re-run at the head: the OFF path is the base's code (`liveDoorPitTile` returns null before any read, so every changed condition short-circuits) | **3 movers, all REFUSED → REFUSED (words):** step **139** (L43, wand + door): pit-teleporter → `no corridor … Obstacle: solid:fallrock (fallrock@176,384)` on the wand goal; step **159** (L43, skip totem + door): → `no corridor … pickup:wand (wand@144,224)`; step **222** (L100, booted at the L99 stairs): → `no corridor … pixelmask:cliffside0`. 0 verdict movers; 187/243 SOLVED both arms |
| survey steps 83/84/114/115 with `SEEDLING_TENTACLE_BEAST_FIGHT=1` | 84/115 REFUSED DEACTIVATED (no talk goal on main) | **the same** (the door is shut until a talk goal runs) |
| keyed sweep, every leg in a pit-door room: L43 409–434 (26), L58 496, L100 756 — `inv`, p4g, page-legs 1, local | solver ×1: **28/28 done** | solver ×1: **28/28 done, identical** (end, divergences, final position, plan lengths). Solver ×2: **28/28 done in all four runs**, identical. Walker ×2 (`producer=walker`): **15 crossed / 13 done in all four runs, verdicts identical leg by leg**; 7 wand legs (410, 418, 420, 422, 424, 432, 434) end a pixel or two apart in y between runs, WITHIN arm A as much as across arms (A-1 vs A-2, seam time 5395–5433), with identical plan lengths: run noise, 0 movers. No leg asks for a pit door (L43's legs are the region south of the lock; L58's goes back through the water door; L100's to the stairs) |
| wasm probe `arrival-composites --only=D`, the three pit/dead-door legs, on the game (9718 OFF / 9719 the head with the default flipped ON) | **ALL CHECKS PASSED** (all three `named`) | **2 FAIL — the movers:** `moved L43 pit door` (arrival (144,48)) and `moved L100 pit door` (arrival (288,80)) now **cross on plan** (6 t, `walk`, divergence null, → L37 / L101); `moved L58 dead door` stays `named` |
| committed tapes / tapeRunner | 635 pairs `88fc7df4…` | **635 pairs `88fc7df4…`** |
| six producer `--check`s | = W0 | **= W0 ON** (`SEEDLING_PIT_TELEPORTER_CROSSING=1`, all six md5-identical, exit 0) |
| identity block | AFTER (OFF, the head's code) log md5 **`e484c3b2…`** = W0, byte-identical (`diff` empty) | the six producers ON above |
| bounded vitest | **104 files: 3,798 passed, 0 failed tests** (the 2 box-artifact files as at base) | **2 red** (below) |

**Bounded vitest ON (`SEEDLING_PIT_TELEPORTER_CROSSING=1`): 3,793 passed, 2 red, 6 skipped** — the whole list for a
licence:
1. `contactFidelity` "the shipped defaults: all three ON" — the defaults pin read under the env override (the flip's
   to move).
2. `fidelityHousekeep` "survey step 113 (L43's door to L37): the teleporter on a pit tile" — staged from (176,448)
   with no clears, ON it refuses `pickup:wand` instead. The flip should re-stage the row with the switch OFF, or move
   it to a latched start (`fidelityPitPort`'s latched row is that case).
The skip is `fidelityPitPort`'s "ships OFF" row. `fidelityStepOff`'s `43|144|64` / `100|288|96` rows stay green ON
(latched starts keep the named refusal).

**Dispatches for the planner** (none was possible from this session):
1. **Survey** (`seedling-survey.yml`, `through=end route=full`) on a branch with the default `true`. Expected vs the
   same at OFF: the three wording movers (139/159/222 by this base's numbering; match by (level, goal, boot)), 0
   verdict movers.
2. **Sweep A/B** (`seedling-divergence-sweep.yml`, on this branch, `mode=inv producer=solver page=seedling_bot_ap_p4g
   page_legs=1`, ×2 each), `keys=` the 28 keys of legs 409–434, 496, 756 (derive at the base:
   `seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks`, the `level_43__*`,
   `level_58__*`, `level_100__*` rows):
   - A: default inputs;
   - B: `contact_fidelity=` the 47 default-ON keys **plus `pitTeleporterCrossing`** (48 keys).
   - Expected: 28/28 done both arms, ×2. Repeat with `producer=walker` for the walker rows.
3. **`seedling-probe.yml battery=standard`** on a branch with the default `true`. Expected: ONLY
   `probe-seedling-wasm-arrival-composites`' `moved L43 pit door` and `moved L100 pit door` go `named` → `cross`
   (measured above on the game); every other probe = OFF. The probe's two `expect: 'named'` rows are the re-pin
   (`expect: 'cross', producer: 'solver'`), and its header's sentence "which of trigger and pit edge wins is
   untranscribed" retires.

## The JS arc: what it must review and wire

- **Review (the walker):** `botDriverV2.findExit`'s new optional `{latched}`, `liveDoorPitTile`, and the one-line
  exemption in `plannerObstacleAt`'s pit arm. Every `producer:walker` sweep row in the pit-door rooms: **none moves** (28 legs ×2, A/B; verdicts identical; the seven wand legs' end-y wobble is within-arm noise). No walker leg asks for a pit door, and the exemption applies only while `allowTeleporter` IS a live pit door.
- **Pins that move at the flip:** `probe-seedling-wasm-arrival-composites.mjs` D's two pit-door rows (above).
- **Nothing to wire** for the solver path: `reach-exit` goals already name these doors. Note, read only: on the wasm
  engine the SHUT L58 door resolves through the runtime walker's pit fallback (`reach-pit (5,1)` → "the player fell
  into a pit … lethal floor"), a refusal by name either way; with the door LIVE it would be a door goal.
- No new staging field, result field or obstacle kind; no run field renamed or reshaped (`seedlingSkinRenderer` green).

## Handed over

- **The next gap at L58 (planner geometry; `planWaypoints`' region, hammer SP's memo — not edited).** After the
  Yeti's talk the solver plans `(56,56) → (72,56) → (88,24)` from the talk stance. The A* edge between the two clear
  tile centres (3,3) → (4,3) passes along y 56, where the box `[y-2, y+3)` reaches y 59 and `yeti@56,56`'s Solid starts
  at y 58: `plannerObstacleAt` says `solid` at (60..68, 56). `stringPull` never tests the segment between two
  consecutive A* nodes, so a sub-tile Solid straddling a tile boundary is crossed on paper; the walk holds `right`
  alone at y 55.93 (inside the dead band) and stalls 400 ticks ("the re-planned corridor failed too"). The same room
  booted with both flags cleared (no Yeti) SOLVES in 98 t. Fix belongs to whoever owns `planWaypoints`/`stringPull`
  (check consecutive-node segments, or grow the node test by the box) — it is a planner defect, not a game gap, and it
  will meet any sub-tile Solid on a tile boundary.
- The three ON survey refusals' new obstacles are not this slice's: L43's `fallrock@176,384` (step 139, the corridor
  south of the wand), the wand pickup as a corridor obstacle (step 159, the survey `skip`s the totem but not the wand),
  and L100's cliffside ledges from the L99 stairs (step 222).
- Nothing for the hammer arc: no escape-read state, no `stateDigest` change.

## What the brief got wrong (measured)

1. *"Steps 91/122 should move to SOLVED."* At this base the full survey has 243 steps; L58 is steps **84/115**, and
   both are NO-ARRIVAL (tentacle fight OFF). With `tentacleBeastFight` ON they refuse DEACTIVATED: there is **no Yeti
   talk goal on main**, so the door stays shut and nothing moves. With a talk goal they would reach the Yeti-Solid
   stall above, not SOLVED.
2. *"The physics throws on the conflict"* (the walker's own words, quoted by D1 of housekeep): the physics never
   reaches its throw on these doors — the door fires first on every approach (W0), and YETI's `talk` already crossed
   at 0 px. The refusal was planner-side only.
3. *"Witnesses in each room where it is reachable"*: L43's and L100's doors are not reachable on the survey route
   today (the obstacles above); the witnesses stage the rooms directly (clears at the boot for L43, a corridor boot
   for L100), which the game accepts.
4. L43 and L100's pit doors also appear in the **wasm probe battery** (`arrival-composites`), which the brief did not
   list: they are the only game-side movers.

## Residue

- The witnesses stage `r8-solve-11`'s block, not the route's inventory at each room; the rooms read no item on these
  walks (L100's flyer/jellyfish did not reach the player on either approach).
- No `seam_census` on the 28 legs: no leg asks for a pit door, and the switch changes nothing else.
- The latched pit-door start is a death loop on the game by the AS3 (`restartLevel` respawns on the door, latched),
  not witnessed: no real arrival lands on a pit door.
- The reference's four box-artifact rows read "differ" here, as at the base.

## Byte-inertia

OFF is byte-identical to the base: the identity block (`e484c3b2…`, AFTER = BEFORE), the six producers (and ON), the 635 tapeRunner pairs (and ON), the survey's 240
untouched rows ON, the 28 sweep legs; the censuses move by the new sites only (surface 343 rows,
site counts; constants 6,894 unchanged; entities 566; profile 138); instruments 461 → 462.

## Records

- Bot log: "Seedling fidelity PITPORT", with two trap candidates.
- Witness fixtures `fixtures/pitdoor-witness/pitdoor-{l43-south,l43-north,l100-west,l100-east,l58-east,l58-shut-east}.json`;
  instrument `probe-seedling-pit-doors.mjs` (box lock; on `boxLock.test`'s takers list).
- Surface census `--write` (343 rows); reference regenerated (instruments only; the four box-artifact regions left as
  committed). No tape index or roster change (289 tapes).

## CI at the last code head

`node scripts/procgen/ci-vitest-summary.mjs f5e0f8fe` (run 39878637838): **vitest 22,209 passed, 0 failed; slow battery 264/264.** The previous head `7b995f2c` (run 39872939435) had 26 reds: the surface census and instruments reference not yet rewritten — fixed by `f5e0f8fe`. The final commit (records + this report) is docs-only.

## Rows to BANK

- `pitTeleporterCrossing`: OFF. ON movers: survey 3 wording (139/159/222), 0 verdicts; sweep 28 pit-room legs 0;
  probes standard: `arrival-composites` D `moved L43 pit door` / `moved L100 pit door` `named` → `cross` (6 t); bounded
  vitest ON 2 reds (the defaults pin, housekeep's step-113 row).
- Game witnesses (p4g, 0 px): `pitdoor-l43-south` 370 t (crosses t360), `-l43-north` 422 t (t412), `-l100-west` 50 t
  (t40), `-l100-east` 106 t (t96), `-l58-east` 148 t (t138), `-l58-shut-east` 191 t (respawn t150).
- tapeRunner pairs: 635, md5 `88fc7df4dd05d11dfd84ebbea675cc8e` (unchanged, OFF and ON).
- Identity block: `e484c3b22d5c5b3940b1112e458a8a1b` (BEFORE = AFTER).
- Bounded vitest: 104 files / 3,798 OFF.

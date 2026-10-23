# Seedling fidelity DRILLKILL — the solver kills L28's drills first, then cuts the rope (`drillKillFirst`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-drillkill` (planner `seedling-fidelity-planning-10`, wave 26) |
| Start SHA | `3ac4f7751d` (main) |
| Code head | `332959b3` (D1b); the report and the regenerated docs index are the commits after it |
| Harness branch | `claude/seedling-drillkill-solver-o7cwaj` (nothing pushed elsewhere) |
| Port | 9717 (and 8000 for the probe battery, whose probes default to it — the same tree) |
| Verdicts | **W0 PASS · D1 PASS (5 p4g witnesses, 0 px) · D2 PASS behind `drillKillFirst` (OFF) · Movers: STOP for a licence (the list is below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-drillkill-evidence/` |

## The one thing to know first

**Fire cannot kill a drill — on the game, not just in the model.** `fire()` calls `genericHit(e, "Fire", fireForce,
fireDamage)`; `Enemy.hit` runs `if (hitByFire || t != "Fire")`, a `Drill`'s `hitByFire` is false (it never sets it), so only
`knockback` runs, and `Drill.knockback` is EMPTY. `fireDamage` is 0 besides. Witnessed on p4g (`drillkill-l28-fire-l26`): a
drill burned point-blank (8 px, inside the 32x32 flame on its hit frames) keeps `hits` 0. So rules-2's acceptance *"Spear and
Fire from both arrivals SOLVE"* cannot be met for **Fire from L26** by a kill. With the key ON:

| L28 rope cut (`clear-tag {28,0}`, `rope@160,64`) | OFF (= rules-2's measurement) | ON |
|---|---|---|
| Sword from L25 (104,24) | SOLVED 52 t | SOLVED 170 t — `drill@128,96` killed (north), then the cut |
| Spear from L25 | REFUSED (`drill@128,96` hop, t59) | **SOLVED 176 t** — `drill@128,96` killed (2 landings) |
| Fire from L25 | SOLVED 89 t | SOLVED 89 t, tick-identical (its walk wakes no drill) |
| Sword from L26 (24,104) | SOLVED 77 t | SOLVED 303 t — both drills killed (west) |
| Spear from L26 | REFUSED (`drill@80,96` hop, t31) | **SOLVED 265 t** — both drills killed |
| Fire from L26 | REFUSED (`drill@80,96` hop, t31) | **REFUSED**, the same refusal plus *"this run holds no weapon that kills a drill first: FIRE CANNOT …"* |

Fire with a held Spear or Sword (Fire selected) solves from both arrivals: the kill selects the weapon's slot (`equip`) and
restores Fire. Fire alone from L26 needs a *pass* (a timed walk past a drill that hops every 27 ticks), not a kill — see
Residue.

## W0 — the base (PASS)

**The game.** `Drill extends Enemy`: `hitsMax` 3, `hitsTimer` 30 per landing (`hitsTimerMax`), `knockback` EMPTY, `removed()`
overridden with its `dropCoins` commented out — **no persistence, no tag write, no `classCount` consequence in L28**: L28's
entities are `fallrock` (tset 1), `rope` (tset 1), `button` (tset 0) and `grasslock` (tset 0) — no `tset == -1` lock, so
`stageDrillKill`'s ledger never refuses there. Kill counts: `swordDamage` 1 → 3 landings; `spearDamage` 2 → 2. The hop
interplay that makes a kill safe: while `hitsTimer > 0` the drill plays "hit" and never hops; when the timer runs out it plays
"undrill" (12 ticks) before "sit", and only "sit" hops — so a landing each time the timer runs out locks it; and `hitPlayer` is
gated on `hitsTimer <= 0`, so a drill being hit never touches the player. A drill hops on an axis only when the player is more
than `Tile.w / 2` (8 px) away on it, so it always closes to an overlap unless it is struck.

| row | command | result |
|---|---|---|
| base | `git checkout -B … 3ac4f7751d`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9717 bash scripts/procgen/identity-block.sh .` (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER — the known box artifact (no `bulletml-dodge` checkout: registry, capabilities, two substrate regions) |
| surface / constants / entities / profile | each `--check` | GREEN **343** · PASS **6,894** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` (`evidence/tape-runner-pairs-before.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 89 files: the brief's list + every test naming `execClearTag`, `clearTagExecutor`, `CONTACT_FIDELITY_KEYS`, `drillMixedRooms`, `drillLive`, `execRopeCut`, `rope@160,64`, `run.drills`, `drills.bodies`, `ropeCutAnyWeapon` | **3,064 passed, 0 red** (`evidence/rows-before.txt`) |
| rules-2's L28 matrix, reproduced | `solveSegment` from `arrivalStaging` | exactly rules-2's six verdicts (the OFF column above) |

`apReportBosses` has no test file of that name (the bounded set uses `fidelityApBosses` / `fidelityApFlip`, as YETI did).

## D2 — the strategy (PASS, behind `drillKillFirst`, OFF)

`contactFidelity.js`: a new key `drillKillFirst` (OFF; `SEEDLING_DRILL_KILL_FIRST=0|1`). `solverBot.js`:

- **`execDrillKillsFirst`** — called by `execClearTag` for the `rope` verb, **before the stance walk** (the sword path's
  stance is walked by the caller, so the hook sits there, not in `execRope`). It asks which live stepped drills the PLANNED
  walk to the cut's stance (`resolved.stance`, else `approach[0]`) would wake (`runRange` 48, the masked "Solid" line), kills
  them nearest-first, re-asks, and stops (`DRILL_KILL.maxKills` 4). With no sword and no spear it kills nothing — the cut's own
  refusal stands, and `execRopeCut`'s drill wrapper now adds the Fire clause.
- **`drillKillStances`** — per side (north/south/west/east): the pre-stance **48 px out on the axis** (a tile centre; L28's
  upper hall is three tiles high, so a stance OUTSIDE the range, 56 px, does not exist above its drills — mutant k4); the lane
  (the cells the drill hops into and the creep's end) plannable floor; the drill's line to the creep's end clear; the walk to
  the pre-stance staying outside this drill's range until its end; and no OTHER drill woken by the walk, the stance or the
  creep (`wakeSlack` 2). Nearest walk first.
- **`execDrillKill`** — walk; settle; accept the drill either still asleep or one hop toward the stance on its axis (the
  arrival can wake it); **a face tap** if the walk's last correction turned the player (measured: the spear from L26, west of
  `drill@128,96`, the walker pressed "left" to undo its overshoot — mutant k2); select the weapon's slot; creep one key toward
  the drill until it hops; then a press whenever the drill is within 20 px on the axis, not "sit", the sword is out of its
  `slashTimer`, and the drill's `hitsTimer <= 1` at the start of the tick (it updates before the player — mutant k3); two
  unanswered presses refuse by name; then the removal waited out (the danger map prices a live body where it stands). Any
  player hit, any drill off its axis, a creep that does not wake it: a `SolverRefusal` with `obstacle: {kind: 'drill', id}`.
- The clear-tag's `done` record carries **`drillKills`** (`[{verb: 'drill-kill', drill, weapon, slot, side, preStance, hopAt,
  presses, killedAt, ticks}]`), on both the `verb` and the `cleared-in-passing` branches.
- **The run is read through its contract**: the `drillBodies` entities fold (`levelRun.drillBodiesNow`) gains `anim`, `hits`,
  `hitsTimer`, `destroy` (additive; `FAMILY_BLOCKS.drillBodies.solverReads` += `solverBot`, its doc table too). No new run
  state and no new per-visit map: `drillStates` keeps its `DIGEST_EXEMPT` row; `stateDigest*` untouched.

**Test** `fidelityDrillKill.test.js` (28 rows): the switch, W0's damage table (Fire never lands), the ON matrix, Fire L25
tick-identical, Fire L26's named refusal, the Fire+Spear `equip` row, the OFF matrix (rules-2's six), and D1's replays.

## D1 — the game witnesses (PASS; p4g, headless logic-only, 0 px)

`scripts/procgen/probe-seedling-drill-kill.mjs --record` → `fixtures/drillkill-witness/`; `fidelityDrillKill.test.js`
replays each against the model (key ON): the player (x, y, level, hits) and **every drill's x, y, anim, `hits` and
`hitsTimer`**, plus the bobsoldier, every tick. Output: `evidence/probe-record.txt`.

| witness | plan | game |
|---|---|---|
| `drillkill-l28-sword-l25` | the solver's (`twoPassSolve`, key ON): `drill@128,96` from the north, 3 landings (t59, t90, t121), then the cut | 174 ticks at 0 px; no player hit; one drill left; rope pulled |
| `drillkill-l28-spear-l25` | the same with the Spear: 2 landings (t88, t119) — the cut ROPESTANCE refused at t59 | 180 ticks at 0 px |
| `drillkill-l28-sword-l26` | both drills from the west, then the cut | 307 ticks at 0 px; no drill left |
| `drillkill-l28-spear-l26` | the same with the Spear | 269 ticks at 0 px |
| `drillkill-l28-fire-l26` | scripted: walk in, wake `drill@80,96`, Fire every 11 ticks (`useItem`'s `if (!firing)`) | 110 ticks at 0 px; the drill 8.05 px in front then 7.95 px behind on the flame's hit frames; its `hits` 0 and `hit_by_fire` false throughout |

The goal witnesses' replay rows also assert the solver still makes the recorded plan (`tape.inputs` equal).

**The spear rule.** SPEARRECT's `spearGameTest` is not on main (checked `origin/main` `9f051629`), so the spear witnesses
were checked against the base: the drill arm is DRILL's game rule (`spearTouchesDrill`: `int` origin, inclusive
`collideRect`, T+1/T+3/T+5, no reach gate, no line), the rope cut `runSpear`'s `presses.spearRect`. Both reproduce at 0 px.

**One model fix the witnesses found** — `endAnim`'s "die" case is `destroy = true; sprDrill.play("")`: the game's row reads
anim `""` through the fade, the model kept "die" (`drill.stepDrillGraphic`). Removal tick, position and every other field
already agreed. No model gate reads the name (`destroy` gates them), **but the L88 skin golden does**
(`seedlingRoomBodySkin.test.js > the drill-L88 tape: every tick's Drill ops`, `roombody-drill-L88.txt` — CI red at
`71ffeb2a`), so the transcription rides `drillKillFirst` (D1b, `332959b3`): OFF "die" as before, ON `""`.

## Mutants (predicted first; copy + edit + run + restore; all red)

| | mutant | predicted | measured |
|---|---|---|---|
| k1 | `execDrillKillsFirst` returns null | the ON Spear rows red | red (+ the Sword rows' kill lists, the Fire+Spear row) |
| k2 | no face tap | Spear from L26 reds (presses miss, named) | red — a superset: the L25 rows and the Fire+Spear row too |
| k3 | no `hitsTimer <= 1` gate on the press | the kill rows red (a press inside the i-frame does not land) | red (+ Fire+Spear) |
| k4 | `preStance` 56 | the L25 rows red (no stance above the drills) | red — a superset: the L26 rows too (a 56 px west stance of `drill@128,96` is where `drill@80,96` stood), and the pin |
| d1 | `play("")` reverted | the four kill witnesses red from the end of the death anim | red as predicted |

## The movers (ON) — before → after, and the dispatches to confirm

**Route survey, full (local, `survey-seedling-route.mjs --through=end --route=full --out=…`, OFF vs
`SEEDLING_DRILL_KILL_FIRST=1`):** 243 rows, SOLVED 187 / REFUSED 52 / NO-EDGE 2 / NO-ARRIVAL 2 both; **0 rows differ** (`ms`
stripped). The full route has **no L28 step** (`evidence/survey-full-{off,on}.txt`).

**Keyed sweep (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver`, the 8 L28 legs derived at the base
— `evidence/drillkill-leg-keys.txt`; arm A = the 47 defaults, arm B = the 47 + `drillKillFirst`, read off each log's stamp),
×2:**

| leg (key) | A1 | A2 | B1 | B2 |
|---|---|---|---|---|
| 289, 290, 292, 293, 295, 296 (L28 exits) | done | done | done | done |
| **291** `level_28__r0c6 <- in_L25_96_128 -> location:L28 flag 0: rope@160,64 cleared` | done, plan 52 t | done, 52 t | **done, 170 t** (verbs rope+walk) | **done, 170 t** |
| **294** `level_28__r0c6 <- in_L26_144_208 -> location:L28 flag 0: rope@160,64 cleared` | done, 77 t | done, 77 t | **done, 303 t** | **done, 303 t** |

Room hits on the game: 0 in every arm. B2 was cut by a worker restart at leg 291; 291 and 294 were re-run (`sweep-B2b`).
**0 verdict movers; 2 plan movers (291, 294: the kill-first plans), both legs played clean on the wasm.** The sphere
inventory holds the Sword, so the sweep exercises the Sword path; the Spear/Fire answers are the D2 matrix.

**Probes standard, ON (local; the literal flipped in a scratch edit, restored):** **11/11 ALL CHECKS PASSED**
(`evidence/probe-battery-standard-on.txt`), `arrival-composites` included.

**Bounded vitest, ON (the same flip; 90 files):** 3,093 tests, **7 red** (`evidence/rows-on.txt`) — the re-pins a flip owes:
1. `contactFidelity.test.js > the shipped defaults` — the defaults table.
2. `fidelityDrillKill.test.js > is OFF by default`.
3. `fidelityDrill.test.js > D3 … ON: the stance (136,72) is walked, and the cut refuses naming drill@128,96 at t59` — **a
   control on the old behaviour**: ON the Spear from L25 solves.
4. `fidelityDrill.test.js > D3 … ON: the Sword from the L25 arrival plans what OFF plans` — 52 → 170 t.
5. `fidelityRope.test.js > D2 … L28 from the L25 arrival: {28,0} cut, 52 t` — 170 t ON.
6. `fidelityRope.test.js > D1 … rope-l28-cut: the solver plans the recorded tape today` — the solver now plans the kill first;
   the recorded 52-t witness itself still replays at 0 px (it is a tape, not a plan).
7. `seedlingRoomBodySkin.test.js > the drill-L88 tape: every tick's Drill ops` — the `play("")` transcription; the golden's
   fading-drill rows read `""` ON.

No committed tape, no producer `--check`, no identity row moves (ON or OFF).

**Please run, on this branch:**
1. **Survey full**: `seedling-survey.yml` `through=end route=full`, defaults and `contact_fidelity=` the 47 defaults +
   `drillKillFirst`. Compare against **39496129402** by (level, goal, boot). Expected: 0 movers (no L28 step on the route).
2. **Keyed sweep ×2**: `seedling-divergence-sweep.yml` with `keys=` the 8 keys of `evidence/drillkill-leg-keys.txt`
   (`|`-separated), `capture_requests=true`, arm A `contact_fidelity=` the 47 defaults (read
   `formatContactFidelity(CONTACT_FIDELITY_DEFAULTS)` at the branch head), arm B the 47 + `drillKillFirst`. Expected: 291 and
   294 `done` both arms with plan ticks 52/77 → 170/303; the six exits unchanged. Add rules-2's L28 legs if they key them
   with Spear/Fire inventories.
3. **Probes**: `seedling-probe.yml battery=standard` with the key ON; and `seedling-probe.yml` running
   `probe-seedling-drill-kill.mjs` (5 witnesses).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched.
  **New `SolverRefusal.obstacle.kind`: `'drill'`** (`{kind: 'drill', id}`) for a refused kill; the rope wrapper's
  `{kind: 'solid', id, drill}` unchanged. **New optional record field** on a `rope` clear-tag's `done` row: `drillKills`.
- **`run.entities('drillBodies')` / `run.drillBodies`** rows gain `anim`, `hits`, `hitsTimer`, `destroy` (additive).
- **`run.drills.bodies[].anim`** of a dead (fading) drill reads `""` with the key ON (the game's), `"die"` OFF — the skin
  renderer's L88 golden reads it (`seedlingRoomBodySkin`); a flip re-pins that golden.
- The walker (`botDriverV2.*`) is untouched: no `producer:walker` row can move.

## Hand-overs

- **Nothing for the hammer arc**: none of its functions were edited (`execKillByPress`, the escape, `planWaypoints`,
  `stateDigest*`, the fork/rewind untouched; the kill is its own executor).
- **The model's Fire arm never registers a drill** (no `chaserPressHits` row when the flame covers one) — behaviourally the
  game's (a Fire hit on a drill changes nothing observable: empty `knockback`, no `hitsTimer`), so left as is; named.

## Deltas

- `contactFidelity.js` `drillKillFirst` (OFF); `solverBot.js` `DRILL_KILL`, `execDrillKillsFirst`, `drillKillStances`,
  `execDrillKill`, `drillKillWeapon`, the `execClearTag` hook and the Fire clause in `execRopeCut`; `levelRun.js`
  `drillBodiesNow` (+4 fields); `drill.js` (`play("")` behind the key); `entityBlocks.js`; `fidelityDrillKill.js` (+test);
  `probe-seedling-drill-kill.mjs` (boxLock roster row); 5 fixtures; censuses (surface 343, constants 6,894); the instruments
  and docs-index references (the four environmental substrate regions left as they are).

## What the brief got wrong (measured)

- **"every weapon can kill it" / "Spear and Fire from both arrivals SOLVE"** — Fire cannot kill a drill (`hitByFire` false,
  `fireDamage` 0; witnessed). Fire from L26 stays refused under any kill strategy.
- **"a drill KILL … drops `classCount(Drill)`, so a room whose `tset == -1` lock …"** — L28 has no such lock; a drill kill
  there writes nothing at all.
- **"the drills (tiles (5,6), (8,6)) … stances in a drill's 48 px run range"** — and the kill stance cannot be OUTSIDE the
  range either: L28's upper hall is three tiles high. The working stance is the range itself (48 px, a tile centre).
- **The witness "kill each drill … from the arrivals the rope legs use"** — from L25 only `drill@128,96` needs killing (the
  walk never wakes `drill@80,96`); the solver kills exactly the drills the walk wakes.

## Residue

- **Fire alone from L26** (`drill@80,96` between the arrival and every fire stance): needs a modelled PASS — the drill hops
  one tile per 27 ticks (15 "drill" + 12 "undrill") and the player is faster; the drill witness `drillkill-l28-fire-l26` even
  shows it hopping THROUGH a standing player without a contact. Not a kill; a queued planner row (or rules-2's call whether
  Fire alone should be in L28's rule).
- `corridorBodyPricing` (OFF) does not solve it either (measured: "the combat ladder is EXHAUSTED").
- The kill strategy runs for the `rope` verb only (the only clear-tag in a drill room); L91's legs 730/731 (DRILL's residue)
  are exits, untouched.

## Byte-inertia (OFF)

- **Identity at head equals W0 on every md5 row and all six producer `--check`s** (exit 0); the reference differs only by
  the environmental four plus the docs index's word counts, which the last commit regenerates.
- tapeRunner pairs 635 `88fc7df4…` (= W0); roster 289; surface GREEN 343; constants PASS 6,894; entities PASS 566; profile
  PASS 138.
- **Bounded vitest AFTER (default, 90 files): 3,093 passed, 0 red** = BEFORE (3,064) + `fidelityDrillKill` (28) + the
  added `seedlingRoomBodySkin` file's rows, nothing removed.
- The OFF L28 matrix is rules-2's, verdict and wording (pinned in `fidelityDrillKill.test.js`).

## CI

`JavaScript Unit Tests` at `71ffeb2a` (run 39875883486): **failure**, 2 reds — `seedlingRoomBodySkin`'s L88 golden (fixed by
D1b, the transcription behind the key) and `generated.test.js` (the docs index's word counts after my doc edits — the final
commit regenerates them; the gate shard's `procgen-reference` arm is the same red). The run at the final head is quoted in the
session's closing message.

## Rows to BANK

- W0: Fire cannot damage a drill (`hitByFire`, `fireDamage` 0); L28 has no kill-lock; Drill's `removed()` writes nothing.
- D1: five p4g witnesses at 0 px with drill `hits`/`hitsTimer` (`fixtures/drillkill-witness/`); mutants k1-k4, d1.
- Trap candidates (bot-log): a weapon that touches an enemy may not damage it — read the receiver's `hit()` gate, not the
  rules; a stance rule in px ("outside the range") can have no solution in a small room.
- Commits: D2 `8807aa7a`, D1 `072148f7`, D2b `71ffeb2a`, D1b `332959b3`, docs/evidence, this report.

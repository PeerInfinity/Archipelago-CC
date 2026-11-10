# Seedling fidelity DRILLWATER — a drill that hops onto water drowns (`drillTerrainSwitch`, OFF)

Wave 37e, planner `seedling-fidelity-planning-18`, session `seedling-fidelity-drillwater` (cloud, Opus).
⚖ user 2026-11-07: *"DRILL-WATER to fidelity"* → *"Launch now (Recommended)"*.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `0d575b78ea` (= origin/main, "train: sdc-embedded-rules-e3"; 114 default-ON of 125) |
| Head | D1 `8e5468bb`, D1 records `7e806288`, this report last (see `git log`) |
| Branch | `claude/seedling-fidelity-wave-37e-b4ptxg` (the harness's; the brief's local name `seedling-fidelity-drillwater` was not pushed) |
| Port | 9778 (head / flip tree), 9779 (scratch / pristine base) |
| Keys after | **126 keys, 114 default-ON**; the new key `drillTerrainSwitch` is last, OFF |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-drillwater-evidence/` |

## 2. Verdicts

| D | verdict | one line |
|---|---|---|
| W0 | done | 719 reproduced at base; L91 mapped; **only L91's drill can reach a fatal tile** (water, 4 hops); DRILL-EXIT-PASS has no branch, measured over the census's what-if as a stand-in |
| D1 | **PASS** | `stepDrill` runs `Enemy.update`'s terrain switch behind `drillTerrainSwitch` (OFF, byte-identical). p4g game witness `drillwater-l91-drown` (drowns t17, removed t27, hitless) + control `drillwater-l91-floor`, both 0 px ON; mutants m1–m3 red as predicted |
| D2 | **STOP by design (no arm needed)** | With DRILL-EXIT-PASS's wiring (stand-in) + D1 ON, **leg 719 is SOLVED on the game page: done, 223 t, 0 room hits, 0 divergences** (OFF: the DRILL D2 "not modelled" refusal). Hammer's timed pass already lures the drill into the water, so a separate bait arm would duplicate their rung inside their call site. At base alone 719 stays refused at the combat ladder, before any drill step: that gate is hammer's |
| D3 | **READY to flip, no tape / producer / skin / hammer pin moves** | flip tree (default ON): bounded fast 110/112 + 86 witness/extra files 85/86 — the reds are the two default-value rows a flip re-pins and one worktree artifact; slow 16/16; train §5; identity block + six producer `--check`s = OFF; drill-room page legs 21/21 identical |

**The one thing to know first:** 719's two gates belong to two arcs. Gate 1 is hammer's DRILL-EXIT-PASS: the timed pass
runs while a weapon is held, and the wake test plans with the door. Gate 2 is this row: the drill drowns. Neither alone
moves 719. Both together solve it on the game (measured over the census's what-if patch, since no DRILL-EXIT-PASS branch
exists yet). Flipping `drillTerrainSwitch` alone moves no measured row.

## 3. W0

**719 at base** (page sweep, `--page=seedling_bot_ap_p4g`, legs derived at the base: 930, `level_91 <- in_L92_32_144 ->
exit:out_teleporter_16_144` = id 719): `failed`, *"reach-exit (16,144)->L89: the combat ladder is EXHAUSTED. The corridor
passes through danger at (78.6,87.2) — enemy:drill@64,80 (a stepped drill, priced as a static box where it stands now
(72,88) …) — … bait: NO LIVE BODY's removal admits a corridor …"*. 718 is the same refusal, the other way
(`w0-page-718-719-base.tsv`). Node replay of the captured request: 20 work units, refusal digest `7b9eac5c5205`, the same
with the key ON (`w0-node-replay-719-base-key{0,1}.jsonl`). The ladder refuses before any drill is stepped, so the key
cannot reach it.

**L91** (`w0-l91-tilemap.txt`; census map `map-l91-719.txt`). `drill@64,80` stands at (72,88), cell (4,5), in the one-tile
west passage. The water cells are (24,120), (40,120), (8,136), (24,136), (40,136). The exit `teleporter@16,144` lies
beyond the water, so the swim is the route (the 5.6 inventory has `canSwim`). The hop's `collideTypes(solids, …)` walls
are the world solids plus the three bobs (all east). The hop path to the water is (72,88) → (56,104) → (40,120): two
diagonal hops, each x then y.

**Drill census** (`w0-drill-census.txt`; a BFS of 16 px axis hops over `world.collidesSolid` on the 10×10 box from each
placement, stopping at a fatal tile). Four drills ship:

| drill | hop reach | fatal tiles reachable |
|---|---|---|
| L28 `drill@80,96` | 52 cells | none (L28's pits at (168–216, 232–264) are outside it) |
| L28 `drill@128,96` | 52 | none |
| L88 `drill@128,160` | 133 | none (the room has no fatal tile) |
| L91 `drill@64,80` | 56 | **water (40,120) in 4 hops, (24,120) in 5** |

So **no lava or pit witness exists on a shipped drill (measured)**. The pit and lava arms are pinned by unit tests against
`Enemy.as`, line by line. The legs that touch these drills are the 21 drill-room legs (L28 292–299, L88 700–708, L91
717–720) and route-survey steps 84/117 (L88). The survey never enters L91; its L89 steps are 86/88/99.

**DRILL-EXIT-PASS:** `git ls-remote origin` shows no `*drill*` / `*exit-pass*` branch at 2026-11-07. I measured over the
census's `w1/whatif-drill.patch`, which has arms A and C hard-wired. A lets the exit timed pass run with a weapon held. C
plans the wake test's walk with the door and lifts the drill's own volume. The patch was applied to a SCRATCH worktree
only and is copied as `standin-whatif-drill.patch.txt` (never committed on a tracked path). Over it, with the key OFF, 719
reproduces the census's refusal exactly: *"drill@64,80 … hops onto tile type 1 at (40,120) on tick 211; `Enemy.update`'s
terrain switch … is not modelled for a drill"*. 718 is done, 190 t.

## 4. D1 — the model

**The game** (`vendor/seedling/src/Enemies/`):
- `Drill.as` overrides none of `dieInWater` / `dieInLava` / `canFallInPit` (`Enemy.as:33,39-40`, all true).
- `Drill.update`: `if (Game.freezeObjects) return; super.update();` FIRST, then the hop: `x = tox`, then `y = toy`, each
  behind `!collideTypes(solids, …)`, with "Enemy" in `solids`.
- `Enemy.update` (`:62-112`): the off-screen return, then `switch (getState())` (`:131-139`,
  `nearestToPoint("Tile", x, y).t`):
  - 1 Water → `destroy`;
  - 6 Pit → the `fallInPit` latch;
  - 17 Lava → `destroy`.
- Then the fall branch, `if (!destroy && fallInPit)`: the centring `/10`, `angle += fallSpinSpeed` (cosmetic RNG), `alpha
  -= 0.05`, and `destroy` + `fell` at ≤ 0. This branch replaces `super.update()`. Otherwise `super.update()` runs
  (`Mobile.death`: alpha −0.1, `World.remove` at ≤ 0), then `if (!destroy) { hitUpdate(); hitPlayer(); }`.

**The change** (all behind `CONTACT_FIDELITY.drillTerrainSwitch`, OFF):
- **`drill.js` `stepDrill`:**
  - The switch runs inside the existing on-screen block, from ctx `tileTypeAt(x, y)`, so it reads the cell the previous
    tick's hop landed on.
  - Water and lava set `destroy` (`terrainDeath: 'water'|'lava'`). A pit latches `fallInPit`, and the fall's own tick
    runs no fade, no `hitUpdate` and no `hitPlayer`.
  - Alpha is clamped at 0, as `Image.alpha` does. `fell` and `terrainDeath: 'pit'` are set at 0.
  - `Drill.update`'s tail is unchanged: a falling drill can still hop, as in the game.
  - New export `DRILL_TERRAIN`.
- **`levelRun.stepDrillsNow`** passes `tileTypeAt: base.tileTypeAt`, the run's `nearestWalkableTile(…, { openBridges })`.
  With the key ON, the DRILL D2 refusal ("terrain switch … not modelled for a drill") is retired. `drillEvents` gains
  `water` / `lava` / `pit` / `fall-start` rows (ON only). The corridor forecast's drill clones get `sctx.tileTypeAt`.
- **`levelRun.drillBodiesNow`** (`run.entities('drillBodies')`) carries `fallInPit`, `fell` and `terrainDeath` (ON only;
  OFF the row is unchanged).
- **`dangerMap.staticEnemyDanger`** skips a drill with a `terrainDeath` or `fallInPit` (ON only), because `destroy` gates
  `hitPlayer`. A sword-killed drill's die/fade pricing is DRILLKILL's and is untouched.
- **When the body stops counting:**
  - As "Enemy" to another drill's hop and to a chaser's wall, it counts until `removed` (`World.remove`), exactly as a
    killed drill: unchanged code, `drillEnemyBodiesTest` / `drillWallsNow`.
  - For the player's hit test it stops at once: `destroy` (water/lava), or the first fall tick (pit).
  - For the danger map it stops at the same tick as the hit test.
- `SEEDLING_DRILL_TERRAIN_SWITCH=0|1` is added to `SOLVER_ENV_NAMES`.
- **No new per-visit run map.** The fields live on the existing `drillStates` bodies (DIGEST_EXEMPT `UNREAD`, unchanged).
  ⚠ For the planner: `drillStates` is outside `stateDigestParts`, so an escape cache keyed on `stateDigest` cannot tell a
  drowning drill from a live one. It is the same exemption a killed drill already has, and not touched here.

**The game witness, first** (`scripts/procgen/probe-seedling-drill-water.mjs`, new; `fidelityDrillWater.js`; fixtures
`fixtures/drillwater-witness/`, p4g headless logic-only, :9778, recorded before the model was trusted):

| witness | tape | game | model (key ON) |
|---|---|---|---|
| `drillwater-l91-drown` (md5 `fe507cd1…`) | boot L91 (32,96), `canSwim`; greedy walk to (40,112), then (24,136), 60 t | hop (56,104) t1; hop **(40,120) WATER t16**; `destroy` **t17**; gone **t27**; hits [] | **0 px on 60 ticks**: player, drill x/y/anim/`destroy`, removal tick |
| `drillwater-l91-floor` (control, md5 `dc0717a4…`) | same boot, idle 40 t | hops onto floor (56,104) t1, (40,104) t16, stays, never `destroy`; hits t17, t37 | **0 px on 40 ticks** |

With the key OFF, the drown tape is refused by name at t16 (the DRILL D2 sentence). That is the row OFF pins.
`fidelityDrillWater.test.js` (12 rows) replays both recordings, the OFF refusal, and unit rows for water/lava (fade
schedule: removed on the 11th update, since 1 − 0.1×10 is 1.4e-16 in doubles), the pit (20 ticks to `fell`, removed the
next on-screen update, the latch holding off the pit cell), no contact while destroyed or falling, and the off-screen gate.

**Mutants** (predicted, then copy + edit + run + restore; `drill.js` md5 restored `070daa6c`):
- m1, the switch reads nothing: predicted drown red at t17. **Red, and 4 unit rows too** (they read the switch directly).
- m2, the switch reads the landing cell on the hop's own tick: predicted drown red at t16. **Red** (drown only).
- m3, `hitPlayer` without the `!destroy` gate: predicted no witness red, the unit red. **As predicted.**

**OFF byte-inertia** (head, the main checkout): identity block, every row identical to CEREMONYEXACT's published values,
which equal main's:

| row | value |
|---|---|
| maze | `57e07d21` |
| acceptance | **`abb206c88de25e7ba1874510d493ce85`** |
| c3 · c6 · c4 | `d356fc8a` · `483c791e` · `e83b066d` |
| ENEMY · guard · AREA | `87e86da9` · `a6d18d49` · `02b22525` |
| killgate | `7c15ed57` / `47116405` / `4d3bbf17` |
| levels | `e28c1e5d` / `fb1a59e5` |
| generated set | OK |
| producers | `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0 |
| reference | MATCH |

Bounded fast vitest OFF: 112 files, 2731/2733 before the records. The two reds were the new probe's `boxLock` row and the
surface census; both are records, now written. CI at `7e806288`: **25850/25850 passed**, slow 439/439. CI at `8e5468bb`
had named 5 reds, all records this slice owed (§9).

## 5. D3 — the flip measured (a worktree with the default set `true`)

| gate | result |
|---|---|
| bounded fast set (the brief's list + every `grep -a` hit, 112 files) | **110/112, 2731/2733.** Reds: `contactFidelity.test.js` "the shipped defaults" and `fidelityDrillWater.test.js` "ships OFF". These are the two rows a flip re-pins. Green: `fidelityDrill`, `fidelityDrillKill`, `dangerMap`, `entityBlocks`, `seedlingRoomBodySkin` (the `roombody-drill-L88` golden), `dashShape`, `dashOnlyWindow`, `jsRuntimeSolverShouldStop`, `levelRunStateDigest`, `levelRunDigestRead`, `solverEnvChannel`, `r8Acceptance`, the roster pins |
| every other test that reads a `fixtures/*-witness/` dir, plus the key-order pins and the constants census (86 files) | **85/86.** The red is `procgenDocs/generated.test.js`: `registerBackend: duplicate id 'empty'`, the known worktree artifact from the symlinked `shared` submodule. In the main checkout with the key ON it is 55/55, and `generate-procgen-reference --check` MATCHES |
| slow (5 files: `fidelityL32ArenaPrefix` + every `.slow.` that reads a witness or a drill) | **16/16** |
| train (`fidelityL40Bk2` + every `.train.` that reads a witness or a drill: 6 hammer pins) | **7/7 files, 21/21 tests** (§5a) |
| identity block + six producer `--check`s | **identical to OFF on every row** (acceptance `abb206c8`). The first flip run's `generated set` row needed the venv in the worktree; it was re-run with the primary's venv (§5a) |
| `ci-producer-checks.mjs --jobs=3` | **97 run / 0 red / 1 skipped** |
| page mini-sweep, every leg in the drill rooms (21: 292–299, 700–708, 717–720), pristine base vs flip | **21/21 identical** (end, ticks, room hits, divergences; `d3-page-drill-rooms-{base,flip}.tsv`) |
| local route survey, the drill-room and L89 steps 84, 86, 88, 99, 117 (the survey never enters L91), OFF vs ON | **identical** (rows md5 `1a2cad6b…` both arms; 84 SOLVED 476 t, 86 REFUSED, 88 SOLVED 291 t, 99 SOLVED 135 t, 117 REFUSED) |
| `seedlingDerivedRuleTable.js --print-engine-closure` ∩ diff | not measured: the brief's path `frontend/modules/seedlingDemo/seedlingDerivedRuleTable.js` does not exist at the base (§10). The diff's model files are `drill.js`, `levelRun.js`, `dangerMap.js`, `contactFidelity.js` |

**What a flip owes:** the default, plus two re-pins (`contactFidelity.test.js` defaults, `fidelityDrillWater.test.js`
"ships OFF"). No committed tape, game witness, producer digest or skin golden moves. No hammer pin moves (the train tier is green ON).

### 5a. Late rows

All three were measured in the flip tree at `7e806288` with the default set `true`:

| gate | result |
|---|---|
| train (`fidelityL40Bk2` + `hammerGhostKillRung`, `hammerIceTurretStatic`, `hammerLatchWeigh`, `hammerSouthDoor`, `hammerSpinnerPress`, `hammerTurretApproach`) | **7/7 files, 21/21 tests**: no hammer pin moves |
| identity block (re-run with the primary's venv) | rc 0. `generated set` OK, and every hash row equals OFF (`identity-flip-on.txt`) |
| `ci-producer-checks.mjs --jobs=3` | **97 run / 0 red / 1 skipped** (`plan-seedling-r7-ends-meet`, a CI browser arm; `producers-flip-on.txt`) |

## 6. The rows this moves (before → after)

| row | base | key ON alone | key ON + DRILL-EXIT-PASS (stand-in) |
|---|---|---|---|
| sweep 719 `level_91 <- in_L92_32_144 -> exit:out_teleporter_16_144` | failed (ladder, `drill@64,80`) | failed, the same (page + node) | **done, 223 t, 0 room hits, 0 divs (page)**; node SOLVED 223 t, both passes, 30 units |
| sweep 718 `level_91 <- in_L89_208_0 -> exit:out_teleporter_240_48` | failed | failed | done 190 t, both arms (hammer's alone) |
| sweep 717, 720, the L28 / L88 legs | — | identical (21/21) | not measured |
| survey | — | no mover on the steps that can reach a drill | — |

**Dispatches for the planner** (cloud sessions cannot dispatch). The arms are in the evidence: `contact-fidelity-off-arm.txt`
is the base's 114 default-ON keys, comma-joined, built fresh from the base's `CONTACT_FIDELITY_DEFAULTS`;
`contact-fidelity-on-arm.txt` is the same plus `drillTerrainSwitch`.
1. `seedling-survey.yml`, branch `claude/seedling-fidelity-wave-37e-b4ptxg`, `--through=end --route=full`, both arms:
   OFF = the default; ON = `SEEDLING_DRILL_TERRAIN_SWITCH=1`, or `contact_fidelity=<on-arm>` where the workflow takes it.
   Predicted: no mover.
2. `seedling-divergence-sweep.yml`, the same branch, the full sweep ×2 per arm: `contact_fidelity=<off-arm>` and
   `contact_fidelity=<on-arm>`. Predicted: no mover. Then keyed ×2 with `capture_requests`:
   `keys=level_91 <- in_L89_208_0 -> exit:out_teleporter_16_144|level_91 <- in_L89_208_0 -> exit:out_teleporter_240_48|level_91 <- in_L92_32_144 -> exit:out_teleporter_16_144|level_91 <- in_L92_32_144 -> exit:out_teleporter_240_48`.
3. `seedling-probe.yml battery=standard` at the branch, both arms (not run locally).
4. **Once DRILL-EXIT-PASS lands:** the same keyed sweep on a merge of the two with the ON arm. Predicted 719 done ~223 t,
   hitless, from the stand-in.

## 7. Boundaries, hand-overs, the JS arc

- **hammer-3 (DRILL-EXIT-PASS):** nothing of theirs was edited. Their gating and the wake planner call were measured only
  through the census's what-if. ⚠ **When their slice lands, 719 needs `drillTerrainSwitch` ON to move.** Without it their
  timed pass hits the DRILL D2 refusal by name on 719, as the census measured. Their 718 is independent of this key. No
  hammer pin is listed as moving (the train rows: §5a).
- **JS arc:**
  - No contract change: `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched.
  - No `SolverRefusal.obstacle.kind` was added.
  - `run.entities('drillBodies')` rows gain `fallInPit`, `fell` and `terrainDeath`, ON only. The skin reads drill bodies
    (`seedlingRoomBodySkin`); its golden is green ON.
  - The walker (`botDriverV2`) is untouched, so no `producer:walker` row is expected to move.
- **Not touched:** AS3, wasm, gitlinks, rules, any committed tape or producer digest, `stateDigest(Parts)`, the escape,
  `planWaypoints`, `drillMixedRooms` / `drillKillFirst` / `drillTimedPassExit` behaviour (their tapes are green ON, so
  nothing moves), the `FROZEN_TICK_PRESS` throws, `REFUSAL_BY_NAME`.

## 8. Deltas, residue, rows to BANK

- **Residue:**
  - L91 is the only shipped drill with a fatal tile in reach, so the pit and lava arms have unit pins but no game witness.
  - `drillStates` is outside the state digest (pre-existing).
  - The bait arm itself is not built (D2). If DRILL-EXIT-PASS does not land, a bait arm would sit at the exit rung, in
    hammer's call site, and would be a hand-over, not this arc's.
- **BANK:**
  - The two witnesses.
  - The drill census: L91 only, water at 4 hops.
  - 719 = hammer gate + this row: page done 223 t, 0 hits, on the stand-in.
  - OFF identity at `0d575b78ea`, unchanged.
- **Trap candidate:**
  - A new key at the END of the defaults reds every test that pins "my keys are last" or "only these keys follow mine".
    At this base those are `fidelityCeremony126` and `fidelityFrozenPress`. Grep `slice(-2)` / `indexOf('<key>') + 1` in
    `fidelity*.test.js` before pushing a new key.
  - `generate-procgen-reference --check` passes locally while a new `scripts/procgen/*.mjs` is still UNTRACKED (the
    instruments index reads the tracked listing): run it after `git add`.

## 9. What the brief got wrong (measured)

- **"D2 (the solver): a drill-bait arm".** None is needed for 719. Hammer's exit timed pass, once its weapon gate and
  wake-planner door are wired, already walks the route on which the drill follows the player into the water. Only the
  model was missing.
- **"`seedlingDerivedRuleTable.js --print-engine-closure`".** No such file at `frontend/modules/seedlingDemo/` at the
  base.
- **"110 ON of 122" (the CONTACT_FIDELITY paragraph).** At the base it is 114 ON of 125, as the brief's own header says.
- **My own miss, corrected:** the first push (`8e5468bb`) went red in CI on 5 records outside my bounded set: the
  reference regen, the constants classification, and two key-order pins. They are fixed in `7e806288`, and CI there is
  green.

## 10. Commands

- Witness: `SEEDLING_PORT=9778 node scripts/procgen/probe-seedling-drill-water.mjs [--record] [--dump=14-30]`.
- Legs: `node scripts/procgen/seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks`.
- Page rows: `probe-seedling-divergence-sweep.mjs --legs=legs.jsonl --mode=inv --producer=solver --page-legs=1
  --page=seedling_bot_ap_p4g --host=http://localhost:<port> --ids=<ids> [--capture-requests=…]`.
- Node replay: `replay-seedling-solve-request.mjs --requests=req.jsonl --id=719 --n=1`, with
  `SEEDLING_DRILL_TERRAIN_SWITCH=0|1`.
- Survey: `survey-seedling-route.mjs --through=end --route=full --only=84,86,88,99,117`.
- Census tools: `evidence/tools/{drillcensus,tilemap,lure}.mjs` (scratch, measure only).

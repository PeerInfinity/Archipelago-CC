# Seedling fidelity STAGEDHITS: the player's damage is staged from the game

| | |
|---|---|
| Session | `seedling-fidelity-stagedhits` (wave 14, model coverage; planner `seedling-fidelity-planning-6`) |
| Start SHA | **`8654f02a4c`** (`8654f02a4c18d3d344963fffe4ac999b9e7459e6`), the brief's base, not rebased |
| Harness branch | `claude/seedling-staged-hits-d8fz6f` (the harness branch IS the slice branch) |
| Commits | D1 `e661be5` · D2 `cdbb9fe` · D3 `084c61d` · records `245d83c` · this report (the head) |
| Dev server | `serve-nocache.py 9650` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (no flag: absent is byte-identical) · D3 PASS: game witness `stagedhits-l73-restage`, 0 px** |

## The one thing to know first

**The two re-stage points need different things, and only one of them needs the new field.**
- The wasm engine's **continuation and delivery** re-stage at the ARRIVAL and replay the shipped prefix. The replay re-bills the hit, so the shadow already carries it (measured on the game below: the shadow equals the game at every tick, `hits` and `hits_timer` included).
  - What is missing there is a **check**: `shadowMismatch` compares level/x/y/primary and never the damage. The new `stagedHitsMismatch(run, botStatus)` is that check.
  - ⛔ Staging the live `botStatus.hits` on top of a replayed prefix would **bill the hit twice**.
- An **in-place re-stage** (`jsRuntimeCore.rebootInPlace`, or a cold adoption) has no prefix. There the game's damage must be **staged**: `player_damage` from `botStatus` at that point (`playerDamageFromStatus`).
- On the game: the in-place re-stage with the field is the game at **0 px through the i-frame's lapse**. The control without it is off at **t1**: it steers through the game's i-frame.

## W0 (at `8654f02a4c`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9650 bash scripts/procgen/identity-block.sh .` (venv active) | maze `57e07d21`, acceptance `933c14f7` (FORCEDHIT's ON value, flipped at the wave-13 harvest), c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; reference 4 DIFFER (the container's substrate rows) |
| six `--check`s | the same run | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json`; md5 over sorted `status\tfullName` | **611** pairs, all pass, **`75a3c41f0c91f6e71953e82d8259dc60`** |
| bounded vitest BEFORE | 136 files (below) | 3,932 pass + **1 red, mine**: `boxLock.test.js`'s roster row caught the D3 probe, untracked in the tree while it ran (it takes the box). Registered in D2 |
| roster | `fixtures/tapes/index.json` | unchanged (no tape added) |

**The bounded set** (137 files at the head, `…-evidence/bounded-files.txt`):
- the brief's list;
- FORCEDHIT's 62 files;
- every `rg -a` hit on what I touch: `createRunForStaging`, `worldHitsOf`, `createPlayerDamage`, `stagingFromTape`, `forcedHitContinuationRefusal`, `shadowMismatch`, `stageItems`, `rebootInPlace`, `.damage`. That covers the JS arc's pins: `seedlingWasmPlayback`, `seedlingWasmPlaybackDelivery`, `wasmArrival*`, `wasmDelivery`, `wasmPlayback`, `jsRuntimeForcedHit`, `jsRuntimeSolver*`, `solverPrefix`, `watchManual`;
- the new `fidelityStagedHits`.

## D1: the census (PASS)

The full table, with file:line for every site, is in `…-evidence/census-d1.md`.

**What the game exposes.**
- `botStatus.hits` and `botStatus.hits_timer` (`Bot.as:2124-2125`).
- NOT the parked facing `directionFace`: `direction` is private (`Bot.as:597`). `botMobiles`' player `anim` shows the facing.
- The dark-stuff latch (`hitByDarkStuff`) is an ENEMY's field, so it is not player state and is out of this slice.

**Decision: hits + the i-frame timer, plus an optional parked facing.**
- `hits_timer` is not cosmetic. It blocks the arrows (`canSteer`) and swallows the next hit from any source (both measured, D2/D3).
- `direction_face` moves only the facing (`nextDirection`), never a position. It is optional; absent = −1.

**The re-stage points** (13 sites; the ones that matter):

| site | what it does to hits today |
|---|---|
| `tapeRunner.createRunForStaging` (`:362`) → `levelRun.js:2855` | every staged run starts at 0/0/−1 |
| `wasmArrival.stagingFromWasmArrival` (`:258`) | read at the begin record (`game_time === save.time`): a new `Player`, 0. Correct |
| `wasmArrival.continuationSolveRequest` (`:492`) | arrival + shipped prefix: **re-bills** the hit; never compared with the game |
| `wasmDelivery.stageItems` / `deliveryRefusal` (`:193`/`:279`) | arrival + prefix: re-bills; its `witness` compares two MODEL runs' hit counts |
| `wasmPlayback.shadowMismatch` (`:699`) | no hits row |
| `wasmPlayback.adoptionRefusal` (`:445`) | refuses `hits \|\| hits_timer` (`player-state`) |
| `jsRuntimeCore.rebootInPlace` (`:672`) | a fresh staging at the player's position: **0**; the JS page's `botStatus` (`:1000`) has no `hits` |
| `forcedHit.worldHitsOf` (`:95`) / `solverBot.js:19629` | the budget reads the ledger; the death check is `playerHit`'s own |

**The game keeps its `Player` on a continuation.** `botStart` builds a `new Game` only when the tape's boot is not the current ctor args (`Bot.as:1843`, `atBootPosition`). The engine's continuation tape reuses the arrival's boot, so it takes the skip path, and the game's hits survive it (measured, D3).

## D2: the field (PASS; no flag)

**The field.**
- `player_damage: {hits, hits_timer, direction_face?}`, an OPTIONAL staging field.
- It uses `botStatus`'s spelling, on `inventory_slots`' precedent. No tape carries it: `stagingFromTape` does not copy it, so every replay is unchanged. `solveStaging` keeps it.
- It is passed through `createRunForStaging` → `createLevelRun({playerDamage})` → the boot world's initial `damage`.
- **Validation** (`playerDamage.stagedPlayerDamage`, each refused by name):
  - integers;
  - `hits_timer` in 0..20 (`hitsTimerMax`);
  - `direction_face` in −1..3;
  - no unknown key;
  - `hits < hitsMax`, the RUN's `hitsMax` (a heart's 4 admits 3). A player at `hitsMax` is dead.
- It is per world: a door or a death builds a fresh `Player` exactly as before.

**Readers.**
- `run.stagedDamage` (a new getter).
- `forcedHit.worldHitsOf` returns `{hits, lastHitAt: null, id: null, staged: true}` while no hit, door or death has replaced it. Unstaged runs read the BEFORE shape.
- The forced-hit budget reads `worldHitsOf`. The forks the proof steps are built from the staging, so they carry it too.

**Leg 622** (`solve622` with the staging's `player_damage`, `forcedHits` ON):

| staged | result |
|---|---|
| `{hits: 0, hits_timer: 0}` | solved, `forced-hit`, 4 t (= absent) |
| `{hits: 1}` | refused: `forced-hit: every input from here is hit … over the budget's 0 (hits now 1, hitsMax 3, margin 1 …)` |
| `{hits: 2}` (hitsMax − 1) | refused: `… every proof leaf dies` (the proof: depth 2, 1,296 leaves, **all deadly**). It never plans a death |

**Helpers for the JS arc** (`playerDamage.js`):
- `playerDamageFromStatus(status)` → `{hits, hits_timer}`.
- `stagedHitsMismatch(run, status)` → null or `{expected (model), got (game)}`, `shadowMismatch`'s shape.

**Mutants** (predicted first; copy + edit + restore; `cmp` equal, `grep -c MUTANT` 0):

| mutant | predicted | measured |
|---|---|---|
| M1 `levelRun` ignores the staged damage | red: initial-damage, i-frame, death, worldHitsOf (after the hit), proof, hits-2 solve, mismatch. Green: the hits-1 solve (the budget reads `stagedDamage`) | **exactly those 7** |
| M2 `worldHitsOf` ignores the staging | red: the worldHitsOf row and the hits-1 solve (cap 1 → admitted) | **exactly those 2** |
| M3 no `hits < hitsMax` check | red: the hits-3 row and the heart row | **exactly those 2** |
| M4 `createRunForStaging` drops the field | every staged row red (17), the S/C witness rows green | **17 red** |

## D3: on the game (PASS)

**Leg 622's own crossing cannot be re-staged in L73.** Its knockback carries the player through the door at t4 whatever is held. In the model, the 2-tick prefixes `up up`, `· ·`, `left left` and `right right` all cross by t10.
- `down+right ×2` (622's own last two keys, played first) takes **the same hit**: `lavarunner@72,24`, t2, 1/19.
- After it, the player rests in L73 at (68.5005, 20.5005).

**The witness `stagedhits-l73-restage`** (`probe-seedling-staged-hits.mjs --record`, p4f headless, box lock, port 9650):
1. Tape 1: the arrival + `down+right ×2` + nothing to t12, HELD. At the hold the game reads hits 1, hits_timer 9, v (0, 0), game_time 4833.
2. Tape 2: the engine's own continuation tape (`shippedTape`: the same boot, the skip path), `left` ×25, held.
3. Every tick's position comes from `botDrain` and every tick's `hits`/`hits_timer` from a `botStatus` poll (26 of 26 ticks).

| run (model) | construction | tape 2 against the game |
|---|---|---|
| **S** shadow | arrival + all shipped keys (`continuationSolveRequest`) | **equal at every tick**, damage included; `stagedHitsMismatch` null at both holds |
| **P** in-place re-stage + field | boot at the hold position, `player_damage = playerDamageFromStatus(hold)` | **0 px and equal damage t0..t9** (the lapse). At t10 the second hit lands **on the game's tick** (2/19), but the knockback is off: the re-stage rebuilt the lavarunner at its spawn (80, 32), while the game's had chased the player |
| **C** control | the same re-stage, no field | damage off at **t0** (0/0 vs 1/9), position off at **t1** (67.7005 vs 68.5005): it steers through the game's i-frame |

`fidelityStagedHits.test.js` replays the witness (26 rows in the file, all green).

## Survey / sweep rows this moves (before → after)

**None, by construction.**
- No survey step, sweep leg, committed tape or producer stages `player_damage`.
- Absent is byte-identical: the identity block, the six producer `--check`s and tapeRunner's 611 pairs are all equal at the head.

**The movers come when the JS arc wires the field:**
- the `forced-hit-continuation` fallbacks become continuations;
- an in-place reboot after a hit keeps it.

## CI dispatches for the planner (I cannot dispatch)

1. **Witness on CI:** `seedling-probe.yml`, ref `claude/seedling-staged-hits-d8fz6f`, `probes=probe-seedling-staged-hits.mjs`, `args=--t1=12 --keys2=left --n2=25`. Expect `ALL CHECKS PASSED` (S equal; P off first at t10; C at t1).
2. **Sweep inertia, leg 622 by key** (`level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0`): `seedling-divergence-sweep.yml`, the same ref, `mode=inv`, `producer=solver`, `contact_fidelity` empty, `ids=622`. Expect done, 4 t, `forced-hit`, as at the base.
3. **Survey inertia:** `seedling-survey.yml`, the same ref, `through=end`, `route=full`, no `only`. Expect it equal to 38168138687 by (level, goal, boot): 222 steps, 169 / 51 / 1 / 1.

## For the JS arc — the wiring spec

**No JS-arc file was edited.** The contracts of `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are unchanged. The new parts are an optional staging field (`player_damage`), an optional `worldHitsOf` field (`staged`), and a run getter (`stagedDamage`). No new `SolverRefusal.obstacle.kind`.

**What to wire:**
1. **The held check** (`seedlingWasmPlayback.js`, where `shadowMismatch(heldRow ?? c.shadowRow, st)` is asked, ~`:1126`). Also ask `stagedHitsMismatch(shadowRun, st)` on the replayed shadow (`replayTape(staging, shipped)`, the run `continuationSolveRequest` builds). A non-null result is the same STOP as a position mismatch: `shadow-mismatch`, named with the two `{hits, hits_timer}`.
   - ⛔ **Do NOT stage `player_damage` on these re-stages.** The arrival staging is read at the begin record (hits 0), and the replay re-bills the prefix's hits.
   - The same applies to a delivery: `deliveryRefusal`'s replay re-bills, so check the re-staged shadow against `botStatus` after the write.
2. **The in-place reboot** (`jsRuntimeCore.rebootInPlace` → `boot`, `:672`/`:459`). On the JS page the run IS the game. Before rebooting, read the run's damage and stage it: `staging.player_damage = {hits: run.damage.hits, hits_timer: run.damage.hitsTimer, direction_face: run.damage.directionFace}`. A door or a death in the new run resets it as the game does.
   - Expose it on the JS page's `botStatus` (`:1000`: add `hits`, `hits_timer`) so `playerDamageFromStatus` reads the same keys on both runtimes.
3. **Optional: the cold adoption** (`adoptionRefusal`'s `player-state` clause). When the only non-zero readouts are `hits` / `hits_timer`, the adoption may stage `player_damage = playerDamageFromStatus(st)` instead of refusing. The position, velocity and inert-mobiles clauses already make the arrival staging the room.

**When the `forced-hit-continuation` guard may be lifted:** once (1) is wired. A continuation's shadow then carries the forced hit by replay, and any re-stage that misses it is caught by name. On the JS page it also needs (2). The guard's own fallback is a forced RE-ARRIVAL, which is the exit-and-re-enter the user's standard rules out.

**Pins that move when wired:** `seedlingWasmPlayback.test.js:1721-1772` (the `forced-hit-continuation` rows, `forcedBy`) and `jsRuntimeForcedHit.test.js`. Nothing moves at this head (both green).

## For the hammer arc

Nothing handed over. No hammer-owned function was touched.

## What the brief got wrong (measured)

1. *"(a) a delivery's `stageItems` re-runs from tick 0"* as a hole for the FIELD. It re-runs with the shipped prefix, which re-bills the hit (the shadow equals the game, D3). That hole needs a game CHECK. Staging the field there would double-bill.
2. *"take 622's forced hit, then re-stage inside the same world"*: 622's own plan cannot. Its knockback carries the player through the door by t4. The same hit (body, tick) from `down+right ×2` leaves the player in L73.
3. *"`rebootInPlace` resets hits to 0 while the game keeps them"*: on the JS page the run IS the game, and its `botStatus` carries no `hits` at all. It is the real game that keeps them (an item flag rebuilds no world).
4. *"(+ the dark-stuff latch)"*: `hitByDarkStuff` is an enemy's field, not the player's.
5. *"a control staged at 0 diverges (name the tick)"*: damage at t0, position at **t1**.

## Residue (ranked)

1. **An in-place re-stage rebuilds the room's bodies at their spawns.** Hits staged exactly do not make the enemies exact (P is off from t10). The JS page's `rebootInPlace` carries this whatever the damage.
2. **The parked facing is not on `botStatus`.** A press inside a staged i-frame swings by the facing. Read it off `botMobiles`' `anim` if it matters (P staged −1, the game's was 0; positions are unaffected).
3. **A tape built from a staged solve does not carry `player_damage`** (`buildStagedTape`, like `inventory_slots`). Re-stepping such a tape from its own staging fields would start at 0. The engine's shadow uses the session staging, so it is unaffected.
4. **`frozen_timer` and `drown_timer`** are on `botStatus` and are also per-`Player` state no staging carries. They are out of this slice; the adoption still refuses them.

## Deltas

**New:**
- `fidelityStagedHits.test.js` (26 rows);
- `probe-seedling-staged-hits.mjs`;
- fixture `fixtures/staged-hits-witness/stagedhits-l73-restage.json`;
- `…-evidence/` (`census-d1.md`, `bounded-files.txt`).

**Changed:**
- `playerDamage.js`: `STAGED_PLAYER_DAMAGE_KEYS`, `stagedPlayerDamage`, `playerDamageFromStatus`, `stagedHitsMismatch`;
- `levelRun.js`: the `playerDamage` parameter, the initial `damage`, the `stagedDamage` getter — inside `createLevelRun` only;
- `tapeRunner.js`: one field in `createRunForStaging`;
- `forcedHit.js`: `worldHitsOf`;
- `boxLock.test.js`: the roster gains the probe.

**Records:**
- `seedling-bot-log.md` entry + 3 trap candidates;
- the `seedling-bot.md` paragraph;
- constants census `--write` (5 literals classified, PASS 5,813);
- surface census `--write` (`run.stagedDamage`, GREEN 278);
- the reference (docs index, instruments; the 4 container rows left as the base has them);
- `check-procgen-docs` ALL CHECKS PASSED;
- roster unchanged.

## Byte-inertia

| row | base | head |
|---|---|---|
| identity block | above | **equal**, every row; reference 4 DIFFER both (= the container rows; 6 before the regen) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` | **equal**, exit 0 |
| tapeRunner | 611, `75a3c41f…` | **611, `75a3c41f…`** |
| bounded vitest | 136 files, 3,932 + 1 red (the untracked probe) | **137 files, 3,959 / 3,959** (= 3,932 + the boxLock row + 26 new), md5 `b0ad2959…` |

## CI (`JavaScript Unit Tests`)

At `245d83c`, the last code head (the report commits touch only `CC/docs/`, which the workflow's path filter skips): run **38279641805**, `completed success`; the suite (unfiltered) **20,044 / 20,044**, the slow battery 253 / 253.

## Rows to BANK

- tapeRunner **611** pairs, `75a3c41f0c91f6e71953e82d8259dc60` (base = head).
- The identity block at the head = the bank (maze `57e07d21`, acceptance `933c14f7`, …).
- Bounded vitest 3,959 / 3,959 (137 files).
- Constants 5,813 PASS; surface GREEN (278 rows).
- Witness `stagedhits-l73-restage`.
- No licence needed: the change is byte-inert with nothing to flip. The behaviour change arrives with the JS arc's wiring.

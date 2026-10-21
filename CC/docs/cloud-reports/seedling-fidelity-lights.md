# Seedling fidelity LIGHTS — the L69 Lights fight, modelled and solved

Slice `seedling-fidelity-lights` (Opus, cloud). Planner `seedling-fidelity-planning-9`, wave 20.
Switch: `CONTACT_FIDELITY.lightsBossFight`, OFF, byte-identical (`SEEDLING_LIGHTS_BOSS_FIGHT=0|1`).

| | |
|---|---|
| Start SHA | **`934f99422b`** |
| Head | the commit carrying this report. Before it: D1+D2a `8b13200c`, D2b+D3 `81bd3d5c`, D4 + records `45679306` |
| Branch | `claude/seedling-lights-boss-fight-9efqku` (the harness's). Nothing went to `main`; nothing was force-pushed |
| Dev servers | `serve-nocache.py 9701` (primary) and `9702` (the pristine base worktree, for W0) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS** (survey moves; the keyed sweep does not, for a named JS-arc reason) |

## The one thing to know first

**The fight is modelled to the bit and the solver wins it, but nothing that drives the GAME asks for it yet.**
- Model and solver: four game witnesses reproduce at 0 px. Both solves (sword 560 t, spear 362 t) win on the game and
  leave by the exit Teleporter to L36.
- Survey: with the switch ON, the model-only survey solves 163 (L69) and 164 (L36), 196 / 54 / 2 / 2 of 254.
- The keyed wasm sweep moves 0 legs. It never reaches the model: both L69 legs are refused in the JS arc's goal
  resolver.
  - `jsRuntimeSolver.solverGoalFor`: *"no live teleporter resolved for the exit"*. The exit only exists after
    `endState()`.
  - `seedlingPlaybackController.BOSS_REPORT_REFUSAL`: *"no fight executor"*.
  - Both files are the JS arc's, so wiring them is hand-over #1.
- Also, the sweep's `bare` legs arrive with no sword, so `execLights` would refuse `cannot-act` anyway.

## W0 — the base (PASS)

Measured in a pristine detached worktree of `934f99422b` (scratchpad `base`, its own server on 9702), because edits had
started before W0 ran.

| row | result |
|---|---|
| identity block | md5 of the whole block **`91cac85c`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49` |
| producers | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`: exit 0. **r9-campaign `c6fc1297`: exit 1, pre-existing at the pristine base** (not this slice's) |
| reference | **4 generated regions DIFFER at the pristine base** (pre-existing drift; regenerated in D4) |
| tapeRunner pairs | **635 `e1648386`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN 321 · PASS · PASS 566 · PASS 138 · **289** |
| bounded vitest BEFORE | 83 files / 2504 green (the standing list); extended set 124 / 4228 green |

## D1 — the fight on the game (PASS)

- Instrument: `scripts/procgen/probe-seedling-lights.mjs`, which takes the box lock and joins the conditional-takers
  list.
- Run: p4g, headless logic-only, port 9701.
- What it records: per tick, the player and its `hits`/`hits_timer`, the level, the intro NPC, every `LightBoss`
  (position, velocity, anim, `hits`, `hits_timer`), every `LightBossShot`, and the clears.
- `--record` writes a fixture only on a PASS against the model.

| witness | ticks | shows |
|---|---|---|
| `lights-stand` | 701 | **The intro** pages at t62 and is removed. The six fliers spawn at (80,−32) at t63 and fly the `worldFrame(180,4)` pattern. Shots: three shot hits, then the death and the respawn at the boot (56,136) |
| `lights-revisit` | 81 | `{69,0}` cleared: no intro, no fliers, and the exit Teleporter (72,72). The crossing lands at t49 in L36 (120,104) |
| `lights-solve-sword` | 560 | the solver's sword tape. The last flier leaves at t548 and `{69,0}` lands at t549; then the exit |
| `lights-solve-spear` | 362 | the solver's spear tape: last flier t348, `{69,0}` at t349 |

**Measured facts the model needed:**
- **The intro is not automatic.** It opens on an X release within 24 px of (80,80), and its two pages are tape ticks
  (talkingSpeed 4, lineLength 34). It is `setTemp(..., true)`, and its removal nulls `myText`. The fliers spawn on the
  NEXT controller update.
- **`FP.RAD` = π/−180**, so the controller's spin decreases. The first transcription had mirrored velocities.
- **The runtime's trig is musl's** (`__cos`/`__sin`). It differs from V8's fdlibm by one ulp on about 1% of arguments,
  e.g. flier 3 at t71. `runtimeLibm.js` transcribes `kcos`, `ksin`, `remPio2` (the large path refused), `cos`, `sin`,
  `atan` and `atan2`.
- **Update order:** shots, then fliers newest-first, then the totem, the NPC, the controller, and the player. Removals
  are deferred to `updateLists`.
- **`endState()` runs on the tick after the last removal.** It writes `{69,0}` (`setPersistence(0,false)`) and adds the
  Teleporter (72,72) → L36 (112,96), arrival (120,104), live from the next tick. The totem's type becomes `""`.
- Shots are 4×4 hitboxes, f = 0, and hit the Player only. The cull is `onScreen()` at margin 0, which is a shake band
  near the edge. The comparator skips shots within 8 px of the room's edge, where the band is the camera's.
- Weapons: the sword tests T+1..T+5 (reach 16 plus `collideLine("Solid")`, the totem included). The spear tests T+1,
  T+3 and T+5 on the rect only, with damage 2 and force 7. The wand's `WandShot` arm is not modelled and is refused.

## D2 — the model (PASS)

- **Modules:**
  - `frontend/modules/seedlingDemo/lightBoss.js`: the controller, the fliers, the shots, the hit and knockback (musl
    trig), the clone, and the exit wrapper.
  - `lightBossWorld.js`: a leaf with no imports, which breaks an import cycle. It holds the totem and exit rows.
  - `runtimeLibm.js`.
  - `lightBossWitness.js`: the model track and the strict comparator.
- **Wiring, all behind the switch:**
  - `levelWorld` builds the totem into `solids`, the exit into `teleporters` when `{69,0}` is cleared, and
    `lightsControllers`.
  - `levelRun.stepLightsNow` steps the fight in order (shots → `applyPlayerHit` source `lightbossshot`; fliers →
    contact source `lightboss`, with dark-suit retaliation; the intro through `beginNpcDialogue`/`stepNpcDialogue`; the
    controller on `clock.now()`). `ended` goes to `apReportWrite({69,0})`, and the end-of-frame removals and the
    `pendingEnd` step drop the totem, add the exit and rebind the world.
  - `lightsSlashNow` follows `bobBossSlashNow` in `applyThrust`. `lightsSpearRepeatsNow` is the spear's T+3/T+5.
  - The family `lightsFight` is in `run.entities` (a list).
  - `playerPhysicsV2.step` carries `lightTotems`.
- **Rows moved from refused to modelled:**
  - `enemyDamage.KILL_ARM_POLICY.LightBoss`: a getter, modelled ON.
  - `CORPSE_COUNTING.LightBoss`: `anim`, no fade.
  - `KILL_SIDE_WRITES.LightBoss`: `none`, because the controller writes.
  - `entityBlocks` row `lightsFight` [hp, emitter, contact].
- **Witness:** `fidelityLights.test.js`, 17 green. The four witnesses are at 0 px, with `compared` = every sampled tick.
  The CONTROL is that the switch OFF does not reproduce the stand.
- **Mutants**, in `evidence/mutants/`, each restored by copy:
  - **m1:** `LIGHTS_SPEAR_REPEATS = []` fails `lights-solve-spear`.
  - **m2:** `step` dropping `lightTotems` fails both solves.
  - V8 trig in place of musl fails at t71. This one is pinned as a value row.

## D3 — the solver (PASS)

- **Rows.** `OBSTACLE_STRATEGIES['solid:lightbosscontroller'] = 'lights'` and `STRATEGY_EXECUTORS.lights = execLights`.
  Both are switch-gated, non-enumerable own rows (`switchGatedRow`): OFF they read `undefined` and never enumerate,
  which is why `rules-2`'s `bossGoal` route stays inert OFF.
- **The arm.** `execClearTag` gains an arm before `already-clear`: `{69,0}` cleared → `already-clear` (0 ticks);
  otherwise the verb, then `waitForWrite`, then `done('verb')`.
- **`lightsVerb.execLights`:**
  - The weapon must be the sword or the spear; otherwise `cannot-act`.
  - The intro: walk to (80,100) and press every 4 ticks.
  - Then each round picks the best sortie on an exact forecast of a CLONED fight (`cloneLightsFight` + the pure player
    step). A sortie is wait w ≤ 60, leg d×n ≤ 10, press, optionally back, then a 16-tick safe tail.
  - If no sortie lands, it picks a one- or two-leg dodge that survives 60 ticks.
- **Refusals** (`unresolved`, each with its reason): the forecast's digest differs from the live fight after a plan, a
  hit, the bound, or no plan.
- **Witnesses:**
  - `lights-solve-sword` (560 t) and `lights-solve-spear` (362 t) are game witnesses at 0 px.
  - `fidelityLights.slow.test.js` re-solves both and equals the recorded tapes key for key (2 tests, ~42 s).
  - The `already-clear` and `cannot-act` (wand) arms are tested.
- No new `SolverRefusal` kind: the reasons are reused.

## D4 — movers (PASS)

**The survey's death exit.** `survey-seedling-route.mjs hopEdge`: an AP exit `out_lightbosscontroller_*` has no `to` in
the .oel, because `endState()` adds the Teleporter. When ON, the edge is answered from the model's own build (the
cleared arm). OFF never reaches it.

| measurement | OFF | ON |
|---|---|---|
| survey `only=162,163,164` (local) | 162 SOLVED 105 · **163 NO-EDGE** · **164 NO-ARRIVAL** | 162 SOLVED 105 · **163 SOLVED 559 t** (2 decisions, 0 hits) · **164 SOLVED 50 t** |
| survey full route (local, ON; OFF = CI 39496129402) | 194 / 54 / 3 / 3 of 254 | **196 / 54 / 2 / 2** of 254. The NO-EDGE pair left is L57's `tentaclebeast` (steps 94/95 and 125/126) |
| keyed sweep, the two L69 keys, `capture_requests` | 607 `failed` (no live exit teleporter), 608 `unresolved` (`BOSS_REPORT_REFUSAL`) | **identical: 0 movers** |
| bounded vitest (125 files) | **4247 green** | 4 red, all pins the flip moves (below) |

**The ON reds are the flip's pins:**
- the `contactFidelity.test` defaults;
- `fidelityLights`' OFF-default row (`CONTACT_FIDELITY.lightsBossFight` is false);
- `enemyDamage.test`'s `refused > 15` floor (LightBoss modelled → 15);
- `fidelityApFlip` "Lights ({69,0}) … room unchanged". APFLIP wrote that row without the fight. On the game the totem is
  a 16×16 Solid until `endState`, so the uncleared room has one more solid than the cleared one.

**CI dispatches to run** (a cloud session cannot dispatch):
1. `seedling-survey.yml` on this branch, the full route `--through=end`, ×2:
   - A: `contact_fidelity` = the 36 default keys;
   - B: the defaults plus `lightsBossFight`.
   - Expect B = A except 163/164 → SOLVED.
2. `seedling-divergence-sweep.yml` on this branch:
   - `keys='level_69 <- in_pit_L70_3_8 -> exit:out_lightbosscontroller_72_72|level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights'`;
   - A: the 36 defaults; B: the defaults plus `lightsBossFight`;
   - `capture_requests=true`, ×2 repeat.
   - Expect 0 movers until hand-over #1 lands.

## The JS arc's pins, and what it must wire

- Reads: `run.entities('lightsFight')` (a list, `[view]` or null) and `run.world.lightsControllers` (absent OFF).
- `jsRuntimeSolver`'s `hasOwnProperty` sees `lights` (a non-enumerable own row), but its value is `undefined` OFF.
- **Wire:**
  - (a) `solverGoalFor`: an exit whose `exit_id` is `out_lightbosscontroller_*` becomes a `clear-tag` goal
    `{69,0}` on that obstacle, then the exit (`withLightsExit` appends the Teleporter after `endState`);
  - (b) the vanilla map's `BOSS_REPORT_REFUSAL` for `lightbosscontroller` becomes the same `clear-tag` goal.
- The sweep's `bare` legs carry no sword, so they will refuse `cannot-act` until an equipped boot reaches L69.
- Untouched: `jsRuntime*`, `flashPanel/*`, the sweep producer, `seedlingHitTicks`, `seedlingContactLab`, contact capture,
  and the signatures of `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging`.

## Hand-overs

1. **JS arc:** wire (a) and (b) above. Then rerun the keyed sweep dispatch.
2. **⛔ STOP — the hammer arc's region.** The danger map does not see the fliers or the shots; the verb's own forecast
   is what keeps the player clear. Adding them to `dangerMap` needs `stateDigest` / `stateDigestParts` to cover
   **`lightsFights`, `lightsExits` and `lightsSpearRepeats`** (run state the escape would read). Not done.
3. **At the flip:**
   - `lightTotems` joins `LIVE_GEOMETRY_KEYS`.
   - The switch-gated rows become plain rows (the R8 derivation row, the pending list, `KNOWN_STRATEGY_VERBS`).
   - Move the four pins above.
4. **The wand arm** (`WandShot` against a flier) is refused. It is residue.
5. **Spear repeats** (T+3/T+5) are modelled for the fliers only. Every other body still sees the spear's T+1 alone, as
   before (not checked here).

## Deltas

- New files: `lightBoss.js`, `lightBossWorld.js`, `runtimeLibm.js`, `lightBossWitness.js`, `lightsVerb.js`, the two
  tests, four witness fixtures, and `probe-seedling-lights.mjs`.
- Edited: `contactFidelity.js` (the key, added last), `levelWorld.js`, `levelRun.js`, `enemyDamage.js`,
  `entityBlocks.js`, `playerPhysicsV2.js` (one destructure and one spread), `solverBot.js`, `solverView.js` (exports),
  `seamPosture.js` (a note: `Rng.cos()`, cosmetic), and `survey-seedling-route.mjs`.
- Also edited: `levelRun.test` (the family list and an L69 witness row), `boxLock.test` (the probe), the surface test
  regex, and `contactFidelity.test` (the defaults pin).
- Censuses: surface `--write` (GREEN 332; 11 rows classified), constants CSV (6469 literals, PASS; `step`'s destructure
  row re-keyed `h8f93e98b` → `hd93e06b5`), the entity-blocks doc row, and the reference regenerated.
- No tape added to the roster (289, names unchanged). No committed tape moved. No producer digest moved.

## What the brief got wrong (measured)

- The intro is not auto-advanced: it opens on an X release in range, and its pages are tape ticks.
- The OFF NO-EDGE at 163 is the survey's atlas lookup (`hopEdge`), not the model.
- The brief does not mention the spin's direction (`FP.RAD` < 0) or the musl trig. Both are load-bearing.
- `seamPosture` cited `Math.random` for the cosmetic RNG; it is `Rng.cos()`.
- An unconditional `STRATEGY_EXECUTORS.lights` would have moved OFF: `rules-2`'s `bossGoal` asks
  `STRATEGY_EXECUTORS[verb]`, and an OFF build would have read the controller as `already-clear`, a false success.
  Hence the switch-gated rows.

## Residue

- The wand arm.
- The danger map's blindness to the fight (hand-over 2).
- An OFF latent: `execClearTag` would answer `already-clear` if handed a `lightbosscontroller` OFF. This is unreachable
  OFF because the survey skips and nothing else builds that goal.

## Byte-inertia (OFF)

- Identity block AFTER: md5 **`91cac85c`**, which is W0 pristine (the r9-campaign exit 1 and the reference drift are
  both W0's).
- tapeRunner pairs AFTER: **635 `e1648386`**, which is W0.
- Bounded vitest AFTER OFF: 125 files / 4247 green. That is W0's extended set plus `fidelityLights.test`.
- Censuses: surface GREEN 332, constants PASS, entities PASS 566, profile PASS 138. The roster is 289.

## CI at the pushed heads

- `81bd3d5c`: shard 2/3 red with 2 failures, both `procgenDocs/generated.test`: the reference did not list the new
  probe. D4's regeneration fixes them.
- `45679306`: run 39519731155 is **green**: unfiltered 21444 passed / 0 failed (868 files); slow battery 261 / 0.

## Rows to BANK

- `fidelityLights` witnesses at 0 px: stand 701, revisit 81, solve-sword 560, solve-spear 362.
- Survey ON: 163 SOLVED 559 t and 164 SOLVED 50 t; full route 196 / 54 / 2 / 2.
- Keyed L69 sweep: 0 movers (JS-arc refusals).
- musl cos(0.7799440094849661) = 0.7109529138748157 (V8: …156).

## Records

- `seedling-bot-log.md` § *Seedling fidelity LIGHTS*, with its trap candidates:
  - `step` rebuilds its live bag;
  - musl trig;
  - a two-line key file;
  - the sweep's default `--host` is :8000.
- `seedling-bot.md`: the clear-tag paragraph gains the `lights` verb.
- Evidence is in `CC/docs/cloud-reports/seedling-fidelity-lights-evidence/`: `w0/`, `d1/`, `d3/`, `d4/`, `after/`,
  `mutants/`, `tools/`.

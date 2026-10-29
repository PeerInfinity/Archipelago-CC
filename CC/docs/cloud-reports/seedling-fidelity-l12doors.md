# Seedling fidelity L12DOORS — L12 → L83 through the stacked doors behind the 13 px gap

Wave 34 (model coverage after R7), planner `seedling-fidelity-planning-16`. ⚖ The user (2026-10-05): *"The first priority
is to expand the model to include everything in the game."*

| | |
|---|---|
| Start SHA | `caa42ea5df` (main: W33 + L40BK2B + js inventory-menu; 97 default-ON keys of 109) |
| Head | the commit carrying this report, on top of `81816d2d` |
| Harness branch | `claude/seedling-fidelity-wave-34-sjpkne` |
| Commits | D1 `6dfb3c87` · D2 `c1bca360` · D3 + witnesses `4e13c320` · records `81816d2d` · this report |
| Servers | `serve-nocache.py 9763` (this tree) · `9764` (a base worktree at `caa42ea5df`, W0 only) · `9765` (a scratch worktree of `81816d2d` with the three keys' defaults flipped ON, never committed: the probe battery ON) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** · probes standard ON 11/11 — steps 172/203 SOLVE with all three keys ON; all three ship **OFF** (byte-identical) |

## The one thing to know first

**It took three gaps, not two, and all three are OFF-by-default switches that need the user's flip.** With
`wandShotChaserBodies` + `fineFrontierHiddenDoor` + `fineWandStance` ON, survey steps 172 and 203 SOLVE (1301 t / 1479 t,
hitless, `{12,12}` + `{12,7}` earned, into L83). The local full survey moves **exactly those two rows** (201/39 → 203/37, every
other row equal with its ticks). The solver's own plans are game-witnessed on p4g at 0 px. G1 was not a placement test. It was a
room-level guard that refused every Wand shot in any room holding a stepped chaser.

## W0 (base `caa42ea5df`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| steps 172/203 | `survey-seedling-route.mjs --through=end --route=full --only=172,203,173,204` | 172, 203 REFUSED KEYLOCK-SEALED `bosslock@112,192` `{12,11}` from (439.99,258.13) / (439.53,258.06); 173/204 (L83) SOLVED 85 t |
| survey full, OFF | `survey-seedling-route.mjs --through=end --route=full --timeout=1500` | **201 SOLVED / 39 REFUSED**, **0 of 240 rows differ** from CI `40617953040` (verdict, ticks, refusal text) — `evidence/survey-off-vs-ci-40617953040.txt` |
| identity block | `SEEDLING_PORT=9764 bash scripts/procgen/identity-block.sh .` in the base worktree (venv) | file md5 **`590b0b88`** (= L100's published value): maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; producers battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · campaign `be9c19c8`, all exit 0; reference "4 DIFFER" (the worktree's uninitialised submodules) — `evidence/identity-base.txt` |
| bounded vitest BEFORE | 106 files (the list below, less `fidelityL12Doors`) in the base worktree | **102 / 106 files**, 3,343 passed, 18 failed. All 18 are `cliContract` / `cliFlags` / `runPipeline` / `seedlingGenRoomGrowth`: the substrate registry under the worktree's symlinked submodules (*"'maze' is not a registered substrate"*). Every Seedling row is green |
| roster | `fixtures/tapes/index.json` | 291, unchanged (the witnesses live in `fixtures/l12doors-witness/`, not the roster) |

The bounded set (107 files) is the brief's list plus every `grep -a` hit for what this slice touches
(`assertWandShotSolidsBound|wandShotBlockerAt|resolveWandStrategy|execWand|fineFrontierFlood|WandShot in level|cannot place|
identifyAndSelect|magicallock|wandShotHits|magicalLocksOpened|nextPastSealedLock|SEALED BEHIND`). That adds `fidelityReturn`,
`fidelityRulesref`, `fidelityStance`, `fidelityStepOff`, `fidelityWand`, `fidelityWandHold`, `magicalLock`, `procgenPostSword`,
`r5Totem`, `seedlingGenRoomGrowth`, `seedlingSolidsSkin`, `seedlingSoundCues`, `solverBot`, `wandL43`, `wandShot`, `cliContract`,
`cliFlags`, `runPipeline`, `seedlingDivergenceLegs` and `surveyFamily`. Also `tapeRunner`, `fidelityL12Keyline`, `levelRunDigestRead`,
`fidelityL100`, `fidelityApBosses`/`fidelityApFlip` (the `apReportBosses` spellers; there is no `apReportBosses.test.js`), the
entity/profile witness tests, the surface/constants tests, and the slow pair `fidelityL32ArenaPrefix` + `fidelityL40Bk2`
(`vitest.slow.config.js`).

### G1, measured (it was not a placement test)

The solver from (40,888), right under the doors (rules-4's `model-under-locks` staging), refuses at the Wand press:

```
levelRun: a WandShot in level 12 would collide with 1 Enemy-typed bod(ies) this run cannot place: puncher@416,256. …
    at assertWandShotSolidsBound (levelRun.js:2747)   ← advance (levelRun.js:23045) ← execWand (solverBot.js:2419)
```

`assertWandShotSolidsBound` is a **room** guard. Once per level it collects the bodies the press census names as Enemy-typed
(`w.pressEnemies`) and refuses the room if any has no live box. A "box" counts only from the boss-totem, ice-turret and spinner
rosters. `puncher@416,256` is a **bridged chaser**: the run steps it (`chaserStateFor` / `chaserRectsNow`, behind
`stepChasersNow`'s `noclip || noDamage` gate) and holds its live box, but the guard never asked that roster. The puncher's
~650 px distance is irrelevant: the guard never looks at the shot's path. Before this slice, a Wand shot in any room holding
a bob or a puncher could not fire in the model.

### G2, measured (the frontier at each round)

These are temporary prints in `identifyAndSelect` (restored from git, md5 `816e0fb7…` verified). They show the 16 px and 8 px
floods at each of the five rounds from step 172's arrival (`evidence/g2-frontier-rounds.txt`):

| round, from | 16 px actionable (nearest the aim first) | 8 px adds | what ran |
|---|---|---|---|
| (176,392) | shieldlocknorm@288,704 (d 294), burnabletree@480,640, bosslock@112,192, @416,240, @432,240 | **magicallock@32,864 (d 20)** | touch |
| (286,711) | burnabletree, the three bosslocks | magicallock (d 20) | burn |
| (471,680) | bosslock@112,192, @416,240, @432,240 | magicallock (d 20) | 112,192 SEALED → next door: keylock @416,240 |
| (425,258) | bosslock@112,192, @432,240 | magicallock (d 20) | SEALED → keylock @432,240 |
| (440,258) | bosslock@112,192 | magicallock (d 20) | SEALED, no next door → **the refusal** |

- `fineFrontierFlood` re-floods at 8 px only when the 16 px frontier has **no** actionable entry, or when the plan error names a
  masked goal tile. Here every round has one, and the plan error is "different connected components". So it never fired.
- FRONTIER3's 8 px retry (`walkTo`'s catch) **did** fire on every SEALED throw. It plans a corridor to the AIM, which the
  standing doors block, so it failed.
- `nextPastSealedLock` (L12KEYLINE) then took the other bosslocks, which open from their own side and lead nowhere.
- The 8 px flood names the real door, 20 px from the aim, on every round.

## D1 — `wandShotChaserBodies` (PASS, OFF)

**Change** (`levelRun.js`, two hunks local to `assertWandShotSolidsBound` and `wandShotBlockerAt`; key in `contactFidelity.js`):
- ON, the guard counts a press-census body as placed when it is in the run's chaser roster (`chaserStateFor(n)` ids) **and** the
  run steps chasers (`!noclip && !noDamage`).
- ON, under the same gate, `wandShotBlockerAt`'s "Enemy" arm (after the totems and spinners) returns `{kind:'enemy', id,
  chaser:true}` for a live chaser box the shot overlaps. `applyWandShotToBoss` then refuses by name (*"…is not a BossTotem"*),
  as `R8_ENEMY_BRIDGE.enemyBodyReaders`' third row already says. So a shot that meets a chaser is a loud refusal, never a pass.
- Under `noclip`/`noDamage` there is no chaser position, and the room still refuses.
- OFF: byte-identical. `SEEDLING_WAND_SHOT_CHASER_BODIES=0|1`.

**Model:** under the doors, D1 alone gives wand(`magicallock@32,864`) → keylock(`bosslock@32,864`) → walk, **114 t** into L83. The
model's shot passes the standing bosslock and opens the magical lock, as rules-4 measured the game doing.

**Witness** `l12doors-under-locks` (below).

## D2 — `fineFrontierHiddenDoor` (PASS, OFF)

**Change** (`solverBot.identifyAndSelect`, one block after the `fineFrontierFlood` block, which is untouched):
- ON, with a non-empty 16 px frontier, the 8 px frontier is flooded.
- If it holds an actionable door the 16 px frontier lacks, **nearer the aim than every 16 px actionable door**, the 8 px
  frontier is the one asked.
- General: no level test. It costs one 8 px flood per identify, ON only.
- OFF: byte-identical. `SEEDLING_FINE_FRONTIER_HIDDEN_DOOR=0|1`.

## D3 — `fineWandStance` (PASS, OFF) — the third gap the brief did not name

With D1 + D2 ON, step 172's first round names `magicallock@32,864`. It then refused *"no REACHABLE stance with a clear wand line
… 6 walkable tile centre(s) … 6 plan no corridor from (176,392)"*. The cause: `stanceReaches` plans at the run's 16 px lattice,
and the strip under the doors is past the 13 px gap.

**Change** (`resolveWandStrategy` + a new `fineWandStanceReaches`):
- A candidate that `stanceReaches` refuses is asked once more with `planWaypoints` on `FINE_LATTICE`, in the world as it is (no
  hypothesis).
- `stanceReaches` itself is untouched (it is L100FIX's).
- The walk to the stance is `walkTo`'s existing FRONTIER3 / stance re-entry fine walk.
- OFF: byte-identical. `SEEDLING_FINE_WAND_STANCE=0|1`.

**With all three keys ON:** step 172 SOLVES in **1301 t**. The trace is wand(`magicallock@32,864`) at t0, keylock(`bosslock@32,864`)
at t1235, walk at t1287. `bosslock@112,192` is never touched.

## The game witnesses (p4g, headless logic-only, delivered set `seedling-vanilla-record-5aeefc3c`, 0 px)

`probe-seedling-l12doors.mjs` (takes the box) plays each witness on a fresh page and drains every tick (`botDrain`). It
compares them at 0 px with the model replaying the same tape with the witness's switches ON. The witnesses are the solver's own
plans on rules-4's step-172 staging (`plan-seedling-l12doors-witness.mjs`, `--check`). The recordings are
`fixtures/l12doors-witness/*.json`:

| witness | switches | ticks | game | model ON | model OFF |
|---|---|---|---|---|---|
| `l12doors-under-locks` (40,888) | D1 | 114 (115 obs) | {12,12} + {12,7} written, {12,11} not, ends L83 (40,56), hits 0 | **0 px on all 115**, hits 0 | refuses: *"cannot place: puncher@416,256"* |
| `l12doors-arrival` (168,384) | D1 + D2 + D3 | 1301 (1302 obs) | the same, hits 0 | **0 px on all 1302**, hits 0 | refuses (same) |

The run and its record: `SEEDLING_PORT=9763 node scripts/procgen/probe-seedling-l12doors.mjs` gave ALL CHECKS PASSED, then
`--record` gave ALL CHECKS PASSED again. md5: `l12doors-under-locks.json` `26aac76c…`, `l12doors-arrival.json` `0fb03011…`.

`fidelityL12Doors.test.js` has 17 rows:
- rules-4's staging facts and `l12Staging`, pinned equal to the probe's;
- all three keys default OFF;
- D1 OFF refuses, D1 ON gives the 114 t plan, D1 under `noDamage` still refuses;
- step 172 OFF is SEALED, ON gives 1301 t, and each key alone OFF refuses by its own gap;
- per witness: the game checks, the tape equals today's derivation, the model ON at 0 px, and the model OFF refuses.

**Mutants** (predicted first; copy → edit → run → restore; `levelRun.js` `dba1f135…`, `solverBot.js` `1ea458e9…` before and after,
verified):

| mutant | predicted | measured |
|---|---|---|
| M1: D1's chaser filter dropped from the guard | 6 red (D1 ON, step-172 ON, both tape-derivation rows, both model-ON rows) | **6 red** ✓ |
| M2: D2's comparison inverted (`<` → `>`) | 3 red (step-172 ON, the arrival tape, the each-key row) | **3 red** ✓ |
| M3: D3's helper always `null` | 2 red (step-172 ON, the arrival tape) | **3 red** ✗: the each-key row's no-D1 arm also needs D3's stance before its shot can refuse "cannot place" (it refuses "no REACHABLE stance" instead). The prediction missed that arm; the row is right |

## Movers

**Survey, full, local, ON vs OFF** (ON = the three env switches; `evidence/survey-on-vs-off.txt`). An ON arm overlapped a mutant
window (the survey runs each step in a child process that reads the files on disk), so it was **discarded and re-run clean**.

| step | (level, goal, boot) | OFF | ON |
|---|---|---|---|
| 172 | L12 v14, reach-exit teleporter@32,848 → L83, staged at (168,384) | REFUSED KEYLOCK-SEALED `{12,11}` | **SOLVED 1301 t**, hits 0, earned {12,12} {12,7}, end L83 |
| 203 | L12 v16, the same goal, **staged at (16,352)** | REFUSED KEYLOCK-SEALED `{12,11}` | **SOLVED 1479 t**, hits 0, earned {12,12} {12,7}, end L83 |
| the other 238 | — | — | identical verdict, ticks and refusal text |

Totals: **201/39 → 203/37**. D2's trigger *can* move any reach-exit step, and none other did.

**Bounded vitest, ON** (env switches, 107 files): **3 red, none a regression.**
- `contactFidelity.test.js` "the shipped defaults": env artifact. The defaults object is captured after the env override.
- `fidelityRulesref.test.js` "the bridge alone … the doorway still refuses" and "leg 579's arrival … both ON: the doorway
  first": these are **controls** that stage `fineFrontierFlood: false` to show the L66 doorway refusing. With D2 ON, the
  hidden-door rule now asks the 8 px frontier there too (the doorway lock is a door only the 8 px flood sees). The verdict
  stays REFUSED; only the text moves, from *"pixelmask:building8"* / *"goal tile (5,4)…"* to *"no REACHABLE stance on
  bosslock@72,64's key line"*. **A flip owes these two controls `fineFrontierHiddenDoor: false` in their staging** (wave 9's
  lesson: a control that assumed the old frontier).

**L4 dash-window margin** (`jsRuntimeSolverShouldStop`, `dashOnlyWindow`, `dashShape`), in the defaults-flipped worktree:
**46/46 green**. The env run red three request-shape rows only because the process is non-default; that is an artifact. The
84-vs-85 margin is untouched.

**Probe battery `standard`, keys ON** (the scratch worktree of `81816d2d` with the three defaults flipped, port 9765,
sequential, each probe with its battery args; `evidence/probes-standard-on.txt`): **11 / 11 ALL CHECKS PASSED, 0 FAIL, 0 SKIP**:

| probe (args) | PASS |
|---|---|
| wasm-logical-links (`--only=B,R`) | 24 |
| wasm-vanilla-map | 23 |
| wasm-arrival-composites | 95 |
| wasm-midroom-replan (`--only=D`) | 10 |
| restart-route (`--only=W,J`) | 18 |
| restart-warp (`--only=W,J`) | 28 |
| wasm-adopt | 51 |
| obstacle-events (`--only=W,J`) | 22 |
| wasm-generated-playback | 35 |
| loop-restart | 30 |
| seal-delivery (`--only=A`) | 6 |

At the defaults (keys OFF) the battery is byte-inert by gate: every hunk is behind its key.

### The dispatches for the planner

All on branch `claude/seedling-fidelity-wave-34-sjpkne`. The arms are comma-joined from this base's defaults plus the three keys
(`evidence/sweep-arm-off.txt`, 97 keys; `evidence/sweep-arm-on.txt`, 100 keys).

1. `seedling-survey.yml`: `through=end`, `route=full`, with the three keys ON. The survey has no fidelity input, so either push
   a measurement ref with the defaults flipped (the scratch worktree's three-line `contactFidelity.js` edit) or run
   `only=172,203` there. **Predicted:** 172 SOLVED 1301, 203 SOLVED 1479, every other row as `40617953040`.
2. `seedling-divergence-sweep.yml` ×2 per arm, the full sweep: `contact_fidelity=<sweep-arm-off.txt>` and
   `contact_fidelity=<sweep-arm-on.txt>`. Only leg 168 (`level_12__r42c28 <- in_L83_32_64 -> exit:out_teleporter_32_848`)
   targets this exit, and it arrives from L83 with the doors' flags staged. Two more are skipped by name (*"goal-is-a-staged-event
   flag:L12:7+flag:L12:12"*). D2 can move any leg, which is why the sweep is full (912 legs derived at this base).
3. `seedling-probe.yml battery=standard` on a defaults-flipped ref, for the CI copy of the local table.
4. **For rules-4:** re-read the L12 → L83 steps at this branch's head with the keys ON (dispatch 1). Rules unchanged.

## For the other arcs

- **JS arc:** nothing to wire. There is no new `SolverRefusal.obstacle.kind` and no staging or result field. The three keys
  ride the existing `contactFidelity` stamp, and the sweep's `contact_fidelity` input carries them. The page's
  `?contactFidelity=` also covers them.
- **Hammer arc:** nothing. No edit is in its region. D1 adds no run state: it reads the existing chaser roster (`chaserStateFor`,
  which `stepChasersNow` already builds under the same gate). So there is no new per-visit map and no `DIGEST_EXEMPT` row.
- **L100FIX:** `stanceReaches` is untouched. D3 is a sibling ask in `resolveWandStrategy`.
- **`R8_ENEMY_BRIDGE.enemyBodyReaders`:** unchanged. Under `noDamage` a chaser's position is still unread (D1 asks the
  stepper's own gate), and the wand-shot row's text (*"anything else THROWS by name"*) stays true ON.

## What the brief got wrong (measured)

1. **G1 is not "the WandShot placement under the stacked locks".** It is a room-level guard (`assertWandShotSolidsBound`) whose
   rosters omit the bridged chasers. The stacked bosslock never stopped the model's shot: `collidesSolid` returns the magical
   lock first, which is the game's answer too.
2. **G2's fallbacks:** FRONTIER3's 8 px retry does fire (on every SEALED throw). It plans to the aim and fails because the doors
   stand. Only `fineFrontierFlood` is gated on "no actionable entry". And the frontier is not defeated by the sealed lock 11
   alone: four other doors (shield lock, tree, two bosslocks) are actionable too.
3. **A third gap (D3)**, the wand stance's 16 px corridor test, stood between G1 + G2 and the solve.
4. **"≈1051 t + the door tail":** measured 1301 t (172) and 1479 t (203).
5. **Step 203's boot is (16,352)**, the L95 arrival, not (168,384). It reached the same (439.5,258) refusal by a different walk.

## Byte-inertia

- **Identity block:** every row equal BEFORE (`evidence/identity-base.txt`, base worktree) and AFTER (`evidence/identity-head.txt`,
  this tree at `81816d2d`). That includes all six producer md5s, all exit 0. The one differing line is the reference: the base
  worktree read "4 DIFFER" because of its uninitialised submodules, and this tree reads ALL MATCH.
- **Survey full OFF** equals CI `40617953040`: 0 of 240 rows differ.
- **Bounded vitest AFTER** (defaults): **107 / 107 files, 3,388 / 3,388**; the slow pair 2 / 2 (6 / 6).
- **CI at `81816d2d`** (run 40725682274): vitest unfiltered **23,961 passed / 0 failed**; slow battery 271 / 271. At `4e13c320`
  (run 40719282054) it had 6 red: the re-pins `81816d2d` carries (defaults row, boxLock ×2, surface, reference).
- **Committed tapes:** none moved; the roster is unchanged (291); there are no tapeRunner pairs (the witnesses are not roster
  tapes).
- **Surface** `--write`: +3 sites (`run:state`, `run:world`, `CONTACT_FIDELITY`, all in `solverBot.js`), then GREEN 360.
  **Constants** PASS 6,999 (`--write`: line moves only).
- **Reference** regenerated: the instruments index gains `probe-seedling-l12doors.mjs` and `plan-seedling-l12doors-witness.mjs`.
  The final check reads ALL 7 MODULES AND 5 REGIONS MATCH (with every submodule initialised).
- **Shared tables** (`OBSTACLE_STRATEGIES`, `KNOWN_STRATEGY_VERBS`, `KILL_ARM_POLICY`, `DEADLINE_SITES`, `FAMILY_RULES`):
  untouched.

## Re-pins and records

- `contactFidelity.test.js` "shipped defaults": +3 rows, all OFF.
- `boxLock.test.js`: the guarded list gains `probe-seedling-l12doors.mjs`, a new box-taking instrument.
- `plan-seedling-l12doors-witness.mjs` carries rules-4's staging facts instead of importing the probe. The probe imports
  playwright, so the plan script read as a browser driver to the box-lock lint. `fidelityL12Doors.test.js` pins them equal.
- `seedling-bot-log.md` entry (with trap candidates); a `seedling-bot.md` paragraph.

## Residue

- D1's chaser stop (`{kind:'enemy', chaser:true}` → `applyWandShotToBoss` refuses) has no game witness of a shot actually
  meeting a chaser. No route step fires at one, and the refusal is the existing one.
- When a shot box overlaps a spinner and a chaser in the same update, the "Enemy" arm returns the spinner first. The FlashPunk
  type-list order between the two is not transcribed. Named, not modelled: no room has both in a wand line.
- D2 also covers RULESREF's L66 doorway case where `fineFrontierFlood` is OFF (see the two controls). The two switches overlap
  there and agree.

## Rows to BANK

- `fidelityL12Doors.test.js` (17 rows) and `fixtures/l12doors-witness/` (2 game recordings, p4g).
- The survey ON prediction: 203 / 37 (172, 203).
- At a flip: the two RULESREF controls pin `fineFrontierHiddenDoor: false`, and `contactFidelity.test.js`'s defaults row
  flips its three rows.

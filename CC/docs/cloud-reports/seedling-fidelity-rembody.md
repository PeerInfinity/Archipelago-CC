# Seedling fidelity REMBODY — a body removed this frame still blocks the bodies stepped after it

| | |
|---|---|
| Session | `seedling-fidelity-rembody` (planner `seedling-fidelity-planning-11`, wave 27) |
| Start SHA | `ba57be9a3d` (main, after SPEARRECT's flip) |
| Code head | `4de98f31` (D2). The commits after it are the bot log, the regenerated reference and this report |
| Harness branch | `claude/seedling-fidelity-rembody-7ou8gl` (the harness's branch, checked out at `ba57be9a3d`; nothing pushed elsewhere) |
| Port | 9720 (pristine base worktree: 9721; scratch-flip worktree for the probe battery: 9722) |
| Verdicts | **W0 PASS · D1 PASS (SKINSWING's L71 tapes; no second family is witnessable, see W0) · D2 PASS (`removedBodyBlocks`, OFF; 0 px ON) · Movers: STOP for a licence (list below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-rembody-evidence/` |

## The one thing to know first

**The model now has the game's rule, behind `removedBodyBlocks` (OFF). With the key ON it reproduces SKINSWING's
`skinswing-l71-resite` at 0 px for all 300 ticks. OFF still leaves the game at t63.** Locally, with the key ON, nothing
on the route moves: the FULL route survey matches OFF on all 239 steps, the 635 tapeRunner rows match, the identity
block's node rows match, and the probe battery passes 11/11. In the bounded vitest set exactly three rows go red, and
each is expected: the defaults pin, SKINSWING's known-gap pin (which a fix is meant to turn red), and the
`lavarunner-L71` skin golden (the [96,200] stand with MASKS OFF kills a body, and the survivor is now held on the
removal tick). **Js-8 can re-site `lavarunner-L71` to (80,208) once this flips.** Until then that stand is a renderer
change detector, not a fidelity claim.

## W0 (PASS)

### Banks

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9721 bash scripts/procgen/identity-block.sh .` at the pristine base worktree (`evidence/identity-before.txt`); the same at head, port 9720 (`identity-after.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640` (all exit 0). This equals SPEARRECT's published row for row. At head the file md5 is `e484c3b22d5c5b3940b1112e458a8a1b`, the same block MASKS and SKINSWING published. The base worktree's two extra lines are environmental: `generated set` needs the primary tree's venv, and the reference rows are the carried probe's |
| tapeRunner pairs | `npx vitest run tapeRunner.test.js --reporter=json`, `fullName\tstatus` sorted | 635 rows, md5 `a02def3b2b47710b8825a88cd62f6c4c`, 0 non-pass. This equals SPEARRECT's published value. Key ON: the same md5 |
| constants | `node scripts/procgen/census-seedling-constants.mjs --check` | PASS at the base (6899 literals, 0 new / 0 vanished) and at head (line moves only) |
| solver surface | `node scripts/procgen/census-seedling-solver-surface.mjs --check` | GREEN at the base (345 rows). At head it DIFFERS on line numbers only → `--write`, committed with D2 (49 `line` fields) |
| help doors | `node scripts/procgen/check-procgen-help.mjs` | ALL PASS, 463 instruments (this includes the carried SKINSWING probe) |
| procgen reference | `node scripts/procgen/generate-procgen-reference.mjs --check` | Red at the base on 6 rows, all environmental: the `bulletml-dodge` submodule is not initialised (registry/capabilities and the two matrices), plus the carried probe's instruments rows. Regenerated only what the probe and my log entry move. 4 environmental rows remain, the same as SKINSWING measured |
| bounded vitest BEFORE | `npx vitest run $(cat evidence/bounded-vitest-files.txt)` at the base worktree. The set is the brief's list ∪ SKINSWING's 72 ∪ every test that stages a chaser removal or a sibling sweep (`chasers`, `fidelityBulb*`, `fidelityLavaRunner`, `fidelityWallFlyer`, `wallFlyer`, `fidelityDrill`, `fidelityKillLock`, `killLockBodiesHook`, `r2Acceptance`, `r2Singles`, `fidelityApBosses`, `fidelityLights*`, `fidelityTentacleBeast`, `jsRuntimeBossWiring`, `jsRuntimeLightsWiring`, `bobBoss`, `shieldBossFight`, `spinner`, `solverSpinnerKill`, `seedlingHazardSkin`, the surface/constants tests) | **93 files, 2341 / 2341 passed** (`bounded-vitest-before.txt`). `fidelityL32ArenaPrefix.slow` is excluded by the default config, so it ran separately: 5/5 OFF, 5/5 ON |

**The witness carried.** SKINSWING's branch is not on this base. I carried its witness verbatim in commit `560cc596`:
`fidelitySkinSwing.js`, its test, the four `fixtures/skinswing-witness/` recordings, `probe-seedling-skin-swing.mjs`, and its
`boxLock.test.js` declared-list row. The files are byte-identical to `d5f5d985`, so a harvest of both branches merges
clean. The boxLock row is placed after SPEARRECT's, because that row is on this base and not on SKINSWING's. At the base,
all 7 SKINSWING rows are green, including the t63 gap pin.

### The removal paths (read in the model and the source)

The game: `World.remove` only queues (`World.as:118-124`). `World.updateLists` drains `_remove` after `World.update`
(`:895-911`). `Entity.collide` walks `_typeFirst[type]` and tests only `collidable` and `e !== this` (`Entity.as:146-186`),
so a removed body stays a collider until the frame ends. **The update order** is NOT the add order: `addUpdate` prepends
(`_updateFirst = e`), so the last-added entity updates first. The model already reverses the `.oel` order for this
(`stepChasersNow`, `chaserForecastNow`).

Movers whose own `solids` carry "Enemy" (only these can be held by a removed body): `Bob` (`:39`) and its subclasses,
`LavaRunner` (`:43`, + "LavaBoss"), `Puncher` (`:48`, + "Player"), `Jellyfish` (`:35`), `Drill` (`:35`), a pushed
`IceTurret` (`:148`), `PushableBlock(Fire)` (`:28`/`:31`), `WandShot`/`RayShot` (projectiles; they hit, they do not
sweep). `Flyer.solids = []` and the Spinner's and the player's lists lack "Enemy".

| removal (model) | game | mid-frame? | later readers that list its type, in the model's order | before REMBODY | after (key ON) |
|---|---|---|---|---|---|
| chaser fade (`stepChaserEntity`'s destroy branch; a pit fall ends there too): bob, bobsoldier, puncher, jellyfish, lavarunner, flyer, the King of Fire's runners | `Mobile.death` → `FP.world.remove` | yes | the chasers stepped after it in `stepChasersNow` (siblings with "Enemy") | dropped at once: **the witnessed gap** | a wall to the rest of the call (D2) |
| bulb "die" end (`stepBulbGraphicNow`, inside the chaser loop) | `Bulb` → `FP.world.remove` | yes | the same siblings | dropped at once | a wall to the rest of the call (D2; no witness: no AP_1 bulb dies beside a later sibling on a tape) |
| forecast: BobSoldier corpse fade, bulb "removed" (`chaserForecastNow`) | as above | yes | the clones stepped after it | dropped at once | mirrored (D2). A plain corpse is never faded in the forecast, see residue |
| forecast: a forecast kill's `dyingAt + removalTicks` | as above | — | — | removed at the END of the forecast tick, after every body stepped: already the game's timing | unchanged |
| drill fade (`drill.js:106`, inside `stepDrillsNow`) | `Mobile.death` | yes | chasers (`drillWallsNow`) and later drills (`drillEnemyBodiesTest`) | dropped at once | **unchanged, named residue** (no witness; see below) |
| wallflyer fade (`wallFlyer.js:292`) | `Mobile.death` | yes | drills' hop test (wallflyers are stepped before drills) | dropped at once | **unchanged, residue** |
| ice turret death (`turretStateFor` `t.removed`) | `FP.world.remove` | yes | chasers (`chaserStaticEnemyBoxesNow`) | dropped at once | **unchanged, residue** |
| spinner (`spinner.js:371`, `removePending` → `removed` on the next step) | `Mobile.death` | — | — | already deferred one step | unchanged |
| static bodies (`stepStaticBodiesNow`, `removedAt`) | `Mobile.death` / anim end | yes | not swept by any "Enemy" mover in the model | — | unchanged |
| shield boss / totem / King of Fire / Lights fliers (`removeRequested`, `drain…Removals`, `f.removing`) | `FP.world.remove` | — | — | already modelled as `updateLists` | unchanged |

**Is a second family reachable on AP_1 as a witness?** Not within this slice. A drill, wallflyer or turret removal only
matters if, on the same frame, an "Enemy"-listing mover that updates later is sweeping into the removed body's box. The
drill case needs a drill kill in a mixed room. On this base the solver never kills a drill (DRILLKILL's `execDrillKill`
is not here), and the sweep's chaser rooms hold no drill beside a chaser that a tape kills. So D1 stays with the L71 tapes
and the other families are residue, named and unmodelled.

## D1 — the witness (PASS; p4g, SKINSWING's recordings)

No new recording. The L71 resite tape (`skinswing-l71-resite`, L71 (80,208), FIGHT ×300, played on p4g twice by SKINSWING)
is the witness. On t63 the game removes three lavarunners, and its `lavarunner@64,192` stays at y 203.303 because a
removed body still in the "Enemy" list holds it.

## D2 — the model (PASS; `CONTACT_FIDELITY.removedBodyBlocks`, OFF)

**Change** (`levelRun.js`; `4de98f31`).
- `stepChasersNow` builds `removedThisFrame` (a `Set`, `null` OFF) per CALL and adds each body its loop removes, both
  the fade and a bulb's "die".
- `stepChaserEntity`'s sibling sweep skips `o.removed` only when `o` is not in that set.
- `chaserForecastNow` mirrors this per forecast tick for the removals it steps (a BobSoldier corpse, a bulb).
- `removed` is still set at once, so every other reader (arrows, bombs, the kill-lock ledger, the census, the skin) is
  unchanged.
- OFF, `removedThisFrame?.has(id)` is `undefined` and the test reduces to the old `o.removed`, so it is byte-identical
  by construction.

The set is per call because a ceremony's stepped dead frames call `stepChasersNow` once per frame
(`stepCeremonyDeadFrameNow`). A per-model-tick field would keep a corpse a wall across 149 dead frames.

**Digest.** No run state was added: both sets are locals that are discarded before the call returns. They are not
per-visit maps, `freshVisitState` does not reset them, and nothing reads them across ticks. So no digest part or
`DIGEST_EXEMPT` row is owed, and the `levelRunStateDigest` GUARD row is green. Nothing the escape reads was added.

**Witness rows** (`fidelityRemBody.test.js`, 7):

| row | result |
|---|---|
| ships OFF | ✓ |
| `skinswing-l71-resite`: ON = the game, all 300 ticks; OFF the first divergence is `t 63 lavarunner@64,192 … 203.303 … 204.467` | ✓ |
| `skinswing-l71-lavarunner`, `-l74-bulb`, `-l74-resite`: ON = OFF = the game at 0 px | ✓ ×3 |
| the forecast taken at t58: ON its t63 survivor is the live one (0 px) | ✓ |
| the forecast, OFF: the live step moves the survivor 1.164 px past the forecast, because the forecast holds its corpses (see residue) | ✓ |

**Mutants** (each predicted first; copy + edit + run + restore; the tree was `cmp`-verified after):

| mutant | predicted | measured |
|---|---|---|
| m1 `stepChasersNow` never adds to `removedThisFrame` | the ON tape row reds at t63; the forecast rows stay green | the ON tape row red (50 divergence rows from t63) **and the forecast ON row red**, which I had mispredicted: that row compares the forecast with the LIVE step, and the live step is what m1 breaks |
| m2 the set is never cleared (one set for the whole process) | the ON row reds after t63 | the ON row red, but by a throw, not a position: the kill-lock ledger refuses `the removal of lavarunner@6…` (a set leaked across runs). Red either way |
| m3 the forecast reader skips every removed body (the OFF reading) | nothing here reds, because the forecast removes no plain corpse | 7/7 green, as predicted. The forecast arm has no witness (named) |

## The movers (key ON) — STOP for a licence

| measurement | OFF | ON | movers |
|---|---|---|---|
| route survey, FULL, local (`survey-seedling-route.mjs --through=end --route=full`; ON in a head worktree with `SEEDLING_REMOVED_BODY_BLOCKS=1`) | 239 steps: 185 SOLVED / 53 REFUSED / 1 TIMEOUT | the same | **0**. Every row is equal except `ms`; `survey-full-{off,on}.txt` md5 `eab5c1c2…` both |
| the 41 + 2 survey steps in rooms the switch can reach (below) | 23+2 SOLVED / 18 REFUSED | the same, ticks and hits too | 0 |
| tapeRunner pairs (635) | `a02def3b…` | `a02def3b…` | 0 |
| identity block (node rows; the page rows read the page's own defaults) | md5 `e484c3b2…` | md5 `e484c3b2…` (byte-equal) | **0** (the node rows and the six producer `--check`s; the page rows run at the page's own defaults) |
| bounded vitest (94 files, with `fidelityRemBody`) | 2348 / 2348 | **3 red** | see the list below |
| `fidelityL32ArenaPrefix.slow` | 5/5 | 5/5 | 0 |
| standard probe battery, local, scratch flip (port 9722) | — | **11/11 ALL CHECKS PASSED**, `wasm-arrival-composites` included (95 PASS rows); `probe-battery-standard-on.txt` | **0** |

**The three bounded-vitest reds with the key ON** (`bounded-vitest-on.txt`):
1. `contactFidelity.test.js` › "the shipped defaults: all three ON". This is the defaults pin, read against the live
   switch set. A flip re-pins it to `removedBodyBlocks: true`. It is an artefact of the env-var arm.
2. `fidelitySkinSwing.test.js` › `skinswing-l71-resite`'s known-gap pin ("ON and OFF agree … t63"). This is the fix
   working. A flip re-pins it to 0 px: ON(`removedBodyBlocks`) = the game, and `fidelityRemBody`'s OFF row keeps the t63 fact.
3. `seedlingEnemySkin.test.js` › "the lavarunner-L71 tape: every tick's LavaRunner ops". The [96,200] stand runs with
   `pixelMaskSightLines` OFF, so its swings kill. At t95, the tick the first corpse is removed, the survivor
   `lavarunner#…@(79.814, 216.542)` is now held where OFF it stepped to 215.658. From there the golden's ops move. The
   golden is re-recorded under a flip (`UPDATE_SKIN_GOLDENS=1`), or retired when js re-sites the stand (below).

`seedlingHazardSkin` and every other row of the set are green ON.

**The keyed sweep set** (`evidence/chaser-pair-rooms.mjs` on legs derived at this base,
`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`: 850 legs). A removed body can only hold a body
stepped after it, so the rooms that matter hold ≥ 2 stepped chasers, at least one of which lists "Enemy". There are 26
such rooms: L5, 6, 14, 16, 17, 25, 26, 40, 53, 54, 60, 63, 71-75, 77, 78, 80, 91, 92, 98-100, 105. L82 is added for the
King of Fire's runtime runners: `kingOfFireFight` is ON at this base, though the brief lists it OFF. That gives
**193 legs** (`leg-keys-chaser-pair-rooms.txt`; `|`-joined in `leg-keys-chaser-pair-rooms.joined.txt`). Not run here:
the sweep is CI's.

### The dispatches the planner should run (this branch, `claude/seedling-fidelity-rembody-7ou8gl`)

The two arms (`evidence/contact-fidelity-arms.txt`):
- **ARM A** = the 49 defaults:
  `collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,igneousLava,lightsBossFight,kingOfFireFight,tentacleBeastFight,ropeCutVerb,chestProbeLineEnd,enclosedPitCorner,igneousDeadFrames,ropeCutAnyWeapon,drillMixedRooms,yetiTalk,pixelMaskSightLines,spearGameTest`
- **ARM B** = ARM A + `,removedBodyBlocks`.

1. `seedling-survey.yml` `through=end route=full`, ARM A and ARM B. Compare by (level, goal, boot) with each other and
   with **39496129402**. Expected: ARM A = ARM B (0 movers, as measured locally on all 239 steps).
2. `seedling-divergence-sweep.yml` `keys=<leg-keys-chaser-pair-rooms.joined.txt>`, `capture_requests=true`, ARM A and
   ARM B, **×2 each**. Expected: no settled mover. A leg that moves on a kill tick is the switch at work. Decide it by
   replaying the captured request (`replay-seedling-solve-request.mjs --seam-time-sweep`), never by one row. List every
   `producer:walker` row that moves. The walker was not edited, but it drives the same `stepChasersNow`.
3. `seedling-probe.yml battery=standard` on a scratch commit that flips the default. The workflow has no contact-fidelity
   input. Expected: 11/11, as measured here.

## The JS arc (js-8)

- **What it can re-site:** `seedlingEnemySkin`'s `lavarunner-L71` stand to **(80,208)**, once `removedBodyBlocks` is ON.
  SKINSWING measured that stand meets every `want` row (walk, die, tint, mirror; 244 'die' frames ON). With this key ON,
  the model reproduces the game's (80,208) FIGHT run at 0 px for all 300 ticks, so the stand becomes a fidelity claim
  too. In the same commit:
  - **re-pin:** re-record the golden at (80,208) (`UPDATE_SKIN_GOLDENS=1`) and drop the `pixelMaskSightLines: false`
    pin (and the ON = 0-die row) for that stand;
  - `fidelitySkinSwing.test.js`'s first row reads the TAPES rows as text and needs its stand witnesses re-pointed
    (SKINSWING's hand-over);
  - re-pin SKINSWING's `skinswing-l71-resite` gap row to 0 px under the default.
- **Before the flip:** a re-site to (80,208) works as a renderer change detector only, because OFF the model leaves the
  game at t63.
- **To wire:** nothing. There is no new staging or result field, no new `SolverRefusal.obstacle.kind`, and no `run.*`
  field was renamed or reshaped. The skin reads `run.chasers`, unchanged.

## Hammer arc

Nothing handed over. No hammer-owned function was edited. `chaserForecastNow` (the chaser mirror) is not on the hammer
list. Its plain-corpse gap below is named for whoever owns the forecast.

## Deltas

- New: `CONTACT_FIDELITY.removedBodyBlocks` (OFF; `SEEDLING_REMOVED_BODY_BLOCKS=0|1`), `fidelityRemBody.test.js` (7 rows).
- `levelRun.js`: `stepChasersNow`, `stepChaserEntity` (an optional `removedThisFrame` in its context), and `chaserForecastNow`.
- `contactFidelity.test.js`: the defaults row gains `removedBodyBlocks: false`. The flash panel's contact settings are
  generated from `CONTACT_FIDELITY_KEYS`, so the switch appears there with no edit.
- `seedling-solver-surface.json` (`--write`, line numbers only).
- Carried from SKINSWING: `fidelitySkinSwing.{js,test.js}`, `fixtures/skinswing-witness/`, `probe-seedling-skin-swing.mjs`,
  and a `boxLock.test.js` row.
- `seedling-bot-log.md`: the REMBODY entry. The generated reference was regenerated for it and for the carried probe.

## What the brief got wrong (measured)

1. "`World.update` iterates `_updateFirst` in add order": `addUpdate` PREPENDS, so the order is the **reverse** of the
   add order. The model already reversed the `.oel` placements.
2. "the pinned row `fidelitySkinSwing.test.js` … a fix turns it red": that file is **not on the base** (SKINSWING's
   branch is unmerged; its base is `3ac4f7751d`). I carried it here byte-identical. A fix behind an OFF key also leaves
   the default-arm pin green; it reds only with the key ON, as measured.
3. "`kingOfFireFight` … OFF": it is **ON** at `ba57be9a3d` (49 ON keys, including `kingOfFireFight`, `igneousLava` and
   `lightsBossFight`). So the King of Fire's runtime lavarunners are stepped chasers that this switch reaches, and L82's
   legs are in the keyed set.
4. "`apReportBosses`" in the bounded set has no test file named that. The test is `fidelityApBosses.test.js`.

## Residue

- **The other families' removals** (drill, wallflyer, ice turret) still drop at once for a later "Enemy" mover in the same
  frame. All are unwitnessed, and none is witnessable on AP_1 without a drill/turret kill beside a later mover (W0).
  When DRILLKILL lands, a drill killed beside a chaser becomes reachable. Then the same set belongs in `stepDrillsNow` →
  `drillWallsNow` / `chaserStaticEnemyBoxesNow`, behind this key, witness first.
- **`chaserForecastNow` never fades a plain corpse.** Its destroy branch steps only a BobSoldier's, so every corpse
  cloned into a forecast stays a wall for the whole forecast. On the removal tick that happens to be the game's answer
  (OFF the forecast "agreed" while the live step did not). From the next tick on it is wrong in the other direction: the
  t64-t69 drift in both arms (`evidence/forecast-probe.mjs`: 1.164 → 2.742 px). This is a forecast gap of its own,
  queued for the model.
- **A pushable block's sweep ignores chasers** (`pushableCtx` tests spinners and the player only, though
  `PushableBlock.solids` carries "Enemy"). This is pre-existing and outside this slice's region. Named.

## Byte-inertia

By construction, OFF is the old predicate (`o.removed && !undefined`). Measured OFF:
- the bounded set is 2348/2348, the BEFORE rows plus the 7 new ones;
- tapeRunner pairs `a02def3b…` (equal to the published value);
- the identity block equals the base (every row; the head file md5 `e484c3b2…` is the one MASKS and SKINSWING published);
- constants PASS, surface line shifts only.

## Rows to BANK

- `fidelityRemBody.test.js` (7 rows): the witness ON 0 px / OFF t63, the three ON = OFF tapes, the forecast pair, and the
  default.
- The fact: **a FlashPunk body removed this frame is still a collider to every body updating after it that frame**
  (`World.remove` queues; `updateLists` drains after the frame). Witnessed on p4g at L71 t63.
- The keyed-sweep derivation `chaser-pair-rooms.mjs` (re-derive at any base; rules re-key legs).

# Seedling fidelity L74LEG624 — a press is gated on its hit tests, a fallen rock is built fallen, and the forecast's lavarunner swims

Slice `seedling-fidelity-l74leg624` (Opus, cloud), planner `seedling-fidelity-planning-6`, wave 14 (model coverage).
Hand-over: hammer C4 (`seedling-hammer-c4.md`), divergence leg 624 by KEY `level_74 <- in_L73_64_0 ->
exit:out_teleporter_16_144` (id 624 at this base).

| | |
|---|---|
| Start SHA | **`8654f02a4c`** (`8654f02a4c18d3d344963fffe4ac999b9e7459e6` = the brief's base; not rebased) |
| Head | the commit carrying this report (code `a203ee3`, `0b735ec`, `3720730`, `0173119`; records after) |
| Branch | `claude/seedling-l74-leg624-rl4n8f` (the harness's; the brief's `seedling-fidelity-l74leg624`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9652` (`SEEDLING_PORT=9652`), PID 562, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (STOP for the flip: 21 bounded movers, 2 identity rows) · D4 PASS: leg 624 SOLVES, 331 t, 0 hits on the game, with all three switches ON** |

## The one thing to know first

**Leg 624 solves hitless with three switches ON, and it takes all three walls, not two.** C4 named the i-frame gate and
the fallrock re-entry. A third was under them: `chaserForecastNow` never ran K2's LavaRunner speed tail, so every
preview of a lavarunner crossing lava certified a walk the drive did not take. With `strikeIframeLapse` +
`forecastSpeedByTerrain` (+ `fallRockPostFall` for the re-entry) the anytime answer is a 331-t detour; on p4f the player
is at 0 px at every tick but the known t1–t2 arrival frame, 0 hits, and it arrives in L75 at (72,24).

Second thing: **the solver returns plans with unbilled hits and deaths.** Two draft configurations "solved" 624 with a
game-confirmed bulb hit at t362, and with four or five lava deaths. `drive` bills them and walks on; nothing compares
the drive with the preview it certified. That is not this slice's region (below, residue 1).

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout` of the harness branch at `8654f02a4c` | `8654f02a4c`; bootstrap `READY`, node v22.22.0; five non-wasm submodules uninitialised again, `git submodule update --init` on each |
| identity block | `SEEDLING_PORT=9652 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`77080c2ed34820619273d5d9d6fcdaa9`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK, reference ALL 7 + 5 MATCH |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| tapeRunner pairs | in the bounded run; sorted `status\tfullName`, md5 | **611**, `86af85259c2ab3a51b1f0ebb409743f4` |
| surface / constants / entities / profile | each `--check` | GREEN **277** · PASS **5,808** · PASS 558 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE | 75 files: the brief's list + every non-slow test naming `strikeCandidates`, `createStrikePolicy`, `vetoedInRect`, `strikePolicy`, `REFUSED_CLEAR_RESPONSES`, `PERSISTENCE_RESPONSE`, `arenaRockOf`, `fallenAtBuild`, `createFallRock`, `fallRocks`, `CONTACT_FIDELITY_KEYS`, `contactSchemaProps`, `fallrock` (`rg -a -l`), `solverBot*.test.js`, `tapeRunner`, surface/constants | **3,035 / 3,035**, md5 `7cc72973c54e4c069c00d58f5730fe22` |

The reproduction: LEASH's leg driver (`drivers/leg.mjs`, the sweep row's items/slots, `BUDGET=2560`, both anytime
passes) refuses 624 with C4's text, byte for byte between base and head (OFF). ⚠ `acceptance batch` is `933c14f7`, not
C4's `76602ae8`: wave 13 moved it (FORCEDHIT's refusal line), so the brief's base is C4's base plus that.

## D1 — the rock's state (PASS)

**The game's own state.** L74's landing cell from the L73 door is `button@288,128` (t0), and `fallrock@288,144` (tag 2,
t0) hangs over the L73 teleporter at (288,144). The arrival frame drops it; `fall()` writes {74,2} itself, so the
game's `persistence_cleared` holds {74,2} from that visit on. `FallRock.as:42-47`: a later `new Game(74)` builds it
**fallen** — `y = fallTo`, `type = "Solid"`, `_active = true` (the button's `set activate` cannot drop it again), and
`cameraTimer = 0`, so its first `update()` takes the `cameraTimer == 0` arm (`freezeObjects = false`,
`resetCamera()`: both statics already at their defaults on L74's routes, so a no-op; not modelled, named). Its
`update()` snaps an overlapping player onto its top on every tick; the player cannot overlap a Solid by walking, so
that arm is reachable only by an arrival inside the cell (none on the roster).

**Measured on the game.** `FallRock` is not a `Mobile`, so `botMobiles` never reports it (⚠ the brief's
`--class=FallRock` exits 2: no `CHASERS` row). It is read through the player: tape `l74leg624-postfall-reentry` boots
L74 at (288,128) with {74,2} staged and holds down from t0. On p4f headless the player stops at y = 141 (the rock's top,
144, minus the box's 3) and rests there for t8–t20; it never reaches the teleporter under it, and the clock calibrates
at shift exactly **[0]** — no arrival freeze, because the button has nothing to drop. That is the rock's position, its
solidity and its persistence, measured.

**Census** of every `fallrock`/`fallrocklarge` a clear list can name (atlas, `tagOf`):

| level | rock | tag | publisher | post-fall build ON |
|---|---|---|---|---|
| 28 | `fallrock@112,240` | 1 | `rope@160,64` (t1) | built fallen |
| 29 | `fallrock@112,112` | 0 | `button@112,128` (t0) | built fallen |
| 32 | `fallrocklarge@64,128` | 1 | the BobBoss arena (`arenaRockOf`) | already built fallen (ENCOUNTERS D2) |
| 37 | `fallrock@288,32` | 4 | `totem@280,80` | removed on the delivered set (`l37-fallrock-removed`) |
| 39 | `fallrock@144,624` | 10 | `rope@96,384` (t6) | built fallen |
| 43 | `fallrock@96,336` / `@192,336` / `@176,384` | 2 / 1 / 3 | `wand@144,224` (t0) | built fallen |
| 74 | `fallrock@288,144` | 2 | `button@288,128` (t0) | built fallen |
| 82 | `fallrocklarge@128,224` | 1 | none (`bossrock`, not `thirdboss`) | **still refused** (its own `update` arm, unread) |

**Who stages one.** No divergence leg stages a fallrock flag (`seedling-divergence-legs.mjs`: 35 staged arrivals, none
a fallrock tag). The page stages {74,2} from the game's own state on any L74 build after the L73-door arrival (C4's
anticipate-4 death rebuild, and sweep 38185510484 by `stage_flags`). No survey row names a fallrock (survey
38168138687: 0 rows).

## D2 — the post-fall build (PASS)

`CONTACT_FIDELITY.fallRockPostFall` (OFF). `levelWorld.postFallRockOf(e)` admits the clear for a non-arena `fallrock`
in `buildLevelWorld`'s refusal branch and marks the roster row `postFall: true`; `levelRun.fallRockStateFor` builds
that row `createFallRock(x, y, t, tag, true)` with `landed: true` (one line in its own function), so `fallenRocksNow`
hands its 16x16 box to `collidesSolid` and `solidBoxesForMover`, and `armButtonFallRocks`/`publishRopeGroup` skip it
(`landed`/`active`). `fallrocklarge` outside the arena stays refused.

**Witness** `fixtures/chaser-witness/l74leg624-postfall-reentry.json` (`probe-seedling-chaser-mobiles.mjs --class=LavaRunner
--player-hits --record`, model ON): 71 player samples at 0 px, clock shift [0], 142 LavaRunner comparisons worst 0.
`fidelityL74Leg624.test.js` replays it at 0 px ON and asserts the OFF refusal.

**Mutants** (predicted red, made by copy + restore): `fallRockStateFor` builds it parked → the witness replay row red;
`postFallRockOf` returns false → the four ON rows red.

## D3 — the i-frame gate (PASS; the flip is a STOP with the list)

`CONTACT_FIDELITY.strikeIframeLapse` (OFF). `Enemy.hit`'s `hitsTimer > 0` gate runs on each TEST tick (`T+1 …
T+SLASH_HIT_TICKS`), not on the press tick. `strikePolicy.iframeLapse(hitsTimer, tick, pressAhead, spare)` asks, from
the one-tick-old reading, `projectedHitsTimer(hitsTimer, pressAhead + i − 1)` at each test `i` — the dash projection's
own two lags — and admits a body when a test reads ≤ 0 with `IFRAME_LAPSE_SPARE_TESTS` (1) still to run. An aim
(`pressAhead` 1) admits a reading ≤ 6; a press on this tick (the planned press, `pressAhead` 0) ≤ 5. C4's witnesses fall
out exactly: reading 5 at t83 and 4 at t84 → the landing test at t87. The aim row carries `iframeLapse {hitsTimer,
firstTest, firstTick}`.

- **The spare test, measured.** The first cut admitted the window's last test (reading 7). On L6 (R9 slice 12b's
  equality room, `bob@112,48`) an aim at reading 7 pressed at t37, the bob's timer still read 1 at the last test, the
  press landed nothing, its contact billed at t43, and the preview/drive key equality parted (`solverBot.test.js`'s two
  12b rows red ON). One spare test turns both green; two changes nothing more on the bounded set (21 vs 22 movers).
  At L74 a reading-7 press did land (evidence `game-l74-624-lapse7-stance-88-72.json`): the margin is the drain, not
  the room.
- **`spent`.** ON, a body in its death is refused (`Enemy.hit`'s `hits < hitsMax`). The forecast drains a dying body's
  frozen i-frame where the drive's body has already left `strikeBodies` (`destroy`); on 624 the preview aimed at the dying
  `lavarunner@208,96` at t114 and the drive did not. Both strike-body shapes carry `spent` (ON only; OFF the shapes are
  byte-identical).
- **The veto** (`vetoedInRect`) asks a body whose i-frame lapses anywhere in the window, with no spare test: a body
  that MIGHT die is vetoed.
- `owed` and `ORDINARY_SWING_PERIOD`'s dash refusal are untouched; their rows are green ON.

**Witnesses.** C4's `press84`/`press85` (game, 0 px, no hit) are inside the final rule (readings 5, 4). The policy's own
decision on C4's stance (264,120) walk (`drivers/policywalk.mjs`: the walk's movement keys, the presses decided by the
policy on the live run as `drive` does): OFF it is C4's exactly (aim t54/press t55, aim t87/press t88, the hit at t87);
ON it aims at reading 6 (t81) and presses at t82, the shield shoves the body out of the swing, its lapse at t87 finds it
22 px away, and the t102 press kills it. Played on p4f: **0 hits**, LavaRunner 0 px over 262 comparisons, the player at
0 px but t1–t2 (`game-l74-624-policy-walk-lapse.json`).

**Mutants**: the projection's offset +1 → 4 rows red; the spare test removed → 2 rows red; `spent` ignored → its row red.

**The mover census, ON** (every other switch at its default):

| instrument | moves |
|---|---|
| identity block | **ENEMY census** `afdc6d1a` → `36b59445`: `bob` 141 → **268 t** (now `kill, collect`), `bobsoldier` REFUSED → **SOLVED 172 t**, `jellyfish` 172 → **252 t** (`kill, collect`), `lavarunner` 228 → 225 t; CORRIDOR arm 8 → 9 solved. **`solve-seedling-r9-campaign --check`** `712f0ead` → `dce96321` exit 1: **`r9-solve-14` 98 → 103 t, `r9-solve-16` 688 → 655 t** (both 0 hits, calm arrivals; `r9-solve-15`/`-18`'s declared `seam.time` oracles follow). Every other row and the other five `--check`s: unmoved |
| tapeRunner (611 replays) | none (`86af8525`) |
| bounded vitest (86 files) | **21 rows in 8 files**: `fidelityBobSoldier2` (4: survey step 50's switch-by-switch rows, its plan IS-the-witness row), `fidelityIceTurretSpear` (1: the C3 ON plan's tape), `fidelityL30KeyLock` (5: the pit-landing switch rows, the chaser arm's stance), `fidelityLeash` (1: leg 629's OFF/ON bait row), `ropeSword` (1: the PULL rung's swing tick), `seedlingCanCross` (2: `cancross-l16-sword-none`, the default dash plan), `solverBot` (6: 12b′'s derived stances ×4 and its dwell bound, 12c's stance dash count and the L14 dash chain), `solverDeadline` (1: the kill-chaser stance) |

**STOP for the flip.** The switch moves 2 identity rows and 21 bounded rows, so it ships OFF and the flip is the
user's licence. ⚠ `bob` and `jellyfish` get **slower** in the ENEMY census (a kill rung inserted before the collect),
`bobsoldier` newly solves: the gate is right about the game, but what the solver does with an earlier press is not
uniformly better. Measure before licensing.

## D4 — leg 624 end to end (PASS)

**The third wall.** With the lapse gate alone, 624 first "solved" 458 t by a detour, and that plan played on the game
at 0 px — including a hit from `bulb@48,112` at **t362**, on the game and in the model, billed nowhere. The detour's
certified preview and its drive part at **t53**: `lavarunner@208,96` steps 1.15 px in the preview and 0.1 px in the drive.
K2 put `LavaRunner`'s terrain speed (swim 1 on water or lava, walk 1.5 elsewhere; `LavaRunner.as:82-92`) into
`stepChasersNow` and not into `chaserForecastNow`, so a previewed lavarunner kept its seeded speed across lava.
`CONTACT_FIDELITY.forecastSpeedByTerrain` (OFF) runs the same tail on the clone; a unit row proves the forecast and the
run agree at every tick of L74's crossing ON and part OFF (mutant: the block off → red).

**The run, all three ON** (node, the sweep row's staging, `BUDGET=2560`; `node-runs.json`):

| config | dashless | full | anytime |
|---|---|---|---|
| OFF (base = head) | refused (C4's text) | refused | refused |
| `fallRockPostFall` only | refused (C4's text) | refused | refused |
| `forecastSpeedByTerrain` only | the fallrock refusal (a lava death's rebuild) | same | refused |
| `strikeIframeLapse` only | the fallrock refusal | same | refused |
| lapse + postfall | "solves" 1,442 t with **5 lava deaths** | "solves" 1,269 t with **4 lava deaths** | — (unusable) |
| lapse + speed | — | — | **331 t** |
| **all three** | refused by name (fidelity-bulb: "killed and then destroyed by the terrain under it", t384) | **331 t, `detour`** | **331 t** |

**The game witness** (p4f headless, `--player-hits`; `tape-l74-624-on-plan.json`, `game-l74-624-on-plan.json`): 332
samples; the player matches at every tick but **t1–t2** (the known L74 arrival frame, Δy +0.8/−1.35, re-converging at
t3; the reason the probe's clock line reads FAIL and the run cannot be `--record`ed, as for C4's and LEASH's 624
tapes); **0 hits** on both sides; ends in **L75 at (72,24)** on both; LavaRunner worst |Δ| 1.3e-15 over 445 comparisons;
Bulb positions at 0 px over 331 comparisons (its **velocity** differs from t305 in the drop death: game ≈ ±5, model 0 —
fidelity-bulb's, position-neutral). The plan kills `lavarunner@208,96` (t81), strikes `lavarunner@24,56` once and kills
`bulb@48,112` (t298; its lava write). **No forced hit** is planned (no `forcedHits` on the plan); OFF the forced-hit rung
cannot prove one either ("the model refuses to step [primary ·]": a press into the arrival freeze).

**Neighbours, all three ON** (node): 622 forced-hit 4 t (= OFF); 628 refused, byte-identical to OFF (the skirt stance
waypoint). ⚠ 628's goal is the L73 teleporter at (288,144), **under the rock**: in a real playthrough every L74 visit
after the L73-door arrival has the rock down, so that exit is closed by the game. The sweep stages 628 from inventory,
not from the live persistence, so it does not see that.

## The survey/sweep rows this moves, and the CI dispatches (planner)

| row | before (this base, OFF) | after (all three ON), node |
|---|---|---|
| sweep leg 624 `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` | REFUSED (combat ladder exhausted; forced-hit unproven) | **done, 331 t, 0 hits** (game-witnessed) |
| sweep leg 622 `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` | forced-hit 4 t | unchanged |
| sweep leg 628 `level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144` | REFUSED (skirt stance) | unchanged |
| survey (38168138687) | no step re-enters L74 from the L73 door; no row names a fallrock | not measured ON (the survey has no `contact_fidelity` input) |

Dispatches (cloud sessions get 403):

1. `seedling-divergence-sweep.yml`, ref `claude/seedling-l74-leg624-rl4n8f`: `mode=inv`, `producer=solver`, `shards=1`,
   `keys=level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield|level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144|level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield`,
   **`contact_fidelity=all`** (every key ON = the defaults + the three). Expect 624 `done` 331 t.
2. The same with `contact_fidelity` empty: the baseline at this head (expect C4's verdicts).
3. The same `keys` (624 alone is enough) with `contact_fidelity=all` and
   `stage_flags=level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144=>74:2` (sweep 38185510484's staging): the re-entry
   case `fallRockPostFall` builds. ⚠ 38185510484's page timed out silently (the JS arc's); a repeat tells whether the
   model now answers.
4. A/B per switch: `contact_fidelity=<the 13 default keys>,strikeIframeLapse,forecastSpeedByTerrain` (expect 624 done
   331 t without postfall, per node).
5. An ON survey needs a measurement commit flipping the defaults; not provided (the switches ship OFF).

## The JS arc's pins and what it must wire

- **Nothing moves in its region** at the defaults: `jsRuntimeDeclarations` and the JS pins in the bounded set are green
  OFF; no signature changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched).
- **Wiring:** none required — `seedlingContactSettings.js` derives a setting per `CONTACT_FIDELITY_KEYS`, so the three
  keys appear as `seedlingContactStrikeIframeLapse`/`…FallRockPostFall`/`…ForecastSpeedByTerrain` with default false,
  and the sweep's `contact_fidelity=` sets them.
- **Theirs, measured here:** (a) the L74 arrival frame (game frozen at t1, model at t2; every L74-from-L73 tape shows
  Δy +0.8/−1.35 at t1–t2). `levelRun`'s button arm resolves the drop one tick after the press; the game's `Button`
  sees the landing cell on the first frame. (b) the solver's acceptance: plans came back with an unbilled game-confirmed
  hit (t362) and with 4–5 deaths; nothing compares a drive with the preview it certified.

## Handed to the hammer arc

- Their L74 chooser tweak can now be measured against a solving leg: with all three switches ON, 624's climb passes
  the kill rung (the chooser's list, unchanged) and the DETOUR rung solves it (the trace's one verb), so the chooser's
  choice no longer blocks 624. Whether their tweak still buys anything there is theirs to measure.
- ⚠ The 12b′ derived-stance rows and the kill-chaser stance (`solverDeadline`) move ON — their `deriveStrike`/stance
  pins are the movers listed above; a flip of `strikeIframeLapse` owes their re-pins.

## Deltas (base → head)

- Code: `contactFidelity.js` (+3 switches, all OFF, with env hooks `SEEDLING_STRIKE_IFRAME_LAPSE`,
  `SEEDLING_FALLROCK_POSTFALL`, `SEEDLING_FORECAST_SPEED_BY_TERRAIN`); `strikePolicy.js` (`iframeLapse`,
  `IFRAME_LAPSE_SPARE_TESTS`, the gate, `spent`, the veto, `pressAhead`); `levelWorld.js` (`postFallRockOf`, the
  refusal branch, the `postFall` row); `levelRun.js` (`fallRockStateFor`'s one line, `spent` on the two strike-body
  shapes, the forecast's speed tail).
- Tests: `fidelityL74Leg624.test.js` (13 rows); `contactFidelity.test.js`'s defaults pin (+3 OFF keys).
- Fixture: `fixtures/chaser-witness/l74leg624-postfall-reentry.json` (no roster tape; no pin reads chaser witnesses by
  directory).
- Censuses: surface `--write` (277 rows; `strikePolicy`'s `CONTACT_FIDELITY` through the door), constants `--write`
  (5,808 → 5,809: `IFRAME_LAPSE_SPARE_TESTS`).
- Docs: `seedling-bot-log.md` § *Seedling fidelity L74LEG624*, `seedling-bot.md` paragraph after FORCEDHIT's, the
  regenerated reference (README count line, docs index).
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-l74leg624-evidence/` (tapes + slim game/model samples, `node-runs.json`,
  `drivers/`: the scratch drivers and the lab instrumentation diff).

## Byte-inertia (OFF)

| row | result |
|---|---|
| identity block at head, OFF | every row = W0; non-`#` md5 **`77080c2ed34820619273d5d9d6fcdaa9`** (= W0); reference ALL 7 + 5 MATCH |
| each switch ON, identity | `fallRockPostFall`: identical to OFF; `forecastSpeedByTerrain`: identical; `strikeIframeLapse`: ENEMY + r9-campaign (D3) |
| tapeRunner | 611, `86af8525` OFF and under each switch |
| bounded vitest AFTER, OFF | 86 files (W0's 75 + `bossTotemFight`, `fidelityBobSoldier2`, `fidelityBulb`, `fidelityL30KeyLock`, `fidelityL74Leg624`, `fidelityLavaRunner`, `killLockBodiesHook`, `levelWorldBroadPhase`, `presses`, `solverPrefix`, `spinner`: every `rg -a` hit for `chaserForecast`, `strikeBodies`, `previewWalk`, `speedByTerrain`, `nearestWalkableTile`): **3,243 / 3,243**, md5 `d764cdf3…`; W0's 75 files: their 3,035 rows byte-identical, plus 3 new (`contactFidelityHook`'s one-setting-per-switch rows for the three keys) |
| 624 OFF | the refusal text byte-identical to the base's |

## What the brief got wrong (measured)

1. *"Two model blockers"*: three. The forecast's missing LavaRunner speed tail is what made the lapse-only plan take a
   game-confirmed hit at t362; without it no configuration solved 624 hitless.
2. *"Fix = admit the press when the one-tick-old `hitsTimer` ≤ the ticks until its tests pass the lapse"*: that rule
   (last test) is one test too greedy. L6 measured a last-test press landing nothing and the preview/drive equality
   parting; the shipped rule keeps one spare test.
3. *"`probe-seedling-chaser-mobiles.mjs --class=FallRock`"*: exits 2 (no `CHASERS` row; `FallRock` is not a `Mobile`,
   so `botMobiles` cannot report it). The rock is measured through the player.
4. *"L74 FALLROCK RE-ENTRY … the walk re-enters L74"*: in every configuration measured here the re-entry was a **death
   rebuild** (`restartLevel`, `levelRun.advance` → `enterWorld`) after a lava death (t119) that `drive` did not notice,
   not a door (C4's stack has the same `advance` → `enterWorld` frames). The final plan never re-enters L74; `fallRockPostFall`
   is what lets a death or a staged arrival build the room at all.
5. *"Base ships `forcedHits` ON: report whether 624 now plans a forced hit"*: it does not; OFF the rung cannot prove one
   (a press into the arrival freeze is refused by the model), ON a hitless crossing exists.
6. The bootstrap's `READY` again left five non-wasm submodules uninitialised (C3's and C4's finding).

## Residue

1. **The solver accepts a plan whose drive took an unbilled hit or died** (leg 624: t362; 4–5 lava deaths). Owner: the
   solver's acceptance (`solveSegment`'s contract, the JS arc's). A drive-vs-preview check, or a refusal on any
   unbilled `playerHits`/`playerDeaths` row, would have caught both.
2. **The L74 arrival frame** (t1 vs t2), the JS arc's: every L74-from-L73 witness here fails the probe's clock line on it.
3. **Bulb velocity in the drop death** (game ≈ ±5 px/tick from t305, model 0; positions equal): fidelity-bulb's.
4. **The dashless pass's refusal** under all three ON (fidelity-bulb's "killed and then destroyed by the terrain under
   it"): a named model gap the anytime answer routes around.
5. **`fallrocklarge` outside the arena** (L82) stays refused; the FallRock's first-update `resetCamera()` is not modelled
   (a no-op on L74's routes).
6. 628's exit lies under the fallen rock: the sweep's inventory staging cannot see that the game closes it.

## Rows to BANK

- `fidelityL74Leg624.test.js` (13 rows), the witness `l74leg624-postfall-reentry`.
- The three OFF keys in `contactFidelity.test.js`'s defaults pin.
- Surface GREEN 277; constants PASS 5,809.
- At a licensed flip of `strikeIframeLapse`: the 21 bounded movers and the two identity rows above (with
  `r9-solve-14`/`-16` re-recorded on the game); of `fallRockPostFall`: the three refusal controls (`fallRock.test.js`'s
  {39,10} row, `fidelityCrossRoom`'s vanilla L37 row, `levelWorld.test.js`'s cleared-tag census row); of
  `forecastSpeedByTerrain`: none measured.

## CI

`JavaScript Unit Tests` at the last CODE head `0173119` (run **38286726462**): job success — suite: vitest (unfiltered)
784 files / **20,034 passed**, 0 failed, 0 skipped; slow battery 18 files / 253 passed. The two commits after it
(records, this report) touch no code; their run is read in the closing message. The suite number is CI's (⚖ 52).

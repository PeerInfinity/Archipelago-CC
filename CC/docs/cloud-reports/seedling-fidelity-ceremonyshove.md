# Seedling fidelity CEREMONYSHOVE: a ceremony's dead frames, stepped

Slice `seedling-fidelity-ceremonyshove` (Opus, cloud), planner `seedling-fidelity-planning-7`, WAVE 16 (model coverage).

| | |
|---|---|
| Start SHA | **`3a53894a9a`** (main: wave 15 + hammer G1 + BW; not rebased) |
| Head | the commit carrying this report. Code: `8f1c5bd` (D2), `816f3f4` (D3). Evidence: `6d8095b` (D1). Records: `7602c0f` |
| Branch | `claude/seedling-ceremony-shove-mtarz5` (the harness's). Nothing went to `main` |
| Dev server | `serve-nocache.py 9671` (`SEEDLING_PORT=9671`), PID 1556, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS for the model; STOP for survey step 50 with both `strikeIframeLapse` and `ceremonyShove` ON (handed to the hammer arc)** |

## The one thing to know first

**The freeze is now modelled, not avoided.** With `CONTACT_FIDELITY.ceremonyShove` ON (a new switch, OFF by default),
`levelRun` steps a ceremony's dead frames where the game runs them. Each frame is:

- the chasers' frozen update (`hitUpdate`, the death fade, the terrain switch);
- `Player.shieldBump`;
- the player's own i-frame drain.

Five game witnesses on p4f reproduce at **0 on every tick**:

- a touched BobSoldier;
- an i-framed one;
- a dying one;
- an i-framed player;
- three Bobs at L17's chest, one of them i-framed (the second class, through the seal piece).

OFF is byte-identical. ON moves no committed tape, and with the lapse OFF it moves **no route-survey step**.

The single cost is survey step 50 when `strikeIframeLapse` is ON as well (413 t → REFUSED):

- retiring the interim avoidance lets the solver collect beside the live BobSoldier;
- the exit walk's own presses kill the body;
- the kill arm that exit had already chosen then refuses a target that is gone (`botDriverV2.runDwell`'s "ALREADY
  TRUE", reached from `execKillByPress`).

That is the hammer arc's function. The hand-over is below.

## W0: the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout` of `3a53894a9a` (the harness branch was created at it) | `3a53894a9a`; bootstrap `READY`, node v22.22.0; five non-wasm submodules uninitialised again (`git submodule update --init` each, for the reference row) |
| identity block | `SEEDLING_PORT=9671 bash scripts/procgen/identity-block.sh .` (first run on the tree with D2 half-written, OFF; re-run at the final head below) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY **`afdc6d1a`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK: the STRIKELAPSE/FLIP14 bank. Reference: "4 differ" with the submodules uninitialised (the known environment row); ALL 7 + 5 MATCH after init |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` | **611, `75a3c41f`** (BW's bank) |
| surface / constants | `census-seedling-solver-surface --check`, `census-seedling-constants --check` | surface **288** GREEN; constants PASS (5,846 literals) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 187 files at a pristine base worktree: the brief's standing list, plus every non-slow test naming `assertNoCeremonyBesideLiveChaser`, `ceremonyBesideLiveBody`, `frozenFramesOwed`, `ceremonyStarts`, `CONTACT_FIDELITY_KEYS`/`_DEFAULTS`, `withContactFidelity`, `shieldBumps`, `collectStandWalk`, `createCorpseClock`, `CEREMONY_DEAD_FRAMES`, `ceremony`, `shieldBump`, `tapeRunner`, plus `levelRun`/`solverBot`/`chasers` and the surface/constants tests (`rg -al`; `evidence/w0/bounded-files.txt`) | **5,660 / 5,660**, pairs md5 `04fd1344` |

## D1: the game, read and witnessed (PASS)

**The AS3.**

```as3
Pickup.update:     playerHit = collide("Player", x, y); if (playerHit) { pick_up(); return; }
Pickup.pick_up:    if (special) { Game.freezeObjects = true;
                     if (specialTimer > 0) { specialTimer--; if (specialTimer <= 0 && text != "") add(new NPC(…text…)); }
                     else if (!myText) { Game.freezeObjects = false; removeSelf(); } … }          // Pickup.as:91-108
Player.update:     getState(); addShield(); shieldBump(); checkDrowning(); freezeStep(); …
                   if (!dying) super.update();   // Mobile.mobileUpdate: friction/input/move only if !freezeObjects
                   sprites(); hitUpdate(); …                                                       // Player.as:527-571
Player.shieldBump: if (shieldObj && v.length > 0) for each (o:Enemy in the shield box)
                     if (hasDarkShield && o.hitsTimer <= 0) o.hit(5, Point(x,y), 0.5, "Shield")   // hit: freeze-gated, a no-op
                     else o.knockback(5, Point(x,y));                                              // Player.as:1691-1708
Enemy.knockback:   if (p && !destroy && currentAnim != "die") { a = atan2(y - p.y, x - p.x); v += 5·(cos a, sin a); }
Enemy.update:      terrain switch; super.update() → Mobile.mobileUpdate: move gated, layering, death() (alpha -= 0.1);
                   if (!destroy) { hitUpdate(); hitPlayer(); }      // hitPlayer → Player.hit: gated on the freeze
BobSoldier.update: super.update(); if (Game.freezeObjects) return; …chase, sword…
Enemy.hit / Player.hit / Player.genericHit: all `!Game.freezeObjects`-gated
Bot.update:        if (game.blackCover > 0 || Game.freezeObjects) { deadFrames++; autoAdvance(); return; }  // a DEAD frame
```

The player's `v` stays frozen non-zero, because friction lives inside the gated `mobileUpdate`. So a body inside the
moving shield box takes `shieldForce` (5) on **every** dead frame, and only moves when the freeze lifts. Through the
same frames:

- each body's `hitUpdate` drains its i-frames;
- `Mobile.death` finishes a fade;
- the player's own `hitUpdate` drains its i-frames.

Nothing is damaged: `hit` and `Player.hit` are gated on the freeze.

**Witnesses** (p4f, headless logic-only, port 9671). Each tape is `strikelapse-l30-torch` (413 t) with presses removed
or moved and idle ticks inserted, truncated to 260 t. They were found by a grid search in the model
(`evidence/d1/`):

| witness | edit | at the ceremony | OFF (model vs game) | ON |
|---|---|---|---|---|
| `ceremonyshove-l30-touch` | t141 kill press dropped, +6 t at t149 | ceremony t155: the LIVE BobSoldier (hits 2) inside the moving shield box | body `v` short by **745.0 px/tick = 149 × 5** from t157; at the release the body flies to (91.85, 281.63) | 0 |
| `ceremonyshove-l30-iframe` | t92 press dropped | t152: BobSoldier inside 21 i-frame ticks, out of contact | the model **throws** (`assertNoCeremonyBesideLiveChaser`) | 0 |
| `ceremonyshove-l30-dying` | t141 press moved to t150 | t156: BobSoldier DYING | the model **throws** | 0 |
| `ceremonyshove-l30-player-iframe` | t61 + t141 dropped, +8 t at t134 | t152: the PLAYER inside 19 i-frame ticks | player `hits_timer` 17 vs 0 from t154 | 0 |

**Where the dead frames fall** (read off the game's per-tick polls):

- the i-framed body reads 21 (cer) → 20 (cer+1) → 0 (cer+2);
- the fade reads 0.6 → 0.5 → gone;
- the touched body's `v` matches the model at cer+1 and is 149 shoves ahead at cer+2.

So the game's phase-A dead frames sit **between the observations one and two ticks after the ceremony's start**, and
they shove 149 times. The 150th dead frame lands **before the release**: once the lump was stepped, the touched body
left the freeze exactly one shove short (Δv 5.0), and that last frame closed it. `differential --record` counts
**150 pickup dead frames** for each witness.

**`differential --record`** (the four tapes put in `fixtures/tapes/` for the run, then moved to evidence; ON =
`SEEDLING_STRIKE_IFRAME_LAPSE=1 SEEDLING_CEREMONY_SHOVE=1`):

- ON: **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"** for all four (261 observations each), ALL CHECKS PASSED.
- OFF control against those recordings: `iframe` and `dying` FAIL (the model throws).
- OFF, `touch` and `player-iframe` pass. Their divergence is in a body's velocity and the player's i-frame, which the
  player-position stream does not carry; the per-tick comparator below does.

**The comparator** (`tools/cmp.mjs`; `d2/cmp-off-vs-on.log`) checks every tick:

- the player's position and `hits_timer`;
- every body of the class (position, velocity, hits, `hits_timer`).

Each body is matched against the closer of the game's **first and last poll at that tick**. ⚠ The Bot's tick stands
still through dead frames, so the first poll at cer+1 is pre-lump and the last poll at the release is post-release. The
stock `probe-seedling-chaser-mobiles` takes the first poll only, which is why its sample-clock line fails on every
ceremony tape: the "probe's ceremony limitation" STRIKELAPSE named.

**The second class.** The roster offers no other knock-back chaser beside a *texted* pickup ceremony at the defaults:

- L74's darkshield sits beside lavarunners and bulbs, which step only under the K2 bridge (`KILLLOCK_BODIES`);
- every other chaser room's ceremony is a chest or a text-less totem part or boss key;
- the puncher at L12's darksword (`enc-l12-witch`) has an empty `knockback` and stands 130 px off.

The chest gave the second class: survey step 19's lapse-ON plan collects L17's seal piece while `bob@96,32` is inside
21 i-frame ticks (D3).

**Census** (`tools/census.mjs`, every committed tape through the model; `d1/census-committed-tapes-*.jsonl`):

- 277 tapes, **67 ceremonies in 55 tapes**;
- **none starts with a body in shield contact, i-framed or dying**;
- one has a live chaser in the room (`enc-l12-witch`: the darksword, the puncher out of contact).

The survey plans: the only ceremony beside a body is step 50's under the lapse (STRIKELAPSE's interim refuses it, and
D3 measures it).

## D2: step the lump (PASS)

**Change** (`levelRun.js`, all behind `CONTACT_FIDELITY.ceremonyShove`; `contactFidelity.js` gains the row, appended,
with `SEEDLING_CEREMONY_SHOVE=0|1`):

- **`armCeremonyLumpNow` / `stepCeremonyLumpNow`.** A texted pickup ceremony, or the Witch's darksword, arms 149
  frames (`CEREMONY_DEAD_FRAMES.pickup - 1`), stepped at the top of the advance after the ceremony's first frozen
  tick. They run just after the `shieldRenderState` snapshot, before anything else in that tick.
- **`stepCeremonyDeadFrameNow`**, one frame, in `Player.update`'s order: `stepChasersNow()` (frozen, because
  `ceremony` is set), then `shieldBumpNow()`, then `stepPlayerDamage` with the facing hand-back.
- **`stepCeremonyReleaseFrameNow`.** The 150th frame, on the finishing tick, above the live step the ceremony falls
  through to.
- **The dialogue's frozen ticks** step the chasers too (`stepChasersNow` above `runFrozenTick`'s shove): the
  cer+1 drain (21 → 20) and fade (0.6 → 0.5).
- **`assertNoCeremonyBesideLiveChaser`** takes `{ stepped }`. ON, it stands down for a stepped ceremony. A text-less
  pickup (it finishes on its start tick) stays a lump, and ON its refusal also names a body inside the moving shield
  box (`assertNoUnsteppedCeremonyShove`).
- **`run.ceremonyLumps`**: the stepped rows (empty OFF).

**Not stepped**, named in the code:

- the camera (`view()`), the slash timer and the activators, which also run on a dead frame;
- the clock still spends phase A as its lump (`spendCeremonyPhaseA`);
- the turrets and bombs keep their own stepping at the ceremony's start.

**Witness rows.** `fidelityCeremonyShove.test.js` replays `fixtures/chaser-witness/ceremonyshove-*.json` (the tape and
the game's first and last poll per tick; not roster tapes):

- ON: exact on every tick, and the lump rows `[149, 1]` with the lump at the ceremony's tick + 1;
- OFF, the controls: Δv 745 = 149 × 5, the two throws, and the player's 17.

**Mutants** (predicted first; copy + restore; `d2/mutants.md`):

| mutant | predicted | measured |
|---|---|---|
| M1 lump 150 frames | touch red only | touch red by the comparison (103 ticks, 3.95); 4 rows red by the test's `[149, 1]` pin |
| M2 lump one tick late | all 4 red | all 4 red |
| M3 no release frame | touch red only | touch red by the comparison (68 ticks, 3.95); 4 rows red by the pin |
| M4 no chaser step on ceremony ticks | iframe red, dying green (alpha not compared) | iframe red only |
| M5 no player i-frame drain | player-iframe red only | player-iframe red only |
| M6 seal lump deferred one tick (D3) | l17 red only | l17 red only |

On M1 and M3 my prediction missed the test's own lump-row pin. The behaviour is red exactly where predicted.

## D3: retire the avoidance (PASS for the model; STOP for step 50 under both switches)

**The priced question.** With `ceremonyShove` ON and a ceremony the run steps (`run.ceremonyStepsDeadFrames(p)`: the
switch and a ceremony with text), `ceremonyBesideLiveBody` (lapse ON) no longer refuses on the interim's grounds. It
asks `ceremonyAftermathDanger`, which looks at where the ceremony leaves each body:

- **a corpse** (`destroy`, `dying`, a staged `dyingAt`) fades inside the 149-frame lump, so it is gone and not asked;
- **a live body inside the moving shield box** (a class whose `knockback` moves it; `chaserKnocksBack` comes through
  the `solverView` door) leaves the freeze at ~750 px/tick and pins against its first wall (measured: (77.8, 72.6) →
  (91.8, 281.6)), so it is not asked;
- **any other body, live or i-framed** (drained to 0) is parked beside the player. It is asked the untimed WAIT
  question (`chaserDanger` at horizon 0) as a live, un-i-framed body.

The shield box comes from the player on the tail's ceremony sample. `previewWalk`'s ceremony break now sets
`sample.player` (ON only); with no player on the sample, no body counts as shoved, the side to err on. A text-less
ceremony keeps the old refusal.

**The first cut was wrong, and it was measured.** Returning "no danger" for every stepped ceremony let step 50 collect
with the body parked 7 px below the player and *outside* the shield box. The exit walk then refused at its first
sample (`chaser:bobsoldier@48,80`, "its sword is timed"). The parked-body arm is that measurement.

**A chest's seal piece is stepped too.** It is 150 phase-A frames plus the `SealController`'s 181, all dead (no text).
The D2 version refused it ON when a chaser was hot, and the survey measured the cost: **step 19** (L17 chest,
`bob@96,32` inside 21 i-frame ticks under the lapse's walk) REFUSED. The game shows the dead frames run **inside the
collecting tick**: the first poll has the bobs unmoved with one i-frame drained, the last poll has them moved with the
i-frames at 0. `stepSealLumpNow` steps 330 frames at the contact; the tick's own live step of the chasers is the
331st. Witness `ceremonyshove-l17-chest-19` (step 19's lapse+shove-ON plan, 132 t, three Bobs):

- the comparator reads **0 on every tick** ON;
- `differential --record` ON passes (331 seal dead frames accounted; "reproduces", 133 observations);
- OFF, the Bob keeps 19 i-frame ticks the game drained (worst 19 at t73).

**Surveys** (local, `node scripts/procgen/survey-seedling-route.mjs --through=end --route=full`, at `816f3f4`; compared
by (level, goals, boot) against CI run **38332251781**; `d3/survey-*.json.gz`, `d3/survey-diffs.txt`):

| configuration | SOLVED | REFUSED | NO-EDGE | NO-ARRIVAL | TIMEOUT | movers |
|---|---|---|---|---|---|---|
| CI base (both OFF) | 169 | 51 | 1 | 1 | 0 | — |
| A: `ceremonyShove` ON | 169 | 49 | 1 | 1 | 2 | **none**: every length and refusal text equal |
| C: `strikeIframeLapse` ON | 170 | 48 | 1 | 1 | 2 | STRIKELAPSE's D3 table exactly (50 → 413, 62 → 748, 147 → 504, the length movers) |
| B: both ON | 169 | 49 | 1 | 1 | 2 | vs C: **step 50, SOLVED 413 → REFUSED**, and nothing else |

The TIMEOUTs are steps 156 and 187 (L12 → L83) under load (four cores at load ~8). Solo at `--timeout=300` all four
(A and B) **refuse with CI's text byte for byte** (99–109 s against CI's ~78 s).

**The survey/sweep rows this slice moves, before → after:**

| step | level | goal | before | A (shove ON) | B (both ON) |
|---|---|---|---|---|---|
| 50 | L30 | Torchpickup → L32 | SOLVED 460 (OFF) / 413 (lapse ON) | 460 | **REFUSED**, see the STOP below |
| 19 | L17 | Chest | 122 (OFF) / 132 (lapse ON) | 122 | 132, game-witnessed (it would have REFUSED with D2's seal refusal) |
| every other step | | | | = | = (vs lapse ON) |

**STOP for step 50, both switches ON (handed to the hammer arc).** The solve (`view-solve` of step 50's boot, goals
`collect:64,64;exit:224,160`):

1. It collects with the BobSoldier parked out of the shield box and out of its pad (ceremony t138). The aftermath
   question passes it.
2. The exit walk toward the keylock stance (bosslock@224,208) kills the body with its own lapse-admitted presses
   (dying from ~t175, removed by t192).
3. The exit's ladder had already chosen `kill (bobsoldier@48,80) by press`. `execKillByPress` reaches
   `botDriverV2.runDwell` and fails: *"the dwell's condition (bobsoldier@48,80 has left the world …) is ALREADY TRUE
   before a tick is spent"*.

The model is right there: the body really is gone. The refusal is a kill arm entered for a target its walk already
killed. Hand-over: **`execKillByPress` should count a target removed during its walk to the stance as the kill done**
(skip the dwell, or re-derive), rather than call `runDwell` on an `until` already true. Reproduce with
`SEEDLING_STRIKE_IFRAME_LAPSE=1 SEEDLING_CEREMONY_SHOVE=1 node evidence/tools/view-solve.mjs
--view=evidence/d3/step-50-boot.json "--goal=collect:64,64;exit:224,160"`. At the defaults
(lapse OFF), `ceremonyShove` costs nothing (survey A).

**The bounded set with the switch ON** (`SEEDLING_CEREMONY_SHOVE=1`, all 188 files; `w0/bounded-vitest.txt`):

- the two census rows, owed records, since re-written;
- `fidelityStrikeLapse` "`ceremonyBesideLiveBody`: … a dying body anywhere and an i-framed body refuse": those
  refusals retire ON, by design;
- `fidelityStrikeLapse` "ON: survey step 50 solves in 413 t": the STOP above;
- one row skipped by design (`contactFidelity`'s defaults pin, under the env).

Nothing else is red.

## The CI dispatches for the planner (cloud sessions get 403)

All on ref `claude/seedling-ceremony-shove-mtarz5`:

1. **`seedling-survey.yml`**, defaults (`--through=end --route=full`), **unmodified**. Expect CI 38332251781 row for
   row (OFF is inert).
2. **`seedling-survey.yml`** with `ceremonyShove` ON. The workflow has no contact input, so use a one-line measurement
   commit setting `ceremonyShove: true` in `contactFidelity.js` on a scratch branch. Expect survey A: 169, nothing
   moved, with 156/187 REFUSED on CI's clock.
3. The same with `strikeIframeLapse: true` as well. Expect survey B: step 50 REFUSED (the STOP), step 19 132, the rest
   = the lapse-ON table.
4. **`seedling-divergence-sweep.yml`**, the full sweep (`ids=` empty), twice:
   - with `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,fallRockPostFall,forecastSpeedByTerrain,ceremonyShove`
     (the defaults plus the switch);
   - and unmodified (the default).

   Compare against baseline 38343649914 by key. Not measured here: no sweep leg is known to start a ceremony beside a
   body (the census found none in the committed tapes), so the expectation is no mover beyond run noise, with any
   `crossed`↔`done` swap checked ×2.

## The JS arc's pins and what it must wire

- **No signature or contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`
  are untouched. There is no new staging/result field and no new `SolverRefusal.obstacle.kind`.
- **New run surface:** `run.ceremonyLumps` (a getter, empty OFF) and `run.ceremonyStepsDeadFrames(p)`.
- **New forecast-sample field, ON only:** `sample.player` on the collect tail's ceremony sample.
- **Wiring:** the page's contact setting derives its default from `CONTACT_FIDELITY_DEFAULTS`, so the new row appears
  OFF. The JS runtime steps through `levelRun`, so the stepped frames come with it. For a page measurement it needs
  only the switch in `?contactFidelity=`.
- **The walker** (`botDriverV2.drive`/`chooseHeld`/`hasArrived`/`driveStepHeld`) is untouched. No `producer:walker`
  sweep row can move from this slice's code.
- **`botDriverV2.runDwell`** is untouched. Its "already true" guard is where step 50 lands; the fix belongs in the
  caller (hammer).

## Handed to the hammer arc

- **Step 50, both switches ON**: `execKillByPress` enters its dwell for a target its own walk to the stance already
  killed (the STOP above). None of the arc's functions were edited.

## Deltas (base → head)

- **Code:**
  - `contactFidelity.js`: the `ceremonyShove` row and its env hook;
  - `levelRun.js`: `armCeremonyLumpNow`, `stepCeremonyDeadFrameNow`, `stepCeremonyLumpNow`,
    `stepCeremonyReleaseFrameNow`, `stepSealLumpNow`, `assertNoUnsteppedCeremonyShove`, the stand-down in
    `assertNoCeremonyBesideLiveChaser`, the chasers' step on ceremony ticks, `ceremonyLumps`,
    `ceremonyStepsDeadFrames`;
  - `solverBot.js`: `ceremonyAftermathDanger`, the ON branch of `ceremonyBesideLiveBody`, `sample.player`,
    `chaserKnocksBack`;
  - `solverView.js`: one re-export.
- **Tests:** `fidelityCeremonyShove.test.js` (17 rows); `contactFidelity.test.js`'s defaults pin
  (`ceremonyShove: false`, appended, plus its env skip).
- **Fixtures:** `fixtures/chaser-witness/ceremonyshove-{l30-touch,l30-iframe,l30-dying,l30-player-iframe,l17-chest-19}.json`
  (game witnesses, **not roster tapes**).
- **Records:**
  - `seedling-solver-surface.json` (290, +2 classified);
  - `seedling-constants-census.csv` (5,854, +8 green drift) and its region of `seedling-constants.md`;
  - the `seedling-bot-log.md` entry with trap candidates;
  - the `seedling-bot.md` as-built paragraph;
  - the reference (`docsIndex.js`, the procgen README word count), ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS
    PASSED; the `procgenDocs` tests 109/109.
- **Evidence:** `seedling-fidelity-ceremonyshove-evidence/`:
  - `d1`: tapes, recordings, gzipped game polls, census;
  - `d2`: differential logs, comparator logs, mutants;
  - `d3`: the L17 witness, census, surveys, diffs;
  - `w0`: bounded files and results;
  - `tools`: `gameprobe`, `cmp`, `census`, `survdiff`.
- **Shared tables:** `CONTACT_FIDELITY` gains one row, appended. `OBSTACLE_STRATEGIES`, `DEADLINE_SITES`,
  `KNOWN_STRATEGY_VERBS`, `KILL_ARM_POLICY` and `FAMILY_RULES` are untouched.
- No tape, expectation, trace, index or roster change; no producer `--check` moves.

## What the brief got wrong (measured)

1. *"the lump's length"*, one number. Phase A's 150 dead frames split **149 + 1**: 149 between the observations one
   and two ticks after the start, and one before the release. 150 at either place is off by one shove, and the model
   needed both places.
2. *"`assertNoCeremonyBesideLiveChaser` throws on the i-framed / dying cases"*: true, but the model's gap was wider
   than the chasers. **The player's own i-frames** also drain through the lump unmodelled, with no refusal at all
   (`ceremonyshove-l30-player-iframe`: model 17, game 0).
3. *"the step-50 BobSoldier case … a plan that collects beside the body may now be shorter"*. With the lapse ON the
   plan that collects beside the body is no longer refused at the ceremony, but it is not shorter: it refuses
   downstream (the STOP). And the body it collects beside is *parked*, not shoved. Only a body inside the shield box
   is shoved; one 7 px below a player moving down is not.
4. *"a second class (a chaser or wallflyer if the roster offers one)"*: the roster offers none beside a *texted*
   ceremony at the defaults. The second class came through a chest's seal piece (L17's Bobs), a ceremony path the
   brief did not name. It had no refusal at all OFF, and it is now stepped ON.
5. *"(expected: none at the defaults — say so with the count)"*: confirmed, 0 of 67.
6. The bootstrap's `READY` again left five non-wasm submodules uninitialised (the reference row reads "4 differ" until
   they are initialised).

## Residue

1. **Step 50 under both switches** (the hammer hand-over).
2. **Unstepped on a dead frame:** the camera (`view()`), the slash timer and the activators, for both the phase-A lump
   and the seal piece. The witnesses do not reach them: their cameras settle, no press lands across a ceremony, and
   there is no button in the rooms.
3. **The seal piece's shove count** (330 + 1 frames) is unwitnessed: no plan collects a seal piece beside a body in
   the box.
4. **A text-less pickup** (totem part, non-zero boss key) is still a lump, refused ON by name when a body is hot or in
   the box. It is unwitnessed; nothing reaches it.
5. **The lavarunner's own freeze return** (`freezeSkipsUpdate`) is honoured by the frozen step (`stepChasersNow`).
   It is unwitnessed in a lump: L74's darkshield is reachable only under the K2 bridge.
6. **`fidelityStrikeLapse`'s two rows** are the flip's re-pins when `ceremonyShove` and the lapse are both ON.

## Byte-inertia (OFF)

- Every committed tape's observation stream equals base (277 / 277, `d1/census-committed-tapes-base.jsonl` vs
  `d3/census-committed-tapes-off.jsonl`).
- tapeRunner: 611, `75a3c41f`, the same at base, OFF and ON.
- Roster: 277.
- Identity block at the final code: see the table below.
- Survey A shows the switch ON is route-inert at the lapse's default.

## Identity at the final code

`SEEDLING_PORT=9671 bash scripts/procgen/identity-block.sh .` at `7602c0f` (`w0/identity-final-{off,on}.log`):

| row | OFF (default) | ON (`SEEDLING_CEREMONY_SHOVE=1`) |
|---|---|---|
| maze / acceptance | `57e07d21` / `933c14f7` | = |
| c3 / c6 / c4 | `4937da80` / `430573e9` / `b9d2185d` | = |
| ENEMY / guard / AREA | **`afdc6d1a`** / `a6d18d49` / `02b22525` | = |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` | = |
| levels pre / post | `e28c1e5d` / `fb1a59e5` | = |
| generated set | OK | OK |
| six `--check`s | `405d9c4b` `b76f6483` `465a8b46` `35456fbc` `6cd35fe1` `712f0ead`, all exit 0 | = |
| reference | ALL 7 + 5 MATCH | = |

Every row equals the W0 bank, and ON equals OFF on every row: no producer digest moves with the switch.

**CI** (the push-triggered `JavaScript Unit Tests`):

- At the last code-bearing head **`7602c0f`** (run 38617575100): **success**, 801 files / **20,277 passed / 0 failed**,
  slow battery **253 / 253**.
- At `816f3f4` (run 38612739481): 2 failed, exactly the two census rows that `7602c0f` re-wrote.
- The later evidence/report-only pushes do not trigger the workflow (path filter).

## Rows to BANK

- **Switch:** `CONTACT_FIDELITY.ceremonyShove` (OFF). With the lapse OFF it moves nothing on the route survey or the
  committed tapes, so a flip licence would cost nothing at today's defaults.
- **Game witnesses** (p4f), each 0 on every tick ON:
  - `ceremonyshove-l30-touch`, `-iframe`, `-dying`, `-player-iframe`: 260 t, `differential --record` ON "reproduces"
    261 observations;
  - `ceremonyshove-l17-chest-19`: 132 t, "reproduces" 133 observations.
- **Survey (local):** A 169 (= CI), C 170 (= STRIKELAPSE), B 169 (step 50 REFUSED); steps 156 and 187 REFUSED with
  CI's text at `--timeout=300`.
- **Bounded vitest:** BEFORE 187 / 5,660, `04fd1344`. AFTER 188 / 5,678 (the 17 new rows and one `contactFidelityHook`
  each-row), all green after the census writes. ON: the four reds above.
- **Mutants:** M1–M6 (`d2/mutants.md`).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no
  force-push.

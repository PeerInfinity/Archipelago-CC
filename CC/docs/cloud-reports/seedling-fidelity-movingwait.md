# Seedling fidelity MOVINGWAIT: a latched wait paces out of the lobber's aim; two residues were the game's ints and statics

| | |
|---|---|
| Session | `seedling-fidelity-movingwait` (planner `seedling-fidelity-planning-6`, wave 14, model coverage) |
| Start SHA | `8654f02a4c` (main: wave 13 `1ef20d8b44` + the JS arc's `c73c812118` and play-clock work; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-moving-wait-swtrl8` |
| Commits | D1+D2 `4c83677` · D3 `b34ceee` · D4a `02a4fc7` · D4b `d0a4f2a` · records `c83fb99` · test fix `4221969` · citation fix `6c58248` · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (`MOVING_WAIT` = `CONTACT_FIDELITY.movingWait`, ships OFF) · D3 PASS for the wait, STOP past it (the legs' next stops are another arc's verb and an unmodelled arm) · D4 PASS ×2 (two OFF switches, measured, STOP for the licence)** |

**The one thing to know first.** The paced hold works on the game: legs 378 and 381 wait out
`buttonroom@272,208`'s latched fade by pacing an out-and-back cycle in step with the lobber (46/48-tick cycles against
its 46), and both are **0 hits and 0 px on every sampled tick** on p4f. But neither leg solves with it ON. Past the wait,
381 is hit standing in a **press kill's** wait (`execKillByPress`, the hammer arc's), and 378's second hold is refused
because a bomb launched before that wait lands on `spinner@192,128` whatever the pacing. The sweep rows change family,
not colour.

## W0: the bank at base (`8654f02a4c`)

Measured in a detached worktree of `8654f02a4c` (submodules and `node_modules` symlinked; served on port 9652). A first
identity run in the main checkout overlapped my first edits; the clean-worktree run is byte-identical to it.

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9652 bash scripts/procgen/identity-block.sh .` (venv activated) | log md5 `a1565a685b4a481e2c6c478f76e06c8c`: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set `OK` |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| reference | in the block | 4 DIFFER, environmental (`registry.js`, `capabilities.js` and their two doc regions: this box's substrate submodules) |
| bounded vitest BEFORE | 80 files, `--reporter=json`, md5 over sorted `status\tfullName` | **80 files / 3,384 tests**: 3,373 passed, 10 skipped, **1 failed** (`procgenDocs/generated`, the same environmental reference rows), md5 `7a0fe22779c0d06d4c119115ea8b30a2` |
| tapeRunner | its rows inside that run | **611** rows, md5 `75a3c41f0c91f6e71953e82d8259dc60`, 0 non-pass (= BOMBPUSHER's bank) |
| surface / constants | `census-seedling-solver-surface --check`, `census-seedling-constants --check` | GREEN 277 / PASS 5,808 |

**The bounded set (80 → 81 files).** The brief's standing list (39 files) plus every non-slow test that `rg -a` hits
for what I touched — `runHold|runLatchedWait|execHold|lobberHoldRefusal|KNOWN_STRATEGY_VERBS|CONTACT_FIDELITY_KEYS|`
`CONTACT_FIDELITY_DEFAULTS|bombEvents|drainBombBlasts|bombpusher|BombPusher|STRATEGY_EXECUTORS|movingWait|pacedSummary|`
`ENTITY_FAMILY_NAMES|LEDGER_KIND_NAMES|contactFidelity` — and `bombPusher`, `contactFidelityHook`, `levelRun`,
`levelWorld`, `solverBot`, `botDriverV2`, `tapeRunner`, `entityRecords`, `seedlingEntityWitness`, `checkProcgenHelp`,
`procgenHelpBaseline`, `seedlingConstantsCensus`, `seedlingSolverSurface` and the `procgenDocs` tests. AFTER adds
`fidelityMovingWait`.

## D1: which waits may move (PASS)

Read from the AS3 (`vendor/seedling/src`, read only):

| wait | the condition | may it pace? |
|---|---|---|
| a latched presser's fade (`runHold` on a `room = -1` ButtonRoom; `runLatchedWait`) | `ButtonRoom.set activate` is behind `if (a)` (*"Can't be reset to false!!"*, `ButtonRoom.as:67-98`): once pressed, the group stays published. `Lock.activationStep` (`Lock.as:64-88`) fades while `activate`, whoever stands where | **yes** — built |
| a plain `Button` hold | `Button.update` assigns `activate = tempCheck` every update (`Button.as:27-46`): stepping off unpresses the group | **no** (never paced) |
| a keylock's line (`BossLock`) | `if (p && hasKey) activate = true`, never set false (`BossLock.as:58-66`) | yes in principle; not built (`execKeylock` is not one of this slice's two verbs) |
| `buttonroom@272,208`'s 131-tick hold | the latch happens on the approach; the paced wait first sees the lock open at its 2nd cycle end (tick 92 / 96 of the wait). 131 is the still bound (fade 101 + `HOLD_SLACK` 30) | **yes** — the measured case |

**The pacing.** A CYCLE holds a direction `span` ticks, coasts to rest, holds the opposite `span` ticks, coasts to rest,
then stands `gap` ticks. Measured on L40's stance with `previewStepper`: 16 cycles (4 cardinal directions × spans
4/8/12/16) return to the start **bit-exactly** (the speed curve is symmetric); max excursion 5.2-20.5 px.
**The proof**, per candidate: every previewed sample clean against the walk forecast (bombs aimed at the PACED player,
chasers, arrows, grenades), no forecast blast on a body, no other presser touched, the latch is a static (held at every
tick by construction), and each cycle end is the stance at rest, bit for bit.

## D2: the verb, behind `MOVING_WAIT` (PASS; OFF by default)

- **`contactFidelity.js`**: `movingWait: false` (appended; `SEEDLING_MOVING_WAIT=0|1`). `solverBot.MOVING_WAIT` reads and
  writes it (`withMovingWait`). As a `CONTACT_FIDELITY` key the sweep's `contact_fidelity=` input switches it with no
  code edit, and the flashPanel setting is derived from `CONTACT_FIDELITY_KEYS`.
- **`solverBot.js`** (my functions): `PACE` (8 out-and-back directions, spans 6..24, gaps 0/6/12/18, smallest motion
  first), `planPacedWait` (each candidate previewed for whole cycles covering the still bound; rejected at its first
  `dangerDuringTransit` source, a blast on a chaser or spinner, another presser, a fall or crossing, or a cycle end off
  the stance), `pacedHoldPlan` (asked only when MOVING_WAIT is ON, the hold is latched, and the still wait prices a bomb;
  a latched hold no pacing clears is refused by name with the pacings tried), `stillWaitBomb`, `pacedTraceRow`.
  `execHold` passes the plan to `runHold`/`runLatchedWait`; `runLatchedWait` gains a `pace` arm. Two one-line `seeRow`
  calls after the executor sites add the trace row `pace`.
- **`botDriverV2.js`**: `runPace` drives the plan and asserts it tick by tick (the exact previewed position, no hit, no
  crossing; the run's own by-name refusal of a blast on an `"Enemy"` body becomes the wait's); it asks the hold's
  condition at cycle ends only, so the wait stops on the stance. `runHold` takes an optional `hold.pace`; **with no
  `pace` the still contract (MOVED, inside the presser, the bound sentence) is byte-for-byte the old loop**.
  `pacedSummary` is the record's optional `paced` field.
- **`decisionTrace.js`**: `KNOWN_STRATEGY_VERBS` + `'pace'` (appended).

**Mutants** (predicted first; copy + restore, `cmp` clean), on `fidelityMovingWait.test.js`:

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | `runPace` drops the path assertion | the off-path row only | ✔ 1 red |
| M2 | `planPacedWait` ignores `d.danger` | both planner rows, both runHold rows, the off-path and bound-sentence rows (the first candidate is chosen) | ✔ 6 red |
| M3 | `blastMeetsBody` never rejects | leg 378's planner and runHold rows (its 30th candidate was rejected for a blast on `bob@304,144`) | ✔ 2 red |

## D3: the witnesses and the census (PASS for the wait; STOP past it)

**The witnesses** — the MOVING_WAIT solver's own inputs from each leg's arrival (the survey's staging,
`l40buttonStaging`), cut before the leg's next stop, played on the game (p4f, headless, damage on, bombs live) with
`probe-seedling-bombpusher.mjs` and recorded from the game's rows (`--record`):

| witness | leg | pacing (from) | rejected first | executed | game | model |
|---|---|---|---|---|---|---|
| `movingwait-l42-381-pace` | 381 | `left/right ×8, gap 18` (t1007, stance (280.738,215.297)) | 56 (every one a bomb: #4 ×14, #5 ×36, #6 ×4, #7 ×2) | 2 cycles × 46 = 92 t | 1,150 samples, **0 hits** | **0 px** every sample, each bomb to the bit, the anim; 6 blasts, none on the player |
| `movingwait-l41-378-pace` | 378 | `down+left/up+right ×6, gap 18` (t1106, stance (280.084,216.232)) | 30 (#5 ×28, #6 ×1, and one whose blast lands on `bob@304,144`) | 2 cycles × 48 = 96 t | 1,287 samples, **0 hits** | **0 px**, 7 blasts, none on the player; through the break to the t1 stance |

`fidelityMovingWait.test.js` replays both, and pins that **the planner's pacing from the witness state is the tape's,
key for key** (92/96 ticks), that the still wait there prices a bomb and the group is latched, and that `runHold` driving
the plan stops at cycle 2 with the lock open, unhit, on the stance. Both stances are BOMBPUSHER's refusal stances
(378: (280.08,216.23); 381: (280.74,215.30)).

**Past the wait (measured, node, the leg's staging, `movingWait` ON):**

| run | wall-clock | outcome |
|---|---|---|
| leg 378 | 162.9 s (one pass) | REFUSED at `buttonroom@160,128`'s hold (t1287, (168.18,136.10)): *"…the hold stands still for up to 131 tick(s) … a Bomb's Explosion at (169,135) 50 tick(s) into the wait … The group is LATCHED, so the wait may pace, and no pacing is clean (MOVING_WAIT, 256 tried): left/right x6 gap 0: bombpusher@112,128#8's blast reaches spinner@192,128 at paced tick 4 …"* — #8 was launched before the wait, so every pacing meets it. Family `BOMB` |
| leg 381 | 192.6 s / 146.1 s / 161.7 s (three runs) | THREW (`chaserForecast` … `Game.shake`'s jiggle; family `CAMERA BAND`) after the player is hit at t1156 standing at (248.37,183.72) from t1132: the stack at t1140 is `execKillByPressOnce` ← `execKillByPress` ← `climbLadder`. t1156 is the tick the game hit BOMBPUSHER's still plan there too |
| the cluster boot (272,224) | 2.6 s | THREW at t200: *"levelRun: the Explosion of bombpusher@112,128#4 at (313, 189) … reaches the chaser bob@304,144 — `Enemy.hit(4, …, 1)` … is not staged"* — in the WALK after the paced hold (the hold itself is clean) |
| OFF (all three) | 1.2 s (cluster) | REFUSED at the t0 hold by name, as at base |

(The 378 run and the first 381 run had the since-withdrawn chaser-arm prototype on; both witnessed prefixes replay
identically without it, and the third 381 run, without it, reached the same stop.) The planner re-time asked for "the wall-clock with your verb": the ON legs run ~2.5-3 min to their new stops in node
(BOMBPUSHER measured ~3 min to the t0 refusal). The search is cheap: a witness row replays ~1,000 ticks to the wait and
re-plans it (56 / 30 candidates rejected first) in ~0.5 s.

## The survey and sweep rows this moves (before → after, by step / leg key)

**Sweep** (leg ids re-derived at this head with `seedling-divergence-legs.mjs --blocks`: unchanged, L40 = 376-415):

| leg | key | before (main: `bombPusherLive` ON) | after (`movingWait` ON) |
|---|---|---|---|
| 378 | `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | REFUSED `BOMB` at `buttonroom@272,208` (t0 hold) | REFUSED `BOMB` at `buttonroom@160,128` (t1 hold; the pre-launched bomb on `spinner@192,128`) |
| 381 | `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | REFUSED `BOMB` at `buttonroom@272,208` | THREW `CAMERA BAND` after a bomb hit in `execKillByPress`'s wait (t1156) |
| 376, 377, 379, 380, 382-415 | the north exits and the south-arrival goals | — | predicted unchanged (the verb acts only where a latched still wait prices a bomb) |

⚠ `surveyFamily.FAMILY_RULES`' `BOMB` row text says *"no verb waits while moving"*; with MOVING_WAIT ON the refusal's own
text names the pacings tried. The row is shared (add, never reword), and a new row could not precede it without
reordering — the planner's to decide.

**Survey** (CI run 38168138687 → local, `movingWait` ON:
`SEEDLING_CONTACT_FIDELITY=<defaults>,movingWait node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=78,124,126,139 --timeout=5400 --out=…`).
L40's four steps, matched on (level, goal, boot). **No row moves** — none of them waits inside the lobber's reach:

| step | CI | ON |
|---|---|---|
| 78 | REFUSED VERB-APPLY (`shove` `pushableblockfire@576,576`) | = |
| 124 | REFUSED STANCE-REENTRY (`hold` of `wandlock@448,432`) | = |
| 126 | SOLVED 70 t | = 70 t |
| 139 | SOLVED 172 t | = 172 t |

### The CI dispatches the planner should run

```
gh workflow run seedling-divergence-sweep.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-moving-wait-swtrl8 \
  -f producer=solver -f mode=inv -f ids=376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415 \
  -f contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,movingWait
```
Expected as the table above; the control is the same run with `contact_fidelity` empty (378/381 refuse `BOMB` at the
t0 hold). For D4 (optional; predicted no mover): the same workflow with `ids=` L40's 376-415 and L43's 419-444 and
`contact_fidelity=<the defaults>,totemShotBlastInt,rebootShake`.

## D4: residue (PASS ×2, each OFF, STOP for the licence)

**(a) The totem shot's Explosion is an `int`** (`CONTACT_FIDELITY.totemShotBlastInt`, OFF).
`BossTotemShot.as:71` is `new Explosion(x + v.x, y + v.y, hitables, 24, 1)`: the ctor's `_x:int, _y:int` truncate the
point, and `Explosion.radius` is an `int`, so the hit radius is `int(24 × 0.65)` = 15 (BOMBPUSHER measured that class at
15). **Measured first**: every committed tape the runner plays (277) replayed, every `bossShotBlast` read — four blasts,
all in `r6-totem-kill`/`-control` at t387, at (122|182, 379.05) → int (122|182, 379), the player 58.4-77.0 px away. No
verdict differs under either reading (closest 42.8 px from the disc edge). ON: `BOSS_TOTEM_SHOT.explosionHitRadiusInt`
and the truncated point in the shot's `applyExplosion`. Mutant M4 (ON keeps 15.6): ✔ 1 red, as predicted.

**(b) The death-reboot camera** (`CONTACT_FIDELITY.rebootShake`, OFF). **The cause, measured on the game** (the two
BOMBPUSHER damage tapes played past their respawn, p4f, `--game-only`):

| tape | the reboot sample | the settled camera (game) | the model (drained) |
|---|---|---|---|
| L42 (`bombpusher-l42-part0-damage`) | t1221: `shake` **4**, cam (776,-56) (polled before the settle) | t1222+: **(777, 0)**, `shake` 0 | exact (776, 0) |
| L41 | t1337: `shake` **5**, cam (856,24) | t1338+: **(800, 22)** | exact (800, 24) |

`Player.die()` is `dying = true; restartLevel()`, a swap with no fade before it, and `Game.shake` is a static the new
`Game` never resets (`Game.as:538`; `restartLevel` is `FP.world = new Game(…)`). So the killing hit's shake jiggles the
new world's own settle frames, and each lerp compounds it. The model's `settleCameraForLoad` drained the shake
(`shakeAcrossLoad`) BEFORE its 20 settle frames, so it reported an exact camera that is wrong — **the cause lies in the
model's camera code**, so it is fixed there, behind the switch: ON, a death reboot with `shake > 0` steps its settle
frames through the shake band (`stepCameraBand`); teleports are unchanged. ON, both whole damage walks (1,597 / 1,543 t,
through the death and the second life) reproduce at 0 px, every bomb to the bit (`rebootshake-l4{1,2}-part0-damage`,
the camera read from the witness on uncertain ticks); OFF they refuse at t1222 / t1338 naming the exact camera. Mutant M5
(the reboot arm never taken): ✔ 2 red, as predicted.

## Byte-inertia (every switch OFF)

| row | result |
|---|---|
| identity block AFTER (head, OFF) | log md5 `a1565a685b4a481e2c6c478f76e06c8c` = **W0 byte for byte** (every value row, the six `--check`s, generated set OK, the same 4 environmental reference rows) |
| bounded AFTER (OFF) | **81 files / 3,412 tests**: 3,401 passed, 10 skipped, 1 failed (the same environmental `generated` row), md5 `24fed9b8bc94dadc920ab8070ea43673`. Against BEFORE: **+25 `fidelityMovingWait`, +3 `contactFidelityHook`** (one setting row per new key); 0 changed, 0 gone |
| tapeRunner AFTER | **611** rows, md5 `75a3c41f0c91f6e71953e82d8259dc60` = W0 (no committed tape moves; no roster tape added) |
| surface / constants | GREEN 277 (`--write` for site counts) / PASS 5,814 (4 literals classified, `--write`) |
| reference | `docsIndex.js` and README's docs-index region regenerated (word counts); the 4 environmental rows left as committed, = W0 |

## Switches ON: everything measured, for the licence

| row | result |
|---|---|
| bounded set ON (`SEEDLING_CONTACT_FIDELITY=<defaults>,movingWait,totemShotBlastInt,rebootShake`, 81 files) | **4 red beyond the environmental row**: `fidelityBombPusher` *"ON: the cluster boot's plan stops at buttonroom@272,208's hold…"* and `fidelityL40Button` *"from the cluster's own boot, bombPusherLive ON…"* (both: now an `Error` at t200, a bomb's blast on `bob@304,144` in the walk after the paced hold, not a `SolverRefusal`); `axeDodgeAskHook` *"byte-identical at the default"* (the env harness makes the run off-default — green in the in-code flip below); `fidelityMovingWait` *"ships OFF"* (fixed: `skipIf` the env var, as its siblings, `4221969`). 23 rows skip under the env var (14 `contactFidelity`, 7 `fidelityWallFlyer`, 1 `fidelityForcedHit`, 1 `fidelityLeash`) |
| defaults flipped IN CODE (copy + restore; the 9 files that pin or skip) | **6 red**: 4 default pins (`contactFidelity` defaults, `fidelityMovingWait` ×3 "ships OFF") and the same 2 cluster-boot rows. `axeDodgeAskHook` green; tapeRunner 611 `75a3c41f` |
| identity block + six `--check`s ON | log md5 `a1565a68…` — **byte-identical to OFF and W0** |
| survey movers ON | see above |
| sweep movers ON (predicted) | 378 (BOMB at t0 → BOMB at t1), 381 (BOMB → CAMERA BAND) |
| committed tapes | none move |

So a `movingWait` flip owes two default re-pins and two **behaviour** re-pins (the cluster-boot rows' refusal becomes the
walk's unmodelled Explosion arm, unnamed), and `totemShotBlastInt`/`rebootShake` owe only their default pins.

## Records

| row | result |
|---|---|
| bot doc / log | `seedling-bot.md` (the paced-wait paragraph and the two D4 switches); `seedling-bot-log.md` MOVINGWAIT entry with trap candidates |
| tape index / roster | **unchanged** (the four new files are `fixtures/bomb-witness/`, not roster tapes) |
| pins (by name) | `contactFidelity.test` defaults + `movingWait`, `totemShotBlastInt`, `rebootShake` (all `false`) |
| `boxLock` | no new box-taking instrument (the game runs used `probe-seedling-bombpusher.mjs`, which takes the box) |
| entities / profile | not touched (`bossTotemFight.js` is not an `ENTITY_RECORD_MODULES` file; no record leaf added) |
| CI (`JavaScript Unit Tests`) | `6c58248` (the last code head): run **38282017908**, job *completed success* — unfiltered **20,046 / 20,046** passed (0 skipped, 0 failed), slow battery **253 / 253**. This report's commit is docs-only (`CC/docs/**`), outside the workflow's path filter, so no JSUT run follows it |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no force-push |

## Deltas

- New: `fidelityMovingWait.test.js` (25 rows); `fixtures/bomb-witness/movingwait-l41-378-pace.json`,
  `movingwait-l42-381-pace.json`, `rebootshake-l41-part0-damage.json`, `rebootshake-l42-part0-damage.json`.
- `contactFidelity.js`: three appended keys (`movingWait`, `totemShotBlastInt`, `rebootShake`), all `false`;
  `SEEDLING_MOVING_WAIT=0|1`.
- `solverBot.js`: `MOVING_WAIT`, `withMovingWait`, `PACE`, `planPacedWait`, `pacedHoldPlan`, `stillWaitBomb`,
  `pacedTraceRow` (mine); `execHold` and `runLatchedWait` take the plan; one import line; two `seeRow` lines.
- `botDriverV2.js`: `runPace`, `pacedSummary` (new); `runHold`'s optional `hold.pace`.
- `decisionTrace.js`: `KNOWN_STRATEGY_VERBS` + `'pace'` (appended).
- `levelRun.js`: the totem shot's blast under `totemShotBlastInt` (3 lines); `settleCameraForLoad({reboot})` and the
  death's `enterWorld({…, reboot: true})` under `rebootShake`. `bossTotemFight.js`: `explosionHitRadiusInt`.
- Shared tables: `CONTACT_FIDELITY` and `KNOWN_STRATEGY_VERBS` rows appended; `OBSTACLE_STRATEGIES`, `DEADLINE_SITES`,
  `KILL_ARM_POLICY`, `surveyFamily.FAMILY_RULES` untouched.
- **Nothing in the hammer arc's or the JS arc's functions.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and
  `createRunForStaging` are unchanged. **No new staging/result field and no new `SolverRefusal.obstacle.kind`** (the
  paced refusal is `{kind: 'danger', id: 'bombpusher@…'}`). A hold record may carry an optional `paced` field and the
  trace a `pace` row. The JS arc wires nothing: the flashPanel setting is derived from `CONTACT_FIDELITY_KEYS`
  (`contactFidelityHook` +3 rows, green).

## Hand-overs

- **To the hammer arc (`execKillByPress`): its standing wait inside the lobber's reach is a bomb hit.** Measured with
  MOVING_WAIT ON: leg 381 stands t1132-t1155 at (248.37,183.72) in `execKillByPressOnce` (← `climbLadder`) and takes the
  blast at t1156 (the game hit BOMBPUSHER's still plan on that tick there too); the cluster boot (with the Explosion's
  chaser arm prototyped, see residue) stood t255-t292 at (311.87,87.78) in the same verb and was hit at t292. Its waits
  do not consult `dangerMap.lobberWaitDanger` / the bombs in `run.spitForecast()`. A press kill presses, so `runPace`'s
  pacing would not transfer as is; the measurement is the hand-over. I did not edit it.
- **To whoever owns the Explosion's `"Enemy"` arm** (BOMBPUSHER residue, now REACHED): with the hold paced, walks draw
  bombs onto bodies — the cluster boot's walk after the hold puts `#4` on `bob@304,144` at t200 (a plain `Error`), and
  leg 378's t1 hold meets `#8` on `spinner@192,128`. I prototyped the chaser arm (`enemyHit(4, Point, 1)` with the
  knockback from the blast, the lava chain's pattern) and **withdrew it**: no game witness, and neither leg's witnessed
  prefix reaches it. Walks do not price a blast on a body either (only on the player).

## What the brief got wrong (measured)

1. *"a swing stance's settle"* (from BOMBPUSHER's *"a stance at (248.4,182.9)"*): the standing wait at (248.37,183.72)
   on leg 381 is **`execKillByPress`'s**, not a break swing's settle (the stack at t1140).
2. *"Every would-be hit lands on a standing player … so the hit is avoidable by pacing during the wait"*: true of the
   t0 hold, not of every wait — leg 378's t1 hold meets a bomb launched **before** the wait (`#8` on
   `spinner@192,128` at paced tick 4), and moving the aim can put a blast on a body (one 378 pacing was rejected for
   `bob@304,144`).
3. *"the D3 forecast already prices a moving dwell sample by sample"*: it prices the PLAYER; nothing priced a blast on
   a chaser or spinner — `planPacedWait` adds that (`blastMeetsBody`), and walks still lack it.
4. *"the death-reboot camera … find the cause"*: not the camera arithmetic — `Game.shake` survives `restartLevel()`
   (no fade before a death's swap), and the model drained it.
5. *"`buttonroom@272,208`'s 131-tick hold"*: 131 is the bound; the paced waits stop at their 2nd cycle end, 92 / 96
   ticks (the latch is on the approach, so the fade is already under way when the wait begins).

## Residue

- `execKillByPress`'s waits inside a lobber's reach (hand-over above). Until then both legs stop past the wait.
- The Explosion's `"Enemy"` arm (chaser, spinner, static) stays a by-name `Error` in `levelRun`, now reachable.
- A keylock line could pace (`BossLock` latches) — not built.
- `rebootShake` covers deaths only; a teleport taken within a few ticks of a hit is unmeasured.
- `BOSS_TOTEM_DEATH_BLAST` (the boss's own r 52 blast) was not examined.
- The `BOMB` survey family's text (*"no verb waits while moving"*) is stale under MOVING_WAIT ON (shared row).

## Rows to BANK

- `CONTACT_FIDELITY.movingWait`, `.totemShotBlastInt`, `.rebootShake` OFF; `fidelityMovingWait` 25 rows;
  `contactFidelityHook` +3; witnesses `fixtures/bomb-witness/movingwait-l4{1-378,2-381}-pace`,
  `rebootshake-l4{1,2}-part0-damage`; roster unchanged; tapeRunner 611 `75a3c41f` (= W0).
- Identity `a1565a68` (W0 = AFTER OFF = ON); bounded AFTER 81 / 3,412 `24fed9b8`; surface GREEN 277; constants 5,814.
- **Licence questions for the user**: flip `movingWait` (movers: the two cluster-boot rows become the walk's unnamed
  Explosion-arm `Error` at t200 + 1 default pin; sweep 378 BOMB→BOMB, 381 BOMB→CAMERA BAND; no tape, no identity row);
  flip `totemShotBlastInt` and `rebootShake` (movers: their default pins only; no tape, no identity row).

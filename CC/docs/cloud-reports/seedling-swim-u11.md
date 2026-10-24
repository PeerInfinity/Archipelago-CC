# Seedling swim U11: step 24's fifth wall is a `Pull` funnel; the facing in the i-frame; the dark shield's hit

**Slice:** `seedling-swim-u11`, an Opus build slice run in the cloud for the swim arc (plan §17–§18, ⚖ Q39, 2026-10-01: *"Yes, one slice"*). It was the only worker, with no siblings.

| | |
|---|---|
| Started from | `origin/main` @ `1c3fb6c916` (the brief's bank commit) |
| Head | this report's commit, on top of D4 `d1edd06` |
| Harness branch | `claude/seedling-swim-u11-step24-fy9zfi` (the harness pins it, not `seedling-swim-u11`) |
| Commits | D2 `fbdd8b6` · D1 `e915dab` · D3 `f3b8e40` · D4 `d1edd06` · this report |
| Dev server | `scripts/serve-nocache.py 8910`, `SEEDLING_PORT=8910`, build `seedling_bot_ap_p4e` |

D2 was committed before D1: D1 ended in a STOP, and its instrument came after.

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `1c3fb6c`. Step 24 refused at wall 5 in 413.6 s, row-identical to U10's. Bounded vitest: 16 files / 1,096 tests. |
| D1 | **STOP (measured; no solver change)** | Wall 5 is not the opened lock row. Those cells read clear. L12's one pit tile is ringed by four `Pull` tiles, which no model transcribes and the planner prices as avoid volumes, so the pit is in another component by construction. The frontier then names a keyType-1 lock. Walking the funnel needs `Pull.update` transcribed, a simulation mechanic. |
| D2 | **PASS, with game witnesses** | `stepV2` takes the hit-parked `directionFace`, and U9's special case folds into it. The witness reds the old model at t44 and the fixed model reproduces it; the puncher arm's `hits` agree 51/51. Mutant: 1 red, by name, at t44. tapeRunner 385/385. |
| D3 | **PASS, with game witnesses** | The dark shield HITS a chaser through `enemyHit` and latches `hitByDarkStuff`. A sword lands through the i-frame the shield opened, and the game's own latch flag agrees. Mutant (f): 1 red at t57. tapeRunner 389/389. A shield kill, the spinner and the BobBoss stay refused by name. |
| D4 | **PASS** | Log section, bot page, reference ALL MATCH, surface GREEN 187, constants PASS 4,632, the profile witnesses (fast and full) name 136 keys, bounded vitest 24 files / 1,392 tests. |

**The one thing to know first.** Step 24 cannot be solved by any solver-side fix. L12's only pit is reachable only through a current of `Pull` tiles that writes the player's position directly every tick, and the model has never transcribed that ("routed around since R1"). U10's "the level admits the route" was measured with the avoid volumes off. The next step for step 24 is a ⚖ licence to transcribe `Pull.update`, with its own game witness.

## W0: the banked rows (at `1c3fb6c`, the main tree)

| Row | Result |
|---|---|
| identity block (`identity-block.sh .`) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 **`e28c1e5d…`/`c4841acb…`** · generated set OK. **All equal the brief's bank.** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 46990775`, all exit 0 |
| reference `--check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| campaign census | exit 0, `NO CHAIN ROOM MOVES`, chain 21 of 21 windows, 5,774 ticks; normalised md5 (tree path → `TREE`) `6f7f1e91…` |
| solver surface / constants / tape index | GREEN 187 / PASS 4,629 literals / 162 tapes |
| roster pins | `dialogueAutoAdvance` 162 (inert 161), `tapeEnvelope` 162, `observationTolerance` 162 ×2; R8 `exposed` 24 |
| profile / entity witnesses | both profile tiers name 135 keys; entities 461 leaves |
| step 24 (`--only=24 --timeout=1500`) | **REFUSED in 413.6 s**, U10's wall-5 text verbatim (*"reach-pit (36,43)->L21 -> keylock: bosslock@80,656 needs a key this run does not hold. The key is a SUB-ORDER — …"*); the row equals U10's in every field but `ms`/`views` |
| bounded vitest (the brief's 14 paths) | **16 files / 1,096 tests**, exit 0 |
| survey 22, 23, 25–30; chamber 12/12; corridor body 143/122 | quoted from the bank, not re-measured at W0. The survey is re-measured at the head (below). |

## D1: wall 5, measured (`e915dab`) — STOP

### The probe (a file-sink patch on `execKeylock`'s refusal, in a scratch worktree, on the survey's own run)

**Probe 1** (t2048):

- `lock` `bosslock@80,656`; the player at (423.67,258.09), tile (26,16);
- `openActivators` = `[bosslock@416,240, bosslock@432,240, shieldlocknorm@288,704]`; `keys` = `[0]`;
- `contacts` = `[proximity-hazard:bosslock@416,240]` (the player stands on that lock's key line).

In the 6×5 window over (24–29, 13–17), every cell that reads blocked is a `tree` (`tree@384,192`, `@384,224`, `@448,224`, `@448,256`). **The two opened lock cells (26,15) and (27,15) read CLEAR**, both with and without volumes, and so do (26,14), (27,14) and (26,16). My first plan query aimed at (584,696) without `allowPit` and was refused on the pit itself, so probe 2 carries `allowPit`, as the pit leg does.

**Probe 2** (the same tick): floods over the planner's own `plannerObstacleAt`, from the player and from U10's fresh-boot point (424,224), under four bags:

| bag | from the player (26,16) | from (424,224) |
|---|---|---|
| the solver's (`solverPlanOpts` + `allowPit`) | 702 tiles, **no pit**; *"no walkable tile path … different connected components"* | 702 tiles, no pit; the same refusal |
| `avoidVolumes: false` | 740 tiles, **pit reached**, 7 waypoints | 740, pit, 6 waypoints |
| `keys: ∅` | 702, no pit | 702, no pit |
| `contacts: ∅` | 702, no pit | 702, no pit |

- **The cause is a volume.** It is not the lock row, the keys or the contacts. The two start points are in ONE component of 702 tiles, and the frontiers are identical.
- **The volume is `Pull`.** The only volume-blocked tile on the frontier near the pit is `proximity-hazard:pull@576,640`, tile (36,40). It is the only gap between `tree@544,640` (34–35,40) and `dungeonspire@592,640` (37,40).

### The cause

L12 has **one** pit tile, (36,43), and all four of its neighbours are `Pull` entities:

| neighbour | blocked by |
|---|---|
| (36,42) | `pull@576,672` |
| (37,43) | `pull@592,688` |
| (36,44) | `pull@576,704` |
| (35,43) | `pull@560,688` |

`region1.oel` places 14 pulls, all force 1, and their directions point at the pit:

- (576,640…672): direction 0.75, i.e. 3π/2, which pushes +1 px/tick SOUTH;
- (560,672…720): direction 0, which pushes EAST;
- (592,656…720): direction 0.5, which pushes WEST;
- (576,704…720): direction 0.25, which pushes NORTH.

`Pull.update` is `e.x += force*cos(dir); e.y -= force*sin(dir)` on every overlapping Player/Enemy/Solid, every tick, with no `hit()`. No model transcribes it (`combat.js`: *"Routed around since R1; unchanged at R5"*), so `plannerObstacleAt` prices each pull tile as a proximity-hazard avoid volume. The pit is unreachable by construction. The frontier has no strategy for a pull, so it names the next obstacle it can resolve, the keyType-1 `bosslock@80,656`, a sub-order unrelated to the pit.

### The instrument

`scripts/procgen/probe-seedling-u11-wall5.mjs` re-measures this offline from a fresh L12 run with step 24's grants, in 1.2 s, with ALL PASS:

- one pit tile;
- four pull neighbours;
- the solver's bag reaches 167 tiles and refuses, while `avoidVolumes: false` reaches 182 tiles and plans 6 waypoints;
- peeling the nearest volume repeatedly opens the pit after exactly three, all pulls (`pull@576,640`, `@576,656`, `@576,672`).

### The brief's other D1 steps

- **Step 2 (the lock's passable tick).** Not needed: both locks were in `openActivators` and their cells read clear at t2048. The keylock verb waits for `openActivators` to hold the lock (the fade's end), as `opensOnKeyTick` 60 + 20 says.
- **Steps 3–5.** No planner geometry fix exists to make, so there is no fix and no mutant (e).
- **Step 6.** The survey still runs at the head (below), to show D2/D3 moved nothing.
- **STOPPED here,** per the brief: *"an honest STOP beats a widened scope"*. Transcribing `Pull.update` is a new simulation mechanic. It needs a licence and its own game witness, whose observable is the player's per-tick position on a pull tile.

## D2: the facing during a knockback's i-frame (`fbdd8b6`)

### The tick order, as read (`Player.as`)

1. An enemy that updates before the player calls `Player.hit`. That arms `hitsTimer = hitsTimerMax` and then calls `knockback(f, p)`, whose `if (hitsTimer > 0) directionFace = direction` **always** fires. It parks the facing the previous tick's `sprites()` left.
2. `Player.update`: … `input()`, inside `super.update()`. The press is `useItem` → `set slashing`/`set spearing`, which captures `direction` (still the parked, pre-hit value), then the move.
3. `sprites()`: `if (directionFace >= 0) direction = directionFace; else` derive it from `v`.
4. `hitUpdate()`: `hitsTimer--`; on reaching 0, `direction = directionFace; directionFace = -1`.

So through the whole i-frame `direction` is the parked facing. The model's `stepV2` called `nextDirection(direction, vx, vy)` with no `directionFace`, so the tick after a hit read the knockback's own heading.

### The fix

`stepOptsFor` carries `directionFace`. The drive's step and the BobBoss rock's release frame pass `damage.directionFace`, which by then includes this tick's hits, because the enemies update first. `stepV2` passes it to `nextDirection`. **U9's special case folds into it:** the shield box's render snapshot now reads `state.direction`, which is the game's. Only `previewStepper` keeps −1 (see the residue).

### The reader audit

| reader | reads | after D2 |
|---|---|---|
| `levelRun` `pressFacing` | the game's `direction` (the press's capture) | follows `directionFace`: the gap U10 found |
| `levelRun` `shieldRenderState` | the game's `direction` (the shield box) | U9's special case, folded |
| `levelRun:8391` `applyPlayerHit`'s `direction:` | the game's `direction` (what `knockback` parks) | unchanged: the pre-hit facing |
| `levelRun:11865` the `direction` getter | the game's `direction` | follows it |
| `strikePolicy.js:877/906/918/982` (`slashPressForecast`) | the game's `direction` (the press policy) | follows it in the drive; a preview takes no hit |
| `solverBot.js:2660` (`previewWalk`'s `slashSet`) | the game's `direction` (a previewed press) | a preview takes no hit |
| `botDriverV2.js:2541-2557` (`faceTowards`) | the game's `direction` ("already facing N?") | follows it: a tap inside an i-frame cannot turn the player, and the verb refuses by name |

No reader reads INTENT, so none needed a second fix.

### The witnesses (`plan-seedling-u11-facing.mjs`, with `--check`)

The keys are a fixed schedule, so the tape is the same bytes under either model. The witnesses were authored and recorded headless on the game BEFORE the fix, in a scratch worktree with its own server.

| tape | old model (pre-fix) | game | fixed model |
|---|---|---|---|
| `u11-facing-knockback` (L4 (64,32), sword, `down` ×20, a press at t21, 80 t) | swings UP (dir 1), misses; the bob's second contact at t44 | the bob is thrown south from t22; no second contact | **reproduces all 81 observations**; bob probe **81/81** (worst 1.4e-14) |
| `u11-facing-puncher` (L12 (400,248), U10's control boot and preview keys, 50 t) | the press at t35 swings WEST: puncher `hits` 1 | `hits` 2 from t36 | **51/51** puncher samples agree |

Measured on the old model:

- **tapeRunner:** *"tick 44 differs: expected (x=72, y=55.76107428115887), got (x=72, y=53.01222866529928)"*.
- **The bob probe:** fits `[]`, 118 disagreements from t22 (game v (−0.12, 4.56), model (−0.23, −0.44)).
- **The puncher probe:** 15 disagreements from *"t 36: game hits 2/30 model 1/0"*, while the player's positions stay bit-exact (the punch's knockback is absorbed by the wall to the west). That is U10's gap, reproduced.

### The mutant and parity

- **Mutant** (predicted first): `nextDirection` fed −1, one build, copied and restored md5-identical (`8eda1361…`). I predicted `u11-facing-knockback` red at t44 and `u9-shield-bob-shove` red. **Measured: 1 red / 384, `u11-facing-knockback` at t44.** `u9-shield-bob-shove`'s player stream cannot see its t27 shove (U9 found that with the body probe), so it stayed green. Re-run with D2, the body probe still agrees on all three of U9's witnesses (51 / 101 / 61 samples).
- **Parity:** tapeRunner **385/385**. A scan of all 162 committed tapes on the old model found 16 that ever hold a parked facing. In 14 of them the velocity-derived facing differs for some ticks, and **in none does a press fall while they differ**. `r5-bobboss-fire` presses 9 times while parked, but its facings agree, because the BobBoss writes `directionFace = 1` and `faceUp`. The roster is press-inert, so no committed expectation moved.
- **Byte-inertia at `fbdd8b6`** (a pristine worktree): the identity block equals W0 on every row, and the six `--check`s are unchanged.

## D3: the dark shield's hit (`f3b8e40`)

### What each family does

| family | the AS3 | the model now |
|---|---|---|
| `Bob` (no `hit` override) | `Enemy.hit(5, p, 0.5, "Shield")`: 0.5 dealt, i-frame 30, `knockback(f, p)`, latch | **modelled** (`darkShieldHitChaser` → `enemyHit` → `enemyKnockbackV`) |
| `Puncher` (no `hit` override; EMPTY `knockback`) | damage and i-frame, no shove, latch | **modelled** (`chaserKnocksBack` false) |
| any chaser at the kill | `startDeath("Shield")` | **refused by name** (the death staging and the kill ledger are not transcribed) |
| `Spinner` (no `hit` override) | damage, knockback, latch | **refused by name**: `hitSpinner` carries no latch, and `spinner.js` is outside the licence |
| `BobBoss` (`hit` override) | on form 2 with `hitsTimer <= 0`: `swords++` and the spin re-seeded; then `super.hit(0, null, d, t)`, i.e. damage with NO shove, an i-frame and the latch | **refused by name, narrower**: only when the dark arm fires (touch + `hitsTimer <= 0`); inside its i-frame the dark shield shoves like the plain one, which is modelled |
| a body inside its own i-frame | `o.knockback(5, p)`: the plain shove | unchanged (modelled since U9) |

- **Where it runs:** the live bump (`shieldBumpNow`) and the chaser forecast both call the one helper.
- **The ledger:** a hit adds `{hit: true, landed, hits, hitsTimer, shoved}` to `shieldBumps`.
- **The new profile key:** `darkShieldDamage: 0.5` (`Player.as:darkShieldDamage`, `bobBossFight.DARK_SHIELD_DAMAGE` beside `SHIELD_FORCE`).

**The latch's observable.** The brief asked whether the latch lets the NEXT BUMP through. It cannot: the bump's own gate is `o.hitsTimer <= 0`, so a second touch inside the i-frame is the plain knockback. The observable is a different damaging hit, a sword, inside the i-frame the shield opened.

### The witnesses (`plan-seedling-u11-dark-shield.mjs`, with `--check`)

Fixed keys. The tapes are emitted before the model is driven. They were authored while the model refused by name (at t16 and t13, as predicted), then recorded on the game, then fixed.

| tape | model (predicted) | game | fixed model |
|---|---|---|---|
| `u11-dark-shield-bob` (L4 (64,32), shield + dark shield + sword, `down` ×40, a press at t19, 58 t) | the hit at t16 (0.5/30, a shove); plain shoves t23–29; the sword lands at t19 THROUGH the i-frame (hits 1.5); contact at t57 | `hit_by_dark_stuff` true from t16, false from t20 (the sword's damaging hit clears it) | **reproduces every observation**; bob probe **59/59** (worst 7.1e-15) |
| `u11-dark-shield-puncher` (L12 (384,256), shield + dark shield, `right` ×40, 60 t) | the hit at t13 (0.5/30, NO shove); no player hit (the plain shield: contact t15, punch t35) | as predicted | **reproduces**; puncher probe **61/61** (worst 2.2e-16) |

**The bob arm's length was found by the game.** The first recording ran 100 ticks. The t57 contact throws the player east into L4's lethal pit at (88,72). `checkFallingInPit` sets `receiveInput = false` from t61, for its 20-frame lerp, and `die()`s at t80, with the respawn at (72,40). The model matched that recording to 1e-2 through t78, then refused the lethal pit by name. Recordings at 72 and 62 ticks still read `saw_input_refused`, because the game runs frames past the tape's end. At 58 ticks the recording passes clean.

### The mutant and parity

- **Mutant (f)** (predicted first): `c.hitByDarkStuff = false` after the dark hit, one build, restored md5-identical (`701eae34…`). I predicted `u11-dark-shield-bob` red at t57. **Measured: 1 red / 388, *"tick 57 differs: expected (x=74.63269078214032, …), got (x=72, …)"*.**
- **Parity:** tapeRunner **389/389**. The five committed `r2-walk-*` dark-shield tapes are `noDamage`, so no chaser is stepped. U9's scan found no stepped body in any shielded room, so they are vacuous.

## Surface, constants, profile and entity deltas

- **Solver surface:** 187 → 187, `--check` GREEN. No new run member and no new facade import: D1's probe is a script, not a family file.
- **Constants census:** 4,629 → 4,632, PASS, 0 unclassified.
  - D2: the advance's `inputBlocked` gate row retargeted to its new hash (`h5e6f118d`); U9's folded `directionFace >= 0` sentinel retired; the two `directionFace = -1` defaults classified `rule/sentinel` (`Player.as:directionFace`).
  - D3: the profile value, and the BobBoss refusal's `hitsTimer <= 0` classified `rule/bound`.
- **Profile:** 135 → 136 keys (`darkShieldDamage`); `profileMd5` `f32d4d47…` → **`cf76477e…`**. The pins in `seedlingProfile.test.js`, `profileBoot.test.js` and `seedlingProfileLoader.test.js` moved with it (key count, md5, anchored 69 → 70, defaulted). It is a NEW key: no existing value moved.
- **Profile witnesses:**
  - fast tier re-measured: 113 tapes, 431 s, `darkShieldDamage` **corpus-blind**, 0 verdicts moved;
  - full tier re-measured over all 166 tapes (from 157): 3,063 s at `--jobs=2`, `darkShieldDamage` **corpus-blind**, 0 verdicts moved. Both tiers name 136 keys, and `--check` PASS.
  - Corpus-blind is honest: the streams cannot see 0.5 vs 0.55 dealt when no witness kills.
- **Entities:** no new leaf (`CHASERS` untouched), 461 leaves, PASS.
- **Reference:** regenerated; instruments 299 → 302 (the two planners and the probe); the docs index follows the doc edits; `--check` ALL 7 + 5 MATCH.
- **Roster:** 162 → 166 (`dialogueAutoAdvance` 166/165, `tapeEnvelope` 166, `observationTolerance` 166 ×2); R8 `exposed` 24 → 28, all four witnesses declared in `exposedAdded` and in the test's three name lists; tape index 166.

## What the brief got wrong (measured)

1. **"Wall 5: the opened lock's cell still reads solid / the component view is stale / the tile under the player".** None of these. The lock cells read clear and there is no component cache (`planTilePath` is a fresh A\* per call). The wall is the `Pull` funnel around L12's one pit.
2. **"A FRESH run booted at (424,224) … reaches all four of the pit's neighbour tiles in 6–9 waypoints … so the level admits the route."** True only with `avoidVolumes: false`. Under the solver's own plan bag, (424,224) is in the same 702-tile component as the stuck player.
3. **"Step 24: predict SOLVED, ~2,300–2,600 t."** It stays REFUSED at the same text: a fresh probe cannot change a wall that is a missing mechanic.
4. **"the witness … puncher `hits` 2 vs 1 from t36 … predict the model FAILS it at the first divergent tick".** For U10's L12 shape the player stream cannot fail: the punch's knockback is absorbed by the wall, and even the old model's death respawns on the same pixel. The puncher arm is kept, and its observable is the body probe. The stream-visible witness is a bob on L4 (`u11-facing-knockback`).
5. **"whether the latch lets the NEXT bump through its i-frame".** It cannot. The bump's gate is `o.hitsTimer <= 0`, so only another damaging hit (a sword) can use the latch.
6. **"`darkShieldDamage` … is it a profile key yet?"** It was not. It is now, at 0.5.
7. **Mutant (D2)'s second red.** `u9-shield-bob-shove`'s stream cannot see the t27 shove the fold restores, so the stream gate does not witness the fold. The body probe does.

## Residue

- **Step 24: transcribe `Pull.update`.** It writes the player's x/y directly every tick, in update order, on overlap. It needs its own game witness, then a planner policy that admits a pull tile whose push is modelled.
  - The frontier misattributes the unmodelled pull as a keyType-1 sub-order. A refusal that named the pull would save the next reader a probe.
  - ⚖ This is the user's to license.
- **`previewStepper` carries no `directionFace`** (nor the i-frame's recovery): a preview started inside a live i-frame derives the facing from `v`. That is the same frozen-gate approximation `steerBlocked` already makes there. No committed solve previews during an i-frame (the six `--check`s are unmoved).
- **The dark shield still refused:**
  - a shield KILL (`startDeath("Shield")` and the kill ledger);
  - the spinner (`hitSpinner` needs the latch; `spinner.js` licence);
  - the BobBoss's dark hit (a latch for `bobBossHit`, plus form 2's `swords++` with no shove). The BobBoss executor's forecast (`fc.shieldBump`) still shoves under the dark shield, so a fight with it would be refused by the live run rather than mispriced.
- **The latch's own field** is not projected into `run.chasers`. The game's `hit_by_dark_stuff` was compared by hand (t16 → t20), not by the probe.
- **`standing-values.json`** is not rewritten, per the rules.
- **Scratch instruments** (session scratchpad, not committed):
  - the two `execKeylock` file-sink probes;
  - `d2/explore.mjs`, `bob.mjs`, `fixed.mjs`, `scan.mjs` (the 162-tape parked-facing scan);
  - `d3/dark.mjs`, `fall.mjs`, `latch.mjs`;
  - the patch scripts `patches/d2.py` and `d3.py`.

## Byte-inertia

| Artifact | W0 (`1c3fb6c`) | D2 (`fbdd8b6`, pristine worktree) | D3 (`f3b8e40`, pristine worktree) |
|---|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** | **identical** |
| killgate s2/s5/s9 | `63d34807` `fb207b8e` `bfbdfb38` | **identical** | **identical** |
| level pre/post s1 | `e28c1e5d` / `c4841acb` | **identical** | **identical** |
| generated set | OK | OK | OK |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 46990775`, exit 0 | **identical** | **identical**, exit 0 |
| campaign census | NO CHAIN ROOM MOVES, 5,774 t, `6f7f1e91…` | — | **identical** (NO CHAIN ROOM MOVES, 5,774 t, `6f7f1e91…`) |
| survey step 24 | REFUSED, U10's text (`bac81e1b…`) | — | REFUSED, the same text; row md5 (sans `ms`/`views`) `a5d18e6b` = U10's `a5d18e6b` (493.5 s) |
| survey 22, 23, 25–30 | the bank's rows (U9's JSON) | — | **row-identical**: md5 pairs 22 `671973a3`, 23 `341eb8ba`, 25 `68909100`, 26 `4319c056`, 27 `1440e6ac`, 28 `643cacb4`, 29 `c2facdbc`, 30 `bee5e241`, each equal to U9's row; route and generator blocks identical (`seedling-swim-u11-survey.json` `722397df…`) |
| tapeRunner | 381 rows (162 tapes) | 385 (+4) | 389 (+4) |
| bounded vitest (the brief's 14 paths + every touched suite) | 16 files / 1,096 | — | **24 files / 1,392**, all pass. One run read 23 files / 1,388 with `seedlingProfileWitness`'s 4 full-tier rows red pending the full write; that suite then passed 8/8 after it |
| reference `--check` | ALL 7 + 5 MATCH | 6 differ (docs owed) | 8 differ at `f3b8e40`, then **ALL 7 + 5 MATCH** at `d1edd06` (regenerated) |
| `fixtures/**` | — | the two facing witnesses + `tapes/index.json` | **the four witnesses only** (two tapes + two expectations each D) and `tapes/index.json`; `campaign-frontier.json` untouched |

None of the following was touched or run: AS3, wasm, gitlinks, any committed tape or expectation other than the four new witnesses, biome defaults, `standing-values --write`, `pytest`, unfiltered vitest.

## For ⚖ Q40: survey steps 22–30 at the head

`--through=2.2 --only=22,23,24,25,26,27,28,29,30 --timeout=1500`, one run. The tool takes one per-step timeout; 1,500 s is step 24's need (a 493.5 s refusal under load), and every other step finishes in under 5 s. Result: **8/9**. Every row is identical to the bank in all fields but `ms`/`views`.

| step | room | verdict | a game recording of this survey segment? |
|---|---|---|---|
| 22 | L13 | SOLVED 48 t | no (the survey solves in memory; `r9-solve-13` is a different L13 segment, 36 t) |
| 23 | L0 | SOLVED 229 t | no |
| 24 | L12 | REFUSED: wall 5, the `Pull` funnel (D1) | no (L12's tapes are other walks and the witnesses) |
| 25 | L21 | SOLVED 26 t | no |
| 26 | L22 | SOLVED 89 t | no |
| 27 | L29 | SOLVED 383 t | no (`r5-bosskey-leg`, 1,070 t, is another walk) |
| 28 | L31 | SOLVED 336 t | no |
| 29 | L30 | SOLVED 210 t | no |
| 30 | L32 | SOLVED 1,056 t | **yes**: `swim-u5-bobboss-encounter` (1,056 t, U5's game recording of the encounter) |

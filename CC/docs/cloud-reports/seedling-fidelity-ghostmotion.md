# Seedling fidelity GHOSTMOTION: the ghost sword's dash re-arms on its own animation clock

**Slice:** `seedling-fidelity-ghostmotion`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-5`), wave 10 (model coverage).

| | |
|---|---|
| Started from | **`3e0ff8b80f`** (main after the hammer arc's B2; not rebased) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/ghost-sword-motion-qn5oet` (the harness branch IS the slice branch; no local `seedling-fidelity-ghostmotion`) |
| Commits | D1+D2 `6f1be6a` · D3 + records `21a26cf` · this report |
| Dev server | `serve-nocache.py 9510` (`SEEDLING_PORT=9510`), this tree only |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (ON, byte-inert) · D3 PASS** (18/18 legs move from diverged to done on the game). One CI red for the planner: the standing roster row (needs `standing-values --write`) |

## The one thing to know first

**A dash re-arms only when the animation it played ends, and the ghost sword's dash animation is 6 ticks, not 4.** `slashEnd()` is the swing sprite's own callback. It runs from `sprites()`, below the press, and it is what clears `slashDashed`. `levelRun` timed that release off the plain sword's table (`SLASH_ANIM_TICKS`, 5 / 4) for every swing. Wave 9 gave the ghost swing its 7 / 6 hit TESTS but not its RELEASE. So the solver's sword dash chain (presses 0 · 2 · 8 · 14) dashed at t 8 in the model, while the game swallowed that press: the t 2 ghost dash is still playing until the end of t 8. One `knockback(2, …)` along travel is the sweep's 2.00 px (1.41 on each axis of a diagonal), and t 9 / t 29 are the t 8 / t 28 presses of the first two `slashTimer` windows. The ghost sword's own chain is 0 · 2 · 10 · 18.

## W0 (at `3e0ff8b80f`, before any edit, this tree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9510 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`8b6d3065c1a012fb368cc31f58719855`**. maze `246dfbce…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate `006b0639…`/`7d4cb820…`/`49e23d85…`, levels `e28c1e5d…`/`fb1a59e5…`, generated set `OK`; reference `4 … DIFFER` (environmental, as every cloud slice). All equal to B2's published base |
| six producers | the block's loop | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `13b8d51f`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, sorted `fullName\tstatus` lines | **575**, md5 `fbe5fc605470431789b76760698b9564` (my serialization; B2's `8635ad89…` is a different one over the same 575), 0 non-pass |
| surface / constants / entities / profile | each `--check` | GREEN 227 · PASS 5,443 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 259 |
| bounded vitest BEFORE | 41 files: the brief's list, plus `tapeRunner`, `combatVerbs`, `presses`, `levelRun`, `solverBot`, `fidelityDash`, `breakVerb`, plus every `grep -a` hit for what I touch (`DASH_CHAIN`, `dashPrefixesFor`, `SLASH_ANIM_TICKS`, `slashInfo`, `endsAt`, `planSwordDash`, `previewWalk`, `ghostSword.js`, `DASH_DISPLACEMENT`): `director`, `playthroughAcceptance`, `solverBotLethalPit` | **2,299 tests, all green** |

## D1: what the game does (PASS)

**The AS3** (`vendor/seedling/src/Player.as`):

| Piece | Where | What it means for motion |
|---|---|---|
| the dash | `set slashing` arm 1: `slashTimer > 0 && _s && !slashDashed` → `slashDashed = true; play("slashnarrow"); knockback(2, Point(x - v.x, y - v.y))` | +2 along the player's own velocity; `slashTimer` NOT refreshed |
| the re-arm | `slashEnd()` → `slashing = false` → `if (!_s) slashDashed = false` | only when the PLAYING animation ends |
| the animation | `getSword()`: `hasGhostSword ? sprGhostSword : …`; all three sprites take `slashEnd` as their callback (`:41-45`) | the clock is the swinging sword's |
| ghost frames | `sprGhostSword.add("slash", [0,1,2,2,3,3,4], 30)`, `("slashnarrow", [0,1,2,3], 20)` | **7** and **6** ticks (sword: 5 and 4) |
| the order | `slash()`'s `slashTimer--` above `super.update()`; the press in `input()`; `sprites()` (→ `slashEnd`) below | a press ON the animation's last tick is still swallowed |
| other motion | no movement arm reads `slashing` (`:1188`, `:1234` are the shield sprite's cosmetic offset) | the release clock is the ONLY motion difference between the swords |

**Reproduced on the game**: sweep leg 760, `level_102__r5c9 <- in_L101_144_96 -> exit:out_teleporter_224_96`, re-derived and played with `probe-seedling-divergence-sweep.mjs --mode=inv --ids=760 --page-legs=1`. It diverged at t 9: model x 204.6 (vx 3.6), game 202.6. The node solve of the same leg, with the game's inventory (`slots [4,1,2]`, sword + ghost sword), gives the same 16-tick plan: `right` + presses at 0 · 2 · 8 · 14 = `DASH_CHAIN_PATTERN`.

**Per tick, on the game** (`ghostmotion-l102-axis`, the leg's own stance and presses; `t` = ticks completed, the sweep's convention):

| t | keys | game x | model ON x (vx) | model OFF x (vx) | OFF − game |
|---|---|---|---|---|---|
| 1 | right+primary | 184.800 | 184.800 (0.80) | 184.800 (0.80) | 0 |
| 3 | right+primary | 189.250 | 189.250 (3.10) | 189.250 (3.10) | 0 (the t2 dash) |
| 8 | right | 201.000 | 201.000 (1.85) | 201.000 (1.85) | 0 |
| **9** | **right+primary** | **202.600** | **202.600 (1.60)** | **204.600 (3.60)** | **+2.000** |
| 10 | right | 203.950 | 203.950 | 207.950 | +4.000 |
| 15 | right+primary | 211.350 | 211.350 (2.90) | 222.950 | +11.600 |

Press outcomes: game = model ON = `0 slash · 2 dash · 8 SWALLOWED · 14 dash`; OFF = `0 slash · 2 dash · 8 dash · 14 dash`.

**Diagonal** (`ghostmotion-l102-diag`, L102 (96,144), open floor, `right`+`down`, presses 0 · 2 · 9 · 15): game = ON at 0.000 on both axes on every tick. Outcomes `slash · dash · dash (gap 7) · SWALLOWED (gap 6)`. OFF dashes the t 15 press: **(+1.414, +1.414) at t 16**. This witness pins the clock from both sides: a gap of 7 dashes, so the clock is ≤ 6, and the axis tape's gap of 6 is swallowed, so it is ≥ 6.

**The game's own counter**: `probe-seedling-dash-window.mjs --tape=ghostmotion-l102-{axis,diag}`. `Bot.slashTests` equals the model's cumulative count at **25 of 25** sampled ticks on each, 14 tests apiece (2 + 6 + 6). A dash at t 8 would have restarted the window. Evidence: `seedling-fidelity-ghostmotion-evidence/slashtests-{axis,diag}.json`.

**Why t 9 / t 29.** The sword chain's window repeats every 20 ticks (`ORDINARY_SWING_PERIOD`): swing 0, dashes 2 · 8 · 14, swing 20, dashes 22 · 28 · 34. The first press the game swallows is t 8 (or t 28 when the leg's chain starts in the second window), and it shows one tick later.

**Leg 620 (L73)** does NOT share it. Its inventory holds no ghost sword (`hasGhostSword: false`, `slots [0,1,3,2]`). The game's t 2 row differs by (−1.87, −1.47), |Δ| 2.38 and not along travel (travel was straight up, vx 0). It is a different arm (see Residue).

## D2: the model (PASS, ON, byte-inert)

- **`ghostSword.js`**: switch `GHOSTSWORD_MOTION` (ON; `SEEDLING_GHOSTMOTION=0|1`; `withGhostSwordMotion`). Added `ghostClockFor(weapon)` (needs both ghost switches), `slashEndTicksFor(anim, weapon)` (the ghost's 7 / 6, else `SLASH_ANIM_TICKS`), and `GHOST_DASH_CHAIN` = 2 · 10 · 18.
- **`combatVerbs.js`**: `DASH_CHAIN` is now `deriveDashChain(SLASH_ANIM_TICKS)`. It is the same loop parameterised by the animation table, and the sword's chain is byte-identical: 2 · 8 · 14, swallowed 4 · 6 · 10 · 12 · 16 · 18.
- **`levelRun.js`**: the press's `slashEndsAt` = `slashEndTicksFor(anim, weaponForPress())`. `slashInfo`, and through it `slashPressForecast`, now carry the ghost release.
- **`solverBot.js`**:
  - `previewWalk`'s planned-dash release reads the same function (keyed on the gate's `hasGhostSword`);
  - `GHOST_DASH_CHAIN_PATTERN` = 0 · 2 · 10 · 18;
  - `dashPrefixesFor(mode, {weapon})` takes an optional second argument;
  - `planSwordDash` passes `weapon: 'ghostsword'` in a ghost-sword room.
- **`solverView.js`**: three new exports (`GHOST_DASH_CHAIN`, `ghostClockFor`, `slashEndTicksFor`).

**Byte-inertia, switch ON**: tapeRunner's 575 pre-slice rows are unchanged (579 with the 4 new witness rows, 0 non-pass). The identity block AFTER and the six producers are in § Byte-inertia. No committed tape or producer moves, so it ships **ON**. OFF reproduces the BEFORE model: the CI survey rows exactly, and the sweep's +2.00 at t 9.

**Mutants** (predicted, then made by copy → edit → restore; `ghostSword.js` md5 restored `0e93e64f5adc26994a87dd76b8151be4`; run: `vitest run tapeRunner.test.js -t ghostmotion`):

| Mutant | Predicted | Measured |
|---|---|---|
| M1 `SEEDLING_GHOSTMOTION=0` | both witnesses red (axis t 9, diag t 16) | axis `tick 9 differs`, diag `tick 16 differs` |
| M2 ghost dash clock 6 → 5 | both red | axis t 9, diag t 16 |
| M3 ghost dash clock 6 → 7 | axis GREEN (the gap-6 swallow holds), diag red at t 10 (gap 7 swallowed) | exactly that |
| M4 ghost swing clock 7 → 5 | both GREEN: blind. The opening swing's end never decides while `slashTimer` is up (the second press dashes either way) | both green |

`ghostMotion.test.js` (new, 10 rows): the switch, the clock ON/OFF, both chains, `dashPrefixesFor` with a weapon, and `levelRun`'s release on the witnesses' stance (ON 8 / OFF 6, the outcomes, and the plain sword untouched by the switch).

## D3: the census (PASS)

### The sweep legs (on the game: `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --ids=…`, port 9510, at `6f1be6a`)

| Legs | Room | BEFORE (sweep-3 @ `e8112a3072`, re-run 38014182034) | AFTER |
|---|---|---|---|
| 760, 761 | L102 | tick-exact divergence (t 9) | **done**, 0 divergences; plans 20 t, 26 t |
| 785 | L109 → `out_teleporter_160_48` | tick-exact divergence | **done**, 0 div., 104 t |
| 791 | L111 | tick-exact divergence | **done**, 0 div., 131 t |
| 798, 799 | L113 ← L112 | tick-exact divergence | **done**, 0 div., 132 t / 90 t |
| 807, 808, 814, 815 | L113 ← L114 | tick-exact divergence | **done**, 0 div., 77 / 76 / 78 / 77 t |
| 819–822 | L113 ← L115 (64,144) | tick-exact divergence | **done**, 0 div., 114 / 112 / 77 / 78 t |
| 826–829 | L113 ← L115 (80,144) | tick-exact divergence | **done**, 0 div., 115 / 115 / 76 / 77 t |
| 779 (walker) | L107 ← L102 | diverged 4× | **crossed**, 0 div. (278 t) |
| 620 | L73 | t 2 divergence, recovers | unchanged: t 2 (−1.87, −1.47), recovers, done |

**18/18 diverged → done, every one on its first plan.** Rows: `seedling-fidelity-ghostmotion-evidence/sweep-after-18-plus-620.jsonl`, `sweep-after-779-walker.jsonl`; the local BEFORE rows of 760 and 620 at `3e0ff8b80f`: `sweep-before-{760,620}.jsonl`.

### The survey rows (`survey-seedling-route.mjs --through=end --route=full --timeout=1500 --only=207,…,220`, local)

| Step | CI 38010117701 | OFF (local) | ON (local) |
|---|---|---|---|
| 207 | SOLVED 185 | 185 | 185 |
| 208 | REFUSED (LADDER, `darktrap`) | = | = (danger point 88.2 → 87.8) |
| 209 | SOLVED 16 | 16 | **20** |
| 210, 211, 213, 218, 219 | REFUSED | = | = |
| 212 | SOLVED 135 | 135 | **158** |
| 214 | SOLVED 161 | 161 | **173** |
| 215 | SOLVED 22 | 22 | **26** |
| 216 | SOLVED 79 | 79 | **82** |
| 217 | SOLVED 95 | 95 | **112** |
| 220 | SOLVED 173 | 173 | 173 |

**Verdicts are unchanged.** Six solved plans grow by 3–23 ticks: the old ones relied on dashes the game swallows (they were the sweep's divergences, priced as speed). OFF equals CI on every row, so every move is this switch's. Rows: `seedling-fidelity-ghostmotion-evidence/survey-207-220-{on,off}.json`.

### The CI dispatches for the planner (I cannot dispatch; 403)

- **Survey**: `seedling-survey.yml` on `claude/ghost-sword-motion-qn5oet`, inputs `through=end`, `route=full`, `only=207,208,209,210,211,212,213,214,215,216,217,218,219,220`. Expect the ON column above.
- **Sweep, wasm** (the JS arc's workflow; the sweep-3 inputs), on the same branch: inv mode, `ids=760,761,785,791,798,799,807,808,814,815,819,820,821,822,826,827,828,829,620` (solver), and `ids=779` with `producer=walker`. Expect 18 done with 0 divergences, 779 crossed, and 620 unchanged.
- **Probe** (optional, the game-side witnesses): `seedling-probe.yml` running `probe-seedling-dash-window.mjs --tape=ghostmotion-l102-axis` and `--tape=ghostmotion-l102-diag` (expect 25/25 each).

## For the JS arc: pins, fields and words

**Pins red on CI** (`ci-vitest-summary.mjs 6f1be6a`: 19,343 passed, 1 red):
- `rosterCategories.test.js` › "the LIVE row carries one part per derived category": expected 201, the standing row says 199. The two witnesses join the `mechanic` tier, and that row is written only by `standing-values --write` (⚖ forbidden to this slice). **STOP: the planner re-banks it** (199 → 201, after a full-tier run). The JS arc's own pins: none red.

**New, optional** (nothing removed; no signature of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` touched):
- `solverBot.dashPrefixesFor(mode, {weapon})`: the second argument is optional, and the default `'sword'` gives the old answer;
- `solverView` exports `GHOST_DASH_CHAIN`, `ghostClockFor`, `slashEndTicksFor` (surface 227 → 230, all classified);
- `ghostSword.js`'s `GHOSTSWORD_MOTION` and its `SEEDLING_GHOSTMOTION` hook;
- `combatVerbs.deriveDashChain`.

No new `SolverRefusal.obstacle.kind`, no new staging/result field.

**What to wire:** nothing is required. The JS runtime, the wasm arrival and the solver worker reach the fix through the shared `levelRun` and `solverBot`. CANCROSS's `solverStamp` moves (`levelRun.js`, `solverBot.js`, `combatVerbs.js`, `ghostSword.js`), so derived rules read STALE until re-derived.

## For the hammer arc (its D1 table, measured or transcribed here)

| Weapon | Press rect (along × across) | Reach gate | Line gate | `genericHit` arm, force, damage | Hit tests (swing / dash) | Release clock (swing / dash) | Dash chain in one window | Motion |
|---|---|---|---|---|---|---|---|---|
| sword | 16 × 32 (dash ×1.5 / ×0.65 → 24 × 20.8) | 16 (dash 24) | applied (waived for Solid / Rope / Flyer) | "Sword", 5, 1 | 5 / 4 | 5 / 4 | 0 · 2 · 8 · 14 | dash: +2 along v; nothing else |
| darksword | as the sword (`sprSlashDark` = the sword's frames) | as the sword | as the sword | "Sword", 5, **2** | 5 / 4 | 5 / 4 | 0 · 2 · 8 · 14 | as the sword |
| ghostsword (with the sword) | **24 × 48, no dash squash** | **24** | **waived for every target** | **"Spear"**, 5, **2** | **7 / 6** | **7 / 6** (this slice) | **0 · 2 · 10 · 18** | dash: +2 along v; nothing else |
| ghostsword (without the sword) | the swing plays, never tests (`slash()` is `if (hasSword)`) | — | — | — | 0 | `slashTimer` never counts down | refused by name | — |
| spear | `Player.spear()`'s own arm; not measured here (wave 9: its 32 × 5 rect plays no part in a ghost press) | — | — | "Spear" | — | — | — | — |

Damage per class under "Spear" is wave 9's table (`ghostSword.GHOST_PRESS_ARMS`; spinner: through `Enemy.hit`, 2 damage).

**Hand-over (hammer-owned, not edited):**
1. `levelRun.spinnerFightForecast` (`levelRun.js` ~14491: `endsAt = t + SLASH_ANIM_TICKS[state.anim]`) and `spinnerForecastWithPress` still release a ghost swing on the sword's clock. To match the run, read `slashEndTicksFor(state.anim, weapon)`. Both forecasts also fire only `th.weapon === 'sword'` (wave 9's residue).
2. `deriveStrike` / `execKillByPress` gate on `primaryWeapon === 'sword'`. A ghost press would also need `GHOST_DASH_CHAIN` wherever a chain is assumed.
3. The witnesses here are the motion half: `ghostmotion-l102-axis` / `-diag`. A ghost-vs-spinner witness is theirs.

**Also outside this region:** `solverBot.forecastEncounterPlan` (`solverBot.js` ~915, the bobBoss strike) uses `SLASH_ANIM_TICKS` and `hasSword: true`. That is the ENCOUNTERS region, sword-only by construction.

## Deltas

**New files:**
- `scripts/procgen/plan-seedling-ghostmotion.mjs` (author + `--check`; `check-procgen-help` PASS);
- tapes + expectations `ghostmotion-l102-axis`, `ghostmotion-l102-diag`;
- `frontend/modules/seedlingDemo/ghostMotion.test.js`;
- `CC/docs/cloud-reports/seedling-fidelity-ghostmotion-evidence/` (slashTests ×2, survey ON/OFF, sweep rows before/after).

**Changed:** `ghostSword.js`, `combatVerbs.js`, `levelRun.js`, `solverBot.js`, `solverView.js`.

**Records:**
- surface GREEN **230** (`--write`, 3 rows classified; the unused `GHOSTSWORD_MOTION` door retired);
- constants **5,443** (`--write`: 0 new, 48 moved re-banked); entities 528 and profile 138 PASS, unchanged;
- roster **261**; tape index regenerated;
- `seedling-bot.md` (a ghost-motion block), `seedling-bot-log.md` (entry + three trap candidates);
- reference: instruments + docs index regenerated (the four substrate regions left as committed, environmental).

**Pins moved and re-pinned** (each named in its test): roster 259 → 261 (`tapeEnvelope`, `observationTolerance` ×2 incl. `swapped` 261 measured, `dialogueAutoAdvance` ×2 incl. 260 unparted). `r8Acceptance` is unmoved (the L102 witnesses expose no enemy).

## What the brief got wrong (measured)

1. **"Fix the motion" (`levelRun`'s press/dash arms)**: the motion arms were right. The dash impulse, its direction and its decay all match the game to 0.000 px. The defect is the dash's RE-ARM clock, which is a timer, not a motion arm.
2. **"Possibly a press-cycle multiple"**: yes, but of the sword's 20-tick window, not of the ghost's. t 9 / t 29 are the sword chain's t 8 / t 28 presses, shown one tick later.
3. **"Leg 620 possibly the same arm"**: no. It holds no ghost sword, and its delta is 2.38 px off the travel axis.
4. **"The ghost sword's swing" was assumed to be the culprit**: it is the dash's release. The swing's own release (7 vs 5) is blind on every chain (M4), because the second press of a window always dashes.
5. **"Edge cost today: 0 weighted blocks"** stands for the sweep, but the survey shows the price: six solved plans were 3–23 ticks short, because they spent dashes the game swallows.

## Residue

1. **Leg 620** (L73, sword only, `up` + primary at t 2): the game moves (−1.87, −1.47) more than the model on the press tick. Unattributed; not the dash clock (no ghost sword, wrong direction). It recovers and completes.
2. **The two hammer-owned forecasts** above read the sword's clock for a ghost swing (hand-over 1).
3. **M4 is a blind spot by construction**: no stream can see the ghost SWING's release while `slashTimer` is up. A witness would need a press after t 20 with no dash between, which costs a whole window.
4. `check-procgen-help.mjs` reports 25 FAILs (IMPORT / HELP side effects) on scripts this slice never touched, on a clean tree at `6f1be6a`. Not measured at the base; mine passes.
5. The survey and sweep AFTER rows were measured locally (node / p4f on this box). Re-run them on CI (the dispatches above) before banking the tick counts.

## Byte-inertia

- tapeRunner (bounded AFTER, switch ON): **579 rows, 0 non-pass**, md5 `72dd8680ea079f2e49eb8f0b4bd53842`; the 575 pre-slice rows are identical to W0 (`diff` shows only the 4 added lines).
- identity block AFTER (this tree at `21a26cf`, port 9510): **byte-identical to W0** (`diff` empty; log md5 `8b6d3065c1a012fb368cc31f58719855` both times): every row, the six producers and the reference line included.
- six producers at the head: battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `13b8d51f`, all exit 0 = W0.
- bounded vitest AFTER: the 41 W0 files + `ghostMotion.test.js` = **42 files, 2,315 tests, all pass** (W0 2,299 + the 10 new rows + the 4 witness rows + 2 re-pinned rows).
- CI `JavaScript Unit Tests` (`ci-vitest-summary.mjs`): at `6f1be6a` run 38064164941 and at `21a26cf` run 38065842719: **19,343 passed, 1 red**, `rosterCategories` (199 → 201, § For the JS arc). This report adds no code.

## Rows to BANK

- `GHOSTSWORD_MOTION` **ON**; tapeRunner pairs **579** (575 + 4);
- roster **261**; surface **230**; constants **5,443**; entities 528; profile 138; R8 exposed unchanged;
- ⚠ the standing roster row's `mechanic` part: 199 → **201** tapes (needs `standing-values --write` after the tier run; red in CI until then);
- sweep (local, on the game): legs 760 761 785 791 798 799 807 808 814 815 819–822 826–829 **done, 0 divergences**; 779 (walker) **crossed**; 620 unchanged;
- survey (local): 207–220 verdicts unchanged; 209 → 20, 212 → 158, 214 → 173, 215 → 26, 216 → 82, 217 → 112.

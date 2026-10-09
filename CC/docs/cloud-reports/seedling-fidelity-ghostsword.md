# Seedling fidelity GHOSTSWORD: the ghost sword swings like a sword, hits like the spear, and needs the sword

**Slice:** `seedling-fidelity-ghostsword`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-4`), wave 9 (model coverage).

| | |
|---|---|
| Started from | **`cf647f39ef`** (main before the hammer arc's A2+A3 merge; not rebased) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-ghostsword-model-1kkim4` (the harness branch IS the slice branch; no local `seedling-fidelity-ghostsword`) |
| Commits | D1+D2 `f93998e` · D3 `5ce00b7` · docs + reference `51a8952` · this report |
| Dev servers | `serve-nocache.py 9480` (this tree), `9481` (a pristine BEFORE worktree `/home/user/wt-base` @ `cf647f39ef`, `node_modules` and submodules symlinked) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** (survey 0/10 → 8/10; two steps move on to walls outside this region). One CI red left for the planner: the standing roster row (needs `standing-values --write`) |

## The one thing to know first

**The ghost sword only works if the player also holds the sword.** `Player.update` calls `slash()` only `if (hasSword)` (`Player.as:560-563`). A ghost sword held alone plays its swing and never tests anything. The game agrees: with the sword removed from the seam, the L3 ghost rock survives and the walk stops at x 18 (evidence tape `ghostsword-l3-nosword`). The model refuses that state by name; everything else about the ghost press is now modelled and ON.

## W0 (at `cf647f39ef`, before any edit, in the pristine worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9481 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` (venv active) | maze `246dfbce…`, acceptance `608693d2…`, c3 `043e1944…`, c6 `f85e7722…`, c4 `4aa74add…`, ENEMY `25417923…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `01210c82…`/`07ce222a…`/`30a1e3e7…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`, generated set `OK`; reference `4 … DIFFER` (this container's uninitialised substrate submodules) |
| six producers | the block's loop | battery `405d9c4b`, d2-chain `8e7a43be`, l18 `33d20889`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `a569eeec`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, sorted `(fullName, status)` | **557**, md5 **`bda9fe128afe10d746d9eb16c9b20af3`**, 0 non-pass |
| surface / constants | the two `--check`s | GREEN 220 / PASS 5,414 |
| roster | `fixtures/tapes/index.json` | 250 |
| bounded vitest BEFORE | 52 files: the brief's list plus every `grep -a` hit for what I touch (`activators`, `blockRoute`, `bobBoss`, `botDriverV2`, `breakVerb`, `breakableRocks`, `combatVerbs`, `director`, `encounters`, `fidelityBurn`, `fidelityL14`, `fidelitySlots`, `levelRun`, `playthroughAcceptance`, `presses`, `procgenDoorElements`, `r5Totem`, `r7Acceptance`, `seedlingAtlasCheckTable`, `solverBot`, `tapeFormat`, `wasmDelivery`) | **52 files / 2,427 tests, all green** |

## D1: what the game does (PASS)

Read from `vendor/seedling/src/Player.as`, then witnessed on the game.

| Piece | The AS3 | Ghost sword | Plain sword |
|---|---|---|---|
| the press | `useItem` cases 0 and 4 are one arm: `slashing = true` | same setter, same four outcomes (slash / dash / swallowed / gated) | — |
| which sword swings | `getSword()`, re-read at the top of every `update()` | the `hasGhostSword` FLAG, not the slot | — |
| the caller | `if (hasSword) slash();` (`:560`) | **never tests without the sword** | — |
| the rect | `getSlashRect`: `h = hasGhostSword ? width*2 : height` | 24 along × 48 across | 16 × 32 |
| the dash squash | `render`: `slashnarrow && !hasGhostSword` | none: a ghost dash is 24 × 48 too | 24 × 20.8 |
| the reach gate | `distanceRectPoint ≤ width * scaleX` | 24 | 16 (dash 24) |
| the line gate | `!collideLine("Solid") \|\| hasGhostSword \|\| …` | **waived for every target** | applied (except Solid/Rope/Flyer) |
| the arm | `genericHit(e, hasGhostSword ? "Spear" : "Sword", swordForce, …)` | `"Spear"`, force 5, damage 2 (`ghostSwordDamage`) | `"Sword"`, force 5, damage 1 (dark 2) |
| the window | `[0,1,2,2,3,3,4]` at 30, `[0,1,2,3]` at 20, under the `FP.elapsed` clamp | **7 tests** (dash 6) | 5 (dash 4) |

What `genericHit(e, "Spear", 5, 2)` does per class:

| Class | The game | Model |
|---|---|---|
| `Enemy` (per-class kill arms) | `hit(5, p, 2, "Spear")`: two damage, knockback, i-frame | modelled (`pressHitDamage`/`pressHitType`) |
| `IceTurret` | `bump(p, "Spear")` (refused: not Fire/Pulse), then `Enemy.hit` | modelled |
| `BreakableRock` | `hit(hasGhostSword ? 1 : 0)`: the FLAG, so rockType 0 and 1 both break | modelled |
| `RopeStart` | `hit()`, no `t` | modelled (reach 24) |
| `LightPole` | `if (t == "Spear") hit()`: a ghost swing toggles it | modelled (its own `hitsTimer` refuses the repeats) |
| `Tile` (bridge) | `if (t == "Spear") bridgeOpeningTimer--` on every one of the seven tests | **refused by name** (the bridge model counts one decrement) |
| `PushableBlockSpear` | `hit(<facing now>, t, true)`: the relative arm | **refused by name** (the facing at each test, on up to seven tests) |
| `Grass`, `Tree` | `cut("Spear")`, `hit("Spear")` | inert |

**Game witnesses** (authored by `plan-seedling-ghostsword.mjs`, recorded with `check-seedling-bot-differential --record --only=…`, p4f, headless, port 9480; the model reproduces each recording exactly, `tapeRunner`):

| Tape | What the model predicted | The game |
|---|---|---|
| `ghostsword-l3-rockghost` (L3, east of the water column, sword + ghost sword + conch, 43 t) | one press at t1 = 7 tests; the first breaks `breakablerockghost@0,64` from **18.65 px** (past the sword's 16); the walk takes the teleporter under it at t33 → L111 | 1 transition derived, to L111; `Bot.slashTests` 7; `cleared [{tag 1, level 3}]` |
| `ghostsword-l3-rock` (L3 arrival pocket, sword + ghost sword, 43 t) | the plain `breakablerock@96,112` breaks at the first test; the walk passes where it stood | stream = model; `Bot.slashTests` 7; `cleared [{tag 0, level 3}]` |
| `ghostsword-l30-bobsoldier` (the `bobsoldier-kill` boot, sword + ghost sword, 103 t) | two presses land from 22.7 and 17.9 px; hits 2 → 4 kills the `hitsMax`-3 body | game `hits` **0 → 2 → 4**; body probe (`probe-seedling-bobsoldier-mobiles.mjs`): 95 comparisons, **worst \|Δ\| 0**; `Bot.slashTests` 14 |
| `ghostsword-l3-nosword` (evidence only, not a fixture: `rockghost` minus the sword) | the model refuses it by name | **0 transitions**: the rock survives, the walk stops at x 18 |

`probe-seedling-dash-window.mjs` now counts ghostsword thrusts too (one filter line). On all three witnesses the game's `Bot.slashTests` equals the model's cumulative count at every sampled tick.

## D2: the model (PASS)

- **`ghostSword.js`** (new): the switch `GHOSTSWORD_PRESS` (ON) and its `SEEDLING_GHOSTSWORD=0|1` hook; `GHOST_SWORD_DAMAGE` 2; `GHOST_SWORD_REACH` 24; `GHOST_SLASH_ANIM_TICKS` {7, 6} derived with `combatVerbs.animCompleteTicks`; `ghostSlashRect` (`combatVerbs.slashRect`'s existing ghost arm); the per-class table `GHOST_PRESS_ARMS`; `ghostSwingRefusal` (ghost without sword).
- **`levelRun`**:
  - `weaponForPress`: a sword slot (or past-the-end slot) swings the ghost sword while the flag is up;
  - `pressHitType`/`pressHitDamage`: one spelling for all eight arms (byte-identical for sword and spear);
  - `applyThrust`'s ghost arm: the rect, reach 24 cut over the whole collection (`presses[].outOfReach`), the Spear audit, LOS waived in every arm that asked it, the two refused arms, the no-sword refusal. OFF it throws the old sentence.
- **`presses.swordWindowStep`**: a ghost thrust schedules its 6 repeats (5 on a dash).
- **The break verb** (`solverBot.resolveBreakStrategy`, through `solverView`): admits a ghostsword primary; the stance stays the sword's 16 px geometry, which the ghost rect contains (so it is a subset of the game's stances, never a superset).

**Byte-inertia, switch ON** (measured before choosing the default): tapeRunner's 557 committed rows `bda9fe12…` (identical to W0) and all six producer `--check`s unmoved. No committed run ever held the ghost sword (a `grep -a` over `fixtures/` finds `hasGhostSword: true` only in the ogmo schema and the vanilla overlay). ⇒ it ships **ON**, as fidelity BOBSOLDIER's switches did. OFF reproduces the BEFORE model.

**Mutants** (predicted, then made by copy → edit → restore; `ghostSword.js` md5 restored `f1413a59…`):

| Mutant | Predicted | Measured |
|---|---|---|
| M1 reach 24 → 16 | rockghost red; bobsoldier red; l3-rock green | exactly that (2 red / 4 green tapeRunner rows) |
| M2 damage 2 → 1 | tapeRunner blind (no player stream changes); body probe red | tapeRunner 6/6 green; mobiles probe **red, worst \|Δ\| 7.71** |
| M3 7 tests → 5 | tapeRunner green (every hit lands on test 1); slashTests probe red | green; probe red at obs 8 (game 6, model 5) |
| (D3) the bounds cut absent | legs 55/58 stall at (-8,56) | that is the BEFORE row of D3's table |

`ghostSword.test.js` (new, 13 rows): the transcription, the window ON/OFF, the L3 press ON/OFF, the no-sword refusal, and the break verb's row ON/OFF/no-sword on `breakVerb.test`'s corridor room.

## D3: the census (PASS)

⚠ **CI dispatch was refused for this session** (`403 Resource not accessible by integration`, from both the GitHub MCP and `gh`), and pushing a `seedling-survey/**` ref would be another branch. So the survey steps and the sweep legs ran **locally** (two node shards; the sweep legs on the game, p4f, port 9480). The runner's wall-clock budget is not the box's; re-run these on CI before banking the tick counts.

**A second fix the legs found.** Legs 55 and 58 passed the new weapon gate and then failed at the break STANCE: `breakStanceCandidates` derived **(-8,56)**, a cell left of the level (L3's ghost rock sits at x 0). The planner treats it as free; `Player.update` clamps the player inside the level, so the walk stalled 400 ticks against the Stone at x 8. The ring now cuts cells outside `world.width/height × TILE_SIZE` (`offLevel`).

### The survey rows this moves (`survey-seedling-route.mjs --through=end --route=full --timeout=1500 --only=…`)

| Step | Room, goal | BEFORE (CI 37661110536) | AFTER |
|---|---|---|---|
| 207 | L106 Ghostsword + exit | REFUSED (levelRun throw) | **SOLVED 185** |
| 208 | L101 → L102 | REFUSED (break: ghostsword) | REFUSED, LADDER: `enemy:darktrap@160,80` on the corridor (a static unbridged Enemy) |
| 209 | L102 → L107 | REFUSED (throw) | **SOLVED 16** |
| 212 | L109 Firewand + exit | REFUSED (throw) | **SOLVED 135** |
| 213 | L101 → L110 | REFUSED (break: ghostsword) | REFUSED, VERB-MISSING: `magicallockfire@96,48` has no strategy row |
| 214 | L110 pit | REFUSED (throw) | **SOLVED 161** |
| 215 | L2 → L3 | REFUSED (throw) | **SOLVED 22** |
| 216 | L3 → L111 | REFUSED (break: ghostsword) | **SOLVED 79** (after the bounds cut; before it: the (-8,56) stall) |
| 217 | L111 → L112 | REFUSED (throw) | **SOLVED 95** |
| 220 | L115 The Seed | REFUSED (throw) | **SOLVED 173** |

**0/10 → 8/10.** Rows in `seedling-fidelity-ghostsword-evidence/survey-after.json`. These are model solves; only the sweep legs below were played on the game.

### The sweep legs (`probe-seedling-divergence-sweep.mjs --mode=inv --ids=55,58,61,62`, on the game)

| Leg | Key | BEFORE (CI 37661037829) | AFTER |
|---|---|---|---|
| 55 | L3 ← L2 → L111 (sphere 9.4) | refused (ghostsword) | **done**, no divergence |
| 58 | L3 ← L4 → L111 | refused (ghostsword) | **done**, no divergence |
| 61 | L3 ← L111 → L111 | refused (ghostsword) | **done**, no divergence |
| 62 | L3 ← L111 → L2 (sphere 0, no items) | refused (primary slot holds NOTHING) | the same, correctly (it holds no weapon) |

## For the JS arc: pins, fields and words

**Pins red:** none of the JS arc's. CI's `JavaScript Unit Tests` (`ci-vitest-summary.mjs`):
- at `f93998e`: 19,233 passed, 3 red, all `procgenDocs/generated.test.js` (the instruments and docs indexes; regenerated at `51a8952`);
- at `51a8952`: **19,235 passed, 1 red**: `rosterCategories.test.js` › "the LIVE row carries one part per derived category" — expected 193, the standing row says 190. The three witnesses join the `mechanic` tier, and that row is written only by `standing-values --write` (forbidden to this slice, ⚖). **STOP — the planner re-banks it** (the mechanic tier's 190 → 193 tapes, after a full-tier run).

**New, optional** (nothing removed, no signature moved):
- `run.presses` rows carry `outOfReach` on a ghostsword press (absent otherwise);
- `solverView` exports `GHOSTSWORD_PRESS` and `ghostSwingRefusal` (surface 220 → 222, both classified);
- `ghostSword.js` and its `SEEDLING_GHOSTSWORD` hook.

No new `SolverRefusal.obstacle.kind`.

**What to wire:**
- CANCROSS's `solverStamp` moves (`levelRun.js`, `solverBot.js`, `presses.js`), so derived rules read STALE until re-derived.
- CANCROSS's L14 ghost-only question stays `model-refused`, for the new reason (no sword ⇒ no test).
- The JS runtime and wasm arrival pick the ghost press up through the shared run with no change.

## Deltas

**New files:**
- `frontend/modules/seedlingDemo/ghostSword.js`, `ghostSword.test.js`;
- `scripts/procgen/plan-seedling-ghostsword.mjs` (`--check`: all green; `check-procgen-help` ALL PASS);
- tapes + expectations `ghostsword-l3-rockghost`, `ghostsword-l3-rock`, `ghostsword-l30-bobsoldier`;
- `CC/docs/cloud-reports/seedling-fidelity-ghostsword-evidence/` (mobiles, slashTests ×3, the no-sword tape and recording, survey rows, sweep rows before/after).

**Changed:** `levelRun.js`, `presses.js`, `solverBot.js` (the break row, the bounds cut), `solverView.js`, `combatVerbs.js` and `presses.js` (comments), `probe-seedling-dash-window.mjs` (one filter), `r8Acceptance.js` (one declared exposure).

**Records:**
- surface GREEN **222**; constants PASS **5,414 → 5,426** (11 frame indices classified cosmetic, 1 literal auto-classified as green drift; `--profile-rows` + `--write`);
- roster **253**; tape index regenerated;
- `seedling-bot.md` (a ghost-sword paragraph), `seedling-bot-log.md` (entry + four trap candidates);
- reference: instruments + docs index regenerated (the four substrate rows left as this container computes them wrong, as at W0).

**Pins moved and re-pinned** (each named in its test):
- roster counts 250 → 253 (`tapeEnvelope`, `observationTolerance` ×2 incl. `swapped`, `dialogueAutoAdvance` ×2);
- `r8Acceptance` exposed set 73 → 74 (+ `ghostsword-l30-bobsoldier`), its sorted list and its synthetic mirror;
- `seedlingCanCross`'s L14 ghost row (switch-aware regex).

## What the brief got wrong (measured)

1. **"Only the plain SWORD breaks a rock in this model"** was the break verb's sentence, not the game's: the rock arm reads `hasGhostSword`, so the ghost sword breaks both rock types (`ghostsword-l3-rock`).
2. **The ghost press is not "the Spear arm" geometrically.** Its rect, reach and line gate are the SLASH's (`getSlashRect`, `slash()`); only `genericHit`'s `t` is "Spear". `Player.spear()`'s 32 × 5 rect plays no part.
3. **The brief's D1 list missed the caller's guard.** `slash()` runs only `if (hasSword)`. A model built from `slash()` alone says the ghost sword works by itself; the game says it does not.
4. **"The 10 steps on CI with `only=`"**: not possible from this session (403). Measured locally instead (above).
5. **"rockghost 4 legs"**: three move (55, 58, 61). Leg 62 holds no items at all (sphere 0) and is honestly refused.
6. **The 10 steps were not all the ghost press.** Two of the three break-verb refusals (208, 213) were hiding the next walls in L101 (a static `darktrap`, a `magicallockfire` with no row). One (216) hid a stance defect that only an edge rock exposes.

## Residue

1. **The hammer arc's forecast ignores a ghost thrust.** `spinnerForecastWithPress` fires only `th.weapon === 'sword'`, so a ghost-sword run fighting a spinner forecasts no landing (hammer-owned: not edited).
2. **The strike/kill and lane-silencer verbs ask `primaryWeapon === 'sword'`** (`deriveStrike`/`execKillByPress` are hammer-owned; the lane silencer at `solverBot.js` ~14572). A ghost-sword run refuses those by name. None of the ten steps needed them.
3. **The bridge `Tile` and `PushableBlockSpear` under the ghost swing** are refused by name (seven Spear tests each).
4. **The ghost sword without the sword** is refused by name, not modelled (the swing plays, `slashTimer` never counts down, so every second press inside the window would dash).
5. **The break stance uses the sword's 16 px geometry**: correct, but it never chooses a stance only the 24 px reach allows (e.g. the floor east of L3's water column).
6. **Steps 208 and 213** stop at L101's `darktrap` (a static unbridged Enemy on the corridor) and `magicallockfire` (no strategy row).
7. The eight survey solves are model solves; re-run on CI and play them on the game before banking.
8. Pre-existing, noticed: the PLAIN sword's `BreakableRock` arm applies no reach gate (a corner of the 16 × 32 rect can be 22 px away). The ghost arm applies its 24 px gate to every responder.

## Byte-inertia

- tapeRunner at the head: **563 rows, 0 non-pass**, md5 `efc461c73a3bb74189155c7d813d8849`; the 557 pre-slice rows `bda9fe12…` = W0.
- six producers at the head: all equal to W0, all exit 0.
- identity block AFTER (this tree at `51a8952`, port 9480): **every row identical to W0** (`diff` empty), the six producers included.

## Rows to BANK

- tapeRunner pairs **563 / `efc461c7…`** (old 557 `bda9fe12…`);
- roster **253**; surface **222**; constants **5,426**; R8 exposed **74**;
- `GHOSTSWORD_PRESS` **ON**;
- ⚠ the standing roster row's `mechanic` part: 190 → **193** tapes (needs `standing-values --write` after the tier run; red in CI until then);
- survey (local) 207/209/212/214/215/216/217/220 SOLVED, 208/213 REFUSED on the named walls;
- sweep legs 55/58/61 done on the game.

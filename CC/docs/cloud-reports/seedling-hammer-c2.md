# Seedling HAMMER-PHASE — slice C2: the ghost-sword press against a spinner

Slice `seedling-hammer-c2` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-11):
*"Please continue with the queue."* One switch, **OFF**, and OFF is byte-inert: `ghostSpinnerPress.GHOST_SPINNER_PRESS`
(`SEEDLING_GHOST_SPINNER_PRESS=1`, `withGhostSpinnerPress(enabled, fn)`).

| | |
|---|---|
| Start SHA | `dd6ae2e379` (= `origin/main` at the fetch; the brief's floor) |
| Head | the commit carrying this report. Code: D1 `97c4002`, D2 `04449af`, D3 `a56c723`, D1's exposure `dc05637`, the OFF controls `2f78f50`, D5 `1a1992a` |
| Branch | `claude/seedling-hammer-c2-5t2tmj` (the harness names it; the brief's `seedling-hammer-c2`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9572` (`SEEDLING_PORT=9572`), PID 624, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS: no mover but this slice's own default row · D5 PASS** (one standing row for the planner, §D5) |

## The one thing to know first

**With the switch ON, a ghost-sword run kills L18's spinners, and the game agrees tick for tick.** At base the press
kill refused any primary but the sword. Both spinner forecasts also dropped a ghost thrust's tests, so they predicted
**0** of the run's landings. ON, the forecasts equal the run byte for byte on a game witness. `r9-solve-18`'s staging
with the ghost sword solves in **336 t with no hit**: four ghost landings from 19–20 px, two per body. It solves at
**45/45** hammer residues. The game plays the solve to L19, with the player stream at 337/337 and `slashTests` 76 equal
to the model's. Nothing committed moves when the switch flips. Separately, every spinner kill shows a one-tick
corpse-removal lag, sword kills included (§D1); that is for fidelity.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-c2-5t2tmj origin/main` | `dd6ae2e379` |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0; `bulletml-dodge` was `-` → `git submodule update --init` → `7423ee86` |
| identity block | `SEEDLING_PORT=9572 bash scripts/procgen/identity-block.sh .` (venv active) | non-`#` md5 **`3a48647f548c821267c3e60cf0ddc496`**: maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY **`afdc6d1a`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; reference ALL 7 + 5 MATCH (evidence `identity-w0.txt`) |
| six `--check`s | the block's loop | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `712f0ead`, **all exit 0** |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted, `\n`-joined | **605**, `70c1a2d1baa27a2df4102e381914b303`, 0 non-pass |
| surface / constants / entities / profile | each `--check` | GREEN **265** · PASS **5,623** · PASS **535** · PASS 138 |
| roster | `fixtures/tapes/index.json` `.tapes` | **274** |
| bounded vitest BEFORE | 19 files: every test naming `spinnerFightForecast`, `spinnerForecastWithPress`, `deriveStrike`, `execKillByPress`, `slashEndTicksFor`, `GHOST_DASH_CHAIN` or `ghostSword` (`ghostMotion`, `ghostSword`, `hammerEscape`, `hammerFight`, `levelRun`, `procgenRoam`, `procgenScratchPersistence`, `seedlingCanCross`, `solverSpinnerKill`), the hammer set (`hammerApproach`, `hammerFightFallback`), `solverBot`, `solverBotLethalPit`, plus `tapeRunner`, `combatVerbs`, `presses`, `spinnerClockPairing`, `spinner`, `fidelityF1c` | **1124/1124** |

### The staging

**No route leg reaches a spinner room with the ghost sword.** `seedling-divergence-legs.mjs` lists 843 legs; the 47 in
L18/L39/L40/L92 all hold inventories without "Ghost Sword Fusion". The route clears those rooms long before the ghost
sword. So the staging uses the progress override a committed witness already uses: **`seam.items.hasGhostSword` true**
(as `ghostsword-l30-bobsoldier` does on the `bobsoldier-kill` boot). It is applied to `r9-solve-18`'s staging, the frozen
copy `fixtures/witness-bases/r9-solve-18.hammer-a.json` (hammer-a's). The sword stays held, as the ghost sword needs it.
The game state is real: the player can walk back into L18 holding both swords.

**Today's behaviour** (`twoPassSolve`, as `sweep-seedling-l18-residues` calls it; evidence `scripts/stage-ghost.mjs`):
- **REFUSED at t0, in 37 ms**: *"solverBot(r9-solve-18) reach-exit (176,112)->L19 -> kill: the kill work order has no
  weapon — the run's `primary` slot fires `ghostsword` — the kill this arm derives is a SWORD press
  (`KILL_ARM_POLICY.Spinner`). The sword is a SUB-ORDER the macro layer owes."*
- `trace.obstacle` = `{kind: 'kill-lock', id: null}`.
- The same refusal holds for `r8-solve-18`'s staging, and at every one of the 45 hammer residues (`ghost-sweep-off.txt`).
- Control: the same staging without the ghost sword SOLVES 518 t, the committed `r9-solve-18`.
- **The forecasts' predicted hits against the real run's**, on D1's walk (`d2-forecasts-off.json`):
  - The run lands twice: t27 (hits 2) and t76 (hits 4, the kill).
  - `spinnerForecastWithPress` at each of the six presses predicts **no landing**: *"no test's rect reached a body
    within 40 row(s)"*. Its bodies leave the run at t27.
  - `spinnerFightForecast` along the whole walk predicts **0 tests**, and leaves the run at t27.

## D1 — the game witness (PASS; `97c4002`, `dc05637`)

**`hammer-c2-l18-ghostspinner`** (91 t; `scripts/procgen/plan-seedling-hammer-c2-ghost.mjs`, author + `--check`; help
gate `HELP ok · IMPORT ok`). The walk heads for `spinner@48,96` and presses when the body is inside 20 px and the ghost
rect toward it overlaps it. It then presses at +2, +8, +10 and +18 with the facing key held, the motion witnesses'
stance. After the i-frame it aims and presses once more. Recorded with `check-seedling-bot-differential --record
--only=hammer-c2-l18-ghostspinner` (p4f, headless logic-only). The replay passes: 92 observations, every edge seen,
the clock equal. The model replays it in `tapeRunner`, 2/2 rows.

Measured on the game (evidence `d1-game-probes.txt`, `d1-spinner-bodies.json`):

| question | the game | the table |
|---|---|---|
| which ticks test | `Bot.slashTests` = the model's cumulative count at **92/92** sampled ticks; **27** in all: the swing's first 2 (t27, t28), then the +2 dash's 6 (it REPLACES the swing's window), +10's 6, +18's 6, and the second swing's 7 | 7 swing / 6 dash ✓ |
| reach | the first landing at **18.41 px** (the sword reaches 16) | 24 ✓ |
| damage per press | `hits` 0 → **2** (t27) → **4** (t76) | 2 ✓ |
| hits to kill | **2 presses**: the second landing kills (`hitsMax` 3) | 2, not 3 ✓ |
| release (dash) | +8 is **SWALLOWED**, +10 dashes | the ghost dash's 6 ✓ |
| release (swing) | blind: a press inside `slashTimer` dashes regardless of the swing's end (GHOSTMOTION's M4, against a spinner too) | 7 (not observable here) |
| dash chain vs a spinner | slash · dash · swallowed · dash · dash at 0 · 2 · 8 · 10 · 18; the dashes' rects reach the body at 28–29 (i-frames) and miss after | 0 · 2 · 10 · 18 ✓ |
| the bodies | position, `hits`, `hits_timer` = the model's at every sampled tick **through t87**, worst \|Δ\| 2.8e-14 (`probe-seedling-u9-shield-mobiles.mjs --class=Spinner --upto=87`) | — |

**The game does not contradict the table.** One disagreement remains outside it: **the killed body leaves the game one
tick before the model.** The game removes it at sample t88 and the model at t89, 12 samples after the kill against the
game's 11. This is not the ghost's. The committed sword kill `r9-solve-18` shows the same lag at t198 and t367
(`control-r9-solve-18-sword-bodies.json`), and so does the ON solve below (t104, t171). It is a presence fencepost in the
model's `spinnerBodies` against `Mobile.death`'s fade, and it is fidelity's to classify (§Residue). Every position,
`hits` and `hits_timer` before the removal is exact.

## D2 — the forecasts per weapon (PASS; `04449af`)

New module **`ghostSpinnerPress.js`** (the hammer region's; nothing restated): the switch; `SWORD_SPINNER_PRESS` and
`GHOST_SPINNER_PRESS_ROW`, each `{weapon, reach, rect, lineOfSight, hitTicks}`, built from `presses.js` (`slashRect`,
`SLASH_REACH`, `SLASH_HIT_TICKS`) and `ghostSword.js` (`ghostSlashRect`, `GHOST_SWORD_REACH`, `GHOST_SLASH_ANIM_TICKS`);
`spinnerStrikePress(weapon)`, `ghostSpinnerPressFor(weapon)`.

`levelRun.js`, all under the switch:
- `spinnerForecastWithPress`'s and `spinnerFightForecast`'s `fire` now pass a `ghostsword` thrust. Before, only
  `sword` thrusts tested; the brief's *"`opens` already admits ghostsword"* was true, but `fire` then dropped the tests.
- `forecastSwordTest` takes `applyThrust`'s ghost arm, in its order:
  - the rect is `ghostSlashRect` (24 × 48, scale 1) and the reach 24;
  - **no line**;
  - `hitSpinner` with `pressHitDamage` / `pressHitType` (2, "Spear");
  - ⚠ an out-of-reach body writes **no** test row. The run's ghost cut is the whole collection's, before the arms
    (`presses[].outOfReach`), so the run writes no `spinnerPressHits` row for it. This was found by the gate: the
    cursor wrote rows at t30/t31 for a body 25.5 and 27.1 px away that the run never wrote.
- The fight cursor's release is `slashEndTicksFor(state.anim, weapon)` (7 / 6), not `SLASH_ANIM_TICKS`.
- `spinnerForecastWithPress` itself needed no clock change. It ages `slashInfo`, whose `endsAt` has been the ghost's
  since GHOSTMOTION, and it holds one press.

**Gate** (`hammerGhostSpinner.test.js`, A's shape, on D1's witness; evidence `d2-forecasts-{off,on}.json`):
- **ON:** each of the six presses' forecast, from a run replayed to its press tick and given the walk's own points,
  equals the run **byte for byte** (every rect and `{id, hits, hitsTimer, destroy}`) up to the next press. Its
  `landing` is the run's: **t27, t76 (killed)**, and null for the dashes.
- **ON:** the fight cursor advanced along all 92 ticks with the walk's presses equals the run at every tick. Its tests
  equal the run's `spinnerPressHits` (`[t, id, landed, killed, hits, hitsTimer]`). Its outcomes are slash · dash ·
  swallowed · dash · dash · slash.
- **OFF:** no landing; both forecasts leave the run at t27 (the control).
- A sword press's forecast is byte-identical ON and OFF, on every press of `r9-solve-18`.

**Mutants** (predicted, then made by copy → edit → measure → restore; `levelRun.js` md5 restored `b505ffdc…`):

| mutant | predicted | measured |
|---|---|---|
| M1: the cursor releases a ghost swing on the sword's clock | the outcomes row red (+8 dashes) | the cursor row red |
| M2: the ghost test at the sword's damage | both ON rows red at t27 | 2 rows red |
| M3: the line asked for a ghost swing | blind: L18's line is clear | 7/7 green (**blind**) |
| M4: reach 24 → 16 | the t27 landing (18.41 px) lost | 2 rows red |

## D3 — the strike and the kill by press (PASS; `a56c723`)

`solverBot.js`, under the same switch. `strikePressOf(run)` → `spinnerStrikePress(run.progress('primaryWeapon'))`. OFF
it returns the sword's row and reads nothing.
- `derivePressKill` (where the gate actually is) admits a `ghostsword` primary. A ghost sword without the sword is
  refused with `ghostSwingRefusal`'s words. The no-strike refusal names the ghost's train and reach, and stays
  byte-identical for the sword.
- `deriveStrike` and `strikeLineBlocked` use the row's rect, reach and seven-test train; the line is skipped for the
  ghost.
- `pressReadyAt`, `trainIsSafeHere` and `trainLineBlockedHere` take the row as an argument from their four callers.
  Each caller holds the run; a previewed view has no progress, and the solver-surface census refuses a view field that
  stands in for it.
- `pressEscape`'s train end is the row's.
- **`GHOST_DASH_CHAIN`: no chain is assumed on this path.** The kill's presses are i-frame paced (31+ ticks, past the
  20-tick `slashTimer`). A press inside the window is a dash, which `slashPressForecast` and the escape's
  `dashImpulse` already model.
- `deriveApproach` / `deriveFight` (both OFF) receive the row through `pressReadyAt`. Their own reach and train
  arithmetic stays the sword's, so the region was not widened (§Residue).

| staging | OFF | ON |
|---|---|---|
| `r9-solve-18` frozen + `hasGhostSword` (residue 40) | REFUSED t0 (above) | **SOLVED 336 t, 0 hits, → L19**; landings t37 (hits 2) · t92 (4, kill) · t113 (2) · t159 (4, kill), all ghost presses from 19.19–20.44 px; kill lock `{18,0}` model-sourced at 271 |
| the same, all 45 hammer residues (`ghost-sweep-{off,on}.txt`) | 0/45 | **45/45**, 0 hits, 336 t at 43 residues, 390 (r5), 340 (r6) |
| `r8-solve-18`'s staging + `hasGhostSword` | REFUSED t0 | SOLVED 336 t, 0 hits |
| + `hasSword: false` | REFUSED (weapon) | REFUSED by name: *"…holds the GHOST SWORD and not the sword…"* |
| the sword's own staging | SOLVED 518 t | **byte-identical** (keys equal) |

**The ON solve, on the game** (evidence `d4-ghostsolve.tape.json`, `d4-ghostsolve-game.txt`,
`d4-ghostsolve-bodies.json`):
- `probe-seedling-dash-window.mjs --tape-file=…`: the drained stream is the model's at **337/337** observations;
  transitions `[{t 336, 18 → 19}]`; game hits 0; `Bot.slashTests` **76** = the model's at every tick; `{18,0}`
  cleared.
- The bodies probe: the player clock fits at shift [0] over 336 ticks. Every position, `hits` and `hits_timer` is
  exact, worst \|Δ\| 1.4e-14, apart from the known removal lag (t104, t171).

**Mutants:**
- D3-M1, the sword's geometry under the switch (the admission alone): the ON staging is REFUSED.
- D3-M2, the ghost train at 5 tests: the same REFUSED.
- Both throw because the escape previews a 5-tick train while the ghost forecast asks for the player's point at test
  7: *"levelRun.spinnerForecastWithPress: no player position for the hit test at tick 48"*. The train length is
  load-bearing.
- `solverBot.js` was restored by md5, and `ghostSpinnerPress.js` from its backup copy (`git status` clean on it).

## D4 — measured ON, STOP at the movers

Command: every row as at W0, with `SEEDLING_GHOST_SPINNER_PRESS=1` exported to the process (and so to the identity
block's children).

| row | OFF | ON | moves? |
|---|---|---|---|
| W0's staging | REFUSED t0 | SOLVED 336 t, 0 hits | **yes**: the slice's purpose (no committed artifact) |
| the L18 sweep (`sweep-seedling-l18-residues.mjs`, 45 residues, the sword) | 45/45, lengths line md5 `1c019765ddfd7f8d950c7f2a3a61b5f3` | the same; every row equal (verdict, length, digest, escapes, fellBack) | no |
| identity block | W0 `3a48647f…` | every row = W0: ENEMY `afdc6d1a`, r9-campaign `712f0ead`, the six producers exit 0 at W0's md5s (`identity-on.txt`) | no (the reference row read DIFFER only because this branch's docs were unregenerated mid-slice; regenerated in D5) |
| r9-campaign `--check` | `712f0ead` exit 0 | `712f0ead` exit 0 | no |
| ENEMY census | `afdc6d1a` | `afdc6d1a` | no |
| bounded vitest (W0's 19 + `hammerGhostSpinner`) | 1137/1137 (inside AFTER's 32 files) | W0's 19 files all green ON, in one run whose only 4 reds were `hammerGhostSpinner`'s OFF rows. Those rows now pin OFF (`2f78f50`); re-run ON, the file is 10/11. The one red is *"is OFF by default"*, this slice's own switch row | this slice's own row only |
| tapeRunner pairs | 607, `dbe15e60b09f0a2376310a8191b899f2` | 607, `dbe15e60…` | no |
| committed tapes holding the ghost sword in a spinner room | `hammer-c2-l18-ghostspinner` only (a replay does not read the switch) | the same | no |

**No mover to re-record.** The flip is the user's call. It would move only `hammerGhostSpinner.test.js`'s default row,
and nothing committed.

## D5 — records (PASS; `1a1992a`)

- `seedling-bot-log.md` § *Seedling hammer-phase C2 — the ghost-sword press against a spinner*.
- `seedling-bot.md`: a paragraph after C1's.
- Surface: `--write`, 3 rows classified (`GHOST_SPINNER_PRESS`, `SWORD_SPINNER_PRESS`, `spinnerStrikePress`), then
  `--check` GREEN **268**.
- Constants: `--write` at D2 (682 literals moved by line only), then `--check` PASS **5,623**. Entities 535 and
  profile 138 PASS.
- The reference regenerated with `generate-procgen-reference.mjs`, then `--check`: ALL 7 + 5 MATCH.
- Roster **274 → 275**, tape index regenerated. Pins re-pinned by name:
  - `tapeEnvelope`;
  - `observationTolerance` ×2 (names, and `swapped` 275 measured);
  - `dialogueAutoAdvance` ×2 (275, 274 unparted);
  - `r8Acceptance`'s `R8_D2_SHIELD.pressExposure` (the walk's press reaches a live spinner; declared by name).
- **Bounded vitest AFTER** (switch OFF): W0's 19 files, `hammerGhostSpinner`, `boxLock`, `seedlingConstantsCensus`,
  `procgenDocs/generated`, `entityBlocks`, `rosterCategories`, `tapeEnvelope`, `observationTolerance`,
  `dialogueAutoAdvance`, `tapeIndexManifest`, `fixtures/tiers`, `r8Acceptance`, `seedlingSolverSurface`. That is 32
  files, **1862/1863**.
- A wider harvest: every test that walks the roster, found by `rg -a`, 57 files: **2881/2882**.
- **Both runs have the same single red, and it is the planner's:** `rosterCategories.test.js` › *"the LIVE row carries
  one part per derived category"* expects 214 and measures 215. The witness joins the `mechanic` tier, and that
  standing row is written only by `standing-values --write` (⚖ forbidden here). GHOSTSWORD and GHOSTMOTION left the
  same row for the same reason.
- Identity block AFTER (OFF, at `1a1992a`): **byte-identical to W0**, every row, the six producers and the reference (ALL 7 + 5 MATCH) included; non-`#` md5 `3a48647f548c821267c3e60cf0ddc496` (`identity-after-off.txt`).
- CI JavaScript Unit Tests at the head: run `38158161139` @ `1a1992a` (`ci-vitest-summary.mjs`): **19,717 passed, 1 failed**, and the failure is `rosterCategories.test.js` › *"the LIVE row carries one part per derived category"* (expected 214, measured 215), the standing row above (the job log, read through the GitHub MCP). The slow battery printed no summary (cancelled step).

## Deltas (base → head)

- **New:**
  - `frontend/modules/seedlingDemo/ghostSpinnerPress.js` and `hammerGhostSpinner.test.js` (11 rows);
  - `scripts/procgen/plan-seedling-hammer-c2-ghost.mjs`;
  - the tape and expectation `hammer-c2-l18-ghostspinner`;
  - `CC/docs/cloud-reports/seedling-hammer-c2-evidence/` (the game probes, the ON solve tape and its game run, the
    sweeps, the identity logs, and the scratch scripts that produced them).
- **Changed:**
  - `levelRun.js` (the two forecasts and `forecastSwordTest`, under the switch);
  - `solverBot.js` (the press kill, under the switch);
  - `solverView.js` (one door line);
  - `r8Acceptance.js` (one declared exposure);
  - the four pin files;
  - `index.json`;
  - the surface table, the constants census, and the docs.
- **Untouched:** every identity row, producer and committed tape; `ghostSword.js`, `combatVerbs.js`, `presses.js`; no
  AS3, wasm, gitlink or rules change.

## What the brief got wrong (measured)

1. **"`deriveStrike` and `execKillByPress` gate on `primaryWeapon === 'sword'`"**: neither does. The gate is
   `derivePressKill`'s, and `execKill` surfaces it as *"the kill work order has no weapon"*. `deriveStrike` and
   `execKillByPress`' ready test carry the sword's geometry (reach 16, 16 × 32, the line, five tests), not a weapon
   check.
2. **"The forecasts release a ghost swing on the sword's clock"** is the smaller half, and true only of
   `spinnerFightForecast`. The bigger gap: both forecasts dropped a ghost thrust's tests entirely (`fire` returned on
   `th.weapon !== 'sword'`). So they predicted no landing at all, not a mistimed one. `spinnerForecastWithPress`'s
   release was already right: it ages `slashInfo`.
3. **"`GHOST_DASH_CHAIN` wherever a chain is assumed"**: no chain is assumed on the default kill path. The presses are
   i-frame paced, and any in-window press is a dash that the forecast already prices. The only chain-shaped
   assumption is `deriveFight`'s `since ≤ 19` bucket, behind `HAMMER_FIGHT` (OFF).
4. **"A spinner room the player can reach holding BOTH swords: L18, L39, L40, L92"**: the AP route never does. Every
   one of the 47 legs in those rooms predates the ghost sword. The staging needs the progress override (§W0).
5. **"Hit tests 7 (swing)"**: true, but a re-press inside the window replaces the swing's remaining tests (the
   witness's swing tests twice before the +2 dash). That is the run's existing behaviour and the game's, not a
   contradiction.
6. **The table holds otherwise**, measured on the game: reach 24, damage 2, 2 presses to kill, the dash release 6, the
   chain 0 · 2 · 10 · 18. The swing release of 7 is unobservable here (GHOSTMOTION's M4).

## Residue

1. **The spinner removal fencepost (fidelity's).** On the game a killed spinner is gone 11 samples after the killing
   test's tick; in the model it is gone after 12. Every spinner kill measured shows it: D1 t88/t89, `r9-solve-18`
   t198/t367, the ON solve t104/t171. Kill locks are unaffected: the declared, model-sourced `{18,0}` at 271 opened
   on the game. It is a presence/fade fencepost in `spinnerBodies`, not damage.
2. **M3 is blind**: no witness sees the waived line. A ghost press through a wall at a spinner needs a walled stance
   (L39's shafts are candidates).
3. **`deriveApproach` / `deriveFight`** (OFF switches) still score reach, train and dash buckets with the sword's
   numbers; under `GHOST_SPINNER_PRESS` + either switch, only their `pressReadyAt` asks the ghost's. Not widened.
4. **L39 / L40 / L92 with the ghost sword are not measured.** Only L18 is. L40's press-kill cost (C1 §D4.3) applies.
5. **CI dispatch**: not attempted for the page sweeps. No sweep leg holds the ghost sword in a spinner room, so no
   page row can move. The `JavaScript Unit Tests` run on push is quoted in §D5.
6. ⛔ **For the planner**: the standing `rosterCategories` row, `mechanic` 214 → 215 (`standing-values --write`).
7. Tree dirt: the identity block wrote untracked `scripts/procgen/.atlas-sphere-*`, `.rl-*` and five
   `worlds/*_worldgen/` directories (the same set at each run). They were removed by name at the end; nothing tracked
   was left dirty.

## Rows to BANK (if the user flips the switch)

- `GHOST_SPINNER_PRESS` ON moves no committed artifact: re-pin `hammerGhostSpinner.test.js`'s default row only.
- Roster **275**; tapeRunner pairs **607** `dbe15e60…`; surface **268**; constants **5,623**; R8 exposed + 1.
- ⚠ The standing `rosterCategories` `mechanic` part: **215**.

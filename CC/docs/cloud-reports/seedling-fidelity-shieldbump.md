# Seedling fidelity SHIELDBUMP — the spinner forecasts step the plain shield bump

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-fidelity-shieldbump` (planner `seedling-fidelity-planning-17`, wave 36), cloud |
| Start SHA | `b646d32d95b4ebd636a70f05886957deffbf724a` (= the main the brief names; 105 ON of 116) |
| Head | D1 `2e4eb6aa`; censuses `626fecf2`; records `8c4feb24`; evidence `3af74537`; this report is the last commit |
| Harness branch | `claude/seedling-fidelity-wave-36-3zxrzc` (local name `seedling-fidelity-shieldbump`, pushed to it) |
| Key | `CONTACT_FIDELITY.forecastShieldBump`, **OFF**, `SEEDLING_FORECAST_SHIELD_BUMP=0|1`, appended at the END of the defaults (117 keys, 105 ON) |
| Licence | ⚖ hammer-2, 2026-10-31. Edited: `spinnerForecastWithPress`, `spinnerFightForecast`, and three helpers beside `forecastSwordTest` (`forecastShieldBumpStep`, `forecastPlayerState`, `forecastStepsShieldBump`). Not touched: `pressEscape`/`pressEscapeOnce`, `pressKillGuards.js`, `HAMMER_ESCAPE`, `deriveStrike`, `execKillByPress*`, any caller |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-shieldbump-evidence/` (scratch tools in `tools/`) |
| `solverEnvChannel.js` | absent at the base, so no `SOLVER_ENV_NAMES` line was owed |

## 2. The answer first

**hammer-2's question:** *"with your key ON, does pressEscape now claim under a carried shield (the forecast no longer
names shieldBumpNow), making SPIN's switch inert (shieldOnlyUnmodelled false), and does 860 still pass spinner@816,848
hitless?"*

**No, `pressEscape` does not claim. SPIN's switch is not inert: `shieldOnlyUnmodelled` stays `true`. Yes, 860 still
passes `spinner@816,848` hitless with SPIN ON, as it did without the key.** Measured, § 6.

**The one thing to know first:** the forecast can be exact only on a path it is TOLD. With the key ON both forecasts step
the plain bump exactly as the run does (game-witnessed, 0 px), on every row they are given the player's state. But the
escape's search walks paths that no forecast is ever told. `pressEscape` first asks a zero-row probe; that probe steps no
row, so it still names the shield, in the same words. So the honest end of SPIN's stand-in lies in the escape kernel
(hammer's), not in the forecast: the search must step the bump on its own paths, or forbid it there, as `deriveFight`
already does (its `bumps` prune). Hand-over in § 9.

| D | verdict |
|---|---|
| W0 | done: the bump's anatomy, why the existing inputs cannot carry it, and the 860 / stand measurements |
| D1 | **PASS**: the key (OFF byte-identical), game witness 0 px, 3 mutants |
| D2 | **PASS**: the 2×2 measured on the four stands, 860, and the three identity rows |
| D3 | **NOT READY to flip, by design** (§ 7): ON alone moves nothing on any default workload measured. Under SPIN it moves one hammer pin and c4. Reds listed, none re-pinned |

## 3. W0

| row | result |
|---|---|
| base | the harness branch was already at `b646d32d95` (`git fetch origin main` + `git log -1`); `session_bootstrap.sh --seedling` → READY, node v22.23.4; server `serve-nocache.py 9766` |
| identity block at the base (`evidence/identity-base.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0; reference ALL MATCH. **Every row = W35's published block.** The "generated set" row lost the box lock to my own witness run (TURRETSNAP hit the same); re-run alone: `OK` (`evidence/identity-base-genset.txt`) |
| censuses at the base (a pristine worktree) | solver surface GREEN 365 rows; constants PASS 7038 literals, 0 drift |
| leg list (`seedling-divergence-legs.mjs` at the base) | 919 legs; **860 / 861 are still the BK2 legs** (`level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2`, `<- in_L43_176_464`); all 52 of SPIN's L40 keys exist (`evidence/sweep-keys-l40*.txt`) |

**The game's bump** (`vendor/seedling/src/Player.as`). `:527-531`: the update calls `getState(); addShield();
shieldBump();` near its top. Every enemy is earlier in the update list, so the bodies have already moved this frame.
`:1691-1708`: `if (shieldObj && v.length > 0)`, every `Enemy` the shield box collides with gets `o.knockback(shieldForce,
new Point(x, y))` (`:242`: `shieldForce = 5`). With the dark shield and `o.hitsTimer <= 0` it gets `o.hit(…, "Shield")`
instead. The box is placed in `render` (`:1186-1255`), so the bump reads where the PREVIOUS frame left it.
`Enemies/Enemy.as:247-255`: `knockback` adds `f·(cos a, sin a)`, `a = atan2(y − p.y, x − p.x)`, unless `destroy` or
"die". `Enemies/Spinner.as` overrides no `knockback`.

**The run's bump** (`levelRun.shieldBumpNow`, ~`:16797`, and `bobBossFight.js:351-396`). The gate is the LIVE `state`'s
`v` (a contact earlier in the same tick can write it). The box is `playerShieldRect` at `shieldRenderState` (the
top-of-tick snapshot: `x`, `y`, `vx`, `vy`, `direction`) with `slashState.slashing`, taken above `slashTimerTick` and the
press. The shove is `enemyKnockbackV(s, v, SHIELD_FORCE, p)`, and a `destroy` body is not shoved. In `advance` it sits
after `stepSpinners` and the spinner contacts, and before `swordWindowStep`'s tests.

**The forecasts as built.** Both step `stepSpinners` per row, then the window's due tests (`forecastSwordTest`), then
(the cursor only) the press. Both named `shield bump (`shieldBumpNow`)` whenever `inventory.hasShield`. The player
reaches them only as `positions(t)` / `advance(point)`, and only at a tick with a test due.

**⛔ Why the bump cannot be stepped from those inputs alone (read in the callers, then measured):**
- `deriveApproach` (`solverBot.js` ~15487) passes a `positions` callback that RECORDS the latest tick asked
  (`windowEnd`) and sizes its stood prefix by it. A forecast that asked it on every row would stand the whole search.
- The fight cursor's quiet rows are shared by every path through them (`ensure` advances with no point).
  `dashSpinnerForecast`'s walk cursor (`previewWalk`) passes bare `{x, y}` points.
- `pressEscape`'s search explores states after `first` is taken. `first.rows` past the train serve every searched path.

**On SPIN's 860 witness** (A5, `L40C_BUDGET_WORK=10240`, `SPIN_SEAM=5950`, SPIN ON; a scratch hook in a scratch worktree,
`evidence/w0-860-k0-s1.txt`): 37 escape `first` forecasts, all with the shield. **6 of them put the shield's box on a
body on their own supplied path**: 27 state ticks, each tested against the bump-blind row of its tick, either
`slashing`. The completed kills' own driven paths never shove a live spinner. The only spinner rows in their
`shieldBumps` are `spinner@880,848` at t912–914, `shoved: false` (dying).

**At SPIN's four stands** (`evidence/w0-stands.txt`: the escape's own path driven on a fresh run). Only `approach`
(820,854) shoves the body, at t0. That shove is opened by a same-tick spinner CONTACT: the player stood still at the top
of t0, and the contact's knockback is the live `v`. Its forecast leaves the run 8.90 px from row 1. `exhausted`
(829,860), walked 12 ticks into the body after the train, shoves at t11, and the bump-blind forecast leaves the run at
row 12 (7.49 px).

## 4. D1 — the key (OFF byte-identical)

**Change** (`levelRun.js`, `contactFidelity.js`; commit `2e4eb6aa`). ON, with the plain shield (`forecastStepsShieldBump`:
key ON, `hasShield`, not `hasDarkShield`), and a room with bodies:
- `forecastShieldBumpStep(st, q, slashing, t, bumps)` is `shieldBumpNow`'s spinner arm on the forecast's copy:
  `shieldBumpTouches(q, slashing, spinnerRect(s), q)`, a `destroy` body not shoved, else `enemyKnockbackV(s, v,
  SHIELD_FORCE, q)`. It runs after the row's `stepSpinners` and above its tests, as in `advance`.
- **`spinnerForecastWithPress`** takes a new optional `players` source (`(t) => state` or an array), asked once per row
  for the bump only. Without it, the bump reads the `positions` the tests ask, but only at a tick no later than the last
  test the window will ask (`lastAsk`, a dry pass of the same window), and never after a blocked line. The maximum
  asked tick is therefore OFF's, so `deriveApproach`'s `windowEnd` cannot move. `slashing` is the run's at the top of the
  tick: the live swing aged (`slashEndsAt` releases below the press), and after `pressAt` the press's own swing (the
  cursor's end clock).
- **`spinnerFightForecast`**: `advance(point)` steps the bump when `point` is a player STATE (`x`, `y`, `vx`, `vy`,
  `direction`). A bare point or `ensure` steps nothing. `slashing` is the cursor's slash state aged to the top of the
  tick. Forks carry the per-row coverage.
- **What is reported.** The bump is modelled (and not named) only when the forecast HAS rows and every one was stepped
  with a state. A zero-row probe, a row with no state and the dark shield name it in the same words. ON adds
  `shieldBump: {bumps, stepped, uncoveredFrom}` (the press forecast) and `shieldBumps` (the cursor); OFF has neither
  field.
- Not carried, named in the code and the docs: a bump whose gate a same-tick contact opens (the forecasts carry no
  contact), and the frozen world (blocks, activators at the forecast's start) both forecasts already have.
- Run state: none added (no new map, no digest member). The forecast reads `inventory` and `slashInfoNow()`, which the
  escape already reads through the existing forecast, so the digest already covers them. ⚠ Like WATERFALL, the key is
  FIXED PER PROCESS: XC's escape cache keys on the digest, not on contact switches, so never flip it mid-solve.

**The game witness** (`fixtures/shieldbump-witness/l40button-l42-part0-bumps.json`; `tools/l42-witness.mjs`). The
committed L40 tape `l40button-l42-part0` was played on the default build (`seedling_bot_ap_p4g`, headless, port 9766),
sampling `botMobiles()`'s Spinner and Player rows at t1304–1347 (44 samples, SMALLGAPS' last-poll join). A scan of all
293 roster tapes (`tools/scan-tapes.mjs`) found it is the ONLY tape where the run shoves a spinner with the plain shield.
`r1-dark-shield-spinner` is the dark arm. The run shoves `spinner@192,160` three times (ledger t1319, t1333, t1334).

| T (body after tick T) | game | run | press forecast @1310 OFF / ON | cursor @1310 OFF / ON |
|---|---|---|---|---|
| 1310–1318 | = run | (200.39,162.96) … | 0 / 0 | 0 / 0 |
| 1319 (after the t1318 shove) | (211.859,151.826) | = game | **4.12** / **0** | **4.12** / **0** |
| 1320–1332 | = run | | 7.86 → 32.63 / **0** | 7.86 → 32.63 / **0** |
| 1333 | = run | | 37.15 / 2.57 (the frozen world: a collision the run's moved world no longer has; both arms) | |

- The run equals the game at every sample, t1306–1346 (0 px; the shoves' velocities equal the ledger's).
- Taken at t1331, ON equals the game through the t1332 and t1333 shoves (to t1339); OFF leaves at t1333 (29.48 px).
- Taken at t1326, both arms meet the frozen-world collision at t1333. That bound is the forecasts', not the bump's
  (`spinnerCtx`'s blocks and activators are taken once).

**On 860's staging** (`fidelityShieldBump.test.js`): `exhausted` walked into the body, every state told: ON = the run at
all 20 rows (the t11 shove stepped); OFF leaves at row 12. Told only the tests' points (`pressEscape`'s shape): 7 rows
stepped, uncovered from row 7, the bump named. `approach`'s contact-opened shove: not stepped (both arms leave at row 1).

**Rows** (`fidelityShieldBump.test.js`, 11 rows, ~5 s): ships OFF; the run = the game (3 shoves, 0 px at ≥ 38 samples);
@1310 ON = game through the t1318 shove, OFF leaves at t1319, ON names nothing, OFF has no new field; @1331 ON = game,
OFF leaves at t1333; the frozen-world bound pinned at t1333; the 860-stand rows above; zero-row probe and fresh cursor
name the shield; the dark shield is named and nothing stepped; `pressEscape` at the four stands, key ON alone =
OFF = no claim.

**Mutants** (predicted first, copy + restore, md5 `2fba72e3` restored):

| mutant | predicted | red |
|---|---|---|
| M1 the bump step dropped in `spinnerForecastWithPress` | t1310, t1331, the walked stand | **those 3** |
| M2 the cursor's bump moved above `stepSpinners` | t1310, t1331 (the cursor arms) | **those 2 + the frozen-world row** (the reordered step moves that collision too; not predicted) |
| M3 coverage ignored (`bumpModelled = stepsBump && need > 0`) | "told only the tests' points" | **that 1** |

## 5. D2 — the 2×2 (hammer-2's (c))

**SPIN's four stands** (`evidence/d2-stands.jsonl`; `pressEscape` for a press at the body, the aim key held one tick):

| stand | key OFF · SPIN OFF | key OFF · SPIN ON | key ON · SPIN OFF | key ON · SPIN ON |
|---|---|---|---|---|
| (808,854) certified | no claim | **certified**, 75 keys | no claim | **certified**, 75 keys |
| (814,854) envelope | no claim | no claim (envelope) | no claim | no claim (envelope) |
| (829,860) exhausted | no claim | **claimed** (exhausted) | no claim | **no claim (envelope)** ← moves |
| (820,854) approach | no claim | no claim (approach) | no claim | no claim (approach) |
| `shieldOnlyUnmodelled(probe)` | true | true | true | true |

**Why the exhausted stand moves (measured, `evidence/d2-exhausted.txt`).** The escape's preview walks left at t0 and
presses at t1. ON, the forecast told that path steps a shove at t1 (`v` (−1.58, −5.15)) and moves the body. The search
then finds a way out, whose path the envelope refuses: no claim. OFF, it exhausts: a claimed negative. Neither answer is
the run's. On the run, the spinner HITS the player on the aim tick (t0 → knocked to (830.85,862.03)) and nothing is
shoved, because the preview has no contact. So the cell moves on a path the run never takes. The approach check
(`clearOfHammersAt` against the forecast row) does not see that contact either; that is hammer's predicate, named in § 9.

**Leg 860** (A5, `L40C_BUDGET_WORK=10240`, `SPIN_SEAM=5950`, SPIN's `tools/witness.mjs` against my head;
`evidence/d2-860-*.txt`):

| | SPIN OFF | SPIN ON |
|---|---|---|
| key OFF | REFUSED work 3068, the corner after `kill (spinner@816,848) by press`; no kill | REFUSED work 10241 (the deadline); **`spinner@816,848` killed, landings 2626 / 2761 / 2817, replayed on a fresh run: gone at t2830, 0 hits, 0 deaths**; counts asked 37, certified 17, envelope 8, exhausted 3, noClaim 9 |
| key ON | = key OFF (the same refusal text, work 3068) | **the same kill, hitless** (landings 2626 / 2761 / 2817, gone t2830, 0 hits, 0 deaths); counts asked 37, certified 17, **envelope 6, noClaim 11**, exhausted 3 |

So under SPIN the key moves two of the 37 answers from "envelope" to another no-claim (both are no claims), and nothing
the kill depends on. The refusal at 10241 is the deadline (an earlier pass's answer), the same text in both arms.

**The three identity rows SPIN moved** (`evidence/idrows-*.txt`; the rows' own commands from `identity-block.sh`):

| row | key OFF · SPIN OFF (base) | key OFF · SPIN ON | key ON · SPIN OFF | key ON · SPIN ON |
|---|---|---|---|---|
| empty pairs c3 | `31dc4572` | `2d527877` (= SPIN's published ON) | `31dc4572` | `2d527877` |
| empty pairs c6 | `40d0a4c4` | `b6d7de6a` (= SPIN's) | `40d0a4c4` | `b6d7de6a` |
| carved pairs c4 | `c9bdd11e` | `62bc5f69` (= SPIN's) | `c9bdd11e` | **`23ce5b2a`** |

The key alone moves no identity row. Under SPIN it moves c4: a generated certify solve's escape forecast steps a bump on
its approach or train. Not attributed to a level here; it would be the c4 re-record's question if both flip.

## 6. Answer to hammer-2, in one table

| question | measured |
|---|---|
| does `pressEscape` claim under a carried shield with the key ON? | **no**: key ON · SPIN OFF = OFF at all four stands, on 860 and on c3/c6/c4 |
| is SPIN's switch inert (`shieldOnlyUnmodelled` false)? | **no**: true at every stand, every arm (the zero-row probe names the shield) |
| does 860 pass `spinner@816,848` hitless? | **with SPIN ON, yes, in both key arms** (0 hits, 0 deaths, same landings); with SPIN OFF, no, in both |
| what the key does move under SPIN | the exhausted stand (claimed → no claim), c4, two of 860's 37 escape answers (envelope → no-claim) |

## 7. D3 — flip readiness (key ON)

| gate | OFF | ON |
|---|---|---|
| bounded fast set by path (114 files: the header list, every `hammer*` fast file, every test that `grep -a`s `spinnerFightForecast` / `spinnerForecastWithPress` / `shieldBump` / `SHIELD_FORCE`, + `levelRunDigestRead`, the surface/constants tests; `evidence/bounded-files.txt`) | **114/114 files, 2498/2498** (`evidence/bounded-fast-off.txt`) | **112/114, 2496/2498**: the 2 reds below (`evidence/bounded-fast-on.txt`) |
| the 8 slow files (`hammerDashShape`, `hammerEscapeGenerated`, `hammerIceTurretStatic`, `hammerLatchWeigh`, `hammerSpinnerPress`, `hammerTurretApproach`, `fidelityL32ArenaPrefix`, `fidelityL40Bk2`; `vitest.slow.config.js`) | **8/8 files, 17/17** (`evidence/bounded-slow-off.txt`) | **8/8 files, 17/17** (`evidence/bounded-slow-on.txt`) |
| identity block (13 rows + generated set + the six @ci-box `--check`s + reference) | = W35 (the base) | **every row = OFF** (`evidence/identity-head-on.txt`); the reference row DIFFERed only on the docs index (my uncommitted doc), regenerated after: ALL PASS |
| `ci-producer-checks --jobs=3` | **97 run, 0 red, 1 skipped** | **97 run, 0 red, 1 skipped** (`evidence/producers-on.txt`) |
| route survey, every step in a spinner level (L18 / L39 / L40: steps 27, 66, 67, 94, 95, 97, 135, 136, 148, 149) | 8 SOLVED / 2 REFUSED | **0 of 10 rows moved** (all fields but `ms`; `evidence/survey-spinner-steps-off-vs-on.txt`) |

**The reds ON (listed, not re-pinned):**
1. `contactFidelity.test.js` › "the shipped defaults: all three ON" (the env flips the defaults row). Mine. A flip owes
   that row the new default, and inverts `fidelityShieldBump.test.js`'s "ships OFF" row.
2. **hammer pin** `hammerSpinnerPress.test.js` › "ON at (829,860): the escape search EXHAUSTS, and that negative is
   claimed (the aim then waits)". Under the key the stand answers "no claim (envelope)" (§ 5). **For hammer-2 to sign.**

**Why ON alone moves nothing on a default solve (code read, then measured above).** At the defaults the key can reach only
two callers. `pressEscapeOnce` returns at its zero-row probe, which still names the shield, so no stepped forecast is
ever read there. `previewWalk`'s `dashSpinnerForecast` cursor passes bare `{x, y}` points, so nothing is stepped.
`landsClearInFlight`, `deriveApproach` and `deriveFight` sit behind `HAMMER_FIGHT` / `HAMMER_APPROACH`, OFF.

**Flip verdict:** the flip is safe on everything measured (0 movers at the defaults) but buys nothing at the defaults
either. Its value is (a) the exact rows under SPIN, and (b) the seam the escape needs (§ 9). I would flip it together
with SPIN or with the escape hand-over, not alone.

## 8. Movers, and the dispatches the planner should run

Predicted with the key alone: **0 movers** on the survey, the sweep and the probes (the default callers never read a
stepped row). I cannot dispatch; branch `claude/seedling-fidelity-wave-36-3zxrzc`:
1. **Survey A/B:** `seedling-survey.yml`, `through=end route=full`, once at the branch head (OFF, the control) and once on
   a scratch commit flipping `forecastShieldBump: true` (the survey has no switch input). Expect 203/37 both, 0 rows moved.
2. **Full divergence sweep ×2 per arm:** `seedling-divergence-sweep.yml`, `contact_fidelity=<evidence/sweep-arm-on.txt>`
   (the 105 default-ON keys + `forecastShieldBump`) and `contact_fidelity=<evidence/sweep-arm-off.txt>` (the 105 alone),
   each twice. Expect only run noise (crossed ↔ done swaps).
3. **L40 keyed legs incl. 860:** the same workflow, `keys=<evidence/sweep-keys-l40.txt>` (SPIN's 52 L40 keys, all
   present at the base; 860 / 861 included), `capture_requests=true`, both arms. With SPIN OFF in the browser (the page
   worker has no `process`), expect equal ends. The ON-under-SPIN effect needs SPIN's own page flag.
4. **Probes:** `seedling-probe.yml battery=standard` on the scratch-flip commit (the browser reads the defaults). Grade
   `probe-seedling-wasm-logical-links` B,R "start-hop arrival is HELD" as KNOWN RED (js's); read
   `probe-seedling-encounter-ticks`' INFO line.

## 9. For the other arcs

- **To hammer-2 (the escape kernel; no change made in your region).** The forecast now steps the bump exactly where it is
  told the player (`players`, or `advance(state)`). For `pressEscape` to claim under the shield honestly:
  (i) the probe must stop being a zero-row question (it can never be "modelled"). Read `first.unmodelled` instead, which
  is `[]` only when every row was stepped;
  (ii) the search's own paths must carry the bump. Either fork a cursor per node and `advance(q)` it (as `deriveFight`
  does), or forbid bump states in the search, as `deriveFight`'s `bumps` prune does. The latter is SPIN's envelope made
  exact per state.
  Until then, SPIN's stand-in stays the only claim under the shield.
  Also measured: at the `exhausted` stand the escape's approach check misses the spinner CONTACT on the aim tick
  (preview t0 walks left; the run is hit and knocked away). The forecast cannot carry a contact; the approach predicate
  is yours.
- **Hammer pins that move (LISTED, not re-pinned):** `hammerSpinnerPress.test.js` "ON at (829,860) … EXHAUSTS … claimed"
  (with the key ON, under SPIN ON). `hammerPressKillGuards`, `hammerOpportunisticStrike` and `hammerRefugeBandText` did
  NOT move (in the ON bounded set). Identity c4 under SPIN ON + the key: `62bc5f69` → `23ce5b2a`.
- **JS arc:** nothing to wire. No `run.*` field renamed or reshaped; the forecasts gain an optional `players` argument
  and an ON-only `shieldBump` / `shieldBumps` field. No staging or result field, no new `SolverRefusal.obstacle.kind`.
  `jsRuntimeTape`'s `NO_TAPE_CHAIN`: a new key may move it; it was not in my set. The planner re-measures with js.
- **Skin:** no run state touched.

## 10. Deltas, and what the brief got wrong (measured)

- *"stop naming `shieldBumpNow` unmodelled when the bump is the only reason"*: on a forecast whose every row was told the
  player, yes. On `pressEscape`'s probe, never, and correctly: it asks about no rows. The brief's premise (the forecast is
  the only seam) holds for EXACTNESS, not for the claim.
- *"a knockback by `SHIELD_FORCE` when `shieldBumpTouches`, exactly as the run steps it"*: exactly, but only where the
  player's state is known. The forecasts' contract gave them points at test ticks only, and one caller
  (`deriveApproach`) depends on which ticks are asked.
- *"Witness first … = the game on a p4g witness where a bump fires"*: one roster tape has a plain spinner shove
  (`l40button-l42-part0`, of 293). It was used; no new tape was recorded.
- *"Read … `Player.as` shield code"*: present at `vendor/seedling/src/Player.as` (cited § 3).
- SPIN's hand-over expected the honest fix to make the escape exact with no envelope. Measured: not from the forecast
  alone (§ 2, § 9).

## 11. Byte-inertia, records, rows to BANK

- **OFF byte-identical:** bounded fast 114/114 (2498); identity = W35 / base on every row; producers 97 / 0 red;
  `pressEscape` at the four stands OFF = the base's answers; `hammerSpinnerPress` 11/11 OFF.
- **Censuses:** `seedling-solver-surface.json` `--write` (365 rows, line moves only; GREEN). `seedling-constants`
  `--write` (7038 → 7049 literals, 11 structural; PASS).
- **Reference:** `generate-procgen-reference` → `check-procgen-reference` ALL CHECKS PASSED;
  `generate-docs-index --check` OK.
- **Docs:** `seedling-bot.md` (the key's paragraph after L32ROCK's); `seedling-bot-log.md` (the entry, 3 trap candidates).
- **Roster:** 293 tapes, unchanged; no tape and no producer `--check` digest moved; no new tape (the witness is a
  fixture of game samples, not a tape).
- **Rows to BANK:** `fidelityShieldBump.test.js` (11); the witness fixture; the 2×2 tables (§ 5); 860's counts under SPIN
  (37 / 17 / 8→6 / 3 / 9→11).
- **CI** (`JavaScript Unit Tests`, run 41225157104 at `8c4feb24`, the last code-bearing head): shards 1/2 green, slow battery **351/351**, unfiltered **24991/24993**. The 2 reds are shard 3's `jsRuntimeTape.test.js` › "the no-tape chain (keyboard + walker, digest per tick) is the one measured on the pre-Phase-B core" and › "a tape LOADED but never started leaves every tick of the chain where it was": the brief's predicted **`NO_TAPE_CHAIN`** (any new `contactFidelity.js` key moves it until js's train 3). Named, not re-pinned; the planner re-measures with js. The commits after it are docs and evidence only

## 12. Residue

- Not measured: the dark shield's bump (named, not stepped); a seam census of 860 under the 2×2 (one seam, 5950);
  the full local survey (only the ten spinner-level steps; the brief's local-survey ask is for the shield-carrying steps,
  and only spinner rooms can ask a spinner forecast); the unfiltered vitest (⚖ 52).
- The scratch worktrees (`/tmp/claude-0/sbwt`, `/tmp/claude-0/basewt`) carried the W0 hook; never committed.
- The evidence `tools/` scripts carry absolute scratch paths (`/tmp/claude-0/sbwt/`, the worktree with `tools/w0-hook.patch` applied); `--root=` rebinds most.

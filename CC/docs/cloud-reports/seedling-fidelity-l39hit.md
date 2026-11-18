# Seedling fidelity L39HIT — the walk's L39 hit is a forecast gap (`pulserForecastPulse`, OFF) (wave 47)

Planner `seedling-fidelity-planning-21`, wave 47. ⚖ GO: Robert 2026-11-16, *"Yes, witness slice (Recommended)"*: a
diagnosis, plus a model fix behind one new key, default OFF, only if the cause is the model's. No flip, no default change.

## 1. Start, head, branch

| | |
|---|---|
| start SHA | `d24a057d99` (= `origin/main`, "train: sdc-addon-u2-apworld 64f7f64f9b"); 135 keys, 125 default-ON |
| head | the commit carrying this report (the last code commit before it: `7fb5350a`, CI-green) |
| harness branch | `claude/seedling-l39-hit-diagnosis-qorv9r` (the brief's `seedling-fidelity-l39hit`) |
| commits | D1 evidence `3a8affaf` · D2 key + rows `88da10ee` · D2 press/fight forecasts + docs + surface `1d18ee10` · constants census `--write` `7fb5350a` · census evidence + draft report `fa142c65` · this report |
| verdicts | **D1 PASS** (rebuilt exactly; game-witnessed; cause named) · **D2 PASS** (key OFF, byte-inert; ON prices the hit at its tick and plans a hitless walk the game plays hitless) · **ON movers listed, STOP for the flip** |
| node / wasm | v22.23.4; `session_bootstrap.sh --seedling` → READY; wasm pin `9968c7dd`, p4g; `vendor/seedling` `ccdf1897` |

## 2. The answer first

**The one thing to know first:** the model *did* step the hit. Replayed, the walk's plan has a `playerHits` row at **t1522**
(`spinner@112,88`'s hammer, `source: spinner-hammer`), at the game's tick and the game's position to the ulp. The plan was
accepted anyway, for two reasons:
1. Its walk segment (decision row t1310 → t1679) was certified against `run.spinnerForecast`, which steps only the spinners.
   `pulser@64,96` hits that spinner at **t1317** (force 6, `hits` 0→1, `hitsTimer` 30). In the forecast cut at t1310 the body
   leaves its line at t1318 (5.75 px) and is **~88 px** off at t1522, so the danger map never priced the hammer there.
2. The backstop that would have refused it, `unbilledDamageGate` (wave 15), is **OFF**. `billedHitsOf` counts deliberate
   `forcedHits` only, so the walk's status read *"0 billed"*.

(1) is the model's: a forecast that omits a player-independent mechanic that `advance` already steps. So D2 is built:
`pulserForecastPulse` (OFF) steps the room's pulsers inside the three spinner forecasts. ON:
- the forecast cut at t1310 is exact through the hit and prices the hammer at **t1522, ±0**;
- the walk's own request plans a **3813 t** dashless walk;
- that plan plays on a fresh p4g page with **0 hits**.

| D | verdict |
|---|---|
| D1.1 rebuild | **EXACT**: the walk's 2864 t, kill,l39shaft,rope,walk, dashless, full stopped at its deadline (block-route), first request, 640 units |
| D1.2 model at the hit | **HIT STEPPED** at t1522 (table §4); the plan bills 0 |
| D1.3 game | **WITNESSED** on a fresh p4g page: hit at t1522, 0 px with the model; the walk's two hit samples are this run's rows bit for bit, `game_time` included |
| D1.4 cause | the walk preview's **spinner forecast omits the Pulser's pulse** (model) + the **OFF acceptance gate** (solver backstop) |
| D2 | `pulserForecastPulse`, OFF, byte-identical OFF; 9 rows; mutants M1 red as predicted, M2/M3 green against prediction (§6) |

## 3. D1.1 — the rebuild

There was no captured request and no tape, so I rebuilt both:
1. **The page's own request.** `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --page=seedling_bot_ap_p4g
   --capture-requests`, with one hand-made leg (`evidence/m/leg-144.jsonl`):
   - the l39phantom shaft leg (`level_39__r25c9 <- in_L38_144_0 -> location:Level 039 - Totem Part 72,40`, `flag:L39:8`
     staged);
   - its inventory extended to the walk's entry-18 set: + `Progressive Swim` and the L12, L38 and L15 seals. From the walk log
     and the seed-1 spoiler, entries 1–17 give Sword 1, Shield 1, Light, Fire, Swim, Red and Green keys, and 10 seals. This
     equals survey step 65's staging items (`canSwim`, `seal_parts` 0–9, `keys` [0,1]).
   - ⚠ The leg's `arrive` must be **(144,608)**: the walk's botStatus (152,616) is that landing's +8 centre. My first leg
     used (152,616), landed at (160,624) and refused the rope stance (`evidence/m/row-walk.jsonl`).

   At (144,608) the page played a **3943 t** kill,l39shaft,rope,walk plan at seam 5269: done, hitless, no divergence
   (`row-144.jsonl`).
2. **The walk's seam.** I replayed the captured request with `replay-seedling-solve-request.mjs --seam-time-sweep` over
   30029–30069 (`evidence/m/sweep1.jsonl`). The walk read `game_time` 30035 on arrival.

   | seam | answer |
   |---|---|
   | 30034–30035 | 2853 t |
   | **30036–30038** | **2864 t, dashless 536 units; full: refusal, deadline `block-route`, limit budget (106 units)**: the walk's exact line |
   | 30039 | 2864 t (another plan) |
   | the rest | 28 distinct answers over 41 seams |

   Seam **30036** is the walk's: §5's game run reproduces the walk's `game_time` readings exactly.
3. **No inventory, flag or RNG difference reaches L39.** The captured staging persists only `{39,8}`; its RNG seed is the
   probe page's own. The plan's rows reproduce the walk's samples at 0 px (§5).

## 4. D1.2 — the model at the hit (plan `seam 30036`, a fresh `createRunForStaging` + the plan's equips)

The player is the state after advance `t`. Bodies are within 48 px.

| t | keys | player (x, y) | v | spinner@112,88 (x, y) / dist | ledger |
|---|---|---|---|---|---|
| 1317 | right | (207.21,152.77) | (0.9,0) | (88.89,124.99), **hits 1, hitsTimer 30** | `pulserHits` pulser@64,96 (the pulse lands) |
| 1518 | left | (122.61,247.32) | (−1.25,0) | (116.40,261.38) / 15.37 | |
| 1519 | left | (121.61,247.32) | (−1,0) | (117.01,260.59) / 14.04 | |
| 1520 | left | (120.06,247.32) | (−1.55,0) | (117.62,259.80) / 12.71 | |
| 1521 | left | (118.76,247.32) | (−1.3,0) | (118.23,259.01) / 11.69 | |
| **1522** | left | **(117.539,243.562)** | (−1.223,−3.762) | (118.84,258.21) / 14.71 | **`playerHits` {t1522, spinner-hammer, spinner@112,88, hits 1/3, knockback dy −4.0}** |
| 1523 | left,down | (116.394,242.562) | (−1.145,−3.524) | (119.45,257.42) / 15.17 | `contactsSuppressed` {spinner-hammer, spinner@112,88, why `hitsTimer`} |
| 1524 | left,down | (115.325,242.562) | (−1.068,−3.287) | (120.06,256.63) / 14.84 | spinner@224,112 at 47.7 px |

- Nothing else is within 48 px at t1490–t1540 except `spinner@224,112` from t1524, at 44–48 px.
- The pulser is at (64,96), 150 px away. Its ring hits only the spinner, at t1317.
- No fallrock is in the delivered set (L39 has none there), and no projectile exists.
- No refusal row falls in the window.
- **At (116,243) at t1521 (the walk's tick numbering), the model says: the hammer of `spinner@112,88`, swinging from (118.8,258.2).**

The decision trace (`evidence/tools/trace-at.mjs`, the dashless pass unbudgeted: the same 2864 t at 536 units) puts t1522
inside the `walk` row from **t1310 to t1679** (from (199.7,152.8), aim (56,200)).

The forecast measure (`evidence/tools/forecast-check.mjs`) cuts `run.spinnerForecast` at t1310 and compares it with the
stepped body:

| cut at | first departure | spinner@112,88 at t1522: forecast vs stepped |
|---|---|---|
| t1310 | **t1318, 5.75 px** | **(128.49,170.25) vs (118.84,258.21)** |
| t1450, t1500, t1515, t1519, t1520 | none | exact |

## 5. D1.3 — the game witness (`evidence/tools/witness.mjs`, `evidence/m/witness-off-2864.json`)

**Setup:** the rebuilt plan as a seam-declaring tape (`evidence/m/tape-off-2864-seam30036.json`: the request's staging,
`seam.time` 30036, the equips as tape rows), played on a **fresh** p4g page (headless, logic-only, the delivered set via
`botLoadLevels`) with a per-tick `botStatus` + `botMobiles` poll. The model replays the same tape.

| t | game (x, y) · hits · hits_timer · game_time | model (x, y) · hits |
|---|---|---|
| 1521 | (118.762,247.324) · 0 · 0 · 31578 | (118.762,247.324) · 0 |
| **1522** | **(117.539,243.562) · 1 · 19 · 31579** | (117.539,243.562) · **1** |
| 1523 | (116.39367712023837, 242.56207322596796) · 1 · **18** · **31580** | = |
| 1542 | (107.67103657826075, 242.9285484355258) · 1 · 0 · **31599** | = |

- **The walk's two hit samples are rows 1523 and 1542, bit for bit, `game_time` included.** The walk's sampler labels them
  "tick 1521" and "tick 1540"; its tick counter runs two rows behind.
- Player x/y matches at 0 px on 2,864 of 2,865 rows, and every spinner on every row.
- The two exceptions:
  - t0, the poll before the boot;
  - **t2825**, where the game repeats t2824's y for one row and rejoins at 0 px. That is at the totem pickup. My witness
    page mounted the vanilla delivered set (`totempart@72,40`), and the walk's page has the AP set's `apitem@72,40`
    (§10). It does not touch the hit.
- The game ends with hits 1.

## 6. D1.4 — AS3 and the cause

- `Spinner.update` (`Enemies/Spinner.as:66-76`): `hammerLength` = 18 − 5 = 13. `hammerAngle` comes from `Game.time %
  timePerFrame`. `collideLine("Player", x, y, …)` → `player.hit(this, 4, Point(x, y))`.
- `Player.hit` (`Player.as:1374-1401`): gated on `hitsTimer <= 0 && hits < hitsMax && !freezeObjects`. Then `hits += d`,
  `hitsTimer = hitsTimerMax` (20, `:336`), `Game.shake += 5`, `knockback(f, p)`. `hitUpdate` decrements the timer, so the
  game's 19 on t1522 and 18 on t1523 are the same hit.
- `Pulser.hit` (`Puzzlements/Pulser.as:87-116`) → `(c as Enemy).hit(force, Point(x, y), damage, "Pulse")`.
  `Enemy.hit` (`Enemies/Enemy.as:141-181`) applies the atan2 knockback at force 6, with `hitsTimer` 30.
- **Order:** `Game.as:2357` adds the pulser and `:2416` the spinner. `World.addUpdate` prepends, so the spinner updates
  first and the pulse lands after it in the same frame. The model already steps it so (`levelRun.js` spinners, then
  `stepPulsersNow` later in `advance`), and §5's 0-px spinner rows through t1317 witness it.

**The cause.** The model's `advance` is exact here: the pulse, the bounce and the hammer. The model's **spinner forecast**
(`levelRun.spinnerForecast`, and likewise `spinnerForecastWithPress` and `spinnerFightForecast`) steps the bodies only
(`stepSpinners`). The walk preview prices spinners off that forecast (`dangerMap.spinnerDanger`), so it certified the walk
clean, and the solver returned it. The acceptance gate that compares the drive with the preview (`unbilledDamageGate`) is OFF.

Measured with the gate ON at the walk's seam:
- 640 units: the dashless pass refuses *"UNBILLED DAMAGE … t1521 (run t1522, L39) spinner-hammer:spinner@112,88"*; the full
  pass runs out at `block-route`.
- the 2560 held retry: the full pass solves, 2540 t (seam 30036) or 2735 t (seam 30039), 0 unbilled.

## 7. D2 — `pulserForecastPulse` (OFF)

**Change** (`levelRun.js`):
- `pulserForecastStepper()` copies the room's pulsers, `armed` as `stepPulsersNow` reads it, once at the forecast's tick.
  That is the latched group, or the momentary group as the player's box presses it now (the `pulserPublishLag`
  `pressedLast` first): the same bound as `arrowForecastNow`.
- After each forecast row's `stepSpinners`, it steps them and applies the enemy arm (`pulseReaches` → `hitSpinner`, force 6,
  damage 1, "Pulse").
- A frozen ctx (a ceremony) steps no pulser.
- Used by:
  - `spinnerForecast`: the memo carries the stepper; such a memo is never shifted (`pulses !== null` skips
    `shiftedSpinnerForecast`, and its `key` is UNCACHEABLE);
  - `spinnerForecastWithPress`;
  - the fight cursor: a row snapshots the stepper, a fork copies it.
- `null` OFF, under `noclip`, in a room with no pulser, or with no spinner.
- The block shove and the player's hit are not a spinner forecast's.

**Wiring:**
- the key goes last in `CONTACT_FIDELITY_DEFAULTS`, `false`, with its doc block and AS3 cites;
- env `SEEDLING_PULSER_FORECAST_PULSE=0|1`;
- `SOLVER_ENV_NAMES` gets the entry, sorted and duplicate-free (214 names; checked);
- 12 key-order pins re-pinned: the ten tails (`fidelityCeremony126`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`,
  `FrozenPress`, `L39Phantom`, `RockButton`, `RockFire`, `RockGone`), `fidelityCorridorBody`'s `.at(-1)` (now "followed by
  `pulserForecastPulse`"), and `contactFidelity.test.js` (the defaults literal and its env skip-list);
- `contactFidelityHook.test.js` enumerates the keys, 143 → 144 rows.

**Rows** (`fidelityL39Hit.test.js`, fast tier, 9 rows, ~7 s). The fixture is `fixtures/l39hit/l39hit-walk-seam30036.json`,
33 KB: the tape, the page's own L39 record (15 KB, `apitem@72,40`) and the game rows t1505–t1545. With that record,
`solveAnytime` on `stagingFromTape(tape)` reproduces the captured request's answers exactly (OFF 2864 t, same solution; ON
3813 t, same solution).

| row | arm | asserts |
|---|---|---|
| the rebuilt request plans the walk's plan | OFF | 2864 t, dashless, full at block-route, verbs; solution = the tape; its drive has exactly one `playerHits` row (t1522, spinner@112,88); no `forcedHits` |
| the model steps the game's hit | OFF | model rows t1505–t1545 = the game's (player, hits, the spinner) at 0 px; first game hit at t1522; the walk's two samples |
| ships OFF, appended last, env name | — | |
| the pulse the forecast misses | OFF | t1317: hits 0→1, hitsTimer 0→30; `pulserHits` row |
| OFF forecast | OFF | cut at t1310: = stepped at t1317, 5.75006 px off at t1318, 85–92 px off at t1522; `spinnerDanger` at horizon 212 prices nothing for the body |
| ON forecast | ON | = the stepped body at t1318 and t1400, and = the game's rows at t1521–t1524; prices `['hammer']` at horizon 212 (**t1522, ±0**), nothing at 211 |
| ON request | ON | 3813 t dashless; its drive has no `playerHits` row |
| ON = OFF, no pulser | both | L18 (`r8-solve-18`'s boot + 40 ticks): `spinnerForecast(300)` byte-equal |
| ON = OFF, pulser unarmed | both | L39 at t1 (before the rope latches group 6): 400 rows byte-equal |

**The ON plan on the game** (`evidence/m/tape-on-3813-seam30036.json`, `witness-on-3813.json`): a fresh p4g page plays it
with **0 hits**. The model's `playerHits` is empty, and the player is at 0 px on every row but t3781, which is the same
totem-pickup read artifact as t2825.

**Mutants** (predicted, then run on `fidelityL39Hit.test.js`; copy + restore, `cmp` confirmed):

| mutant | predicted | shown |
|---|---|---|
| M1: the enemy arm writes nothing (`if (sp && false)`) | the ON forecast row and the ON request row red | **2 red, exactly those** ✅ |
| M2: the pulse stepped BEFORE `stepSpinners` | the ON forecast row red | **0 red** ✗: equivalent on this witness. The prediction was wrong, and I did not chase why the order makes no difference here |
| M3: drop the shift bypass (`\|\| pulses !== null`) | the ON request row red (the solver's per-tick memo shifts without pulsers) | **0 red** ✗: the memo's `key = UNCACHEABLE` is a second guard |
| M3b: drop both guards | the ON request row red | **0 red** ✗: the shift is not reached by this witness. The guard is defensive and **uncovered**; named in §10 |

## 8. Byte-inertia and the gates

| gate | result |
|---|---|
| acceptance md5 (`batch-seedling-acceptance.mjs \| md5sum`) | base `391322d681b7aa0229d94b3f6906d024` · head OFF `391322d681b7aa0229d94b3f6906d024` · head ON `391322d681b7aa0229d94b3f6906d024` |
| bounded vitest BEFORE (base, 63 files: the brief's list + every `.test.js` naming `spinnerForecast`, `pulseReaches`, `stepPulser`, `hitSpinner`, `SOLVER_ENV_NAMES`, `pulserStateFor`, `stepPulsersNow`, + `fidelityUnbilledGate`) | **63/63 files, 1231/1231** |
| bounded vitest AFTER, key OFF (64 files: + `fidelityL39Hit`) | **64/64 files, 1241/1241** (+9 `fidelityL39Hit` rows, +1 `contactFidelity` hook row) |
| bounded vitest AFTER, key ON (`SEEDLING_PULSER_FORECAST_PULSE=1`) | **3 red**: the movers in §9 (the 9 L39HIT rows green ON) |
| fixtures diff | **empty**: no committed fixture or tape changed; the one new fixture is `fixtures/l39hit/` |
| `ci-producer-checks.mjs --jobs=3` | **99 run, 0 red, 1 skipped** |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED |
| `generate-procgen-reference.mjs --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH (after a regenerate: README counts + `docsIndex.js` for the new doc text) |
| constants census `--check` | PASS (7,122 literals; green drift only) |
| surface census `--check` | GREEN after `--write`: 58 `line` shifts in `levelRun.js`; 375 rows before and after, none added or removed |
| CI `JavaScript Unit Tests` at the last head | run `43980123118` at `7fb5350a`: **success**, unfiltered 28183/28183, slow 437/437. (The run at `1d18ee10`, `43976673973`, was red on `seedlingConstantsCensus` mutant (b): the census needed a `--write`, landed as `7fb5350a`) |

## 9. ON census and movers

**Reach by construction:** only rooms with a Pulser **and** a spinner (`pulserForecastStepper` is `null` otherwise, and the
forecasts return early without spinners). The atlas has **L39** (`pulser@64,96`, 3 spinners) and **L40** (a Pulser, 5
spinners).

**Survey** (`--through=end --route=full --only=` the 13 L39/L40 steps at this base; `evidence/m/survey-*.txt`):

| step | level | OFF | ON |
|---|---|---|---|
| 65 | L39 (Totem 72,40) | SOLVED 2740 t | SOLVED **2477** t |
| 95, 133, 148, 165 | L39 | SOLVED 2624 t | SOLVED **2359** t |
| 172 | L39 | SOLVED 2626 t | SOLVED **2288** t |
| 66, 96, 134, 149 | L40 | REFUSED | = (refusal objects identical) |
| 136 / 166 / 173 | L40 | SOLVED 70 / 172 / 172 t | = |

- 9/13 SOLVED in both arms, and no verdict moves.
- With `SEEDLING_UNBILLED_DAMAGE_GATE=1` the six L39 rows SOLVE in both arms, so **no row is hit-taking either way**.
- Survey wall time ON was +14 % (L40 refusals 25→35 s and 42→58 s; the two arms ran concurrently, so it is noisy). The
  budgets are work units, so the cost doesn't move a plan.

**Seed-1 legs:** the page's L39 legs are this request and its seam neighbours. The walk now gets a hitless 3813 t plan at
the walk's own seam (30036 and 30039 measured). L40 legs: unchanged on the survey, not swept.

**Bounded ON movers (file:row):**
1. `fidelityL39Shaft.test.js` › L39SHAFT D2 › "the solver, keys ON, plans exactly the recorded tape" — `expected 2477 to be
   2740`. This is a **re-record**, the step-65 plan above. At a flip, `l39shaft-solver-step66` re-records on p4g, as wave
   38 said for its own key.
2. `fidelityL39Shaft.test.js` › "one block home (t300)" — ON the `l39shaft-from-300` solve **refuses**: *"kill
   (spinner@224,112) by press: ran the strike schedule … 5754-tick bound (455 strike(s) planned, 0 landing(s))"*.
   - Measured at that state: the ON forecast tracks the stepped run further (spinner@112,88 exact to t761, vs OFF t535).
   - spinner@224,112 departs at t597 in **both** arms (4.75 px), from something other than the pulse.
   - So the route ON reaches a strike case the scheduler cannot land. Handed to hammer (§11).
3. `pressKillCost.test.js` › "r5-press-glide … every row equal" — `expected 0 to be greater than 200`. The row needs
   shifts, and ON bypasses the shift in a pulser room by design. It needs an ON arm, or a shift that carries the pulsers
   (hammer's P1).

**Train tier, key ON** (`-c vitest.train.config.js`, the 24 `seedlingDemo` `.train.` files naming L39/L40; run detached):

| file | ON | OFF control |
|---|---|---|
| hammerChooserPair | 6/6 | |
| hammerGhostKillRung | 7/7 | |
| hammerPitWest | 8/8 | |
| hammerApproachOrder | 2 red (the "OFF: solved inside the budget … 4,519 ticks" and "ON: the right side's corridor … 4,527 ticks" rows) | **7/7 green**: so the key moves both rows |
| the other 20 (BombPhase, OppFallbackHits, TurretApproach, Bk2Combat, EscapeExact, fidelityL40Latch, SpinnerPress, PocketBurn, OppPressFallback, BodyGate, OppDashDefers, KillHitBody, fidelityCorpseBump2, IceTurretStatic, StagedHuntScanMemo, fidelityL40Bk2, KeylockTurret, ClearTagChain, SouthDoor, LatchWeigh) | **20/20 files, 56/56** | not needed |

## 10. What the brief got wrong (measured)

- **"The plan was accepted with 0 billed hits, so the model predicted none."** The model steps the hit at t1522.
  "Billed" counts `forcedHits` only, and the gate that compares the drive with the preview is OFF.
- **"The pulser: ring phase" / "fallrock".** The delivered set has no `fallrock@144,624` in L39, and the ring never reaches
  the player. The Pulser matters *indirectly*: its t1317 pulse moved the spinner the forecast didn't move.
- **"Arrival (152,616)."** That is the botStatus position. The probe's `arrive` is (144,608) (+8 centre); a leg at
  (152,616) lands at (160,624) and refuses.
- **"No captured request and no wasm tape exist."** True. Both are rebuilt here, and the rebuild is exact (§3, §5).
- **"Sphere 6.7."** The leg list labels the same location sphere 5.3. The walk counts its own spheres; the items are the same.
- Everything else the brief stated was right: the survey's step 65 (2740 t, staged boot), L39's roster, the base's 135/125
  keys, and that `wallFlyerCorpseGone` is irrelevant to L39.

## 11. Hand-overs

- **Hammer (solver):**
  - (a) **`unbilledDamageGate`**: OFF still lets every forecast gap through as a hit-taking "solve". This walk is one more
    witness (ON, the 640 request refuses by name and the 2560 retry plans a 2540 t full-pass walk).
  - (b) **the t300 strike-schedule refusal** under `pulserForecastPulse` ON (§9.2).
  - (c) **`pressKillCost`'s shift in pulser rooms**: ON recuts the forecast every tick there (+cost); a shift that carries
    the pulser copy is the clean form.
  - (d) **`hammerApproachOrder.train`'s two rows ON**: ON, the push side's solve comes back `['dashless', 4519]` where the row pins `['full', 4306]`, and the right side's corridor row reads `false`. Both are green OFF (7/7). The re-priced L39/L40 spinner forecast changes which pass wins; this is a chooser/pin question for hammer at a flip, not a model defect I measured.
- **Fidelity (at a flip):** re-record `l39shaft-solver-step66` (step 65 is 2477 t ON); re-choose D0's witness window.
- **JS arc / walk instrument:** the walk saves no request and no tape. Saving `--capture-requests`-style requests per leg
  would have made this a 10-minute replay. The page's AP L39 record (`apitem@72,40`) is what the node rebuild needs on top
  of the tape (the fixture carries it).
- **Planner dispatch:** `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref
  claude/seedling-l39-hit-diagnosis-qorv9r -f train_only=true` at this head (the train tier with the key OFF), and the
  usual survey/sweep A/B with `contact_fidelity` + `pulserForecastPulse` for a flip.

## 12. Residue

- **M2 is equivalent on this witness** (the pulse's order relative to the bodies' step). The model's own order is
  AS3-cited and game-witnessed. The forecast's order was not separately pinned.
- **The forecast-shift guard is uncovered** (M3/M3b green): defensive only.
- **One-row read artifacts** at t2825 (OFF plan) and t3781 (ON plan): the game repeats one row's y at the totem pickup. My
  witness page mounted the vanilla delivered set (`totempart@72,40`, a pickup ceremony), not the page's AP set
  (`apitem@72,40`). It is unattributed and outside the hit.
- **spinner@224,112's forecast departs at t597** from the t300 state in both arms (4.75 px): another unmodelled forecast
  input (not the pulse). Unattributed.
- **Session hygiene:**
  - dev server: started on 9795 (PID 739); a worker restart took it down, so there was nothing to kill;
  - train run: the first ON run was stopped by literal PIDs (2996, 2997, 3008, 3009, plus children 3016, 4290); the detached
    gate script (PID 4380) ran to completion;
  - tree: clean but for this report's commit; no `pytest`, no `stash`, no `--write` of standing values.

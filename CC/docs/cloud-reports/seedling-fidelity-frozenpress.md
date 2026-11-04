# Seedling fidelity FROZENPRESS (wave 37) — the solver's presses scheduled around a freeze it can forecast

Session `seedling-fidelity-frozenpress` (planner `seedling-fidelity-planning-17`). ⚖ The user's GO, 2026-11-02 (hammer-2's
FROZEN-PRESS, handed to fidelity).

- **Start SHA** `fa5c098bfb79bb7d1ad8c7ae512356d85848e919` (= `fidelity-flip/w36`, 108 ON of 121).
- **Head** — see the last commit on the harness branch **`claude/seedling-fidelity-wave-37-cqju3b`** (local name
  `seedling-fidelity-frozenpress`). D1 code head `b6f9bb11`.
- **New key** `CONTACT_FIDELITY.frozenPressForecast` — **OFF**, last in the defaults (109 → now 122 keys, 108 ON);
  `SEEDLING_FROZEN_PRESS_FORECAST=0|1` (in `SOLVER_ENV_NAMES`).
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-frozenpress-evidence/`.

| part | verdict |
|---|---|
| W0 | **DONE.** Reproduced (work 5067, t2119, throw 3). Issuer: the walk's OPPORTUNISTIC STRIKE (`strikePolicy.decide`, asked by `botDriverV2.drive`), NOT a hammer executor. The freeze is an `IceTurretBlast` contact (t2117), fully determined at scheduling time. Class census: 1 survey row (step 126, a different freeze: a pickup ceremony), 0 sweep-12 rows |
| D1 | **PASS.** `freezeForecast` (exact one-tick forecast) + the policy's stand-down, behind the key, OFF byte-identical. Game witness on p4g, 0 px. 4/4 mutants as predicted |
| D2 | **PASS (860 gets past t2119; does NOT reach `spinner@816,848`).** ON·ON 5171: refused by name at the LWEIGH corpse-weigh approach (hammer's unbuilt volley-aware arm) |
| D3 | **READY to flip, one hammer pin LISTED.** Key ON: survey 0 movers (both arms), identity block + six `--check`s = OFF on every row, producers 97 run / 0 exit≠0, bounded fast 158/160 files (2 env-vs-default artifacts), slow 28/29 (the one red is hammer's 860 pin, the predicted mover) |

## 1. W0 — the trace

**Command** (A5 arm, as hammer ESCAPE-EXACT measured it: CHOOSER_PAIR size 3, ICEST, OPP, LWEIGH, `orbitFreeAim`,
`strategyBoundDistinct` ON; seam 5950; deadline 10240; request `fixtures/spin-witness/leg860-request.json.gz`):

```
SEEDLING_PRESS_ESCAPE_EXACT=1 SEEDLING_FORECAST_SHIELD_BUMP=1 node evidence/tools/leg860s.mjs <repo>
```
(`leg860s.mjs` = hammer's `leg860.mjs` + an `Object.assign` hook that records the stack of every `FROZEN_TICK_PRESS`
error at construction, + `HAMMER_DEFAULTS=1` for the defaults arm.) Result on the base: REFUSED, work **5067**, 167 s,
one frozen-press throw (`evidence/860/w0-base-a5-k1x1.json`).

- **Which throw:** the third (`levelRun.advance`, the X edge while `frozenTimer > 0`): *"a `primary` press at tick 2119
  lands on a FROZEN tick (frozenTimer 12 after this tick's `freezeStep`)"*. 12 after t2119's step ⇒ the contact set 15 on
  **t2117** (decremented to 14 that tick, 13 on t2118).
- **Who pressed:** `levelRun.advance` ← `solverBot.advanceNamingRefusals` ← `solverBot` run proxy `advance` ←
  **`botDriverV2.drive`** (line 5694, `strike.decide(...)` → `{ primary }`) ← `walkToUnder` / `walkTo` (four nested) ←
  `solveSegmentUnder`. The press is the walk's **opportunistic strike** (`strikePolicy.createStrikePolicy().decide`, R9 12b),
  which every run-side walk consults. It is not `execKillByPress*`, `deriveStrike`, `pressEscape*` or an ice-turret kill.
  ⇒ the site is in fidelity's region (the walker, `drive`, agreed with the JS arc; `strikePolicy.js` is not on hammer's list).
- **Scheduled vs lands:** the policy is two-tick (aim, then press). Both the aim and the press were decided ON refused
  ticks (t2118 had 13, t2119 had 12 left); the press is decided and lands on the same tick (`decide` returns the held set
  for the tick about to run). The aim on t2118 steered nothing (`input()` returned).
- **Which freeze:** an `IceTurretBlast` of `iceturret@472,400` (`run.blastFreezes`), not `Game.freezeObjects`.
- **Determined at scheduling time?** Yes, exactly. Tick t's refusal is `frozenTimer` after t's `freezeStep` > 0, and the
  only writer before that step is a blast stepping first in the tick (`World.addUpdate` prepends) against the player's
  box at the tick's TOP. So "is input t refused" = (a blast in flight, stepped one tick from the current state, touches
  the tick-top box) OR `frozenTimer − 1 > 0`. A volley spawned during tick t is added below the blasts and first steps on
  t+1.

**The game** (vendor/seedling at the pin): `IceTurretBlast.as:18` `freezeTime = 15`; `:51-53` contact → `freeze(15)` then
`hit(null, 0, …)`; `Player.as:532` `freezeStep()` above `super.update()`; `:586-601` `freeze`/`freezeStep`;
`:1515-1524` `input()` returns while `frozenTimer > 0` (and `useItem` is called inside `input()`). `Game.freezeObjects`
writers: `Game.as:959/999/1325`, `Inventory.as:153/185`, `SealController.as:46` (the ceremonies, the menu, the seal).

**The class census (base):**

| source | defaults | 860 switches ON |
|---|---|---|
| route survey, local, `--through=end --route=full` (237 steps) | 203 SOLVED / 34 REFUSED; **1** frozen-press row: **step 126** (L64 Ghostspear): throw 2, *"a sword press at tick 43 would fire its rect on a FROZEN tick (a pickup ceremony)"* | identical verdicts; 4 L39 tick movers (66, 94, 135, 148: the K+X switches' own); step 126 the same |
| CI survey `40936270865` (W35, 240 steps) | the same single row (its step 126) | — |
| sweep 12 `40912321813` (919 legs) | **0** rows (leg 631's L74 row, housekeep's, is `done` there) | not measured (needs a dispatch, § 6) |

Step 126's press (`evidence/w0-step126-stack.txt`): the same site, `drive`'s strike: pressed at t43 as the walk reached
the pickup, whose ceremony's first frame is t44, where the pending thrust fires.

## 2. D1 — the change (`b6f9bb11`)

- `levelRun.freezeForecastNow` → `run.progress('freezeForecast')` / `run.freezeForecast` (new progress field, appended):
  `{ refusedNext, timerNext, contact }`. Copies of the current level's blasts (`blastStates.get`, never `blastsFor`:
  a pure read, DIGESTREAD holds) are stepped one tick with `stepBlastsNow`'s own context (`frozen: ceremony !== null`,
  the tick-top player box, `collidesBlast`, the `iceBlastShield` shield box); `timerNext` is 14 on a contact, else
  `max(frozenTimer − 1, 0)`. No new run state; nothing written.
- `strikePolicy.decide(…, { slash, freeze })`: with `freeze.refusedNext` the policy returns the walk's keys, takes no
  aim, drops an owed aim (`owed` untouched: the body is aimable again after), and traces a `frozenRefused` row when it
  withheld something. No aim-time half is needed: past the guard the timer is 0, so the press tick can only be refused by
  a contact ON that tick, which depends on where the aim key puts the player and is caught when that tick is asked.
  `FROZEN_PRESS_COUNTS { stoodDown, dropped }`.
- `strikeDecideOpts(run)`: OFF `{ slash: run.progress('slashInfo') }` (the object every site built before); ON adds
  `freeze`. Wired at the six run-side sites: `botDriverV2` `drive`, `runDwell`, `runShove`; `solverBot`
  `guardedChaserDwell`, `execBreak`, `orbitKillPolicy`. **Not wired:** hammer's `execKillByPressOnce` OPP call
  (`opp.decide`, line ~19567, hammer region) — see § 7. The preview (`previewWalk`) steps no blasts and is not a caller,
  as before (a frozen tick already parted preview and drive).
- Not touched: the three throws, `REFUSAL_BY_NAME`, `iceTurret.js` / `iceTurretBlast.js` (the model was right: the
  witness reproduces the game's 14 refused inputs at 0 px).

**Witness** (`fixtures/frozenpress-witness/`, `scripts/procgen/probe-seedling-frozen-press.mjs --record`, p4g headless,
port 9769, `fidelityFrozenPress.js`): from the L40 pocket boot (Sword, no shield), up 12, stand under
`iceturret@472,400`. The first volley freezes the player on input 52.
- `frozenpress-l40-lost`: `primary` on inputs 52 (the contact tick) and 65 (the last refused). The game: `frozen_timer`
  > 0 on exactly observations 53..66; the turret takes **no** hit. Game = the model of the press-free tape at 0 px on all
  120 ticks (player, hits, freeze, turret position, hits, i-frame). The tape itself in the model: `FROZEN_TICK_PRESS`.
- `frozenpress-l40-landed`: `primary` on input 66, the forecast's first free input. The game's turret takes the hit
  (observation 68, its first hit test); game = model at 0 px.
- Both: the model's `freezeForecast` names exactly the inputs the game refuses, all 120.
ALL CHECKS PASSED.

**Test** `fidelityFrozenPress.test.js` (11): the switch (OFF, last; env name; the progress field), `strikeDecideOpts` OFF/ON,
the policy's drop and recovery, the recordings, the model's refusal of the lost tape, and both witnesses vs the model +
forecast. **Mutants** (predicted, then copy + restore): M1 the forecast never sees a contact → 2 red (the witness
forecast rows) ✓; M2 the guard removed → 1 red (the drop row) ✓; M3 no timer decrement → 2 red ✓; M4 opts ignore the key
→ 1 red ✓.

**Not kept: a pickup-ceremony arm** (`evidence/ceremony-arm-prototype.full.diff`): `freezeForecast.pickupGap` (the
least Chebyshev gap to an uncollected touchable pickup, `pickupUnderfoot`'s own skips) against a one/two-tick travel
bound at press/aim. On step 126 it removes the frozen press, and the step then REFUSES with a walk stall: *"collect (72,24)
stance waypoint 0 (72,24): not reached within 400 ticks; stalled at (72.958,34.784) v=(−0.35,−1.49)"*. The guard fired
once (gap 0). OFF, the t43 press's `{primary}`-only coast was what carried the player onto the Ghostspear. The stall is
a walk-geometry defect the press hid, not a press-scheduling one, so this arm is not in the key (§ 8).

## 3. D2 — 860 and the class

**860, the 2×2** (A5 arm; key × (`forecastShieldBump` + `PRESS_ESCAPE_EXACT`); `evidence/860/d2-*.json`):

| key \ K+X | OFF | ON |
|---|---|---|
| **OFF** | REFUSED 3068: the `spinner@816,848` press-kill corner at (770.96,860.99), 19 t after its t2744 landing (HAMMER_PHASE_RUNG). 29 escape asks, all no claim | REFUSED **5067** `unmodelled-frozen-press` (t2119). 200 asks: 184 claimed (t541 no-landing), 16 ok |
| **ON** | REFUSED 3068, **identical** text; 0 stand-downs | REFUSED **5171**, past t2119: 14 stand-downs, 1 owed press dropped, 0 frozen throws. Refused by name, obstacle `{danger, iceturret@472,400}`: *"weigh (wandlock@448,432): the reordered corpse weigh took a hit at t2118 (blast:iceturret@472,400#2.0) on its way to iceturret@472,400's kill stance (488,445) — the approach into the turret's range is not certified (⛓ LWEIGH: a volley-aware approach is the unbuilt arm)"* |

⇒ The key gets 860 past t2119. It does not reach `spinner@816,848`, and the run is not hitless: the t2117 blast that froze
the player is also a HIT (t2118 in the hit ledger), which LWEIGH's reordered corpse weigh refuses. That is the next wall,
and it belongs to hammer (§ 7).

**Hammer switches at their defaults** (`HAMMER_DEFAULTS=1`, `evidence/860/d2hd-*.json`): all four arms refuse at
`burnabletree@872,784`'s burn stance on `bobsoldier@880,832` (key OFF/ON: 3094 / 3094 with K+X OFF, 3132 / 3132 with
K+X ON, identical text). The freeze is never met and the key is inert.

**The census rows with the key ON:** survey step 126: unchanged (a pickup-ceremony freeze, outside this key). Sweep:
0 rows to re-run.

## 4. Movers (measured locally)

| run | arms | movers |
|---|---|---|
| route survey, full (237) | defaults vs key ON | **0** (203 / 34 both; `evidence/survey/def-vs-f1.txt`) |
| route survey, full | K+X ON vs K+X + key ON | **0** (`kx-vs-f1kx.txt`) |
| 860 A5 | § 3 | K+X OFF: 0; K+X ON: 5067 FROZEN → 5171 LWEIGH refusal |

## 5. D3 — flip readiness (key ON, `SEEDLING_FROZEN_PRESS_FORECAST=1`)

| gate | OFF (head) | ON |
|---|---|---|
| bounded set (172 files: the header list, shieldbump's 122, every `hammer*` incl. `.slow`, every file `rg -a` finds for `FROZEN_TICK_PRESS`, `frozenTimer`, `freezeObjects`, `ICE_TURRET_BLAST`, `iceTurret`, `PROGRESS_FIELD_NAMES`, `createStrikePolicy`, `strikeDecideOpts`, `SOLVER_ENV_NAMES`; `evidence/bounded-files.txt`) — fast 160 | first run 6 files red: all my own bookkeeping (r8Acceptance `liveSolidOpts` batch, progress count, defaults pin, boxLock registry, surface + constants census); fixed in D1, the six re-run **8/8 files, 397/397** | **158/160 files, 4081 passed, 2 failed, 1 skipped** (`evidence/bfast-on-summary.txt`) |
| — the 2 fast reds ON | — | `contactFidelity.test` "the shipped defaults" (the live object ≠ the pinned defaults under the env; a flip re-pins `frozenPressForecast: true`); `procgenRequirementsStrategy.test` "REFUSED at the gate … STRONG" (the solve record stamps `contactFidelity` whenever the process differs from the defaults: `null` expected; green OFF 5/5). Neither is a behaviour move; both clear on a flip |
| slow 12 files | (CI's slow battery reads OFF) | **11/12 files, 28/29** (`evidence/bslow-on-summary.txt`). Red: `hammerEscapeExact.slow` "[needs fidelity's forecastShieldBump] key ON, SPIN OFF, ON: … the frozen-tick press refusal at t2119": **the predicted mover** (860 → 5171, the LWEIGH refusal, § 3). **Hammer pin: LISTED for hammer-2, not re-pinned** |
| identity block (13 rows + generated set + the six @ci-box `--check`s) | = the published base block on every row (`evidence/identity-head-off.txt`: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0) | **= OFF on every row** (`identity-head-on.txt`) |
| `ci-producer-checks.mjs --jobs=3` | — | **97 run, every producer exit 0, 1 skipped**; the one flagged row is `(battery) TREE-MOVED`, caused by my own report draft and records commit landing during the run, not by a `--check` write (`evidence/producers-on.txt`) |
| route survey, full | 203 / 34 | 203 / 34, **0 movers** (with K+X too) |
| reference / docs index | regenerated; `check-procgen-reference` ALL CHECKS PASSED; `generate-docs-index --check` OK | — |

⇒ **Flip owes:** the defaults pin (`contactFidelity.test`, → `true`), hammer's `hammerEscapeExact.slow` 860 row (hammer-2
re-pins to the 5171 LWEIGH refusal or moves it with LWEIGH's fix), and the survey/sweep A/B in § 6.

## 6. CI dispatches for the planner (branch `claude/seedling-fidelity-wave-37-cqju3b`)

DEFAULT_ON = the 108 default-ON keys (read off `contactFidelity.js` `CONTACT_FIDELITY_DEFAULTS` at this head).

1. **Survey A/B:** `seedling-survey.yml` `through=end route=full`, ×2: as-is (OFF), and with `solver_env=SEEDLING_FROZEN_PRESS_FORECAST=1` (or the input that sets contact fidelity: DEFAULT_ON + `frozenPressForecast`). Expect 0 movers.
2. **Full divergence sweep ×2 per arm:** `seedling-divergence-sweep.yml` `contact_fidelity=<DEFAULT_ON>` and
   `contact_fidelity=<DEFAULT_ON>|frozenPressForecast`. Expect only legs whose walk strikes inside an ice-blast freeze
   to move (none in sweep 12 refused for it; a few L40 legs may move by the dropped aims).
3. **L40 keyed legs incl. 860**, `capture_requests=true`: the 52 L40 keys of ESCAPE-EXACT/SHIELDBUMP
   (`CC/docs/cloud-reports/seedling-fidelity-shieldbump-evidence/sweep-keys-l40.txt`, re-derive at this base with
   `seedling-divergence-legs.mjs`), both arms as in 2.
4. **Probes:** `seedling-probe.yml battery=standard`, both arms (`solver_env=SEEDLING_FROZEN_PRESS_FORECAST=1`).
5. **The 860 arm:** the sweep with `keys=<860's key>`, `solver_env=SEEDLING_PRESS_ESCAPE_EXACT=1`,
   `contact_fidelity=<DEFAULT_ON>|forecastShieldBump|frozenPressForecast`, `capture_requests=true`. Expect
   `unmodelled-frozen-press` → the LWEIGH-style approach refusal (if the page's arm matches A5) or the bobsoldier burn-stance
   refusal (hammer defaults).

## 7. Hand-over

**To the hammer arc (hammer-2):**
- **860's next wall is LWEIGH's.** With the key ON and K+X ON (A5), the solve refuses at 5171 because the reordered corpse
  weigh's approach to `iceturret@472,400`'s kill stance (488,445) takes the t2117/t2118 blast HIT (`blast:iceturret@472,400#2.0`):
  *"a volley-aware approach is the unbuilt arm"*. That is `LATCH_WEIGH_FIRST`'s territory. `freezeForecast` (one tick)
  and `run.blastsInFlight` are available to a volley-aware approach.
- **OPP's `opp.decide` in `execKillByPressOnce`** (~`solverBot.js:19567`) is not wired to `strikeDecideOpts`: it is
  hammer's. One line, `opp.decide(…, strikeDecideOpts(run))`. Unmeasured whether OPP ever presses into a freeze.
- Nothing in hammer's region was edited; no hammer pin moved OFF (§ 5 lists the ON results).

**To the JS arc:** nothing to wire. `solveSegment`'s contract is unchanged; the refusal kind is unchanged. A new
`run.progress` field (`freezeForecast`) and getter: `seedlingSkinRenderer` is not affected (it does not enumerate
progress fields). The worker reads `SEEDLING_FROZEN_PRESS_FORECAST` through `SOLVER_ENV_NAMES`.

## 8. What the brief got wrong (measured)

- *"Who presses at t2119 … executor"*: no executor. It is the walk's opportunistic strike (`drive`), so the fix sits in
  the policy every walk shares, not in a kill verb, and not in hammer's region.
- *"The freeze span is derivable from the volley clock"*: it is, but the volley clock is not needed. The run state at
  scheduling time (`frozenTimer` + the blasts already in flight) decides the next tick exactly, and a press is decided for
  the tick about to run, so a one-tick forecast is complete.
- The survey class is not 860's freeze: step 126 is a pickup ceremony (`Game.freezeObjects`, throw 2), and a guard for it
  unmasks a walk stall (§ 2), so it is a separate slice.
- *"108 default-ON keys of 121"*: confirmed at the base; with this key, 122 keys, 108 ON.

## 9. Residue

- Step 126 (L64 Ghostspear): the ceremony class. Queue: the walk to a pickup at (72,24) stalls at (72.96,34.78) once no
  strike press coasts it there. Name the blocker first (likely the pickup alcove's geometry vs `chooseHeld`), then the
  ceremony guard (`evidence/ceremony-arm-prototype.full.diff`).
- Seed fire windows (throw 1) on a frozen tick: not met anywhere measured; not addressed.
- A seam census of 860 under the key (one seam, 5950).

## 10. Byte-inertia, records, rows to BANK

- **OFF byte-identical:** `strikeDecideOpts` returns `{ slash }` (the object every site built); the forecast is only read
  ON; the new getter and progress field are pure reads (DIGESTREAD green, auto-enumerated). Identity = base on every row;
  the six producer `--check`s unchanged; survey OFF = the base's run (both 203 / 34).
- **Censuses:** `seedling-solver-surface.json` `--write` (371 rows, GREEN: +`freezeForecast` in `folded.progress`,
  strikePolicy now reaches `run:progress`); `seedling-constants` `--write` (7061 literals, PASS).
- **Records:** `seedling-bot.md` (the key's paragraph after L100LATTICE's); `seedling-bot-log.md` (the entry, 2 trap
  candidates); reference regenerated.
- **Roster:** unchanged (293). No tape and no producer digest moved. The witness is game samples, not a tape.
- **New:** `fidelityFrozenPress.js`, `fidelityFrozenPress.test.js` (11), `fixtures/frozenpress-witness/` (2),
  `scripts/procgen/probe-seedling-frozen-press.mjs` (box-locked, registered in `boxLock.test.js`).
- **Rows to BANK:** the 11 rows; the witness; § 3's 2×2 (A5: 3068/3068, 5067 FROZEN → 5171 LWEIGH; defaults: 3094/3094,
  3132/3132); the class census (survey 1 row = step 126, ceremony; sweep 12: 0).
- **CI** (`JavaScript Unit Tests` at the last code-bearing head): see the planner's read. Run `41540912776` at `68a34b9e`
  was queued when this report was written (the D1 run `41534548921` at `b6f9bb11` was superseded by the push).

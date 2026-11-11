# Seedling fidelity FENCEPOST — a faded-out spinner leaves the roster on the game's read (`spinnerRemoveRead`, OFF)

Session `seedling-fidelity-fencepost`, wave 40, planner `seedling-fidelity-planning-19`. ⚖ The user's GO 2026-11-11
(*"Fire break + fencepost now (Recommended)"*).

- **Start SHA:** `4bbf15fea9` (= `origin/main` when the session began; 121 default-ON keys of 131).
- **Harness branch:** `claude/seedling-fidelity-wave-40-3b6cot`. The brief's `seedling-fidelity-fencepost` branch was
  not created: the harness pushes only to its own branch.
- **Head:** the commit that adds this report; the last code/docs head before it is `ac1abe9054`.
- **Verdicts:** W0 PASS · **D1 PASS** (key OFF, byte-identical, last key) · **D2 STOP** (key ON measured; the flip moves
  committed tapes, three producers, the acceptance md5 and hammer-owned pins, so it is NOT made).

## 1. The one thing to know first

With the key ON nothing the model STEPS changes: all 293 committed tapes replay to byte-identical observation streams.
What changes is what a reader sees between two ticks, and one reader is the solver's kill verb, which ends when the body
leaves the roster. Every spinner kill plan therefore ends one tick sooner, and the hammer's 45-tick phase turns that
tick into anything from −228 to +50 ticks on L18/L39/L40 solves. A flip is a re-record wave over the L18 tapes and a
re-sign of most of the hammer arc's L40 train pins.

## 2. W0

**The cause, in the AS3** (`vendor/seedling/src`):

- `Mobile.death` (`Mobile.as:60-71`): `alpha -= 0.1` a tick, `FP.world.remove` at `alpha <= 0`.
- `Engine.update` (`net/flashpunk/Engine.as:70-78`) is `FP._world.update(); FP._world.updateLists();`. The removal is
  processed at the END of the alpha-zero update, and `Spinner.removed()` (the persistence write) runs there.
- On the alpha-zero update itself the entity is still in every type list. `Spinner.update` swings the hammer below
  `super.update()` with no `destroy` test (`Enemies/Spinner.as:66-76`), and a block's sweep still collides with it.

`spinner.stepSpinner` sets `removePending` on the alpha-zero step and `removed` at the top of the NEXT step. Its comment
says `updateLists` runs "at the TOP of the frame"; that is equivalent for stepping and one read late for every reader
between the two ticks.

**Readers of the roster and what each does with the corpse on its extra read** (`grep -a`, non-test source):

| reader | effect of the extra read (key OFF) |
|---|---|
| `levelRun.spinnerBodiesNow` → `run.entities('spinnerBodies')` / `run.spinnerBodies` | lists the corpse, `destroy` up, alpha ≤ 0 |
| `dangerMap.spinnerDanger` (live arm) | prices the corpse at horizon 0 for one observation. ⚠ It also pairs roster bodies with forecast rows BY INDEX (`ahead?.[i]`): with the corpse in the roster and absent from the forecast row, every body listed after it reads another body's rect. Read from the code, not measured; see residue 1 |
| `dangerMap.spinnersTheRunSteps` (static arm, `spinnerRosterGone`) | the corpse counts as "in the roster", so its placement is skipped one read longer |
| `solverBot` kill verb (`execKillByPress*`, the END test `spinnerBodies.some(id)`), `derivePressKill`'s `liveById`, the fight cursor | the kill ends one tick later; a strike can be scheduled against a body that is gone |
| `levelRun.spinnerPressBodiesNow` / `spinnerFireBodiesNow` (press and fire censuses) | the corpse is a live press target for one read |
| `levelRun.spinnerDeaths`, `spinnerWrites`, `spinnerKillLockOpens` | the write lands one read after the game's flag |
| skins and sound (`seedlingEnemySkin`, `seedlingEffectSkin`, `seedlingSoundCues`, `watchArt`, `watchOverlays`, `watchViewer`) | one more frame of a body at alpha ≤ 0 (invisible) |
| in-tick users ABOVE the spinner step (wand shots, blasts, bombs' `spinnerRects`) | see the corpse on the tick after; `hitSpinner` returns a destroyed body unchanged, so no state moves |
| the hammer's forecasts (`spinnerForecast`, `spinnerForecastWithPress`, the fight forecast) | they step their OWN copies with `stepSpinner` and read rows in-tick; not changed here |

**Which rooms and artefacts cross a spinner death.** Four levels hold a spinner: L18, L39, L40, L92 (the `.oel` grep
and `census-seedling-committed-rooms.mjs`). `evidence/tools/tape-death-census.mjs` replays every committed tape:
**14 of 293 cross a spinner death, with 25 corpse reads** (`evidence/tape-death-census-base.txt`): seven L18 hammer/F1c
tapes, `r8-d2`, `r8-solve-18`, `r9-solve-18`, `r8-l18-spinner-press`, `l40button-l42-part0` (L40), `r5-shaft-control`
(L39), `r5-feather` (L92, a pit death). Survey steps in spinner rooms at this base: 27 (L18), 65/95/136/149 (L39),
66/96/98/137/150 (L40), 86 (L92). Sweep legs: 56 at this base (L18 3, L39 3, L40 48, L92 2;
`evidence/spinner-room-keys.txt`).

**Banks at the base** (`evidence/identity-base-off.txt`): maze `57e07d21…`, acceptance batch
`abb206c88de25e7ba1874510d493ce85` (= main's), the six producer `--check`s exit 0, generated set OK, reference "ALL 7
GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH". Bounded vitest BEFORE: 115 files, 2755 passed, 0 failed.

## 3. D1 — `spinnerRemoveRead` (OFF, byte-identical)

**Change** (`levelRun.js`, `contactFidelity.js`, `solverEnvChannel.js`; `spinner.js` untouched):

- `advance`'s body is one arrow; below it `settleSpinnerRemovalsNow()` is the tick's `updateLists()`. With the key ON a
  `removePending` body of the state this tick stepped becomes `removed`, after the contact, the block sweep and
  everything else that tick reads.
- The removal's write loop (the flag, `spinnerWrites`, `assertSpinnerRemovalIsDeclared`'s kill-lock declaration) is one
  arrow, `bankSpinnerRemovals`, with two callers: in place under `stepSpinners` (as before) and the settle (ON). The
  stamped values are the same either way, because `ticksCompleted` has already moved when the settle runs.
- Not on a tick that left the level: OFF never wrote that removal either (residue 3).
- No new per-visit map. `spinnersSteppedThisTick` is a one-tick transient (null between ticks); `spinnerStates` is
  already in `stateDigestParts`' `visit`. No `DIGEST_EXEMPT` row is owed; `levelRunStateDigest.test.js` is green.
- Key appended LAST with its doc block; `SEEDLING_SPINNER_REMOVE_READ=0|1`, in `SOLVER_ENV_NAMES`.

**⚠ The first cut was wrong, and the brief's warning was the reason.** It flipped the body at the tick's end and left
the write on the next tick. `solve-seedling-r8-l18 --check` with the key ON then threw *"every counted body is dead and
the run's own kill-lock ledger (`spinnerKillLockOpens`) recorded NOTHING"*: the kill verb ends on the roster and asks
the ledger on the same read (`evidence/producers-on-first-cut.txt`). Roster and ledger now move together.

**Rows** (`fidelityFencepost.test.js`, 10, written and predicted before the change; all passed on first run except the
source-shape regex, which I had to adjust for a line I added):

- OFF: the named fencepost is exactly t1278; readout `{destroyAt 1267, lastListed 1278, goneAt 1279}`.
- **ON: ZERO fencepost ticks on the D0 game witness**; `bad = []` over all 121 ticks; the readout equals the game's
  `{1267, 1277, 1278}`.
- At t1278 OFF lists the corpse (alpha ≤ 0) and `spinnerDanger(…, 0)` prices it; ON neither. No other row differs.
- At t1277 and t1279, ON equals OFF byte for byte, `stateDigest` included.
- ONE CLOCK: the tape's stream md5, `spinnerWrites`, `spinnerKillLockOpens`, `spinnerDeaths` and the end digest are
  identical ON and OFF; the write's row is t1279 in both.
- L18 (`f1c-l18-lock-removal`): corpse reads `[169, 316]` → `[]`; last listed 169/316 → 168/315; ledgers equal.
- Roster and ledger read by read (t314–318): OFF drops the body and writes the ledger at 317; ON both at 316.
- L92 pit death (`r5-feather`): the same one read.
- Source shape: one settle call, below the body's arrow; `spinner.js` has no reference to the key.

`fidelityL39Phantom.test.js`'s default-arm row still pins `[1278]` (the key is OFF). It reds with the key ON, as it was
written to; a flip re-pins it to `[]`.

**Mutants** (copy + restore, both files `cmp`-restored):

| mutant | predicted | measured |
|---|---|---|
| M1 the key gate dropped from the settle | the OFF fencepost row and L39PHANTOM's default row | those two + 4 more rows red |
| M2 the settle moved to the top of `advance` | "ON: zero fencepost ticks" + source shape | those two + 4 more rows red |
| M3 the settle flips and does not run the write loop | the roster/ledger row | that row + source shape red |
| M4 `stepSpinner` removes on the alpha-zero step | source shape + `spinner.test.js` | ⚠ source shape did NOT red; `spinner.test.js` and 6 other rows did |
| M5 the settle's write stamps `t` a tick early | ONE CLOCK | ONE CLOCK + the L18 and L92 rows red |

**Byte-inertia (key OFF):** identity block at the head equals the base line for line (`diff` empty:
`evidence/identity-{base,head}-off.txt`), acceptance md5 `abb206c88de25e7ba1874510d493ce85`. Bounded vitest OFF at the
head: 120 files, 2858 passed, 0 failed. CI `JavaScript Unit Tests` at `eef7fd8da6` and at `ac1abe9054`: 26857 passed,
0 failed; slow battery 436/436. (The run at `be56ea6d2a` had 3 reds in shard 3. I could not read their names from the
log; the constants-census field row I re-keyed in the next commit is the likely cause, and the two later runs are
green.)

## 4. D2 — the key ON, measured (STOP: the flip is not made)

**4.1 Committed tapes as replays.** `evidence/tape-death-census-on.txt`: 293 stream md5s identical to OFF; corpse
reads 25 → 0; each body's last listed read is one sooner.

**4.2 Game witnesses that hold spinners.** `fidelityL39Phantom` (the only witness that records destroyed spinners to
their removal): 0 px, zero fencepost ticks ON. `fidelityL39Shaft`, `fidelityBobIframe`, `fidelityFireSpinner`,
`fidelityL40*` witness-replay rows: green ON (their folds filter `!destroy`, so they could not see the corpse either
way). The one `fidelityL39Shaft` red is a SOLVER row (below), not a witness replay.

**4.3 Producers and the acceptance batch** (`evidence/producers-on.txt`, `producer-on-*-fails.txt`):

| producer | ON | what moved |
|---|---|---|
| `r8-battery`, `r8-tail`, `r9-l3` | exit 0 | nothing |
| `r8-l18` | DRIFT | `r8-solve-18`: 467 ticks, 0 hits, `{18,0}` at 419, as committed; three input rows after the first kill start one tick sooner (174→173, 174→173, 188→187). Its trace sidecar is byte-identical |
| `r8-d2-chain` | DRIFT | `r8-d2`'s first 467 ticks are that walk (first difference tick 173) |
| `r9-campaign` | DRIFT | `r9-solve-18` **390 → 440 ticks**, 0 hits, 0 deaths; the campaign's seam clocks after it and its segment-sum rows follow |
| acceptance batch | md5 `8fb0586ea94605d4d9db7e2c43dd025a` | one row: post-shield seed 2, 232→231 (192→191 solved; 223→222 without the shield) |

**4.4 Bounded vitest ON** (`SEEDLING_SPINNER_REMOVE_READ=1`, 120 files): 2831 passed, **26 failed**, 1 skipped
(`evidence/vitest-bounded-on-fails.txt` has each message).

| file (owner) | rows | what the failing assertion shows |
|---|---|---|
| `contactFidelity.test.js` | 1 | the defaults pin (expected under an env flip) |
| `fidelityL39Phantom.test.js` | 1 | fencepost `[1278]` → `[]` (the fix) |
| `fidelityF1c.test.js` | 4 | `r9-solve-18` 390→440; residue-42 solve 477→509; two rows that expected a stall now see none |
| `fidelityL39Shaft.test.js` | 1 | the step-66 solve is 2556 ticks, the recorded tape 2740 |
| `solverSpinnerKill.test.js` | 6 | each generated-room solve one tick sooner (238→237, 490→489, 229→228, 160→159, 197→196, 193→192) |
| `solverBot.test.js` | 1 | L18 from the lock's chamber: the second kill lands at 265 (OFF 393), so the committed tape's declared clear (419) no longer fits and the single pass throws `PendingDeclaration` |
| `solveProgress.test.js` (hammer) | 4 | L18 residue 21: 367→376 and the snapshot md5s |
| `hammerApproach.test.js` (hammer) | 2 | 476→482; the witness's keys differ |
| `hammerFight.test.js` (hammer) | 1 | 476→482 |
| `hammerGhostSpinner.test.js` (hammer) | 4 | 328→320, 476→482; **two forecast-vs-run rows** (`[87]` vs `[]`): the forecast lists a body at the tick the run has dropped it — hand-over H1 |
| `hammerStrikeEtaFloor.test.js` (hammer) | 1 | L40 prefix 1629→1628 |

**4.5 Train and slow tiers, every file, one at a time, key ON** (39 files; `evidence/vitest-heavy-on.txt`; each red
file re-run OFF and green there). The slow tier is green ON (17 files). **15 of 22 train files have reds, 26 rows:**

- fidelity: `fidelityCorpseBump2` (2), `fidelityL40Latch` (1).
- hammer: `hammerBk2Combat` (3), `hammerBombPhase` (2), `hammerChooserPair` (1), `hammerClearTagChain` (2),
  `hammerEscapeExact` (2), `hammerGhostKillRung` (1), `hammerIceTurretStatic` (2), `hammerLatchWeigh` (2),
  `hammerOppPressFallback` (4), `hammerPocketBurn` (1), `hammerSouthDoor` (1), `hammerStagedHuntScanMemo` (1),
  `hammerTurretApproach` (1).
- Green ON: `fidelityL40Bk2`, `hammerApproachOrder`, `hammerKeylockTurret`, `hammerL53Killlock`, `hammerPitWest`,
  `hammerSpinnerPress`, `seedlingGenCapacity`, and the 17 slow files.

All 15 red files pin L40 solves. I read the failure of ONE of them (`hammerBombPhase`, leg 376 at phase 23): with the
key ON the plain 640-budget solve SUCCEEDS where the default refuses, and the hammer's ON arm still solves hitless but
no longer needs its 4-tick wait. ⚠ I did not read the other 14 files' failures, so **their verdicts and hit counts with
the key ON are not measured here.** That is the gap the CI sweep below has to close before any licence.

**4.6 Local survey, the 11 spinner-room steps, ON vs OFF** (`evidence/survey-spinner-rooms-ab.txt`, `-off.json`,
`-on.json`). No other step can move: with no spinner in the room the tick steps no spinner state and the settle
returns at once.

| step | level | OFF | ON |
|---|---|---|---|
| 27 | L18 | SOLVED 467, 0 hits | SOLVED 467, 0 hits (inputs shift) |
| 65 | L39 | SOLVED 2740, 0 hits | SOLVED 2556, 0 hits |
| 95, 136 | L39 | SOLVED 2624, 0 hits | SOLVED 2422, 0 hits |
| 149 | L39 | SOLVED 2626, 0 hits | SOLVED 2398, 0 hits |
| 86 | L92 | SOLVED 395, 0 hits | identical |
| 98, 137, 150 | L40 | SOLVED 70 / 172 / 172, 0 hits | identical |
| 66, 96 | L40 | REFUSED (ladder-routed collect) | REFUSED, same kind (the text's numbers differ) |

9 SOLVED / 2 REFUSED in both arms; no verdict moves; no hit appears.

**4.7 Why D2 stops.** ⛔ The brief: no committed tape and no producer digest moves without a licence. ON moves
`r8-solve-18`, `r8-d2`, `r9-solve-18` (and the campaign clocks behind it), the acceptance md5, 26 bounded rows and 26
train rows; 35 of those 52 are hammer-owned. ⚖ And "a flip that turns a hitless leg into a hit-taking one does not ship" is
proven only for the survey's 11 steps and the two L18 producers, not for the L40 train legs.

## 5. The dispatches for the planner (I cannot dispatch)

Branch `claude/seedling-fidelity-wave-40-3b6cot` at its head.

1. **Survey A/B** — `seedling-survey.yml -f through=end -f route=full`, (A) the branch as is and (B) the same with
   `spinnerRemoveRead: true` as the default on a scratch branch (the workflow has no switch input). Expect: only steps
   27, 65, 95, 136, 149 move, the L39 four shorter, no verdict moves; 66/96's refusal text may differ in its numbers.
2. **Sweep ×2 per arm** — `seedling-divergence-sweep.yml`, ≤ 10 shards, `mode=inv`, `producer=solver`,
   `leg_budget_ms=180000`, `capture_requests=true`,
   `keys="$(cat CC/docs/cloud-reports/seedling-fidelity-fencepost-evidence/spinner-room-keys.txt)"` (56 legs, derived
   at THIS base), `contact_fidelity="$(cat …/contact-fidelity-off.txt)"` for the control and `…/contact-fidelity-on.txt`
   for ON. ⚠ Both lists are this base's 121 default-ON keys (+ the key); rebuild them at whatever base the run uses.
   Read hits per leg in both arms: this is the measurement D2 lacks for L40.
3. **`seedling-probe.yml -f battery=standard`** on the branch (key OFF: should equal main).
4. **`unittests_frontend.yml --ref claude/seedling-fidelity-wave-40-3b6cot -f train_only=true`** (key OFF: should be
   green; my local OFF re-runs covered only the 15 files that were red ON).

## 6. Hand-overs, pins, and what other arcs must wire

- **H1 → hammer arc (forecast rows vs the run's roster).** With the key ON, `hammerGhostSpinner.test.js`'s two
  "the forecast is the run's, byte for byte" rows differ at exactly the removal read (`[87]` vs `[]`). The forecasts
  cut a row with `spinnerRects(st)` right after `stepSpinners`, which is an IN-TICK read and correctly holds the body on
  its last update; the run's between-ticks roster no longer does. Either the comparison takes the forecast's row as
  "the bodies tick T's contact reads" or the forecast drops a `removePending` body from the row it publishes. Not
  edited here (⛔ hammer's).
- **Hammer-owned pins that move with the key ON, for hammer to sign, not re-pinned:** the bounded-set rows in
  `solveProgress`, `hammerApproach`, `hammerFight`, `hammerGhostSpinner`, `hammerStrikeEtaFloor` (12) and the 13 train
  files listed in 4.5 (23 rows).
- **Fidelity pins a flip owes:** `contactFidelity.test.js` (defaults), `fidelityFencepost.test.js` row 1,
  `fidelityL39Phantom` (`[1278]` → `[]`), `fidelityF1c` (4), `fidelityL39Shaft` (1), `solverSpinnerKill` (6),
  `solverBot` (1), `fidelityCorpseBump2` (2), `fidelityL40Latch` (1).
- **Re-records a flip owes (game witnesses, p4g):** `r8-solve-18`, `r8-d2`, `r9-solve-18` and its chain;
  `l39shaft-solver-step66` (2740 → 2556); the L18 hammer/F1c witnesses whose solve rows moved
  (`f1c-l18-phase42`, `hammer-b1-l18-approach40`, `hammer-c2-l18-ghostspinner`); the @ci-box standing values of the
  three producers.
- **JS arc:** nothing to wire. No signature or contract changed; no `run.*` field was renamed or reshaped (the skins
  read `spinnerBodies` and simply lose one invisible frame; `seedlingSkinRenderer`, `seedlingEnemySkin`,
  `seedlingEffectSkin` tests are green ON). `jsRuntimeTape.slow` is green ON (and OFF in CI).
- **Sibling FIREBREAK** also appends a key LAST: the eight last-key pins I re-pointed will conflict at the harvest.

## 7. What the brief got wrong (measured)

1. *"Nothing is stepped for the corpse on the extra tick, so it's a READ fencepost"* is true of the model's state, and
   still the flip is far from inert: the kill verb's END is a roster read, so every spinner kill plan moves.
2. *"`spinner.js`'s `removePending` read"* as the region: the fix is not in `spinner.js`. Removing on the alpha-zero
   step there (mutant M4) takes the body away from its last update's contact and sweep. The fix is the tick's tail in
   `levelRun.advance`.
3. *"F5 already stamps the removal LEDGER at the alpha-zero step"*: the STAMP's value is the alpha-zero tick, but the
   ledger ROW was pushed a tick later. Moving the roster without the row broke L18 (section 3).
4. The game's removal is at the END of the update (`Engine.update`), not at the top of the next as `spinner.js`'s
   comment says.

## 8. Residue

1. **`dangerMap.spinnerDanger`'s index pairing** (`ahead?.[i]` against the roster's order). Whenever a removal falls
   inside the horizon the roster has one more body than the forecast row, and every body after it is paired with
   another body's rect. The key removes the horizon-0 case only. Read from the code, not measured; the L39 solves
   getting ~200 ticks shorter ON may be this, and I did not prove it. The row format is hammer's (H1's neighbour).
2. **`r9-solve-18` +50 ticks ON** (390 → 440, hitless): not traced. One tick's shift meeting the hammer phase is the
   likely cause; `fidelityF1c`'s residue rows are the instrument.
3. **A removal on the tick the player leaves the level** is never written by the model in either arm (the room's next
   tick never comes); the game writes it (`updateLists` runs before `checkWorld`). No committed tape does this.
4. **The pushable blocks have the same `removePending` shape** (`pushables.js:565, 782`). Not measured here.
5. **14 of the 15 red train files were not read** beyond their titles (4.5).
6. `spinner.js`'s "at the TOP of the frame" comment is now known to be wrong and is left as is (the file is not edited).

## 9. Deltas and records

- New: `fidelityFencepost.test.js` (10 rows, default tier, ~3 s); key `spinnerRemoveRead` (132 keys, 121 ON);
  `SEEDLING_SPINNER_REMOVE_READ` in `SOLVER_ENV_NAMES`; `evidence/tools/tape-death-census.mjs`.
- Re-pointed last-key pins (names): `contactFidelity`, `fidelityCeremony126`, `fidelityDrillWater`,
  `fidelityFireSpinner`, `fidelityFrozenPress`, `fidelityL39Phantom`, `fidelityRockFire`, `fidelityRockGone`.
- Records: solver surface `--write`/`--check` GREEN (371 rows); constants census PASS (7088 literals; one field row
  re-keyed `advance` → `bankSpinnerRemovals`, because the write loop is now inside that arrow); reference regenerated,
  `--check` ALL 7 + 5 MATCH; `seedling-bot.md` paragraph; `seedling-bot-log.md` entry.
- No tape added, no tape moved, no `standing-values --write`, no AS3/wasm/gitlink/rules edit, no new box-taking
  instrument (no `boxLock` row owed). No file of mine is `.train.`.

## 10. Rows to BANK

- `fidelityFencepost.test.js`.
- Fact: FlashPunk removes at the END of the update that called `world.remove` (`Engine.update`), and `removed()` runs
  there; the entity is in every type list for the whole of that update.
- Fact: with `spinnerRemoveRead` ON, 293/293 committed tapes replay byte-identically and hold 0 corpse reads (OFF: 25
  over 14 tapes).
- Trap candidate: a "read-only" fencepost is not inert when a verb's END condition is that read. Ask which executor
  loops terminate on the read before calling a switch byte-inert for plans.
- Trap candidate: a roster and its ledger must move on the same read; a consumer that ends on one and asks the other
  turns a one-tick gap into a throw (`execKillByPress*` → `spinnerKillLockOpens`).

# Seedling hammer-phase OPP-DASH-DEFERS: the dashless policy could not see another verb's press

Slice `seedling-hammer-opp-dash-defers` (Opus, cloud). Planner `seedling-hammer-phase-planning-7`/`-8`. ⚖ Approved by the
user 2026-11-12 ("OPP press dash defers"). Landing needs the user's SHA-bound OK through the planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `99db9a4e03` (`origin/claude/seedling-spinner-corner-tj7e4k` = main `a3a5b8182e` + `HAMMER_BODY_GATE` OFF) |
| Code commit | `55e4ecef` (the switch in `strikePolicy.js`, the env name, the 871 tool) |
| Rows commit | `2c4b8790` (5 default rows, 2 train rows, census tools, surface regenerated) |
| Head | the report commit on top of `2c4b8790` (this file, evidence) |
| Branch | `claude/seedling-opp-dash-defers-gockuc` |

No planner follow-up arrived while I worked; I followed the brief alone.

## 2. The answer first

**Switch: `OPP_DASH_DEFERS`** (`SEEDLING_OPP_DASH_DEFERS=1`, `withOppDashDefers`, in `SOLVER_ENV_NAMES`). It ships OFF.
The acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base, OFF and ON.

**The one thing to know first:** OPP is not missing a price for the dash. In a dashless pass, no body-gated press is
allowed to dash at all. The strike policy's own rule (R9 12b′/12c′, "THE OPPORTUNISTIC DASH IS RETIRED") already forbids
it. With `allowDash` false, though, that rule checks only **the policy's own** `lastPressAt`. The press kill's `PRESS`
is a different verb, so the policy cannot see it. It offered the aim, and the press landed inside `set slashing`'s
double-tap window. ON, the policy asks the run's own slash state (`slashPressForecast` at `tick + 1`), which is the same
question the `allowDash: true` arm already asks. A press that would dash is then refused by name
(`dashRefused.anyVerb`). This is option (b) of the brief, applied where the rule lives. No slide is priced.

- **Leg 871's key under the train set:** OFF refuses at work 885, as today. ON, without `HAMMER_BODY_GATE`, it
  **solves hitless**: work 2935, 1123 ticks, sha `6a59f4db8770`, 0 row mismatches on a fresh run, flags `40:0` and
  `40:12`. With `HAMMER_BODY_GATE` also ON, the plan is identical. `HAMMER_BODY_GATE` alone gives SPINNER-CORNER's 1114-t
  `b833d3f60baa`.
- **No live-body case exists in what I could measure** (§ 7). Across 68 captured requests (30 fixtures plus 38
  sweep-capture lines) and 871 under the train set, I found 5 in-window dashing presses. One is 871's, which cornered on
  a corpse. The other four are walk or dwell presses in hitless plans. None hit, and none cornered on a live body. The
  change is still the smallest correct one, because it makes true what the policy's own docblock already claims.

## 3. The reproduction (measured)

**871's branch tape** (`fixtures/hammer-spinner-corner/leg871-branch724.json.gz`, 724 keys). I asked a fresh
`strikePolicyFor(run, {dashMode: 'none'})` with the run's slash state on every tick of the tape (now the default row
`hammerOppDashDefers.test.js`):

| key index | press | slash state before | speed (px/tick) |
|---|---|---|---|
| 718 | the kill's press on `spinner@880,848` (its third hit) | `slashTimer` 20 after | 0.80 → 0.55, plain swing |
| 721 | (no press) OPP's drive asks: **OFF aims `bob@736,800`**, ON refuses (`anyVerb`) | `slashTimer` 18 | — |
| 722 | OPP's press | `slashTimer` 17, `slashing` true | **0.80 → 2.55, `slashDashed` true** |

On the whole tape, the fresh policy's OFF aims fall into two groups:

- 8 aims fall on ticks whose press would be a plain swing. ON gives the same aim on every one of them, row for row.
  These are the default row's control.
- 20 aims fall on ticks whose press would dash. ON refuses every one of them.

The branch has 8 presses, and only one of them dashed: OPP's, 4 ticks after the kill's.

**At the drive** (`tools/leg871.mjs`, the solve under the train set, OFF): the policy met 3 in-window asks, and the drive
took one of them, the aim at t721 on `bob@736,800`. SPINNER-CORNER § 3 measured the rest: the dash slid the player onto
the corpse, and at t724 all 9 key sets were blocked by its body. ON makes 13 in-window refusals over the solve, and the
search finds its plan.

**Why OFF misses it** (`strikePolicy.js`, `decide`). `forecast` is built only `(slash && allowDash)`. With `allowDash`
false, the dash test falls back to `lastPressAt !== null && (tick + 1) - lastPressAt < ORDINARY_SWING_PERIOD`, where
`lastPressAt` is set only by this policy's own press. Each drive or walk builds a fresh policy
(`strikePolicyFor`), so the press kill's `PRESS`, a dwell's press or a previous walk's press never reaches it.

## 4. Design, change, OFF identity

**Design (stated before the code).** Option (b), defer, placed in the strike policy, not the press kill. The rule that a
dashless policy may not dash already exists there, and every body-gated press goes through it: the press kill's OPP
drive, `previewWalk` (7091), the walk drives and dwells in `botDriverV2`. Each of these already passes `decide` a slash
state: the drive passes the run's `slashInfo`, and the preview passes its own threaded state. So ⚖ 30(c) holds with no
new plumbing. The decision is generic and comes from the run's own dash rule (`slashPressForecast` → `set slashing`).
It uses no level, coordinate or constant beyond `ORDINARY_SWING_PERIOD`, which the rule already used.

**Change** (`strikePolicy.js`, plus one name in `solverEnvChannel.js`; `solverBot.js` untouched):

- `OPP_DASH_DEFERS {enabled}`, `OPP_DASH_DEFERS_COUNTS {asked, inWindow, deferred}` (counted OFF and ON),
  `OPP_DASH_DEFERS_TRACE {sink}`, `withOppDashDefers`.
- `pressDashesByRunSlash(slash, state, tick, chosen)`. This asks `slashPressForecast(slash, {tick, ticksAhead: 1,
  direction})` when a body was chosen and a slash state was supplied. It returns `{why}` only ON and only for an outcome
  of `dash`.
- **One call site** in `decide`. It is asked only where the existing rule found nothing (no `forecast`, and the policy's
  own press not in the window). `wouldDash = ownWouldDash || anyVerb !== null`. The refusal row gains
  `anyVerb: true` and its own `why`. The scan's rect stays the plain swing's, because a refused press swings no rect.
- **Thread:** the solve worker. `decide` runs inside `solveSegment`, `previewWalk` and the `botDriverV2` drives, which
  are all in the worker. No main-thread mapper reads the switch, and `?seedlingSolverEnv=SEEDLING_OPP_DASH_DEFERS=1`
  reaches it.

| OFF identity | Value |
|---|---|
| Acceptance md5 at base `99db9a4e03` (its `strikePolicy.js` + `solverEnvChannel.js` restored, measured) | `391322d681b7aa0229d94b3f6906d024` |
| Acceptance md5 at `55e4ecef`, OFF | `391322d681b7aa0229d94b3f6906d024` |
| Acceptance md5 at `55e4ecef`, `SEEDLING_OPP_DASH_DEFERS=1` | `391322d681b7aa0229d94b3f6906d024` |

## 5. Rows and bounded vitest runs

| File (tier) | Rows | Result |
|---|---|---|
| `hammerOppDashDefers.test.js` (default) | the switch (OFF, env name, the wrapper restores on throw). On 871's branch tape: the one dashing press is OPP's, inside 20 ticks of the kill's undashed press, with speed up by more than 1.5. OFF aims on every in-window tick and ON refuses each (`anyVerb`, the OFF target in `inReach`). **Control:** every plain-swing aim is the same OFF and ON. The instrument counts both arms and ON refuses exactly what it counted | **5 / 5**, 0.46 s |
| `hammerOppDashDefers.train.test.js` (train) | 871's key, OFF: refused at work 885 (`the combat ladder is EXHAUSTED`, 0 deferred). ON: `{ok, work 2935, 1123 t, deferred 13, 0 mismatches, sha 6a59f4db8770, 0 hits, 0 deaths, 40:0 40:12}`, the same plan **with and without `HAMMER_BODY_GATE`**. **Control:** 872 (`… <- in_L43_176_464 ~> …`) OFF = ON (`work 3823, 2385 t, 0c51cdb94854`, 0 in-window) | **2 / 2**, 250 s (`evidence/vitest-hammerOppDashDefers-train.txt`) |
| Bounded neighbours: `hammerOppDashDefers`, `hammerOpportunisticStrike`, `hammerOppPressFallback`, `hammerBodyGate`, `solverEnvChannel`, `dashOnlyWindow`, `dashShape`, `fidelityDash`, `hammerDashCert`, `hammerDashShape`, `hammerDashWindow`, `ulpDash` | OFF | **109 / 109**, 12 files (`evidence/vitest-bounded.txt`) |
| Bounded: every default-tier importer of `strikePolicy.js`: `solverBot`, `placedTalk`, `fidelityLapseCost`, `fidelityFrozenPress`, `fidelityCeremony126`, `fidelityStatueTalk`, `fidelityCeremonyExact`, `fidelityBulbPlacement`, `fidelityL74Leg624` | OFF | **195 / 195**, 9 files (`evidence/vitest-bounded-strikePolicy-importers.txt`) |

Producers:

- `census-seedling-solver-surface.mjs --write` (372 rows; one forecast row's `strikePolicy.js` site count went from 2 to
  3), then `--check` GREEN.
- `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match.
- `generate-docs-index.mjs --check`: current.

No doc under `docs/json/developer/procgen/` was edited, so no link-census pin is owed. Not run, per the rules:
unfiltered local vitest, `pytest`, `standing-values --write`. The suite number is CI's at the pushed SHA. The new train
file has no row in `scripts/test/train-shard-costs.json`, so it runs on the lightest shard with a warning (about 250 s
locally).

## 6. Page play / game witness

None run. I did not play the ON 871 plan (`6a59f4db8770`, 1123 t) on p4g. SPINNER-CORNER's game witness was for the
other plan (`b833d3f60baa`, under `HAMMER_BODY_GATE`). ON's plan presses no dash, its swings are plain, and it replays
row for row on a fresh run, but it is model evidence only. A p4g pass (`probe-seedling-bobiframe.mjs` with the tape
recipe in `seedling-hammer-spinner-corner-evidence/tools/leg871-tape.mjs`) is the next step if the planner wants
landing evidence. No whole-game walk was asked for, and none was run.

## 7. Census

**Captured requests**, each first request's dashless pass at the shipped defaults (OPPORTUNISTIC_STRIKE is ON there),
OFF then ON, capped at 2560 work (`tools/census.mjs`):

- **30 fixtures** (`evidence/census-fixtures-cap2560.tsv`): 27 rows are OFF = ON (verdict, work, ticks, sha). 3 plans
  change. No drive in-window aim was made by the kill's OPP at these defaults.
- **38 sweep-capture lines** under `CC/docs/cloud-reports/**/*request*.jsonl.gz` (`--jsonl`,
  `evidence/census-sweep-captures-cap2560.tsv`): 37 rows are OFF = ON, and 1 plan changes.
- **No refusal says "no step out"** in either set, OFF or ON.

Every in-window dashing press that was actually TAKEN, OFF (`tools/plancheck.mjs`, `evidence/plancheck/`; each plan
replayed on a fresh run):

| Leg (key) | set | who pressed | OFF | ON |
|---|---|---|---|---|
| `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared` | train | the kill's OPP drive, 4 t after the kill's press | **refused** (corner on the corpse, work 885) | solved hitless, 1123 t |
| `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_21` | defaults | the walk (`previewWalk` / `botDriverV2.driveStepHeld`), 11 t after a press, plan t746, 0.80 → 2.55 | clean (0 hits), 989 t | clean, 985 t, swing at t755 |
| `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_13_21` | defaults | same, plan t746 | clean, 1111 t | clean, 1112 t |
| `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_14_21` | defaults | same, plan t746 | clean, 1156 t | clean, 1168 t |
| `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest` (BOBIFRAME's 397 capture, pre-R-A5 key, seam 5247) | defaults | a dwell (`botDriverV2.runDwell`), 5 t after a press, plan t1078 | clean, 1149 t | clean, 1157 t |

Totals: OFF has **1 refused, 4 clean, 0 hits**. ON has **0 dashes, 5 clean, 0 hits** (every one deferred). The other
in-window rows (371, 377, 853, 860 at the defaults) are asks the policy met on preview or rejected branches. Their
verdicts and plans are identical OFF and ON.

**Which seed-1 divergence-sweep legs the change can move, and why.** Only a dashless pass, where a body-gated press
(OPP in a press kill, a walk's strike, a dwell's strike) would fall within `ORDINARY_SWING_PERIOD` of a press by a
**different** verb or policy. In the captures, that is the L40 spinner and bob rooms, after a press kill or a dwell. The
measured movers are the five keys above:

- 871's key, under the train set only: refused → solved.
- The three `out_pit_*` exits and the 397 Chest capture: hitless → hitless, a plan 4 ticks shorter to 12 ticks longer.

Every other captured request is byte-identical OFF and ON. I did not run a page sweep.

## 8. What the brief got wrong (measured)

1. **"OPP prices its press's landing tick but NOT the dash's momentum afterwards."** In a dashless pass, an opportunistic
   dash should not exist at all. The policy's own rule forbids it, and its docblock says *"at `allowDash: false` … the
   refusal below already forbids every press that could dash"*. That claim was false only because the fallback reads the
   policy's own `lastPressAt` (§ 3). Pricing the slide would mean certifying a press the policy already promises not to
   make. Under `allowDash: true`, `forecast` reads `slashInfo` and refuses an opportunistic dash already. I read that in
   the code; I did not measure it, since every row here is a dashless pass.
2. **"`oppDefers` is the existing pattern … OPP defers a press inside the double-tap window."** The deferral is right,
   but its home is the policy, not the press kill. 4 of the 5 dashing presses measured were not the kill's OPP drive. They
   came from a walk's strike (`previewWalk`, `botDriverV2.driveStepHeld`) and a dwell's (`botDriverV2.runDwell`), after
   another verb's press. A press-kill-local rule would have missed all four.
3. **"Against a LIVE body the same slide would still corner the player."** Not observed. No live-body corner or hit
   followed an in-window dash anywhere I could measure (§ 7). 871's corner remains the only one, and it was on a corpse.

## 9. Residue and hand-overs

- **To the planner, overlapping switches.** `HAMMER_BODY_GATE` and `OPP_DASH_DEFERS` both rescue 871's key. With both
  ON, the result is `OPP_DASH_DEFERS`'s plan (`6a59f4db8770`), because the dash never happens. The body gate's
  `holdStepOut` is then not needed for 871. The body gate is still a separate fix: it makes the guard bill only what the
  run bills, so a corpse is no longer a wall.
- **`botDriverV2` behaviour moves ON** (its walk and dwell presses go through the policy), but its file is untouched. If
  fidelity or the driver owners want the rule only at the press kill, the alternative is a filter at
  `oppStrikeOffer` in `solverBot.js`. On this census that version would move only 871.
- **The game witness for `6a59f4db8770`** (§ 6) has not been run.
- **Train-shard cost row** for `hammerOppDashDefers.train.test.js` (about 250 s locally) belongs to whoever owns
  `train-shard-costs.json`.
- **Residue:** none. The evidence tools write nothing tracked. Temporary census output went to the session scratchpad.
  The base-md5 measurement restored two tracked files with `git show` and put them back with `git checkout --`; the
  tree was clean afterwards.

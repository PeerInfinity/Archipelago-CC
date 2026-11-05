# Seedling hammer-phase OPP-FREEZE — the press kill's opportunistic strike asks the frozen-tick forecast

Session `seedling-hammer-opp-freeze` (cloud, Opus; planner `seedling-hammer-phase-planning-3`). ⚖ The user queued it
2026-11-04. I took no mid-run message from the planner; the scope is the brief's.

## 1. SHAs

- **Start** `26ed405d3f45d3cb86ebae87207035fc08a57e04` (`origin/main`).
- **Branch** `claude/seedling-opp-freeze-measure-w4xx4i`. **Head**: the last commit on the branch (this report is
  committed last). Commits: W0 `2447511f`, I `343eb883`, then D (docs + gates + this report).
- Evidence: `CC/docs/cloud-reports/seedling-hammer-opp-freeze-evidence/` (`tools/` has the instruments and their README,
  `w0/` the census, `on/` the ON arms, `gates/` the gate outputs).

## 2. The answer first

| question | answer |
|---|---|
| Does any OPP-ON solve press into a freeze from `execKillByPressOnce`'s `opp.decide`? | **No.** OPP was asked **6,577** times inside the press kill (route survey, leg 860 A5 with K+X both OFF and ON, the 11 committed sweep request fixtures). **0** of those asks were on a tick the freeze forecast marks refused; **0** `FROZEN_TICK_PRESS` throws came from the press kill |
| The fix | Landed anyway, behind **`solverBot.OPP_FREEZE_FORECAST`** (OFF; `SEEDLING_OPP_FREEZE_FORECAST=1`, `withOppFreezeForecast`, in `SOLVER_ENV_NAMES`). The call asks `oppDecideOpts(run)`: OFF the `{ slash }` it always built, ON `strikeDecideOpts(run)` (`slash` unchanged) |
| ON vs OFF on measured solves | **Identical** on every solve that reaches the call: 860 ×2, legs 371/853, survey steps 66/94 (answers, work, counts, messages) |
| The gap closed by test | A constructed row on fidelity's L40 freeze tape: OFF, the owed press on t52 (the contact tick) → `FROZEN_TICK_PRESS`; ON, the policy stands down t52..t65, re-aims t66, presses t67 |
| Hammer switch, or ride `frozenPressForecast`? | **Recommend riding `frozenPressForecast`**: at the harvest, replace `oppDecideOpts(run)` with `strikeDecideOpts(run)` and delete the switch (§ 5.4) |

**The one thing to know first:** the gap is real in the code but empty on every solve measured. With `OPPORTUNISTIC_STRIKE` ON, the press kill never asks OPP while the player is frozen, so the change moves nothing that was measured. Its only measured effect is the constructed row.

## 3. W0 — measure first

**The instrument** (`evidence/tools/hook.mjs`, its README): a `NODE_OPTIONS=--import` hook. It reaches the survey's
per-step child processes. It uses a ONE-LINE scratch patch directly after the call,
`globalThis.__OPPF_W0?.(run, d, offered);`, which was applied for W0 and reverted before any commit (`git checkout`; W0's
commit has no source change). On every OPP ask it reads `run.progress('freezeForecast')`, a pure read: the 860 arms
reproduce the frozenpress report's 3068 and 5171 exactly with the hook in. It logs the asks on a refused tick, and the
decisions taken there with their stacks. Separately, it logs every `FROZEN_TICK_PRESS` error with its stack and whether
`execKillByPressOnce` is on that stack.

| source (OPP ON, base `26ed405d3f`) | verdicts | OPP asks in the press kill | asks on a refused tick | `FROZEN_TICK_PRESS` (from the press kill) |
|---|---|---|---|---|
| route survey `--through=end --route=full`, 236 steps, 3 shards (`w0/survey-on-verdicts.txt`) | 202 SOLVED / 34 REFUSED | 1,530 (two children, 765 each; by shard, L40 steps 66 and 94, which share the (488,904) boot) | **0** | 1 (**0**): step 126's pickup ceremony, *"a sword press at tick 43 would fire its rect on a FROZEN tick (a pickup ceremony)"*, stack `drive` ← `walkToUnder` ← `walkTo` ← `solveSegmentUnder`, which is fidelity's known residue and not this call |
| leg 860 A5 (`leg860s.mjs`: CPAIR-3, ICEST, OPP, LWEIGH, `orbitFreeAim`, `strategyBoundDistinct`; seam 5950, budget 10240), K+X OFF | REFUSED 3068 (`spinner@816,848` press-kill corner, HAMMER_PHASE_RUNG) | 3,073 | **0** | 0 |
| leg 860 A5, K+X ON (`SEEDLING_PRESS_ESCAPE_EXACT=1 SEEDLING_FORECAST_SHIELD_BUMP=1`) | REFUSED 5171, the LWEIGH volley-approach refusal (`FROZEN_PRESS_COUNTS` 14 stood down, 1 dropped: the walk's sites) | 1,826 | **0** | 0 |
| 11 committed sweep request fixtures (`w0/legs-on.jsonl`: legs 149, 160, 775, 371, 105, 127, 356, 367, 853, 108, 637) | 9 SOLVED; 371 and 853 REFUSED (the combat ladder) | 2,148 (371: 444, 853: 1,704; the other nine never reach the press kill with OPP) | **0** | 0 |
| **total** | | **6,577** | **0** | **0** |

So no case was found: the census came back empty, with stacks for the one throw that does occur (not this call).

⚠ **Not measured:** the 59 captured L40 sweep requests (OPP's own census) are CI artifacts that were never committed, and
a cloud session cannot dispatch the sweep (403). The committed fixtures stand in for them. § 7 names the dispatch.

## 4. M — the design

| choice | taken | why |
|---|---|---|
| where the options come from | `oppDecideOpts(run)` in `solverBot.js`, directly above `execKillByPressOnce` | the brief's one line, plus a switch. `solverBot` already imports `strikeDecideOpts`. `pressKillCost.js` (OPP's own switch file) is in `levelRun.js`'s import closure, so an import from `strikePolicy.js` there would widen that closure |
| ON options | exactly `strikeDecideOpts(run)` | `slash` is what `strikeDecideOpts` gives (the same `run.progress('slashInfo')`). `freeze` is added only while fidelity's `frozenPressForecast` is ON, so this switch never adds a forecast that fidelity's key withholds (row 3 pins both fidelity arms) |
| OFF | `{ slash: run.progress('slashInfo') }`, the object the call built before | byte-identical |
| read where | only inside the call's own guard (`opp !== null`, i.e. `OPPORTUNISTIC_STRIKE` ON) | OPP OFF never reads the switch |
| gate | none needed | walk strikes (`strikePolicyFor`, OPP, AXIS) are deliberately not under `kill` (brief). No new arm or rung; `strategySwitch.test.js` green |
| the kill's own spinner press on a frozen tick | not touched | out of scope (the kill's rungs). W0 saw 0 `FROZEN_TICK_PRESS` from the press kill of any origin, so nothing to hand over |

**Scratch measurement** (`tools/probe-construct.mjs`): the constructed case before any edit. OFF options
`51:aim 52:press:R` → `FROZEN_TICK_PRESS` (*"a `primary` press at tick 52 lands on a FROZEN tick (frozenTimer 14 …)"*).
Forecast options: `51:aim`, `52..65:none:R`, `66:aim`, `67:press`, no throw.

## 5. I — the switch, the rows, the mutants, the radius

### 5.1 The edit (`343eb883`), lines touched

- `frontend/modules/seedlingDemo/solverBot.js`: a new block directly above `function execKillByPressOnce` (`OPP_FREEZE_FORECAST`,
  `OPP_FREEZE_FORECAST_DEFAULT`, `withOppFreezeForecast`, `oppDecideOpts`; lines 19089–19119 at the head), and the
  call (line 19648: one comment line and `opp.decide(…, oppDecideOpts(run))`). Nothing else in the file.
- `frontend/modules/seedlingDemo/solverEnvChannel.js`: `SEEDLING_OPP_FREEZE_FORECAST` in `SOLVER_ENV_NAMES` (sorted after
  `SEEDLING_OPPORTUNISTIC_STRIKE`; the line re-wrapped at 120).
- Untouched: `strikePolicy.js`, every fidelity file, `levelRun.js`, `botDriverV*.js`, `strategySwitch.js`, generators.

### 5.2 Rows — `hammerOppFreeze.test.js` (5)

1. ships OFF (skipped when the env sets it);
2. the env name is in `SOLVER_ENV_NAMES`;
3. `oppDecideOpts` OFF = `{ slash }` with fidelity's key ON and OFF; ON = `strikeDecideOpts(run)`: `{ slash, freeze }`
   with fidelity ON, `{ slash }` with fidelity OFF;
4. **the constructed frozen tick**: fidelity's L40 freeze tape (`fidelityFrozenPress.frozenPressModelTape`, read only),
   driven to t51 on a real run (`createRunForStaging`). A policy aims at a body above the player and owes the press on
   t52, the volley's contact tick, and every decision's keys are what the run advances by. OFF: `FROZEN_TICK_PRESS`
   from `levelRun.advance`. ON: no throw; t52..t65 `none`, t66 aim, t67 press;
5. the source: `execKillByPressOnce` has exactly one `opp.decide(…)` call, it passes `oppDecideOpts(run)`, and the
   function no longer spells `{ slash: run.progress('slashInfo') }`.

⚠ Row 4 asks the policy with the call's own options builder on a real frozen run. It does not drive
`execKillByPressOnce` itself: no measured or constructible press kill was found that is asked during a freeze (§ 3).
Row 5 ties the builder to the call.

### 5.3 Mutants (predicted, then copied and restored)

| mutant | predicted | measured |
|---|---|---|
| M1 `oppDecideOpts` ignores the switch (always `{ slash }`) | rows 3 and 4 red | **2 red** (3, 4) ✓ |
| M2 the call site reverted to `{ slash: run.progress('slashInfo') }` | row 5 red | **1 red** (5) ✓ |

### 5.4 The ON radius, by mover class

| class | movers ON |
|---|---|
| OPP OFF (every default build, every pin that does not set OPP) | **none possible**: the switch is read only inside OPP's guard |
| OPP ON, the solves that reach the call (860 ×2, legs 371 / 853, survey steps 66 / 94; `on/`) | **0**: identical answers, work, OPP counts, `FROZEN_PRESS_COUNTS`, messages |
| OPP ON, the rest of the survey and fixtures | **0** by construction (they never ask OPP in the press kill) |
| OPP ON, a press kill asked inside an ice-blast freeze | stands down (row 4); none measured |

**⚖ Switch or `frozenPressForecast`? Recommendation: ride fidelity's key.** At the harvest, the call becomes
`opp.decide(…, strikeDecideOpts(run))` and `OPP_FREEZE_FORECAST` is deleted.
- The six other run-side sites already ask `strikeDecideOpts` with no switch of their own. The FROZENPRESS report lists this
  call as the one site it did not wire. Fidelity's key is the contract ("every run-side decide asks the forecast").
- A hammer switch can only narrow that contract. ON, `oppDecideOpts` is `strikeDecideOpts` exactly; OFF, it opts the press
  kill out of every option a later slice adds to `strikeDecideOpts`. That is the trap this slice closes.
- Riding the key moves nothing measured: OPP is OFF by default, and with OPP ON, ON = OFF on every solve that reaches the call.
- The switch ships here because the brief asks for it, and because a flip with an empty radius is the user's call, not mine.
  Riding the key needs the planner's sign-off; fidelity's files do not change either way.

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), 20 files (`gates/bounded-files.txt`: every fast test naming `OPPORTUNISTIC_STRIKE`, `withOpportunisticStrike`, `execKillByPress`, `strikeDecideOpts`, `SOLVER_ENV_NAMES`, + `strategySwitch`, `solverEnvChannel`, `contentIdentity`, `entityBlocks`, `boxLock`, `boxLockCommit`) | OFF **20/20 files, 253/253** (`gates/bounded-off.txt`); switch ON **20/20, 252 + 1 skipped** (the ships-OFF row, skipped by its own env guard; `gates/bounded-on.txt`) |
| hammer `.slow` (`vitest.slow.config.js`, the 4 `hammer*.slow` files) | **4/4 files, 8/8** (`gates/slow-hammer.txt`) |
| `.train` files the change reaches (the train files that turn OPP ON) | `vitest.train.config.js` `hammerGhostKillRung`, `hammerSpinnerPress` (both set OPP), `hammerLatchWeigh` (the 860 latch chain): **3/3 files, 11/11** (`gates/train.txt`). The planner's train-tier dispatch is still owed at the tip |
| `ci-producer-checks --jobs=4` | defaults: **97 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, browser; `gates/producers-off-clean.txt`). The first defaults run flagged only `(battery) TREE-MOVED` because I wrote this report draft during it; every producer exited 0 (`gates/producers-off.txt`). Switch ON: **97 run, 0 red**, 1 skipped (`gates/producers-on.txt`) |
| identity block (`identity-block.sh`, this tree, served on :8000) | **base = head OFF = head ON on every row** (the base was measured on this tree with my two code files at `26ed405d3f`): maze `57e07d21`, acceptance `abb206c8`, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8` (all exit 0). Its `reference` line read *"2 GENERATED MODULE(S)/REGION(S) DIFFER"* in all three runs: the docs index was behind my uncommitted doc edits, regenerated below |
| `census-seedling-solver-surface --check` | GREEN, 371 rows (no `--write` needed) |
| `census-seedling-constants --check` | PASS (7061 literals, 0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (the docs index counts); ALL CHECKS PASSED |
| `generate-docs-index --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless | **ALL PASS**, exit 0 (the r9 campaign ship, 30 windows; `gates/wasm-ship.txt`) |
| `solverEnvChannel.test.js`, `strategySwitch.test.js` | green (in the bounded set) |
| JSUT (CI) | run **`41964327210`** at `3da6938d` (code = the head; only this report follows it, and `CC/docs/**` does not trigger the workflow): **success**, suite 1135 files / **25516 passed**, 0 skipped, 0 failed; **slow battery 35 files / 372 passed, 0 failed** (`ci-summary.mjs --run=41964327210`). The earlier run `41959131978` (at `343eb883`) was cancelled when the next push superseded it |

## 7. What the harvest A/B should expect, and the dispatches

- **OFF: no movers.** The switch is read only under `OPPORTUNISTIC_STRIKE` (OFF), and the call's OFF options are the old object.
- **ON (OPP ON both arms): expect 0 movers**, per § 3 and § 5.4.
- **The ON sweep** (`seedling-divergence-sweep.yml`), two arms on the same SHA:
  - A: `solver_env=SEEDLING_OPPORTUNISTIC_STRIKE=1`, `capture_requests=true`
  - B: `solver_env=SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_OPP_FREEZE_FORECAST=1`, `capture_requests=true`
  - `keys`: the 52 L40 keys (OPP's census set; re-derive at the harvest SHA with `seedling-divergence-legs.mjs`, as
    FROZENPRESS § 6.3 says), plus 860's key. A full sweep in both arms is the stronger read if the budget allows.
  - Expect A = B leg for leg.
- **The survey**: `seedling-survey.yml` has no `solver_env` input, so an OPP-ON survey cannot be dispatched as it stands.
  The local OPP-ON survey in § 3 (202 / 34, 0 asks on a refused tick) is the read; ON = OFF on its two press-kill steps.
- **The train tier**: the planner's dispatch at the tip (§ 6 lists what I ran locally).

## 8. What the brief got wrong (measured)

- *"≈ line 19615 on main 26ed405d3f"*: correct (19615 at the base; 19648 at the head, below the new block).
- *"Census: the survey route and the sweep legs' captured requests"*: the 59 captured L40 requests are not in the tree.
  The committed request fixtures (11 + 860) were the measurable stand-in.
- *"If W0 finds cases: … a case OFF throws"*: there are no cases, so the "OFF throws" row is constructed (§ 5.2 row 4).
- The brief's ship-OFF design is sound, but the switch is redundant with fidelity's key (§ 5.4).

## 9. Residue and hand-overs

- **To the planner:** the recommendation in § 5.4 (ride `frozenPressForecast`, delete the switch) needs a sign-off.
  The sweep dispatch is in § 7.
- **To fidelity** (no action asked): step 126's ceremony press (`drive`'s strike) is the only frozen-tick press in the
  OPP-ON survey too, the same as in FROZENPRESS § 9.
- **Not covered:** the kill's own spinner aim/press on a frozen tick (`execKillByPressOnce`'s `PRESS`, its rungs:
  L95-PUNCHER's region). W0 recorded 0 `FROZEN_TICK_PRESS` from the press kill of any origin, so there is no case to hand over.
- Dev server: started on :8000 for the identity block (PID 4387), stopped by PID at the end.

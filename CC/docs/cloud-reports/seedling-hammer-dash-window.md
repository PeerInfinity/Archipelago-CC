# seedling-hammer-dash-window — the L4 dash window's margin, and the whole-chain dash under a `stand` tail

Slice DASH of the hammer phase (`seedling-hammer-dash-window`), cloud, Opus. ⚖ The user queued it on 2026-10-30, one of
four parallel hammer slices (SPIN, APPROACH, CPWIT are the others). Planner: `seedling-hammer-phase-planning-2`. No
mid-run message changed the scope. Evidence: [`seedling-hammer-dash-window-evidence/`](./seedling-hammer-dash-window-evidence/).
Log: `seedling-bot-log.md` § *Seedling hammer-phase DASH — the L4 window margin and the stand-tail dash*.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `9c0f904549` (`origin/main` at checkout) |
| Head | the commit carrying this report. Before it: W0 `a9868fee`, M `e95d97af`, I `6b65214c`, D `53d45e81`, D2 `896cb74b` |
| Branch | `claude/seedling-l4-dash-window-40c275` (the harness named it; the brief's `seedling-hammer-dash-window`) |

## 2. The answer first

**The 1-unit margin is the OFF arm's. On the shipped arm L4's margin is 46.** The window (`SOLVER_UPGRADE_WINDOW_WORK`,
85) counts what `DASH_ONLY_WINDOW` says. ON (the default since the dash flip) it counts only the full pass's `sword-dash`
asks, and L4 (16,16) → its stairs needs **39** of them (margin **46**). OFF (the off-default arm, the old whole-pass rule)
it counts every unit, and L4 needs **84** (margin **1**; it was 76 before `holdWaitPriced`). So L4 is safe as shipped.

**But the shipped arm does have legs on the edge.** Over the 870 captured page requests of sweep `38845773709`, re-solved
at this head, 529 upgrade (their full plan beats the dashless one). On the shipped arm:
- **7 sit at exactly 85** (margin 0). One is leg 108 (L12): 328 t at 85, 343 t at 84.
- 10 sit within 1 to 9 units.
- 94 already ship less than window 0 would.

The ON thresholds fall on a lattice of 4k+1 asks (a candidate start previews four prefixes), and 85 is a lattice point.

**The window decision: keep 85, and pin the margin.** No window value removes the edge, because the thresholds spread from
5 to 346. The margin pins in `hammerDashWindow.test.js` fail when the next default change crosses a stated floor: L4 ON
≥ 40, L4 OFF ≥ 1, leg 108 ON ≥ 0. Part 1 needs no code. What a bigger window would buy is priced in § 4.

**The stand-tail dash: no gain on the route, and both gains and a loss on the generated levels.** `DASH_STAND_WHOLE` (OFF)
asks `spinnerDashWhole` for a corridor that ends standing, and certifies the dashed walk together with its whole stand.
- **On the route: no gain.** I measured 60 stand-tail corridors: the route survey, the r9 campaign, the 55 spinner-room
  page requests and the L40 latch chain. Only 7 are in a room with live spinners, and ON plans the same ticks on every
  one. The survey is identical ON, 237 of 237 rows.
- **On the generated levels: two gains and one loss.** The identity block's `carved pairs c4` row moves. Three kind-pair
  solves have a collect approach beside one spinner:
  - bushy post-feather seed 9: 96 → **80 t** (the level 102 → 86);
  - loopy post-shield seed 2: 88 → 86 t;
  - winding post-feather seed 9: 199 → **204 t**, a loss.
- **Why ON can lose ticks.** `spinnerDashWhole` takes the press-blind chain whenever it certifies, and never compares it
  with the window-by-window chain. So ON is not monotone. This is the existing L40BK2 D2 rule; the switch extends it to
  stand tails.

**Flip readiness: not ready as it stands.** A flip would need all of:
- the user's ruling on the +5 t winding loss (or a keep-the-shorter arm, which costs a second scan; residue 2);
- re-recording nine trace sidecars. Their `why` text changes; every tape is byte-identical. They are r8-d2 ×3 and
  r9-solve-12, -19, -20, -29, -30 and -31;
- re-sealing `carved pairs c4`;
- re-pinning three `solveProgress.test.js` L40 kill-rung rows: one more certificate preview, with the same answer, the
  same 183 `shouldStop` units and the same 679 t.

It moves no margin pin and no window threshold: the certificate preview asks no deadline unit (L4: the same 61 units).

## 3. W0 — the base

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-l4-dash-window-40c275 origin/main` → `9c0f904549` |
| bootstrap | `session_bootstrap.sh --seedling`: done (node v22.22.0). Its pip step failed on an interactive `ModuleUpdate` prompt (EOF); the headless pip and `npm ci` passed. Eight submodules were `-`; each non-wasm one was `git submodule update --init` |
| identity block | `SEEDLING_PORT=9593 identity-block.sh .`: EXIT 0. **Every row equals LWEIGH's / ICEST's published values**: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated OK, the six producer `--check`s exit 0 (r9 campaign `be9c19c8`), reference ALL 7 + 5 MATCH (`evidence/w0/identity.txt`) |
| bounded set | 32 files (`evidence/w0/bounded-files.txt`): every test naming `planSwordDash`, `spinnerDashWhole`, the `DASH_*` switches, the window, `upgradeWindowWork`, `holdWaitPriced`, `standTailOpts`, `dashShape`, `dashOnlyWindow`, plus `fidelityLapseCost` (DF's lesson: it pins page-budget plan lengths). Run at the head in D (the change is OFF-inert; see § 6) |
| reports read | DF (`seedling-dash-flip.md`), DS (`seedling-dash-economics.md`), the window's derivation (`jsRuntimeSolver.js` § WINDOW 85 and `jsRuntimeSolverCalibration.slow.test.js`), L40LATCH's `holdWaitPriced` (`seedling-bot.md`) |
| L4 reproduced | `dashOnlyWindow.test.js`'s witness: OFF threshold **84** (83 ships the dashless 255 t), ON **39** (38 keeps the partial 235 t). `evidence/m/l4-thresholds.json` |

## 4. M — the design check

### Part 1: the window's threshold per leg
**The instrument** (`evidence/tools/thr.mjs.txt`): one captured request per fresh process, at this head.
1. The anytime loop runs unwindowed, bounded only by the budget, with a counting `shouldStop`. It reports, per pass, the
   units and the `sword-dash` asks.
2. Where the full plan beats the dashless one, the LOSS threshold per arm is bisected on real `solveAnytime` calls. The
   loss threshold is the smallest window whose shipped plan has the unwindowed plan's ticks.
3. A counted threshold ≤ 75 is used as an upper bound instead (margin ≥ 10, no solve).

**The population.** The brief named the route survey and the r9 campaign. Neither runs under the window: both drive
`twoPassSolve` / `solveSegment` with no budget, so the window cannot move them and they have no threshold. The window acts
on budgeted requests only (the page, its worker, the divergence sweep). So the population is the 870 requests DB/DF
captured (sweep `38845773709`, `gh run download`), the same set DF's 617 came from, plus L4 and the two calibration legs.

**The anchor legs** (`evidence/m/l*-thresholds.json`):

| leg | dashless → full | ON threshold (margin) | OFF threshold (margin) |
|---|---|---|---|
| L4 (16,16) → stairs | 255 → 219 t | **39 (46)** | **84 (1)** |
| L30 (240,80) → teleporter | 207 → 97 t | 21 (64) | 42 (43) |
| L40 (480,896) → stairs | 417 → 172 t | 37 (48) | 85 (0, the leg 85 was calibrated on) |

**The 870 requests** (`evidence/m/window-thresholds-table.txt`). 529 of them upgrade.

| arm | over 85 (ships less than window 0) | at 85 (margin 0) | margin 1–9 | margin 10–39 | margin ≥ 40 |
|---|---|---|---|---|---|
| ON (shipped) | 95 | **7** | 10 | 64 | 353 |
| OFF | 166 | 1 (382: the L40 calibration leg) | 17 | 68 | 277 |

- **The seven at 85 on the shipped arm:** 769 (L104), 146 (L12), 409 (L40 pit 4,22), 32 (L0), **108 (L12)**, 671 (L87)
  and 311 (L29). At 84 each ships 2 to 25 ticks more.
- **The ON thresholds fall on 4k+1**: 73, 77, 81, 85, 89, 93, 97… The dash scan previews four prefixes per candidate
  start, so the window really counts candidate starts, and 85 is one of the lattice points. The OFF thresholds are spread
  out (every unit counts).

**The window options**, on the ON arm (`evidence/m/window-options-table.txt`). Every request whose full pass asks more
than 85 dash previews with a plan in hand (138) was re-solved at each window; no other request can move. "% of savings" is
of window 0's tick savings over the dashless plans, on the 719 requests whose dashless pass answered.

| window | ticks | % of savings | short of window 0 | Δ units (the 138) |
|---|---|---|---|---|
| **85 (today)** | **107,824** | **80.3 %** | 94 | 0 (23,662) |
| 89 | 107,390 | 81.6 % | 93 | +537 |
| 97 | 107,039 | 82.7 % | 80 | +1,610 |
| 129 | 104,964 | 89.3 % | 59 | +5,105 |
| 193 | 102,837 | 96.0 % | 33 | +10,725 |
| 257 | 101,877 | 99.0 % | 15 | +14,636 |
| 353 | 101,523 | 100.1 % | 2 | +17,844 |

For comparison, the DASH FLIP's measured 70.4 % (DF, the 617) and DB's 77.6 % were taken on older trees and smaller sets.
This table is today's.

**The window is not monotone in ticks.** On 31 requests a kept partial at some window ships fewer ticks than both the
dashless plan and the unwindowed full plan, because the greedy scan accepts windows that a later window undoes. That is
why 353 shows 100.1 %. The thresholds above are measured against the unwindowed plan.

**The three designs, weighed:**
1. **Keep 85** (chosen). L4 is safe by 46 on the shipped arm. The legs at the edge are pinned by name (leg 108), so a
   default change that adds asks before leg 108's last kept window reds a row instead of silently costing 15 ticks.
2. **Re-derive one window.** 89 lifts the seven margin-0 legs to one spare start for +537 units (+2.3 % on the 138) and
   saves 434 t. 129 recovers 89 % for +22 %. Either is a value change, which the brief keeps for the user. No value
   removes the edge, because thresholds exist at every lattice point from 5 to 346.
3. **A rule not on a 1-unit edge** (a per-level margin, or a window tied to the pass). A per-level margin is a
   distribution over legs, not a property of the window: every value has legs at its edge. A window tied to the pass
   (for example, stop after K asks with no new acceptance) is a new search rule. It is not measured here; it is the
   residue's design question.

### Part 2: the whole-chain dash under a `stand` tail
**The instrument.** `DASH_STAND_WHOLE.audit` (shipped, null by default) records each corridor whose `stand` tail decided
which dash ask it got. A scratch worktree adds a patch that also plans the OTHER arm's answer for each such corridor
(`evidence/tools/audit-preload.mjs.txt`).

| population | stand-tail corridors asked a dash | in a room with live spinners | ON ≠ OFF |
|---|---|---|---|
| route survey `--through=end --route=full` (237 steps, 201 SOLVED) | 44 (35 planned) | 0 | **0** |
| r9 campaign `--check` (exit 0) | 9 | 0 | **0** |
| the 55 captured requests in spinner rooms (L18, L39, L40, L92) | 6 (legs 378, 381: L40 Totem, 5 spinners) | 6 | **0** |
| fidelity L40LATCH's latch chain (shipped defaults) | 1 (`hold stance (wandlock@480,560)`, 3 spinners, 20 → 19 t) | 1 | **0** |

Examples:
- L20's hold on `lock@32,80` (131 ticks) dashes 27 → 19 t both ways.
- L4's hold on `button@16,64` (126 ticks) dashes 43 → 27 t both ways.
- The keylock tails on L12, L19, L30 and L31 (110 ticks) all certify whole ON with the same ticks.

**Which legs would dash, and the ticks saved:** none beyond today's. Every stand-tail corridor that dashes ON already
dashes OFF, with the same ticks.

**Why:** `spinnerDashWhole` differs from the window-by-window plan only where the samples carry spinner rows that a
later window turns back. Stand tails sit at holds, keylocks and collect approaches, and the 7 in spinner rooms happen to
have no such window.

**The two designs, weighed:**
1. **Certify the dash and the stand together** (chosen). One preview of the dashed walk with `standTailOpts(stand)`, and
   `probeSamples` over walk and tail. That is the walk the drive takes, and then the wait it stands (⚖ 30(c)). It costs one
   preview and no deadline ask, so the window does not move (L4: the same 61 units).
2. **Certify the dash to the stand's start, and the stand separately.** This is unsound. A dash changes the arrival tick,
   so a stand certified from the undashed arrival is a stand at a different clock against the same chasers and spinners.
   And a stand certified from the dashed arrival is the same preview as design 1, split in two. Rejected.

## 5. I — the fix

**The switch.** `solverBot.DASH_STAND_WHOLE` (`SEEDLING_DASH_STAND_WHOLE=1`, `withDashStandWhole(enabled, fn)`), beside
the `DASH_*` switches, **OFF**. Its docblock carries the user's queueing.
- OFF, the call is the one before it: `spinnerDashWhole(wps, except)` with no tail, and `planSwordDash` with the tail.
  `spinnerDashWhole`'s new `stand` defaults to null, and null adds no option.
- ON, a corridor with a tail goes to `spinnerDashWhole(wps, except, stand)`. The certificate requires all of:
  - an untruncated walk (a `crossed` in the dwell is a dwell that left the room, trap 150, not an arrival);
  - every one of `stand.ticks` stood, or the collect tail's ceremony sample;
  - a clean `probeSamples` over the walk and the tail.

  Anything less falls back to the window-by-window plan.
- `holdWaitPriced` and `standTailOpts` are called, not changed.

**Part 1 has no switch:** it needs no code. It ships the measurement and the pins.

**Rows** (`hammerDashWindow.test.js`, 12 rows, ~15 s, fast tier):

| row | holds |
|---|---|
| the window and the arm are today's | 85, budget 640, `DASH_ONLY_WINDOW` ON |
| L4: the thresholds | ON 39 / 38 → 219 / 235 t; OFF 84 / 83 → 219 / 255 t |
| **THE MARGIN PIN: L4** | 219 t at 85 − 40 (ON) and 85 − 1 (OFF) |
| leg 108 on the shipped arm | 328 t at 85, 343 t at 84 |
| **THE MARGIN PIN: leg 108** | 328 t at 85 − 0 (ON); OFF its dashless 561 t |
| ships OFF | `DASH_STAND_WHOLE.enabled` false, `audit` null (skipped under the env) |
| OFF reproduces today | L20 560 t; both stand-tail corridors planned window by window (collect 177 → 122 t, hold 27 → 19 t) |
| ON | the same keys; each certified whole with its stand (the hold's 131 ticks; the collect's 10 to its ceremony) |
| ON under the window | L4's 126-tick hold: the same keys and the same units (23 / 61) |
| ON dashes where it should | generated bushy post-feather s9: the collect approach 96 → 80 t, certified with its 7-tick stand; the level 102 → 86 t |
| ON is not monotone | generated winding post-feather s9: 199 t OFF, 204 t ON (skeleton walk 205 → 210 t) |
| ON with no stand tail = OFF | leg 108 (audit empty both ways): key for key, unit for unit |

**Mutants** (`evidence/i/mutants.txt`, each in a scratch worktree):

| mutant | reds |
|---|---|
| m1 drop the stand from the certificate | ON (L20), ON under the window (L4), both generated rows |
| m2 shorten the certified stand by one tick | ON (L20), ON under the window (L4) (the generated tails end on their ceremony either way) |
| m3 the window 85 → 83 (across L4's OFF threshold) | the window row, both margin pins |

**The ON radius, by mover class:**

| radius | ON movers | class |
|---|---|---|
| L4, L20 | 0 in keys, ticks or units | certificate text only (the stand-tail rows' `why`) |
| route survey, 237 rows | **0** (`evidence/m/survey-off-vs-on.txt`) | — |
| r9 campaign `--check` | exit 1: 6 trace sidecars (r9-solve-12/19/20/29/30/31); every tape row PASS (`evidence/d/r9-campaign-check-on-fails.txt`) | trace text |
| bounded set ON (28 files) | 3 rows of `solveProgress.test.js` (the L40 kill rung, the Totem part at (160,640)): `previews` 34 → 35, `previewStates` +46, snapshots 390 → 391; the answer, 679 t and `shouldStop` 183 unchanged. 734 pass, 1 skipped (ships OFF) (`evidence/d/bounded-on.txt`) | cost counters |
| producer roster ON (`ci-producer-checks`) | **0** of 97. The battery's one red was `TREE-MOVED` on this report file, which I wrote mid-run (`evidence/d/producers-on.txt`) | — |
| identity block ON (`evidence/d/identity-on.txt`) | `carved pairs c4` `c9bdd11e` → `7e1497c4` (three generated solves, § 2); `r8-d2-chain --check` exit 1 (3 trace sidecars; the tapes byte-identical, `evidence/d/r8-d2-chain-check-on.txt`); `r9-campaign --check` exit 1 (above). Every other row equal | ticks (generated levels); trace text |
| tick totals (the 870 requests) | 0 (the spinner-room audit: no corridor plans different ticks) | — |

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest OFF, by path (⚖ 52) | **28 files, 738 / 738** (`evidence/d/bounded-off.txt`; the 4 `.slow` files of the set run in CI's slow battery) |
| `ci-producer-checks --jobs=4` OFF | **97 run, 0 producer red**, 1 skipped (`r7-ends-meet`, the browser arm). The battery's one red was `TREE-MOVED`: my own doc edits, made while it ran. Re-run ON on a clean tree below |
| `ci-producer-checks --jobs=4` ON | **97 run, 0 producer red**, 1 skipped; `TREE-MOVED` on this report file only (written mid-run) |
| identity block after, OFF / ON | OFF: **byte-identical to W0** (`evidence/d/identity-off.txt`). ON: the three movers in § 5. The first ON run collided with the wasm-ship check on the box lock (`identity-on-collided-with-wasm-check.txt`); it was re-run alone |
| `census-seedling-solver-surface` | `--check` RED on line moves only (215,225 bytes both ways); `--write`, then GREEN, 363 rows, no new row to classify |
| `census-seedling-constants --check` | PASS, 7,015 literals, 0 drift |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README word count, docsIndex), then ALL CHECKS PASSED |
| `quicklaunch/generate-docs-index.mjs --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, `--host=http://127.0.0.1:9593`) | ALL PASS (`evidence/d/wasm-ship.txt`) |
| **JSUT at `896cb74b`** (run `41100965849`: the code, all 12 rows; the report commit after it changes docs only) | unfiltered vitest **24,352 / 24,352**, slow battery **275 / 275** |
| JSUT at `53d45e81` (run `41093094690`, the switch and the first 10 rows) | unfiltered vitest **24,350 / 24,350**, slow battery **275 / 275**; CI's producer `--check`s, headless and browser gates green |
| not run | pytest, unfiltered local vitest (⚖ 52), `standing-values --write`, any dispatch (cloud: 403) |

## 7. What the harvest A/B should expect

- **OFF: no movers.** The switch is OFF, the call OFF is the one before it, and the rest is a test, a fixture, a census
  and docs. The identity block OFF equals W0 row for row; 97 producers are green OFF.
- **The divergence sweep with `SEEDLING_DASH_STAND_WHOLE=1`:** no tick movers expected on the route. The 55 spinner-room
  requests and the stand-tail audit say so. Traces' stand-tail rows re-word their `why`.
- **The survey A/B:** identical, as measured here (237 / 237).
- **The generated levels ON:** `carved pairs c4` moves (three solves: −16, −2 and +5 ticks on the corridor). Any census
  built on the kind pairs would show it.

## 8. What the brief got wrong

1. *"L4's whole-pass threshold is 84, the margin 1."* That is the OFF arm (`DASH_ONLY_WINDOW` off-default). On the
   shipped arm the window counts dash asks, L4 needs 39, and the margin is 46.
2. *"Measure the threshold per level on the route survey and the r9 campaign."* Neither runs under the window (no budget),
   so neither has a threshold. The window's population is the budgeted requests: the 870 captured page requests.
3. *"L20's hold walk gets a `stand` tail."* It does, and so do L4's stairs leg (a 126-tick hold), every keylock stance
   and every collect approach (`strikeIframeLapse`'s ceremony tail). L20 has no spinner, so its whole-chain ask changes
   nothing. The legs that do move are generated ones: a collect approach beside a spinner.
4. *"The DASH FLIP's 77.6 % table."* 77.6 % was DB's lab number. DF's flip measured 70.4 % on the 617. Today's number is
   80.3 % on the 870 at this head.
5. *"Measure … how many ticks they would save."* Saved ticks are not the whole story. The whole-chain rule can also COST
   ticks (winding s9 +5), because it never compares the two chains.

## 9. Residue and hand-overs

1. **The user's call on the window value.** § 4's table prices it. Keeping 85 leaves 7 legs at margin 0 on the shipped
   arm, pinned by leg 108.
2. **`DASH_STAND_WHOLE`'s flip** (§ 2):
   - the user's ruling on the +5 t loss;
   - or a "keep the shorter chain" arm. That arm would plan both chains, so it doubles the dash asks on stand-tail
     corridors in spinner rooms and moves the window's count there. It also applies to fidelity's non-stand
     `spinnerDashWhole`, which has the same non-monotone shape. That makes it fidelity's question too; the planner
     routes it.
3. **The non-monotone window** (31 requests ship fewer ticks at some window than unwindowed): the dash scan is greedy, so
   more windows can be worse. Whether `planSwordDash` should compare its kept partials is a search question for the
   planner.
4. **A window rule tied to the pass** (design 3) is unmeasured.
5. **The planner's dispatches:** the divergence sweep A/B with `SEEDLING_DASH_STAND_WHOLE=1` (expect no tick movers on
   the route), the survey A/B (measured identical here), TT.
6. **Out of scope, untouched:** the press kill and the strike policy (SPIN); `killForCorpse`, `latchWeighFirst`, the
   turret kills (APPROACH); the page worker and the chooser (CPWIT). No fidelity file, no `levelRun.js` / `dangerMap.js` /
   `botDriverV*.js` / `iceTurret.js` / `flashPanel/*` edit, no switch flip, and no pin of fidelity's to sign.
7. **Tree hygiene.** The scratch worktrees `wt` and `wt2` (under the scratchpad) and the server on :9593 (PID 1381) are
   removed / killed by name and PID at the end of the session. The captures stay in the scratchpad, not in the tree.

# Seedling hammer-phase VOLLEY-APPROACH — LWEIGH's hit approach, rewound to the range's edge and tried on forks (`VOLLEY_APPROACH`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-volley-approach` (planner `seedling-hammer-phase-planning-3`), cloud, Opus |
| Start SHA | `26ed405d3f45d3cb86ebae87207035fc08a57e04` (= `origin/main` at start) |
| Head | W0 `bfd85701`; M `5e279ace`; I `cf141a97` (the code); D `a839c668` (records, mutants, runs; the CI-measured head); this report and its gate evidence are the last commit |
| Branch | `claude/seedling-hammer-volley-8ljiuv`: the harness's designated branch. The brief's `seedling-hammer-volley-approach` name was not used |
| Switch | `solverBot.VOLLEY_APPROACH`, **OFF**. `SEEDLING_VOLLEY_APPROACH=1` / `withVolleyApproach(enabled, fn)`; its `SOLVER_ENV_NAMES` line is added |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-volley-approach-evidence/` (the scratch tools are in `tools/`) |
| Scope messages | none arrived mid-run |

## 2. The answer first

**Where does 860 A5 stop with the switch ON?** At work **7513** (OFF: 5171). It gets past t2118 hitless and refuses by
name on the weigh's own fade dwell:

> *"… -> shove stance (pushableblockfire@576,576) -> weigh (fade, corpse home): the dwell's condition (every shut
> responder in group t=2 [wandlock@448,432, wandlock@512,480] is open) is ALREADY TRUE before a tick is spent, so
> waiting for it proves nothing."*

The retry rewinds the full pass to t2035, just outside the range. APPROACH's fork search then finds the up side, via
(466,445), with a wait of 34, after 36 forks. The turret dies hitless and the corpse is bumped home. Then
`execCorpseWeigh`'s `runDwell` refuses, because both t2 locks are already open. This is not new: **OFF's dashless pass
refuses on the same wall**, because its walk into the range happened not to be hit. It is CORPSEBUMP's code
(`execCorpseWeigh`), outside this slice (§9).

**Is `PRESS_ESCAPE_EXACT` flip-ready?** **No.** With every switch of the A5 arm plus this one, 860 still does not reach
`spinner@816,848` and does not solve. The next wall is the fade dwell, then whatever comes after it. The 860 case for
retiring SPIN's stand-in (SPIN ON kills `spinner@816,848`) is no stronger than it was. The exact escape's own evidence is
unchanged (ESCAPE-EXACT § 2).

| arm (860, seam 5950, deadline 10240) | OFF | `VOLLEY_APPROACH` ON |
|---|---|---|
| A5 + `PRESS_ESCAPE_EXACT` + `forecastShieldBump` (`frozenPressForecast` ON on main) | REFUSED **5171**, t2118, LWEIGH's text (full pass); the dashless pass is not hit and refuses on the fade dwell | REFUSED **7513**, the fade dwell (both passes); retry `{from 1448, entry 2035, up, via (466,445), wait 34, forks 36}` |
| main's defaults | REFUSED 3094, `burnabletree@872,784`'s burn stance (`bobsoldier@880,832`) | **identical**, nothing asked |
| latch chain (CPAIR-3 + LWF, `turretSnapPricing` OFF) | REFUSED t917 hit (perTick 1245) | the retry `{entry 817, right, via (467,402), wait 46, forks 244}`, then the four-order bound at `pushableblock@576,560` |
| latch chain + `FIFTH_ORDER` | — | **SOLVED 4286**. Fresh replay: hits `[]`, deaths 0, turret dead on (30,26) at t1103, `wandlock@448,432` open at t1371, keyType 2 at t4286 |

**The one thing to know first:** the arm the brief called "unbuilt" was mostly built already. `TURRET_APPROACH`'s fork
search is the volley-aware approach. From 860 it could not be used, because its staging point lies south of the latched
door, and its fork routes have no ladder to open it. This slice keeps the walk that opened the door: the live stance walk
plays as OFF does, ladder and all. Only on a hit is the run rewound to the last tick outside the range, and APPROACH's
search runs from there. A wait outside the range does nothing to the turret's clock, so the lever is the in-range wait
under cover. The search already had that.

## 3. W0 — reproduction and the trace

| row | result |
|---|---|
| base | `git fetch origin main` → `26ed405d3f`; branch reset onto it; `session_bootstrap.sh --seedling` → done (node v22.23.4; its pip step reported FAILED, the headless pip OK); every non-wasm submodule initialised by hand |
| 860 A5 (`tools/leg860s.mjs` = fidelity FROZENPRESS's tool) | REFUSED **5171**, 235 s, the brief's text exactly; `FROZEN_PRESS_COUNTS` 14 stood down / 1 dropped (`860/w0-a5.json`) |
| 860 defaults (`HAMMER_DEFAULTS=1`) | REFUSED **3094**, the `bobsoldier@880,832` burn-stance ladder (`860/w0-defaults.json`): fidelity's d2hd row |
| 860 A5 + `TURRET_APPROACH` | REFUSED **1951**: staging (488,579), 12 `no-plan` forks (APPROACH's own arrival answer) (`w0-a5-ta.json`) |
| 860 A5 + TA + `APPROACH_DOOR` + `FIFTH_ORDER` | REFUSED **2557**: `buttonroom@880,768`'s hold has no reachable stance (SOUTHDOOR's arrival answer) (`w0-a5-ta-ad-5.json`) |

**The trace** (`860/w0-a5-trace.txt`). It comes from a scratch hook in the frontier, now removed. The hook replays the
reordered weigh's walk from its first tick with `rewind.replay` and steps it tick by tick. The replay ends at the live
position, with the live hit count (checked). Two weighs were traced, one per anytime pass:

- **The dashless pass** (from t1478) walks the same route about 270 ticks later. It is **not hit**: volley clock and
  path happened to clear. It refuses later, on the fade dwell.
- **The full pass** (from t1448): the walk stands on the latch, goes down and west along y 855, up x 743, west along y
  680, and up x 488 through the open south door (y 560 at t2036). The player is in range from t2041. The turret's
  `shootTimer` decrements from there: the turret was still at its ctor y 416, d 126. Volley 1 spawns at t2069 while the
  player is at (481,505), behind `pushableblockfire@480,480`. Its blasts die on that block. The walk then climbs the
  x 471 column and **stands at (471.2,456.0) from t2105 to t2112**, through the startshot that begins at t2111. Volley
  2 spawns at t2114 aimed at the player (v −2.36,5.52). The walk's own swing lands on the turret at t2117 (hits 1,
  `hitsTimer` 30), and #2.0 lands at **t2118**: frozen 14, hits 1.
- **Why the certification misses it:** the stance walk is the loop's `walkTo`. Its preview and corridor probe step no
  blast. `killForCorpse` certifies only the kill, on forks, from the stance. The one-tick `freezeForecast` reads `-0`
  before t2117's advance and `R14C` before t2118's: it names the contact on the tick it lands, too late to move a player
  who is standing still.

## 4. M — the design check (`860/m-*.json`, `latch/*.json`)

Every design starts from the same state: the full pass rewound to t2035 at (487.7,562.8), just outside the range.

| design | 860 A5 | latch chain | verdict |
|---|---|---|---|
| (1) time the approach by a wait OUTSIDE the range (w = 0 … 48 stood at the entry, then the same walk's keys replayed) | **0 / 49 hitless**: 44 hit (volley 2, 4 or 5), 4 press into a freeze (`FROZEN_TICK_PRESS`) | not run | rejected. Outside the range `IceTurret.update`'s `else` re-arms `shootTimer` every tick, so the wait moves only the room's other bodies, and the walk's own timing shifts with them |
| (2) a route that stays out of the blasts' paths: every side × route (the corridor, the two vias), wait 0 | **refused**, 12 forks: body ×2, approach hit ×5, kill refused ×2, kill hit ×3 | not run | rejected alone |
| (3) certify against the blasts on forks and pick among them: APPROACH's search (sides × routes × waits 0 … 48 at the route's first waypoint, inside the range) | **hitless**: up, via (466,445), wait 34, 36 forks; then the fade dwell (7513) | **hitless**: right, via (467,402), wait 46, 244 forks | **chosen** |
| (3) push side only | = (3) (the push side is the up side here) | — | (3) kept with every side: the latch chain needs the right side |

How (3) is reached is the design's other half:

- **Rewind**, chosen. The live walk keeps its ladder, so the south door is opened as OFF opens it. Only the in-range
  tail is searched.
- **Stage first**, measured in W0. `TURRET_APPROACH`'s staging on the push side's normal lands south of the latched
  door, and its fork routes have no ladder: 12 `no-plan` forks.

The other workloads, with the switch ON:

- **The L40 survey steps** (66, 94, 96, 135, 148), under the A5 env with LWF (`survey/a5-off.json`, `a5-on.json`):
  **0 movers**, the rows identical field for field. Steps 66 and 94 refuse at the chest stance after `weigh stance`,
  before any approach. 96, 135 and 148 are SOLVED and never reach a weigh.
- **The L40 captured requests:** not re-captured here. The capture is a browser sweep, about 30 MB, never committed by
  LWEIGH or APPROACH. 860/1 is the one measured (§7).

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, beside `TURRET_APPROACH`): `VOLLEY_APPROACH = { enabled }`
(`SEEDLING_VOLLEY_APPROACH === '1'`), `VOLLEY_APPROACH_DEFAULT = false`, `withVolleyApproach`,
`VOLLEY_APPROACH_COUNTS.retries` and `resetVolleyApproachCounts`.

**The code**, all in `solverBot.js`:

- `approachSides(run, r, dir, exempt)` and `approachForkTries(run, perTick, ctx, {…})` are moved out of
  `approachKillForCorpse` **unchanged**: the side order, and APPROACH's steps 2–3. `approachKillForCorpse` calls them.
- `volleyApproachRetry(run, perTick, resolved, ctx)` is new. It returns null, and LWEIGH's refusal stands, when:
  - the hit is not this turret's (one of its blasts, or its body);
  - there is no fork or rewind;
  - the walk starts in range, or never enters it;
  - the turret is not live at the entry.

  Otherwise it:
  1. replays the walk to the entry (the last tick farther than `attackRange + 1 + TURRET_APPROACH_STAGE_CLEAR` from the
     snapped box's centre);
  2. passes `requireVerb('kill', 'weigh:volleyApproachRetry', id)`;
  3. rewinds with `rewind.to(entry)`, selects the blade, and asks `approachSides` + `approachForkTries`.

  When no try is hitless it refuses by name: *"(⛓ VOLLEY-APPROACH, rewound to tN at (x,y), outside <turret>'s range)
  no approach … is hitless — N fork(s), {tally}"*.
- **The frontier** (the LWEIGH block of `walkToUnder`'s strategy apply):
  - `hitsBeforeStance` is now `let`;
  - `volleyFrom` (null OFF) is taken before the stance walk;
  - the executor call is `applyVerb()`, called once as before;
  - ON, and on a hit since `hitsBeforeStance`, the retry runs. A success re-runs `applyVerb()` and moves
    `hitsBeforeStance` to the entry's count. LWEIGH's guard is otherwise unchanged.
- ⚠ `approachForkTries` writes `TURRET_APPROACH_COUNTS.approaches` when the retry asks it too. That is an instrument,
  read by nothing that decides.
- `solverBot.js` lines touched: `approachSides` (new, before APPROACH's docblock); `approachKillForCorpse`'s sides and
  tail; `approachForkTries` and `volleyApproachRetry` (new, before SOUTHDOOR's docblock); the switch block after
  `resetTurretApproachCounts`; the frontier's LWEIGH block (`hitsBeforeStance` … the guard). Nothing in `iceTurret.js`,
  `strikePolicy.js`, `levelRun.js`, the OPP call in `execKillByPressOnce`, or the puncher rungs.

**The rows:**

| file | row | asserts |
|---|---|---|
| `hammerVolleyApproach.test.js` (fast, 5) | ships OFF | the default, the env, `withVolleyApproach`, `SOLVER_ENV_NAMES` |
| | the gate | `requireVerb('kill', …)` precedes `ctx.rewind.to(` and `approachForkTries(` in the function; the frontier's `volleyFrom` and retry sites, by source |
| | `C2-no-block` (the hold fallback, no turret), LWF ON | ON = OFF byte for byte; nothing asked |
| | L16 `r9-solve-16` (a block weigh), LWF ON, with a fork | ON = OFF keys and strategies; nothing asked |
| | ICEST's pocket boot (the LIVE corpse weigh, not the reorder) | SOLVED 4495; ON keys = OFF; nothing asked |
| `hammerVolleyApproach.train.test.js` (2, ~24 min) | 860 A5 (+ X + K + `frozenPressForecast`, TA OFF) | OFF: LWEIGH's t2118 text. ON: not t2118, the fade wall, more work, the one retry `{from 1448, entry 2035, approached, up, via (466,445), wait 34}`, both passes on the fade wall |
| | the latch chain, CPAIR-3 + LWF, TA OFF, `turretSnapPricing` OFF | ON alone: the four-order bound at `pushableblock@576,560`; ON + `FIFTH_ORDER`: SOLVED 4286; the retry `{entry 817, right, via (467,402), wait 46}` both times; a fresh replay with hits `[]`, deaths 0, the turret dead at t1103 on (30,26), the lock open at t1371, keyType 2 at t4286 |

**Re-pinned:** both rows of `hammerEscapeExact.slow.test.js` (`solve860Exact`) now run under `withVolleyApproach(false,
…)`. They are LWEIGH's own approach: the OFF row is the t2119 frozen press, and the sibling ON row pins the 5171
refusal. With this switch ON the sibling moves to the fade wall, and that answer is pinned in my train row rather than
in theirs. The rows' expectations are unchanged.

**The mutants** (`tools/mutants.py`; `mutants/M*.txt`). Each was applied in a scratch worktree of the I commit, its rows
run, and the file restored (md5 `85435360` before and after):

| mutant | red rows |
|---|---|
| M1 the retry never asked (`if (false && volleyFrom …`) | the latch train row (the t917 LWEIGH refusal returns) |
| M2 the entry never found (`away(f) < 0`) | the latch train row (the same) |
| M3 the turret's own blast not recognised (`${id}@` for `${id}#`) | the latch train row (the same) |
| M4 the kill gate after the rewind | the fast gate row |

The 860 train row was not run under M1–M3, to save about 15 minutes each. The latch row asserts the same retry path.

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| 860 A5 | 1 | refusal moves: 5171 (t2118 hit) → 7513 (the fade dwell), hitless past the turret |
| 860 at main's defaults | 0 | — |
| latch chain CPAIR-3 + LWF | 1 | refusal moves: t917 hit → the four-order bound; + `FIFTH_ORDER`: **SOLVED 4286** |
| ICEST's pocket boot, L16 block weigh, the hold fallback | 0 | — |
| L40 survey steps 66, 94, 96, 135, 148 (A5 env) | 0 | — |
| main's defaults anywhere | 0 by construction: `LATCH_WEIGH_FIRST` is OFF there, and the retry is only asked behind it | — |

## 6. D — gates and records

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), 10 files: `hammerVolleyApproach`, `hammerTurretApproach`, `hammerLatchWeigh`, `hammerSouthDoor`, `hammerEscapeExact` (fast), `solverEnvChannel`, `strategySwitch`, `contentIdentity`, `entityBlocks`, `boxLock` | OFF **150/150** (`bounded-off.txt`) · `SEEDLING_VOLLEY_APPROACH=1` **150/150** (`bounded-on.txt`) |
| hammer `.slow` files (`hammerBk2Combat`, `hammerDashShape`, `hammerEscapeExact` (re-pinned), `hammerEscapeGenerated`) | **4 files, 8/8** (`slow-hammer.txt`) |
| train files, run locally by path | `hammerVolleyApproach.train` **2/2** (24 min, `train-volley.txt`); in a scratch worktree of `cf141a97` (the refactored APPROACH path): `hammerTurretApproach.train` **3/3**, `hammerSouthDoor.train` **4/4**, `hammerPocketBurn.train` **4/4** (`train-hammer*.txt`). Not run: `hammerLatchWeigh.train` (its rows pin `TURRET_APPROACH` OFF and this switch is OFF by default; my latch row covers the ON path), `hammerChooserPair`, `hammerGhostKillRung`, `hammerIceTurretStatic`, `hammerSpinnerPress` (the retry is behind LWF + a hit of the reordered weigh; OFF they read one boolean) |
| `ci-producer-checks --jobs=4` | OFF **97 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, CI's browser arm) (`producers-off.txt`) · `SEEDLING_VOLLEY_APPROACH=1` **97 run, 0 red**, 1 skipped (`producers-on.txt`) |
| identity block, head vs a pristine worktree of the base `26ed405d3f` (`identity-head-off.txt`, `identity-base.txt`) | **every value row identical**: maze `57e07d21`, acceptance `abb206c8`, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0. Generated set OK (the head's in-block row was refused by the box lock the base run held; re-run alone: OK). Reference: head ALL MATCH; the base worktree's "4 differ" is the known symlinked-submodule artifact (LWEIGH § 3) |
| `census-seedling-solver-surface` | RED on site counts (`turrets` +1, `playerHits` +2, `ticksCompleted` +1, `ICE_TURRET` +1, `INVENTORY_ITEM_IDS` +4) → `--write` → **GREEN, 371 rows**, no new row to classify |
| `census-seedling-constants --check` | PASS (7061 literals, 0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README word counts, docs index) → ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (193 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS**, exit 0 (`wasm-ship.txt`; the r9 campaign window included) |
| JSUT | **run `41969052987` at `a839c668` (`ci-summary.mjs --run=41969052987`): success.** Shards 1–3 green; unfiltered vitest **25516 passed, 0 skipped, 0 failed**; **slow battery 372/372** (`jsut.txt`). The I commit's run `41964110140` was cancelled by the D push. The train tier does not run on a slice push: the planner dispatches it |
| records | `seedling-bot.md` (the switch's paragraph, before BK2COMBAT's); `seedling-bot-log.md` (`### Seedling hammer-phase VOLLEY-APPROACH — …`, two trap candidates) |

## 7. What the harvest A/B should expect, and the ON sweep

- **OFF: no movers.** OFF, the code reads one more `VOLLEY_APPROACH.enabled` (in `volleyFrom`). The executor call is
  the same call, wrapped in `applyVerb`. The moved helpers are byte-identical in behaviour. Evidence: the identity block,
  the producer roster, the fast and slow rows, and the APPROACH, SOUTHDOOR and POCKET-BURN train files, all green.
- **ON at main's defaults: no movers.** The retry sits behind `LATCH_WEIGH_FIRST`, which is OFF.
- **The page's worker** reads the switch through `SOLVER_ENV_NAMES`, so the sweep can carry it.
- **The exact ON sweep** (`seedling-divergence-sweep.yml`), on this branch:
  - **ON arm:** `keys=` 860's key (L40C's / ESCAPE-EXACT's 52 L40 keys,
    `CC/docs/cloud-reports/seedling-fidelity-shieldbump-evidence/sweep-keys-l40.txt`, for the wider run);
    `solver_env=SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_ICETURRET_STATIC_KILL=1;SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_PRESS_ESCAPE_EXACT=1;SEEDLING_VOLLEY_APPROACH=1`;
    `contact_fidelity=` the default-ON keys + `forecastShieldBump` + `orbitFreeAim` + `strategyBoundDistinct`
    (`frozenPressForecast` is ON by default); `capture_requests=true`.
  - **Control:** the same with `SEEDLING_VOLLEY_APPROACH` removed from `solver_env`.
  - **Expect:** 860 moves from LWEIGH's t2118 refusal to the fade-dwell refusal. Any leg whose reordered weigh is hit
    moves in refusal or verdict. Every other leg is identical. Read any SOLVED → REFUSED.
  - A third arm with `SEEDLING_FIFTH_ORDER=1` added shows whether the latch-chain solve (4286) appears on any captured
    leg.
- The survey A/B (`seedling-survey.yml`) has no switch input. Measured locally on its L40 steps: 0 movers.

## 8. What the brief got wrong (measured)

- *"a volley-aware approach is the unbuilt arm"*: it was built, as `TURRET_APPROACH`'s `approachKillForCorpse`, sides ×
  routes × in-range waits on forks. It was unreachable from 860, because its staging point is south of the latched door
  and its fork routes have no ladder. This slice reaches it by a rewind, not by a new search.
- Design (1), *"wait outside range until a forecast-clean window"*: outside the range the turret's clock does not run
  (`IceTurret.update`'s `else` re-arms it), so no outside wait opens a window. Measured: 0/49.
- *"ON gets past t2118 (say to which next wall)"*: it does. The next wall is not the approach's: it is the weigh's
  fade dwell, which OFF's dashless pass already meets. The anytime answer names only the full pass's refusal, so it hid
  that.
- *"`run.progress('freezeForecast')` … available to a volley-aware approach"*: available, but one tick is too short to
  steer a standing player out of a blast moving 6 px a tick. The search certifies on forks instead, and reads no
  forecast.

## 9. Residue and hand-overs

- **To CORPSEBUMP / `execCorpseWeigh` (fidelity's corpse bump):** on 860 A5, after a hitless kill and the bumps,
  `runDwell(armed(resolved.dwell), '(fade, corpse home)')` refuses because its condition, both t2 locks open, is
  already true. LWEIGH's order hands `deriveHold`'s fade dwell to a weigh whose presser is a permanent corpse. On 860
  the locks are open by the time it is asked; on ICEST's pocket boot (the live weigh) the same dwell passes. Not traced
  further. It is the 860 wall, ON and in OFF's dashless pass alike.
- **To the planner (flip readiness):** `VOLLEY_APPROACH` solves only behind CPAIR-3 + LWF (+ `FIFTH_ORDER` on the latch
  chain), all OFF. It loses nothing measured. A bundle flip (CPAIR-3 + LWF + VA + FO) would turn the latch chain
  SOLVED, and would move `hammerLatchWeigh.train`'s CPAIR-3 row (its t917 pin) unless that row pins
  `withVolleyApproach(false)`. It is not pinned here: the switch is OFF, and the row is LWEIGH's.
- **The cost:** a retry costs one replay to find the entry, one rewind, and APPROACH's forks (860: 36; latch: 244).
- **Not measured here:** the 60 L40 captured requests (§4); a game witness (no wasm probe was run; the planner's).
- **Not touched:** `iceTurret.js`, `strikePolicy.js`, `levelRun.js` (including `freezeForecastNow`), `dangerMap.js`,
  `botDriverV*.js`, `flashPanel/*`, `strategySwitch.js`, every fidelity file, the OPP call in `execKillByPressOnce`, the
  kill ladder's puncher rungs, `killForCorpse`, `execCorpseWeigh`, `deriveCorpseWeigh`, `latchWeighFirst`.
- The scratch worktrees under the session scratchpad (three mutant/train trees and the base identity tree) were removed. No scratch knob is in the committed code. The dev server on :8000 was left running for the next slice.

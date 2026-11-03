# Seedling hammer-phase BK2COMBAT — the fight on BK2's burn walk (`CHASER_STAGED_HUNT`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-bk2combat` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `31ce3077a1` (origin/main) |
| Head | W0 `2571a906`; M `eb5eb013`; I `91e76f90`; D `94f8b39d` (ledger fold, census, docs, mutants), `af74e403` (log, radius, reference), `782e5fbb` (gate evidence); this report (with the log's ON-mover bullet and the slow ON battery) is the last commit on the branch |
| Branch | `claude/bk2combat-burn-walk-ro4aau` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-bk2combat-evidence/` (`w0/`, `m/`, `radius/`, instruments under `tools/`) |
| Scope messages | none arrived mid-run |
| Leg ids | the BK2 arrivals are still **864/865** (by key: `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` and `<- in_L43_176_464`) |
| Fidelity W36 keys | not on this start SHA's defaults as far as any answer here reads them; nothing here depends on them |

## 2. The answer first

**The one thing to know first:** the burn walk has **two** fights, not one, and they fail for different reasons. (a) The
spinner press with a shaft bob still alive (`bob@736,752` kills the player inside the press of `spinner@816,848` /
`@880,848`; on the re-boot `bob@736,800` lands one hit there). The existing OFF switch `OPPORTUNISTIC_STRIKE` already
answers it. (b) `bobsoldier@880,832` in its notch. No hammer switch answered it. The new switch `CHASER_STAGED_HUNT`
does: the chaser arm walks to a cell it already certified safe to wait in, stands still until a stance prices, and
kills the BobSoldier hitless. With POCKET-BURN's five switches + OPP + this switch, leg 864 goes past the whole combat, the
latched door and the turret to the **sixth-order bound**, hitless on a fresh run. **And ON alone, at the defaults, it gains
a solve:** L40 request 390/1 (`Level 040 - Chest`, the BobSoldier's own chest), hitless and game-modelled.

| # | question | answer |
|---|---|---|
| 1 | W0: does it reproduce? | **Yes, with two walls, not one.** Defaults: 864/1 the BobSoldier (EXHAUSTED, the brief's), 865/1 **a death to `bob@736,752` inside the press of `spinner@880,848`** (t800; the brief said BobSoldier). The five switches (F): 864/1 the press death (t780, as POCKET-BURN), 865/1 now the press death too (t798; the brief said BobSoldier). Pocket-shut re-boot (F): the BobSoldier, after a non-fatal hit from `bob@736,800` inside the press (t551). Pocket-open re-boot: SOLVED 4810 hitless |
| 2 | Why does the burn walk fail where 4810 wins? | **The order the bodies are met in, and where the player stands when the BobSoldier is asked.** 4810's hold walk meets `bob@736,752` first (the chaser arm kills it from (744,776)), presses the spinner from (744,840), and asks for the BobSoldier with the player already in the corridor at (856,856): (888,856) prices, the walk's strikes kill it. The burn walk's corridor meets the spinner first (so the press runs with the bob alive), and asks for the BobSoldier from the x 744 shaft. From there the BobSoldier never comes to the cells west of it (*"still standing after the whole ceiling"* — a BobSoldier leaves its notch only when the player is close), and the cells beside it meet its blade on arrival (the wait at (888,856) is hit 37 ticks in). Not a budget (10240 changes nothing), not the burn stance's position itself (the stance is the only one; it is inside the notch either way) |
| 3 | The fix chosen | **(b): the chaser arm's own question asked again from a staging cell** (`CHASER_STAGED_HUNT`): the cells the arm refused ONLY because the body never came are staging cells. Walk to the nearest, ask on a fork after each still tick up to that cell's ceiling, drive the first tick that prices, rewind a cell that prices nothing. (a) needs no new code: OPP (OFF, hammer's) kills `bob@736,800` inside the press at t576 hitless; `PRESS_KILL_CHASERS` passes it on the requests too |
| 4 | Rejected (measured, `m/`) | a press-chasers-first order (kill the bobs whose leash covers the press cell before it): the chaser arm prices no stance for `bob@736,800` while the spinner lives (every wait is the spinner's); a still delay from the shaft (0–64 ticks): nothing prices; staging alone at (856,856): nothing prices. Fidelity's `orbitFreeAim` (OFF) also answers (b) — fidelity's key, measured only |
| 5 | Does ON pass the combat? | **Yes.** Pocket-shut re-boot (F+OPP+ON): staged at (856,856), wait 15, BobSoldier dead t883; tree burnt t957; door open t1083; all hitless on a fresh run. Leg 864/1 (dashless): bobs t740/t930, BobSoldier t1177, burnt t1261, door t1407, `wandlock@448,432` t2617, `wandlock@800,400` t5111 — **5216 ticks, hits [], deaths 0** on a fresh run of the request's staging. Leg 865/1: bobs t779/t942, BobSoldier t2114, burnt t2200, door t2346, hitless |
| 6 | What refuses next (exact text) | **864 (and 864/0, 864/1 at 10240): the sixth-order bound** — *"solverBot(wasm-location-40) apitem (656,528) contact: applied 5 strategies for one goal [shove(pushableblockfire@576,576), weigh(wandlock@448,432), burn(burnabletree@872,784), hold(wandlock@480,560), weigh(wandlock@800,400)] and the corridor still does not plan. A policy that keeps clearing obstacles without a corridor appearing is not making progress."* (the sixth order is POCKET-BURN's `shove(pushableblock@576,560)`). **865: not the bound** — the walk back from the hold to the door: *"… approach door wandlock@480,560 (488,568): the combat ladder is EXHAUSTED. The corridor passes through danger at (840.2,855.5) — spinner:spinner@880,848 …"*, the chooser handing the kill rung `bob@352,448` (no presser) while the danger is the spinner (whose press arm is never asked). The re-boot: the ice turret's approach from the door (*"no approach to iceturret@472,400 from the staging point … is hitless — 492 fork(s)"*). At the captured budget all three end on the anytime deadline |
| 7 | Does 4810 stay? | **Yes, byte for byte**: the pocket-open re-boot under F + ON solves 4810 with keys identical to OFF; the staged hunt is never asked |
| 8 | Radius | ON alone: **1 / 58** L40 requests (390/1 refusal → SOLVED 1279, hitless, modelled), **0 / 237** survey steps. Behind F+OPP: **3** requests (390/1, 864/1, 865/1: the BobSoldier's refusal → the anytime deadline at the captured budget), survey **0 / 237** (201 SOLVED both ways). **ON in fidelity's rows:** 4 rows in 2 files and 1 producer move (§5) |

## 3. W0

| row | result |
|---|---|
| base | `31ce3077a1`; bootstrap `done` (the Archipelago pip line failed, as POCKET-BURN's; not used by any Seedling gate); every non-wasm submodule initialised before the first gate; node v22.23.4 |
| legs | `seedling-divergence-legs.mjs` → 923 legs; BK2 = 864/865 |
| capture (`w0/capture-bk2.txt`) | the sweep, `--mode=inv --producer=solver --ids=864,865 --capture-requests`, :8000, defaults: both `failed`, 2 requests each. 864: *"… -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bobsoldier@880,832"*; 865: *"… -> burn stance (…) -> kill (spinner@880,848) by press: the player died at t800 (chaser bob@736,752)"* |
| node replay (`w0/bk2-*.txt`) | D0: 864/1 BobSoldier (`c99b8f361646`), 865/1 the press death (`051b04442da8`). F (LWF+TA+SD+FO+SB): 864/1 press death t780 (`29e8b2f7c64c`), 865/1 press death t798 (`d52713fbd913`), both budgets. `/0` at the captured budget: the deadline at `walk` |
| existing switches (`w0/bk2-cap-F-{OPP,PKC,OPP+OFA}.txt`, `m/bk2-w10240-*.txt`) | F+OPP and F+PKC: past the press, both legs on the BobSoldier (EXHAUSTED). F+OFA: the press death. F+OPP+OFA at 10240: the sixth-order bound on both legs (`70780dd3cd05`) |
| re-boots (`w0/south*.txt`, `-replay.txt`) | pocket open (F): SOLVED 4810, hitless. Pocket shut (F): the BobSoldier, after a hit from `bob@736,800` at t551 inside the press. Shut + OPP: hitless to the BobSoldier (`bob@736,800` killed t576). Shut + OFA: past the BobSoldier (with the t551 hit). Shut + OPP + OFA: hitless past the BobSoldier |
| the fights, named | 1. `bob@736,752` — chaser arm, killed before the press on every arm (t458 re-boot, t740 864, t779 865). 2. `spinner@816,848` (864, re-boot) / `@880,848` (865, D0) — the press kill (`execKillByPress`), during which `bob@736,800` (re-boot) or `bob@736,752` (arrivals, where it was not met first) chases. 3. `bobsoldier@880,832` — the chaser arm (no stance), the orbit arm (ccw pinned for the 420-tick bound, cw hit by the BobSoldier at orbit tick 196, or by `bob@736,800` at tick 22 when it lives), detour/forced-hit refused (the aim's own tile is inside its volume, `coveredGoalRefusal`) |

## 4. M — the design check

Workloads: the four captured BK2 requests (node, `tools/arms.mjs`, `reqrows.mjs`, `story.mjs`), the latch boot re-booted
at (488,579) with the pocket shut (the tree un-banked) and open (SOUTHDOOR's 4810), `tools/latch.mjs`, `replay.mjs`.
Instruments inside the solver were scratch env knobs, recorded as `m/scratch-knobs.diff` / `m/scratch-equips-hooks.diff`
and removed before I (`git diff` at I holds only the switch).

| design | workload | result | evidence |
|---|---|---|---|
| the BobSoldier's previews, OFF | re-boot open (asked at t684 from (856,856)) / shut (asked at t712 from (744,760)) | open: (888,856) prices (the walk's strikes land at +21, +51; dead +81). Shut: (824..856,856) *"still standing"* (the body stays at (884,847)); (872,856), (888,824/840/856) the WAIT/APPROACH hit at +220..223 | `m/hunt-open-bobsoldier.txt`, `m/hunt-shut-bobsoldier.txt` |
| press-chasers-first (scratch `SCRATCH_PCF`) | shut | the threat is `bob@736,800` (13 px off the press cell (744,776)); the chaser arm prices no stance for it: every wait is hit by the spinner | `m/southtree-scratch-pcf.txt` |
| still delay from where the arm was asked (scratch `SCRATCH_DELAY`, 4..64) | shut | nothing prices | `m/southtree-scratch-delay.txt` |
| staging at (856,856) (scratch `SCRATCH_STAGE`) | shut + OPP | nothing prices on arrival; the WAIT at (888,856) is hit at +38 | `m/southtree-OPP-scratch-stage856.txt` |
| **staging + still wait** (scratch, then the switch) | shut + OPP | prices (888,856) after 16 (scratch, step 2) / **15** (the switch, step 1); the combat passes | `m/southtree-OPP-scratch-stage856-delay.txt`, `m/southtree-F-OPP-SH.txt`, `m/southtree-SH-replay.txt` |
| the switch, without OPP | open (F) | **4810, keys identical**, never asked | `m/south-open-F-SH.txt` |
| the switch with OPP | open (F+OPP) | 5258 hitless (OPP alone 5461 hitless); one staged ask (wait 0) | `m/south-open-F-{OPP,OPPSH}.txt` |
| F+OPP+ON | 864 / 865 at 10240 | 864: the sixth-order bound (`70780dd3cd05`, = OPP+OFA's digest); 865: the spinner on the walk back to the door (`e714ce33fbf6`) | `m/bk2-w10240-F-OPP+SH.txt`, `m/story-86{4,5}-F-OPP-SH.txt` |
| F+OPP+ON | 864 / 865 at the captured budget | `/0` and `/1`: the anytime deadline (the staged asks spend the rest of the budget) | `m/bk2-cap-F-OPP+SH.txt` |

**Did any honest fix reach a forbidden file?** No. (a) is OPP's (hammer's, existing, OFF); (b) is the chaser arm's own
question (solverBot.js). Fidelity's `orbitFreeAim` answers (b) too and was only measured.

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, beside `orbitKillChaser`): `CHASER_STAGED_HUNT = { enabled }`
(`SEEDLING_CHASER_STAGED_HUNT === '1'`), `CHASER_STAGED_HUNT_DEFAULT = false`, `withChaserStagedHunt(enabled, fn)`;
the instrument `CHASER_STAGED_HUNT_COUNTS.asks` (`{id, t, cell, wait, verdict}`); `SEEDLING_CHASER_STAGED_HUNT` in
`SOLVER_ENV_NAMES`.

**The code:**
- `deriveKillByChaser`: ON, a candidate refused because the body is *"still standing after the whole ceiling"* (a walk
  and a wait with no danger) is marked, and a no-stance answer carries `waits` (`{x, y, ceiling, d}`). OFF: no field.
- The kill rung's chaser arm: `const hunt = !firstHunt.stance && firstHunt.waits?.length > 0 ? stagedChaserHunt(…) :
  firstHunt;` — after the arm's own ask, inside the chain the strategy switch's `kill` gate guards
  (`killRungArmRuns && rungGate('kill')`), so a `disable: ['kill']` solve never reaches it. It is the chaser arm's own
  question (no new arm or rung; `strategySwitch.test.js`'s source rows unchanged, 21/21).
- `stagedChaserHunt` (in `solveSegment`, beside `climbLadderUnder`): needs `fork` and `rewind`. Cells nearest the body
  first; `walkTo` the cell (a refusal or a hit there → rewind); one fork, stepped one still tick at a time up to the
  cell's ceiling, `deriveKillByChaser` asked on it each tick; the first tick that prices → the still ticks driven on the
  run (checked hitless) and the stance re-derived on the run (it must price, or rewind: `diverged`). The staged record
  rides on the chaser arm's trace row and record (`staged: {cell, wait, from}`). The anytime deadline ends the asks
  (`deadline`).
- **OFF cost:** one flag test per `still standing` rejection and one per no-stance return; `waits` absent, so the arm's
  closure is never called. Byte-identical by construction (the 4810 keys, the D0 request arm: 57 of 58 identical, the
  one mover being ON's own).

**The rows:**

| file | row | asserts |
|---|---|---|
| `hammerBk2Combat.test.js` (fast, ~3 s) | ships OFF | default false; follows the env; `withChaserStagedHunt` toggles and restores; the env name listed; counts reset |
| | where it sits | after the kill rung's `rungGate('kill')` branch and the arm's own ask; one call site; no rung opened between |
| | OFF/ON answers | the latch boot in the corridor at (784,856), pocket shut: OFF no `waits`; ON = OFF + `waits` [(824,856,115), (840,856,96), (856,856,77)] |
| `hammerBk2Combat.slow.test.js` (~9.5 min) | the arm | CPAIR enabled at size 3 |
| | shut, OPP, OFF | the burn walk's ladder EXHAUSTED on `bobsoldier@880,832`, 680 ticks, no ask |
| | shut, OPP, ON | asks `[{bobsoldier@880,832, t680, (856,856), wait 15, staged}]`; the refusal is the turret's approach from the door; the first 900 spent ticks (the combat; before the burn's slot select) on a FRESH run: hits [], deaths 0, the three walk bodies gone (⚖ 30(c)) |
| | open, no OPP, ON | SOLVED 4810, no ask; fresh run: hits [], deaths 0, keyType 2 at t4810 |

⚠ The brief's row *"864 or 865 ON gets past the combat hitless"* is not a committed row: the captured request is ~1 MB (no
cut of it stands alone), and at the captured budget the ON request ends on the deadline. The committed stand-in is the
pocket-shut re-boot (the arrivals' shape, POCKET-BURN's workload); 864/865 at 10240 are in `m/` with fresh replays.

**The mutants** (`tools/mutants.py`, `mutants.txt`; a scratch detached worktree, restored byte for byte, removed):

| mutant | red row |
|---|---|
| M1 drop the fix | shut ON: *"expected [] to deeply equal [ { id: 'bobsoldier@880,832', … } ]"* |
| M2 no still wait (ask once on arrival) | shut ON: *"expected [ …(3) ] to deeply equal [ { id: 'bobsoldier@880,832', …(4) } ]"* (three ask rows, not the one staged row) |
| M3 stage on every refused cell | the fast OFF/ON row: the `waits` list (seven, not three) |
| M4 drive one still tick short | shut ON: *"expected [ …(3) ] to deeply equal [ { id: 'bobsoldier@880,832', …(4) } ]"* (three ask rows, not the one staged row) |

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| 58 captured L40 requests, D0 → D0+ON (`radius/cmp-D0-vs-D0-SH.txt`) | **1** (390/1) | **refusal → SOLVED** (1279 ticks, hitless, game-modelled; staged (856,856), wait 8). 44 → 45 / 58 |
| 58 requests, F+OPP → F+OPP+ON (`radius/cmp-FOPP-vs-FOPP-SH.txt`) | **3** (390/1, 864/1, 865/1) | refusal text: the BobSoldier's EXHAUSTED → the anytime deadline (the staged asks spend the budget). 43/58 both ways |
| BK2 requests at 10240, F+OPP → F+OPP+ON | 4 | refusal text: the BobSoldier → the sixth-order bound (864/0, 864/1) / the spinner on the walk back (865/0, 865/1) |
| pocket-open re-boot (F) | 0 | 4810 = 4810, keys identical |
| pocket-shut re-boot (F+OPP) | 1 | refusal text: the BobSoldier → the turret's approach from the door |
| the route survey, OFF vs ON alone (`radius/survey-off-vs-on.txt`) | **0** | 201 SOLVED / 237 both ways |
| the route survey, F+OPP vs F+OPP+ON (`radius/survey-F-vs-F-SH.txt`) | **0** | 201 SOLVED / 237 both ways |
| bounded fast set OFF / ON (`bounded-{off,on}.txt`, 75 files) | OFF **0**; ON **4 rows in 2 fidelity files** | OFF 1492 passed, 1 skipped. ON: `fidelityL30KeyLock.test.js` (both-OFF and WAIT-alone rows at (224,80): refusal with 2 hits → **SOLVED 318 hitless**, staged (120,104), wait 0; WAIT alone 309 → 318 hitless) and `fidelityL40Bk2b.test.js` (the two orbit rows: the BobSoldier removed by the staged hunt at **t112 hitless** — staged (856,856), wait 17 — before the orbit arm is asked; D1's orbit removes it at t125). Class: the chaser arm answers before the orbit arm (`radius/fidelity-{l30,l40bk2b}-on.txt`) |
| producer roster OFF / ON (`producer-{off,on}.txt`) | OFF **0** red; ON **1** red | 97 run, 1 skipped. ON red: `plan-seedling-l30keylock` — its BEFORE witness (both fidelity switches OFF, (224,80)) now SOLVES hitless (the L30 mover above) |
| r9 campaign (identity block and producers) | **0** | `be9c19c8`, exit 0 |

## 6. D — the gates

__GATES__

## 7. What the harvest A/B should expect

**OFF: no movers** (every read is behind the flag; `waits` is absent OFF, so the staged hunt is never called).
**ON alone (every other default): one mover on the L40 requests** — 390/1, `level_40__r23c29 <- in_L39_144_0 ->
location:Level 040 - Chest`, refusal → SOLVED (hitless). Expect the same leg to move on the page sweep (`failed` →
`done`) if the page's budget holds the staged asks; at the captured budget the node replay solves it on `/1`.

**The ON sweep to dispatch** (cloud sessions get a 403):

```
seedling-divergence-sweep: mode inv, producer solver (the full sweep)
solver_env = SEEDLING_CHASER_STAGED_HUNT=1
```
expected: 1 mover, leg 390 (`… -> location:Level 040 - Chest`) `failed` → `done`; no other leg moves (the L30 pit
landing moves only with fidelity's `strikeIframeLapse`/`chaserOrbitKill` OFF, which is not the shipped arm; the survey's
step 52 does not move). ⚠ At a flip, the 4 fidelity rows and the one producer of §5 need `withChaserStagedHunt(false)`
pins (fidelity's files: the planner gets them signed). And the BK2 arm:

```
keys = level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2|level_40__r32c36 <- in_L43_176_464 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2
solver_env = SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_TURRET_APPROACH=1;SEEDLING_APPROACH_DOOR=1;SEEDLING_FIFTH_ORDER=1;SEEDLING_STANCE_BURN=1;SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_CHASER_STAGED_HUNT=1
upgrade_window_work = 10240   (at the page's own budget the staged asks end on the deadline)
```
with `SEEDLING_CHASER_STAGED_HUNT=1` removed as its control. Expected verdicts: both `failed`; ON 864 *"applied 5
strategies for one goal […]"*, ON 865 *"… approach door wandlock@480,560 (488,568): the combat ladder is EXHAUSTED …
spinner:spinner@880,848"*; the control both on the BobSoldier's EXHAUSTED ladder. ⚠ `upgrade_window_work` is the
nearest page knob to the node replay's lifted budget; if it does not lift the held retry's budget the ON arm reads the
deadline (that is the captured-budget answer, not a regression).

## 8. What the brief got wrong (measured)

- *"865: `bobsoldier@880,832` beside the burn's stance"* — at this main 865 dies inside the spinner press (to
  `bob@736,752`) at the defaults and under the five switches; the BobSoldier is 864's wall at the defaults, and both
  legs' once the press is passed.
- *"The fight on the burn walk"* — two fights, (a) the press with a shaft bob alive and (b) the BobSoldier; (a) is
  already answered by an existing OFF switch (OPP), so the new switch is (b)'s.
- *"After the combat, report what refuses next (the expected sixth-order bound)"* — 864: yes, the bound, word for word.
  865: no — the walk back from the hold meets `spinner@880,848` and the chooser names `bob@352,448`. The re-boot: the
  turret's approach from the door.
- *"Rows: 864 or 865 ON gets past the combat hitless"* — not committable as a request row (size, budget); the re-boot
  stands in (§5).
- The L40 capture: 43 done / 8 failed / 1 timeout (leg 864, under the box's load; its two requests captured) — 58 requests,
  as POCKET-BURN's.

## 9. Residue and hand-overs

- **To the planner (a ruling): the order bound.** Leg 864 with the combat passed stops on
  `[shove(pushableblockfire@576,576), weigh(wandlock@448,432), burn(burnabletree@872,784), hold(wandlock@480,560),
  weigh(wandlock@800,400)]` — the sixth (`shove(pushableblock@576,560)`) is the next order. POCKET-BURN's hand-over stands.
- **To a chooser slice: 865's walk back to the door.** The kill rung is handed `bob@352,448` (chooser head; no presser,
  no chaser stance) while the corridor's danger is `spinner@880,848`; the spinner's press arm is never asked.
  `CHOOSER_HIT_SOURCES` (OFF) is the nearest existing switch; not measured here.
- **To the APPROACH line: the turret from the door on the re-boot.** 492 forks, none hitless (`m/southtree-F-OPP-SH.txt`).
- **To fidelity:** `orbitFreeAim` (OFF) passes the BobSoldier on the re-boot and on 864 (`w0/southtree-F-SB-OPP+OFA.txt`,
  `m/bk2-w10240-F-OPP+OFA.txt`); nothing here depends on it, and no fidelity row was pinned.
- **The page budget:** at the captured budget the staged asks (one fork stepped up to the cell's ceiling, the arm asked
  each tick) end on the deadline for 864/865/390 behind F+OPP. A cheaper ask (only the cells beside the body) is the
  obvious next cut; not built (not measured).
- **Not touched:** the press kill and its guards, the strike policy, `orbitKillChaser`, `strategySwitch.js`, every
  fidelity file, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `iceTurret.js`, `flashPanel/*`.
- **Not committed:** the captures (2.1 MB BK2, the 52-leg L40 one) and the request-arm jsonl; the summaries are in `w0/`,
  `m/`, `radius/`. Commits during the capture used `BOX_LOCK_COMMIT_ANYWAY=1` (my own sweep's lock).

# Seedling hammer-phase APPROACH — a hitless approach into an IceTurret's range, and the latch chain's 5th order (`TURRET_APPROACH`, `FIFTH_ORDER`, both OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-turret-approach` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `9c0f904549` (origin/main, "Regenerate on main 6230ec33ac: constants census, procgen reference; L65 r4c11 in the block pin") |
| Head | W0 `26f9c9b2`; M `66f60507`; I `73dfb0a7` and `f5502a10` (the route prune); D `0a2548d3` (gates), `5229c2a3` (records), `57634cb0` (LWEIGH's slow rows pinned), `4538f926` (identity after, wasm, survey); this report is the last commit on the branch |
| Branch | `claude/seedling-hammer-turret-approach-ti09us`. This is the harness's designated branch; the brief's `seedling-hammer-turret-approach` name was not used |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-turret-approach-evidence/` (instruments under `tools/`, the design table under `m/`, the ON radius under `radius/`) |
| Scope messages | none arrived mid-run |
| L40C's report | not on main; read from `origin/claude/seedling-l40-combined-measure-xusatn` (`282f91b5`), its tools copied into `tools/` with their origin named |

## 2. The answer first

**The one thing to know first:** the approach volley was a CLOCK problem, and the wait that solves it has to be spent
**inside** the turret's range, under cover. Outside the range `IceTurret.update`'s `else` re-arms `shootTimer` every tick,
so no wait there moves anything. On the latch chain the corridor's first waypoint (488,504) sits in the range (d 80)
behind `pushableblockfire@480,480`, and a blast dies on the first `Solid` it meets. Standing there 30 ticks, then
walking to the WEST stance (467,424) and killing from there, is hitless. That is one fork try out of 376.

| # | question | answer |
|---|---|---|
| 1 | Does Boss Key 2 solve hitless from the latch staging? | **Yes.** CPAIR size 3 + `LATCH_WEIGH_FIRST` + `TURRET_APPROACH`: **SOLVED 4142 ticks**. Replayed on a fresh run of the model: `collected` keyType 2 at t4142, **hits `[]`, deaths 0**, the turret dead on (30,26) at t965, the corpse (30,26) → (30,25) → (30,24), `wandlock@448,432` open with the corpse on (30,24) (t1253), `wandlock@800,400` at t3427 (`radius/latch-A4-TAFO-replay.txt`, `m/prod-latch-on.txt`). + ICEST + OPP: the same 4142. + `orbitFreeAim` + `strategyBoundDistinct` (A5, measurement only): **SOLVED 4108, hitless** (killed from the push side via (466,445), wait 24) |
| 2 | From any L40 arrival leg (860/861 by KEY)? | **No.** Under every arm (L, A4, A5, each + TA + FO) the approach is asked at t0. Its staging walk reaches (488,579) hitless (t283 / t311), and then no route plans past the latched south door `wandlock@480,560` to any kill stance. It refuses by name after 12 forks, all `no-plan`. On the latch staging that door was opened by the walk's own ladder at t101 |
| 3 | What does the chain meet next? | **From the latch staging: nothing.** Boss Key 2 is collected. **From the arrivals: `wandlock@480,560` (the latched south door) between the approach's staging point and the turret.** The uncertified stance walk discharged it in its ladder (that is the `hold(wandlock@480,560)` order L40C's guard-off arm applied); the approach's fork routes use `planWaypoints`, which has no ladder. Behind it stand L40C's own arrival walls (`spinner@816,848` on 860's walk west, the anytime deadline on 861) |
| 4 | The designs chosen, and why | **Part 1:** all three of the brief's designs together, because each alone was measured and fails. (b) fork-certify the approach and the kill as one try (`killIceTurretOnWalk`'s shape). (a) a wait timed to the clock, spent at the route's first waypoint INSIDE the range. (c) every side of the snapped box: the push side's stance (488,445) has no hitless approach. **Part 2:** a fifth application only when it is distinct from four distinct predecessors, the narrowest of the three measured (§4). **Part 3:** the local snap (`iceTurretKillBox`) under `TURRET_APPROACH` |
| 5 | Is the 5th order needed? | **Not with the approach.** With `TURRET_APPROACH` ON the latch chain applies four orders (shove(576,576), weigh(448,432), weigh(800,400), shove(576,560)), so the bound is not met. The `hold(wandlock@480,560)` that made L40C's guard-off arm a five-order chain was the uncertified stance walk's. With LWEIGH's guard off (scratch), `FIFTH_ORDER` alone solves the latch at 4138 with the t917 hit |
| 6 | Flip readiness | **Neither switch is ready to flip by itself.** `TURRET_APPROACH` solves only behind CPAIR size 3 + `LATCH_WEIGH_FIRST`, both OFF. It loses nothing: 0 movers alone on 60 L40 requests, 0 red producers ON, bounded ON green, the pocket boot unchanged. A flip of the CPAIR-3 + LWF + TA bundle would move: the latch staging (refusal → SOLVED 4142); 4 L40 requests (860/0,1, 861/0,1) in refusal text; and `hammerLatchWeigh.slow.test.js`'s CPAIR-3 row (§5). `FIFTH_ORDER` solves nothing anywhere measured with the approach ON; it is shipped as the measured narrowest claim and should stay OFF until a workload needs it |

## 3. W0

| row | result |
|---|---|
| base | `git fetch origin main` → `9c0f904549`; branch reset onto it |
| bootstrap | `session_bootstrap.sh --seedling` → READY, node v22.22.0; every non-wasm submodule initialised |
| identity block (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, the six producer `--check`s exit 0 (r9 campaign `be9c19c8`); reference **ALL 7 MODULES AND 5 REGIONS MATCH**. Every row equals LWEIGH's and L40C's published values |
| `ci-producer-checks --jobs=4` (`producer-w0.txt`) | **97 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, CI's browser arm) |
| bounded set (`bounded-files.txt`: every test naming `killForCorpse`, `corpseKillSide`, `killIceTurretInPlace`, `circleKillIceTurret`, `killIceTurretOnWalk`, `latchWeighFirst`, `LATCH_WEIGH_FIRST`, `MAX_STRATEGIES_PER_GOAL` or `strategyBoundDistinct`, plus the L40, corpseBump, iceTurret and hammer rows) | 43 files; the 37 fast ones **457/457** (`bounded-w0.txt`); the 6 `.slow` files ran in D and on CI |
| the t917 repro (`latch-w0-cp3-lwf.txt`) | CPAIR-3 + LWF: refused *"the reordered corpse weigh took a hit at t917 (blast:iceturret@472,400#2.2) on its way to iceturret@472,400's kill stance (488,445)"*, perTick 1245. LWEIGH's, exactly |
| the t3502 bound (`m/part2-ng.txt`, LWEIGH's guard off by a scratch env in the worktree) | `applied 4 strategies for one goal [shove(pushableblockfire@576,576), weigh(wandlock@448,432), hold(wandlock@480,560), weigh(wandlock@800,400)]` at t3416 → the shove at t3502. L40C's, exactly |
| the clock (`clock-off-cp3-lwf.txt`, `tools/clock.mjs`: `turretDamage` per tick on the refused prefix) | in range at t822 (d 129 → 124); volley 1 spawned t852; **the walk's own swing lands on the turret at t879** (`hits` 1, `hitsTimer` 30), which holds `shootTimer` at 0; the player stops on the stance at t909; `hitsTimer` reaches 0 and the startshot begins at t910; three blasts at t913; #2.2 lands at t917 (frozen 14) |
| the L40 capture (`capture-legs.tsv`) | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --keys=<L40C's 52 keys> --capture-requests`, this tree on :8000: 52 legs, **39 done, 11 failed, 2 timeout; 60 requests** (L40C: 61; one leg ended `timeout` here where it ended `failed` there). 860 at seam 5924, 861 at seam 5407. The capture (32 MB) is not committed |

## 4. M — the design check

**Part 1, the approach** (`tools/scratch-arm.js`, env-gated in a scratch worktree; every row is the latch staging,
CPAIR-3 + LWF):

| design | result | evidence |
|---|---|---|
| OFF (the stance walk) | the t917 blast, refused at t1245 | `latch-w0-cp3-lwf.txt` |
| (b) fork tries from the current position | t0 from (888,776): no corridor plans directly; the stance walk relies on its own ladder | (first scratch run) |
| (b) staging on the push side's normal + fork tries of the corridor | staging (488,579) reached hitless at t705; **97/97 forks hit by the turret's body** at (470.5,442.3): the corridor dog-legs `(488,504) → (472,504) → (472,440) → (488,445)` because `pushableblockfire@480,480` shuts the x 488 column, and x 472 clips the snapped body (y 408..440) | `m/scratch-a-push-side-corridor.txt` |
| (b) + via points beside the box on the stance's line | 291 forks: the body is missed, but a blast (volley 3, t857) lands on the slide along y 445 | `m/scratch-b-push-side-vias.txt` |
| (a) + a wait at the route's first waypoint | 387 forks: 8 arrive and are hit during the kill, the rest on the approach | `m/scratch-b-push-side-vias-mid.txt` |
| (a)+(b)+(c): every side of the snapped box, routes, a wait in range (also a wait before the range and a stand at the stance) | **SOLVED 4142, hitless**: the west stance (467,424) (`corpseKillSide` key `right`), the corridor, a wait of 30 at (488,504). 1395 forks | `m/scratch-c-all-sides-pre-mid-post.txt` |
| the clock scan: that route, waits 1 … 48 | at (488,504) at t774 the turret is in `finishshot` (`shootTimer` 25, a blast in flight); **only waits 30 and 31 are hitless**. Waits 4–20, 22, 24–27 and 32–38 are hit by volley 2 (#2.1) leaving the cover. Waits 39–46 are hit by volley 4 near the stance. Waits 3, 21, 23, 28, 29, 47, 48 are hit by volley 4 or 5 during the kill | `m/scratch-clock-west-corridor-mid-scan.txt` |
| the search kept | a wait before the range is never tried (it cannot move the clock), nor a stand at the stance (the measured hit). Per side, per route, per wait 0 … 48 at the first waypoint. The production arm: SOLVED 4142, the same keys; 376 forks after the route prune (§5) | `m/prod-latch-on.txt` |
| the pocket boot (480,456) | **4495 OFF = ON** (keys identical), also with CPAIR-3 + LWF + TA: its corpse weigh binds live, so the reorder (and the approach) is never asked | `m/prod-pocket-*.txt` |
| every captured L40 request | §5 (the ON radius) | `radius/` |

**Part 2, the fifth order** (LWEIGH's guard off by a scratch env, so the four-order chain is reached;
`m/part2-*.txt`):

| arm | latch staging |
|---|---|
| guard off | bound at t3416 (the four distinct orders above) |
| guard off + bound 5 | SOLVED 4138 (the t917 hit) |
| guard off + "a fifth distinct order" | SOLVED 4138 (the t917 hit) |
| guard off + "do not re-count a succeeded order" | SOLVED 4138 (the t917 hit) |
| **TURRET_APPROACH ON (guard on)** | **SOLVED 4142, hitless, four orders: the bound is not met** |

**The narrowest claim is "a fifth distinct order".** Every application in `applied` has succeeded: an executor that
fails refuses the segment, so nothing failed is ever counted. "Do not re-count a succeeded order" therefore removes
the bound entirely. "Bound 5" also admits a repeat, which is the loop the bound exists for. "Distinct" admits exactly
the chain L40C measured and nothing that repeats.

**Part 3, the ctor-box snap** (`hammerTurretApproach.test.js`, "the ctor box"): the pocket boot's run at tick 0, before
the turret's first update, has the turret at (488,416) with its ctor box. Off the run's rect, the up kill stance is
**(488,437)**. After one tick the live body is y 408..440, so that stance is **inside the body**. Off the snap
(`iceTurretKillBox` ON) it is **(488,445)**, outside it. Once the turret has updated, the two boxes are equal (its rest
cycle is 0.5 px, under the snap's 1 px threshold). That is why no shipped caller moves: a trace of every
`iceTurretKillBox` call where the boxes differ fired **0 times** on L40 requests 860/1.

**Did any honest fix reach a forbidden file?** No. Everything is in `solverBot.js`, and `deriveCorpseWeigh`,
`execCorpseWeigh`, `killForCorpse`'s search and `latchWeighFirst` are unchanged (`killForCorpse` changes only its box,
and only ON).

## 5. I — the switches, the rows, the mutants, the ON radius

**The switches** (`solverBot.js`, after `LATCH_WEIGH_FIRST`'s block):
- `TURRET_APPROACH = { enabled }` (`SEEDLING_TURRET_APPROACH === '1'`), `TURRET_APPROACH_DEFAULT = false`,
  `withTurretApproach(enabled, fn)`, the instrument `TURRET_APPROACH_COUNTS.approaches` (written only ON, read by
  nothing that decides) and `resetTurretApproachCounts()`.
- `FIFTH_ORDER = { enabled }` (`SEEDLING_FIFTH_ORDER === '1'`), `FIFTH_ORDER_DEFAULT = false`, `withFifthOrder`,
  and the pure rule `fifthOrderAdmits(applied, next)`.
- The docblock names the user's queueing and LWEIGH's and L40C's hand-overs.

**The code:**
- `approachKillForCorpse` (new, beside `killForCorpse`):
  - the staging walk: the live `walkTo`, the order's exemptions, to the first plannable floor past the range on the
    push side's normal;
  - the fork tries: side × route × wait. Per try: walk to the first waypoint, stand the wait, walk on, the snap wait,
    settle on the side the kill derives off the live box, `killIceTurretInPlace` (`corpseOnly`), stand until no blast
    is in flight;
  - played on the live run and read back. A route with no corridor, or whose walk meets the turret's body, is pruned
    after its first try. No hitless try refuses by name with the tally.
- The frontier: with `TURRET_APPROACH` ON and a `latchWeighFirst` corpse order, the approach replaces the stance walk;
  LWEIGH's hit guard stays behind it.
- `iceTurretKillBox` (exported): ON the snapped box, OFF the run's rect. Read by `killForCorpse`'s `corpseKillSide`
  and by `killIceTurretInPlace`'s sides.
- `strategyBoundReached(applied, next)`: ON, `fifthOrderAdmits` first. The frontier passes the next application.
- **OFF cost:** one `TURRET_APPROACH.enabled` test per applied frontier order, one in each kill's box read, one
  `FIFTH_ORDER.enabled` test per bound ask.

**The rows:**

| file | row | asserts |
|---|---|---|
| `hammerTurretApproach.test.js` (fast, a few seconds) | ships OFF | both defaults false; `enabled` follows each env; each `with*` toggles |
| | the fifth order (L40C's list) | `fifthOrderAdmits` true for `shove(pushableblock@576,560)` after the four; false for any repeat, at 3, at 5, with a repeat among the four, with no `next`; `strategyBoundReached` OFF reached at four (with or without `next`), ON lifted for the fifth only |
| | the ctor box | the pocket boot at t0: the turret at (488,416); OFF the stance (488,437) is inside the live body after one tick; ON (488,445) is not; once updated, ON = OFF |
| | no turret in range | `C2-no-block` with no turret and with a turret out of range, under LWF: ON = OFF byte for byte, nothing approached |
| | a turret in range, no corpse route | `C2-no-block` + a turret in range (no Fire): the reorder is not taken, ON = OFF, nothing approached |
| `hammerTurretApproach.slow.test.js` (~6–10 min) | OFF | the t917 refusal, perTick 1245 |
| | ON | SOLVED 4142; the approach `{side 'right', via null, wait 30}`; the weigh's `corpse.kill` null; on a FRESH run: hits `[]`, deaths 0, keyType 2 at t4142, death on (30,26), corpse tiles (30,26) → (30,25) → (30,24), the lock open on (30,24) (⚖ 30(c)) |
| | the pocket boot | 4495, ON keys identical, nothing approached |

The t3502 bound is not a slow row: it needs LWEIGH's guard off, which no shipped knob does. The fifth-order row pins
the rule on that measured list instead.

**The mutants** (`tools/mutants.py`, `mutants.txt`; each applied, its rows run, the file restored byte for byte):

| mutant | red row |
|---|---|
| M1 drop the timing (no wait) | slow ON: *"expected SolverRefusal … to be null"* |
| M2 time it one turret cycle late (every wait + 45) | slow ON: *"to have a length of 4142 but got 4188"*. The cycle-late plan still solves hitless, because the volley clock is periodic (46 ticks); the row catches it by the plan's length, so this is a cost mutant, not a correctness one |
| M3 let the fifth order re-count a succeeded order | the fifth-order row: *"expected true to be false"* |
| M4 drop the snap | the ctor-box row: *"expected { x: 488, y: 437 } to deeply equal { x: 488, y: 445 }"* |

M1–M4 ran twice: before the route prune (`mutants.txt`) and on the final code (`mutants-final.txt`), with the same four
reds.

**The ON radius by mover class** (TA+FO = both switches ON):

| workload | movers | class |
|---|---|---|
| latch staging, CPAIR-3 + LWF | 1 | **refusal → SOLVED 4142, hitless, game-modelled** |
| latch staging, A4 (CPAIR-3 + ICEST + OPP + LWF) + TA+FO | 1 | refusal → SOLVED 4142 (`radius/latch-A4-TAFO*.txt`) |
| latch staging, A5 (+ `orbitFreeAim` + `strategyBoundDistinct`) + TA+FO | 1 | CORPSEBUMP refusal → SOLVED 4108, hitless (measurement only: `orbitFreeAim` is fidelity's) |
| latch staging, CPAIR-3 + LWF + FO alone | 0 | the t917 refusal (FO is inert without the approach) |
| ICEST's pocket boot | 0 | 4495 = 4495 |
| 60 L40 requests, defaults → TA+FO (`radius/cmp-D0-vs-D0-TAFO.txt`) | **0** | 42/60 solved both ways |
| 60 L40 requests, L → L+TA+FO | 4 (860/0, 860/1, 861/0, 861/1) | refusal text only. OFF: the anytime deadline (`/0`), `bobsoldier@880,832`'s volume (860/1), the press kill's hammer line (861/1). ON: the approach's named refusal at (488,579). 48/60 both ways |
| 60 L40 requests, A4 → A4+TA+FO | the same 4 | refusal text only; 47/60 both ways |
| 60 L40 requests, A5 → A5+TA+FO | the same 4 | refusal text only; 49/60 both ways |
| producer roster ON (`producer-on.txt`) | **0** | 97 run, 0 red, 1 skipped; r9 campaign `--check` inside it |
| bounded set ON, fast (`bounded-on.txt`) | **0** | 38 files, 462/462 (the 37 base files + the new one) |
| bounded `.slow` files ON (`slow-on.txt`) | 2 (`hammerLatchWeigh.slow.test.js`, both rows) | the CPAIR-3 row refusal → SOLVED (this slice's own effect); the LWF-alone row refusal text. Pinned OFF (§6) |
| the route survey (`survey-seedling-route.mjs --through=end`, OFF vs both switches ON; `radius/survey-off-vs-on.txt`) | **0** | 201 SOLVED / 237 both ways (237 steps on this main; LWEIGH's had 240) |
| identity block after | **0** | every row equals W0 |

**A flip is not ready** (§2, row 6). Its pins:
- `hammerLatchWeigh.slow.test.js`'s two rows read the process env and move under `SEEDLING_TURRET_APPROACH=1`. They are
  already pinned `withTurretApproach(false, …)` in this branch (§6), so a flip moves no committed row of LWEIGH's.
- The 4 L40 requests above, in refusal text.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), OFF | the new fast file 5/5 (`bounded-new-off.txt`). The 37 base files were not re-run locally OFF after the change; ON they pass (below), and CI's unfiltered suite at `5229c2a3` (every one of them, OFF) is green |
| bounded vitest ON | 38 files, 462/462 |
| hammer `.slow` files OFF / ON (`slow-off.txt`, `slow-on.txt`, `slow-on-lweigh-pinned.txt`): `hammerTurretApproach`, `hammerLatchWeigh`, `hammerIceTurretStatic`, `fidelityL40Latch`, `fidelityL40Bk2` | OFF **5 files, 10/10**. ON (both switches in the env) **8/10**: `hammerLatchWeigh.slow.test.js`'s two rows read the process env and move (the CPAIR-3 row now solves; the LWF-alone row meets `bobsoldier@880,832`'s sword on the approach's staging walk instead of `bob@736,800` at t271, refusal text). Both describe LWEIGH's own walk, so they are pinned `withTurretApproach(false, …)` (hammer's file; no change at the defaults); pinned, ON **2/2** |
| `ci-producer-checks --jobs=4` OFF / ON | 97 run, 0 red, 1 skipped / the same |
| identity block after (`identity-after.txt`) | **every row equals W0** (the diff is W0's appended exit line only), reference ALL MATCH |
| `census-seedling-solver-surface --check` | `--write` (site counts only; still 363 rows, so no new row to classify), then GREEN |
| `census-seedling-constants --check` | PASS (0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED (README and `procgenDocs/generated/docsIndex.js` regenerated: seedling-bot.md's word count) |
| `generate-docs-index.mjs --check` | OK |
| `derive-seedling-tick0 --check` | PASS (declared 16414 + 21 = 16435, measured 16435) |
| `check-seedling-wasm-ship` headless (`wasm-ship.txt`, :8000) | **ALL PASS, 415 PASS, 0 FAIL** |
| JSUT at `0a2548d3` (run 41096831894) | **success**: the 3 Vitest shards (suite 24345 passed, 0 failed), **the slow battery success (278 passed, 0 failed)**, the producer checks, both headless shards, every browser gate shard including seedling-wasm-ship |
| JSUT at `5229c2a3` (run 41112210525, the route prune and the records) | **success**: the 3 Vitest shards (24345 passed, 0 failed), **the slow battery success (28 files, 278 passed, 0 failed)**, the producer checks, both headless shards, the browser gate shards. The commits after it change one test file (the pin) and records only |
| route survey OFF / ON | 0 movers, 201/237 SOLVED both ways |
| `seedling-bot.md` | the paragraph names both switches (OFF) |
| `seedling-bot-log.md` | `### Seedling hammer-phase APPROACH — a hitless approach into an IceTurret's range` |

## 7. What the harvest A/B should expect

**OFF: no movers.** Both switches ship OFF, and OFF is byte-identical: producers 97/0 red OFF, the identity block
unchanged, the bounded set green. ON alone (the switches, every other default): 0 of 60 L40 requests move, and 0
producers red, 0 of 237 survey rows. A probe / TT / sweep / survey A/B with the two switches ON alone should show **no mover**: without
`LATCH_WEIGH_FIRST` the approach is never asked, and the snap moves nothing on a turret that has updated. With CPAIR-3
+ LWF also ON, expect the latch staging to solve (4142) and the two Boss Key 2 legs to change refusal text.

## 8. What the brief got wrong (measured)

- *"the turret's clock is the likelier lever"* — right, but not in the form "an entry timed to the clock". The entry
  cannot be timed from outside the range: the clock re-arms there every tick. The lever is a wait **inside** the range
  under cover, and it needs the side to change as well. The push side's stance (488,445) has no hitless approach at any
  wait.
- *"the 4-strategy bound stops the chain at `pushableblock@576,560` … a 5th order"* — that bound was the uncertified
  walk's. With the approach certified, the `hold(wandlock@480,560)` is never applied and the chain needs four orders.
  The fifth order is still the measured narrowest claim behind the guard-off arm, and ships OFF.
- *"Does it solve from any L40 arrival leg?"* — the arrivals do not reach the turret yet. From them the approach now
  walks further than OFF did (to (488,579), hitless), and stops on the latched south door.
- `orbitFreeAim` was expected to break the chain (CORPSEBUMP). With the approach ON (A5) the latch solves at 4108: the
  push-side kill changes the bump's phase, so the second bump is never refused. That is measurement only; CORPSEBUMP's
  code is not changed.
- The brief's 61 captured L40 requests are 60 here (one leg ended `timeout` instead of `failed`).

## 9. Residue and hand-overs

- **To the next hammer slice (the arrivals):** from 860/861 the approach's staging point (488,579) is south of the
  latched `wandlock@480,560`, and the fork routes (`planWaypoints`) have no ladder to discharge it. The door's hold
  must come first, or the approach must stage inside the door's discharge. Behind it are L40C's arrival walls
  (`spinner@816,848`, the anytime deadline on 861). Those belong to SPIN's and DASH's areas, not touched here.
- **To fidelity (measurement only):** A5's latch solve shows CORPSEBUMP's refusal is avoidable by the kill's side and
  timing, not only by `execCorpseWeigh`'s rest read. Nothing in `execCorpseWeigh` was changed.
- **The cost:** the latch staging's approach takes 376 forks (~2.5–3.5 min of the ~4 min solve). A request with a
  `crusher-fork` deadline and a covered route far down the order could refuse on the deadline; ordering the routes by
  cover would be the next economy.
- **Rows pinned here for a flip:** `hammerLatchWeigh.slow.test.js`'s two rows (hammer's), `withTurretApproach(false, …)`. No fidelity row moves (bounded fast set ON: 462/462; the fidelity `.slow` files ON: green).
- **Not touched:** the press kill, `pressKillGuards.js`, `pressKillCost.js`, `strikePolicyFor` (SPIN); the page worker
  and the chooser (CPWIT); the dash code (DASH); `deriveCorpseWeigh`, `execCorpseWeigh`, `latchWeighFirst`; every
  fidelity file; `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `iceTurret.js`, `flashPanel/*`.
- **The capture** (60 requests, ~32 MB) is not committed; `capture-legs.tsv` and `l40-leg-keys-l40c.txt` name it.
- **Scratch worktree:** the measurements under `m/` ran in a detached worktree in the session scratchpad, removed at
  the end. No scratch knob is in the committed code.

# Seedling hammer-phase SOUTHDOOR — the approach's latched south door, discharged before its forks (`APPROACH_DOOR`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-south-door` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `8440451386` (origin/main, "train: depgraph-determinism 334dd82370") |
| Head | W0 `46a797bf`; M `7a2600cc`; I `2c813b52`; D `6b0ed73f` (gates, docs, mutants), `c13b5647` (the lint fix), `5dff7147` (the radius and the log); this report is the last commit on the branch |
| Branch | `claude/seedling-hammer-southdoor-fusim3` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-south-door-evidence/` (instruments under `tools/`, the design measurements under `m/`, the request radius under `radius/`) |
| Scope messages | none arrived mid-run |
| Leg ids | L40C's 860/861 are **856/857** on this main (by KEY: `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` and the same `<- in_L43_176_464`) |

## 2. The answer first

**The one thing to know first:** the door is not the last wall, it is the first one with an order behind it. With the
switch ON the approach now asks for `wandlock@480,560` and the walk's own ladder raises the door's order — the latch's
`hold` at `buttonroom@880,768`. Where the latch pocket is open, that order runs (it kills `bob@736,752`,
`spinner@816,848` and `bobsoldier@880,832` on the way, latches, and returns to the doorway), the approach kills the
turret hitless from there, and Boss Key 2 is collected hitless at t4810 (with `FIFTH_ORDER`: the door's hold is now an
applied order, so the chain needs a fifth distinct one). **From the two arrival legs the pocket is shut:**
`burnabletree@872,784` stands between the arrival side and `buttonroom@880,768`, and the hold's own stance derivation
refuses (*"no REACHABLE stance inside buttonroom@880,768 … none of them plans a corridor from (488,578)"*); its
prerequisite search offers no `burn`.

| # | question | answer |
|---|---|---|
| 1 | Does Boss Key 2 solve from an arrival leg in the model? | **No**, in no arm measured (L+TA, L+TA+SD, +SP, +FO; captured budget and 10240). The door is passed only where the latch pocket is open: the latch fixture re-booted SOUTH of the door at (488,579) — APPROACH's staging point on the arrivals — with the latch NOT held: CPAIR-3 + LWF + TA + **SD** + **FO** **SOLVED 4810**, replayed on a fresh run of the model: hits `[]`, deaths 0, keyType 2 at t4810 (`m/south-L-TA+SD+FO*.txt`). Without FO it stops on the 4-order bound `[shove(pushableblockfire@576,576), weigh(wandlock@448,432), hold(wandlock@480,560), weigh(wandlock@800,400)]` |
| 2 | What does each leg meet next? | **Both legs (856/0,1 and 857/0,1), at 10240 and on `/1` at the captured budget: the door's own order refuses** — `hold(wandlock@480,560)`'s stance `buttonroom@880,768` plans no corridor from (488,578): `burnabletree@872,784` shuts the pocket (a plan to (888,824) succeeds, to (888,800) is refused on the tree; the run holds Fire). The hold's prerequisite list names only activators and a pushable, no burn. **On `/0` at the captured budget: the anytime deadline at the `walk` site** (the door's ask spends the work before the walk). Named, not fixed (the hold's derivation is outside this slice's boundary) |
| 3 | Does it need SPIN's switch and the lifted budget? | **SPIN's switch: no** — `PRESS_ESCAPE_SHIELD_CLAIM` changes nothing on either leg (same digests with and without it, both budgets). On the south re-boot the ladder kills `spinner@816,848` by the press arm without it. **The lifted budget: only to see the wall on `/0`** — at the captured budget `/0` ends on the anytime deadline; at 10240 every request ends on the hold's refusal |
| 4 | The design chosen | **(1)+(2) together:** the door's order before the forks (via the loop's own ladder, so the order is the ladder's, not chosen here), staged inside its discharge (the walk ends in the open doorway (488,568), 144 px from the turret, outside its range). (3) — giving each fork the ladder — was not built: a fork has no `walkTo`, and the discharge is the same 1368-tick order on every try; it would refuse at the same hold derivation on the arrivals (§4) |
| 5 | Does any answer depend on the CHOOSER_PAIR flip? | **All of them.** The approach (and so this switch) is reached only behind CPAIR size 3 + `LATCH_WEIGH_FIRST` + `TURRET_APPROACH`. At the defaults the switch is never asked (59 requests, 0 movers). If CPAIR size 3 lands ON before the harvest, the answers hold with LWF + TA + SD still to flip |
| 6 | Flip readiness | **Not ready by itself**, and not harmful: ON alone 0 movers; behind L+TA it moves only the 4 BK2 requests, refusal text only (no solve gained or lost, 47/59 both ways). It needs `TURRET_APPROACH`, `LATCH_WEIGH_FIRST`, CPAIR-3 and (for the chain it unlocks) `FIFTH_ORDER` ON, and the pocket's burn before it helps an arrival |

## 3. W0

| row | result |
|---|---|
| base | `git fetch origin main` → `8440451386`; branch reset onto it |
| bootstrap | `session_bootstrap.sh --seedling` → READY; node v22.23.4; every non-wasm submodule initialised |
| the capture (`capture-legs.tsv`) | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --keys=<L40C's 52> --capture-requests`, this tree on :8000: 52 legs, **39 done, 12 failed, 1 timeout; 59 requests** (APPROACH: 60). The BK2 pair 856/857 were captured first on their own (`capture-bk2-legs.txt`), 2 requests each. The capture (31 MB) is not committed |
| the (488,579) refusal (`w0-bk2-L-TA.txt`) | CPAIR-3 + LWF + TA, captured budget AND 10240: all four requests *"no approach to iceturret@472,400 from the staging point (488,579) is hitless — 12 fork(s), {"no-plan":12}"*, approach asked at t283 (856) / t311 (857). APPROACH's, exactly |
| latch staging, L+TA (`m/latch-W0-L-TA.txt`) | SOLVED 4142, the approach `{side 'right', via null, wait 30, forks 376}`. APPROACH's, exactly |
| identity block, producer roster, bounded set | measured on this tree with the switch OFF (W0's code was already in the tree by the time the CPU was free; OFF is byte-identical by construction — every read is behind `APPROACH_DOOR.enabled` inside `TURRET_APPROACH`'s approach). See § 6 |

## 4. M — the design check

The instrument (`tools/doorfor.mjs`, then `approachDoorFor` itself): on the latch fixture re-booted at (488,579) the
hypothesis (`stanceHypothesisProbe`) holds `wandlock@480,560` as a `hold`; no side of the turret's box plans live; the
up side plans with the hypothesis' doors open and its route crosses `wandlock@480,560` at its cell (488,568). At (488,504)
(north of the door) a side plans: nothing asked. At (488,904) (the arrival) the same door is named.

| design | workload | result | evidence |
|---|---|---|---|
| OFF (APPROACH) | south re-boot (488,579), L+TA | the arrivals' refusal at t0, 12 no-plan forks | `m/south-L-TA.txt` |
| (1)+(2) the door's order first, staged in the doorway | south re-boot, L+TA+SD | the ladder applies `hold(wandlock@480,560)` (kills `bob@736,752` at t456, `spinner@816,848` by press 539–671, `bobsoldier@880,832`, latches at t884, back in the doorway after 1368 t, door open); the approach from there: `{side 'right', via (467,446), wait 25, forks 321}` at t1632, hitless; then `weigh(wandlock@800,400)`; **then the 4-order bound** | `m/south-L-TA+SD.txt` |
| + `FIFTH_ORDER` | south re-boot, L+TA+SD+FO | **SOLVED 4810**; fresh replay: door open by t884, turret dead at t1620, corpse (30,26)→(30,25)→(30,24), `wandlock@448,432` open at t1908, hits `[]`, deaths 0, keyType 2 at t4810 | `m/south-L-TA+SD+FO.txt`, `-replay.txt` |
| (1)+(2) | arrival legs 856/857, captured budget, L+TA+SD (+SP) | `/1`: the hold's refusal (buttonroom unreachable); `/0`: the anytime deadline at `walk` | `m/bk2-cap-L-TA+SD*.txt` |
| (1)+(2) | arrival legs, 10240, L+TA+SD, +SP, +FO | all four: the hold's refusal, same digests (`2da39ddbe0ab` 856, `2d2e1763f05e` 857) | `m/bk2-w10240-*.txt` |
| the pocket, measured | request 856/1's staging | plans to (888,860), (888,840), (888,824); refused to (888,800)/(872,800)/(904,800) on `solid burnabletree at (872,784)`; (904,776) another component | `tools/probe-pocket.mjs` (output in this table) |
| (3) the forks given the ladder | — | not built: a fork has no `walkTo` (`noWalk`), the discharge is the same 1368-tick order on every try, and on the arrivals it refuses at the same hold derivation. Measured equivalent: the ask from the arrival point (488,904) names the same door (`doorfor.mjs`) |
| the latch staging | L+TA+SD | **SOLVED 4142**, the same approach, doors asked: none (the door is faded open at t101, so a side plans at the approach's ask, t977) | `m/latch-L-TA+SD.txt` |
| ICEST's pocket boot (480,456) | L+TA+SD | **SOLVED 4495**, nothing approached, nothing asked | `m/pocket-L-TA+SD.txt` |

**Did any honest fix reach a forbidden file?** No. The next wall (the hold's stance prerequisites not offering a burn)
is in the stance derivation, outside this slice's boundary; it is named, not touched.

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, after `TURRET_APPROACH`'s block): `APPROACH_DOOR = { enabled }`
(`SEEDLING_APPROACH_DOOR === '1'`), `APPROACH_DOOR_DEFAULT = false`, `withApproachDoor(enabled, fn)`, the instrument
`APPROACH_DOOR_COUNTS.doors` (written only ON, read by nothing that decides) and `resetApproachDoorCounts()`. The
docblock names the user's queueing (2026-10-31) and APPROACH's hand-over. `SEEDLING_APPROACH_DOOR` is in
`SOLVER_ENV_NAMES` (`solverEnvChannel.test.js` green).

**The code** (beside `approachKillForCorpse`):
- `approachDoorFor(run, sides, exempt, contacts)` (exported, no tick spent): null when a side plans from where the player
  stands; else the stance hypothesis, the hypothesis bag (`bagWithDischarged`), and the first hypothesis door a side's
  hypothesis route crosses (the player box sampled every 2 px along the waypoints) → `{door, side, cell}`, or
  `{door: null, why}`.
- `approachDoorFirst`: notes the ask, and for a door walks the LIVE run to its cell with the loop's own `walkTo` (the
  order's exemptions); the ladder raises the door's order.
- In `approachKillForCorpse`, after the staging walk: ON, the door first; a hit during it refuses by name; the staging
  point becomes the doorway. Nothing else moves: `deriveCorpseWeigh`, `execCorpseWeigh`, `latchWeighFirst`,
  `resolveWeighStrategy` are unchanged.
- **OFF cost:** one `APPROACH_DOOR.enabled` test per approach (which is itself asked only under `TURRET_APPROACH`).

**The rows:**

| file | row | asserts |
|---|---|---|
| `hammerSouthDoor.test.js` (fast, ~3 s) | ships OFF | default false; `enabled` follows the env; `withApproachDoor` toggles |
| | south of the door | the fixture at (488,579): `{door 'wandlock@480,560', side 'up', cell (488,568)}`; no tick spent; nothing noted |
| | north of the door | (488,504): null (nothing asked) |
| `hammerSouthDoor.slow.test.js` (~7.5 min) | OFF, south | the arrivals' refusal text, 12 no-plan forks from (488,579) |
| | ON (+FO), south | SOLVED 4810; the door row `{ticks 1368, open true}`; the hold at `buttonroom@880,768` opened the door; one approach at t1632 from the right; on a FRESH run hits `[]`, deaths 0, keyType 2 at t4810, the door open before the turret dies (⚖ 30(c)) |
| | the latch staging | SOLVED 4142 ON, nothing asked, APPROACH's approach |
| | the pocket boot | ON keys identical to OFF (4495), nothing asked |

The ON row runs with `FIFTH_ORDER` ON, because the door's hold is now an applied order (the measured 4-order bound
without it). "ON where the staging is on the near side = OFF" is the latch-staging row (nothing asked, so byte-identical
by construction) and the north fast row.

**The mutants** (`tools/mutants.py`, `mutants.txt`; in a scratch worktree, the file restored byte for byte):

| mutant | red row |
|---|---|
| M1 drop the reorder (the door is never asked) | slow ON: *"expected SolverRefusal … to be null"* |
| M2 order it on the near side (the "a side plans" answer dropped) | fast north: *"expected { door: null, …(1) } to be null"* |
| M3 skip the discharge (the door named, no walk) | slow ON: *"expected SolverRefusal … to be null"* |

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| 59 captured L40 requests, defaults → SD alone (`radius/cmp-D0-vs-D0-SD.txt`) | **0** | 41/59 both ways |
| 59 requests, L+TA → L+TA+SD (`radius/cmp-LTA-vs-LTA-SD.txt`) | 4 (856/0, 856/1, 857/0, 857/1) | **refusal text only**: the 12 no-plan forks → the hold's buttonroom refusal (`/1`) or the anytime deadline (`/0`). 47/59 both ways |
| 59 requests, L+TA+FO → L+TA+SD+FO | the same 4 | refusal text only; 47/59 both ways |
| latch staging, L+TA+SD | 0 | 4142 = 4142, nothing asked |
| ICEST's pocket boot | 0 | 4495 = 4495 |
| south re-boot (a new workload, not a shipped one) | 1 | refusal → **SOLVED 4810 hitless, game-modelled** (with FO) |
| producer roster ON (`producer-on.txt`) | **0** | 97 run, 0 red, 1 skipped |
| bounded fast set OFF / ON (TA+FO+SD) | **0** | 38 files, 542/542 both |
| hammer `.slow` files of the bounded set, OFF / ON (SD in the env; `slow-off.txt`, `slow-on.txt`) | **0** | 8 files, 14/14 both |
| the route survey, OFF vs TA+FO+SD ON (`radius/survey-off-vs-on.txt`) | **0** | 201 SOLVED / 237 both ways |
| r9 campaign (`solve-seedling-r9-campaign --check`, in the identity block and the producer roster) | **0** | `be9c19c8`, exit 0 |
| identity block after | **0** | every row equals the published values |

**A flip is not ready** (§2 row 6). It would move no committed row and no pin by itself (ON alone: 0 movers anywhere).

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), OFF / ON | 38 files 542/542 / 542/542 (`bounded-off.txt`, `bounded-on.txt`); the new fast file 3/3; `solverEnvChannel.test.js` 11/11; `lintGateLabels.test.js` 14/14 after the fix |
| the new slow file | 4/4 (`slow-new-first.txt`, 450 s) |
| hammer `.slow` files (the 8 in `bounded-files.txt`: `hammerTurretApproach`, `hammerLatchWeigh`, `hammerIceTurretStatic`, `fidelityL40Latch`, `fidelityL40Bk2`, …) OFF / ON | 8 files, **14/14** / 8 files, **14/14** |
| `ci-producer-checks --jobs=4` OFF / ON | OFF: 97 run, every producer exit 0, the battery's own TREE-MOVED guard red — **my evidence files were being written into the tree during the run** (`producer-off.txt` lists them), not a producer. ON: 97 run, **0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, CI's browser arm) |
| `census-seedling-solver-surface --check` | `--write` (site counts only; 365 rows before and after, no new row to classify), then GREEN |
| `census-seedling-constants --check` | PASS (0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED (README and `procgenDocs/generated/docsIndex.js` regenerated) |
| `generate-docs-index.mjs --check` | OK |
| `derive-seedling-tick0 --check` | PASS |
| identity block after (`identity-after.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, the six producer `--check`s exit 0 (r9 campaign `be9c19c8`), **ALL 7 MODULES AND 5 REGIONS MATCH** — every row equals APPROACH's published W0 |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS**, 0 FAIL (`wasm-ship.txt`, cut to its tail) |
| JSUT at `6b0ed73f` (run 41226734022) | **the slow battery success: 34 files, 355 passed, 0 failed**; Vitest shards 1/3 and 3/3 success; shard 2/3 **1 failed**: `lintGateLabels.test.js` on this slice's own slow file (a pinned roster length, `toHaveLength(1)`, under a row name with numbers). Fixed in `c13b5647` (the roster read whole; the lint test 14/14 locally). Suite 25012 passed, 1 failed. Producer checks, both headless shards and every browser-gate shard (seedling-wasm-ship included) success |
| JSUT at `c13b5647` (run 41232996426) | **success**: Vitest shards 1/3, 2/3, 3/3 success — suite **25013 passed, 0 failed**; **the slow battery success: 34 files, 355 passed, 0 failed** (the new `hammerSouthDoor.slow.test.js` among them). The commits after it are evidence, docs and this report only |
| `seedling-bot.md` | a paragraph names `APPROACH_DOOR` (OFF) and what it does |
| `seedling-bot-log.md` | `### Seedling hammer-phase SOUTHDOOR — the approach's latched south door` |

## 7. What the harvest A/B should expect

**OFF: no movers.** The switch ships OFF; every read is behind it, inside an approach that is itself behind
`TURRET_APPROACH`. **ON alone (every other default): no movers** (59 L40 requests, 0; producers 0 red). A sweep / survey
A/B with the switch alone shows nothing, because without CPAIR-3 + LWF + TA no approach is asked. With CPAIR-3 + LWF + TA
also ON (`solver_env` = `SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_TURRET_APPROACH=1;SEEDLING_APPROACH_DOOR=1`
plus `SEEDLING_FIFTH_ORDER=1`), expect the two BK2 legs to change refusal text, from the approach's no-plan forks to the
hold's buttonroom refusal. **The game witness to dispatch** (cloud sessions get a 403): the divergence sweep with `keys`
= the two BK2 keys and that `solver_env`; the expected page verdict is the same refusal, so it witnesses the channel and
the ask, not a solve. A game witness of the 4810 solve needs the south re-boot staged on the page (not a leg).

## 8. What the brief got wrong (measured)

- *"Does it need SPIN's switch and the lifted budget?"* — SPIN's wall (`spinner@816,848` on 860's walk west) is not met
  on this path: the approach's staging walk reaches (488,579) before it, and on the south re-boot the ladder kills that
  spinner by the press arm with SPIN's switch OFF. The lifted budget only uncovers the hold's refusal on `/0`.
- *"Behind it are L40C's arrival walls"* — the wall behind the door is the door's own order: the latch pocket is shut by
  `burnabletree@872,784` from the arrival side.
- *"ON passes the door with every step game-modelled"* — on the arrival legs nothing passes the door. The row is on the
  committed latch fixture re-booted south of the door (pocket open), where it does, replayed hitless on a fresh run.
- The leg ids moved again: 860/861 → 856/857. 59 requests captured (APPROACH 60, L40C 61).
- *"Measure each [design]"*: (3) was argued from (1)+(2)'s measurement, not built (§4).

## 9. Residue and hand-overs

- **To the next hammer (or fidelity) slice — the pocket's burn:** from both BK2 arrivals, `hold(wandlock@480,560)`'s
  stance `buttonroom@880,768` is unreachable because `burnabletree@872,784` shuts the pocket; the hold's prerequisite
  search (`stancePrerequisite` / the `NO REACHABLE stance` refusal's list) offers activators and pushables, not a
  `burn`. The run holds Fire. Once the tree is burnt, the south re-boot shows the rest of the chain runs (with
  `FIFTH_ORDER`): the press kill of `spinner@816,848`, the chaser kills, the latch, the approach, the weighs, the shove.
- **To the planner (flip):** the bundle CPAIR-3 + LWF + TA + SD + FO is what the chain needs; none is ready alone.
- **The cost:** the door's discharge is a 1368-tick ladder walk inside the approach; at the captured budget it spends
  the anytime deadline on `/0` before the hold's refusal is reached.
- **Not touched:** the press kill, `pressKillGuards.js`, `pressEscape*`, `strikePolicyFor`, the strike scan, the PULL
  rung, `deriveCorpseWeigh`, `execCorpseWeigh`, `latchWeighFirst`, `resolveWeighStrategy`, the dash code, every
  fidelity file, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `iceTurret.js`, `flashPanel/*`.
- **Not committed:** the capture (31 MB) and the 4810 keys file (33 KB; the slow ON row re-derives it).
- **Scratch worktree** (mutants): removed. No scratch knob is in the committed code.

# Seedling hammer-phase POCKET-BURN — a burn opens BK2's latch pocket (`STANCE_BURN`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-pocket-burn` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `6d9f991739` (origin/main, "train: hammer-stack-2 5eb1ee52ee") |
| Head | W0 `d0ee66f9`; M `a5073169`; I `653e17ab`; D `032c57f5` (census, reference, docs, mutants, request radius), `2be229c5` (log, reference, gates); this report (with the survey radius and the clean producer run) is the last commit on the branch |
| Branch | `claude/seedling-pocket-burn-p7guq6` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-pocket-burn-evidence/` (`w0/`, `m/`, `radius/`, instruments under `tools/`) |
| Scope messages | none arrived mid-run |
| Leg ids | the BK2 arrivals are **864/865** on this main (by KEY, unchanged: `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` and `<- in_L43_176_464`) |
| Fidelity W36 branches | not used: no answer here needed them |

## 2. The answer first

**The one thing to know first:** the burn was never the last wall. With `STANCE_BURN` ON the hold's derivation
raises `burn(burnabletree@872,784)` exactly as asked, and the refusal moves past the pocket — onto the burn walk's
COMBAT (`bobsoldier@880,832` beside the burn's stance; on leg 864 a death to `bob@736,752` while the ladder press-kills
`spinner@816,848`). That is the same wall the **defaults** already meet on these legs (at the defaults the frontier
raises the burn through `wandlock@448,432`'s hypothesis and dies on `bobsoldier@880,832`). And past the combat, the
chain from a shut pocket is **six distinct orders** — the burn plus SOUTHDOOR's five — where `FIFTH_ORDER` admits five.
So no switch in this slice's boundary solves Boss Key 2 from an arrival; this slice removes the pocket's wall and names
the two behind it.

| # | question | answer |
|---|---|---|
| 1 | W0: does the refusal reproduce? | **Yes, byte for byte.** LWF+TA+SD+FO (CPAIR-3 the default), both legs `/1`, captured budget and 10240: `no REACHABLE stance inside buttonroom@880,768 … from (488,578)`, SOUTHDOOR's digests (`2da39ddbe0ab` 864, `2d2e1763f05e` 865). `/0` at the captured budget: the anytime deadline at `walk` (SOUTHDOOR's too) |
| 2 | The prerequisite list the derivation builds | guard (iii)'s walls `wandlock@448,432`, `wandlock@512,480`, `wandlock@800,400` (no block reaches their buttons), `bosslock@480,352` (no presser), `pushableblock@576,560` (no shove plans). **No burn**: `stancePrerequisite` had two arms, (a) a `weigh` activator's mechanism and (b) a walk-family pushable — a tree was never a candidate |
| 3 | Where is it decided? | `deriveHoldStance` → `stancePrerequisite(run, candidates, exempt, hypothesis, contacts, blocked)` (solverBot.js), asked only by `resolveHoldStrategy` (`{prerequisites: true}`), consumed by `prerequisiteOrder`, which resolves `${kind}:${tag}` through `OBSTACLE_STRATEGIES` and `frontierExecutor`. A tree needs (i) a third arm that probes the corridor with the tree burnt (`burnedTrees` in the bag) and (ii) a prerequisite `{kind 'solid', tag 'burnabletree'}` — `solid:burnabletree` → `burn` is already a registered row, so `prerequisiteOrder` needed no change |
| 4 | The design chosen | **(2): the prerequisite search's own arm (c)**, last (after mechanism and geometry), offered only with Fire held (no Fire Wand) and `burn` through the strategy switch's gate. (1), trees in the stance hypothesis, was measured and rejected: it changes every stance derivation (the hypothesis is shared), and on the BK2 legs it hits the strategy bound on a REPEAT (`wandlock@448,432`) inside the door's nested walk — a scratch sixth order does not admit it. (3) was not chosen because (2) does not break the bound: it is the chain that does, whatever raises the burn (§4) |
| 5 | Does ON solve an arrival? | **No** (§4): the refusal moves to the combat on the burn's walk. The arrival rows therefore assert the move, not a solve |
| 6 | Does 4810 stay? | **Yes.** The pocket-open south re-boot ON: SOLVED 4810, hitless on a fresh run, no burn record (the slow row) |
| 7 | Orders counted | pocket open (SOUTHDOOR's 4810): `hold(wandlock@480,560)`, `weigh` ×2, `shove` ×2 = 5 distinct (kills are rungs, not counted). Pocket shut: + `burn(burnabletree@872,784)` = **6**. A prerequisite order counts (it replaces the round's plan before `strategyBoundReached`). `FIFTH_ORDER` admits a fifth only |
| 8 | Radius | ON alone: **0 / 58** L40 requests, **0 / 237** survey steps; behind LWF+TA+SD+FO: **2** requests (864/1, 865/1) and **1** survey step (95), refusal text only; 45/58 and 201/237 solved both ways |

## 3. W0

| row | result |
|---|---|
| base | `6d9f991739`; bootstrap READY (the Archipelago pip line failed on a `bsdiff4` pin — not used by any Seedling gate); every non-wasm submodule initialised by hand before the first gate; node v22.23.4 |
| legs | `seedling-divergence-legs.mjs` → 923 legs; the BK2 pair are **864/865** (SOUTHDOOR's 856/857) |
| capture (`capture-bk2-legs.txt/.log`) | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --keys=<the 2> --capture-requests`, :8000, at the defaults: both `failed`, 2 requests each (seams 5176 / 5204). Page text: `… -> hold stance (wandlock@448,432) -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bobsoldier@880,832` — **the defaults already burn** |
| node replay, F = LWF+TA+SD+FO (`w0/bk2-cap-F.txt`, `w0/bk2-w10240-F.txt`) | `/1` both budgets and `/0` at 10240: the hold's refusal, SOUTHDOOR's digests; the door asked at t283 (864) / t311 (865); `/0` at the captured budget: the deadline at `walk` |
| defaults (`w0/bk2-cap-D0.txt`) | `/1`: the burn's combat ladder on `bobsoldier@880,832` (`8d5e0f607f2b`, `474880567541`) — the page's own text |

## 4. M — the design check

Workloads: the 4 captured BK2 requests (node), the latch boot re-booted at (488,579) with the tree **un-banked** (its
L40 tag-0 persistence row dropped: the pocket SHUT, the arrivals' shape) and as committed (the pocket OPEN, SOUTHDOOR's
4810 fixture). `tools/latch.mjs TREE=1`, `tools/story.mjs` (a refusal's spent ticks replayed on a fresh run).

| design | workload | result | evidence |
|---|---|---|---|
| OFF (F) | arrivals `/1`; pocket shut | the hold's refusal, no burn named | `w0/`, `m/southtree-F.txt` |
| **(2) prerequisite arm (c)** (F-SB) | the probe (`holdStanceProbe`) on the pocket-shut boot | `prerequisite {burnabletree@872,784, via burn}`, stance (888,776) | `m/probe-hold-stance.txt` |
| (2) | 864/1 (both budgets, and `/0` at 10240) | `… door wandlock@480,560 (488,568) -> burn stance (burnabletree@872,784) -> kill (spinner@816,848) by press: the player died at t780 (chaser bob@736,752)` — the story: 3 hits from `bob@736,752` at (744,773), t723–780 | `m/bk2-*-F-SB.txt`, `m/story-864-F-SB.txt` |
| (2) | 865/1 (both budgets, and `/0` at 10240) | `-> burn stance (…): the combat ladder is EXHAUSTED … bobsoldier@880,832` (the burn's stance tile is inside its live volume) | `m/bk2-*-F-SB.txt` |
| (2) | pocket shut | the same `bobsoldier@880,832` wall; the spent ticks kill `bob@736,752` at t458 and take a hit from `bob@736,800` at t551 | `m/southtree-F-SB.txt`, `-replay.txt` |
| (2) | pocket open | **SOLVED 4810** (SOUTHDOOR's records unchanged: kills, hold, weigh ×2, shove ×2) | `m/south-F-SB.txt` |
| (2) | defaults (D0-SB) | identical digests to D0 (the hold is never asked at the defaults) | `m/bk2-cap-D0-SB.txt` |
| (1) trees in the hypothesis (scratch `SCRATCH_TREE_HYP`) | arrivals, pocket shut | `… -> hold stance (wandlock@480,560) -> burn stance (…): applied 5 strategies for one goal [shove, weigh(wandlock@448,432), hold(wandlock@480,560), burn, brave(iceturret@472,400)]`; the refusal's live perTick is 283 (arrivals) / 0 (re-boot): the chain ran inside the door's nested walk | `m/bk2-*-F-TH.txt`, `m/southtree-F-TH.txt`, `m/story-864-F-TH.txt` |
| (1) + a scratch sixth order (`SCRATCH_SIXTH`) | pocket shut | unchanged: the next application repeats `wandlock@448,432`, which no distinct-order rule admits | `m/southtree6-*.txt` |
| (1)+(2) | pocket shut | = (1) (the hold reaches under the hypothesis, so the prerequisite is never asked) | `m/southtree6-F-SB+TH.txt` |

**Did any honest fix reach a forbidden file?** No. The walls behind the burn are the combat ladder's (the press kill
of `spinner@816,848` under `bob@736,752`'s chase, and the chaser arm on `bobsoldier@880,832` beside the burn's stance)
and the strategy bound (a ruling). Neither is in this slice's boundary; both are named (§9).

The scratch knobs (`SCRATCH_TREE_HYP`, `SCRATCH_SIXTH`, `SCRATCH_EQUIPS`) lived only in the working tree during M and
were removed before I was committed (`git diff` at I has three hunks, all the switch's).

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, after `STANCE_ROCKS`): `STANCE_BURN = { enabled }` (`SEEDLING_STANCE_BURN === '1'`),
`STANCE_BURN_DEFAULT = false`, `withStanceBurn(enabled, fn)`; `SEEDLING_STANCE_BURN` in `SOLVER_ENV_NAMES`. The read-only
probe `holdStanceProbe(run, at, blocked)` (the derivation `resolveHoldStrategy` asks; steps nothing).

**The code** (beside `stancePrerequisite`):
- `stanceBurnTrees(run, blocked)`: the standing, unrefused trees — empty unless the run holds Fire, not the Fire Wand,
  and `executorFor('burn', 'stancePrerequisite:burn')` (the strategy switch's gate) answers.
- `stanceBurnPrerequisite`: for each tree, the corridor to each candidate (the caller's list and order) with that tree
  burnt in the bag (`burnedTrees`) — first the world as it is, then under the hypothesis with its volumes exempted
  (`stanceReaches`' own reading). The first that plans → `{id, kind 'solid', tag 'burnabletree', via 'burn', why}`.
- `stancePrerequisite`'s last line: `return STANCE_BURN.enabled ? stanceBurnPrerequisite(…) : null;` — after arms (a)
  and (b), so wherever they answer nothing moves.
- `prerequisiteRefusalClause`: ON, each tree tried is named (`… (no burn of it plans the corridor)`).
- The order: unchanged `prerequisiteOrder` → `refineStrategy('burn')` → `frontierExecutor` (gated) →
  `resolveBurnStrategy` (its own stance and Fire gate) → applied through `callableExecutor` like every frontier order.
  No new call site, so `strategySwitch.test.js`'s source rows are unchanged (green).
- **OFF cost:** one flag test where arm (b) returned null, and one in the refusal clause. Byte-identical by construction.

**The rows:**

| file | row | asserts |
|---|---|---|
| `hammerPocketBurn.test.js` (fast, ~18 s) | ships OFF | default false; `enabled` follows the env; `withStanceBurn` toggles and restores |
| | pocket shut | OFF: the refusal from (488,579), the list ending `pushableblock@576,560 …`, no `burnabletree`; ON: `prerequisite {burnabletree@872,784, via 'burn'}` at (888,776); ON with no Fire held = OFF word for word; ON with `burn` disabled (the strategy switch's scope) = OFF word for word |
| | pocket open | ON = OFF: stance (888,776), no prerequisite (a stance with no tree) |
| `hammerPocketBurn.slow.test.js` (~5 min) | the arm | CPAIR enabled at size 3 (the default the file leans on) |
| | pocket shut, OFF | the hold's refusal; no tree named |
| | pocket shut, ON | not the hold's refusal; `-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED`; obstacle `bobsoldier@880,832` |
| | pocket open, ON | SOLVED 4810, no `burn` record; on a FRESH run hits `[]`, deaths 0, keyType 2 at t4810 (⚖ 30(c)) |

⚠ The brief's row *"ON burns the tree, latches, and collects BK2 hitless"* is not written: it is not true in the model
(§2, §4). The rows say what is.

**The mutants** (`tools/mutants.py`, `mutants.txt`; a scratch detached worktree, the file restored byte for byte, the
worktree removed):

| mutant | red row |
|---|---|
| M1 drop the burn offer | pocket shut: *"expected 'solverBot: no REACHABLE stance inside…' to be null"* |
| M2 offer it with no Fire held | pocket shut (the no-Fire arm): *"expected { stance: { x: 888, y: 776 }, …} to deeply equal { stance: null, …}"* |
| M3 offer it past the strategy switch's gate | pocket shut (the `burn`-disabled arm): the same |

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| 58 captured L40 requests, D0 → D0+SB (`radius/cmp-D0-vs-D0-SB.txt`) | **0** | 45/58 both ways |
| 58 requests, F → F+SB (`radius/cmp-F-vs-F-SB.txt`) | **2** (864/1, 865/1) | **refusal text only**: the hold's refusal → the burn walk's combat. 45/58 both ways; `/0` unchanged (deadline) |
| pocket-open south re-boot (F) | 0 | 4810 = 4810, hitless |
| pocket-shut south re-boot (F) | 1 | refusal text only (hold → bobsoldier) |
| producer roster ON (`producer-on.txt`) | **0** | 97 run, 0 red, 1 skipped (CI's browser arm) |
| bounded fast set OFF / ON | **0** | 65 files, 1257/1257 both |
| bounded `.slow` set OFF / ON (`slow-off.txt`, `slow-on.txt`) | **0** | 10 files, 22/22 both |
| the route survey, OFF vs SB alone (`radius/survey-off-vs-on.txt`) | **0** | 201 SOLVED / 237 both ways |
| the route survey, F vs F+SB (`radius/survey-F-vs-F-SB.txt`) | **1** (step 95, L40 Totem Part 64,144, staged from `r8-solve-11`) | **refusal text only**: the same buttonroom refusal from (488,578), whose clause now also names `burnabletree@872,784 (no burn of it plans the corridor)` — on that boot the burn alone does not open the stance (why: not measured). 201/237 both ways |
| r9 campaign (in the identity block and the producer roster) | **0** | `be9c19c8`, exit 0 |

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), OFF / ON (`bounded-files.txt`: SOUTHDOOR's 46 + every test naming a prerequisite/burn + the switch/env/lint tests) | 65 files, **1257/1257** both |
| `solverEnvChannel.test.js`, `strategySwitch.test.js`, `lintGateLabels.test.js` | 11/11, 21/21, 14/14 (after renaming one row whose label typed a count — the lint caught it before push) |
| the new files | fast 3/3; slow 4/4 (296 s first run; 286 s in the slow OFF battery) |
| hammer `.slow` files of the bounded set, OFF / ON | **10 files, 22/22** both (`hammerSouthDoor`, `hammerLatchWeigh`, `hammerTurretApproach`, `hammerSpinnerPress`, `hammerIceTurretStatic`, `fidelityL40Latch`, `fidelityL40Bk2`, the new file, …) |
| `ci-producer-checks --jobs=4` OFF / ON | ON: 97 run, **0 red**, 1 skipped. OFF: every producer exit 0; the battery's TREE-MOVED guard red because my uncommitted docs/census/evidence were in the tree during the run (the files it lists are those). Re-run on a CLEAN tree after the last code/doc commit (`producer-off-clean.txt`): **97 run, 0 red**, 1 skipped |
| `census-seedling-solver-surface --check` | `--write` (site counts only: 371 rows before and after, none new to classify), then GREEN |
| `census-seedling-constants --check` | PASS (0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | README and `procgenDocs/generated/docsIndex.js` regenerated (twice: again after the log entry's heading); **ALL CHECKS PASSED** |
| `generate-docs-index.mjs --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| identity block (`identity-after.txt`) | every one of its 19 hash rows equals SOUTHDOOR's published `identity-after.txt` (maze, acceptance, c3/c6/c4, ENEMY, guard, AREA, killgate ×3, levels ×2, the six producer `--check`s incl. r9 campaign `be9c19c8`); its reference row read DIFFER because the log entry was written after the first regeneration — regenerated, then `check-procgen-reference` passed |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS** (`wasm-ship-tail.txt`) |
| JSUT at `032c57f5` (run **41397377276**) | **success**: shards 1/3, 2/3, 3/3; suite **25270 passed, 0 failed**; **the slow battery: 39 files, 369 passed, 0 failed** (`hammerPocketBurn.slow.test.js` among them) |
| `seedling-bot.md` / `seedling-bot-log.md` | a paragraph names `STANCE_BURN` (OFF); `### Seedling hammer-phase POCKET-BURN — a burn opens BK2's latch pocket` |

## 7. What the harvest A/B should expect

**OFF: no movers** (every read is behind the flag; the arm runs only after arms (a) and (b) have returned null).
**ON alone (every other default): no movers** — at the defaults the latch hold is never asked on the BK2 legs (the
frontier burns the tree itself), 0/58 L40 requests. With the BK2 chain's switches ON, expect the two BK2 legs to change
refusal text from the hold's buttonroom refusal to the burn walk's combat. **The ON sweep to dispatch** (cloud sessions
get a 403):

```
probe-seedling-divergence-sweep, mode inv, producer solver,
keys = level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2|level_40__r32c36 <- in_L43_176_464 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2
solver_env = SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_TURRET_APPROACH=1;SEEDLING_APPROACH_DOOR=1;SEEDLING_FIFTH_ORDER=1;SEEDLING_STANCE_BURN=1
```
and the same with `SEEDLING_STANCE_BURN=1` removed as its control. Expected page verdicts: both `failed`, the ON text
`… -> burn stance (burnabletree@872,784) …` (864: the press kill's death to `bob@736,752`; 865: `bobsoldier@880,832`),
the control text the hold's buttonroom refusal. And the full ON sweep with `solver_env = SEEDLING_STANCE_BURN=1` alone,
expected 0 movers (it witnesses the channel, not a solve).

## 8. What the brief got wrong (measured)

- *"The run holds Fire … why the hold's stance prerequisites never raise it"* — right, and fixed; but the burn is not
  what stands between the arrivals and Boss Key 2. At the defaults the frontier already raises it; the walls are the
  combat at the burn's stance and the order bound (six distinct orders from a shut pocket).
- *"ON burns the tree, latches, and collects BK2 hitless (fresh replay)"* — not true in the model from the arrivals or
  from the pocket-shut re-boot; the fresh-replay row is the pocket-open 4810 (unchanged).
- *"(3) leave it (if (1)/(2) break the bound)"* — (2) does not break the bound: the chain does, whatever raises the burn.
  (1) breaks it, and on a repeat.
- The leg ids moved again: 856/857 → 864/865. 58 L40 requests captured (SOUTHDOOR 59; 44 done / 8 failed of 52 legs).

## 9. Residue and hand-overs

- **To the planner (a ruling): the order bound.** From a shut pocket the Boss Key 2 chain is six distinct orders
  (`burn`, `hold(wandlock@480,560)`, `weigh(wandlock@448,432)`, `weigh(wandlock@800,400)`, `shove(pushableblockfire@576,576)`,
  `shove(pushableblock@576,560)`); `FIFTH_ORDER` admits five, and `NESTED_OPENER_DEPTH`/`MAX_STRATEGIES_PER_GOAL` say
  raising the number is a ruling.
- **To the strike/press slices (AXIS-L12HITS, STRIKE-SLOT, ESCAPE-EXACT):** the burn walk's combat. 864: the ladder
  press-kills `spinner@816,848` while `bob@736,752` chases (three hits at (744,773), t723–780, `PRESS_KILL_REBOOT_GUARD`).
  865 and the re-boot: the chaser arm prices no stance for `bobsoldier@880,832` (7 reachable, all *"still standing after
  the whole ceiling"*), and the burn's stance tile (55,51) is inside its live volume. On the pocket-open re-boot the hold
  walk kills `bob@736,752` first (t456) and `bobsoldier@880,832` from (888,856) — the order of kills is the difference.
- **Not touched:** `approachKillForCorpse`/`approachDoorFirst`, `resolveBurnStrategy`, the strike policy, the press kill
  and escape, `spinnerDashWhole`, `strategySwitch.js`, every fidelity file, `levelRun.js`, `dangerMap.js`,
  `botDriverV*.js`, `iceTurret.js`, `flashPanel/*`.
- **Not committed:** the captures (1 MB BK2, the 52-leg one) and the request-arm jsonl (the summaries are in `w0/`, `m/`,
  `radius/`). The capture ran on a tree whose OFF-gated edits were uncommitted (the sweep's lock froze `d0ee66f9`); I
  committed under my own lock with `BOX_LOCK_COMMIT_ANYWAY=1` twice (evidence and the OFF switch only).

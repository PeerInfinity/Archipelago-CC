# Seedling hammer-phase CLEARTAG-CHAIN — the clear-tag hold runs its stance prerequisite (the burn)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-cleartag-chain` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-05 (the L40 census's step 3) |
| Start SHA | `97739720dd4121e306312a111b00873dda9d00a4` (origin/main, "train: sdc-apcalc-parity 01606741091f"); the brief named `2342e25604` or later. Leg ids 871/872 are unchanged here (`seedling-divergence-legs.mjs` regenerated at this SHA: the same keys) |
| Head | W0 `5bfebc8d`, M `e6a62bb3`, I `65fe3260`, D `aea3d788`, `8029c2bf`, `fdb8f866`; this report is the last commit on the branch |
| Branch | `claude/seedling-hammer-cleartag-chain-rr2pjw` (the harness's designated branch) |
| Switch | `solverBot.CLEARTAG_CHAIN`, **OFF** (`SEEDLING_CLEARTAG_CHAIN=1`, `?seedlingSolverEnv=SEEDLING_CLEARTAG_CHAIN=1`, `withClearTagChain`) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-cleartag-chain-evidence/` (`w0/`, `m/`, `i/`, `d/`, `tools/`) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` READY; every submodule initialised (the wasm one too, for the page captures); node v22.23.4; 4 cores; a :8000 `serve-nocache` server for the page sweeps |

**Method.** The page's requests for 871/872 were re-captured at the start SHA
(`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g --ids=871,872
--capture-requests`). Each was replayed in node with the census's `chain.mjs` (copied to `tools/`, cap 40960 work units,
both passes on one work clock, trace rows stamped with the work unit; a SOLVED plan re-driven on a fresh run of the
staging, row by row, ⚖ 30(c)). Arms are `+`-joined switch sets (`tools/arms2.sh`): CC = `CLEARTAG_CHAIN`, and the
census's SB CSH OPP LWF TA SD FO PEE FSB; `p0` stages L40 tag 0 (the tree burnt). Main's numbers come from a pristine
detached worktree at the start SHA (`--root`).

## 2. The answer first

**The one thing to know first: with the arm, both flag-12 legs SOLVE hitless from a tree-unburnt save, and the census's
wall C does not stand on this head.** The bill is the SE fight's staged hunt: about 85% of it.

| question | answer |
|---|---|
| Does W0 reproduce wall B? | Yes. At the defaults both legs refuse *"no REACHABLE stance inside buttonroom@880,768"*; SB and ALL refuse *"'hold''s stance is reachable only once burnabletree@872,784 is discharged … a clear-tag order does not chain openers"* (182 units a pass). With tag 0 staged, ALL SOLVES both, hitless (871 1438 t, 872 1320 t) |
| The design | `clearTagPrerequisite`: the order `prerequisiteOrder` builds, unchanged, applied the way the frontier applies one; then the hold is re-derived from where it left the player (§4) |
| One switch with SB? | **No, a separate switch, which needs SB ON for this case.** CC consumes any prerequisite the derivation names (arms (a) mechanism and (b) geometry are on at the defaults); SB only lets a tree be named, and it also moves the frontier (BK2). CC alone on 871/872 is OFF byte for byte (nothing named) |
| The bound | `prerequisiteOrder`'s own: `NESTED_OPENER_DEPTH` = 2 on the goal's `openerChain` (one link per goal). The burn is one application in the goal's strategy bound (`applied`, shared with the frontier's orders). A prerequisite named again after its order ran is refused by name |
| 872 from a tree-unburnt save | **SOLVED hitless**, 2389 t, under CC + SB + OPP + CSH + PEE + FSB (= CC + ALL, plan byte for byte); the fresh run burns the tree, writes `{40,0}` and `{40,12}`, 0 hits, 0 deaths. Without PEE, or without FSB: 1809 t with **1 hit** (`bob@736,800` at t800) |
| 871 | **SOLVED hitless**, 1122 t, under the same set. The census's wall C (the x 744 shaft) is not met. The trace's order is the burn, then (on its stance walk) `kill spinner@880,848`, then `bobsoldier@880,832` twice, then the hold. Not bisected: ALL + tag 0 also SOLVES 871 at this head (1438 t), where the census measured C |
| Work vs the page's 640 / 2560 | 871 **2774**, 872 **3469**: both over the 2560 retry. The staged hunt (`stagedChaserHunt` on the stack) is **2360 / 2774** and **2912 / 3469** (≈ 85%). Without it the bills would be ~414 and ~557, inside 640 |
| OFF | byte-identical: 10 of 10 (871/872 × D0, SB, ALL, SB+p0, ALL+p0) digests and work equal to main's |
| Radius | **the only movers are 871/872.** 96 captured requests from 85 legs (asked: the other 91 flag legs and 394/411/869/870/395/412, 97 in all; the other 12 were skipped by the leg list or captured no request), each under D0, SB and SB + OPP + CSH + PEE + FSB: **0 arrivals** at either clear-tag prerequisite site, so CC cannot move any of them (§5) |

## 3. W0 — 871/872 at the defaults, SB, ALL, and with tag 0 staged

The page sweep at the start SHA (`w0/page-sweep-871-872.jsonl`): both **failed**, `R` (one refusal), the message the census
quotes (*"no REACHABLE stance inside buttonroom@880,768 … pushableblock@576,560 (no shove of it plans the corridor)"*).

Node replays (`w0/w0-table.txt`; main's tree, `i/off-identity-871-872.txt`):

| leg | D0 | SB | ALL | D0 + tag 0 | SB + tag 0 | ALL + tag 0 |
|---|---|---|---|---|---|---|
| 871 (← L39, (488,904)) | REFUSED 364 u: no reachable stance | **wall B** 364 u | **wall B** 364 u | REFUSED 9066 u: ladder EXHAUSTED, `bobsoldier@880,832` (A2) | = D0 + tag 0 | **SOLVED 1438 t**, 3496 u, hitless |
| 872 (← L43, (328,600)) | REFUSED 364 u: no reachable stance | **wall B** 364 u | **wall B** 364 u | REFUSED 106 u: press death t1139 to `bob@736,752` (A1) | = D0 + tag 0 | **SOLVED 1320 t**, 2041 u, hitless (the full pass) |

**The refusal site** (`execClearTag`'s solid arm, `solverBot.js`): `resolveObstacleStrategy(run, 'hold', …)` returns the
hold with `prerequisite: {id: 'burnabletree@872,784', via: 'burn'}` (from `deriveHoldStance` → `stancePrerequisite`'s
arm (c), SB on), and the arm refused at once: only `walkToUnder`'s frontier consumed a prerequisite
(`prerequisiteOrder`, *"THE PREREQUISITE IS CONSUMED HERE AND NOWHERE ELSE"*). The cross-room presser arm
(`execCrossRoomPress`) has the same refusal; no measured leg reaches it (§5).

⚠ **The census's 871 wall C does not reproduce at this head.** The census (at `2342e256`) measured 871 + tag 0 under ALL
as REFUSED (C: *"the hold walk climbs the x 744 shaft, meets `bob@736,752` first"*). Here the same arm SOLVES (1438 t).
Main moved between the two SHAs; I did not bisect which commit.

## 4. M — the designs

| # | design | verdict |
|---|---|---|
| D1 | **the clear-tag arm runs `prerequisiteOrder`'s order, applied as the frontier applies one, then re-derives its verb** | **built** |
| D2 | walk to the hold's stance anyway and let the frontier find the tree | rejected on design, not measured: the frontier answers the nearest actionable obstacle on its flood, not the one the derivation named (on 869's chain the flood's first orders are `shove` and `hold(wandlock@448,432)`), so it would be a second claim about the same stance |
| D3 | fold the chain into `STANCE_BURN` | rejected: two decisions (what may be named; whether the clear-tag arm consumes it), and SB alone already moves the frontier |
| D4 | a deeper chain (raise `NESTED_OPENER_DEPTH`) | not needed: 871/872 need one link, and raising the number is a ruling (prerequisiteOrder's own text) |
| D5 | chain the cross-room presser arm too | not built: nothing measured reaches it (residue) |

**D1, what it reuses.** `prerequisiteOrder` is unchanged: its strategy row, its registration check, its sub-aim (the
stance it unlocks), the derivation's exemptions, and its depth bound on the goal's `openerChain`. The application mirrors
the frontier's:
- the goal's strategy bound (`strategyBoundReached(applied, …)`), with the burn pushed to `applied`;
- a trace row (`strategy: {verb, prerequisiteOf}`);
- the shut-before snapshot;
- the stance walk, registered in `stanceWalks` for `STANCE_REENTRY`;
- the executor through `callableExecutor(frontierExecutor(…), …, 'clear-tag-prerequisite')`, so the strategy switch's
  `disable` gates it;
- the exemptions carried.

The caller then re-resolves the hold against the changed world. A flag the order itself clears finishes as
`cleared-in-passing`.

**What the order bound counts.** One application per prerequisite, in the same `applied` list the frontier fills, so the
burn and any frontier orders on the later walks share one per-goal bound. 871/872 apply the burn and no frontier order
(the trace rows), far from `MAX_STRATEGIES_PER_GOAL`.

**Scratch arms** (`m/arms-871-872.txt`; tree unburnt):

| arm | 871 | 872 |
|---|---|---|
| CC | = D0 (REFUSED 364, digest `7c2fd7098f6e`) | = D0 (`0c0409958d2d`) |
| CC + SB | REFUSED 1810 u: **the burn stance walk**, ladder EXHAUSTED on `bobsoldier@880,832` (A2) | REFUSED 464 u: **the burn stance walk**, press death t799 to `bob@736,752` (A1) |
| CC + SB + OPP + CSH | SOLVED 1392 t, 2599 u, hitless | SOLVED 1809 t, 3523 u, **1 hit** (`bob@736,800` t800) |
| CC + SB + OPP + CSH + PEE | — | SOLVED 1809 t, 1 hit |
| CC + SB + OPP + CSH + FSB | — | SOLVED 1809 t, 1 hit |
| **CC + SB + OPP + CSH + PEE + FSB** | **SOLVED 1122 t, 2774 u, hitless** | **SOLVED 2389 t, 3469 u, hitless** |
| CC + ALL | = the row above (digest `13eef59de064`) | = the row above (`111a34376e28`) |
| CC + ALL − OPP | — | REFUSED 600 u: press death t834 (A1) |
| CC + ALL − CSH | — | REFUSED 3424 u: EXHAUSTED `bobsoldier@880,832` (A2) |
| CC + ALL − PEE / − FSB | — | SOLVED 1809 t, 1 hit |
| CC + ALL − LWF / − TA / − SD / − FO | — | = CC + ALL (`111a34376e28`) |

**So the minimal set measured is CC + SB + OPP + CSH + PEE + FSB** (six switches; LWF, TA, SD and FO are no-ops here).

## 5. I — the switch, the rows, the mutants, the radius

**The switch** (`solverBot.js`; my lines only):
- the declaration after `withStanceBurn` (`CLEARTAG_CHAIN`, `CLEARTAG_CHAIN_DEFAULT`, `withClearTagChain`);
- `clearTagPrerequisite`, a new closure just above `execClearTag`;
- `execClearTag`'s solid arm: the resolve block folded into `resolveCT()` (same text, same order of checks) and the
  bounded loop before the existing `if (resolved.prerequisite)` refusal.

Also: `SEEDLING_CLEARTAG_CHAIN` in `solverEnvChannel.SOLVER_ENV_NAMES`, and `strategySwitch.test.js`'s wrapped-executor
source row gains the second `frontierExecutor` (no `strategySwitch.js` edit). No other file of the solver is touched.

**Rows.**

| file | tier | rows |
|---|---|---|
| `hammerClearTagChain.test.js` | default | (1) ships OFF, env + channel; (2) OFF + SB: wall B, the exact text, 182 u; (3) ON + SB: the burn runs, the refusal moves to the burn walk's press death t799 (A1), 232 u, message sha pinned; (4) ON without SB = OFF byte for byte (the defaults' message, sha `cd5f0db75f2a` = main's); (5) ON + SB with `burn` disabled by the strategy switch = OFF with it disabled. Each is ONE dashless pass, uncapped |
| `hammerClearTagChain.train.test.js` | train | 872: OFF under the set refuses at wall B; ON SOLVES 2389 t / 3467 u (the dashless pass), the fresh run row-for-row equal, hits `[]`, deaths 0, tree burnt, clears `40:0, 40:12`. 871: SOLVED 1122 t / 2772 u, the same checks |

Fixtures: `fixtures/hammer-cleartag-chain/leg87{1,2}-…-request.json.gz`, the page's requests with the atlas records cut
to level 40 (10.1 KB each; `tools/cut-fixture.mjs`). Cut and uncut answer byte-identically on D0, SB, CC + SB and CC + ALL,
both legs (`i/fixture-cut-871-872.txt`).

**Mutants** (`tools/mutants.py`, a separate worktree; `i/mutants-{default,train}.txt`):

| mutant | default tier | train tier |
|---|---|---|
| M1 the switch ignored (the chain OFF too) | **RED** (row 2) | — |
| M2 no re-derivation (the stale resolution kept) | survived | **RED** (both rows) |
| M3 no stance walk (the burn run where the player stands) | **RED** (row 3) | — |
| M4 the exemptions not carried | survived | survived |
| M5 the order not counted in the strategy bound | survived | survived |
| M6 the repeat guard dropped | survived | survived |

M4–M6 guard paths 871/872 never take: the burn's resolution carries no exemption, the bound is never near, and the burn
takes on the first try. No measured workload reaches them, so they are stated rather than pinned.

**Work and the staged hunt** (`i/work-attribution-871-872.txt`, one stack capture per work unit):

| leg | work | staged hunt (`stagedChaserHunt` on the stack) | the rest of the burn order (its walk's other rungs, the burn) | the hold (resolve, re-derive, walk, verb) and pass overhead |
|---|---|---|---|---|
| 871 | 2774 | **2360** (85%) | 226 | 188 |
| 872 | 3469 | **2912** (84%) | 370 | 187 |

The whole SE fight happens on the burn order's stance walk. **The part of the bill that is not the staged hunt is ~414 /
~557 units, inside the page's 640.** STAGED-HUNT-CHEAP's cut is what brings these legs under the budget.

**Tree already burnt** (`i/tree-burnt-on-871-872.txt`): CC + ALL + tag 0 = ALL + tag 0 byte for byte on both legs (no
prerequisite is named, so nothing is chained); CC + tag 0 = D0 + tag 0.

**The ON radius.** CC changes a solve only where `execClearTag` meets a resolution carrying a prerequisite. Up to that
point OFF and ON run the same code, and OFF that point is the *"does not chain openers"* refusal. So the radius is counted
there, not diffed. An instrumented scratch tree (the head plus one counter at each of the two prerequisite sites,
`tools/radius-instrument.patch`, never committed) replayed every captured request, OFF, and counted the arrivals.

| workload | arm (CC off; the counter's arms) | requests | arrivals at the solid arm / the cross-room arm | movers under CC |
|---|---|---|---|---|
| 85 legs of the 97 asked (the 91 other flag legs + 394, 411, 869, 870, 395, 412) that captured a request (`d/radius-prereq-arrivals.tsv`, `d/radius-ids.txt`; page capture at the start SHA) | D0 | 96 | 0 / 0 | **0** |
| | SB | 96 | 0 / 0 | **0** |
| | SB + OPP + CSH + PEE + FSB (the ON dispatch's set) | 96 | 0 / 0 | **0** |
| 871, 872 | SB, ALL, the set | 2 | 2 / 0 (one per pass) | **2**: wall B → SOLVED (§4) |

By mover class: **refusal → hitless solve: 2** (871, 872 under the set; under CC + SB alone, refusal → a later refusal). Everything
else is **none**. The levels covered are 0, 12, 16, 19, 20, 24, 28, 30, 31, 38, 40, 48, 61, 63, 65, 68, 71, 101, 113 and 114.
The capture's 8 skipped legs carry no request and were not run. Not covered: the route survey, the r9 campaign and the
non-flag legs outside L40. They reach the clear-tag arm only through a flag goal, so by the argument above they cannot move
unless a flag goal is in their list; that was not measured.

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) | `hammerClearTagChain.test.js` 5/5, `strategySwitch.test.js` + `solverEnvChannel.test.js` + `hammerPocketBurn.test.js` (41 with the new file), `solveProgress.test.js` + `strategySwitch.test.js` 80/80 after the TC2 fix, `contentIdentity` + `entityBlocks` + `boxLock` 86/86 |
| hammer `.slow` files, locally (serial config) | `hammerBk2Combat` 4, `hammerEscapeExact` 2, `hammerEscapeGenerated` 1, `hammerDashShape` 1: **8/8** |
| `.train` files run locally (`vitest.train.config.js`) | `hammerClearTagChain.train` 2/2, `hammerSouthDoor.train` 4/4, `hammerPocketBurn.train` 4/4 (the nearest pins: the south door and the tree; no train pin drives the clear-tag arm, so OFF identity is what covers the rest). **Not run here**: `hammerChooserPair`, `hammerGhostKillRung`, `hammerIceTurretStatic`, `hammerLatchWeigh`, `hammerSpinnerPress`, `hammerTurretApproach` (the planner's dispatched train-tier run) |
| `ci-producer-checks --jobs=4`, switch ON (`SEEDLING_CLEARTAG_CHAIN=1`) | **97 run, 0 red**, 1 skipped (r7-ends-meet, a browser arm) (`d/producer-checks-on.txt`) |
| `ci-producer-checks --jobs=4`, defaults | 97 producers rc 0 on two runs; each run's battery row read `TREE-MOVED` because **I** changed the tree while it ran (a soft reset to split a commit, then new untracked evidence paths). **A third run on an untouched tree: 97 run, 0 red**, 1 skipped (`d/producer-checks-off.txt`; run 2 kept as `d/producer-checks-off-run2.txt`) |
| `identity-block.sh`, main (pristine worktree) vs head | every byte-inertia row equal (`d/identity-block-{main,head}.txt`). The one differing line is the generated-docs row, which reads *"4 differ"* at the PRISTINE worktree and *"all match"* at the head, so it is not a regression; I did not chase why the detached worktree reads 4 |
| `census-seedling-solver-surface --check` | RED before, then `--write`: the `run:entities` row's counts (+4 solverBot sites: `clearTagPrerequisite`'s shut-before snapshot). **No new row to classify.** GREEN after (371 rows) |
| `census-seedling-constants --check` | PASS (7061 literals, 0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (word counts), ALL CHECKS PASSED |
| `generate-docs-index.mjs --check` | OK (193 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless) | ALL PASS |
| CI (JSUT) | run `42130123422` at `8029c2bf`: **slow battery 414/414**; suite 25666/25667: 1 red, `solveProgress.test.js` TC2's source row (6 → 7 `progressFrame` sites, mine), fixed in `fdb8f866`. **Run at `fdb8f866`: `42134039562` GREEN: suite 25667/25667, slow battery 414/414** |

## 7. What the harvest A/B should expect

- **OFF: no movers.** Every path is behind `CLEARTAG_CHAIN.enabled`. Main and the head are byte-identical on 871/872 under
  10 arms. The identity block is equal, and producer checks are rc 0 throughout.
- **The ON sweep dispatch** (the 64 L40 legs, as the census ran them):
  `probe-seedling-divergence-sweep` with `keys` = the census's `w0/l40ids.txt` (or at least 871, 872) and
  `solver_env` = `SEEDLING_CLEARTAG_CHAIN=1;SEEDLING_STANCE_BURN=1;SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_CHASER_STAGED_HUNT=1;SEEDLING_PRESS_ESCAPE_EXACT=1;SEEDLING_FORECAST_SHIELD_BUMP=1`,
  against the same `solver_env` without `SEEDLING_CLEARTAG_CHAIN=1`.
  - Expect 871/872 to stay **failed on the page**, now as a budget/deadline cut rather than wall B. Both need 2774 / 3469
    work units against the 2560 retry.
  - The other legs that set moves are SB/OPP/CSH/PEE/FSB's own movers (the census's arms), not this switch's.
  - All six names are in `solverEnvChannel.SOLVER_ENV_NAMES` (checked), so the page channel carries them.
- **With STAGED-HUNT-CHEAP harvested**, 871/872 should fit inside the page's budget (≈ 414 / 557 units without the hunt).
  That is the A/B that can turn them green.

## 8. What the brief got wrong (measured)

- *"871 then meets wall C"*: not at this head. 871 + tag 0 under ALL SOLVES (1438 t, hitless), and from a tree-unburnt
  save CC + the set SOLVES it too (1122 t). The census measured C at `2342e256`; main moved since.
- *"872 SOLVES under ALL nine switches (1501 t, 2750 u)"* (tree banked): here 1320 t, 2041 u (the full pass; the dashless
  pass refuses at 49 u). Same verdict, different plan, again a moved main.
- *"the census's minimal set"*: the census measured no minimal set for 872 with the tree banked (ALL only). Measured
  here from the unburnt tree: OPP + CSH answer the SE fight, and **PEE and FSB are both needed for hitless**. Either one
  alone leaves `bob@736,800`'s hit at t800.
- *"start from `origin/main`, 2342e25604 or later"*: the start was `97739720dd`.
- *"report the door-shut result"*: 871/872's goal IS the door (flag 12), so every number above is door-shut. The
  door-banked variant was measured anyway (D0 + tag 12, `i/door-banked-871-872.txt`). ⚠ It does NOT finish as
  `already-clear`: the door is open (its group t=3 latched), the hold runs 131 ticks, and the arm refuses `not-written`
  (*"the run's `earnedClears` still does not hold {40,12}"*), 6 units a pass. The clear-tag arm reads the run's ledger,
  not the staged persistence. **For the planner's door-carry staging:** a leg whose goal is a flag the harness stages
  refuses this way. The BK2 and flag-8 legs the ruling is about have other goals, so by construction they do not hit
  it (not measured here).

## 9. Residue and hand-overs

- **To STAGED-HUNT-CHEAP (budget):** 85% of 871/872's bills are `stagedChaserHunt`'s asks on the burn walk's SE fight.
  The two fixtures (`fixtures/hammer-cleartag-chain/`) are a ready workload for it.
- **To the planner (door-carry staging):** with L40 tag 12 staged, the flag-12 goal refuses `not-written`, because the
  clear-tag arm reads `earnedClears`, not the staged persistence (§8). That bears on the harness staging question.
- **Not built:** the cross-room presser arm's chain (D5); no measured leg reaches it (0 arrivals on 96 requests).
- **Surviving mutants M4–M6** (the exemption carry, the bound count, the repeat guard): no measured workload exercises
  them.
- **Wall C:** not met on this head (§3). If it returns on another head, it is the SE-FIGHT-ORDER slice's.
- **The plan's `verbs` list omits `burn`.** The trace builder merges same-tick rows, keeping the later substantive one,
  and the burn's row (tick 0 of the segment) shares its tick with the stance walk's first ladder rows. The burn is in that
  row's `note` (*"merged: burn decided on the same tick"*), and the fresh run confirms it burned. The frontier's orders
  behave the same way; this is not a defect of this arm.
- **Tooling** (scratch, `tools/`): `chain.mjs` (the census's, plus the fresh run's `burned`/`clears`, the stack tags and
  the radius counters); `arms2.sh`; `sum.mjs`; `cut-fixture.mjs`; `mutants.py`; `radius-instrument.patch`.
- **Worktrees:** `…/scratchpad/base` (main at the start SHA) and `…/scratchpad/mut` (the mutants and the instrumented
  radius) are mine, both outside the repo and removed by name at the end.
- **Commits** used `BOX_LOCK_COMMIT_ANYWAY=1` while this session's own sweeps held the box.
- One push was rejected four times by GitHub (*"fatal error in commit_refs_rules"*) and went through unchanged later;
  the D commit was split in two while it was refused.

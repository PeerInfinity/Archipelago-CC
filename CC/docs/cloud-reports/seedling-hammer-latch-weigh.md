# Seedling hammer-phase LWEIGH — the L40 latch chain reaches the corpse weigh, not the hold stance (`LATCH_WEIGH_FIRST`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-latch-weigh` (planner `seedling-hammer-phase-planning-2`), cloud |
| Start SHA | `af86d85d` (main, "Merge origin/main caa42ea5df into the ICEST harvest") |
| Head | the code is `5903c0ed` (I), the docs and gates `bd086e44` (D); this report is the last commit |
| Branch | `claude/l40-latch-corpse-weigh-uveext` (the harness's designated branch; the brief's `seedling-hammer-latch-weigh` name was not used) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-latch-weigh-evidence/` |
| Scope messages | none arrived mid-run |

## 2. The answer first

**The census: the weigh is always asked, and always refused by the same reject.** Every plan or refusal that picks
`hold stance (wandlock@448,432)` comes from `resolveWeighStrategy`. It finds no block for `button@480,384`, asks the
corpse weigh, and falls back to the hold. The corpse weigh's named reject is the same in every case:

> *"its first press's stance (488,440) plans no corridor from (x,y) — the corpse is not on this side"*

| workload | resolutions of `weigh(wandlock@448,432)` | weigh asked | taken | reject |
|---|---|---|---|---|
| latch chain (L40LATCH's staging, (888,776)) | t0 | yes | **no** | the one above, from (888,776) |
| 60 captured L40 requests | 853 and 854, requests 0 and 1 (4 requests); request 1 of each names the hold in its refusal, request 0 hits the anytime deadline | yes | **no** | the same, from (488,904) (853) and (328,600) (854) |
| route survey, 240 rows | steps 67 and 95 (both L40 from (488,904)) | yes | **no** | the same |
| guard (iii)'s hypothesis only (no hold chosen) | 853/854 ×2, 356, 359, 376, 393 | yes | no | the same |
| ICEST's pocket boot ((480,456)) | t0 | yes | **yes** (live) | — |

The reject is an asymmetry, not an order. The hold stance (488,392) is derived under the stance hypothesis, **through**
the latched south door `wandlock@480,560` {t 3}. The corpse weigh's "on this side" gate is asked of the live world, and
there the first press stance (488,440) is behind that same door. So the solver prefers the hold only because it asks the
hold under a more optimistic world.

**The design chosen: design 1, behind `LATCH_WEIGH_FIRST` (OFF).** Where the hold's stance lies inside a live turret's
`attackRange`, the corpse weigh is asked again with the hypothesis bag (the bag `chainWeighHypothesis` already hands
it). A corpse plan of that turret becomes the order. Design 2 (fix the reject inside `deriveCorpseWeigh` for every caller)
was measured and is worse. It admits the t2 lock into guard (iii)'s base hypothesis, and the latch chain then refuses
**at t0** on `button@816,400`'s hold. It also changes CORPSEBUMP's answer for its existing callers (§4).

Two measured additions make design 1 drive rather than loop:
- **The order carries the kill stance** (off the snapped box), so the frontier walks it as a registered stance walk.
  Without it, `killForCorpse`'s own walk named the same lock on its frontier and re-raised the same weigh every two ticks
  until the strategy bound.
- **A hit from that walk to the verb's end refuses by name.** The approach into the range is not fork-certified, and
  without the guard the CPAIR arm took a blast at t917 and walked on.

**The measured effect (the latch chain):**

| arm | OFF | ON |
|---|---|---|
| defaults | `hold stance` → `bob@736,800`, t271 | **`weigh stance`** → `bob@736,800`, t271 (the same refusal, the same 271 ticks) |
| + ICEST, or + OPP | t271, as above | t271, as above |
| + `orbitFreeAim` + `strategyBoundDistinct` | — | `weigh stance` → `bob@736,800`, t351 |
| + CPAIR size 3 (± ICEST ± OPP) | ICEST's arm handed the turret at t577, no hitless try, refused t833 | **past the bobs; the turret dies (t966), the corpse slides (30,26) → (30,25) → (30,24), `button@480,384` held, `wandlock@448,432` open at t1245**, every step on a fresh replay of the model. The walk into the range drew a volley: a blast at t917, so it refuses by name at t1245 |
| + CPAIR size 3 + ICEST + OPP + `orbitFreeAim` + `strategyBoundDistinct` | the same t833 refusal (t879 there) | the corpse's second bump refuses inside `execCorpseWeigh`: *"iceturret@472,400 is ALREADY on (30,24)"* |
| ICEST's pocket boot | SOLVED 4495 t (the live corpse weigh) | **identical**; the reorder is never asked |

The other workloads move only in refusal text: 853/854 request 1 at their captured seams, 2 of the 60 L40 requests,
2 of the 240 survey rows, and 3 rows of the bounded set. Each says `weigh stance` where it said `hold stance`, and
nothing else moves. The r9 campaign does not move (the producer roster ON: 95 run, 0 red).

**Does Boss Key 2 solve?** No, in no arm: not from the latch chain, and not from the sweep's L40 legs in the model.

**What the chain meets next** (named, not fixed):
1. ON alone (and with ICEST, OPP or `orbitFreeAim`): `bob@736,800` at t271, the same x≈744 refusal as OFF. The walk west
   to the weigh's stance crosses the same corridor the hold's walk did.
2. With CPAIR size 3: **the approach volley.** The stance walk reaches (487.6,445.1) hitless at t916, and a blast lands
   at t917 on `execCorpseWeigh`'s snap tick. The kill itself (`killForCorpse`'s circling kill) is fork-certified; the walk
   into the range is not. This is ICEST's hand-over again: a volley-aware approach is the unbuilt arm.
3. Past that hit (a scratch arm with the guard off): `wandlock@800,400` opens at t3416. The chain then stops on the
   4-strategy bound at `pushableblock@576,560` (t3502), because `shove`, `weigh(448,432)`, `hold(480,560)` and
   `weigh(800,400)` are four distinct orders, so `strategyBoundDistinct` does not lift it.
4. With `orbitFreeAim` the first bump carries the corpse to (30,24) and the second bump is refused by `runFire`.
   `execCorpseWeigh`'s rest read (`tileOf` the entity point) and `runFire`'s entity tile disagree. That is CORPSEBUMP's code.

**Is the switch ready to flip?** **No.** It is safe: OFF is byte-identical, ON ships no hit (the guard), and no measured
workload loses a solve. But it solves nothing yet. Alone it moves only refusal text. With CPAIR size 3 it reaches the
room's real mechanism, then refuses on the uncertified approach.

**The one thing to know first:** the hold was never preferred over the weigh. The weigh is asked first everywhere, but
of the live world, while the hold is asked under the stance hypothesis. Asked under the same hypothesis, the weigh wins
on L40, and the chain's next gap is the approach volley into the turret's range.

## 3. W0 — the baselines and the census

| row | result |
|---|---|
| base | `git fetch origin main` → `af86d85d`; the designated branch was already there |
| bootstrap | `session_bootstrap.sh --seedling` → READY, node v22.22.0; every non-wasm submodule initialised |
| identity block, pristine worktree at the base (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, the six producer `--check`s exit 0 (r9 campaign `be9c19c8`): **every row equals ICEST's published values**. The reference row read "4 differ" in the worktree; only `registry.js` differs, an artifact of the worktree's symlinked submodules (the main tree: ALL MATCH) |
| `ci-producer-checks --jobs=4` at the base | **95 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm CI runs) |
| bounded set at the base (`bounded-files.txt`: every test naming `deriveCorpseWeigh`, `execCorpseWeigh`, `deriveWeigh`, `stancePrerequisite`, `hold stance`, `l40LatchSolve` or `wandlock@448,432`, plus the L40, corpseBump, hammer and iceTurret rows and `procgenWeigh.test.js`) | the fast files: **37 files, 415/415** (`bounded-base.txt`); the 5 `.slow` files run in D |
| the L40 capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, CPAIR's 52 L40 leg KEYS (`l40-leg-keys.txt`), this tree on :8000: 52 legs (40 done, 12 failed), **60 requests**, 853 at seam 5941, 854 at seam 5450 (`capture-legs.txt`). The capture (~31 MB) is not committed. The tree's `solverBot.js` was edited while the page ran; every edit was OFF-identical or env-gated, and the page's worker has no `process` |

**The instrument** (scratch, env-gated `LW_TRACE`, removed before the I commit). It logs every `deriveWeighSource` answer
for a weigh activator at three sites: `resolveWeighStrategy` (the order), guard (iii) (`stanceHypothesis`) and
`stancePrerequisite`. Each row has the obstacle, the player, the block/parked/corpse answer and the rejects. It decides
nothing. The rows are `census-latch-off.txt`, `census-survey-off.txt` / `-on.txt` and the `trace` field of
`radius-off.jsonl`. `stancePrerequisite` never fired on these workloads.

## 4. M — the design table and the scratch measurements

| design | latch chain (alone) | + CPAIR size 3 | verdict |
|---|---|---|---|
| OFF | `hold stance` → t271 `bob@736,800` | (+ICEST +OPP) t833 ICEST's arm refuses | |
| **1: reorder where the hold stance is in a live turret's range** (`latch-on.txt`, `latch-on-cp3.txt`) | `weigh stance` → t271 | the mechanism runs; the approach hit refuses at t1245 | **chosen** |
| 1, first cut: no stance on the order (`scratch-design1-no-stance.txt`) | `weigh -> kill stance (up)` ×3: the strategy bound at **t6** | — | loops |
| 1, "always" (no range test) (`scratch-design1-always.txt`) | = design 1 | — | the same here; the range test is the narrower claim |
| 2: the reject fixed inside `deriveCorpseWeigh` for every caller, with the caller's contacts (`scratch-design2.txt`) | refuses at **t0**: *"no REACHABLE stance inside button@816,400"* | — | worse; changes fidelity's callers |
| 2 without the contacts (`scratch-design2-no-contacts.txt`) | = OFF (the player on the latch cannot plan out of its own presser) | — | inert |

The "on this side" gate's history is in its own docblock: survey step 93 measured a weigh raised from outside the pocket
that looped. Design 1 keeps that gate for every existing caller. It asks the weigh under the hypothesis only from the hold
fallback, and only where the hold would stand in a live turret's range.

The other OFF switches on the latch chain, ON (`latch-on-*.txt`; OFF twins `latch-off-*.txt`): ICEST alone, OPP alone =
ON's t271. `orbitFreeAim` + `strategyBoundDistinct` = t351 on the same bob. CPAIR size 3 (alone, + ICEST + OPP) = the
t917 hit, refused at t1245. CPAIR size 3 + `orbitFreeAim` + `strategyBoundDistinct` (± ICEST ± OPP) = the second bump's
`runFire` refusal. The unguarded scratch arms (`scratch-unguarded-*.txt`, and its replay `scratch-unguarded-on-cp3-replay.txt`)
show item 3 of §2. With `strategyBoundDistinct` the bound still stops it at t3502, and with `orbitFreeAim` alone it ends
at the second bump.

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, beside `ICETURRET_STATIC_KILL`):
- `LATCH_WEIGH_FIRST = { enabled }` (`SEEDLING_LATCH_WEIGH_FIRST === '1'`), `LATCH_WEIGH_FIRST_DEFAULT = false`,
  `withLatchWeighFirst(enabled, fn)`;
- `LATCH_WEIGH_FIRST_COUNTS.asked` (written only ON, read by nothing that decides) and `resetLatchWeighFirstCounts()`.

The code:
- `resolveWeighStrategy`'s hold fallback: ON, the hold is resolved as before, then `latchWeighFirst` may replace it;
- `latchWeighFirst`: the live turrets within `attackRange` of the hold's stance (`Math.trunc` of the distance, the game's
  `int`); then `stanceHypothesis` → `bagWithDischarged`, with the discharged activators' and rocks' volumes exempt, and
  `deriveWeighSource(…, { liveBag })`. A corpse plan of an in-range turret (and no block plan, nothing parked) becomes a
  corpse resolution. It carries the kill stance (`corpseKillSide` off the snapped box), the hypothesis exemptions plus the
  turret's, and a `rejected` row naming the hold;
- the frontier: with `plan.resolved.latchWeighFirst`, the hits before the stance walk are counted, and a hit by the
  verb's end refuses by name.

`deriveCorpseWeigh`, `execCorpseWeigh`, `killForCorpse` and `deriveWeighSource` are unchanged. OFF, the code runs one
`LATCH_WEIGH_FIRST.enabled` test in the fallback and one `latchWeighFirst` property read per applied frontier order.

**The rows:**

| row | asserts |
|---|---|
| ships OFF (fast) | `LATCH_WEIGH_FIRST_DEFAULT` false; `enabled` follows the env; `withLatchWeighFirst` toggles it |
| `C2-no-block`, no turret (fast) | the weigh's hold fallback (*"no pushable block at all"*); ON's answer = OFF's byte for byte; nothing asked |
| `C2-no-block` + a live turret beside the button, no Fire (fast) | asked `[{lock@64,80, t0, taken: false, inRange: [iceturret@96,16]}]`; ON = OFF |
| `C2-no-block` + a turret out of range (fast) | nothing asked; ON = OFF |
| L16's committed solve (a block weigh) (fast) | ON = OFF keys and records; nothing asked |
| ICEST's pocket boot (fast, ~33 s) | OFF SOLVED 4495 t through the corpse weigh on `button@480,384`; ON keys identical; nothing asked |
| the latch chain OFF/ON (slow) | OFF `-> hold stance (wandlock@448,432)`, ON `-> weigh stance (wandlock@448,432)`, both 271 ticks on `bob@736,800`; every ask taken, of `iceturret@472,400`, in range |
| the latch chain ON + CPAIR size 3 (slow) | the refusal names the t917 blast and the kill stance (488,445). The refused prefix on a fresh run: hits `[t917 blast]`; the turret first dead on (30,26) after t917; the corpse tiles (30,26) → (30,25) → (30,24); the lock opens with the corpse on (30,24); at the end dead, not removed, the lock open |

No fixture: the rooms are built in the test, and the latch boot is L40LATCH's committed fixture. A "no corpse route" row
on L40 itself is not possible: every switch that removes the route (`fireLiveTurretReach`, `blockSweepBodies`,
`corpseBumpWeigh`) refuses the whole chain at t0 on `button@816,400`, before the reorder is asked. So that row is the
generated gadget with no Fire.

**The mutants** (`tools/mutants.py`, `mutants.txt`; each applied, the rows run, the file restored byte for byte):

| mutant | red rows |
|---|---|
| M1 drop the reorder | the in-range/no-Fire row; the latch chain OFF/ON |
| M2 the range test inverted | the in-range/no-Fire row; the out-of-range row; the latch chain OFF/ON |
| M3 offer a weigh where no corpse route exists | the in-range/no-Fire row |

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| latch chain | 1 | refusal text (`hold stance` → `weigh stance`), the same t271 refusal and ticks |
| latch chain + CPAIR size 3 | 1 | refusal moves (t833 ICEST's arm → t1245 the named approach hit); the mechanism runs in the model |
| 60 L40 requests (`radius-off.jsonl` / `-on.jsonl`) | **2** (853/1, 854/1) | refusal text only; 41 solved both ways |
| legs 853/854 at their captured seams | the same 2; request 0 of each unchanged (the anytime deadline) | refusal text |
| route survey, 240 rows (`survey-off-vs-on.txt`) | **2** (steps 67, 95) | refusal text only; 201 SOLVED / 39 REFUSED both ways |
| r9 campaign | 0 | `solve-seedling-r9-campaign --check` in the producer roster ON |
| producer roster ON | 95 run, **0 red**, 1 skipped | — |
| bounded set ON (38 fast files) | **3**: `fidelityL40Bk2.test.js` "ON: the chain walks the south door's links…", `fidelityL40Res.test.js` "OFF: survey step 93…" and "ON: the re-entry passes to the chest…" | refusal text only (each expects `hold stance (wandlock@448,432)`; ON says `weigh stance (wandlock@448,432)`, the rest equal). They read the process env, so a flip must pin them OFF (fidelity's files; the planner gets it signed) |
| ICEST's pocket boot | 0 | — |

**A flip is not ready** (§2).

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) | OFF **38 files, 421/421** (`bounded-off.txt`) · ON 418/421, the 3 text movers above (`bounded-on.txt`, `bounded-on-movers.txt`) |
| hammer `.slow` files (`hammerDashShape.slow`, `hammerEscapeGenerated.slow`, `hammerIceTurretStatic.slow`, `hammerLatchWeigh.slow`) | 4 files, **6/6** (`slow-hammer.txt`) |
| `ci-producer-checks --jobs=4` | OFF: 95 run, every producer exit 0, and the battery's TREE-MOVED row red, which was my own doc edits written mid-run (`producer-off.txt`). Re-run on a frozen tree at `bd086e44`: **95 run, 0 red**, 1 skipped (`producer-off-frozen.txt`) · `SEEDLING_LATCH_WEIGH_FIRST=1`: **95 run, 0 red**, 1 skipped (`producer-on.txt`) |
| identity block at the head `bd086e44` (`identity-after.txt`) | **every row byte-identical to W0**; the reference row reads ALL 7 MODULES AND 5 REGIONS MATCH (W0's "4 differ" was the base worktree's symlink artifact) |
| `census-seedling-solver-surface --check` | RED on site counts → `--write` → GREEN, **360 rows** (no new row); committed with I |
| `census-seedling-constants --check` | PASS (6999 literals, 0 new) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README word counts, docs index) → ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS, 415 PASS, 0 FAIL** (`wasm-ship.txt`) |
| JSUT at `5903c0ed` (run 40736446491) | **success**: vitest 23954/23954, **slow battery 275/275** (both latch rows included) |
| **JSUT at `bd086e44` (run 40743537910)** | **success**: vitest 23954/23954, **slow battery 275/275** |

## 7. What the planner's harvest A/B should expect

- **Switch OFF: no movers.** OFF, the solver runs only the `LATCH_WEIGH_FIRST.enabled` test and one property read. The
  evidence: the identity block, the producer roster, the bounded set and every OFF arm above.
- **`SEEDLING_LATCH_WEIGH_FIRST=1` (node half):** the 52-leg L40 sweep and the survey move in refusal text only.
  853/854 request 1 and survey steps 67/95 say `weigh stance (wandlock@448,432)` where they said `hold stance`. No verdict
  flips, and the r9 campaign does not move.
- The page's worker has no `process`, so the env cannot turn the switch on in the browser half of the sweep (OPP's,
  CPAIR's and ICEST's precedent).
- With CPAIR size 3 as well: the latch chain reaches the corpse weigh's mechanism and refuses on the approach hit.

## 8. What the brief got wrong (measured)

- *"Find which of these, or which earlier choice, makes the latch chain pick the hold stance"*: none of the three listed
  conditions. The weigh IS asked (no block, none parked), both keys are ON, and the inventory holds Fire (slots `[0,1]`).
  The cause is the "this side" gate (§2), asked of the live world while the hold is derived under the hypothesis.
- *"Ask the corpse weigh ahead of the hold stance"*: it already is asked ahead; the hold is `resolveWeighStrategy`'s
  fallback. The reorder that works asks it a second time, under the hold's own world.
- *"The latch chain… meets the x≈744 bobs (t271) and then the turret, which has no hitless kill from below"*: with the
  weigh the turret's kill IS hitless (`killForCorpse`'s circling kill, fork-certified, from the 'up' side). What is not
  hitless is the walk into its range to the kill stance.
- *"each step is game-modelled (the turret's death, the corpse's slide, the button held)"*: they are, on a replay of the
  model (the slow row). They are not game-witnessed here: no wasm probe was run (the planner's).
- The branch: the harness designated `claude/l40-latch-corpse-weigh-uveext`, so that is where the commits are.

## 9. Residue and hand-overs

- **To the approach (strategy / kill layer):** the walk into a live turret's range to `killForCorpse`'s stance is not
  certified. With CPAIR size 3 a volley drawn at the arrival lands at t917. A volley-aware approach (an entry timed to the
  turret's clock, or the stance walk tried on forks as `killIceTurretOnWalk` does) is the arm this needs. ICEST measured
  that its own fork-certified approach from below finds no hitless try on the latch chain, so the turret's clock is the
  likelier lever.
- **To fidelity (CORPSEBUMP, `execCorpseWeigh`):** with `orbitFreeAim` ON the first bump leaves the corpse where
  `execCorpseWeigh`'s rest read says "not yet at the presser" and `runFire`'s entity tile says "already on (30,24)". The
  second bump then refuses as a BotDriverV2Error with no `perTick` on the refusal.
- **To the strategy bound:** past the hit, the chain needs a fifth distinct order (`pushableblock@576,560`'s shove), and
  `strategyBoundDistinct` counts distinct orders, so it does not lift the bound here.
- **To fidelity (rows):** `fidelityL40Bk2.test.js` (1 row) and `fidelityL40Res.test.js` (2 rows) read the process env and
  move in refusal text ON. A flip must pin them `withLatchWeighFirst(false, …)` (fidelity's files; the planner signs).
- **Not touched:** the press kill, `strikePolicyFor`, `pressKillCost.js`, the chooser, `killIceTurretOnWalk`,
  `deriveCorpseWeigh`, `execCorpseWeigh`, every fidelity file.
- **The capture** (60 requests, ~31 MB) is not committed; `l40-leg-keys.txt` and `capture-legs.txt` name it.

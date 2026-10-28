# Seedling hammer-phase CPAIR — the removal chooser answers a chaser pair (`CHOOSER_PAIR`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-chooser-pair` (planner `seedling-hammer-phase-planning-2`), cloud |
| Start SHA | `34d6220a` (main, "Merge origin/main ce84ec369b (G11 graphics) into the OPP harvest") |
| Head | code and evidence `e0945610` (CI green there); this report is the commit after it |
| Branch | `claude/seedling-hammer-chooser-pair-fdae4c` (the harness's designated branch; the brief's `seedling-hammer-chooser-pair` name was not used) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-chooser-pair-evidence/` |
| Scope messages | none arrived mid-run |

## 2. The answer first

**The pair the brief names is not what blocks L40.** `bob@736,752` + `bob@736,800` removed together **never** admit a
corridor. Every empty-chooser climb on the L40 Boss Key 2 legs needs a THIRD body as well:
- on leg 853 (Boss Key 2 from `in_L39_144_0`), at its captured seam and across all 45 arrival clocks of one hammer
  period, the third body is `bobsoldier@880,832`. Its volume covers the burn stance's aim (`COVERED GOAL`);
- on the latch chain's walk back west (L40LATCH's `latch-boot.json`, t271), the third body is `iceturret@472,400`, a
  static. Removing every live chaser at once still admits nothing there.

**The chooser census** (§3), counting climbs where the chooser is empty, ≥2 live chasers are near the hit, and some pair
admits a corridor:

| workload | empty climbs | a chaser in the hit | **a pair admits** | needs ≥ 3 chasers | needs a static |
|---|---|---|---|---|---|
| 60 captured L40 requests, each at its own seam | 46 | 36 | **0** | 36 (L40 west bobs + `puncher@128,624`; 853/375's x≈744 trio) | — |
| leg 853/1, 45 seams (each climb counted per pass) | 176 | 84 | **18** (all `bob + bobsoldier@880,832`; 14 with the hit's own bob, the pair the arm asks) | 66 | — |
| latch chain (L40LATCH staging, holdWaitPriced + chaserOrbitKill ON) | 1 (t271) | 1 | **0** | 0 | 1 (`iceturret@472,400`) |
| route survey (240 rows) | 14 | 0 with a partner | **0** | 0 | — |
| L16: `r9-solve-16` and the whole r9 campaign | **0** | — | 0 | 0 | — |
| generated: killgate s2/s5/s9, the ENEMY census | 0 / 9 | 0 with ≥ 2 live | **0** | 0 | — |

**The design chosen: a pair hypothesis in the climb (design 1), behind `CHOOSER_PAIR`, OFF, with `size: 3` as a
measurement arm.** Both of the brief's designs were measured. Design 2 scoped ("the hit's chaser, only where the chooser
is empty AND a pair admits") hands the kill rung the same first body as design 1, by construction. The rung reads
`removable[0]` and `interceptOrder(removable, hit)[0]`, and both are the hit's chaser. So the real contrast is design
1 vs design 2 UNSCOPED: L40LATCH's scratch, the hit's chaser whenever the list is empty. Design 2 unscoped hands out
bodies whose removal admits nothing, which is the scope C1 ruled out. Design 1 keeps the chooser's own question ("does
the removal admit a corridor") and only widens the hypothesis from one body to two.

**The measured effect** (§4, §5):

| workload | OFF | pair (D1) | D1 + OPP ON | size 3 | unscoped (D2u) |
|---|---|---|---|---|---|
| leg 853 at its captured seam 5172 | EXH on `bobsoldier@880,832` | identical | — | text moves, same body | text moves, same body |
| 853/1 over 45 seams | bobsoldier 13, bob@736,800 13, bob@736,752 16, "every key set" 3 | **7 move**: 4 to bobsoldier, 1 same body, **2 kill bob@736,752 then die** in the `spinner@816,848` press kill (5196/5197) | **5 move** (of OPP's own 24/11/7/3): 3 to bobsoldier, 2 same body, **no death** | **42 move**: 40 to bobsoldier, the same 2 deaths | **42 move**, byte-identical answers to size 3 |
| 60 L40 requests | — | **60/60 identical** | — | **52/60**: 367/371/373 (×2 requests) **SOLVE**; 375/0 and 853/1 move | not run |
| latch chain | t271 refusal on `bob@736,800` | identical | — | inert (the third body is a static) | bobs die, t577 refusal on `iceturret@472,400` (L40LATCH's scratch, reproduced) |
| route survey | 240 rows | **240/240 identical** (ms aside) | — | inert by the census (no climb asks) | — |
| r9 campaign `--check` | EXIT 0, 161 PASS | EXIT 0, 161 PASS | — | inert by the census | EXIT 0, 161 PASS |

**Does the chaser arm kill the pair, one at a time, in the model?** Where a pair admits, yes, the first one. At 853/5196
the pair `[bob@736,752, bobsoldier@880,832]` admits, and the chaser arm kills `bob@736,752` at t855 (`strikeBodies` no
longer holds it). The re-climb's pair is then the bobsoldier's, and no arm kills a BobSoldier hitless: the chaser arm
finds no stance, and the orbit arm's 20 forks are all hit. The two x≈744 bobs are never both killed by the pair arm,
because they are never a pair that admits.

**What the chain meets next:** `bobsoldier@880,832`, on 40 of 45 seams with size 3 or D2u. The other blocker is the
press kill's chaser death to `bob@736,800` (5196/5197, OFF only; OPP ON removes it). On the latch chain it is
`iceturret@472,400` (unscoped arm only; no chooser set admits there).

**Does OPP ON change the answer?** Yes, at 5196/5197: OPP's strikes remove the press-kill death the pair arm walks into.
With OPP ON the pair moves 5 seams, none to a death.

**Is the switch ready to flip?** **No, not for the pair. It is safe and inert where it is not useful.** No measured
workload solves with it: 60/60 L40 requests, 240/240 survey rows and the r9 campaign are unchanged. On 853 it only moves
a refusal from a bob to the bobsoldier, or into a press-kill death that OPP clears. **The size-3 arm is the one worth a
dispatch:** it solves legs 367, 371 and 373 (L40 → the L43 pits) in the model. It needs the planner's game witness (TT)
and the sweep A/B before anyone weighs a flip.

**The one thing to know first:** the x≈744 corridor is held by THREE bodies, not two. The chooser gap is a triple, and
its third member is fidelity's BobSoldier (wave 33) or the next slice's IceTurret.

## 3. W0 — baselines and the census

| row | result |
|---|---|
| base | `git fetch origin main` → `34d6220a`; branch `claude/seedling-hammer-chooser-pair-fdae4c` reset onto it |
| bootstrap | `session_bootstrap.sh --seedling` → READY, node v22.22.0; the six non-wasm submodules initialised |
| identity block at base (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; all six producer `--check`s exit 0; reference ALL MATCH; EXIT 0 |
| `ci-producer-checks --jobs=4` | **not run at the base** (the box was held by the L40 capture and the census replays); the identity block's six producer `--check`s exit 0 there. At the head, OFF and ON: 94 run, 0 red (§6) |
| bounded set (41 at base, 42 at the head with `hammerChooserPair.test.js`; every test naming `chooseBodyToRemove`, `hitSourceBodies`, `CHOOSER_HIT_SOURCES`, `deriveKillByChaser`, `interceptOrder`, every L40/hammer/L1516 row, every `r9-solve-16` row) | base 41 files, 857 passed + 1 skipped (a row that needs the wasm submodule, absent in the base worktree) |
| the L40 capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, the 52 L40 leg KEYS (L40LATCH's list), this tree on :8000. 52 legs (38 done, 13 failed, 1 timeout), **60 requests**. Boss Key 2's ids are **853/854**, as the brief said. The capture (~31 MB) is not committed; `l40-leg-keys.txt` is |

**The instrument** (`tools/census.patch`, applied in a scratch worktree only): on every climb it logs the chooser's
list. Where the list is empty, it asks:
- which pairs from (the hit's live chasers ∪ the 6 live chasers nearest the hit point) admit a corridor;
- whether removing EVERY live chaser admits one, and every volume;
- for the hit's chaser plus its nearest partner, which single extra volume completes the set (`basePlusOne`).

It asks the chooser's own question (`dangerVolumes` minus the set → `plansReach` / `planWaypoints`) and decides
nothing. 853/1's answer with the patch equals the clean tree's (`8a47a2637b4d`).

The census rows are `census-radius.jsonl`, `census-853-seams.jsonl`, `census-latch.jsonl`, `census-survey.jsonl`,
`census-r9.jsonl` and `census-enemy.jsonl`. Their classification is the table in §2. The named climbs:
- **853/1**, 45 seams: t0 (`spinner@880,848`, C1 admits it, so no pair is asked) and t762–t943 at the burn stance's walk.
  The admitting pairs are `[bob@736,752, bobsoldier@880,832]` (t779, t919) and `[bob@736,800, bobsoldier@880,832]`
  (t878, t879, t943).
- **The latch chain**, t271, hit `bob@736,800` at (744.3, 767.4): `allChasersAdmit: false`, `allVolumesAdmit: true`,
  and the base pair plus one is `iceturret@472,400`.
- **The radius**: 36 empty climbs with a chaser in the hit, every one t0 or 375/0 t810 and 853/1 t858; 23 distinct.
  Legs 363–390 at t0 (hit `bob@208,448` / `bob@192,480`) need ≥ 3 chasers, the third mostly `puncher@128,624`.
- **L16** (`r9-solve-16`, the r9 campaign): 4 climbs in the whole campaign, none empty.
- **Generated**: killgate s2/s5/s9 never reach the chooser; the ENEMY census's 9 empty climbs have 0–1 live chasers.

## 4. M — the design table and the scratch measurements

| design | what it hands the kill rung | 853 (45 seams) | L40 radius | latch | L16 / campaign | verdict |
|---|---|---|---|---|---|---|
| D1 pair (`choosePairToRemove`) | `[hit chaser, partner]` where their joint removal admits | 7 move (2 kills → press-kill death; OPP ON: 5, no death) | 60/60 | inert | unchanged, never asked | **BUILT** (the brief's design 1) |
| D2 scoped (hit chaser, only where a pair admits) | `[hit chaser]` on exactly D1's climbs | = D1 at the rung (same `removable[0]`, same `interceptOrder` head) | = D1 | = D1 | = D1 | folded into D1 |
| D2 unscoped (L40LATCH scratch, `tools/d2u.patch`) | `[hit chaser]` wherever the list is empty | 42 move (40 → bobsoldier, 2 deaths) | not run | bobs die, t577 `iceturret@472,400` | campaign EXIT 0, 161 PASS; `r9-solve-16` re-derives | not built: it hands out bodies whose removal admits nothing (C1's scope) |
| D1 size 3 (`SEEDLING_CHOOSER_PAIR_SIZE=3`) | `[hit chaser, p, q]` where the triple admits | 42 move, byte-identical to D2u | 52/60: **367, 371, 373 SOLVE** (6 requests) | inert | inert by the census | shipped as the measurement arm |

The seam tables are `seams-853-*.jsonl` and their `*-vs-*.txt` comparisons. The latch runs are `latch-off.txt`,
`latch-d1.txt` and `latch-d2u.txt`; the radius comparisons are `radius-d1-vs-off.txt` and `radius-size3-vs-off.txt`.

**The size-3 solves.** 367/0 (`level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_21`):
- OFF it is a deadline refusal (work 642 of 640);
- with size 3 the set `bob@192,480` + `bob@224,496` + `puncher@128,624` admits, and the arm kills `bob@192,480` at t745
  (dead in the model);
- the walk then crosses to the L43 pit: 955 ticks, work 425.

371 and 373 are the same leg family to the next pit tiles (938 and 909 ticks on the full pass).

**375/0** under size 3 moves from EXH on `bob@736,800` (work 102) to a deadline refusal (work 643). **853/1** keeps the
bobsoldier as the named body.

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, beside `CHOOSER_HIT_SOURCES`):
- `CHOOSER_PAIR = { enabled, near: 4, size: 2 }`: `enabled` is `SEEDLING_CHOOSER_PAIR === '1'`, and `size` is 3 only with
  `SEEDLING_CHOOSER_PAIR_SIZE=3`;
- `CHOOSER_PAIR_DEFAULT = false`, `withChooserPair(enabled, fn)`;
- `CHOOSER_PAIR_COUNTS` (`asked`, `sets`, `admitted`, `last`, `gone`, `kills`; written only ON, read by nothing that
  decides) and `resetChooserPairCounts()`.

The code is `choosePairToRemove`, a closure beside `chooseBodyToRemove` that asks the same existence question. The
climb calls it after C1, only while the list is still empty. The chaser arm's two exits record a set body's kill into
`kills`. OFF, the only new statement the climb executes is the `CHOOSER_PAIR.enabled` test.
- `solverView.js` needs no change: it re-exports simulation symbols INTO the solver family, and the switch lives in
  `solverBot.js`, a family file (§8).
- `census-seedling-solver-surface --write` moved site counts only (`chasers`, `strikeBodies`, `run.state`, `run.world`).
  There are no new rows to classify.

**The rows** (`hammerChooserPair.test.js`; fixtures `fixtures/hammer-cpair/`, three captured requests cut to their
levels, 10–11 KB each). Each cut answers byte-identically to the full capture: 853 at 5194 OFF `b6790a73`, ON
`c5bd2355`; 367 OFF `b577ea0f`, size 3 955 t.

| row | asserts |
|---|---|
| ships OFF | `CHOOSER_PAIR_DEFAULT` false; `enabled` follows the env; `size` 2 |
| 853 at 5196 | OFF: EXH at the burn stance on `bob@736,752`, BAIT's "NO LIVE BODY's removal admits a corridor", `asked` 0. ON: `last` = `[bob@736,752, bobsoldier@880,832]`, `kills` = `[{bob@736,752, t855, dwell, dead}]`, refusal moves to the `spinner@816,848` press kill (t1046 on the dashless pass) |
| 853 at 5172 | only triples admit: `asked` > 0, `admitted` 0, ON = OFF (ok, work, message) |
| 356 (control) | every climb answered singly: SOLVED, `asked` 0, ON = OFF (plan) |
| 367, size 3 | OFF deadline refusal; pairs only: asked, none admitted; size 3: SOLVED 955 t, `last` the triple, `bob@192,480` dead at t745 |
| the L16 guard | ON, `r9-solve-16` re-derived from its tape: 655 t, inputs equal to the committed tape's, `admitted` 0 |

**The mutants** (`mutants.txt`, `tools/mutants.py`; each run against the file, then restored):

| mutant | red rows |
|---|---|
| M1 drop the pair hypothesis | 5196, 5172 |
| M2 drop the empty-list scope (pairs asked ahead of a non-empty list) | 356 |
| M3 offer sets whose joint removal admits nothing | 5196, 5172 |

The L16 guard reds under none of them. At this base no climb on `r9-solve-16` reaches an empty list, even with chasers
unscoped (D2u re-derives it too), so the guard is a regression row, not a discriminating one (§8).

**The ON radius by mover class** (pairs, size 2):

| workload | movers | class |
|---|---|---|
| 60 L40 requests | 0 | — |
| 853/1 × 45 seams, OPP OFF | 7 | 4 refusal names the bobsoldier instead of a bob (no kill: the admitted pair's head is the bobsoldier); 1 same body, new text; **2 kill `bob@736,752`, then the press kill dies** (a refusal; no tape ships a hit) |
| 853/1 × 45 seams, OPP ON | 5 | 3 refusal on the bobsoldier instead of a bob; 2 same body, new text |
| route survey | 0 | — |
| r9 campaign | 0 | — |
| bounded set | 0 | — (864/864 ON) |
| producer roster ON | 94 run, **0 red**, 1 skipped | |
| identity block | every row byte-identical to W0 (`identity-after.txt`), EXIT 0 | |

**A flip is not ready** for the reason in §2: nothing solves with pairs. The size-3 arm's three solves are model-only.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) | OFF 42 files, **864/864** · ON 42 files, **864/864** |
| hammer `.slow` files (`hammerDashShape.slow`, `hammerEscapeGenerated.slow`) | 2 files, 2/2 |
| `ci-producer-checks --jobs=4` | OFF 94 run, **0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, a browser arm CI runs) · `SEEDLING_CHOOSER_PAIR=1` 94 run, **0 red**, 1 skipped. The first pass of each read `1 red`: `TREE-MOVED`, from my own doc edits during the run, with every producer at rc 0; both were re-run on the frozen tree |
| identity block at the head | every row byte-identical to W0 (`identity-after.txt`), EXIT 0 |
| `census-seedling-solver-surface --check` | RED on site counts → `--write` → GREEN, 360 rows |
| `census-seedling-constants --check` | PASS (6977 literals, 0 new) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README word counts, docs index) → ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless (:8000) | EXIT 0, **415 PASS, 0 FAIL** (`wasm-ship.txt`) |
| JSUT at `3aed2d79` (run 40576572482) | slow battery **271/271**; 3 red in `seedlingSolverSurface.test.js` (the surface census, re-written in the next commit) |
| JSUT at `d64aef4c` (run 40584312980) | slow battery **271/271**; 1 red, `lintGateLabels.test.js` (the triple row's name over a `CHOOSER_PAIR.size` read; fixed in `e0945610`) |
| **JSUT at `e0945610` (run 40592830721)** | **success**: vitest 23721/23721 (0 failed), **slow battery 271/271** |

## 7. What the planner's harvest A/B should expect

- **Switch OFF: no movers.** OFF, the climb runs one new test, `CHOOSER_PAIR.enabled`, and nothing else is read or
  written. Evidence: the identity block, the producer roster, the bounded set and wasm-ship above.
- **`SEEDLING_CHOOSER_PAIR=1` (node half):**
  - the L40 sweep moves only where 853/854's clocks land on one of the 7 pair seams;
  - the survey and the campaign do not move.
- **`SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3`:**
  - legs 367/371/373 should SOLVE in node; the game witness is TT's;
  - 853 should move to `bobsoldier@880,832` on most seams;
  - 375/0 should move to a deadline refusal.
- The page's worker has no `process`, so the env cannot turn the switch on in the browser half of the sweep (OPP's
  precedent).

## 8. What the brief got wrong (measured)

- *"No SINGLE removal does, so its list is empty"* + *"some PAIR … admits a corridor"*: the x≈744 pair never admits.
  The blocked climbs are triples: the bobsoldier on 853, the IceTurret on the latch chain.
- *"Boss Key 2 … refuses at the burn stance: combat ladder EXHAUSTED on `bob@736,752`"*: at this capture's own seam
  (5172) it refuses on `bobsoldier@880,832`. On the other seams it is bob@736,752 16, bob@736,800 13, bobsoldier 13 of
  45, which is OPP's 847 table exactly.
- *"`r9-solve-16` must keep its DETOUR answer"*: it does, but at this base no climb on L16 or anywhere in the r9 campaign
  reaches an empty list, even with chasers unscoped. C1's regression does not reproduce, so the L16 guard cannot red.
- *"`solverView.js`: its re-export"*: `solverView.js` is the door for simulation symbols into the solver family, and it
  exports nothing of `solverBot.js`'s. The switch needed no line there.
- *"`fixtures/l40latch-witness/` if on main"*: it is on main (`latch-boot.json`, the orbit chain and the stand witness).
  The latch chain reaches the walk back only with `holdWaitPriced` + `chaserOrbitKill` ON.
- The branch: the harness designated `claude/seedling-hammer-chooser-pair-fdae4c`, so that is where the commits are.

## 9. Residue and hand-overs

- **To fidelity wave 33 (L40BK2B, `bobsoldier@880,832`):** every Boss Key 2 path past the x≈744 bobs, with pairs, triples
  or unscoped chasers, stops at the bobsoldier. Its volume covers the burn stance's aim (`COVERED GOAL`). The chaser arm
  finds no hitless stance, and the orbit arm's 20 forks are all hit, at orbit tick 30, by `bob@736,752`. Once the
  bobsoldier can die (or the burn stance can be stood beside it), the triple arm hands the bobs to the chaser arm in
  order.
- **To the next hammer slice (`iceturret@472,400`):** the latch chain's walk back to `wandlock@448,432`'s hold stance needs
  the IceTurret gone with both bobs. No chaser set admits until it is. The static arm has no IceTurret death; the aim
  (30,24) is beside the turret.
- **The press kill's chaser death** (853/5196, 5197 with pairs, OFF): after the pair arm kills `bob@736,752`, the
  `spinner@816,848` press kill dies to `bob@736,800`. OPP ON removes it. That is OPP's and PKC's, not the chooser's.
- **The size-3 arm** is the useful finding: three L40 west legs solve in the model. It needs the planner's TT witness and
  the sweep A/B. A ruling is also needed on whether the shipped hypothesis should be "a set of ≤ 3".
- **The ordering question, not built:** where an admitted set's head is the BobSoldier (5194, 5207, 5208, 5210), the
  kill rung asks only the head. A rung that tried the set's next body (a bob it can kill) would kill the bob and still
  meet the bobsoldier. It would gain nothing until wave 33 lands.
- **The capture** (60 requests, ~31 MB) is not committed. The three cut requests are.

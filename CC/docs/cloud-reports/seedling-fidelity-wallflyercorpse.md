# Cloud report: `seedling-fidelity-wallflyercorpse`

**Wave 45, one slice: `dangerMap.staticEnemyDanger` stops pricing a wallflyer the run no longer holds live, behind one
new OFF key, `wallFlyerCorpseGone`.** Planner: `seedling-fidelity-planning-21`. ⚖ GO: Robert, 2026-11-15, *"GO: OFF key,
flip later (Recommended)"*. No flip, no default change. Source finding: hammer's
`seedling-hammer-wallflyer-gaps.md` (§2, §3, §9 hand-over 1).

## 1. SHAs

| | |
|---|---|
| start (base) | `75e45c964d9ce37b3eb6db3c1e887b9b873b484c` (origin/main, train 115). Defaults: **135 keys, 125 ON**, last `corridorForecastMemo` |
| step 1, the key + rows | `875b96df` |
| step 2, the family's reader + census/doc regen | `95208a0f` |
| evidence | `76f8360e` (`seedling-fidelity-wallflyercorpse-evidence/`) |
| CI fix | `f224c898` (the witness row's label; **last code head**) |
| head | this report's commit |
| harness branch | `claude/wallflyer-danger-pricing-off-l46vuf` (local name `seedling-fidelity-wallflyercorpse`) |
| head defaults | **136 keys, 125 ON** (the new key is OFF and last) |
| scratch merge (never pushed) | `e5d070eb` = `origin/hammer-flip-wallflyer-kill` `b45422fa82` + `875b96df`, a clean `git merge --no-edit`. Built before step 2; step 2 changes no runtime code (entityBlocks row, census json, docs) |
| wasm / `vendor/seedling` | unchanged; `session_bootstrap.sh --seedling` → READY |

## 2. The answer first

**PASS.** The key is in, OFF is byte-identical, and ON does what hammer's scratch fix did:

- Survey step 35 under the page budget, at the scratch merge (hammer's flip branch + this head), key ON: **SOLVED on the
  first 640 attempt: dashless, 609 t, 530 units, 0 hits, into L29.** The plan is **tick-for-tick identical** (0 differing
  ticks of 609) to hammer's game-witnessed 0-hit tape `witness/walk-step-35-609.json`.
- At this head with `SEEDLING_WALLFLYER_KILL_ARM=1 SEEDLING_WALLFLYER_CORPSE_GONE=1`: the same answer (609 t, 530 units,
  0 hits, L29). **No TypeError:** the 640 attempt answers, so the held retry, where G1's null fork lives, never runs.
- **The one thing to know first:** ON moves **no shipped plan** on seed 1 in node (32 wallflyer-room sweep legs, survey
  steps 33/34/35/41, all wallflyer tests and the train file: 0 movers besides hammer's gap pin). It moves **passes**:
  the dashless pass on 2 legs (#6 505 → 486 t; #8 REFUSED → 482 t), and on step 35 under the page budget, which is where
  the page's first answer comes from. So the flip's evidence is a **budgeted** sweep, not an unbudgeted one (§7).

## 3. D1, the rule from the AS3 (read only)

**(a) The dying span: a dying wallflyer does NOT hurt. Skip it too.**
- `Enemies/Enemy.as:211-221` `hitPlayer()`: `if (!destroy && (!(graphic is Spritemap) || (graphic as Spritemap).currentAnim
  != "die") && hitsTimer <= 0) { … p.hit(this, 3, …) }`. Both halves of the death are gated out.
- `Enemies/Enemy.as:104-111`: `hitPlayer()` runs only `if (!destroy)`, after `super.update()`.
- `Enemies/WallFlyer.as:47-51` `startDeath`: plays `"die"` (no `destroy`); `:99-110` `endAnim`: the end of `"die"` sets
  `destroy = true`. `:56-57`: `update` returns early while `destroy || currentAnim == "die"` (no trigger).
- `Enemy.hit` (`Enemy.as:155-161`) sets `hitsTimer = hitsTimerMax` (30) on the killing blow, so even without the anim gate
  the first 30 ticks could not hit.
- `Player.as`: the only `Player.hit` caller for a wallflyer is `Enemy.hitPlayer` (`Player.as:1374` is the callee; the
  `enemies` list at `:100` is used by the shield's own collision, which is the shield-bump path, not damage).
- Unlike Bob (a dying body hits until removed), a wallflyer's death is harmless from the blow. The model already says so:
  `wallFlyer.js:299` (`w.dieAnim === null` in `hitPlayer`) and `:295` (`!w.destroy`).
- Measured on step 35's 539 t plan (`step35/family-timeline-539.txt`): `wallflyer@48,112` "die" t287, `destroy` t300,
  removed t311; `wallflyer@64,80` "die" t408, `destroy` t421, removed t432.

**(b) A live resting flyer at its placement: not wrong, not changed.** Report only.
- Measured along the same plan (`step35/d1b-live-vs-placement-539.txt`): on t1 `check()` settles each resting flyer 1 px
  INTO its wall (`decideMotion(-moveSpeed)`, `WallFlyer.as:41-45`), so the live box is the placement box shifted 1 px
  wallward (e.g. `wallflyer@144,112` live `[146,113 14x14]` vs placement `[145,113 14x14]`). The 1 px column the placement
  misses lies inside the wall. For a resting body the placement price is the live box to within that column.
- A LAUNCHED live flyer (`wallflyer@144,112` flies t322–359 on this plan) leaves its placement box stale. That is an
  over-forbid (the cell is empty), already named as residue by fidelity CORRIDOR D2 ("the trap-157 cost of the
  placement — a cell a launched flyer has left — is kept"). It is not a double count in the unsafe direction.
- **Why not change it:** the placement arm is the ONLY wallflyer price in `wait` mode. `corridorBodyDanger` is
  transit-only and only when a caller hands the forecast (`dangerAt`, `dangerMap.js` ≈l.2187). Dropping a live flyer's
  placement would leave every wait-mode question about it unpriced. No second sub-change was made.

## 4. D2, the key

`CONTACT_FIDELITY.wallFlyerCorpseGone`, **default OFF**, appended LAST (`contactFidelity.js`), with
`SEEDLING_WALLFLYER_CORPSE_GONE=0|1` (the two env lines) and the worker env name in `solverEnvChannel.SOLVER_ENV_NAMES`
(sorted: between `SEEDLING_WALK_DEATH_REFUSED` and `SEEDLING_WALLFLYER_KILL_ARM`). Doc block (verbatim in the file):

> fidelity WALLFLYERCORPSE D2 (wave 45) — A WALLFLYER THE RUN NO LONGER HOLDS LIVE IS NOT PRICED AT ITS PLACEMENT. …
> The game: a wallflyer touches the player only through `Enemy.hitPlayer`, gated `!destroy && currentAnim != "die" &&
> hitsTimer <= 0` (`Enemies/Enemy.as:211-221`), called from `Enemy.update` only when `!destroy` (`:106-111`);
> `WallFlyer.startDeath` plays "die" (`Enemies/WallFlyer.as:47-51`) and the anim's `endAnim` sets `destroy` (`:99-110`) …
> ON: a wallflyer whose id has no LIVE row in `run.entities('wallFlyerBodies')` (live = `!destroy && dieAnim === null`,
> the family's own reading) is skipped, when the family is an array. A LIVE flyer keeps its placement price … OFF:
> byte-identical. ⛔ OFF by default (⚖ user 2026-11-15, "OFF key, flip later").

**The change** (`dangerMap.staticEnemyDanger`): ON, one read of `run.entities('wallFlyerBodies')` (the census family,
not the debug getter `run.wallFlyers`) builds the set of LIVE ids; after the drill skip, a `wallflyer` whose id is not in
it is `continue`d. OFF the family is not read at all (`wallFlyerFamily = null`), so OFF is byte-identical by construction.
This is hammer's scratch form (absent, or `destroy`, or `dieAnim`), restated as a set.

**Pins that list keys** (each gains `wallFlyerCorpseGone` at the end): `fidelityCeremony126`, `fidelityFrozenPress`,
`contactFidelity.test.js` (the defaults row `wallFlyerCorpseGone: false` and its env skip), and the order pins in
`fidelityDrillWater`, `fidelityFencepost`, `fidelityFireBreak`, `fidelityFireSpinner`, `fidelityL39Phantom`,
`fidelityRockGone`, `fidelityRockFire`, `fidelityRockButton`. The newest key's `.at(-1)` pin moves from
`fidelityCorridorBody.test.js` (now: `corridorForecastMemo` is followed by `['wallFlyerCorpseGone']`) to the new test.

**The family's first solver reader** (step 2): `entityBlocks` D2 holds `solverReads` to a grep, so
`wallFlyerBodies.solverReads = ['dangerMap']`. Then `census-seedling-solver-surface --write` (375 rows; `run:entities`
gains `wallFlyerBodies: {dangerMap.js: 1}`; the `CONTACT_FIDELITY` import table +1 `dangerMap` site), the surface doc
(the table's "Read by" `dangerMap`; **Modelled** gains `wall-launch (wallFlyerBodies)` and the family under `contact`/`hp`;
**Not modelled** loses `wall-launch`: the same two lines hammer's step 2 wrote), `seedling-bot.md` gains the key's
paragraph, and `generate-procgen-reference` regenerated the docs index (word counts). ⚠ Harvest: hammer's branch writes
`solverReads: ['solverBot']` on the same line; the union is `['dangerMap', 'solverBot']` and the surface json needs one
more `--write` after the merge.

## 5. Rows + mutant

`fidelityWallFlyerCorpse.test.js` (fast tier, 7 rows, ≈3 s). Witness: step 35's boot fixture (L22) plus the step's
unbudgeted 539 t plan, **inlined as run-length keys** so the slice adds no fixture (provenance: hammer's
`fixtures/wallflyer-gaps/survey-step-35-plan-539.json` at `b45422fa82`, blob `25cdfaf394`). The replay reads no solver
switch, so the arm's env is irrelevant to it (measured: the rows pass with `SEEDLING_WALLFLYER_KILL_ARM=1` too).

| row | OFF priced | ON priced |
|---|---|---|
| the key: ships OFF, last, env name known | — | — |
| the witness: `${ALL.length}` flyers, the `${PLAN.length}` t plan, L22 and 0 hits at every read tick | — | — |
| t0 and t286, all live | all 4 | all 4 |
| **t287 DYING** (`dieAnim`, no `destroy`) | all 4 | 3 (not @48,112) |
| **t300 FADING** (`destroy`) | all 4 | 3 |
| **t311 REMOVED** (@48,112 left the family) | all 4 | 3 |
| **t432**, hammer's ghost tick | all 4 | `['wallflyer@128,80', 'wallflyer@144,112']` |

**Mutants (copy + restore, both predicted before running):**
- M1, drop `&& !w.dieAnim` (price a dying body until `destroy`). Predicted: only the t287 row reds. **Measured: 1 failed
  (t287), 6 passed.**
- M2, disable the skip (`if (false && …)`). Predicted: the four post-kill rows red. **Measured: 4 failed (t287, t300,
  t311, t432), 3 passed.**

## 6. Byte-inertia OFF

| | |
|---|---|
| `git diff --name-only 75e45c964d HEAD \| grep -aE 'fixtures/\|golden\|tapes/'` | **empty** (rc 1) |
| acceptance md5, base (`75e45c964d`, own worktree) | `391322d681b7aa0229d94b3f6906d024` |
| acceptance md5, head OFF | `391322d681b7aa0229d94b3f6906d024` |
| acceptance md5, head `SEEDLING_WALLFLYER_CORPSE_GONE=1` | `391322d681b7aa0229d94b3f6906d024` (no ON move) |

## 7. D3, the ON-arm measurement

### 7.1 Step 35 under the page budget

`probe-seedling-page-budget-step.mjs` (hammer's) on `fixtures/wallflyer-drill-kill/survey-step-35-boot.json`,
`--exit=192,64`, 640 + the held 2560 retry (`step35/`):

| where | answer | attempt 640 passes | arm |
|---|---|---|---|
| scratch merge `e5d070eb`, key ON (arm ON by its flip) | **SOLVED 609 t, 0 hits, 0 deaths, L29**, verbs bait/detour/kill | dashless ✓ 609 t, 530 units; full ✗ 112 units (`sword-dash` deadline) | kills @48,112 t134 (1 fork), @64,80 t311 (1 fork); refused @128,80 at t432 (8 forks, HIT at fork tick 30), so the corridor DETOURs it |
| head `95208a0f`-runtime, `SEEDLING_WALLFLYER_KILL_ARM=1 SEEDLING_WALLFLYER_CORPSE_GONE=1` | **the same** (609 t, 530 units, 0 hits, L29) | the same | the same |
| hammer's numbers for comparison | head without the fix: the named EXHAUSTED refusal; base: TypeError in the retry | | |

The merge's plan against hammer's game-witnessed 609 t tape: **609/609 ticks equal** (keys compared per tick through
`heldKeysAt`). At this head **no null-fork TypeError**: the first attempt answers, so the retry never forks.

**Hammer's gap test at the merge** (`hammerWallFlyerGaps.test.js`, key ON): unflipped, the gap row reds (expected: the
model gap is closed); flipped, **3/3**. **The one-line pin diff for hammer:**

```diff
-        expect(priced).toEqual(['wallflyer@64,80', 'wallflyer@128,80', 'wallflyer@48,112', 'wallflyer@144,112']);
+        expect(priced).toEqual(['wallflyer@128,80', 'wallflyer@144,112']);
```

⚠ The flipped pin reds with the key OFF (measured), so it lands **with the key's flip**, or as
`CONTACT_FIDELITY.wallFlyerCorpseGone ? [two] : [four]` until then. The row's title ("…still prices both there") wants
the same edit.

### 7.2 The mover census

**Which legs the key can touch.** Only a room holding a `wallflyer` (`seedling-map.json`): **L22 (4), L25 (2), L27 (1)**.
L28/L88/L91 hold drills only and are untouched by construction (the skip tests `inst.tag === 'wallflyer'`). Within those
rooms a solve can move only if `staticEnemyDanger` is asked while some flyer of the visit is no longer live, which needs a
kill earlier in the same visit (sword, spear, the dark suit/shield, water/lava/pit). **Method, exact:** a scratch counter
in the scratch head worktree's `staticEnemyDanger` (`drivers/touch-counter.patch`, never committed) counts `seen` (a
non-live flyer skipped) and `touch` (skipped AND overlapping the asked box = an answer that differs from OFF). A solve
with `touch = 0` is byte-identical to OFF.

**The 32 sweep legs** (sweep 43136081951's `legs.jsonl`, `rows.jsonl`, `delivered-set.json`; hammer's drill-kill
`inv-leg.mjs`, ANYTIME_PASSES; arm ON by env on both arms; `census/`):

| | key OFF | key ON |
|---|---|---|
| shipped plan solved / hitless | 32 / 32 | 32 / 32 |
| shipped-plan movers (ok, ticks, verbs, end, hits) | — | **0** |
| legs with `touch > 0` | — | **2**: #6 `level_22 <- in_L25_144_32 -> exit:out_teleporter_96_0` (touch 1), #8 `level_22 <- in_L25_144_32 -> exit:out_teleporter_192_64` (touch 17) |
| legs with `seen > 0`, `touch = 0` | — | 1: #31 `level_27 <- in_L28_128_304 -> exit:out_teleporter_32_0` |
| **pass-level movers** | | **#6** dashless 505 → **486 t**; **#8** dashless **REFUSED → 482 t**. The full pass (132 t / 207 t) is shorter and ships on both arms |

Under the page budget (`BUDGET=640 WINDOW=85`, `census/budget-640-legs-6-8-31.jsonl`): the same picture. #6 dashless 505
→ 486, #8 dashless refused → 482, shipped full pass unchanged (132 / 207 t, 0 hits); #31 identical.

**Survey steps in those rooms** (`--through=end --route=full --only=33,34,35,41`, arm ON by env, `survey/`): the route
survey holds only these four wallflyer-room steps (L27 is not on it; the L28/L88/L91 steps are drill rooms). OFF and ON
are **identical except wall time**: 33 SOLVED 113 t, 34 SOLVED 108 t, 35 SOLVED 539 t, 41 SOLVED 126 t, 0 hits each. The
survey is unbudgeted, so step 35 ships its full pass on both arms; the key's effect on it shows only under the page budget
(§7.1).

**Tests with the key ON** (each run alone):

| file | where | arm | result |
|---|---|---|---|
| `hammerWallFlyerDrillKill.test.js`, `fidelityWallFlyer.test.js`, `fidelityWallFlyerCorpse.test.js`, `wallFlyer.test.js` | head | default (OFF here) | 31 passed, 1 skipped (the "ships OFF" row skips under the env) |
| the first three | head | `SEEDLING_WALLFLYER_KILL_ARM=1` | 24 passed, 1 skipped |
| `hammerWallFlyerDrillKill.train.test.js` (the only `.train.` file naming those rooms, of 31) | head | default / arm ON | 5/5 / 5/5 |
| `hammerWallFlyerDrillKill`, `hammerWallFlyerGaps`, `fidelityWallFlyer`, `fidelityWallFlyerCorpse` | scratch merge | ON (flip) | **1 failed: `hammerWallFlyerGaps` › "THE MODEL GAP …" (the intended pin flip, §7.1)**, 26 passed, 1 skipped |
| `hammerWallFlyerDrillKill.train`, `hammerWallFlyerGaps.train` | scratch merge | ON | 6/6 (step 35 539 t, step 84 354 t unchanged) |

**ON movers, by file:row: one.** `hammerWallFlyerGaps.test.js` › *"the 539 t plan removes wallflyer@48,112 and
wallflyer@64,80, and `staticEnemyDanger` still prices both there"* (pin flip). Plus the two pass-level movers above
(sweep legs #6, #8), which no committed row pins.

### 7.3 The sweep the planner should run

**The divergence sweep, keyed, over the wallflyer rooms, under the page budget** (the default: the sweep's own budgeted
page solves; that is where the key moves the first answer):
- legs: the 32 keys of `census/keys.txt` (L22 ×16, L25 ×12, L27 ×4), `--keys=` joined with `|`;
- arms: `--contact-fidelity` = the defaults + `wallFlyerCorpseGone` vs the defaults (or `SEEDLING_WALLFLYER_CORPSE_GONE=1`
  vs `=0` through the worker env channel); **`SEEDLING_WALLFLYER_KILL_ARM=1` on both arms** (or run at hammer's flip
  branch, where it is the default);
- shards: **min(10, 32) = 10**, ×1 per arm (2 runs);
- read: `end`, hits, the shipped plan's pass, and legs #6/#8's dashless answers. Expectation from node: 0 shipped-plan
  movers; the page may ship the dashless pass first on #8 (482 t) if the full pass trips its budget there, which is the
  question the sweep answers.
- Plus CI: `unittests_frontend.yml -f train_only=true` at this head (I cannot dispatch: 403), and one survey run at this
  head with the key ON if the planner wants the 250-step identity on the record (node predicts identity: the survey is
  unbudgeted and its 4 wallflyer-room steps do not move).

## 8. Gates

| gate | result |
|---|---|
| bounded vitest BEFORE (base worktree; 29 files: `contactFidelity*`, `dangerMap`, `decisionTrace`, `entityBlocks`, `fidelityCeremony126`, `fidelityFrozenPress`, `fidelityWallFlyer`, `hammerWallFlyerDrillKill`, `wallFlyer`, `levelRun`, `levelRunDigestRead`, `r8Acceptance`, `solverDeadline`, `tapeEnvelope`, + grep hits for `staticEnemyDanger`/`wallFlyerBodies`: `levelRunStateDigest`, `fidelityL39Phantom`, `fidelityDrill`, `fidelityDarkTrap`, `fidelityTurretSnap`, `fidelityCorpseBump`, `fidelityFencepost`, + the key-order pin files) | **29 files, 864 passed** |
| bounded vitest AFTER (the same + `fidelityWallFlyerCorpse`), head `95208a0f` | **30 files, 872 passed** |
| `seedlingSolverSurface.test.js` + `frontend/modules/procgenDocs/` | 9 files, 530 passed |
| `ci-producer-checks.mjs --jobs=3` | 99 run, **0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, browser), 0 known-red |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED |
| `generate-procgen-reference.mjs --check` | ALL 7 MODULES AND 5 REGIONS MATCH (after its own regen in step 2) |
| `census-seedling-solver-surface --check` | GREEN, 375 rows (after `--write`) |
| `census-seedling-constants --check` | PASS (0 new, 0 vanished) |
| CI `JavaScript Unit Tests` at `95208a0f` (run 43755696138) | suite 27891 passed / **1 failed** (`lintGateLabels`: my witness label's typed counts) / 0 skipped; slow 437/437. Fixed by `f224c898` (`lintGateLabels` + the row green locally) |
| CI `JavaScript Unit Tests` at the last code head `f224c898` | **pending when this report was committed**; read it with `node scripts/procgen/ci-vitest-summary.mjs f224c898 --wait` |

`hammerWallFlyerGaps*` do not exist at this base (hammer's branch); they were run at the scratch merge. No pytest, no
unfiltered vitest, no `standing-values --write`.

## 9. What the brief got wrong (measured)

1. **"Stage step 35's room … (L22, the arm ON by env)" for the fidelity test.** The t432 ghost is a property of the
   plan's replay, which reads no solver switch; the arm only matters to the SOLVE. The rows replay the 539 t plan and pass
   with the arm ON or OFF. The plan is inlined, because a copied fixture would break the empty-fixtures-diff gate.
2. **"Step 35 at your own head … may hit the null-fork TypeError that hammer's G1 fixes."** It does not: with the key ON
   the first 640 attempt answers, so the held retry (where the null fork was) never runs. With the key OFF the retry runs;
   hammer measured the TypeError there at `12b1abd649` (= this base + the flip). I did not re-run that arm here.
3. **"The newest key's `.at(-1)` pin"** was one of several: nine more files pin the key ORDER after an earlier key
   (`fidelityDrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `L39Phantom`, `RockGone`, `RockFire`, `RockButton`,
   `CorridorBody`). All were extended.
4. **The census rooms.** Hammer §7's six rooms are the ARM's rooms; this key can only touch the three wallflyer rooms.
   The survey has 4 steps there (33, 34, 35, 41), not steps in L27/L28/L88/L91.
5. **"Two `SOLVER_ENV_NAMES` lines."** The key has two env lines in `contactFidelity.js` and ONE `SOLVER_ENV_NAMES` entry.
6. **My own miss, caught by CI:** the witness row's first label typed its counts ("four wallflyers, the 539 t plan"), which `scripts/procgen/lintGateLabels.test.js` refuses (CI run 43755696138, shard 2/3, the only red of 27892). `f224c898` interpolates them. Not in the brief's gate list; worth adding to it.
7. **`entityBlocks` was not named**, but the family's first reader reds its D2/D4 (grep vs `solverReads`, surface doc),
   so step 2 updates them (§4, with the harvest note).

## 10. Residue / hand-overs

- **→ hammer:** the one-line pin flip (§7.1), landing with the key's flip. The arm still refuses `wallflyer@128,80` at
  t432 (8 forks, HIT at fork tick 30); the corridor DETOURs it on step 35. Not this slice's.
- **→ planner, the flip:** the key ships OFF. Node: 0 shipped-plan movers, 0 hits anywhere, step 35 solves under the page
  budget hitless and game-identical to hammer's witness. The budgeted keyed sweep (§7.3) is the remaining evidence.
- **→ harvest:** `entityBlocks.wallFlyerBodies.solverReads` and the surface doc/json collide with hammer's step 2 on the
  same lines: union `['dangerMap', 'solverBot']`, then `census-seedling-solver-surface --write`. Wave 44's key also lands
  at the end of `CONTACT_FIDELITY_DEFAULTS`; every key-order pin listed in §4 needs the planner's order.
- **noclip:** `wallFlyerBodiesNow` returns `[]` under noclip, so ON skips every wallflyer there. A noclip run takes no
  damage, so nothing a plan can see changes, but it is named.
- **Not measured here:** the wasm/JS page walks (hand-over 2 of hammer's report stays the js gate's), and the dashless
  plans of legs #6/#8 are not replayed for hits (they do not ship).
- Scratch: two worktrees (`base`, `head`) and the scratch merge worktree + local branch `scratch/wallflyercorpse-on-hammer`
  in the scratchpad, removed at the end; nothing pushed besides the harness branch. No dev server was started.

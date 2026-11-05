# Seedling hammer-phase L95-PUNCHER — the `puncher@416,256` kill on the L95_624_64 legs (answered by `CHASER_STAGED_HUNT`, OFF; no new switch)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-l95-puncher` (planner `seedling-hammer-phase-planning-3`), cloud, Opus |
| Start SHA | `26ed405d3f` (= `origin/main` at launch) |
| Head | W0 `29a67bb0`; M `6d880caa` (+ L40 evidence `a178a781`); I `12315e17` + `43527bd3` (the row split); D `da4f6bfc`, `97f7d919`, `5ccc6364`; this report is the last commit on the branch |
| Branch | `claude/l95-puncher-kill-rung-l0za2l` (the harness's designated branch). Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-l95-puncher-evidence/` (`w0/`, `m/`, `d/`, `i-*.txt`, instruments under `tools/`) |
| Scope | No mid-run message reached this session; the scope is the brief's. No solver code changed |

## 2. The answer first

**The one thing to know first: the fix already exists. It is `CHASER_STAGED_HUNT` (BK2COMBAT, OFF), and no new
switch was built.** The 2 L95_624_64 refusals are a phase problem at the one stance that can kill the puncher. The
staged hunt's staging cell shifts that phase: it is one of the two hitless cells where the body never arrives inside the
ceiling.

| question | answer |
|---|---|
| **With the fix ON + `CLEARTAG_STAND` ON, do all 14 legs pass, and with what hits?** | **Yes: 14 / 14 pass, 0 hits**, in node and on the page (the page sweep of this head with `solver_env=SEEDLING_CLEARTAG_STAND=1;SEEDLING_CHASER_STAGED_HUNT=1`: 14 pass, roomHits max 0). 160 / 161 answer in 794 / 809 t. The other 12 are `CLEARTAG_STAND`'s plans byte for byte |
| Why do the 2 legs refuse with `CLEARTAG_STAND` alone? | On **every** L12 leg, only one of the chaser arm's 17 reachable leash stances can kill: (376,248). From L95_624_64 the walk arrives there 0.5 px lower (y 248.8 vs 248.3 from L0). The puncher's second wind-up then ends at **t610, the tick its i-frame lapses**, so the punch is live, and the third strike lands at t611, one tick late. The brief's "all 17 have their wait punched" is not quite right: 1 stance is punched, 14 meet the bare body on the tick its i-frame lapses, and 2 are clean but the body never comes (§3) |
| Does the switch alone move anything on the 14? | **No.** `CHASER_STAGED_HUNT` ON with `CLEARTAG_STAND` OFF answers the defaults' plan on all 14 (the hold's 2 punches still stand on the 6 hit legs). The flip needs **both** |
| Radius of both ON beyond L12 | Route survey **0 movers** (236 steps, 202 SOLVED / 34 REFUSED both ways). L40's 59 captured requests: **5 movers, every one `CHASER_STAGED_HUNT`'s alone** (411/1 refusal → SOLVED 1333 t, hitless; the other 4 stay refused, with changed work or text). L30KEYLOCK `--check` is **red** with STAGED ON: its BEFORE witness now solves hitless, the red BK2COMBAT already recorded |
| The new switch the brief asked for | **Not built.** It would duplicate the staged hunt under a second name: the same question (`deriveKillByChaser`) asked from the same staging cell. Rows pin the existing switch on the L95 leg instead (§5) |

## 3. W0 — reproduce

| row | result |
|---|---|
| base | `26ed405d3f`; bootstrap `--seedling` done (node v22.23.4; the AP `pip` step FAILED, `/root/CC/pip.log`, as in the last three slices; nothing here reads it); every non-wasm submodule initialised before the first gate |
| leg list | `seedling-divergence-legs.mjs --blocks` (930 legs); the 14 L12 bosslock keys of CLEARTAG-STAND (`w0/l12-keys.txt`) |
| page sweep OFF, this tree on :8000 (CLEARTAG-STAND's `tools/sweep.sh`, `--capture-requests`) | 14/14 pass; 8 at roomHits max 0; **127, 128, 160, 161, 171, 172 at max 2** (127 t433/474, 128 t493/520, 160 t575/615, 161 t562/589, 171 t610/652, 172 t627/654, all `exact: true`): CLEARTAG-STAND's W0 to the tick (`w0/page-sweep-off.jsonl`) |
| node replays, 4 configs (`tools/batch.sh`; `w0/table-4configs.txt`) | defaults: CLEARTAG-STAND's ticks and plan hashes on all 14. `CLEARTAG_STAND`: 160 refused (350 work), 161 refused (642, the budget at `detour`); the other 12 as recorded. `CHASER_STAGED_HUNT` alone: the defaults byte for byte on all 14. **Both: 14 pass, 0 hits** |

**The chaser arm's candidates** (`tools/arm-register.mjs`, a load hook recording each candidate `deriveKillByChaser`
previews; `w0/arm-candidates-cleartag.jsonl`, legs 105 / 127 / 160 / 161 with `CLEARTAG_STAND`). The arm is asked at
the clear-tag walk's start: (24,88) on 105, (120,120) on 127, (24,360) on 160/161. It scans the target's box: 76 leash
cells, 17 reachable with a corridor onward.

| stance | 105 (L0) | 127 (L35) | 160 / 161 (L95_624_64) |
|---|---|---|---|
| **(376,248)** | **dies @650** (arrive 532) | **dies @528** | **WAIT punched @610** (the punch, live) |
| (376,232), (376,216) | no death in the ceiling (clean) | no death (clean) | no death (clean) |
| the other 14 | bare body as its i-frame lapses (the strike's aim step meets it), or the transit meets a punch | bare body | bare body (`inside leash 80 (d=3.6–11.0), box grown 1 px/tick x 0 + pad 0`) |

**The phase at (376,248)** (the target's dwell transitions; `[tick, player x, y, body x, y, hits, hitsTimer, punch]`):

| 105 | 160 |
|---|---|
| 548 hit 1 (timer 29) | 551 hit 1 |
| 577 timer 0 → 578 hit 2 | 580 timer 0 → 581 hit 2 |
| 607 timer 0 → 608 hit 3 | 598 wind-up ends, timer 12: **punch refused** |
| 613 wind-up ends, timer 24: refused | **610 wind-up ends, timer 0: PUNCH-HIT**; 611 hit 3 |
| 650 gone | (the candidate is refused) |

The player stands at (377.5, 250.0→251.7) on 105 and (377.5, 250.5→252.2) on 160. The puncher (`Puncher.as:111-117`)
re-decides its wind-up (11 ticks) as soon as one ends, and the strike policy presses as the i-frame lapses (29 ticks).
Whether a wind-up ends exactly on the lapse tick depends on the arrival phase, and from L95_624_64 it does.

**Why flag 5 runs out of budget** (161, `CLEARTAG_STAND`): its aim (440,264) sits on tile (27,16), which is not
inside the puncher's danger volume. So `coveredGoalRefusal` does not fire, and DETOUR spends the rest of the 640 units
(`deadline: detour`). On flag 4 the aim tile (26,16) is covered and DETOUR is refused by name (350 units in all).

**Why the 8 good legs' transit meets a punch and the 6 do not** (OFF; re-measured, same as CLEARTAG-STAND §3): timing,
not route. With `CLEARTAG_STAND` ON, all 14 transits-with-tail meet the punch and the kill rung runs on all of them; the
difference among them is only (376,248)'s phase above.

## 4. M — the design check

| design | 160 / 161 (CLEARTAG ON) | the other 12 (CLEARTAG ON) | the 14, CLEARTAG OFF | L30KEYLOCK `--check` | L40 (59 req) / survey (236) | verdict |
|---|---|---|---|---|---|---|
| (1) **phase-aware kill stance = `CHASER_STAGED_HUNT`** (stage at a cell the arm certified clean, ask again) | **pass, 0 hits** (794 / 809 t; the plan is the dashless pass's, 421 / 423 work; the full pass's dash upgrade is cut by the budget, lossless) | `CLEARTAG_STAND`'s plans byte for byte | the defaults byte for byte (never asked) | **red** ON (the BEFORE witness solves hitless; BK2COMBAT's recorded red), green OFF | 5 L40 movers (all STAGED alone; 1 gain) / **0** | **THE ANSWER** (existing switch) |
| (2) a forced-hit rung pricing the hold (`m/diag-covered-goal-off-*.json`; `SEEDLING_COVERED_GOAL_REFUSAL=0`, diagnosis only) | still refused: DETOUR spends the 640 units first (`deadline: detour`). At 6,000 units DETOUR plans 2,399 legs and previews 0, and the forced-hit proof is asked from the walk's start (24,360): *"the hitless input survives 3 tick(s) — no hit is forced"* | — | — | — | not run | **not built**. Pricing a hit in the hold would need a new rung that bills hits at a stance the walk has not reached yet, and it would accept 2 hits where (1) finds 0 |
| (3) a different stance / approach that kills before the hold | (1) is this: the staged hunt's second ask is a different approach to the same stance (from (376,232), 19 ticks), at a phase whose every wind-up ends inside an i-frame | | | | | **= (1)** |
| (4) what W0 shows: a new stance score that avoids lapse-tick contact | — | — | — | — | — | **not built**: the bare-contact refusals on 14 stances are the danger map's (fidelity's) reading of a press that steps into the body; out of scope |

## 5. I — the rows, the mutants, the ON radius

- **No new switch** (§2). The switch exercised is `solverBot.CHASER_STAGED_HUNT` (`SEEDLING_CHASER_STAGED_HUNT=1`,
  `withChaserStagedHunt`, `CHASER_STAGED_HUNT_DEFAULT = false`, already in `SOLVER_ENV_NAMES`). It already sits inside
  the kill rung's chaser arm, under `rungGate('kill')` (`strategySwitch.test.js` green). No `solverBot.js` line was touched.
- **Rows** (`hammerL95Puncher.test.js`, 4 rows, default tier, 27 s in all; plus `hammerL95Puncher.train.test.js`, 1 row):
  1. ships OFF, and the page channel knows both names;
  2. **leg 160, CLEARTAG ON, on the dashless pass** (the pass the plan comes from; 14 s): STAGED OFF refuses with the ladder's text (*"the combat ladder is EXHAUSTED"*, *"17 of
     THOSE refused by the forecast"*, no staged ask); ON passes, **794 t, 0 hits**, and the instrument's first ask is
     `{cell: (376,232), wait: 0, verdict: 'staged'}` (plan `b6a1482dccf4`);
  3. **L35 leg 127, CLEARTAG ON:** ON = OFF byte for byte (643 t, 0 hits, never staged);
  4. **leg 160 at the defaults:** ON = OFF (632 t, the hold's 2 punches at t575 / t615): the switch alone moves nothing.
  5. (train) **leg 160 with the worker's two passes:** OFF both refuse; ON the dashless pass answers 794 t, 0 hits, plan
     `b6a1482dccf4`, and the full pass is cut by the budget (`limit: 'budget'`). It was row 2 at first: 28 s on a quiet box, over
     the brief's ~20 s line, so the default row now runs the dashless pass alone.
- **Fixture** `fixtures/hammer-l95-puncher/leg160-l95-l12-request.json.gz`: the page's captured request, atlas records cut
  to level 12, **9.6 KB**. Cut and uncut answer identically in all 3 configs (`i-fixture-cut.txt`: defaults 632 t
  `f7765903792f`; CLEARTAG a refusal, message sha `a3d3511487df`; both 794 t `b6a1482dccf4`).
- **Mutants** (`tools/mutants.py`, a scratch worktree removed by name; `i-mutants.txt`):

| mutant (in `solverBot.js`'s staged hunt) | result |
|---|---|
| M1 the staged hunt never asked (`return first`) | **RED** (row 2 and the train row) |
| M2 `waits` kept with the switch OFF | survived: **equivalent**. The per-cell `wait` mark is gated on the switch too, so OFF's `waits` is `[]` either way |
| M3 the staging order reversed (farthest from the body first) | **RED** (row 2 and the train row) |
| M4 hit cells offered as staging too | **RED** (row 2 and the train row) |

- **The ON radius (both switches, against the defaults), by mover class:**

| workload | movers | class |
|---|---|---|
| the 14 L12 bosslock legs (node; the page agrees, `m/page-sweep-cleartag-staged.jsonl`) | 6 | **hits removed**: 127, 128, 160, 161, 171, 172 go 2 → 0 (CLEARTAG's 4, plus 160/161 now passing instead of refusing) |
| | 8 | none (OFF's plan byte for byte) |
| L40, 59 captured requests (AXIS-L12HITS's 52 keys, captured OFF at this head; `m/l40-compare.txt`, `m/l40-attribution.txt`) | 5 | **refusal → pass** (1): 411/1 (`… <- in_L43_176_464 -> Level 040 - Chest`) SOLVED 1333 t, 0 hits. **refusal → refusal, other text or work** (2): 394/1 (ladder exhausted → the budget at `kill-chaser`), 869/1 (Boss Key 2: a different chain). **work only** (2): 394/0, 411/0 (deadline site `crusher-fork` → `kill-chaser`, 642 → 643). Every one reproduces with `CHASER_STAGED_HUNT` alone, and `CLEARTAG_STAND` alone moves none (BK2COMBAT measured the same chest, as 390/1, at its own capture) |
| route survey `--through=end` (`m/survey-off-vs-cleartag-staged.txt`) | **0** | 236 steps, 202 SOLVED / 34 REFUSED both ways |
| L30KEYLOCK `--check` (`m/l30keylock-*.txt`) | the BEFORE witness | OFF / CLEARTAG green (18 PASS); STAGED / both **red**, 4 FAIL: the fidelity-switches-OFF witness at (224,80) now solves with 0 hits |

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52; `d/bounded-files.txt`: `hammerL95Puncher`, `hammerBk2Combat`, `hammerClearTagStand`, `solverEnvChannel`, `strategySwitch`, `entityBlocks`, `contentIdentity`, `boxLock`, `boxLockCommit`) | **9 files, 138 passed** at the defaults (`d/bounded-off.txt`) and with `SEEDLING_CLEARTAG_STAND=1 SEEDLING_CHASER_STAGED_HUNT=1` (`d/bounded-both-on.txt`) |
| the hammer `.slow` files (`vitest.slow.config.js`, all 4 at this head) | **4 passed, 8 / 8 tests** (`d/slow-hammer.txt`) |
| the hammer `.train` files | no solver line changed, so no existing train file is reached. **The new `hammerL95Puncher.train.test.js`: 1 passed** (`d/train-l95.txt`, 27 s). The planner's train-tier dispatch covers the rest |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`d/producer-off.txt`, at `a178a781`). A first run read 1 red, the battery's `TREE-MOVED` guard: my own report draft and an L40 replay file were written into the tree mid-run, and every producer exited 0. Re-run on a still tree: 0 red. (`43527bd3`/`5ccc6364` after it change a test file and docs only) |
| `ci-producer-checks --jobs=4`, `SEEDLING_CLEARTAG_STAND=1 SEEDLING_CHASER_STAGED_HUNT=1` | 97 run, **1 red**, 1 skipped (`d/producer-both-on.txt`): `plan-seedling-l30keylock`, its BEFORE witness (fidelity switches OFF, (224,80)) now solves hitless. This is BK2COMBAT's recorded red under `CHASER_STAGED_HUNT`, and a flip re-pins it |
| identity block (`identity-block.sh .`, `d/identity-head.txt`) | exit 0; every producer `--check` row exit 0 (r9 campaign `be9c19c8…`, as recorded by BK2COMBAT); reference ALL MATCH. Against CLEARTAG-STAND's block (start `31ce3077a1`) 4 generator rows differ (acceptance batch, empty pairs c3/c6, carved pairs c4): main moved the generator between the two starts (`31a5ed84` seedling gen baitgate, among others); this branch touches no generator file |
| `census-seedling-solver-surface --check` | GREEN, 371 rows match a fresh census; no `--write` (`d/surface.txt`) |
| `census-seedling-constants --check` | PASS (`d/constants.txt`) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated twice (README region, `procgenDocs/generated/docsIndex.js`); ALL CHECKS PASSED (`d/procgen-reference.txt`). A first check refused on the box lock (my wasm-ship run held it) |
| `generate-docs-index --check` | OK (193 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, :8000) | **ALL PASS** (`d/wasm-ship.txt`) |
| docs | `seedling-bot.md`: an L95-PUNCHER sentence in CLEARTAG-STAND's paragraph and one in BK2COMBAT's. `seedling-bot-log.md`: `### Seedling hammer-phase L95-PUNCHER — …` |
| JSUT | run **41975212198** at `5ccc6364` (the last code-bearing head; the report and evidence pushes are path-filtered out). It was **still queued** on CI at the time of writing (queued 05:41 UTC; the superseded `97f7d919` run sat queued for 50 min). Read it with `node scripts/procgen/ci-summary.mjs --run=41975212198 --wait`. The local bounded set, the 4 hammer `.slow` files and the new train row are green |

## 7. What the harvest A/B should expect

**OFF: no movers.** This branch changes no solver code: a test, a fixture, docs and evidence.

**The flip the planner is weighing is `CLEARTAG_STAND` + `CHASER_STAGED_HUNT` together.** The exact ON sweep to
dispatch (`seedling-divergence-sweep.yml`):

- `keys` = the 14 L12 keys (`w0/l12-keys.txt`, `|`-joined; the same list as CLEARTAG-STAND §7)
- `solver_env` = `SEEDLING_CLEARTAG_STAND=1;SEEDLING_CHASER_STAGED_HUNT=1`
- expect: **14/14 pass, roomHits max 0**. The page sweep of this head read exactly that (`m/page-sweep-cleartag-staged.jsonl`).

Then the **full sweep** with the same `solver_env` against an OFF run at the same SHA. Expect the 6 L12 hit legs going
2 → 0 and the L40 pocket-chest movers (411/1-class: the staged hunt's own), plus whatever the staged hunt reaches on legs
this session could not run. Every chaser-arm refusal that leaves a clean staging cell is in its reach. Flipping
`CHASER_STAGED_HUNT` also needs `plan-seedling-l30keylock`'s BEFORE witness re-pinned (fidelity's producer: a sign-off).

## 8. What the brief got wrong (measured)

- **"All 17 leash stances have their wait punched (t603–607)."** The ticks are relative to the walk's start, not
  absolute. Only (376,248)'s wait is punched (t610). 14 meet the puncher's bare body on the tick its i-frame lapses,
  and 2 are clean, refused only because the body does not arrive inside their ceiling. Those 2 are what make the fix possible.
- **"Behind a NEW switch."** The phase-aware stance the brief names as candidate (1) already exists:
  `CHASER_STAGED_HUNT`, inside the same chaser arm and under the same gate. A second switch would be the same mechanism
  under a second name, so none was built (§2).
- **"Flag 5 runs out of work budget first"** is right, and the cause is that its aim tile (27,16) is not inside the
  puncher's volume, so `coveredGoalRefusal` lets DETOUR run (§3).
- "The hammer `.slow` files": there are 4 at this head (CLEARTAG-STAND's report ran 9; files have since moved tiers).

## 9. Residue and hand-overs

- **The flip decision** is the planner's: `CLEARTAG_STAND` with `CHASER_STAGED_HUNT` (14/14 hitless on L12, 1 L40
  gain, 0 survey movers), the L30KEYLOCK BEFORE re-pin included.
- **The bare-contact refusals** (14 of the 17 L95 stances; also most stances on the good legs): the strike's aim step
  moves the player into the puncher on the tick its i-frame lapses, and the danger map prices the bare body there. Whether
  the game bills that contact is fidelity's question (`dangerMap.chaserDanger`, out of scope). Noted, not touched.
- **The capture** (L12 ~1 MB, L40 ~13 MB) is not committed. The keys are `w0/l12-keys.txt` and AXIS-L12HITS's
  `m/l40-leg-keys.txt`; the node replay answers are committed (`w0/replay-*.jsonl`, `m/l40-replay-*.jsonl`).
- **Bootstrap residue:** the AP `pip` step fails (`/root/CC/pip.log`).
- **Worktrees:** the mutant worktree (made twice) was removed by name both times. The pre-commit hook is installed in
  this clone (`git config --worktree core.hooksPath scripts/git-hooks`), after the first worktree was removed.
- **Dev server:** this session started `serve-nocache.py` on :8000 (no server was running) and stopped it by PID at the end.

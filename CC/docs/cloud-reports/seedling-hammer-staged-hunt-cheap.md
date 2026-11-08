# Seedling hammer-phase STAGED-HUNT-CHEAP — the staged hunt's per-still-tick ask, made cheap and exact (`STAGED_HUNT_SCAN_MEMO`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-staged-hunt-cheap` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-05 (L40-CENSUS step 2) |
| Start SHA | `97739720dd4121e306312a111b00873dda9d00a4` (origin/main; the brief named 2342e25604 "or later") |
| Head | this report is the last commit on the branch (the code is `79990992` + `d3e6518f`; docs `6276bceb`) |
| Branch | `claude/seedling-staged-hunt-cheap-s4tvzz` |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-staged-hunt-cheap-evidence/` (`w0/`, `m/`, `d/`, `tools/`, `i-mutants.txt`) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` READY; every submodule initialised (the wasm one too); node v22.23.4; 4 cores; :8000 dev server for the captures |

**Method.** The page sweep (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1
--page=seedling_bot_ap_p4g --capture-requests`) captured the solve requests of the 10 L40 brief legs (394, 411, 869–872,
395, 412, 387, 388) and of L12's 14 bosslock legs (CLEARTAG-STAND's `w0/l12-keys.txt`), at main's defaults, at the
start SHA. Each captured request was replayed in node by `tools/chain.mjs` (L40-CENSUS's instrument), with the anytime
deadline lifted to a cap of 40960 work units, under each arm. Every SOLVED plan was replayed on a fresh run (30(c)). The
captures (~30 MB) are not committed; the command is above, with `--ids=394,411,869,870,871,872,395,412,387,388` /
`--keys="$(cat …cleartag-stand-evidence/w0/l12-keys.txt)"`.

## 2. The answer first

**The one thing to know first: the staged hunt's cost was the leash SCAN, not the stance search.** Of the 177 work
units one per-still-tick ask spends on 394, ~160 are the scan's per-cell reachability lookups. It walks two boxes (the
player's, then the target's under `KILL_STANCE_TARGET_RESCAN`), and each cell is one `fineDeadlineReached`. Nothing
those lookups read changes while the player stands still. A memo of them is therefore **exact**: same answers, about a
third of the units.

| question | answer |
|---|---|
| Where does the per-tick ask repeat work it could share? | The scan's two floods (`plansReach` from the player, into the aim) and each cell's yes/no against them. They read the world, `solverPlanOpts`, the teleporter grant, the player's state and the aim, and a still tick moves none of these. The body moves (< 1 px/tick on 394), but that only changes leash membership, which is arithmetic. The 8 forecast candidates and the guard approach's 8 previews really do change per tick, and they stay (§3) |
| The design | `STAGED_HUNT_SCAN_MEMO` (OFF, new module `stagedHuntScanMemo.js`; asked only inside `stagedChaserHunt`, so only under CSH). One memo per hunt call holds the floods, the aim's `corridorPlans` answer and each cell's answer, keyed exactly. A reused cell costs no unit, and everything else is computed as before |
| Exact? | **Yes, by construction and measured.** Every one of 35 requests × arms answers its base arm's plan/refusal digest (§5), as does L30KEYLOCK `--check`'s output and BK2COMBAT's chain (train row) |
| 394 / 411 SOLVED hitless under OPP+CSH+new within 2560? | **Yes, both.** 394: 2384 → **790**. 411: 2630 → **716**. 640: **394 under CSH+new alone, 582**. 394 OPP+CSH+new and 411 still need the held retry (by 150 / 76 units) |
| Radius | **0 verdict movers** against the base arm on every request measured. Work moves only where the hunt waits more than one still tick (394, 411, 869, 870) |
| Wall time | **Not cut.** The units removed were cheap lookups; node wall time is within noise (394: 10–14 s either way, 411 ~35 s). The 90 s page leg budget is untouched by this switch |
| Flip proposal | `OPPORTUNISTIC_STRIKE` + `CHASER_STAGED_HUNT` + `STAGED_HUNT_SCAN_MEMO` together (+ `CLEARTAG_STAND` for L12): the memo carries no pin of its own; the pins are CSH's (§7) |

**Budget table** (uncapped node replays of the captured requests; the page gives 640, then 2560 on the held retry):

| request | arm | base work | with the memo | verdict (both) | fits |
|---|---|---|---|---|---|
| 394/0, 394/1 (Chest ← L39) | CSH | 1863 | **582** | SOLVED 1279 t, 0 hits, staged (856,856) w8 | **640** |
| 394/0, 394/1 | OPP+CSH | 2384 | **790** | SOLVED 1297 t, 0 hits, staged (856,856) w10 | 2560 |
| 411/0 (Chest ← L43) | OPP+CSH | 2630 | **716** | SOLVED 1763 t, 0 hits, staged (856,856) w12 | 2560 (was over by 70) |
| 411/0 | CSH | 80 | 80 | REFUSED (press death, A1: needs OPP) | — |
| 869/0,/1 (BK2 ← L39, one visit) | OPP+CSH | 7965 | 2900 | REFUSED, the same text (two staged hunts, w17 + w15) | — |
| 870/0,/1 (BK2 ← L43, one visit) | OPP+CSH | 7616 | 2864 | REFUSED, the same text | — |
| 869/0, door carried (tag 12) | LWF+TA+SD(+OPP+CSH) | 3236 | 3236 | SOLVED 4491 t, 0 hits; the hunt is never asked | no (over by 676) |
| 870/0, door carried (tag 12) | LWF+TA+SD(+OPP+CSH) | 1021 | 1021 | SOLVED 4519 t, 0 hits; the hunt is never asked | 2560 |
| 395, 412 (flag 8), door shut or carried | any | 20 | 20 | REFUSED (wall F, 0 key-line cells) | — |
| 871, 872 (flag 12) | any | 364 | 364 | REFUSED (wall B) | — |
| 387, 388 (pit exits) | any | 7054 | 7054 | REFUSED (wall G) | — |

## 3. W0 — the per-tick ask, re-measured

`w0/394-per-tick-asks.txt` (a scratch probe hook, since removed, read each fork ask's internals; `tools/chain.mjs
--hunt=1` needs that hook, which is quoted in §9):

- 394/1 under CSH: SOLVED 1279 t, 1862 units, exactly as L40-CENSUS measured. Staged at (856,856), 8 still ticks, 9 fork
  asks (+ the run's re-ask).
- Each no-stance ask is **177 units**: 1 (the hunt's own deadline ask) + 1 (the arm's entry) + **~160 scan cells**
  (80 inside the leash in the player's box, then the target's box, overlapping) + 8 scored candidates + 8 guard-approach
  candidates. The pricing ask is 89 (it scores, so no guard approach). 9 × 177 ≈ 1507 of the solve's 1862.
- Between ticks the player is still at (856,856); the BobSoldier moves 0.2–0.4 px in y; the set of leash cells moves by
  at most one (80 ↔ 81); the 8 reachable candidates are the same 8; the forecast's verdicts per candidate shift by a tick
  (the WAIT/APPROACH danger tick counts down), which is why the ask must be repeated at all.
- OPP+CSH on 394/1: 2383 units at this head (L40-CENSUS had 2153 at 2342e256: main moved), 11 asks of ~177.
- Every work unit in the solve is the `kill-chaser` site (1703 of 1863).

## 4. M — the designs weighed

| design | exact? | what it cuts | verdict |
|---|---|---|---|
| **memo the scan (floods + per-cell answers) under an exact key** | **yes**: same inputs, same answers; leash membership and every preview still recomputed | ~160 of 177 units per repeated ask | **built** |
| cells beside the body only | no: a strategy change (the far cells are the ones that priced on L12 and on BK2COMBAT's workload) | some previews | rejected |
| ask every k still ticks | no: the pricing tick is a phase (w8, w10, w12, w15, w17 measured); skipping can miss it or pick a later one | k× | rejected |
| memo by body state | no key exists short of the whole run state: `stateDigest` folds the tick into `place`, and every forecast reads the clock | — | not exact |
| cheap pre-filter before the candidates | none found that is a necessary condition: the verdict is the forecast's | — | — |
| early stop of a preview at its first danger (fork asks only) | yes (a rejected candidate stays rejected) | wall time only, no units | not built (the units were the budget; noted as residue) |

## 5. I — the switch, the rows, the mutants, the radius

**The switch.** `frontend/modules/seedlingDemo/stagedHuntScanMemo.js`: `STAGED_HUNT_SCAN_MEMO` (env
`SEEDLING_STAGED_HUNT_SCAN_MEMO === '1'`), `STAGED_HUNT_SCAN_MEMO_DEFAULT = false`, `withStagedHuntScanMemo(enabled, fn)`
(sync or async), `newStagedHuntScanMemo()` (`null` OFF), `stagedScanEntry(memo, inputs, build)`, the instrument
`STAGED_HUNT_SCAN_MEMO_COUNTS` (`builds/hits/unkeyed/cellsReused/cellsAsked`). Key: the run's `world` by identity (a
world is replaced, never edited, per `levelRun.stateDigestParts`' note) + `canonicalDigestText({state, planOpts,
allowTeleporter, aim})`. A key whose text holds a bare `fn` token (a function) is no key. Env name added to
`solverEnvChannel.SOLVER_ENV_NAMES`.

**`solverBot.js` lines touched** (all my own; nothing in another slice's functions):
- the import block (one line, after `strikeSlot.js`);
- `deriveKillByChaser`: the options (`scanMemo = null`); `aimIsPlannable` + `reach` now come from `stagedScanEntry`
  (OFF it builds both exactly as before, in the same order); the scan's per-cell block (a memoised cell skips its
  `fineDeadlineReached` and its two lookups);
- `stagedChaserHunt`: `const scanMemo = newStagedHuntScanMemo();` and the `ask` passes it.

The strategy switch is untouched: the memo sits inside the kill rung's chaser arm, under its `kill` gate. It adds no
arm, rung or executor.

**Rows.**
- `hammerStagedHuntScanMemo.test.js` (fast, ~5 s):
  - ships OFF; toggles and restores, sync, async and on a throw; the env name is listed.
  - The source: one memo, made inside `stagedChaserHunt`, and one ask that passes it.
  - The entry's key: the world, the state, the plan options, a function, and the string `"fn"`.
  - On BK2COMBAT's corridor run:
    - The memo's answer is the no-memo answer, ask after ask and after a still tick.
    - Under a counting `withSolveDeadline`, the first memoised ask spends exactly the no-memo units minus its in-ask reuse.
    - The second spends no unit on any cell, and less than ¼ of the no-memo units.
- `hammerStagedHuntScanMemo.train.test.js` (train tier, ~530 s): BK2COMBAT's pocket-shut chain (POCKET-BURN's arm + OPP +
  CSH). With the memo ON:
  - the same staged row `(856,856) wait 15 staged`;
  - the same refusal text, obstacle and every tick's keys;
  - `hits ≥ 15`, `unkeyed 0`.

**Mutants** (`tools/mutants.py`, `i-mutants.txt`): **9 / 9 red**. The killed mutants:
- the key ignores the world, the state, or the plan options;
- a function gets keyed;
- the memo is made OFF;
- no cell is stored;
- a reused cell still spends a unit;
- a reused cell reads open;
- the hunt passes no memo.

**The ON radius by mover class** (`m/ab-l40.tsv`, `m/ab-l12.tsv`, `m/ab-door-tag12.tsv`):

| set | arms (base → base+memo) | verdict movers | work movers |
|---|---|---|---|
| L40, 15 captured requests | D0→M, CSH→CSH+M, OPP+CSH→OPP+CSH+M | **0** | 394/0, 394/1, 869/0, 869/1, 870/0, 870/1 (OPP+CSH), 411/0 (OPP+CSH); the rest identical work |
| L12, 14 (CLEARTAG-STAND's keys) | D0→M, CSH→CSH+M, CTS+CSH→CTS+CSH+M | **0** | 0 (no hunt waits more than one tick there; CTS+CSH 14/14 SOLVED hitless) |
| L40, tag 12 staged (the door carried), 6 | D0, OPP+CSH(+M), LWF+TA+SD(+OPP+CSH(+M)) | **0** | 394, 411 (as above) |
| L30KEYLOCK `--check` | CSH vs CSH+M | identical output (4 FAIL lines, the BEFORE witness solves; BK2COMBAT's recorded red) | — |
| BK2COMBAT's chain | CSH vs CSH+M | identical (the train row) | — |

**The memo alone (no CSH) is byte-identical to the defaults everywhere measured**, as it must be: it is only made inside
the staged hunt.

**The door (⚖ "carry the door for now").** The Chests (394, 411) answer the same with tag 12 staged or not. BK2 (869,
870) solves only with the door carried, under LWF+TA+SD, and the staged hunt is never asked there. So the memo moves
neither: 869 needs 3236 (over 2560 by 676), 870 needs 1021. Flag 8 (395, 412) stays on wall F, door shut or carried.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52; `d/bounded-files.txt`, 12 files) | **202 passed** at the defaults (`d/bounded-off.txt`). With CSH+memo ON: 4 red in 2 fidelity files (`fidelityL30KeyLock` ×2, `fidelityL40Bk2b` ×2): **the same 4 CSH alone reds** (`d/bounded-csh-on.txt`; BK2COMBAT §5's recorded rows) |
| hammer `.slow` files (4 on main: Bk2Combat, DashShape, EscapeExact, EscapeGenerated) | **8 / 8 passed** (`d/slow-hammer.txt`) |
| train files run locally | `hammerStagedHuntScanMemo.train.test.js` **1 / 1** (529 s). Nothing else reaches the memo OFF; the CSH train pins are BK2COMBAT's (§7) |
| `ci-producer-checks --jobs=4` | defaults **97 run, 0 red, 1 skipped**; memo alone **0 red**; CSH+memo **1 red** = `plan-seedling-l30keylock` (CSH's recorded red) |
| identity block (`identity-block.sh .`) | exit 0, every row OK (`d/identity-head.txt`) |
| `census-seedling-solver-surface --check` | **GREEN, 371 rows** after `--write`. The new site is the `canonicalDigestText` row, its `why` classified by hand. The family gains `stagedHuntScanMemo.js` |
| `census-seedling-constants --check` | PASS (7061 literals, 0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless | **ALL PASS** (`d/wasm-ship.txt`) |
| `solverEnvChannel.test.js`, `strategySwitch.test.js` | in the bounded set, green |
| CI JSUT | run **42120047244** at `6276bceb`: success. Unfiltered vitest 25666 passed, 0 failed; **slow battery 414 / 414** (`d/jsut-42120047244.txt`) |

Commits used `BOX_LOCK_COMMIT_ANYWAY=1` while this session's own capture sweep held the box lock.

## 7. What the harvest A/B should expect, and the ON sweep

**OFF: no movers.** The memo exists only inside `stagedChaserHunt`, which runs only under CSH; OFF passes `null`.

**The ON sweep to dispatch** (cloud sessions get a 403):

```
seedling-divergence-sweep: mode inv, producer solver, page_legs 1
keys = level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest|level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest
solver_env = SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_CHASER_STAGED_HUNT=1;SEEDLING_STAGED_HUNT_SCAN_MEMO=1
```

Expected: both `done`, roomHits 0 (394 1297 t, 411 1763 t, both on the held retry). Control: the same keys with
`SEEDLING_STAGED_HUNT_SCAN_MEMO=1` removed. The expected difference is 411 `failed` on the deadline at 2560 (it needs
2630) and 394 `done`. ⚠ The page's 90 s leg budget is wall time, and this switch does not cut wall time. Node does
411 in ~35 s, the page is slower, so read the page's wall time too. Then run the **full sweep** with the same
`solver_env` against `SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_CHASER_STAGED_HUNT=1` at the same SHA. Expect no verdict
mover except a leg the control lost to the work deadline inside a staged hunt.

**Flip proposal (not a flip).**
- **OPP + CSH + `STAGED_HUNT_SCAN_MEMO` together**, plus `CLEARTAG_STAND` for L12's 14 (L95-PUNCHER: 14 / 14 hitless,
  reproduced here byte for byte with the memo).
- The memo adds **no pin of its own**. The re-records are CSH's (BK2COMBAT §7, re-measured here):
  - `plan-seedling-l30keylock`'s BEFORE witness;
  - the 4 fidelity rows (`fidelityL30KeyLock` ×2, `fidelityL40Bk2b` ×2; fidelity's files, the planner gets them signed);
  - `hammerPocketBurn` pocket-shut ON and `hammerSpinnerPress`'s two leg-860 rows, which now live in the train tier,
    not measured here.
- OPP's own pins are OPP-FREEZE's question, not measured here.
- The memo could flip ON with CSH at no cost even if OPP does not.

## 8. What the brief got wrong (measured)

- *"394 OPP+CSH 2153 u"*: **2384 at `97739720`** (main moved since 2342e256); CSH alone 1862 is unchanged. *"411 OPP+CSH
  2629"*: 2630. The capture at this head holds only 411/0, and it is the same request shape.
- *"~80 % of the work is `stagedChaserHunt>deriveKillByChaser`"*: true, but **~90 % of that is the leash scan's cell
  lookups**, not the stance search the hunt exists for.
- *"Without the hunt's cost the Chest legs would be ~450–550 u"*: with the scan memoised they are **582–790**. The
  per-tick candidates and guard approach (~18 u/tick) are real work and stay.
- The brief implies a cheaper ask is a faster ask. **It is not, here:** the work clock counted cheap lookups as units,
  so units fall about 3× and wall time does not.
- `hammerSpinnerPress.slow` / `hammerPocketBurn.slow` (BK2COMBAT's pins): those `.slow` files are no longer on main (4
  hammer `.slow` files remain); their rows are in the train tier now.

## 9. Residue and hand-overs

- **Not measured:**
  - The route survey A/B: CSH's own survey radius was 0 movers (L95-PUNCHER), and the memo is exact against CSH on every
    request measured.
  - The page sweep ON arm (§7, the planner's).
  - The train tier beyond this slice's file.
- **Wall time** stays the limit for 869/870's one-visit attempts (80–120 s in node) and for the page's 90 s leg budget.
  A preview early stop in the fork asks (§4) would be exact and cut time, not units. That is a follow-up if the page reads
  time-bound.
- **869 with the door carried needs 3236** (no staged hunt on that solve). Its work is elsewhere (L40-CENSUS: the weigh
  and turret chain), so it is not this slice's.
- **Tooling.** `tools/chain.mjs --hunt=1` reads a scratch hook that is not in the tree. To reproduce W0, put
  `globalThis.__csh` rows in `stagedChaserHunt`'s fork loop (before `ask(f)`) and at `deriveKillByChaser`'s no-stance
  return. `w0/394-per-tick-asks.txt` is its output. Without the hook, `chain.mjs` is L40-CENSUS's instrument plus the
  staged-ask rows.
- L40-CENSUS's report was read from its branch and not committed here.

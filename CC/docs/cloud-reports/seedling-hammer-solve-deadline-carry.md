# Seedling HAMMER-PHASE SDC — `withSolveDeadline` carries a rewound result's `liveRun`, and FF's report lands

Slice `seedling-hammer-solve-deadline-carry` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ User approval of
2026-10-26 (*"Yes please"*, to queue it). It closes FF-HARNESS's hand-over 1
([`seedling-hammer-ff-harness.md`](seedling-hammer-ff-harness.md) § 11.1) and lands FF's report
([`seedling-hammer-fight-fallback-shadow.md`](seedling-hammer-fight-fallback-shadow.md)). **No switch was flipped:
`HAMMER_FIGHT_FALLBACK` stays OFF.** Evidence is in
[`seedling-hammer-solve-deadline-carry-evidence/`](seedling-hammer-solve-deadline-carry-evidence/). No mid-run message
changed the scope.

## 1. Where this ran

| | |
|---|---|
| start SHA | **`c26a807e`** (`origin/main` at the fetch). FF-HARNESS's `6ca614dd2d` is an ancestor, and `recordingRun` is in `jsRuntimeSolver.js` (~777) |
| commits | `a0d08209` L (FF's report) · `9be73546` W0 evidence · `f9cffd9c` I (the carry) · `88ec9e33` rows · `2f3d636a` D (docs, log, radius evidence) · this report (the head) |
| branch | local `seedling-hammer-solve-deadline-carry`, pushed to the session's designated branch **`claude/solve-deadline-carry-fovxec`**. Nothing went to `main` |
| box | 4 cores, node v22.22.0, dev server `serve-nocache.py 9601` (killed by PID at the end) |

## 2. The answer

| leg 371, seams 5226–5280 (one hammer period of 45 + a 10-seam overlap) | phases solving of 45 | divergences |
|---|---|---|
| OFF (the default), base and after | 30 | 0 — **byte-identical**: all 55 results equal in every field but wall time |
| ON, base (`c26a807e`) | 34 | 1: 5251 (`DIVERGE 1753/1260`, FF-HARNESS's, seam for seam) |
| **ON, after the carry** | **35** | **0** |

- **The one mover is 5251.** Its full pass rewinds at t1112, solves 1753 t, and trips `sword-dash`. It is now a plan:
  answer `f68e8bab7311`, `expected` 1754 rows, `equips: []`, the same 408 work units. An independent `replayTape` of the
  plan equals its `expected` row for row (`after/replay-5251.json`). The ON census equals FF-HARNESS's scratch-carry
  census (`census-on-sbx.txt`) seam for seam.
- **The copy sites:** `withSolveDeadline` is the only site between `solveSegmentUnder` (where `liveRun` is set) and its
  readers that copies the result. § 5 lists every site checked.

## 3. W0 — the baselines (`c26a807e`, pristine)

| row | result |
|---|---|
| bootstrap | `session_bootstrap.sh --seedling` → `READY`. Six submodules were `-` after it (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); each got `git submodule update --init`. No gitlink moved |
| identity block | `SEEDLING_PORT=9601 bash scripts/procgen/identity-block.sh .`, EXIT 0 (`w0/identity.log`). The first run's **generated-set** row was the venv miss (*"playwright 1.56.0, the pin is 1.63.0"*, `w0/identity-envmiss.log`). After `pip install -r scripts/procgen/requirements-headless.txt` into `/root/CC/venv`, it is **OK**. Other rows: maze `57e07d21…`, acceptance `cf54cdf7…`, c3 `31dc4572…`, c6 `40d0a4c4…`, c4 `7e1497c4…`, the six producer `--check`s exit 0, reference MATCH |
| `ci-producer-checks` (`--jobs=2`) | **93 run, every producer 0**, 1 skipped (`r7-ends-meet`, browser). The battery reported 1 red, `TREE-MOVED`: this slice's own test file, edited mid-run. It is not a producer's (`w0/producers.txt`). D's run is clean (§ 8) |
| bounded vitest (⚖ 52) | the 67 test files naming `jsRuntimeSolver` / `solveFromTape` / `solveAnytime` / `watchSolve` / `hammerFightFallback` / `liveRun` / `withSolveDeadline` (`w0/bounded.txt`). This is FF-HARNESS's 60 plus the 7 `withSolveDeadline` callers. 63 default-tier files **1558 / 1558**; 4 slow files **12 / 12** |
| 371's page capture | `probe-seedling-divergence-sweep --mode=inv --producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --ids=371 --capture-requests=…`. Leg 371 matched by key (still id 371 of 918). One request, at the page's seam **5251**: the rewind seam itself. The default refuses *"… kill (spinner@192,128) by press … at (260.63,183.74) … There is no step out."* (`w0/page-row-371.json`) |
| 371's census | FF-HARNESS's `ff-solve.mjs` + `census.sh`, one fresh process per seam. **OFF 30 / 45, 0 divergences. ON 34 / 45, 1 divergence (5251).** Both equal FF-HARNESS's `after/census-*.txt` seam for seam (seam, phase, ok, work, answer sha) |

## 4. L — what landed for FF

- `git checkout origin/claude/hammer-fight-fallback-shadow-u2ypme -- <report> <evidence dir>` at `b2a640421f`, unchanged.
  That is the report plus 26 evidence files (27 paths, ~120 KB): docs, tools and measurement output only.
- `rg -a NewDocs` over them finds nothing.
- Every relative link in FF's report resolves.
- FF-HARNESS's link `](seedling-hammer-fight-fallback-shadow.md)` now resolves on this branch.

## 5. I — the diff and the copy-site audit

```diff
         const out = fn();
-        return deadline.first === null ? out : { ...out, deadline: deadlineReport(deadline) };
+        if (deadline.first === null) return out;
+        const tripped = { ...out, deadline: deadlineReport(deadline) };
+        // ⛓⛓ SDC — the spread drops the non-enumerable `liveRun` (B3): carry it, still not enumerable
+        if (out?.liveRun !== undefined) Object.defineProperty(tripped, 'liveRun', { value: out.liveRun });
+        return tripped;
```

The docblock (⛓⛓ SDC, ⛓ FF-HARNESS hand-over 1) states B3's `liveRun` contract and why the spread lost it. It also says
the carry is inert OFF. The diff is `handover/withSolveDeadline-carry-landed.diff`. It is FF-HARNESS's scratch diff with
one variable renamed.

**The audit.** `rg -a "\.\.\.out\b"` and the other spread and copy forms were searched in `solverBot.js`,
`jsRuntimeSolver.js` and `watchSolve.js`. Each `solveSegment` caller was then checked by hand.

| site | copies the result? | `liveRun` |
|---|---|---|
| `solverBot.withSolveDeadline` (~22586) | **yes, when a site tripped** | **dropped → carried (this slice)** |
| `solveSegment` → `withSolveProgress` (`solveProgress.js` ~89) | no: `return fn()` | kept |
| `progressSegment` / `progressRun` (`solveProgress.js` ~622 / ~416) | no: `return out` | kept |
| `refusingByName` (~473) | no: `return fn()` | kept |
| `solverBot` ~13762 `deriveApproach` / ~14223 `deriveFight` `{ ...out, record }` | not a `solveSegment` result (a search's own result) | n/a |
| `solverBot` ~10009 `{ ...out.plan, still }` | a bomb plan, not a segment result | n/a |
| `jsRuntimeSolver.solveFromTape` | reads `out.liveRun` directly. Its plan is a new object, but `liveRun` is consumed there (the recording is chosen from it) | consumed |
| `jsRuntimeSolver.solveAnytime` | copies plans, never a segment result | n/a |
| `watchSolve.solveForPage` (~524) | reads `out.liveRun ?? built`. Passes no `shouldStop`, so no wrap | consumed |
| `twoPassSolve` (~191) | returns `out` as it came. Passes no `shouldStop` | kept |
| `seedlingCanCross` (~471, out of scope) | reads `perTick` / `trace` / `deadline` only, never the run after the solve | not needed |

So no other site drops a `liveRun` that a reader needs.

## 6. The rows and the mutant (`hammerFightFallback.test.js`, `88ec9e33`)

**`SDC — a tripped deadline keeps a rewound run's liveRun`**
1. **The deadline-tripped rewind through `solveFromTape`.** The setup is FF-HARNESS's tape: B3's `r9-solve-18` at
   residue 4, `HAMMER_ESCAPE` off, kill-lock clear at 323, empty prefix. Its `shouldStop` trips every site asked once the
   fallback trace has a row. It asserts:
   - OFF, the same `shouldStop` gives the `HAMMER_SAFETY` refusal;
   - ON gives exactly one fallback row, `{t: 0, how: 'rewind', refused: HAMMER_SAFETY, refusedAt: 266, verdict: 'solved'}`;
   - `plan.deadline` is `{tripped: true, first: 'sword-dash'}`, and the first ask was answered before the rewind (so the
     trip came after it);
   - the plan is 381 ticks (the dashless plan the trip leaves), and `expected.length − 1 === solution.length`;
   - `expected` equals a fresh replay of the plan, row for row (382 rows);
   - `equipsAt.size === 0`.

   The staging trips cheaply (≈4 s), so **371's request did not need to be cut to a fixture**. The same defect is shown
   on the real request by `after/replay-5251.json`.
2. **The unit row:**
   - `planSwordDash` asks `sword-dash` before any work, so `shouldStop: () => true` trips it at once.
   - A tripped `withSolveDeadline` returns a new object with `deadline = {tripped, first: 'sword-dash', sites:
     {'sword-dash': 1}}` and the same `liveRun`, non-enumerable and non-writable. `Object.keys` is `['perTick',
     'deadline']`.
   - Without a mark, the own property names are exactly `['perTick', 'deadline']`.
   - Untripped, the very object comes back.

**Mutant sdc-m1** (the `defineProperty` line removed): both rows fail.
- Row 1: ***"ShadowDivergence: the solve returned 381 key set(s) but the shadow advanced 266 time(s)"***, FF-HARNESS's
  defect exactly.
- Row 2: *"expected undefined to be {}"*.

The pre-fix tree fails the same way, because it is the mutant. The fix was restored, and sdc-m1 is listed in the file's
mutation list. With the fix, all 15 rows of the file pass.

## 7. The radius, by mover class

### 7.1 371's census (§ 2)
- **ON:** one mover, **5251**, from DIVERGE to SOLVE (1753 t, the same 408 work). The 54 other seams are equal in every
  field but wall time. This is FF's prediction (35 / 0) and FF-HARNESS's scratch measurement.
- **OFF:** byte-identical, 55 / 55 (`after/rawcmp.txt`).

### 7.2 L40 and the spinner rooms (4 arms)
- **The capture:** fresh, at the fix (OFF, so it is the base's too). 42 L40 legs give 47 requests. The spinner rooms add
  7 more: L18 220/221, L39 363/364/365 and L92 **710/711**, matched by key (FF-HARNESS's 720/721 ids have shifted). That
  is 54 requests, FF-HARNESS's count.
- **Pinning 371:** the page put 371 at seam **5560**, where no rewind runs (its one fallback row is an admission
  refusal). So 371 gained two pinned cells at the rewind seam 5251 (FF-HARNESS residue 4):
  - i=100, the W0 page capture (the page's own 5251);
  - i=101, this capture's request moved there by `atSeamTime`.

  `tools/pin371.mjs` adds them.
- **The arms:** base OFF, base ON, fix OFF, fix ON. Base is a pristine `solverBot.js` swapped in by a loader hook
  (`tools/base-hooks.mjs`), checked to reproduce `381/266` on the r9 staging. Each cell runs in its own process
  (`tools/radius4.sh`).

| | cells | identical base ↔ fix (every field but wall time) | solve (base → fix) | divergences (base → fix) | fallback rows |
|---|---|---|---|---|---|
| OFF | 56 | **56** | 37 → 37 | 0 → 0 | 0 |
| ON | 56 | **54** | 37 → **39** | 2 → **0** | 5 → 5 |

- **The two ON movers are the two pinned 371 cells.** Both go from DIVERGE to a 1753-t solve with the same rewind rows.
- No other request moves in either arm.
- Of the 54 fresh requests, only 371@5560 runs a fallback row at all, an admission that refuses (`radius/radius.txt`).

### 7.3 The bounded set, the producers and the identity block, after (defaults)
| | result |
|---|---|
| bounded vitest | **1560 / 1560** (W0's 1558 + the 2 new rows) over 63 files; slow **12 / 12** |
| producers | **93 run, 0 red**, 1 skipped (`d/producers.txt`) |
| identity block | **= W0, byte for byte** (`d/identity.log`, generated set OK) |

## 8. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) + the new rows | 1560 / 1560, slow 12 / 12 |
| `ci-producer-checks --jobs=4` | 93 run, **0 red** |
| identity block | = W0 |
| `census-seedling-solver-surface --check` | GREEN, 353 rows (no `--write`: no surface line moved) |
| `census-seedling-constants --check` | PASS (6938 literals, 0 new / 0 vanished, 111 moved = green drift) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (the procgen README's and `procgenDocs/generated/docsIndex.js`'s word counts), then ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `seedling-bot.md` | `HAMMER_FIGHT_FALLBACK`'s paragraph says a rewound solve is honoured end to end (FF-HARNESS's recorder, SDC's carry), so js-11's flip precondition is met. The switch is still OFF |
| `seedling-bot-log.md` | `### Seedling hammer-phase SDC — a tripped deadline keeps a rewound run's liveRun` |
| **CI JSUT** | run **`40262349392`** at `2f3d636a` (the last commit before this report): **success**. Suite (unfiltered, quoted from CI per ⚖ 52) **22991 passed, 0 failed, 0 skipped** over 969 files (3 shards). **Slow battery 268 / 268** over 23 files |

## 9. What the planner's harvest A/B should expect

With the switch OFF there should be **no movers**. `liveRun` is set only by `rewind.to`, which only
`HAMMER_FIGHT_FALLBACK`'s rewind mode calls, so the carry's branch never runs OFF. That is measured on:
- 371's 55 seams (every field);
- the 56-cell radius;
- the identity block;
- the producers;
- the bounded set.

Any OFF mover in the probes, TT or the sweep / survey A/B is not this slice's. The survey A/B runs
`survey-seedling-route --merge`, which now exits 1 on a BOOT-CHECK-FAIL alone, so read its boot checks before blaming
a mover.

## 10. Is a `HAMMER_FIGHT_FALLBACK` flip slice worth it now?

**The precondition is met, and the decision is the user's.**
- **What it gains:**
  - On leg 371, the one leg where it acts, 30 → **35 of 45** phases with **0 divergences**: 4 rewind rescues (5251,
    5264, 5265, 5266) and 1 admission solve (5249).
  - The tape harness and the deadline carry both honour every rewind now, so the "can only add solves" promise holds
    there.
  - Nowhere else measured on the spinner route moves. Of 54 fresh requests, only 371 runs a fallback row.
- **What it costs, measured before this slice (unchanged by it):**
  - A flip moves committed generated rows. `seedling-bot.md` gives 21 gained solves (c4 15, c3/c6/acceptance 2 each),
    and FF-HARNESS § 6.3 gives 4 identity rows moving ON. Those movers need the user's licence.
  - A rescued kill gate certifies and keeps its tag, so a killgate draw re-rolls past any measured bound
    (`seedlingGenCapacity` seed 57: 335 s off, more than 2,400 s on).
- **What a cloud session cannot measure:** the page cannot see an env switch (BW residue 6). A flip's real measure is
  a default flip with the probe, TT and the sweep / survey A/B, which a cloud session cannot dispatch.

So a flip slice is cheap and no longer blocked. Its route gain is narrow (+5 phases on one leg). Its real price is the
generated-row movers and the killgate capacity cost, which are the user's to license.

## 11. What the brief got wrong (measured)

1. **"`solverBot.withSolveDeadline` (~22248 at `af699d39`)"** is at **~22586 at `c26a807e`**. It was re-found by name.
2. **The branch** is the session's designated `claude/solve-deadline-carry-fovxec`. The brief's
   `seedling-hammer-solve-deadline-carry` is only the local name.
3. **"If no staging trips cheaply, cut 371's request at seam 5251 to a small fixture":** B3's `r9-solve-18` residue-4
   tape trips cheaply (≈4 s, the first post-rewind ask is the full pass's `sword-dash`). No fixture was cut.
4. **The spinner-room ids:** L92's legs are now **710 / 711** (FF-HARNESS's 720 / 721); matched by key. 371 is still 371.
5. **"FF's evidence … 27 files":** the evidence dir is 26 files; with the report it is 27 paths.
6. **The page capture lands where the page's clock puts it:** W0's single-leg capture put 371 at 5251, a rewind seam.
   The radius capture put it at 5560, not one. So the radius pinned it explicitly (FF-HARNESS residue 4's advice).
7. The bootstrap again left six submodules uninitialised after `READY` (expected by the brief, as stated).

## 12. Residue

1. **Not run here (cloud 403 on `workflow_dispatch`):** the probes, TT and the sweep / survey A/B, which are the
   planner's. With the switch OFF, expect no movers (§ 9).
2. **`equipsAt` across a rewind** (FF-HARNESS residue 2) still has no reachable fixture. Every rescued 371 plan, 5251's
   included, has `equips: []`.
3. **The flip** is the user's call (§ 10). This slice records that js-11's precondition is met and does not flip.
4. **Tree hygiene:**
   - no `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `pressKillGuards.js`, `flashPanel/*`, AS3, wasm, gitlink or
     rules edit;
   - `solverBot.js` changed in `withSolveDeadline` only;
   - the pristine `solverBot.js` copy the radius's base arms loaded (`seedlingDemo/.sdc-base-solverBot.js`, untracked)
     was removed by name before the D gates;
   - the page captures (371's request, 530 KB, and the radius's) stay in the scratchpad;
   - no `pytest`, no `standing-values --write`, no unfiltered local vitest, no stash, no force-push, nothing pushed to
     `main`;
   - the dev server was killed by PID.

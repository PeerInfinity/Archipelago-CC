# Seedling HAMMER-PHASE SFF2 — the drown in `deriveStrike`'s `walkTo`, and making SFF landable

Slice `seedling-hammer-strike-floor-fix` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User,
2026-10-23: *"Yes please"*. The evidence is in
[`seedling-hammer-strike-floor-fix-evidence/`](seedling-hammer-strike-floor-fix-evidence/).

⛔ **Read this first: SFF is still NOT landable. The slow battery is still red ON, on the same two rows.** D1 fixes
`walkTo`, and the unit row proves it. But once `deriveStrike` stops throwing, the executor goes to a refuge, and the same
drown escapes from **`deriveRefuge`'s `previewWalk`** (`solverBot.js:10376`). That site is outside this slice's scope
("if the honest fix reaches further than `walkTo` … STOP"), so it is handed over (§ 8.1). Measured in a scratch tree: the
same catch there turns **both slow rows green ON** (`d1/slow-on-walkTo-plus-refuge-SCRATCH.txt`). The patch is
`d1/handover-deriveRefuge-SCRATCH.diff`.

⚠ **Also found: a second SFF residue, now fixed.** SFF left the `tick0` latch of 13 continuation tapes stale, so the
browser gate `seedling-wasm-ship` was red at SFF's own head (§ 2.2).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`42ffdb0329`** (SFF's head; `origin/claude/seedling-strike-eta-floor-flip-ugfnjp`) |
| merged SHA | **`fbf996ff67`** (`origin/main` `86c2ed386b` merged in) |
| head | the commit that adds this report (see `git log`); the last code commit is `43f00d13ad` |
| branch | `claude/seedling-strike-floor-fix-fyytfl`, the session's designated branch (not the brief's `seedling-hammer-strike-floor-fix`). Nothing went to `main` |
| commits | W0 evidence `28f63cb1a4` · D1 `0f2fd2db6c` (+ evidence `ce5a657197`, `79f6bca290`) · D2 `eb8bc3db19` · W0 `tick0` re-derivation `43f00d13ad` · D3 docs `7a64a3db85` · D2 evidence `45647be5c5` |
| box | 4 cores, node v22.22.0; dev server `serve-nocache.py 9587` (PID 1471, killed by PID at the end) |

## 2. W0 — what the merge moved in SFF's work

### 2.1 The merge and the re-check

- **The merge.** Conflicts only in the generated `docs/json/developer/procgen/README.md` and
  `procgenDocs/generated/docsIndex.js`: I took ours and regenerated both. `seedling-bot-log.md` merged as a union.
  `seedling-solver-surface.json` was rebuilt with `--write` from main's copy (equal to main's). No gitlink moved
  (`git diff --raw origin/main | grep 160000` is empty).
- **ON at the merged tree** (`w0/`):
  - the identity block is byte-identical to SFF's `f3/identity-on.txt`. The one difference: the reference row now
    reads "ALL … MATCH" where SFF's read "4 differ";
  - `ci-producer-checks --jobs=4`: 93 run, 0 red;
  - the bounded set (SFF's 21 + 4 + the 51 tape readers + its 21 touched files + main's 9 new non-slow test files since
    `dbe7668ca7`, 80 files): **2,967 / 2,967**.
- **`=0` at the merged tree:**
  - producers: 93 run, 0 red;
  - identity: `r8-d2-chain`, `r8-l18` and `r9-campaign` `--check` exit 1. This is expected: they record ON walks;
  - 26 bounded rows red in 14 files (`w0/vitest-off-fails.txt`). Also expected: SFF re-pinned them to ON's answers.
    This is the `=0` before-baseline for D1.
- **wave27 moved nothing in SFF's work.** None of SFF's re-recorded tapes, game streams or re-pinned rows moved at the
  merged tree, ON or OFF (identity, roster and bounded set as above). So nothing needed re-recording for wave27.

### 2.2 Found at W0: SFF's stale `tick0` latches (fixed here)

**The failure.** CI's browser gate `seedling-wasm-ship` was red at D1's push. It was **already red at SFF's
`16ad7e81`** (run 40047047904; SFF's report doesn't mention it), and it reproduced here (`w0b/ship-head-before.txt`).
The gate's two chain arms refused:
- CHAIN, at boundary 2/3: Δ 104;
- CAMPAIGN, at boundary 20/30: Δ −50.

**The cause.** On a continuation, `watchWasm.continuationTape` writes the game each window's v11 **`tick0`** latch, a
fresh-page game measurement. SFF's re-record moved the `seam` clock and RNG of 13 continuation tapes:
- `r8-d2-19` and `-20`: +104;
- `r9-solve-19`, `-20`, `-21`, `-22`, `-13-v2`, `-0-v3`, `-12`, `-29`, `-30`, `-31` and `-32`: −50.

SFF did not re-derive their `tick0` blocks, so the page resumed each moved window on the pre-flip clock. For example,
window 2's tick 0 read 8990, which is the old 8969 + 21.

**The fix.** `derive-seedling-tick0.mjs --check` named exactly those 13. I re-derived them with the field's own producer
on headless wasm (`--only=<the 13>`, `w0b/tick0-write.txt`): every clock now reads declared + 21 (ALL CHECKS PASSED).
Only the `tick0` blocks changed, and the tape index is unchanged. This is a game measurement, not a model re-record.

**After the fix:**
- `check-seedling-wasm-ship`: **415 PASS, 0 FAIL, rc 0** (`w0b/ship-after-tick0.txt`);
- the 40 test files that read `tick0` or these chains: **2,386 / 2,386**;
- identity ON: `r8-d2-chain` `1e8180a5` → **`a591fa9d`** and `r9-campaign` `5266b7a6` → **`27478177`**, both exit 0.
  Their `--check` output covers the tapes. Every other row is unchanged (`d3/identity-on.txt`).

## 3. D1 — the fix

**The diff** (`solverBot.js`, `deriveStrike`):

```js
// walkTo's catch, ahead of the shake-band arm
if (e instanceof PhysicsV2Error) {
    const out = { walk: { truncated: { kind: 'death' }, samples: [] }, eta: 0, unsafe: null,
        death: e.message.split(' — ')[0] };
    walks.set(cell, out);
    return out;
}
// the walk loop, ahead of the shake check
if (death !== undefined) {
    rejected.push({ option: `strike (…) at +${o.i}`,
        why: `the preview DIED: ${death} — a previewed death is a step not taken, so the walk is no plan` });
    continue;
}
```

- The test is `previewOrDeath`'s own (`instanceof PhysicsV2Error`), not a new one.
- `walkRefuses`, `measuredPair` and the continuation all read `walk.truncated`, so no pass picks the candidate.
- The docblock is in the catch.

**The unit row:** `hammerStrikePreviewDeath.test.js`, 4 rows.
- **The staging.** C1's staging A, with the run's preview stepper wrapped so that any previewed step within 6 px of
  (728,680) throws the real `deathRefusal` drown. That cell is staging A's first-derivation strike.
  - Without the pool: (728,680) at +510, ON and OFF.
  - With it: (712,680) at +825 ON, refused by name. OFF gives the same answer.
  - A non-death error still throws.
- **The mutant.** Without the new arm, both pool rows fail with "the player DROWNED in level 40 at (723.01…, 680.84…)"
  (`d1/unit-mutant.txt`).
- **Why not seed 30's room?** Its first oracle solve takes about 30 s, so it stays the slow row.

**The two slow rows, before → after:**

| row | before (merged tree, ON) | after D1 (ON) | `=0` |
|---|---|---|---|
| `hammerEscapeGenerated.slow` › seed 30 | ABORTED, a drown from `walkTo` | **ABORTED**, a drown from **`deriveRefuge`** | certified, 158 t |
| `seedlingGenCapacity.slow` › post-sword 1–60 | red (seed 30's room) | **red**, the same `deriveRefuge` drown | green |
| both, D1 + the scratch `deriveRefuge` catch | — | **green** (35 s / 482 s) | — |

- With both catches, seed 30 ON certifies a **different level** from `=0`:
  - ON: 178 t, kept `water-pool(2×2)@(2,6)`, `wall(v,4)@(7,5)`, `water-pool(2×2)@(4,3)`;
  - `=0`: 158 t, kept `water-pool(3×1)@(2,3)`, `water-pool(2×2)@(2,6)`, `wall(v,4)@(7,5)`.
- The floor changes which strikes are chosen, so the attempt loop keeps different candidates (`d1/seed30-fields.txt`).

**OFF did not move.** ⚠ The brief's premise is wrong: the walk loop calls `walkTo` OFF too, so the throw was OFF's as
well (the unit row's OFF pool row shows it). It is still byte-identical in practice:
- the identity block at `=0`, before vs after D1: **identical** (`d1/identity-off-after.txt`);
- the producer roster at `=0`: the same 93 verdicts;
- the bounded set at `=0`: the same 26 failing rows, by name (`d1/vitest-off-fails-{before,after}.txt`);
- seed 30's `=0` summary md5 `5f23b6d2…`: the same on main, on D1 and on D1 + the refuge catch.

**ON did not move either:** identity byte-identical, producers 93 / 0, the bounded set (+ the new file) 2,971 / 2,971.
**There are no D1 movers.**

## 4. D2 — the counter: made P2-invariant (a counting-only change)

**The evidence.** I instrumented `measuredPair` in a scratch tree (`d2/counter-decomposition.txt`) on
`pressKillCost`'s staging A, floor ON.
- **The far refusal.** `etaSkipped` is 9,149 with P2 ON and 16,202 with P2 OFF.
  - Pairs in the press's reach: **8,079 known + 5 fresh, equal both ways**.
  - The 7,053 between them (8,118 − 1,065) are **all out of reach**.
- **`capSkipped`.** It has the same artefact. On the first derivation, OFF counts 38,205 cap skips out of reach, against
  0 with P2 ON (0 in reach both ways). It just never reached a refusal on this staging.

**The decision.** The counter should mean the same under P2. A pair out of reach is no opportunity whatever its walk
(`opportunityAt`'s first test), so it is not a pair that the measured ETA or the budget dropped. The old counter measured
how many cells were *asked*. Both counters now count only in-reach pairs (`inReach`), and `etaSkipped`'s
fresh-preview arm is in reach by construction.
- **Counting only:** the pair is refused either way.
- **A non-finite rect counts as before**, so the old throw site is unchanged.

**The rows:**
- `pressKillCost`'s SFF ON sibling now holds P2 to the **whole** refusal: `JSON.stringify(on) === …(off)`, with
  `etaSkipped` [8084, 8084].
- `hammerStrikeEtaFloor`'s `capSkipped` rows are unchanged.
- The D2 battery: identity is byte-identical to D1's at both `=0` and ON; producers 93 / 0; the bounded set 81 / 81
  files, 2,971 / 2,971.

## 5. D3 — gates

| gate | result |
|---|---|
| bounded vitest (by path, ⚖ 52) | the W0 set + D1's file: **2,971 / 2,971** ON; the 40 `tick0` / chain readers 2,386 / 2,386 |
| `ci-producer-checks --jobs=4` at head | **93 run, 0 red** ON and `=0` (`d3/`) |
| identity ON at head | rc 0; = D2's except the two `--check` md5s from the `tick0` re-derivation (§ 2.2) |
| `census-seedling-solver-surface --check` | GREEN, 345 rows. The `--write` was site counts only: `PhysicsV2Error` 10 → 11 (D1), `distanceRectPoint` 24 → 25 (D2); CI shard 1 named it at D1's push |
| `census-seedling-constants --check` | PASS |
| `generate-procgen-reference --check` → `check-procgen-reference` | match → ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `check-seedling-wasm-ship` (local, headless wasm) | 415 / 0 after the `tick0` re-derivation |
| `seedling-bot-log.md` | `### Seedling hammer-phase SFF2 — a previewed drown in the strike scan is a skipped candidate` |
| **JSUT** at `7a64a3db85`, run **40058148730** | **suite 22,459 passed / 0 failed**; **slow battery 265 / 267: 2 failed**, `hammerEscapeGenerated.slow` › seed 30 and `seedlingGenCapacity.slow` › post-sword 1–60, both thrown from `deriveRefuge` (§ 8.1). Producer `--check`s and headless gates green. The `seedling-wasm-ship` browser shard was not scheduled in that run (the shard plan ran two), so its evidence is the local run |

Earlier CI runs on this branch:
- **40051672835** (D1): shard 1 red on the surface census. Fixed in D2.
- **40054528603** (D2): the slow job died at checkout (*Unshallow the Seedling source submodule*) before any test ran,
  and `wasm-ship` was red (from before the `tick0` fix).

## 6. What the planner's harvest A/B should expect (SFF's § 6, updated)

- **Steps that can move:** as SFF's § 6. Legs that ask a spinner press kill (L18, L39, L40, L92, and generated levels
  with spinner or corridor bodies). D1 and D2 add no movers: no leg that finished before can change.
- **⚠ The generated-level survey will still abort** on seeds whose spinner room borders water or lava, now through
  `deriveRefuge`, not `walkTo`. Post-sword seed 30 at least. Until § 8.1 lands, an A/B reads those seeds as *errors* ON.
  With § 8.1, seed 30 ON certifies a different level from OFF (178 t vs 158 t, § 3).
- **Probes that drive the page's continuation chains** (`r8-d2`, `r9-campaign` on wasm) now pass with the re-derived
  `tick0` latches. Before this slice they refused at the first moved seam.
- **Should not move:** as SFF's § 6 (maze, guard, ENEMY, AREA, levels s1, `r8-battery`, `r8-tail`, `r9-l3`), and
  anything OFF.
- **`standing-values`:** SFF's three moved md5s (`1e8180a5`, `6460d60d`, `5266b7a6`) are now `a591fa9d` (`r8-d2-chain`),
  `6460d60d` (`r8-l18`, unchanged) and `27478177` (`r9-campaign`). Re-banking them is the planner's call.

## 7. What the brief got wrong (measured)

1. **"OFF never previews in the bounded pass, so the fix is unreachable OFF."** The first half is true. But `walkTo` is
   also the walk loop's preview, which runs OFF, so a drowning strike walk threw OFF as well. The unit row's OFF pool
   row shows it. OFF's byte-identity holds anyway, because nothing OFF reached it (§ 3).
2. **"In `walkTo`, a death in the preview reads as a truncated walk" fixes the slow rows.** It does not: the drown then
   escapes through `deriveRefuge`. The honest fix covers two sites (§ 8.1).
3. **SFF's re-recorded set was complete.** It was not: 13 tapes' `tick0` latches were left behind, and the browser gate
   was red at SFF's own head (§ 2.2). No model gate reads `tick0`.
4. **"Anything wave27 moved: re-record it."** Nothing of SFF's moved at the merged tree (§ 2.1).
5. **The branch:** the designated branch is `claude/seedling-strike-floor-fix-fyytfl`. The bootstrap again left six
   submodules uninitialised; I initialised them by hand.

## 8. Residue and hand-overs

1. **(s) — the same drown, in `deriveRefuge`.** `deriveRefuge`'s candidate loop (`solverBot.js:10373`) calls
   `previewWalk` bare. The same rule applies there: catch `PhysicsV2Error` and `continue` (skip the refuge candidate).
   - The scratch patch is `d1/handover-deriveRefuge-SCRATCH.diff`. It still carries a `globalThis.__REFUGE_DEATHS`
     probe, which must be removed.
   - With it, both slow rows were green ON.
   - Before landing, measure its OFF identity and roster as § 3 did for D1.
   - ⚠ Other bare `previewWalk` callers in the executor may be next. A full sweep for unwrapped preview throws is the
     honest scope.
   - **Until this lands, SFF + SFF2 must not merge:** the page's generator would abort on those seeds.
2. **`standing-values`** (§ 6). No `--write` was run.
3. **The CI probes, TT and the route sweep / survey A/B** are the planner's (`workflow_dispatch` is 403 from here).
4. **A gate gap, not this slice's to change:** no model gate notices a stale `tick0` after a seam re-record. A
   `derive-seedling-tick0 --check` in the producer roster, or in the re-record producers' write mode, would catch it.
5. **Hygiene:**
   - no stash, no force-push, nothing pushed to `main`;
   - no `pytest`, no unfiltered local vitest, no `standing-values --write`;
   - no AS3, wasm, gitlink or rules edit, and no edit to `levelRun.js`, `dangerMap.js`, `botDriverV*.js`,
     `pressKillGuards.js` or `flashPanel/*`;
   - `STRIKE_ETA_FLOOR` stays ON;
   - one pre-commit refusal under my own gate's box lock was honoured (I waited it out);
   - the scratch worktrees lived in the session scratchpad and are removed; the dev server (PID 1471) was killed by PID.

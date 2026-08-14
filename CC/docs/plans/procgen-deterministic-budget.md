# Procgen: a deterministic budget — tick-bounded, not wall-clock

**Date:** 2026-08-14 · **Status: DONE — see §8 AS-BUILT, which OVERRIDES §§1-7 where they disagree.** ⚖ **User priority
(2026-08-14): "make it one of the next priorities to make procgen
deterministic, by making it tick based, not wall clock based."**

The finding is old and has been recorded three times inside other arcs' as-built
docs (`procgen/seedling-bot.md`, `procgen/omsi.md`) and deferred each time as
"a design decision, nobody's in passing". It is now somebody's.

---

## 1. The defect, in one line

**A solve that SUCCEEDED is reclassified as a rejection because of how long it
took** — so the same code on the same seed keeps a candidate on a quiet box and
reverts it on a busy one, and the run then reaches different candidates from
there on.

`frontend/modules/seedlingDemo/procgenOracle.js:503`:

```js
if (ms > b.wallClockMs) {
    return {
        ...base,
        verdict: VERDICT.BUDGET_EXHAUSTED,
        ms,
        budgetKind: 'wall-clock',
        classifiedBy: `the solve SUCCEEDED in ${ms} ms, over the ${b.wallClockMs} ms `
            + 'wall-clock budget — the level is solvable and too expensive, which is '
```

⛓ The comment is honest about what it does. The problem is not that it is
hidden; it is that **elapsed time is not a property of the candidate.**

**Measured (2026-08-13):** seed 20, five runs, identical code — **3 runs
produced 3 levels, 2 produced `GenerationAborted(PhysicsV2Error)`.**

⚠ **And it is not only the generator.** Phase 5 of the level-sets arc had a full
vitest suite go **red with 3 failures at load 22.8**; solo on a quiet box the
same three files are 515/515. ⇒ any gate that runs the solver inherits the
nondeterminism, so "is this red mine?" costs a re-run every time.

## 2. What is already there — this is smaller than it looks

`DEFAULT_BUDGET` (`procgenOracle.js:118`) **already has two values**, and one of
them is already a tick bound:

```js
export const DEFAULT_BUDGET = Object.freeze({
    wallClockMs: 5000,                              // :99  — "a CHOSEN ceiling, not a measured limit"
    maxTicksPerTarget: DEFAULT_MAX_TICKS_PER_TARGET, // :106 — the engine default, on purpose
});
```

And there are **two** `BUDGET_EXHAUSTED` sites, only one of which is the problem:

| site | trigger | deterministic? |
|---|---|---|
| `:452-458` | a solve **threw**; classified `per-target-ticks` if the message names the tick budget, else `wall-clock` | the tick arm **yes**; the wall-clock arm no |
| **`:503`** | a solve **SUCCEEDED** and simply took too long | ⛔ **no — this is the defect** |

⇒ **The minimum fix is one branch.** Deleting or demoting `:503` removes
nondeterminism from the keep/revert decision immediately; the tick arm at `:452`
already works the way we want.

## 3. The obstacle the file names itself

`procgenOracle.js:112`:

> ⛔ THERE IS NO EXPANSION BUDGET HERE. `planDash`'s 40,000-expansion cap is
> internal to `solverBot` and takes no argument; naming a number this file
> cannot pass would be a bound nobody enforces (trap: a comment naming an arm
> nobody built). **The wall clock is the only bound this side owns.**

That is the real reason the wall clock exists: it is standing in for a search
bound the oracle cannot reach. ⛓ **But the plumbing is nearly there already** —
`solverBot.js:4346` defines

```js
const TIME_RUNG = Object.freeze({ dwell: 4, reach: 48, maxExpansions: 40000 });
```

and `:5135` already threads it as `limits: { maxExpansions: TIME_RUNG.maxExpansions }`.
It is a module constant being read where a parameter could be passed. ⇒ making
it budget-supplied is **plumbing, not redesign**.

## 4. The shape of the work

1. **Make `maxExpansions` a budget field** — `DEFAULT_BUDGET.maxExpansions`,
   threaded to `solverBot`'s existing `limits` object. Default to `40000` so
   nothing changes behaviour on the first commit (the `maxTicksPerTarget`
   precedent at `:106`: adopt the engine's own number first, tune later with a
   measurement).
2. **Make exhaustion a REFUSAL, not a post-hoc reclassification** — the solver
   should stop and say "I hit the expansion bound", which arrives at `:452` as a
   thrown refusal and classifies deterministically, exactly as the tick arm does
   today.
3. **Demote `wallClockMs` to a safety net that never decides an outcome** —
   keep it as a watchdog against a genuine hang, but make crossing it a
   *diagnostic* (`GenerationAborted` with its own verdict, or a warning), never
   `BUDGET_EXHAUSTED` on a candidate that succeeded. ⚖ Whether it survives at
   all is the open question in §5.
4. **Prove it.** Re-run §1's measurement: seed 20, five runs, on a box under
   *deliberate* load — all five must agree. That is the acceptance, and it is
   the one gate this work exists to pass.

## 5. Open questions — decide before coding

1. **What is the tick/expansion equivalent of 5000 ms?** `wallClockMs` was
   chosen as ~40× the 47–139 ms empty-room cost (`:99`). The equivalent
   expansion figure has never been measured, and picking it by analogy would
   reintroduce a chosen number without the measurement that justified the first
   one. **Measure the expansion count of the same empty-room case first.**
2. **Does `wallClockMs` survive as a watchdog, or go entirely?** A watchdog that
   can still abort a run is still a source of run-to-run difference — just a
   rarer one. Rare nondeterminism is worse than common nondeterminism, because
   nobody believes it exists.
3. **Is `maxExpansions: 40000` even the binding constraint?** Nobody has checked
   whether real rejections hit the expansion cap or the wall clock first. If it
   is always the wall clock, the cap is decorative and the new bound needs a
   different number.

## 6. ⛔ Expected consequence: committed artefacts will move

Changing what counts as a rejection **changes which candidates are kept**, so
generator output changes legitimately. Expect to re-baseline:

- `scripts/procgen/solve-seedling-r8-battery.mjs --check` — the standing md5
  **`1fedb0ab35b7cd74accecf0345bdc893`** (exit 1 is correct);
- any committed procgen fixture captured from a solve;
- the Seedling level-sets arc's generated-set fixtures (`§14`).

⇒ **A moved md5 here is a PASS, not a regression** — but it must be re-derived
on a quiet box and stated as deliberate, or the next reader will treat it as a
red. ⚠ Do not re-baseline and fix in the same commit; the diff should show the
behaviour change and the new baseline separately.

## 7. Where this was found

- `docs/json/developer/procgen/seedling-bot.md` — recorded during the tag
  allocator work (Phase 6 of the level-sets arc), deferred as a design decision.
- `docs/json/developer/procgen/omsi.md` — the same property, independently.
- `docs/json/developer/procgen/gotchas.md` — the cross-cutting entry, added
  2026-08-14, which points here.
- `CC/docs/plans/seedling-external-level-sets.md` — bit three separate phases of
  that arc; §16.2 lists it as one of the four things a newcomer gets wrong.

---

# 8. AS-BUILT — landed 2026-08-14

**Status: DONE.** `wallClockMs` is gone from `DEFAULT_BUDGET` entirely; nothing
in the procgen pipeline is denominated in milliseconds any more.

⚠ **§§1–7 above are the brief as written before any measurement, and three of
its load-bearing claims did not survive.** They are kept because the reasoning
is instructive, but **this section wins wherever they disagree.**

## 8.1 What actually changed

| site | change |
|---|---|
| `procgenOracle.js` `DEFAULT_BUDGET` | `wallClockMs: 5000` **removed**; only `maxTicksPerTarget` remains |
| `procgenOracle.js` `assertBudget` | a budget still carrying `wallClockMs` is **refused by name**, not ignored |
| `procgenOracle.js:503` (the defect) | **branch deleted** — a certified solve is `SOLVED`, full stop |
| `procgenOracle.js:452` (thrown arm) | elapsed-time arm **removed**; a refusal is a budget verdict only if it NAMES a budget the call passed in |
| `generate-seedling-level.mjs` | `--budget-ms` refused by name (exit 2) |
| `watchGenerate.js` | `?budgetms` warns and is ignored (a stale bookmark must not hard-fail a page) |
| `procgenScratchPersistence.test.js` | its frozen-clock **workaround removed** — it existed only to dodge this defect |

`ms` survives in `solve()`'s return as **evidence only**. It never reaches the
trace: `levelGenerator` reads `verdict`, `ticks`, `classifiedBy`, `reasonText`
and `budgetKind`, and none of those now depends on elapsed time.

## 8.2 ⛔ The three claims the measurements refuted

**(a) §5.1's question has no answer in expansions, and needs none in ticks.**
The empty room of `:99`'s own provenance measures **134 ticks and 0 expansions**
(50–139 ms, reproducing `:99`'s stated range). So the 40× reasoning that
produced 5,000 ms yields ~**5,360 ticks** — against an observed max *total* of
**800 ticks** over 326 solves / 40 seeds. A bound 6.7× above anything ever
observed is decoration. And 40 × 0 expansions is 0: the case that justified the
number spends none, so there is no expansion equivalent to measure at all.
⇒ **nothing replaced the clock, and that is the measured answer rather than an
omission.** `maxTicksPerTarget` already binds where the clock used to — it
classified 4 of the sweep's 5 `BUDGET_EXHAUSTED` verdicts.

**(b) §4.1 / §3's "plumbing, not redesign" is the wrong fix, twice.** Threading
`TIME_RUNG.maxExpansions` into the budget is real plumbing and it was verified
to be as shallow as the brief says — but:

- as a **bound** it is decoration: the search it caps ran at all in **2 of 326
  solves** and hit the cap in **1**;
- as a **classification** input it is actively wrong: the cap surfaces as *one
  rung's sub-reason* inside a ladder refusal whose other rungs refused about the
  LEVEL ("no admissible corridor", "no live body's removal admits a corridor").
  Classifying on it would convert a true `REFUSED` into a false
  `BUDGET_EXHAUSTED` — a budget excuse for a level that genuinely has no route.

⇒ **before promoting an internal cap to a budget field, measure how often it
binds AND read what a caller would conclude when it does.**

**(b2) §7's citation list is one entry too long.** It says the defect is
"recorded independently" in `docs/json/developer/procgen/omsi.md`. It is not —
that file's only wall-clock reference is a 12 s loop round-trip measurement,
unrelated. The real records were `seedling-bot.md`, `gotchas.md` and the
level-sets plan. ⚠ Cheap to check, and worth checking: a citation list is a
claim like any other.

**(c) §1's seed-20 repro no longer reproduces — and did not pre-fix either.**
Five pre-fix runs of `--seeds=20` were byte-identical at load 55; seed 20's
slowest solve on a quiet box is **217 ms**, nowhere near 5,000. The finding was
real when taken (2026-08-13) and the tree has moved since. ⇒ the "measured
limitations EXPIRE" trap in its own habitat: **the repro inside a finding ages
faster than the finding does.** Re-derive a repro before building an acceptance
on it, or the acceptance is a claim that cannot fail.

## 8.3 ⛓ The repro that does work, and what it revealed

**`--seeds=9`, 5 runs, 192 CPU burners on 8 cores (load ~100–170): 5 failures
out of 5, pre-fix.** And the failure is worse than the brief's "different
candidates":

```
LevelGeneratorError: THE SKELETON DID NOT SOLVE — BUDGET_EXHAUSTED. The empty
bordered room with its goal is the loop's control: it is solvable by
construction, so this is a defect in the room builder, the boot or the goal...
The oracle said: "the solve SUCCEEDED in 5810 ms, over the 5000 ms wall-clock budget"
```

The **skeleton** — the loop's own control arm, solvable by construction — took
5,810–8,334 ms, was reclassified, and the skeleton guard then accused the room
builder of a defect it did not have. It throws `LevelGeneratorError`, **not**
`GenerationAborted`, so it also escaped the exporter's abort handling and
crashed the process (exit 1, zero stdout) rather than being reported as an abort.

⇒ generalisable: **a control arm that the machine can fail will eventually
accuse your code of the machine's problem**, and it will do it in whatever error
class sits nearest — including one nobody's handler catches.

## 8.4 ⚠ RESIDUE — owed, measured, deliberately not fixed here

`planDash`'s `maxExpansions: 40000` permits a **12,267 ms single dash** (seed 13,
quiet box). That cap is far too loose to be a useful cost bound. Lowering it is a
**slowness** finding with its own measurement owed — it is not a determinism
finding, and the two must not be traded for each other. It is deterministic
today: it just takes a long time deterministically.

## 8.5 Gates

Recorded with the box state that produced each, because the acceptance requires
load and every other gate is *less* trustworthy under it.

| gate | box | result |
|---|---|---|
| `npx vitest run frontend/modules/seedlingDemo/` (baseline, pre-change) | quiet, load 0.13 | 3880 / 109 files |
| `solve-seedling-r8-battery.mjs --check` md5 (baseline, pre-change) | quiet | `1fedb0ab35b7cd74accecf0345bdc893`, exit 1 |
| `npx vitest run frontend/modules/seedlingDemo/` (post-change) | quiet, load 2.4 | **3883 / 109 files**, 358 s |

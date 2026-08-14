# Procgen: a deterministic budget — tick-bounded, not wall-clock

**Date:** 2026-08-14 · **Status: QUEUED, no code.** ⚖ **User priority
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

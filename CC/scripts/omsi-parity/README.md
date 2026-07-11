# omsi-parity — fork vs upstream differential parity harness

Proves that the Idle Loops **fork** (`frontend/modules/omsi-loops`, branch
`substrate`) behaves **identically** to the **upstream game at the fork
point**, by running both sims headlessly in lockstep through the same
deterministic scenarios and comparing an **exact full-state snapshot after
every step**. Clones the `CC/scripts/jta-parity/` conventions.

Trivial while the fork carries zero engine mods — but it gates every future
mod: any fork change that shifts sim behavior at defaults shows up as a
pinned first-divergent step and field.

## Comparison target

- Fork point: `fe4a349efb799a56ab548018caca1a1a1aea0c8f`
  ("update Recent Changes with notes from #15" — dmchurch HEAD, 2025-03-23,
  the same commit serving <https://dmchurch.github.io/omsi-loops/>).
  Verified as `git merge-base HEAD dmchurch` inside the submodule by
  `fetch-upstream.mjs`, which also reports live-upstream drift
  (none as of 2026-07-10).
- Fork side: the submodule's **committed HEAD** via `git archive` (never the
  working tree). The commit used is recorded in every result JSON
  (`forkCommit`).
- Upstream side: the fork-point commit, extracted from the submodule's own
  object store (`git archive fe4a349`) — content-addressed, so the
  submodule's copy IS upstream's bytes. No clone, no build step (plain JS).

## Usage

```
node CC/scripts/omsi-parity/fetch-upstream.mjs       # fork-point + drift check
node CC/scripts/omsi-parity/run-parity.mjs           # all scenarios
node CC/scripts/omsi-parity/run-parity.mjs --scenario loops
node CC/scripts/omsi-parity/run-parity.mjs --list

# comparator canary: perturb the FORK engine's towns[0].expWander by 1e-9 at
# step N; MUST report a divergence at exactly that step/field and exit 1
# (guards against the harness ever passing vacuously)
node CC/scripts/omsi-parity/run-parity.mjs --scenario ticks --selftest-perturb 500
```

Everything generated lives in gitignored `upstream/`, `fork-head/`, `results/`.

## How both engines are driven

Boot recipe proven by the experiments lineage (probe-harness → play-harness →
planner-harness, see `NewDocs/plans/omsiloops/experiments/`): Node `vm`
context per engine, the exact 11-file `importScripts` list from
`predictor-worker.js`, ~40 lines of DOM/View stubs, story-function shims,
`loadDefaults()` + the two headless-boot fixups (`stonesUsed`,
`townsUnlocked=[0]`). Each engine lives in its own vm context (fully isolated
module state), so scenarios run process-fresh in one process.

The step driver is the game's real `executeGameTicks` core
(`actions.tick(manaAvailable)` — proven byte-equivalent to `singleTick` by
the experiments), with `manaAvailable` capped per step so the lockstep
granularity is fixed: **1 mana per step** in the `ticks` scenario, 50 in
`loops`. Policies rebuild the queue at every loop boundary from that
engine's own state readout only (no cross-engine reads); both the policy's
intended queue and the **engine-ordered** queue (`actions.next` after
`addAction` travel tail-pinning) are compared at every install.

Both sims are seeded with the same mulberry32 `Math.random` and the snapshot
carries the RNG consumption counter, so RNG-consumption parity is asserted
too (this early route consumes zero RNG — the counter proves it stays zero
on both sides).

## The comparison snapshot (exact, unrounded)

`__snapshotExact()` in `sim-context.mjs`: timer/timeNeeded/curTown,
totals/effectiveTime/timeCounter, resources, townsUnlocked,
completedActions, totalTalent/goldInvested/stonesUsed, every town var
(exp/checked/good/goodTemp/total for all varNames) + suppliesCost +
hiddenVars, skill exp, stat exp + talent exp, buff amounts, the live
`actions.current` execution state (loops/loopsLeft/manaUsed/ticks) and
`actions.next`, dungeon floor state (ssChance/completed), trial floors,
story flags/vars/storyMax — compared as a single JSON string **after every
step**, after setup, and across every loop boundary. No float rounding: the
bar is byte equality (same code today; any future fork mod must keep it at
defaults).

On divergence the harness pins the first divergent step, loop, and field
paths, then watches ~200 more steps to classify transient vs persistent.

Every PASS carries activity floors (minSteps / minLoops / minTicks /
minPeakMana — peak per-loop mana budget proves the scenario engaged
banks/converters, not just the Wander backstop); an under-running scenario
is VACUOUS and fails.

## Scenarios and results (2026-07-10, fork = fork point `fe4a349`, zero mods)

| scenario | drive | granularity | steps | loops | ticks | peak mana | result |
|---|---|---|---|---|---|---|---|
| `ticks` | fixed early queue (Smash Pots x6, Wander x3) | 1 mana/step | 4,000 | 16 | 4,000 | — | **PASS** |
| `loops` | generic scripted policy: harvest every unlocked bank + check up to 10 items, Buy Glasses / Buy Mana Z1 when available, Wander x99 backstop | 50 mana/step | 3,851 | 600 | 190,100 | 1,150 | **PASS** |

Canary: perturbation at step 500 caught at step 501 in
`townDump.0.expWander` (`0` vs `1e-9`), classified persistent — comparator
proven non-vacuous.

**Verdict: PASS — byte-identical on every step of every scenario.**
Aggregate report: `results/parity-report.json`.

## Coverage notes

The `loops` scenario crosses the early unlock wave (Pick Locks at Wander 20,
Meet People, glasses/mana purchases), exercises limited-action
harvest-then-check semantics, purchases, the gold→mana converter, and
per-loop resource evaporation, across 600 full loop resets. Not covered yet:
travel (multi-town queues), multipart actions (dungeons), story-flag-gated
actions beyond town 0, RNG-consuming reward paths (soulstones/surveys), and
save/load round-trips. Extend the scenario table when fork mods start
touching those surfaces — and when the fork's own automation lands, add a
scenario that reuses the planner playthrough as the drive.

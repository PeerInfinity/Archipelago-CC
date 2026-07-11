# omsi-stats — findings summary

Raw per-run JSON lives in local-only `results/` (jta-stats convention); this
file carries the durable numbers.

## Round 1 — Stage 1 acceptance: the fork's Advanced Automation reproduces the v0 planner byte-exactly (2026-07-10)

Fork branch `automation` @ `e15d3d4` (run from the identical working tree),
seed 12345, default weights, predictor cross-check off, fresh save.

| Metric | v0 experiment (frozen reference) | Fork port | |
|---|---:|---:|---|
| Loops to Forest Path (town 1) | 500 | **500** | ✅ |
| Cumulative mana ticks | 5,432,753 | **5,432,753** | ✅ |
| Final-state hash (sha256-16) | `54506b48ec1758af` | **`54506b48ec1758af`** | ✅ |
| RNG consumed | 0 | **0** | ✅ |
| Wall time | ~31 min (Node 23, vm) | 13.6 min | — |

**ACCEPTANCE (≤ 500 loops to town 1): PASS.**
**V0 exact reproduction: PASS — the port did not change planner behavior.**

Milestones (loop): Pick Locks + Buy Glasses unlocked L105 · Investigate L270
· Start Journey unlocked (travel wall) L405 · town 1 at L500. Matches the
v0 milestone table (PLANNER-REPORT §1).

Context for the comparison: the hand-scripted baseline needs 646 loops /
7,526,981 ticks on the same seed; the planner discovers every mechanic it
uses by probing and measurement.

This same run doubles as the whole-system behavioral regression gate the
XML-migration plan adopts for its Phases 4/5 (run it against the XML-backed
build; the hash must not move).

## Round 2 — predictor cross-check variant (`--seed-predictor`) (2026-07-10)

With the predictor-model cross-check enabled, planner DECISIONS are designed
to be identical (engine measurement stays authoritative; the predictor
projection is recorded as a prior and divergences logged as a verifier —
the "third oracle").

**Result: decision-neutrality CONFIRMED — the run is byte-identical to
Round 1** (500 loops / 5,432,753 ticks / hash `54506b48ec1758af`, 0 RNG,
11.8 min), with **54 divergences recorded**.

**Divergence quality caveat:** every one of the 54 shows `predicted=0.00`
(Short Quest/Pick Locks/Long Quest gold yields; Buy Glasses / Buy Mana Z1 /
Buy Supplies gold spends; Throw Party rep spend). That is a limitation of
the current PRIOR EXTRACTION, not evidence against the predictor model: the
prior runs the predictor on a single-exec queue from the LIVE state, so any
action that is resource-gated or costed from that state projects no resource
delta (the planner's engine measurements inject resources; the predictor
probe doesn't). Useful next step for the arc: derive priors from the
predictor's per-action effect table (`Koviko.Predictor.initPredictions()`
entries) or feed the predictor an injected input state, so the cross-check
compares like with like. Until then, treat zero-predicted divergences as
"extraction blind spot", and only a NON-zero mismatch as a true third-oracle
alarm.

## Round 3 — rebase gate + effect-table priors (2026-07-10)

Two whole-system gates, both against the frozen v0 reference
(500 / 5,432,753 / `54506b48ec1758af` / 0 RNG, seed 12345):

| Run | Fork | Result |
|---|---|---|
| Unseeded, after `automation` was REBASED onto the Phase-1 substrate (introspection metadata refactor underneath) | `dd4fd0d` | **byte-exact PASS** |
| Seeded (`--seed-predictor`), after the prior-extraction fix | `0622a54` | **byte-exact PASS** (decision-neutral at full scale) |

Milestone table identical in both (Pick Locks/Buy Glasses L105 · Investigate
L270 · Start Journey L405 · town 1 L500).

**Prior-extraction fix (`0622a54`)**: priors now come from the predictor's
per-action effect table (`predictions[name].effect`) applied to synthetic
accumulators that mirror `measureAction`'s injections, with the snapshot
restored first (effects read live globals: town banks, `goldCost()`, buffs).
Loop-model entries (multiparts) are marked `unsupported` — their rewards
live in per-segment handlers, not the flat `effect()`. Spend-all converters
(Buy Mana zeroes the wallet in one exec) are flagged `goldSpendAll` and the
divergence check compares the engine's TOTAL spend instead of the per-exec
average (the observed `-87.5 vs -1050` mismatch was averaging across a
12-exec batch, not a model error).

**Divergence quality after the fix: 54 blind-spot zeros → 26 entries, all
ONE genuine model boundary** — Short Quest (11) / Pick Locks (9) / Long
Quest (6) gold: the predictor's effect gates yield on the banked
("checked") goods, while the engine also yields gold on FRESH checks, so
measurements taken with an empty bank record small measured-vs-0 gaps.
That is a real predictor-model limitation worth knowing about (it
underestimates queues that check-and-harvest in one loop), and exactly what
the third oracle exists to surface. Non-zero-vs-non-zero mismatches are now
trustworthy alarms.

## Round 4 — parameter sweeps: screenK / probeEvery / weights (2026-07-10)

All unseeded, seed 12345, fork `0622a54` (clean worktree), reference =
defaults (screenK 8, probeEvery 1): **500 loops / 5,432,753 ticks**.

| Variant | Loops | Ticks | vs reference |
|---|---:|---:|---|
| screenK 4 | 542 | 5,878,586 | worse — narrow screen drops good candidates |
| **screenK 8 (default)** | **500** | **5,432,753** | — |
| screenK 16 | 570 | 7,497,789 | worse — see below |
| probeEvery 5 | 531 | 6,384,858 | worse — stale thresholds mis-time unlock pushes |
| weights frontier:1000 | 502 | 7,101,523 | loops ≈ v0's 502 EXACTLY (port-fidelity cross-check) |
| weights bank:10 | 632 | 5,354,266 | loops ≈ v0's 632 EXACTLY (port-fidelity cross-check) |

Findings:

- **Quality is non-monotonic in screenK: the predictor screen is a
  REGULARIZER, not just a compute saver.** Widening the screen to 16 lets
  myopically-attractive candidates through to engine confirmation, and the
  scorer's delayed-payoff approximations sometimes pick one over the
  long-game candidate the narrower screen would have forced. screenK 8
  stays the default.
- **probeEvery > 1 costs real progress** (531 vs 500 at probeEvery 5):
  threshold probes are cheap relative to a mis-timed unlock push. Keep 1.
- **Both v0 weight-sweep cross-checks reproduce loop-exactly** (frontier
  1000 → 502, bank 10 → 632), extending the byte-exact port-fidelity
  evidence from the default point to the weight axis. Tick totals show the
  trade both ways: bank:10 finishes in FEWER ticks (5.35M) across MORE
  loops — the bank-light policy runs shorter loops — while frontier:1000
  matches the default's loop count at a 31% tick premium. Loops and ticks
  disagree about second place, another reason the loops-to-milestone
  primary metric is reported with ticks beside it.

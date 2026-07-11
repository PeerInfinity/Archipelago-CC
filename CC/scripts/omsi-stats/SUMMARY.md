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

## Round 2 — predictor cross-check variant (`--seed-predictor`)

With the predictor-model cross-check enabled, planner DECISIONS are designed
to be identical (engine measurement stays authoritative; the predictor
projection is recorded as a prior and divergences logged as a verifier —
the "third oracle"). Result: <!-- ROUND2 -->pending.

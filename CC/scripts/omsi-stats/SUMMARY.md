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

## Round 5 — stretch goal: past town 1 with no new hand-scripting (2026-07-10)

`--target-town 2 --max-loops 1200`, unseeded, seed 12345, fork `0622a54`.

**Result: town 2 NOT reached — the run hit the 1200-loop cap (32.8M ticks,
84 min wall).** Town 1 fell at L500 exactly as always; the remaining 700
loops split into `grind:Magic` (301), `discover:Throw Party` (40), and
`repeat` (359) — the planner converged to a byte-identical town-0 queue
and repeated it to the cap. This is the expected wall from the plan, now
precisely characterized, and it is NOT an unlock problem: **Continue On
(the town-1 → town-2 travel) unlocked at L500**, the same loop town 1
opened.

Two layers, both town-0-centric planner design:

1. **Travel-candidate filter confuses the travel DELTA with the
   destination** (`planner.js` buildPushes): candidates are kept while
   `!townsUnlocked.includes(a.travelNum)`, but `travelNum` is the offset
   (+1 for both Start Journey and Continue On — destination = townNum +
   travelNum, with specials like Open Portal's -5). For Continue On it
   checks town 1 — already unlocked — so the only route to town 2 is
   never even generated. The check only coincides with the destination
   for town-0 travels, which is why v0 never noticed.
2. **Knowledge never forms for town-1 content.** `refreshKnowledge`
   measures each action with a single-action queue from loop start (town
   0); every town-1 action therefore measures exec=0, and the generators
   only compose `[town-0 economy…, travel]` single-hop queues. Reaching
   town 2 requires a two-hop loop — `[t0 economy, Start Journey, t1
   actions, Continue On]` — plus measurement that runs a travel prefix
   before probing an out-of-town action.

Next arc item (design work, not a patch): destination-aware travel
candidates (townNum + travelNum), travel-prefixed measurement so town-1
actions become measurable, and generators that build per-town sub-queues.
Multipart actions/dungeons — the originally predicted wall — sit BEHIND
this one and stay unassessed until it falls.

## Round 6 — multi-town planner lands; town-2 wall recharacterized as ECONOMIC (2026-07-11)

Fork `automation` @ `c97c50b` (M0 `30b6310` graph/pushes, M1+M2 `04b02e8`
measurement/segments, M3 `efd0ef7` plannerMultiTown option, `c97c50b`
expedition economics). All phases byte-inert at townsUnlocked=[0]:

| run | loops | ticks | result |
|---|---:|---:|---|
| acceptance (M0 tree) | 500 | 5,432,753 | hash `54506b48ec1758af` — **byte-exact** |
| acceptance (M1–M3 tree) | 500 | 5,432,753 | **byte-exact** |
| acceptance (final tree, `c97c50b`) | 500 | 5,432,753 | **byte-exact** |
| cross-check frontier:1000 | 502 | 7,101,523 | loop- AND tick-exact vs Round 4 |
| cross-check bank:10 | 632 | 5,354,266 | loop- AND tick-exact vs Round 4 |
| stretch town-2, M0 only | 1200 cap | 32,833,753 | hash `1240f71c5654f61e`; town 2 NOT reached |
| town-2, M0–M3 as designed | 1200 cap | 32,833,753 | **byte-identical to M0-only** — every multi-town candidate generated+confirmed, none ever won |
| town-2, + expedition economics | 1200 cap | 27,643,753 | hash `e01418a303a0cdb4`; town 2 NOT reached, but the cascade fires (below) |

**The design doc's model of the wall was wrong.** Round 5 framed town 2 as
a planner-structure problem (destination filter + measurement). Both are
fixed and verified (two-hop pushes generate; town-1 profiles form via
travel-prefixed probes), yet nothing changed: the binding constraint is
LOOP CAPACITY. Engine-verified arithmetic at the L500 state:

- Pure town-0 economy loop: 34,250 realized mana − 23,468 pump ticks =
  **10,782 disposable headroom**. Pools are saturated (Pots 500/500,
  SQuests 76/76…); capacity plateaus at 39,250 by L600.
- Gold reserved for a purchase forgoes its converter value (~50
  mana/gold): supplies = 15,000 mana-equivalent (9,000 at Haggle h6,
  rep-capped by the 6-item LQuest bank). Push budgets match exactly:
  19,250 = 34,250 − 15,000 (h0); 25,250 = 34,250 − 9,000 (h6).
- Town-2 price at best composition ≈ 9,000 + 1,639 (Haggle/Buy/Start
  Journey) + 8,000 (Continue On) ≈ 18.6k ≫ 10,782. An h6 expedition
  leaves ~143 ticks of town-1 time. The knowledge model is fine — it is
  actually PESSIMISTIC (realized gold yields exceed measured).
- No alternate route: Hitch Ride (cost 1, dest 2!) and Open Rift are
  story-gated (probeable:false — vanilla unlocks them only after
  reaching those towns).

**Expedition-economics fix** (`c97c50b`: binding tailReserve, full pump +
Haggle variants, generous tails): expeditions WIN from L506 and unlock
six town-1 actions — Wild Mana L508, Gather Herbs L533, Old Shortcut
L570, Talk To Hermit L838, Follow Flowers L909, Clear Thicket L933 (the
as-designed run unlocked ZERO in 700 post-L500 loops). The run then
converges to replaying an h6 expedition loop (mana 30,250 = 39,250 −
9,000 toll, paid every loop).

**The NEXT wall is scoring horizon (design doc §11.5, now proven):**
Old Shortcut — whose progress cheapens Continue On's 8,000 and is the
vanilla-intended key to town 2 — was ground exactly ONCE in 700 loops:
travel-COST reductions are invisible to the frontier term (it prices
unlock thresholds only). Ditto capacity compounding (Wild Mana bank
growth via sustained investment). Both need a scoring design pass
(travel-relief term gated to multi-town states + multi-loop capacity
valuation), not a patch. Multiparts/dungeons remain unassessed behind it.

## Round 7 — scoring-horizon pass: the capacity probe was the real lever (2026-07-11, session 8)

Fork `automation` @ `c990b16` (expGainMultiplier `1db09f6`; scoring terms +
snapshot-start resume `d276342`; headroom/probe fix `a39bc27`; Stats-panel
Automation view `51442a3`/`c990b16`; AUTOMATION.md `6ed71d1`). Outer:
`--gain-mult`/`--save-state`/`--from-state` + sidecar progress logs in
run-planner.mjs.

**Enablers.** expGainMultiplier multiplies exp ONLY (three engine funnels;
economy stays real; 1 = byte-inert, identity golden). Snapshot-start resume
is BYTE-EXACT (resumed L40→L55 at 100x ≡ continuous: trace + hash) and
carries the knowledge table, so scorer iteration skips the 500-loop replay.

**Gates (all green).** v0 acceptance byte-exact (500 / 5,432,753 /
54506b48ec1758af) on `1db09f6`, `d276342` AND `a39bc27`; weight cross-checks
loop- AND tick-exact on the final tree (frontier:1000 → 502/7,101,523;
bank:10 → 632/5,354,266); npm test 25/25; CI green; UI smoke 20/20.

**Design.** Two mana-unit terms, gated on pre.townsUnlocked.length > 1
(byte-inert at [0]): travelRelief (Δ summed route costs to reachable towns —
prices Old Shortcut → Continue On 8000−60/level) and headroom
(Δ(capacity − pump cost) vs last committed loop). Validation then exposed
that headroom read 0 BY CONSTRUCTION twice over: the chunk driver's spent ==
budget on every completed loop (pump cost = Σ lastExec manaUsed instead),
and the capacity probe's end-loaded converter STARVED once banks outgrew the
base budget (probe 5,250 vs realized 21,250 at a 10x L140 state) — fixed
with cushion-chunked interleaved harvests, state-gated (`a39bc27`).

**Multiplier sensitivity (get-it-working-boosted-first ruling):**

| regime | result |
|---|---|
| 100x | NO WALL: town 1 L84, town 2 L85, unmodified scorer — 100x cannot discriminate designs (~3.5 min/run; plumbing smoke only) |
| 10x | wall melts economically: town 2 L213 (control == pre-fix design BYTE-IDENTICAL — terms never flipped a winner); fixed tree L232 (−19 loops: the redirection costs more than it buys where frontier dominates) |
| 1x | wall STANDS at L1200 (700 resumed loops from the shared L500 donor), both arms |

**1x attribution (the round's key finding).** Full design vs
terms-zeroed control, both on the fixed tree, from the same L500 state:
NEARLY IDENTICAL (same 15 milestones incl. Hunt unlocked L732/L~732 and Bird
Watching visible; histograms differ by single loops; Shortcut ground 2 vs 1
times; 22.43M vs 22.49M ticks). Both differ RADICALLY from Round 6: sustained
town-1 investment (Forest grinds ×52, invests ×71, Thicket discovery ×15 vs
Round 6's near-total `repeat` convergence). So the behavior change came from
the CAPACITY-PROBE FIX, not the scoring terms: accurate capacity flows into
capacityHint, which sizes expedition tail batches — the starved probe
(~5k instead of ~32k) had been silently crippling town-1 tails all along.
The terms themselves are cheap and directionally right but marginal at
their current weights (relief credits ~180/Shortcut-level vs an ~7k gap).

**Residual wall at 1x = economy-dominated:** 9k supplies toll every loop
against a bank-limited ~39k plateau; Old Shortcut relief accrues ~2 levels
per rare grind loop. Options for the next arc: heavier relief weighting
(sweep W.travelRelief 10–30 from the L500 snapshot), buff-grant visibility,
multipart assessment — all pending recalibration under the SUCCESS-METRIC
ruling (user, session 8): loops-to-town-N incentivizes capacity-maximizing
loops; ticks/wall-clock (both already recorded) may be the truer metric,
and weight calibration (incl. bank 30 / bankPot 15) should be redone under
whichever is chosen. The harness side SHIPPED same session: `--metric
loops|ticks|wall|weighted` (+ `--metric-weights`), reported/stored as
metricValue — **default stays loop count for now** (user ruling); gates
unchanged. ALSO ruled: v1 AP location checks = RESOURCE unlocks (pool
discovery + lootable checking), NOT action unlocks.

**New defect found (browser-vs-worker):** "Lootable first" checkboxes are
DOM-only; the worker has no DOM, so its sim plays LOOT-FIRST while the
browser default is CHECK-FIRST — live play can realize a different budget
than the plan. RULED + SHIPPED same session (fork `af09547`):
`plannerControlLootFirst` (default ON) — ON: automation sets all
searchToggler boxes to its loot-first model at each plan request; OFF:
live checkbox states are forwarded with the plan message and the worker's
getElementById shim returns HTMLInputElement stubs carrying them. Headless
paths untouched (byte-gates unaffected); UI smoke 23/23 covers both
branches.

## Round 8 — human-opening arms: wander-first loses at the town-1 horizon under BOTH metrics (2026-07-12)

Success-metric experiment (plan §11.5 open item 1, three-arm design ruled
by the user): harness `--wander-until N` (zero fork changes) plays the
human opening — [Wander x1] every loop, NO planning — until town 0
Explored reaches N%, then hands the planner a resume blob at the switch
point. Engine fact found on the way: Wander costs 250 mana == starting
mana and stat LEVELS reset per loop, so wander-only play is pinned at
exactly one 250-tick Wander per loop ([Wander x1] ≡ [Wander x99],
identical 2,525-loop probes). Fork `automation` @ `4174348`
(--worktree), seed 12345, defaults, targetTown 1.

| Arm | Total loops | Total ticks | Planner phase | End-state talent |
|---|---:|---:|---|---:|
| A: baseline | **500** | **5,432,753** | 500 L / 5.43M t (V0 byte-gate PASS) | 108,113 |
| B: wander→50% (638 L) | 1,046 | 6,545,842 | 408 L / 6.39M t | 132,574 |
| C: wander→100% (2,525 L) | 2,816 | 6,341,414 | 291 L / 5.71M t | 129,468 |

**Key finding: exploration converges regardless — all three arms end
town 1 with Explored 100% and IDENTICAL pools (500 pots / 100 locks).**
The baseline already fully explores town 0 en route (Buy Glasses at L105,
then 4x-rate exploration interleaved with economy), so a raw-Wander
prefix buys nothing durable: it pays for exploration at the 4x-worse
pre-glasses rate, without economy, and the planner would have acquired
the same map anyway. The only residual asset is talent (+22% in B/C) —
and that comes from running MORE loops, not from exploring earlier.

**Both metrics agree at this horizon** (baseline wins loops AND ticks) —
the first data point for the metric ruling, and a null one: these arms
don't discriminate the metrics. Curiosities worth remembering: (1)
pre-exploration DOES cut planner-phase loops monotonically (500 → 408 →
291) — the planner from a 100%-explored state hits Start Journey in 177
planner loops vs 405 — but the loops are so mana-rich that planner-phase
TICKS still exceed baseline (C: 5.71M > 5.43M before even counting the
wander phase); (2) the 50% arm is worse than the 100% arm in ticks
(6.55M vs 6.34M) — B's planner phase alone (6.39M from 50% explored)
spent more ticks than the baseline's whole run from 0%, an anomaly not
yet diagnosed.

Town-1 end states saved (state-arm{A,B,C}-town1.json). POST-ROUND RULING
(user, 2026-07-12): wander-first is CLOSED as a failure — no sub-50%
sweep, no special-case openings in the algorithm. The talent residue is
devalued too: every action gives talent, and per-tick stat exp scales
with expMult (actions.js:706; 85 actions at x1 incl. Wander, 17 at x2,
8 at x4, 5 at x5), so B/C's +22% talent is reproducible ~4-5x more
tick-efficiently by deliberately grinding high-expMult actions — the
--from-state talent continuation is deprioritized. If a ticks-flavored
metric ever makes talent compounding score-worthy, the vocabulary is
high-expMult grind CANDIDATES (expMult is already exported in
plReadState, currently unused in scoring).

## Round 9 — metric-disagreement hunt: NULL at the optimum; bankPot:8 dominates; a fixation hole at bank:20 (2026-07-12)

Initial attempt to find loops-vs-ticks disagreement (user-directed; the
pre-registered fallback: if none found, adopt "track both, stop
hunting"). Six new 1x lab runs (seed 12345, town-1 horizon, fork
`4174348` --worktree) along the bank/bankPot axis, joining three known
points:

| Config | Loops | Ticks | |
|---|---:|---:|---|
| **bankPot:8** | **484** | **5,099,270** | **argmin BOTH metrics** |
| default (bank:30/bankPot:15) | 500 | 5,432,753 | the frozen reference |
| frontier:1000 | 502 | 7,101,523 | known (R4) |
| bank:15 | 531 | 5,764,277 | worse both |
| bank:45 | 534 | 7,276,823 | worse both (+34% ticks) |
| bank:10 | 632 | 5,354,266 | known (R4) — 2nd in ticks, 6th in loops |
| bank:10+bankPot:8 | 636 | 5,502,151 | lean combo does NOT compound |
| bank:5 | 694 | 6,550,643 | bank:10's tick edge collapses |
| bank:20 | DNF (1200 cap) | 29,455,600 | fixation hole — see below |

**Verdict on the metric question: the metrics AGREE about the winner.**
bankPot:8 is optimal under loops AND ticks; the only disagreement in the
field remains the known bank:10 asymmetry (−1.4% ticks for +26% loops),
which no config amplified. Per the pre-registered rule, the
recommendation is: keep loops as the primary metric (standing ruling),
keep recording ticks/wall beside it (the harness already does), fold
metric-watching into the other planned work, and stop actively hunting
disagreement sources.

**Finding 2 — recalibration debt is real but modest:** bankPot:8 beats
the shipped default on both currencies (−3.2% loops, −6.1% ticks).
DEFAULT_WEIGHTS is NOT changed: one seed, one horizon, and a default
change invalidates the frozen byte-reference (500/5,432,753/54506b...)
→ that belongs to the deliberate recalibration pass (ideally after the
§11.7 eval pool makes sweeps cheap), not a drive-by.

**Finding 3 — the weight landscape has a fixation HOLE, not a smooth
trade-off:** bank:20 NEVER reached town 1 (1200-loop cap, 29.5M ticks)
despite unlocking Start Journey at L462 — `repeat` won 675 of the last
738 loops while it built the fattest economy of any run (34,750-mana
loops). Healthy neighbors on BOTH sides (15 → 531, 30 → 500). Mechanism
undiagnosed (same fixation class as the R5/R6 walls: the travel push
never outscores the banked-economy loop at exactly this credit level).
Consequences: weight calibration is a ROBUSTNESS problem, not just an
optimization problem — sweeps must flag DNFs, and AP-randomized content
(different economies) raises the odds of landing in a hole. A
cap-triggered anti-fixation guard (e.g. frontier boost after N identical
committed queues) is a candidate general mechanism, consistent with the
no-special-cases doctrine.

## Round 10 — parallel eval pool SHIPPED: 2.0x, and the planner's true bottleneck is the predictor screen (2026-07-12)

§11.7 Design A implemented (fork `automation` @ `efc9b36`: setEvalPool
hook + confirmCandidate extraction + per-phase wall instrumentation;
outer `5e0fd6d13`: eval-worker.mjs + `--pool N` batched worker_threads
host). All gates byte-exact: v0 acceptance serial AND pool-8 both
reproduce 500 / 5,432,753 / `54506b48ec1758af` / 0 RNG; fork npm test
26/26 (new two-kind pool-contract equivalence test).

**Measured speedup at --pool 8: 2.0x full-run (1775s → 878s, identical
contention), not the 4–8x the design estimated.** The new phase
instrumentation explains why, and the finding matters beyond the pool:

- **The Koviko predictor screen is 80–93% of ALL planning wall time**
  (L200 profile: screen 80 / confirm 14 / probe 3 / know 1; full 500-run
  serial: screen 93 / confirm 6). Engine confirms — presumed dominant
  since v0 — are a rounding error. Pooling confirms alone bought 5%.
- Pooled rounds are bounded by the SLOWEST SINGLE PREDICTION, not worker
  count: late-game committed queues run 50+ entries and the predictor
  scales with queue length, so the `repeat` candidate's prediction is a
  long pole that caps per-round parallelism at ~2–3x. Batched dispatch
  (one message per worker per round) recovered the messaging overhead
  (per-job round trips cost ~as much as the predictions themselves).
- Worker-side snapshot restore caching was a no-op (predictions are
  state-pure; restores were never the cost).

Further speedup routes, all BEHAVIOR-CHANGING and therefore future
design decisions, not drive-bys: predictor-level optimization (its cost
model, not the planner's), screening long repeat queues incrementally,
or narrowing what gets predicted. For now: `--pool 8` halves every
stats run; acceptance stays gated on the serial path.

## Round 11 — screen-mode A/B: the K-cut is the regularizer; engine screen = the 5x iteration regime (2026-07-12)

User question: if the predictor costs more than the engine (Round 10),
use the engine for the screen step — or skip screening? Fork gained
`screenMode: predictor (default) | engine | none` (`e3d4d89`; runner
`--screen-mode`). All arms pool-4, seed 12345, 1x. **Every run in this
arc consumed 0 RNG — the trajectory is fully deterministic, so gaps
below are facts about THE canonical run, not sampling noise** (there is
no seed axis to average over until AP randomization exists).

| Arm | Loops | Ticks | Wall (shared box) |
|---|---:|---:|---:|
| predictor screen, K=8 (reference) | **500** | **5,432,753** | 772s — byte-exact PASS |
| engine screen, K=8 | 514 | 5,954,659 | **156s (~5x)** |
| no screen (all confirmed) | 570 | 7,497,789 | 132s |

Findings:
- **`none` reproduces Round 4's screenK:16 EXACTLY (570 / 7,497,789)**
  — K=16 was already past the candidate count, so that old data point
  WAS the no-screen ablation: the K-CUT is the regularizer, worth 70
  loops / 38% ticks, independent of what ranks the candidates.
- **Engine-truth ranking is slightly WORSE than the predictor's
  model-gapped ranking** (+14 loops / +9.6% ticks). First divergence at
  L292: the engine screen admits `discover:Investigate`, which WINS the
  round (793 > invest:1's 787) — locally better, globally worse. The
  predictor under-ranks discovery queues (its known model gap), which
  functioned as accidental regularization against a myopic pick. A
  lesson for scorer work, not a defense of the predictor per se.
- **Engine screen has no long pole** (uniform loop cost per candidate vs
  predictor cost scaling with queue entry count): full 1x runs drop to
  ~2.6 min pooled.

**Standing usage ruling (recorded):** the reference/acceptance gates
stay on `predictor` (default, byte-inert — no re-baseline); `--screen-
mode engine` is the ITERATION regime for sweeps and experiments (~5x,
quality within 3% loops on the canonical trajectory); `none` is
rejected. Sweeps should final-check winning configs under predictor
mode before drawing conclusions.

## Round 12 — systematic action-code census: the complete blind-spot map (2026-07-12, session 10)

Queue item 1 of the ARCHITECTURE-FIRST sequencing ruling: all 157 actions'
reward/effect code audited (mechanical harness extraction + hand read of
every finish/segment/loop/floorReward handler and the shared reward
helpers). Durable deliverable: **`ACTION-CENSUS.md`** (this directory) —
per-action table, complete effect-channel taxonomy, visibility
classification against the measurement + scoring vocabulary.

Headline results (details and per-action rows in the census):

- **The blind-spot map is now CLOSED-FORM**: every reward-path statement in
  the game maps to one of the census channels; the reward-path RNG surface
  is exactly 4 sites (dungeon soulstones ×2-roll, Mine Soulstones stat
  pick, exchangeMap zone pick).
- **Buff grants (7) are the deepest hole**: Ritual/Imbuement/Imbuement2/
  Feast/Heroism/Aspirant/Imbuement3 — the mid/late-game capacity levers
  (zone speed, starting stats, training caps, exp/talent mults) are
  entirely absent from the read state, profiles, and scoring.
- **Soulstones are an invisible ECONOMY, not just a resource**: granted by
  3 dungeon lines + Mine Soulstones, spent by the 3 sacrifice buffs,
  and each stone multiplies stat exp (1 + ss^0.8/30) — none of it
  differenceable today.
- **The skill-level efficiency web is the highest-leverage scoring
  extension**: 15+ skills cheapen or amplify OTHER actions' costs/yields;
  only travel edges are credited (travelRelief). Yield INCREASES
  (goldCost-as-yield: pots/locks/quests × Dark/Practical/Thievery) are
  never attributed to the skill action — they arrive as measurement lag.
- **A gate class blocks MEASUREMENT, not just scoring**: needs-probing
  raises resources positively only — guild membership (a global, not a
  resource), negative-rep clauses (Dark Magic/Ritual, Thieves Guild),
  upper bounds (power < 8), soulstone/talent/buff floors, and time gates
  (Escape < 60s) all measure exec=0 forever. Guild-gated town-2/7
  economies are unmeasurable without composed (join-prefix) probes.
- Structural distortions catalogued: cross-town effects outside the
  measured town's window (exchangeMap, Build Tower/adjustRocks),
  consumption invisibility (33 cost() bodies verified), context-dependent
  reward amounts (Seek Blessing/Buffet/Guild Assassin scale with per-loop
  counters), temporal decay (Mana Well = 5000 − 10×effectiveTime).
- Census §5 records the design implications for queue item 4 (metadata =
  channel existence + gates; empirical measurement stays authoritative
  for rates; read-state extensions must stay byte-inert additive).

No fork changes, no harness changes, no behavior changes this round —
audit only.

## Round 13 — bank:20 fixation DIAGNOSED: starved [0] capacity probe + rep-capped h-ladder; anti-fixation design drafted (2026-07-12, session 10)

Byte-exact reproduction of the Round-9 DNF to L470 (trace EXACT vs the
original), then a one-round candidate-eval dump from the resumed state
(planRound's `evals`). Full write-up + proposed response: plan §11.9
(design for user review). The chain:

- **The capacity probe is starved in ALL town-0 states** — prevTimeNeeded
  = 5250 (250 + 50 pots × 100) in the hole at L470 AND in the healthy
  reference at L500, vs 27k–35k realized. This is the Round-7 end-loaded-
  converter starvation, deliberately left un-fixed at townsUnlocked=[0]
  (the a39bc27 interleave is gated `length > 1`) to preserve the
  byte-reference. Candidate economies are sized against a ~7x-understated
  capacityHint everywhere in town-0 play.
- **The Haggle ladder is capped by the rep-bank model**: fixated state has
  goodLQuests=3 / totalLQuests=19 (low Met progress) → h ≤ 3 → supplies
  ≥ 240 gold; every healthy run won its push with h4–h6 from
  goodLQuests≈6 / totalLQuests=30.
- **Every push eval dies mid-queue before Buy Supplies** (exec ledgers:
  0/1 on the whole purchase tail; the loop runs dry at Short Quest 5–7 of
  13) → pushes score talent-only (~3) < repeat (~6) → discover arms win
  while bankPot expectation lasts, then repeat absorbs. 0 RNG freezes it:
  mana pinned at exactly 34,750 for 600 loops.
- Separation data for a general guard trigger (all 11 traces): healthy max
  committed-queue repeat streak 16, max milestone drought 135; the hole
  617 / unbounded. Proposed (plan §11.9): Part A root fix = un-gate the
  interleaved probe at [0] + always include the optimistic h arm (both
  re-baseline items, first change of the queue-item-6 pass); Part B =
  streak/drought-triggered one-round search escalation (full re-measure,
  no screen cut, full h range; K doubles on failure) — byte-inert on the
  reference by measured margin (16 < 32), option-gated.

Artifacts: results/session10-bank20-to470.json (+ resume blob
session10-bank20-L470.json), diagnose-round.mjs (promoted into this
directory: resume any --save-state blob, dump full per-round evals +
push exec ledgers; pass the donor's --weights). No fork
changes this round (diagnosis + design only). Also this session:
rep-gap tracker shipped (fork `2b79ceb`, Round-12 census `b32f9d33b`).

## Round 14 — §11.10 targeted mode T0+T1: goal-regression engine SHIPPED; the bank:20 escape is economy-walled, not scoring-walled (2026-07-13, Opus)

Targeted-mode plan `NewDocs/plans/omsiloops/omsi-loops-targeted-mode-plan.md`
(§12 = T0 results). Fork `automation`: T1 adds `regressAction` /
`generateTargeted` / `planTargeted` (a goal-directed backward regression that
generalizes `buildPushes`), a new orthogonal `plannerStrategy: heuristic |
targeted` (§7 Option X, byte-inert at the default), and the runner flag
`--target-action NAME`.

- **T0 de-risk (§8.1, RULED v2):** guild MEMBERSHIP (`guild==="X"`, the actual
  gate) is set after ~3000 mana — one Crafting Guild rep — long before the 2M+
  RANK; `[Crafting Guild x1, Apprentice x5]` runs in ~12k mana in one loop. The
  L11 "zero progress with 50M injected" was a town-0 probe artifact (the town-2
  action was never selected at curTown 0). But guild goals only succeed
  deep-game (reach town 2+, unlock Drunk≥30 which v1 does not regress, nonzero
  Magic/Crafting), so v1 covers route + canStart + repMax gates only; guild
  goals deferred to v2 (as WITHIN-loop action goals, not the multi-loop setup
  the plan assumed). §8.2 rep-sinks and §8.3 persistent-Δ differencing both
  confirmed.
- **T1 mechanism PROVEN:** default-weights `--target-action "Start Journey"`
  installs the regressed chain the loop it first CONFIRMS achievable —
  `L514 target:Start Journey:h4` → town 1. The engine confirm IS the
  achievability oracle (a chain whose target never executes is not installed).
  At default weights that is L514 = the same loop the heuristic's own push
  becomes fundable, so no early escape there — but the install proves the
  regress→confirm→install→commit pipeline end to end.
- **The bank:20 escape is ECONOMY-walled, confirming Round 13.** Targeting
  Start Journey under `--weights '{"bank":20}'` does NOT escape (0 installs
  through L911, still `repeat`/34,750). Direct diagnosis on a fixated state:
  the Start Journey chain's own loop budget (~19,750, earned by its own harvest)
  cannot fund the toll — the reserved supplies harvest (Short Quest ×12 for
  ~240g at h3) exhausts it before Buy Supplies, exactly the "push dies before
  Buy Supplies" ledger of Round 13. This is the starved-[0]-capacity /
  rep-capped-h-ladder economics whose fix is **Part A (re-baseline, out of
  §11.10 scope)**. So the plan's §10 headline framing (targeted escapes bank:20
  "Part-A-independent", i.e. a pure SCORING problem) does not hold: bank:20 is
  *both* mis-scored (repeat > push) *and* economically infeasible in one loop.
  Targeted mode fixes the scoring half (install-without-scoring) but the chain
  still runs dry. **Open for T4 / user:** the bank:20 escape needs either a
  Part-A economy slice pulled into scope, or the headline gate re-scoped to a
  state where the toll is fundable.

Byte-gate: 500 / 5,432,753 / 54506b48ec1758af (0 RNG, pool-8) at the default
strategy (heuristic). npm 44/44 (+6 targeted-mode tests incl. a
targeted-falls-back-to-heuristic byte-equivalence guard). Iteration ran under
`--screen-mode engine` (~2 min/run); no DEFAULT_WEIGHTS / reference change.

### Round 14 addendum — T2: target-value goals + §4 measurement extension (2026-07-13, Opus)

Fork `automation`: `measureAction` now differences the piece-1 persistent
read-state fields across each probe (`p.persistentDelta = {buffs, soulstones,
goldInvested}`, the identical subtraction `grants` does) — byte-inert (an
additive profile field the heuristic scorer never reads; the snapshot hash
covers game state, not the knowledge table). New `regressTarget` /
`rankValueProviders` / `readStateValue`: a kind-b target-value goal FILLS the
loop with the max-ΔR provider toward a PERSISTENT target (skill/progress level,
buff, soulstones, goldInvested — ruling 6; NOT gold/rep/mana), reusing
regressAction for the route/gate/economy scaffold and replacing its terminal x1
with a pool-availability-capped fill. V is the across-rounds stop condition
(planTargeted drops a goal once read-state R ≥ V). Runner flag
`--target-value TYPE:NAME:VALUE`. Functional check:
`--target-value progress:Wander:8` installs `value:progress:Wander` 4/5 loops.
§4 differencing was empirically validated at T0 (goldInvested Δ=500 on a forced
Invest). npm 50/50 (+6 T2 tests incl. a satisfied-goal byte-equivalence guard).

### Round 14 addendum — T3: priority list + budgets + residual fitting + UI (2026-07-13, Opus)

Fork `automation`: the targeted strategy now composes a whole priority list into
ONE committed queue. New `assembleTargetedQueue` — the highest-priority
achievable goal is the SPINE (economy + chain); lower-priority kind-b goals
layer BUDGETED fills onto the shared economy against a running remaining-ticks
counter (cascade falls out of the counter; §3.5); leftover budget goes to a
heuristic grind tail (residual handoff, ruling 5); full fallback = no goal's
scaffold forms. planTargeted confirms the assembled queue and, if the residual
extension starved the spine (§8.4), retries the bare spine. `autoRankGoals`
enumerates the blocked travel frontier (ruling 2). Options registered
(`plannerStrategy` / `plannerTargets` JSON / `plannerAutoRankTargets`, all
isStandardOption:false = extraOptions save-compat) and threaded through
automation.js → planner-worker.js. Automation-view UI: strategy select +
auto-rank checkbox + a priority-list JSON textarea (add/remove/reorder-by-edit;
a richer row editor is deferred polish). Runner flags `--targets` / `--auto-rank`.

Byte-inert: 500 / 5,432,753 / 54506b48ec1758af (0 RNG, pool-8) at the default
strategy. npm 53/53 (+3 T3 tests: budgeted layers + cascade + residual tail,
unbudgeted-spine greed, auto-rank enumeration). Playwright ui-smoke 31/31
(strategy select + auto-rank + priority-list textarea render, sync via
loadOption, and persist through save()/reload).

### Round 14 addendum — T4: §6 stagnation trigger SHIPPED; bank:20 headline gate FAILS on the economy wall (2026-07-13, Opus)

Fork `automation`: the §6 anti-fixation trigger. `updateStagnation` tracks the
committed-queue identity STREAK and the no-new-action-availability DROUGHT on P
(not serialized, like perf). planRound: when `plannerAntiFixation` is on and the
HEURISTIC has fixated (streak ≥ K=32 or drought ≥ D=256), it auto-enters ONE
all-in targeted escalation round (`planTargeted({escalate})` → autoRankGoals,
ignoring the user list + budgets); a failed escalation that re-commits the same
queue doubles K (sticky backoff). Option `plannerAntiFixation` (default off,
isStandardOption:false) + Automation-view checkbox + runner `--anti-fixation`.

**Byte-inert by margin:** default off, and even on, the separation holds
(healthy max streak 16 < K 32); v0 acceptance reproduces 500 / 5,432,753 /
54506b48ec1758af (0 RNG, pool-8) at defaults. npm 55/55 (+2: streak/drought/
K-backoff counters, byte-inert-margin guard).

**HEADLINE GATE FAILS — bank:20 is economy-walled, not scoring-walled.**
`--anti-fixation --weights '{"bank":20}'` DNFs at 1200 loops with **0
escalation installs**. The trigger FIRES correctly (the repeat streak reaches
~738 during the L462–1200 fixation, far past K), and every escalation round
regresses the Start Journey goal — but the chain confirms **SJ exec=0 at ALL
bank levels, including the L1200 max-bank state** (h0/h1/h3 loop budgets
19,750–22,750; the chain's own harvest can't reach repeat's 34,750 because it
doesn't invest, and the supplies+travel toll doesn't fit the ~20k it musters).
This is exactly Round 13's "push evals die before Buy Supplies" — the starved
[0]-capacity / rep-capped-h-ladder economics whose fix is **Part A (un-gate the
[0] capacity probe + optimistic h arm), a re-baseline item the §11.10 plan
explicitly scoped OUT** (§8.4). So the plan's §10 framing (targeted mode escapes
bank:20 "Part-A-independent", i.e. a pure SCORING problem) does not hold:
targeted mode fixes the scoring half (install-without-scoring) and the trigger
fixes the auto-entry, but the chain is economically infeasible in one loop
regardless. **The bank:20 escape needs a Part-A economy slice pulled into scope;
open for the user** (and bears on the plannerAntiFixation default — the guard
fires but cannot escape until the economy is fixed).

## Round 15 — Part A: un-gated town-0 capacity probe SHIPPED; the bank:20 headline gate now PASSES; reference deliberately re-frozen (2026-07-13, Opus)

Parent design: multitown-planner-plan §11.9 Part A; brief
`NewDocs/plans/omsiloops/omsi-loops-part-a-rebaseline-plan.md`. This is the
FIRST deliberate move of the frozen byte-reference since v0. **A1 only** landed
(A2 dropped — see below).

**A1 — un-gate the interleaved capacity probe at `[0]`** (planner.js:698,
`const interleave = post.townsUnlocked.length > 1` → `true`). The Round-7
`a39bc27` fix had left town-0-only states on the v0 non-interleaved path to
preserve the byte-reference; consequently `planning.prevTimeNeeded` read 5,250
in ALL town-0 states while committed loops realize 27k–35k — a ~7× understated
capacityHint that mis-sized every economy/push candidate. A1 makes the
cushion-chunked interleave the universal path.

**The re-freeze (old → new, side by side):**

| metric | v0 (pre-Part-A) | Part A (A1) |
|---|---|---|
| loops to town 1 (default) | 500 | **535** |
| cumulative ticks | 5,432,753 | **5,965,890** |
| final-state hash (sha256-16) | `54506b48ec1758af` | **`e23f020400162f9a`** |
| RNG draws | 0 | 0 |

Predictor screen, seed 12345, pool-8. Run **twice** under the predictor screen,
byte-identical both times; engine-screen run of the same tree is ALSO
byte-identical (535 / 5,965,890 / `e23f020400162f9a`) — 0 RNG, fully
deterministic. Old V0 gate correctly reports MISMATCH (the change binds). The
+35-loop healthy cost (+9.8% ticks) was accepted by the user as the price of the
headline-gate fix (ruling 2026-07-13). Golden `candidates-town0.json` is
UNCHANGED under A1-only (A1 does not alter the town-0 candidate SET; the probe
change affects sizing, not these synthetic states). npm 55/55.

**HEADLINE GATE (bank:20 escape) — PASSES.** `--weights '{"bank":20}'`:
pre-Part-A DNF@1200 with 0 escapes → post-A1 **escapes to town 1 at loop 538**
(538 / 5,783,328 / `f8a0a310fdf528d8`, 0 RNG). Critically the **plain
heuristic** escapes; `--anti-fixation` produces byte-identical output (the guard
never changes the outcome here). So §11.9's "Part A alone probably melts it"
held, and the datum for the `plannerAntiFixation` default is clear: **plain
escapes ⇒ default stays OFF** (user ruling 2026-07-13; a guard the plain path
doesn't need to escape).

**Why A2 (the optimistic h arm) was DROPPED.** Attribution matrix (engine
mode, seed 12345):

| variant | healthy default | bank:20 |
|---|---|---|
| baseline `48bd32e` | 500 | DNF@1200 |
| A2-only | 514 | DNF@1200 |
| A1-only | **535 / `e23f0204`** | **escapes @538 / `f8a0a310`** |
| A1+A2 | 535 / `e23f0204` | escapes @538 / `f8a0a310` |

A1-only == A1+A2 **byte-for-byte on BOTH scenarios** ⇒ A2 is inert on top of A1.
It only adds a `push:Start Journey:h15` candidate in synthetic states that never
win from fresh (the actual escape uses the ordinary h4–h6 rep-capped ladder,
which A1's accurate capacity now funds). The §11.9 rationale for A2 ("h15 makes
supplies price 0") is therefore **falsified** — A1's sizing accuracy, not the
optimistic arm, funds the toll. A2 alone is mildly harmful (514, still DNF), so
it was dropped; only A1 shipped (user ruling 2026-07-13).

**Out of scope (calibration stays LAST, handoff item 5).** The two prior
weight-sweep cross-checks (frontier:1000 → 502, bank:10 → 632) predate Part A
and no longer reproduce byte-exact; they are re-measured in the calibration
re-baseline, not here. DEFAULT_WEIGHTS, scored channels, DNF-aware sweeps, and
the bankPot:8 re-test all remain in that last queue item.

## Round 16 — vocabulary arc W0–W4 SHIPPED: measured data channels + coverage report, no scoring (2026-07-13, Opus, session 15)

Queue item 4 (ARCHITECTURE, not calibration). All 5 phases landed byte-inert vs
the Round-15 reference **535 / 5,965,890 / e23f020400162f9a / 0 RNG** (seed 12345,
pool-8, predictor). Submodule `automation`: W0 `501e573`, W1 `f289007`, W2
`ac8f62c`, W3 `868c757` (outer gitlink LEFT on substrate pin `531faa3`). This
harness (run-planner.mjs, outer `ab3ad75f6`) gained two flags:

- **`--coverage`** — writes `results/vocabulary-coverage.json` + prints a
  census-class → measured/declared-channel map with sample values probed on
  representative states. The item-5 calibration handshake artifact. Sample run:

  | census class | coverage | sample |
  |---|---|---|
  | 1 buffs | 7 dimEffects declared + persistentDelta.buffs measured | — |
  | 2 soulstones | persistentDelta.soulstones/perStat measured (rng cycle) | Small Dungeon per-stat +0.083/exec |
  | 3 stacks | 4 segmentRate skills declared; consumes{} | — |
  | 4 skill web | 15 skill dims declared + edgeRates measured | Practical→Smash Pots manaCost **−0.067**, →Pick Locks goldYield **+0.017** |
  | 5 gates | 22 declared | — |
  | 6 ledgers | persistentDelta.dungeons/trials/mult/… measured | Small Dungeon floor completed +0.083, ssChance drift <0 |
  | 7 cross-town/context | crossTown:7 temporal:2 dynamic:15 rng:5 | Learn Alchemy consumes herbs:10 |

- **`--rng-mode random|cycle`** — exposes the W0 fork option (default random keeps
  the frozen reference; cycle enables RNG-channel measurement + Layer-P probing of
  RNG targets). Serial only (pool workers boot their own context); folded into the
  `knobsAtDefaults` byte-reference guard.

**Informed mode** (`--vocabulary informed`) runs deterministic (twin hash
`209a55c3d687c876`) and clean under both random and cycle. **No scoring/weights
changed** — DEFAULT_WEIGHTS untouched; scored channels that CONSUME this coverage
stay in the item-6 recalibration bundle. **Deviation:** multipart segmentRate
LIVE measurement is v2 (census 2.4 — multiparts measure exec=0 in a single-loop
probe); the Combat→multipart edge is DECLARED + coverage-reported. Detail: plan
§11 + memory [[project_omsi_loops_fork]] session 15.

## Round 17 — assist-ladder rung 3 SHIPPED as a Buy Mana / zone-1 economy optimiser (2026-07-13, Opus, session 16)

Rung 3 of the §11.6 assist ladder shipped, but **the user redefined it mid-L0**
from a general rearranger into a **Buy Mana / zone-1 economy optimiser**:
`IdlePlanner.optimizeEconomy(sess, snap, queue) → {queue, report}`. It optimises
the town-0 mana↔gold economy — REORDER gold into batches before each conversion,
REMOVE redundant/thin Buy Manas, SPLIT a gold harvest to INSERT an intermediate
conversion when the budget would starve, MERGE unnecessarily-split entries, and
RESERVE gold for downstream purchases. **Removing unnecessary Buy Mana actions
is the expected result** (so it is not rearrange-only). Best-improvement local
search, engine rollout as oracle.

**Objective (reserved decision 1 — resolved EMPIRICALLY):** lexicographic in
mana units — (1) unmet reps of every NON-converter action (throughput), then
(2) `unconvertedGold·rate + converter mana spent`. Two L0 findings: (a) "failed
execs" must count ALL unmet reps or a misplaced mana-sink that starves later
entries reads as low-waste (collapse-reward); (b) the brief's recommended
`failed→idle→gold` ranks tail idle mana above unconverted gold, making the
balancer prefer NOT converting — so it fails to recover converter-before-income.
Folding idle+gold into one mana term (converter's actual `manaUsed` overhead +
`gold·rate`) recovers every case. A conversion is worth keeping only above
`overhead/rate` ≈ 2 gold.

**Harness changes:** `buy-mana-opt.mjs` (L0 prototype: 6 capability fixtures +
feasibility guard, all PASS) and a `--balance` flag on `run-planner.mjs`
(optimise a `--from-state` committed queue or `--queue` override; prints the
proposed order + waste deltas). Both are dev readouts; the optimiser never runs
in the reference path.

**Gates:** byte-gate 535 / 5,965,890 / e23f020400162f9a / 0 RNG re-verified on the
working tree (pool-8, worktree); fork npm 85/85; ui-smoke 41 checks ALL PASS
(worker optimize → 3→1 Buy Mana proposal → apply → persistence). Both options
(`economyOptimizer` / `economyOptimizerAuto`) default OFF.

**Commits (NOT pushed; pointer stays on substrate pin 531faa3):** submodule
`automation` L1 `ef32a7b` + L2 `169cfaf`; outer L0 `48813d73d` + `--balance`
`68c205175`. **Rung 2 (auto-add reps) DEFERRED** — ships as its own follow-on.
Detail: plan `omsi-loops-ladder-rungs-plan.md` §4b + memory
[[project_omsi_loops_fork]] session 16.

## Round 18 — §11.7 Design B shipped; replanEvery sweep (wall vs loops); reserved-thread experiment REFUTED for headless (2026-07-14, Opus, session 19)

**§11.7 Design B (live no-pause pipelining) + replanEvery reuse SHIPPED** (memory
session 19; submodule `automation` `c65d6ea`+`a99685f`, outer `867857384` =
`--replan-every`). Byte-gate 535 / 5,965,890 / e23f020400162f9a re-verified;
npm 95/95; ui-smoke ALL PASS + a live soft-lock guard.

### replanEvery wall-clock vs loop-count (seed 12345, pool-8, predictor screen)

| replanEvery | loops | ticks | wall | vs K=1 |
|---|---|---|---|---|
| 1 (reference) | 535 | 5,965,890 | 650s | — |
| 2 | 609 (+14%) | 7,457,767 | 382s | −41% wall |
| 3 | 580 (+8%) | 6,500,047 | 242s | −63% wall |
| 4 | **FIXATES** | — | — | (see below) |
| 8 | 769 (+44%) | 9,879,417 | 114s | −82% wall |
| 12 | 829 (+55%) | 10,682,871 | 76s | −88% wall |

**Wall scales ~1/K** (down to −88% at K=12) because a planRound is ~99% of
per-loop cost and reuse skips K−1 of them. The loop cost is **NON-MONOTONE and
not smooth** — K=3 beats K=2, and **K=4 falls into the 34,750-mana economy
FIXATION hole** (the same one bank:20 hits, Round 13): stuck on `repeat` loops
past L1700 with no frontier push, effectively DNF, while its neighbours K=3 and
K=8 both converge. So replanEvery is a **robustness problem, not a smooth knob**
— exactly the bank:20 lesson (weight/cadence sweeps have wildly-different
neighbours). The default anti-fixation guard (OFF) likely rescues K=4; untested.
**Ruling stands: K=1 is the byte-exact reference; K∈{2,3} is the safe wall win;
higher K is opt-in and must be validated per-K (some fixate).**

### Reserved-thread headless experiment (user idea #2) — REFUTED for headless

Harness: `reserved-thread-exp.mjs` (executor advances committed loops on the main
thread) + `planner-thread-worker.mjs` (a dedicated planner worker_thread planning
from snapshots the executor hands it, swapping in fresh plans as they land — the
purest form of "run while planning, swap at a loop boundary").

**Natural (dispatch-when-idle, screenK 8): DNF at 3000 loops**, effective reuse
**K=143**, all 21 adoptions stale. Root cause measured: the executor runs
**14 ms/loop** but a planRound is **2269 ms** — a **~160:1** ratio — so plans are
hopelessly stale and never converge. Because headless committed loops are already
~free/fast, there is NOTHING to overlap: the executor outruns the planner 160:1,
so "run while planning" just runs *very stale* plans. Bounding staleness to make
it converge forces the executor to WAIT for the planner (planning-bound), which
is just serial replanEvery with no overlap gain (loop time is negligible).

**Anti-fixation guard ON (--anti-fixation): STILL DNF** at 5000 loops, K=208. It
does not help because the fixation is EXECUTOR-side, not planner-side: the planner
plans from snapshots ~208 loops apart, so consecutive plans DIFFER (P.streak never
accumulates → the streak/drought guard never fires). The real failure is that the
frontier PUSH (Buy Supplies → Start Journey) is a precise, timing-sensitive
multi-loop setup; adopting a push-plan ~150–208 loops stale drops it into a state
where it no longer executes. Extreme staleness is fine for the ECONOMY phase
(stale economy loops still bank resources) but BREAKS the town-crossing.

**Reconciliation — the user's idea IS valid; it is `replanEvery`.** "Save wall at
the cost of inefficient loops" is exactly what replanEvery=12 delivers: 829 loops
/ 76s (−88% wall, +55% loops), CONVERGING to town 1. The reserved thread is the
same idea with concurrency, but (a) in headless the committed loop is already
~free so overlap buys nothing over serial replanEvery at a matched K, and (b) it
auto-selects K≈150–208 (the hardware ratio), which is stale enough to break the
push. Bounding staleness to a converging K just makes the executor WAIT for the
planner (= serial replanEvery, no overlap gain). **So: use replanEvery and pick
the K you want — higher K = more wall savings + more (inefficient) loops, until
the push breaks (K=4 fixates; K≤3 and K∈{8,12} converge on this seed).** The
concurrency/overlap only pays off in LIVE play (loops cost real seconds), which is
what Design B does.

**Commits (NOT pushed; §11.7 Design B):** submodule `automation` `c65d6ea` +
`a99685f` (pushed to the fork for CI); outer `867857384` (`--replan-every`) +
this SUMMARY + the two reserved-thread harness scripts. Outer main push HELD:
6 interleaved commits from a concurrent jta session bump an unpushed j-t-a
submodule pin. Detail: memory [[project_omsi_loops_fork]] session 19.

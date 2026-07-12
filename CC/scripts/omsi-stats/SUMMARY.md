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

Town-1 end states saved for continuation runs (state-arm{A,B,C}-town1
.json): the long-term half of the hypothesis — whether extra talent pays
off past town 1 — is still open, testable cheaply via --from-state.
User's live refinement during the round: with glasses x4, the optimal
wander-only cutoff is likely well below 50%, and the real human opening
is "glasses first, then wander" (arm D candidate).

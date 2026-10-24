# Seedling HAMMER-PHASE — slice SC: is the strike scan's ETA floor admissible?

Slice `seedling-hammer-sc` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-14):
*"DWELL-DONE + strike census"*. This slice is the census. **MEASURE ONLY:** no switch, no tracked `.js` change. The lab
was a scratch copy; its diff is evidence.

| | |
|---|---|
| Start SHA | **`c137aef8a9`** (= `origin/main` at the fetch = RE's harvest merged) |
| Head | the commit carrying this report. Before it: W0 + D1 `f127d14`, D2 + D3 `35af859`, records `2df38b6` |
| Branch | `claude/seedling-hammer-sc-a13pot` (the harness names it; the brief's `seedling-hammer-sc`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9585` (`SEEDLING_PORT=9585`), PID 785, killed by PID at the end |
| Verdict | **(b)**: the floor is inadmissible, and chosen strikes change on every workload that derives a strike. End to end, staging A, L18, C2's ghost staging, killgate and three committed tapes move |

## The one thing to know first

**`minTicksBetween` is wrong in both directions it claims, and an admissible floor is not a free fix.**
- **The floor is too high.** It divides by `WALK_SPEED` (0.8). That number is `applyInput`'s ADD, not a clamp: the axis
  runs at up to 1.6 px/tick (2·moveSpeed). It also ignores the 1 px arrival tolerance, which makes the walk SHORTER.
- **How much too high.** On every workload that derives a strike, most previews arrive before it, by up to 100 ticks
  (leg 414) and 72 ticks (staging A). The admissible floor `ceil((cheb − 1) / max(1.6, |v0|))` is never beaten, and it
  is tight: the least `ETA − floor` is 0.
- **Swapping it in changes the solver's play.** Staging A's spinner dies 1,784 ticks (sword) and 860 ticks (ghost)
  sooner. Three committed tapes drift. But C2's ghost staging gets 28 % longer and 20 of L18's 45 residues get longer.
  The looser floor also lets the forty candidates fill with pairs the walk cannot make: R8 slice 8's trap again, one
  level up.

So the fix the planner takes to the user is an admissible floor **plus** a measured-ETA skip in the bounded pass, behind
a switch, OFF. Its flip is a tape move.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main`; `git checkout -B claude/seedling-hammer-sc-a13pot origin/main` | `c137aef8a9` |
| `REFUGE_ETA_CUT` | `pressKillCost.js:374` | **`REFUGE_ETA_CUT_DEFAULT = false`**: the user's ON ruling is not on `main` at this SHA |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine); `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9585 bash scripts/procgen/identity-block.sh .` (venv) | non-`#` md5, the `rc=` line dropped: **`77080c2e`** = RE's, every row. Reference ALL 7 + 5 MATCH (`evidence/identity-w0.txt`) |
| six `--check`s | the block's loop | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| surface / constants / entities / profile | each `--check` | GREEN **291** · PASS **5,851** · PASS **558** · PASS **138** (`evidence/censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |

## D1 — the true speed

**The model.**
- `playerPhysicsV1.applyInput` is a threshold test followed by a full-magnitude add:
  `if (held.right && v.x < moveSpeed) v.x += moveSpeed`.
- `Mobile.mobileUpdate` runs friction, then input, then the move. Friction (`applyFriction`) shortens the velocity
  VECTOR by 0.25.
- So an axis that enters input just under 0.8 leaves it just under **1.6**. By induction (above 0.8 nothing adds, and
  friction only shortens), a walking axis stays under `2·moveSpeed`:
  - **1.6** on ground;
  - **2.0** on ice (`slidingSpeed` 1, friction 0.025).
- A diagonal loses less of each axis to friction (the friction is split over both axes), so the free axis helps the
  other.
- `playerPhysicsV1.js`'s own docblock already says "peak velocity is nearly 2x `moveSpeed`".

An exact DP over key sequences from rest (`evidence/d1/speed-model.mjs`, the module's own `applyInput` and
`applyFriction`, 9 key sets per tick, no walls):

| ticks | hold → | hold ↘ | best, any keys | per tick | `ceil(best / 0.8)` (the base floor for that distance) |
|---|---|---|---|---|---|
| 1 | 0.80 | 0.80 | 0.80 | 0.800 | 1 |
| 5 | 5.50 | 5.43 | 6.06 | 1.212 | 8 |
| 10 | 11.15 | 11.25 | 12.61 | 1.261 | 16 |
| 20 | 22.90 | 23.21 | 25.45 | 1.272 | 32 |
| 40 | 46.60 | 46.91 | 51.33 | 1.283 | 65 |
| 60 | 70.30 | 71.11 | 77.18 | 1.286 | 97 |

Peak per-tick axis velocity: 1.5999 (any keys), 1.55 (axis keys only). On ice (`speed-model-ice.txt`): 1.989 peak,
51.3 px in 30 ticks.

**The game** (p4f, headless logic-only; `probe-seedling-dash-window.mjs --tape-file=evidence/d1/sc-speed.tape.json`).
The scratch tape on level 0: RIGHT for 20 ticks, RIGHT+UP for 20, then RIGHT with UP/DOWN zig-zag in 2-tick blocks
for 24.
- **ALL CHECKS PASSED**: the drained stream is the model's, tick for tick, over 81 observations.
- Per tick (`evidence/d1/sc-speed-game.txt`):
  - max |dx| **1.584**, max |dy| **1.595**;
  - axis 1.145 px/tick, diagonal 1.197, zig-zag 1.169, sustained.

**What bounds a walk's ticks admissibly.** `hasArrived` accepts within the tolerance on both axes, at rest. So a walk
must cover at least `cheb − tolerance` on its longer axis, at under `V` per tick:

    floor = ceil( max(0, max(|dx|, |dy|) − tolerance) / V ),   V = max(2·moveSpeed_max, |v0.x|, |v0.y|)

- `2·moveSpeed_max` is 1.6 on ground and 2.0 where ice is walked.
- `v0` honours a knocked-back start: above the cap nothing adds, and friction only lowers the speed.
- **Measured over every strike preview below:**
  - the least `ETA − floor` is **0**, so the bound is exact somewhere;
  - **no preview beats it**;
  - `floor − ETA` for the base floor reaches **100**.
- Every per-tick preview step over 1.6 (max 2.50) started from `|v0| > 1.6` (A sword 8 of 9, A ghost 4 of 5, L18 3 of 3
  derivations).
- No walk stepped faster than 1.6 from a calm start. So no workload's strike walk ran at ice speed (inferred from the
  steps; the terrain was not read).

## D2 — the census (a scratch lab only)

**The lab** (`evidence/make-lab.py` applied to a scratch copy of the tree; `evidence/sc-lab.diff`).
- `deriveStrike` becomes `deriveStrikeCore(…, floorOf, carriedStore, lab)`.
- Under `SC_LAB=census`, every derivation runs it twice, in alternating order:
  - with the base floor;
  - with the admissible floor (ground cap 1.6).
- The shadow pass gets its own carried line book and has every module count object restored after it, so the run
  follows the base.
- **Proof it is inert:** every census answer equals RE's base md5 and the identity block's row:
  - A `7c279226` / `b3b38f55`, 397 `4720caab`, 414 `489a9482`;
  - legs 378–400 `1c2e9305 d38ea9c0 26b9204f 54ec94b7 0a85d42f`;
  - L18 `864ab175`, ghost staging `1ca7eed5`, campaign `4199d181`;
  - the five producers' `--check` md5s and killgate `006b0639 / 7d4cb820 / 49e23d85`.
- **What each derivation records** (`evidence/d2-census-records.tar.gz`; `sc-census.py`, `sc-diffcats.py`):
  - both results;
  - both kept-candidate lists;
  - scan pairs, previews and wall ms for each floor;
  - every previewed walk's ETA against both floors;
  - the dropped pairs, counted in a third, untimed pass over the base's own bounded tick range. A dropped pair is one
    the base floor skipped, the admissible floor admits, and `opportunityAt` accepts. It is **reachable** when the full
    preview arrives by `i − 1`, and **a plan** when it is also transit- and dwell-safe. Bombs and the escape are not
    asked.

| workload | derivations | arrived previews (base) | ETA under the base floor | worst floor − ETA | ETA under the admissible floor | chosen strike differs: total (admissible earlier · base found, admissible refused · other) | dropped pairs: reachable / plan | scan ms, base → admissible |
|---|---|---|---|---|---|---|---|---|
| staging A, sword | 1,329 | 6,611 | 4,083 | 72 | **0** | 7 (2 · 5 · 0) | 24,748 / 92 | 76.5 → 73.1 s |
| staging A, ghost (G1 ON) | 1,085 | 5,801 | 2,962 | 66 | **0** | 3 (0 · 3 · 0) | 25,240 / 29 | 56.8 → 55.8 s |
| leg 397, ghost | 1,154 | 8,578 | 3,514 | 62 | **0** | 2 (0 · 2 · 0) | 23,204 / 12 | 53.7 → 50.9 s |
| leg 414, ghost | 1,256 | 9,106 | 3,420 | **100** | **0** | 4 (0 · 4 · 0) | 22,140 / 30 | 58.5 → 56.5 s |
| L18 sweep, 45 residues | 10,086 | 70,899 | 65,862 | 39 | **0** | 1,707 (1,395 · 261 · 51) | 285,813 / 37,719 | 84.2 → 61.9 s |
| C2's L18 ghost staging, 45 | 4,596 | 25,998 | 17,193 | 44 | **0** | 561 (402 · 159 · 0) | 45,246 / 22,023 | 80.0 → 55.1 s |
| `r9-campaign --check` (incl. `r9-solve-16`) | 315 | 2,367 | 2,178 | 29 | **0** | 27 (21 · 6 · 0) | 7,659 / 537 | 2.6 → 2.4 s |
| `r8-l18 --check`; `r8-d2-chain --check` (identical counts) | 135 each | 828 | 774 | 29 | **0** | 27 (21 · 6 · 0) | 3,705 / 630 | 1.0 → 0.6 s |
| killgate s2 / s5 / s9 | 180 / 180 / 189 | 396 / 405 / 675 | 225 / 279 / 432 | 34 / 40 / 41 | **0** | 18 / 9 / 36 | 756 / 468 · 1,179 / 585 · 1,404 / 441 | 0.8 / 4.4 / 4.7 → 0.5 / 0.4 / 0.6 s |
| legs 378 / 381 / 384 / 396 / 400 (sword); `r8-battery`, `r9-l3`, `r8-tail` (its parent process) | **0** | — | — | — | — | — | — | — |
| **total** | **20,640** | **132,492** | **101,696** | **100** | **0** | | | |

Reading it:
- **The floor is not admissible, anywhere.**
  - 77 % of the base's arrived strike previews come in under it (L18: 93 %).
  - The worst gap is 100 ticks. On leg 414, `(728,680)` is 400 px away: the floor says 500, the walk takes 400.
  - Staging A's worst is `(744,856)`, 176 px away: floor 220, walk 148.
- **The 40 kept candidates change in most derivations** (1,321 of 1,329 on staging A, sword). That is expected, since
  earlier ticks become eligible. What matters is the choice:
  - **Earlier strikes.** In 1,907 derivations the admissible floor picks a strike that presses earlier: by a median of 5
    ticks on L18, 8 on the ghost staging, and up to 68.
  - **Strikes lost.** In 470 it REFUSES where the base found one. This is R8 slice 8's trap one level up: the looser
    floor admits early pairs at cells whose real walk is too slow, so the forty fill sooner and the bounded pass stops
    before the base's strike.
  - Staging A, sword, t1119: the base presses `(744,776)` at 1337 with ETA 117. The admissible floor keeps 40 pairs by
    +114 (`(744,840)` from +89 on), none reachable, and refuses.
- **The dropped opportunities are real.** On every workload the base floor skips pairs whose full preview arrives in
  time, and some of them are full plans (L18 37,719; the ghost staging 22,023; staging A 92 / 29).
- **Cost.** Inside the derivations, the admissible floor scans fewer pairs on L18 and previews more cells
  (40,230 → 46,182), yet is faster: L18 −27 %, ghost staging −31 %. Staging A, 397 and 414 gain 2–5 %. The two passes
  ran in the same process in alternating order, so the warm-cache bias cancels.

## D3 — the verdict: **(b)**

**The admissible floor end to end** (`SC_LAB=floorB`: the lab with only the floor swapped, no shadow). Paired with a
base run of the same workload, two at a time. Answers are compared with the wall clock stripped
(`evidence/d3-answers.txt`, `d3-outs/`, `d3-sweeps.txt`, `d3-check-failures.txt`, `d3-times.jsonl`).

| workload | base | admissible floor | verdict moves? |
|---|---|---|---|
| staging A, sword | REFUSED t3113 on `bob@736,752`. `spinner@880,848` hit at 511, 1770, 1985, 2960, 3062, killed 3100. 6 player hits. keys `af47d35d`. 195.2 s | REFUSED **t1329** on **`bobsoldier@880,832`**. Spinner hit at 511, 1283, killed **1316**. **2** player hits. keys `7f28da0b`. **112.5 s** | still REFUSED; the run, the obstacle and the kill move |
| staging A, ghost | REFUSED t2195 on `bob@736,752`. Spinners killed 2114 (`@880,848`) and 2182 (`@816,848`). 3 hits. 161.3 s | REFUSED **t1267** on `bob@736,752`. `@880,848` killed **1254**; `@816,848` never fought. 2 hits. **109.2 s** | still REFUSED; the run moves |
| leg 397, ghost | refused on `bob@736,752`, err `de067efc`. 177.4 s | refused on `bob@736,752`, err `eba8e51c`. **463.3 s** | still refused; the message moves |
| leg 414, ghost | refused on **`bob@736,800`**, err `585ba9b3`. 186.2 s | refused on **`bob@736,752`**, err `01280d0e`. **580.2 s** | still refused; the obstacle moves |
| L18 sweep, 45 | 45 SOLVE, Σ 19,545 t. 115.4 s | 45 SOLVE; **every** residue's length moves, 25 shorter and 20 longer (r0 462 → 374, r35 363 → 604), Σ 19,802 t. 102.1 s | no SOLVE is lost; every tape moves |
| C2's L18 ghost staging, 45 | 45 SOLVE at 336 t (r5 390, r6 340). 88.6 s | 45 SOLVE at **431 t each**. 168.2 s | no SOLVE is lost; all longer (+28 %) |
| `r9-campaign --check` | exit 0, `4199d181` | **exit 1**: `r9-solve-18` 518 → 434 t; the free oracle for `r9-solve-19` misses (10478 vs 10394); Σ 10,931 → 10,847 | committed artifact drift |
| `r8-l18 --check` | exit 0 | **exit 1**: `r8-solve-18` and its trace drift | committed artifact drift |
| `r8-d2-chain --check` | exit 0 | **exit 1**: `r8-d2` drifts; the headline 1,740 → 1,669 t, with `{18,0}` declared at 397 vs `r8-solve-18`'s 305 | committed artifact drift |
| killgate s2 / s5 / s9 | the identity rows | the printed table is unchanged; `md5(rows)` moves (s2 `660869bc` → `56b3900e`) | the identity rows move |
| `r8-battery`, `r8-tail`, `r9-l3` | — | byte-equal | no |
| legs 378 / 381 / 384 / 396 / 400 | — | not run (0 derivations in the census) | no |

**(b), and with a warning: the admissible floor alone is not an improvement.**
1. **What it fixes.** It is admissible by construction, measured with 0 violations in 210,404 arrived previews (both passes). It finds
   strikes the base hides: staging A kills its spinner 1,784 / 860 ticks sooner, and three committed L18 tapes get
   shorter.
2. **What it loses.** It spends the bounded pass's forty on pairs that are admissible but too slow, and refuses where
   the base found a strike (470 derivations). End to end it lengthens C2's ghost staging by 28 % and 20 of L18's 45
   residues. Earlier is not always better: a greedy earliest strike can set up a worse fight.

### The fix's shape (for the planner and the user)

- **A switch, OFF.** For example `STRIKE_ETA_FLOOR` in `pressKillCost.js`, beside `STRIKE_SCAN_COST` (both read the same
  floor; `strikeScanBox`'s `unreachableAt` counts with it).
- **ON:**
  1. **The floor.** `floor = ceil(max(0, cheb − DEFAULT_TOLERANCE) / max(2·WALK_SPEED, |v0.x|, |v0.y|))`. A room whose
     walk can reach ice needs `2·SLIDING_SPEED`; none of these workloads did.
  2. **The measured ETA.** Once a cell has been previewed, the bounded pass replaces its floor with the measured ETA.
     The continuation already does this (`known.eta > i − 1 → continue`), and the bounded pass previews the forty only
     after it has collected them. So the collection has to be interleaved with the walk cache, or the budget counted in
     distinct cells previewed, as the continuation counts it. Without this step the switch reproduces the 470 lost
     strikes measured above.
- **The flip is a tape move**, not a cost change. `r8-solve-18`, `r8-d2` and `r9-solve-18` must be re-recorded, every
  L18 residue moves, and the identity block's killgate rows and three producers' `--check`s move. Staging A changes
  answer. The decision is the user's, on the D3 table.
- **The docblock fix is due either way.** It is a comment edit in `solverBot.js` (`STRIKE_CANDIDATES`' paragraph and
  `minTicksBetween`), and it belongs to whoever owns `deriveStrike` next. It is not made here (measure-only). Two claims
  are false today:
  - *"`applyInput` clamps EACH AXIS at `WALK_SPEED`"*: it adds `WALK_SPEED` under a threshold, so the cap is
    2·`WALK_SPEED`;
  - *"the tolerance … can only make the real walk LONGER"*: `hasArrived`'s tolerance makes it shorter.

## Records

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase SC — the strike scan's ETA floor`, with the census and end-to-end tables |
| reference | `generate-procgen-reference.mjs` (README word count, docs index), then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: wrote 173 docs (no diff) |
| surface / constants / entities / profile | `--check` only, no `--write`: GREEN **291** · PASS **5,851** · **558** · **138** (`evidence/censuses-after.txt`) |
| bounded vitest | `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`: **4 files, 150 / 150** (`evidence/vitest-after.txt`) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no force-push, nothing to `main` |
| files | docs only: the log, `README.md` (word count), `procgenDocs/generated/docsIndex.js`. **No tracked `.js` source change.** Nothing in `solveSegmentUnder` (DD's region), the fidelity files, the JS arc, AS3, wasm, gitlinks or rules |

**CI for the planner** (dispatch returns 403 from the cloud): `JavaScript Unit Tests` on
`claude/seedling-hammer-sc-a13pot` at the head (`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`). Only docs
and a generated index changed, so expect today's suite. No sweep is needed: nothing executable moved.

## What the brief got wrong (measured)

1. **"Whether `REFUGE_ETA_CUT` is ON by default there."** It is not: `REFUGE_ETA_CUT_DEFAULT = false` at `c137aef8a9`.
   The user's ON ruling has not landed on `main`.
2. **"By up to 15+ ticks"** (RE's refuge number). On the strike side it is up to **100** ticks (414) and 72 on staging A,
   and 77 % of all arrived strike previews beat the floor. RE's arrivals are not a refuge-only effect: verdict (c) is
   refuted.
3. **"The player's top speed is a little over two"** (the `STEP_LOOKAHEAD` docblock). Per axis it is under **1.6** on
   ground (game peak 1.584 / 1.595) and under 2.0 on ice. "A little over two" fits only the diagonal VECTOR
   (1.6·√2 ≈ 2.26). The floor is a per-axis question.
4. **"If the floor is too high, the 40 it keeps may be later or worse than the ones it dropped."** True (1,907
   derivations press earlier), but the converse also holds and matters for the fix. The admissible floor's 40 can be
   worse: 470 derivations refuse where the base found a strike. End to end it lengthens C2's staging by 28 % and 20 L18
   residues.
5. **The workloads.**
   - Legs 378 / 381 / 384 / 396 / 400 (sword) never reach `deriveStrike` (0 derivations).
   - Of the identity block's producers, `r8-battery`, `r9-l3` and `r8-tail`'s parent process derive none.
   - The ones that do: `r8-l18` and `r8-d2-chain` (135 each), `r9-campaign` (315), and killgate s2 / s5 / s9.
6. **The branch.** The harness names it `claude/seedling-hammer-sc-a13pot`, not `seedling-hammer-sc`.
7. **The bootstrap's `READY` again left five submodules uninitialised.**

## Residue

1. **For the user: the switch's design, then its flip.**
   - The census says the floor is wrong.
   - D3 says a floor swap alone trades lost strikes and longer ghost fights for earlier kills.
   - The measured-ETA half of the fix is unmeasured. A slice that builds the switch should re-run this census with it:
     the evidence's `sc-run.sh` / `make-lab.py` take a third floor function in one edit.
2. **`r8-tail` spawns child processes.** The `--import` sink saw only the parent, which derived nothing; the children
   were not censused. Its `--check` was byte-equal under the admissible floor, so whatever runs there is unaffected or
   derives no strike.
3. **The dropped-pair count** covers the base's own bounded tick range only, not the continuation's range to the
   horizon. Its "plan" column does not ask the bombs (OFF everywhere here) or the escape.
4. **Ice** was inferred from the preview steps (none over 1.6 from a calm start), not read from the terrain. A fix that
   uses 1.6 must test the walk's terrain, or use 2.0 when the room has ice.
5. **Mid-walk impulses.** The floor honours `v0`. A knockback DURING the walk could in principle beat it. None did in
   210,404 arrived previews.
6. **Timing caveats.**
   - The census ms are in-process paired.
   - The end-to-end walls ran two at a time beside their pair (`d3-times.jsonl`), so they are indicative only.
   - Legs 397 / 414 ran 2.6–3× longer under the admissible floor.
7. **Tree hygiene.** The lab copy (`<scratchpad>/lab`) and the scratch outputs were removed by name. Nothing else was
   created outside the evidence directory.

## Evidence (`seedling-hammer-sc-evidence/`)

- **Scripts:**
  - `make-lab.py` (the lab's `deriveStrike` instrument) and `sc-lab.diff` (the lab's `solverBot.js` against the base);
  - `sc-run.sh` (one workload in one mode), `queue.sh`, `sink.mjs`;
  - `sc-census.py`, `sc-diffcats.py`, `sweep-cmp.py`;
  - RE's `g1-solve.mjs`, `d1-leg.mjs`, `ghost-sweep.mjs` and `norm.py` were used unchanged from
    `seedling-hammer-re-evidence/`.
  - The leg inputs: `seedling-divergence-legs.mjs --out=legs.jsonl` (843 legs; the ids are G1's), and
    `probe-seedling-divergence-sweep.mjs --mode=inv --ids=400 --dump=dump.json`.
- **D1:** `d1/speed-model.mjs`, `speed-model-{ground,ice}.txt`, `sc-speed.tape.json`, `sc-speed-game.json` (the drain),
  `game-speed.mjs`, `sc-speed-game.txt`.
- **W0:** `identity-w0.txt`, `censuses-w0.txt`.
- **D2:** `d2-census-records.tar.gz`, `d2-census-summary.txt`, `d2-diffcats.txt`, `d2-census-answers.txt`,
  `d2-census-times.jsonl`.
- **D3:** `d3-answers.txt`, `d3-outs/{base,floorB}-*.out`, `d3-sweeps.txt`, `d3-check-failures.txt`, `d3-times.jsonl`.
- **Records:** `censuses-after.txt`, `vitest-after.txt`.

# Seedling HAMMER-PHASE PDS — every unguarded preview death is a skipped candidate, and the strike-floor flip made landable

Slice `seedling-hammer-preview-death-sweep` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User,
2026-10-24: *"Yes, I approve launching all of these"*. The evidence is in
[`seedling-hammer-preview-death-sweep-evidence/`](seedling-hammer-preview-death-sweep-evidence/).

⛔ **Read this first: SFF + SFF2 + PDS is green in CI, slow battery included** (JSUT run **40123003978** at `2fc79e5440`:
suite 22,604 passed / 0 failed; slow battery **268 / 268**). Both of SFF2's red slow rows pass. One thing to know: on
this cloud box, `seedlingGenCapacity.slow` › post-sword 1–60 takes **919 s** solo with the floor ON, past its 900 s
budget (every seed seats). It takes the same time per seed at SFF2's own head, and CI's box finishes it inside the
budget. So it is a box property, not a defect, but it is the row with the least headroom (§ 4.3).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`f5fb6f7bca`** (SFF2's head, `origin/claude/seedling-strike-floor-fix-fyytfl`) |
| merged SHA | **`e09a90077a`** (`origin/main` `f9342f25b8`, fidelity wave 28, merged in) |
| head | the commit that adds this report (see `git log`). The last code commit is `20e846f2a0` (D3); `2fc79e5440` adds the bot log |
| branch | `claude/seedling-hammer-preview-death-sweep-m6thwv`, the session's designated branch (not the brief's `seedling-hammer-preview-death-sweep`). Nothing went to `main` |
| commits | W0 merge `e09a90077a` · D1 census `efc3b82d43` · W0 witness pin `15ee7742eb` · D2 `ba5b76f38b` · D3 `20e846f2a0` · D4 bot log `2fc79e5440` · this report |
| box | 4 cores, node v22.22.0; dev servers `serve-nocache.py` 9587 (primary) and 9588 (a scratch bench worktree), killed by PID at the end |

## 2. W0 — what the merge moved in SFF/SFF2's work

**The merge.**
- Conflicts:
  - `plan-seedling-hammer-bw-bombstand.mjs`: resolved by keeping BOTH fidelity wave-28's `blastBody` re-pin and SFF's
    `withStrikeEtaFloor(false, …)` pin;
  - the generated procgen `README.md` and `docsIndex.js`: ours, then regenerated;
  - `seedling-bot-log.md`: a union;
  - `seedling-solver-surface.json`: main's copy, rebuilt with `--write`.
- Gitlinks: no gitlink differs from main (`git diff --raw origin/main HEAD | grep 160000` is empty). Main itself moved
  `frontend/modules/shared` from `218cbbf` to `4445b62`. The bootstrap's mirror lacked that commit, so I fetched it into
  the mirror. Six submodules were again left uninitialised, and I initialised them from their mirrors.

**The re-check at the merged tree** (`w0/`, `w0b/`):

| check | ON | `=0` |
|---|---|---|
| identity block | = SFF2's head row for row (`w0b/identity-on.txt`), except the acceptance batch (below). `r8-d2-chain` `a591fa9d`, `r8-l18` `6460d60d`, `r9-campaign` `27478177`, exit 0 | the same md5s as SFF2's `=0` except the acceptance batch; the three ON-recorded producers exit 1 (expected, as at SFF2) |
| `ci-producer-checks --jobs=4` | 93 run, 0 red | 93 run, 0 red |
| bounded vitest (88 files: SFF2's 80 + its new file + main's 7 new seedlingDemo files) | **3,057 / 3,058**: 1 red, `fidelityWandHold` › leg 371 ON (below) | 26 red in 14 files = **SFF2's 26 by name** (one row only renamed by SFF2's D2) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED | — |
| `check-seedling-bot-differential --only=<SFF's 16 moved tapes>` | ALL CHECKS PASSED | — |
| `check-seedling-wasm-ship` (headless, own server) | **415 PASS / 0 FAIL** (= SFF2's count) | — |

**What main moved:**
1. **The acceptance batch, both ways.** At `=0` it is `933c14f7` → **`481b7a1c`**, and ON it is `9fbd9304` →
   **`cf54cdf7`**. I measured main itself in a scratch worktree: `f9342f25b8` at its default (floor OFF) gives
   `481b7a1c`, and with `SEEDLING_STRIKE_ETA_FLOOR=1` it gives `cf54cdf7` (`w0/acceptance-main.txt`). So the move is
   main's (wave 27/28), and SFF/SFF2 still change nothing OFF.
2. **Main's new `fidelityWandHold.test.js` › leg 371 ON row** pins the solve to its game witness
   `wandhold-l42-371-paced` (p4g, recorded on main's floor-OFF default). With SFF's floor ON the solve is 1663 ticks,
   not 1667. That is **kind (w)**, so it is pinned `withStrikeEtaFloor(false, …)` as SFF's witness rows are
   (`15ee7742eb`). The ON answer is 1663 t. Green ON and `=0`.

Nothing else of SFF/SFF2's moved. No tape needed re-recording.

## 3. D1 — the census

The table is [`d1/census.md`](seedling-hammer-preview-death-sweep-evidence/d1/census.md). It was produced by an AST walk
(`scripts/census.mjs`, raw rows in `d1/raw.tsv`), then every row was read by hand along its call graph.

**The premise it rests on (measured in the code).** A preview stepper throws `deathRefusal` on any previewed death.
**But `previewWalk` ends a walk at a death that starts inside it** (`lethalFloorOf`: a drown the walk latches is
`'drowned'`, a lethal pit is `'lethal-pit'`). So **`previewWalk` throws only when the live run's drown was ALREADY
latched when the preview started**. That is a property of the decision tick, and the first preview asked at that tick
is the one that throws. Raw `previewStepper` loops have no such check: they throw on any death, at any tick. The floor
gates none of these sites, so every one is reachable OFF and ON alike.

| `solverBot.js` | count | kind | D2 |
|---|---|---|---|
| `previewWalk` calls | 31 | 4 guarded (`walkTo`, `baitForecastOf`, `deriveKillByChaser`, `deriveGuardApproach`) | — |
| | | **1 executor gate**: `probeCorridor`, the corridor `walkTo` is about to walk | **left bare**: the death is the live run's; swallowed, an empty walk would read as a clean corridor |
| | | **26 candidate sites**: `deriveRefuge` ×2 (measured, SFF2), `planSwordDash` ×2, `corridorDashRescue`, the DODGE / WHIRLPOOL / AXE / AXETIMING / PHASE stall searches and their screens, three DETOUR `certify`s, AXE_PRICED_CROSSING (base, members, screen, prefix), `stepOffIfLatched`, `returnOntoDoor` | wrapped; 5 also get a death arm |
| raw `previewStepper` searches | 5 unguarded | `searchEncounterStrike`, `searchEncounterReposition` (via `forecastEncounterPlan`), `previewLean`, `previewFaceTap`, `planPacedWait` | wrapped |
| | the rest | guarded (A2's `previewOrDeath`, or their own catch), or guarded by construction (`previewPressApproach` steps only a key set `landsClearOfHammers` already stepped and found not dead) | — |
| `previewWalk`'s own steps | 3 | the throw's origin | ⛔ not edited (the brief's STOP line) |

**Other files:**
- `arrivalSolid.modelStuck` is guarded (a catch-all);
- `spaceTimeReach` takes its `step` from its callers, and every caller hands it `previewOrDeath`'s;
- `solveProgress` does not preview;
- **2 unguarded candidate searches are outside this slice's files**: `crusherBait.alignmentCandidates` and `lightsVerb`'s
  sortie step (`env.step`). They are handed over (§ 9).

Of the 26 `previewWalk` candidate sites:
- 2 are first-preview reachable: `deriveRefuge` (measured) and `stepOffIfLatched`. `planSwordDash`'s base and
  `returnOntoDoor` can also open a fresh tick;
- the rest are **shadowed**: they run only after `probeCorridor` previewed the same state at the same tick, so the throw
  would land there first.

All 26 are wrapped anyway. The cost is nothing unless a preview throws.

## 4. D2 — the fix

### 4.1 The fixes (`solverBot.js`, catches, death arms and docblocks only)

- **`previewWalkOrDeath(run, wps, tolerance, opts)`**: `previewWalk`, except that a `PhysicsV2Error` (A2's
  `instanceof` test) becomes `{ samples: [], truncated: { kind: 'death', at, why: 'the preview DIED: …' } }`. Anything
  else still throws.
  - It is used at the 26 candidate sites. 21 are drop-in: every reader already refuses a non-crossed truncation, or a
    too-short walk.
  - 5 get a death arm before they would read `samples` or ask `probeSamples` (which returns `null`, "clean", on an
    empty walk):
    - `axeStall`'s and `phaseStall`'s base → no stall (`null`);
    - AXETIMING's `timingBase` → `out(why)`;
    - AXE_PRICED_CROSSING's base → `why` (the block that reads the base is re-indented under an `else`);
    - `stepOffIfLatched` → the step-off is rejected by name.
  - `deriveRefuge` is SFF2's hand-over, **without its `globalThis.__REFUGE_DEATHS` probe**.
- **The raw-stepper searches go through `previewOrDeath`:**
  - `forecastEncounterPlan` returns `touchedAt: k` on a death, so the strike search skips the plan and the reposition
    reads the key set as safe only until then;
  - `previewLean` and `previewFaceTap` return `null` (their docblocks already read lethal floor as `null`);
  - `planPacedWait` rejects the pacing with *"dies at paced tick n (a previewed death)"*.
- **Exports for the rows only:** `previewWalkOrDeath`, `previewLean`, `previewFaceTap`, `searchEncounterStrike` and
  `searchEncounterReposition`.
- **Surface census:** site counts only (`--write`; `PhysicsV2Error` 11 → 12, plus the helper's `run.state` /
  `ticksCompleted` / `state.x/y` reads). Constants: 0 moved.

### 4.2 The unit rows (`hammerPreviewDeathSweep.test.js`, 11 rows)

The template is SFF2's pool staging: the run's preview stepper is wrapped so that a chosen previewed step throws the
real `deathRefusal`.

| row | without a death | with one |
|---|---|---|
| `previewWalkOrDeath` | = `previewWalk` sample for sample | a truncated walk with no samples, `kind: 'death'`, its `why` names the drown; a `TypeError` still throws |
| `deriveRefuge` (G1's witness at t1251) | (488,872) at eta 15 | a pool there → (488,856) at eta 16; every walk dying → `null`; a defect still throws |
| `planSwordDash` (staging A) | — | the base dies → the STALL refusal names the death |
| `planPacedWait` (staging A) | a plan | every pacing *"dies at paced tick 1"*, plan `null`; a defect throws |
| `previewLean` | (488, 853.9) | `null` (the pool under its first tick, and under a later one); a defect throws |
| `previewFaceTap` | (488, 902.3) | `null`; a defect throws |
| the encounter (L32, `r5-bobboss-fire` at t20) | up ×7, retreat up, lands at 12 | a pool 4 px up → another approach; every step dying → `none`, reposition `safeFor` 0; a defect throws |

**The mutants** (`d2/mutants.txt`): with each fix undone in turn, its own rows go red. The helper's mutant fails 4 rows
(the helper, refuge ×2, dash), and the paced, lean, tap and encounter mutants fail 1 row each. Each run ended with the
fixed file restored byte for byte.

### 4.3 The slow rows

| row | W0 (merged tree, ON) | after D2, ON | `=0` |
|---|---|---|---|
| `hammerEscapeGenerated.slow` › empty post-sword seed 30 | ABORTED (SFF2: the drown through `deriveRefuge`) | **green, 73.8 s** | certified (SFF2) |
| `seedlingGenCapacity.slow` › post-sword 1–60 | red (seed 30's room aborted) | **every seed seats and 31 is refused**, but locally **timed out**: 1,017 s on a loaded box, then **919 s solo**, against the 900 s budget | green |
| both, in CI (JSUT 40123003978) | — | **green** (slow battery 268 / 268) | — |

**Seed 30's answer, ON.** In the identity block's pairs it certifies a level: `stop=TARGET_REACHED`, ticks 183 → 178
(c3 in 4 attempts, c6 in 7). That is the 178 t SFF2's scratch patch measured; `=0` certifies at 158 t.

**The 919 s is not D2's, and not main's** (`d2/slow-cost-attribution.txt`):
- the post-sword body, timed per seed: ON 775 s against `=0` 579 s, and main at its default 567 s (three processes in
  parallel). The floor-ON seeds 7, 21, 40 and 57 are 2–3× slower;
- those four seeds in SFF2's exact configuration (the W0 tree with only the `deriveRefuge` catch) against this tree:
  94.7 / 131.8 / 86.6 / 111.8 s vs 96.6 / 131.9 / 83.8 / 113.6 s;
- seed 21 at **SFF2's own head** (`f5fb6f7bca`, shared at `218cbbf`, with the refuge catch): 128.5 s, against 129.7 s
  here.

So the cost is SFF's floor on this box, which runs about 1.9× slower than SFF2's (482 s there). I changed no budget: CI
is the arbiter, and CI is green.

### 4.4 OFF's identity proof (SFF2 § 3's shape)

| `=0` | before D2 (W0, `15ee7742eb`) | after D2 (`ba5b76f38b`) |
|---|---|---|
| identity block | `w0/identity-off.txt` | **every md5 identical** (`d2b/identity-off.txt`). The reference row reads "4 differ" in the bench worktree, a symlinked-submodule artifact; the primary tree's `--check` at the same content reads ALL MATCH |
| producer roster | 93 run, 0 red | **93 run, 0 red**, the same verdicts |
| bounded set | SFF2's 26 red rows | **the same 26 by name** (`d2b/vitest-off-fails.txt`); D2's 11 rows pass at `=0` too (3,042 passed = 3,031 + 11) |

### 4.5 ON — the movers, by kind

| item | before → after | kind |
|---|---|---|
| identity `empty pairs c3` | `c4a58671` → **`31dc4572`**: seed 30 `THREW GenerationAborted …` → `level=ab1f88c5… stop=TARGET_REACHED attempts=4 ticks=183->178` | **(m)**: the row records the default's answer, and the abort was the defect this slice fixes. No game witness reads it |
| identity `empty pairs c6` | `5d06a8b0` → **`40d0a4c4`**: the same seed, `attempts=7` | (m), the same |
| every other identity row, the three producers' `--check` | unchanged | — |
| producer roster ON | 93 run, 0 red → 93 run, 0 red | — |
| bounded set ON | 3,058 (with the W0 pin) → **3,069 / 3,069** (+ D2's 11) | — |

No (w), no (s). CI's identity rows carry no pairs rows, so the two moved md5s are local only.

## 5. D3 — the INTERIM pin, retired

**Before → after:**

| | before (pin: `strikeIframeLapse` OFF) | after (the contact defaults: lapse ON, `bombBlastBody` ON; the floor pinned OFF per SFF) |
|---|---|---|
| ON solve | stops at t1294 on `#10`'s blast on `bob@272,112` (with `bombBlastBody` OFF) | **returns at t1667, no refusal, 0 hits** |
| the tape | the prefix cut at t1293, first landing t1154 | **the whole 1667-tick walk**, first landing **t1157** (then t1190 ×2, t1273, t1290) |
| = another witness? | — | **fidelity WANDHOLD's game witness `wandhold-l42-371-paced`, key for key** (a `--check` row) |
| `#7` | explodes on the stand at t1156 (OFF) | explodes at **(272,204) at t1155**, ~31 px from the stand on (248,184) |
| OFF (`PRESS_KILL_BOMBS` OFF) | the stand takes `#7` (t1157's ledger row) | **the same 1667 keys as ON**: with the lapse the stand meets no bomb, so the forecast refuses nothing on this staging |
| game samples | 1,289 (p4f), to t1293 | **1,665 (p4g, headless, damage on), to t1666** |

**The game's agreement.** I used the header's own path:
- `probe-seedling-bombpusher.mjs --file=<the new tape> --out=<rows>` (headless): every Bomb, the lobber's anim, the
  player and the hits agree at every tick **1..1666**. At t1667 the game shows 0 Bomb rows where the model shows one,
  and the player 1 px off;
- t1667 is the game's **Totem Part pickup freeze**. WANDHOLD's witness of this same walk stops at 1666 for the same
  reason;
- the probe's own re-join with `--reuse --upto=1666`: **PASS** (`d3/probe-reuse-1666.txt`);
- `--samples` now compacts to `SAMPLED_UPTO = CUT − 1` (1666).

So the model and the game agree on the new walk, and the tape was written by the producer's own write mode.

**The header** records the pin as retired (the ruling and the date) and names each ⛓ control:
- **KEPT**: the pre-lapse control (lapse OFF, `PRESS_KILL_BOMBS` OFF: the stand takes `#7` at t1157). It is BW's reason,
  and the only walk in this staging where the forecast refuses a stand;
- **RETIRED**: "ON, `bombBlastBody` OFF stops on `#10`'s blast on a Bob". It was the reason for the old cut, the tape is
  no longer cut, and that stop is fidelity BOMBBLAST's own row;
- **RETIRED**: "the INTERIM pin's witness (lapse ON returns at t1667)". It is now the witness itself.

**`--check`: 7 / 7 green.** The rows: the pre-lapse control; ON returns at 1667 with no hit; no hit; the first landing on
`spinner@192,128`; = `wandhold-l42-371-paced`; OFF = ON; the tape is byte-identical.

**The gate row and the doc:**
- `hammerPressBombs.test.js` is re-pinned to the new walk: 1665 samples, `tick_count` 1667, the landing at t1157, and
  `#7` at (272,204) at t1155, outside the 15 px disc;
- `seedling-bot.md`'s BW paragraph is updated.

## 6. D4 — the gates

| gate | result |
|---|---|
| bounded vitest, ⚖ 52 (by path) | W0 set + the W0 pin + D2's file: **3,069 / 3,069** ON; `=0` = SFF2's 26 (§ 4.4); D3's touched files (`hammerPressBombs`, `fidelityWandHold`) green ON and `=0` |
| both `.slow` files | seed 30 green ON locally; post-sword seats every seed but runs 919 s locally (§ 4.3); **CI: 268 / 268** |
| `ci-producer-checks --jobs=4` | **93 run, 0 red**, ON and `=0` (at D2; D3's producer is not in the roster, and its `--check` is 7 / 7) |
| identity block | § 4.4 / § 4.5 |
| `census-seedling-solver-surface --check` | GREEN, 347 rows |
| `census-seedling-constants --check` | PASS (0 new, 0 vanished, 0 moved) |
| `generate-procgen-reference --check` → `check-procgen-reference` | ALL MATCH → ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED (at W0 and at the head) |
| `check-seedling-wasm-ship` (headless) | **415 PASS / 0 FAIL** at W0 and again at the head `2fc79e5440` (`d4/ship-head-summary.txt`) |
| `seedling-bot-log.md` | `### Seedling hammer-phase PDS — a previewed death is a skipped candidate, everywhere` |
| **JSUT** at `2fc79e5440`, run **40123003978** | **suite 22,604 passed / 0 failed; slow battery 268 / 268**. Every gate and producer row exits 0. The MOVED rows against the standing-values bank are SFF's floor-ON identities and main's acceptance move. No `--write` was run |

## 7. What the planner's harvest A/B should expect (SFF § 6 and SFF2 § 6, updated)

- **Steps that can move:** as SFF's § 6. Legs that ask a spinner press kill (L18, L39, L40, L92, and generated levels
  with spinner or corridor bodies).
- **The generated-level survey no longer aborts on a preview death.** Post-sword seed 30 now certifies ON (178 t vs
  OFF's 158 t, a different level). A seed that aborted ON before PDS through any candidate preview now reads as a
  verdict.
  - What still can abort: a death in `probeCorridor` (the executor's gate, deliberately bare), or one in the two
    out-of-file searches (§ 9). If an A/B shows a `PhysicsV2Error` abort, look there first.
- **D2 moves nothing that finished before.** Every change engages only on a throw: `=0` is byte-identical, and the only
  ON movers are seed 30's two pair rows.
- **D3:** the bw-bombstand witness is now WANDHOLD's walk. Anything replaying `hammer-bw-l42-381-bombstand` replays
  1667 ticks.
- **Wall clock:** the floor ON makes some generated post-sword seeds 2–3× slower (seeds 7, 21, 40, 57 of the capacity
  census). A survey A/B should expect a longer ON wall clock on post-sword generation.
- **Should not move:** as SFF's § 6, and anything OFF.
- **`standing-values`:** SFF2's three md5s stand (`a591fa9d`, `6460d60d`, `27478177`). The acceptance batch is now
  `481b7a1c` at `=0` and `cf54cdf7` ON (main's move). Re-banking is the planner's call.

## 8. What the brief got wrong (measured)

1. **The branch:** the designated branch is `claude/seedling-hammer-preview-death-sweep-m6thwv`.
2. **"Gitlinks: none may move":** main itself moved `shared`, and the merge took main's pointer. No gitlink differs from
   main.
3. **"other bare `previewWalk` callers in the executor may be next" — the unit is wrong.** `previewWalk` throws only on a
   drown latched before the preview, so the throw is a property of the tick, and 20 of the 26 candidate call lines
   are shadowed by an earlier preview of the same state. The one bare site that matters is `probeCorridor`, which must stay
   bare. The raw-stepper searches are the ones that throw on any death.
4. **"Both slow rows green ON" on this box:** seed 30 is green, but the capacity census runs 919 s here against a 900 s
   budget, the same cost at SFF2's own head. Green in CI.
5. **D3 "if the stand's walk changes, re-witness it":** the new walk was already game-witnessed (WANDHOLD,
   `wandhold-l42-371-paced`), and it no longer exercises BW's refusal: OFF = ON at the defaults. The re-witness was run
   anyway (§ 5). The game's last tick is a pickup freeze, not a disagreement on the walk.
6. **Main's wave 28 brought one SFF witness row the brief did not name:** `fidelityWandHold` › leg 371 ON (§ 2).
7. **The producer's "3–4 minutes" per solve:** about 15 s each on this box.

## 9. Residue and hand-overs

1. **Two unguarded candidate searches outside this slice's files:**
   - `crusherBait.alignmentCandidates` (a candidate prefix whose step dies throws out of `execBait`);
   - `lightsVerb`'s sortie step (`env.step = run.previewStepper()`, `lightsVerb.js:327` → `:168`).
   The same rule applies: `previewOrDeath`, skip the candidate. Neither is measured reachable.
2. **`probeCorridor` stays bare by design** (the executor's gate). If the planner wants an executor-path preview death
   to surface as a refusal by name rather than an abort, that is a decision about executors, not a candidate fix.
3. **The capacity census's headroom:** 919 s on this box against 900 s. If a CI box is ever as slow, it times out with
   every seed seated. Splitting the row, or a measured budget, is the planner's call. I changed nothing.
4. **`standing-values`** (§ 7). No `--write`.
5. **The CI probes, TT and the route sweep / survey A/B** are the planner's (`workflow_dispatch` is 403 from here).
6. **Hygiene:**
   - no stash, no force-push, nothing pushed to `main`;
   - no `pytest`, no unfiltered local vitest, no `standing-values --write`;
   - no AS3, wasm, gitlink, rules, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `pressKillGuards.js` or
     `flashPanel/*` edit, and `previewWalk` is untouched;
   - no switch flipped;
   - the scratch worktrees (`main-wt`, `bench`, `w0wt`, `sff2`, and the `shared-218` submodule worktree) lived in the
     session scratchpad and are removed by name; the dev servers were killed by PID.

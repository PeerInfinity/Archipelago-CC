# SEEDLING HAMMER-PHASE — slice STRIKECACHE (cheaper `deriveStrike`)

Session `seedling-hammer-strikecache` (Opus, cloud). Planner: `seedling-hammer-phase-planning-14`. Evidence:
`CC/docs/cloud-reports/seedling-hammer-strikecache-evidence/`. No planner follow-up arrived during the slice.

## 1. SHAs

- Start: `origin/hammer-stack-face1-meter` @ `dbf18d461fdd5881020e26b96d49856acfdd4add` (main `5aaad790eb` + FACE1 + SPINNER880).
- Branch: `claude/seedling-strikecache-k6kngc`. Head: this report's commit.
- Commits: `cb996d20` (step 1, the measurement), `c69a0e90` (step 2, the switch), `ccad361e` (step 3, the rows),
  then the regenerated solver-surface census, the evidence tools, and `4708bb26`, a merge of `origin/main` @ `363564bf`.
- `origin/main` moved during the slice (lab and region-map trains). It touched no solver file. The merge conflicted
  only in generated census text, which I regenerated. The FACE1/SPINNER880 stack had not landed. Acceptance md5 was
  re-measured after the merge (§4).

## 2. The answer first

- **The switch:** `STRIKE_PREVIEW_LEAN` (`SEEDLING_STRIKE_PREVIEW_LEAN=1`, OFF; `withStrikePreviewLean(enabled, fn)`).
  - It runs where `deriveStrike` runs: the solve worker, and node.
  - No main-thread mapper reads it.
- **The one thing to know first:** the brief's cross-tick cache **cannot be exact**, and it does not pay.
  - Measured (§3): 96–99 % of each tick's strike walks repeat the previous tick's cell and start state.
  - But only 4 % (19:1) and 0 % (26:11) repeat it whole. The bodies move every tick, so every whole-walk key misses.
  - What repeats is the waste. 82 % (19:1) and 100 % (26:11) of the previewed states are 400-tick `stalled` walks. Each
    one moves for 19 ticks, then sits pinned against a wall. `walkTo` reads nothing of such a walk but `truncated`.
- **What the switch does:** it computes only what `walkTo` actually reads.
  - The spinner rows are taken at the walk's end, and never for a truncated walk.
  - With no strike policy, every forecast is output only. The transit then steps the player alone, and the
    forecasts are replayed at the end, never for a truncated walk.
  - The change is **exact**: a walk that arrives is identical sample for sample, and a truncated one has the same
    `truncated`. Every request I ran gives a byte-identical answer, work, passes and progress-site trace (§5).
- **The numbers** (node, 4-core box, same box per pair; the census arms ran 3 at a time):

  | request | OFF | LEAN | METER | LEAN+METER |
  |---|---|---|---|---|
  | P1 19:1 | 240 s | **131 s** | 78 s | **63 s** |
  | P1 26:11 | 1,079 s | **692 s** | 46 s | **32 s** |
  | all 147 P1 requests (sum) | 1,625 s | **1,072 s** | 361 s | **344 s** |
  | L43 flag12 5227 @ 2560 | 839 s | 820 s | — | — |

- **Solved / hitless:** nothing moves.
  - P1: 147 of 147 requests are identical in every arm pair.
  - L43 5227: the same 2068 t plan, `69df67a6a954`, with 0 hits in both arms.
  - The survey: 250 of 250 steps identical, so no step gains a hit.
- **What is left on the wall:** with a strike policy (26:11, and every L40 kill), the chaser forecast still steps.
  That forecast re-steps its own copy of the spinners in every preview, which is 33 % of preview time. That cost is
  in `levelRun`'s model, so it is a hand-over (§9), not this slice's.

## 3. The reproduction (measured)

### Instrument

- `STRIKE_WALK_TRACE` is a sink in `deriveStrike`'s `walkTo`. It is `null` unless a tool sets it.
- `tools/trace-walks.mjs` and `tools/trace-walks2.mjs` replay one captured request with the sink on. They write one row
  per walk computed: the tick, cell, start state hash, motion hash, full-sample hash, verdict and shape.
- `tools/analyze.mjs` compares each derivation with the one before it.
- Requests come from re-measure-6's `P1.requests.jsonl.gz`.

### P1 19:1 (`repeat-19-1.txt`, `shape-19-1.txt`)

- 352 derivations, 6,450 walks, 1.83 M previewed states. Median 18 walks per derivation.
- Consecutive derivations are 1 tick apart (336 of 351 gaps).

| of each walk, against the tick before's derivation | walks | states |
|---|---|---|
| the same cell | 96.3 % | 95.8 % |
| the same cell and the same start state (`run.state`) | 95.7 % | 95.7 % |
| … and the same motion (x, y, keys per tick) | 69.1 % | 66.4 % |
| … and the same samples whole (with the bodies) | **3.8 %** | **5.3 %** |
| … and the same verdict (truncated / safe / length) | 88.1 % | 91.9 % |

- Only 4 distinct start states appear in the whole solve: the player stands on its refuge.
- Shape of the walks:

  | walks | count | states | median distinct positions | median last move |
  |---|---|---|---|---|
  | unarmed, stalled | 1,904 | 761,600 | 20 | tick 19 |
  | armed, stalled | 1,840 | 736,000 | 20 | tick 19 |
  | unarmed, arrived | 1,356 | 165,068 | 135 | — |
  | armed, arrived | 1,350 | 165,836 | 128 | — |

  "Unarmed" is the OPP fallback's redo, which has no strike policy.
- So a stalled walk is 19 ticks of motion, then 381 ticks pinned. 82 % of all states are in stalled walks.

### P1 26:11 (`repeat-26-11.txt`)

- 1,492 derivations, 24,828 walks, 9.93 M states. 24,826 of the walks are `stalled`.
- 98.7 % repeat the cell, start and motion of the tick before; **0 %** repeat whole.
- 99.8 % are armed, and none of them takes a strike.

### Where the time goes (`prof-19-1-previewWalk.txt`)

Measured with `profile-seedling-solve-wall.mjs --focus=previewWalk` on 19:1:

| share of `previewWalk` | what |
|---|---|
| **60.4 %** | the chaser forecast's `step`; of that, `stepSpinners` (its spinner walls) 33.1 % and `chaserStep` 10.9 % |
| **18.9 %** | `spinRow` (the spinner fight cursor) |
| 7.0 % | the player stepper |
| 4.9 % | `combatBefore` |

### What an exact reuse would have to key on

A walk depends on:
- the player state;
- the stepper's frozen geometry;
- **every forecast's state at the walk's start**: spinners, chasers, spits, slash windows;
- the strike policy's state.

The bodies change every tick, so the key changes every tick: 0–4 % whole-walk repeats.

The motion alone does repeat. Unarmed, 3,122 of 3,122 repeats are identical. But a motion-only memo would save only
the stepper's 7 %.

I also tried detecting a pinned orbit, to stop a stalled walk early. The player's velocity cycles against the wall
with period 15, but the cycle drifts in the last ulp. So it repeats exactly in only 248 of ~1,900 walks, and I dropped it.

**The expected saving, stated before the change:**
- spinRow's 19 % on armed truncated walks;
- nearly all of the forecast cost on unarmed truncated walks;
- roughly 40 % of 19:1's wall, and the spinRow share alone for an armed-only kill such as 26:11.

## 4. Design and change; OFF identity

All in `solverBot.js`: new functions, one new `previewWalk` option, and the one `walkTo` call site. No reformatting.

**`previewWalk(…, { lean })`** is opt-in, and only `deriveStrike`'s `walkTo` passes it, under the switch. It makes two
changes:
1. **Spinner rows.**
   - `spinRow` is output only: nothing in the walk reads `sample.spinners`, and the cursor belongs to the walk.
   - Each tick's inputs (x, y, press) are queued.
   - At the walk's end, an arrived walk takes the rows in order. A truncated one never takes them
     (`STRIKE_PREVIEW_LEAN_COUNTS.spinRowsSkipped`).
2. **Forecasts deferred (`leanDeferrable`).** This applies only where nothing reads the forecasts and nothing skipped
   could have thrown:
   - no strike policy (its keys read the chasers' bodies, and its swing hits them);
   - no steer, no `stopWhen`, no stall in the walk, no standing tail;
   - with chasers present, an exact camera: `run.shake === 0` and no `run.cameraNow.band`. The chaser forecast's only
     non-structural throw (`onScreenAt`) needs a band, and a band opens only from a shake.

   The transit then steps the player alone and queues `[sample, pre-move state]`. An arrived walk replays every forecast
   over those states in tick order (`leanForecastReplay`). Each sample is rebuilt in the transit's key order, so its JSON
   is the same. A truncated walk replays nothing (`forecastTicksSkipped`).

**Other edits:**
- `solverEnvChannel.SOLVER_ENV_NAMES` gains `SEEDLING_STRIKE_PREVIEW_LEAN`.
- The PREVIEW_METER count is unchanged under lean. Every sample is still pushed, so the meter counts the same states;
  this is why METER vs LEAN+METER is identical too.

**Acceptance md5** (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

| run | md5 |
|---|---|
| base `dbf18d46` | `391322d681b7aa0229d94b3f6906d024` |
| head, OFF (after the main merge) | `391322d681b7aa0229d94b3f6906d024` |
| head, ON (after the main merge) | `391322d681b7aa0229d94b3f6906d024` |

## 5. Rows and bounded vitest

**`strikePreviewLean.test.js`** (default tier, L18 `r9-solve-18`): **4/4**, 15 s.
1. Ships OFF.
2. Exactness on recorded inputs.
   - At every walk an OFF solve's `deriveStrike` computes (984 walks), the same walk is asked again on the spot, both
     uncached and lean.
   - An arrived walk is byte-identical. A truncated one has the same `truncated` and length.
   - L18's kill holds no strike policy, so this row covers the deferred-forecast arm.
3. The whole solve, ON vs OFF, is byte-identical, and the skip counters are non-zero.
4. `lean` is opt-in: without it, the walk is the same ON as OFF.

**`strikePreviewLean.slow.test.js`** (slow tier, the armed arm): **2/2**, 283 s.
- The witness is the L40 chest press kill on `spinner@880,848` (`fixtures/l40bk2-witness/step67-boot.json`, the OPP
  witness's boot), capped at t800.
1. The same exactness check on every armed walk, each with a fresh strike policy.
2. The drive's keys are identical to the cap, and `spinRowsSkipped` is above 0.

**Other bounded runs:**
- `frontend/modules/procgenDocs/`, `strikePreviewLean.test.js` and `solverEnvChannel.test.js`: 10 files, 512/512
  (after the merge).
- `scripts/procgen/seedlingSolverSurface.test.js` and `entityBlocks.test.js`: 66/66.

**Regenerated, with `--check` green:**
- `census-seedling-solver-surface.mjs` (374 rows: `run.shake` and `run.cameraNow` each read at one more site);
- `generate-procgen-reference.mjs`;
- `generate-docs-index.mjs`.

**Captured requests** (`census.jsonl`, `census-compare.txt`; `tools/census.mjs`, `tools/cmp.mjs`):
- All 147 P1 requests under four arms.
- OFF vs LEAN: **147/147 identical** in answer digest, work, kind and per-pass record, and 147/147 identical
  progress-site trace hashes. Wall 1,625 s → 1,072 s.
- METER vs LEAN+METER: **147/147 identical**, the traces too. Wall 361 s → 344 s.
- By leg, wall OFF → LEAN:
  - `Level 040 - Boss Key 2`: 1,182 → 777 s.
  - `Level 040 - Chest`: 241 → 132 s.
  - The other legs move by seconds. That is contention noise: §7 shows they never reach the walk.

**L43 flag12 5227 at 2560** (the fixture re-stamped as SPINNER880 ran it; OFF and ON at once on this box):
- Both arms: ok, work 2024. Dashless 2160 t, full **2068 t, answer `69df67a6a954`, 0 hits, 0 deaths**.
- 839 s → 820 s. Lean skipped 460,800 spinner rows here, yet the wall barely moved: this request's time is elsewhere.

**Survey `--through=end`** (OFF and ON at once):
- 250 step lines identical once wall ms is stripped, and the `--out` JSON identical.
- 224 SOLVED, 26 REFUSED; the hit counts are OFF's. 17 m 34 s in both arms.
- No step gains a hit. No survey step spends meaningful time in the press kill's walk (`survey-slowest.txt`).

## 6. Page play / game witness

None. The switch is exact, so no plan moves and there is nothing new to witness. On the page, LEAN alone does not
bring 26:11 under the 300 s backstop (692 s in node). With PREVIEW_METER ON it is 32 s instead of 46 s.

## 7. Census: which seed-1 legs can move, by KEY

The switch moves **no verdict and no plan**, by construction and as measured (§5), so it can move wall time only.

Legs whose solves reach `deriveStrike`'s `walkTo` (`walks-by-leg.txt`: every P1 request under LEAN+METER, with the
sink counting walks):

| leg (key) | requests reaching | walks | forecast ticks skipped | spinner rows skipped |
|---|---|---|---|---|
| `Level 040 - Chest` | 1 of 2 | 2,144 | 123,200 | 368,000 |
| `Level 040 - Boss Key 2` | 3 of 12 | 1,050 | 39,200 | 291,200 |
| `Level 019 - Boss Key 0` | 1 of 5 | 518 | 9,600 | 0 |
| `Level 039 - Totem Part 72,40` | 1 of 9 | 197 | 22,000 | 0 |

The other 22 legs never reach it.

I did not run the divergence sweep's own L40 legs by key (`flag12-L39`, `chest-L39`). The one sampled, L43 → L40
flag 12 (`level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared`),
gains 2 %.

## 8. What the brief got wrong (measured)

- *"Cache the press kill's strike previews across ticks"*: no exact cross-tick cache hits. Whole walks repeat 0–4 %,
  because the bodies' forecast state is part of every walk's input and changes every tick (§3).
  - What repeats is the start state (96–99 %) and the shape: 400-tick stalled walks whose outputs nobody reads.
  - The saving therefore comes from not computing unread outputs, not from reuse.
- *"Inside the preview: `levelRun.step` 47.6 %"*: that `step` is the **chaser forecast's** step (`levelRun.js:9367`),
  not the player stepper. The player stepper is 7 %.
  - So a stepper memo, the obvious exact cross-tick lever, would save at most 7 %.
- The F1c `clearAhead` pattern (carry the drive's own walk forward) fits the rung's preview of the walk the drive
  takes. It does not fit here: these walks go to candidate cells the drive is not walking to, while the drive stands
  on its refuge.

## 9. Residue and hand-overs

- **Hand-over to the `levelRun` / fidelity owners: the chaser forecast's spinner walls.**
  - `chaserForecastNow` steps its own spinner copy (`fspin`) in every preview. That is 33 % of preview time on 19:1,
    and it dominates 26:11's remaining 692 s.
  - The spinner walls are player-independent: they read no player input.
  - So a per-tick trunk shared by all of a derivation's walks, shifted across ticks as `spinnerForecast` already is
    under PRESS_KILL_COST, would be exact and would also cut the armed walks.
  - Rows to start from: this slice's `strikePreviewLean*.test.js` exactness harness (`STRIKE_WALK_TRACE`).
- **Observation for fidelity, not acted on.** `deriveStrike`'s `walkTo` prices transit with
  `dangerDuringTransit(…, arrows, chasers, spits, grenades)`. It passes no `walkSpinners`, so the walk's own struck
  spinner rows (L40BK2 D2) are computed and never priced there. Is that intended? It is why `spinRow` is pure output
  in these walks.
- **Before any flip:**
  - the divergence sweep's L40 legs by key, ON vs OFF;
  - a page run of 26:11 with LEAN+METER.
- **Scratch tools** live in the evidence's `tools/` folder. `one.mjs` and `walks.mjs` print the lean counters.

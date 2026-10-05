# Seedling fidelity DASH: the game refutes the solver's L16 dash plan — why, the fix, and an exact dash count (cloud report)

**Slice:** `seedling-fidelity-dash`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-2`, wave 4).

⚖ **The user** (2026-10-03): *"Yes, I want to extend the model to cover everything in the game."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/wave3` @ **`b116c69fe57f5ad807e710f5231a208002932407`** |
| Harness branch | **`claude/seedling-fidelity-dash-i1dan7`**. Every push went here; nothing went to `main` |
| Commits | D1 `df1b9d4` · D2 `ed2d206` · D3 `8465001` · reference `b56cff1` · D4 `4332076` · log `e38696a` · pins `37cc1bf` · this report (the head) |
| Verdicts | **W0 PASS · D1 PASS · D2 STOP (the fix lands gated OFF; turning it on moves two committed solves) · D3 PASS · D4 PASS** |

## The one thing to know first

**A sword DASH buys four hit tests in the game, and the model ran five.** That fifth test is what broke L16.

- In the PULL rung's walk to the rope stance, the model's fifth test pulled `rope@32,16` at tick 88.
- That silenced the arrow traps one volley early.
- The game fired at t100, and that volley's arrow hit the player at t104.

The cause is one constant in the animation clock. `FP.elapsed` is the 0.0333 clamp, not 1/30, so the dash animation
ends one tick sooner than the model thought.

The fix (`combatVerbs.SLASH_ANIM_TICKS_GAME`) is game-witnessed, but it ships **OFF** (`DASH_WINDOW_ROSTER_WIDE =
false`). Turning it on makes the solver re-derive two committed campaign segments:
- `r9-solve-14`: 118 t → 98 t;
- `r9-solve-16`: 625 t → 688 t.

No re-record is licensed. So the flip, and the re-record of those two segments, is one slice's job.

## W0 (at `b116c69`, primary tree, `SEEDLING_PORT=9270`)

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9270 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`aa46950b5958b32136111155250dd253`** (the banked value) |
| six `--check`s | in the block | `405d9c4bb37a0ab00fb0ef9a99194783` · `8e7a43be0509882d753f54155ef284c2` · `33d20889ebd8c72452ce7262bce9505b` · `35456fbc07e7151ddbc4c2a1fd00c789` · `6cd35fe1414af6bf5beb7605f235cb8e` · `b29b589b26e6ad996c2a328d16b52c90`, all exit 0 |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / entities / profile | the four `--check`s | **GREEN 195** · **PASS 4,966** · **PASS 518** · **PASS 138**; surface json `9a7cdc1e…` |
| roster | `fixtures/tapes/index.json` | **210** (`c96bcc4c…`) |
| bounded vitest BEFORE | 18 files: `combatVerbs`, `presses`, `ulpDash`, `solverBot`, `solverDeadline`, `tapeRunner`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `decisionTrace`, `entityBlocks`, `seedlingCanCross`, `jsRuntimeDeclarations` (read-only), `seedlingProfile`, `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus` | **986 / 986 green** |
| tapeRunner | (fullName, status) pairs, sorted, `name\tstatus\n` | **477/477**, md5 `5bdf547cd654e69b2cf239e1549ef0f5` (CANCROSS's banked value) |

## D1: diagnosed on the game (PASS)

**Reproduce.** `can-cross-seedling.mjs --level=16 --exit=17 --from=15 --inventory=sword --dash=all --witness=…` gives
the 111 t plan, `5b1f924b52`.

**The instrument.** `scripts/procgen/probe-seedling-dash-window.mjs` (new; takes the box behind `isEntryPoint`; in
`boxLock.test`'s guarded list) plays a tape on headless p4f. At every tick it samples it reads `botStatus` and
`botMobiles`, then compares three things against the model:
- **slash**: the game's own counter `Bot.slashTests` (`botStatus.slash.tests`, one per `Player.slash()` rect test)
  against the model's `presses` ledger, `fired + 1`, cumulative;
- **arrows**: every `Projectiles::Arrow` against `arrowFlights`;
- **stream**: the drained stream against `runTapeToStream`.

All 112/112 and 118/118 ticks were sampled.

**What the game said, on the refuted tape:**

| signal | game | model (base) |
|---|---|---|
| slash tests after the dash pressed at t77 | obs 79, 80, 81, 82: **four** | fired 78–82: **five** |
| slash tests after the dash pressed at t83 | obs 85–88: **four** | fired 84–88: **five**; the fifth (fired 88) hits `RopeStart rope@32,16`, `pulled: true` |
| `persistence_cleared` tag 0 (the rope) | appears at obs **101** (the press at t99, fired 100) | `ropePulls` t **88** |
| arrow volleys (`y = 32`) | t 1, 12, …, 89, **100** | t 1, 12, …, 89 (the trap read the rope's group at 89) |
| t104 | arrow `(100, 52)` stops (`vy` 0); `hits` 1 | no hit |
| first stream divergence | t104: game (95.475, 47.074), model (98.569, 50.342) | |

The probe's first disagreement is at obs 11, the first dash of the walk (game 6, model 7). Arrows first differ at
obs 100. The stream first differs at t104.

**The cause, in the source.**
- `Spritemap.update` does `_timer += _anim._frameRate * FP.elapsed`, and steps a frame each time `_timer` reaches 1
  (`Spritemap.as:74`). `FP.elapsed` is clamped at `MAX_ELAPSED = 0.0333` (`Engine.as:270`).
- `slash` is frames [0..4] at `swordSpeed` 30. That is 0.999 an update, so the first update steps nothing and the
  fifth frame wraps on **update 6**.
- `slashnarrow` is frames [1..3] at `swordSpeedDash` 20. That is 0.666 an update, stepping on updates 2, 4 and 5, so
  it wraps on **update 5**.
- `play(anim, true)` runs inside `input()`, and `sprites()` advances `slashingSprite` on the same tick. So the press
  tick is update 1.
- `slash()` runs above `super.update()` and tests while `slashing` is up. `slashEnd` drops the flag in `sprites()`,
  below that tick's test.
- So a press at T tests on `T+1 … T+(updates − 1)`: **5** for a swing and **4** for a dash.
- `combatVerbs.animCompleteTicks` accumulated `frameRate / 30`. That gives 5 for both: right for the swing by a
  coincidence (1.0 an update), and one too long for the dash.
- Every other clock in the tree already read 0.0333 (`breakableRocks`, `chasers`, `burnableTree`, `fireVerb`,
  `bobBoss`). This was the only `/30`.

**Hypotheses the brief named, as measured:**
- **An arrow already in flight when the rope is pulled: no.** The rope was pulled too EARLY in the model, so the
  game had one more volley.
- **The dash's hitbox or knockback: no.** The rect sizes (24 × 20.8), the reach (24) and the 2-px impulse agree; the
  stream is exact to t103.
- **A bob: no.** No bob moves near the trap row.
- **The strike policy's press during the dash: no.** It was the planned dash's own fifth test, in the PULL walk, not
  the final walk's window.

## D2: fixed, and gated OFF (STOP)

**The change.**
- `combatVerbs.js`:
  - `animCompleteUpdates(frames, rate, elapsed = PROFILE.fpElapsed)` (the wrap update) and
    `animCompleteTicks = updates − 1`;
  - `SLASH_ANIM_TICKS_GAME = {slash: 5, slashnarrow: 4}`, and the roster's
    `SLASH_ANIM_TICKS_LEGACY = {5, 5}` (`animCompleteTicksLegacy`, the old `1/30`);
  - `DASH_WINDOW_ROSTER_WIDE` selects between the two tables, and `slashHitTicksFor(anim)` reads the selected one.
- `presses.js`:
  - `swordWindowStep` repeats each thrust per its own `anim`;
  - a load-time assertion that the measured `SLASH_HIT_TICKS` (5) is the plain swing's derived length.

At `false` every value is the base's, so the model is byte-identical.

**With the gate ON (measured in a scratch worktree and by copy-and-restore mutants):**

| measurement | result |
|---|---|
| the refuted tape vs the game's stream | **identical**, 112 observations, the hit at t104, volley at t100 |
| model hit tests vs `Bot.slashTests` | equal at every observation of both tapes (53 / 54 in-tape tests) |
| tapeRunner (every committed tape vs its recording) | **479/479** |
| `solve-seedling-r8-battery / -d2-chain / -l18 / -tail / -r9-l3 --check` | byte-identical (`405d9c4b` `8e7a43be` `33d20889` `35456fbc` `6cd35fe1`, exit 0) |
| `solve-seedling-r9-campaign --check` | ⛔ **exit 1** (`7315212c…`): `r9-solve-14` re-derived 118 → 98 t, `r9-solve-16` 625 → 688 t (8 failures: the two segments, their traces, the tick sum 10935 → 10978, two seam-time oracles) |
| the solver's L16 `all` plan | **117 t, `12575cff30`**, PULL, 0 hits, onto L17 |

This is the brief's STOP case: a committed tape would move and no re-record is licensed. So the gate is `false`.

**The game witness.** `dash-l16-sword-all` is the 117 t plan. It joins the roster:
- `--record`: *"⛓⛓ THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 118 observations, 1 transition(s)"*. The game's
  `hits` 0 = the model's, 40 dead frames.
- A second replay, by the probe, gave the stream equal tick for tick.

It also replays identically at the gate OFF. Its trajectory survives the legacy window, but its arrows do not: the
game's t100 volley.

**The refutation, kept** in `fixtures/refuted/dash-l16-sword-refuted.{tape,expectation}.json` (the 111 t plan + the
game's stream; not in the roster; read by name). `fixtures/dash-window-oracle.json` holds the game's `Bot.slashTests`,
`hits` and volley ticks at every observation of both tapes.

**Unit rows** (`fidelityDash.test.js`, 8 rows; every row holds at both arms):
1. the tables, and the gate is OFF;
2. and 3. per tape: the model's tests, with each dash cut to four, equal `Bot.slashTests` at every observation. The
   model's own count parts at obs 11 at the gate OFF;
4. the refuted plan:
   - gate ON: the stream is reproduced, the volleys equal the game's, and the hit is at t104;
   - gate OFF: CANCROSS's exact t104 message, and the one missing volley is t100;
5. `canCross` L16 `all`:
   - gate OFF: the refuted 111 t plan, `5b1f924b52`;
   - gate ON: 117 t, `12575cff30`, with inputs equal to the committed witness's.

Also updated:
- `combatVerbs.test`: the accumulator rows (5/6 updates, 5/4 ticks, the clamp vs 1/30, the ghost sword 7/6), the
  tables, the gate pin, and `slashHitTicksFor`;
- `presses.test`: a dash window of `T+1 … T+n`.

**Mutants** (each predicted, made by copy and restore, restored md5-identical):

| mutant | predicted | measured |
|---|---|---|
| `DASH_WINDOW_ROSTER_WIDE = true` | only the two gate-pinning rows red; tapeRunner green | **2 red / 92** (`combatVerbs`, `presses`, `fidelityDash`), **tapeRunner 479/479**. Restored `cc5d98f2…`. ⚠ A first cut of row 4 predicted the hit ledger at t103 and measured t104, so the row was corrected to the measured value |
| the same, on the 5-row `fidelityDash` (with the `canCross` row) | the gate row only | **1 red / 5** |
| the same, on the broad bounded set (26 files) | the gate rows, plus whatever pins the legacy window | **6 red / 1,315**: the 2 gate rows; `r8Acceptance`'s pre-existing red; and **3 model rows that pin the legacy window**: `levelRun` *"the replaced window leaves NO GAP"* (3 > 2), `solverBot` *"a PLANNED dash chain takes L14's boot to ZERO hits THROUGH 120"* (22 hits vs 11), `solverBot` *"a press the model says will be SWALLOWED"* (51 vs 68). The flip slice owes those three. **No JS-arc test moves** (`jsRuntimeSolver`, `jsRuntimeSolveService`, `jsRuntimeDeclarations` green) |

## D3: `out.dashes` (PASS)

`solveSegment(…)` returns an **optional new field** (the only contract change; no signature moved):

```js
out.dashes = {
  count,    // dash presses this segment's ticks made: `set slashing`'s dash arm, read off the run
  windows,  // planned dash windows handed to a driven walk, inner rung walks included
  walks,    // [{tick, what, attempt, planned, windows, ticks, saved, why, pressed}], one per walk the planner was asked for
}
```

**How `count` is read.** It is counted on the segment's `advance` wrapper, the one every executor's tick passes
through:
- `slashDashed` rises only in the dash arm, and falls only on the release, four or more ticks later. So one
  false→true edge across one advance is exactly one dash.
- With a `prefix`, the count starts after the prefix.
- Nothing in `solverBot` reads it, and the trace is untouched. The two extra `progress('slashInfo')` reads go through
  `inner`, not the JS arc's recording proxy's intercepted `advance`/`equipNow`.

**L16 → L17:**

| | `count` | `windows` | `walks` (windows / pressed) | the trace's `swordDash` windows |
|---|---|---|---|---|
| `all`, gate OFF (111 t) | **11** (= `run.dashes`) | **5** | PULL stance walk 4 / 9 · final walk 1 / 2 | **1** |
| `all`, gate ON (117 t) | 11 | 5 | 4 / 9 · 1 / 2 | 1 |
| `none` (206 t) | **0** | 0 | `[]` | — |

**Why the rows under-count.** The PULL rung's inner walk sees its row at tick 0, the same tick as the `pull` row.
`seeRow`'s merge keeps the substantive row and drops the walk's `strategy`, `swordDash` included (SF residue 1,
traced). The replay of the committed plan presses the same 11.

**Unit rows:** 3 in `fidelityDash.test.js`.
- Mutant (the increment made `+= 0`, copy and restore): predicted the two count rows red and the dashless row green;
  measured **2 red / 8**. Restored `26182474…`.

## D4: census (PASS)

`scripts/procgen/census-seedling-dash-window.mjs` (new, headless, model-only) replays every committed tape under the
roster's model. It lists two kinds of suspect:
- **(A)** a dash's fifth test landing an *effective* hit;
- **(B)** a press exactly five ticks after a dash (`slashEnd` one tick late).

Output md5 `8028b6e6…`:
- **213 tapes (211 roster + 2 refuted); 35 press a dash.**
- **Three suspects, all with the one cause.** In each, the fifth test of the dash pressed at t83 (fired 88) pulls
  `rope@32,16`:
  - `dash-l16-sword-all`;
  - `refuted/dash-l16-sword-refuted`;
  - **`r9-solve-16`**, the committed campaign L16 crossing. That is why it re-derives at the gate ON. Its recording
    agrees on the player and was blind to the rope.
- **No (B) anywhere.**
- `r9-solve-14` is clean. Its re-derivation at the gate ON comes from the planner's candidate previews (the dash chain
  timing), not from a fifth test in its tape.
- The other 32 dash tapes are clean. Among them are `burn-l24/l44`, `f1c-l18-*`, `r8-d2*` (69 dashes), `r9-solve-0…31`
  and `r9-l6-sword-dash-hit`.
- One replay error: `refuted/r8-solve-5` (a pre-existing sound-pin refusal under a plain stepper).

A sweep for any other `/30` animation accumulator: none (`shieldBossFight` names the clamp explicitly).

## Records

| row | command | result |
|---|---|---|
| identity AFTER | the W0 command, committed tree | `aa46950b…`, empty `diff` vs W0 |
| surface / constants | `--check`, `--write`, `--check` | **GREEN 195** / **PASS 4,970** (both `--write`s were needed: D2 moved `combatVerbs.js` lines and literals, D3 added two sites) |
| entities / profile | `--check` | PASS 518 / PASS 138 |
| reference | `generate-procgen-reference.mjs`, then `--check`; `check-procgen-docs` | ALL 7 + 5 MATCH; ALL CHECKS PASSED |
| help gate | `check-procgen-help --only=<each new instrument>` | ALL PASS, both |
| box lock | `boxLock.test` (the probe in the guarded list) | 26/26 |
| bounded vitest AFTER | the W0 18 + `fidelityDash`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `fixtures/tiers`, `rosterCategories`, `levelRun`, `jsRuntimeSolver`, `jsRuntimeSolveService`, `r8Acceptance`, `dangerMap`, `shieldFight`, `campaignChain` | **32 files / 1,730 of 1,732**, 2 pre-existing reds |
| bot log | `seedling-bot-log.md` | `### Seedling fidelity DASH — a dash buys four hit tests, and the game said so`, after CANCROSS, with three trap candidates |

## The JS arc's pins

- **At the gate OFF (the head): none move.** `jsRuntimeSolver`, `jsRuntimeSolveService` and `jsRuntimeDeclarations`
  are green; no JS-arc file was edited.
- **New optional field:** `solveSegment(...).dashes`.
- **At the flip:**
  - the live L16 plan the worker's full pass plays becomes 117 t (from 111 t), and the game agrees with it;
  - `canCross`'s `CAN_CROSS_DASH_MODE = 'none'` (CANCROSS) can be revisited.

## Deltas

| row | W0 | head |
|---|---|---|
| identity log | `aa46950b…` | **`aa46950b…`**, byte-identical (empty `diff`), all six `--check`s and the reference row included |
| bounded vitest | 18 files / 986 green | **32 files / 1,730 of 1,732**; the 2 reds are pre-existing at the base (measured there): `rosterCategories:175` and `r8Acceptance`'s exposed set |
| tapeRunner | 477/477 `5bdf547c…` | **479/479** `55bc8755…`: the 477 old pairs byte-identical (`5bdf547c…`) + 2 for `dash-l16-sword-all` |
| roster | 210 | **211** (`dash-l16-sword-all`), index `4e4460bf…` |
| surface | GREEN 195, `9a7cdc1e…` | **GREEN 195**, `baf8548b…` (`--write`: line moves in `combatVerbs.js`, +2 `run.progress` sites via the `inner` alias) |
| constants | PASS 4,966 | **PASS 4,970** (`--write`; the fields CSV re-targeted to `animCompleteUpdates`, `animCompleteTicks(Legacy)`, `SLASH_ANIM_TICKS_GAME/_LEGACY`) |
| entities / profile | 518 / 138 | unchanged |
| instruments | 343 | 345 (`probe-seedling-dash-window`, `census-seedling-dash-window`) |

**Files:**
- new:
  - `probe-seedling-dash-window.mjs`, `census-seedling-dash-window.mjs`, `fidelityDash.test.js`;
  - the roster tape and its expectation, the refuted pair, `dash-window-oracle.json`.
- changed:
  - `combatVerbs.js`, `presses.js`, `solverBot.js` (D3 only);
  - tests: `combatVerbs.test`, `presses.test`, `boxLock.test`, `ulpDash.test`, `r8Acceptance.test`;
  - `r8Acceptance.js` (one exposure row);
  - the roster pins: `tapeEnvelope`, `observationTolerance` ×2, `dialogueAutoAdvance`;
  - the refuted README, the census tables, the bot log, the regenerated reference.

## What the brief got wrong (measured)

1. **"Expected (95.47, 47.07), got (98.57, 50.34)."** *Expected* is the GAME and *got* is the model. The game's player
   was knocked back (−3.09, −3.27) by arrow (100, 52). It is not the model that was displaced.
2. **"PULL + one dash window."** The plan presses **11 dashes in 5 windows**. Four windows are in the PULL rung's walk
   to the rope stance, and that walk broke the plan. The trace shows 1.
3. **"The divergence point is under the trap row"** was a symptom. The cause was 13 ticks earlier and 50 px away: the
   rope pulled at fired 88 by a dash test the game never runs.
4. **The four hypotheses** (an arrow in flight at the pull, the dash's hitbox or knockback, a bob, the strike
   policy's press) were all no. It was the animation clock's constant.
5. **"Fix the model so the model reproduces the game's hit, and the solver then stops certifying that window."** The
   model fix is complete, but it cannot be the default without moving `r9-solve-14` and `r9-solve-16`. It ships OFF.
6. **"`hits_timer` 12."** It depends on when the post-tape frame is sampled: 11 in this slice's probe runs. The frozen
   terminal counter is the stable reading.

## Residue

| # | item | owner |
|---|---|---|
| 1 | **Flip `DASH_WINDOW_ROSTER_WIDE`**. The licence it needs is to re-record `r9-solve-14` (→ 98 t) and `r9-solve-16` (→ 688 t), plus the campaign `--check` and its seam-time oracles. Update the three model rows that pin the legacy window (`levelRun` no-gap chain; two `solverBot` L14 dash-chain rows) | coordinator → a re-record slice |
| 2 | After the flip, revisit `canCross`'s default `dashMode: 'none'` (CANCROSS), which this refutation was its reason for | rules arc / CANCROSS's owner |
| 3 | `r9-solve-16`'s committed recording is blind to its rope timing (D4 suspect A). The re-record in 1 retires it | with 1 |
| 4 | `probe-seedling-dash-window.mjs` FAILs on any dash tape at the gate OFF, by design. It is a measuring instrument, not a gate; it becomes a clean witness at the flip | — |
| 5 | Pre-existing at the base, not this slice's: `rosterCategories:175` (149 vs 150 at the base; 151 with this roster), the composite bank row (`standing-values --write`); `r8Acceptance`'s exposed set (`cancross-l16-sword-none` undeclared) | coordinator / CANCROSS |
| 6 | The spear's `SPEAR_HIT_TICKS_UNMODELLED` cites a "six-advance animation". The same clamp arithmetic should be checked there before a non-idempotent spear arm is reached | fidelity |
| 7 | The new roster tape owes the full tier a CI drive (`check-seedling-full-tier-owed`) | CI |

## Byte-inertia

- **D2 at the gate OFF.** Every table value is the base's: `SLASH_ANIM_TICKS` {5, 5}, `DASH_CHAIN` unchanged, and the
  window's repeat count is 5 for every sword thrust. tapeRunner's 477 old pairs are byte-identical.
- **D3.** It adds a result field and two pure reads per advance. No decision reads them.
- **The identity block AFTER** (`SEEDLING_PORT=9270 bash scripts/procgen/identity-block.sh .` on the committed tree)
  is log md5 **`aa46950b5958b32136111155250dd253`**, and its `diff` against W0 is **empty**. That covers all six
  `--check`s (`405d9c4b` `8e7a43be` `33d20889` `35456fbc` `6cd35fe1` `b29b589b`, exit 0) and the reference row.
  ⚠ The pins commit `37cc1bf` landed while the block ran. It adds one frozen data row to `r8Acceptance.R8_ENEMY_BRIDGE`,
  which the producers import only for `assertTwoPassPrefixAgrees`.
- No committed tape moved, no re-record, and `campaign-frontier.json` is untouched.
- No AS3, wasm, gitlink or rules edit. No `standing-values --write`, no `pytest`, no unfiltered vitest, no
  `git stash`.

## Rows to BANK

- **Identity:** log **`aa46950b5958b32136111155250dd253`** (unmoved). The six `--check`s are unmoved.
- **tapeRunner 479/479**: all pairs `55bc875591b72ef1fa5b9b8c40d07104`; the 477 old ones
  `5bdf547cd654e69b2cf239e1549ef0f5`. **Roster 211.**
- **New fixtures:**
  - `dash-l16-sword-all` tape `4dfa916bae0db58188ff9a053d798103`, expectation `08212b9a9d18ffad732e2c8939ec738f`;
  - `index.json` `4e4460bf3a0d157e33871d5a37f3984f`;
  - refuted tape `60ddaff00a71afd382a6efb54223e16b` / stream `cd5cbb589297384b01b7ac8011b1fbf2`;
  - `dash-window-oracle.json` `90c1c8035657485263eb0b004e2e6867`.
- **Surface** GREEN 195 (`baf8548b06fe05385a44b470b3a33080`) · **constants** PASS 4,970 · **profile** 138 ·
  **entities** 518.
- **Sources:** `combatVerbs.js` `cc5d98f2…`, `presses.js` `dcd50736…`, `solverBot.js` `26182474…`.
- **New API:**
  - `combatVerbs`: `animCompleteUpdates`, `animCompleteTicksLegacy`, `SLASH_ANIM_TICKS_GAME`,
    `SLASH_ANIM_TICKS_LEGACY`, `DASH_WINDOW_ROSTER_WIDE` (= false), `slashHitTicksFor`;
  - `solveSegment(…).dashes`.
- **New instruments:** `probe-seedling-dash-window.mjs` (box, guarded), `census-seedling-dash-window.mjs` (headless).

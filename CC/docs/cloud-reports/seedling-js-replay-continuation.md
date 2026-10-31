# Cloud report: `seedling-js-replay-continuation` (multi-window tape replay in the JS frame)

Coordinator: `seedling-js-planning-13`. The lab-file edits are listed below for `seedling-lab-planning-1`.
Branch: `claude/seedling-js-replay-continuation-6tm89l` (the harness pins it). Base: `origin/main` `bf289081`.
Code commit: `4bb826ab`. This report is the last commit.

**Outcome: built. Nothing STOPPED.** The continuation needed only the core's tape glue. There is no `levelRun`,
solver, `vendor/seedling`, wasm, flashPanel, `scripts/cloud/` or `jsRuntimePage.js` edit. The rebuild rule reads
straight off Bot.as, so nothing had to be guessed.

## 1. The JS core continues: `frontend/modules/seedlingDemo/jsRuntimeCore.js`

### The Bot.as lines modelled

| Bot.as (and friends) | What it says | JS core |
|---|---|---|
| `:1843-1846` `if (bootLevel != Main.level \|\| !atBootPosition()) booting = new Game(…)` | The game rebuilds only off the boot. | `botStart` takes the **continue** arm when `run.level === boot.level` and `run.worldCtor` equals `(boot.x, boot.y)`. |
| `:1950-1953` `atBootPosition`: `Main.playerPositionX == bootX && …Y` | Compares the boot spot with `Main.playerPosition*`. | — |
| `Game.as:555-560` | That value is the room's CONSTRUCTION spot (the `playerPosition` setter: ctor or arrival), never the live position. | `run.worldCtor`, the same value the core's own `Main.playerPositionX` read answers (`:1113`). |
| `:1915` `armed = (booting == null)` | On the skip path, the tape arms at once. | Armed at once over the live run. |
| `:1708-1772` | Persistence and save-array reset plus the declared clears. These are unconditional, so they run on a continuation too. | **Not re-staged**, for two reasons. The admission (`director.continuationAdmission`) already holds the declared tables equal to the live world's. And no built object re-reads them. Re-staging *is* a rebuild (`tapeRunner.createTapeStepper`'s resume face). |
| `tapeRunner.js:553-555` | The resume face adopts the window's clock when the run's clock is unknown. | `live.adoptWindowClock(tape)` |
| `watchViewer.walkSequence` `run.addEquips`, and game `:3246` `applyEquipsFor(tick)` | The window's equips, applied per window tick. | `live.addEquips(equips rebased by run.ticksCompleted)`. A misfit refuses as `JS_TAPE_REFUSALS.equips`. |
| `:1663` `holding = false` | `botStart` releases a held room. | Same. |
| `:1936` `clearObservations()` | `botStart` clears the buffer **and** its base. | `obs: [], obsBase: 0` on every `botStart`. Phase B reset the base only in `botLoadTape`. |
| `:1607`, `:1628` | `botLoadTape` records `holdDeclared`, clears the observations, and does **not** release a held room (`:288-292`). | Same. The `hold` refusal is retired. |
| `:3326-3328` `if (holdDeclared) holding = true`, and `Main.as:80-89` | P4E: the latch holds the room before the finishing frame's `super.update()`. | On the finishing tick and every tick after it, the core returns `{stepped: false, held: true}` without stepping until the next `botStart`. The host queue is still drained. |
| `:2048` `held: holding` | Status field. | `botStatus.held` |
| `:3563` | `botLoadLevels` releases a held room. | Same. |

### `botLoadTape` / `botDrain` across windows

The buffer and drain base behave as the game's do:
- `botStart` zeroes the base;
- `botDrain` keeps the base (`:2882-2883`);
- each window's drain starts again at `t 0`, which `concatDrains` expects.

### ⚖ One bounded liberty, named in the docblock

The continue arm runs only over a **tape's** run (`tape.chainBoot`). A tape rebuild sets it; every non-tape boot clears it.

So a tape whose boot is a room that a non-tape boot built still **rebuilds**, where the game would not. Non-tape boots
are the game's first frame (`Main.as:51`, which `setVanilla` boots at L0 (80, 128)), a host teleport, and an item
reboot. Without the liberty, every single-window tape booting at L0 (80, 128) would continue over the first frame
without its declaration. Measured: the Phase B boot-path row reds. The liberty keeps every first window exactly Phase
B's fresh boot.

### `botJsLatch`, a new JS-only verb

The game has no `botJsLatch`; its latch is `botSeam`, an LFSR-and-seam envelope this model does not keep.
`botJsLatch` returns `director.jsLiveEnvelope(run, chain boot persistence, pins)`, the same function the page walk
reads its own run with.

### A halted run is rebuilt

A halted run cannot continue, so it is rebuilt, and the boot note says so.

## 2. The lab chains windows: lab-file edits, for `seedling-lab-planning-1`

### `watchWasm.js`
- The `PHASE B` docblock gains a `seedling-js-replay-continuation` paragraph.
- `stagesOf`: a JS replay with `windows > 1` gets the sequence list. Its head is unchanged.
- `state.hold` for a JS replay of N > 1 windows is `{capable: true, why: 'the JS core models hold …'}`. Single-window values are unchanged.
- **The `js-sequence-unsupported` refusal is removed.**
- The boundary reads the live world from the frame's `botJsLatch` for JS and from `botSeam` → `segmentBootFromLatch` for wasm. The wasm path is unchanged.
- A JS continuation window (`k > 0`) ships `gameVisibleTape(wTape)`, not `continuationTape(wTape).tape`, with `tick0Applied: null`.
  - Why: the tick-0 write is a game-side latch that the JS model never applies (`walkSequence` docblock).
  - **Measured:** shipping `continuationTape` to the JS frame moves the adopted clock, and `r9-solve-18` (L18's hammer) parts from the model at tick 63 (dx −2.53, dy −2.77).

### `watchViewer.js`
- `runJsSequence` stashes its admitted walk (`jsSequenceWalk`).
- `replayJsShipFor` gives a `?tapes=` sequence `replayJsSequenceShip()`. It builds the same payload `runWasmSequence` builds (`windows: perWindow`, the whole model stream), with the note *"REPLAY of the sequence in the JS frame, on ONE run — each window's per-tick verdict is the JS frame against the JS model (not the real game)"*.
- `wireShipButton` resets the stash.

### `watchWasmJs.test.js`
The sequence-refusal row is replaced by a sequence-chains row (below).

## 3. The pins and the mutant

### No-tape identity
`noTapeChain` is byte-identical: `{chain: '0d022900a706b10a780bf029f08a', rows: 224, walk: 'done'}`. The constant is unedited, and both rows are green.

### Single-window identity
- Slow tier: **293 of 293** committed tapes, 0 findings.
- Every existing `jsRuntimeTape.test.js` row passes. The one exception is the `hold` row: it was a refusal pin and now pins that a `hold` tape plays and holds.

### New: `jsRuntimeContinuation.test.js` (8 rows)
- **`toy-west-pair` (2 windows) and `r8-d2` (3)**, shipped as the lab ships them, with a 40-frame gap between windows. The row checks:
  - every window after the first CONTINUES the same run object, and the gap steps 0 frames;
  - every window's drain agrees **per tick** with the model walk (`jsRuntimeSequence.walkChainModel`, `walkSequence`'s loop);
  - at every held window end, the run's `stateDigest` and `ticksCompleted` equal the model walk's, built the core's way (`scratchPersistence`);
  - the last window is one live step on (`Bot.as:3330-3333`).
- **Edges:**
  - window 1 over the first frame rebuilds;
  - a boot elsewhere rebuilds;
  - a host teleport ends the chain;
  - hold blocks steps until `botStart`, `botLoadTape` does not release it, and the drain base is cleared;
  - `botLoadLevels` releases the hold.

### Slow tier: the r9 campaign
**`r9-campaign`, 30 windows** (10,572 ticks) on one JS run gives 0 findings. That covers continuation, hold, per-tick agreement, and the held-end digest and tick count.

### The mutant
The mutant is a patched copy of the core with `continues = false`, so it always rebuilds. It is built and imported by the test itself.
- **RED** on both chains: "did not continue", plus a `ticksCompleted` or state-digest finding.
- Its positions **do not** red. That is a finding in its own right: these chains are built so that a fresh boot of a window equals its continuation (⚖ 23). So the drain is not the witness; the run is. The row asserts the 0 position diffs out loud.

### Measured on the way
- Against the lab's own model (`collectRun` default, no scratch), the campaign's run digests part from window 8 (`r8-solve-8`) while every position agrees.
- Against a walk built on `scratchPersistence`, all 29 held ends match.
- So the digest difference is Phase B's scratch-on choice for tape boots, which is already documented. It is not a continuation defect.

## 4. The sequence verdicts, and wasm vs JS

**JS frame vs JS model** (node and browser):

| Sequence | Windows | Per window | Where measured |
|---|---|---|---|
| `toy-west-pair` | 2 | 62 + 49 obs, both agree; whole 110 agrees | node, `watchWasmJs`, Chromium lab check |
| `r8-d2` | 3 | 468 / 747 / 561 obs, all agree | node |
| `r9-campaign` | 30 | 30 / 30 agree | node (slow tier) |

**Wasm vs JS** (`probe-seedling-js-vs-wasm-tape.mjs --chain=<id>`, new):
- Setup: headless `HEADLESS_WEBGPU_ARGS`, `seedling_bot_ap_p4g` (declares `hold`).
- On one page per side, each window is shipped with that transport's lab projection, and keys are released at each boundary.

| Chain | Result |
|---|---|
| `toy-west-pair` | **2/2 windows AGREE at every tick** (L94 (296,168) → L0 (24,136)) |
| `r8-d2` | **3/3 AGREE at every tick** (L19 → L20 → L13 (104,56)) |
| `r9-campaign` | **30/30 AGREE at every tick** (L2 … L32). Every JS window after the first `continued`; every window except the last `held=true` on both sides. |

- The one number that differs is the **last** window's live `botStatus` y after `finished`: wasm 81.05, JS 80.75.
- This is the post-finish coast that `END_STATE_TOLERANCE`'s docblock describes (`botStatus` is a live read of a frame that goes on simulating). The drained streams agree.
- No fidelity finding from these three.

## 5. Gates and bounded counts (⚖ ruling 52: no unfiltered local vitest)

- `npx vitest run` over the 42 non-slow `seedlingDemo/jsRuntime*.test.js` and `seedlingDemo/watch*.test.js`, plus `scripts/procgen/boxLock.test.js` and `frontend/modules/procgenDocs/`: **51 files, 1644 tests, all passed.**
- `npx vitest run --config vitest.slow.config.js …/jsRuntimeTape.slow.test.js`: **1 file, 2 tests, passed.** The 293 tapes give 0 findings, and `r9-campaign` (30 windows) gives 0 findings.
- `node scripts/procgen/check-seedling-lab-load-in-js.mjs` (the cloud's Chromium): **ALL CHECKS PASSED (41)**.
  - New SEQUENCE case: `?tapes=toy-west-pair`.
  - S1: the 13 sequence stages arrive in order, and the note names the JS model.
  - S2: window 1 is `heldAtFinish`, and window 2 is admitted on the frame's latch (L94 at (288,160)). The frame's boot notes read `[first frame, tape r7-ends-meet-1 (botStart), continued]`.
  - S3: `agrees per tick (62)`, `(49)`, whole `(110)`, and the drain is 110/110.
  - Sound and live keys work after the last window.
- Generated reference: `instruments.js` regenerated (the probe's new `--chain` flag). `--check` reports **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE**. bulletml-dodge was initialised first, as the brief said.
- CI (JSUT and unittests) runs on push. The coordinator reads it by SHA and dispatches TT and the probe battery.

## 6. Files

- `frontend/modules/seedlingDemo/jsRuntimeCore.js`: the rebuild rule, continuation, hold, `botJsLatch`, `held`.
- `frontend/modules/seedlingDemo/jsRuntimeSequence.js` (new): `walkChainModel`, `playChainOnJsCore` and `jsWindowTape`. These are the node sequence driver that the pins, the slow sweep and the probe share.
- `frontend/modules/seedlingDemo/jsRuntimeContinuation.test.js` (new). Also edited: `jsRuntimeTape.test.js` (the hold row), `jsRuntimeTape.slow.test.js` (+ the campaign) and `watchWasmJs.test.js`.
- The lab: `watchWasm.js` and `watchViewer.js` (§2).
- `scripts/procgen/check-seedling-lab-load-in-js.mjs` (+ SEQUENCE) and `scripts/procgen/probe-seedling-js-vs-wasm-tape.mjs` (+ `--chain=`).
- `frontend/modules/procgenDocs/generated/instruments.js` (regenerated).

## STOPPED

Nothing.

## Residue

- **The bounded liberty above.** A tape at the game's first frame, or at a host-teleported room, rebuilds in JS but not in the game. If a caller ever needs the game's exact behaviour there, it needs a ruling. Today only the sequence tail continues, and its first window is meant to be fresh.
- **A continuation window's `grants`/`despawn` are not applied**, exactly as in the model walk (the resume face applies only the clock, plus the walk's forward clears and equips). The game's `applyGrantsFor` does run per window. No committed chain trips this (30/30 agree), but it is a model-side gap rather than a frame one.
- **`continuationFindings` on a JS window reads no `dead_frames`**: the JS `botStatus` has none. It reports that by name (informational), not as a refusal.

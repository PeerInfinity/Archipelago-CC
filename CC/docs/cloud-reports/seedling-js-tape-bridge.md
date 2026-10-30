# Cloud report — `seedling-js-tape-bridge` (lab Phase B: tape replay in the JS frame)

Coordinator: `seedling-js-planning-13`. Lab-file edits are listed for `seedling-lab-planning-1`.
Branch: `claude/seedling-js-tape-bridge-ndn5n8` (the harness pins it). Base: `origin/main` `9c0f9045`. Code commit: `5e5e8c76`; this report is the last commit.

**Outcome: built. Nothing STOPPED.** The walker's tick contract carries a tape without changing any
walker-visible field, and `boot()` is shared.

## What landed

### 1. The tape verbs on the JS core — `frontend/modules/seedlingDemo/jsRuntimeCore.js`

| Verb | Bot.as lines | JS behaviour |
|---|---|---|
| `botLoadTape(json)` | `:912-1636` (version gate `:921-924`; load disarms and clears the buffer `:1610-1628`) | `JSON.parse`, then the SAME version gate and string (`error:tape_version must be 1, 2, 3, 4, 5, 6, 7, 8 or 12, got N`), then `parseTape` (its refusals stand in for the field checks), then `stagingFromTape`. A `hold` tape is refused by name (`JS_TAPE_REFUSALS.hold`: the JS runtime has no `hold` capability). Returns `'ok'` / `'error:…'`. |
| `botStart()` | `:1658-1937` (persistence and save reset `:1708-1772`; rebuild only off the boot `:1843-1846`; arm `:1884-1890`) | `error:no tape loaded` / `error:already running`, the game's own strings. It boots through the **same `boot()`**, which takes a new `declared` staging: the tape's own declaration, with no session merge. This matches ruling 25's fresh start plus what the tape declares. ⚠ It **always** rebuilds: the JS frame has no continuation path. |
| armed tick | `:3148`, `:3232-3335` (record then act; disarm at `tick_count` without spending a tick) | `tapeRecordThenAct(run)`: push the observation, then `heldKeysAt(tape, tick)`. On the finishing tick it returns null and the frame carries on as an ordinary one. That matches the game, where `Main.update` still runs `super.update()` after the bot hook returns. |
| `botStatus()` | `:2027-2069` | Gains `loaded`, `armed`, `finished`, `error`, `tick`, `tick_count`, `buffered`, and `items`. `items` is `itemReadout`'s fourteen (`:2690`): the run's live inventory, or the host's flags when no run exists. Every field that was already there is unchanged. |
| `botDrain()` | `:2870-2886` | `{ticks: [{t: base+i, x, y, level}], transitions: []}`. The buffer is cleared and the base is kept. This is the vocabulary `gameStreamFromDrain` / `diffObservationStreams` already eat, reused rather than re-spelled. |

On a tape tick the walker is **not asked** (`heldFor`), **not told** (`observe`), and solver holds do not apply.
There is no ceremony auto-advance, which `runTape` does not add either. An item delivery's in-place reboot waits
while a tape is armed and lands on the first tick after it finishes. If the model halts mid-tape, the tape
finishes with `error: 'error:the JS model halted — …'`, so the lab's poll cannot hang.

Two choices in the session build, both measured rather than assumed:

- **`declared`** (new option on `watchManual.createManualSession`). The tape's staging runs **as declared**, without
  `solveStaging`; this is `runTape`'s own construction. Without it, ~90 committed relaxed tapes (noclip, noDamage,
  despawn) would play a different world from the model's. `fold()` refuses such a session by name: it is a replay,
  not a producer, so the one-construction law still holds for every tape a manual drive writes.
- **`scratchPersistence` stays ON for a tape boot.** The frame receives the game-visible projection, and
  `gameVisibleTape` drops v9's kill-lock `at` rows, so the frame has to compute those clears itself, as the game
  does. Measured with it off: 14 committed kill-lock tapes halted ("OPENS 1 kill lock … DECLARES no clear"). With it
  on, all of them agree.

### 2. The lab — **lab-file edits, for `seedling-lab-planning-1`** (kept minimal)

- `watchWasm.js`
  - The `PHASE A ONLY` docblock is replaced by a `PHASE B` one.
  - New `JS_REPLAY_STAGES` = `probe runtime start [levels] tape running finished drain verdict`.
  - `stagesOf({transport:'js', replay})` returns that list for a replay.
  - In `shipToFrame`:
    - a payload's `replay: true` sends a JS ship down the **unchanged wasm tail**;
    - a JS replay of more than one window refuses with `js-sequence-unsupported`;
    - `state.hold` for a JS replay is `{capable: false, why: 'the JS runtime declares no hold'}`, because the tail reads it. A source pin keeps the `state.hold.capable` line byte-identical.
  - The running line now says `running in the JS game` for a JS replay.
  - `verdictBlock(v, note, who = 'wasm')` takes the subject name. Its default output is unchanged.
- `watchViewer.js`
  - REPLAY's `replayJsShipFor` builds the wasm replay's payload: the tape, plus `collectRun`'s model stream and end state, plus `replay: true`. Its note now reads *"REPLAY of the tape in the JS frame — the per-tick verdict is the JS frame against the JS model (not the real game)"*.
  - The panel heading reads `THE JS GAME — tape replay`.
  - `shipReadout.onVerdict` paints a JS replay's verdict as `js frame verdict: …`. A live JS ship still paints none.
- **Other arms are unchanged.** SOLVE, MANUAL, GENERATE and EDIT still ship a spot for live play (`spot → play`).

### 3. Tests, gates and probe

- `frontend/modules/seedlingDemo/jsRuntimeTape.test.js` (new, 9 rows): the identity pin, tape plays, the boot-path
  row, the refusals, and a relaxed tape played as declared.
- `frontend/modules/seedlingDemo/jsRuntimeTape.slow.test.js` (new, slow tier): every committed tape, JS frame vs
  JS model, per tick.
- `frontend/modules/seedlingDemo/watchWasmJs.test.js` (+3 rows): `shipToJs` with `replay: true` over a fake frame
  whose game is the **real** JS core. It reaches `verdict` with per-tick `agrees`. It also covers the sequence
  refusal and the live list being unchanged.
- `scripts/procgen/check-seedling-lab-load-in-js.mjs`: the REPLAY case now asserts R1–R3 (see its header). The
  generated and vanilla cases are unchanged.
- `scripts/procgen/probe-seedling-js-vs-wasm-tape.mjs` (new probe, not a gate): one tape, run the same way on
  `jsRuntime.html` and the default wasm build, with the two drains diffed. It is registered in `boxLock.test.js`'s
  guarded roster. It is not in the CI gate plan; the lab check isn't either.
- Generated reference: `instruments.js`, `architecture.md` § procgen-instruments and `urlGrammar.js` (a line moved
  in `watchManual.js`). `--check` reports **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE**.
  - ⚠ Cloud note: `session_bootstrap.sh --seedling` does not init `frontend/modules/bulletml-dodge`. Without it,
    `--write` silently drops the `noiz2sa` registry entry (−887 lines in `registry.js`). I initialised the
    submodule and regenerated; nothing from the bad run was committed.

## The identity pin and the mutant

- **The pin.** `noTapeChain` runs `configure` → `setVanilla` (the game's own first frame) → a 66-tick keyboard
  leg → the walker's walk to the L0 stairs, to `DONE`. Each tick it hashes `canonicalDigestText` of:
  - `run.stateDigest()`,
  - the **pre-Phase-B** `botStatus` fields,
  - the walker state,
  - the host reports.
- **Measured on the pre-Phase-B core** (`git show 9c0f9045:…/jsRuntimeCore.js`, loaded beside the new one):
  `{chain: '0d022900a706b10a780bf029f08a', rows: 224, walk: 'done'}`. The new core gives the identical value, and
  the value is pinned as a constant.
- **Second leg:** a tape *loaded but never started* gives the same chain.
- **The mutant.** In `tickOnce`, changing `tape.armed ? tapeRecordThenAct(run) : null` to
  `tape.loaded ? …` makes tape inputs leak into the no-tape path. Result: **RED**, 2 rows (the loaded-but-not-started
  chain, and "after finished the keyboard drives again"). The other 6 rows stayed green. Restored, and verified green.
- **Walker paths did not move.** Every `jsRuntime*` suite is green, including `jsRuntimeWalker`,
  `jsRuntimeVanillaDelivery`, `jsRuntimeLongPlanWalk` and `jsRuntimeGameSpeed`'s per-tick `stateDigest` pins.

## The vanilla-room per-tick verdict (JS frame vs JS model)

- **Node:** `collide-up-rock` (L0, 45 ticks) and `cross-level-leg` (257 ticks, crosses levels) agree with `runTape`
  at every tick (`diffObservationStreams` → null), `finished` at `tick_count`, with `tick_count + 1` observations.
- **Whole roster (slow tier):** **293 of 293** parseable committed tapes load, finish without error, and agree at
  every tick (~43 s).
- **Browser (the cloud's Chromium), `check-seedling-lab-load-in-js.mjs`: ALL CHECKS PASSED (29 checks).**
  - The REPLAY case ships `r8-solve-1` (L2, 183 ticks) through the lab.
  - The stages are `probe → runtime → start → tape → running → finished → drain → verdict`.
  - The frame finished at `183/183` and drained 184 observations.
  - The verdict reads **`js frame verdict: agrees per tick (184 observations)`**.
  - After the tape the frame goes on live: keys and the touch d-pad move the player.

## The wasm vs JS comparison (run the same way, same tape)

`probe-seedling-js-vs-wasm-tape.mjs`, headless `HEADLESS_WEBGPU_ARGS`, build `seedling_bot_ap_p4g`:

| Tape | Ticks | wasm | JS | Diff |
|---|---|---|---|---|
| `collide-up-rock` | 45 | 46 obs, L0 (88, 130.05) | 46 obs, L0 (88, 130.05) | **AGREE at every tick** |
| `r8-solve-1` | 183 | 184 obs, L2 (56, 40) | 184 obs, L2 (56, 40) | **AGREE at every tick** |
| `cross-level-leg` | 257 | 258 obs, L0 (24, 136) | 258 obs, L0 (24, 136) | **AGREE at every tick** |

No mismatch was found, so there is nothing for the fidelity arc from these three.

## Bounded counts (⚖ ruling 52 — no unfiltered local vitest)

- `npx vitest run` over every `seedlingDemo/jsRuntime*.test.js` and `seedlingDemo/watch*.test.js` (slow excluded),
  plus `scripts/procgen/boxLock.test.js` and `procgenDocs/*.test.js`: **50 files, 1635 tests, all passed.**
- `npx vitest run --config vitest.slow.config.js frontend/modules/seedlingDemo/jsRuntimeTape.slow.test.js`:
  **1 file, 1 test, passed** (293 tapes, 0 findings).
- The suite number comes from CI at the pushed SHA (JSUT + unittests), read by the coordinator.

## STOPPED

Nothing. Limits respected: no `vendor/seedling`, wasm, flashPanel, solver or `levelRun` edit, and no
`jsRuntimePage.js` edit. The page needed none: `start()` copies `runtime.game`'s verbs onto the bridge, and its fade
slots are dead frames, as the game's `blackCover` frames are.

## Residue

- The JS frame refuses a multi-window JS replay (`js-sequence-unsupported`). A continuation needs the JS core to
  read and apply a latch instead of rebuilding. That would be a js-arc slice of its own.
- `hold` (v12) is refused by name on the JS core.

## Local finish

Slice `seedling-js-tape-bridge-pin` (local, launched by `seedling-js-planning-13`). Worktree base:
`git merge-base HEAD origin/claude/seedling-js-tape-bridge-ndn5n8` → `abd96e36a26b340a91eaf3fa79c84306906b84dc`.
There is no core or lab-code edit: the planner's reading, that a tape tick takes no live input by construction, now has pins.

- **Unit pin** (`jsRuntimeTape.test.js`, row 4, `slots-l24-fire-first`). The tape has two items and `firstUse`, so the V menu is
  openable on most of its ticks. It plays with arrows, X, C, V and I fed into every tape tick. The pin requires all of
  the following against the same tape with no live keys:
  - the drain (`botDrain` text) is byte-identical;
  - the `stateDigest`, slots and `primary` are equal;
  - the menu never opens;
  - no `inventory` events.

  The finishing frame is a live frame (`Bot.as:3330-3333`), so both legs feed it nothing. The last tape tick carries
  no toggle, because a V held into that frame is released on it, which is a live-frame edge.
  - Mutant M1, the step on `held` instead of `tapeHeld`: **RED**, 4 rows (this one, both drain-vs-model rows, and the
    relaxed tape).
  - Mutant M2, `menuLiveTail` also on a tape tick: **RED**, this row only (the noisy replay ends on L24, the quiet one
    on L12).
  - Restored: green.
- **`#jsTouch` on a replay ship: kept mounted, no lab change.** Its taps are `KeyboardEvent`s dispatched on the frame's
  canvas (`flashPanel/gameInput.js:67-73` `dispatchGameKey`). They bubble to the JS page's document `keydown`/`keyup`
  (`jsRuntimePage.js:499-500`), into the same `down` set the keyboard fills. That set reaches the core only through
  `runtime.tick(heldFromCodes(down))` (`jsRuntimePage.js:542`), which is exactly the input the unit pin feeds.
- **Browser assert, R4** (`check-seedling-lab-load-in-js.mjs`, REPLAY case). A key (left, X, V) and a d-pad tap go in
  mid-replay, with the tape armed before and after. The test waits by tick, not time: CI measured `tick 0→0` over a
  fixed 300 ms, because `running` is reached before the first tape tick. R3's verdict still reads `agrees per tick
  (184 observations)`. Local result: ALL CHECKS PASSED (30).
- **Re-merge** of `origin/main` `c32c924748` (render-fixes landed): clean, with no conflicts. `generate-procgen-reference
  --check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE. The `boxLock.test.js` rows auto-merged.
- **Gates at `733e147fb7`:**
  - JSUT `41098904625`: success.
    - `seedling-editor-manual | 63/0`
    - `seedling-editor-switch | 62/0`
    - `seedling-lab-load-in-js | 30/0`
    - `seedling-lab-art | 63/0`
  - unittests `41098904676`: success.
- **Gates at `33ee232e6f`** (the same core and lab code; only the check script moved after it):
  - TT `41091467987`: success.
  - `seedling-probe.yml battery=standard` `41091486052`: success, 11 probes.
  - `seedling-wasm-ship | 415/0`. It was path-filtered at the tip.
- Bounded vitest (the tape, `watchWasmJs`, inventory menu, `boxLock`, `procgenDocs`): 12 files, 552 tests, all passed.

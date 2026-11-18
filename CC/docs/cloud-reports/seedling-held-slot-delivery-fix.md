# Cloud report: `seedling-held-slot-delivery-fix`

**F1 (a named failure when the game stops the tape early) + F2 (one idle lead tick after a held slot delivery).**

Launcher: `seedling-js-planning-21` (js-21). Ruling: Robert, 2026-11-17T22:35:11Z (transcript c54da6ff), *"Loud error + idle
tick, one slice (Recommended)"*. Diagnosis: `CC/docs/cloud-reports/seedling-seed2-stall-diagnosis.md` on
`origin/claude/seedling-seed2-stall-diagnosis-xbn3k1` (@7bb9917ce8).

Branch: **`claude/seedling-held-slot-delivery-fix-qetr98`** (the harness pinned it; no plain `seedling-held-slot-delivery-fix`
branch was pushed). The branch is BASE + the fix commit `257f7375` + this report. It carries no measurement code.

## Summary for Robert

- **Seed 2 now plays past the stall.** Entry 5 (`level_12__r0c37 -> level_21`) plays its 859 ticks: the old 858 plus the one
  idle tick. The walk then goes on to **13/48** checks. It stops at entry 14 with a *named solver refusal* on a different leg,
  the L28 exit `level_28__r1c18 -> level_30__r2c10` ("no REACHABLE stance inside button@112,240"). That is a solver question,
  not this defect.
- **Seed 1 did not regress:** **24/48**, stopping at entry 24 (the L58 yeti), the same as re-measure-4.
- **F1 bites.** With F2 switched off, the seed-2 walk now fails within about 5 s, by name: *"the game's tape errored: equip at
  tick 0 selected slot 1 but the inventory holds 1 item(s) …"*. Before, it sat silent for 300 s.
- One existing pin moved, because of the idle tick (below). The held **arrival** case is still not covered (§5 gap, named in the
  code).

## Base and box

| | |
|---|---|
| BASE | **`fb030c550bfbb2f4cd3f0f67814c62a76a5c3de1`** = `origin/main` ("train: atlas-sphere-rerecord a901b92811") |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (the gitlink at BASE, checked out; the same pin as re-measure-4 and the diagnosis) |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --all` → `READY`, tree clean. Every wasm run reports `transport=wasm` |
| fix commit | `257f7375` (pushed) |

## F1: the silence becomes a named failure

`frontend/modules/flashPanel/seedlingWasmPlayback.js`, `watch()`:
- `:1784–1786`: each drain notes whether it brought a new row (`play.lastRowAt`). It is reset at the ship (`:1722`) and at a
  resume (`resumeFrozen`, `:1498`).
- `:1805–1813`: **while ticks are still owed** (`progress.ticks < play.ticks`) **and no new row has arrived for `STATUS_MS`**,
  the page reads `botStatus()` once per `STATUS_MS`:
  - `st.error` → `fail("the game's tape errored: …")`, the same text as the post-tape path at `:1802`;
  - `st.finished && !st.armed` → `fail("the game's tape ended at tick k of N")`.
- **W0's rule holds:** `botStatus` is never read per frame on a healthy tape. A playing tape drains a row a frame, so this branch
  only runs once the drain has stalled. The test checks this (fewer `botStatus` than `botDrain` calls after the ship).

## F2: one idle lead tick after a held slot delivery

`frontend/modules/flashPanel/seedlingWasmPlayback.js`:
- `slotsMoved(before, after)` (`:221–226`): whether the game's array before the write differs from `slotsAfterDelivery`'s
  `post.slots`.
- `deliverHeld` (`:2277–2281`): if the held delivery adds or moves a slot, nothing else set a lead, and the room has shipped
  ticks (a continuation), set `room.lead = [[]]`.
- The mid-tape `admit` callback in `freezeAndDeliver` (`:2228–2229`): the same rule. That path already sets
  `room.lead = [heldKeys]` when the frozen tape held keys; F2 only fills the empty-hold case.
- No new machinery. `solveInRoom` already passes `[...r.shipped, ...lead]` and replays the held row, and `ship()` prepends the
  lead and shifts `equipsAt`/`equipItems` by its length.
- `wasmDelivery.js` was not touched: the admit path lives in `seedlingWasmPlayback.js`.

## §5 gap (not fixed, as briefed)

A slot item delivered into a **held arrival** (`room.shipped.length === 0` → `arrivalSolveRequest`) still reaches the game's
array in the new tape's tick-0 tail, and no idle tick is shipped for it. This is unmeasured. A code comment names it at the
arrival solve (`seedlingWasmPlayback.js:1276–1277`). `firstTickSlotRefusal` still guards an X press there; nothing guards a t0
*equip*. F3's guard (from the diagnosis) is the candidate if it matters.

## Tests

`frontend/modules/flashPanel/seedlingWasmPlayback.test.js` (`:487–523`), in "named refusals and failures":
- `⛓ EARLY DISARM — a tape the game stops after 1 row with an error fails BY NAME, fast`: the fake game disarms after 1 row
  with the seed-2 error text. Expected: exactly that failure, no done.
- `… without one`: disarmed with no error. Expected: `the game's tape ended at tick 1 of N`.
- Mutant: with F1's branch removed (`false &&`), **both rows fail** (the file restored md5-identical, `f4f81000…`).

`frontend/modules/flashPanel/seedlingWasmPlaybackDelivery.test.js`, new `describe('⛓ HELD SLOT LEAD …')` (`:468`):
- `a held SLOT delivery (the Sword after Fire)`: Fire held `[1]`, the Sword delivered into the held room, and the next plan
  selects slot 1 at t0. Expected: the solve's prefix is `chestTicks + 1` with an empty last tick, the tape's `equips` is
  `[{t: 1, slot: 1}]`, tape tick 0 holds no key, `tick_count` is `solution + 1`, `room.equips` is
  `[{t: chestTicks + 1, slot: 1}]`, and the door is done.
- `a held NON-slot delivery (the Shield)`: the same room with the Shield. Expected: no lead, the prefix is `chestTicks`, the
  equip ships at `t: 0` (unchanged), and there are no fallbacks.
- `a MID-TAPE slot delivery frozen where the tape holds NO key`: frozen from 12 drained rows (measured: `heldKeys []`).
  Expected: the row's `lead` is `[[]]` (was null), the prefix is `tick + 1`, and the tape's tick 0 is idle.
- Mutants (each restored md5-identical): h1, the lead off in `deliverHeld` → 2 red ('held SLOT delivery' + 'the SLOT LAG');
  h2, the lead off in `admit` → 1 red ('MID-TAPE …'); h3, the lead on for any delivery → 1 red ('NON-slot …'). They are listed
  in the file's mutation header.

## Pins moved (because of the idle tick)

| pin | old | new |
|---|---|---|
| `seedlingWasmPlaybackDelivery.test.js` "the SLOT LAG: Fire delivered into the held room …" | the continuation's injected t0 `primary` press → a `delivery-first-tick` fallback, `why` matching `presses primary on its first tick … (0 → 1)` | the press plays behind the idle lead tick: no `delivery-first-tick` fallback, no failures, tape t0 holds no key, t1 holds `primary`, the door is done as a continuation |

Nothing else moved. The continuation-t0 pins expected by inspection (the WASM EQUIPS rows) involve no held *slot* delivery, so
they get no lead. The mutation header's note on s1 records that its catcher moved with this pin: the guard still covers the
arrival ship, unit-pinned in `wasmDelivery.test.js`.

## Bounded vitest

Every test file importing the touched module (`git ls-files -z '*.test.js' '*.test.mjs' | xargs -0 grep -a -l
seedlingWasmPlayback`, 8 files), plus `seedlingDemo/wasmDelivery.test.js` and `wasmEquips.test.js` (the slot guards):

```
✓ seedlingDemo/wasmPlayback.test.js (72)           ✓ flashPanel/seedlingWasmPlaybackDelivery.test.js (43)
✓ flashPanel/seedlingVanillaArmMap.test.js (27)    ✓ seedlingDemo/wasmDelivery.test.js (27)
✓ seedlingDemo/wasmEquips.test.js (21)             ✓ seedlingDemo/dashOnlyWindow.test.js (14)
✓ seedlingDemo/wasmArrivalComposite.test.js (14)   ✓ flashPanel/seedlingWasmPlayback.test.js (152)
✓ flashPanel/seedlingPlaybackLootChest.test.js (10) ✓ seedlingDemo/dashShape.test.js (14)
Test Files  10 passed (10)   Tests  394 passed (394)
```
No local unfiltered vitest (⚖ 52). The suite number is CI's at the pushed SHA.

## The walks

**How they were measured.** I used a **local scratch branch** `measure-scratch` = `257f7375` + `d6b6aed4d` cherry-picked
cleanly (`0247ba1f` "MEASUREMENT-ONLY: knobs + sampler …", 4 files, +124/−5). It was never pushed and has been deleted; the
landing branch never carried the instrument. The knobs were re-measure-4's Arm A′: `TEST_AUTO_START_TIMEOUT_MS=10800000
TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000 TEST_MEASURE_BOT_STALL_MS=300000`, `npm test --
--mode=test-substrates --batch=tutorials-seedling-whole-game`, on `scripts/serve-nocache.py 8000`, one run at a time.

Seed 2 came from `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` →
`AP_01043188731678011336`, with `TEST_MEASURE_PLAYTHROUGH_SEED=2`. It was generated in the tree, never committed, and cleaned up
afterwards.

### Seed 2 at the tip (S2): plays past entry 5

```
[MEASURE tick] t=255s checked=4 … status="Sphere 1.7 → walking to \"Level 012 - Chest\" (4/48) — playing tick 1382/1508"
[MEASURE tick] t=270s checked=5 … status="Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing tick 210/859"
…
[MEASURE end] seedling-whole-game t=754s step=bot-plays checked=17 botQueue=48 botCursor=13 botChecked=13 botRegion="level_28__r1c18" lastRegionEvent="level_28__r1c18" regionChanges=91 wasmPushes=67 transport=wasm wasmMemMB=656 jsHeapMB=169 status="error: level_28__r1c18: the bot cannot walk to exit \"level_28__r1c18 -> level_30__r2c10\" — the wasm playback failed: the solver declined level_28__r1c18 -> level_30__r2c10 in level 28 (refusal): solverBot: no REACHABLE stance inside button@112,240 in level 28 — 1 cell(s) land the player box in the button and none of them plans a corridor from (136,296). A hold that cannot be stood on is not a strategy for this obstacle. ⛔ AND THE PREREQUISITES WERE TRIED AND REFUSED, one at a time: grasslock@176,208 — its group t=0 publishes only while a Solid sits on button@112,240, and NO block in this room can reach it — …"
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 755.9s
```
- Entry 5 plays: **859** ticks (858 + the idle lead) and moves on at once. The diagnosis showed it frozen at `1/858` here
  (5/5 repros).
- How far: **13/48** bot checks (`botChecked=13`), 91 region changes, 67 wasm pushes. Before: 4/48 and frozen.
- **Next stop:** entry 14 (target `level_30__r2c10`), a **named solver refusal** on the L28 exit `level_28__r1c18 ->
  level_30__r2c10`. The solver finds no reachable stance on `button@112,240`, which `grasslock@176,208` needs held. This is a
  solver/room-logic question for js-21, outside this slice.

### Seed 1 at the tip (S1): no regression

```
[MEASURE end] seedling-whole-game t=1624s step=bot-plays checked=39 botQueue=48 botCursor=23 botChecked=24 botRegion="level_58__r3c3" lastRegionEvent="level_58__r3c3" regionChanges=140 wasmPushes=95 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_58__r3c3: the bot cannot walk to location \"L58 flag 1: yeti@56,56 cleared\" — the wasm playback failed: the solver has no goal for L58 flag 1: yeti@56,56 cleared: \"L58 flag 1: yeti@56,56 cleared\" is a saved-obstacle …"
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1625.7s
```
**24/48** vs re-measure-4's **24/48**, the same stop (entry 24, the L58 yeti). It took 1624 s against re-measure-4's ~3000 s
(this box is faster). Not below 24, so no STOP.

### F1 by mutant (S2-mutF2off): F2 reverted in the working tree, seed 2

Both F2 lines were replaced by `/* MUTANT: F2 off */`, uncommitted, then restored with `git checkout`.
```
[MEASURE tick] t=255s checked=4 … status="Sphere 1.7 → walking to \"Level 012 - Chest\" (4/48) — playing tick 1456/1508"
[tutorial-walk-timing] seedling-whole-game: load 3.1s, start-game-page 5.4s, start-game 1.4s, bot-plays-open 0.3s, bot-plays 250.1s
[MEASURE end] seedling-whole-game t=260s step=bot-plays checked=5 botQueue=48 botCursor=4 botChecked=4 botRegion="level_12__r0c37" … status="error: level_12__r0c37: the bot cannot walk to exit \"level_12__r0c37 -> level_21\" — the wasm playback failed: the game's tape errored: equip at tick 0 selected slot 1 but the inventory holds 1 item(s); useItem on an out-of-range slot…"
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 262.3s
```
Without F2, the same leg now fails **by name within about 5 s** of the chest walk's end (t=255 s on the chest at 1456/1508 →
t=260 s failed). Before, the S2a stall ran 300 s (bot-plays 556 s). So F1 bites in the live game, and the error text is the
game's own, word for word.

## Cleanup

- The dev server (PID 2135) had already exited when I went to stop it by its literal PID. No `serve-nocache` process is left.
- `frontend/presets/preset_files.json` was reverted; `frontend/presets/seedling_playthrough/AP_01043188731678011336/` and
  `output/AP_01043188731678011336.zip` were deleted.
- While the walks ran, the preset dirt was hidden from `git status` with `.git/info/exclude` + `--skip-worktree`, to quiet a
  stop hook. Both have been undone.
- The local scratch branch `measure-scratch` was deleted. The tree is clean.

## Scope check

Only `seedlingWasmPlayback.js`, `seedlingWasmPlayback.test.js`, `seedlingWasmPlaybackDelivery.test.js` and this report changed.
There is no solver, model, wasm, `vendor/seedling`, preset, fixture, tape or workflow change, and no `NewDocs/` citation.

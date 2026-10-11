# Seedling fidelity ENCOUNTERS2: the live Bob Boss divergence is the panel's write, and a pickup's item lands a frame late

**Slice:** `seedling-fidelity-encounters2`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-5`), wave 10b (a fix slice after wave 10).

| | |
|---|---|
| Started from | **`99cdf5ce23`** (main after wave 10 `d978c76322` + the rules arc's F3; not rebased) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-encounters-fidelity-tq5nbk` (the harness branch IS the slice branch) |
| Commits | D1+D2 `97c73bc` · D3 `1d5f468` · reference `aded1ef` · this report |
| Dev server | `serve-nocache.py 9550` (this tree); the JS arc's branch in a read-only worktree on 9551; W0 in a pristine worktree on 9552 |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (no model change needed) · D3 PASS (measured, fixed behind a switch) / STOP on the default flip** |

## The one thing to know first

**Both live symptoms come from the panel's own clearing write, not the model.** `flashBridgeAdapter._itemWritesFor` writes `false` to every location-mapped property that no owned item backs. While the delivery gate holds an encounter's AP item back, that is `hasFire = false` (L32) and `hasDarkSword = false` (L12), written into the game after the game granted it. Replaying the live arrival's plan on the game with that one write queued at t840 reproduces CI's Bob Boss divergence **to the bit** (t932, y 34.24584332605449). Without it, the same plan is 0 px over 1,050 observations. This is the JS arc's to fix (the evidence is below).

Separately, D3 found a real model defect that no stream could see: **a special pickup's item flag lands one frame after its ceremony closes**, on every pickup measured. It is fixed behind `PICKUP_REMOVED_NEXT_FRAME` (OFF). The default flip is a STOP: ON moves one recorded stream (`r8-solve-10`) and three producers.

## W0 (at `99cdf5ce23`, a pristine detached worktree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9552 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `006b0639…`/`7d4cb820…`/`49e23d85…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`, generated set `OK`; reference `4 … DIFFER` (this container's uninitialised substrate submodules). Log md5 `0d927f7161962ca3aa2fba0f548d9a54` |
| six producers | the block's loop | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `b064c264`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`; md5 over the sorted `fullName\tstatus\n` lines | **589**, md5 **`8cb21cd9950584e5bd35e8b3b36490d4`**, 0 non-pass |
| surface / constants / entities / profile | `census-seedling-solver-surface --check` · `census-seedling-constants --check` · `witness-seedling-entities --check` · `witness-seedling-profile --check` | GREEN 234 / PASS 5,488 / 528 leaves / 138 keys (both tiers); colliders 79 exact |
| roster | `fixtures/tapes/index.json` | 266 |
| bounded vitest BEFORE | 48 files: the brief's list + every `grep -a` hit for what I touch (`fidelityEncounters`, `solverEncounter`, `bobBoss`, `placedTalk`, `levelRun`, `outOfBandLedger`, `fallRock`, `levelWorld`, `fidelityF6`, `r5Chain`, `r7Acceptance`, `wasmArrival`, `wasmArrivalComposite`, `rosterCategories`, the surface/constants/surveyFamily tests) | **48 files / 1,841 tests, all green** |

## D1: measure the live Bob Boss (PASS)

**The witness.** Run 38079190387's artifacts are logs only (ten `*-log` artifacts of 2–6 KB; no tape or stream rows). So I re-ran the JS arc's B session locally, read-only, from `origin/seedling-js-encounters-rebased` @ `36b72856f5` in a separate worktree: `probe-seedling-wasm-logical-links.mjs --only=B --trace=…`. The trace holds every solve request and every shipped tape. The L32 request is the arrival's staging (`stagingFromWasmArrival`: the shield and the torch held, keys 0 and 1, 35 cleared flags, rng seed 1370430624 split). Its result is the same 1,049-tick plan CI shipped (expected y at t932 = 33.84584332605449, as in CI). Equips: slot 1 at t833.

**On the game** (new instrument `probe-seedling-encounter-ticks.mjs`, p4f, headless, port 9550; the drained stream compared to the model per tick):

| Replay of the live plan from its staging | Result |
|---|---|
| plain | **0 px over 1,050 obs**; t932 y 33.846 = the model |
| `botHold` at t833, the page's delivery freeze (k = 833 in CI), 500 ms | 0 px |
| the hold at the 1st/2nd/3rd/4th/6th page answer at or after t833 | 0 px each |
| the hold with a 1.5 s **main-thread stall** inside it (the page computes `deliveryRefusal` synchronously while held) | 0 px |
| **`hasFire = false` queued at t840** (`__swfBridge.queueItems`, BridgeGeneric configured as `configureBridge` does) | **first off t932: game (71.12077844673605, 34.24584332605449)**, byte-identical to all three CI runs |

**Why.** The burn press at ~t877 needs the Fire. With `hasFire` cleared there is no burn, and the tree (Solid until it burns) stops the walk at y 34.2458 when it reaches the pit mouth at t932. The model burns the tree (removed at obs 918) and walks through.

**The writer**, read from the JS arc's branch: `flashBridgeAdapter._itemWritesFor`, the block "For every location-mapped property NOT backed by a currently-owned item, emit a clearing write". `_buildItemWritesFromInventory` passes the inventory through `itemGate`, and the delivery gate holds the Fire. In CI that is a `deferDelivery` ("an item delivery waits for the room's end (room-end) — prefix: with hasFire staged at the arrival …"). So the gated inventory has no Fire and the clearing write lands. `stateChanged for "fire" ignored — AP placement owns that location` stands down the undo path only, not the clearing write. My local run's panel log shows the write coming back: `stateChanged (player action): hasFire = false`. On CI it is suppressed as an expected echo.

**Why the staged `enc-l32-*` witnesses missed it:** they are game-only tapes with no panel, so no gate and no clearing write. The model was never wrong there or here.

**Leg 351** (the sweep's held-shadow mismatch after 833 t). This is not measured: no sweep artifacts were in reach, and I cannot dispatch. Inferred: it is the same family. The CI text shows the delivery path re-staging the room's OWN drop at the arrival ("with hasFire staged at the arrival the shipped prefix leaves the model elsewhere at tick 4 of 833"). If that delivery is admitted rather than refused, the continuation's shadow is the replay of that re-staged arrival. With the Fire held from the start, `BobBoss`'s ctor removes itself, so the shadow is elsewhere by tick 4 and can never match the game. That is a JS-arc staging question, not a model one.

**Also seen, locally only (JS arc's):** on this slower box the delivery arrived after the tape had ended. `freezeAndDeliver` then toggled `botHold` on/off about 520 times ("the tape is not mid-span"), and the queued exit goal failed ("waited 60 s for the playing tape").

## D2: the witness (PASS; no model change needed)

**`enc-l32-live-arrival`** (1,049 t). The live staging is verbatim in `plan-seedling-encounters.mjs`, solved by the worker's shipping pass (`dashMode: 'none'`, `ANYTIME_PASSES[0]`). Its inputs are byte-identical to the tape the page shipped. A default `solveSegment` differs only at three dash presses.

- Recorded on the game (`check-seedling-bot-differential --record --only=enc-l32-live-arrival`, p4f, port 9550): 1,050 obs, 1 transition; every differential row PASS.
- Items 14/14, the slot array `[0,1]`, `primary` 1, hits 0, `rock-armed → 32:1`, `fire-removed → 31:29`, `save.time` 23899.
- tapeRunner: "JS stream matches the real game recording, exactly" and the stepping face both pass.
- Planner `--check`: 16 PASS (the existing three tapes byte-identical).

| Mutant (copy → edit → restore; `levelRun.js` md5 restored `5da5c1b5…`) | Predicted | Measured |
|---|---|---|
| M1 the model never applies the Fire | red | red (the model refuses the t833 Fire equip: one slot) |

## D3: the Witch's removal tick (PASS; the fix ships OFF, the flip is a STOP)

**Measured per tick on the game** (`probe-seedling-encounter-ticks.mjs`). The flag is read off `botStatus().items` at every tick, beside `run.inventory` at the same observation. Every drained stream is 0 px.

| Tape | The ceremony | Game: first obs with the flag | Model (today) |
|---|---|---|---|
| `enc-l12-witch` | the close t340 (`witch-close`, `darksword-added`), contact t341 — both as the model | **`hasDarkSword` 378**, the frame the player first moves | 377 (`darksword-removed` t377) |
| `enc-l32-live-arrival` | — | **`hasFire` 833** | 832 (`fire-removed` t832) |
| `bobsoldier2-l30-torch` | a PLACED pickup | **`hasTorch` 226** | 225 |
| `r8-solve-10` | the Sword (its `removed()` adds `Help(3)`) | **`hasSword` 71** | 70 |

`NPCs/NPC.as:71-84`: `NPC.removed()` nulls the pickup's `myText`, and it runs at the END of the closing frame (`updateLists`). So `Pickup.pick_up()`'s `else if (!myText)` arm, and with it `removeSelf()` → `removed()`, is the next frame's. The model applied `removed()` on the closing frame. x/y cannot see it because the player is free on the closing frame on both sides. The Bob Boss executor's existing "one tick after the flag" equip wait was this frame, measured from the other side.

**Is it why the live Witch legs end with `hasDarkSword` false? No.** The game sets the flag on the frame after the plan's last tick, and the disarm frame steps the world:

| Witch tape cut at the removal (the live legs' shape; 377 t) | Game at `finished` (+ a 60–150-answer tail) |
|---|---|
| plain | `hasDarkSword` **true** |
| `hold: true` (as the page ships) | **true** |
| the clearing write `hasDarkSword = false` queued at t377 | **false**, and false through the tail |

So the live FALSE is the clearing write again, as for the Fire. The brief's "less likely" was the cause; the evidence for the JS arc is the last row.

**The change** (`1d5f468`):

- `pickupRemoval.js` (new): switch `PICKUP_REMOVED_NEXT_FRAME`, OFF (`SEEDLING_PICKUP_REMOVED_NEXT=1` for a process).
  - ON, the finishing frame queues `removed()`'s flag writes: the item and its slot sync, a key, a totem part, the pickup's own persistence flag, and the `darksword-removed` / `fire-removed` rows. They land at the end of the next advance.
  - Unmoved: the freeze's end, the `collected` record, the shield's beam, the wand's activator loop and a sword's `Help`.
- `levelRun.js`: the queue and its flush, in the live and frozen paths. A late flush at the top of the following advance covers any early return.
- `solverBot.js`:
  - `execWitchEncounter` and `execBobBossEncounter` end their ceremony loops on the `collected` record.
  - The Bob Boss executor spends the removal frame as its equip-lag tick.
  - Plans are identical under either switch: `plan-seedling-encounters --check` is byte-identical with the switch ON too.
- `fixtures/pickup-removal-witness.json` (the four game rows above, written from the probe's output) and `fidelityEncounters2.test.js` (9 rows):
  - ON lands each flag on the game's observation; OFF one early; streams identical except `r8-solve-10` (the residue);
  - the ledger rows (`darksword-removed` t378 ON / t377 OFF, `fire-removed` t833 / t832);
  - the Witch executor's plan identical under both switches.

| Mutant (`levelRun.js` md5 restored `7d5e9478…`) | Predicted | Measured |
|---|---|---|
| M3 the queued removal one more frame late (`due + 1`) | red | **red, 5 rows** (the three stream-identical witness rows and both ledger rows) |

**The default flip: STOP.** Measured with the switch ON (`SEEDLING_PICKUP_REMOVED_NEXT=1`):

| Mover | ON |
|---|---|
| tapeRunner | 591 rows, **1 red**: `r8-solve-10: JS stream matches the real game recording` (t73: expected (56.705, 51.115), got (55.252, 52.489)) |
| `solve-seedling-r8-battery --check` | moves (`405d9c4b` → `20ee3cb8`): `r8-solve-10` SOLVED 83 → 90 t |
| `solve-seedling-r8-d2-chain --check` | **throws** at `r8-d2`: "keylock: bosslock@48,32 needs a key this run does not hold". The boss key lands a frame after the collect goal ends. |
| `solve-seedling-r9-campaign --check` | **throws** the same at `r9-solve-19` |
| l18 / tail / r9-l3 | unmoved (`465a8b46` / `35456fbc` / `6cd35fe1`) |
| the four `enc-*` tapes | byte-identical |

What the flip needs (both measured above):

- **The press gate.** `r8-solve-10` presses `primary` on the sword's closing frame. The game swings (the dash two ticks later lands), so the game's swing on that frame does not wait for `Sword.removed()`. The ON model's press reads `hasSword` and does not swing.
- **The solver's collect goals** must wait out the removal frame before a goal that uses the item (the keylock).

Both are outside this slice's executors. The flip and its re-records are the user's licence.

## The survey and sweep rows this moves

**None** from this branch: the switch is OFF, and the encounter plans are identical even ON. Survey steps 51 (L32, SOLVED 1,056) and 140 (L12 Witch, SOLVED 601) cannot move, since `plan-seedling-encounters --check` and the encounter executors are byte-identical. The live rows move only when the JS arc fixes the clearing write:

| Row | Now | Expected after the JS arc's fix |
|---|---|---|
| logical-links B "0 divergences" (`seedling-probe.yml`, runs 38079190387 / 38079881262 / 38080437841) | RED, t932 | green (the plan is 0 px on the game without the write) |
| the 7 Witch legs' game `hasDarkSword` at the end | false | true (the game sets it on the disarm frame) |
| sweep leg 351 (held-shadow mismatch after 833 t) | leaves its plan | not measured here (see D1) |

**CI dispatches for the planner** (I cannot dispatch: 403):

1. The tape tier on this branch, to re-check the new recording on CI: `seedling-differential` with `--only=enc-l32-live-arrival,enc-l32-fallen-door,enc-l32-fire-return,enc-l12-witch`.
2. `seedling-survey.yml` on `claude/seedling-encounters-fidelity-tq5nbk`, `through=end`, `route=full`, `only=51,140`. Expect 51 SOLVED 1,056 and 140 SOLVED 601 (unchanged).
3. After the JS arc's adapter fix, on their branch: `seedling-probe.yml`, the logical-links probe `--only=B`. Expect 0 divergences and the Bob Boss leg `done`. Then `seedling-divergence-sweep.yml`, `mode=inv`, `ids=351,109,119,129,139,149,159,169`.

## For the JS arc: what moves, and what to wire

**No pin of the JS arc's moved**; none of its files were touched. To fix, with the evidence:

1. **The clearing write** (`flashBridgeAdapter._itemWritesFor`).
   - The problem: it must not write `false` to a host-owned location's property while that location's own AP item is held by the delivery gate. Today the game's drop is taken back mid-room.
   - Evidence: `probe-seedling-encounter-ticks.mjs --tape-file=<the live L32 tape> --write-at=840,hasFire,false` reproduces CI's t932 row byte-for-byte; the same probe on a tape of the Witch goal alone (`enc-l12-witch`'s staging, 377 t, the live legs' shape; a scratch tape, not committed) with `--write-at=377,hasDarkSword,false` reproduces the Witch legs' FALSE.
   - The local log line: `stateChanged (player action): hasFire = false`.
2. **The delivery of an encounter's own drop.** `deliveryRefusal` re-stages the drop at the ARRIVAL ("with hasFire staged at the arrival …"). For a drop the room itself grants mid-room, that staging can never be the room. Probably leg 351's shadow mismatch.
3. **The end-of-plan read.** A pickup's flag lands one frame after the plan's last tick (D3), on the disarm frame. A check binding that reads the flag at the plan's last drained tick sees false even without the clearing write; read it at `finished`.
4. (Local only) the delivery loop's on/off `botHold` toggling after a tape has ended starved the next goal (60 s).

**New, optional fields:** none. No new `SolverRefusal.obstacle.kind`. The solver reads the existing `collected` ledger.

## Handed to the hammer arc

Nothing. No hammer-owned function was touched.

## Deltas

**New files:**

- `scripts/procgen/probe-seedling-encounter-ticks.mjs` (help and import doors PASS; a declared guarded box taker in `boxLock.test`);
- `frontend/modules/seedlingDemo/pickupRemoval.js`, `fidelityEncounters2.test.js`, `fixtures/pickup-removal-witness.json`;
- tape + expectation `enc-l32-live-arrival`.

**Changed:** `levelRun.js`, `solverBot.js`, `plan-seedling-encounters.mjs`, `r8Acceptance.js`.

**Pins moved and re-pinned:**

- roster 266 → 267 (`tapeEnvelope`, `observationTolerance` ×2 incl. `swapped`, `dialogueAutoAdvance` ×2);
- R8 exposed 83 → 84 (its declaration, sorted list and synthetic mirror);
- `boxLock.test`'s guarded-taker list (+1).

**Records:**

- surface GREEN **234** (counts re-censused, `--write`); constants **5,488 → 5,490** (`--write`);
- tape index 267;
- reference regenerated (instruments + docs index; the four substrate rows left as committed);
- `seedling-bot.md` (two paragraphs), `seedling-bot-log.md` (entry + three trap candidates).

## What the brief got wrong (measured)

1. **"Name the model's error (which entity/arm, which tick)."** There is none. The live plan is 0 px on the game; the divergence is the panel's clearing write.
2. **"The witness to take is a LIVE arrival: the B leg in run 38079190387 (`gh run download`; find the B leg's tape/stream rows)."** That run's artifacts are ten small logs with no tape or stream rows. The live arrival had to be re-made with a local `--trace` run.
3. **"Deterministically."** It is deterministic on CI's timing. Locally the same leg did not diverge, because the delivery came after the tape ended. Whether the clearing write lands mid-span is the page's timing.
4. **"A 1–2 frame lag is frozen out by the ceremony hold."** The lag is real and exactly one frame, but it is every special pickup's, not the Witch's. It does not leave the game false: the disarm frame steps the world, even with `hold: true`. The FALSE is the clearing write, the brief's "less likely".
5. **"`then: 'reach-pit'` … L32 is the only [arena]"**: consistent with what I saw; nothing here contradicts it.

## Residue

1. The default flip of `PICKUP_REMOVED_NEXT_FRAME` (D3's STOP): the press gate on a sword's closing frame (`r8-solve-10`), and the solver's collect goals waiting out the removal frame (the d2-chain and campaign keylocks).
2. Unmeasured, and unmoved by the switch: the shield's beam, the wand's activator loop and a sword's `Help` also run in `removed()`, so they are a frame later on the game too.
3. Leg 351's shadow mismatch: inferred, not measured.
4. `rosterCategories.test.js` › "the LIVE row carries one part per derived category" expects **207** and the row says 206. It needs `standing-values --write` after the tier run. **STOP — the planner re-banks it** (red in CI until then, as in wave 10).
5. `procgenDocs/generated.test.js` and the reference `--check` read 4 DIFFER here, identically at the base (this container's substrate submodules).

## Byte-inertia (switch OFF)

- tapeRunner at the head: **591 rows, 0 non-pass**, md5 `3ec8090f11707c809ebfa1e6cd733d64`; the 589 pre-slice rows `8cb21cd9…` = W0.
- identity block AFTER (this tree, `SEEDLING_PORT=9550`): **every md5 row and all six producers identical to W0** (all exit 0). The reference line went 4 → 8 DIFFER (my instrument and docs) and is back to W0's 4 after `aded1ef`.
- bounded vitest AFTER: **49 files / 1,851 tests, 1 red** (residue 4, the standing row).
- CI `JavaScript Unit Tests` at the last head: see the closing line of the final message (read with `ci-vitest-summary.mjs`).

## Rows to BANK

- tapeRunner pairs **591 / `3ec8090f…`** (old 589 `8cb21cd9…`);
- roster **267**; surface **234**; constants **5,490**; R8 exposed **84**;
- `PICKUP_REMOVED_NEXT_FRAME` = OFF (default `false`);
- ⚠ the standing roster row 206 → **207** (planner, `standing-values --write`).

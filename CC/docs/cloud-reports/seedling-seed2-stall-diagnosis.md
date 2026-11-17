# Cloud report: `seedling-seed2-stall-diagnosis`

**Why the seed-2 wasm whole-game walk freezes at "playing tick 1/858". DIAGNOSE ONLY.**

Launcher: `seedling-js-planning-21` (js-21). Ruling: Robert, 2026-11-17T21:42:18Z (transcript c54da6ff), *"Diagnose now, fix
after"*. Branch: **`claude/seedling-seed2-stall-diagnosis-xbn3k1`** (the harness pinned it; no plain
`seedling-seed2-stall-diagnosis` branch was pushed). I fixed nothing. No solver, bot, wasm, `vendor/seedling`, preset or rules file
was changed on any branch meant for landing. The commits are three labelled MEASUREMENT-ONLY ones, the evidence
(`seedling-seed2-stall-diagnosis-evidence/`) and this report.

## Summary for Robert

The bot isn't stuck. The game threw the plan away on its very first frame, and the page never looked. Here is the sequence.

In seed 2, the Level 12 chest holds the **Sword**. Fire was already in the inventory's first slot, because seed 2's "Level 010 -
Sword" chest holds Fire. The page delivers the Sword while it holds the room still. Then it plans the next walk, and that plan says
"select slot 1 (the Sword) and swing on the first frame".

The game only puts a newly delivered item into its slot list at the **end** of a frame, and a held room runs no frames. So on that
first frame the game still has only one slot. The game's bot code checks the selection at the top of the frame, sees slot 1 doesn't
exist, and stops the tape with an error: *"equip at tick 0 selected slot 1 but the inventory holds 1 item(s)"*.

The page's watcher reads the game's error only after **all** 858 planned frames have played. They never will, so it waits forever,
until the test's 300 s stall timer ends the run.

Seed 1 never takes this path: its Sword comes from L10 and has sat in slot 0 since. Its L12→L21 walk is a fresh arrival plan with
no slot change, and it plays through.

So there are two defects:
1. **The cause:** a slot item delivered into a held room is treated as already in the slot list at the next plan's tick 0, when
   the game adds it one frame later. This is a known game rule, already handled for items picked up mid-tape, but not for
   held-room deliveries.
2. **Why it's silent:** the page never reads the tape's error while ticks are still owed.

I propose small, separate fixes for both (§ Fix proposal). Each is a question for you.

## Base, wasm and instrument

| | |
|---|---|
| BASE | **`d3f74f4978f6ee66f5c1c14a1d6752fb6c0f395e`** = `origin/main` ("train: unbounded-grid-s2 56888ee976") |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (the gitlink at BASE, and checked out; the same pin as re-measure-4) |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --all` → READY, "seedling wasm builds: OK (4 dirs)", tree clean. Every wasm run reports `transport=wasm` (WebGPU from the batch's `webgpu: true`) |
| instrument 1 | `d6b6aed4d` (re-measure-4's) cherry-picked **cleanly** → `6e71c9e6` "MEASUREMENT-ONLY: knobs + sampler …" (4 files, +124/−5, the same diff as every earlier measure) |
| instrument 2 | `5348364c` "MEASUREMENT-ONLY: wasm playback stall probe": exposes the engine's closure on `globalThis.__measureWasmPlayback`, adds a `[MEASURE wp]` line per sampler tick (phase, goal, drained/ticks, room, gate, the game's `botStatus` core) and one `[MEASURE stall-dump]` when a "playing tick k/N" status repeats |
| instrument 3 | `4d0a628b` "MEASUREMENT-ONLY: log every wasm plan ship with its tick-0 slot facts": one `[MEASURE ship]` line per `ship()` (goal, continuation, first key sets, `equipsAt`, the game's `inventory_slots`/`primary`, `room.slotLag`, the last delivery row) |
| seed 2 | `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` → **`AP_01043188731678011336`**, loaded as level set **`seedling-ap-record-5f705e09`** (the same set re-measure-4's A′ loaded). Generated in the tree and never committed. Cleaned up at the end (§ Cleanup) |
| box | the cloud container, headless Chromium, `scripts/serve-nocache.py 8000`, one run at a time under the box lock, a fresh page per run (each run is its own `npm test`) |

None of the three instrument commits is for landing.

## Reproduction (2 of 2 here, 5 of 5 counting walk check 2's 2 and re-measure-4's 1)

Knobs: re-measure-4's Arm A′ (`TEST_AUTO_START_TIMEOUT_MS=10800000 TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000
TEST_MEASURE_BOT_STALL_MS=300000 TEST_MEASURE_PLAYTHROUGH_SEED=2`), `npm test -- --mode=test-substrates
--batch=tutorials-seedling-whole-game` (`run-arm.sh`). Run S2b lowered the bot stall to 60 s, because the freeze needs no 300 s to
show.

**Staging.** The whole-game row reaches entry 5 in about 270 s here, so I made no shortcut. The instrument has no knob to start
mid-walk, and 4.5 min per attempt was cheap enough. Re-measure-4 took 450 s for the same leg: its 15 s ticks were coarser and its
box was slower.

| run | stall seen | bot-plays wall | stop |
|---|---|---|---|
| S2a (stall 300 s) | t=270 s → end, `playing tick 1/858` at every sample | 556.0 s (row 572.1 s) | the 300 s bot stall; status still "playing tick 1/858" |
| S2b (stall 60 s) | the same leg, the same plan (858 t, `equipsAt [[0,1]]`) | 320.6 s (row 336.3 s) | the 60 s bot stall |

S2a, quoted (`S2a.measure.log`):
```
[MEASURE tick] seedling-whole-game t=255s … botRegion="level_12__r42c28" … status="Sphere 1.7 → walking to \"Level 012 - Chest\" (4/48) — playing tick 1218/1508"
[MEASURE tick] seedling-whole-game t=270s … checked=5 … botRegion="level_12__r0c37" … status="Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing tick 1/858"
[MEASURE wp tick] phase=playing goal="level_12__r0c37 -> level_21" goalLevel=12 ticks=858 drained=1 rows=1 hold=false continuation=true frozen=null room={"level":12,"shipped":2366} gate={"pending":false,"deferred":null} landing=null selfCheck=null queued=null game={"level":12,"x":327.8454631151322,"y":824.8151079715487,"game_time":11404,"held":false,"armed":false,"finished":true,"frozen":false,"error":"equip at tick 0 selected slot 1 but the inventory holds 1 item(s); useItem on an out-of-range slot is a silent no-op","tick":0,…}
[MEASURE wp tick] … drained=1 … game={… "game_time":11788,"held":false,"armed":false,"finished":true, … "error":"equip at tick 0 selected slot 1 …","tick":0,…}
… (every 15 s; game_time 12189, 12611, 13034, 13451, 13860, 14266, …; x, y never move)
[tutorial-walk-timing] seedling-whole-game: load 5.0s, start-game-page 6.5s, start-game 2.1s, bot-plays-open 0.2s, bot-plays 556.0s
[MEASURE end] seedling-whole-game t=570s step=bot-plays checked=5 botQueue=48 botCursor=4 botChecked=4 botRegion="level_12__r0c37" lastRegionEvent="level_12__r0c37" regionChanges=28 wasmPushes=23 transport=wasm wasmMemMB=656 jsHeapMB=190 status="Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing tick 1/858"
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 572.1s
```
The checks, region changes (28) and wasm pushes (23) are the same as re-measure-4's A′1. So is the leg: the 1508-tick walk to
"Level 012 - Chest", then `level_12__r0c37 -> level_21`, 858 ticks.

## 1. What the bot holds at the freeze (`S2a.stall-dump-1.json`)

| | value |
|---|---|
| engine phase / goal | `playing`, `level_12__r0c37 -> level_21` (exit, level 12), a **continuation** (`prefix 1508`: the chest walk's ticks, `room.shipped` 1508 + 858 = 2366) |
| plan | 858 ticks, pass `full`, verbs `walk`. **`equipsAt [[0, 1]]`** (select slot 1 at tick 0). First key sets `["down","primary"], ["down"], ["down","primary"], …` |
| plan `expected[0]` | `{level 12, x 327.8454631151322, y 824.8151079715487}` |
| drained | **1 row**: `{t 0, level 12, x 327.8454631151322, y 824.8151079715487}`, exactly `expected[0]`. No divergence |
| the game's tape (`botStatus`) | `armed false, finished true, tick 0, held false, frozen false`, `error "equip at tick 0 selected slot 1 but the inventory holds 1 item(s); useItem on an out-of-range slot is a silent no-op"`, seam `{partial: true, latched: true, why: "equip check failed: …"}`. `equips [{slot 1, t 0}]` |
| the game now | level 12, the player at (327.85, 824.82), the plan's start row, never moving. `game_time` **advancing** (11404 → 14266 over the stall): the frame loop is alive and nothing drives the player. `inventory_slots [1, 0]` (Fire, Sword: the Sword was appended AFTER tick 0), `items.hasSword true, hasFire true` |
| what was delivered | `deliveries[-1] = {level 12, goal "level_12__r0c37 -> level_21", phase "held", tick 1508, items [{hasSword false → true}], outcome "staged", policy "hold-and-replan"}`, i.e. `deliverHeld`. `selfChecks[-1] = {location "Level 012 - Chest", tick 1508, settled, delivered}` |
| timeline (last rows) | `finish` "Level 012 - Chest" held end (gt 11388) → `begin` the L12→L21 exit, `continue` → `self-check` → `solve wasm-continue-exit-12` (gt 11388) → ship at gt 11404 |
| host starts | `{label "continuation", from 213, to 224}`, the last one. No fallback, no hold seam, no timer throw, no divergence |
| room / spawn | `room.level 12`. There was no arrival: the room has been held since the chest walk's held end. The game's level (12) and the bot's region (`level_12__r0c37`) agree |

So the game's own tape player stopped. It is not waiting on a condition: it is **finished with an error**. The page's tape watcher
(`watch()`) keeps polling `botDrain()`, gets nothing new, and never asks `botStatus()`, because it only does that once every planned
tick has drained.

## 2. Seed 1 vs seed 2 on the same exit (`[MEASURE ship]`, S2b and S1a)

| | seed 1 (S1a, vanilla `seedling-vanilla-…`) | seed 2 (S2b, `seedling-ap-record-5f705e09`) |
|---|---|---|
| entry, how the exit is reached | 9/48 (target `level_25__r2c7`), via `level_0__r11c19 -> level_12__r0c19` | 5/48 (target `level_25__r2c7`), right after entry 4 "Level 012 - Chest" in the same room |
| the leg | **arrival** plan (`continuation=false, prefix=0`) | **continuation** of the held chest-walk room (`continuation=true, prefix=1508`) |
| delivery into the held room just before | none (the last delivery was the Shield, in L20, long before) | **Sword**, `deliverHeld`, `outcome staged` |
| the game's `inventory_slots` at the ship | `[0]` (the Sword, since L10's "Sword" check) | **`[1]`** (Fire only: seed 2's "Level 010 - Sword" chest gave Fire) |
| `room.slotLag` | null | `{before [1], after [1,0], primary 0, secondary 0, held []}` |
| plan | 2564 t, first keys `["right"]×3`, **`equipsAt []`** | 858 t, first keys `["down","primary"], ["down"], ["down","primary"]`, **`equipsAt [[0,1]]`**, the model's inventory at t0 with `hasSword true` |
| the game at tick 0 | slot 0 = Sword, nothing selected | Bot.update selects slot 1, `drainEquipChecks` sees **1** slot → disarm, error |
| outcome | plays: `playing tick 414/2564` (t=360 s) → `840` → `1261` → on through L39 | frozen at `1/858` |

The difference that matters is the **slot item delivered into the held room, followed by a plan that selects the new slot at tick
0**. Position, facing and flags don't matter: the start row agrees to the last digit. Seed 1 can't hit this here: its Sword is
slot 0 and needs no selection.

**The in-seed control (seed 1, S1a), the same shape with one tick of difference.** `level_32 -> level_30__r2c10` is a continuation
(prefix 818) after a held **Fire** delivery (`deliverHeld`, `outcome staged`), with `slotLag {before [0], after [0,1], primary 0}`
and `game.slots [0]` at the ship. Its plan selects the new slot 1 too: `equipsAt [[27,1],[81,0]]`. But it selects it at **t=27**,
by which time 27 live tails have appended Fire, and it plays. Of S1a's 84 ships (17 continuations), 6 select a slot and none does
it at t=0.

## 3. Model vs game

The game never played tick 1. `Bot.update` records tick 0's observation, then applies the equips, then drains the equip checks.
The check disarms the tape before tick 0's key edges are dispatched (`Bot.as:3187–3216` at the vendored pin), so the game has
exactly one row, and it equals the model's `expected[0]`. There is no physical divergence to replay, so I did not run
`replay-seedling-solve-request.mjs`.

**The model and the game disagree on one piece of state the row compare doesn't carry: the slot array at the top of tick 0.**
- **Model:** `[1, 0]`. The continuation's staging is the arrival's, re-staged with the delivered Sword
  (`stageItems(room.staging, …, {slots: st.inventory_slots})`, `seedlingWasmPlayback.js:2252` at BASE). `levelRun` appends a STAGED
  item at construction (`syncSlots()`, `levelRun.js:944–953`), by the rule *"the SEAM's items are written before the boot world
  exists, and the boot's dead frames append them: held at tick 0"* (`levelRun.js:899–901`). So the solver sees the Sword at index 1
  and selects it at t0 (`equipsAt [[0,1]]`).
- **Game:** `[1]` at tick 0's top. A held room runs no `super.update()` (`Main.as:78–87`: `if (!Bot.holding && !Bot.frozen)`), so
  `Game.update` → `inventory.update()` → `addItemsFromSave` (`Game.as:1044–1046`, `Inventory.as:291–299`) never ran after the flag
  was written. The first live frame is the continuation's tick 0, and `Bot.update` runs before `super.update()`. So the Sword joins
  the array in tick 0's **tail**, after `drainEquipChecks` (`Bot.as:2840–2862`) has read `Inventory.itemCount == 1`.

A continuation into a held room has **no boot dead frames**, so the seam rule doesn't hold for an item delivered while held. That
item behaves exactly like a GRANT: *"a GRANT row … that frame's equip check and its X press read the array WITHOUT it, and its tail
appends it"* (`levelRun.js:902–908`). That is the measured finding of `seedling-fidelity-slots.md` §1, the same error text word for
word. The solver already waits that frame out for a mid-tape Fire pickup (`solverBot.js:1717–1729`, *"ONE TICK AFTER THE FLAG"*).
Nothing waits it out for a held-room delivery.

## 4. The cause, plainly

**(A) The cause.** A slot item (`SLOT_ITEM_PROPERTIES`: sword, ghost sword, fire, wand, fire wand, spear;
`wasmDelivery.js:58`) delivered into a HELD room reaches the game's slot array one frame AFTER the next tape's tick-0 equip check.
The model stages it as present at tick 0. The two host guards that should catch the gap don't:
- `equipSlotRefusal` (`wasmDelivery.js:396–407`, called at `seedlingWasmPlayback.js:1656` at BASE) checks the equip against
  `slotsAfterDelivery(game slots now, model items)`, the array the game holds **after** the tail. Here that is `[1, 0]`, so slot 1
  passes. Its docstring says *"the game will HOLD that slot at that tick"*, which is false at tick 0 after a held delivery.
- `firstTickSlotRefusal` (`wasmDelivery.js:420–433`, called at `seedlingWasmPlayback.js:1649` with `room.slotLag`) exists for
  exactly this one-frame lag. But it reads the slot index from `slotLag.primary`, the game's selection **before** the plan's own
  tick-0 equip. Here that is 0 (Fire → Fire, unchanged), so it passes. It never sees that the plan moves `primary` to 1 on that very
  tick.

The game then refuses the equip, which is correct: an out-of-range index reads 0 and would silently swing the wrong item for any
item but the Sword. It stops the tape (`Bot.as:2849–2856`).

**(B) The silence.** `watch()` (`seedlingWasmPlayback.js:1770–1797` at BASE) reads `botStatus()` only under
`if (play.progress.ticks >= play.ticks && …)` (`:1787`). A tape that the game disarms early (an equip-check failure, or a
`pinFault`, `Bot.as:219–233`) never drains its owed ticks. So `st.error` / `st.finished` is never read, nothing fails by name, and
the `playing` phase has no deadline of its own. The engine's only exit is the bot's stall timer outside it. This is the
"silent-watcher" family the `Bot.as` comments warn about (*"an error that only recorded itself would be invisible"*): the game
reports it, and the page doesn't read it.

**Proven by:** the game's own `botStatus.error` and seam `why` at the freeze; drained = 1 = `expected[0]`; `inventory_slots [1]` at
ship time and `[1, 0]` after; `equipsAt [[0,1]]` with `slotLag {before [1], after [1,0], primary 0}`, in 2 of 2 runs. The seed-1
control is the same exit with no held slot delivery and no t0 equip, and it plays.

## 5. Can it hit other exits?

**Searched (measured):** re-measure-4's evidence, every run's statuses: A1, A2, P1 (seed 1, about 3000 s each, 24/48 entries), B1
(JS) and A′1 (seed 2). Counted as runs of the same "playing tick k/N", only A′1 has one: 21 samples at `1/858`. No seed-1 run has a
frozen tick. In seed 1, every `[MEASURE ship]` in S1a up to L39 has `equipsAt []` (I read all of them up to the budget stop).

**By construction (not measured), the same cause fires whenever both hold:**
1. A slot item is delivered while the room is HELD. That covers `deliverHeld` between goals or during a solve (as here), and the
   mid-tape freeze (`admit` after `botHold("on")`) when the frozen tape held no keys, so no lead tick is shipped (`room.lead =
   heldKeys.length ? [heldKeys] : null`, `seedlingWasmPlayback.js:2211`). With a non-empty lead the equip shifts to t ≥ 1, the lead
   tick's tail appends the item, and it is safe.
2. The next plan selects, at its tick 0, an index at or past the pre-delivery array's length. That is the usual case whenever the
   plan wants the NEW item at once, because the model appends it at the end.

Which entries in which seeds meet both is a matter of placement. On a randomized seed, any chest holding a slot item that the very
next leg uses at t0 (a Sword before a cut, Fire before a burn, a Wand, a Spear) qualifies. A fused item (Fire Wand, Ghost Sword:
`removeItem` + `addItem(…, pos)`, `Inventory.as:300–322`) is worse. There the pre-delivery index can be **in range but name another
item**, which is a silent wrong swing, not an error. I didn't measure that variant.

A held **arrival** delivery (`room.shipped.length === 0`) takes `arrivalSolveRequest`, not the continuation. The tape is still
`botLoadTape` + `botStart` on the held world with no dead frames, so its tick-0 equip has the same exposure. Not measured.

Defect (B) is general: any early disarm on any leg stalls silently.

## Fix proposal (for Robert: each is its own question; nothing here is done)

| # | what | where | size | risk | re-records |
|---|---|---|---|---|---|
| **F1** (the silence → a named failure) | in `watch()`, also read `botStatus()` when the drain has returned **no new row** for `STATUS_MS`, while ticks are still owed. `st.error` → `fail("the game's tape errored: …")`, as at `:1789` today. `st.finished && !st.armed` with ticks owed → `fail` by name ("the game's tape ended at tick k of N") | `frontend/modules/flashPanel/seedlingWasmPlayback.js` `watch()`; one test in `seedlingWasmPlayback.test.js` (a fake game whose tape disarms after 1 row) | ~8 lines + 1 test | low. `botStatus` costs about 15 ms, but it is asked only on a stalled drain, never per frame on a healthy tape (W0's rule holds) | nothing. The seed-2 walk then stops at once with *"equip at tick 0 selected slot 1 …"* instead of 300 s of silence (a FAIL by name, not a pass) |
| **F2** (the cause, cheapest consistent cure) | when a held delivery **adds or moves a slot** (`post.slots` ≠ `before`) and nothing else set a lead, set `room.lead = [[]]`: one idle lead tick. The game's tail appends the item on that tick, and the plan (equips included, `ship()`'s `shift`) starts at t=1. The machinery exists already: `solveInRoom` passes `[...r.shipped, ...lead]` to `continuationSolveRequest`, and `ship()` prepends the lead and shifts `equipsAt` | `seedlingWasmPlayback.js` `deliverHeld` (`:2252–2253` at BASE) and the mid-tape `admit` (`:2205–2206`); tests in `seedlingWasmPlaybackDelivery.test.js` | ~6 lines + 2 tests | medium-low. Every continuation after a held slot delivery starts one idle tick later. The model replays the idle tick in the shadow (no press, so the staged-vs-tail difference is unobservable on it). The arrival path isn't covered | delivery pins that expect a continuation's t0 (`seedlingWasmPlaybackDelivery.test.js`, by inspection; to be measured). No game witness, no fixture, no wasm |
| **F3** (a guard, if F2 is not wanted) | make the two guards see the lag. `equipSlotRefusal` checks a **t=0** equip against `room.slotLag.before` when a lag is pending, and `firstTickSlotRefusal` uses the plan's own t0 equip as the pressed index. A refusal goes to the existing `fallback(…, 'delivery-first-tick')`: a forced re-arrival, whose fade frames run the tails and append the item before the new arrival plan's tick 0 | `wasmDelivery.js:396–433`, `seedlingWasmPlayback.js:1649–1656` (BASE); tests in `wasmEquips.test.js` / `wasmDelivery.test.js` | ~12 lines + 2–3 tests | low (a refusal path that exists already). It costs a re-arrival each time, and whether the re-arrival's fresh plan for L12→L21 then solves is **not measured** | refusal-text pins only |
| (not proposed) | the model learns that a held delivery is a tick-0 GRANT, not a seam item (a staging field read by `levelRun`) | `levelRun.js` / `wasmArrival.js` | larger | touches every staging consumer and the fidelity witnesses | witnesses; out of proportion while F2 exists |
| (not proposed) | `Bot.as` appends a delivered slot before the equip check | `vendor/seedling` + a wasm rebuild | — | a wasm re-pin (the standing ASK-FIRST gitlink) and a game-behaviour change for every tape | the pins |

**My recommendation:** F1 and F2 together, as one slice. F1 alone turns the stall into a named stop. F2 lets this seed-2 leg play
on (to be measured by a re-run of Arm A′ at the slice tip). F3 is the fallback if you would rather spend a re-arrival than shift
continuations by a tick. Neither F2 nor F3 covers the held **arrival** case (§5). If that matters, F3's guard also belongs on the
arrival ship.

## What the brief got wrong, or what differs

- *"freezes at tick 1/858 from about 450 s"*: here it is from 270 s. Same leg, same counts; this box was faster.
- *"whether the tape player is waiting on a condition"*: it is not waiting. It **finished**, with an error, on tick 0.
- *"Model vs game: … compare tick 1"*: the game has no tick 1. The comparison that answers it is the slot array at tick 0's top
  (§3). The position rows agree.

## Cleanup

The dev server I started (`scripts/serve-nocache.py 8000`, PID 1477) was stopped by its literal PID.
`frontend/presets/preset_files.json` was reverted, and `frontend/presets/seedling_playthrough/AP_01043188731678011336/` and
`output/AP_01043188731678011336.zip` were deleted. `git status` is clean apart from the commits on this branch.

## Evidence (`seedling-seed2-stall-diagnosis-evidence/`)

`S2a.measure.log`, `S2b.measure.log`, `S1a.measure.log` (the `[MEASURE]` / `[PROGRESS]` lines, no stall dump; S1a covers up to its
1080 s budget stop), `S2a.stall-dump-1.json` (the full dump at the freeze), `run-arm.sh`, `seq.sh`, `gen-seed2.log`.

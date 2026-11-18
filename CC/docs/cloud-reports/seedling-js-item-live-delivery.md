# seedling-js-item-live-delivery — host deliveries are written into the LIVE run on the JS runtime; no room rebuild

Cloud slice (⚖ Robert 2026-11-18T01:41:07Z, *"Live apply, no rebuild (Recommended)"*): cure A of
`CC/docs/cloud-reports/seedling-js-item-reboot-diagnosis.md` (on `origin/claude/seedling-item-reload-diagnosis-7zosnt`
@ `6f5f14492e`), held to `seedling-fidelity-planning-22`'s eight conditions. BASE `ed92d80127` (origin/main). The
harness pinned the branch **`claude/seedling-js-item-live-delivery-p2enz8`**; there is no `seedling-js-item-live-delivery`
branch. Evidence: `CC/docs/cloud-reports/seedling-js-item-live-delivery-evidence/`.

## Summary for Robert

Both of your reports are fixed on the JS runtime. When the AP server sends an item back, the JS page now writes it into
the room you are standing in, the way the game's setters write the save. It no longer builds the room again.

- **L40:** the Red Key from the chest no longer brings the bobsoldier back, and the respawn point stays the room's
  entry. Measured with the diagnosis' own probe: 3 deaths before the chest and **0 after it in 1800 idle ticks**, the
  same as the run with no item at all. Before the fix there were 35 deaths after it.
- **L39:** the Seal from the totem no longer resets the three fire blocks. **All six lock/cover blocks stay open** 600
  ticks later. Before the fix all six shut again.

It holds for every kind of delivery: item flags, keys (a delivered key now opens its BossLock in the same visit), totem
parts and seals. The 16th seal makes the room's chests vanish on the next frame, as `Chest.update` does in the game.
No tape is re-recorded, no fidelity key or solver file changed, and the acceptance md5 is unchanged. One generated
file moved: the constants census retired the old seal constant's row, by its own documented protocol (§5).

**One thing you might notice:** the in-place reboot used to hide a gap in the JS solver. The solver replays your session
from its boot to check its plan, and that replay could not see a live delivery. I closed the gap without touching the
solver: the session records each delivery on its staging, and the replay applies it at the same tick (§1, item 5).

**One pre-existing bug for js-21, not fixed here (item 8):** if the host delivers a key, a seal or a totem before
the level set is mounted, the mount wipes it. Flags survive. BASE behaves the same.

## 1. The change (file:line at the final commit)

1. **`levelRun.deliver(change)`**, one entry point (`frontend/modules/seedlingDemo/levelRun.js:5684-5796`; docblock at
   `:5684`, `deliver` `:5723`, `deliverNow` `:5750`). It accepts four kinds: `{kind:'flag', property, value}`,
   `{kind:'key', key}`, `{kind:'totem', index}` and `{kind:'seal', slot, identity}`.
   - A `true` flag goes through `applyGrantsFor`'s own `applyItem` (the grant path without its level gate). The slot is
     NOT synced in `deliver`: the next step's tail does it (`syncSlotsAtTail`).
   - A key is `keys.add`, a totem `totemParts.add`, a seal `sealParts[slot] = identity`.
   - It is idempotent: an echo returns `{changed: false}` and records nothing.
   - It refuses an unknown kind or an out-of-range value by name. It throws if called inside `advance`
     (`advancing`, `:21899`).
   - Exposed as `run.deliver` / `run.deliveries` (`:21894`).
2. **`HAS_ALL_SEAL_PARTS` is now a live read.** It is `hasAllSealPartsNow()` (`:15060`, docblock above it), read each
   chest step (`:8248`). Nothing in the model writes `sealParts` except the boot and `deliver`, so a run nobody
   delivers into reads the same constant as before.
3. **CHESTSEAL's live half** (`liveSealVisit`, `:1051`; `openChestIdsNow`, `:4134`; the `checkBySeal` arm, `:8272`; the
   docblock, `:4117`, and `contactFidelity.js`'s `chestSealRemoval` doc). In the visit where the 16th seal arrives, the
   chest's own `checkBySeal()` banks the flag through `pendingEarnedClears`, the same path `open()` uses. The chest stays
   a wall to the Player for the rest of that frame, because `FP.world.remove` lands at `updateLists()`
   (`Engine.as:69-76`). It is gone from the next frame. Every later build of any room uses the constructor half, as
   before.
4. **Karlore / the `worlds` memo** (`addedTimeHold`, `:1051`; `worldFor`, `:1318`). A delivered `ADDED_TIME_PROPERTIES`
   flag (Fire) does not reach the current visit's build, not even after a mid-visit memo drop. The next `new Game(48, …)`
   builds without him (`enterWorld` → `dropWorldIfBuiltStale`, R5 slice 4's path).
5. **The staged-delivery channel** (`levelRun.js:856`, `stagedDeliveries`; applied by `applyStagedDeliveries`, `:5740`,
   at construction `:19258` and at each tick's end `:24274`; `tapeRunner.createRunForStaging` threads
   `staging.deliveries`, `tapeRunner.js:429`; `watchManual` session `deliver`, `watchManual.js:284`).
   - **Why it exists:** the JS solver's shadow is `createRunForStaging(session.staging)` replayed through
     `session.perTick` (`jsRuntimeSolver.replayTape` / `forkRunFor`).
   - **Without it, measured:** after two live flags the L0 rock walk failed: *"the run's `primary` slot holds
     NOTHING"*.
   - **How it works:** the session records each delivery that changed the run as `{t, change}` on its staging. A
     rebuilt run applies it at the same boundary.
   - **Scope:** an optional field no tape carries, like `inventory_slots` / `player_damage`. No solver file changed.
6. **`jsRuntimeCore`.**
   - `applyItem` pushes `{kind, …}` onto `pendingDeliveries` (`jsRuntimeCore.js:1321`, `:1334`, `:1344`, `:1360`) and no
     longer sets `deferredReboot`. The session ledgers (`flags`, `heldKeys`, `sealSlots`, `heldTotems`) still change as
     before, because they stage the next real boot.
   - `applyDeliveries` (`:1195`) hands the pending list to `session.deliver` at the end of the queue drain (`:1375`) and
     at the top of `tickOnce` (`:885`). Both points are before the tick's `session.step`.
   - Each delivery writes a `delivery` note `{kind, …, changed, level, tick}`, updates `bootItems` for a flag, and
     raises `saveChanged('delivery')`.
   - A boot or a restore drops what is pending, because it stages the ledgers that already hold it (`:689`, `:1301`).
   - `rebootInPlace` (`:1171`) now serves only the RE2 restore, at an integer constructor (`:1179`).
     `IN_PLACE_REBOOT_WHY` (`:242`) reads `'the save was restored'`.

Diff vs BASE (before this report): 25 files; the source is `levelRun.js` (+~200 incl. docblocks), `jsRuntimeCore.js` (+~75 / −~25),
`tapeRunner.js` (+5), `watchManual.js` (+11), comment-only `contactFidelity.js`, `seedlingEffectSkin.js`,
`playerDamage.js`, `flashPanel/seedlingJsSave.js`.

## 2. The reviewer's conditions → how each is met

All pins are in `frontend/modules/seedlingDemo/jsRuntimeLiveDelivery.test.js` (15 rows, all green) unless named
otherwise. Each mutant in the next section was applied to the source, measured red, and reverted.

1. **When in the tick.**
   - `deliver` runs only at a tick boundary and throws inside a step. Its docblock (`levelRun.js:5684`) cites where the
     wasm game's write lands: BridgeGeneric's `getItemQueue` poll on its own `ENTER_FRAME` (`BridgeGeneric.as:117,224`),
     outside `Game.update` and its `blackCover` gate, between two `Game.update()`s.
   - Pin *"a flag queued between tick t and t+1 …"* (`:138`): after the boundary the run holds the flag, `inventorySlots`
     is still `[]` and the `deliveries` row has `t`. After the next tick the slot is `[0]`.
   - Pin *"… the GRANT path without its level gate"* (`:154`): a delivery at t0 and a boot grant read the same position,
     inventory, slots, primary and presses, tick for tick.
   - Mutant d2 (sync at once) reds the first pin.
2. **SEAL 16 / CHESTSEAL.** Pin *"L36 `chest@64,48` …"* (`:200`). Fifteen seals are staged and the player pushes into
   the chest. Then the 16th is delivered.
   - Tick t+1: the flag is banked (`persistence_cleared` has {36,0}) and the player has not moved; the chest is still a
     wall.
   - Tick t+2: the player moves, then walks through the chest's cell.
   - The check is reported once.
   - (a) bank via `pendingEarnedClears` (`:8272` arm); (b) one frame in Chest's update slot; (c) the docblocks at
     `levelRun.js:4117` and `contactFidelity.js` `chestSealRemoval`.
   - Mutants d3 (seal read back to a build constant), d4 (chest gone at the boundary) and d5 (live clear not banked)
     each red this row.
   - No committed tape takes the 16th seal mid-visit: `sealParts` had no writer but the boot until `deliver`, and the
     acceptance md5 is unchanged.
3. **Karlore / the memo.**
   - Pin *"in L48: Fire delivered → Karlore stays (and stays through a mid-visit rebuild); the next new Game(48) drops
     him"* (`:225`). The mid-visit rebuild is a v9 timed clear of the L48 chest at tick 3; the rebuild is proven by the
     chest being gone.
   - Pin *"Fire delivered in another room: the next L48 build has no Karlore"* (`:249`).
   - Mutant d6 (no hold) reds the first.
   - **Census** pin (`:259`):
     - (i) `buildLevelWorld`'s options, read off its signature, are exactly `cleared, inventory, nextLevelRecord,
       roles`. There is no key, totem or seal input.
     - (ii) `levelWorld.js` has 5 code lines that touch `inventory` (the parameter, the `ADDED_TIME_REMOVAL` test, the
       stamped `addedTimeKey`, and `addedTimeKey` itself) and none that touch a save mirror.
       `ADDED_TIME_REMOVAL = {karlore}`, `ADDED_TIME_PROPERTIES = ['hasFire']`.
     - (iii) Measured over the vanilla 116: an empty inventory and every item held build the same world everywhere
       except **L48**.
     - (iv) `levelRun.js` has 21 code lines that read `sealParts` / `totemParts` / `hasAllTotemParts` /
       `hasAllSealPartsNow`, each reviewed as the boot, `deliver`, or a per-tick read, and `HAS_ALL_SEAL_PARTS` is gone.
       A new reader reds the count until someone classifies it.
4. **`encounterHoldsDelivery` and the tape deferral are kept** (`applyDeliveries`' gate, `jsRuntimeCore.js:1195`; the
   ceremony gate is kept too).
   - Pin *"a delivery queued while a tape is armed waits for the tape's end, then lands live (no boot)"* (`:325`).
     Mutant d10 (`tape.armed` dropped from the gate) reds it.
   - The encounter hold is pinned in `jsRuntimeEncounterLegWalk.test.js`'s L32 Bob row (restated below). Its m5
     (`encounterHoldsDelivery` → false) is measured red.
5. **Idempotence.**
   - Pin *"run.deliver: a held key, the same seal in the same slot, a flag at its value — unchanged, recorded once, one
     slot"* (`:292`).
   - Pin *"through the core: the echo of a key the run picked up itself, and a re-pushed totem/seal, write nothing"*
     (`:312`).
   - Mutant d8 (a held key recorded again) reds the first.
6. **`rebootInPlace` only for the RE2 restore, integer ctor.**
   - Pin *"a restore mid-room reboots once, at the truncated position minus the half tile"* (`:361`). It is not vacuous:
     the position is fractional.
   - Also asserted in `jsRuntimeSave.test.js`'s reload row.
   - Mutant d9 (float ctor) reds it.
7. **Byte classes moved** — §5. Acceptance md5 **`391322d681b7aa0229d94b3f6906d024`** (= the pinned one).
8. **Measured — yes, it can.** See §6.

Also pinned: L40 (`:89`), L39 (`:111`), a delivered key opening L19's `bosslock@48,32` in the same visit (`:182`), and
the solver's shadow replaying live deliveries (`:344`; mutant d7, the session not recording, reds it plus
`jsRuntimeSave`'s rock walk).

### Mutants (each applied to the source, measured, reverted; `git status` clean after)

| id | mutation | red |
|---|---|---|
| d1 | the core reboots again (`applyDeliveries` → `rebootInPlace`) | 9 of 15 rows (L40, L39, boundary, BossLock, chest, Karlore, echo, tape, shadow) |
| d2 | `deliver` syncs the slot at once | the boundary row |
| d3 | the seal read a build constant again | the chest row |
| d4 | the chest leaves at the boundary (no `sealRemovedAt` frame) | the chest row |
| d5 | the live seal's clear not banked | the chest row |
| d6 | no Karlore hold | the Karlore row |
| d7 | the session does not record deliveries on its staging | the shadow row, the idempotence row, `jsRuntimeSave`'s reload row |
| d8 | `deliver` not idempotent for a held key | the idempotence row |
| d9 | the restore keeps the float ctor | the restore row |
| d10 | the tape deferral dropped | the tape row |
| m5 | `encounterHoldsDelivery` → false | `jsRuntimeEncounterLegWalk`'s Bob row |

## 3. Tests restated (old → new)

| File | Old | New |
|---|---|---|
| `jsRuntimeCore.test.js` | "queueItems flag writes are idempotent: … a new one reboots once" | "… a new one is written into the LIVE run once (no boot)": same run, 1 delivery note, the slot `[0]`, the arrival and the ctor untouched |
| `jsRuntimeCore.test.js` | "`hasKeySet` is MODELLED: … (a reboot in place) …" | "… (written live) …" (assertions unchanged; they held) |
| `jsRuntimeCore.test.js` | "the SLOT ORDER … survives an item-flag reboot …" | "… survives a live item delivery …" (assertions unchanged) |
| `jsRuntimeCore.test.js` | "a slot whose item the flags no longer hold is dropped (the model refuses it)" | "… stays for the visit (`addItemsFromSave` only appends) and is dropped at the next boot": `[1,0,2]` live after `hasSword = false`, `[1,2]` after a teleport |
| `jsRuntimeCore.test.js` | "`hasSealPartSet` … the next boot stages the log" (`staging.save.seal_parts` right after the delivery) | "… the live run holds it, the next boot stages the log": same run, `deliveries` rows; staged after a teleport |
| `jsRuntimeCore.test.js` | "sixteen seals fill the LAST slot … in the run the page booted" | "… in the LIVE run and in the next boot": `finalDoorGate.hasAllSealParts`, 16 filled, then the boot |
| `jsRuntimeCore.test.js` | "`hasTotemPartSet` … staged at the next boot" (staged at once) | live `saveState.totem_parts`, no boot; staged after a teleport |
| `jsRuntimeForcedHit.test.js` | "the game's hits SURVIVE the item-flag reboot: staged from the run …" | "… SURVIVE an item delivery: the same Player …": same run and world, `stagedDamage` null, i-frame −1 |
| `jsRuntimeForcedHit.test.js` | "a reboot with NO damage stages none" (`— an item flag changed`) | "a delivery with NO damage stages none (no boot at all)": the last note is the delivery |
| `jsRuntimeGameSpeed.test.js` | `reboots: 2` (×5 rows) | `delivered: 2`, `reboots: 0` |
| `jsRuntimeGameSpeed.test.js` | MUTANT m1 / m2: "the pin goes red" (through the reboot) | still red, now through a LIVE write on a later tick: each also pins `deliveredAt` ≠ the reference's (measured [280, 300] and [280, 297] vs [280, 296]). ⚠ Measured on the way: before the staged-delivery channel (§1 item 5) both mutants went GREEN, because the solver's shadow could not see the delivery and the walk ran differently (deliveries at [280, 310] in every arm). That was the gap, not the mutants |
| `seedlingFadeOnce.test.js` | boots `[first frame, teleport, REBOOT, REBOOT]`; the pre-G7 mutant had 4 ramps | the deliveries boot nothing; a **RE2 restore** at slot 150 is the one reboot in place: boots `[first frame, teleport, IN_PLACE_REBOOT_WHY]`, ramps `[0, arrival]`; the mutant had 3 ramps |
| `seedlingFadeOncePerCrossing.test.js` | "the delivery rebooted in place" | the delivery landed live, nothing rebooted in place |
| `jsRuntimeSave.test.js` | the restore's note `— an item flag changed` | `— the save was restored`, plus an integer ctor |
| `jsRuntimeDeclarations.test.js` | "the clear is CARRIED: a re-boot in the room (an item flag) …" | "… a delivery, a re-boot in the room …": the delivery keeps the same run; the RE2 restore re-boots; the lock stays gone in both |
| `jsRuntimeSolver.test.js` | "a forced mismatch (an item re-boot mid-plan)"; "the 3rd refutation" (an item flag every 5 ticks) | the same rows, with the RE2 restore as the re-boot |
| `jsRuntimeSolveService.test.js` | "a re-boot while the worker thinks" (an item flag) | the same row, with the RE2 restore |
| `jsRuntimeEncounterLegWalk.test.js` | L32 Bob: boots +1 when the held Seal lands; m5 "reboots the room mid-leg" | 0 delivery notes while the leg walks, then 1 (live, same run, no boot); m5's text updated (measured red) |
| in-app `seedling-js-runtime-graphics-puzzles` (`seedlingJsRuntimeTests.js`) | "the runtime rebooted in place for the item", `'an item flag changed'` | "the runtime wrote the item live (no reboot)": `true/0/true` (changed / boots / same run), still no fade |
| in-app `seedling-js-runtime-solver-fights-bob-encounter` | comment on the grants' deferred reboot | comment updated (no assertion change) |
| `fidelityFencepost.test.js` | SOURCE SHAPE: `advance(held) {` then the FENCEPOST comment …; `})(); settle; return advanced; },` | the same, with the boundary guard around it (`advancing = true; try {` … `advancing = false; applyStagedDeliveries();` before the return, `finally`): the settle is still the one line after the arrow |
| `scripts/procgen/seedlingConstantsCensus.test.js` (via the committed census) | the rule row `levelRun.js\|createLevelRun\|h1015b0cb\|-1` (`HAS_ALL_SEAL_PARTS`) | RETIRED (`--write`); its review carried to `hasAllSealPartsNow`'s `-1` by one row in `seedling-constants-fields.csv` (as `finalDoorGateNow`'s). `--check` PASS |

The diagnosis named ~8 files. Three more (`jsRuntimeDeclarations`, `jsRuntimeSolver`, `jsRuntimeSolveService`) used an
item flag as a *tool* to force a re-boot. The RE2 restore now plays that part.

## 4. The two reproductions (the diagnosis' probe, the page's core in node)

`node CC/docs/cloud-reports/seedling-js-item-live-delivery-evidence/probe-reboot.mjs l40|l40-control|l39|l39-control`.
This is the diagnosis' probe; its kept notes now include `delivery`. Its snapshot labels still say "the in-place reboot
ran", because they are the diagnosis' text. The `base-*.json` files are the same probe at BASE `ed92d80127`.

| | BASE (`base-l40.json`) | fix (`l40.json`) | control, no echo (`l40-control.json`) |
|---|---|---|---|
| runs | 1, **2** (rebooted) | **1** | 1 |
| `worldCtor` after | (879.63, 825.10), the chest | **(864, 848)**, the entry | (864, 848) |
| bobsoldier after the echo | back, 0 hits | **absent** | absent |
| deaths (3 before the chest) | **38** | **3** | 3 |
| note | `boot level 40 … — an item flag changed` | `delivery {"kind":"key","key":0} — written into the live run` | — |

| | BASE (`base-l39.json`) | fix (`l39.json`) | control (`l39-control.json`) |
|---|---|---|---|
| runs | 1, **2** | **1** | 1 |
| `worldCtor` | (77.50, 34.29) | **(144, 608)** | (144, 608) |
| pushed fire blocks | none (all back at origin) | **3** | 3 |
| `wandlock@144,64/48/32`, `cover@144,112/176,144/112,144` | **shut ×6** | **open ×6** | open ×6 |

Both are also vitest pins (`jsRuntimeLiveDelivery.test.js:89`, `:111`). The page itself: the restated in-app G7 row
drives `jsRuntime.html` and passed (below).

## 5. Gates and byte classes moved

- **Acceptance:** `node scripts/procgen/batch-seedling-acceptance.mjs | md5sum` = **`391322d681b7aa0229d94b3f6906d024`** ✅.
- **Bounded vitest:** every default-tier test file that imports a touched module, found with `grep -a -l` (`levelRun`,
  `jsRuntimeCore`, `tapeRunner`, `watchManual`, `contactFidelity`, `seedlingEffectSkin`, `playerDamage`,
  `seedlingJsSave`), **376 files, run at `75829a32`: 373 passed, 3 red, 8027 tests passed / 8 failed**. All three
  were fixed and re-run green (62/62) at `ea9c3e4c`:
  - `jsRuntimeGameSpeed` m1/m2: see §3. My intermediate "inert" restatement was wrong once the staged channel landed.
  - `fidelityFencepost.test.js` "SOURCE SHAPE": restated (§3).
  - `scripts/procgen/seedlingConstantsCensus.test.js`: the census RETIRED the `HAS_ALL_SEAL_PARTS` rule row (§5).

  Before that, the 74 `jsRuntimeCore` importers had gone 10 files red → 0 after the restatements.
- **Slow tier** (`vitest.slow.config.js`): `jsRuntimeTape`, `jsRuntimeSolverForkRun`, `fidelityLights`,
  `strategySwitchApproach` and `strategySwitchEscape` ran at `ea9c3e4c`: **5 files, 11/11 passed**. Not run:
  `jsRuntimeSolverCalibration.slow` (calibration).
- **Acceptance re-measured at `ea9c3e4c`:** `391322d681b7aa0229d94b3f6906d024`.
- **In-app (TT), measured here at `734ab14` + the uncommitted comment edits:**
  - `--batch=seedling-js` **37/37 passed**.
  - `--batch=seedling-js-solver` **12/12 passed**, including `seedling-js-runtime-solver-fights-bob-encounter`.
  - `--test=seedling-js-runtime-graphics-puzzles` 1/1.
  - Each run logged only 404s for files absent here (e.g. the playthrough sphere log) plus two `already_checked`
    rejections in `seedling-js`.
- **Byte classes moved:**
  - **Vitest:** the 10 files in §3 plus 1 new (`jsRuntimeLiveDelivery.test.js`).
  - **TT rows:**
    - `seedling-js-runtime-graphics-puzzles`: assertion text and values.
    - `seedling-js-runtime-solver-fights-bob-encounter`: comment only.
    - The substrates config `_comment` of the G7 row.
  - **Digests:** none committed. A run that takes a delivery has a different `stateDigest` from BASE from that tick
    on, because the delivered state is live and nothing is rebuilt. No committed digest crosses a delivery (acceptance
    unchanged; GameSpeed's speed-vs-speed digests are equal to each other).
  - **Tapes / fixtures / goldens:** none.
  - **The constants census** (`scripts/procgen/seedling-constants-census.csv` + the doc region of
    `docs/json/developer/procgen/seedling-constants.md`):
    - Regenerated by `--write`. The diff is mostly line-number moves (1051 rows), plus the RETIRED `HAS_ALL_SEAL_PARTS`
      rule row and 7 new structural literals of the new code.
    - One reviewed row was added to `seedling-constants-fields.csv`.
    - Class totals: rule 1807 (unchanged), structural +5, total 7119 → 7124.
    - This is the census's own documented protocol for a retired statement ("--write, and say why in the commit"),
      a direct consequence of making the seal read live. I flag it because it is a committed generated file.
  - **Fidelity keys:** none new. CHESTSEAL's docblock is extended.
  - **Solver files:** none.
- **TT rows I expect to move at your tip (js-21):**
  - In `seedling-js`, `seedling-js-runtime-graphics-puzzles` moves (restated). Any row that delivers mid-room no longer
    logs a reboot boot.
  - In `seedling-js-solver`, the encounter row and the rows whose grants used to reboot after a teleport (their
    "quiet boots" waits are now trivially satisfied).
  - All of these were green here.
- **Not run here:** `train_only` (14 `*.train.test.js` import `levelRun`/`tapeRunner`), the slow tier (6 importers),
  the bundled boot. No `gh` here, so js-21 dispatches `train_only` and TT at the tip.

## 6. Item 8 — measured: the core CAN apply an AP delivery with nothing mounted, and with a non-rewritten set mounted

`node CC/docs/cloud-reports/seedling-js-item-live-delivery-evidence/probe-item8-mount-order.mjs` →
`item8-mount-order.out` (fix) and `item8-mount-order-BASE-ed92d80127.out` (BASE, same verdict).

- **Nothing mounted (`mounted` null).** After `setVanilla`, the live run is the vanilla first frame (`Main.as:51`, L0).
  `applyDeliveries` has no `mounted` gate, so `hasKeySet(1)`, `hasSealPartSet(0,3)` and `hasSword` are written into
  that run (`key1`, `seal0`, `flaghasSword`, all `written@L0`).
  - A later `botLoadLevels` → `mount()` (`jsRuntimeCore.js` `mount`) clears `heldKeys`, `sealSlots` and `heldTotems`
    ("a new set is a new save") but not `flags`.
  - After the start teleport, **the key and the seal are gone** (`runKeys []`, `sealSlot0 -1`) and the sword survives.
  - At BASE the result is identical: the same ledgers are cleared by the same `mount()`. This slice did not introduce
    it.
- **A GENERATED (non-rewritten) set mounted** (`mountedKindOf` → `generated`). Deliveries are written into it too
  (`key2`, `flaghasShield`). Nothing in the core asks the mounted kind before applying a delivery.
- **Reported as a delivery-order bug, not fixed here.** If the AP host can push items before the level-set delivery
  mounts (the core cannot tell), keys, seals and totem parts are silently lost and flags are not. By design an AP
  session mounts `rewriteRecordSet`'s set (`mountedKindOf` :309) before it delivers. Whether the live host keeps that
  order was not measured here: that is the host's adapter, not the core.

## 7. Notes and residuals

- **The solver can be refuted by a live write**, as the reviewer anticipated (condition 4). A delivery that lands while
  a plan plays changes the live run, so the per-tick check may refute and re-solve. That is why
  `encounterHoldsDelivery` stays. The next solve's shadow replays the delivery (§1 item 5).
- **`carriedDamage` lost its last caller.** `rebootInPlace` serves only the restore, which stages no damage (a fresh
  life). The STAGEDHITS staging code is unchanged, and `scripts/procgen/probe-seedling-staged-hits.mjs` mode P still
  describes `rebootInPlace`'s construction.
- **A delivered `false` flag** (the inventory panel's removal) sets the run's flag false and keeps the slot for the
  visit, as `addItemsFromSave` does. The next boot drops the slot, as before (`carriedSlots`).
- **Seal slots the run earned by opening chests** are folded into the core's seal log (`foldGainedSaves`) but are not in
  the live run's `sealParts`. They never were mid-visit: the reboot used to stage them. This only matters if the 16th
  slot is one of them, and then the next boot has it.
- **The core still gates a delivery on a running ceremony**, as the reboot did (the diagnosis called keeping it
  harmless). The game would apply the write on a ceremony's dead frames; in the model it lands on the first tick after
  the ceremony, which is what L39's Seal does here (it arrives during the totem's ceremony).
- **Side finding:** L86 (`new Game(86, 32, 16)` / `(86, 56, 56)`) lets the player move in no direction for 480 ticks
  on the JS model. This is unrelated to deliveries, not investigated, and is why the chest pin uses L36.

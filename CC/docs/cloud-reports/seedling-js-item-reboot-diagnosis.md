# seedling-js-item-reboot-diagnosis — why a pickup "reloads" the room on the JS Seedling runtime

Cloud slice, DIAGNOSE + FIX PROPOSAL ONLY (⚖ Robert 2026-11-18T01:14:20Z, *"Diagnose, then fix (Recommended)"*).
BASE `ed92d80127` (origin/main). Branch `claude/seedling-item-reload-diagnosis-7zosnt` (the harness pinned it, so
there is no `seedling-js-item-reboot-diagnosis` branch). No source changed. Evidence:
`CC/docs/cloud-reports/seedling-js-item-reboot-diagnosis-evidence/`.

## Summary for Robert

When you pick something up in an AP game on the JS runtime, the AP server sends the item back: a key, a Seal, a
Totem Shard or an item flag. The JS page then **builds the room again from scratch**, with the player standing where
they are (`jsRuntimeCore.rebootInPlace`). The real game never does this. Its setters only write the save
(`Main.as:187-212`), and everything in the room that cares about that save reads it live.

Building the room again does two things the game never does:

1. **Everything the room doesn't save comes back.** That covers enemies you killed, blocks you pushed, buttons
   they were holding, and the locks those buttons kept open.
   - **L39:** the three locks in the shaft are held open only by three fire blocks sitting on their buttons
     (`Lock.as:63-104`). After the Seal from the totem arrives, all three blocks are back where they started and
     all six lock/cover blocks are shut again (measured). You are left shut in the totem nook.
2. **The room's respawn point moves to where you were standing.** The game's death is
   `restartLevel()` → `new Game(level, playerPosition.x, playerPosition.y)` (`Game.as:2031-2034`), and that
   position is the constructor's (`Game.as:673-677`, `:555-561`). The rebuilt JS run's constructor is your live
   position, so every death puts you back at the pickup.
   - **L40:** after you kill the bobsoldier and open the chest, the Red Key echo brings the bobsoldier back on the
     tile under the chest, which is also the new respawn point. Measured: **35 deaths in the next 1800 ticks, one
     every 52 ticks, every respawn at the chest**. The same run without the echo has 0 deaths after the chest.

The reboot also doesn't do what its own comment says it is for. With a key or totem part held, the model builds
the room exactly as it would without one (measured below). Nothing in the model needs the rebuild.

**Recommended cure (A): apply each delivery to the LIVE run, as the game does, and rebuild nothing.** The model
already has almost all of the pieces:
- mid-run item grants with the slot sync (`levelRun.applyGrantsFor`);
- a live `keys` set the BossLock reads every tick;
- a live totem gate.

The one model read that has to become live is the "all sixteen seals" flag the chests read
(`HAS_ALL_SEAL_PARTS`, a constant at build). Rough size: ~100–150 lines in `levelRun.js` + `jsRuntimeCore.js`, plus
restating ~8 vitest files and 2 in-app rows that assert the reboot. No committed tape re-records. One fidelity key
(CHESTSEAL) is touched, so `seedling-fidelity-planning-22` should review it.

## 1. Inventory: what sets `deferredReboot`, what the model reads at build, what the game does live

The reboot path (BASE lines):
- `jsRuntimeCore.applyItem` (`jsRuntimeCore.js:1252-1306`) sets `deferredReboot` for each delivery kind.
- `drainQueue` (`:1308-1315`) and `tickOnce` (`:870`) run `rebootInPlace(IN_PLACE_REBOOT_WHY)` (`:1149-1160`,
  `:238`) unless a tape is armed, a ceremony is running, or an encounter leg holds the delivery (`:1324`).
- `rebootInPlace` calls `boot()` (`:640-680`) at the live position (minus the half tile) with the carried damage
  (`carriedDamage`, `:1143`). `boot()` banks persistence clears (`bankClears`) and folds items, keys and seals,
  then creates a **new** `createManualSession` run.
- The model's death restarts at `run.worldCtor` (`:920-933`, `arrival = { level, ...run.worldCtor }`), which is now
  the pickup spot.

| Delivery (host call) | Model reads at BUILD (`levelRun.js` / `levelWorld.js`) | Game behaviour, live (AS3) | Can the model apply it live today? |
|---|---|---|---|
| **Item flag** `Main.<prop> = v` (`:1292-1303`; sword, shield, fire, wand, swim, torch…) | The `inventory` the world is built with (`worldFor`, `levelRun.js:1291-1305`). Its only build reader is `ADDED_TIME_REMOVAL` = Karlore/`hasFire` (`levelWorld.js:3192-3201`, read `:4793`). Everything else reads `inventory` at use time. | A setter writes `SAVE_FILE` only (`Main.as:187-207`). `Inventory.update()` → `addItemsFromSave()` every frame (`Inventory.as:161,188,291-330`) adds the slot. The weapon/NPC/hazard readers are live (`Player.as` ×47, `ShieldLock.as:33`, `LavaTrap.as:64`, `Watcher.as:114`, `Witch.as:32-50`). Karlore's `added()` runs only at build (`Karlore.as:27-33`), so he stays until the next room entry. | **Nearly.** `applyGrantsFor` (`levelRun.js:5625-5638`) already does `applyItem(inventory, item)` mid-run and leaves the slot to `syncSlotsAtTail` (`:953`), the frame tail in `addItemsFromSave` order. It is gated to "on entering level n" and not exposed to the page: it needs a public entry point. |
| **Key** `Main.hasKeySet(i, true)` (`:1253-1263`) | `keys = new Set(bootSave.keys)` (`levelRun.js:5623`). **No build reader** (measured, §1a). | `Main.hasKeySet` writes the save (`Main.as:209`). `BossLock.update` reads `Player.hasKey` every frame (`BossLock.as:58-66`). A held key's `BossKey` removes itself only in `check()` (`BossKey.as:33-41`), which runs **once, on a new world's first frame** (`Game.as:869-878`). Mid-visit the key on the floor stays put. | **Yes, trivially.** `keys` is a live Set, the BossLock arm reads it every tick (`activators.js:850`), and the run already adds to it itself (`levelRun.js:22965`). It is just not reachable from the page. |
| **Totem Shard** `Main.hasTotemPartSet(i, true)` (`:1277-1286`) | `totemParts = new Set(bootSave.totem_parts)` (`levelRun.js:1026`). **No build reader for the pickup** (measured, §1a). | Save write (`Main.as:210`). `BossTotemPart.check()` (`BossTotemPart.as:35-43`) is build-time only. `Wand.update` (`Wand.as:78`) and `BossTotem.as:291` read `hasAllTotemParts()` live. | **Yes, trivially.** `totemParts` is live, `totemGateNow` (`levelRun.js:3807`) and `:15556` read it per tick, and the run adds to it itself (`:22978`). |
| **Seal** `Main.hasSealPartSet(slot, id)` (`:1264-1276`) | `sealParts` from `bootSave.seal_parts` (`levelRun.js:1027-1028`). **`HAS_ALL_SEAL_PARTS` is a constant computed at build (`:14892`)** and passed to `stepChests` (`:8091`). `chestsSealRemoved` (`:4091`) and the final door (`:16295`) already read `sealParts` live. | Save write (`Main.as:211`). `Chest.update()` calls `checkBySeal()` every frame (`Chest.as:59-61`), so when the 16th slot fills, every chest in the room removes itself and writes its persistence (`Chest.as:47-57`). The ctor's call (`:35`) is the build half. | **Partly.** The slot write is a one-liner, but `HAS_ALL_SEAL_PARTS` has to become a live read for the 16th seal. Seals 1–15 change nothing in any room. |
| (RE2) **save restore** `restoreSave` (`:1214-1247`) | everything | n/a (a page feature) | Out of scope. ⚖ Robert ruled the restore is a fresh life, so its reboot stays. |

### 1a. Measured: the model's build ignores a held key or totem part

`evidence/probe-build-reads.mjs` → `build-reads-held-key-totem.log`. L40 was built twice, without and then with
key 2 and totem parts 0+1 held. Both builds contain `bosskey@656,528`, `totempart@64,144` and `totempart@160,640`.
The run's `takenPickups` and `collected` stay empty five ticks later. So the comment at
`jsRuntimeCore.js:1253-1255` ("a key is read at BUILD: a held key's `BossKey` removes itself") describes the game,
not this model. For keys and totems the reboot builds the same room it replaces.

The model also doesn't remove a held key's `BossKey` at a real room entry. That is a separate fidelity gap from the
game's `check()`, outside this slice, noted for fidelity-22.

## 2. Reproductions (seed 1 vanilla placement, the JS runtime core)

**Harness.** These runs drive `createJsRuntime` (`seedlingDemo/jsRuntimeCore.js`) in node. That is the same core
`jsRuntime.html` / `jsRuntimePage.js` and flashPanel `?runtime=js` run, on the vanilla map
(`flashPanel/atlases/seedling-map.json`). The probe plays the HOST's part: when the pickup reports, it queues the
item that seed 1 (`frontend/presets/seedling/AP_14089154938208861744`) places there, as the AP server would echo
it. The item mapping is `games/seedling.json` `ap_locations`/`ap_items`:

| Pickup | Location | Seed-1 item | Host call |
|---|---|---|---|
| L39 `totempart 2` | `totem2` = Totem Shard (Three Blocks Puzzle) | Seal | `Main.hasSealPartSet(0, 0)` |
| L40 `chest@880,816` (tag 13) | `chest40` = Chest (Lacste Main Room) | Red Key | `Main.hasKeySet(0, true)` |

Every case has a **control**: the identical run with no echo. Commands: `node
CC/docs/cloud-reports/seedling-js-item-reboot-diagnosis-evidence/probe-reboot.mjs l40|l40-control|l39|l39-control`.
Outputs are in `<case>.json` (full object dumps) and `<case>.log`.

⚠ This is the page's core, not the browser page; no screenshots were taken. How each room was reached: L39 is
solved by the committed tape `fixtures/tapes/r5-shaft.json`. L40 is entered by an in-room `new Game(40, 864, 848)`,
the same constructor `restartLevel` uses, because the solver declines the full room from both doors (logged in the
probe history: a bomb-pusher hold and a spinner-hammer corridor). The key held for the bosslock (key 2) is staged
before the boot, so it causes no reboot.

### L40: the chest in front of the tree, then the death loop (`l40.json`, `l40-control.json`)

1. Boot in the corridor below the chest. The player kills `bobsoldier@880,832`: gone at t273, after 3 deaths on the
   way, each respawning at the entry ctor (872,856).
2. The player steps onto the bobsoldier's tile under the chest and presses up. The chest opens and `pendingCheck`
   = `1|40|13|0` at t317.
3. The host queues `Main.hasKeySet(0, true)`.

| | before the echo (t317) | one tick after (reboot ran) | 1800 idle ticks later |
|---|---|---|---|
| run object | run 1 | **run 2** (`boot level 40 at (879.625…, 825.10…) — an item flag changed`) | run 2 |
| `worldCtor` (= respawn point) | (864, 848), the entry | **(879.63, 825.10), the chest** | (879.63, 825.10) |
| player pos | (887.63, 833.10) | (887.63, 833.10) | — |
| `bobsoldier@880,832` | **absent** (killed) | **back at (888, 840), 0 hits** | alive |
| chasers in the room | 14 | 15 | 15 |
| persistence 40:13 (chest) | cleared | cleared (carried) | cleared |
| deaths | 3 | 3 | **38**: 35 after the echo |

Respawns after the echo (`l40.json` `deaths[].respawn`): every one is at (887.63, 833.10), the chest. The interval
is 52 ticks every time: chaser contact, then the sword. **Control (no echo):** the bobsoldier stays dead, the ctor
stays (864, 848), and there are 0 deaths in the same 1800 ticks. This is Robert's L40 report exactly. The enemy
under the chest comes back, kills the player, the player respawns at the chest, and it repeats.

Side observation: the rebooted ctor is non-integer. The game's `new Game(_level:int, _playerx:int, _playery:int)`
never is.

### L39: the totem, then the locks come back (`l39.json`, `l39-control.json`)

1. Tape `r5-shaft` runs to its end (t2764). Its three fire blocks sit on the three lock buttons, the three column-9
   wandlocks and the three covers are open, and the player is beside `totempart 2`.
2. The player picks up the totem: `totem_parts[2]` = true at t2796.
3. The host queues `Main.hasSealPartSet(0, 0)`. The reboot waits out the pickup ceremony
   (`!session.run.inCeremony`) and then lands.

| | after the pickup, before the echo | 600 ticks after the echo |
|---|---|---|
| run / boot note | run 1 | **run 2**, `boot level 39 at (77.50…, 34.29…) — an item flag changed` |
| `worldCtor` | (144, 608), the bottom door | **(77.50, 34.29), the totem nook** |
| fire blocks moved (`pushedBlocks`) | `@144,176`→(9,7), `@208,80`→(11,9), `@48,176`→(7,9) | **none: all three back at their origin** |
| buttons down | `@144,112`, `@112,144`, `@176,144` | **none** |
| `wandlock@144,64` / `@144,48` / `@144,32` | OPEN / OPEN / OPEN | **shut / shut / shut** |
| `cover@144,112` / `@176,144` / `@112,144` | OPEN ×3 | **shut ×3** |
| persistence 39:{0,1,2,9,10} | cleared | **still cleared**, but not read (below) |

**Control (no echo):** everything stays open and the run stays run 1. The lock clears are carried but have no
effect. The game's `Lock.check()` removes a lock at build only when `tSet < 0` (`Lock.as:38-45`). An activator lock
(`tSet` 3/4/5) is open only while its button is held, and it restores itself the moment the button is released
(`Lock.as:63-104`, `returnToNormal`). So a rebuild that resets the blocks shuts the locks, in the game as in the
model. The game just never rebuilds here. This is Robert's L39 report: "some lock blocks reappear".

⚠ Tape artifact, not Robert's path: after the reboot `wandlock@144,592` (39:8, the entrance plug) is present too.
The tape *declares* that clear, the session never earned it, and a non-tape reboot stages only the session's own
clears. On Robert's path the L38 ButtonRoom writes it in play, so it would be banked. That was not measured here.

## 3. What a reboot re-creates

The new run is built from the record + the session's carried persistence + flags/keys/seals. So:

- **Survives:** every persistence clear (`bankClears`: chests opened, kill locks, BossLocks, keys/totems picked
  up, ropes, rocks with a tag); flags, keys, seals, totems; the slot order (`carriedSlots`); damage
  (`carriedDamage`).
- **Comes back (the category that shouldn't):** all **per-visit, non-persisted room state**:
  - enemies killed this visit (L40's bobsoldier; any untagged enemy), at their spawn with full health;
  - pushed blocks back at their origin, so buttons are released, so activator locks/covers shut (L39);
  - every other per-visit map `levelRun`'s digest lists as runtime state: spinners, crushers, turrets, bulbs,
    tile writes, bridges, burned trees without a tag, the `Game.time`-driven phases;
  - the room's ctor, which in the game only a new room entry sets.

In the game the same category comes back on a death or a re-entry, which is a real `new Game`, but **never on a
pickup**. The first category is correct on any boot. The second is wrong on this boot only because this boot
should not exist.

## 4. Who depends on the reboot

Found with `git grep -a` on `IN_PLACE_REBOOT_WHY|rebootInPlace|an item flag changed|double fade|deferredReboot` and
on "reboot in place".

- **Vitest (default tier) that asserts the reboot or its effects:**
  - `jsRuntimeCore.test.js:266` (key row: "a reboot in place", the `boot level 86` note) and `:352` ("the reboot in
    place staged it", the seal row). The slot-order rows `:295-326` survive if slots sync live.
  - `jsRuntimeForcedHit.test.js:193,207`: the staged-hits carry across the reboot.
  - `jsRuntimeGameSpeed.test.js:90,188`: it counts reboots on the L86 chest delivery. Its pin compares speeds with
    each other, so it should stay green, but the counts change.
  - `seedlingFadeOnce.test.js:89`: the boots list contains two `IN_PLACE_REBOOT_WHY`.
  - `seedlingFadeOncePerCrossing.test.js:192`: "the delivery rebooted in place".
  - `jsRuntimeEncounterLegWalk.test.js:145` + mutant m5 (`encounterHoldsDelivery`).
  - `jsRuntimeSave.test.js:113` is the RE2 restore. It stays if the restore keeps its reboot.
- **In-app TT rows:**
  - `tests/testCases/seedlingJsRuntimeTests.js:3796` (inside `seedlingJsRuntimeGraphicsPuzzles`) asserts
    `'an item flag changed'`.
  - The `:4977` comment in the fade-once-per-crossing row reasons about a deferred reboot.
  - The `playwright_tests_config-substrates.json:2304` G7 row comment.

  Which batch each row runs in was not measured; read `testBatches.js` at fix time.
- **Page code built around it:**
  - `jsRuntimePage.js:603-606`: G7's "no fade for a reboot in place".
  - `seedlingEffectSkin.js:490`, `playerDamage.js:531` (STAGEDHITS: the damage carry exists for this reboot).
  - `scripts/procgen/probe-seedling-staged-hits.mjs` mode P.
  - `watchWasm.js:292` and `flashPanel/seedlingJsSave.js:16` (comments; the restore).
- **Train tier / tapes:** no `*.train.test.js` hit. Tapes are unaffected: the reboot is deferred while a tape is
  armed (`:870`), and a tape boot stages its own declaration. **No committed tape re-records.**
- **The solver's JS walk:**
  - One measured refutation is on record in the code: CI 40541497513. L32's Times report delivered a Seal at the
    kill, the page rebooted in place, and the plan was refuted (2/0/1). It was patched by `encounterHoldsDelivery`
    (`jsRuntimeCore.js:1317-1328`).
  - No other measured case was found. The L40 loop above would end any walk after such a pickup (the walker
    observes every death). The GameSpeed fixture walks through a reboot (L86 chest → L0) without harm, because its
    room has no killed enemy or open activator to lose.
- **Wasm runtime:** not touched. The wasm game applies the write live through BridgeGeneric. Its delivery gate is
  `wasmPlayback.encounterReportServed`.
- **Node survey:** not touched. `scripts/procgen/seedling-divergence-bare.mjs:136` only teleports (`new Game`),
  never delivers.

## 5. The cure, per delivery kind

### A — apply live, rebuild nothing (RECOMMENDED)

One new `levelRun` entry point, e.g. `run.deliver(change)`, called by `jsRuntimeCore.applyItem` in place of
`deferredReboot = true`:

| Kind | Live write in the run | What reacts live (already does) | New model work |
|---|---|---|---|
| flag | `applyItem(inventory, name)`, the same call `applyGrantsFor` makes mid-run (`levelRun.js:5630`) | `syncSlotsAtTail` appends the slot at the frame tail (`:953`) as `Inventory.addItemsFromSave` does live. Weapons, shields, swim, torch and hazards read `inventory` at use time. | Expose the grant path without its level gate. Check whether the `worlds` memo (`worldFor`, keyed by level only) must drop OTHER levels' memo when an `ADDED_TIME_PROPERTIES` flag (Fire) changes, so the next L48 entry builds without Karlore. The current visit keeps him, as the game does. |
| key | `keys.add(i)` | BossLock opens on contact (`activators.js:850`) | none |
| totem | `totemParts.add(i)` | `totemGateNow` / the Wand gate (`levelRun.js:3807`, `:15556`) | none |
| seal | `sealParts[slot] = id` | final door (`:16295`), `chestsSealRemoved` (`:4091`) | turn `HAS_ALL_SEAL_PARTS` (`:14892`, read `:8091`) into a live read, so the 16th seal removes the room's chests on the next tick (`Chest.update`→`checkBySeal`). ⚠ CHESTSEAL fidelity key. |

On the `jsRuntimeCore` side:
- Keep the session ledgers (`flags`, `heldKeys`, `sealSlots`, `heldTotems`) exactly as now; they still stage the
  next real boot.
- Update `bootItems` on a delivered flag, so `foldGainedItems` does not count it as gained.
- Keep the **tape** deferral: apply when the tape finishes, as today. Writing into a tape's run mid-stream would
  desync it.
- Ceremony deferral: the game applies during dead frames (`drainItems` runs on held frames), so a live write needs
  no ceremony gate. Keeping it is harmless.
- `encounterHoldsDelivery`: keep it until fidelity-22 says the live write cannot refute a leg. A flag adds a slot
  but the plan presses none.
- `rebootInPlace` remains only for the RE2 restore.

- **Files:** `seedlingDemo/levelRun.js` (+~60–90: the method, its docblock, the seal live read),
  `seedlingDemo/jsRuntimeCore.js` (−~25 / +~40).
- **Tests restated:** the ~8 vitest files and 2 in-app rows in §4.
- **New pins:**
  - L40: no boot event on a delivery; the bobsoldier stays dead; ctor unchanged; 0 deaths in N idle ticks
    (`probe-reboot.mjs l40` is the shape).
  - L39: the three locks stay open after the Seal.
  - L40: a delivered key opens a BossLock in the same visit.
  - The 16th seal removes a chest live.
- **Re-records:** no tapes. TT rows in the seedling-js batch, plus a page/graphics check that G7's fade logic needs
  no case for a delivery any more (nothing reboots).
- **Fidelity keys:** CHESTSEAL (the seal read). STAGEDHITS' `carriedDamage` loses its delivery caller: the same
  `Player` simply continues, which is closer to the game.
- **Risk: medium.** The run's state digest changes exactly where the live state changes. No committed digest pin was
  found that crosses a delivery; to be confirmed by the fix's CI.
- **Fixes:** both reports, for every kind, and removes a whole class of "the room forgot what I did".

### B — stopgap: reboot, but keep the room's entry as the ctor

Boot at the live position with `worldCtor` = `arrival` (the room's entry). This fixes the **death loop's respawn
point only**: L40's bobsoldier still comes back and the L39 locks still shut. `levelRun` has no "spawn ≠ ctor"
staging, and the game has no such state either, so this invents one. Size ~40 lines + a staging field + tests.
**Not recommended.**

### C — stopgap: reboot that preserves non-persisted room state

Snapshot every per-visit map (chasers, activators, pushables, spinners, crushers, turrets, bulbs, tile writes,
bridges, ropes, …) and restore it into the new run. It is large and fragile: every new entity family must join or
it silently resets. It is still a rebuild the game does not do. **Not recommended.**

### Recommendation

**A.** Each kind's live write is a line or two on state the run already holds and reads live. The work is exposing
it, making one seal read live, and restating the tests that pinned the reboot. B and C keep a mechanism the game
does not have and fix only part of what Robert saw.

## Side findings (not acted on)

1. For keys and totems the reboot's stated purpose doesn't hold: the model's build ignores held keys and totem
   parts (§1a). Separately, the model never models `BossKey.check()` / `BossTotemPart.check()` removing a held one
   at a **real** room entry. That is a fidelity gap for fidelity-22.
2. The rebooted ctor is a float (`879.6251297839632, 825.100995790727`). The game's constructor takes ints.
3. The walker's location goal cannot target an untagged vanilla `totempart` (`walkTo` → "level 39 has no
   totempart with tag null"). That is why L39 was driven by the committed tape.

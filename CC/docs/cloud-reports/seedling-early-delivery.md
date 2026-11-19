# seedling-early-delivery — an item the server sends before the Seedling page has finished loading is not dropped, on wasm or JS

Cloud slice for js-21 (`seedling-js-planning-21`). ⚖ Robert, 2026-11-18T15:36:30Z: *"Measure both wasm and js. I don't
want either to drop items that arrive from the server early."* The target: **neither runtime drops an early server item;
an early item is applied once loading finishes, exactly once.** fidelity-22 reviews.

- **Base:** `origin/main` @ `e390574969`, merged with `--no-ff` with `origin/js-live-delivery-remerge` @ `02ce8ec413`
  (TRAIN 148) = `b09ceca4`. The merge was clean: no conflicts, the constants census `--check` PASS without a `--write`.
- **Branch:** the harness pinned **`claude/seedling-early-delivery-drops-sleqyw`**. There is no `seedling-early-delivery`
  branch.
- **Bootstrap:** `session_bootstrap.sh --all` READY. The wasm submodule is `9968c7dda4` (unchanged). The browser probes
  ran headless logic-only (`HEADLESS_LOGIC_ONLY_ARGS`), as `probe-seedling-seal-delivery.mjs` does.
- **Evidence:** `CC/docs/cloud-reports/seedling-early-delivery-evidence/`.

## Summary for Robert

**The wasm runtime dropped nothing.** On the real page, an early item reached the game in every window I could drive:
before the panel opened, before ▶ Start, during the AP load, and in the same moment as a teleport. The game's own
level-set load does wipe keys, seals and totem shards. The panel puts them back on its next push, in about 2 seconds.
No change to the Seedling binaries was needed.

**The JS runtime dropped one item on the real page: Health.** A Health that arrived before loading finished was lost.
The run kept 3 hearts while the panel's readout said 4, so nothing ever sent it again. The cause was that each JS boot
staged `hitsMax` under a field nothing reads. It affected every boot, not only early ones.

The JS core also lost keys, seals, totem shards and flags when the level set mounted or the save was restored. That is
the "item 8" bug from the live-delivery slice. On the page, the panel re-sent these, so they came back 2–2.6 s later.

**Fixed, host-side, in `jsRuntimeCore.js`:**
1. Health is now staged where the boot reads it.
2. A mount or a save restore keeps what the server delivered. The next boot applies it, once.

After the fix, every window on both runtimes holds every item, once (tables below). On JS the items are held from the
first frame after loading, not 2 s later. Acceptance md5 unchanged, no tape, solver or fidelity file touched.

## 1. Where an "early" item goes — the two maps

An AP item reaches the game only one way, on both runtimes:

1. The client's `ReceivedItems` writes the AP inventory (the state manager).
2. The panel's adapter rebuilds the game's writes from that whole inventory on every push. It does not keep its own
   queue: `FlashBridgeAdapter._buildItemWritesFromInventory`, `flashBridgeAdapter.js:622`.
3. The writes go to the page every 100 ms (`WasmBridgeAdapter._pushTick`, `wasmBridgeAdapter.js:183-194`).

So an item can never be lost while it sits in the inventory. It can only be lost after a write lands, if something in
the game resets it and the adapter does not write it again. The adapter writes again only when the game's readout says
the item is missing:

- **property items** are written on every push;
- **key / fill items** are written only while the readout lacks them (`_setIfMissing` `:840`, `_resolveFill` `:792`),
  at most once per `METHOD_RETRY_TICKS` = 30 pushes while unanswered.

### 1a. JS runtime (`frontend/modules/seedlingDemo/jsRuntimeCore.js`, line numbers at the fix)

| # | window | where the item goes | survives? (tip `b09ceca4`) |
|---|---|---|---|
| J1 | page loaded, panel not opened | the AP inventory only (no adapter yet: `flashPanelUI.js:1777`) | yes: it waits |
| J2 | game page up, bridge not ready | adapter exists, `gameReady` false, writes withheld (`flashBridgeAdapter.js:590`), flips on the first report (`:463`) | yes: it waits |
| J3 | bridge attached, AP load in flight (the vanilla first frame runs, `Main.as:51`) | `applyItem` (`:1357`) → the ledgers (`flags`, `heldKeys`, `sealSlots`, `heldTotems`) + `pendingDeliveries`, written live at the next boundary (`applyDeliveries` `:1221`) into the vanilla L0 run | yes, into a run the load is about to replace |
| J4 | **set mount** (`botLoadLevels` → `mount` `:1574`) | `heldKeys` / `sealSlots` / `heldTotems` CLEARED (`:1588-1590`); `session` = null; `flags` kept | **NO** for key / seal / totem in the core. The page recovered them by the adapter's re-send (2.1–2.6 s) |
| J5 | the set's start boot (`teleport` → `boot` `:661` → `stageSession` `:714`); and any boot in the same tick (a teleport) | the ledgers are staged into the new run; `pendingDeliveries` dropped (`:707`). `flags` are staged as `seam.items`, and **`items.hitsMax` is read by nothing** (`SEAM_BOOT_SPEC`'s row is `hits_max`) | **NO for Health**, core and page: the run boots with 3; `flags.hitsMax` (and the readout, `valueOf` `:1440`) says 4, so the adapter's `hitsMax=4` write is a no-op forever |
| J6 | RE2 restore (`_bindJsSave`, `flashPanelUI.js:1999` → `seedlingJsSave.js:69` → `restoreSave` `:1297`) | the ledgers are REPLACED by the save; `pendingDeliveries` dropped (`:1329`); a reboot in place stages them | **NO** in the core for what the save lacks (an item newer than the save: sword, seal); Health in every case (J5). The page recovered sword/seal by the re-send, never Health |
| J7 | a ceremony / an armed tape / an encounter leg's own report | `applyDeliveries` waits (`:1223`); the ledgers hold it | yes: held, then written live. Pinned by TRAIN 148 (`jsRuntimeLiveDelivery` L39 ceremony row, tape row; `jsRuntimeEncounterLegWalk` Bob) |
| J8 | a door / level transition | in-run (`enterWorld`): no boot, no ledger reset; the next boundary writes it live | yes (the "control" case) |

### 1b. wasm runtime (the game is the SWFRecomp binary; `BridgeGeneric` polls `getItemQueue` each frame)

| # | window | where the item goes | survives? (tip) |
|---|---|---|---|
| W1 | page loaded, panel not opened | the AP inventory only | yes |
| W2 | game page up, ▶ Start not clicked | the adapter waits for the bridge (`flashPanelUI.js:1814`), then `gameReady` (`flashBridgeAdapter.js:590`) | yes |
| W3 | bridge attached, AP load in flight | written into the running game before the set is handed over. **The game's level-set load resets the save arrays**: the trace shows `hasKeySet(0,true)` pushed again right after `setDelivery` | yes. The adapter re-sends: the key within one push, the seal and totem after the 30-push throttle (1.98–2.76 s) |
| W4 | a teleport (`new Game`) in the same moment | the game's statics / `SAVE_FILE` survive a `new Game` | yes |
| W5 | the Playback Bot driving (`seedlingWasmPlayback.js`) | `engageGate` (`:1993`) admits the inventory as it stands, and `gateFilter` (`:2025`) holds back only a LATER visible delivery until a safe point | not an early case (an item from before the drive is admitted); unchanged, `seedlingWasmPlaybackDelivery.test.js` 43/43 |
| W6 | a page reload | the wasm game keeps no host save: a reload is W1 again | — |

## 2. How it was measured

Two instruments, both in the evidence dir. No live AP server exists in the harness.

- **The real page** — `probe-early-delivery.mjs`, built on `probe-seedling-seal-delivery.mjs`'s boot.
  - Setup: `seedling_playthrough` loaded by `?rules=` into the full frontend. The flash panel mounts the JS or wasm page
    and the AP load delivers its set.
  - The "server" is the AP inventory (`stateManagerProxy.addItemToInventory`): the sink `ReceivedItems` writes.
  - Each window is a fresh browser context.
  - Items granted: Progressive Sword (a slot flag), Red Key (a method item), Seal ×1 (a fill log), Totem Shard ×1 (a
    fill set), and Health (an `add`, `hitsMax` 3 → 4, which detects a double apply).
  - Read after the load, for up to 20 s plus 3 s: the **live** state. J reads the run's `inventory` / `keys` /
    `finalDoorGate.sealSlotsFilled` / `saveState.totem_parts`, not the ledger or the readout. W reads the game's
    `readState` + `botStatus.save`.
  - A trace records each adapter push and the set hand-over (`glue.setDelivery`), with ms timestamps.
- **The JS core, in node** — `probe-core-windows.mjs`.
  - The real `FlashBridgeAdapter` (shipped `games/seedling.json`) is wired to the real `createJsRuntime` the way
    `jsRuntimePage` wires them.
  - Mode **once**: the adapter's first push that carries the items, then nothing. This is the core on its own.
  - Mode **adapter**: the adapter keeps pushing every 3 ticks. This is the page.
  - Windows are deterministic: the vanilla first frame then mount (J3→J4), mounted with no run (J4→J5), the same queue
    as a `new Game` (J5), the restore of an older save (J6), the restore of a save that already holds the items
    (J6, the double-apply case), and the control.

Verdict per cell: **APPLIED** (held once), **DROPPED** (not held), **TWICE** (Health > 4, more than one seal slot or
totem part).

## 3. Before (tip `b09ceca4`, no source change)

**Real page** (`before-tip-b09ceca4.log`; the J teleport row re-run on the clean tree in
`before-tip-b09ceca4-J-teleport-rerun.log`, because my first edit was briefly live while that row ran):

| runtime | window | sword | key | seal | totem | Health |
|---|---|---|---|---|---|---|
| J | pre-panel (J1) | APPLIED | APPLIED | APPLIED (2090 ms) | APPLIED (2090 ms) | **DROPPED** |
| J | pre-start (J2) | APPLIED | APPLIED | APPLIED (2186 ms) | APPLIED (2446 ms) | **DROPPED** |
| J | in-load (J3→J4) | APPLIED | APPLIED | APPLIED (2623 ms) | APPLIED (2623 ms) | **DROPPED** |
| J | post-load (control) | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | teleport | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | reload | APPLIED | APPLIED | APPLIED (2444 ms) | APPLIED (2444 ms) | **DROPPED** |
| W | pre-panel | APPLIED | APPLIED | APPLIED (2463 ms) | APPLIED (2463 ms) | APPLIED |
| W | pre-start | APPLIED | APPLIED | APPLIED (2042 ms) | APPLIED (2042 ms) | APPLIED |
| W | in-load | APPLIED | APPLIED | APPLIED (2760 ms) | APPLIED (2760 ms) | APPLIED |
| W | post-load (control) | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| W | teleport | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |

(ms = from the AP load's end to the first read that held it; an unmarked APPLIED was held at the first read.)

- Every J Health DROPPED reads `hitsMax` **3** in the run against a readout of **4**.
- J teleport: the grant is async, so it landed after the boot; the node `same-boot` row is the deterministic case.
- J reload: no RE2 save was in storage at reload time (`savedKeys: []`), so the row ran as a second pre-panel. The
  restore window is measured in node.

**JS core** (`core-windows-before-tip-b09ceca4.out`):

| mode | window | sword | key | seal | totem | Health |
|---|---|---|---|---|---|---|
| once | first-frame | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| once | vanilla → mount | APPLIED | **DROPPED** | **DROPPED** | **DROPPED** | **DROPPED** |
| once | mounted, no run | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| once | same queue as `new Game` | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| once | after `new Game` | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| once | restore (older save) | **DROPPED** | APPLIED | **DROPPED** | APPLIED | **DROPPED** |
| once | restore (save holds them) | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| once | control | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| adapter | first-frame | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| adapter | vanilla → mount | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| adapter | mounted, no run | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| adapter | same queue as `new Game` | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| adapter | after `new Game` | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| adapter | restore (older save) | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| adapter | restore (save holds them) | APPLIED | APPLIED | APPLIED | APPLIED | **DROPPED** |
| adapter | control | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |

No TWICE anywhere.

## 4. The fix (`frontend/modules/seedlingDemo/jsRuntimeCore.js`, commit `73007fb5`; +53 lines, one file)

1. **Health is staged where a boot reads it.** `stageSession` (`:714`) now writes `staging.seam.hits_max =
   flags.hitsMax`, and only when it is above the base 3, so a run without Health stages byte-identically (`:728`).
   `createLevelRun` reads `hits_max` → `save.hitsMax` → `inventory.hitsMax` (`seamFieldsFromBlock`, `levelRun.js:893-897`).
   This cures J5 and the Health half of J4/J6.
2. **A mount or a restore keeps what the host delivered** (the cure for J4/J6; item 8 of
   `seedling-js-item-live-delivery`).
   - `hostDelivered` (`:415`) records what the host's own writes set. `applyItem` adds to it at `:1365` (keys), `:1379`
     (seal identities), `:1390` (totems) and `:1407` (the last value written to each flag).
   - `reseatHostDeliveries` (`:1345`) puts it back into the ledgers. Keys and totems are a union. Seal identities are
     appended to the log's filled prefix only where it lacks them, which is the guard against applying twice. Flags
     take the host's last write.
   - It runs after `mount`'s clears (`:1593`) and after `restoreSave` sets the save (`:1321`).
   - **Nothing is handed to a run here.** A mount drops the session and a restore reboots in place, so the next boot
     stages the ledgers once (`stageSession`). The readouts then hold the items, so the adapter writes nothing more.
   - **What still goes:** what the OLD set's runs earned, and a restored save's own keys. A mount still clears those,
     as `jsRuntimeSave.test.js`'s "a NEW SET clears everything a restore put back" requires (green). The new
     "mount still drops …" row pins the split.

This reuses the existing machinery: the ledgers, the boot staging and the adapter's set-if-missing. It adds no second
queue, and there is no wasm-side change.

## 5. After (fix `73007fb5`)

**Real page** (`after-fix.log`): **every cell APPLIED on both runtimes**.

| runtime | window | sword | key | seal | totem | Health |
|---|---|---|---|---|---|---|
| J | pre-panel | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | pre-start | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | in-load | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | post-load | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | teleport | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| J | reload | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| W | pre-panel | APPLIED | APPLIED | APPLIED (2195 ms) | APPLIED (2195 ms) | APPLIED |
| W | pre-start | APPLIED | APPLIED | APPLIED (2031 ms) | APPLIED (2031 ms) | APPLIED |
| W | in-load | APPLIED | APPLIED | APPLIED (1981 ms) | APPLIED (1981 ms) | APPLIED |
| W | post-load | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |
| W | teleport | APPLIED | APPLIED | APPLIED | APPLIED | APPLIED |

- **JS:** every item is held at the first read after the load (14–140 ms), with `hitsMax` 4.
- **JS notes:** the core's notes show no delivery after the `MOUNT` in the early windows. The boot staged the items;
  nothing was re-sent.
- **wasm:** unchanged by construction (no wasm-side code changed). The ~2 s for the seal and totem is the game's own
  set-load reset followed by the adapter's throttled re-send. Nothing is lost.

**JS core** (`core-windows-after.out`): **all 16 rows × 5 items APPLIED, no TWICE.**

## 6. Pins and mutants

`frontend/modules/seedlingDemo/jsRuntimeEarlyDelivery.test.js`, 14 rows, all green. It uses the real adapter and the
real core in the panel's order, and each row asserts the LIVE run.

- **ONCE** (one push carries the items; `carried === 1` asserted): `vanilla`, `mounted`, `sameBoot`, `restore`,
  `restoreHeld`, and `control`.
- **ONCE, vanilla, step by step:** the items are written into L0, survive the mount in the save, and the start boot
  stages them with no delivery note after the mount.
- **ADAPTER:** the same six windows.
- **The mount still drops the old runs' and a restored save's keys and keeps the host's:** `[0, 2, 3]` → `[0]`.

At tip `b09ceca4` the file is 10 red / 2 green (the two control rows); it was written before the fix.

Mutants (`mutants.out`): each was applied to the source, measured red, and reverted.

| id | mutation | red |
|---|---|---|
| e1 | `stageSession` without the `hits_max` line | 11 rows (every Health row, ONCE and ADAPTER) |
| e2 | `mount` without `reseatHostDeliveries()` (item 8 back) | ONCE vanilla, the vanilla step-by-step row, the "mount still drops" row |
| e3 | `restoreSave` without `reseatHostDeliveries()` | ONCE restore |
| e4 | the seal re-seat without its `includes` guard (**drain twice**) | `restoreHeld` ONCE and ADAPTER: two seal slots for one Seal (TWICE) |
| e5 | `applyItem` does not record the host's seal | ONCE vanilla, ONCE restore, the vanilla step-by-step row |

TRAIN 148's pins (a) and (b) in `jsRuntimeLiveDelivery.test.js` stay green, inside the bounded run below. A new boot
still stages no old run's recorded `deliveries`. The re-seat writes the ledgers, never `staging.deliveries`.

## 7. Gates

- **Bounded vitest:** every default-tier test file that imports `jsRuntimeCore.js` directly or through one of its five
  source importers (`fidelityF2`, `fidelityStepOff`, `jsRuntimePage`, `wasmArrival`, `wasmWalkTape`), found with
  `grep -a -l`.
  - **101 files, 2295 tests, all passed** (fix in the working tree).
  - That set includes `jsRuntimeLiveDelivery`, `jsRuntimeSave`, `seedlingWasmPlayback.test.js` and
    `seedlingWasmPlaybackDelivery.test.js`.
  - Plus the new file: 14/14.
  - The file list is `vitest-bounded-files.txt`; the summary is `vitest-bounded-summary.txt`.
  - Not run: the 4 slow-tier importers (`jsRuntimeTape.slow`, `jsRuntimeSolverCalibration.slow`,
    `seedlingGenGoalChestPipeline.slow`, `seedlingGenGoalLootSweep.slow`) and the train tier. No unfiltered vitest (⚖ 52).
- **Acceptance:** `node scripts/procgen/batch-seedling-acceptance.mjs | md5sum` = **`391322d681b7aa0229d94b3f6906d024`** ✅.
- **Engine closure** (`--print-engine-closure`, 42 files, `engineMd5 bec369878feb…`) ∩ diff = **∅**.
- **Constants census** `--check` PASS (7133 literals, 0 drift).
- **No** solver, hammer, fidelity-key, generator, preset, tape or fixture change. No binary, no wasm gitlink, no
  `vendor/seedling`.
- **In-app rows that could move (js-21: please dispatch TT at the tip):**
  - **What could move:** a row whose JS run boots holding a delivered Health, or one that grants a key, seal or
    totem before an AP load mounts. None grants Health today (grep of `seedlingJsRuntimeTests.js`).
  - **`seedling-js`:** 37/37 green here at the fix (§8).
  - **`seedling-js-solver`:** not run here. Its `seedling-js-runtime-solver-fights-bob-encounter` grants sword,
    shield, Green Key and Red Key, then teleports. The boot stages them the same as before, so I expect no move.
  - **`seedling-wasm`:** nothing on the wasm side changed.

## 8. Notes and residuals

- **TT `--batch=seedling-js` at the fix (local, `73007fb5`):** **37/37 passed**, 0 not run (3.9 min;
  `tt-seedling-js-at-fix.txt`). `seedling-js-solver`, `seedling-wasm` and `train_only` were not run here.
- **Side finding (pre-existing, from TRAIN 148, not this slice):** `probe-seedling-seal-delivery.mjs --only=J`, row 3,
  FAILS at `b09ceca4`. It asserts *"the booted run holds the 16 (`saveState.bootSealParts`)"*. Since live delivery,
  seals are written into the LIVE run (`finalDoorGate.sealSlotsFilled`), not staged by a boot, so `bootSealParts` is
  `[]`. The seal log itself is full (its row 3a PASSES). The probe's J row needs restating to read the live slots. That
  is js-21's call; I did not touch it.
- **The wasm game resets its save arrays at its own level-set load** (W3). Nothing is lost, because the adapter
  re-asserts the inventory. A fix inside the game is not needed for this ruling and would be a binary change (ASK FIRST).
- **Not measured as separate cells:** a ceremony and an armed tape (J7) hold and then apply; TRAIN 148 pins that. A
  door crossing (J8) has no boot or reset, so it is the control. The wasm Playback Bot's gate (W5) does not hold an item
  from before the drive.
- **Nothing needs the binaries.** No STOP.

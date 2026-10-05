# Seedling fidelity SLOTS — the inventory's slot order is session state (+ two BURN residues)

| | |
|---|---|
| Session | `seedling-fidelity-slots` (Opus, cloud), planner `seedling-fidelity-planning-2`, wave 5 |
| Start SHA | `f90c4ee` (`origin/main`) |
| Head | the last commit on the branch (this report's identity fill) |
| Harness branch | `claude/inventory-slot-order-dgpk7c` |
| Commits | `7ed06fa` D1+D2 · `45ccd4d` D3 · `7cae798` D4 + records · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS** (two banked reds and one JS-arc pin, below) |

## The one thing to know first

**The game's slot array is the order the items ARRIVED, and the model now carries it as state.** The new staging field is `inventory_slots` (snake_case, the `botStatus` readout's own name). It is optional, and no tape carries it. A staging built from a live game should pass `status.inventory_slots`; the run and the solver then plan in the game's order. Once it does, the JS arc's `slotOrderRefusal` can stand down.

Two findings came out of the witnesses, both MEASURED on the game:

1. **A grant's item reaches the array only in its frame's TAIL.** That frame's equip check and its X press read the array without it. The first recording of the D3 witness disarmed the bot: *"equip at tick 0 selected slot 1 but the inventory holds 1 item(s)"*.
2. **The burnable tree's geometry fencepost was off by one.** The game blocks the player on the update that enters at `goneAt - 1`. The model used to free the cell there. Every earlier burn witness waited past that update, so none had measured it.

## W0 (at `f90c4ee`, pristine worktree `/home/user/w0-base`, before any edit)

⚠ My first W0 attempt ran in the primary tree while I had started editing, so I killed it by PID and re-ran everything in a detached worktree at the base. The worktree had symlinked `node_modules` and submodules and its own server on :9331.

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9331 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`2a0db7c4ce602f0a4489569593eac2f9`** |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, **all exit 0** |
| reference | the block's last row | *"4 GENERATED MODULE(S)/REGION(S) DIFFER"* in the worktree (see residue) |
| tapeRunner | bounded vitest, sorted `(fullName, status)` lines | **501/501**, md5 **`51829dac294c79fba6ed687124fdaf96`** |
| surface / constants / profile / entities | the four `--check`s (primary tree, before edits) | **GREEN 198** · **4,968, 0 drift** · **PASS 138** (both JSONs) · **PASS 518** |
| roster | `fixtures/tapes/index.json` | **222** |
| bounded vitest BEFORE | 38 files (below) | **38 files / 1,980 tests, all green** |

The 38 files: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `rosterCategories`, `levelRun`, `tapeRunner`, `tapeFormat`, `solverBot`, `solverEncounter`, `fidelityBurn`, `wasmEquips`, `wasmDelivery`, `fireVerb`, `r4Acceptance`, `r7Acceptance`, `blockRoute`, `breakableRocks`, `fidelityL14`, `jsRuntimeSolver`, `jsRuntimeVerbs`, `wasmPlayback`, and `flashPanel/seedlingWasmPlayback` + `seedlingWasmPlaybackDelivery` (read-only). That is my region's tests plus every test naming `inventorySlots|inventory_slots|equipNow|primaryWeapon|inventorySlotsFor`.

## D1 — the game's rule (PASS, measured)

**The AS3** (read-only, `vendor/seedling` at `f8d9bc1`):
- `Inventory.items` is a `private static var` (`Inventory.as:51`).
- `addItemsFromSave` (`:291-332`) runs inside `inventory.update()`, which `Game.update` calls in the frame's TAIL, after `super.update()` and outside the `blackCover` gate (`Game.as:1044`), but only while `canInventory()`. It adds an id only when `!hasItem(id)`, in three blocks: sword; fire, wand; spear.
- The fusions are the only removals. Ghostsword runs `removeItem(0); removeItem(3); addItem(4, 0)`; firewand runs `removeItem(1); removeItem(2); addItem(5, 1)`.
- `removeItem` (`:109-120`) splices without stepping back, then sets `Main.primary %= items.length` (and `secondary`). On an emptied array that is `% 0` = NaN, which `set primary(_t:int)` stores as 0.
- A flag that goes false removes nothing.
- `clearItems` is called only by `Main.clearSave` (new game from the title, `Game.as:1288`, the debug warps) and `Main.freshSaveForLevelSet`. `Bot.botStart`, `botLoadLevels` and the seam block call neither.
- `Player.useItem(i)` switches on `Inventory.getItem(i):int`. An index past the end is `undefined`, coerced to **0** (the sword's id), so case 0 runs `slashing = true` behind `set slashing`'s `hasSword || hasGhostSword` guard.
- `Main.primary` is what X uses and `Main.secondary` what C uses; both are indices into `items`. The inventory menu's X/C assign `selected` to them (`:210-216`).
- `Bot.update` order per observation: record, `applyGrantsFor`, `applyEquipsFor`, `drainEquipChecks` (which returns early while `itemCount <= 0`), then the key edges.

**Measured** (`scripts/procgen/probe-seedling-slot-order.mjs`, p4f headless logic-only, `fixtures/slot-order-oracle.json`). Each arm is BURN's L24 staging, idle 4 ticks; multi-window arms run on ONE page, the model staged with the previous window's array:

| arm | game `inventory_slots` / primary | model |
|---|---|---|
| FIRE-FIRST (seam Fire, the sword granted at L24) | `[1,0]` / 0 | `[1,0]` / 0 |
| CANONICAL (seam both) | `[0,1]` / 0 | `[0,1]` / 0 |
| NO-REBUILD (FIRE-FIRST, then the CANONICAL tape as window 2) | `[1,0]`, then `[1,0]` | same |
| FUSION (FIRE-FIRST; then + wand, primary 2; then + fire wand) | `[1,0]`, `[1,0,2]`/2, **`[0,5]`/0** | same |
| PRESS (`slots-l24-fire-first`) | `[1,0]`/0, tree `{24,0}` burned, ends L12 | burns once, ends L12 |

`ALL CHECKS PASSED` (8 rows). AP grants travel the same flag-write path (the panel's item writes set `Player.has*`), so they append like a tape grant. Pickups write the flag in `removed()` and append in a later tail.

## D2 — the model (PASS, game-witnessed)

**Change** (`7ed06fa`):
- `tapeFormat.appendInventorySlots(slots, items, {primary})` is the transcription above. `inventorySlotsFor(items)` is now `appendInventorySlots([], items).slots`, identical to the old fixed order for all 64 flag sets (pinned).
- `inventorySlotsRefusal` refuses a staged array the model cannot carry, by name: a non-item id, a duplicate, or a slot whose flag is false. The game can hold that last case, but its press is gated on a flag the model does not track.
- `levelRun`:
  - `inventorySlots` parameter (null = a fresh game's `[]`);
  - `slotOrder` state, synced after the seam (the boot's dead frames), in every frame's tail (`syncSlotsAtTail`, frozen ticks included), and at a ceremony's item (immediate, as before);
  - grants no longer sync at the write;
  - the equip bound moves to `drainEquipChecks` timing (top of the tick, deferred while empty);
  - `weaponForPress` reads an out-of-range index as the sword when held;
  - new `progress('inventorySlots')`.
- `tapeRunner.createRunForStaging` passes `staging.inventory_slots ?? null`. `stagingFromTape` does NOT copy it: no tape carries it.

**Witness** `slots-l24-fire-first` (164 t, recorded on the game, model = game). The seam holds Fire and the sword is granted at L24. The keys are the solver's plan for the same leg with no sword: one X press, no equips. The press burns the tree because slot 0 is Fire. The control (both items in the seam, `[0,1]`) slashes, and the walk ends in L24 (pinned in `fidelitySlots`).

**Mutants** (copy + restore, md5 identical):
- M1, `appendInventorySlots` starting from `[]` (the old re-sort). Predicted: the order rows, the D2 witness and D3 go red. Got **13 red**: D1 FIRE-FIRST / NO-REBUILD / FUSION, the append row, the staged / tail / drain / witness rows, both D3 rows, and tapeRunner's two differentials plus one stepping row.
- M2, a grant syncs at the write (the old timing). Predicted: the tail row, the drain row and D3's idle tick go red. Got **4 red**: those three plus the empty-array deferral row.

## D3 — the solver (PASS, game-witnessed)

**Change** (`45ccd4d`, `solveSegment` before the goal loop). If `primaryWeapon` is `'fire'` and a sword or ghostsword is held, the solver equips the sword's slot, found by id in `progress('inventorySlots')`. When that slot is not in the array yet (a grant on this observation), it advances one idle tick first. `execBurn`'s Fire slot and the Bob encounter's Fire slot are read from the run's array. The solver door exports `INVENTORY_ITEM_IDS`, and the `inventorySlotsFor` row retires.

**Measured before the fix.** From the Fire-first staging the solver "solved" in 164 t: its dash presses at t0/14/26 were FIRE presses, because the strike policy presses `primary` believing it is the sword.

**After the fix:**
- Fire-first: 125 t, `[{1,1},{61,0},{115,1}]`, the vanilla plan's keys one tick later with arrival-order indices.
- A STAGED `[1,0]`: `[{0,1},{60,0},{114,1}]`, 124 t.
- Vanilla: unchanged (124 t, `[{60,1},{114,0}]`).

**Witness** `slots-l24-burn-fire-first`, recorded on the game, model = game: `[1,0]`, primary 1 at the end.

**Mutant** M3 (the re-select disabled): predicted both D3 rows and wasmEquips K=80/K=110 go red. Got **4 red**, exactly those.

## D4 — BURN's residues (PASS, game-witnessed)

**(a)** `resolveBurnStrategy`: a tree in `treeBurns` and not yet in `burnedTrees` resolves to `{strategy:'burn', wait:true, goneAt}`. This is asked before the Fire gates (no Fire is needed to wait). `execBurn`'s wait arm idles until it is gone, bounded by `goneAt`.

**(b)** D3's rule: a continuation cut after `execBurn` selected Fire selects the sword's slot on its first tick.

**Measured.** I built the cuts exactly as the wasm engine continues a held room: `arrivalSolveRequest` → the plan, cut at K, `continuationSolveRequest` with a lead tick → `solveFromTape`, played as ONE tape.
- K=80 (mid-burn): it used to refuse *"Strategy 'burn' failed to apply"*. Now it gives equips `[[0,0]]`, verbs `burn, walk`, and reaches L12.
- K=110: `[[0,0]]`, `walk`, L12 (it used to cross with Fire selected).

**The fencepost (found by the witness).** The first `slots-l24-burn-cut-80` recording REFUTED the model at t105: game y 124.75, model 125.55. On the game the update entering at t104 (= `goneAt - 1`) is still blocked and the one at t105 is free. That matches `burn-write-oracle` (the write lands with the `goneAt + 1`-tick cut, the update `die()` runs in). `levelRun.burnedTreeIdsNow` now asks `burnedTreeIds(…, ticksCompleted)`; it asked `+ 1`, argued from `World.updateLists`.

**Witnesses**, recorded on the game, model = game:
- `slots-l24-burn-cut-80` (115 t);
- `slots-l24-burn-cut-110` (121 t);
- `slots-l24-burn-fencepost` (115 t: cut-80 with its walk one tick earlier, the first key on t104; the game blocks it on t104, exactly as in the refuting recording).

I also replayed all six L24 tapes against the live game in compare mode: **145 PASS, 0 FAIL**.

**Mutants:**
- M4 (the alight arm nulled): wasmEquips K=80 red, as predicted.
- M5 (`+ 1` restored): I predicted cut-80's differential would go red. **It did not**, because the fixed cut-80 waits one tick longer and never touches the boundary. That is why I added `slots-l24-burn-fencepost`. With it, M5 reds the fencepost differential (t105) and wasmEquips K=80, as predicted.

## For the JS arc

**Wire.** Stage `inventory_slots: status.inventory_slots` on every staging a live game builds: arrival, continuation, delivery. Then `slotOrderRefusal` can stand down, and so can `equipSlotRefusal`'s "the game appends a late slot" arm (the model now appends too). `createRunForStaging`'s signature is unchanged. The field is optional and validated by name (`inventorySlotsRefusal`).

**Their pins that move at my head:**
- `wasmEquips.test.js` (in `seedlingDemo`; I updated it because it pins exactly D4's residues). K=110 now expects `[[[0,0]], 0]`, where it expected `[0,1]`. The RESIDUE row is now the D4a row: solves, `[[0,0]]`, `burn, walk`, no key before t105.
- ⛔ **`flashPanel/seedlingWasmPlaybackDelivery.test.js` "the SLOT LAG …" is RED and I did not edit it** (theirs). Its fixture is the game at `[0]` with primary 1. With `getItem`'s out-of-range read transcribed, the room's dash presses are sword dashes in the model, as the test's own comment says the game reads them ("past the end: reads 0, the sword"). So staging the spear at the arrival really would change those presses, and the gate defers with `prefix` (*"with hasSpear staged at the arrival the shipped prefix leaves the model elsewhere at tick 3 of 88"*). The model is right; the fixture needs a room whose prefix presses nothing (e.g. `dashMode: 'none'`, or the slot lag staged at primary 0 on an empty array).
- `wasmDelivery.slotsAfterDelivery` leaves `primary` unchanged on an emptied array, where the game gives 0. `appendInventorySlots` is the shared transcription to call instead.

## Deltas

- `tapeFormat.js`: `appendInventorySlots`, `inventorySlotsRefusal`, `inventorySlotsFor` re-expressed.
- `levelRun.js`: `inventorySlots` param, `slotOrder` / `syncSlots` / `syncSlotsAtTail`, `drainEquipChecks`, `weaponForPress`'s out-of-range read, `progress('inventorySlots')`, `burnedTreeIdsNow` at `ticksCompleted`.
- `tapeRunner.js`: `inventorySlots: staging.inventory_slots ?? null`.
- `solverBot.js`: the sword re-select (+ idle tick), the run-array Fire lookups, the alight `wait` arm.
- `solverView.js`: `INVENTORY_ITEM_IDS` replaces `inventorySlotsFor`.
- New: `probe-seedling-slot-order.mjs`, `plan-seedling-slots-witness.mjs` (`--check` re-derives all five tapes byte for byte), `fixtures/slot-order-oracle.json`, `fidelitySlots.test.js` (20), five tapes + expectations.
- Records: roster 222 → **227**; R8 exposure 54 → **59**; surface GREEN **198**; constants **4,977** PASS; `boxLock` guarded + the probe; the bot log entry; the `seedling-bot.md` tape-format paragraph; the reference regenerated (instruments + docs index).

## What the brief got wrong (measured)

- *"grants APPEND"* is right, but not at the grant. The append lands in the frame's tail. An equip of the arriving item on the grant's own tick DISARMS the bot, so the solver's re-select needs an idle tick when the sword arrives at t0.
- *"at K=110 … a later X press would burn"*: right, and the cure is the same rule as D3's. No `execBurn` change was needed for (b).
- D4(a) was not only a solver residue. The model's tree fencepost was one update early, invisible until a walk entered the cell on the boundary.
- *"the solver re-selects the sword only inside `execBurn`"*: there was a second place that picked a slot by the fixed order, the Bob encounter's Fire equip (`solverBot` ~866). It now reads the run's array too.

## Residue

- `canInventory()` is not modelled: the game skips the tail append while `talking` or `!receiveInput` (a dialogue, a ceremony). The model appends every tail.
- A ceremony's item keeps its immediate sync. The game appends it in a later tail; the solver's Fire collect already waits a tick for it.
- `Main.secondary` (the C key) is carried in the seam but not modelled, so the fusion modulo on it is not carried.
- The inventory MENU's own selection (V, up/down, X/C) is not modelled. It was refused before and still is.
- The rocks' geometry query keeps `ticksCompleted + 1`, the same argument the tree's was. It is unmeasured; a boundary walk would settle it.
- The base worktree's reference row read *"4 differ"*. That worktree had symlinked submodules and untracked symlinks, and the generator reads the tree. The head's own `--check` reads ALL 7 + 5 MATCH.

## Byte-inertia

| Row | W0 (`f90c4ee`) | head | movers |
|---|---|---|---|
| identity log | `2a0db7c4…` | `5bf10815…`: **every measured row byte-identical** (maze, acceptance, the pairs, the censuses, killgates, levels, generated set, and the six `--check`s `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, all exit 0); the ONE differing line is the reference row: the base worktree read "4 differ", the head reads **ALL 7 + 5 MATCH** | **none**: no producer's walk presses through a re-ordered slot, equips on a grant's tick, or enters a burning tree's cell on the boundary update |
| tapeRunner | 501, `51829dac…` | **511, `0ce82642…`**; the 501 old `(name, status)` pairs are **identical** (`diff` adds 10 lines) | +10: the five new tapes' differential and stepping rows |
| committed tapes / expectations | — | **none modified** (`git diff f90c4ee --stat -- fixtures/tapes fixtures/expectations` adds files and edits only `index.json`) | none |
| roster | 222 | **227** | the five `slots-*` |
| surface | GREEN 198 | **GREEN 198** (`--write`, classify, `--check`) | + `import:INVENTORY_ITEM_IDS` (seedling/constant), − `import:inventorySlotsFor`, the progress fold + `inventorySlots`, site-count drift |
| constants | 4,968 | **4,977, PASS** (`--profile-rows` → `--write` → `--check`) | the two fusion splice rows re-targeted to `appendInventorySlots`, + the `% 0` rule row |
| profile / entities | 138 / 518 | 138 / 518 | none |
| bounded vitest | 38 / 1,980 green | **39 / 2,015: 2,012 green, 3 red** | `rosterCategories:175` (BANK); `seedlingWasmPlaybackDelivery` SLOT LAG (JS arc's); `boxLock` "a QUEUED taker dies on SIGTERM" red only under the concurrent identity block, **26/26 alone** |

## Rows to BANK

- `rosterCategories.test.js:175` *"expected 162 to be 166"*: the standing-values roster row. I am not licensed for `standing-values --write`; it needs a re-measure with the five tapes.
- `seedlingWasmPlaybackDelivery.test.js` SLOT LAG: the JS arc re-stages the fixture (above).
- The SUITE number comes from CI at the pushed SHA (⚖ 52): `node scripts/procgen/ci-vitest-summary.mjs <sha>`.

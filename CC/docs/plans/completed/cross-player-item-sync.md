# Cross-Player Item Sync — Spoiler Checklist Integration

**Created:** 2026-03-12
**Status:** Implemented
**Priority:** Medium

## Overview

Add a "Simulate Received Items" feature to the Spoiler Checklist panel. In multiworld games, checking a location only grants items belonging to the current player — items for other players are skipped (`locationChecking.js:134-141`). This feature simulates the reverse: granting items that other players would send to us, based on how far we've progressed through the sphere log.

The logic: look at the sphere log in order, find the first unchecked location belonging to our player, and grant all cross-player items from spheres before that point. A checkbox in the Spoiler Checklist controls enables/disables this behavior.

After this is working, the Cost Debugger's Verify tool will be updated to delegate to this module instead of computing cross-player items internally.

## Current State

### What exists today

1. **Spoiler Checklist panel** (`spoilerChecklist/spoilerChecklistUI.js`) — displays sphere log as an interactive checklist. Already tracks `checkedLocations` from snapshots, renders cross-player locations (dimmed), and subscribes to `stateManager:snapshotUpdated`.

2. **Cost Debugger Verify** (`costDebugger/costDebuggerUI.js:258-296`) — has `_computeCrossPlayerItemsBySphere()` that computes which items to grant per sphere, using the spoiler test dedup pattern. Grants items via `stateManagerProxySingleton.addItemToInventory()` with batch updates.

3. **`sphereState.getSphereData()`** — returns sphere data with cumulative `inventoryDetails.base_items` per sphere.

4. **`stateManagerProxy.addItemToInventory()`** — fire-and-forget command to worker; `beginBatchUpdate()`/`commitBatchUpdate()` available to batch multiple grants into one snapshot cascade.

### The dedup pattern (from workerSpoilerTest.js:313-351)

Each sphere's `base_items` includes ALL items the player has at that point — both from checking our own locations (same-player items) and from other players sending us items (cross-player items). Since `checkLocation` already grants same-player items, we must subtract those to avoid double-granting:

1. Get `base_items` for the sphere (cumulative inventory)
2. Identify items `checkLocation` will grant (same-player items at our locations in this sphere)
3. Subtract those → remainder = cross-player items to grant

## Design

### Feature behavior

1. A new checkbox "Simulate Received Items" appears in the Spoiler Checklist controls bar
2. When enabled, the module:
   - Scans sphere data in sphere order
   - Finds the **frontier**: the first sphere containing an unchecked location for the current player
   - Computes cross-player items for all spheres **before** the frontier (strictly less-than)
   - Subtracts items already in the current inventory (to avoid double-granting on re-sync)
   - Grants remaining items via `addItemToInventory` with batch update
3. Re-syncs automatically when checked locations change (detected by comparing `checkedLocations.length` to a cached value on `stateManager:snapshotUpdated`)
4. The panel displays a status line showing: how many items have been granted, current frontier sphere, and a manual "Sync Now" button

### Key design decisions

**Frontier = strictly before first unchecked location.** If sphere 0.98 has unchecked locations, we grant items from 0.41, 0.51, 0.80 but NOT 0.98. This is conservative: we only simulate receiving items that logically must have been sent by the time we reach the frontier.

**Inventory-based dedup.** Compare what the sphere log says we should have vs what the inventory actually contains, and grant the delta. This is idempotent — safe to re-run at any time without tracking what was previously granted. After a game state reset (e.g., Verify tool calling `resetForNewRules()`), the inventory empties, so the delta naturally recomputes from scratch.

**Count-aware dedup.** The dedup subtraction must work with item counts, not just presence/absence. If `base_items` has `{Sword: 2}` and own locations contribute `{Sword: 1}`, we grant 1 Sword. The sphere log may correctly specify multiple instances of the same item, and all must be accounted for.

**Batch updates.** All grants in a single sync use `beginBatchUpdate()`/`commitBatchUpdate()` to trigger only one snapshot cascade.

**Sync only when checked locations change.** Rather than syncing on every `stateManager:snapshotUpdated` (which fires frequently for inventory changes, region recomputes, etc.), cache the checked location count and only re-sync when it changes. This avoids unnecessary work and prevents feedback loops where granting items triggers a snapshot which triggers another sync.

### Public API (for Cost Debugger integration)

The spoilerChecklist module will expose these public functions via `registrationApi.registerPublicFunction()`:

```javascript
// Compute cross-player items for all spheres up to (but not including) the given sphere.
// Returns Map<sphereIndex, string[]> — same format as current _computeCrossPlayerItemsBySphere()
'computeCrossPlayerItemsUpToSphere': (sphereIndex) => ...

// Grant all cross-player items up to the frontier (first unchecked location).
// Uses batch update. Returns { grantedCount, frontierSphere }.
'syncReceivedItems': () => ...

// Grant cross-player items up to a specific sphere index (for Verify tool).
// Returns { grantedCount }.
'grantItemsUpToSphere': (sphereIndex) => ...
```

### Files to change

#### 1. `frontend/modules/spoilerChecklist/index.js`

- Register new public functions: `computeCrossPlayerItemsUpToSphere`, `syncReceivedItems`, `grantItemsUpToSphere`
- Register event publisher: `spoilerChecklist:itemsSynced`
- Add `stateManagerProxySingleton` import
- Create the `CrossPlayerItemSync` logic class (or import from new file)

#### 2. `frontend/modules/spoilerChecklist/crossPlayerItemSync.js` (new file)

Core logic class containing:

```javascript
export class CrossPlayerItemSync {
  constructor({ stateManager, sphereState }) { ... }

  /**
   * Find the frontier sphere — the first sphere with an unchecked
   * location for the current player.
   * @returns {string|null} Sphere index string, or null if all checked
   */
  findFrontierSphere(checkedLocations) { ... }

  /**
   * Compute cross-player items by sphere using the dedup pattern.
   * Extracted from costDebuggerUI._computeCrossPlayerItemsBySphere().
   * @param {string} [upToSphere] - If provided, only compute up to this sphere (exclusive)
   * @returns {Map<string, string[]>} sphereIndex → item names to grant
   */
  computeCrossPlayerItems(upToSphere) { ... }

  /**
   * Determine what items to grant based on current inventory.
   * Compares expected inventory (from sphere data) vs actual inventory
   * to produce the delta.
   * @param {Map<string, string[]>} crossPlayerItems - from computeCrossPlayerItems()
   * @param {object} currentInventory - from snapshot.inventory
   * @returns {string[]} Item names to grant
   */
  computeGrantDelta(crossPlayerItems, currentInventory) { ... }

  /**
   * Execute the sync: compute frontier, compute items, grant delta.
   * Uses beginBatchUpdate/commitBatchUpdate.
   * @returns {Promise<{ grantedCount: number, frontierSphere: string|null }>}
   */
  async sync() { ... }

  /**
   * Grant items up to a specific sphere (for Verify tool).
   * @param {string} sphereIndex
   * @returns {Promise<{ grantedCount: number }>}
   */
  async grantUpToSphere(sphereIndex) { ... }
}
```

The `compareSphereIndex()` helper (currently in `costDebuggerUI.js`) moves here as a shared utility.

#### 3. `frontend/modules/spoilerChecklist/spoilerChecklistUI.js`

- Add "Simulate Received Items" checkbox to controls bar
- Add status line below controls showing sync state (e.g., "Synced 7 items through sphere 0.80 | Frontier: 0.98")
- Add "Sync Now" button next to status
- On `updateDisplay()`, if checkbox is enabled, call `crossPlayerItemSync.sync()`
- Persist checkbox state via `settingsManager`

#### 4. `frontend/modules/costDebugger/costDebuggerUI.js`

- Remove `_computeCrossPlayerItemsBySphere()` method
- Remove `compareSphereIndex()` function (moved to crossPlayerItemSync.js)
- In `_handleVerify()`, replace the inline cross-player grant logic (lines 258-296) with calls to the spoilerChecklist's public functions. The Verify tool calls `grantItemsUpToSphere(sphereIndex)` directly before each step (bypassing frontier logic, since Verify knows exactly which sphere it's processing). This is an async call that resolves after `commitBatchUpdate()`, so the Verify tool awaits it before proceeding.
- The Verify tool does NOT enable the "Simulate Received Items" checkbox or rely on auto-sync — it calls the grant function directly for explicit control over timing.
- Import `centralRegistry` to access the public function (already imported)

#### 5. `frontend/modules/spoilerChecklist/index.js` — module config update

No changes needed to `modules.json` — `spoilerChecklist` already has `requires: ["stateManager", "commonUI", "sphereState", "locations"]`, which covers all dependencies.

### UI mockup (controls bar)

```
[✓] Show Region Column  [✓] Show Item Column  [✓] Simulate Received Items
Synced 7 items through sphere 0.80 | Frontier: 0.98  [Sync Now]
```

When disabled or in single-player (no cross-player items):
```
[✓] Show Region Column  [✓] Show Item Column  [ ] Simulate Received Items
```

## Implementation order

1. Create `crossPlayerItemSync.js` with core logic (extracted from costDebuggerUI)
2. Wire up in `spoilerChecklist/index.js` — register public functions
3. Add UI controls and auto-sync to `spoilerChecklistUI.js`
4. Test with multiworld seed (player 4 Adventure)
5. Update Cost Debugger Verify to use the public API
6. Remove duplicated code from `costDebuggerUI.js`

## Resolved questions

1. **Frontier boundary**: Strictly before the first unchecked location. Confirmed.

2. **Dedup strategy**: Inventory-based. Compare expected vs actual inventory and grant the delta. Idempotent, no reset tracking needed.

3. **Auto-sync timing**: Only sync when `checkedLocations` count changes, not on every snapshot. Prevents unnecessary work and feedback loops.

4. **Verify tool integration**: Verify calls `grantItemsUpToSphere(sphereIndex)` directly — does not use the checkbox or auto-sync. This gives Verify explicit control over timing.

## Open questions

1. **Inventory format matching**: `snapshot.inventory` may use a different structure than `base_items` (e.g., `progressive_items` vs flat counts). Need to verify the exact format during implementation to write correct delta comparison. May need to sum across inventory categories.

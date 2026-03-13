/**
 * Cross-Player Item Sync
 *
 * Simulates receiving items from other players in multiworld games.
 * Tracks which locations have been checked, finds the "frontier" (first
 * unchecked location), and grants all cross-player items from spheres
 * before that frontier.
 *
 * Uses the spoiler test dedup pattern: sphere base_items include ALL items
 * (same-player + cross-player). Since checkLocation only grants same-player
 * items, we subtract those to find the cross-player remainder.
 *
 * Inventory-based dedup: compares expected items vs actual inventory to
 * compute a delta. Idempotent — safe to re-run after resets.
 */

import { stateManagerProxySingleton } from '../stateManager/index.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('crossPlayerItemSync', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[crossPlayerItemSync] ${message}`, ...data);
  }
}

/**
 * Compare sphere index strings like "0", "0.41", "0.100", "1.31".
 * Format is "major.minor" where both parts are integers.
 * "0.100" > "0.98" (100 > 98), unlike numeric comparison.
 */
export function compareSphereIndex(a, b) {
  const [aMajor, aMinor = 0] = String(a).split('.').map(Number);
  const [bMajor, bMinor = 0] = String(b).split('.').map(Number);
  if (aMajor !== bMajor) return aMajor - bMajor;
  return aMinor - bMinor;
}

export class CrossPlayerItemSync {
  constructor() {
    this._lastCheckedCount = -1;
    this._lastSyncResult = null;
  }

  /**
   * Get current player ID.
   * @returns {string}
   */
  _getPlayerId() {
    const getIdFn = centralRegistry.getPublicFunction('sphereState', 'getCurrentPlayerId');
    return String(getIdFn?.() || DEFAULT_PLAYER_ID);
  }

  /**
   * Get sphere data from sphereState module.
   * @returns {Array|null}
   */
  _getSphereData() {
    const getSphereData = centralRegistry.getPublicFunction('sphereState', 'getSphereData');
    if (!getSphereData) return null;
    const data = getSphereData();
    return (data && Array.isArray(data) && data.length > 0) ? data : null;
  }

  /**
   * Get static location data (includes item info with player ownership).
   * @returns {Map|null}
   */
  _getLocations() {
    return stateManagerProxySingleton.getStaticData()?.locations || null;
  }

  /**
   * Find the frontier sphere — the first sphere containing an unchecked
   * location for the current player. Spheres are scanned in order.
   *
   * @param {Set<string>} checkedLocations - Set of checked location names
   * @returns {string|null} Sphere index of the frontier, or null if all checked
   */
  findFrontierSphere(checkedLocations) {
    const sphereData = this._getSphereData();
    if (!sphereData) return null;

    // Sort spheres by sphere index
    const sorted = [...sphereData].sort((a, b) =>
      compareSphereIndex(a.sphereIndex, b.sphereIndex)
    );

    for (const sphere of sorted) {
      // Skip sphere 0 base (starting items)
      if (sphere.integerSphere === 0 &&
          (sphere.fractionalSphere === 0 || sphere.fractionalSphere == null)) {
        continue;
      }

      const locations = sphere.locations || [];
      for (const loc of locations) {
        if (!checkedLocations.has(loc)) {
          return sphere.sphereIndex;
        }
      }
    }

    return null; // All locations checked
  }

  /**
   * Compute cross-player items using the dedup pattern.
   *
   * sphereState.inventoryDetails.base_items is CUMULATIVE (accumulated by
   * _mergeInventory), so we use the last included sphere's cumulative total
   * and subtract own-player items from ALL included locations at once.
   * The per-sphere approach double-counted because each sphere's cumulative
   * base_items re-included items from prior spheres.
   *
   * @param {string} [upToSphere] - Only include spheres up to this index.
   *                                 If null/undefined, include all spheres.
   * @param {boolean} [inclusive=false] - If true, include upToSphere itself.
   *                                      If false, exclude it (strictly before).
   * @returns {Map<string, string[]>} sphereIndex → array of item names to grant
   */
  computeCrossPlayerItems(upToSphere, inclusive = false) {
    const locations = this._getLocations();
    if (!locations) return new Map();

    const playerId = this._getPlayerId();
    const sphereData = this._getSphereData();
    if (!sphereData) return new Map();

    // Sort spheres by index so we can find the last included sphere
    const sorted = [...sphereData].sort((a, b) =>
      compareSphereIndex(a.sphereIndex, b.sphereIndex)
    );

    // Collect all locations from included spheres and find the last one
    let lastIncludedSphere = null;
    const allOwnLocationItems = {};

    for (const sphere of sorted) {
      // Check boundary
      if (upToSphere != null) {
        const cmp = compareSphereIndex(sphere.sphereIndex, upToSphere);
        if (inclusive ? cmp > 0 : cmp >= 0) continue;
      }

      // Collect own-player items from ALL spheres (including sphere 0)
      // so they are properly subtracted from the cumulative base_items
      for (const locName of (sphere.locations || [])) {
        const locData = locations.get?.(locName);
        if (locData?.item?.name) {
          const itemPlayer = String(locData.item.player ?? playerId);
          if (itemPlayer === playerId) {
            const name = locData.item.name;
            allOwnLocationItems[name] = (allOwnLocationItems[name] || 0) + 1;
          }
        }
      }

      // Track last included sphere (skip sphere 0 base for this purpose —
      // its cumulative base_items are just starting items)
      if (sphere.integerSphere === 0 &&
          (sphere.fractionalSphere === 0 || sphere.fractionalSphere == null)) {
        continue;
      }
      lastIncludedSphere = sphere;
    }

    if (!lastIncludedSphere) return new Map();

    // Use the last included sphere's cumulative base_items (contains ALL items
    // the player should have by that point)
    const cumulativeItems = lastIncludedSphere.inventoryDetails?.base_items || {};
    if (Object.keys(cumulativeItems).length === 0) return new Map();

    // Expand cumulative items to array
    const allItems = [];
    for (const [name, count] of Object.entries(cumulativeItems)) {
      for (let i = 0; i < count; i++) allItems.push(name);
    }

    // Subtract all own-location items (what checkLocation will grant)
    const itemsToGrant = [...allItems];
    for (const [name, count] of Object.entries(allOwnLocationItems)) {
      let remaining = count;
      for (let i = itemsToGrant.length - 1; i >= 0 && remaining > 0; i--) {
        if (itemsToGrant[i] === name) {
          itemsToGrant.splice(i, 1);
          remaining--;
        }
      }
    }

    if (itemsToGrant.length > 0) {
      return new Map([[lastIncludedSphere.sphereIndex, itemsToGrant]]);
    }
    return new Map();
  }

  /**
   * Compute the delta between expected cross-player items and actual inventory.
   * Returns only items that still need to be granted.
   *
   * @param {Map<string, string[]>} crossPlayerItems - from computeCrossPlayerItems()
   * @param {object} currentInventory - snapshot.inventory ({itemName: count})
   * @returns {string[]} Item names to grant (may contain duplicates for count > 1)
   */
  computeGrantDelta(crossPlayerItems, currentInventory) {
    // Aggregate all cross-player items into counts
    const expectedCounts = {};
    for (const [, items] of crossPlayerItems) {
      for (const name of items) {
        expectedCounts[name] = (expectedCounts[name] || 0) + 1;
      }
    }

    // Compare against actual inventory and compute delta
    const itemsToGrant = [];
    for (const [name, expectedCount] of Object.entries(expectedCounts)) {
      const actualCount = currentInventory?.[name] || 0;
      const delta = expectedCount - actualCount;
      if (delta > 0) {
        for (let i = 0; i < delta; i++) {
          itemsToGrant.push(name);
        }
      }
    }

    return itemsToGrant;
  }

  /**
   * Execute a full sync: find frontier, compute cross-player items,
   * compute delta, grant items.
   *
   * @returns {Promise<{ grantedCount: number, frontierSphere: string|null }>}
   */
  async sync() {
    const snapshot = stateManagerProxySingleton.getLatestStateSnapshot();
    if (!snapshot) return { grantedCount: 0, frontierSphere: null };

    const checkedLocations = new Set(snapshot.checkedLocations || []);
    // Update tracked count so snapshot-triggered _maybeSyncReceivedItems
    // doesn't redundantly re-sync after our batch commit fires a snapshot.
    this._lastCheckedCount = checkedLocations.size;
    const frontierSphere = this.findFrontierSphere(checkedLocations);

    // Compute cross-player items up to (but not including) frontier
    const crossPlayerItems = this.computeCrossPlayerItems(frontierSphere);

    // Compute delta against current inventory
    const itemsToGrant = this.computeGrantDelta(crossPlayerItems, snapshot.inventory);

    if (itemsToGrant.length > 0) {
      await stateManagerProxySingleton.beginBatchUpdate();
      for (const itemName of itemsToGrant) {
        await stateManagerProxySingleton.addItemToInventory(itemName, 1);
      }
      await stateManagerProxySingleton.commitBatchUpdate();
      log('info', `Synced ${itemsToGrant.length} cross-player items (frontier: ${frontierSphere})`);
    }

    this._lastSyncResult = {
      grantedCount: itemsToGrant.length,
      frontierSphere,
      totalCrossPlayerItems: [...crossPlayerItems.values()].reduce((sum, arr) => sum + arr.length, 0),
    };

    return { grantedCount: itemsToGrant.length, frontierSphere };
  }

  /**
   * Grant cross-player items up to and including a specific sphere index.
   * Used by the Cost Debugger Verify tool which knows exactly which sphere
   * it's processing and doesn't need frontier logic.
   *
   * @param {string} sphereIndex - Grant items for all spheres up to and including this one
   * @returns {Promise<{ grantedCount: number }>}
   */
  async grantUpToSphere(sphereIndex) {
    const crossPlayerItems = this.computeCrossPlayerItems(sphereIndex, true);

    const snapshot = stateManagerProxySingleton.getLatestStateSnapshot();
    const itemsToGrant = this.computeGrantDelta(crossPlayerItems, snapshot?.inventory);

    if (itemsToGrant.length > 0) {
      await stateManagerProxySingleton.beginBatchUpdate();
      for (const itemName of itemsToGrant) {
        await stateManagerProxySingleton.addItemToInventory(itemName, 1);
      }
      await stateManagerProxySingleton.commitBatchUpdate();
      log('info', `Granted ${itemsToGrant.length} cross-player items up to sphere ${sphereIndex}`);
    }

    return { grantedCount: itemsToGrant.length };
  }

  /**
   * Check if checked locations have changed since last sync.
   * @param {number} currentCheckedCount
   * @returns {boolean}
   */
  hasCheckedLocationsChanged(currentCheckedCount) {
    if (currentCheckedCount === this._lastCheckedCount) return false;
    this._lastCheckedCount = currentCheckedCount;
    return true;
  }

  /**
   * Get last sync result for UI display.
   * @returns {{ grantedCount: number, frontierSphere: string|null, totalCrossPlayerItems: number }|null}
   */
  getLastSyncResult() {
    return this._lastSyncResult;
  }

  /**
   * Check if this is a multiworld game with cross-player items.
   * @returns {boolean}
   */
  isMultiworld() {
    const sphereData = this._getSphereData();
    if (!sphereData) return false;
    const locations = this._getLocations();
    if (!locations) return false;
    const playerId = this._getPlayerId();

    // Check if any location has a cross-player item
    for (const sphere of sphereData) {
      for (const locName of (sphere.locations || [])) {
        const locData = locations.get?.(locName);
        if (locData?.item?.player != null) {
          const itemPlayer = String(locData.item.player);
          if (itemPlayer !== playerId) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Sphere Log Comparison Library
 *
 * Provides functions for parsing and comparing sphere logs
 * between Python-generated and Universal Tracker versions.
 *
 * @module sphereLogComparison
 */

/**
 * Parse a sphere log JSONL string and return entries with metadata.
 * @param {string} content - JSONL content as string
 * @returns {{entries: Array, metadata: Object|null}} Parsed entries and metadata
 */
export function parseSphereLogWithMetadata(content) {
  const lines = content.trim().split('\n');
  const entries = [];
  let metadata = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      if (entry.type === 'metadata') {
        metadata = entry;
      } else {
        entries.push(entry);
      }
    } catch (e) {
      console.warn('Failed to parse sphere log line:', line, e);
    }
  }

  return { entries, metadata };
}

/**
 * Extract event locations and items to ignore from sphere log metadata.
 * @param {Object} metadata - Metadata object from sphere log
 * @returns {{ignoreLocations: Set, ignoreItems: Set}} Sets of items/locations to ignore
 */
export function extractEventFiltersFromMetadata(metadata) {
  const ignoreLocations = new Set();
  const ignoreItems = new Set();

  if (!metadata) {
    return { ignoreLocations, ignoreItems };
  }

  // Extract event locations (per player)
  if (metadata.event_locations) {
    for (const playerId of Object.keys(metadata.event_locations)) {
      const locations = metadata.event_locations[playerId];
      if (Array.isArray(locations)) {
        locations.forEach(loc => ignoreLocations.add(loc));
      }
    }
  }

  // Extract event items (per player)
  if (metadata.event_items) {
    for (const playerId of Object.keys(metadata.event_items)) {
      const items = metadata.event_items[playerId];
      if (Array.isArray(items)) {
        items.forEach(item => ignoreItems.add(item));
      }
    }
  }

  return { ignoreLocations, ignoreItems };
}

/**
 * Filter a set of locations/items by removing ignored entries.
 * @param {Array} items - Array of items/locations
 * @param {Set} ignoreSet - Set of items to ignore
 * @returns {Array} Filtered array
 */
function filterIgnored(items, ignoreSet) {
  if (!ignoreSet || ignoreSet.size === 0) {
    return items;
  }
  return items.filter(item => !ignoreSet.has(item));
}

/**
 * Compare two inventory objects.
 * @param {Object} expected - Expected inventory
 * @param {Object} actual - Actual inventory
 * @param {Set} ignoreItems - Items to ignore
 * @returns {Object} Comparison result
 */
function compareInventory(expected, actual, ignoreItems) {
  const result = {
    match: true,
    missing: {},
    extra: {},
    mismatch: {}
  };

  // Check for missing and mismatched items
  for (const [item, expectedCount] of Object.entries(expected || {})) {
    if (ignoreItems && ignoreItems.has(item)) continue;

    const actualCount = (actual || {})[item] || 0;
    if (actualCount === 0) {
      result.missing[item] = expectedCount;
      result.match = false;
    } else if (actualCount !== expectedCount) {
      result.mismatch[item] = { expected: expectedCount, actual: actualCount };
      result.match = false;
    }
  }

  // Check for extra items
  for (const [item, actualCount] of Object.entries(actual || {})) {
    if (ignoreItems && ignoreItems.has(item)) continue;

    if (!expected || !(item in expected)) {
      result.extra[item] = actualCount;
      result.match = false;
    }
  }

  return result;
}

/**
 * Compare two sphere log entries (state_update).
 * @param {Object} pythonEntry - Python sphere log entry
 * @param {Object} utEntry - UT sphere log entry
 * @param {Object} options - Comparison options
 * @returns {Object} Comparison result
 */
function compareSphereEntries(pythonEntry, utEntry, options = {}) {
  const result = {
    sphere_index: pythonEntry?.sphere_index || utEntry?.sphere_index,
    match: true,
    players: {}
  };

  const pythonPlayers = pythonEntry?.player_data || {};
  const utPlayers = utEntry?.player_data || {};

  // Get all player IDs from both logs
  const allPlayers = new Set([
    ...Object.keys(pythonPlayers),
    ...Object.keys(utPlayers)
  ]);

  for (const playerId of allPlayers) {
    const pythonData = pythonPlayers[playerId] || {};
    const utData = utPlayers[playerId] || {};

    const playerResult = {
      match: true,
      accessible_locations: { match: true, missing: [], extra: [] },
      accessible_regions: { match: true, missing: [], extra: [] },
      inventory: {
        match: true,
        base_items: { match: true, missing: {}, extra: {}, mismatch: {} },
        resolved_items: { match: true, missing: {}, extra: {}, mismatch: {} }
      }
    };

    // Compare accessible locations
    const pythonLocs = filterIgnored(
      pythonData.new_accessible_locations || [],
      options.ignoreLocations
    );
    const utLocs = filterIgnored(
      utData.new_accessible_locations || [],
      options.ignoreLocations
    );

    const pythonLocSet = new Set(pythonLocs);
    const utLocSet = new Set(utLocs);

    for (const loc of pythonLocs) {
      if (!utLocSet.has(loc)) {
        playerResult.accessible_locations.missing.push(loc);
        playerResult.accessible_locations.match = false;
        playerResult.match = false;
      }
    }

    for (const loc of utLocs) {
      if (!pythonLocSet.has(loc)) {
        playerResult.accessible_locations.extra.push(loc);
        playerResult.accessible_locations.match = false;
        playerResult.match = false;
      }
    }

    // Compare accessible regions
    const pythonRegs = pythonData.new_accessible_regions || [];
    const utRegs = utData.new_accessible_regions || [];

    const pythonRegSet = new Set(pythonRegs);
    const utRegSet = new Set(utRegs);

    for (const reg of pythonRegs) {
      if (!utRegSet.has(reg)) {
        playerResult.accessible_regions.missing.push(reg);
        playerResult.accessible_regions.match = false;
        playerResult.match = false;
      }
    }

    for (const reg of utRegs) {
      if (!pythonRegSet.has(reg)) {
        playerResult.accessible_regions.extra.push(reg);
        playerResult.accessible_regions.match = false;
        playerResult.match = false;
      }
    }

    // Compare inventory (base_items)
    const pythonBaseItems = pythonData.new_inventory_details?.base_items || {};
    const utBaseItems = utData.new_inventory_details?.base_items || {};
    playerResult.inventory.base_items = compareInventory(
      pythonBaseItems,
      utBaseItems,
      options.ignoreItems
    );
    if (!playerResult.inventory.base_items.match) {
      playerResult.inventory.match = false;
      playerResult.match = false;
    }

    // Compare inventory (resolved_items)
    const pythonResolvedItems = pythonData.new_inventory_details?.resolved_items || {};
    const utResolvedItems = utData.new_inventory_details?.resolved_items || {};
    playerResult.inventory.resolved_items = compareInventory(
      pythonResolvedItems,
      utResolvedItems,
      options.ignoreItems
    );
    if (!playerResult.inventory.resolved_items.match) {
      playerResult.inventory.match = false;
      playerResult.match = false;
    }

    result.players[playerId] = playerResult;

    if (!playerResult.match) {
      result.match = false;
    }
  }

  return result;
}

/**
 * Compare two sphere logs.
 * @param {Array} pythonLog - Python sphere log entries
 * @param {Array} utLog - UT sphere log entries
 * @param {Object} options - Comparison options (ignoreLocations, ignoreItems)
 * @returns {Object} Comparison result
 */
export function compareSphereLogs(pythonLog, utLog, options = {}) {
  const result = {
    all_match: true,
    summary: {
      python_entries: pythonLog.length,
      ut_entries: utLog.length,
      matched_entries: 0,
      mismatched_entries: 0,
      missing_in_ut: 0,
      extra_in_ut: 0
    },
    spheres: []
  };

  // Create index map for UT entries by sphere_index
  const utByIndex = new Map();
  for (const entry of utLog) {
    if (entry.sphere_index !== undefined) {
      utByIndex.set(String(entry.sphere_index), entry);
    }
  }

  // Create index map for Python entries by sphere_index
  const pythonByIndex = new Map();
  for (const entry of pythonLog) {
    if (entry.sphere_index !== undefined) {
      pythonByIndex.set(String(entry.sphere_index), entry);
    }
  }

  // Compare each Python entry
  for (const pythonEntry of pythonLog) {
    const sphereIndex = String(pythonEntry.sphere_index);
    const utEntry = utByIndex.get(sphereIndex);

    if (!utEntry) {
      result.all_match = false;
      result.summary.mismatched_entries++;
      result.summary.missing_in_ut++;
      result.spheres.push({
        sphere_index: sphereIndex,
        status: 'missing_in_ut',
        match: false
      });
    } else {
      const comparison = compareSphereEntries(pythonEntry, utEntry, options);
      result.spheres.push({
        sphere_index: sphereIndex,
        status: comparison.match ? 'match' : 'mismatch',
        ...comparison
      });

      if (comparison.match) {
        result.summary.matched_entries++;
      } else {
        result.all_match = false;
        result.summary.mismatched_entries++;
      }
    }
  }

  // Check for extra entries in UT
  for (const utEntry of utLog) {
    const sphereIndex = String(utEntry.sphere_index);
    if (!pythonByIndex.has(sphereIndex)) {
      result.all_match = false;
      result.summary.extra_in_ut++;
      result.spheres.push({
        sphere_index: sphereIndex,
        status: 'extra_in_ut',
        match: false
      });
    }
  }

  return result;
}

/**
 * Find the first mismatch between two sphere logs.
 * @param {Array} pythonLog - Python sphere log entries
 * @param {Array} utLog - UT sphere log entries
 * @param {Object} options - Comparison options
 * @returns {Object|null} First mismatch details, or null if all match
 */
export function findFirstMismatch(pythonLog, utLog, options = {}) {
  const comparison = compareSphereLogs(pythonLog, utLog, options);

  for (const sphere of comparison.spheres) {
    if (!sphere.match) {
      return sphere;
    }
  }

  return null;
}

/**
 * Format a comparison result as a summary string.
 * @param {Object} comparison - Comparison result
 * @returns {string} Formatted summary
 */
export function formatComparisonSummary(comparison) {
  const lines = [];
  const summary = comparison.summary;

  lines.push('=== Sphere Log Comparison Summary ===');
  lines.push(`Python entries: ${summary.python_entries}`);
  lines.push(`UT entries: ${summary.ut_entries}`);
  lines.push(`Matched: ${summary.matched_entries}/${summary.python_entries}`);
  lines.push(`Mismatched: ${summary.mismatched_entries}`);

  if (summary.missing_in_ut > 0) {
    lines.push(`Missing in UT: ${summary.missing_in_ut}`);
  }
  if (summary.extra_in_ut > 0) {
    lines.push(`Extra in UT: ${summary.extra_in_ut}`);
  }

  lines.push('');
  if (comparison.all_match) {
    lines.push('RESULT: ALL SPHERES MATCH');
  } else {
    lines.push('RESULT: MISMATCHES FOUND');
  }

  return lines.join('\n');
}

export default {
  parseSphereLogWithMetadata,
  extractEventFiltersFromMetadata,
  compareSphereLogs,
  findFirstMismatch,
  formatComparisonSummary
};

/**
 * Sphere Log Comparison Library
 *
 * Provides utilities for parsing and comparing sphere logs between
 * Python-generated logs and Universal Tracker generated logs.
 *
 * @module sphereLogComparison
 */

/**
 * Parse a sphere log JSONL file content.
 * @param {string} content - JSONL file content
 * @returns {Object} Parsed result with entries and optional metadata
 */
export function parseSphereLogWithMetadata(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const entries = [];
  let metadata = null;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      // Check if this is a metadata line (usually first line with special structure)
      if (parsed.metadata || parsed.event_locations || parsed.event_items) {
        metadata = parsed;
      } else {
        entries.push(parsed);
      }
    } catch (e) {
      // Skip invalid JSON lines
      console.warn('[sphereLogComparison] Skipping invalid JSON line:', line.substring(0, 50));
    }
  }

  return { entries, metadata };
}

/**
 * Extract event filters from metadata for comparison.
 * @param {Object} metadata - Metadata from sphere log
 * @returns {Object} Object with ignoreLocations and ignoreItems Sets
 */
export function extractEventFiltersFromMetadata(metadata) {
  const ignoreLocations = new Set();
  const ignoreItems = new Set();

  if (!metadata) {
    return { ignoreLocations, ignoreItems };
  }

  // Extract event locations
  if (metadata.event_locations) {
    for (const [playerId, locations] of Object.entries(metadata.event_locations)) {
      if (Array.isArray(locations)) {
        locations.forEach(loc => ignoreLocations.add(loc));
      }
    }
  }

  // Extract event items
  if (metadata.event_items) {
    for (const [playerId, items] of Object.entries(metadata.event_items)) {
      if (Array.isArray(items)) {
        items.forEach(item => ignoreItems.add(item));
      }
    }
  }

  return { ignoreLocations, ignoreItems };
}

/**
 * Compare two sphere logs.
 * @param {Array} pythonLog - Array of sphere entries from Python log
 * @param {Array} utLog - Array of sphere entries from UT log
 * @param {Object} options - Comparison options
 * @param {Set} [options.ignoreLocations] - Locations to ignore in comparison
 * @param {Set} [options.ignoreItems] - Items to ignore in comparison
 * @returns {Object} Comparison result
 */
export function compareSphereLogs(pythonLog, utLog, options = {}) {
  const ignoreLocations = options.ignoreLocations || new Set();
  const ignoreItems = options.ignoreItems || new Set();

  const pythonCount = pythonLog.length;
  const utCount = utLog.length;
  const maxCount = Math.max(pythonCount, utCount);

  let matchedEntries = 0;
  let mismatchedEntries = 0;
  let missingInUt = 0;
  let extraInUt = 0;
  const mismatches = [];

  for (let i = 0; i < maxCount; i++) {
    const pythonEntry = pythonLog[i];
    const utEntry = utLog[i];

    if (!pythonEntry && utEntry) {
      extraInUt++;
      mismatches.push({
        sphere_index: i,
        status: 'extra_in_ut',
        ut_entry: utEntry
      });
    } else if (pythonEntry && !utEntry) {
      missingInUt++;
      mismatches.push({
        sphere_index: i,
        status: 'missing_in_ut',
        python_entry: pythonEntry
      });
    } else {
      const comparison = compareSphereEntries(pythonEntry, utEntry, ignoreLocations, ignoreItems);
      if (comparison.match) {
        matchedEntries++;
      } else {
        mismatchedEntries++;
        mismatches.push({
          sphere_index: i,
          status: 'content_mismatch',
          players: comparison.players
        });
      }
    }
  }

  return {
    all_match: mismatchedEntries === 0 && missingInUt === 0 && extraInUt === 0,
    summary: {
      python_entries: pythonCount,
      ut_entries: utCount,
      matched_entries: matchedEntries,
      mismatched_entries: mismatchedEntries,
      missing_in_ut: missingInUt,
      extra_in_ut: extraInUt
    },
    mismatches
  };
}

/**
 * Compare two sphere entries.
 * @param {Object} pythonEntry - Python sphere entry
 * @param {Object} utEntry - UT sphere entry
 * @param {Set} ignoreLocations - Locations to ignore
 * @param {Set} ignoreItems - Items to ignore
 * @returns {Object} Comparison result with match boolean and player details
 */
function compareSphereEntries(pythonEntry, utEntry, ignoreLocations, ignoreItems) {
  const result = {
    match: true,
    players: {}
  };

  // Get all player IDs from both entries
  const playerIds = new Set([
    ...Object.keys(pythonEntry || {}),
    ...Object.keys(utEntry || {})
  ].filter(key => !isNaN(parseInt(key, 10))));

  for (const playerId of playerIds) {
    const pythonPlayer = pythonEntry?.[playerId] || {};
    const utPlayer = utEntry?.[playerId] || {};

    const playerResult = {
      match: true,
      accessible_locations: compareArrays(
        pythonPlayer.accessible_locations || [],
        utPlayer.accessible_locations || [],
        ignoreLocations
      ),
      accessible_regions: compareArrays(
        pythonPlayer.accessible_regions || [],
        utPlayer.accessible_regions || []
      ),
      inventory: compareInventories(
        pythonPlayer.inventory || {},
        utPlayer.inventory || {},
        ignoreItems
      )
    };

    // Check if any component mismatches
    if (!playerResult.accessible_locations.match ||
        !playerResult.accessible_regions.match ||
        !playerResult.inventory.match) {
      playerResult.match = false;
      result.match = false;
    }

    result.players[playerId] = playerResult;
  }

  return result;
}

/**
 * Compare two arrays.
 * @param {Array} expected - Expected array
 * @param {Array} actual - Actual array
 * @param {Set} [ignore] - Items to ignore
 * @returns {Object} Comparison result
 */
function compareArrays(expected, actual, ignore = new Set()) {
  const expectedSet = new Set(expected.filter(item => !ignore.has(item)));
  const actualSet = new Set(actual.filter(item => !ignore.has(item)));

  const missing = [...expectedSet].filter(item => !actualSet.has(item));
  const extra = [...actualSet].filter(item => !expectedSet.has(item));

  return {
    match: missing.length === 0 && extra.length === 0,
    missing,
    extra
  };
}

/**
 * Compare two inventories.
 * @param {Object} expected - Expected inventory (item -> count)
 * @param {Object} actual - Actual inventory (item -> count)
 * @param {Set} [ignore] - Items to ignore
 * @returns {Object} Comparison result with base_items and resolved_items
 */
function compareInventories(expected, actual, ignore = new Set()) {
  const baseItemsDiff = {
    missing: {},
    extra: {},
    mismatch: {}
  };

  // Check expected items
  for (const [item, count] of Object.entries(expected)) {
    if (ignore.has(item)) continue;

    const actualCount = actual[item] || 0;
    if (actualCount === 0) {
      baseItemsDiff.missing[item] = count;
    } else if (actualCount !== count) {
      baseItemsDiff.mismatch[item] = { expected: count, actual: actualCount };
    }
  }

  // Check actual items for extras
  for (const [item, count] of Object.entries(actual)) {
    if (ignore.has(item)) continue;
    if (!(item in expected)) {
      baseItemsDiff.extra[item] = count;
    }
  }

  const baseMatch = Object.keys(baseItemsDiff.missing).length === 0 &&
                    Object.keys(baseItemsDiff.extra).length === 0 &&
                    Object.keys(baseItemsDiff.mismatch).length === 0;

  return {
    match: baseMatch,
    base_items: baseItemsDiff,
    resolved_items: {
      missing: {},
      extra: {},
      mismatch: {}
    }
  };
}

/**
 * Find the first mismatch between two logs.
 * @param {Array} pythonLog - Python sphere entries
 * @param {Array} utLog - UT sphere entries
 * @param {Object} options - Comparison options
 * @returns {Object|null} First mismatch, or null if all match
 */
export function findFirstMismatch(pythonLog, utLog, options = {}) {
  const ignoreLocations = options.ignoreLocations || new Set();
  const ignoreItems = options.ignoreItems || new Set();

  const maxCount = Math.max(pythonLog.length, utLog.length);

  for (let i = 0; i < maxCount; i++) {
    const pythonEntry = pythonLog[i];
    const utEntry = utLog[i];

    if (!pythonEntry && utEntry) {
      return {
        sphere_index: i,
        status: 'extra_in_ut',
        ut_entry: utEntry
      };
    }

    if (pythonEntry && !utEntry) {
      return {
        sphere_index: i,
        status: 'missing_in_ut',
        python_entry: pythonEntry
      };
    }

    const comparison = compareSphereEntries(pythonEntry, utEntry, ignoreLocations, ignoreItems);
    if (!comparison.match) {
      return {
        sphere_index: i,
        status: 'content_mismatch',
        players: comparison.players
      };
    }
  }

  return null;
}

/**
 * Format a comparison summary as a human-readable string.
 * @param {Object} result - Comparison result from compareSphereLogs
 * @returns {string} Formatted summary
 */
export function formatComparisonSummary(result) {
  const { summary, all_match } = result;
  const lines = [];

  lines.push('=== Sphere Log Comparison Summary ===');
  lines.push(`Python entries: ${summary.python_entries}`);
  lines.push(`UT entries: ${summary.ut_entries}`);
  lines.push(`Matched: ${summary.matched_entries}`);
  lines.push(`Mismatched: ${summary.mismatched_entries}`);
  lines.push(`Missing in UT: ${summary.missing_in_ut}`);
  lines.push(`Extra in UT: ${summary.extra_in_ut}`);
  lines.push('');
  lines.push(all_match ? 'RESULT: ALL MATCH' : 'RESULT: DIFFERENCES FOUND');

  return lines.join('\n');
}

export default {
  parseSphereLogWithMetadata,
  extractEventFiltersFromMetadata,
  compareSphereLogs,
  findFirstMismatch,
  formatComparisonSummary
};

// frontend/modules/tileMapAnalyzer/rulesExporter.js
//
// Exports the reachability analysis as a rules.json file. Runs the
// BFS-twice approximation to determine which abilities are required
// for each exit, then emits regions/exits/locations/access rules.
//
// Performance note: the per-ability-removal step requires one BFS
// per (save_point, reduced_ability_set) pair. With caching, this is
// O(save_points × non_basic_abilities) BFS runs total — not per
// location. For Kitty: 3 × 9 + 3 + 3 = 33 BFS runs ≈ 30–60 seconds.

import { buildEffectiveGrids } from './tileCategorizer.js';
import {
  computeReachable,
  findPlayerStart,
  findPointsOfInterest,
  orderSavePoints,
} from './reachabilityAnalyzer.js';
import {
  makeHasRule,
  makeAndRule,
  makeTrueRule,
  makeRegion,
  makeExit,
  makeLocation,
  makeRulesJsonScaffold,
} from '../shared/rulesJsonBuilder.js';

function tileKey(x, y) { return `${y},${x}`; }

// Yield back to the browser so it can paint the current progress update and
// process input events. Used between BFS iterations to keep the panel
// responsive during long exports.
function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Map an ability name to an AP item name via the config's categories.
 */
function abilityToItemName(ability, config) {
  const cats = config.categories;
  for (const cat of Object.values(cats)) {
    if (cat.grants_ability === ability && cat.ap_name) {
      return cat.ap_name;
    }
  }
  return ability.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build an access rule from a list of required ability names.
 */
function abilitiesToRule(abilities, config) {
  if (abilities.length === 0) return makeTrueRule();
  const hasRules = abilities.map(a => makeHasRule(abilityToItemName(a, config)));
  return makeAndRule(hasRules);
}

/**
 * Precompute BFS reachable sets for all needed ability combinations,
 * cached by a string key. Returns a lookup function
 * getReachable(savePointIndex, abilitySetKey) → Set<tileKey>.
 */
async function precomputeReachableSets(savePoints, abilitySets, categoryGrid, config, log, debugLog) {
  const cache = new Map();
  const total = savePoints.length * abilitySets.length;

  for (let si = 0; si < savePoints.length; si++) {
    const sp = savePoints[si];
    for (const [setKey, abilitySet] of abilitySets) {
      const cacheKey = `${si}:${setKey}`;
      const { effectiveGrid, floorFlags } =
        buildEffectiveGrids(categoryGrid, abilitySet, config);
      const { reachable, midairPOIs } = computeReachable(
        sp.x, sp.y, effectiveGrid, floorFlags, categoryGrid, abilitySet, config
      );
      const augmented = new Set([...reachable, ...midairPOIs]);
      cache.set(cacheKey, augmented);

      const midairCount = midairPOIs.size;
      const msg = `BFS ${cache.size}/${total}: SP${si + 1} (${sp.x},${sp.y}) ${setKey} → ${reachable.size} tiles + ${midairCount} midair = ${augmented.size}`;
      log(msg, { done: cache.size, total });
      debugLog.push(msg);

      // Log which POIs are in this reachable set
      const poiHits = [];
      for (const k of augmented) {
        const comma = k.indexOf(',');
        const y = parseInt(k.slice(0, comma), 10);
        const x = parseInt(k.slice(comma + 1), 10);
        const cat = config.categories[categoryGrid[y]?.[x]];
        if (cat && (cat.is_region || cat.is_location)) {
          const name = cat.ap_name || categoryGrid[y][x];
          const src = reachable.has(k) ? 'bfs' : 'midair';
          poiHits.push(`    ${name} (${x},${y}) [${src}]`);
        }
      }
      if (poiHits.length) {
        debugLog.push(`  POIs reached: ${poiHits.length}`);
        poiHits.forEach(h => debugLog.push(h));
      }

      // Let the browser paint the status update and handle input events
      // before kicking off the next BFS run.
      await yieldToBrowser();
    }
  }

  return (si, setKey) => cache.get(`${si}:${setKey}`) || new Set();
}

/**
 * Run the full BFS-twice analysis and export a rules.json object.
 *
 * The onProgress callback is invoked with (message, info) where `info` is
 * an optional `{done, total}` object for BFS iterations. The function
 * yields to the browser between BFS runs so the UI stays responsive.
 */
export async function exportRulesJson(categoryGrid, config, onProgress) {
  const log = onProgress || (() => {});

  const basicSet = new Set(config.basic_abilities || []);
  const fullSet = new Set(Object.keys(config.abilities || {}));
  const nonBasic = [...fullSet].filter(a => !basicSet.has(a));
  const cats = config.categories;

  // Find POIs
  const pois = findPointsOfInterest(categoryGrid, config);
  const savePointsRaw = pois.filter(p => {
    const cat = cats[p.categoryName];
    return cat && cat.is_region && !cat.is_location && !cat.is_player_start;
  });
  const savePoints = orderSavePoints(savePointsRaw, config);
  const locations = pois.filter(p => cats[p.categoryName]?.is_location);

  log(`${savePoints.length} save points, ${locations.length} locations, ${nonBasic.length} non-basic abilities`);

  // Name regions
  for (let i = 0; i < savePoints.length; i++) {
    savePoints[i].regionName = `Save Point ${i + 1}`;
  }
  for (const loc of locations) {
    loc.regionName = loc.ap_name || loc.categoryName;
  }

  // A location is "goal" if its category doesn't grant an ability — it's the
  // win condition, not a collectible. For Robot Wants Kitty this is the
  // `goal_kitty` tile. Treat the first such location as the Victory location.
  const goalLocation = locations.find(
    (loc) => !cats[loc.categoryName]?.grants_ability
  );
  const collectibleLocations = locations.filter(
    (loc) => cats[loc.categoryName]?.grants_ability
  );

  // Build the set of ability combinations we need to BFS:
  // - "basic" (basic abilities only)
  // - "full" (all abilities)
  // - "full-X" for each non-basic ability X (full minus one)
  const abilitySets = [
    ['basic', basicSet],
    ['full', fullSet],
  ];
  for (const ability of nonBasic) {
    const reduced = new Set(fullSet);
    reduced.delete(ability);
    abilitySets.push([`full-${ability}`, reduced]);
  }

  const debugLog = [];
  debugLog.push(`=== TileMapAnalyzer Export Debug Log ===`);
  debugLog.push(`game: ${config.game}`);
  debugLog.push(`basic abilities: ${[...basicSet].sort().join(', ')}`);
  debugLog.push(`all abilities: ${[...fullSet].sort().join(', ')}`);
  debugLog.push(`non-basic: ${nonBasic.sort().join(', ')}`);
  debugLog.push(`save points: ${savePoints.map((sp, i) => `SP${i+1} (${sp.x},${sp.y})`).join(', ')}`);
  debugLog.push(`locations: ${locations.map(l => `${l.ap_name || l.categoryName} (${l.x},${l.y})`).join(', ')}`);
  debugLog.push('');
  debugLog.push(`--- Precomputing ${savePoints.length * abilitySets.length} BFS runs ---`);

  log(`precomputing ${savePoints.length * abilitySets.length} BFS runs...`);
  const getReachable = await precomputeReachableSets(
    savePoints, abilitySets, categoryGrid, config, log, debugLog
  );

  // Build exits
  log('building exits...');
  const regions = {};
  let exitCount = 0;

  // All target tiles (save points + locations)
  const allTargets = [
    ...savePoints.map(sp => ({ ...sp, isLocation: false })),
    ...locations.map(loc => ({ ...loc, isLocation: true })),
  ];

  debugLog.push('');
  debugLog.push('--- Building exits ---');

  for (let si = 0; si < savePoints.length; si++) {
    const sp = savePoints[si];
    const basicReachable = getReachable(si, 'basic');
    const fullReachable = getReachable(si, 'full');
    const exits = [];

    debugLog.push(`\nSP${si + 1} (${sp.x},${sp.y}) — basic: ${basicReachable.size} tiles, full: ${fullReachable.size} tiles`);

    for (const target of allTargets) {
      if (target.x === sp.x && target.y === sp.y) continue;
      if (!target.isLocation && target.regionName === sp.regionName) continue;

      const tk = tileKey(target.x, target.y);
      const tname = target.regionName;
      if (!fullReachable.has(tk)) {
        debugLog.push(`  ${tname} (${target.x},${target.y}): SKIP — not in full reachable`);
        continue;
      }

      if (basicReachable.has(tk)) {
        exits.push(makeExit(
          `${sp.regionName} -> ${tname}`,
          tname,
        ));
        debugLog.push(`  ${tname} (${target.x},${target.y}): True_ — in basic reachable`);
      } else {
        const required = [];
        const removalDetails = [];
        for (const ability of nonBasic) {
          const reducedReachable = getReachable(si, `full-${ability}`);
          const inReduced = reducedReachable.has(tk);
          if (!inReduced) {
            required.push(ability);
          }
          removalDetails.push(`${ability}:${inReduced ? 'still' : 'LOST'}`);
        }
        exits.push(makeExit(
          `${sp.regionName} -> ${tname}`,
          tname,
          abilitiesToRule(required, config),
        ));
        const ruleStr = required.length ? required.sort().join(' AND ') : 'True_';
        debugLog.push(`  ${tname} (${target.x},${target.y}): ${ruleStr} — removal: ${removalDetails.join(', ')}`);
      }
      exitCount++;
    }

    regions[sp.regionName] = makeRegion(sp.regionName, exits, []);
    regions[sp.regionName].position = { x: sp.x, y: sp.y };
  }

  // Location regions (each has one AP location, no exits).
  // Collectible locations map to an AP location that grants the ability's
  // item. The goal location is instead an event location that places the
  // Victory event item — this is what the completion condition checks.
  for (const loc of collectibleLocations) {
    const locEntry = makeLocation(
      loc.ap_name || loc.categoryName,
      null,
    );
    regions[loc.regionName] = makeRegion(loc.regionName, [], [locEntry]);
    regions[loc.regionName].position = { x: loc.x, y: loc.y };
  }
  if (goalLocation) {
    const victoryEvent = {
      name: 'Victory',
      id: null,
      access_rule: makeTrueRule(),
      item: { name: 'Victory', player: 1, advancement: true, type: 'Event' },
      locked: true,
      event: true,
    };
    regions[goalLocation.regionName] = makeRegion(
      goalLocation.regionName, [], [victoryEvent]
    );
    regions[goalLocation.regionName].position = {
      x: goalLocation.x, y: goalLocation.y,
    };
  }

  // Menu → first save point
  const menuExits = [];
  if (savePoints.length > 0) {
    menuExits.push(makeExit(
      `Menu -> ${savePoints[0].regionName}`,
      savePoints[0].regionName,
    ));
  }
  regions['Menu'] = makeRegion('Menu', menuExits, []);

  log(`${Object.keys(regions).length} regions, ${exitCount} exits`);

  // Resolve game identifiers. These are currently hardcoded per game until
  // the tileMapAnalyzer gets a generalized config layer.
  const gameName = config.game || 'Unknown';
  const gameDirectory = GAME_DIRECTORY_OVERRIDES[gameName]
    || gameName.toLowerCase().replace(/\s+/g, '');
  const worldClassName = gameName.replace(/\s+/g, '') + 'World';

  // Build scaffold
  const rules = makeRulesJsonScaffold({
    gameName,
    gameDirectory,
    worldClassName,
    seed: 1,
    seedName: 'AP_14089154938208861744',
    startRegions: ['Menu'],
  });

  // Items: one per collectible ability, plus a Victory event item.
  const items = {};
  for (const loc of collectibleLocations) {
    const name = loc.ap_name || loc.categoryName;
    items[name] = {
      name,
      id: null,
      groups: [],
      classification: 'progression',
      type: null,
      max_count: 1,
    };
  }
  items['Victory'] = {
    name: 'Victory',
    id: null,
    groups: ['Event'],
    classification: 'progression',
    event: true,
    type: 'Event',
    max_count: 1,
  };

  // Itempool counts: each collectible appears once; Victory is an event.
  const itempoolCounts = {};
  for (const loc of collectibleLocations) {
    const name = loc.ap_name || loc.categoryName;
    itempoolCounts[name] = (itempoolCounts[name] || 0) + 1;
  }
  itempoolCounts['Victory'] = 1;

  rules.items = { '1': items };
  rules.itempool_counts = { '1': itempoolCounts };
  rules.regions = { '1': regions };

  // World-generator metadata the scaffold doesn't set
  rules.world['1'].world_directory = gameDirectory;
  rules.game_info['1'].completion_condition = { type: 'item_check', item: 'Victory' };

  if (config.game) {
    rules.flash_panel = {
      config: gameDirectory + '.json',
      swf: gameDirectory + '_injected.swf',
    };
  }

  return { rules, debugLog };
}

// Map of hardcoded per-game directory overrides. The exporter auto-derives a
// directory from the game name otherwise. TODO: lift into config once more
// than one game is supported.
const GAME_DIRECTORY_OVERRIDES = {
  'Robot Wants Kitty': 'robotkitty',
};

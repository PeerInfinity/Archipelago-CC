// frontend/modules/shared/rulesJsonBuilder.js
//
// Shared utilities for building rules.json structures. Used by both
// the APCalc generator and the TileMapAnalyzer exporter (and any
// future module that produces rules.json output).
//
// Rule format: Rule Builder format as defined in
// frontend/schema/rules.schema.json — { rule: "Has", args: {...} }

// --- Rule builders ---

export function makeHasRule(itemName, count = 1) {
  const rule = { rule: 'Has', args: { item_name: itemName } };
  if (count > 1) rule.args.count = count;
  return rule;
}

export function makeAndRule(children) {
  if (!children.length) return { rule: 'True_' };
  if (children.length === 1) return children[0];
  return { rule: 'And', children };
}

export function makeOrRule(children) {
  if (!children.length) return { rule: 'True_' };
  if (children.length === 1) return children[0];
  return { rule: 'Or', children };
}

export function makeTrueRule() {
  return { rule: 'True_' };
}

// --- Structure builders ---

export function makeRegion(name, exits = [], locations = []) {
  return { name, exits, locations };
}

export function makeExit(name, connectedRegion, accessRule = null) {
  return {
    name,
    connected_region: connectedRegion,
    access_rule: accessRule || makeTrueRule(),
  };
}

export function makeLocation(name, id, accessRule = null) {
  return {
    name,
    id,
    access_rule: accessRule || makeTrueRule(),
  };
}

// --- Scaffold ---

/**
 * Build a minimal rules.json scaffold with all required top-level
 * fields populated. The caller fills in game-specific data (regions,
 * items, etc.) on the returned object.
 *
 * @param {object} opts
 * @param {string} opts.gameName - e.g. "Robot Wants Kitty"
 * @param {string} opts.gameDirectory - e.g. "robotkitty"
 * @param {string} opts.worldClassName - e.g. "RobotKittyWorld"
 * @param {number} [opts.seed] - generation seed
 * @param {string} [opts.seedName] - seed name string
 * @param {string} [opts.playerName] - player name (default "Player1")
 * @param {string[]} [opts.startRegions] - default start region names
 */
export function makeRulesJsonScaffold(opts) {
  const {
    gameName,
    gameDirectory,
    worldClassName,
    seed = 1,
    seedName = '',
    playerName = 'Player1',
    startRegions = ['Menu'],
  } = opts;

  return {
    schema_version: 3,
    game_name: gameName,
    game_directory: gameDirectory,
    archipelago_version: '0.6.7',
    generation_seed: seed,
    seed_name: seedName,
    player_names: { '1': playerName },
    world_classes: { '1': worldClassName },
    regions: { '1': {} },
    start_regions: {
      '1': { default: startRegions, available: [] },
    },
    items: { '1': {} },
    item_groups: { '1': [] },
    itempool_counts: { '1': {} },
    world: {
      '1': {
        game: gameName,
        world_class_name: worldClassName,
        options: {},
      },
    },
    game_info: {
      '1': {
        completion_condition: { type: 'constant', value: true },
      },
    },
    helpers: {},
    exporter: {},
    canonical_placements: { '1': {} },
    progression_mapping: { '1': {} },
    starting_items: { '1': [] },
  };
}

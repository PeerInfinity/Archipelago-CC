/**
 * Equivalence: the DepGraph rules.json built from server data must match the
 * exporter's rules.json for the same seed.
 *
 * Each case feeds the builder what the server would send for that seed:
 * slot_data (the exporter keeps a copy in world[p].slot_data), the scouts
 * (the file's own placements, turned into LocationInfo entries), and the
 * DataPackage tables (the file's item and location IDs). The output is then
 * compared field by field with the file.
 *
 * Cases: every committed DepGraph preset (all entrance_rule_mode 1 with no
 * starting nodes, and their slot_data predates sending the mode and the graph
 * key, so they also exercise the fallback), plus committed fixtures for the
 * option values the presets don't cover: modes 0, 2 and 3, starting nodes
 * (randomized and in order), player 1 of a DepGraph + APQuest room, and the
 * real-server check's seed (strict, 53 random starting nodes, ten of them
 * leaves, whose empty regions the exporter marks dynamically_added).
 * depgraph_worldgen/ is excluded: it is a different game ("DepGraph WorldGen").
 *
 * Fields the server cannot know are excluded (see IGNORED below).
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { buildDepgraphRules, entranceRuleModeOf } from './depgraphRulesBuilder.js';
import WORLD_INFO from './depgraphWorldInfo.json' with { type: 'json' };
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const FIXTURES = join(HERE, 'fixtures', 'depgraphRulesBuilder');

function presetCases() {
  const cases = [];
  for (const gameKey of ['depgraph', 'depgraph_vanilla']) {
    const dir = join(ROOT, 'frontend', 'presets', gameKey);
    if (!existsSync(dir)) continue;
    for (const folder of readdirSync(dir).sort()) {
      const path = join(dir, folder, `${folder}_rules.json`);
      if (existsSync(path)) cases.push({ name: `${gameKey}/${folder}`, path });
    }
  }
  return cases;
}

function fixtureCases() {
  return readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json') || f.endsWith('.json.gz'))
    .sort()
    .map((f) => ({ name: `fixture ${f}`, path: join(FIXTURES, f) }));
}

const CASES = [...presetCases(), ...fixtureCases()];

// The large fixture is committed gzipped.
const readRules = (path) =>
  JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString('utf8') : readFileSync(path, 'utf8'));

/** What the server would hand the client for this rules.json's player. */
function serverDataFor(rules) {
  const p = rules.playerId ?? Object.keys(rules.world)[0];
  const scouts = [];
  const locationNameToId = {};
  for (const region of Object.values(rules.regions[p])) {
    for (const location of region.locations) {
      if (location.id === null || location.id === undefined) continue;
      locationNameToId[location.name] = location.id;
      scouts.push({
        locationId: location.id,
        locationName: location.name,
        itemName: location.item.name,
        player: location.item.player,
        progression: location.item.advancement,
      });
      // The file keeps an item's classification; LocationInfo carries it as flags.
      const classification = rules.items[p][location.item.name]?.classification;
      Object.assign(scouts[scouts.length - 1], {
        itemId: rules.items[p][location.item.name]?.id,
        useful: classification === 'useful',
        trap: classification === 'trap',
      });
    }
  }
  // The game's own DataPackage: the file's item table minus the other games'
  // items placed here (the exporter lists those too).
  const foreign = new Set(scouts.filter((s) => s.player !== Number(p)).map((s) => s.itemName));
  const itemNameToId = {};
  for (const item of Object.values(rules.items[p])) {
    if (item.id !== null && item.id !== undefined && !foreign.has(item.name)) itemNameToId[item.name] = item.id;
  }
  return {
    p,
    slotData: rules.world[p].slot_data,
    scouts,
    context: {
      slot: Number(p),
      names: rules.player_names,
      seedName: rules.seed_name,
      game: rules.world[p].game,
      itemNameToId,
      locationNameToId,
      archipelagoVersion: rules.archipelago_version,
    },
  };
}

// Fields the server cannot know. Everything else is compared.
const IGNORED_TOP = ['generation_seed', 'preset_label', 'playerId'];
const IGNORED_WORLD = ['preset_label'];
// Options the server sends (slot_data) or that follow from them; the rest
// (starting_nodes %, randomize_starting_nodes, progression_balancing,
// accessibility when randomized, the common list options) are not sent, so the
// built document carries the defaults. graph_file is compared when slot_data
// names it: the committed presets predate sending it.
const COMPARED_OPTIONS = ['entrance_rule_mode', 'randomize_items', 'vanilla_placement'];

// A per-player slice (_P<N>_rules.json) leaves these out when empty; a
// single-player document keeps them as {}. Either form is the same.
const EMPTY_EQUALS_ABSENT = ['exporter', 'preset_sidecars'];

function without(object, keys) {
  const copy = { ...object };
  for (const key of keys) delete copy[key];
  for (const key of EMPTY_EQUALS_ABSENT) {
    if (copy[key] && typeof copy[key] === 'object' && Object.keys(copy[key]).length === 0) delete copy[key];
  }
  return copy;
}

describe('buildDepgraphRules equivalence with the exporter', () => {
  it('has cases for every entrance rule mode', () => {
    const modes = new Set(
      CASES.map(({ path }) => {
        const rules = readRules(path);
        const p = rules.playerId ?? Object.keys(rules.world)[0];
        return rules.world[p].options.entrance_rule_mode;
      })
    );
    expect([...modes].sort()).toEqual([0, 1, 2, 3]);
    expect(CASES.length).toBeGreaterThanOrEqual(28 + 3);
  });

  it('has cases with starting nodes, in order and randomized', () => {
    const starts = CASES.map(({ path }) => {
      const rules = readRules(path);
      const p = rules.playerId ?? Object.keys(rules.world)[0];
      return rules.world[p].slot_data.starting_nodes;
    }).filter((list) => list.length > 1);
    // [1, 2, 3] from randomize_starting_nodes false; anything else from true.
    expect(starts.some((list) => list.join() === [...list].sort((x, y) => x - y).join())).toBe(true);
    expect(starts.some((list) => list.join() !== [...list].sort((x, y) => x - y).join())).toBe(true);
  });

  it('has a case with a starting node nothing depends on (an empty, dynamically_added region)', () => {
    const marked = CASES.some(({ path }) => {
      const rules = readRules(path);
      const p = rules.playerId ?? Object.keys(rules.world)[0];
      return Object.values(rules.regions[p]).some((region) => region.dynamically_added);
    });
    expect(marked).toBe(true);
  });

  for (const { name, path } of CASES) {
    it(name, () => {
      const expected = readRules(path);
      const { p, slotData, scouts, context } = serverDataFor(expected);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let built;
      try {
        built = buildDepgraphRules(slotData, scouts, context);
      } finally {
        warn.mockRestore();
      }

      // Logic and placements, one field at a time for readable failures.
      expect(built.regions).toEqual(expected.regions);
      expect(built.items).toEqual(expected.items);
      expect(built.starting_items).toEqual(expected.starting_items);
      expect(built.itempool_counts).toEqual(expected.itempool_counts);
      expect(built.canonical_placements).toEqual(expected.canonical_placements);
      expect(built.game_info).toEqual(expected.game_info);
      expect(built.start_regions).toEqual(expected.start_regions);

      const builtWorld = built.world[p];
      const expectedWorld = expected.world[p];
      for (const key of COMPARED_OPTIONS) {
        expect(builtWorld.options[key], `options.${key}`).toEqual(expectedWorld.options[key]);
      }
      if ('graph_file' in slotData) expect(builtWorld.options.graph_file).toEqual(expectedWorld.options.graph_file);
      expect(without(builtWorld, [...IGNORED_WORLD, 'options'])).toEqual(
        without(expectedWorld, [...IGNORED_WORLD, 'options'])
      );
      expect(without(built, [...IGNORED_TOP, 'world'])).toEqual(without(expected, [...IGNORED_TOP, 'world']));
    });
  }
});

describe('depgraphWorldInfo.json', () => {
  it('matches the apworld metadata in every committed DepGraph preset', () => {
    for (const { name, path } of presetCases()) {
      const rules = readRules(path);
      const world = rules.world['1'];
      const context = `${name} (refresh depgraphWorldInfo.json from a regenerated preset)`;
      expect(world.option_definitions, context).toEqual(WORLD_INFO.option_definitions);
      expect(world.web, context).toEqual(WORLD_INFO.web);
      expect(world.world_description, context).toEqual(WORLD_INFO.world_description);
      expect(world.world_class_name, context).toEqual(WORLD_INFO.world_class_name);
      expect(world.world_directory, context).toEqual(WORLD_INFO.world_directory);
      expect(rules.game_directory, context).toEqual(WORLD_INFO.game_directory);
      expect(Object.keys(world.options).sort(), context).toEqual(Object.keys(WORLD_INFO.default_options).sort());
    }
  });
});

describe('buildDepgraphRules output', () => {
  const fixture = JSON.parse(readFileSync(join(FIXTURES, 'mode3_with_apquest_P1.json'), 'utf8'));

  it('validates against rules.schema.json', () => {
    const schema = JSON.parse(readFileSync(join(ROOT, 'frontend', 'schema', 'rules.schema.json'), 'utf8'));
    const { slotData, scouts, context } = serverDataFor(fixture);
    const built = buildDepgraphRules(slotData, scouts, context);
    expect(rulesJsonSchemaErrors(built, schema)).toEqual([]);
  });

  it('names a placed item from the receiving game', () => {
    const { slotData, scouts, context } = serverDataFor(fixture);
    const built = buildDepgraphRules(slotData, scouts, context);
    const placed = Object.values(built.regions['1']).flatMap((r) => r.locations.map((l) => l.item));
    expect(placed.some((item) => item?.player === 2 && item.name === 'Key')).toBe(true);
  });

  it('keys everything by the slot number', () => {
    const { slotData, scouts, context } = serverDataFor(fixture);
    const built = buildDepgraphRules(slotData, scouts, { ...context, slot: 2 });
    expect(built.playerId).toBe('2');
    expect(Object.keys(built.regions)).toEqual(['2']);
    expect(built.world['2'].slot_data).toBe(slotData);
  });

  it('omits seed_name when the room has none (seedless)', () => {
    const { slotData, scouts, context } = serverDataFor(fixture);
    const built = buildDepgraphRules(slotData, scouts, { ...context, seedName: null });
    expect('seed_name' in built).toBe(false);
  });

  it('throws without a graph_structure', () => {
    expect(() => buildDepgraphRules({}, [], { slot: 1 })).toThrow(/graph_structure/);
  });
});

describe('entranceRuleModeOf', () => {
  it('reads the mode from slot_data', () => {
    for (const mode of [0, 1, 2, 3]) expect(entranceRuleModeOf({ entrance_rule_mode: mode })).toBe(mode);
  });

  it('falls back to the world default with a warning when slot_data lacks it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(entranceRuleModeOf({})).toBe(WORLD_INFO.option_definitions.entrance_rule_mode.default);
      expect(entranceRuleModeOf({})).toBe(1);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

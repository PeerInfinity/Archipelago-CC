/**
 * Equivalence: the APCalc rules.json built from server data must match the
 * exporter's rules.json for the same seed.
 *
 * Each case feeds the builder what the server would send for that seed:
 * slot_data (the exporter keeps a copy in world[p].slot_data), the scouts
 * (the file's own placements, turned into LocationInfo entries), and the
 * DataPackage tables (the file's item and location IDs). The output is then
 * compared field by field with the file.
 *
 * Cases: every committed APCalc preset (default options), plus committed
 * fixtures (generated with the current apworld, NOT presets) for the option
 * values the presets don't cover: unrandomized items with ops 2 / digits 3 /
 * no junk / 3 branches over 5 spheres; 10 spheres with ops 3 / digits 4 /
 * junk 5 / 10 branches; player 2 of a room with two APCalc slots; and player 1
 * of an APCalc + APQuest room (APQuest items in its locations, its buttons in
 * APQuest's).
 *
 * The committed presets predate slot_data's per-edge path_costs and sphere and
 * its generation options. For them the test supplies what the current apworld
 * sends, from the file's own world.generated_edges and world.options; the
 * fixtures carry the real fields.
 *
 * The builder is registered for game "APCalc" (worlds/apcalc) only. A puzzle
 * built in the APCalc Generator panel is game "APCalc Puzzle <seed>-<hash>"
 * (puzzleIdentity) and must never reach it: its rules come from its own
 * rules.json, not from slot_data.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { buildApcalcRules, pathCostsRule, summarizeApcalcRules } from './apcalcRulesBuilder.js';
import WORLD_INFO from './apcalcWorldInfo.json' with { type: 'json' };
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { hasServerDataBuilder } from '../client/core/serverDataRules.js';
import { puzzleIdentity, PUZZLE_PARAM_KEYS } from '../apcalcGenerator/apcalcGeneratorEngine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const FIXTURES = join(HERE, 'fixtures', 'apcalcRulesBuilder');

function presetCases() {
  const dir = join(ROOT, 'frontend', 'presets', 'apcalc');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .map((folder) => ({ name: `apcalc/${folder}`, path: join(dir, folder, `${folder}_rules.json`), preset: true }))
    .filter(({ path }) => existsSync(path));
}

function fixtureCases() {
  return readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json') || f.endsWith('.json.gz'))
    .sort()
    .map((f) => ({ name: `fixture ${f}`, path: join(FIXTURES, f), preset: false }));
}

const CASES = [...presetCases(), ...fixtureCases()];
const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'frontend', 'schema', 'rules.schema.json'), 'utf8'));

const readRules = (path) =>
  JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString('utf8') : readFileSync(path, 'utf8'));

const playerOf = (rules) => rules.playerId ?? Object.keys(rules.world)[0];

/** A committed preset's slot_data as the current apworld sends it (see the header). */
function withCurrentSlotData(rules) {
  const p = playerOf(rules);
  const world = rules.world[p];
  const slotData = world.slot_data;
  if (slotData.edges.every((edge) => Array.isArray(edge.path_costs))) return rules;
  world.slot_data = {
    ...slotData,
    edges: slotData.edges.map((edge, i) => ({
      ...edge,
      sphere: world.generated_edges[i].sphere,
      path_costs: world.generated_edges[i].path_costs,
    })),
  };
  for (const key of ['ops_per_sphere', 'nums_per_sphere', 'trash_per_sphere', 'max_branches']) {
    world.slot_data[key] = world.options[key];
  }
  world.slot_data.randomize_items = world.options.randomize_items;
  return rules;
}

/** What the server would hand the client for this rules.json's player. */
function serverDataFor(rules) {
  const p = playerOf(rules);
  const scouts = [];
  const locationNameToId = {};
  for (const region of Object.values(rules.regions[p])) {
    for (const location of region.locations) {
      if (location.id === null || location.id === undefined) continue;
      locationNameToId[location.name] = location.id;
      const classification = rules.items[p][location.item.name]?.classification;
      scouts.push({
        locationId: location.id,
        locationName: location.name,
        itemName: location.item.name,
        itemId: rules.items[p][location.item.name]?.id,
        player: location.item.player,
        progression: location.item.advancement,
        useful: classification === 'useful',
        trap: classification === 'trap',
      });
    }
  }
  // The game's own DataPackage: the file's APCalc items (all in the world's
  // one group), not the other games' items placed here. Another slot's
  // APCalc items placed here carry our names, so "foreign by player" is not
  // the test: in a two-APCalc room P1's buttons sit in P2's locations.
  const itemNameToId = {};
  for (const item of Object.values(rules.items[p])) {
    if (item.id !== null && item.id !== undefined && item.groups.includes('Everything')) itemNameToId[item.name] = item.id;
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
// Options slot_data sends; the rest (progression_balancing, accessibility, the
// common list options) are not sent, so the built document carries the defaults.
const COMPARED_OPTIONS = ['num_spheres', 'ops_per_sphere', 'nums_per_sphere', 'trash_per_sphere', 'max_branches', 'randomize_items'];
const EMPTY_EQUALS_ABSENT = ['exporter', 'preset_sidecars'];

function without(object, keys) {
  const copy = { ...object };
  for (const key of keys) delete copy[key];
  for (const key of EMPTY_EQUALS_ABSENT) {
    if (copy[key] && typeof copy[key] === 'object' && Object.keys(copy[key]).length === 0) delete copy[key];
  }
  return copy;
}

function build(expected) {
  const { slotData, scouts, context } = serverDataFor(expected);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    return buildApcalcRules(slotData, scouts, context);
  } finally {
    warn.mockRestore();
  }
}

describe('buildApcalcRules equivalence with the exporter', () => {
  it('covers the presets plus option values they do not', () => {
    expect(CASES.filter((c) => c.preset).length).toBeGreaterThanOrEqual(3);
    const worlds = CASES.map(({ path }) => {
      const rules = readRules(path);
      return { rules, world: rules.world[playerOf(rules)] };
    });
    expect(worlds.some(({ world }) => world.options.randomize_items === false)).toBe(true);
    expect(worlds.some(({ world }) => world.options.trash_per_sphere === 0)).toBe(true);
    expect(worlds.some(({ world }) => world.options.ops_per_sphere === 3)).toBe(true);
    // another game's items in our locations, and a player other than 1
    expect(worlds.some(({ rules }) => Object.keys(rules.player_names).length > 1 && playerOf(rules) !== '1')).toBe(true);
    expect(
      worlds.some(({ rules }) =>
        Object.values(rules.regions[playerOf(rules)]).some((r) =>
          r.locations.some((l) => l.item.player !== Number(playerOf(rules)))
        )
      )
    ).toBe(true);
    // a node value beyond 2^53 (see the name_substitutions note below)
    expect(
      worlds.some(({ world }) => Object.values(world.slot_data.nodes).some((n) => !Number.isSafeInteger(n.value)))
    ).toBe(true);
    // a starting button that is also in the pool (max_count > 1 from both)
    expect(
      worlds.some(({ rules }) => {
        const p = playerOf(rules);
        return rules.starting_items[p].some((name) => rules.items[p][name].max_count > 1);
      })
    ).toBe(true);
  });

  it('keeps apcalcWorldInfo.json equal to every committed preset', () => {
    for (const { path } of CASES.filter((c) => c.preset)) {
      const rules = readRules(path);
      const world = rules.world[playerOf(rules)];
      expect(rules.game_directory).toBe(WORLD_INFO.game_directory);
      expect(world.world_class_name).toBe(WORLD_INFO.world_class_name);
      expect(world.world_directory).toBe(WORLD_INFO.world_directory);
      expect(world.world_description).toBe(WORLD_INFO.world_description);
      expect(world.web).toEqual(WORLD_INFO.web);
      expect(world.option_definitions).toEqual(WORLD_INFO.option_definitions);
      expect(world.options).toEqual(WORLD_INFO.default_options);
    }
  });

  for (const { name, path, preset } of CASES) {
    it(name, () => {
      const expected = preset ? withCurrentSlotData(readRules(path)) : readRules(path);
      const p = playerOf(expected);
      const built = build(expected);

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
      // A node value beyond 2^53 reaches JS rounded (JSON.parse, here and in
      // the client alike), so its display name can differ in the last digits.
      // Only those names are left out; the regions and rules use generic names.
      const unsafe = new Set(
        Object.values(expectedWorld.slot_data.nodes)
          .filter((node) => !Number.isSafeInteger(node.value))
          .map((node) => node.location_name.replace('Check ', ''))
      );
      const safeNames = (subs) => ({
        locations: Object.fromEntries(
          Object.entries(subs.locations || {}).filter(([k]) => !unsafe.has(k.replace('Check ', '')))
        ),
        regions: Object.fromEntries(
          Object.entries(subs.regions || {}).filter(([k]) => !unsafe.has(k.replace('Region ', '')))
        ),
        items: subs.items,
      });
      expect(safeNames(builtWorld.name_substitutions)).toEqual(safeNames(expectedWorld.name_substitutions));
      const ignoredWorld = [...IGNORED_WORLD, 'options', 'name_substitutions'];
      expect(without(builtWorld, ignoredWorld)).toEqual(without(expectedWorld, ignoredWorld));
      expect(without(built, [...IGNORED_TOP, 'world'])).toEqual(without(expected, [...IGNORED_TOP, 'world']));
      expect(rulesJsonSchemaErrors(built, SCHEMA)).toEqual([]);
    });
  }
});

describe('buildApcalcRules without the data it needs', () => {
  it('throws when slot_data edges carry no path_costs (an older apworld)', () => {
    const rules = readRules(presetCases()[0].path);
    const { slotData, scouts, context } = serverDataFor(rules);
    expect(() => buildApcalcRules(slotData, scouts, context)).toThrow(/path_costs/);
  });
});

describe('pathCostsRule (set_rules._path_costs_to_rule as rule_builder resolves it)', () => {
  it('one cost: Has, HasAll or HasAllCounts by its counts', () => {
    expect(pathCostsRule([{ 5: 1 }])).toEqual({ rule: 'Has', args: { item_name: 'Button: 5' } });
    expect(pathCostsRule([{ 9: 1, '+': 1, 3: 1 }])).toEqual({
      rule: 'HasAll',
      args: { item_names: ['Button: +', 'Button: 3', 'Button: 9'] },
    });
    expect(pathCostsRule([{ 9: 2, '-': 1 }])).toEqual({
      rule: 'HasAllCounts',
      args: { item_counts: { 'Button: -': 1, 'Button: 9': 2 } },
    });
    expect(pathCostsRule([])).toEqual({ rule: 'True_' });
  });

  it('parallel edges: Or of the unique costs, single-button ones folded last', () => {
    // The generator has not produced a parallel edge in any preset or in a
    // 300-config sweep, so this branch is pinned here, not by a fixture.
    expect(pathCostsRule([{ 1: 1, '+': 1 }, { '+': 1, 1: 1 }])).toEqual({
      rule: 'HasAll',
      args: { item_names: ['Button: +', 'Button: 1'] },
    });
    expect(pathCostsRule([{ 4: 1 }, { 1: 2, '*': 1 }, { 7: 1 }])).toEqual({
      rule: 'Or',
      children: [
        { rule: 'HasAllCounts', args: { item_counts: { 'Button: *': 1, 'Button: 1': 2 } } },
        { rule: 'HasAny', args: { item_names: ['Button: 4', 'Button: 7'] } },
      ],
    });
  });
});

describe('summarizeApcalcRules', () => {
  it('names the node and sphere counts', () => {
    expect(summarizeApcalcRules({ nodes: { 'Region 1': {}, 'Region 2': {} }, num_spheres: 8 })).toBe(
      '(2 nodes, 8 spheres)'
    );
  });
});

describe('which rooms the builder serves', () => {
  it('is registered for worlds/apcalc ("APCalc")', () => {
    expect(hasServerDataBuilder('APCalc')).toBe(true);
  });

  it('never serves a browser-built puzzle ("APCalc Puzzle <seed>-<hash>")', () => {
    const params = Object.fromEntries(PUZZLE_PARAM_KEYS.map((k, i) => [k, i + 2]));
    for (const seed of [1, 7, 42, 'abc']) {
      const { gameName } = puzzleIdentity({ seed, ...params });
      expect(gameName.startsWith('APCalc Puzzle ')).toBe(true);
      expect(hasServerDataBuilder(gameName)).toBe(false);
    }
    // Nor the retired worldgen copy, nor near-misses of the name.
    for (const game of ['APCalc WorldGen', 'apcalc', 'APCalc ', 'APCalc Puzzle']) {
      expect(hasServerDataBuilder(game)).toBe(false);
    }
  });
});

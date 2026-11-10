// The room's spoiler data, rebuilt, IS the spoiler log: like with like.
//
// One multiworld (fixtures/spoilerData/make_fixtures.py: seed 1, ALttP slot 1 +
// APQuest slot 2) gives both sides: the real Spoiler Export Hook's records, and
// the real exporter logger's per-player files (json_tools.sphere_log_per_player,
// all locations, fractional, incremental). expandSpoilerData on a record must
// give that player's file line for line:
//   - the same labels, in the same order;
//   - the player's own sphere_locations and base_items;
//   - its new_accessible_regions, when the record carries regions;
//   - every other world's entry (the senders), exactly, when it carries senders.
// Not compared: the player's resolved_items and new_accessible_locations (the
// room sends {} and []), and the metadata's event lists (the room lists the
// rows it sent by name); both name `filtered_to_player`. Without senders the file's other-world entries are
// stripped before comparing.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { SphereState } from '../../sphereState/sphereState.js';
import { CostPlanner } from '../../shared/procgen/loopCostPlanner.js';
import { expandSpoilerData, tablesFromDataPackage } from './spoilerData.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/spoilerData');
const read = (name) => readFileSync(join(DIR, name), 'utf8');
const parse = (text) => text.trim().split('\n').map((line) => JSON.parse(line));
const SEED = JSON.parse(read('seed.json'));
const RECORDS = {
  own_slot: JSON.parse(read('own_slot.json')),
  own_slot_with_senders: JSON.parse(read('own_slot_with_senders.json')),
  own_slot_regions: JSON.parse(read('own_slot_regions.json')),
  own_slot_with_senders_regions: JSON.parse(read('own_slot_with_senders_regions.json')),
};
const LEVELS = [
  { name: 'own_slot', senders: false, regions: false },
  { name: 'own_slot_with_senders', senders: true, regions: false },
  { name: 'own_slot_regions', senders: false, regions: true },
  { name: 'own_slot_with_senders_regions', senders: true, regions: true },
];
const PLAYERS = ['1', '2'];
const FILE = Object.fromEntries(PLAYERS.map((p) => [p, parse(read(`sphere_log_P${p}.jsonl`))]));
const COMBINED = parse(read('sphere_log.jsonl'));
const tables = (p) => tablesFromDataPackage(SEED.data_package, SEED.slot_info, p);

/** The compared view of one line: own fields per the level, other worlds' entries whole (or none). */
function comparable(line, p, { senders, regions }) {
  const out = {};
  for (const [player, entry] of Object.entries(line.player_data)) {
    if (player === p) {
      out[player] = {
        sphere_locations: entry.sphere_locations,
        base_items: entry.new_inventory_details.base_items,
        ...(regions ? { regions: [...entry.new_accessible_regions].sort() } : {}),
      };
    } else if (senders) {
      out[player] = entry;
    }
  }
  return { sphere_index: line.sphere_index, player_data: out };
}

describe.each(LEVELS)('$name: the rebuilt room lines equal the per-player file', (level) => {
  it.each(PLAYERS)('slot %s', (p) => {
    const room = expandSpoilerData(RECORDS[level.name][p], tables(p));
    const file = FILE[p];
    expect(room[0].seed_name).toBe(file[0].seed_name);
    expect(file[0].filtered_to_player).toBe(p);
    expect(room[0].filtered_to_player).toBe(p);
    const roomLines = room.slice(1).map((line) => comparable(line, p, level));
    const fileLines = file.slice(1).map((line) => comparable(line, p, level));
    expect(roomLines.map((l) => l.sphere_index)).toEqual(fileLines.map((l) => l.sphere_index));
    expect(roomLines).toEqual(fileLines);
  });
});

describe('the comparison is not vacuous', () => {
  it('the files drop lines, carry senders and open regions after the start', () => {
    for (const p of PLAYERS) {
      expect(FILE[p].length).toBeLessThan(COMBINED.length);
      expect(FILE[p].some((l) => Object.keys(l.player_data || {}).length > 1)).toBe(true);
      expect(FILE[p].slice(2).some((l) => l.player_data?.[p]?.new_accessible_regions.length > 0)).toBe(true);
    }
  });

  it('a record without regions sends none, and one with them changes nothing else', () => {
    for (const p of PLAYERS) {
      expect(RECORDS.own_slot[p]).not.toHaveProperty('regions');
      const { regions, ...rest } = RECORDS.own_slot_regions[p];
      expect(regions.start.length).toBeGreaterThan(0);
      expect(rest).toEqual(RECORDS.own_slot[p]);
      const plain = expandSpoilerData(RECORDS.own_slot[p], tables(p));
      expect(plain.slice(1).every((l) => l.player_data[p].new_accessible_regions.length === 0)).toBe(true);
    }
  });
});

describe('regions from the room reach the region readers', () => {
  async function loaded(text, p) {
    const s = new SphereState(null);
    s.setCurrentPlayerId(p);
    expect(await s.loadSphereLog(`${p}.jsonl`, text)).toBe(true);
    return s;
  }
  const jsonl = (lines) => lines.map((line) => JSON.stringify(line)).join('\n');

  it.each(PLAYERS)('slot %s: sphereState accessibleRegions equal the file at every step', async (p) => {
    const room = await loaded(jsonl(expandSpoilerData(RECORDS.own_slot_regions[p], tables(p))), p);
    const file = await loaded(read(`sphere_log_P${p}.jsonl`), p);
    const regions = (s) => s.getSphereData().map((e) => [e.sphereIndex, e.accessibleRegions]);
    expect(regions(room)).toEqual(regions(file));
    expect(room.getSphereData().at(-1).accessibleRegions.length).toBeGreaterThan(1);
  });

  it.each(PLAYERS)('slot %s: the CostPlanner gets the file\'s newAccessibleRegions with regions, none without', (p) => {
    const entries = (log) => {
      const planner = Object.create(CostPlanner.prototype);
      planner._resolvePlayerId = () => p;
      return planner._extractLocationEntries(log);
    };
    const fromFile = entries(FILE[p]);
    expect(entries(expandSpoilerData(RECORDS.own_slot_regions[p], tables(p)))).toEqual(fromFile);
    expect(fromFile.some((e) => e.newAccessibleRegions.length > 0)).toBe(true);
    const plain = entries(expandSpoilerData(RECORDS.own_slot[p], tables(p)));
    expect(plain.every((e) => e.newAccessibleRegions.length === 0)).toBe(true);
  });
});

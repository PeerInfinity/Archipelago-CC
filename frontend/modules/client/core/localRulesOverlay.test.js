/**
 * The local rules.json of a generated world + the server's placements = the
 * room's rules.json.
 *
 * ⚖ (user, 2026-11-05) Only OUR generated worlds get the overlay; they are
 * recognised by world_generator's `use_canonical_options` option (census over
 * the committed presets: 24 of 24 world_generator slots, 0 of 212 others).
 *
 * Fixtures (`fixtures/localRulesOverlay/`, exporter output of Generate.py, not
 * presets): Cloudberry Sphere WorldGen alone at seed 3, and as P2 (Berry) of an
 * APQuest + Cloudberry Sphere room at seed 5, so two of its locations hold
 * APQuest items. The local document is the committed seed-1 preset.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GENERATED_WORLD_OPTION,
  checkLocalWorld,
  isGeneratedWorldDoc,
  overlayServerData,
  perPlayerKeysOf,
} from './localRulesOverlay.js';
import { exportRulesJson, generate } from '../../apcalcGenerator/apcalcGeneratorEngine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const readJson = (...parts) => JSON.parse(readFileSync(join(...parts), 'utf8'));
const fixture = (name) => readJson(HERE, 'fixtures', 'localRulesOverlay', name);
const preset = (dir, seed = '14089154938208861744') =>
  readJson(ROOT, 'frontend', 'presets', dir, `AP_${seed}`, `AP_${seed}_rules.json`);

const LOCAL = preset('cloudberry_sphere_worldgen');
const SOLO = fixture('cloudberry_sphere_seed3_rules.json');
const ROOM_P2 = fixture('cloudberry_sphere_with_apquest_seed5_P2_rules.json');

const FLAGS = { progression: 1, useful: 2, trap: 4 };

/** What the server sends for the exporter's slot `p`, recovered from its file. */
function serverView(doc, p) {
  const items = doc.items[p];
  const locations = Object.values(doc.regions[p])
    .flatMap((region) => region.locations)
    .filter((location) => location.id !== null);
  const scouts = locations.map((location) => {
    const flags = FLAGS[items[location.item.name].classification] ?? 0;
    return {
      locationId: location.id,
      locationName: location.name,
      itemId: items[location.item.name].id,
      itemName: location.item.name,
      player: location.item.player,
      flags,
      progression: (flags & 1) !== 0,
      useful: (flags & 2) !== 0,
      trap: (flags & 4) !== 0,
    };
  });
  return {
    slot: Number(p),
    names: { ...doc.player_names },
    seedName: doc.seed_name,
    slotData: doc.world[p].slot_data ?? {},
    scouts,
    slotGame: doc.world[p].game,
    locationIds: locations.map((location) => location.id),
    // The DataPackage of the slot's game: its own items (foreign entries have no groups).
    itemNameToId: Object.fromEntries(
      Object.values(items)
        .filter((item) => item.id !== null && item.groups?.length > 0)
        .map((item) => [item.name, item.id])
    ),
    locationNameToId: Object.fromEntries(locations.map((location) => [location.name, location.id])),
  };
}

/**
 * Fields the server doesn't send, so the overlay keeps the local file's:
 * `generation_seed`, and the world's own options (`randomize_items` is false in
 * the canonical seed-1 preset, true in a default room).
 */
function comparable(doc) {
  const copy = structuredClone(doc);
  delete copy.generation_seed;
  for (const world of Object.values(copy.world)) delete world.options.randomize_items;
  return copy;
}

describe('isGeneratedWorldDoc: the marker', () => {
  it('a world_generator preset carries it', () => {
    expect(isGeneratedWorldDoc(LOCAL, '1')).toBe(true);
    expect(isGeneratedWorldDoc(ROOM_P2, '2')).toBe(true);
  });

  it('the APCalc Generator panel export carries it', async () => {
    const doc = exportRulesJson(
      await generate({ seed: 7, numSpheres: 3, opsPerSphere: 1, numsPerSphere: 2, trashPerSphere: 0, maxBranches: 3, reuseAttempts: 3 }, () => {})
    );
    expect(doc.world['1'].options).toEqual({ randomize_items: true, [GENERATED_WORLD_OPTION]: true });
    expect(isGeneratedWorldDoc(doc, '1')).toBe(true);
  });

  it.each([
    ['apquest'],
    ['alttp'],
    ['adventure'],
    ['metamath'],
    ['apcalc'],
  ])('an upstream or hand-written world (%s) does not', (dir) => {
    expect(isGeneratedWorldDoc(preset(dir), '1')).toBe(false);
  });

  it('a document without options does not', () => {
    expect(isGeneratedWorldDoc({ world: { 1: { game: 'X' } } }, '1')).toBe(false);
    expect(isGeneratedWorldDoc(null, '1')).toBe(false);
  });
});

describe('perPlayerKeysOf', () => {
  const schema = readJson(ROOT, 'frontend', 'schema', 'rules.schema.json');
  const schemaPerPlayer = new Set(
    Object.entries(schema.properties).filter(([, v]) => v && v.patternProperties).map(([k]) => k)
  );

  it.each([['the Cloudberry preset', LOCAL], ['a multiworld P2 slice', ROOM_P2]])(
    'is the schema per-player properties that %s fills',
    (_, doc) => {
      const derived = perPlayerKeysOf(doc);
      expect(derived.length).toBeGreaterThan(0);
      for (const key of derived) expect(schemaPerPlayer.has(key), key).toBe(true);
      const filled = Object.keys(doc).filter(
        (k) => schemaPerPlayer.has(k) && doc[k] && Object.keys(doc[k]).length > 0
      );
      expect(new Set(derived)).toEqual(new Set(filled));
    }
  );
});

describe('checkLocalWorld', () => {
  it('passes the local file against the room it was built for', () => {
    for (const [doc, p] of [[SOLO, '1'], [ROOM_P2, '2']]) {
      const room = serverView(doc, p);
      expect(checkLocalWorld(LOCAL, '1', room)).toEqual({ ok: true, problems: [] });
    }
  });

  it('refuses another game', () => {
    const room = serverView(SOLO, '1');
    const { ok, problems } = checkLocalWorld(LOCAL, '1', { ...room, slotGame: 'Cloudberry Maze Mix WorldGen' });
    expect(ok).toBe(false);
    expect(problems[0]).toMatch(/slot plays Cloudberry Maze Mix WorldGen/);
  });

  it('refuses a location set that differs, either way', () => {
    const room = serverView(SOLO, '1');
    const extra = checkLocalWorld(LOCAL, '1', { ...room, locationIds: [...room.locationIds, 4242] });
    expect(extra.problems.join(' ')).toMatch(/1 server location\(s\) are not in the file: 4242/);
    const fewer = checkLocalWorld(LOCAL, '1', { ...room, locationIds: room.locationIds.slice(1) });
    expect(fewer.problems.join(' ')).toMatch(/1 file location\(s\) are not on the server: region_2_2__loc_0/);
  });

  it('refuses IDs that differ from the DataPackage', () => {
    const room = serverView(SOLO, '1');
    const locs = checkLocalWorld(LOCAL, '1', {
      ...room,
      locationNameToId: { ...room.locationNameToId, region_3_2__loc_0: 9 },
    });
    expect(locs.problems.join(' ')).toMatch(/1 location ID\(s\) differ.*region_3_2__loc_0/);
    const items = checkLocalWorld(LOCAL, '1', { ...room, itemNameToId: { ...room.itemNameToId, Clouds: 99 } });
    expect(items.problems.join(' ')).toMatch(/1 item ID\(s\) differ.*Clouds/);
  });
});

describe('overlayServerData = the exporter file at the room seed', () => {
  it('Cloudberry Sphere alone, seed 3 (placements differ from the local seed 1)', () => {
    const room = serverView(SOLO, '1');
    const built = overlayServerData(LOCAL, '1', room);
    const placed = (doc) =>
      Object.values(doc.regions['1']).flatMap((r) => r.locations.map((l) => `${l.name}=${l.item.name}`));
    expect(placed(LOCAL)).not.toEqual(placed(SOLO)); // the case is not vacuous
    // A one-player export has no playerId; every overlaid doc names its slot.
    expect(built.playerId).toBe('1');
    const { playerId: _, ...rest } = built;
    expect(comparable(rest)).toEqual(comparable(SOLO));
  });

  it('Cloudberry Sphere as P2 of an APQuest room, seed 5 (re-keyed slot, foreign items)', () => {
    const room = serverView(ROOM_P2, '2');
    expect(room.scouts.some((s) => s.player === 1)).toBe(true);
    const built = overlayServerData(LOCAL, '1', room);
    expect(Object.keys(built.regions)).toEqual(['2']);
    expect(comparable(built)).toEqual(comparable(ROOM_P2));
  });

  it("moves an event location's item to the room slot (found by the APCalc puzzle real-server check)", () => {
    const doc = structuredClone(LOCAL);
    doc.regions['1'].region_2_2.locations.push({
      name: 'Checked 2_2',
      id: null,
      access_rule: { rule: 'True_' },
      item: { name: 'Checked 2_2', player: 1, advancement: true, type: 'None' },
      locked: true,
      event: true,
    });
    const built = overlayServerData(doc, '1', serverView(ROOM_P2, '2'));
    const event = built.regions['2'].region_2_2.locations.find((l) => l.name === 'Checked 2_2');
    expect(event.item.player).toBe(2);
  });

  it('drops sphere_log and lays slot_data over the options it names', () => {
    const doc = structuredClone(LOCAL);
    doc.sphere_log = [{ sphere: 1 }];
    doc.world['1'].slot_data = { goal: 1 };
    doc.world['1'].options.goal = 1;
    const room = serverView(SOLO, '1');
    const built = overlayServerData(doc, '1', { ...room, slotData: { goal: 2, extra: [1] } });
    expect(built.sphere_log).toBeUndefined();
    expect(built.world['1'].slot_data).toEqual({ goal: 2, extra: [1] });
    expect(built.world['1'].options.goal).toBe(2);
    expect(built.world['1'].options.extra).toBeUndefined();
  });

  it('keeps the file slot_data when the server sends none', () => {
    const doc = structuredClone(LOCAL);
    doc.world['1'].slot_data = { goal: 1 };
    const built = overlayServerData(doc, '1', { ...serverView(SOLO, '1'), slotData: {} });
    expect(built.world['1'].slot_data).toEqual({ goal: 1 });
  });

  it('does not touch the local document', () => {
    const before = JSON.stringify(LOCAL);
    overlayServerData(LOCAL, '1', serverView(ROOM_P2, '2'));
    expect(JSON.stringify(LOCAL)).toBe(before);
  });

  it('throws when a location has no scout, or the server places an item the file lacks', () => {
    const room = serverView(SOLO, '1');
    expect(() => overlayServerData(LOCAL, '1', { ...room, scouts: room.scouts.slice(1) })).toThrow(
      /no scouted item for 1 location/
    );
    const scouts = room.scouts.map((s, i) => (i === 0 ? { ...s, itemName: 'Mystery' } : s));
    expect(() => overlayServerData(LOCAL, '1', { ...room, scouts })).toThrow(/placed Mystery/);
  });
});

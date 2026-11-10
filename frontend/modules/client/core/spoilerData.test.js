/**
 * The room's spoiler data (slot_data.spoiler_data from the Spoiler Export Hook) → a sphere log.
 *
 * Fixtures come from the REAL helper on a real seed (fixtures/spoilerData/make_fixtures.py: ALttP slot 1 +
 * APQuest slot 2, seed 1), with the exporter's all-locations log of the same multiworld as the baseline. The
 * expanded log must give the real SphereState and the real CostPlanner what that file gives them.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: vi.fn(() => null),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));
const stateManagerMock = vi.hoisted(() => ({
  getStaticData: vi.fn(() => null),
  getGameName: vi.fn(() => null),
  getLatestStateSnapshot: () => null,
  applyRuntimeStateData: vi.fn(),
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
  getLastRawJsonData: () => null,
}));
vi.mock('./storage.js', () => ({ default: { getItem: () => null, setItem: () => {}, initialize: () => {} } }));

import { SphereState } from '../../sphereState/sphereState.js';
import { CostPlanner } from '../../shared/procgen/loopCostPlanner.js';
import { MessageHandler } from './messageHandler.js';
import { overlayServerData, slotDataWithoutRules } from './localRulesOverlay.js';
import {
  describeOmitted,
  expandSpoilerData,
  readRoomSpoilerData,
  SPOILER_DATA_FORMATS,
  tablesFromDataPackage,
} from './spoilerData.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/spoilerData');
const read = (name) => readFileSync(join(DIR, name), 'utf8');
const SEED = JSON.parse(read('seed.json'));
const OWN = JSON.parse(read('own_slot.json'));
const SENDERS = JSON.parse(read('own_slot_with_senders.json'));
const OMITTED = JSON.parse(read('omitted.json'));
const UNKNOWN = JSON.parse(read('unknown_format.json'));
const LOG_TEXT = read('sphere_log.jsonl');
const LOG = LOG_TEXT.trim().split('\n').map((line) => JSON.parse(line));
const PLAYERS = Object.keys(OWN);

const tables = (p) => tablesFromDataPackage(SEED.data_package, SEED.slot_info, p);
const jsonl = (lines) => lines.map((line) => JSON.stringify(line)).join('\n');
const roomArgs = (slot) => ({ dataPackage: SEED.data_package, slotInfo: SEED.slot_info, slot, seedName: SEED.seed_name });

async function loaded(text, p) {
  const s = new SphereState(null);
  s.setCurrentPlayerId(p);
  expect(await s.loadSphereLog(`${p}.jsonl`, text)).toBe(true);
  return s;
}
const view = (s) => s.getSphereData().filter((e) => e.locations.length > 0)
  .map((e) => ({ sphereIndex: e.sphereIndex, locations: e.locations, base: e.inventoryDetails.base_items }));
const cumulative = (s) => s.getSphereData().at(-1).inventoryDetails.base_items;
function plannerEntries(log, p) {
  const planner = Object.create(CostPlanner.prototype);
  planner._resolvePlayerId = () => String(p);
  return planner._extractLocationEntries(log)
    .map(({ sphereIndex, locationName, itemsReceived }) => ({ sphereIndex, locationName, itemsReceived }));
}

describe('the fixtures are the real helper\'s output', () => {
  it('cover both slots, both levels, an omitted record, an unknown format and the name that does not round-trip', () => {
    expect(PLAYERS).toEqual(['1', '2']);
    expect(PLAYERS.every((p) => OWN[p].format === 1 && OWN[p].player === Number(p))).toBe(true);
    expect(PLAYERS.every((p) => OWN[p].steps.every((row) => row.length === 3))).toBe(true);
    expect(PLAYERS.every((p) => SENDERS[p].steps.some((row) => row.length === 4))).toBe(true);
    expect(OMITTED).toEqual({ spoiler_data_omitted: { reason: 'hook_absent' } });
    expect(SPOILER_DATA_FORMATS.has(UNKNOWN.format)).toBe(false);
    // ALttP: the helper sends "Progressive Bow" by NAME, because its id gives back "Progressive Bow (Alt)".
    expect(OWN['1'].steps.some((row) => row[2] === 'Progressive Bow')).toBe(true);
  });
});

describe.each(PLAYERS)('slot %s: the expanded record against the exporter\'s all-locations log', (p) => {
  it('parses in the real SphereState with the same own-location rows and cumulative items', async () => {
    const file = await loaded(LOG_TEXT, p);
    const room = await loaded(jsonl(expandSpoilerData(OWN[p], tables(p))), p);
    expect(view(room).length).toBeGreaterThan(0);
    expect(view(room)).toEqual(view(file));
    expect(cumulative(room)).toEqual(cumulative(file));
  });

  it('gives the real CostPlanner the same location entries', () => {
    const entries = plannerEntries(expandSpoilerData(OWN[p], tables(p)), p);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toEqual(plannerEntries(LOG, p));
  });

  it('with senders: the same rows, and each sender is the location the log collected at that step', async () => {
    const lines = expandSpoilerData(SENDERS[p], tables(p));
    expect(plannerEntries(lines, p)).toEqual(plannerEntries(LOG, p));
    const room = await loaded(jsonl(lines), p);
    const withSenders = room.getSphereData().filter((e) => e.receivedFrom);
    expect(withSenders).toHaveLength(SENDERS[p].steps.filter((row) => row.length === 4).length);
    const logAt = new Map(LOG.filter((l) => l.type === 'state_update').map((l) => [l.sphere_index, l]));
    for (const sphere of withSenders) {
      const [{ player, location }] = sphere.receivedFrom;
      expect(player).not.toBe(p);
      expect(logAt.get(sphere.sphereIndex).player_data[player].sphere_locations).toEqual([location]);
    }
    // Without senders nothing carries the field, and the rest of the view is unchanged.
    const plain = await loaded(jsonl(expandSpoilerData(OWN[p], tables(p))), p);
    expect(plain.getSphereData().some((e) => 'receivedFrom' in e)).toBe(false);
    expect(view(room)).toEqual(view(plain));
  });
});

describe('ids and names', () => {
  it('keeps a name the helper sent as a name (Progressive Bow, not the package\'s "Progressive Bow (Alt)")', async () => {
    const room = await loaded(jsonl(expandSpoilerData(OWN['1'], tables('1'))), '1');
    const file = await loaded(LOG_TEXT, '1');
    expect(cumulative(room)['Progressive Bow']).toBeGreaterThan(0);
    expect(cumulative(room)['Progressive Bow']).toBe(cumulative(file)['Progressive Bow']);
    expect(cumulative(room)['Progressive Bow (Alt)']).toBe(cumulative(file)['Progressive Bow (Alt)']);
  });

  it('turns ids into names with the slot\'s own game, and a sender\'s location with the sender\'s game', () => {
    const record = { format: 1, seed_name: 's', player: 1, start: [7], unreachable: 0,
      steps: [['0.1', 100, 7], ['0.2', null, 7, [2, 100]], ['1.1', 'Event', 'Win']] };
    const dataPackage = { games: {
      A: { item_name_to_id: { Sword: 7 }, location_name_to_id: { 'A Chest': 100 } },
      B: { item_name_to_id: { Feather: 7 }, location_name_to_id: { 'B Chest': 100 } },
    } };
    const lines = expandSpoilerData(record, tablesFromDataPackage(dataPackage, { 1: { game: 'A' }, 2: { game: 'B' } }, 1));
    expect(lines[0]).toMatchObject({ type: 'metadata', seed_name: 's', event_locations: { 1: ['Event'] }, event_items: { 1: ['Win'] } });
    expect(lines[1].player_data['1'].new_inventory_details.base_items).toEqual({ Sword: 1 });
    expect(lines[2].player_data['1']).toMatchObject({ sphere_locations: ['A Chest'], new_inventory_details: { base_items: { Sword: 1 } } });
    expect(lines[3].player_data['1'].received_from).toEqual([{ player: '2', location: 'B Chest' }]);
    expect(lines[3].player_data['1'].sphere_locations).toEqual([]);
    expect(lines[4].player_data['1']).toMatchObject({ sphere_locations: ['Event'], new_inventory_details: { base_items: { Win: 1 } } });
  });
});

describe('readRoomSpoilerData: what the room says', () => {
  it('a record → a log named for the room, with no message', () => {
    const result = readRoomSpoilerData({ spoiler_data: OWN['2'] }, roomArgs(2));
    expect(result.message).toBeUndefined();
    expect(result.log.source).toBe(`room:${SEED.seed_name}:P2`);
    expect(result.log.text).toBe(jsonl(expandSpoilerData(OWN['2'], tables('2'))));
  });

  it('spoiler_data_omitted → one line saying why; neither key → nothing', () => {
    expect(readRoomSpoilerData(OMITTED, roomArgs(1))).toEqual({
      message: 'This room has no spoiler data: the generator did not have the Spoiler Export Hook.', type: 'info',
    });
    expect(readRoomSpoilerData({}, roomArgs(1))).toBeNull();
    expect(readRoomSpoilerData(undefined, roomArgs(1))).toBeNull();
    expect(describeOmitted({ reason: 'over_cap', size_bytes: 2000000, cap_bytes: 1048576 }))
      .toBe("This room has no spoiler data: it was 2000000 bytes, over the Spoiler Export Hook's 1048576-byte limit.");
    expect(describeOmitted({ reason: 'race' })).toBe('This room has no spoiler data: it is never sent in a race seed.');
    expect(describeOmitted({ reason: 'new_reason' })).toBe('This room has no spoiler data: the generator gave the reason "new_reason".');
  });

  it('an unknown format → a warning and no log', () => {
    const result = readRoomSpoilerData({ spoiler_data: UNKNOWN }, roomArgs(1));
    expect(result.log).toBeUndefined();
    expect(result).toMatchObject({ type: 'warning' });
    expect(result.message).toContain(`format ${UNKNOWN.format}`);
    expect(expandSpoilerData(UNKNOWN, tables('1'))).toBeNull();
  });

  it('another slot\'s record, another seed\'s, or no DataPackage for the game → a warning and no log', () => {
    expect(readRoomSpoilerData({ spoiler_data: OWN['1'] }, roomArgs(2)).log).toBeUndefined();
    expect(readRoomSpoilerData({ spoiler_data: OWN['1'] }, { ...roomArgs(1), seedName: 'other' }).log).toBeUndefined();
    expect(readRoomSpoilerData({ spoiler_data: OWN['1'] }, { ...roomArgs(1), dataPackage: { games: {} } }).message)
      .toContain('DataPackage has no A Link to the Past');
  });
});

describe('the overlay does not copy the room\'s spoiler data into the world\'s slot_data', () => {
  it('slotDataWithoutRules drops spoiler_data and spoiler_data_omitted with the rules keys', () => {
    expect(slotDataWithoutRules({ a: 1, spoiler_data: OWN['1'] })).toEqual({ a: 1 });
    expect(slotDataWithoutRules({ a: 1, spoiler_data_omitted: { reason: 'race' } })).toEqual({ a: 1 });
    expect(slotDataWithoutRules({ a: 1, worldgen_rules: {}, spoiler_data: {} })).toEqual({ a: 1 });
    const kept = { a: 1 };
    expect(slotDataWithoutRules(kept)).toBe(kept);
  });

  it('overlayServerData leaves it out of world.slot_data', () => {
    const doc = { world: { 1: { game: 'G', slot_data: {}, options: {} } }, locations: {} };
    const out = overlayServerData(doc, '1', { slot: 1, slotData: { a: 1, spoiler_data: OWN['1'], spoiler_data_omitted: {} } });
    expect(out.world['1'].slot_data).toEqual({ a: 1 });
  });
});

describe('MessageHandler on Connected', () => {
  let handler;
  let published;
  beforeEach(() => {
    published = [];
    handler = new MessageHandler();
    handler.setEventBus({ publish: (name, payload) => published.push({ name, payload }), subscribe: () => () => {} });
    handler.dataPackage = SEED.data_package;
    handler.roomInfo = { seed_name: SEED.seed_name };
  });
  const connected = (slotData, slot = 1) => ({
    cmd: 'Connected', slot, team: 0, players: [], missing_locations: [], checked_locations: [],
    slot_data: slotData, slot_info: SEED.slot_info,
  });
  const named = (name) => published.filter((e) => e.name === name);

  it('publishes the expanded log for sphereState, and prints nothing', async () => {
    await handler._handleConnected(connected({ spoiler_data: SENDERS['1'] }));
    const [event] = named('client:roomSpoilerData');
    expect(event.payload).toEqual(readRoomSpoilerData({ spoiler_data: SENDERS['1'] }, roomArgs(1)).log);
    expect(named('ui:printToConsole')).toEqual([]);
  });

  it('with spoiler_data_omitted prints one line and publishes no log; with neither key, neither', async () => {
    await handler._handleConnected(connected(OMITTED));
    expect(named('ui:printToConsole').map((e) => e.payload)).toEqual([
      { message: 'This room has no spoiler data: the generator did not have the Spoiler Export Hook.', type: 'info' },
    ]);
    published.length = 0;
    await handler._handleConnected(connected({ other: 1 }));
    expect(named('ui:printToConsole')).toEqual([]);
    expect(named('client:roomSpoilerData')).toEqual([]);
  });

  it('a record it cannot read is a warning line, never a thrown Connected', async () => {
    await handler._handleConnected(connected({ spoiler_data: { format: 1, player: 1, steps: 'not rows' } }));
    expect(named('ui:printToConsole')[0].payload.type).toBe('warning');
    expect(named('client:roomSpoilerData')).toEqual([]);
  });
});

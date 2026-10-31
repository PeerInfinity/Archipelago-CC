/**
 * Unit tests for building a slot's rules from server data at connect time.
 *
 * ⚖ Rulings (2026-10-30): when no preset matches the room and the game is
 * Metamath (picked, the room's only game, or the loaded rules' game at another
 * seed), the client connects, then on Connected: scout → wait for
 * LocationInfo → build → ONE loadRules → apply the runtime state (Connected,
 * then the ReceivedItems/RoomUpdate held meanwhile). The player sees console
 * lines only. On failure the client stays connected and applies the held
 * packets against the rules already loaded.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: vi.fn(() => null),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

const calls = vi.hoisted(() => []);
const stateManagerMock = vi.hoisted(() => ({
  staticData: null,
  getStaticData: vi.fn(() => stateManagerMock.staticData),
  getGameName: vi.fn(() => stateManagerMock.staticData?.game_name ?? null),
  getLatestStateSnapshot: () => null,
  applyRuntimeStateData: vi.fn((payload) => calls.push(['applyRuntimeStateData', payload])),
  beginBatchUpdate: vi.fn(async () => {}),
  commitBatchUpdate: vi.fn(async () => {}),
  addItemToInventory: vi.fn(async (name) => calls.push(['addItemToInventory', name])),
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
}));

vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler } from './messageHandler.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// Player 1 (Mathy, Metamath 2p2e4, entrance mode 3) of a Metamath + APQuest room.
const FIXTURE = JSON.parse(
  readFileSync(
    join(HERE, '..', '..', 'proofShared', 'fixtures', 'metamathRulesBuilder', 'mode3_2p2e4_with_apquest_P1.json'),
    'utf8'
  )
);

const SEED = '62126080856822086120';

// What the server knows about that room, recovered from the exporter's file.
const placements = Object.values(FIXTURE.regions['1'])
  .flatMap((region) => region.locations)
  .filter((location) => location.id !== null);
const metamathItems = Object.fromEntries(
  Object.values(FIXTURE.items['1'])
    .filter((item) => /^Statement \d+$/.test(item.name))
    .map((item) => [item.name, item.id])
);
const apquestItems = { Sword: 2, 'Health Upgrade': 5, 'Confetti Cannon': 6 };
const DATA_PACKAGE = {
  games: {
    Metamath: {
      item_name_to_id: metamathItems,
      location_name_to_id: Object.fromEntries(placements.map((l) => [l.name, l.id])),
    },
    APQuest: { item_name_to_id: apquestItems, location_name_to_id: {} },
  },
};
const itemIdOf = (item) => (item.player === 1 ? metamathItems[item.name] : apquestItems[item.name]);
const LOCATION_INFO = {
  cmd: 'LocationInfo',
  locations: placements.map((l) => ({
    item: itemIdOf(l.item),
    location: l.id,
    player: l.item.player,
    flags: { progression: 1, useful: 2, trap: 4 }[FIXTURE.items['1'][l.item.name].classification] ?? 0,
  })),
};

function connected(slotData = FIXTURE.world['1'].slot_data) {
  return {
    cmd: 'Connected',
    slot: 1,
    team: 0,
    players: [
      { team: 0, slot: 1, alias: 'Mathy', name: 'Mathy' },
      { team: 0, slot: 2, alias: 'Questy', name: 'Questy' },
    ],
    missing_locations: placements.map((l) => l.id),
    checked_locations: [],
    slot_data: slotData,
    slot_info: {
      1: { name: 'Mathy', game: 'Metamath', type: 1, group_members: [] },
      2: { name: 'Questy', game: 'APQuest', type: 1, group_members: [] },
    },
  };
}

// The start inventory (location -2) and one item sent by player 2.
const RECEIVED_ITEMS = {
  cmd: 'ReceivedItems',
  index: 0,
  items: [
    { item: metamathItems['Statement 1'], location: -2, player: 0, flags: 1 },
    { item: metamathItems['Statement 3'], location: 1, player: 2, flags: 1 },
  ],
};

function makeBus({ answerLoads = true } = {}) {
  const subscribers = new Map();
  const published = [];
  const bus = {
    published,
    subscribe: vi.fn((event, cb) => {
      if (!subscribers.has(event)) subscribers.set(event, new Set());
      subscribers.get(event).add(cb);
      return () => subscribers.get(event)?.delete(cb);
    }),
    publish: vi.fn((event, data) => {
      published.push({ event, data });
      if (event === 'files:jsonLoaded') calls.push(['files:jsonLoaded', data]);
      for (const cb of [...(subscribers.get(event) || [])]) cb(data);
      if (event === 'files:jsonLoaded' && answerLoads) {
        setTimeout(() => bus.publish('stateManager:rulesLoaded', { source: data.sourceName }), 0);
      }
    }),
  };
  return bus;
}

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const sent = (cmd) =>
  connectionMock.send.mock.calls.flatMap(([packets]) => packets).filter((packet) => packet?.cmd === cmd);
const consoleLines = (bus) =>
  bus.published.filter((p) => p.event === 'ui:printToConsole').map((p) => p.data.message);

describe('MessageHandler: rules built from server data', () => {
  let handler;
  let bus;

  beforeEach(() => {
    connectionMock.send.mockClear();
    calls.length = 0;
    stateManagerMock.staticData = { game_name: 'Adventure', playerId: '1', world: { 1: { game: 'Adventure' } } };
    // No preset_files.json match: the lookup fails, as for an unknown seed.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    handler = new MessageHandler();
    bus = makeBus();
    handler.setEventBus(bus);
    handler._requestDataPackage = vi.fn();
    handler.clientSlotName = 'Mathy';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function connectAndLogIn(slotData) {
    handler.processMessage({ cmd: 'RoomInfo', games: ['Archipelago', 'Metamath'], seed_name: SEED, version: { major: 0, minor: 6, build: 8 } });
    handler.processMessage({ cmd: 'DataPackage', data: DATA_PACKAGE });
    await flush();
    // The server sends Connected and ReceivedItems in one batch.
    handler.processMessage(connected(slotData));
    handler.processMessage(RECEIVED_ITEMS);
    await flush();
  }

  it("connects as the room's only game and holds the runtime state until the rules load", async () => {
    await connectAndLogIn();

    expect(sent('Connect')[0]).toMatchObject({ game: 'Metamath', name: 'Mathy' });
    expect(sent('LocationScouts')[0].locations).toHaveLength(placements.length);
    // Nothing applied against the old (Adventure) rules
    expect(calls).toEqual([]);

    handler.processMessage(LOCATION_INFO);
    await flush(10);

    const kinds = calls.map(([kind]) => kind);
    expect(kinds).toEqual(['files:jsonLoaded', 'applyRuntimeStateData', 'applyRuntimeStateData']);
    const load = calls[0][1];
    expect(load.selectedPlayerId).toBe(1);
    expect(load.sourceName).toBe(`server:${SEED}:P1`);
    expect(load.playerInfo).toEqual({ playerName: 'Mathy' });
    // The ONE load is the exporter-equivalent document
    expect(load.jsonData.regions).toEqual(FIXTURE.regions);
    expect(load.jsonData.items).toEqual(FIXTURE.items);
    expect(load.jsonData.seed_name).toBe(SEED);
    expect(load.jsonData.archipelago_version).toBe('0.6.8');
    expect(bus.published.filter((p) => p.event === 'files:jsonLoaded')).toHaveLength(1);
    // game:connected comes after the load, for the panels of the new rules
    const order = bus.published.map((p) => p.event);
    expect(order.indexOf('game:connected')).toBeGreaterThan(order.indexOf('files:jsonLoaded'));
    expect(order.lastIndexOf('game:locationsScouted')).toBeGreaterThan(order.indexOf('stateManager:rulesLoaded'));
    // ⚖ The plain rule: Connected re-adds only the ID-less starting items from the built rules,
    // and ReceivedItems index 0 REPLACES the inventory with the server's items.
    expect(calls[1][1]).toMatchObject({ startingItemsFromServer: true });
    expect(calls[2][1]).toMatchObject({ resetInventory: true, startingItemsFromServer: true, rederiveIdlessLocations: true });
    expect(calls[2][1].receivedItemsForProcessing.map((d) => d.itemName)).toEqual(['Statement 1', 'Statement 3']);
    expect(consoleLines(bus).some((m) => /Built Metamath rules for 2p2e4 \(10 statements, entrance mode 3\)/.test(m))).toBe(true);
    expect(sent('LocationScouts')).toHaveLength(1);
  });

  it('stays connected and applies the held packets when the build fails', async () => {
    await connectAndLogIn({ theorem: '2p2e4' }); // no proof_structure
    handler.processMessage(LOCATION_INFO);
    await flush(10);

    expect(bus.published.filter((p) => p.event === 'files:jsonLoaded')).toHaveLength(0);
    expect(calls.map(([kind]) => kind)).toEqual(['applyRuntimeStateData', 'applyRuntimeStateData']);
    expect(consoleLines(bus).some((m) => /Could not build Metamath rules .*proof_structure.*Staying connected/.test(m))).toBe(true);
    expect(handler._serverBuild).toBe(null);
  });

  it('gives up waiting for LocationInfo after 30 s and stays connected', async () => {
    vi.useFakeTimers();
    try {
      handler.processMessage({ cmd: 'RoomInfo', games: ['Metamath'], seed_name: SEED });
      handler.processMessage({ cmd: 'DataPackage', data: DATA_PACKAGE });
      await vi.runOnlyPendingTimersAsync();
      handler.processMessage(connected());
      await vi.advanceTimersByTimeAsync(30_000);
    } finally {
      vi.useRealTimers();
    }
    await flush(10);
    expect(consoleLines(bus).some((m) => /no LocationInfo within 30 s/.test(m))).toBe(true);
    expect(calls.map(([kind]) => kind)).toEqual(['applyRuntimeStateData']);
  });

  it('rebuilds when the loaded Metamath rules are for another seed', async () => {
    stateManagerMock.staticData = {
      game_name: 'Metamath',
      seed_name: '14089154938208861744',
      playerId: '1',
      world: { 1: { game: 'Metamath' } },
    };
    handler.processMessage({ cmd: 'RoomInfo', games: ['Archipelago', 'Metamath', 'APQuest'], seed_name: SEED });
    await flush();
    expect(sent('Connect')[0]).toMatchObject({ game: 'Metamath' });
    expect(handler._serverBuild?.game).toBe('Metamath');
  });

  it('uses loaded Metamath rules of the same seed as they are', async () => {
    stateManagerMock.staticData = { game_name: 'Metamath', seed_name: SEED, playerId: '1', world: { 1: { game: 'Metamath' } } };
    handler.processMessage({ cmd: 'RoomInfo', games: ['Metamath'], seed_name: SEED });
    await flush();
    expect(sent('Connect')[0]).toMatchObject({ game: 'Metamath' });
    expect(handler._serverBuild).toBe(null);
  });

  it('does not build for a game without a builder', async () => {
    handler.processMessage({ cmd: 'RoomInfo', games: ['APQuest'], seed_name: SEED });
    await flush();
    expect(sent('Connect')[0]).toMatchObject({ game: 'APQuest' });
    expect(handler._serverBuild).toBe(null);
  });

  it('a picked Metamath in a multi-game room means build', async () => {
    handler.chosenGame = 'Metamath';
    handler.processMessage({ cmd: 'RoomInfo', games: ['Metamath', 'APQuest'], seed_name: SEED });
    await flush();
    expect(sent('Connect')[0]).toMatchObject({ game: 'Metamath' });
    expect(handler._serverBuild?.game).toBe('Metamath');
  });

  it('without a build, Connected and ReceivedItems are handled at once, as before', async () => {
    // Usable rules (Metamath at this seed): the pre-existing Connected path.
    stateManagerMock.staticData = { game_name: 'Metamath', seed_name: SEED, playerId: '1', world: { 1: { game: 'Metamath' } } };
    handler.processMessage({ cmd: 'RoomInfo', games: ['Metamath'], seed_name: SEED });
    handler.processMessage({ cmd: 'DataPackage', data: DATA_PACKAGE });
    await flush();
    handler.processMessage(connected());
    handler.processMessage(RECEIVED_ITEMS);
    await flush(10);

    expect(handler._serverBuild).toBe(null);
    expect(bus.published.filter((p) => p.event === 'files:jsonLoaded')).toHaveLength(0);
    expect(calls.map(([kind]) => kind)).toEqual(['applyRuntimeStateData', 'applyRuntimeStateData']);
    expect(sent('LocationScouts')).toHaveLength(1);
    // LocationInfo is only recorded: no build, no second scout, no load
    handler.processMessage(LOCATION_INFO);
    await flush(10);
    expect(bus.published.filter((p) => p.event === 'files:jsonLoaded')).toHaveLength(0);
    expect(handler.getScoutedLocations()).toHaveLength(placements.length);

    // An incremental ReceivedItems (index > 0) still ADDS, in one worker batch, as before the plain rule.
    calls.length = 0;
    stateManagerMock.beginBatchUpdate.mockClear();
    stateManagerMock.commitBatchUpdate.mockClear();
    handler.processMessage({
      cmd: 'ReceivedItems',
      index: 2,
      items: [{ item: metamathItems['Statement 4'], location: 2, player: 2, flags: 1 }],
    });
    await flush(10);
    expect(calls).toEqual([['addItemToInventory', 'Statement 4']]);
    expect(stateManagerMock.beginBatchUpdate).toHaveBeenCalledTimes(1);
    expect(stateManagerMock.commitBatchUpdate).toHaveBeenCalledTimes(1);
  });

  it('a disconnect abandons the build', async () => {
    handler.processMessage({ cmd: 'RoomInfo', games: ['Metamath'], seed_name: SEED });
    await flush();
    handler.processMessage(connected());
    bus.publish('connection:close');
    expect(handler._serverBuild).toBe(null);
  });
});

/**
 * The connect flow for a room of a GENERATED world whose rules.json the
 * player has (client/core/localRulesOverlay.js).
 *
 * ⚖ (user, 2026-11-05): the local file is the logic; the server's placements
 * and slot_data are laid over it after login, and ONE loadRules follows (the
 * same hold → scout → load → apply sequence as a build from server data).
 * Only documents with world_generator's marker option get this; any other
 * document connects as before. With no rules for the game anywhere, the client
 * connects and waits, logged in with the packets held, for the server's own
 * document or the player's (⚖ b1, 2026-11-06). The any-seed preset fallback is only for
 * games without a server-data builder.
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
  rawPayload: null,
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
  getLastRawJsonData: () => stateManagerMock.rawPayload ?? null,
}));

vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler } from './messageHandler.js';
import {
  overlayServerData,
  WORLDGEN_RULES_FORMAT,
  WORLDGEN_RULES_KEY,
  WORLDGEN_RULES_OMITTED_KEY,
} from './localRulesOverlay.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const readJson = (...parts) => JSON.parse(readFileSync(join(...parts), 'utf8'));
const LOCAL_PATH = './presets/cloudberry_sphere_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const LOCAL = readJson(ROOT, 'frontend', LOCAL_PATH);
// P2 (Berry) of an APQuest + Cloudberry Sphere WorldGen room, seed 5: the exporter's file.
const ROOM = readJson(HERE, 'fixtures', 'localRulesOverlay', 'cloudberry_sphere_with_apquest_seed5_P2_rules.json');
const GAME = 'Cloudberry Sphere WorldGen';
const SEED = ROOM.seed_name;

const locations = Object.values(ROOM.regions['2'])
  .flatMap((r) => r.locations)
  .filter((l) => l.id !== null);
const ownItemIds = Object.fromEntries(
  Object.values(ROOM.items['2']).filter((i) => i.id !== null && i.groups.length > 0).map((i) => [i.name, i.id])
);
const apquestIds = { 'Health Upgrade': 5, 'Confetti Cannon': 6, Clouds: 1 };
const DATA_PACKAGE = {
  games: {
    [GAME]: {
      item_name_to_id: ownItemIds,
      location_name_to_id: Object.fromEntries(locations.map((l) => [l.name, l.id])),
    },
    APQuest: { item_name_to_id: apquestIds, location_name_to_id: {} },
  },
};
const FLAGS = { progression: 1, useful: 2, trap: 4 };
const LOCATION_INFO = {
  cmd: 'LocationInfo',
  locations: locations.map((l) => ({
    item: l.item.player === 2 ? ownItemIds[l.item.name] : apquestIds[l.item.name],
    location: l.id,
    player: l.item.player,
    flags: FLAGS[ROOM.items['2'][l.item.name].classification] ?? 0,
  })),
};

function connected({ extraLocation = false } = {}) {
  return {
    cmd: 'Connected',
    slot: 2,
    team: 0,
    players: [
      { team: 0, slot: 1, alias: 'Questy', name: 'Questy' },
      { team: 0, slot: 2, alias: 'Berry', name: 'Berry' },
    ],
    missing_locations: [...locations.map((l) => l.id), ...(extraLocation ? [4242] : [])],
    checked_locations: [],
    slot_data: {},
    slot_info: {
      1: { name: 'Questy', game: 'APQuest', type: 1, group_members: [] },
      2: { name: 'Berry', game: GAME, type: 1, group_members: [] },
    },
  };
}

function makeBus() {
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
      if (event === 'files:jsonLoaded') {
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
const loads = (bus) => bus.published.filter((p) => p.event === 'files:jsonLoaded');

/** The app as if `doc` were loaded for `player` (static data + the raw payload). */
function loadInApp(doc, player = '1', source = 'userLoadedFile') {
  stateManagerMock.staticData = {
    game_name: doc.game_name,
    seed_name: doc.seed_name ?? null,
    playerId: player,
    world: doc.world,
  };
  stateManagerMock.rawPayload = { source, rawJsonData: doc, selectedPlayerInfo: { playerId: player } };
}

const PRESET_FILES = {
  cloudberry_sphere_worldgen: {
    name: GAME,
    folders: {
      AP_14089154938208861744: {
        seed: 1,
        games: [{ player: 1, name: 'Player1', game: GAME }],
        files: ['AP_14089154938208861744_rules.json'],
      },
    },
  },
  apquest: {
    name: 'APQuest',
    folders: {
      AP_14089154938208861744: {
        seed: 1,
        games: [{ player: 1, name: 'Player1', game: 'APQuest' }],
        files: ['AP_14089154938208861744_rules.json'],
      },
    },
  },
};

function stubFetch(files) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const key = String(url);
      if (!(key in files)) return { ok: false, status: 404 };
      return { ok: true, json: async () => structuredClone(files[key]) };
    })
  );
}

describe('MessageHandler: local generated-world rules + server placements', () => {
  let handler;
  let bus;

  beforeEach(() => {
    connectionMock.send.mockClear();
    calls.length = 0;
    stateManagerMock.staticData = { game_name: 'Adventure', playerId: '1', world: { 1: { game: 'Adventure' } } };
    stateManagerMock.rawPayload = null;
    stubFetch({});
    for (const m of ['warn', 'error', 'log', 'debug']) vi.spyOn(console, m).mockImplementation(() => {});
    handler = new MessageHandler();
    bus = makeBus();
    handler.setEventBus(bus);
    handler._requestDataPackage = vi.fn();
    handler.clientSlotName = 'Berry';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function roomInfoThenLogIn(connectedPacket = connected()) {
    handler.processMessage({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest', GAME], seed_name: SEED });
    handler.processMessage({ cmd: 'DataPackage', data: DATA_PACKAGE });
    await flush();
    handler.processMessage(connectedPacket);
    handler.processMessage({ cmd: 'ReceivedItems', index: 0, items: [] });
    await flush();
  }

  it('loaded seed-1 rules, a seed-5 room: ONE load of the local file with the server placements', async () => {
    loadInApp(LOCAL);
    await roomInfoThenLogIn();

    expect(sent('Connect')[0]).toMatchObject({ game: GAME, name: 'Berry' });
    expect(handler._serverBuild?.mode).toBe('overlay');
    expect(calls).toEqual([]); // held until the load
    handler.processMessage(LOCATION_INFO);
    await flush(10);

    expect(calls.map(([kind]) => kind)).toEqual(['files:jsonLoaded', 'applyRuntimeStateData', 'applyRuntimeStateData']);
    const load = calls[0][1];
    expect(load.selectedPlayerId).toBe(2);
    expect(load.sourceName).toBe(`server:${SEED}:P2`);
    expect(load.jsonData.regions).toEqual(ROOM.regions);
    expect(load.jsonData.items).toEqual(ROOM.items);
    expect(load.jsonData.player_names).toEqual(ROOM.player_names);
    expect(load.jsonData.seed_name).toBe(SEED);
    expect(loads(bus)).toHaveLength(1);
    expect(consoleLines(bus).some((m) => /Loaded the local Cloudberry Sphere WorldGen rules with the server's placements \(4 locations/.test(m))).toBe(true);
    // No seed-mismatch warning: the overlay replaces it
    expect(consoleLines(bus).some((m) => /Warning: the server's seed/.test(m))).toBe(false);
  });

  it("a room that isn't the file's world: console error, stays connected, no load", async () => {
    loadInApp(LOCAL);
    await roomInfoThenLogIn(connected({ extraLocation: true }));
    handler.processMessage({ ...LOCATION_INFO, locations: [...LOCATION_INFO.locations, { item: 1, location: 4242, player: 2, flags: 1 }] });
    await flush(10);

    expect(loads(bus)).toHaveLength(0);
    expect(calls.map(([kind]) => kind)).toEqual(['applyRuntimeStateData', 'applyRuntimeStateData']);
    expect(
      consoleLines(bus).some((m) =>
        /Could not use the local Cloudberry Sphere WorldGen rules for this room .*1 server location\(s\) are not in the file: 4242.*Staying connected/.test(m)
      )
    ).toBe(true);
    expect(handler._serverBuild).toBe(null);
  });

  it("rules of the room's own seed are used as they are", async () => {
    loadInApp({ ...LOCAL, seed_name: SEED });
    handler.processMessage({ cmd: 'RoomInfo', games: [GAME], seed_name: SEED });
    await flush();
    expect(sent('Connect')[0]).toMatchObject({ game: GAME });
    expect(handler._serverBuild).toBe(null);
  });

  it('seedless local rules are overlaid', async () => {
    const { seed_name: _, ...seedless } = LOCAL;
    loadInApp(seedless);
    handler.processMessage({ cmd: 'RoomInfo', games: [GAME], seed_name: SEED });
    await flush();
    expect(handler._serverBuild?.mode).toBe('overlay');
  });

  it('a document without the marker connects as before (the seed warning, no overlay)', async () => {
    const unmarked = structuredClone(LOCAL);
    delete unmarked.world['1'].options.use_canonical_options;
    loadInApp(unmarked);
    handler.processMessage({ cmd: 'RoomInfo', games: [GAME], seed_name: SEED });
    await flush();
    expect(sent('Connect')[0]).toMatchObject({ game: GAME });
    expect(handler._serverBuild).toBe(null);
    expect(consoleLines(bus).some((m) => /Warning: the server's seed/.test(m))).toBe(true);
  });

  it("a picked game's committed preset at another seed is the local file", async () => {
    stubFetch({ './presets/preset_files.json': PRESET_FILES, [LOCAL_PATH]: LOCAL });
    handler.chosenGame = GAME;
    await roomInfoThenLogIn();
    expect(sent('Connect')[0]).toMatchObject({ game: GAME });
    expect(handler._serverBuild?.local?.source).toBe(LOCAL_PATH);
    handler.processMessage(LOCATION_INFO);
    await flush(10);
    expect(loads(bus)).toHaveLength(1);
    expect(loads(bus)[0].data.jsonData.regions).toEqual(ROOM.regions);
  });

  it("an unmarked committed preset of the picked game: connects as before", async () => {
    stubFetch({ './presets/preset_files.json': PRESET_FILES, './presets/apquest/AP_14089154938208861744/AP_14089154938208861744_rules.json': readJson(ROOT, 'frontend', 'presets', 'apquest', 'AP_14089154938208861744', 'AP_14089154938208861744_rules.json') });
    handler.chosenGame = 'APQuest';
    handler.processMessage({ cmd: 'RoomInfo', games: ['APQuest', GAME], seed_name: SEED });
    await flush(10);
    expect(sent('Connect')[0]).toMatchObject({ game: 'APQuest' });
    expect(handler._serverBuild).toBe(null);
  });

  it('no rules for the game anywhere: connects, then waits LOGGED IN (packets held) until they load (⚖ b1)', async () => {
    // A puzzle-like world of the room's slot: the seed-5 room's Cloudberry slot, renamed.
    const PUZZLE = GAME;
    stubFetch({ './presets/preset_files.json': { apquest: PRESET_FILES.apquest } });
    handler.chosenGame = PUZZLE;
    await roomInfoThenLogIn();

    // ⚖ b1: Connect is sent at once (the server may send the rules).
    expect(sent('Connect')[0]).toMatchObject({ game: PUZZLE });
    expect(handler._serverBuild?.mode).toBe('overlay');
    expect(handler._serverBuild?.local).toBe(null);
    handler.processMessage(LOCATION_INFO);
    await flush(10);

    // No document anywhere: the wait, logged in, with every packet held.
    expect(handler.getAwaitedRulesGame()).toBe(PUZZLE);
    expect(bus.published.some((p) => p.event === 'client:rulesNeeded' && p.data.game === PUZZLE)).toBe(true);
    expect(consoleLines(bus).some((m) => /did not send them.*logged in/.test(m))).toBe(true);
    expect(calls).toEqual([]);
    expect(handler.clientSlot).toBe(2);

    // Rules of another game load first: still waiting.
    bus.publish('stateManager:rulesLoaded', { source: 'presets' });
    await flush();
    expect(calls).toEqual([]);

    // The player loads the world's rules (a marked document): ONE overlay load, then the held packets.
    loadInApp(LOCAL, '1', 'userLoadedFile');
    bus.publish('stateManager:rulesLoaded', { source: 'userLoadedFile' });
    await flush(10);
    expect(calls.map(([kind]) => kind)).toEqual(['files:jsonLoaded', 'applyRuntimeStateData', 'applyRuntimeStateData']);
    expect(calls[0][1].jsonData.regions).toEqual(ROOM.regions);
    expect(handler.getAwaitedRulesGame()).toBe(null);
    expect(handler._serverBuild).toBe(null);
  });

  it('a wait for rules: an UNMARKED document of the game is used as it loaded (no overlay)', async () => {
    stubFetch({ './presets/preset_files.json': { apquest: PRESET_FILES.apquest } });
    handler.chosenGame = GAME;
    await roomInfoThenLogIn();
    handler.processMessage(LOCATION_INFO);
    await flush(10);
    expect(handler.getAwaitedRulesGame()).toBe(GAME);
    const unmarked = structuredClone(LOCAL);
    delete unmarked.world['1'].options.use_canonical_options;
    loadInApp(unmarked, '1', 'userLoadedFile');
    bus.publish('stateManager:rulesLoaded', { source: 'userLoadedFile' });
    await flush(10);
    expect(loads(bus)).toHaveLength(0);
    expect(calls.map(([kind]) => kind)).toEqual(['applyRuntimeStateData', 'applyRuntimeStateData']);
    expect(handler._serverBuild).toBe(null);
  });

  it('a game with a server-data builder never takes the any-seed preset path', async () => {
    stubFetch({ './presets/preset_files.json': PRESET_FILES });
    handler.chosenGame = 'Metamath';
    handler.processMessage({ cmd: 'RoomInfo', games: ['Metamath', 'APQuest'], seed_name: SEED });
    await flush(10);
    expect(sent('Connect')[0]).toMatchObject({ game: 'Metamath' });
    expect(handler._serverBuild?.mode).toBeUndefined();
    expect(handler.getAwaitedRulesGame()).toBe(null);
  });

  it('a new RoomInfo or a disconnect ends a wait for rules', async () => {
    stubFetch({ './presets/preset_files.json': { apquest: PRESET_FILES.apquest } });
    handler.chosenGame = GAME;
    await roomInfoThenLogIn();
    handler.processMessage(LOCATION_INFO);
    await flush(10);
    expect(handler.getAwaitedRulesGame()).toBe(GAME);
    bus.publish('connection:close');
    expect(handler.getAwaitedRulesGame()).toBe(null);
    expect(handler._serverBuild).toBe(null);
    loadInApp(LOCAL, '1', 'userLoadedFile');
    bus.publish('stateManager:rulesLoaded', { source: 'userLoadedFile' });
    await flush(10);
    expect(loads(bus)).toHaveLength(0);
  });

  it('the loaded document equals overlayServerData of the local file', async () => {
    loadInApp(LOCAL);
    await roomInfoThenLogIn();
    handler.processMessage(LOCATION_INFO);
    await flush(10);
    const expected = overlayServerData(LOCAL, '1', {
      slot: 2,
      names: { 1: 'Questy', 2: 'Berry' },
      seedName: SEED,
      slotData: {},
      scouts: handler.getScoutedLocations(),
    });
    expect(loads(bus)[0].data.jsonData).toEqual(expected);
  });
});

/**
 * The rules a world_generator world SENDS (slot_data.worldgen_rules, sdc-embedded-rules E3).
 * ⚖ (Robert, 2026-11-06): exact-seed preset → server doc → local doc → wait; a refused server doc
 * (format stamp, a retired shape, the ID check) falls back to the local doc with a console line.
 */
describe('MessageHandler: the rules the server sends (worldgen_rules)', () => {
  let handler;
  let bus;
  // The package's own shipped envelope: what its fill_slot_data sends.
  const ENVELOPE = readJson(ROOT, 'worlds', 'cloudberry_sphere_worldgen', '_worldgen_rules.json');
  const withRules = (slotData) => ({ ...connected(), slot_data: slotData });

  beforeEach(() => {
    connectionMock.send.mockClear();
    calls.length = 0;
    stateManagerMock.staticData = { game_name: 'Adventure', playerId: '1', world: { 1: { game: 'Adventure' } } };
    stateManagerMock.rawPayload = null;
    stubFetch({ './presets/preset_files.json': { apquest: PRESET_FILES.apquest } });
    for (const m of ['warn', 'error', 'log', 'debug']) vi.spyOn(console, m).mockImplementation(() => {});
    handler = new MessageHandler();
    bus = makeBus();
    handler.setEventBus(bus);
    handler._requestDataPackage = vi.fn();
    handler.clientSlotName = 'Berry';
    handler.chosenGame = GAME;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function logInWith(packet) {
    handler.processMessage({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest', GAME], seed_name: SEED });
    handler.processMessage({ cmd: 'DataPackage', data: DATA_PACKAGE });
    await flush();
    handler.processMessage(packet);
    handler.processMessage({ cmd: 'ReceivedItems', index: 0, items: [] });
    await flush();
    handler.processMessage(LOCATION_INFO);
    await flush(10);
  }

  it('no local rules anywhere: the server doc is laid over and loaded ONCE; the room plays', async () => {
    await logInWith(withRules({ [WORLDGEN_RULES_KEY]: structuredClone(ENVELOPE) }));
    expect(sent('Connect')[0]).toMatchObject({ game: GAME, name: 'Berry' });
    expect(calls.map(([kind]) => kind)).toEqual(['files:jsonLoaded', 'applyRuntimeStateData', 'applyRuntimeStateData']);
    const doc = calls[0][1].jsonData;
    // The room's placements (= the exporter's file at this seed), from a document that carried none.
    for (const [name, region] of Object.entries(ROOM.regions['2'])) {
      expect(doc.regions['2'][name].locations.map((l) => [l.name, l.id, l.item?.name, l.item?.player]))
        .toEqual(region.locations.map((l) => [l.name, l.id, l.item?.name, l.item?.player]));
    }
    expect(Object.keys(doc.items['2']).sort()).toEqual(Object.keys(ROOM.items['2']).sort());
    expect(doc.world['2'].game).toBe(GAME);
    expect(doc.world['2'].slot_data?.[WORLDGEN_RULES_KEY]).toBeUndefined();
    expect(consoleLines(bus).some((m) => /Loaded the server-sent Cloudberry Sphere WorldGen rules with the server's placements/.test(m))).toBe(true);
    expect(handler.getAwaitedRulesGame()).toBe(null);
  });

  it('the server doc wins over a loaded local doc (and equals overlayServerData of it)', async () => {
    loadInApp(LOCAL);
    handler.chosenGame = null;
    await logInWith(withRules({ [WORLDGEN_RULES_KEY]: structuredClone(ENVELOPE) }));
    expect(loads(bus)).toHaveLength(1);
    const expected = overlayServerData(ENVELOPE.doc, ENVELOPE.player, {
      slot: 2,
      names: { 1: 'Questy', 2: 'Berry' },
      seedName: SEED,
      slotData: { [WORLDGEN_RULES_KEY]: ENVELOPE },
      scouts: handler.getScoutedLocations(),
    });
    expect(loads(bus)[0].data.jsonData).toEqual(expected);
  });

  it('an exact-seed preset still wins: the server doc is not used', async () => {
    loadInApp({ ...LOCAL, seed_name: SEED });
    handler.chosenGame = null;
    await logInWith(withRules({ [WORLDGEN_RULES_KEY]: structuredClone(ENVELOPE) }));
    expect(loads(bus)).toHaveLength(0);
    expect(handler._serverBuild).toBe(null);
  });

  it.each([
    ['an older format', { ...ENVELOPE, format: WORLDGEN_RULES_FORMAT - 1 }, /built by an older world generator \(rules format 0/],
    ['a newer format', { ...ENVELOPE, format: WORLDGEN_RULES_FORMAT + 1 }, /built by a newer world generator/],
    ['a retired shape', { ...ENVELOPE, doc: { ...ENVELOPE.doc, is_canonical: true } }, /built by an older world generator \(rules\.json carries a document-level `is_canonical`/],
    ['a doc that is not this world', { ...ENVELOPE, doc: { ...ENVELOPE.doc, world: { 1: { ...ENVELOPE.doc.world['1'], game: 'Other' } } } }, /don't match this room/],
  ])('%s: refused by name, the local doc is used instead', async (_label, envelope, why) => {
    loadInApp(LOCAL);
    handler.chosenGame = null;
    await logInWith(withRules({ [WORLDGEN_RULES_KEY]: structuredClone(envelope) }));
    expect(consoleLines(bus).some((m) => /^Not using the rules the server sent/.test(m) && why.test(m))).toBe(true);
    expect(loads(bus)).toHaveLength(1);
    expect(consoleLines(bus).some((m) => /Loaded the local Cloudberry Sphere WorldGen rules/.test(m))).toBe(true);
    expect(loads(bus)[0].data.jsonData.regions).toEqual(ROOM.regions);
  });

  it('over the cap (worldgen_rules_omitted): says so, and uses the local doc', async () => {
    loadInApp(LOCAL);
    handler.chosenGame = null;
    await logInWith(withRules({ [WORLDGEN_RULES_OMITTED_KEY]: { size_kb: 9, cap_kb: 4, reason: 'over_cap' } }));
    expect(consoleLines(bus).some((m) => /did not send this world's rules \(9 KB, over the slot's rules_in_slot_data_max_kb of 4 KB\)/.test(m))).toBe(true);
    expect(loads(bus)).toHaveLength(1);
    expect(loads(bus)[0].data.jsonData.world['2'].slot_data).toBeUndefined();
  });

  it('a refused server doc with no local doc: the connected wait', async () => {
    await logInWith(withRules({ [WORLDGEN_RULES_KEY]: { ...ENVELOPE, format: 0 } }));
    expect(loads(bus)).toHaveLength(0);
    expect(calls).toEqual([]);
    expect(handler.getAwaitedRulesGame()).toBe(GAME);
  });
});

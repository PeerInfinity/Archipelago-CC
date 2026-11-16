/**
 * sdc-no-preset-refusal (⚖ Robert 2026-11-15, "Yes, fix it"): a room of a
 * hand-written world whose committed presets are all for OTHER seeds connects
 * the way a game with no preset does — the overlay path with no local
 * document. The server's own rules (slot_data.worldgen_rules) are used if it
 * sends them; otherwise the client waits, logged in, with the packets held,
 * and asks for THIS room's preset. It never keeps the boot rules (another
 * game's) or another player's rules loaded for the slot.
 *
 * Pinned unchanged here: no preset anywhere, a generated world's preset at
 * another seed (E path), the room's exact preset, a builder world (APCalc),
 * and loaded rules of the game, for this slot, at another seed (the seed
 * warning, connect anyway).
 *
 * The preset index is the committed frontend/presets/preset_files.json, and
 * preset rules are served from disk.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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

import messageHandlerSingleton, {
  MessageHandler,
  rulesNeededMessage,
  handleUserLocationCheckForClient,
} from './messageHandler.js';
import { goalMet } from './goalCheck.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..');
const PRESET_FILES = JSON.parse(readFileSync(join(FRONTEND, 'presets', 'preset_files.json'), 'utf8'));
const SEED1 = '14089154938208861744';
const ROOM_SEED = '45010000000000000000'; // no committed preset has it
const BAKING = 'Baking Adventure';
const CODING = 'Coding Adventure';
const BAKING_SEED1_PATH = `./presets/bakingadventure/AP_${SEED1}/AP_${SEED1}_rules.json`;
const readPreset = (path) => JSON.parse(readFileSync(join(FRONTEND, path.replace(/^\.\//, '')), 'utf8'));

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
      if (event === 'files:jsonLoaded') {
        calls.push(['files:jsonLoaded', data]);
        loadInApp(data.jsonData, String(data.selectedPlayerId), data.sourceName);
      }
      for (const cb of [...(subscribers.get(event) || [])]) cb(data);
      if (event === 'files:jsonLoaded') {
        setTimeout(() => bus.publish('stateManager:rulesLoaded', { source: data.sourceName }), 0);
      }
    }),
  };
  return bus;
}

/** The app as if `doc` were loaded for `player`. */
function loadInApp(doc, player = '1', source = 'userLoadedFile') {
  stateManagerMock.staticData = {
    game_name: doc.game_name,
    seed_name: doc.seed_name ?? null,
    playerId: player,
    world: doc.world,
    player_names: doc.player_names,
  };
  stateManagerMock.rawPayload = { source, rawJsonData: doc, selectedPlayerInfo: { playerId: player } };
}

/** The boot state: the Adventure seed-1 preset, as the app loads it. */
const ADVENTURE_BOOT = {
  game_name: 'Adventure',
  seed_name: SEED1,
  player_names: { 1: 'Player1' },
  world: { 1: { game: 'Adventure', options: {} } },
};

/** fetch: the committed preset index (or `index`), and preset rules read from disk. */
function serve(index = PRESET_FILES, extra = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const key = String(url);
      if (key === './presets/preset_files.json') {
        return index ? { ok: true, json: async () => structuredClone(index) } : { ok: false, status: 404 };
      }
      if (key in extra) return { ok: true, json: async () => structuredClone(extra[key]) };
      const disk = join(FRONTEND, key.replace(/^\.\//, ''));
      if (key.startsWith('./presets/') && existsSync(disk)) {
        return { ok: true, json: async () => JSON.parse(readFileSync(disk, 'utf8')) };
      }
      return { ok: false, status: 404 };
    })
  );
}

const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A 2-slot room: slot `slot` plays `game` (name `name`), the other slot plays the other game. */
function room({ slot = 1, game = BAKING, name = 'Baker', slotData = {} } = {}) {
  const other = game === BAKING ? CODING : BAKING;
  const otherSlot = slot === 1 ? 2 : 1;
  const ids = [9001, 9002, 9003];
  return {
    roomInfo: { cmd: 'RoomInfo', games: ['Archipelago', BAKING, CODING], seed_name: ROOM_SEED },
    dataPackage: {
      games: {
        [game]: { item_name_to_id: { Flour: 1 }, location_name_to_id: { A: 9001, B: 9002, C: 9003 } },
        [other]: { item_name_to_id: {}, location_name_to_id: {} },
      },
    },
    connected: {
      cmd: 'Connected',
      slot,
      team: 0,
      players: [
        { team: 0, slot, alias: name, name },
        { team: 0, slot: otherSlot, alias: 'Other', name: 'Other' },
      ],
      missing_locations: ids,
      checked_locations: [],
      slot_data: slotData,
      slot_info: {
        [slot]: { name, game, type: 1, group_members: [] },
        [otherSlot]: { name: 'Other', game: other, type: 1, group_members: [] },
      },
    },
    locationInfo: {
      cmd: 'LocationInfo',
      locations: ids.map((id) => ({ item: 1, location: id, player: slot, flags: 1 })),
    },
  };
}

describe('MessageHandler: no preset for this room (sdc-no-preset-refusal)', () => {
  let handler;
  let bus;

  const sent = (cmd) =>
    connectionMock.send.mock.calls.flatMap(([packets]) => packets).filter((packet) => packet?.cmd === cmd);
  const lines = () => bus.published.filter((p) => p.event === 'ui:printToConsole').map((p) => p.data);
  const text = () => lines().map((l) => l.message);
  const loads = () => bus.published.filter((p) => p.event === 'files:jsonLoaded');

  beforeEach(() => {
    connectionMock.send.mockClear();
    connectionMock.isConnected.mockReturnValue(true);
    calls.length = 0;
    loadInApp(ADVENTURE_BOOT, '1', 'presets');
    serve();
    for (const m of ['warn', 'error', 'log', 'debug', 'info']) vi.spyOn(console, m).mockImplementation(() => {});
    handler = new MessageHandler();
    bus = makeBus();
    handler.setEventBus(bus);
    handler._requestDataPackage = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function play(r, { chosen = null, name = 'Baker' } = {}) {
    handler.clientSlotName = name;
    if (chosen) handler.chosenGame = chosen;
    handler.processMessage(r.roomInfo);
    handler.processMessage({ cmd: 'DataPackage', data: r.dataPackage });
    await flush();
    handler.processMessage(r.connected);
    handler.processMessage({ cmd: 'ReceivedItems', index: 0, items: [{ item: 1, location: -2, player: 0, flags: 1 }] });
    await flush();
    handler.processMessage(r.locationInfo);
    await flush(10);
  }

  describe.each([
    ['Baking at slot 1', { slot: 1, game: BAKING, name: 'Baker' }],
    ['Coding at slot 2', { slot: 2, game: CODING, name: 'Coder' }],
  ])('%s, presets only at other seeds, the server sends no rules', (_label, opts) => {
    it('the refusal: Connect as the game, packets held, no load, no checks, the prompt names seed and game', async () => {
      await play(room(opts), { chosen: opts.game, name: opts.name });

      expect(sent('Connect')).toHaveLength(1);
      expect(sent('Connect')[0]).toMatchObject({ game: opts.game, name: opts.name });
      // The boot rules are not used: nothing applied, nothing loaded, nothing sent.
      expect(calls).toEqual([]);
      expect(loads()).toHaveLength(0);
      expect(sent('LocationChecks')).toEqual([]);
      expect(handler.getAwaitedRulesGame()).toBe(opts.game);
      expect(handler.clientSlot).toBe(opts.slot);
      expect(bus.published.some((p) => p.event === 'client:rulesNeeded' && p.data.game === opts.game)).toBe(true);

      // In the player's console (warnings), not only the debug log.
      const warnings = lines().filter((l) => l.type === 'warning').map((l) => l.message);
      expect(warnings.some((m) => m.includes(`This ${opts.game} room (seed ${ROOM_SEED}) has no preset here`))).toBe(true);
      expect(
        warnings.some((m) => m.startsWith(`This ${opts.game} room needs its own preset file (seed ${ROOM_SEED})`))
      ).toBe(true);
      expect(text().some((m) => m.includes('APCalc'))).toBe(false);
      expect(text().some((m) => m.includes("applying the server's placements"))).toBe(false);
      expect(text()).toContain(`Logged in; the server sent no ${opts.game} rules, and none for this room are loaded.`);
    });
  });

  it('no game picked: the same refusal via the "loaded rules are for another game" path', async () => {
    // A single-game Baking room, the Adventure boot rules loaded.
    const r = room();
    r.roomInfo.games = ['Archipelago', BAKING];
    await play(r);
    expect(sent('Connect')[0]).toMatchObject({ game: BAKING });
    expect(text().some((m) => m.includes('The loaded rules are for Adventure, which this room does not have'))).toBe(true);
    expect(handler.getAwaitedRulesGame()).toBe(BAKING);
    expect(calls).toEqual([]);
  });

  it('presets only at other seeds, but the server SENDS rules: they are the ones used (no wait)', async () => {
    await play(room({ slotData: { worldgen_rules: 'not-a-real-doc' } }), { chosen: BAKING });
    // The (unreadable) server doc is refused with a console line, then the wait: the path reads slot_data.
    expect(text().some((m) => m.startsWith('Not using the rules the server sent'))).toBe(true);
    expect(text().some((m) => m.includes("applying the server's placements to the Baking Adventure rules"))).toBe(true);
    expect(handler.getAwaitedRulesGame()).toBe(BAKING);
  });

  it('every Baking preset hidden: the no-preset path, unchanged (no "other seeds" line)', async () => {
    // bakingadventure and bakingadventure_vanilla, as the survey hid them.
    const index = Object.fromEntries(Object.entries(PRESET_FILES).filter(([key]) => !key.startsWith('bakingadventure')));
    serve(index);
    await play(room(), { chosen: BAKING });
    expect(handler.getAwaitedRulesGame()).toBe(BAKING);
    expect(handler._serverBuild?.presetsAtOtherSeeds).toBe(null);
    expect(text()).toContain(`No ${BAKING} rules are loaded; connecting to see whether the server sends them…`);
    expect(text().some((m) => m.startsWith(`No rules for ${BAKING} are loaded, and the server did not send them.`))).toBe(true);
    expect(text().some((m) => m.includes('other seeds'))).toBe(false);
    expect(calls).toEqual([]);
  });

  it('an unreadable preset index: the same wait, never the boot rules', async () => {
    serve(null);
    await play(room(), { chosen: BAKING });
    expect(handler.getAwaitedRulesGame()).toBe(BAKING);
    expect(calls).toEqual([]);
  });

  it("a generated world's preset at another seed: the overlay with it as the local doc (E path, unchanged)", async () => {
    const game = 'Baking Adventure WorldGen';
    const r = room({ game });
    r.roomInfo.games = ['Archipelago', game];
    handler.clientSlotName = 'Baker';
    handler.processMessage(r.roomInfo);
    await flush(10);
    expect(sent('Connect')[0]).toMatchObject({ game });
    expect(handler._serverBuild?.mode).toBe('overlay');
    expect(handler._serverBuild?.local?.source).toBe(
      `./presets/bakingadventure_worldgen/AP_${SEED1}/AP_${SEED1}_rules.json`
    );
    expect(handler._serverBuild?.presetsAtOtherSeeds).toBe(null);
    expect(text().some((m) => m.includes('other seeds'))).toBe(false);
  });

  it("the room's exact preset: loaded before Connect, no build (unchanged)", async () => {
    const r = room({ name: 'Player1' });
    r.roomInfo.seed_name = SEED1;
    r.roomInfo.games = ['Archipelago', BAKING];
    // Only the plain preset (its _vanilla twin at seed 1 would make two matches).
    serve({ bakingadventure: PRESET_FILES.bakingadventure });
    handler.clientSlotName = 'Player1';
    handler.processMessage(r.roomInfo);
    await flush(10);
    expect(loads()).toHaveLength(1);
    expect(loads()[0].data.sourceName).toBe(BAKING_SEED1_PATH);
    expect(sent('Connect')[0]).toMatchObject({ game: BAKING, name: 'Player1' });
    expect(handler._serverBuild).toBe(null);
  });

  it('a builder world (APCalc): built from server data, not the overlay (unchanged)', async () => {
    handler.clientSlotName = 'Calc';
    handler.processMessage({ cmd: 'RoomInfo', games: ['Archipelago', 'APCalc'], seed_name: ROOM_SEED });
    await flush(10);
    expect(sent('Connect')[0]).toMatchObject({ game: 'APCalc' });
    expect(handler._serverBuild?.game).toBe('APCalc');
    expect(handler._serverBuild?.mode).toBeUndefined();
    expect(text().some((m) => m.includes("building APCalc rules from the server's data"))).toBe(true);
  });

  // sdc-embed-handwritten-rules (⚖ Robert 2026-11-15, "Embed their rules"): Baking and Coding send their
  // own rules document (worlds/<w>/_embedded_rules.json, the envelope fill_slot_data sends). The room plays
  // with it: one load of the server's document with the room's placements, and the goal rule holds on it.
  describe.each([
    ['Baking at slot 1', { slot: 1, game: BAKING, name: 'Baker', dir: 'bakingadventure', goal: 'Cool on Wire Rack' }],
    ['Coding at slot 2', { slot: 2, game: CODING, name: 'Coder', dir: 'codingadventure', goal: 'Production Deployment' }],
    ['Baking vanilla at slot 2', { slot: 2, game: BAKING, name: 'BakerV', dir: 'bakingadventure', goal: 'Cool on Wire Rack', vanilla: 1 }],
  ])("%s: the world's embedded rules, sent by the server", (_label, opts) => {
    it("are loaded with the room's placements and slot_data, and the goal is met only by Victory", async () => {
      const envelope = JSON.parse(readFileSync(join(FRONTEND, '..', 'worlds', opts.dir, '_embedded_rules.json'), 'utf8'));
      const doc = envelope.doc;
      const locations = Object.values(doc.regions['1']).flatMap((region) => region.locations);
      const itemNameToId = Object.fromEntries(Object.values(doc.items['1']).map((item) => [item.name, item.id]));
      const pool = Object.keys(itemNameToId).filter((name) => name !== 'Victory');
      const r = room({
        slot: opts.slot,
        game: opts.game,
        name: opts.name,
        slotData: {
          ...(opts.game === BAKING ? { vanilla_placement: opts.vanilla ?? 0 } : {}),
          reports_goal_by_server_item: true,
          worldgen_rules: envelope,
        },
      });
      r.dataPackage.games[opts.game] = {
        item_name_to_id: itemNameToId,
        location_name_to_id: Object.fromEntries(locations.map((loc) => [loc.name, loc.id])),
      };
      r.connected.missing_locations = locations.map((loc) => loc.id);
      r.locationInfo.locations = locations.map((loc, i) => ({
        item: itemNameToId[loc.name === opts.goal ? 'Victory' : pool[i % pool.length]],
        location: loc.id,
        player: opts.slot,
        flags: 1,
      }));
      await play(r, { chosen: opts.game, name: opts.name });

      expect(loads()).toHaveLength(1);
      const loaded = loads()[0].data;
      expect(loaded.sourceName).toBe(`server:${ROOM_SEED}:P${opts.slot}`);
      expect(String(loaded.selectedPlayerId)).toBe(String(opts.slot));
      const s = String(opts.slot);
      const placed = Object.values(loaded.jsonData.regions[s]).flatMap((region) => region.locations);
      expect(placed).toHaveLength(locations.length);
      expect(placed.every((loc) => loc.item?.name)).toBe(true);
      expect(placed.find((loc) => loc.name === opts.goal).item.name).toBe('Victory');
      // The world's own slot_data, without the document it carried.
      expect(loaded.jsonData.world[s].slot_data.worldgen_rules).toBeUndefined();
      expect(loaded.jsonData.world[s].slot_data.reports_goal_by_server_item).toBe(true);
      if (opts.game === BAKING) expect(loaded.jsonData.world[s].options.vanilla_placement).toBe(opts.vanilla ?? 0);
      expect(handler.getAwaitedRulesGame()).toBe(null);
      expect(sent('LocationChecks')).toEqual([]);
      expect(text()).toContain(
        `Loaded the server-sent ${opts.game} rules with the server's placements ` +
          `(${locations.length} locations, room seed ${ROOM_SEED}).`
      );
      expect(text().some((m) => m.startsWith('Not using the rules the server sent'))).toBe(false);

      // The goal: not met with no items, met once the server delivered Victory (goalCheck.goalMet).
      expect(goalMet(loaded.jsonData, opts.slot, opts.game, new Map())).toBe(false);
      expect(goalMet(loaded.jsonData, opts.slot, opts.game, new Map(pool.map((name) => [name, 1])))).toBe(false);
      expect(goalMet(loaded.jsonData, opts.slot, opts.game, new Map([['Victory', 1]]))).toBe(true);
    });
  });

  describe("the game's preset of another seed is loaded", () => {
    it("for another player (the survey's seed-1 Baking play): a seed warning, then the refusal", async () => {
      loadInApp(readPreset(BAKING_SEED1_PATH), '1', BAKING_SEED1_PATH);
      const r = room();
      r.roomInfo.games = ['Archipelago', BAKING];
      await play(r);

      const warnings = lines().filter((l) => l.type === 'warning').map((l) => l.message);
      expect(warnings).toContain(
        `Warning: the loaded ${BAKING} rules are for seed ${SEED1}, not this room's seed ${ROOM_SEED}, and are not ` +
          "this slot's, so they are not used for it."
      );
      expect(handler.getAwaitedRulesGame()).toBe(BAKING);
      expect(calls).toEqual([]);
      expect(sent('LocationChecks')).toEqual([]);

      // The player loads it anyway: used as loaded, with the seed-mismatch warning (⚖ "allow it").
      loadInApp(readPreset(BAKING_SEED1_PATH), '1', 'userLoadedFile');
      bus.publish('stateManager:rulesLoaded', { source: 'userLoadedFile' });
      await flush(10);
      expect(text().some((m) => m.startsWith(`Warning: the server's seed (${ROOM_SEED}) is not the loaded rules' seed (${SEED1})`))).toBe(true);
      expect(calls.map(([kind]) => kind)).toEqual(['applyRuntimeStateData', 'applyRuntimeStateData']);
      expect(handler.getAwaitedRulesGame()).toBe(null);
    });

    it('for this slot (same name): the seed warning, connected with it (unchanged)', async () => {
      loadInApp(readPreset(BAKING_SEED1_PATH), '1', BAKING_SEED1_PATH);
      const r = room({ name: 'Player1' });
      handler.clientSlotName = 'Player1';
      handler.processMessage(r.roomInfo);
      await flush(10);
      expect(sent('Connect')[0]).toMatchObject({ game: BAKING, name: 'Player1' });
      expect(handler._serverBuild).toBe(null);
      expect(text().some((m) => m.startsWith(`Warning: the server's seed (${ROOM_SEED}) is not the loaded rules' seed (${SEED1})`))).toBe(true);
    });
  });

  it('two presets of the game match THIS seed (plain + _vanilla): the generic prompt, never "other seeds"', async () => {
    const r = room({ name: 'Player1' });
    r.roomInfo.seed_name = SEED1;
    r.roomInfo.games = ['Archipelago', BAKING];
    await play(r, { name: 'Player1' });
    expect(text().some((m) => m.startsWith('Several presets match this room (bakingadventure_vanilla, bakingadventure)'))).toBe(true);
    expect(handler.getAwaitedRulesGame()).toBe(BAKING);
    expect(text().some((m) => m.includes('other seeds'))).toBe(false);
    expect(calls).toEqual([]);
  });

  describe('game checks made during the wait (planner condition (a))', () => {
    it('held, then sent with the server id once the player loads the rules (the singleton, end to end)', async () => {
      const h = messageHandlerSingleton;
      h.setEventBus(bus);
      h._requestDataPackage = vi.fn();
      h._heldGameChecks = [];
      h.dispatcher = { publishToNextModule: vi.fn() };
      handler = h; // play() drives `handler`
      const r = room();
      await play(r, { chosen: BAKING });
      expect(h.getAwaitedRulesGame()).toBe(BAKING);

      await handleUserLocationCheckForClient({ locationName: 'B', originator: 'FlashPanel', reportedByGame: true });
      expect(sent('LocationChecks')).toEqual([]);
      expect(h._heldGameChecks).toHaveLength(1);

      // The player loads this room's rules (a Baking doc naming A/B/C): used as loaded, then the replay.
      const doc = { ...readPreset(BAKING_SEED1_PATH), seed_name: ROOM_SEED };
      loadInApp(doc, '1', 'userLoadedFile');
      bus.publish('stateManager:rulesLoaded', { source: 'userLoadedFile' });
      await flush(12);
      expect(h.getAwaitedRulesGame()).toBe(null);
      expect(text().some((m) => m.startsWith('Sending 1 check(s) the game made while this room\'s rules were loading: "B"'))).toBe(true);
      expect(sent('LocationChecks')).toEqual([{ cmd: 'LocationChecks', locations: [9002] }]);
      expect(h._heldGameChecks).toEqual([]);
      h._cancelServerBuild();
      h._cancelRulesWait();
    });

    it('a player disconnect drops them with a warning; a socket drop keeps them for the reconnect', () => {
      const held = { eventData: { locationName: 'B' }, eventName: 'user:locationCheck', seedName: ROOM_SEED };
      handler._heldGameChecks = [held];
      bus.publish('connection:close', { requested: false });
      expect(handler._heldGameChecks).toEqual([held]);
      bus.publish('connection:close', { requested: true });
      expect(handler._heldGameChecks).toEqual([]);
      expect(text().at(-1)).toBe(
        'Not sent: 1 check(s) the game made while this room\'s rules were pending ("B"); the player disconnected first.'
      );
    });

    it("a RoomInfo of the same seed keeps them; another seed's drops them", async () => {
      const held = { eventData: { locationName: 'B' }, eventName: 'user:locationCheck', seedName: ROOM_SEED };
      handler._heldGameChecks = [held];
      handler.clientSlotName = 'Baker';
      handler.processMessage(room().roomInfo);
      await flush();
      expect(handler._heldGameChecks).toEqual([held]);
      handler.processMessage({ ...room().roomInfo, seed_name: '99999999999999999999' });
      await flush();
      expect(handler._heldGameChecks).toEqual([]);
      expect(text().some((m) => m.endsWith('("B"); the server is another room now.'))).toBe(true);
    });
  });

  describe('rulesNeededMessage, per game', () => {
    it('APCalc names the APCalc Generator', () => {
      expect(rulesNeededMessage('APCalc', ROOM_SEED)).toContain('APCalc Generator → Load in Frontend, or the Files panel');
    });
    it.each([BAKING, CODING, 'Cloudberry Sphere WorldGen'])('%s with no presets: no APCalc', (game) => {
      const m = rulesNeededMessage(game, ROOM_SEED);
      expect(m).toMatch(new RegExp(`^No rules for ${game} are loaded, and the server did not send them\\. Load its rules\\.json \\(the Files panel\\)`));
      expect(m).not.toContain('APCalc');
    });
    it.each([BAKING, CODING])('%s with presets at other seeds: needs its preset file, names the seed', (game) => {
      const m = rulesNeededMessage(game, ROOM_SEED, [{ gameKey: 'x', folderName: 'y' }]);
      expect(m).toBe(
        `This ${game} room needs its own preset file (seed ${ROOM_SEED}), and the server did not send its rules. ` +
          `The ${game} presets here are for other seeds. Load this room's rules.json (the Files panel); the client ` +
          "is logged in, sends no checks until then, and applies the server's data when they load."
      );
    });
  });
});

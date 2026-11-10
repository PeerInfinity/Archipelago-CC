/**
 * Unit tests for the Connect handshake MessageHandler drives.
 *
 * The `game` field must name the LOADED PLAYER's game. A combined multiworld
 * rules.json carries the placeholder `game_name: "Multiworld"` at the top
 * level, and sending that gets the connection refused with InvalidGame
 * (reported by guigui0246). The refusal path must also leave no half-built
 * session state behind.
 *
 * Connect flow (server-data arc, connect flow part A): rules for a game the
 * room doesn't have are not used. The client then loads the room's own preset
 * (by RoomInfo.seed_name + slot name + the room's games), or connects as the
 * game the player picked, or the room's only game, or waits for a pick. A
 * seed_name mismatch with usable rules warns and connects anyway.
 *
 * Rules loaded for another player (the slot name isn't their player's name)
 * are not used either, even when their game is in the room. Nothing before
 * Connect can tell a same-named slot of another game, so InvalidGame for the
 * loaded rules' game retries once without them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: vi.fn(() => null),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

const stateManagerMock = vi.hoisted(() => ({
  staticData: null,
  gameName: null,
  getStaticData: vi.fn(function () {
    return stateManagerMock.staticData;
  }),
  getGameName: vi.fn(function () {
    return stateManagerMock.gameName;
  }),
  getLatestStateSnapshot: () => null,
  clearInventory: () => {},
  invalidateCache: () => {},
  notifyUI: () => {},
  applyRuntimeStateData: () => {},
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
  getLastRawJsonData: () => stateManagerMock.rawPayload ?? null,
}));

// storage is read for a remembered slot name; keep it empty here.
vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler } from './messageHandler.js';

/** The shape getStaticGameData() produces for a combined multiworld file. */
function multiworldStaticData(playerId) {
  return {
    game_name: 'Multiworld',
    playerId,
    player_names: { 1: 'Player1', 2: 'Player2', 3: 'Player3', 4: 'Player4' },
    world: {
      1: { game: 'A Hat in Time' },
      2: { game: 'A Link to the Past' },
      3: { game: 'A Short Hike' },
      4: { game: 'Adventure' },
    },
  };
}

function makeBus() {
  const subscribers = new Map();
  const published = [];
  return {
    published,
    subscribe: vi.fn((event, cb) => {
      if (!subscribers.has(event)) subscribers.set(event, new Set());
      subscribers.get(event).add(cb);
      return () => subscribers.get(event)?.delete(cb);
    }),
    publish: vi.fn((event, data) => {
      published.push({ event, data });
      for (const cb of [...(subscribers.get(event) || [])]) cb(data);
    }),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MessageHandler Connect packet', () => {
  let handler;

  beforeEach(() => {
    connectionMock.send.mockClear();
    stateManagerMock.staticData = null;
    stateManagerMock.gameName = null;
    handler = new MessageHandler();
    handler.setEventBus({ publish: () => {}, subscribe: () => () => {} });
    handler._requestDataPackage = vi.fn();
  });

  const sentConnect = () => {
    const call = connectionMock.send.mock.calls
      .map(([packets]) => packets[0])
      .find((packet) => packet?.cmd === 'Connect');
    return call;
  };

  it("sends the selected player's game, not the multiworld placeholder", () => {
    stateManagerMock.staticData = multiworldStaticData('2');
    stateManagerMock.gameName = 'Multiworld';
    handler.clientSlotName = 'SupraGuigui';

    handler._handleRoomInfo({
      cmd: 'RoomInfo',
      games: ['Archipelago', 'A Hat in Time', 'A Link to the Past', 'A Short Hike', 'Adventure'],
    });

    expect(sentConnect()).toMatchObject({
      cmd: 'Connect',
      game: 'A Link to the Past',
      name: 'SupraGuigui',
    });
  });

  it('uses the single-player game name unchanged', () => {
    stateManagerMock.staticData = {
      game_name: 'TUNIC',
      playerId: '1',
      world: { 1: { game: 'TUNIC' } },
    };
    stateManagerMock.gameName = 'TUNIC';
    handler.clientSlotName = 'Player1';

    handler._handleRoomInfo({ cmd: 'RoomInfo' });

    expect(sentConnect().game).toBe('TUNIC');
  });

  it('falls back to the state manager game name when world has no entry', () => {
    stateManagerMock.staticData = { game_name: 'Adventure', playerId: '1' };
    stateManagerMock.gameName = 'Adventure';
    handler.clientSlotName = 'Player1';

    handler._handleRoomInfo({ cmd: 'RoomInfo' });

    expect(sentConnect().game).toBe('Adventure');
  });

  it("defaults the slot name to the loaded player's own name", () => {
    stateManagerMock.staticData = multiworldStaticData('3');
    expect(handler.getDefaultSlotName()).toBe('Player3');

    handler._handleRoomInfo({ cmd: 'RoomInfo' });
    expect(sentConnect()).toMatchObject({
      game: 'A Short Hike',
      name: 'Player3',
    });
  });

  it('clears session state when the server refuses the connection', () => {
    handler.clientSlot = 2;
    handler.clientTeam = 0;
    handler.players = [{ slot: 2, name: 'Player2' }];

    handler._handleConnectionRefused({ cmd: 'ConnectionRefused', errors: ['InvalidGame'] });

    expect(handler.getClientSlot()).toBeNull();
    expect(handler.getClientTeam()).toBeNull();
    expect(handler.getPlayers()).toEqual([]);
  });
});

describe('MessageHandler connect flow — seed check, game picker, preset auto-load', () => {
  const SEED = '14089154938208861744';
  const FOLDER = `AP_${SEED}`;
  let handler;
  let bus;
  let fetchMock;

  const consoleLines = () =>
    bus.published.filter((p) => p.event === 'ui:printToConsole').map((p) => p.data);
  const connects = () =>
    connectionMock.send.mock.calls.map(([packets]) => packets[0]).filter((p) => p?.cmd === 'Connect');

  const refuse = (...errors) => handler._handleConnectionRefused({ cmd: 'ConnectionRefused', errors });
  const refusalsShown = () => bus.published.filter((p) => p.event === 'network:connectionRefused');

  /** fetch: preset_files.json is `index` (or 404), every other URL 404 unless in `files`. */
  function serve(index, files = {}) {
    fetchMock.mockImplementation(async (url) => {
      const body = url === './presets/preset_files.json' ? index : files[url];
      if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    });
  }

  beforeEach(() => {
    connectionMock.send.mockClear();
    connectionMock.isConnected.mockReturnValue(true);
    stateManagerMock.staticData = null;
    stateManagerMock.gameName = null;
    bus = makeBus();
    handler = new MessageHandler();
    handler.setEventBus(bus);
    handler._requestDataPackage = vi.fn();
    handler.clientSlotName = 'Player1';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    serve(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function loadRules(game, seedName) {
    stateManagerMock.staticData = { game_name: game, playerId: '1', world: { 1: { game } } };
    if (seedName !== undefined) stateManagerMock.staticData.seed_name = seedName;
    stateManagerMock.gameName = game;
  }

  describe('seed check (usable rules)', () => {
    it('warns on a seed_name mismatch and connects anyway', () => {
      loadRules('APQuest', '11111111111111111111');
      handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest'], seed_name: SEED });

      expect(connects()).toHaveLength(1);
      expect(connects()[0].game).toBe('APQuest');
      const warning = consoleLines().find((l) => l.type === 'warning');
      expect(warning.message).toContain(SEED);
      expect(warning.message).toContain('11111111111111111111');
    });

    it.each([
      ['a matching seed', SEED],
      ['a seedless document (no seed_name)', null],
      ['an empty seed_name', ''],
    ])('no warning for %s', (_label, seedName) => {
      loadRules('APQuest', seedName === null ? undefined : seedName);
      handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest'], seed_name: SEED });

      expect(connects()[0].game).toBe('APQuest');
      expect(consoleLines().filter((l) => l.type === 'warning')).toEqual([]);
    });
  });

  describe('rules for a game the room does not have', () => {
    it("connects as the room's only game when no preset matches", async () => {
      loadRules('A Link to the Past', SEED);
      await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest'], seed_name: SEED });

      expect(connects()).toHaveLength(1);
      expect(connects()[0]).toMatchObject({ game: 'APQuest', name: 'Player1' });
      expect(consoleLines().some((l) => l.message.includes('which this room does not have'))).toBe(true);
    });

    it('waits for a pick in a multi-game room, then connects as the picked game', async () => {
      await handler._handleRoomInfo({
        cmd: 'RoomInfo', games: ['Archipelago', 'APQuest', 'A Short Hike'], seed_name: SEED,
      });

      expect(connects()).toEqual([]);
      expect(handler.isAwaitingGameChoice()).toBe(true);
      const ask = bus.published.find((p) => p.event === 'client:gameChoiceNeeded');
      expect(ask.data.games).toEqual(['APQuest', 'A Short Hike']);

      handler.chooseGame('A Short Hike');
      await flush();

      expect(connects()).toHaveLength(1);
      expect(connects()[0].game).toBe('A Short Hike');
      expect(handler.isAwaitingGameChoice()).toBe(false);
    });

    it('uses a game picked before RoomInfo, free text included', async () => {
      handler.chooseGame('Some Unlisted Game');
      await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest', 'A Short Hike'] });

      expect(connects()[0].game).toBe('Some Unlisted Game');
    });

    it("loads the room's preset BEFORE sending Connect, then connects as its game", async () => {
      const rulesPath = `./presets/apquest/${FOLDER}/${FOLDER}_rules.json`;
      const rulesDoc = { game_name: 'APQuest', seed_name: SEED };
      serve(
        {
          apquest: {
            folders: {
              [FOLDER]: { games: [{ player: 1, name: 'Player1', game: 'APQuest' }], files: [`${FOLDER}_rules.json`] },
            },
          },
        },
        { [rulesPath]: rulesDoc }
      );
      // The app's loader: files:jsonLoaded -> loadRules -> stateManager:rulesLoaded.
      const order = [];
      bus.subscribe('files:jsonLoaded', (event) => {
        order.push('files:jsonLoaded');
        expect(event).toMatchObject({ jsonData: rulesDoc, selectedPlayerId: '1', sourceName: rulesPath });
        expect(connects()).toEqual([]);
        loadRules('APQuest', SEED);
        setTimeout(() => bus.publish('stateManager:rulesLoaded', { source: rulesPath }), 0);
      });
      connectionMock.send.mockImplementation(() => { order.push('Connect'); return true; });

      await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest'], seed_name: SEED });

      expect(order).toEqual(['files:jsonLoaded', 'Connect']);
      expect(connects()[0].game).toBe('APQuest');
      connectionMock.send.mockImplementation(() => true);
    });

    it('several matching presets: no auto-load, the console names them', async () => {
      const folder = { games: [{ player: 1, name: 'Player1', game: 'Metamath' }], files: [`${FOLDER}_rules.json`] };
      serve({ metamath: { folders: { [FOLDER]: folder } }, metamath_vanilla: { folders: { [FOLDER]: folder } } });

      await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Metamath'], seed_name: SEED });

      expect(bus.published.some((p) => p.event === 'files:jsonLoaded')).toBe(false);
      expect(consoleLines().some((l) => l.message.includes('metamath, metamath_vanilla'))).toBe(true);
      expect(connects()[0].game).toBe('Metamath');
    });

    it('a preset whose rules fail to fetch falls back to the picker path', async () => {
      serve({
        apquest: {
          folders: {
            [FOLDER]: { games: [{ player: 1, name: 'Player1', game: 'APQuest' }], files: [`${FOLDER}_rules.json`] },
          },
        },
      });

      await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'APQuest'], seed_name: SEED });

      expect(consoleLines().some((l) => l.message.startsWith('Could not load'))).toBe(true);
      expect(connects()[0].game).toBe('APQuest');
    });
  });

  describe("rules for a game the room has, but another player's", () => {
    const ROOM_GAMES = ['Archipelago', 'A Hat in Time', 'A Link to the Past', 'A Short Hike', 'Adventure'];
    const OTHER_SEED = '22222222222222222222';
    const room = (seed = SEED) => ({ cmd: 'RoomInfo', games: ROOM_GAMES, seed_name: seed });

    /** One loaded player, named `name` (omitted: the document names nobody). */
    function loadPlayer(game, name, seedName = SEED) {
      loadRules(game, seedName);
      if (name) stateManagerMock.staticData.player_names = { 1: name };
    }

    /** The multiworld rules file, loaded as `playerId`. */
    function loadMultiworld(playerId) {
      stateManagerMock.staticData = { ...multiworldStaticData(playerId), seed_name: SEED };
      stateManagerMock.gameName = 'Multiworld';
    }

    function serveMultiworldPreset({ player = 2, sentBefore = 0 } = {}) {
      const rulesPath = `./presets/multiworld/${FOLDER}/${FOLDER}_P${player}_rules.json`;
      const rulesDoc = { seed_name: SEED };
      serve(
        {
          multiworld: {
            folders: {
              [FOLDER]: {
                games: [
                  { player: 1, name: 'Player1', game: 'A Hat in Time' },
                  { player: 2, name: 'Player2', game: 'A Link to the Past' },
                  { player: 3, name: 'Player3', game: 'A Short Hike' },
                  { player: 4, name: 'Player4', game: 'Adventure' },
                ],
                files: [`${FOLDER}_rules.json`, `${FOLDER}_P${player}_rules.json`],
              },
            },
          },
        },
        { [rulesPath]: rulesDoc }
      );
      bus.subscribe('files:jsonLoaded', (event) => {
        expect(event).toMatchObject({ selectedPlayerId: String(player), sourceName: rulesPath });
        expect(connects()).toHaveLength(sentBefore);
        stateManagerMock.staticData = { ...multiworldStaticData(String(player)), seed_name: SEED };
        setTimeout(() => bus.publish('stateManager:rulesLoaded', { source: rulesPath }), 0);
      });
    }

    it("loads the room's preset for the slot and connects as the slot's game", async () => {
      loadPlayer('Adventure', 'Player1');
      handler.clientSlotName = 'Player2';
      serveMultiworldPreset();

      await handler._handleRoomInfo(room());

      expect(connects()).toHaveLength(1);
      expect(connects()[0]).toMatchObject({ game: 'A Link to the Past', name: 'Player2' });
      expect(consoleLines().some((l) => l.message.includes('for Player1, not Player2'))).toBe(true);
    });

    it("asks for the game in a multi-game room with no preset; the loaded game isn't sent", async () => {
      loadPlayer('Adventure', 'Player1');
      handler.clientSlotName = 'Player2';

      await handler._handleRoomInfo(room());

      expect(connects()).toEqual([]);
      expect(handler.isAwaitingGameChoice()).toBe(true);
    });

    it('a matching slot name changes nothing: no preset lookup, the loaded game is sent', async () => {
      loadPlayer('Adventure', 'Player4');
      handler.clientSlotName = 'Player4';

      await handler._handleRoomInfo(room());

      expect(fetchMock).not.toHaveBeenCalled();
      expect(connects()[0]).toMatchObject({ game: 'Adventure', name: 'Player4' });
    });

    it("multiworld rules compare the loaded player's name, not every player's", async () => {
      loadMultiworld('2');
      handler.clientSlotName = 'Player2';
      await handler._handleRoomInfo(room());
      expect(connects()[0]).toMatchObject({ game: 'A Link to the Past', name: 'Player2' });

      connectionMock.send.mockClear();
      loadMultiworld('2');
      handler.clientSlotName = 'Player3';
      await handler._handleRoomInfo(room());
      // Player3 is in the document, but the Connect would carry Player2's game.
      expect(connects()).toEqual([]);
      expect(handler.isAwaitingGameChoice()).toBe(true);
    });

    it.each([
      ['a seedless document', () => {
        loadPlayer('Adventure', 'Player1');
        delete stateManagerMock.staticData.seed_name;
      }],
      ['an empty seed_name', () => loadPlayer('Adventure', 'Player1', '')],
      ['a document with no player names', () => loadPlayer('Adventure', null)],
    ])('%s: no name comparison, the loaded game is sent', async (_label, load) => {
      load();
      handler.clientSlotName = 'Player2';

      await handler._handleRoomInfo(room());

      expect(connects()[0]).toMatchObject({ game: 'Adventure', name: 'Player2' });
    });

    it('a same-named slot of another game is not detected before Connect', async () => {
      loadPlayer('Adventure', 'Player1');
      handler.clientSlotName = 'Player1';

      await handler._handleRoomInfo(room());

      expect(connects()[0]).toMatchObject({ game: 'Adventure', name: 'Player1' });
    });

    describe('a builder game at another seed', () => {
      const BUILDER_ROOM = { cmd: 'RoomInfo', games: ['Archipelago', 'Metamath', 'APQuest'], seed_name: SEED };

      it('a matching name still builds the loaded game', async () => {
        loadPlayer('Metamath', 'Mathy', OTHER_SEED);
        handler.clientSlotName = 'Mathy';

        await handler._handleRoomInfo(BUILDER_ROOM);

        expect(connects()[0]).toMatchObject({ game: 'Metamath', name: 'Mathy' });
        expect(handler._serverBuild?.game).toBe('Metamath');
      });

      it('another name does not assume the loaded game in a multi-game room', async () => {
        loadPlayer('Metamath', 'Mathy', OTHER_SEED);
        handler.clientSlotName = 'Other';

        await handler._handleRoomInfo(BUILDER_ROOM);

        expect(connects()).toEqual([]);
        expect(handler.isAwaitingGameChoice()).toBe(true);
      });

      it("another name still builds in the game's own single-game room", async () => {
        loadPlayer('Metamath', 'Mathy', OTHER_SEED);
        handler.clientSlotName = 'Other';

        await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Metamath'], seed_name: SEED });

        expect(connects()[0]).toMatchObject({ game: 'Metamath', name: 'Other' });
        expect(handler._serverBuild?.game).toBe('Metamath');
      });
    });

    describe('a local generated world', () => {
      afterEach(() => {
        stateManagerMock.rawPayload = null;
      });

      function loadGeneratedWorld(seedName) {
        loadPlayer('Cloudberry', 'Player1', seedName);
        stateManagerMock.rawPayload = {
          rawJsonData: {
            seed_name: seedName,
            player_names: { 1: 'Player1' },
            world: { 1: { game: 'Cloudberry', options: { use_canonical_options: true } } },
          },
          selectedPlayerInfo: { playerId: '1' },
          source: 'local.json',
        };
      }

      it('at another seed, another slot name still uses the overlay', async () => {
        loadGeneratedWorld(OTHER_SEED);
        handler.clientSlotName = 'Berry';

        await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Cloudberry', 'APQuest'], seed_name: SEED });

        expect(connects()[0]).toMatchObject({ game: 'Cloudberry', name: 'Berry' });
        expect(handler._serverBuild?.mode).toBe('overlay');
      });

      it('at this seed, another slot name is another player', async () => {
        loadGeneratedWorld(SEED);
        handler.clientSlotName = 'Berry';

        await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Cloudberry', 'APQuest'], seed_name: SEED });

        expect(connects()).toEqual([]);
        expect(handler.isAwaitingGameChoice()).toBe(true);
      });

      it('at another seed, InvalidGame for the overlay drops it and asks for the game', async () => {
        loadGeneratedWorld(OTHER_SEED);
        handler.clientSlotName = 'Berry';
        await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Cloudberry', 'APQuest'], seed_name: SEED });
        expect(handler._serverBuild?.mode).toBe('overlay');

        refuse('InvalidGame');
        await vi.waitFor(() => expect(handler.isAwaitingGameChoice()).toBe(true));

        expect(handler._serverBuild).toBeNull();
        expect(connects()).toHaveLength(1);
        expect(refusalsShown()).toHaveLength(0);
      });
    });

    describe('the server refuses the Connect', () => {
      const lastGame = () => connects().at(-1).game;

      /** The boot preset's shape: Adventure's player has this room's slot name. */
      async function connectAsLoadedAdventure() {
        loadPlayer('Adventure', 'Player1');
        handler.clientSlotName = 'Player1';
        await handler._handleRoomInfo(room());
        expect(lastGame()).toBe('Adventure');
      }

      it("InvalidGame for the loaded rules' game: finds the slot's preset and connects as its game", async () => {
        loadPlayer('Adventure', 'Player1');
        handler.clientSlotName = 'Player1';
        serveMultiworldPreset({ player: 1, sentBefore: 1 });
        await handler._handleRoomInfo(room());

        refuse('InvalidGame');
        await vi.waitFor(() => expect(connects()).toHaveLength(2));

        expect(connects()[1]).toMatchObject({ game: 'A Hat in Time', name: 'Player1' });
        expect(refusalsShown()).toHaveLength(0);
        expect(consoleLines().filter((l) => l.type === 'error')).toEqual([]);
      });

      it('with no preset, asks for the game on the open socket', async () => {
        await connectAsLoadedAdventure();

        refuse('InvalidGame');
        await vi.waitFor(() => expect(handler.isAwaitingGameChoice()).toBe(true));

        expect(connects()).toHaveLength(1);
        expect(refusalsShown()).toHaveLength(0);
      });

      it('retries once: the second refusal is shown, and nothing is sent after it', async () => {
        handler.chooseGame('A Short Hike');
        await connectAsLoadedAdventure();

        refuse('InvalidGame');
        await vi.waitFor(() => expect(connects()).toHaveLength(2));
        expect(lastGame()).toBe('A Short Hike');
        expect(refusalsShown()).toHaveLength(0);

        refuse('InvalidGame');
        refuse('InvalidGame');
        await flush();

        expect(connects()).toHaveLength(2);
        expect(refusalsShown()).toHaveLength(2);
      });

      it('a reconnect gets no second retry: a server that refuses and hangs up cannot loop it', async () => {
        await connectAsLoadedAdventure();
        refuse('InvalidGame');
        await vi.waitFor(() => expect(handler.isAwaitingGameChoice()).toBe(true));

        // What the reconnect timer produces after the socket dropped.
        bus.publish('connection:close', {});
        bus.publish('connection:open', {});
        await handler._handleRoomInfo(room());
        expect(connects()).toHaveLength(2);

        refuse('InvalidGame');
        await flush();

        expect(connects()).toHaveLength(2);
        expect(refusalsShown()).toHaveLength(1);
      });

      it.each([
        ['after the refusal was shown', () => {
          refuse('InvalidGame');
          refuse('InvalidSlot');
        }],
        ['after the player disconnects', () => {
          refuse('InvalidGame');
          bus.publish('connection:close', { requested: true });
        }],
        ['after a login', () => {
          refuse('InvalidGame');
          return handler._handleConnected({ slot: 1, team: 0, players: [], slot_info: {} });
        }],
      ])('a new attempt %s gets its own retry', async (_label, endAttempt) => {
        await connectAsLoadedAdventure();
        await endAttempt();
        await flush();
        const shown = refusalsShown().length;

        await handler._handleRoomInfo(room());
        refuse('InvalidGame');
        await vi.waitFor(() => expect(handler.isAwaitingGameChoice()).toBe(true));

        expect(refusalsShown()).toHaveLength(shown);
      });

      it.each([
        [['InvalidSlot']],
        [['InvalidPassword']],
        [['IncompatibleVersion']],
        [['InvalidItemsHandling']],
        [['InvalidGame', 'InvalidPassword']],
        [[]],
      ])('%j is shown as before, with no retry', async (errors) => {
        await connectAsLoadedAdventure();

        refuse(...errors);
        await flush();

        expect(connects()).toHaveLength(1);
        expect(handler.isAwaitingGameChoice()).toBe(false);
        expect(refusalsShown()).toHaveLength(1);
      });

      it('a game the player picked is theirs: the same game loaded too, no retry', async () => {
        handler.chooseGame('Adventure');
        await connectAsLoadedAdventure();

        refuse('InvalidGame');
        await flush();

        expect(connects()).toHaveLength(1);
        expect(refusalsShown()).toHaveLength(1);
      });

      it("a pick made at the retry's question is shown when refused, not overridden", async () => {
        await connectAsLoadedAdventure();
        refuse('InvalidGame');
        await vi.waitFor(() => expect(handler.isAwaitingGameChoice()).toBe(true));
        handler.chooseGame('A Short Hike');
        await vi.waitFor(() => expect(connects()).toHaveLength(2));

        refuse('InvalidGame');
        await flush();

        expect(connects()).toHaveLength(2);
        expect(refusalsShown()).toHaveLength(1);
      });

      it("a game from this room's own preset is not retried", async () => {
        loadPlayer('Adventure', 'Player1');
        handler.clientSlotName = 'Player2';
        serveMultiworldPreset();
        await handler._handleRoomInfo(room());
        expect(lastGame()).toBe('A Link to the Past');

        refuse('InvalidGame');
        await flush();

        expect(connects()).toHaveLength(1);
        expect(refusalsShown()).toHaveLength(1);
      });

      it('a socket that is already gone gets the refusal shown, not a retry', async () => {
        await connectAsLoadedAdventure();
        connectionMock.isConnected.mockReturnValue(false);

        refuse('InvalidGame');
        await flush();

        expect(handler.isAwaitingGameChoice()).toBe(false);
        expect(refusalsShown()).toHaveLength(1);
      });

      describe('a builder game at another seed', () => {
        it('the loaded game as the fallback: the build is dropped and the game asked for', async () => {
          loadPlayer('Metamath', 'Mathy', OTHER_SEED);
          handler.clientSlotName = 'Mathy';
          await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Metamath', 'APQuest'], seed_name: SEED });
          expect(handler._serverBuild?.game).toBe('Metamath');

          refuse('InvalidGame');
          await vi.waitFor(() => expect(handler.isAwaitingGameChoice()).toBe(true));

          expect(handler._serverBuild).toBeNull();
          expect(connects()).toHaveLength(1);
          expect(refusalsShown()).toHaveLength(0);
        });

        it("the room's only game is the room's answer: shown, no retry", async () => {
          loadPlayer('Metamath', 'Mathy', OTHER_SEED);
          handler.clientSlotName = 'Mathy';
          await handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'Metamath'], seed_name: SEED });

          refuse('InvalidGame');
          await flush();

          expect(connects()).toHaveLength(1);
          expect(refusalsShown()).toHaveLength(1);
        });
      });
    });
  });
});

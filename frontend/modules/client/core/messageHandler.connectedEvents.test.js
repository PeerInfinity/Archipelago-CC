/**
 * Connected checks of locations with NO server ID (events), sdc-connected-events (⚖ Robert 2026-11-12).
 *
 * Before: connected, a `user:locationCheck` on an event resolved to id 0 (the rules' `id: null`), the send filter
 * dropped it, and nothing was sent or collected. Offline, the same check is collected by the state manager.
 * Now: an ID-less check is passed up to the state manager, exactly as offline (its own logic guard judges it);
 * an ID-bearing check is sent as before; the out-of-logic gate still runs first; a batch splits.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

const smState = vi.hoisted(() => ({ reachability: {}, pings: 0 }));
vi.mock('../../stateManager/index.js', () => {
  const proxy = {
    pingWorker: async () => { smState.pings += 1; return true; },
    getLatestStateSnapshot: () => ({ locationReachability: smState.reachability }),
    getSnapshot: () => ({ locationReachability: smState.reachability, inventory: {}, regionReachability: {} }),
    getStaticData: () => null,
    clearInventory: () => {},
    invalidateCache: () => {},
    notifyUI: () => {},
  };
  return { getLastRawJsonData: () => null, stateManagerProxySingleton: proxy };
});

// The DataPackage holds only the ID-bearing names; the loaded rules map an event to `id: null`, which
// getServerLocationId turns into 0 (Number(null)) — the real shape that used to reach the send filter.
const SERVER_IDS = { 'Level 010 - Sword': 30000000, 'Level 011 - Chest': 30000001 };
const RULES_IDS = { ...SERVER_IDS, 'L16 flag 0: rope@32,16 cleared': 0, 'L0 flag 1: breakablerock@288,176 cleared': 0 };
const ID_TO_NAME = Object.fromEntries(Object.entries(SERVER_IDS).map(([n, i]) => [i, n]));
vi.mock('../utils/idMapping.js', () => ({
  getItemNameFromServerId: () => null,
  getLocationNameFromServerId: (id) => ID_TO_NAME[id] ?? `Location ${id}`,
  getServerLocationId: async (name) => (name in RULES_IDS ? RULES_IDS[name] : null),
  getItemNameForGame: () => null,
  getLocationNameForGame: () => null,
  initializeMappingsFromDataPackage: () => true,
}));
vi.mock('../utils/debugSphereLogger.js', () => ({
  generateInaccessibleLocationSphereLog: () => 'diag',
  generateRegressionTestSphereLog: () => 'regr',
  createSphereLogDownloadUrl: () => 'blob:x',
  generateSphereLogFilename: (n, k) => `${n}-${k}.jsonl`,
}));

import messageHandler, { handleUserLocationCheckForClient } from './messageHandler.js';
import { goalMet } from './goalCheck.js';
import { GENERATED_WORLD_OPTION } from './localRulesOverlay.js';

const ROPE = 'L16 flag 0: rope@32,16 cleared';
const ROCK = 'L0 flag 1: breakablerock@288,176 cleared';
const CARD = (locationName) => ({ locationName, originator: 'LocationCardClick', originalDOMEvent: true });
const GAME = (locationName) => ({ locationName, originator: 'FlashPanel', originalDOMEvent: false, reportedByGame: true });

let busEvents;
let dispatcher;
const sentFrames = () => connectionMock.send.mock.calls.map(([frames]) => frames).flat()
  .filter((f) => f.cmd === 'LocationChecks');
const passedUp = () => dispatcher.publishToNextModule.mock.calls.map(([mod, ev, data, opts]) => ({ mod, ev, name: data.locationName, opts }));
const refusals = () => busEvents.filter((e) => e.name === 'client:locationCheckRefused').map((e) => e.data);

beforeEach(() => {
  connectionMock.isConnected.mockReturnValue(true);
  connectionMock.send.mockClear();
  smState.reachability = {
    [ROCK]: 'reachable', [ROPE]: 'unreachable', 'Level 010 - Sword': 'reachable', 'Level 011 - Chest': 'reachable',
  };
  smState.pings = 0;
  busEvents = [];
  dispatcher = { publishToNextModule: vi.fn() };
  messageHandler.eventBus = { publish: (name, data) => busEvents.push({ name, data }) };
  messageHandler.dispatcher = dispatcher;
  messageHandler.clientSlot = 1;
  messageHandler.clientTeam = 0;
  messageHandler.serverLocationNameToId = new Map(Object.entries(SERVER_IDS));
  messageHandler._sentLocationIds = new Set();
});

describe('a connected check of a location with no server ID', () => {
  it('is applied locally: passed up to the state manager, nothing sent (it used to be dropped)', async () => {
    await handleUserLocationCheckForClient(CARD(ROCK), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(passedUp()).toEqual([{ mod: 'client', ev: 'user:locationCheck', name: ROCK, opts: { direction: 'up' } }]);
    expect(refusals()).toEqual([]);
  });

  it('a game-reported event (gate-exempt) is applied locally too — the state manager judges it, as offline', async () => {
    await handleUserLocationCheckForClient(GAME(ROPE), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(passedUp().map((c) => c.name)).toEqual([ROPE]);
  });

  it('system:locationCheck of an event is applied locally under its own name', async () => {
    await handleUserLocationCheckForClient({ locationName: ROCK }, 'system:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(passedUp().map((c) => c.ev)).toEqual(['system:locationCheck']);
  });

  it('an out-of-logic event click is refused by the gate first: not sent, not passed up (fail-closed)', async () => {
    await handleUserLocationCheckForClient(CARD(ROPE), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(passedUp()).toEqual([]);
    expect(refusals()).toEqual([{ locationName: ROPE, reason: 'not_accessible', originator: 'LocationCardClick' }]);
  });

  it('an event the snapshot has no answer for is refused (fail-closed), not collected', async () => {
    delete smState.reachability[ROCK];
    await handleUserLocationCheckForClient(CARD(ROCK), 'user:locationCheck');
    expect(passedUp()).toEqual([]);
    expect(refusals().map((r) => r.reason)).toEqual(['reachability_unknown']);
  });
});

describe('a connected check WITH a server ID is unchanged', () => {
  it('is sent and not passed up', async () => {
    await handleUserLocationCheckForClient(CARD('Level 010 - Sword'), 'user:locationCheck');
    expect(sentFrames()).toEqual([{ cmd: 'LocationChecks', locations: [30000000] }]);
    expect(passedUp()).toEqual([]);
  });

  it('offline, every check (ID or not) is passed up as before', async () => {
    connectionMock.isConnected.mockReturnValue(false);
    await handleUserLocationCheckForClient(CARD('Level 010 - Sword'), 'user:locationCheck');
    await handleUserLocationCheckForClient(CARD(ROCK), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(passedUp().map((c) => c.name)).toEqual(['Level 010 - Sword', ROCK]);
  });
});

describe('a mixed batch splits', () => {
  it('splitLocationChecks: server IDs to send, ID-less names apart (id 0 / null / unknown are none)', async () => {
    const out = await messageHandler.splitLocationChecks(['Level 010 - Sword', ROPE, 'Level 011 - Chest', ROCK, 'Nowhere']);
    expect(out).toEqual({ ids: [30000000, 30000001], idless: [ROPE, ROCK, 'Nowhere'] });
  });

  it('the send filter never sees an ID-less location (no [0] frame)', async () => {
    const { ids } = await messageHandler.splitLocationChecks([ROPE, 'Level 011 - Chest']);
    messageHandler._internalSendLocationChecks(ids);
    expect(sentFrames()).toEqual([{ cmd: 'LocationChecks', locations: [30000001] }]);
  });
});

describe('the goal never counts a local event', () => {
  it('a local event check leaves the server-delivered items untouched, so goalMet stays false', async () => {
    // A generated world whose completion condition is an EVENT item (the pre-Victory shape; other games still have it).
    const doc = {
      world: { 1: { game: 'G', options: { [GENERATED_WORLD_OPTION]: 0 } } },
      game_info: { 1: { completion_condition: { type: 'item_check', item: 'Beat Boss' } } },
    };
    messageHandler._serverItems = new Map();
    smState.reachability['Beat Boss'] = 'reachable';
    await handleUserLocationCheckForClient(CARD('Beat Boss'), 'user:locationCheck');
    expect(passedUp().map((c) => c.name)).toEqual(['Beat Boss']); // collected locally, by the state manager
    expect([...messageHandler._serverItems]).toEqual([]);
    expect(goalMet(doc, 1, 'G', messageHandler._serverItems)).toBe(false);
    expect(goalMet(doc, 1, 'G', new Map([['Beat Boss', 1]]))).toBe(true); // the control: a delivered goal counts
  });
});

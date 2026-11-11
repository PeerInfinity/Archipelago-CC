/**
 * The connected path's out-of-logic gate and the false-alarm fix (sdc-ool-guard, ⚖ Robert 2026-11-11, options B + D
 * of NewDocs-plans `server-data/check-out-of-logic-guard.md`).
 *
 * B — connected, a `user:locationCheck` the game did not report is refused when the state manager's snapshot says
 *     the location is unreachable: no `LocationChecks` frame, a `client:locationCheckRefused`, a console warning.
 *     A game-reported pickup (`reportedByGame: true`) and `system:` events are still sent.
 * D — a RoomUpdate echo of a location this client sent, or a release after the goal, is force-checked without the
 *     `[INACCESSIBLE LOCATION DETECTED]` alarm; a genuine server/client mismatch still raises it.
 *
 * The payloads below are the exact ones the surfaces publish (locations/locationUI.js handleLocationClick,
 * regionGraph/graphInteractionManager.js dispatchLocationCheckEvent, flashPanel/seedlingRegionGlue.js _locationCheck).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

// The state manager's own answer: its snapshot's locationReachability.
const smState = vi.hoisted(() => ({ reachability: {}, pings: 0, checks: [] }));
vi.mock('../../stateManager/index.js', () => {
  const proxy = {
    pingWorker: async () => { smState.pings += 1; return true; },
    getLatestStateSnapshot: () => ({ locationReachability: smState.reachability }),
    getSnapshot: () => ({ locationReachability: smState.reachability, inventory: {}, regionReachability: {} }),
    getStaticData: () => null,
    checkLocation: async (name, addItems, force) => {
      smState.checks.push({ name, addItems, force });
      smState.reachability[name] = 'checked';
    },
    clearInventory: () => {},
    invalidateCache: () => {},
    notifyUI: () => {},
  };
  return { getLastRawJsonData: () => null, stateManagerProxySingleton: proxy };
});

const NAME_TO_ID = { 'Add Eggs': 300000008, 'Add Vanilla': 300000009, 'Preheat Oven': 300000001, 'Seedling Chest': 30000005 };
const ID_TO_NAME = Object.fromEntries(Object.entries(NAME_TO_ID).map(([n, i]) => [i, n]));
vi.mock('../utils/idMapping.js', () => ({
  getItemNameFromServerId: () => null,
  getLocationNameFromServerId: (id) => ID_TO_NAME[id] ?? `Location ${id}`,
  getServerLocationId: async (name) => NAME_TO_ID[name] ?? null,
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
import { needsLogicGate } from './checkGate.js';

const CARD = (locationName) => ({
  locationName, regionName: 'Kitchen', originator: 'LocationCardClick', originalDOMEvent: true,
  isLocationDiscovered: true, isRegionDiscovered: true,
});
const NODE = (locationName) => ({ locationName, regionName: 'Kitchen', originator: 'RegionGraphCheck', originalDOMEvent: true });
const SEEDLING_PICKUP = (locationName) => ({
  locationName, originator: 'FlashPanel', originalDOMEvent: false, reportedByGame: true,
});

let busEvents;
let dispatcher;
const sentFrames = () => connectionMock.send.mock.calls.map(([frames]) => frames).flat()
  .filter((f) => f.cmd === 'LocationChecks');
const published = (name) => busEvents.filter((e) => e.name === name).map((e) => e.data);
const alarms = () => published('ui:printToConsole').filter((d) => /INACCESSIBLE LOCATION DETECTED/.test(d.message));

beforeEach(() => {
  connectionMock.isConnected.mockReturnValue(true);
  connectionMock.send.mockClear();
  smState.reachability = {
    'Add Eggs': 'unreachable', 'Add Vanilla': 'unreachable', 'Preheat Oven': 'reachable', 'Seedling Chest': 'unreachable',
  };
  smState.pings = 0;
  smState.checks = [];
  busEvents = [];
  dispatcher = { publishToNextModule: vi.fn() };
  messageHandler.eventBus = { publish: (name, data) => busEvents.push({ name, data }) };
  messageHandler.dispatcher = dispatcher;
  messageHandler.clientSlot = 1;
  messageHandler.clientTeam = 0;
  messageHandler.serverLocationNameToId = new Map(Object.entries(NAME_TO_ID));
  messageHandler._sentLocationIds = new Set();
  messageHandler._slotReleased = false;
  messageHandler._goalReported = false;
  messageHandler._syncedLocationIds = new Set();
});

describe('B — the connected logic gate', () => {
  it('refuses an unreachable Locations-card click: no frame, a refusal, a warning, not passed on', async () => {
    await handleUserLocationCheckForClient(CARD('Add Eggs'), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(published('client:locationCheckRefused')).toEqual([
      { locationName: 'Add Eggs', reason: 'not_accessible', originator: 'LocationCardClick' },
    ]);
    const warn = published('ui:printToConsole');
    expect(warn).toHaveLength(1);
    expect(warn[0].type).toBe('warning');
    expect(warn[0].message).toMatch(/Out of logic: "Add Eggs" was not checked/);
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
    expect(smState.pings).toBe(1); // the snapshot was flushed before it was read
  });

  it('refuses an unreachable region-graph node click', async () => {
    await handleUserLocationCheckForClient(NODE('Add Vanilla'), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(published('client:locationCheckRefused').map((d) => d.locationName)).toEqual(['Add Vanilla']);
  });

  it('sends a reachable click', async () => {
    await handleUserLocationCheckForClient(CARD('Preheat Oven'), 'user:locationCheck');
    expect(sentFrames()).toEqual([{ cmd: 'LocationChecks', locations: [300000001] }]);
    expect(published('client:locationCheckRefused')).toEqual([]);
  });

  it('still sends a game-reported pickup the logic calls out of logic (the Seedling teleport case)', async () => {
    await handleUserLocationCheckForClient(SEEDLING_PICKUP('Seedling Chest'), 'user:locationCheck');
    expect(sentFrames()).toEqual([{ cmd: 'LocationChecks', locations: [30000005] }]);
    expect(published('client:locationCheckRefused')).toEqual([]);
  });

  it('never gates system:locationCheck', async () => {
    await handleUserLocationCheckForClient({ locationName: 'Add Eggs', regionName: 'Kitchen' }, 'system:locationCheck');
    expect(sentFrames()).toEqual([{ cmd: 'LocationChecks', locations: [300000008] }]);
  });

  it('fails closed: a check the state manager has no answer for is refused', async () => {
    delete smState.reachability['Add Eggs'];
    await handleUserLocationCheckForClient(CARD('Add Eggs'), 'user:locationCheck');
    expect(sentFrames()).toEqual([]);
    expect(published('client:locationCheckRefused')[0].reason).toBe('reachability_unknown');
  });

  it('fails closed on the payload: a user: check without reportedByGame is gated, whatever originalDOMEvent says', () => {
    expect(needsLogicGate('user:locationCheck', { locationName: 'x' })).toBe(true);
    expect(needsLogicGate('user:locationCheck', { locationName: 'x', originalDOMEvent: false })).toBe(true);
    expect(needsLogicGate('user:locationCheck', { locationName: 'x', reportedByGame: 'yes' })).toBe(true);
    expect(needsLogicGate('user:locationCheck', { locationName: 'x', reportedByGame: true })).toBe(false);
    expect(needsLogicGate('system:locationCheck', { locationName: 'x' })).toBe(false);
  });

  it('offline: unchanged — passes the event on for the state manager to judge', async () => {
    connectionMock.isConnected.mockReturnValue(false);
    await handleUserLocationCheckForClient(CARD('Add Eggs'), 'user:locationCheck');
    expect(dispatcher.publishToNextModule).toHaveBeenCalledWith('client', 'user:locationCheck', CARD('Add Eggs'), { direction: 'up' });
    expect(published('client:locationCheckRefused')).toEqual([]);
  });
});

describe('D — no false INACCESSIBLE alarm for our own sends or a release', () => {
  it('our own sent check, echoed out of logic: force-checked, no alarm', async () => {
    await handleUserLocationCheckForClient(SEEDLING_PICKUP('Seedling Chest'), 'user:locationCheck');
    await messageHandler._syncLocationsFromServer([30000005]);
    expect(smState.checks).toEqual([{ name: 'Seedling Chest', addItems: false, force: true }]);
    expect(alarms()).toEqual([]);
  });

  it('a release after OUR goal: no alarm for the burst', async () => {
    messageHandler.reportGoal();
    await messageHandler._syncLocationsFromServer([300000008, 300000009]);
    expect(smState.checks.map((c) => [c.name, c.force])).toEqual([['Add Eggs', true], ['Add Vanilla', true]]);
    expect(alarms()).toEqual([]);
  });

  it('a Release (or Goal) PrintJSON for our slot: no alarm', async () => {
    await messageHandler._handlePrintJSON({ cmd: 'PrintJSON', type: 'Release', team: 0, slot: 1, data: [{ text: 'released' }] });
    await messageHandler._syncLocationsFromServer([300000008]);
    expect(alarms()).toEqual([]);
  });

  it('a genuine mismatch (not ours, no release) still raises the alarm', async () => {
    await messageHandler._syncLocationsFromServer([300000008]);
    expect(smState.checks).toEqual([{ name: 'Add Eggs', addItems: false, force: true }]);
    expect(alarms()).toHaveLength(1);
    expect(alarms()[0].message).toMatch(/Location: Add Eggs/);
  });

  it('another slot releasing does not silence our alarm', async () => {
    await messageHandler._handlePrintJSON({ cmd: 'PrintJSON', type: 'Release', team: 0, slot: 2, data: [{ text: 'released' }] });
    await messageHandler._syncLocationsFromServer([300000009]);
    expect(alarms()).toHaveLength(1);
  });

  it('a reconnect re-arms both (a new connection starts with nothing sent and nothing released)', async () => {
    messageHandler._sentLocationIds.add(300000008);
    messageHandler._slotReleased = true;
    await messageHandler._handleConnected({ slot: 1, team: 0, players: [], slot_info: {}, missing_locations: [], checked_locations: [] }, { scout: false })
      .catch(() => {}); // the rest of the handshake needs more of the app than this test stubs
    expect(messageHandler._sentLocationIds.size).toBe(0);
    expect(messageHandler._slotReleased).toBe(false);
  });
});

describe('the game publishers declare reportedByGame', () => {
  // A game/substrate pickup without the flag would be logic-gated (refused) while connected — a physical pickup
  // the game allowed must still send. These are the user:locationCheck publishers that are the game reporting.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const modules = path.resolve(here, '../..');
  for (const rel of [
    'flashPanel/seedlingRegionGlue.js',
    'flashPanel/flashBridgeAdapter.js',
    'flashSubstrate/bridge.js',
    'jtaSubstrateWrapper/bridge.js',
    'omsiSubstrateWrapper/bridge.js',
    'textAdventureSubstrateWrapper/bridge.js',
    'apcalc/index.js',
    'vibeCodingSim/index.js',
    'jtaArchipelago/jtaArchipelagoLogic.js',
  ]) {
    it(rel, () => {
      expect(readFileSync(path.join(modules, rel), 'utf8')).toMatch(/reportedByGame: true/);
    });
  }
});

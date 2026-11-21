/**
 * Offline progress at connect (sdc-offline-progress-op1; design-offline-progress.md § 8; ⚖ Robert 2026-11-21):
 * a record captured at RoomInfo, offered only on an EXACT seed + slot + game match (Send / Not now / Discard),
 * pushed through the ordinary check path in passes (never out of logic; leftovers retried on ReceivedItems),
 * the goal named in the offer and reported once, Loop mode bypassed by calling the handler directly, and a
 * reconnect mid-push that resumes without a second prompt. Nothing persists past the page session.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: () => null,
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

const smState = vi.hoisted(() => ({ reachability: {}, checked: [], raw: null, player: null }));
vi.mock('../../stateManager/index.js', () => {
  const proxy = {
    pingWorker: async () => true,
    getLatestStateSnapshot: () => ({ locationReachability: smState.reachability, checkedLocations: smState.checked }),
    getSnapshot: () => ({ locationReachability: smState.reachability, inventory: {}, regionReachability: {} }),
    getStaticData: () => null,
    applyRuntimeStateData: () => {},
    beginBatchUpdate: async () => {},
    addItemToInventory: async () => {},
    commitBatchUpdate: async () => {},
  };
  return {
    getLastRawJsonData: () =>
      smState.raw ? { rawJsonData: smState.raw, selectedPlayerInfo: { playerId: smState.player } } : null,
    stateManagerProxySingleton: proxy,
  };
});

const LOC_IDS = { 'Bottom Left Chest': 1001, 'Top Middle Chest': 1002, 'Bottom Right Chest': 1003, 'Old Chest': 1099 };
const ID_TO_NAME = Object.fromEntries(Object.entries(LOC_IDS).map(([n, id]) => [id, n]));
const ITEM_IDS = { 7: 'Sword', 8: 'Shield' };
vi.mock('../utils/idMapping.js', () => ({
  getItemNameFromServerId: (id) => ITEM_IDS[id] ?? null,
  getLocationNameFromServerId: (id) => ID_TO_NAME[id] ?? `Location ${id}`,
  getServerLocationId: async (name) => LOC_IDS[name] ?? null,
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
import {
  OFFLINE_ORIGINATOR,
  captureRecord,
  goalInPending,
  mergeRecord,
  pickPass,
} from './offlineProgress.js';
import { GENERATED_WORLD_OPTION } from './localRulesOverlay.js';

const SEED = '14089154938208861744';
const GOAL = 'Final Boss Defeated';

/** An APQuest-shaped document for players 1 and 2 (the combined doc); `player` is the one loaded. */
const questDoc = ({ seed = SEED } = {}) => {
  const regionsFor = (p) => ({
    Overworld: { locations: [
      { name: 'Bottom Left Chest', id: 1001, item: { name: 'Sword', player: p } },
      { name: 'Top Middle Chest', id: 1002, item: { name: 'Shield', player: p } },
      { name: 'Bottom Right Chest', id: 1003, item: { name: 'Key', player: p === 1 ? 2 : 1 } },
      { name: 'Old Chest', id: 1099, item: { name: 'Junk', player: p } },
      { name: 'Rock Event', id: null, event: true, item: { name: 'Rock', player: p } },
    ] },
    'Final Boss Room': { locations: [
      { name: GOAL, id: null, event: true, locked: true, item: { name: 'Victory', player: p },
        access_rule: { rule: 'HasAll', args: { item_names: ['Shield', 'Sword'] } } },
    ] },
  });
  return {
    ...(seed === null ? {} : { seed_name: seed }),
    player_names: { 1: 'Player1', 2: 'Player2' },
    world: { 1: { game: 'APQuest' }, 2: { game: 'APQuest' } },
    game_info: {
      1: { completion_condition: { rule: 'Has', args: { item_name: 'Victory' } } },
      2: { completion_condition: { rule: 'Has', args: { item_name: 'Victory' } } },
    },
    regions: { 1: regionsFor(1), 2: regionsFor(2) },
  };
};

let busEvents;
let subscribers;
let dispatcher;
const frames = (cmd) => connectionMock.send.mock.calls.map(([f]) => f).flat().filter((f) => f.cmd === cmd);
const sentIds = () => frames('LocationChecks').flatMap((f) => f.locations);
const goalFrames = () => frames('StatusUpdate').filter((f) => f.status === 30);
const published = (name) => busEvents.filter((e) => e.name === name).map((e) => e.data);
const offers = () => published('client:offlineProgressOffer');
const consoleLines = () => published('ui:printToConsole').map((d) => d.message);

/** Offline play on the loaded doc: what the state manager holds when RoomInfo arrives. */
const playOffline = (doc, player, checked, reach = {}) => {
  smState.raw = doc;
  smState.player = player;
  smState.checked = checked;
  smState.reachability = reach;
};

/** RoomInfo: the capture (the connect flow itself is stubbed out). */
const roomInfo = (seed = SEED) => {
  messageHandler.processMessage({ cmd: 'RoomInfo', seed_name: seed, games: ['APQuest'] });
};

/** The Connected reset: the state manager then holds only the server's state. */
const connected = async ({ slot = 1, name = `Player${slot}`, game = 'APQuest', checked = [], missing } = {}) => {
  const all = Object.values(LOC_IDS);
  const missingIds = missing ?? all.filter((id) => !checked.includes(id));
  smState.checked = checked.map((id) => ID_TO_NAME[id]);
  for (const id of checked) smState.reachability[ID_TO_NAME[id]] = 'checked';
  messageHandler.clientSlotName = name;
  await messageHandler._handleConnected({
    cmd: 'Connected', slot, team: 0,
    players: [{ slot, team: 0, name }],
    slot_info: { [String(slot)]: { name, game, type: 1 } },
    missing_locations: missingIds,
    checked_locations: checked,
  });
};

const received = async (index, items) => {
  await messageHandler._handleReceivedItems({ cmd: 'ReceivedItems', index, items });
  await messageHandler._offlinePassChain;
};

/** Arm the exact-seed goal record, as _connectWithLoadedRules does for the marked copy. */
const armGoal = (doc, slot = 1) => {
  const goal = messageHandler._deriveAndMarkGoal(doc, slot, 'APQuest');
  messageHandler._upstreamGoal = { goal, doc, slot: String(slot), seedName: SEED };
};

beforeEach(() => {
  connectionMock.isConnected.mockReturnValue(true);
  connectionMock.send.mockClear();
  smState.reachability = {};
  smState.checked = [];
  smState.raw = null;
  smState.player = null;
  busEvents = [];
  subscribers = new Map();
  dispatcher = {
    // Only an ID-less check reaches here while connected (the state manager's local check). A Loop-mode
    // dispatcher would swallow a user:locationCheck; the push never goes through it for an ID check.
    publishToNextModule: vi.fn((_mod, _ev, data) => {
      if (smState.reachability[data.locationName] === 'reachable') smState.reachability[data.locationName] = 'checked';
    }),
  };
  messageHandler.eventBus = {
    publish: (name, data) => {
      busEvents.push({ name, data });
      for (const fn of subscribers.get(name) || []) fn(data);
    },
    subscribe: (name, fn) => {
      if (!subscribers.has(name)) subscribers.set(name, []);
      subscribers.get(name).push(fn);
      return () => subscribers.set(name, subscribers.get(name).filter((f) => f !== fn));
    },
  };
  messageHandler._subscribeToConnectionEvents();
  messageHandler.dispatcher = dispatcher;
  messageHandler._connectForRoom = vi.fn();
  messageHandler._requestDataPackage = vi.fn();
  messageHandler.clientSlot = null;
  messageHandler.clientTeam = null;
  messageHandler.clientSlotName = 'Player1';
  messageHandler.slotInfo = {};
  messageHandler._serverBuild = null;
  messageHandler._rulesWait = null;
  messageHandler._heldGameChecks = [];
  messageHandler._upstreamGoal = null;
  messageHandler._offlineRecords = new Map();
  messageHandler._offlineGameReported = new Set();
  messageHandler._offlineOffer = null;
  messageHandler._offlinePassChain = Promise.resolve();
  messageHandler._offlinePassWaiting = false;
  messageHandler._clientRulesSources = new Set();
  messageHandler._goalReportedRooms = new Set();
  messageHandler.scoutedLocations = new Map();
});

const ALL_IN_LOGIC = { 'Bottom Left Chest': 'reachable', 'Top Middle Chest': 'reachable', 'Old Chest': 'reachable' };

describe('the record: captured at RoomInfo, from the offline state', () => {
  it('RoomInfo captures the ID-bearing checks in check order (+ the goal), before the connect flow runs', () => {
    playOffline(questDoc(), 1, ['Top Middle Chest', 'Rock Event', 'Bottom Left Chest', GOAL]);
    roomInfo();
    const [record] = [...messageHandler._offlineRecords.values()];
    expect(record).toMatchObject({ seedName: SEED, slot: '1', game: 'APQuest', playerName: 'Player1', goalLocation: GOAL });
    expect(record.names).toEqual(['Top Middle Chest', 'Bottom Left Chest', GOAL]); // the event re-derives: not kept
    expect(messageHandler._connectForRoom).toHaveBeenCalledTimes(1);
  });

  it('a seedless document gives no record (it describes no room)', () => {
    playOffline(questDoc({ seed: null }), 1, ['Bottom Left Chest']);
    roomInfo();
    expect(messageHandler._offlineRecords.size).toBe(0);
  });

  it('a second capture of the same document is merged, never replaced (a capture after a reset loses nothing)', () => {
    const a = captureRecord(questDoc(), 1, ['Bottom Left Chest']);
    const b = captureRecord(questDoc(), 1, ['Top Middle Chest', 'Bottom Left Chest']);
    a.decision = 'send';
    const merged = mergeRecord(a, b);
    expect(merged.names).toEqual(['Bottom Left Chest', 'Top Middle Chest']);
    expect(merged.decision).toBe('send');
  });
});

describe('the offer: exact identity only', () => {
  it('slot 1, exact seed: offered once with a summary; nothing is sent before the player answers', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest', 'Top Middle Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1 });
    expect(offers()).toHaveLength(1);
    expect(offers()[0].count).toBe(2);
    expect(offers()[0].message).toMatch(/^You checked 2 locations while offline \(Player1, APQuest, this room's seed\)\. Send them/);
    expect(offers()[0].goal).toBeNull();
    expect(sentIds()).toEqual([]);
  });

  it('slot 2 of the combined document (player 2 loaded) at its own slot: offered', async () => {
    playOffline(questDoc(), 2, ['Top Middle Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 2 });
    expect(offers()).toHaveLength(1);
    expect(offers()[0].message).toMatch(/\(Player2, APQuest/);
  });

  it.each([
    ['another seed (the warning-but-allowed load)', () => roomInfo('99999'), { slot: 1 }],
    ["another player's document (Player1's doc, slot 2)", () => roomInfo(), { slot: 2 }],
    ['the same slot under another player name', () => roomInfo(), { slot: 1, name: 'Someone' }],
    ['another game at the slot', () => roomInfo(), { slot: 1, game: 'ChecksFinder' }],
  ])('%s: never offered, nothing sent', async (_l, room, conn) => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    room();
    if (conn.name) messageHandler.clientSlotName = conn.name;
    await connected(conn);
    expect(offers()).toEqual([]);
    expect(sentIds()).toEqual([]);
  });

  it('a check the server already has (a !collect, another tab) is not counted or sent', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest', 'Top Middle Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1, checked: [1001] });
    expect(offers()[0].count).toBe(1);
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1002]);
  });

  it('a check this room has no location for is dropped with one console line', async () => {
    playOffline(questDoc(), 1, ['Old Chest', 'Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1, missing: [1001, 1002, 1003] }); // 1099 is not in this room
    expect(offers()[0].count).toBe(1);
    expect(consoleLines().filter((l) => l.startsWith('Not sent: 1 offline check(s) this room has no location for ("Old Chest")'))).toHaveLength(1);
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1001]);
  });

  it('nothing to offer when every offline check is on the server', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1, checked: [1001] });
    expect(offers()).toEqual([]);
    expect(messageHandler._offlineRecords.size).toBe(0);
  });
});

describe('Send: passes through the ordinary path, never out of logic', () => {
  it('sends what is in logic now, keeps the rest, and sends it when a ReceivedItems puts it in logic', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest', 'Top Middle Chest']);
    roomInfo();
    await connected({ slot: 1 });
    smState.reachability = { 'Bottom Left Chest': 'reachable', 'Top Middle Chest': 'unreachable' };
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1001]);
    expect(consoleLines().at(-1)).toMatch(/Sent 1 offline check\(s\)\. Still out of logic: 1; kept/);
    expect(published('client:locationCheckRefused')).toEqual([]); // a pass never asks the gate for an out-of-logic one
    // Our own Sword comes back; logic now reaches the other chest.
    smState.reachability['Top Middle Chest'] = 'reachable';
    await received(1, [{ item: 7, location: 1001, player: 1 }]);
    expect(sentIds()).toEqual([1001, 1002]);
  });

  it('a check that stays out of logic is never sent, however many items arrive', async () => {
    playOffline(questDoc(), 1, ['Top Middle Chest']);
    roomInfo();
    await connected({ slot: 1 });
    smState.reachability = { 'Top Middle Chest': 'unreachable' };
    await messageHandler.respondToOfflineProgress('send');
    for (let i = 1; i <= 3; i += 1) await received(i, [{ item: 8, location: -1, player: 2 }]);
    expect(sentIds()).toEqual([]);
    expect(messageHandler._offlineRecords.size).toBe(1); // still kept for this session
  });

  it('a burst of deliveries asks for many passes; at most one runs and one waits (live: MW-P3 crawled otherwise)', async () => {
    const pass = vi.spyOn(messageHandler, '_offlineProgressPass').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    try {
      for (let i = 0; i < 20; i += 1) messageHandler._queueOfflinePass();
      await messageHandler._offlinePassChain;
      expect(pass).toHaveBeenCalledTimes(1);
      messageHandler._queueOfflinePass();
      await messageHandler._offlinePassChain;
      expect(pass).toHaveBeenCalledTimes(2);
    } finally {
      pass.mockRestore();
    }
  });

  it('every pushed check is a direct handler call (originator OfflineProgress): Loop mode never sees it', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest', 'Top Middle Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1 });
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1001, 1002]);
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
  });

  it('a pickup the GAME reported offline stays exempt from the gate when pushed', async () => {
    playOffline(questDoc(), 1, []);
    connectionMock.isConnected.mockReturnValue(false);
    await handleUserLocationCheckForClient({ locationName: 'Top Middle Chest', reportedByGame: true }, 'user:locationCheck');
    await handleUserLocationCheckForClient({ locationName: 'Bottom Left Chest', originator: 'LocationCardClick' }, 'user:locationCheck');
    smState.checked = ['Top Middle Chest', 'Bottom Left Chest'];
    connectionMock.isConnected.mockReturnValue(true);
    roomInfo();
    await connected({ slot: 1 });
    smState.reachability = { 'Top Middle Chest': 'unreachable', 'Bottom Left Chest': 'unreachable' };
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1002]); // the click stays pending: out of logic
  });

  it('all confirmed: the record ends with one console line', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1 });
    await messageHandler.respondToOfflineProgress('send');
    await messageHandler._handleRoomUpdate({ cmd: 'RoomUpdate', checked_locations: [1001] });
    await messageHandler._offlinePassChain;
    expect(consoleLines()).toContain('All your offline checks are on the server.');
    expect(messageHandler._offlineRecords.size).toBe(0);
  });
});

describe('the goal', () => {
  it('named in the same offer with the warning; Send reports it exactly once (verify_stale_offline: 0 before, 1 after)', async () => {
    const doc = questDoc();
    playOffline(doc, 1, ['Bottom Left Chest', 'Top Middle Chest', GOAL]);
    roomInfo();
    armGoal(doc);
    await connected({ slot: 1 });
    smState.reachability = { ...ALL_IN_LOGIC, [GOAL]: 'reachable' };
    expect(offers()[0].count).toBe(3);
    expect(offers()[0].goal).toEqual({ locations: [GOAL] });
    expect(offers()[0].message).toMatch(
      /This includes your goal \("Final Boss Defeated"\): sending it finishes Player1's game, and the server may release your remaining items/
    );
    expect(goalFrames()).toEqual([]);
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1001, 1002]);
    expect(goalFrames()).toHaveLength(1);
    await received(1, [{ item: 7, location: 1001, player: 1 }]);
    expect(goalFrames()).toHaveLength(1);
    // Live-found (APQ-s1): the ID-less goal stays checked locally and the server never echoes it, so the next
    // RoomInfo re-captures it. A goal this session already reported is never offered again.
    await messageHandler._handleRoomUpdate({ cmd: 'RoomUpdate', checked_locations: [1001, 1002] });
    await messageHandler._offlinePassChain;
    expect(messageHandler._offlineRecords.size).toBe(0);
    smState.checked = ['Bottom Left Chest', 'Top Middle Chest', GOAL];
    roomInfo();
    await connected({ slot: 1, checked: [1001, 1002] });
    await messageHandler._offlinePassChain;
    expect(offers()).toHaveLength(1);
    expect(goalFrames()).toHaveLength(1);
  });

  it('a generated world: the Victory location in the push is named as the goal', () => {
    const doc = questDoc();
    doc.world['1'].options = { [GENERATED_WORLD_OPTION]: true };
    doc.regions['1'].Overworld.locations.push({ name: 'Victory Spot', id: 1500, item: { name: 'Victory', player: 1 } });
    const pending = [
      { name: 'Bottom Left Chest', id: 1001, goal: false },
      { name: 'Victory Spot', id: 1500, goal: false },
    ];
    expect(goalInPending(doc, 1, pending, new Map())).toEqual({ locations: ['Victory Spot'] });
    expect(goalInPending(doc, 1, pending.slice(0, 1), new Map())).toBeNull();
    expect(goalInPending(doc, 1, pending, new Map([['Victory', 1]]))).toBeNull(); // already finished on the server
  });

  it('pickPass sends the goal last within a pass', () => {
    const pending = [
      { name: GOAL, id: null, goal: true, reportedByGame: false },
      { name: 'Bottom Left Chest', id: 1001, goal: false, reportedByGame: false },
    ];
    const picked = pickPass(pending, { reachability: { [GOAL]: 'reachable', 'Bottom Left Chest': 'reachable' }, inFlight: new Set() });
    expect(picked.map((e) => e.name)).toEqual(['Bottom Left Chest', GOAL]);
  });
});

describe('Not now, Discard, other rules, a reconnect', () => {
  it('Not now: nothing sent; offered again on the next connect in this session', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1 });
    await messageHandler.respondToOfflineProgress('later');
    expect(published('client:offlineProgressOfferClosed')).toEqual([{ choice: 'later' }]);
    expect(sentIds()).toEqual([]);
    // Disconnect, reconnect: RoomInfo again (the state manager now holds the server's state only).
    smState.checked = [];
    roomInfo();
    await connected({ slot: 1 });
    expect(offers()).toHaveLength(2);
    expect(offers()[1].count).toBe(1);
  });

  it('Discard: deleted, never offered again', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1 });
    await messageHandler.respondToOfflineProgress('discard');
    smState.checked = [];
    roomInfo();
    await connected({ slot: 1 });
    expect(offers()).toHaveLength(1);
    expect(sentIds()).toEqual([]);
  });

  it("the player loading other rules discards the record; the connect flow's own load does not", async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    messageHandler._clientRulesSources.add('rules:marked-copy');
    messageHandler.eventBus.publish('stateManager:rulesLoaded', { source: 'rules:marked-copy' });
    expect(messageHandler._offlineRecords.size).toBe(1);
    messageHandler.eventBus.publish('stateManager:rulesLoaded', { source: './presets/other/rules.json' });
    expect(messageHandler._offlineRecords.size).toBe(0);
    expect(consoleLines()).toContain('Discarded your offline checks: other rules were loaded.');
    await connected({ slot: 1 });
    expect(offers()).toEqual([]);
  });

  it('a reconnect mid-push: no second prompt, the confirmed check is not re-sent, the rest goes', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest', 'Top Middle Chest']);
    roomInfo();
    await connected({ slot: 1 });
    smState.reachability = { 'Bottom Left Chest': 'reachable', 'Top Middle Chest': 'unreachable' };
    await messageHandler.respondToOfflineProgress('send');
    expect(sentIds()).toEqual([1001]);
    // The socket drops; the server had confirmed 1001. Reconnect.
    smState.checked = ['Bottom Left Chest'];
    roomInfo();
    smState.reachability = { 'Top Middle Chest': 'reachable' };
    await connected({ slot: 1, checked: [1001] });
    await messageHandler._offlinePassChain;
    expect(offers()).toHaveLength(1);
    expect(sentIds()).toEqual([1001, 1002]);
  });

  it('a push sent but never confirmed before the drop is sent again after the reconnect (the server dedupes)', async () => {
    playOffline(questDoc(), 1, ['Bottom Left Chest'], { ...ALL_IN_LOGIC });
    roomInfo();
    await connected({ slot: 1 });
    await messageHandler.respondToOfflineProgress('send');
    smState.checked = [];
    roomInfo();
    smState.reachability = { ...ALL_IN_LOGIC };
    await connected({ slot: 1 });
    await messageHandler._offlinePassChain;
    expect(sentIds()).toEqual([1001, 1001]);
    expect(offers()).toHaveLength(1);
  });

  it('pushed checks carry the OfflineProgress originator', async () => {
    const seen = [];
    const handler = messageHandler._refuseCheck.bind(messageHandler);
    messageHandler._refuseCheck = (name, reason, data) => { seen.push(data.originator); handler(name, reason, data); };
    try {
      playOffline(questDoc(), 1, ['Bottom Left Chest'], { 'Bottom Left Chest': 'reachable' });
      roomInfo();
      await connected({ slot: 1 });
      // The snapshot flips between the pass's read and the gate's: the gate still refuses.
      const original = smState.reachability;
      let reads = 0;
      Object.defineProperty(smState, 'reachability', {
        configurable: true,
        get: () => (reads++ === 0 ? original : { 'Bottom Left Chest': 'unreachable' }),
        set: () => {},
      });
      await messageHandler.respondToOfflineProgress('send');
    } finally {
      delete messageHandler._refuseCheck;
      delete smState.reachability;
      smState.reachability = {};
    }
    expect(seen).toEqual([OFFLINE_ORIGINATOR]);
    expect(sentIds()).toEqual([]);
    expect(messageHandler._offlineInFlight.has('Bottom Left Chest')).toBe(false); // retried on the next pass
  });
});

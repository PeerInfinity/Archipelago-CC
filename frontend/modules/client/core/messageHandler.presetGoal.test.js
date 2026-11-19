/**
 * The goal report for a slot loaded from a committed preset matched to the room by its exact seed
 * (sdc-preset-goal-report): the same derive / mark / record as an add-on slot's (upstreamGoal.js), hooked
 * where _connectWithoutRules loads the room's own preset (_loadPresetRules). A multiworld `_P<n>` preset counts
 * (slot = the preset's player).
 *
 * Positives: the click reports exactly once; items that arrive after the click still finish. Negatives: nothing
 * at reachable / ReceivedItems / sync / reconnect; nothing for a world that reports its own goal (generated,
 * reports_goal_by_server_item, a proof/graph world); nothing for a preset of another seed; one console line
 * when the goal can't be derived.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: () => null,
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

const smState = vi.hoisted(() => ({ reachability: {}, raw: null }));
vi.mock('../../stateManager/index.js', () => {
  const proxy = {
    pingWorker: async () => true,
    getLatestStateSnapshot: () => ({ locationReachability: smState.reachability }),
    getSnapshot: () => ({ locationReachability: smState.reachability, inventory: {}, regionReachability: {} }),
    getStaticData: () => null,
    clearInventory: () => {},
    invalidateCache: () => {},
    notifyUI: () => {},
    applyRuntimeStateData: () => {},
  };
  return {
    getLastRawJsonData: () => (smState.raw ? { rawJsonData: smState.raw } : null),
    stateManagerProxySingleton: proxy,
  };
});

vi.mock('../utils/idMapping.js', () => ({
  getItemNameFromServerId: () => null,
  getLocationNameFromServerId: () => null,
  getServerLocationId: async () => null,
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
import { GOAL_EVENT_KIND, reportsOwnGoal } from './upstreamGoal.js';

const GOAL = 'Final Boss Defeated';
const SEED = '14089154938208861744';
const SLOT = 2;

/** An APQuest-shaped preset (the shape on disk: placements, event goal) for `slot` at `seed`. */
const presetDoc = ({ slot = SLOT, seed = SEED, slotData = {}, options = {} } = {}) => {
  const p = String(slot);
  return {
    seed_name: seed,
    game_info: { [p]: { completion_condition: { rule: 'Has', args: { item_name: 'Victory' } } } },
    world: { [p]: { game: 'APQuest', slot_data: slotData, options } },
    regions: {
      [p]: {
        Overworld: { locations: [
          { name: 'Bottom Left Chest', id: 1001, item: { name: 'Sword', player: slot } },
          { name: 'Top Middle Chest', id: 1002, item: { name: 'Shield', player: slot } },
        ] },
        'Final Boss Room': { locations: [
          { name: GOAL, id: null, event: true, locked: true, item: { name: 'Victory', player: slot },
            access_rule: { rule: 'HasAll', args: { item_names: ['Shield', 'Sword'] } } },
        ] },
      },
    },
  };
};

const PRESET = {
  path: `./presets/multiworld/AP_${SEED}/AP_${SEED}_P${SLOT}_rules.json`,
  gameKey: 'multiworld', folderName: `AP_${SEED}`, playerId: String(SLOT), game: 'APQuest',
};
const CARD = { locationName: GOAL, regionName: 'Final Boss Room', originator: 'LocationCardClick', originalDOMEvent: true };

let busEvents;
let served; // the JSON text fetch serves for the preset path
let loadedDocs;
const frames = (cmd) => connectionMock.send.mock.calls.map(([f]) => f).flat().filter((f) => f.cmd === cmd);
const goalFrames = () => frames('StatusUpdate').filter((f) => f.status === 30);
const consoleLines = () => busEvents.filter((e) => e.name === 'ui:printToConsole').map((e) => e.data.message);
const goalLocation = (doc, slot = SLOT) => doc.regions[String(slot)]['Final Boss Room'].locations[0];

/** _connectWithoutRules for a room at `roomSeed`, with the room's preset found. */
const connectWithPreset = async (roomSeed = SEED) => {
  messageHandler.roomInfo = { seed_name: roomSeed };
  messageHandler._findPresetForRoom = vi.fn(async () => PRESET);
  await messageHandler._connectWithoutRules({ seed_name: roomSeed }, ['APQuest'], messageHandler._roomInfoSeq);
  return loadedDocs.at(-1);
};

/** What _handleConnected does that matters here: a new connection. */
const newConnection = () => {
  messageHandler._goalReported = false;
  messageHandler._connectionSeq += 1;
};

beforeEach(() => {
  connectionMock.isConnected.mockReturnValue(true);
  connectionMock.send.mockClear();
  smState.reachability = { [GOAL]: 'reachable', 'Bottom Left Chest': 'checked', 'Top Middle Chest': 'checked' };
  smState.raw = null;
  busEvents = [];
  served = JSON.stringify(presetDoc());
  loadedDocs = [];
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => JSON.parse(served) }));
  // The load the Presets panel does: the state manager keeps the published object (getLastRawJsonData).
  messageHandler._loadRulesDocument = vi.fn(async (doc) => {
    smState.raw = doc;
    loadedDocs.push(doc);
    return true;
  });
  messageHandler.eventBus = { publish: (name, data) => busEvents.push({ name, data }), subscribe: () => () => {} };
  messageHandler.dispatcher = {
    publishToNextModule: vi.fn((_mod, _ev, data) => {
      if (smState.reachability[data.locationName] === 'reachable') smState.reachability[data.locationName] = 'checked';
    }),
  };
  messageHandler.chosenGame = null;
  messageHandler.clientSlot = SLOT;
  messageHandler.clientTeam = 0;
  messageHandler.clientSlotName = 'Quester';
  messageHandler.slotInfo = { [String(SLOT)]: { name: 'Quester', game: 'APQuest' } };
  messageHandler.serverLocationNameToId = new Map();
  messageHandler._sentLocationIds = new Set();
  messageHandler._slotReleased = false;
  messageHandler._goalReported = false;
  messageHandler._serverBuild = null;
  messageHandler._rulesWait = null;
  messageHandler._heldGameChecks = [];
  messageHandler._serverItems = new Map([['Sword', 1], ['Shield', 1]]);
  messageHandler._upstreamGoal = null;
  messageHandler._connectionSeq = 3;
});

describe('an exact-seed preset (multiworld _P2) gets the add-on\'s goal record', () => {
  it('derived and marked event_kind goal on the fetched object before it loads; recorded for slot 2', async () => {
    const doc = await connectWithPreset();
    expect(goalLocation(doc).event_kind).toBe(GOAL_EVENT_KIND);
    expect(messageHandler._upstreamGoal).toMatchObject({ slot: '2', seedName: SEED, doc });
    expect(messageHandler._upstreamGoal.goal).toMatchObject({ location: GOAL, item: 'Victory' });
    expect(frames('Connect')).toHaveLength(1);
  });

  it('the mark is on this fetch\'s own object: a later load of the same preset starts unmarked', async () => {
    const first = await connectWithPreset();
    const again = JSON.parse(served);
    expect(goalLocation(first).event_kind).toBe(GOAL_EVENT_KIND);
    expect(goalLocation(again).event_kind).toBeUndefined();
  });

  it('nothing at reachable, ReceivedItems or /sync; the click reports once; a second click nothing', async () => {
    await connectWithPreset();
    messageHandler._reportGoalIfMet(); // what every ReceivedItems (index 0 = connect, /sync) runs
    expect(goalFrames()).toEqual([]);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toEqual([{ cmd: 'StatusUpdate', status: 30 }]);
    expect(consoleLines()).toContain('Goal sent: you finished at "Final Boss Defeated". The server now marks Quester as done.');
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    messageHandler._reportGoalIfMet();
    expect(goalFrames()).toHaveLength(1);
  });

  it('a reconnect does not re-report (the check was on the earlier connection)', async () => {
    await connectWithPreset();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    connectionMock.send.mockClear();
    newConnection();
    messageHandler._reportGoalIfMet();
    expect(goalFrames()).toEqual([]);
  });

  it('items that arrive after the click still finish the game', async () => {
    const doc0 = presetDoc();
    doc0.game_info[String(SLOT)].completion_condition = { rule: 'HasAll', args: { item_names: ['Victory', 'Shield'] } };
    served = JSON.stringify(doc0);
    await connectWithPreset();
    messageHandler._serverItems = new Map([['Sword', 1]]);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toEqual([]);
    messageHandler._serverItems.set('Shield', 1);
    messageHandler._reportGoalIfMet();
    expect(goalFrames()).toEqual([{ cmd: 'StatusUpdate', status: 30 }]);
  });

  it('slot 1 (a single-game preset): the same', async () => {
    served = JSON.stringify(presetDoc({ slot: 1 }));
    messageHandler.clientSlot = 1;
    messageHandler.slotInfo = { 1: { name: 'Quester', game: 'APQuest' } };
    messageHandler._findPresetForRoom = vi.fn(async () => ({ ...PRESET, playerId: '1' }));
    messageHandler.roomInfo = { seed_name: SEED };
    await messageHandler._connectWithoutRules({ seed_name: SEED }, ['APQuest'], messageHandler._roomInfoSeq);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });
});

describe('no record', () => {
  it.each([
    ['a world_generator world (its own goalMet)', { options: { use_canonical_options: true } }],
    ['a world declaring reports_goal_by_server_item (APCalc)', { slotData: { reports_goal_by_server_item: true } }],
    ['a proof world (MetaMath: proof_structure)', { slotData: { proof_structure: { statements: [] } } }],
    ['a graph world (DepGraph: graph_structure)', { slotData: { graph_structure: { nodes: [] } } }],
  ])('%s: unmarked, no record, no console line', async (_l, over) => {
    served = JSON.stringify(presetDoc(over));
    const doc = await connectWithPreset();
    expect(reportsOwnGoal(doc, SLOT)).toBe(true);
    expect(goalLocation(doc).event_kind).toBeUndefined();
    expect(messageHandler._upstreamGoal).toBeNull();
    expect(consoleLines().some((l) => l.includes("won't tell the server"))).toBe(false);
  });

  it('a preset whose document is of another seed than the room\'s: no record', async () => {
    served = JSON.stringify(presetDoc({ seed: '99' }));
    const doc = await connectWithPreset();
    expect(goalLocation(doc).event_kind).toBeUndefined();
    expect(messageHandler._upstreamGoal).toBeNull();
  });

  it('a goal that can\'t be derived (a state_method goal): unchanged, one console line, clicks report nothing', async () => {
    const doc0 = presetDoc();
    doc0.game_info[String(SLOT)].completion_condition = { type: 'state_method', method: 'can_reach_location', args: [] };
    served = JSON.stringify(doc0);
    const doc = await connectWithPreset();
    expect(goalLocation(doc).event_kind).toBeUndefined();
    expect(messageHandler._upstreamGoal).toBeNull();
    expect(consoleLines()).toContain(
      "This client won't tell the server when APQuest is finished (its goal rule names no item). Its own game client reports the goal."
    );
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toEqual([]);
  });

  it('a record from an earlier preset is dropped when another preset loads', async () => {
    await connectWithPreset();
    served = JSON.stringify(presetDoc({ options: { use_canonical_options: true } }));
    await connectWithPreset();
    expect(messageHandler._upstreamGoal).toBeNull();
  });

  it('the loaded rules\' seed differs from the room\'s (warning-but-allowed): no record', async () => {
    smState.raw = presetDoc({ seed: '99' });
    messageHandler._upstreamGoal = null;
    messageHandler.getClientGameName = () => 'APQuest';
    try {
      await messageHandler._connectForRoom({ seed_name: SEED }, ['APQuest'], messageHandler._roomInfoSeq);
    } finally {
      delete messageHandler.getClientGameName;
    }
    expect(frames('Connect')).toHaveLength(1);
    expect(messageHandler._upstreamGoal).toBeNull();
    expect(goalLocation(smState.raw).event_kind).toBeUndefined();
  });
});

/**
 * The add-on slot's goal report in the message handler (design-upstream-goal-report § 2–3, as ruled 2026-11-17:
 * no send restrictions this mode doesn't have elsewhere).
 *
 * A check of the goal location takes the ordinary path, whoever sends it (a card, a node, the Region Graph bulk
 * check, the Timer, a bot, the Loop queue, a game report); it reports exactly one StatusUpdate 30 when this
 * connection saw the goal go from unchecked to checked and the SERVER's items complete it. Negatives: nothing when
 * the goal becomes reachable or on ReceivedItems/sync alone, out of logic, already checked before, on another
 * document / seed / slot, when the state manager does not record the check, when the server's items don't complete
 * it (until they do), offline, on a later connection, or for rules that did not come from the add-on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
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
  };
  return { getLastRawJsonData: () => (smState.raw ? { rawJsonData: smState.raw } : null), stateManagerProxySingleton: proxy };
});

const NAME_TO_ID = { 'Bottom Left Chest': 1001, 'Top Middle Chest': 1002 };
vi.mock('../utils/idMapping.js', () => ({
  getItemNameFromServerId: () => null,
  getLocationNameFromServerId: () => null,
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
import { GOAL_EVENT_KIND, deriveUpstreamGoal } from './upstreamGoal.js';
import { UPSTREAM_RULES_ADDON_SOURCE } from './localRulesOverlay.js';

const GOAL = 'Final Boss Defeated';
const SLOT = 2;

/** An APQuest-shaped add-on doc for `slot`: Victory @ Final Boss Defeated, behind Sword + Shield. */
const addonDoc = (slot = SLOT) => {
  const p = String(slot);
  return {
    game_info: { [p]: { completion_condition: { rule: 'Has', args: { item_name: 'Victory' } } } },
    world: { [p]: { game: 'APQuest' } },
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

const CARD = { locationName: GOAL, regionName: 'Final Boss Room', originator: 'LocationCardClick', originalDOMEvent: true };
const NODE = { locationName: GOAL, regionName: 'Final Boss Room', originator: 'RegionGraphCheck', originalDOMEvent: true };

let busEvents;
let dispatcher;
const frames = (cmd) => connectionMock.send.mock.calls.map(([f]) => f).flat().filter((f) => f.cmd === cmd);
const goalFrames = () => frames('StatusUpdate').filter((f) => f.status === 30);
const published = (name) => busEvents.filter((e) => e.name === name).map((e) => e.data);
const consoleLines = () => published('ui:printToConsole').map((d) => d.message);

/** Arm the handler as _completeServerBuild does after the add-on's rules loaded. */
const arm = (doc = addonDoc()) => {
  const build = { mode: 'overlay', overlaySource: 'server', overlayFrom: UPSTREAM_RULES_ADDON_SOURCE, game: 'APQuest' };
  const goal = messageHandler._prepareUpstreamGoal(build, { slot: SLOT }, doc);
  smState.raw = doc;
  messageHandler._upstreamGoal = { goal, doc, slot: String(SLOT), seedName: '1234' };
  return doc;
};

beforeEach(() => {
  connectionMock.isConnected.mockReturnValue(true);
  connectionMock.send.mockClear();
  smState.reachability = { [GOAL]: 'reachable', 'Bottom Left Chest': 'checked', 'Top Middle Chest': 'checked' };
  smState.raw = null;
  busEvents = [];
  // The state manager's local check: the goal becomes 'checked' when the event reaches it.
  dispatcher = {
    publishToNextModule: vi.fn((_mod, _ev, data) => {
      if (smState.reachability[data.locationName] === 'reachable') smState.reachability[data.locationName] = 'checked';
    }),
  };
  messageHandler.eventBus = { publish: (name, data) => busEvents.push({ name, data }), subscribe: () => () => {} };
  messageHandler.dispatcher = dispatcher;
  messageHandler.clientSlot = SLOT;
  messageHandler.clientTeam = 0;
  messageHandler.clientSlotName = 'Quester';
  messageHandler.slotInfo = { [String(SLOT)]: { name: 'Quester', game: 'APQuest' } };
  messageHandler.serverLocationNameToId = new Map(Object.entries(NAME_TO_ID));
  messageHandler._sentLocationIds = new Set();
  messageHandler._slotReleased = false;
  messageHandler._goalReported = false;
  messageHandler._serverBuild = null;
  messageHandler._rulesWait = null;
  messageHandler._heldGameChecks = [];
  messageHandler._serverItems = new Map([['Sword', 1], ['Shield', 1]]);
  messageHandler._upstreamGoal = null;
  messageHandler._connectionSeq = 7;
  messageHandler.roomInfo = { seed_name: '1234' };
});

describe('_prepareUpstreamGoal — only the add-on\'s rules, marked before load', () => {
  it('the add-on\'s doc: the goal is derived and marked event_kind goal (never auto-collected)', () => {
    const doc = arm();
    expect(messageHandler._upstreamGoal.goal).toMatchObject({ location: GOAL, item: 'Victory' });
    expect(doc.regions[String(SLOT)]['Final Boss Room'].locations[0].event_kind).toBe(GOAL_EVENT_KIND);
  });

  it.each([
    ['a server doc from world_generator (no add-on source)', { overlayFrom: null }],
    ['a local document', { overlaySource: 'local', overlayFrom: null }],
    ['a server-data build (no doc)', { mode: 'build' }],
  ])('%s: unchanged, no goal record', (_label, over) => {
    const doc = addonDoc();
    const build = { mode: 'overlay', overlaySource: 'server', overlayFrom: UPSTREAM_RULES_ADDON_SOURCE, game: 'APQuest', ...over };
    expect(messageHandler._prepareUpstreamGoal(build, { slot: SLOT }, doc)).toBeNull();
    expect(doc.regions[String(SLOT)]['Final Boss Room'].locations[0].event_kind).toBeUndefined();
    expect(consoleLines()).toEqual([]);
  });

  it('an add-on doc whose goal can\'t be derived (SC2-like state_method): unchanged + one console line', () => {
    const doc = addonDoc();
    doc.game_info[String(SLOT)].completion_condition = { type: 'state_method', method: 'can_reach_location', args: [] };
    const build = { mode: 'overlay', overlaySource: 'server', overlayFrom: UPSTREAM_RULES_ADDON_SOURCE, game: 'APQuest' };
    expect(messageHandler._prepareUpstreamGoal(build, { slot: SLOT }, doc)).toBeNull();
    expect(doc.regions[String(SLOT)]['Final Boss Room'].locations[0].event_kind).toBeUndefined();
    expect(consoleLines()).toEqual([
      "This client won't tell the server when APQuest is finished (its goal rule names no item). Its own game client reports the goal.",
    ]);
  });
});

describe('any sender checks it; the goal is reported once', () => {
  it.each([
    ['a Locations card', 'user:locationCheck', CARD],
    ['a Region Graph node', 'user:locationCheck', NODE],
    ['the Region Graph bulk check', 'user:locationCheck', { originator: 'RegionGraphBulkCheck', originalDOMEvent: true }],
    ['the Timer', 'user:locationCheck', { originator: 'TimerModuleAuto', fromBot: true, originalDOMEvent: false }],
    ['the Playback Bot', 'user:locationCheck', { originator: 'PlaybackBot', fromBot: true }],
    ['the Loop queue executing the action', 'user:locationCheck', { fromLoop: true }],
    ['a game report', 'user:locationCheck', { originator: 'TextAdventure', reportedByGame: true }],
    ['a system: check', 'system:locationCheck', { originator: 'SomeSubstrate' }],
  ])('%s: checked locally, one StatusUpdate 30', async (_l, eventName, extra) => {
    arm();
    await handleUserLocationCheckForClient({ locationName: GOAL, regionName: 'Final Boss Room', ...extra }, eventName);
    expect(dispatcher.publishToNextModule).toHaveBeenCalledTimes(1);
    expect(frames('LocationChecks')).toEqual([]); // an event has no server ID
    expect(goalFrames()).toEqual([{ cmd: 'StatusUpdate', status: 30 }]);
    expect(consoleLines()).toContain('Goal sent: you finished at "Final Boss Defeated". The server now marks Quester as done.');
    expect(published('client:locationCheckRefused')).toEqual([]);
  });

  it('a second check sends nothing more', async () => {
    arm();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });

  it('the Timer\'s batch path (checked locally first, then sendBatchLocationChecks) reports too', async () => {
    arm();
    smState.reachability[GOAL] = 'checked'; // batchCheckLocations already ran
    await messageHandler._noteUpstreamGoalCheck(GOAL, 'reachable');
    expect(goalFrames()).toHaveLength(1);
  });
});

describe('what still decides', () => {
  it('goal becomes reachable: nothing is sent without a check (ReceivedItems/sync alone never report)', () => {
    arm();
    messageHandler._reportGoalIfMet(); // what every ReceivedItems (index 0 = connect, /sync) runs
    expect(goalFrames()).toEqual([]);
  });

  it('out of logic: refused by the landed gate, as for every location', async () => {
    arm();
    smState.reachability[GOAL] = 'unreachable';
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
    expect(goalFrames()).toEqual([]);
    expect(published('client:locationCheckRefused')[0].reason).toBe('not_accessible');
  });

  it('already checked before the check (e.g. offline on a kept document): passed on, no report (the offline push at connect is a separate step: messageHandler.offlineProgress.test.js)', async () => {
    arm();
    smState.reachability[GOAL] = 'checked';
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).toHaveBeenCalledTimes(1);
    expect(goalFrames()).toEqual([]);
    messageHandler._reportGoalIfMet();
    expect(goalFrames()).toEqual([]);
  });

  it('the state manager does not record the check: no report', async () => {
    arm();
    dispatcher.publishToNextModule = vi.fn(); // its own guard refused it
    const wait = messageHandler._waitForLocalCheck.bind(messageHandler);
    messageHandler._waitForLocalCheck = (name) => wait(name, { tries: 2, intervalMs: 1 });
    try {
      await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    } finally {
      delete messageHandler._waitForLocalCheck;
    }
    expect(goalFrames()).toEqual([]);
  });

  it('the server\'s items don\'t complete it yet: checked, no report; the ReceivedItems that completes it reports', async () => {
    const doc = addonDoc();
    doc.game_info[String(SLOT)].completion_condition = { rule: 'HasAll', args: { item_names: ['Victory', 'Sword'] } };
    arm(doc);
    messageHandler._serverItems = new Map([['Shield', 1]]); // the frontend may hold a Sword; the server sent none
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).toHaveBeenCalledTimes(1);
    expect(goalFrames()).toEqual([]);
    expect(consoleLines().at(-1)).toMatch(/goal is sent once the items the server has sent you complete it/);
    messageHandler._serverItems.set('Sword', 1);
    messageHandler._reportGoalIfMet();
    expect(goalFrames()).toHaveLength(1);
  });

  it('a check on an earlier connection does not report on a later one', async () => {
    const doc = addonDoc();
    doc.game_info[String(SLOT)].completion_condition = { rule: 'HasAll', args: { item_names: ['Victory', 'Sword'] } };
    arm(doc);
    messageHandler._serverItems = new Map();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    messageHandler._connectionSeq += 1; // a reconnect (_handleConnected)
    messageHandler._serverItems = new Map([['Sword', 1]]);
    messageHandler._reportGoalIfMet();
    expect(goalFrames()).toEqual([]);
  });

  it.each([
    ['another document was loaded after the add-on\'s (equal content, a different load)', () => { smState.raw = addonDoc(); }],
    ['no document loaded', () => { smState.raw = null; }],
    ['a room of another seed', () => { messageHandler.roomInfo = { seed_name: '9999' }; }],
    ['another slot', () => { messageHandler.clientSlot = 3; }],
  ])('%s: the ordinary ID-less path, no report', async (_l, set) => {
    arm();
    set();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toEqual([]);
  });

  it('a same-seed reconnect keeps the loaded rules and the record; nothing is sent until a check', async () => {
    arm();
    messageHandler._handleConnected = vi.fn(); // the reconnect: no build, the loaded rules stay
    try {
      messageHandler.processMessage({ cmd: 'Connected', slot: SLOT, slot_info: {} });
    } finally {
      delete messageHandler._handleConnected;
    }
    messageHandler._goalReported = false; // what _handleConnected re-arms
    messageHandler._connectionSeq += 1;
    expect(goalFrames()).toEqual([]);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });

  it('offline: the check is passed up locally, nothing is reported (it is offered at the next connect: messageHandler.offlineProgress.test.js)', async () => {
    arm();
    connectionMock.isConnected.mockReturnValue(false);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(connectionMock.send).not.toHaveBeenCalled();
  });

  it('another location of the same slot takes the normal path', async () => {
    arm();
    smState.reachability['Bottom Left Chest'] = 'reachable';
    await handleUserLocationCheckForClient({ ...CARD, locationName: 'Bottom Left Chest' }, 'user:locationCheck');
    expect(frames('LocationChecks')).toEqual([{ cmd: 'LocationChecks', locations: [1001] }]);
    expect(goalFrames()).toEqual([]);
  });

  it('the derivation the handler uses is the module\'s', () => {
    expect(deriveUpstreamGoal(addonDoc(), String(SLOT)).goal.location).toBe(GOAL);
  });
});

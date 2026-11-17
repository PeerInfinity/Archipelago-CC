/**
 * The add-on slot's goal report in the message handler (design-upstream-goal-report § 2–3).
 *
 * Every row of the safety table has a negative here: nothing is sent when the goal becomes reachable, on a bulk /
 * timer / bot / Loop / replay / game check, in Loop mode, out of logic, when already checked, on another document,
 * after a new Connected, when the state manager does not record the check, when the server's items don't complete
 * the goal, offline, or for rules that did not come from the add-on. The one positive: a deliberate click sends
 * exactly one StatusUpdate 30.
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

const loop = vi.hoisted(() => ({ active: false, throws: false, registered: true }));
vi.mock('../../../app/core/centralRegistry.js', () => ({
  centralRegistry: {
    getPublicFunction: (mod, name) => {
      if (loop.throws) throw new Error('registry down');
      if (!loop.registered || mod !== 'loops' || name !== 'isLoopModeActive') return undefined;
      return () => loop.active;
    },
  },
}));

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
import { GOAL_HOLD, GOAL_EVENT_KIND, deriveUpstreamGoal } from './upstreamGoal.js';
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
  loop.active = false;
  loop.throws = false;
  loop.registered = true;
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

describe('the deliberate click — the only report', () => {
  it.each([['a Locations card', CARD], ['a Region Graph node', NODE]])('%s sends exactly one StatusUpdate 30', async (_l, data) => {
    arm();
    await handleUserLocationCheckForClient({ ...data }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).toHaveBeenCalledTimes(1); // checked locally, as offline
    expect(frames('LocationChecks')).toEqual([]); // an event has no server ID
    expect(goalFrames()).toEqual([{ cmd: 'StatusUpdate', status: 30 }]);
    expect(consoleLines()).toContain('Goal sent: you finished at "Final Boss Defeated". The server now marks Quester as done.');
  });

  it('a second click (already checked) sends nothing more', async () => {
    arm();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });
});

describe('held back: nothing sent, nothing checked locally', () => {
  it.each([
    ['Region Graph "check all accessible"', 'user:locationCheck', { originator: 'RegionGraphBulkCheck', originalDOMEvent: true }, GOAL_HOLD.NOT_A_CLICK],
    ['the Timer', 'user:locationCheck', { originator: 'TimerModuleAuto', fromBot: true, originalDOMEvent: false }, GOAL_HOLD.NOT_A_CLICK],
    ['the Playback Bot', 'user:locationCheck', { originator: 'PlaybackBot', fromBot: true }, GOAL_HOLD.NOT_A_CLICK],
    ['a Loop queue replay', 'user:locationCheck', { regionName: 'Final Boss Room', fromLoop: true }, GOAL_HOLD.NOT_A_CLICK],
    ['a game report', 'user:locationCheck', { originator: 'TextAdventure', reportedByGame: true }, GOAL_HOLD.NOT_A_CLICK],
    ['a system: check (playback, sync)', 'system:locationCheck', { originator: 'LocationCardClick' }, GOAL_HOLD.NOT_A_CLICK],
  ])('%s', async (_l, eventName, extra, reason) => {
    arm();
    await handleUserLocationCheckForClient({ locationName: GOAL, ...extra }, eventName);
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
    expect(smState.reachability[GOAL]).toBe('reachable'); // still clickable
    expect(goalFrames()).toEqual([]);
    expect(published('client:locationCheckRefused')).toEqual([
      { locationName: GOAL, reason, originator: extra.originator ?? null },
    ]);
  });

  it.each([
    ['Loop mode on', () => { loop.active = true; }],
    ['the registry throws (fail closed)', () => { loop.throws = true; }],
  ])('a card click with %s', async (_l, set) => {
    arm();
    set();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
    expect(goalFrames()).toEqual([]);
    expect(published('client:locationCheckRefused')[0].reason).toBe(GOAL_HOLD.LOOP_MODE);
  });

  it('no loops module registered = Loop mode off: the click reports', async () => {
    arm();
    loop.registered = false;
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });

  it.each([
    ['another document was loaded after the add-on\'s (equal content, a different load)', () => { smState.raw = addonDoc(); }],
    ['no document loaded', () => { smState.raw = null; }],
    ['a room of another seed', () => { messageHandler.roomInfo = { seed_name: '9999' }; }],
    ['another slot', () => { messageHandler.clientSlot = 3; }],
  ])('%s: the ordinary ID-less path (checked locally), no report', async (_l, set) => {
    arm();
    set();
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toEqual([]);
    expect(published('client:locationCheckRefused').filter((r) => String(r.reason).startsWith('goal_'))).toEqual([]);
  });
});

describe('the other gates', () => {
  it('goal becomes reachable: nothing is sent without a click (and ReceivedItems/sync never report it)', () => {
    arm();
    messageHandler._reportGoalIfMet(); // what every ReceivedItems (index 0 = connect, /sync) runs
    expect(goalFrames()).toEqual([]);
  });

  it('out of logic: refused by the landed gate', async () => {
    arm();
    smState.reachability[GOAL] = 'unreachable';
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
    expect(goalFrames()).toEqual([]);
    expect(published('client:locationCheckRefused')[0].reason).toBe('not_accessible');
  });

  it('already checked earlier (e.g. offline on a kept document): no report', async () => {
    arm();
    smState.reachability[GOAL] = 'checked';
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
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

  it('the server\'s items don\'t complete the goal: no report, and the goal stays clickable', async () => {
    const doc = addonDoc();
    doc.game_info[String(SLOT)].completion_condition = { rule: 'HasAll', args: { item_names: ['Victory', 'Sword'] } };
    arm(doc);
    messageHandler._serverItems = new Map([['Shield', 1]]); // the frontend may hold a Sword; the server sent none
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(dispatcher.publishToNextModule).not.toHaveBeenCalled();
    expect(smState.reachability[GOAL]).toBe('reachable');
    expect(goalFrames()).toEqual([]);
    expect(consoleLines().at(-1)).toMatch(/don't complete the goal/);
    // the server delivers the Sword: the same click now reports
    messageHandler._serverItems.set('Sword', 1);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });

  it('a same-seed reconnect keeps the loaded rules and the record; nothing is sent until the click', async () => {
    arm();
    messageHandler._handleConnected = vi.fn(); // the reconnect: no build, the loaded rules stay
    try {
      messageHandler.processMessage({ cmd: 'Connected', slot: SLOT, slot_info: {} });
    } finally {
      delete messageHandler._handleConnected;
    }
    messageHandler._goalReported = false; // what _handleConnected re-arms
    expect(goalFrames()).toEqual([]);
    await handleUserLocationCheckForClient({ ...CARD }, 'user:locationCheck');
    expect(goalFrames()).toHaveLength(1);
  });

  it('offline: the click is passed up locally, nothing is reported', async () => {
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


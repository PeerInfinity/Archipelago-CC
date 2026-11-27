import { describe, expect, it } from 'vitest';
import {
  LIVE_PLAY_EVENTS,
  MYSTERY_EVENTS, MYSTERY_REFUSALS, MysteryArchipelagoLogic, SOURCE_MODULE, caseRegionsOfWarehouse, currentMysteryBlock, gameKeyOf,
  mysteryBlockOf,
  mysteryBlockOfRegion, mysteryStateOf,
} from './mysteryArchipelagoLogic.js';

const staticData = (over = {}) => ({
  playerId: '1',
  seed_name: '777',
  world: {
    1: {
      slot_data: {
        mystery: {
          story: 'custom-house-fire',
          version: 'abc123',
          goal: 'q.who',
          locations: { 'Question 01': 'q.set', 'Question 02': 'q.door', 'Question 03': 'q.who' },
          items: { 'The night watch book': 'watch_book', "Dr. Hume's note": 'doctor' },
          ...over,
        },
      },
    },
  },
});

/** A logic instance over a fake bus, with the world and snapshot held in `env`. */
function setup({ data = staticData(), snapshot = { inventory: {}, checkedLocations: [] } } = {}) {
  const env = {
    data, snapshot, connection: { connected: false, slot: null, team: null }, published: [], dispatched: [], handlers: new Map(),
    caseRegions: [], activeRegionId: null, livePlay: null,
  };
  const eventBus = {
    subscribe: (event, handler) => env.handlers.set(event, handler),
    publish: (event, payload) => env.published.push({ event, payload }),
  };
  const dispatcher = { publish: (event, payload, direction) => env.dispatched.push({ event, payload, direction }) };
  const logic = new MysteryArchipelagoLogic({
    eventBus, dispatcher, getStaticData: () => env.data, getSnapshot: () => env.snapshot, getConnection: () => env.connection,
    getCaseRegions: () => env.caseRegions, getActiveRegionId: () => env.activeRegionId, getLivePlay: () => env.livePlay,
  });
  logic.initialize();
  env.fire = (event, payload) => env.handlers.get(event)(payload);
  env.states = () => env.published.filter((p) => p.event === MYSTERY_EVENTS.STATE).map((p) => p.payload);
  env.refusals = () => env.published.filter((p) => p.event === MYSTERY_EVENTS.REFUSED).map((p) => p.payload.reason);
  return env;
}

describe('mysteryBlockOf', () => {
  it('reads the loaded player\'s block and inverts the location map', () => {
    const block = mysteryBlockOf(staticData());
    expect(block.story).toBe('custom-house-fire');
    expect(block.locationOfQuestion.get('q.door')).toBe('Question 02');
    expect(block.seedName).toBe('777');
  });

  it('is null for a world that is not a mystery case', () => {
    expect(mysteryBlockOf(null)).toBeNull();
    expect(mysteryBlockOf({ world: { 1: { slot_data: {} } } })).toBeNull();
    expect(mysteryBlockOf({ world: { 1: { slot_data: { mystery: { story: 'x' } } } } })).toBeNull();
  });

  it('follows playerId, so a slot other than 1 reads its own block', () => {
    const data = { playerId: '2', seed_name: 5, world: { 2: staticData().world[1] } };
    expect(mysteryBlockOf(data).player).toBe('2');
  });
});

describe('mysteryStateOf', () => {
  const block = mysteryBlockOf(staticData());

  it('gives the whole set of papers held and questions checked, in the page\'s ids, sorted', () => {
    const snapshot = {
      inventory: { 'The night watch book': 1, "Dr. Hume's note": 1, 'Nothing new': 3 },
      checkedLocations: ['Question 03', 'Question 01', 'Some other location'],
    };
    const state = mysteryStateOf(block, snapshot, { connected: true, slot: 2, team: 0 });
    expect(state).toEqual({
      story: 'custom-house-fire', version: 'abc123', game: '777:0:2', connected: true,
      papers: ['doctor', 'watch_book'], solved: ['q.set', 'q.who'],
    });
  });

  it('leaves out a paper whose count is 0', () => {
    expect(mysteryStateOf(block, { inventory: { 'The night watch book': 0 } }, {}).papers).toEqual([]);
  });

  it('names an offline game apart from a connected one', () => {
    expect(gameKeyOf(block, { connected: false })).toBe('offline:777:1');
    expect(gameKeyOf(block, { connected: true, slot: 1, team: 0 })).toBe('777:0:1');
  });
});

describe('MysteryArchipelagoLogic', () => {
  it('sends nothing before the page has asked', () => {
    const env = setup();
    env.fire('stateManager:snapshotUpdated');
    env.fire('game:connected', { slot: 1, team: 0 });
    expect(env.published).toEqual([]);
  });

  it('answers a request with the state', () => {
    const env = setup({ snapshot: { inventory: { 'The night watch book': 1 }, checkedLocations: [] } });
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire', version: 'abc123' });
    expect(env.states()).toEqual([{
      story: 'custom-house-fire', version: 'abc123', game: 'offline:777:1', connected: false,
      papers: ['watch_book'], solved: [],
    }]);
  });

  it('answers every request, even when nothing changed', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire' });
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire' });
    expect(env.states()).toHaveLength(2);
  });

  it('refuses another story, another version and a world that is no mystery, by name', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'garden-room' });
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire', version: 'older' });
    env.data = { playerId: '1', world: { 1: { slot_data: {} } } };
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire' });
    expect(env.refusals()).toEqual([
      MYSTERY_REFUSALS.OTHER_STORY, MYSTERY_REFUSALS.OTHER_VERSION, MYSTERY_REFUSALS.NO_MYSTERY_WORLD,
    ]);
    expect(env.states()).toEqual([]);
  });

  it('a refusal carries the story and version the slot has', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire', version: 'older' });
    expect(env.published[0].payload).toEqual({
      reason: MYSTERY_REFUSALS.OTHER_VERSION, story: 'custom-house-fire', version: 'abc123',
    });
  });

  it('after a request, sends again only when the state changed', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire' });
    env.fire('stateManager:snapshotUpdated');
    env.fire('game:itemsReceived');
    expect(env.states()).toHaveLength(1);
    env.snapshot = { inventory: { "Dr. Hume's note": 1 }, checkedLocations: [] };
    env.fire('stateManager:snapshotUpdated');
    env.fire('stateManager:snapshotUpdated');
    expect(env.states()).toHaveLength(2);
    expect(env.states()[1].papers).toEqual(['doctor']);
  });

  it('connecting and disconnecting change the state: connected, and the game string', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire' });
    env.connection = { connected: true, slot: 3, team: 0 };
    env.fire('game:connected', { slot: 3, team: 0 });
    env.fire('client:connectedStateApplied');
    env.connection = { connected: false, slot: null, team: null };
    env.fire('connection:close');
    env.fire('connection:close');
    expect(env.states().map((s) => [s.connected, s.game])).toEqual([
      [false, 'offline:777:1'], [true, '777:0:3'], [false, 'offline:777:1'],
    ]);
  });

  it('enabled after the app connected (no connect event seen), it still says connected', () => {
    const env = setup();
    env.connection = { connected: true, slot: 2, team: 0 };
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'custom-house-fire' });
    expect(env.states().map((s) => [s.connected, s.game])).toEqual([[true, '777:0:2']]);
  });

  it('turns a solved question into a location check the client never logic-gates', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, { story: 'custom-house-fire', questionId: 'q.door' });
    expect(env.dispatched).toEqual([{
      event: 'user:locationCheck',
      payload: { locationName: 'Question 02', sourceModule: SOURCE_MODULE, reportedByGame: true },
      direction: 'bottom',
    }]);
  });

  it('the goal question is an ordinary check', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, { story: 'custom-house-fire', questionId: 'q.who' });
    expect(env.dispatched[0].payload.locationName).toBe('Question 03');
  });

  it('sends a question again while it is not checked, and not once it is', () => {
    const env = setup();
    const solved = { story: 'custom-house-fire', questionId: 'q.set' };
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
    expect(env.dispatched).toHaveLength(2);
    env.snapshot = { inventory: {}, checkedLocations: ['Question 01'] };
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
    expect(env.dispatched).toHaveLength(2);
  });

  it('checks nothing for another story or an unknown question', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, { story: 'garden-room', questionId: 'q.door' });
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, { story: 'custom-house-fire', questionId: 'q.nope' });
    expect(env.dispatched).toEqual([]);
    expect(env.refusals()).toEqual([MYSTERY_REFUSALS.OTHER_STORY]);
  });
});

/** A `mystery` region's payload, as mysterySubstrateLibrary.js writes it. */
const officePayload = (over = {}) => ({
  story: 'custom-house-fire', version: 'abc123', case: 'cases/custom-house-fire', lock: 'actions',
  ap_locations: { 'q.set': 'Question 01', 'q.door': 'Question 02', 'q.who': 'Question 03' },
  papers: { 'The night watch book': 'watch_book', "Dr. Hume's note": 'doctor' },
  ...over,
});

describe('a case that is a region of a generated world', () => {
  const request = { story: 'custom-house-fire', version: 'abc123' };
  const inWorld = (over = {}) => {
    const env = setup({ data: { playerId: '1', seed_name: '777', world: { 1: { slot_data: {} } } } });
    env.caseRegions = [{ regionId: 'The case', payload: officePayload(over) }];
    return env;
  };

  it('reads the map off the region\'s payload, both ways', () => {
    const block = mysteryBlockOfRegion('The case', officePayload(), { playerId: '2', seed_name: 9 });
    expect(block.locationOfQuestion.get('q.door')).toBe('Question 02');
    expect(block.questionOfLocation['Question 03']).toBe('q.who');
    expect([block.player, block.seedName, block.regionId, block.lock, block.case]).toEqual(['2', '9', 'The case', 'actions', 'cases/custom-house-fire']);
    expect(mysteryBlockOfRegion('x', { story: 'x' }, {})).toBeNull();
  });

  it('finds the mystery regions of the runtime player\'s warehouse (the real class), and none without one', async () => {
    const { WorldWarehouse } = await import('../procgenPlayer/procgenPlayerEngine.js');
    const warehouse = new WorldWarehouse();
    warehouse.regions.set('The street', { substrate: 'maze', world: {} });
    warehouse.regions.set('The case', { substrate: 'mystery', world: officePayload() });
    expect(caseRegionsOfWarehouse(warehouse, 'mystery')).toEqual([{ regionId: 'The case', payload: officePayload() }]);
    expect(caseRegionsOfWarehouse(null, 'mystery')).toEqual([]);
  });

  it('the region wins over the slot\'s block, and a world with neither has no case', () => {
    const regions = [{ regionId: 'The case', payload: officePayload({ version: 'region' }) }];
    expect(currentMysteryBlock({ staticData: staticData(), caseRegions: regions }).version).toBe('region');
    expect(currentMysteryBlock({ staticData: staticData(), caseRegions: [] }).version).toBe('abc123');
    expect(currentMysteryBlock({ staticData: { world: { 1: {} } } })).toBeNull();
  });

  it('among several cases: the asked story, else the one the player is in, else the first', () => {
    const caseRegions = [
      { regionId: 'A', payload: officePayload({ story: 'a' }) },
      { regionId: 'B', payload: officePayload({ story: 'b' }) },
    ];
    const pick = (over) => currentMysteryBlock({ staticData: {}, caseRegions, ...over }).regionId;
    expect(pick({ story: 'b', activeRegionId: 'A' })).toBe('B');
    expect(pick({ activeRegionId: 'B' })).toBe('B');
    expect(pick({ story: 'zzz' })).toBe('A');
  });

  it('the state says the lock and whether the player is in the office', () => {
    const env = inWorld({ lock: 'new-reading' });
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, request);
    expect(env.states()[0]).toMatchObject({ story: 'custom-house-fire', version: 'abc123', lock: 'new-reading', inOffice: false });
  });

  it('a slot\'s case carries neither field', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, request);
    expect(env.states()[0]).not.toHaveProperty('lock');
    expect(env.states()[0]).not.toHaveProperty('inOffice');
  });

  it('moving in and out of the office sends a new state each time, and only then', () => {
    const env = inWorld();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, request);
    env.activeRegionId = 'The case';
    env.fire('procgen:activeSubstrateChanged');
    env.fire('procgen:activeSubstrateChanged');
    env.activeRegionId = 'The street';
    env.fire('procgen:activeSubstrateChanged');
    expect(env.states().map((s) => s.inOffice)).toEqual([false, true, false]);
  });

  it('a question is checked in the office and not away from it, under every lock', () => {
    for (const lock of ['actions', 'new-reading', 'everything']) {
      const env = inWorld({ lock });
      const solved = { story: 'custom-house-fire', questionId: 'q.door' };
      env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
      expect(env.dispatched, lock).toEqual([]);
      env.activeRegionId = 'The case';
      env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
      expect(env.dispatched.map((d) => d.payload.locationName), lock).toEqual(['Question 02']);
    }
  });

  it('in loop mode the office counts only while the queue is parked on it for live play', () => {
    const env = inWorld();
    env.activeRegionId = 'The case';
    env.livePlay = { loopMode: true, region: null };
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, request);
    const solved = { story: 'custom-house-fire', questionId: 'q.door' };
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
    expect(env.dispatched).toEqual([]);
    env.livePlay = { loopMode: true, region: 'The street' };
    env.fire('loopState:manualEntered');
    env.livePlay = { loopMode: true, region: 'The case' };
    env.fire('loopState:manualEntered');
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, solved);
    env.livePlay = { loopMode: false, region: null };
    env.fire('gameState:loopModeChanged');
    expect(env.states().map((s) => s.inOffice)).toEqual([false, true]);
    expect(env.dispatched.map((d) => d.payload.locationName)).toEqual(['Question 02']);
  });

  it('every live-play event is listened to', () => {
    const env = inWorld();
    for (const event of LIVE_PLAY_EVENTS) expect(env.handlers.has(event), event).toBe(true);
  });

  it('papers and solved are read through the region\'s maps', () => {
    const env = inWorld();
    env.snapshot = { inventory: { "Dr. Hume's note": 1, 'A maze key': 1 }, checkedLocations: ['Question 03', 'A maze chest'] };
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, request);
    expect(env.states()[0]).toMatchObject({ papers: ['doctor'], solved: ['q.who'] });
  });

  it('another story than any case of the world is refused by name', () => {
    const env = inWorld();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: 'garden-room' });
    expect(env.refusals()).toEqual([MYSTERY_REFUSALS.OTHER_STORY]);
  });
});

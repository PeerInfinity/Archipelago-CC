import { describe, expect, it } from 'vitest';
import {
  MYSTERY_EVENTS, MYSTERY_REFUSALS, MysteryArchipelagoLogic, SOURCE_MODULE, gameKeyOf, mysteryBlockOf, mysteryStateOf,
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
  const env = { data, snapshot, published: [], dispatched: [], handlers: new Map() };
  const eventBus = {
    subscribe: (event, handler) => env.handlers.set(event, handler),
    publish: (event, payload) => env.published.push({ event, payload }),
  };
  const dispatcher = { publish: (event, payload, direction) => env.dispatched.push({ event, payload, direction }) };
  const logic = new MysteryArchipelagoLogic({
    eventBus, dispatcher, getStaticData: () => env.data, getSnapshot: () => env.snapshot,
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
    env.fire('game:connected', { slot: 3, team: 0 });
    env.fire('client:connectedStateApplied');
    env.fire('connection:close');
    env.fire('connection:close');
    expect(env.states().map((s) => [s.connected, s.game])).toEqual([
      [false, 'offline:777:1'], [true, '777:0:3'], [false, 'offline:777:1'],
    ]);
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

// The mystery page's bridge for an ActionNodes world (AN-MYST-1), against the committed The Same Monday preset's own
// slot_data: the papers held from the received items, `loop` from the world's loop runtime, and the goal ⚑ PENDING
// (superseded by Robert's 2026-11-26 ruling: page questions are the locations, q.who the goal; the world-side goal
// is AN-MYST-2) — until then a questionSolved checks nothing and is answered with nothing.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOOP_NUMBER_EVENTS, MYSTERY_EVENTS, MysteryArchipelagoLogic, mysteryBlockOf,
} from './mysteryArchipelagoLogic.js';
import { ACTION_NODES_STATE_EVENT } from '../actionNodes/actionNodesRuntime.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PRESET = 'frontend/presets/action_nodes_same_monday/AP_1/AP_1_rules.json';
const rules = JSON.parse(fs.readFileSync(path.join(REPO, PRESET), 'utf8'));
const staticData = { playerId: '1', seed_name: rules.seed_name, world: rules.world };
const block = rules.world['1'].slot_data.mystery;
const goalLocation = Object.values(rules.regions['1']).flatMap((r) => r.locations).find((l) => l.locked && !l.event).name;

function setup() {
  const env = {
    snapshot: { inventory: {}, checkedLocations: [] }, loop: 1, published: [], dispatched: [], handlers: new Map(),
  };
  const logic = new MysteryArchipelagoLogic({
    eventBus: {
      subscribe: (event, handler) => env.handlers.set(event, handler),
      publish: (event, payload) => env.published.push({ event, payload }),
    },
    dispatcher: { publish: (event, payload) => env.dispatched.push({ event, payload }) },
    getStaticData: () => staticData,
    getSnapshot: () => env.snapshot,
    getConnection: () => ({ connected: true, slot: 1, team: 0 }),
    getLoopNumber: () => env.loop,
  });
  logic.initialize();
  env.fire = (event, payload) => env.handlers.get(event)(payload);
  env.states = () => env.published.filter((p) => p.event === MYSTERY_EVENTS.STATE).map((p) => p.payload);
  return env;
}

describe('The Same Monday as a mystery world (its committed slot_data)', () => {
  it('parses as a slot-level case, so the panel frames the page for it', () => {
    const b = mysteryBlockOf(staticData);
    expect(b).not.toBeNull();
    expect(b.case).toBe(block.case);
    expect(b.regionId).toBeNull();
  });

  it('papers come from the received items by `items`, and `loop` is in every state', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: block.story, version: block.version });
    expect(env.states().at(-1)).toMatchObject({ story: block.story, version: block.version, papers: [], solved: [], loop: 1 });
    const [innItem] = Object.entries(block.items).find(([, paper]) => paper === 'inn');
    env.snapshot = { inventory: { [innItem]: 1 }, checkedLocations: [] };
    env.fire('stateManager:snapshotUpdated');
    expect(env.states().at(-1)).toMatchObject({ papers: ['inn'], loop: 1 });
    // A new loop: the runtime's own event resends with the new day.
    env.loop = 2;
    env.fire(ACTION_NODES_STATE_EVENT, { source: 'reset', loaded: true });
    expect(env.states().at(-1)).toMatchObject({ papers: ['inn'], loop: 2 });
    expect(env.states().every((s) => Number.isInteger(s.loop))).toBe(true);
  });

  it('a page of another version is refused', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: block.story, version: 'not-this-one' });
    expect(env.published.at(-1)).toMatchObject({ event: MYSTERY_EVENTS.REFUSED, payload: { reason: 'other-version' } });
  });

  it('a world not played in numbered loops sends no `loop`', () => {
    const env = setup();
    env.loop = null;
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: block.story });
    expect(env.states().at(-1)).not.toHaveProperty('loop');
  });

  it('the resend event is the ActionNodes runtime\'s own', () => {
    expect(LOOP_NUMBER_EVENTS).toContain(ACTION_NODES_STATE_EVENT);
  });

  it('⚑ PENDING goal: questionSolved → no dispatch, no state; the goal node checks the goal, and `solved` still lacks it', () => {
    const env = setup();
    env.fire(MYSTERY_EVENTS.REQUEST_STATE, { story: block.story, version: block.version });
    const before = env.published.length;
    env.fire(MYSTERY_EVENTS.QUESTION_SOLVED, { story: block.story, questionId: block.goal });
    expect(env.dispatched).toEqual([]);
    expect(env.published.length).toBe(before); // zero mystery:state (nor anything else) in reply: no echo loop
    expect(env.snapshot.checkedLocations).not.toContain(goalLocation);
    // Performing the goal node checks its location (the runtime's own check); the page is told nothing about it.
    env.snapshot = { ...env.snapshot, checkedLocations: [goalLocation] };
    env.fire('stateManager:snapshotUpdated');
    expect(env.states().at(-1).solved).toEqual([]);
    expect(env.states().at(-1).solved).not.toContain(block.goal);
  });
});

describe('a re-initialized bridge answers once', () => {
  it('initialize twice, or a second instance after dispose, leaves one subscriber per event', () => {
    const subs = new Map();
    const bus = {
      subscribe: (event, handler) => {
        subs.set(event, [...(subs.get(event) ?? []), handler]);
        return () => subs.set(event, subs.get(event).filter((h) => h !== handler));
      },
      publish: () => {},
    };
    const deps = { eventBus: bus, dispatcher: { publish: () => {} }, getStaticData: () => staticData,
      getSnapshot: () => ({}), getConnection: () => ({ connected: false }) };
    const first = new MysteryArchipelagoLogic(deps);
    first.initialize();
    first.initialize();
    expect(subs.get(MYSTERY_EVENTS.REQUEST_STATE)).toHaveLength(1);
    first.dispose();
    new MysteryArchipelagoLogic(deps).initialize();
    expect(subs.get(MYSTERY_EVENTS.REQUEST_STATE)).toHaveLength(1);
    expect(subs.get(MYSTERY_EVENTS.QUESTION_SOLVED)).toHaveLength(1);
  });
});

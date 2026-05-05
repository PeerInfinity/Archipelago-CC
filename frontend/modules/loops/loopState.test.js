import { describe, it, expect, beforeEach } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';

function makeBus() {
  const events = [];
  return {
    events,
    publish: (name, data) => events.push({ name, data }),
    subscribe: () => () => {},
  };
}

function makeStubStateManager() {
  return {
    getLatestStateSnapshot: () => ({ checkedLocations: [], inventory: {} }),
    getStaticData: () => ({ regions: new Map() }),
  };
}

/**
 * Wire a LoopState with a real GameState behind a flat API object,
 * matching how loops/index.js wires them at runtime.
 */
function makeWiredLoopState() {
  const bus = makeBus();
  const gs = new GameState(bus);
  const loopState = new LoopState();
  loopState.setDependencies({
    eventBus: bus,
    stateManager: makeStubStateManager(),
    dispatcher: null,
    gameState: {
      getState: () => gs,
      // The other API methods aren't exercised by these tests
    },
  });
  return { loopState, gs, bus };
}

describe('LoopState — mana/XP delegation to GameState', () => {
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWiredLoopState());
  });

  it('reads mana through getter and writes through setter', () => {
    expect(loopState.currentMana).toBe(100);
    loopState.currentMana = 42;
    expect(gs.getCurrentMana()).toBe(42);
    expect(loopState.currentMana).toBe(42);
  });

  it('reads/writes maxMana via accessor', () => {
    loopState.maxMana = 200;
    expect(gs.getMaxMana()).toBe(200);
    expect(loopState.maxMana).toBe(200);
  });

  it('writing currentMana directly does NOT auto-fire an event', () => {
    bus.events.length = 0;
    loopState.currentMana = 50; // silent setter
    expect(bus.events.find((e) => e.name === 'gameState:manaChanged')).toBeUndefined();
  });

  it('regionXP getter returns the gameState-owned Map', () => {
    loopState.addRegionXP('Forest', 10);
    expect(loopState.regionXP).toBe(gs.regionXP);
    expect(loopState.regionXP.get('Forest').xp).toBe(10);
  });

  it('regionXP setter accepts arrays and Maps', () => {
    loopState.regionXP = [['A', { level: 0, xp: 5, xpForNextLevel: 100 }]];
    expect(gs.regionXP.get('A').xp).toBe(5);

    loopState.regionXP = new Map([['B', { level: 1, xp: 0, xpForNextLevel: 120 }]]);
    expect(gs.regionXP.get('B').level).toBe(1);
  });

  it('addRegionXP delegates to gameState (so XP events fire from gameState)', () => {
    loopState.addRegionXP('Cave', 120);
    const xpEvents = bus.events.filter((e) => e.name === 'gameState:xpChanged');
    expect(xpEvents.length).toBe(1);
    expect(loopState.getRegionXP('Cave').level).toBe(1);
  });

  it('manaDebt and noManaDepletionReset round-trip via accessors', () => {
    loopState.noManaDepletionReset = true;
    expect(gs.noManaDepletionReset).toBe(true);
    loopState.manaDebt = 17;
    expect(gs.manaDebt).toBe(17);
    expect(loopState.manaDebt).toBe(17);
  });

  it('serialize/deserialize round-trips through gameState', () => {
    loopState.currentMana = 50;
    loopState.addRegionXP('Region1', 30);
    const serialized = loopState.getSerializableState();
    expect(serialized.currentMana).toBe(50);
    expect(serialized.regionXP).toEqual([
      ['Region1', { level: 0, xp: 30, xpForNextLevel: 100 }],
    ]);

    const { loopState: ls2, gs: gs2 } = makeWiredLoopState();
    ls2.loadFromSerializedState(serialized);
    expect(gs2.getCurrentMana()).toBe(50);
    expect(gs2.getRegionXP('Region1').xp).toBe(30);
  });
});

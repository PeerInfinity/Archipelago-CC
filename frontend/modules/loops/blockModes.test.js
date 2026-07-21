/**
 * Tests for the per-block mode system (M1) — the Manual/Playback mode
 * map that replaces the per-region Manual checkbox. Mode is keyed per
 * (region, instanceNumber) visit; a region's two visits can differ.
 */
import {
  describe, it, expect, beforeEach, beforeAll, afterAll,
} from 'vitest';
import {
  installRafShim, uninstallRafShim, makeTicker, makeStubStateManager,
} from './testHarness.js';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

function makeFunctionalBus() {
  const subs = new Map();
  const events = [];
  return {
    events,
    subscribe: (name, cb) => {
      if (!subs.has(name)) subs.set(name, []);
      subs.get(name).push(cb);
      return () => {
        const list = subs.get(name);
        const i = list ? list.indexOf(cb) : -1;
        if (i !== -1) list.splice(i, 1);
      };
    },
    unsubscribe: () => {},
    publish: (name, data) => {
      events.push({ name, data });
      (subs.get(name) ?? []).slice().forEach((cb) => cb(data));
    },
  };
}

function wire({ startRegion = 'Menu' } = {}) {
  const bus = makeFunctionalBus();
  const gs = new GameState(bus);
  const loopState = new LoopState();
  loopState.setDependencies({
    eventBus: bus,
    stateManager: makeStubStateManager(),
    dispatcher: { publish: () => {}, publishToNextModule: () => {} },
    gameState: {
      getState: () => gs,
      getPath: () => gs.getPath(),
      getCurrentRegion: () => gs.getCurrentRegion(),
      getCurrentMana: () => gs.getCurrentMana(),
      getMaxMana: () => gs.getMaxMana(),
      refillMana: () => gs.refillMana(),
    },
  });
  gs.setStartRegions([startRegion]);
  gs.setCurrentRegion(startRegion);
  return { loopState, gs, bus };
}

// Register a manual-capable substrate for `manualRegion` and leave
// everything else AP-native (getRegionInfo → null).
function registerManualSubstrate() {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  substrateRegistry.register?.({
    id: 'test_substrate',
    label: 'Test',
    panelComponentType: 'testSubstratePanel',
    loadRegionEvent: 'test:loadRegion',
    loopSupport: { queueActions: ['regionMove', 'locationCheck'], manual: true, customQueues: false },
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => {
    if (region === 'A' || region === 'manualRegion') {
      return { substrate: 'test_substrate', label: 'Test', manaEnabled: true };
    }
    return null;
  });
}

describe('per-block mode — storage & precedence', () => {
  let loopState;
  beforeEach(() => {
    ({ loopState } = wire());
    registerManualSubstrate();
  });

  it('defaults to defaultBlockMode (playback) when nothing stored', () => {
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
  });

  it('stores an explicit mode per (region, instance)', () => {
    loopState.setBlockMode('A', 1, 'manual');
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
    // A different visit is independent.
    expect(loopState.getBlockMode('A', 2)).toBe('playback');
  });

  it('two visits to one region can diverge', () => {
    loopState.setBlockMode('A', 1, 'manual');
    loopState.setBlockMode('A', 2, 'playback');
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
    expect(loopState.getBlockMode('A', 2)).toBe('playback');
  });

  it('legacy manualRegionStates makes every visit of that region manual', () => {
    loopState.setManualRegion('A', true);
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
    expect(loopState.getBlockMode('A', 2)).toBe('manual');
  });

  it('an explicit per-block mode overrides the legacy region fallback', () => {
    loopState.setManualRegion('A', true);
    loopState.setBlockMode('A', 1, 'playback');
    expect(loopState.getBlockMode('A', 1)).toBe('playback'); // explicit wins
    expect(loopState.getBlockMode('A', 2)).toBe('manual');   // still legacy
  });

  it('a default of manual is capability-clamped for non-manual regions', () => {
    loopState.defaultBlockMode = 'manual';
    // A supports manual → manual.
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
    // AP-native region (no substrate) → clamped to playback.
    expect(loopState.getBlockMode('APNative', 1)).toBe('playback');
  });
});

describe('per-block mode — serialization & migration', () => {
  it('blockModeStates round-trips through serialization', () => {
    const { loopState } = wire();
    loopState.setBlockMode('A', 1, 'manual');
    loopState.setBlockMode('A', 2, 'playback');
    const state = loopState.getSerializableState();
    expect(state.blockModeStates).toEqual([['A#1', 'manual'], ['A#2', 'playback']]);

    const fresh = wire().loopState;
    fresh.loadFromSerializedState(state);
    expect(fresh.getBlockMode('A', 1)).toBe('manual');
    expect(fresh.getBlockMode('A', 2)).toBe('playback');
  });

  it('migrates an old save with only manualRegionStates', () => {
    // Simulate a pre-mode-system save: manualRegionStates present, no
    // blockModeStates field at all.
    const fresh = wire().loopState;
    fresh.loadFromSerializedState({ manualRegionStates: [['A', true]] });
    expect(fresh.getBlockMode('A', 1)).toBe('manual');
    expect(fresh.getBlockMode('A', 5)).toBe('manual');
    // A different region is unaffected.
    expect(fresh.getBlockMode('B', 1)).toBe('playback');
  });

  it('resetForNewRules clears per-block modes', () => {
    const { loopState } = wire();
    loopState.setBlockMode('A', 1, 'manual');
    loopState.resetForNewRules();
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
  });
});

describe('per-block mode — setAllBlockModes', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = wire());
    registerManualSubstrate();
  });

  it('applies manual only to blocks whose substrate supports it', () => {
    // Menu (AP-native) → A (manual-capable) → APNative (AP-native).
    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('APNative', 'go', 'A');
    const changed = loopState.setAllBlockModes('manual');
    // Only A#1 is manual-capable.
    expect(changed).toBe(1);
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
    expect(loopState.getBlockMode('Menu', 1)).toBe('playback');   // unsupported, untouched
    expect(loopState.getBlockMode('APNative', 1)).toBe('playback');
  });

  it('applies playback to every block that offers it', () => {
    gs.updatePath('A', 'go', 'Menu');
    loopState.setBlockMode('A', 1, 'manual');
    const changed = loopState.setAllBlockModes('playback');
    // A offers playback; Menu/AP-native don't.
    expect(changed).toBe(1);
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
  });
});

describe('per-block mode — execution parks the right visit', () => {
  let loopState, gs, bus, tick;
  beforeEach(() => {
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    registerManualSubstrate();
  });

  it('parks on a manual visit but runs a playback visit of the same region', () => {
    // Menu → A (manual) → B → A (playback). A#1 manual, A#2 playback.
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    gs.updatePath('A', 'back', 'B');
    gs.addLocationCheck('Loc2', 'A');
    loopState.setBlockMode('A', 1, 'manual');
    loopState.setBlockMode('A', 2, 'playback');

    // Cursor on A#1's locationCheck (index 1) → manual → parks.
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
    expect(loopState._manualActionEntered).toBe(true);
    expect(loopState._manualRegionName).toBe('A');
    expect(loopState.isProcessing).toBe(false);
  });

  it('customQueue playback suppresses panel activation when focus is locked', () => {
    // Register a substrate panel for cqRegion + a loops.isFocusLocked.
    try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
    try { centralRegistry.publicFunctions.get('loops')?.delete('isFocusLocked'); } catch { /* ignore */ }
    try { substrateRegistry.clear?.(); } catch { /* ignore */ }
    substrateRegistry.register?.({
      id: 'cq_sub', label: 'CQ', panelComponentType: 'cqPanel', loadRegionEvent: 'cq:load',
    });
    centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (r) => (
      r === 'cqRegion' ? { substrate: 'cq_sub', label: 'CQ' } : null
    ));
    let locked = true;
    centralRegistry.registerPublicFunction('loops', 'isFocusLocked', () => locked);

    gs.updatePath('cqRegion', 'go', 'Menu');
    gs.addCustomQueueAction('cqRegion', { recordedAt: 1 }, 'q');
    gs.updatePath('after', 'n', 'cqRegion');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;

    const activated = [];
    bus.subscribe('ui:activatePanel', (d) => activated.push(d));
    tick(loopState);
    // Focus locked → no panel activation, but the queue still parks.
    expect(activated).toEqual([]);
    expect(loopState._manualActionEntered).toBe(true);

    // Now unlock and re-run: activation is published.
    locked = false;
    loopState._manualActionEntered = false;
    loopState.isProcessing = true;
    tick(loopState);
    expect(activated).toContainEqual({ panelId: 'cqPanel' });
  });

  it('does NOT park on the A#2 (playback) visit', () => {
    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('B', 'exit', 'A');
    gs.updatePath('A', 'back', 'B');
    gs.addLocationCheck('Loc2', 'A');
    loopState.setBlockMode('A', 1, 'manual');
    loopState.setBlockMode('A', 2, 'playback');

    // Cursor on A#2's locationCheck. Find its index.
    const queue = loopState.getActionQueue();
    const idx = queue.findIndex(
      (e) => e.type === 'locationCheck' && e.locationName === 'Loc2',
    );
    expect(idx).toBeGreaterThan(-1);
    loopState.currentActionIndex = idx;
    loopState.currentAction = queue[idx];
    // The current block (A#2) resolves to playback → not manual.
    expect(loopState._currentBlockIsManual()).toBe(false);
  });
});

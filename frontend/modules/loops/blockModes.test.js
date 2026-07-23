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
import {
  getSavedQueueByTag,
  saveQueue,
  _testOnly_clearAll as resetSavedQueueStore,
} from './savedQueueStore.js';
import { hashRulesData, clearRulesHashCache } from '../shared/rulesHash.js';

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

// Register a substrate that DECLARES instant (M3) for region 'A', plus a
// playback-but-not-instant substrate for region 'P'.
function registerInstantSubstrate() {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  substrateRegistry.register?.({
    id: 'instant_sub', label: 'Inst', panelComponentType: 'instPanel', loadRegionEvent: 'i:load',
    loopSupport: { queueActions: ['regionMove', 'locationCheck'], manual: true, playback: true, instant: true },
  });
  substrateRegistry.register?.({
    id: 'plain_sub', label: 'Plain', panelComponentType: 'plainPanel', loadRegionEvent: 'p:load',
    loopSupport: { queueActions: ['regionMove', 'locationCheck'], manual: true, playback: true },
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => {
    if (region === 'A') return { substrate: 'instant_sub', label: 'Inst', manaEnabled: true };
    if (region === 'P') return { substrate: 'plain_sub', label: 'Plain', manaEnabled: true };
    return null;
  });
}

describe('per-block Instant (M3) — storage, capability & set-all', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = wire());
    registerInstantSubstrate();
  });

  it('defaults to not-instant and stores a per-(region,instance) flag', () => {
    expect(loopState.getBlockInstant('A', 1)).toBe(false);
    loopState.setBlockInstant('A', 1, true);
    expect(loopState.getBlockInstant('A', 1)).toBe(true);
    // A different visit is independent.
    expect(loopState.getBlockInstant('A', 2)).toBe(false);
  });

  it('clearing a flag deletes the entry (only truthy flags are stored)', () => {
    loopState.setBlockInstant('A', 1, true);
    loopState.setBlockInstant('A', 1, false);
    expect(loopState.getBlockInstant('A', 1)).toBe(false);
    expect(loopState.getSerializableState().blockInstantStates).toEqual([]);
  });

  it('round-trips through serialization', () => {
    loopState.setBlockInstant('A', 1, true);
    loopState.setBlockInstant('A', 3, true);
    const state = loopState.getSerializableState();
    expect(state.blockInstantStates).toEqual([['A#1', true], ['A#3', true]]);
    const fresh = wire().loopState;
    fresh.loadFromSerializedState(state);
    expect(fresh.getBlockInstant('A', 1)).toBe(true);
    expect(fresh.getBlockInstant('A', 3)).toBe(true);
    expect(fresh.getBlockInstant('A', 2)).toBe(false);
  });

  it('an old save without blockInstantStates loads with no flags', () => {
    const fresh = wire().loopState;
    fresh.loadFromSerializedState({ blockModeStates: [['A#1', 'playback']] });
    expect(fresh.getBlockInstant('A', 1)).toBe(false);
  });

  it('resetForNewRules clears the instant flags', () => {
    loopState.setBlockInstant('A', 1, true);
    loopState.resetForNewRules();
    expect(loopState.getBlockInstant('A', 1)).toBe(false);
  });

  it('_regionSupportsInstant reflects the substrate declaration', () => {
    expect(loopState._regionSupportsInstant('A')).toBe(true);     // declares instant
    expect(loopState._regionSupportsInstant('P')).toBe(false);    // playback but no instant
    expect(loopState._regionSupportsInstant('APNative')).toBe(false); // no substrate
  });

  it('setAllBlockInstant applies only to instant-capable blocks', () => {
    // Menu (AP-native) → A (instant) → P (playback, no instant).
    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('P', 'go', 'A');
    const changed = loopState.setAllBlockInstant(true);
    expect(changed).toBe(1);
    expect(loopState.getBlockInstant('A', 1)).toBe(true);
    expect(loopState.getBlockInstant('P', 1)).toBe(false); // unsupported, untouched
    // Clearing again touches only the capable block.
    expect(loopState.setAllBlockInstant(false)).toBe(1);
    expect(loopState.getBlockInstant('A', 1)).toBe(false);
  });

  it('_currentBlockIsInstant resolves the running block', () => {
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    loopState.setBlockInstant('A', 1, true);
    const queue = loopState.getActionQueue();
    const idx = queue.findIndex((e) => e.type === 'locationCheck' && e.locationName === 'Loc1');
    loopState.currentActionIndex = idx;
    loopState.currentAction = queue[idx];
    expect(loopState._currentBlockIsInstant()).toBe(true);
    loopState.setBlockInstant('A', 1, false);
    expect(loopState._currentBlockIsInstant()).toBe(false);
  });

  it('the generic timer completes a nonzero-cost action in one frame when the block is Instant', () => {
    // A#1 owns an explore customAction (default cost ~50). With the GLOBAL
    // instantMode off, only the per-block Instant flag can drive the
    // single-frame completion — so this isolates the M3 seam.
    gs.updatePath('A', 'go', 'Menu');
    gs.addCustomAction('explore', { regionName: 'A' });
    gs.maxMana = 1000; gs.currentMana = 1000;
    loopState.instantMode = false;
    const queue = loopState.getActionQueue();
    const idx = queue.findIndex((e) => e.type === 'customAction');
    loopState.currentActionIndex = idx;
    loopState.currentAction = queue[idx];
    const pathIndex = loopState.currentAction.pathIndex;

    // Not instant yet → a 16ms frame makes only partial progress.
    loopState._advanceActionProgress(16);
    expect(loopState.actionQueueManager.getProgress(pathIndex)).toBeLessThan(100);

    // Flag the block Instant, reset progress → one frame completes it.
    loopState.actionQueueManager.setProgress(pathIndex, 0);
    loopState.setBlockInstant('A', 1, true);
    loopState._advanceActionProgress(16);
    expect(loopState.actionQueueManager.getProgress(pathIndex)).toBe(100);
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

// ---------------------------------------------------------------------------
// M2 — Record mode + playback-of-recordings (maze + textAdventure model).
// ---------------------------------------------------------------------------

const RULES_DATA = { regions: { 1: ['A'] } };

// Register a record/playback-capable substrate for region 'A' with a
// controllable recording stash and a replayActions spy. Returns handles.
function registerRecordSubstrate() {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  const handles = { stash: null, takeCalls: 0, replayCalls: [] };
  substrateRegistry.register?.({
    id: 'rec_sub',
    label: 'Rec',
    panelComponentType: 'recPanel',
    loadRegionEvent: 'rec:loadRegion',
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck'],
      manual: true, customQueues: false, record: true, playback: true,
    },
    takeLastRecording: () => {
      handles.takeCalls += 1;
      const s = handles.stash;
      handles.stash = null; // pull-and-clear, like the real sinks
      return s;
    },
    getPlaybackController: () => ({
      replayActions: (actions, opts) => { handles.replayCalls.push({ actions, opts }); return true; },
    }),
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    region === 'A' ? { substrate: 'rec_sub', label: 'Rec', manaEnabled: true } : null
  ));
  return handles;
}

function makeStash(overrides = {}) {
  return {
    regionName: 'A',
    substrate: 'rec_sub',
    arrivalExitId: 'IGNORED_recorder_value',
    departureExitId: 'exit',
    actions: [{ type: 'locationCheck', locationName: 'Loc1' }],
    manaAtEntry: 100, manaAtExit: 80, manaMin: 75,
    locationsChecked: ['Loc1'], itemsPickedUp: [],
    ...overrides,
  };
}

describe('M2 — Record lifecycle', () => {
  let loopState, gs, bus, tick, handles;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    handles = registerRecordSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    // Menu → A (record) → B.
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');
  });

  function parkOnRecordBlock() {
    // Cursor on A#1's locationCheck (index 1) → record parks like manual.
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  it('parks a Record block like Manual and flags it for capture', () => {
    parkOnRecordBlock();
    expect(loopState._manualActionEntered).toBe(true);
    expect(loopState._manualRegionName).toBe('A');
    expect(loopState._recordingBlock).toEqual({ region: 'A', instance: 1 });
    expect(loopState.isProcessing).toBe(false);
  });

  it('on a successful exit: persists under the queue-derived tag + auto-switches to Playback', () => {
    parkOnRecordBlock();
    handles.stash = makeStash();
    // Player leaves via the expected regionMove → B.
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });

    // Pulled the substrate stash exactly once.
    expect(handles.takeCalls).toBe(1);
    // Persisted under the loops-derived tag: arrivalKey = source exit name
    // 'go' (no warehouse), ordinal 0 — NOT the recorder's own arrivalExitId.
    const rulesHash = hashRulesData(RULES_DATA);
    const saved = getSavedQueueByTag(rulesHash, 'A', 'rec_sub', 'go', 0);
    expect(saved).toBeTruthy();
    expect(saved.arrivalExitId).toBe('go');
    expect(saved.ordinal).toBe(0);
    expect(saved.actions).toEqual([{ type: 'locationCheck', locationName: 'Loc1' }]);
    // Auto-switch (default ON) flipped the block to Playback + announced it.
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
    expect(bus.events.some((e) =>
      e.name === 'loopState:blockModeChanged' && e.data?.mode === 'playback')).toBe(true);
    expect(loopState._recordingBlock).toBeNull();
  });

  it('auto-switch OFF leaves the block in Record but still persists', () => {
    loopState.autoSwitchToPlaybackAfterRecord = false;
    parkOnRecordBlock();
    handles.stash = makeStash();
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeTruthy();
    expect(loopState.getBlockMode('A', 1)).toBe('record');
  });

  it('wrong exit DISCARDS the recording and pauses until reset', () => {
    parkOnRecordBlock();
    handles.stash = makeStash();
    // Player leaves toward the wrong region.
    loopState._handleManualWake_regionMove({ targetRegion: 'Wrong' });

    expect(loopState._queuePausedUntilReset).toBe(true);
    // Nothing persisted; the stash was drained (discarded), not kept.
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeNull();
    expect(handles.takeCalls).toBe(1); // drained
    expect(handles.stash).toBeNull();
    expect(loopState.getBlockMode('A', 1)).toBe('record'); // not switched
    expect(loopState._recordingBlock).toBeNull();
  });

  it('mana-out mid-record discards the recording on reset', () => {
    parkOnRecordBlock();
    handles.stash = makeStash();
    loopState._resetLoop();
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeNull();
    expect(handles.stash).toBeNull(); // drained
    expect(loopState._recordingBlock).toBeNull();
  });

  it('coarse replacement rewrites the block interior to the performed actions', () => {
    parkOnRecordBlock();
    // Player performed a DIFFERENT location than the queued Loc1.
    handles.stash = makeStash({
      actions: [{ type: 'locationCheck', locationName: 'LocPerformed' }],
      locationsChecked: ['LocPerformed'],
    });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });

    // The block's queued interior (Loc1) was replaced with the performed
    // action; the boundary regionMove survived untouched.
    const interior = gs.getPath()
      .filter((e) => e.sourceRegion === 'A' && e.instanceNumber === 1 && e.type === 'locationCheck')
      .map((e) => e.locationName);
    expect(interior).toEqual(['LocPerformed']);
    const aMoves = gs.getPath().filter((e) => e.type === 'regionMove' && e.sourceRegion === 'A');
    expect(aMoves).toHaveLength(1);
    // Cursor advanced past the whole segment.
    expect(loopState.currentAction).toBeNull();
  });

  it('coarse replacement survives the gameState:pathUpdated auto-resume path (no cursor reentrancy)', () => {
    // Faithful mimic of eventCoordinator._handlePathUpdated: auto-resume ONLY
    // when the queue is 'waiting'. Record the state each pathUpdated sees so
    // we can prove the finalizing block stays 'idle' — the reason the
    // interior mutation can't re-enter processing on the un-advanced cursor.
    const statesSeen = [];
    let reentrantResumes = 0;
    bus.subscribe('gameState:pathUpdated', () => {
      const state = loopState.getProcessingState();
      statesSeen.push(state);
      if (state === 'waiting'
          && loopState.getActionQueue().length > loopState.currentActionIndex) {
        reentrantResumes += 1;
        loopState.resumeProcessing();
      }
    });

    parkOnRecordBlock();
    handles.stash = makeStash({
      actions: [{ type: 'locationCheck', locationName: 'LocPerformed' }],
      locationsChecked: ['LocPerformed'],
    });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });

    // The interior mutation DID emit pathUpdated (probe is real)...
    expect(statesSeen.length).toBeGreaterThan(0);
    // ...but the finalizing block was never 'waiting', so auto-resume never
    // fired mid-mutation — no reentrancy corrupted the cursor.
    expect(statesSeen).not.toContain('waiting');
    expect(reentrantResumes).toBe(0);

    // End state is correct + intact: interior rewritten, block completed
    // once (not re-parked / re-replayed), auto-switched, persisted.
    const interior = gs.getPath()
      .filter((e) => e.sourceRegion === 'A' && e.instanceNumber === 1 && e.type === 'locationCheck')
      .map((e) => e.locationName);
    expect(interior).toEqual(['LocPerformed']);
    expect(handles.replayCalls).toHaveLength(0);
    expect(loopState.currentAction).toBeNull();
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeTruthy();
  });
});

// M3b (session 66b): free-walk authoring is RETIRED — the wake's unparked
// Record capture (_maybeCaptureUnparkedRecordExit) was removed with it.
// A wake with nothing parked is now a no-op:
describe('M3b — unparked wakes are inert (free-walk capture removed)', () => {
  it('leaving a Record-mode block with nothing parked captures nothing', () => {
    resetSavedQueueStore();
    clearRulesHashCache();
    const { loopState, gs } = wire();
    const handles = registerRecordSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');

    expect(loopState._manualActionEntered).toBeFalsy();
    handles.stash = makeStash();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });

    expect(handles.takeCalls).toBe(0);
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeNull();
    expect(loopState.getBlockMode('A', 1)).toBe('record');
  });
});

// Register a COARSE-ONLY record+playback substrate: no takeLastRecording,
// no replayActions — loops owns capture and the generic executor owns
// playback (the text-adventure shape after M3b).
function registerCoarseSubstrate({ regions = ['A'] } = {}) {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  substrateRegistry.register?.({
    id: 'coarse_sub',
    label: 'Coarse',
    panelComponentType: 'coarsePanel',
    loadRegionEvent: 'coarse:loadRegion',
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck', 'explore'],
      manual: true, customQueues: false, record: true, playback: true,
    },
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    regions.includes(region) ? { substrate: 'coarse_sub', label: 'Coarse', manaEnabled: true } : null
  ));
}

describe('M3b — strict action gate (evaluateActionGate)', () => {
  let loopState, gs;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs } = wire());
    registerCoarseSubstrate({ regions: ['A', 'A2'] });
    loopState._cachedRulesData = RULES_DATA;
    gs.setLoopModeActive(true);
  });

  const evalGate = (over = {}) => loopState.evaluateActionGate({
    kind: 'location', regionName: 'A', eventName: 'user:locationCheck', data: {}, ...over,
  });

  it('loop mode off → allowed (gate out of scope)', () => {
    gs.setLoopModeActive(false);
    expect(evalGate()).toMatchObject({ allowed: true, reason: 'loopModeOff' });
  });

  it('exemption matrix: fromLoop / fromReset / system:* / planning sources / delegation / bot', () => {
    expect(evalGate({ data: { fromLoop: true } }).reason).toBe('fromLoop');
    expect(evalGate({ data: { fromReset: true } }).reason).toBe('fromReset');
    expect(evalGate({ eventName: 'system:locationCheck' }).reason).toBe('systemEvent');
    expect(evalGate({ data: { source: 'regionGraph-addToPath' } }).reason).toBe('planningSource');
    expect(evalGate({ data: { source: 'loops-costGenerator' } }).reason).toBe('planningSource');
    expect(evalGate({ data: { source: 'procgenPlayer-start' } }).reason).toBe('planningSource');
    loopState._delegatedAction = { type: 'regionMove' };
    expect(evalGate().reason).toBe('queueExecution');
    loopState._delegatedAction = null;
    loopState._botExecutedAction = { type: 'locationCheck' };
    expect(evalGate().reason).toBe('queueExecution');
    loopState._botExecutedAction = null;
  });

  it('AP-native region → out of scope', () => {
    expect(evalGate({ regionName: 'B' })).toMatchObject({ allowed: true, reason: 'apNative' });
  });

  it('substrate without record+playback declarations → not yet gated (staged rollout)', () => {
    registerManualSubstrate(); // test_substrate declares manual only
    expect(evalGate({ regionName: 'A' })).toMatchObject({ allowed: true, reason: 'substrateNotGated' });
  });

  it('blocked states: empty queue / not started / completed / hard-pause / paused', () => {
    expect(evalGate()).toMatchObject({ allowed: false, reason: 'emptyQueue' });

    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('B', 'exit', 'A');
    expect(evalGate()).toMatchObject({ allowed: false, reason: 'notStarted' });

    loopState._queueCompleted = true;
    expect(evalGate()).toMatchObject({ allowed: false, reason: 'queueCompleted' });
    loopState._queueCompleted = false;

    loopState._queuePausedUntilReset = true;
    expect(evalGate()).toMatchObject({ allowed: false, reason: 'hardPause' });
    loopState._queuePausedUntilReset = false;

    loopState.isPaused = true;
    expect(evalGate()).toMatchObject({ allowed: false, reason: 'paused' });
    loopState.isPaused = false;
  });

  function parkOn(mode) {
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, mode);
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState._manualActionEntered = true;
    loopState._manualRegionName = 'A';
  }

  it('parked Manual live play in the matching region → allowed', () => {
    parkOn('manual');
    expect(evalGate()).toMatchObject({ allowed: true, reason: 'parkedLivePlay' });
    expect(loopState.livePlayRegion()).toBe('A');
  });

  it('parked Record live play in the matching region → allowed', () => {
    parkOn('record');
    expect(evalGate()).toMatchObject({ allowed: true, reason: 'parkedLivePlay' });
  });

  it('parked live play, action in a DIFFERENT gated region → blocked wrongRegion', () => {
    parkOn('manual');
    expect(evalGate({ regionName: 'A2' }))
      .toMatchObject({ allowed: false, reason: 'wrongRegion', expectedRegion: 'A' });
  });

  it('a parked Playback block is NOT live play', () => {
    parkOn('playback');
    expect(loopState.livePlayRegion()).toBeNull();
    expect(evalGate().allowed).toBe(false);
  });

  it("a move without a sourceRegion falls back to the player's current region", () => {
    gs.setCurrentRegion('A');
    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('B', 'exit', 'A');
    const verdict = loopState.evaluateActionGate({
      kind: 'move', regionName: null, data: { exitName: 'east' },
    });
    expect(verdict).toMatchObject({ allowed: false, reason: 'notStarted' });
  });

  it('a move WITHOUT an exitName is a synthetic reposition — exempt', () => {
    // Test harnesses / debug tooling reposition the player with bare
    // user:regionMove publishes (exitName: null); every real substrate
    // exit-crossing carries its exit. Not player-performed → not gated.
    gs.setCurrentRegion('A');
    gs.updatePath('A', 'go', 'Menu');
    gs.updatePath('B', 'exit', 'A');
    const verdict = loopState.evaluateActionGate({
      kind: 'move', regionName: 'A', data: { exitName: null },
    });
    expect(verdict).toMatchObject({ allowed: true, reason: 'syntheticMove' });
  });
});

describe('M3b — loops-owned coarse capture + live-play economy', () => {
  let loopState, gs, bus, tick;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    registerCoarseSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    gs.setLoopModeActive(true);
    gs.maxMana = 1000;
    gs.currentMana = 1000;
    // Menu → A → B with one planned interior check.
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Planned', 'A');
    gs.updatePath('B', 'exit', 'A');
  });

  function park(mode) {
    loopState.setBlockMode('A', 1, mode);
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  it('Record: observed live actions are charged AND buffered; exit rewrites the interior + auto-switches; no store write', () => {
    park('record');
    expect(loopState._recordingBlock).toEqual({ region: 'A', instance: 1 });

    const before = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Performed', regionName: 'A' });
    // Fallback locationCheck cost: exactly 100 at level 0.
    expect(before - gs.getCurrentMana()).toBe(100);
    const afterCheck = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'explore', regionName: 'A' });
    // Fallback explore (customAction) cost: 50, discounted by the XP the
    // first charge awarded (xp-adjusted costs — same economy as the
    // executor).
    const exploreCharge = afterCheck - gs.getCurrentMana();
    expect(exploreCharge).toBeGreaterThan(0);
    expect(exploreCharge).toBeLessThanOrEqual(50);
    // XP awarded 1:1 with the charge (same economy as the executor).
    expect(gs.getRegionXP('A').xp).toBeGreaterThan(0);
    expect(loopState._liveCaptureBuffer).toEqual([
      { type: 'locationCheck', locationName: 'Performed' },
      { type: 'explore', regionName: 'A' },
    ]);

    const manaBeforeExit = gs.getCurrentMana();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    // The departing move was charged on the wake (fallback regionMove 50,
    // XP-discounted by the XP the observed actions accrued).
    expect(gs.getCurrentMana()).toBeLessThan(manaBeforeExit);

    // Interior rewritten to the observed actions (boundary moves intact).
    const interior = gs.getPath().filter((e) => e.sourceRegion === 'A' && e.type !== 'regionMove');
    expect(interior.map((e) => e.type === 'locationCheck' ? e.locationName : e.actionName))
      .toEqual(['Performed', 'explore']);
    expect(gs.getPath().filter((e) => e.type === 'regionMove' && e.sourceRegion === 'A')).toHaveLength(1);
    // Auto-switched; buffer cleared; NOTHING persisted to savedQueueStore.
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
    expect(loopState._liveCaptureBuffer).toEqual([]);
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'coarse_sub', 'go', 0)).toBeNull();
    // The auto-switch refresh carried an iterable queue payload.
    const qu = bus.events.filter((e) => e.name === 'loopState:queueUpdated');
    expect(qu.length).toBeGreaterThan(0);
    expect(qu.every((e) => Array.isArray(e.data?.queue))).toBe(true);
  });

  it('Manual: observed live actions are charged but captured NOWHERE; exit leaves the interior untouched', () => {
    park('manual');
    const before = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Performed', regionName: 'A' });
    expect(before - gs.getCurrentMana()).toBe(100);
    expect(loopState._liveCaptureBuffer).toEqual([]);

    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    // The planned interior is still exactly what was authored.
    const interior = gs.getPath().filter((e) => e.sourceRegion === 'A' && e.type === 'locationCheck');
    expect(interior.map((e) => e.locationName)).toEqual(['Planned']);
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
  });

  it('wrong exit: the departing move is still charged, the capture is discarded, the queue hard-pauses', () => {
    park('record');
    loopState.observeParkedLiveAction({ type: 'explore', regionName: 'A' });
    expect(loopState._liveCaptureBuffer).toHaveLength(1);

    const before = gs.getCurrentMana();
    loopState._handleManualWake_regionMove({ targetRegion: 'Wrong', oldRegion: 'A' });
    expect(gs.getCurrentMana()).toBeLessThan(before);
    expect(loopState._queuePausedUntilReset).toBe(true);
    expect(loopState._liveCaptureBuffer).toEqual([]);
    expect(loopState._recordingBlock).toBeNull();
    expect(loopState.getBlockMode('A', 1)).toBe('record');
    const interior = gs.getPath().filter((e) => e.sourceRegion === 'A' && e.type === 'locationCheck');
    expect(interior.map((e) => e.locationName)).toEqual(['Planned']);
  });

  it('fromReset wake: no charge, no finalize — the reset flow owns queue state', () => {
    park('record');
    const before = gs.getCurrentMana();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', fromReset: true });
    expect(gs.getCurrentMana()).toBe(before);
    expect(loopState._manualActionEntered).toBe(true); // still parked
    expect(loopState.getBlockMode('A', 1)).toBe('record');
  });

  it('depletion mid-live-play triggers the loop reset and discards the capture', () => {
    park('record');
    loopState.observeParkedLiveAction({ type: 'explore', regionName: 'A' });
    gs.currentMana = 60; // next check (100) depletes
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Expensive', regionName: 'A' });
    // deductMana → manaChanged → _handleManualWake_mana → _resetLoop:
    // refilled, unparked, capture discarded.
    expect(gs.getCurrentMana()).toBe(gs.getMaxMana());
    expect(loopState._manualActionEntered).toBe(false);
    expect(loopState._recordingBlock).toBeNull();
    expect(loopState._liveCaptureBuffer).toEqual([]);
  });

  it('fine-grained substrates (with a recorder) are exempt from loops-side charging and buffering', () => {
    registerRecordSubstrate(); // rec_sub supplies takeLastRecording
    loopState.setBlockMode('A', 1, 'record');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);

    const before = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Performed', regionName: 'A' });
    expect(gs.getCurrentMana()).toBe(before);
    expect(loopState._liveCaptureBuffer).toEqual([]);
  });

  it('coarse-only Playback never consults the recording store (stale entries are ignored)', () => {
    // Seed a stale pre-M3b recording under the block's tag — a coarse-only
    // substrate must NOT bind it (there is no substrate replayActions to
    // hand it to; the generic executor runs the block interior instead).
    saveQueue(hashRulesData(RULES_DATA), {
      regionName: 'A', substrate: 'coarse_sub',
      arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
      actions: [{ type: 'locationCheck', locationName: 'Stale' }],
      manaAtEntry: 100, manaAtExit: 80, manaMin: 75,
      locationsChecked: ['Stale'], itemsPickedUp: [],
    });
    loopState.setBlockMode('A', 1, 'playback');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);

    // Not parked for replay — fell through to the generic executor path.
    expect(loopState._manualActionEntered).toBe(false);
  });
});

describe('M2 — Playback replays a bound recording', () => {
  let loopState, gs, bus, tick, handles;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    handles = registerRecordSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
  });

  it('a Playback block with a bound recording replays it (parks + dispatches replayActions)', () => {
    // Seed a recording under A#1's tag (arrivalKey 'go', ordinal 0).
    saveQueue(hashRulesData(RULES_DATA), {
      regionName: 'A', substrate: 'rec_sub',
      arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
      actions: [{ type: 'locationCheck', locationName: 'Loc1' }],
      manaAtEntry: 100, manaAtExit: 80, manaMin: 75,
      locationsChecked: ['Loc1'], itemsPickedUp: [],
    });
    loopState.setBlockMode('A', 1, 'playback');

    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);

    // Parked and replayed the recorded script.
    expect(loopState._manualActionEntered).toBe(true);
    expect(handles.replayCalls).toHaveLength(1);
    expect(handles.replayCalls[0].actions).toEqual([{ type: 'locationCheck', locationName: 'Loc1' }]);
  });

  it('a Playback block with NO bound recording does not replay (falls through)', () => {
    loopState.setBlockMode('A', 1, 'playback');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
    expect(handles.replayCalls).toHaveLength(0);
  });
});

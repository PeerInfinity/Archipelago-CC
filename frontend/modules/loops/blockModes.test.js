/**
 * Tests for the per-block mode system (M1) — the Manual/Playback mode
 * map that replaces the per-region Manual checkbox. Mode is keyed per
 * (region, instanceNumber) visit; a region's two visits can differ.
 */
import {
  describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi,
} from 'vitest';
import {
  installRafShim, uninstallRafShim, makeTicker, makeStubStateManager,
} from './testHarness.js';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
  getSavedQueues,
  getSavedQueueByTag,
  saveQueue,
  hasPlayableRecording,
  _testOnly_clearAll as resetSavedQueueStore,
} from './savedQueueStore.js';
import { hashRulesData, clearRulesHashCache } from '../shared/rulesHash.js';
import { annotationsAreEmpty } from './blockAnnotations.js';
import { CostDataManager } from './costDataManager.js';

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

  it('defaults to defaultBlockMode — RECORD (M4), clamped where unsupported', () => {
    // test_substrate declares manual but NOT record/playback, so the M4
    // Record default falls back to MANUAL (user ruling: the point of the
    // default is "live-play each block once", and Manual is the live-play
    // mode) — not to Playback.
    expect(loopState.defaultBlockMode).toBe('record');
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
    // An AP-native region can't park at all → the second clamp applies.
    expect(loopState.getBlockMode('APNative', 1)).toBe('playback');
  });

  it('a Record default is honoured where the substrate declares record+playback', () => {
    registerRecordSubstrate(); // rec_sub declares record + playback for 'A'
    expect(loopState.getBlockMode('A', 1)).toBe('record');
  });

  it('stores an explicit mode per (region, instance)', () => {
    loopState.setBlockMode('A', 1, 'playback');
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
    // A different visit is independent — it still resolves from the default.
    expect(loopState.getBlockMode('A', 2)).toBe('manual');
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
    loopState.defaultBlockMode = 'playback';
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
    // Auto-switched; buffer cleared; no ACTIONS persisted to
    // savedQueueStore. M4 stores an annotations-only envelope there
    // (actions: []), which never reads as a playable recording — the M3b
    // invariant "coarse Playback never reads actions from the store" is
    // what matters, not the absence of a row.
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
    expect(loopState._liveCaptureBuffer).toEqual([]);
    const coarseEntry = getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'coarse_sub', 'go', 0);
    expect(coarseEntry?.actions).toEqual([]);
    expect(hasPlayableRecording(coarseEntry)).toBe(false);
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

  it('ONE ECONOMY: live-playing a block costs exactly what the generic executor charges to replay it', () => {
    // Ruling 2's core claim: live play, Record, and Playback share one
    // economy — recording a block costs what replaying it costs. Charge
    // the same interior (check + explore) + departure twice:
    //   run A — parked live play (observation layer + regionMove wake);
    //   run B — the generic executor over the same authored block
    //           (instantMode so each action charges once at its
    //           start-of-action XP level, like the live path).
    // XP awards (1:1 with the charge) discount later actions in BOTH
    // runs, in the same order — the totals must match exactly.

    // Run A: live play. Queue already authored in beforeEach
    // (Menu→A, check 'Planned', A→B); park Record and perform.
    park('record');
    const liveStart = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Planned', regionName: 'A' });
    loopState.observeParkedLiveAction({ type: 'explore', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    const liveTotal = liveStart - gs.getCurrentMana();
    expect(liveTotal).toBeGreaterThan(0);

    // Run B: a fresh world, identical block, generic executor.
    const fresh = wire();
    registerCoarseSubstrate();
    fresh.loopState._cachedRulesData = RULES_DATA;
    // Run B is the AUTO path by construction, so pin Playback rather than
    // inheriting M4's Record default (which would park the block).
    fresh.loopState.defaultBlockMode = 'playback';
    fresh.gs.setLoopModeActive(true);
    fresh.gs.maxMana = 1000;
    fresh.gs.currentMana = 1000;
    fresh.gs.updatePath('A', 'go', 'Menu');
    fresh.gs.addLocationCheck('Planned', 'A');
    fresh.gs.addCustomAction('explore', { regionName: 'A' });
    fresh.gs.updatePath('B', 'exit', 'A');
    fresh.loopState.setInstantMode(true);

    // Mana after the arrival move (Menu→A) completes = the baseline the
    // A-block charges are measured from.
    let manaAfterArrival = null;
    fresh.bus.subscribe('loopState:actionCompleted', ({ action }) => {
      if (manaAfterArrival === null && action?.type === 'regionMove' && action.destinationRegion === 'A') {
        manaAfterArrival = fresh.gs.getCurrentMana();
      }
    });

    const freshTick = makeTicker();
    fresh.loopState.startProcessing();
    for (let i = 0; i < 200 && !fresh.loopState._queueCompleted; i++) {
      freshTick(fresh.loopState);
    }
    expect(fresh.loopState._queueCompleted).toBe(true);
    expect(manaAfterArrival).not.toBeNull();
    const playbackTotal = manaAfterArrival - fresh.gs.getCurrentMana();

    // Live run A also captured a check into its interior — but the
    // authored interiors were identical (check + explore), so the
    // executor replays exactly what live play performed.
    expect(playbackTotal).toBeCloseTo(liveTotal, 10);
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

// ---------------------------------------------------------------------------
// Arc D slice 4b — the substrate-driven reset releases a stale park.
//
// `gameState:loopReset` is published only by `gameState.triggerLoopReset`,
// i.e. exclusively by resourceChannels' out-of-mana flow; loops' own reset is
// `_resetLoop` (which publishes `loopState:loopReset`). Until this slice the
// substrate seam ran `_resetActionsProgress()` alone, so a Manual / Record /
// Playback park survived a reset that had just teleported the player out of
// the parked region — with the frame loop STOPPED, since both park entries
// call stopProcessing(). Nothing re-dispatched, and a multi-run Playback
// replay hung forever.
//
// The in-app leg `omsi-multi-run-replay-retry` witnesses the park-flag and
// resume halves end to end. These pin the whole field set, including the two
// it cannot reach: `_boundReplayCheckedIndex` (the leg's queue passes through
// a manual wake on the way back, which clears it for other reasons) and
// `_queuePausedUntilReset`.
// ---------------------------------------------------------------------------

describe('slice 4b — a substrate-driven loop reset releases the park', () => {
  let loopState, gs, bus, tick, handles;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    handles = registerRecordSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    gs.setLoopModeActive(true);
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
  });

  /** Park A#1 in `mode` with the queue processing, as the frame loop would. */
  function park(mode) {
    loopState.setBlockMode('A', 1, mode);
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  function seedRecording() {
    saveQueue(hashRulesData(RULES_DATA), {
      regionName: 'A', substrate: 'rec_sub',
      arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
      actions: [{ type: 'locationCheck', locationName: 'Loc1' }],
    });
  }

  it('a Playback replay park is released, the cursor snaps to 0 and processing resumes', () => {
    seedRecording();
    park('playback');
    expect(loopState._manualActionEntered).toBe(true);
    expect(handles.replayCalls).toHaveLength(1);
    // The park stopped the frame loop — this is why _resumeFrameLoopIfProcessing
    // (the M6 bot cure, which bails on !isProcessing) would not have sufficed.
    expect(loopState.isProcessing).toBe(false);

    gs.triggerLoopReset();

    expect(loopState._manualActionEntered).toBe(false);
    expect(loopState._manualRegionName).toBeNull();
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);
  });

  it('the per-index replay guard is cleared, so the retry can re-dispatch replayActions', () => {
    seedRecording();
    park('playback');
    expect(loopState._boundReplayCheckedIndex).toBe(1);

    gs.triggerLoopReset();
    expect(loopState._boundReplayCheckedIndex).toBe(-1);

    // Re-entering the block replays AGAIN. Left stale, the guard would send a
    // Playback block down the bot/generic-executor path instead — a silent
    // crossing of an exit that was never replayed, which is worse than a hang.
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    tick(loopState);
    expect(handles.replayCalls).toHaveLength(2);
  });

  it('an in-flight Record capture is discarded, matching _resetLoop', () => {
    park('record');
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Performed', regionName: 'A' });
    expect(loopState._recordingBlock).toEqual({ region: 'A', instance: 1 });

    gs.triggerLoopReset();

    expect(loopState._recordingBlock).toBeNull();
    expect(loopState._liveCaptureBuffer).toEqual([]);
    // Nothing was persisted: the visit never crossed its exit.
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeNull();
  });

  it('the wrong-exit hard pause is lifted — its contract is "until the next loop reset"', () => {
    park('manual');
    loopState._handleManualWake_regionMove({ targetRegion: 'Elsewhere', oldRegion: 'A' });
    expect(loopState._queuePausedUntilReset).toBe(true);

    gs.triggerLoopReset();
    expect(loopState._queuePausedUntilReset).toBe(false);
    expect(loopState.isProcessing).toBe(true);
  });

  it('an UNPARKED queue is untouched — the release is a park release, not a start button', () => {
    expect(loopState._manualActionEntered).toBe(false);
    expect(loopState.isProcessing).toBe(false);
    gs.triggerLoopReset();
    expect(loopState.isProcessing).toBe(false);
  });

  it('a user PAUSE survives the release', () => {
    seedRecording();
    park('playback');
    loopState.isPaused = true;
    gs.triggerLoopReset();
    // The park is still released (it is stale either way), but resumeProcessing
    // declines while paused, so the reset cannot un-pause the player.
    expect(loopState._manualActionEntered).toBe(false);
    expect(loopState.isProcessing).toBe(false);
  });

  it('a Bot park is left to _handleBotWake_regionChanged (M6)', () => {
    loopState._botExecutedAction = { type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' };
    gs.triggerLoopReset();
    expect(loopState._botExecutedAction).toEqual({
      type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B',
    });
  });
});

// ---------------------------------------------------------------------------
// M4 slice 4 — queue annotations (item deltas + minima, XP), the universal
// savedQueueStore envelope.
// ---------------------------------------------------------------------------

describe('M4 — Record annotations (fine-grained)', () => {
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
    loopState.setBlockMode('A', 1, 'record');
  });

  function park() {
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  function savedEntry() {
    return getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0);
  }

  it('records item movement as DELTAS from block start, not absolutes', () => {
    // A pre-existing stock of 500 before the block must not appear anywhere:
    // the tracker is created empty at every park.
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'host', itemType: 'Food', count: 500 });
    park();
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'maze', itemType: 'Food', count: 3 });
    handles.stash = makeStash({ actions: [] });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });

    expect(savedEntry().annotations.items['rec_sub/Food']).toEqual({ net: 3, min: 0 });
  });

  it('counts CROSS-SUBSTRATE pool items, keyed by their owning substrate', () => {
    park();
    // A grant this block caused into ANOTHER substrate's pool still belongs
    // to the block's economy — it is keyed by its owner, not by us.
    bus.publish('crossSubstrate:itemGranted', { to: 'other_sub', from: 'rec_sub', itemType: 'Gem', count: 2 });
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'host', itemType: 'Gem', count: 1 });
    handles.stash = makeStash({ actions: [] });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });

    const { items } = savedEntry().annotations;
    expect(items['other_sub/Gem']).toEqual({ net: 2, min: 0 });
    expect(items['rec_sub/Gem']).toEqual({ net: 1, min: 0 });
  });

  it('folds the recording\'s item USES in as consumption, and the minimum is the trough', () => {
    park();
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'host', itemType: 'Food', count: 4 });
    handles.stash = makeStash({
      actions: [
        { actionType: 'clickTask', actionId: 7, label: 'Chop', loops: 2 },
        { actionType: 'useItem', actionId: 1, label: 'Food', loops: 6 },
      ],
    });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });

    // net = +4 granted − 6 used = −2. The minimum is the CONSERVATIVE
    // interleaving (every spend before any gain) = −6, so the UI's
    // "needs ≥6 at start" can only overstate, never understate.
    expect(savedEntry().annotations.items['rec_sub/Food']).toEqual({ net: -2, min: -6 });
  });

  it('a block that moved no economy stores no annotations object', () => {
    park();
    handles.stash = makeStash({ actions: [] });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });
    expect(savedEntry().annotations).toBeNull();
  });

  it('a DISCARDED recording takes its annotations with it', () => {
    park();
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'host', itemType: 'Food', count: 9 });
    handles.stash = makeStash();
    // Wrong exit → discard.
    loopState._handleManualWake_regionMove({ targetRegion: 'Wrong' });
    expect(savedEntry()).toBeNull();
    expect(loopState._annotationTracker).toBeNull();

    // The next Record of the same block starts from zero, not from 9.
    loopState._queuePausedUntilReset = false;
    park();
    handles.stash = makeStash({ actions: [] });
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'host', itemType: 'Food', count: 1 });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });
    expect(savedEntry().annotations.items['rec_sub/Food']).toEqual({ net: 1, min: 0 });
  });

  it('grants outside a Record block are ignored (no tracker, no leak)', () => {
    bus.publish('crossSubstrate:itemGranted', { to: 'rec_sub', from: 'host', itemType: 'Food', count: 7 });
    expect(loopState._annotationTracker).toBeNull();
    park();
    handles.stash = makeStash({ actions: [] });
    loopState._handleManualWake_regionMove({ targetRegion: 'B' });
    expect(savedEntry().annotations).toBeNull();
  });
});

describe('M4 — coarse substrates get an ACTIONS-LESS annotations entry', () => {
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
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Planned', 'A');
    gs.updatePath('B', 'exit', 'A');
  });

  function park() {
    loopState.setBlockMode('A', 1, 'record');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  function savedEntry() {
    return getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'coarse_sub', 'go', 0);
  }

  it('stores annotations with NO actions, and that entry never reads as playable', () => {
    park();
    bus.publish('crossSubstrate:itemGranted', { to: 'coarse_sub', from: 'host', itemType: 'Lamp', count: 1 });
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Performed', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });

    const entry = savedEntry();
    expect(entry).toBeTruthy();
    expect(entry.actions).toEqual([]);
    expect(entry.annotations.items['coarse_sub/Lamp']).toEqual({ net: 1, min: 0 });
    // XP is tracked (live-play charges award it) but never displayed.
    expect(entry.annotations.xp.net).toBeGreaterThan(0);
    // The M3b invariant: coarse Playback never reads actions from the store.
    expect(hasPlayableRecording(entry)).toBe(false);
    expect(loopState._lookupBoundRecording('A', 1)).toBeNull();
    // …but the annotations themselves are readable for the UI.
    expect(loopState.getBlockAnnotations('A', 1)).toEqual(entry.annotations);
  });

  it('re-recording the same coarse block REPLACES its annotations (not a no-op duplicate)', () => {
    park();
    bus.publish('crossSubstrate:itemGranted', { to: 'coarse_sub', from: 'host', itemType: 'Lamp', count: 1 });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    expect(savedEntry().annotations.items['coarse_sub/Lamp'].net).toBe(1);

    // Second visit of the same block: identical (empty) actions and null
    // departure, so only the annotations differ — the duplicate check must
    // notice, or the stale economy survives forever.
    park();
    bus.publish('crossSubstrate:itemGranted', { to: 'coarse_sub', from: 'host', itemType: 'Lamp', count: 5 });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    expect(savedEntry().annotations.items['coarse_sub/Lamp'].net).toBe(5);
    // Still exactly one entry for the tag — replace-on-tag, not append.
    expect(getSavedQueues(hashRulesData(RULES_DATA), 'A', 'coarse_sub')).toHaveLength(1);
  });

  it('a walk-through with no item movement still records its (undisplayed) XP', () => {
    // The departing move is itself charged live play, so every coarse
    // Record exit has SOME economy. What matters is that it carries no
    // item annotations to display.
    park();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    const entry = savedEntry();
    expect(entry.annotations.items).toEqual({});
    expect(entry.annotations.xp.net).toBeGreaterThan(0);
    expect(annotationsAreEmpty(entry.annotations)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// M5 slice 1 — the SUMMARY capture category (runner, bounce). A third shape
// beside coarse-only and fine-grained: the recording is the visit's NET
// RESULT, and Playback applies it instantly rather than replaying anything.
// This slice lands the shape resolver, the store guards, and the Playback
// dispatch branch; the drain, the capture and the instant apply follow.
// ---------------------------------------------------------------------------

// Register a SUMMARY substrate for region 'A' — record+playback+instant
// declared, NO takeLastRecording, and a playback controller shaped like the
// real runner/bounce PlaybackProxy: walkTo (the M6 bot path) but NO
// replayActions, by design.
function registerSummarySubstrate({ regions = ['A'] } = {}) {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  const handles = { walkToCalls: [] };
  substrateRegistry.register?.({
    id: 'sum_sub',
    label: 'Summary',
    panelComponentType: 'sumPanel',
    loadRegionEvent: 'sum:loadRegion',
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck'],
      executeVia: 'solver',
      manual: true, customQueues: false,
      record: true, playback: true, instant: true, summaryRecording: true,
    },
    getPlaybackController: () => ({
      walkTo: (...args) => { handles.walkToCalls.push(args); return true; },
    }),
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    regions.includes(region) ? { substrate: 'sum_sub', label: 'Summary', manaEnabled: true } : null
  ));
  return handles;
}

function makeSummaryEntry(overrides = {}) {
  return {
    regionName: 'A', substrate: 'sum_sub',
    arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
    actions: [],
    annotations: { items: {}, xp: { net: 12 } },
    summary: { durationSeconds: 4, checks: ['Loc1'], costedActions: [] },
    ...overrides,
  };
}

describe('M5 — capture shape resolution', () => {
  let loopState;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState } = wire());
  });

  it('resolves the three categories off the registry', () => {
    registerSummarySubstrate();
    expect(loopState.getRegionCaptureShape('A')).toBe('summary');
    // An AP-native region has no substrate at all → the coarse default,
    // which is what every non-declaring caller has always assumed.
    expect(loopState.getRegionCaptureShape('APNative')).toBe('coarse');

    registerCoarseSubstrate();
    expect(loopState.getRegionCaptureShape('A')).toBe('coarse');

    registerRecordSubstrate();
    expect(loopState.getRegionCaptureShape('A')).toBe('fine');
  });

  it('a summary substrate is NOT fine-grained (nothing may pull a fine stream from it)', () => {
    registerSummarySubstrate();
    expect(loopState.isFineGrainedRegion('A')).toBe(false);
    expect(loopState._substrateHasRecorder('sum_sub')).toBe(false);
  });

  it('a real recorder WINS over a summary declaration (the stronger contract)', () => {
    try { substrateRegistry.clear?.(); } catch { /* ignore */ }
    substrateRegistry.register?.({
      id: 'both_sub', label: 'Both', panelComponentType: 'p', loadRegionEvent: 'b:load',
      takeLastRecording: () => null,
      loopSupport: { manual: true, record: true, playback: true, summaryRecording: true },
    });
    centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo',
      () => ({ substrate: 'both_sub', label: 'Both' }));
    expect(loopState.getRegionCaptureShape('A')).toBe('fine');
  });

  it('summary substrates opt into the Record default and the strict action gate', () => {
    registerSummarySubstrate();
    // Declaring record+playback means the M4 Record default no longer clamps
    // to Manual for these blocks — fresh runner/bounce queues park in Record.
    expect(loopState.defaultBlockMode).toBe('record');
    expect(loopState.getBlockMode('A', 1)).toBe('record');
    // ...and the same declaration arms the strict action gate (staged
    // rollout: `record && playback`).
    expect(loopState._substrateGateEnforced('A')).toBe(true);
  });
});

describe('M5 — summary binding and Playback dispatch', () => {
  let loopState, gs, tick, handles;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs } = wire());
    tick = makeTicker();
    handles = registerSummarySubstrate();
    loopState._cachedRulesData = RULES_DATA;
    // Menu → A (summary) → B.
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
  });

  function parkCursorOnBlockInterior() {
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  it('binds a summary entry by tag — and never a fine recording', () => {
    expect(loopState.hasBoundSummary('A', 1)).toBe(false);

    saveQueue(hashRulesData(RULES_DATA), makeSummaryEntry());
    expect(loopState.hasBoundSummary('A', 1)).toBe(true);
    // The summary is actions-less, so the fine lookup must not see it.
    expect(loopState.hasBoundRecording('A', 1)).toBe(false);
  });

  it('a stale FINE recording under the same tag does not bind as a summary', () => {
    saveQueue(hashRulesData(RULES_DATA), {
      regionName: 'A', substrate: 'sum_sub',
      arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
      actions: [{ type: 'locationCheck', locationName: 'Stale' }],
      manaAtEntry: 100, manaAtExit: 80, manaMin: 75,
      locationsChecked: ['Stale'], itemsPickedUp: [],
    });
    expect(loopState.hasBoundSummary('A', 1)).toBe(false);
  });

  it('a Playback block with no bound summary parks for live play, never the bot', () => {
    loopState.setBlockMode('A', 1, 'playback');
    parkCursorOnBlockInterior();

    // Ruling 5: the walkTo/bot chain is unreachable from Playback until M6's
    // Bot radio re-homes it. The block parks for hand-play instead of
    // falling through to the generic executor's bot path.
    expect(loopState._manualActionEntered).toBe(true);
    expect(loopState._manualRegionName).toBe('A');
    expect(handles.walkToCalls).toHaveLength(0);
  });

  it('a COARSE block still falls through to the generic executor (no shape leakage)', () => {
    registerCoarseSubstrate();
    loopState.setBlockMode('A', 1, 'playback');
    parkCursorOnBlockInterior();
    expect(loopState._manualActionEntered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// M5 slice 2 — the live-play time drain and explicit-only per-action costs.
// A summary substrate's visit is priced by how long it takes; its actions
// cost mana only where the loop_costs data says so explicitly.
// ---------------------------------------------------------------------------

describe('M5 — the summary time drain', () => {
  let loopState, gs, tick;

  function costsFor(regionData = {}, locations = {}) {
    const cdm = new CostDataManager();
    cdm.setCostData({
      regions: { A: regionData },
      locations,
      defaultRegionCost: 50,
      defaultLocationCost: 100,
    }, 'test');
    return cdm;
  }

  function setUp({ regionData = {}, locations = {}, coarse = false } = {}) {
    ({ loopState, gs } = wire());
    tick = makeTicker();
    if (coarse) registerCoarseSubstrate(); else registerSummarySubstrate();
    loopState.setCostDataManager(costsFor(regionData, locations));
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');
    gs.setLoopModeActive(true);
  }

  function park() {
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    loopState?.stopTimeDrain();
    vi.useRealTimers();
  });

  it('drains the region rate once per second while parked, and counts the seconds', () => {
    setUp({ regionData: { timeDrainPerSecond: 3 } });
    park();
    const before = gs.getCurrentMana();

    vi.advanceTimersByTime(3000);

    expect(gs.getCurrentMana()).toBe(before - 9);
    // The tick count IS the visit's recorded duration (slice 3 persists it).
    expect(loopState._summaryDrainSeconds).toBe(3);
  });

  it('defaults to 1 mana per second when the sidecar names no rate', () => {
    setUp();
    park();
    const before = gs.getCurrentMana();
    vi.advanceTimersByTime(5000);
    expect(gs.getCurrentMana()).toBe(before - 5);
  });

  it('charges nothing unparked, paused, or hard-paused', () => {
    setUp({ regionData: { timeDrainPerSecond: 3 } });

    // Never parked at all.
    const idle = gs.getCurrentMana();
    vi.advanceTimersByTime(4000);
    expect(gs.getCurrentMana()).toBe(idle);

    park();
    loopState.isPaused = true;
    const paused = gs.getCurrentMana();
    vi.advanceTimersByTime(4000);
    expect(gs.getCurrentMana()).toBe(paused);
    loopState.isPaused = false;

    loopState._queuePausedUntilReset = true;
    const hardPaused = gs.getCurrentMana();
    vi.advanceTimersByTime(4000);
    expect(gs.getCurrentMana()).toBe(hardPaused);
    loopState._queuePausedUntilReset = false;

    // ...and it resumes once the queue is live again — proving the zeroes
    // above are a gated drain, not a dead timer.
    const resumed = gs.getCurrentMana();
    vi.advanceTimersByTime(2000);
    expect(gs.getCurrentMana()).toBe(resumed - 6);
  });

  it('charges nothing in a COARSE region (the drain is summary-only)', () => {
    setUp({ regionData: { timeDrainPerSecond: 3 }, coarse: true });
    park();
    const before = gs.getCurrentMana();
    vi.advanceTimersByTime(4000);
    expect(gs.getCurrentMana()).toBe(before);
  });

  it('runs only while loop mode is active', () => {
    setUp({ regionData: { timeDrainPerSecond: 3 } });
    park();
    gs.setLoopModeActive(false);
    const before = gs.getCurrentMana();
    vi.advanceTimersByTime(4000);
    expect(gs.getCurrentMana()).toBe(before);

    gs.setLoopModeActive(true);
    vi.advanceTimersByTime(1000);
    expect(gs.getCurrentMana()).toBe(before - 3);
  });

  it('is XP-scaled and awards region XP 1:1, like every other cost', () => {
    setUp({ regionData: { timeDrainPerSecond: 10 } });
    park();

    const before = gs.getCurrentMana();
    vi.advanceTimersByTime(1000);
    const firstCharge = before - gs.getCurrentMana();
    expect(firstCharge).toBe(10);
    // XP awarded equals the mana spent (the one economy).
    expect(loopState.getRegionXP('A').xp).toBeCloseTo(10, 10);

    // Enough XP to level the region reduces what a second of the same
    // region costs (xpEffect defaults to 'cost').
    loopState.addRegionXP('A', 100000);
    const beforeDiscounted = gs.getCurrentMana();
    vi.advanceTimersByTime(1000);
    expect(beforeDiscounted - gs.getCurrentMana()).toBeLessThan(firstCharge);
  });

  it('resets the counted duration at each park and on discard', () => {
    setUp({ regionData: { timeDrainPerSecond: 1 } });
    park();
    vi.advanceTimersByTime(2000);
    expect(loopState._summaryDrainSeconds).toBe(2);

    loopState._discardActiveRecording();
    expect(loopState._summaryDrainSeconds).toBe(0);
  });
});

describe('M5 — explicit-only per-action costs', () => {
  let loopState, gs, tick;

  function setUp(locations = {}, regionData = {}) {
    ({ loopState, gs } = wire());
    tick = makeTicker();
    registerSummarySubstrate();
    const cdm = new CostDataManager();
    cdm.setCostData({
      regions: { A: regionData },
      locations,
      defaultRegionCost: 50,
      defaultLocationCost: 100,
    }, 'test');
    loopState.setCostDataManager(cdm);
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');
    gs.setLoopModeActive(true);
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
  });

  it('a performed check is FREE unless the sidecar names its cost', () => {
    // The sidecar has a defaultLocationCost of 100 and says nothing about
    // Loc1 — for a summary substrate that means free, not 100.
    setUp();
    const before = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    expect(gs.getCurrentMana()).toBe(before);
    // ...but it is still CAPTURED: free does not mean invisible.
    expect(loopState._liveCaptureBuffer).toEqual([{ type: 'locationCheck', locationName: 'Loc1' }]);
  });

  it('an EXPLICIT per-action cost is charged (and XP-scaled)', () => {
    setUp({ Loc1: 40 });
    const before = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    expect(gs.getCurrentMana()).toBe(before - 40);
  });

  it('the departure move is free by default and charged when explicit', () => {
    setUp();
    const before = gs.getCurrentMana();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    expect(gs.getCurrentMana()).toBe(before);

    setUp({}, { moveCost: 25 });
    const beforeCosted = gs.getCurrentMana();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    expect(gs.getCurrentMana()).toBe(beforeCosted - 25);
  });

  it('a COARSE substrate still gets the sidecar defaults (no cross-contamination)', () => {
    ({ loopState, gs } = wire());
    tick = makeTicker();
    registerCoarseSubstrate();
    const cdm = new CostDataManager();
    // Well under max mana: a charge that empties the pool would trip the
    // depletion reset, which refills it and hides the deduction.
    cdm.setCostData({ regions: { A: {} }, locations: {}, defaultRegionCost: 50, defaultLocationCost: 40 }, 'test');
    loopState.setCostDataManager(cdm);
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');
    gs.setLoopModeActive(true);
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);

    const before = gs.getCurrentMana();
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    expect(gs.getCurrentMana()).toBe(before - 40);
  });
});

// ---------------------------------------------------------------------------
// M5 slice 3 — summary Record: capture the visit's net result, persist it on
// a successful exit, rewrite the interior, discard it otherwise.
// ---------------------------------------------------------------------------

describe('M5 — summary Record capture', () => {
  let loopState, gs, bus, tick;

  function setUp({ regionData = { timeDrainPerSecond: 2 }, locations = {} } = {}) {
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    registerSummarySubstrate();
    const cdm = new CostDataManager();
    cdm.setCostData({
      regions: { A: regionData }, locations,
      defaultRegionCost: 50, defaultLocationCost: 100,
    }, 'test');
    loopState.setCostDataManager(cdm);
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');
    gs.setLoopModeActive(true);
  }

  function park() {
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  const saved = () => getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'sum_sub', 'go', 0);

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    loopState?.stopTimeDrain();
    vi.useRealTimers();
  });

  it('persists duration, checks and the crossed departure on a successful exit', () => {
    setUp();
    park();
    vi.advanceTimersByTime(3000);
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });

    const entry = saved();
    expect(entry.summary).toEqual({
      durationSeconds: 3,
      checks: ['Loc1'],
      costedActions: [],
    });
    expect(entry.departureExitId).toBe('exit');
    // Actions stay EMPTY: a summary is not a replayable script.
    expect(entry.actions).toEqual([]);
    expect(hasPlayableRecording(entry)).toBe(false);
    expect(loopState.hasBoundSummary('A', 1)).toBe(true);
  });

  it('lists only EXPLICITLY costed actions, so Playback cannot double-charge', () => {
    setUp({ regionData: { timeDrainPerSecond: 1, moveCost: 5 }, locations: { Loc1: 7 } });
    park();
    vi.advanceTimersByTime(1000);
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });

    expect(saved().summary.costedActions).toEqual([
      { type: 'locationCheck', locationName: 'Loc1' },
      { type: 'regionMove' },
    ]);
  });

  it('records a free visit with an EMPTY costed list (the duration is the price)', () => {
    setUp();
    park();
    vi.advanceTimersByTime(2000);
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });

    expect(saved().summary.costedActions).toEqual([]);
    expect(saved().summary.durationSeconds).toBe(2);
  });

  it('falls back to the queued exit when the move carried no exit name', () => {
    setUp();
    park();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    expect(saved().departureExitId).toBe('exit');
  });

  it('rewrites the block interior to the performed checks (ruling 6)', () => {
    setUp();
    park();
    // The player checks a DIFFERENT location than the one queued.
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Other', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });

    const interior = gs.getPath()
      .filter((e) => e.type === 'locationCheck' && e.sourceRegion === 'A')
      .map((e) => e.locationName);
    expect(interior).toEqual(['Other']);
  });

  it('auto-switches the block to Playback after a successful Record', () => {
    setUp();
    park();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
  });

  it('records a zero-economy visit too — the duration alone is a recording', () => {
    // Unlike the coarse annotations envelope (which writes nothing when the
    // block moved no economy), a summary block always has something to say.
    setUp({ regionData: { timeDrainPerSecond: 0 } });
    park();
    vi.advanceTimersByTime(2000);
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });

    expect(saved().summary).toEqual({ durationSeconds: 2, checks: [], costedActions: [] });
  });

  it('discards everything on a WRONG exit', () => {
    setUp();
    park();
    vi.advanceTimersByTime(3000);
    loopState.observeParkedLiveAction({ type: 'locationCheck', locationName: 'Loc1', regionName: 'A' });
    loopState._handleManualWake_regionMove({ targetRegion: 'Elsewhere', oldRegion: 'A', exitName: 'other' });

    expect(saved()).toBeNull();
    expect(loopState._summaryDrainSeconds).toBe(0);
    expect(loopState._summaryCostedActions).toEqual([]);
    expect(loopState._queuePausedUntilReset).toBe(true);
  });

  it('a re-record with a different duration REPLACES the stale one', () => {
    // The isDuplicate trap: a summary entry is actions-less, so without the
    // summary field in the comparison the second recording would read as a
    // duplicate and the first duration would survive forever.
    setUp();
    park();
    vi.advanceTimersByTime(2000);
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });
    expect(saved().summary.durationSeconds).toBe(2);

    loopState.setBlockMode('A', 1, 'record');
    loopState.currentActionIndex = 0;
    loopState._manualActionEntered = false;
    loopState._boundReplayCheckedIndex = -1;
    park();
    vi.advanceTimersByTime(5000);
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', exitName: 'exit' });

    expect(saved().summary.durationSeconds).toBe(5);
    expect(getSavedQueues(hashRulesData(RULES_DATA), 'A', 'sum_sub')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// M5 slice 4 — instant-apply Playback: the recorded net result is applied
// directly, priced at the CURRENT XP level. The game replays nothing.
// ---------------------------------------------------------------------------

describe('M5 — instant-apply Playback', () => {
  let loopState, gs, bus, tick, handles, dispatched;

  function setUp({ regionData = { timeDrainPerSecond: 2 }, locations = {}, summary, maxMana } = {}) {
    ({ loopState, gs, bus } = wire());
    dispatched = [];
    loopState.dispatcher = {
      publish: (name, data, opts) => dispatched.push({ name, data, opts }),
      publishToNextModule: (mod, name, data, opts) => dispatched.push({ name, data, opts }),
    };
    tick = makeTicker();
    handles = registerSummarySubstrate();
    const cdm = new CostDataManager();
    cdm.setCostData({
      regions: { A: regionData }, locations,
      defaultRegionCost: 50, defaultLocationCost: 100,
    }, 'test');
    loopState.setCostDataManager(cdm);
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    if (maxMana !== undefined) { gs.maxMana = maxMana; gs.currentMana = maxMana; }
    gs.setLoopModeActive(true);
    if (summary) {
      saveQueue(hashRulesData(RULES_DATA), makeSummaryEntry({ summary }));
    }
    loopState.setBlockMode('A', 1, 'playback');
  }

  function run() {
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
  });

  it('prices the recorded duration at the CURRENT rate and spends it', () => {
    setUp({ summary: { durationSeconds: 4, checks: [], costedActions: [] } });
    const before = gs.getCurrentMana();
    run();
    // 4 recorded seconds × 2 mana/s = 8 — the envelope was used, not any
    // per-action default (which would have been 50 for the move alone).
    expect(before - gs.getCurrentMana()).toBe(8);
  });

  it('re-prices at the current XP level rather than replaying a frozen cost', () => {
    setUp({ regionData: { timeDrainPerSecond: 10 }, summary: { durationSeconds: 2, checks: [], costedActions: [] } });
    loopState.addRegionXP('A', 100000);
    const before = gs.getCurrentMana();
    run();
    const charged = before - gs.getCurrentMana();
    expect(charged).toBeGreaterThan(0);
    expect(charged).toBeLessThan(20); // the un-discounted price
  });

  it('adds the current price of each explicitly-costed recorded action', () => {
    setUp({
      regionData: { timeDrainPerSecond: 1, moveCost: 5 },
      locations: { Loc1: 7 },
      summary: {
        durationSeconds: 3,
        checks: ['Loc1'],
        costedActions: [{ type: 'locationCheck', locationName: 'Loc1' }, { type: 'regionMove' }],
      },
    });
    const before = gs.getCurrentMana();
    run();
    expect(before - gs.getCurrentMana()).toBe(3 + 7 + 5);
  });

  it('refires the recorded checks and crosses the departure, both fromLoop', () => {
    setUp({
      summary: { durationSeconds: 1, checks: ['Loc1', 'Loc2'], costedActions: [] },
    });
    run();

    const checks = dispatched.filter((e) => e.name === 'user:locationCheck');
    expect(checks.map((e) => e.data.locationName)).toEqual(['Loc1', 'Loc2']);
    expect(checks.every((e) => e.data.fromLoop === true && e.data.regionName === 'A')).toBe(true);

    const moves = dispatched.filter((e) => e.name === 'user:regionMove');
    expect(moves).toHaveLength(1);
    expect(moves[0].data).toMatchObject({
      sourceRegion: 'A', targetRegion: 'B', exitName: 'exit', fromLoop: true,
    });
    // Reaches procgenPlayer, which sits below loops in the chain.
    expect(moves[0].opts).toMatchObject({ initialTarget: 'bottom' });
  });

  it('the game replays NOTHING — no walkTo, no replayActions', () => {
    setUp({ summary: { durationSeconds: 1, checks: ['Loc1'], costedActions: [] } });
    // Prove the watcher is live before trusting its zero: the substrate's
    // controller must exist and expose the method we are counting.
    const controller = substrateRegistry.get('sum_sub').getPlaybackController();
    expect(typeof controller.walkTo).toBe('function');

    run();

    expect(handles.walkToCalls).toHaveLength(0);
    expect(controller.replayActions).toBeUndefined();
    // ...paired with a positive assertion, so the zero cannot be vacuous.
    expect(dispatched.filter((e) => e.name === 'user:locationCheck')).toHaveLength(1);
  });

  it('ABORTS the apply when the charge depletes mana (the ordering trap)', () => {
    // A recording that costs more than the pool holds: the deduction fires
    // the depletion reset synchronously, refilling mana and snapping the
    // queue to index 0. Nothing after the charge may run.
    setUp({
      regionData: { timeDrainPerSecond: 10 },
      summary: { durationSeconds: 50, checks: ['Loc1'], costedActions: [] },
      maxMana: 100,
    });
    run();

    expect(loopState._manualActionEntered).toBe(false);
    expect(dispatched.filter((e) => e.name === 'user:locationCheck')).toHaveLength(0);
    expect(dispatched.filter((e) => e.name === 'user:regionMove')).toHaveLength(0);
    // The reset refilled the pool and restarted the queue.
    expect(gs.getCurrentMana()).toBe(gs.getMaxMana());
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('a fine recording under the same tag does NOT instant-apply', () => {
    setUp();
    saveQueue(hashRulesData(RULES_DATA), {
      regionName: 'A', substrate: 'sum_sub',
      arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
      actions: [{ type: 'locationCheck', locationName: 'Stale' }],
      manaAtEntry: 100, manaAtExit: 80, manaMin: 75,
      locationsChecked: ['Stale'], itemsPickedUp: [],
    });
    const before = gs.getCurrentMana();
    run();
    // Parked for live play instead — no charge, no dispatches.
    expect(loopState._manualActionEntered).toBe(true);
    expect(gs.getCurrentMana()).toBe(before);
    expect(dispatched).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// M6 — the Bot radio and solver unification. Two solver mechanisms existed
// before this arc: the maze's substrate DELEGATION and the walkTo path
// (jta / runner / bounce). Neither had an explicit trigger — delegation fired
// from a pre-dispatch tick for any non-Manual block (shadowing Record and
// Playback on delegation-capable regions), and walkTo was an unconditional
// fall-through at the end of the frame dispatch. M6 gives both ONE trigger:
// a block set to 'bot'.
// ---------------------------------------------------------------------------

// A DELEGATION-capable fine-grained substrate, shaped like the real maze:
// a recorder (fine capture), sharing.mana.loopActionDelegation, and regions
// that carry manaEnabled. Delegation needs BOTH the declaration and the flag.
function registerDelegationSubstrate({ regions = ['A'], manaEnabled = true } = {}) {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  const handles = { stash: null, replayCalls: [], walkToCalls: [] };
  substrateRegistry.register?.({
    id: 'dele_sub',
    label: 'Delegation',
    panelComponentType: 'delePanel',
    loadRegionEvent: 'dele:loadRegion',
    sharing: { mana: { loopActionDelegation: true } },
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck'],
      manual: true, customQueues: false, record: true, playback: true,
    },
    takeLastRecording: () => { const s = handles.stash; handles.stash = null; return s; },
    // The maze's controller walkTo drives its VISUALIZER, not the charging
    // panel engine — delegation is its solver, and walkTo must stay unused.
    getPlaybackController: () => ({
      replayActions: (actions, opts) => { handles.replayCalls.push({ actions, opts }); return true; },
      walkTo: (target) => { handles.walkToCalls.push(target); return true; },
    }),
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    regions.includes(region) ? { substrate: 'dele_sub', label: 'Delegation', manaEnabled } : null
  ));
  return handles;
}

describe('M6 — regionSolver', () => {
  let loopState;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState } = wire());
  });

  it("resolves 'delegation' from the capability declaration PLUS manaEnabled", () => {
    registerDelegationSubstrate();
    expect(loopState.regionSolver('A')).toBe('delegation');
  });

  it('a delegation-capable substrate on a mana-less region has NO solver', () => {
    registerDelegationSubstrate({ manaEnabled: false });
    expect(loopState.regionSolver('A')).toBeNull();
    expect(loopState._regionSupportsBot('A')).toBe(false);
  });

  it("resolves 'walkTo' from executeVia: 'solver'", () => {
    registerSummarySubstrate();
    expect(loopState.regionSolver('A')).toBe('walkTo');
    expect(loopState._regionSupportsBot('A')).toBe(true);
  });

  it('a substrate with neither mechanism has no solver, and neither does an AP-native region', () => {
    registerCoarseSubstrate();
    expect(loopState.regionSolver('A')).toBeNull();
    expect(loopState.regionSolver('APNative')).toBeNull();
    expect(loopState.regionSolver(null)).toBeNull();
  });
});

describe('M6 — Bot is the ONLY trigger for delegation (the shadowing regression pin)', () => {
  let loopState, gs, bus, tick, handles;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    handles = registerDelegationSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
  });

  function runBlock(mode) {
    loopState.setBlockMode('A', 1, mode);
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
  }

  const beganEvents = () => bus.events.filter((e) => e.name === 'loops:substrateActionBegan');

  // The POSITIVE first, so the negatives below can't be vacuous: if the Bot
  // branch could not delegate at all, every "was not delegated" assertion
  // would pass for the wrong reason.
  it('a BOT block delegates: the action is parked and substrateActionBegan fires', () => {
    runBlock('bot');
    expect(loopState._delegatedAction).not.toBeNull();
    expect(beganEvents()).toHaveLength(1);
    expect(beganEvents()[0].data.action.locationName).toBe('Loc1');
    // Parked, not stopped, and no progress ticked.
    expect(loopState.isProcessing).toBe(true);
    expect(loopState._animationFrameId).toBeNull();
    // Delegation drives the panel engine — the visualizer's walkTo stays put.
    expect(handles.walkToCalls).toEqual([]);
  });

  it('a RECORD block parks for hand-play and is NEVER delegated', () => {
    runBlock('record');
    expect(loopState._delegatedAction).toBeNull();
    expect(beganEvents()).toEqual([]);
    expect(loopState._manualActionEntered).toBe(true);
    expect(loopState._manualRegionName).toBe('A');
    // ...and the Record capture actually armed, which the pre-M6 delegation
    // tick pre-empted before this branch ever ran.
    expect(loopState._recordingBlock).toEqual({ region: 'A', instance: 1 });
  });

  it('a PLAYBACK block replays its bound recording and is NEVER delegated', () => {
    saveQueue(hashRulesData(RULES_DATA), {
      regionName: 'A', substrate: 'dele_sub',
      arrivalExitId: 'go', ordinal: 0, departureExitId: 'exit',
      actions: [{ type: 'locationCheck', locationName: 'Loc1' }],
      manaAtEntry: 100, manaAtExit: 80, manaMin: 75,
      locationsChecked: ['Loc1'], itemsPickedUp: [],
    });
    runBlock('playback');
    expect(loopState._delegatedAction).toBeNull();
    expect(beganEvents()).toEqual([]);
    expect(handles.replayCalls).toHaveLength(1);
  });

  it('a MANUAL block parks and is NEVER delegated', () => {
    runBlock('manual');
    expect(loopState._delegatedAction).toBeNull();
    expect(beganEvents()).toEqual([]);
    expect(loopState._manualActionEntered).toBe(true);
  });
});

describe('M6 — the Bot branch dispatch matrix', () => {
  let loopState, gs, bus, tick;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    tick = makeTicker();
    loopState._cachedRulesData = RULES_DATA;
  });

  function seedQueue() {
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'bot');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
  }

  it("a walkTo-solver region dispatches walkTo and parks", () => {
    const handles = registerSummarySubstrate();
    seedQueue();
    tick(loopState);
    expect(handles.walkToCalls).toEqual([[{ kind: 'location', name: 'Loc1' }]]);
    expect(loopState._botExecutedAction).not.toBeNull();
    expect(loopState._delegatedAction).toBeNull();
  });

  it('a region with NO solver parks for live play and warns — never the generic timer', () => {
    // Ruling 2: a Bot block that cannot engage a solver must announce itself.
    // A silent fall-through to the timer would teleport the player through
    // content the bot was meant to play (the jtaQueueEngine lesson).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      registerCoarseSubstrate();
      seedQueue();
      tick(loopState);
      expect(loopState._botExecutedAction).toBeNull();
      expect(loopState._delegatedAction).toBeNull();
      expect(loopState._manualActionEntered).toBe(true);
      expect(loopState._manualRegionName).toBe('A');
      // The generic timer did NOT advance the action.
      expect(loopState.actionQueueManager.isCompleted(1)).toBe(false);
      expect(warn).toHaveBeenCalled();
      expect(warn.mock.calls.flat().join(' ')).toMatch(/no engageable solver/);
    } finally {
      warn.mockRestore();
    }
  });

  it('a Bot block records nothing (capture stays Record-gated)', () => {
    registerSummarySubstrate();
    seedQueue();
    tick(loopState);
    expect(loopState._recordingBlock).toBeNull();
  });

  it('livePlayRegion is null while a solver drives, but open during the fallback park', () => {
    // A bot is not live play — its events pass the gate on the queueExecution
    // exemption. The FALLBACK park is live play, though: the player has to
    // drive it by hand, so the gate must let them.
    const handles = registerSummarySubstrate();
    seedQueue();
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(1); // liveness: the bot really parked
    expect(loopState.livePlayRegion()).toBeNull();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      ({ loopState, gs, bus } = wire());
      tick = makeTicker();
      loopState._cachedRulesData = RULES_DATA;
      registerCoarseSubstrate();
      seedQueue();
      tick(loopState);
      expect(loopState.livePlayRegion()).toBe('A');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('M6 — Bot in the mode vocabulary', () => {
  let loopState, gs;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs } = wire());
    loopState._cachedRulesData = RULES_DATA;
  });

  it("set-all Bot applies only where a solver exists", () => {
    // A (walkTo solver) gets it; the AP-native block does not.
    registerSummarySubstrate({ regions: ['A'] });
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('APNative', 'exit', 'A');
    gs.addLocationCheck('Loc2', 'APNative');
    const changed = loopState.setAllBlockModes('bot');
    expect(changed).toBe(1);
    expect(loopState.getBlockMode('A', 1)).toBe('bot');
    expect(loopState.getBlockMode('APNative', 1)).not.toBe('bot');
  });

  it("Bot is NOT part of the defaultBlockMode enum (explicit per-block choice, v1)", () => {
    registerSummarySubstrate();
    expect(loopState.defaultBlockMode).toBe('record');
    expect(loopState.getBlockMode('A', 1)).toBe('record');
  });

  it("a 'bot' mode round-trips through serialization with no schema change", () => {
    loopState.setBlockMode('A', 1, 'bot');
    const state = loopState.getSerializableState();
    expect(state.blockModeStates).toEqual([['A#1', 'bot']]);
    const fresh = wire().loopState;
    fresh.loadFromSerializedState(state);
    expect(fresh.getBlockMode('A', 1)).toBe('bot');
  });
});

// ---------------------------------------------------------------------------
// M6 slice 3 — Bot economy. One economy by CAPTURE SHAPE: bot execution costs
// what live play of the same content costs. Fine substrates charge natively
// (the flat completion charge that predates them would double-bill); summary
// substrates are priced by TIME, so their drain runs while the bot plays and
// their actions cost only what the loop_costs data names explicitly.
//
// Sign conventions throughout: costs and drain rates are POSITIVE numbers that
// DEDUCT from the pool (mana goes down), and every spend awards region XP 1:1
// with the mana spent (_spendMana), so an XP rise of N pins a spend of N.
// ---------------------------------------------------------------------------

// A jta-shaped substrate: FINE capture (a real recorder) driven by the walkTo
// solver. This is the combination the flat completion charge double-billed —
// the substrate's own economy has already run by the time loops completes.
function registerFineSolverSubstrate({ regions = ['A'] } = {}) {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  const handles = { stash: null, walkToCalls: [], stopCalls: 0 };
  substrateRegistry.register?.({
    id: 'fine_solver_sub',
    label: 'FineSolver',
    panelComponentType: 'fsPanel',
    loadRegionEvent: 'fs:loadRegion',
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck'],
      executeVia: 'solver',
      manual: true, customQueues: false, record: true, playback: true, instant: true,
    },
    takeLastRecording: () => { const s = handles.stash; handles.stash = null; return s; },
    getPlaybackController: () => ({
      walkTo: (target) => { handles.walkToCalls.push(target); return true; },
      stop: () => { handles.stopCalls += 1; },
    }),
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    regions.includes(region) ? { substrate: 'fine_solver_sub', label: 'FineSolver', manaEnabled: true } : null
  ));
  return handles;
}

// A summary substrate with NO solver: same time-priced economy, but nothing
// for a Bot block to engage, so it takes the warn-and-park fallback.
function registerSummarySubstrateWithoutSolver({ regions = ['A'] } = {}) {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  const handles = { walkToCalls: [] };
  substrateRegistry.register?.({
    id: 'sum_nosolver_sub',
    label: 'SummaryNoSolver',
    panelComponentType: 'snsPanel',
    loadRegionEvent: 'sns:loadRegion',
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck'],
      manual: true, customQueues: false,
      record: true, playback: true, instant: true, summaryRecording: true,
    },
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    regions.includes(region)
      ? { substrate: 'sum_nosolver_sub', label: 'SummaryNoSolver', manaEnabled: true }
      : null
  ));
  return handles;
}

function botCosts({ regionData = {}, locations = {} } = {}) {
  const cdm = new CostDataManager();
  cdm.setCostData({
    regions: { A: regionData },
    locations,
    defaultRegionCost: 50,
    defaultLocationCost: 100,
  }, 'test');
  return cdm;
}

describe('M6 — Bot economy: the completion charge follows the capture shape', () => {
  let loopState, gs, tick;

  function setUp(register, costs) {
    ({ loopState, gs } = wire());
    tick = makeTicker();
    const handles = register();
    loopState.setCostDataManager(costs);
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'bot');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    tick(loopState);
    return handles;
  }

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
  });

  it('FINE: completing a bot action charges NOTHING — the substrate already did', () => {
    // The jta double-charge, pinned dead. loop_costs names a real 40 for
    // Loc1; a fine substrate must not be billed it on top of its native drain.
    const handles = setUp(registerFineSolverSubstrate, botCosts({ locations: { Loc1: 40 } }));
    expect(handles.walkToCalls).toHaveLength(1); // liveness: the bot really parked
    const manaBefore = gs.getCurrentMana();
    const xpBefore = loopState.getRegionXP('A').xp;

    loopState._handleBotWake_locationCheck('Loc1');

    // Completion really ran (else "no charge" would be vacuous)...
    expect(loopState._botExecutedAction).toBeNull();
    expect(loopState.actionQueueManager.isCompleted(1)).toBe(true);
    // ...and cost nothing, in either currency.
    expect(gs.getCurrentMana()).toBe(manaBefore);
    expect(loopState.getRegionXP('A').xp).toBe(xpBefore);
  });

  it('SUMMARY: completing charges the EXPLICIT cost only, and awards XP 1:1', () => {
    const handles = setUp(registerSummarySubstrate,
      botCosts({ regionData: { timeDrainPerSecond: 0 }, locations: { Loc1: 7 } }));
    expect(handles.walkToCalls).toHaveLength(1);
    const manaBefore = gs.getCurrentMana();
    const xpBefore = loopState.getRegionXP('A').xp;

    loopState._handleBotWake_locationCheck('Loc1');

    expect(loopState.actionQueueManager.isCompleted(1)).toBe(true);
    expect(gs.getCurrentMana()).toBe(manaBefore - 7);
    // XP 1:1 with the spend — the old direct deductMana awarded none.
    expect(loopState.getRegionXP('A').xp).toBe(xpBefore + 7);
  });

  it('SUMMARY with no explicit cost: the completion is FREE (the duration was the price)', () => {
    // Pins that the 50/100 generic fallbacks never reach a summary action.
    setUp(registerSummarySubstrate, botCosts({ regionData: { timeDrainPerSecond: 0 } }));
    const manaBefore = gs.getCurrentMana();

    loopState._handleBotWake_locationCheck('Loc1');

    expect(loopState.actionQueueManager.isCompleted(1)).toBe(true);
    expect(gs.getCurrentMana()).toBe(manaBefore);
  });
});

describe('M6 — Bot economy: the time drain matrix', () => {
  let loopState, gs, tick, handles;

  // Region rate 3/s, no explicit action costs: every mana delta below is
  // drain, and drain alone.
  function setUp({ register = registerSummarySubstrate, rate = 3, locations = {} } = {}) {
    ({ loopState, gs } = wire());
    tick = makeTicker();
    handles = register();
    loopState.setCostDataManager(botCosts({ regionData: { timeDrainPerSecond: rate }, locations }));
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    gs.setLoopModeActive(true);
    loopState.setBlockMode('A', 1, 'bot');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
  }

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    vi.useFakeTimers();
  });
  afterEach(() => {
    loopState?.stopTimeDrain();
    vi.useRealTimers();
  });

  it('PATH A — a solver driving a summary region drains at the region rate', () => {
    setUp();
    loopState.startTimeDrain();
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(1); // liveness: a bot really parked
    const before = gs.getCurrentMana();

    vi.advanceTimersByTime(3000);

    expect(gs.getCurrentMana()).toBe(before - 9);
    expect(loopState.getRegionXP('A').xp).toBeGreaterThan(0);
    // A bot is not live play, and it records nothing: the duration counter
    // is Record-capture state and stays owned by the live-play path.
    expect(loopState.livePlayRegion()).toBeNull();
    expect(loopState._summaryDrainSeconds).toBe(0);
  });

  it('PATH B — a Bot block with NO solver falls back to live play, which drains', () => {
    // No code path of its own: the fallback park IS live play, so the M5
    // live branch prices it. Its second counter runs but is inert — nothing
    // persists it, because a Bot block never arms a Record capture.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      setUp({ register: () => registerSummarySubstrateWithoutSolver() });
      loopState.startTimeDrain();
      tick(loopState);
      expect(loopState.livePlayRegion()).toBe('A');
      const before = gs.getCurrentMana();

      vi.advanceTimersByTime(2000);

      expect(gs.getCurrentMana()).toBe(before - 6);
      expect(loopState._summaryDrainSeconds).toBe(2);
      expect(loopState._recordingBlock).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it('the two paths can never both charge in one tick', () => {
    // They are mutually exclusive by construction — livePlayRegion() returns
    // null whenever a solver park is active — and this pins it: one tick
    // moves the pool by exactly one rate, never two.
    setUp();
    loopState.startTimeDrain();
    tick(loopState);
    expect(loopState._botExecutedAction).not.toBeNull();
    expect(loopState.livePlayRegion()).toBeNull();
    const before = gs.getCurrentMana();

    vi.advanceTimersByTime(1000);

    expect(gs.getCurrentMana()).toBe(before - 3);
  });

  it('FINE substrates are not drained by loops while a bot drives them', () => {
    // jta charges natively through the energy mirror; a loops-side drain on
    // top would be the same double-bill the completion charge used to be.
    setUp({ register: registerFineSolverSubstrate });
    loopState.startTimeDrain();
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(1);
    const before = gs.getCurrentMana();

    vi.advanceTimersByTime(5000);

    expect(gs.getCurrentMana()).toBe(before);
  });

  it('paused, hard-paused and stopped bot parks all cost nothing', () => {
    setUp();
    loopState.startTimeDrain();
    tick(loopState);

    loopState.isPaused = true;
    let before = gs.getCurrentMana();
    vi.advanceTimersByTime(2000);
    expect(gs.getCurrentMana()).toBe(before);

    loopState.isPaused = false;
    loopState._queuePausedUntilReset = true;
    before = gs.getCurrentMana();
    vi.advanceTimersByTime(2000);
    expect(gs.getCurrentMana()).toBe(before);

    loopState._queuePausedUntilReset = false;
    loopState.isProcessing = false;
    before = gs.getCurrentMana();
    vi.advanceTimersByTime(2000);
    expect(gs.getCurrentMana()).toBe(before);

    // Liveness: with the gates cleared the same clock DOES charge, so the
    // three zeros above are gating, not a dead drain.
    loopState.isProcessing = true;
    before = gs.getCurrentMana();
    vi.advanceTimersByTime(1000);
    expect(gs.getCurrentMana()).toBe(before - 3);
  });

  it('botSolverRegion reports the park livePlayRegion hides, in BOTH shapes', () => {
    // D2 slice 1: omsi gates its clock on the queue's park, and
    // livePlayRegion() is null while a solver drives — so without a separate
    // getter a Bot block would drive a FROZEN substrate. Unlike the drain
    // rule, the step gate is shape-independent: a fine substrate is not
    // loops-drained, but its clock still has to run.
    setUp();
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(1);   // liveness: a bot really parked
    expect(loopState.livePlayRegion()).toBeNull(); // the hole being filled
    expect(loopState.botSolverRegion()).toBe('A');

    setUp({ register: registerFineSolverSubstrate });
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(1);
    expect(loopState.botSolverRegion()).toBe('A');
  });

  it('botSolverRegion closes with the park — paused, hard-paused or stopped', () => {
    // The gate must shut again the moment the park goes dormant, or a paused
    // queue would leave the substrate free-running.
    setUp();
    tick(loopState);
    expect(loopState.botSolverRegion()).toBe('A');

    loopState.isPaused = true;
    expect(loopState.botSolverRegion()).toBeNull();
    loopState.isPaused = false;
    loopState._queuePausedUntilReset = true;
    expect(loopState.botSolverRegion()).toBeNull();
    loopState._queuePausedUntilReset = false;
    loopState.isProcessing = false;
    expect(loopState.botSolverRegion()).toBeNull();

    // Liveness: cleared, it reports again — the three nulls are gating, not
    // a getter that simply stopped answering.
    loopState.isProcessing = true;
    expect(loopState.botSolverRegion()).toBe('A');

    // And no park at all is null, whatever the queue is doing.
    loopState._botExecutedAction = null;
    expect(loopState.botSolverRegion()).toBeNull();
  });

  it('draining the pool dry mid-walk resets the loop and re-engages the bot', () => {
    // The production retry: a solver park runs no frames, so neither the
    // generic timer's OOM check nor the manual mana wake would ever notice
    // the depletion. The drain tick owns it. This is what makes a bot walk
    // that costs more than one pool completable at all — the jta zone case,
    // where skills compound across resets until one loop suffices.
    setUp({ rate: 40 });
    loopState.autoRestartQueue = true;
    loopState.startTimeDrain();
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(1);
    const max = gs.getMaxMana();

    vi.advanceTimersByTime(3000); // 120 drained against a 100 pool

    // Reset fired: pool refilled, the walk stopped, the queue snapped to 0.
    expect(gs.getCurrentMana()).toBe(max);
    expect(loopState._botExecutedAction).toBeNull();
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);
    // ...and the requeued frame re-engages the solver.
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    tick(loopState);
    expect(handles.walkToCalls).toHaveLength(2);
  });

  it('with auto-restart OFF the same depletion pauses instead of retrying', () => {
    setUp({ rate: 40 });
    loopState.autoRestartQueue = false; // the default
    loopState.startTimeDrain();
    tick(loopState);
    const max = gs.getMaxMana();

    vi.advanceTimersByTime(3000);

    expect(gs.getCurrentMana()).toBe(max);
    expect(loopState._botExecutedAction).toBeNull();
    expect(loopState.isPaused).toBe(true);
    expect(loopState.isProcessing).toBe(false);
    // Paused means paused: the drain does not keep billing a stopped bot.
    const after = gs.getCurrentMana();
    vi.advanceTimersByTime(3000);
    expect(gs.getCurrentMana()).toBe(after);
  });
});

// ---------------------------------------------------------------------------
// M6 slice 4 — Instant for Bot blocks. Ruling 4: offered only where the solver
// actually honors it, because a checkbox that does nothing is a vacuous
// control. v1 is the walkTo solver on a FINE substrate (jta, whose instant()
// maps to the fork's setInstantMode). Summary bots play real-time physics;
// maze delegation is DEFERRED — its instant() drives the visualizer, while a
// delegated walk is tracked through that same visualizer's per-tick change
// stream, so wiring it means touching the two-position-tracker split.
// ---------------------------------------------------------------------------

// A solver substrate whose controller records the ORDER of instant/walkTo
// calls. `fine` picks the capture shape: fine (a recorder, jta-shaped) vs
// summary — the two sides of the honors-instant split, with an identical
// controller so only the shape differs.
function registerInstantOrderedSubstrate({ fine, regions = ['A'] }) {
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getRegionInfo'); } catch { /* ignore */ }
  try { centralRegistry.publicFunctions.get('procgenPlayer')?.delete('getWarehouse'); } catch { /* ignore */ }
  try { substrateRegistry.clear?.(); } catch { /* ignore */ }
  const handles = { calls: [], stash: null };
  const id = fine ? 'inst_fine_sub' : 'inst_sum_sub';
  substrateRegistry.register?.({
    id,
    label: 'InstantOrdered',
    panelComponentType: 'ioPanel',
    loadRegionEvent: 'io:loadRegion',
    loopSupport: {
      queueActions: ['regionMove', 'locationCheck'],
      executeVia: 'solver',
      manual: true, customQueues: false,
      record: true, playback: true, instant: true,
      ...(fine ? {} : { summaryRecording: true }),
    },
    ...(fine
      ? { takeLastRecording: () => { const s = handles.stash; handles.stash = null; return s; } }
      : {}),
    getPlaybackController: () => ({
      instant: (on) => { handles.calls.push(`instant:${on}`); },
      walkTo: () => { handles.calls.push('walkTo'); return true; },
      stop: () => {},
    }),
  });
  centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', (region) => (
    regions.includes(region) ? { substrate: id, label: 'InstantOrdered', manaEnabled: true } : null
  ));
  return handles;
}
const registerInstantOrderedFineSolverSubstrate = () => registerInstantOrderedSubstrate({ fine: true });
const registerInstantOrderedSummarySubstrate = () => registerInstantOrderedSubstrate({ fine: false });

describe('M6 — Bot × Instant is offered per CAPABILITY', () => {
  let loopState;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState } = wire());
  });

  it('YES for the walkTo solver on a fine substrate (jta)', () => {
    registerFineSolverSubstrate();
    expect(loopState.regionBotHonorsInstant('A')).toBe(true);
  });

  it('NO for summary bots — real-time physics, no instant variant exists', () => {
    // `instant` IS declared on these (the focus-suppression seam), so this
    // must not be inferred from the declaration alone.
    registerSummarySubstrate();
    expect(loopState._regionSupportsInstant('A')).toBe(true);
    expect(loopState.regionBotHonorsInstant('A')).toBe(false);
  });

  it('NO for maze delegation (deferred — the visualizer/panel-engine split)', () => {
    registerDelegationSubstrate();
    expect(loopState.regionSolver('A')).toBe('delegation');
    expect(loopState.regionBotHonorsInstant('A')).toBe(false);
  });

  it('NO where the substrate never declared instant at all', () => {
    registerCoarseSubstrate();
    expect(loopState.regionBotHonorsInstant('A')).toBe(false);
    expect(loopState.regionBotHonorsInstant('APNative')).toBe(false);
  });
});

describe('M6 — Bot × Instant, the effect', () => {
  let loopState, gs, tick;

  function setUp(register) {
    ({ loopState, gs } = wire());
    tick = makeTicker();
    const handles = register();
    loopState._cachedRulesData = RULES_DATA;
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'bot');
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
    loopState.isProcessing = true;
    return handles;
  }

  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
  });

  it('an Instant Bot block sets instant mode BEFORE dispatching the walk', () => {
    // Order matters: instant is a MODE the substrate reads as the walk runs,
    // not an argument to walkTo.
    const handles = setUp(registerInstantOrderedFineSolverSubstrate);
    loopState.setBlockInstant('A', 1, true);
    tick(loopState);
    expect(handles.calls).toEqual(['instant:true', 'walkTo']);
  });

  it('a NON-Instant Bot block turns instant mode OFF — pacing is per block', () => {
    // jta's instant is sticky (setInstantMode with no unset path), so only
    // ever setting it ON would let one Instant block collapse every later
    // block, Manual visit and Record capture in the same iframe. Each block
    // establishes its own pacing.
    const handles = setUp(registerInstantOrderedFineSolverSubstrate);
    tick(loopState);
    expect(handles.calls).toEqual(['instant:false', 'walkTo']);
  });

  it('a stored Instant flag does NOT reach a solver that cannot honor it', () => {
    // The checkbox is hidden for summary bots, but the flag is per BLOCK and
    // survives a mode switch — a block toggled Instant under Playback and
    // then switched to Bot must not half-apply it. Nothing is sent at all
    // here, in either direction.
    const handles = setUp(registerInstantOrderedSummarySubstrate);
    loopState.setBlockInstant('A', 1, true);
    tick(loopState);
    expect(handles.calls).toEqual(['walkTo']);
  });
});

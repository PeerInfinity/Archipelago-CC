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

// Mode-based capture (M2, user ruling 2026-07-21): leaving a Record-mode
// region saves + auto-switches EVEN WHEN the loop queue never parked on the
// block (open-ended block, or free-walking with the queue not driving). Any
// player exit of a Record region is a correct exit. Fires from the wake's
// `!_manualActionEntered` branch via _maybeCaptureUnparkedRecordExit.
describe('M2 — mode-based unparked Record capture', () => {
  let loopState, gs, bus, handles;
  beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    ({ loopState, gs, bus } = wire());
    handles = registerRecordSubstrate();
    loopState._cachedRulesData = RULES_DATA;
    // Menu → A (record) → B, but WITHOUT parking on the block: the player
    // free-walked and the queue never entered manual/record parking, so
    // _manualActionEntered stays false.
    gs.updatePath('A', 'go', 'Menu');
    gs.addLocationCheck('Loc1', 'A');
    gs.updatePath('B', 'exit', 'A');
    loopState.setBlockMode('A', 1, 'record');
  });

  it('persists + auto-switches when a Record block is left with nothing parked', () => {
    expect(loopState._manualActionEntered).toBeFalsy();
    handles.stash = makeStash();
    // Player left A → B; the wake runs the unparked branch.
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });

    // Pulled the stash and persisted under the queue-derived tag.
    expect(handles.takeCalls).toBe(1);
    const saved = getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0);
    expect(saved).toBeTruthy();
    expect(saved.arrivalExitId).toBe('go');
    expect(saved.actions).toEqual([{ type: 'locationCheck', locationName: 'Loc1' }]);
    // Auto-switch (default ON) flipped it to Playback + announced it.
    expect(loopState.getBlockMode('A', 1)).toBe('playback');
    expect(bus.events.some((e) =>
      e.name === 'loopState:blockModeChanged' && e.data?.mode === 'playback')).toBe(true);
  });

  it('does NOT capture on a loop reset (fromReset)', () => {
    handles.stash = makeStash();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A', fromReset: true });
    expect(handles.takeCalls).toBe(0);
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeNull();
    // Stash left intact for a later real exit; block still in Record.
    expect(handles.stash).not.toBeNull();
    expect(loopState.getBlockMode('A', 1)).toBe('record');
  });

  it('does NOT capture when the left block is not in Record mode', () => {
    loopState.setBlockMode('A', 1, 'manual');
    handles.stash = makeStash();
    loopState._handleManualWake_regionMove({ targetRegion: 'B', oldRegion: 'A' });
    expect(handles.takeCalls).toBe(0);
    expect(getSavedQueueByTag(hashRulesData(RULES_DATA), 'A', 'rec_sub', 'go', 0)).toBeNull();
    expect(loopState.getBlockMode('A', 1)).toBe('manual');
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

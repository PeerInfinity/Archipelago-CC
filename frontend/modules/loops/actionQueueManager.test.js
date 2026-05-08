/**
 * Tests for ActionQueueManager — translates GameState path entries
 * into action objects, tracks per-action progress and completion.
 *
 * The manager delegates queue mutations to gameStateAPI, so tests use
 * a stub API that records calls and exposes a path array.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ActionQueueManager } from './actionQueueManager.js';

function makeStubAPI({ path = [] } = {}) {
  const calls = [];
  const state = { path: [...path] };
  return {
    calls,
    state,
    getPath: () => state.path,
    addCustomAction: (actionName, params) => {
      calls.push({ method: 'addCustomAction', actionName, params });
      state.path.push({ type: 'customAction', actionName, params, sourceRegion: 'X', instanceNumber: 1 });
    },
    addLocationCheck: (locationName, regionName) => {
      calls.push({ method: 'addLocationCheck', locationName, regionName });
      state.path.push({ type: 'locationCheck', locationName, sourceRegion: regionName, instanceNumber: 1 });
    },
    removeLocationCheckAt: (locationName, regionName, instanceNumber) => {
      calls.push({ method: 'removeLocationCheckAt', locationName, regionName, instanceNumber });
      return true;
    },
    removeCustomActionAt: (actionName, regionName, instanceNumber, metadata) => {
      calls.push({ method: 'removeCustomActionAt', actionName, regionName, instanceNumber, metadata });
      return true;
    },
    removeAllActionsOfType: (actionType, specificName) => {
      calls.push({ method: 'removeAllActionsOfType', actionType, specificName });
      const before = state.path.length;
      state.path = state.path.filter((e) => {
        if (e.type !== actionType) return true;
        if (specificName && e.actionName !== specificName) return true;
        return false;
      });
      return before - state.path.length;
    },
  };
}

describe('ActionQueueManager — getActionQueue', () => {
  it('returns [] when no API is wired', () => {
    const mgr = new ActionQueueManager(null);
    expect(mgr.getActionQueue()).toEqual([]);
  });

  it('returns [] when API has no getPath', () => {
    const mgr = new ActionQueueManager({});
    expect(mgr.getActionQueue()).toEqual([]);
  });

  it('maps regionMove / locationCheck / explore customAction entries', () => {
    const path = [
      { type: 'regionMove', sourceRegion: 'Menu', destinationRegion: 'A', exitUsed: 'GameStart' },
      { type: 'locationCheck', locationName: 'Loc1', sourceRegion: 'A' },
      { type: 'customAction', actionName: 'explore', sourceRegion: 'A' },
    ];
    const mgr = new ActionQueueManager(makeStubAPI({ path }));
    const queue = mgr.getActionQueue();
    expect(queue.length).toBe(3);
    expect(queue.map(q => q.type)).toEqual(['regionMove', 'locationCheck', 'customAction']);
    expect(queue.map(q => q.id)).toEqual(['action-0', 'action-1', 'action-2']);
    expect(queue.map(q => q.pathIndex)).toEqual([0, 1, 2]);
  });

  it('skips non-explore customActions', () => {
    const path = [
      { type: 'customAction', actionName: 'explore', sourceRegion: 'A' },
      { type: 'customAction', actionName: 'rest', sourceRegion: 'A' },
      { type: 'customAction', actionName: 'somethingElse', sourceRegion: 'A' },
    ];
    const mgr = new ActionQueueManager(makeStubAPI({ path }));
    const queue = mgr.getActionQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].actionName).toBe('explore');
    // pathIndex preserves the original path position even though queue is shorter
    expect(queue[0].pathIndex).toBe(0);
  });

  it('overlays progress and completed flags', () => {
    const path = [
      { type: 'regionMove', sourceRegion: 'Menu', destinationRegion: 'A' },
      { type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' },
    ];
    const mgr = new ActionQueueManager(makeStubAPI({ path }));
    mgr.setProgress(0, 42);
    mgr.markCompleted(1);
    const queue = mgr.getActionQueue();
    expect(queue[0].progress).toBe(42);
    expect(queue[0].completed).toBe(false);
    expect(queue[1].progress).toBe(100);
    expect(queue[1].completed).toBe(true);
  });
});

describe('ActionQueueManager — queue mutations', () => {
  let mgr, api;
  beforeEach(() => {
    api = makeStubAPI();
    mgr = new ActionQueueManager(api);
  });

  it('queueExploreAction delegates to addCustomAction with repeat flag', () => {
    expect(mgr.queueExploreAction('Forest', true)).toBe(true);
    const call = api.calls.find(c => c.method === 'addCustomAction');
    expect(call).toMatchObject({ actionName: 'explore', params: { repeat: true } });
  });

  it('queueExploreAction returns false when API is missing addCustomAction', () => {
    const m = new ActionQueueManager({ getPath: () => [] });
    expect(m.queueExploreAction('Forest', false)).toBe(false);
  });

  it('queueLocationCheck delegates to addLocationCheck', () => {
    expect(mgr.queueLocationCheck('Loc1', 'Forest')).toBe(true);
    const call = api.calls.find(c => c.method === 'addLocationCheck');
    expect(call).toMatchObject({ locationName: 'Loc1', regionName: 'Forest' });
  });

  it('queueLocationCheck returns false when API is missing addLocationCheck', () => {
    const m = new ActionQueueManager({ getPath: () => [] });
    expect(m.queueLocationCheck('L', 'R')).toBe(false);
  });
});

describe('ActionQueueManager — removeAction', () => {
  it('returns false on out-of-range index', () => {
    const api = makeStubAPI({
      path: [{ type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' }],
    });
    const mgr = new ActionQueueManager(api);
    expect(mgr.removeAction(-1)).toBe(false);
    expect(mgr.removeAction(99)).toBe(false);
  });

  it('removes a locationCheck via removeLocationCheckAt', () => {
    const api = makeStubAPI({
      path: [{ type: 'locationCheck', locationName: 'L', sourceRegion: 'R', instanceNumber: 1 }],
    });
    const mgr = new ActionQueueManager(api);
    mgr.setProgress(0, 50);
    mgr.markCompleted(0);

    expect(mgr.removeAction(0)).toBe(true);
    const removeCall = api.calls.find(c => c.method === 'removeLocationCheckAt');
    expect(removeCall).toMatchObject({ locationName: 'L', regionName: 'R', instanceNumber: 1 });
    // Tracking entries for that pathIndex are cleaned.
    expect(mgr.getProgress(0)).toBe(0);
    expect(mgr.isCompleted(0)).toBe(false);
  });

  it('removes a customAction via removeCustomActionAt', () => {
    const api = makeStubAPI({
      path: [{ type: 'customAction', actionName: 'explore', sourceRegion: 'R', instanceNumber: 2 }],
    });
    const mgr = new ActionQueueManager(api);
    expect(mgr.removeAction(0)).toBe(true);
    const call = api.calls.find(c => c.method === 'removeCustomActionAt');
    expect(call).toMatchObject({ actionName: 'explore', regionName: 'R', instanceNumber: 2 });
  });

  it('returns false for an unknown action type', () => {
    // regionMove entries appear in the queue but removeAction has no
    // branch for them — verify the unknown-type guard.
    const api = makeStubAPI({
      path: [{ type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' }],
    });
    const mgr = new ActionQueueManager(api);
    expect(mgr.removeAction(0)).toBe(false);
  });

  it('returns false when API is missing entirely', () => {
    const mgr = new ActionQueueManager(null);
    expect(mgr.removeAction(0)).toBe(false);
  });
});

describe('ActionQueueManager — clearQueue / clearExploreActions', () => {
  it('clearQueue clears tracking and removes location/custom actions from path', () => {
    const api = makeStubAPI({
      path: [
        { type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' },
        { type: 'locationCheck', locationName: 'L', sourceRegion: 'B' },
        { type: 'customAction', actionName: 'explore', sourceRegion: 'B' },
      ],
    });
    const mgr = new ActionQueueManager(api);
    mgr.setProgress(1, 50);
    mgr.markCompleted(2);

    mgr.clearQueue();

    expect(mgr.getProgress(1)).toBe(0);
    expect(mgr.isCompleted(2)).toBe(false);
    // Both removeAllActionsOfType calls fired.
    const types = api.calls
      .filter(c => c.method === 'removeAllActionsOfType')
      .map(c => c.actionType);
    expect(types).toEqual(['locationCheck', 'customAction']);
    // Path now retains only regionMove.
    expect(api.state.path.map(p => p.type)).toEqual(['regionMove']);
  });

  it('clearExploreActions returns the count removed', () => {
    const api = makeStubAPI({
      path: [
        { type: 'customAction', actionName: 'explore', sourceRegion: 'A' },
        { type: 'customAction', actionName: 'rest', sourceRegion: 'A' },
        { type: 'customAction', actionName: 'explore', sourceRegion: 'B' },
      ],
    });
    const mgr = new ActionQueueManager(api);
    expect(mgr.clearExploreActions()).toBe(2);
    expect(api.state.path.map(p => p.actionName)).toEqual(['rest']);
  });

  it('clearQueue is a no-op when API is missing (no throw)', () => {
    const mgr = new ActionQueueManager(null);
    expect(() => mgr.clearQueue()).not.toThrow();
  });

  it('clearExploreActions returns 0 when API is missing', () => {
    const mgr = new ActionQueueManager(null);
    expect(mgr.clearExploreActions()).toBe(0);
  });
});

describe('ActionQueueManager — progress / completion tracking', () => {
  let mgr;
  beforeEach(() => {
    mgr = new ActionQueueManager(makeStubAPI());
  });

  it('getProgress defaults to 0 for untracked indices', () => {
    expect(mgr.getProgress(99)).toBe(0);
  });

  it('setProgress + getProgress round-trip', () => {
    mgr.setProgress(3, 75);
    expect(mgr.getProgress(3)).toBe(75);
  });

  it('markCompleted both adds to completed set AND pins progress at 100', () => {
    mgr.markCompleted(7);
    expect(mgr.isCompleted(7)).toBe(true);
    expect(mgr.getProgress(7)).toBe(100);
  });

  it('isCompleted false for untracked indices', () => {
    expect(mgr.isCompleted(99)).toBe(false);
  });

  it('resetProgress clears both Maps', () => {
    mgr.setProgress(0, 50);
    mgr.markCompleted(1);
    mgr.resetProgress();
    expect(mgr.getProgress(0)).toBe(0);
    expect(mgr.isCompleted(1)).toBe(false);
  });
});

describe('ActionQueueManager — getState / loadState round-trip', () => {
  it('saves and restores progress + completion state', () => {
    const a = new ActionQueueManager(makeStubAPI());
    a.setProgress(0, 30);
    a.setProgress(2, 55);
    a.markCompleted(1);
    const state = a.getState();

    const b = new ActionQueueManager(makeStubAPI());
    b.loadState(state);
    expect(b.getProgress(0)).toBe(30);
    expect(b.getProgress(2)).toBe(55);
    expect(b.isCompleted(1)).toBe(true);
    expect(b.getProgress(1)).toBe(100);
  });

  it('loadState tolerates partial state objects', () => {
    const mgr = new ActionQueueManager(makeStubAPI());
    expect(() => mgr.loadState({})).not.toThrow();
    expect(() => mgr.loadState({ actionCompleted: [5] })).not.toThrow();
    expect(mgr.isCompleted(5)).toBe(true);
  });
});

describe('ActionQueueManager — getDebugInfo', () => {
  it('summarizes queue contents and tracking sizes', () => {
    const api = makeStubAPI({
      path: [
        { type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' },
        { type: 'locationCheck', locationName: 'L', sourceRegion: 'B' },
      ],
    });
    const mgr = new ActionQueueManager(api);
    mgr.setProgress(0, 25);
    mgr.markCompleted(1);
    const dbg = mgr.getDebugInfo();
    expect(dbg.queueLength).toBe(2);
    expect(dbg.trackedProgress).toBe(2); // setProgress + markCompleted (which also sets progress)
    expect(dbg.completedActions).toBe(1);
    expect(dbg.queue[0]).toMatchObject({ type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B', progress: 25, completed: false });
    expect(dbg.queue[1]).toMatchObject({ type: 'locationCheck', sourceRegion: 'B', progress: 100, completed: true });
  });
});

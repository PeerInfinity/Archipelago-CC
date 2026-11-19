/**
 * sdc-loop-start-region-queue (Robert 2026-11-18T03:05:41.891Z): a location
 * in the START region can be queued in Loop mode when the path has no
 * synthesized start hop (an AP-native / add-on doc such as APQuest).
 *
 * addLocationCheck used to refuse an empty path ("no regionMove entries found
 * in path"); in Loop mode it now resolves its region and instance the way
 * addCustomAction does (_resolveRegionAndInstance). Outside Loop mode the
 * empty-path refusal is kept (non-Loop path tracking unchanged). A path WITH a regionMove keeps the old
 * behaviour exactly (the last regionMove's instance, always).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { GameState } from './state.js';
import { installRafShim, uninstallRafShim, makeWired } from '../loops/testHarness.js';

function makeGs() {
  const bus = { publish: vi.fn(), subscribe: () => () => {} };
  return { gs: new GameState(bus), bus };
}

describe('addLocationCheck on an EMPTY path, Loop mode on', () => {
  let gs, bus;
  beforeEach(() => {
    ({ gs, bus } = makeGs());
    gs.setStartRegions(['Overworld']);
    gs.setCurrentRegion('Overworld');
    gs.setLoopModeActive(true);
    bus.publish.mockClear();
  });

  it('queues a start-region location with the given region, instance 1', () => {
    gs.addLocationCheck('Bottom Left Chest', 'Overworld');
    expect(gs.getPath()).toEqual([
      { type: 'locationCheck', locationName: 'Bottom Left Chest', sourceRegion: 'Overworld', instanceNumber: 1 },
    ]);
    expect(bus.publish.mock.calls.some(([n]) => n === 'gameState:pathUpdated')).toBe(true);
  });

  it('falls back to currentRegion when no region is given', () => {
    gs.addLocationCheck('Top Middle Chest');
    expect(gs.getPath()).toEqual([
      { type: 'locationCheck', locationName: 'Top Middle Chest', sourceRegion: 'Overworld', instanceNumber: 1 },
    ]);
  });

  it('takes the region from staticData when no region is given', () => {
    const staticData = { locations: new Map([['Far Chest', { region: 'Right Room' }]]) };
    gs.addLocationCheck('Far Chest', null, staticData);
    expect(gs.getPath()[0]).toMatchObject({ sourceRegion: 'Right Room', instanceNumber: 1 });
  });

  it('matches addCustomAction (explore) in the same region: same sourceRegion and instance', () => {
    gs.addCustomAction('explore', { regionName: 'Overworld' });
    gs.addLocationCheck('Bottom Left Chest', 'Overworld');
    const [explore, check] = gs.getPath();
    expect(check.sourceRegion).toBe(explore.sourceRegion);
    expect(check.instanceNumber).toBe(explore.instanceNumber);
  });

  it('refuses (path unchanged, no pathUpdated) only when no region resolves at all', () => {
    const fresh = makeGs();
    fresh.gs.setLoopModeActive(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fresh.gs.currentRegion = null;
    fresh.gs.addLocationCheck('Chest');
    expect(fresh.gs.getPath()).toEqual([]);
    expect(fresh.bus.publish.mock.calls.some(([n]) => n === 'gameState:pathUpdated')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no region resolves'));
    warn.mockRestore();
  });
});

describe('addLocationCheck on an EMPTY path, Loop mode OFF (unchanged: refuses)', () => {
  it('does not record a check made before the first move (gameState\'s non-Loop path tracking)', () => {
    const { gs, bus } = makeGs();
    gs.setStartRegions(['Overworld']);
    gs.setCurrentRegion('Overworld');
    bus.publish.mockClear();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    gs.addLocationCheck('Bottom Left Chest', 'Overworld');
    expect(gs.getPath()).toEqual([]);
    expect(bus.publish.mock.calls.some(([n]) => n === 'gameState:pathUpdated')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no regionMove entries found in path'));
    warn.mockRestore();
  });
});

describe('addLocationCheck on a path WITH a regionMove (unchanged)', () => {
  let gs;
  beforeEach(() => {
    ({ gs } = makeGs());
    gs.setStartRegions(['Menu']);
    gs.setCurrentRegion('Menu');
    gs.updatePath('A', 'Menu -> A', 'Menu');
    gs.updatePath('B', 'A -> B', 'A');
  });

  it('takes the last regionMove\'s destination and instance', () => {
    gs.addLocationCheck('LocB');
    expect(gs.getPath().at(-1)).toEqual(
      { type: 'locationCheck', locationName: 'LocB', sourceRegion: 'B', instanceNumber: 1 });
  });

  it('keeps the last regionMove\'s instance even for a different named region (old behaviour)', () => {
    gs.updatePath('A', 'B -> A', 'B'); // A instance 2
    gs.addLocationCheck('LocMenu', 'Menu');
    expect(gs.getPath().at(-1)).toEqual(
      { type: 'locationCheck', locationName: 'LocMenu', sourceRegion: 'Menu', instanceNumber: 2 });
  });
});

describe('the queue EXECUTES an empty-path start-region locationCheck', () => {
  beforeAll(installRafShim);
  afterAll(uninstallRafShim);

  it('runs it to completion and dispatches user:locationCheck {fromLoop} for the start region (no cost data)', () => {
    const { loopState, gs, dispatcher } = makeWired({ startRegion: 'Overworld' });
    dispatcher.publishToNextModule = vi.fn();
    gs.setLoopModeActive(true);
    gs.addLocationCheck('Bottom Left Chest', 'Overworld');

    const queue = loopState.getActionQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ type: 'locationCheck', sourceRegion: 'Overworld', instanceNumber: 1 });
    // No loop_costs on the doc: the no-cost-data fallback prices it (finite, > 0).
    const cost = loopState._calculateActionCost(queue[0]);
    expect(cost).toBeGreaterThan(0);
    expect(Number.isFinite(cost)).toBe(true);

    loopState.instantMode = true;
    loopState.startProcessing();
    let clock = 1000;
    for (let i = 0; i < 20 && !loopState._queueCompleted; i++) {
      loopState._processFrame(clock);
      clock += 16;
    }
    expect(loopState._queueCompleted).toBe(true);
    expect(dispatcher.publishToNextModule).toHaveBeenCalledWith(
      'loops', 'user:locationCheck',
      { locationName: 'Bottom Left Chest', regionName: 'Overworld', fromLoop: true },
      { direction: 'up' });
  });
});

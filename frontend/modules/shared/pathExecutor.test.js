import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeRegionMovePath, buildStepsFromRegionList } from './pathExecutor.js';

function makeDispatcher() {
  const calls = [];
  return {
    calls,
    publish: vi.fn((eventName, data, options) => {
      calls.push({ eventName, data, options });
    }),
  };
}

function makeGameState() {
  const calls = [];
  return {
    calls,
    updatePath: vi.fn((target, exit, source) => {
      calls.push({ target, exit, source });
    }),
  };
}

describe('executeRegionMovePath — guards', () => {
  it('returns 0 and does nothing when dispatcher is missing', () => {
    expect(executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher: null,
      source: 'test',
    })).toBe(0);
  });

  it('returns 0 and does nothing when dispatcher.publish is not a function', () => {
    expect(executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher: { publish: 'not a function' },
      source: 'test',
    })).toBe(0);
  });

  it('returns 0 on empty step list without invoking dispatcher', () => {
    const dispatcher = makeDispatcher();
    expect(executeRegionMovePath({ steps: [], dispatcher, source: 'test' })).toBe(0);
    expect(dispatcher.publish).not.toHaveBeenCalled();
  });

  it('returns 0 when steps is not an array', () => {
    const dispatcher = makeDispatcher();
    expect(executeRegionMovePath({ steps: null, dispatcher, source: 'test' })).toBe(0);
    expect(executeRegionMovePath({ steps: undefined, dispatcher, source: 'test' })).toBe(0);
    expect(dispatcher.publish).not.toHaveBeenCalled();
  });
});

describe('executeRegionMovePath — dispatch behavior', () => {
  let dispatcher;
  beforeEach(() => {
    dispatcher = makeDispatcher();
  });

  it('emits one user:regionMove per step, in order', () => {
    const steps = [
      { sourceRegion: 'A', targetRegion: 'B', exitName: 'east' },
      { sourceRegion: 'B', targetRegion: 'C', exitName: 'north' },
      { sourceRegion: 'C', targetRegion: 'D', exitName: 'door' },
    ];
    const count = executeRegionMovePath({ steps, dispatcher, source: 'test' });

    expect(count).toBe(3);
    expect(dispatcher.publish).toHaveBeenCalledTimes(3);
    expect(dispatcher.calls.map(c => c.data.targetRegion)).toEqual(['B', 'C', 'D']);
    expect(dispatcher.calls.every(c => c.eventName === 'user:regionMove')).toBe(true);
  });

  it('dispatches with updatePath:true when no gameState is provided', () => {
    executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      source: 'cost-gen',
    });
    expect(dispatcher.calls[0].data.updatePath).toBe(true);
  });

  it('dispatches with updatePath:false when gameState is provided', () => {
    const gameState = makeGameState();
    executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      gameState,
      source: 'graph',
    });
    expect(dispatcher.calls[0].data.updatePath).toBe(false);
  });

  it('forwards source through to every event payload', () => {
    const steps = [
      { sourceRegion: 'A', targetRegion: 'B', exitName: 'east' },
      { sourceRegion: 'B', targetRegion: 'C', exitName: 'north' },
    ];
    executeRegionMovePath({ steps, dispatcher, source: 'regionGraph-addToPath' });
    expect(dispatcher.calls.every(c => c.data.source === 'regionGraph-addToPath')).toBe(true);
  });

  it('passes initialTarget through to dispatcher options', () => {
    executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      source: 'test',
      initialTarget: 'top',
    });
    expect(dispatcher.calls[0].options).toEqual({ initialTarget: 'top' });
  });

  it("defaults initialTarget to 'bottom'", () => {
    executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      source: 'test',
    });
    expect(dispatcher.calls[0].options).toEqual({ initialTarget: 'bottom' });
  });

  it('preserves all four payload fields per step', () => {
    executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      source: 'test',
    });
    expect(dispatcher.calls[0].data).toEqual({
      sourceRegion: 'A',
      targetRegion: 'B',
      exitName: 'east',
      updatePath: true,
      source: 'test',
    });
  });
});

describe('executeRegionMovePath — gameState.updatePath synchronization', () => {
  it('calls updatePath BEFORE the dispatch event, per step', () => {
    const order = [];
    const dispatcher = {
      publish: (eventName, data) => order.push(`dispatch:${data.targetRegion}`),
    };
    const gameState = {
      updatePath: (target) => order.push(`updatePath:${target}`),
    };
    executeRegionMovePath({
      steps: [
        { sourceRegion: 'A', targetRegion: 'B', exitName: 'e' },
        { sourceRegion: 'B', targetRegion: 'C', exitName: 'n' },
      ],
      dispatcher,
      gameState,
      source: 'test',
    });
    expect(order).toEqual([
      'updatePath:B',
      'dispatch:B',
      'updatePath:C',
      'dispatch:C',
    ]);
  });

  it('forwards (target, exit, source) to gameState.updatePath in that order', () => {
    const dispatcher = makeDispatcher();
    const gameState = makeGameState();
    executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      gameState,
      source: 'test',
    });
    expect(gameState.calls[0]).toEqual({ target: 'B', exit: 'east', source: 'A' });
  });

  it('skips updatePath gracefully if gameState lacks the method', () => {
    const dispatcher = makeDispatcher();
    expect(() => executeRegionMovePath({
      steps: [{ sourceRegion: 'A', targetRegion: 'B', exitName: 'east' }],
      dispatcher,
      gameState: {}, // no updatePath
      source: 'test',
    })).not.toThrow();
    // When gameState is truthy but lacks updatePath, the helper still
    // treats this as "gameState mode" and dispatches with updatePath:false.
    expect(dispatcher.calls[0].data.updatePath).toBe(false);
  });
});

describe('buildStepsFromRegionList', () => {
  it('returns [] for an empty region list', () => {
    expect(buildStepsFromRegionList({
      startRegion: 'A',
      regions: [],
      findExit: () => 'door',
    })).toEqual([]);
  });

  it('returns [] when regions is not an array', () => {
    expect(buildStepsFromRegionList({
      startRegion: 'A',
      regions: null,
      findExit: () => 'door',
    })).toEqual([]);
  });

  it('uses startRegion as the source for the first step', () => {
    const steps = buildStepsFromRegionList({
      startRegion: 'Menu',
      regions: ['Forest'],
      findExit: () => 'gate',
    });
    expect(steps).toEqual([{ sourceRegion: 'Menu', targetRegion: 'Forest', exitName: 'gate' }]);
  });

  it('chains source from previous target for subsequent steps', () => {
    const steps = buildStepsFromRegionList({
      startRegion: 'Menu',
      regions: ['A', 'B', 'C'],
      findExit: (s, t) => `${s}->${t}`,
    });
    expect(steps).toEqual([
      { sourceRegion: 'Menu', targetRegion: 'A', exitName: 'Menu->A' },
      { sourceRegion: 'A', targetRegion: 'B', exitName: 'A->B' },
      { sourceRegion: 'B', targetRegion: 'C', exitName: 'B->C' },
    ]);
  });

  it('passes (source, target) to findExit in that order', () => {
    const findExit = vi.fn(() => 'east');
    buildStepsFromRegionList({
      startRegion: 'Start',
      regions: ['Mid', 'End'],
      findExit,
    });
    expect(findExit).toHaveBeenNthCalledWith(1, 'Start', 'Mid');
    expect(findExit).toHaveBeenNthCalledWith(2, 'Mid', 'End');
  });

  it('preserves null exit names from findExit (caller decides what to do)', () => {
    const steps = buildStepsFromRegionList({
      startRegion: 'A',
      regions: ['B'],
      findExit: () => null,
    });
    expect(steps[0].exitName).toBeNull();
  });
});

describe('integration — buildStepsFromRegionList + executeRegionMovePath', () => {
  it('the regionGraph pattern: build steps from region names, dispatch with sync updatePath', () => {
    const dispatcher = makeDispatcher();
    const gameState = makeGameState();
    const adjacency = {
      'A->B': 'east',
      'B->C': 'north',
    };

    const steps = buildStepsFromRegionList({
      startRegion: 'A',
      regions: ['B', 'C'],
      findExit: (s, t) => adjacency[`${s}->${t}`],
    });
    const count = executeRegionMovePath({
      steps,
      dispatcher,
      gameState,
      source: 'regionGraph-addToPath',
    });

    expect(count).toBe(2);
    expect(gameState.calls).toEqual([
      { target: 'B', exit: 'east', source: 'A' },
      { target: 'C', exit: 'north', source: 'B' },
    ]);
    expect(dispatcher.calls.map(c => c.data.exitName)).toEqual(['east', 'north']);
    expect(dispatcher.calls.every(c => c.data.updatePath === false)).toBe(true);
  });

  it('the cost-generator pattern: pre-shaped steps, no gameState, updatePath:true', () => {
    const dispatcher = makeDispatcher();
    // Cost generator's pathFinder.findPathWithExits returns
    // steps as [{ region, exitUsed }] starting at startRegion;
    // the caller skips index 0 and reshapes.
    const findPathWithExitsResult = [
      { region: 'Menu', exitUsed: null },
      { region: 'Forest', exitUsed: 'gate' },
      { region: 'Cave', exitUsed: 'mouth' },
    ];
    const startRegion = 'Menu';
    const steps = findPathWithExitsResult.slice(1).map((step, index) => ({
      sourceRegion: index === 0 ? startRegion : findPathWithExitsResult[index].region,
      targetRegion: step.region,
      exitName: step.exitUsed,
    }));

    executeRegionMovePath({ steps, dispatcher, source: 'loops-costGenerator' });

    expect(dispatcher.calls.map(c => c.data)).toEqual([
      { sourceRegion: 'Menu', targetRegion: 'Forest', exitName: 'gate', updatePath: true, source: 'loops-costGenerator' },
      { sourceRegion: 'Forest', targetRegion: 'Cave', exitName: 'mouth', updatePath: true, source: 'loops-costGenerator' },
    ]);
  });
});

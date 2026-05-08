/**
 * Unit tests for the testable parts of CostGenerator.
 *
 * The full async generate() pipeline depends on pathFinder + loopState
 * + dispatcher + the snapshot event loop, which is too tangled to wire
 * up in a unit test. We cover the pure helpers and the simple
 * lifecycle methods (cancel, getProgress, save/restore state) here;
 * end-to-end coverage belongs in a Playwright/integration suite.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CostGenerator } from './costGenerator.js';

function makeStubDeps({ staticData = {}, manaState = {} } = {}) {
  const events = [];
  return {
    events,
    deps: {
      loopState: {
        currentMana: manaState.currentMana ?? 100,
        maxMana: manaState.maxMana ?? 100,
        regionXP: new Map(),
        isPaused: false,
        isProcessing: false,
        instantMode: false,
        noManaDepletionReset: false,
        gameSpeed: 1,
        setInstantMode(v) { this.instantMode = v; },
        setNoManaDepletionReset(v) { this.noManaDepletionReset = v; },
        setPaused(v) { this.isPaused = v; },
        setGameSpeed(v) { this.gameSpeed = v; },
        startProcessing() { this.isProcessing = true; },
        stopProcessing() { this.isProcessing = false; },
        _resetLoop() { this.currentMana = this.maxMana; },
      },
      stateManager: {
        getStartRegions: () => ['Menu'],
        getStaticData: () => staticData,
        getLatestStateSnapshot: () => ({ checkedLocations: [] }),
      },
      pathFinder: { findPathWithExits: () => null },
      eventBus: { publish: (n, d) => events.push({ name: n, data: d }), subscribe: () => {}, unsubscribe: () => {} },
      costDataManager: {
        _data: null,
        setCostData(data) { this._data = data; return true; },
        getCostData() { return this._data; },
      },
      dispatcher: { publish: () => {} },
      gameStateAPI: { addLocationCheck: () => {}, trimPath: () => {} },
    },
  };
}

describe('CostGenerator — getProgress / cancel', () => {
  let gen;
  beforeEach(() => {
    gen = new CostGenerator(makeStubDeps().deps);
  });

  it('initial progress reports zeros and 0%', () => {
    const p = gen.getProgress();
    expect(p).toEqual({ isGenerating: false, processed: 0, total: 0, percent: 0 });
  });

  it('cancel() is a no-op when nothing is running', () => {
    gen.cancel();
    expect(gen.isCancelled).toBe(false);
  });

  it('cancel() sets isCancelled when generation is in progress', () => {
    gen.isGenerating = true;
    gen.cancel();
    expect(gen.isCancelled).toBe(true);
  });

  it('getProgress reports percent based on processed/total', () => {
    gen.totalEntries = 4;
    gen.processedEntries = 1;
    expect(gen.getProgress().percent).toBe(25);
  });
});

describe('CostGenerator — _extractLocationEntries', () => {
  let gen;
  beforeEach(() => {
    gen = new CostGenerator(makeStubDeps().deps);
  });

  it('returns [] for empty sphere log', () => {
    expect(gen._extractLocationEntries([])).toEqual([]);
  });

  it('skips non state_update entries', () => {
    const log = [
      { type: 'rules_loaded', sphere_index: 0 },
      { type: 'unknown' },
    ];
    expect(gen._extractLocationEntries(log)).toEqual([]);
  });

  it('flattens sphere_locations into one entry per location', () => {
    const log = [
      {
        type: 'state_update',
        sphere_index: 1,
        player_data: {
          1: { sphere_locations: ['Loc1', 'Loc2', 'Loc3'] },
        },
      },
    ];
    const entries = gen._extractLocationEntries(log);
    expect(entries.map(e => e.locationName)).toEqual(['Loc1', 'Loc2', 'Loc3']);
    expect(entries.every(e => e.sphereIndex === 1)).toBe(true);
  });

  it('grants itemsReceived only on the LAST location of a sphere', () => {
    const log = [
      {
        type: 'state_update',
        sphere_index: 1,
        player_data: {
          1: {
            sphere_locations: ['A', 'B'],
            new_inventory_details: { base_items: { item1: 2, item2: 3 } },
          },
        },
      },
    ];
    const [first, last] = gen._extractLocationEntries(log);
    expect(first.itemsReceived).toBe(0);
    expect(last.itemsReceived).toBe(5);
  });

  it('emits a phantom entry (locationName=null) when no locations but items received', () => {
    const log = [
      {
        type: 'state_update',
        sphere_index: 2,
        player_data: {
          1: {
            sphere_locations: [],
            new_inventory_details: { base_items: { item1: 4 } },
          },
        },
      },
    ];
    const entries = gen._extractLocationEntries(log);
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({
      sphereIndex: 2,
      locationName: null,
      itemsReceived: 4,
    });
  });

  it('emits no phantom when no locations AND no items', () => {
    const log = [
      { type: 'state_update', sphere_index: 0, player_data: { 1: { sphere_locations: [] } } },
    ];
    expect(gen._extractLocationEntries(log)).toEqual([]);
  });

  it('skips spheres with no player_data for current player', () => {
    const log = [
      { type: 'state_update', sphere_index: 0, player_data: { 99: { sphere_locations: ['X'] } } },
    ];
    expect(gen._extractLocationEntries(log)).toEqual([]);
  });

  it('passes through new_accessible_regions per entry', () => {
    const log = [
      {
        type: 'state_update',
        sphere_index: 1,
        player_data: {
          1: {
            sphere_locations: ['A'],
            new_accessible_regions: ['R1', 'R2'],
          },
        },
      },
    ];
    expect(gen._extractLocationEntries(log)[0].newAccessibleRegions).toEqual(['R1', 'R2']);
  });
});

describe('CostGenerator — _assignDefaultCosts', () => {
  let gen, deps;
  beforeEach(() => {
    deps = makeStubDeps({
      staticData: {
        regions: new Map([
          ['A', { exits: [{ connected_region: 'B' }] }],
          ['B', { exits: [{ connected_region: 'A' }, { connected_region: 'C' }] }],
          ['C', { exits: [] }],
        ]),
        locations: new Map([['Loc1', {}], ['Loc2', {}], ['Loc3', {}]]),
      },
    });
    gen = new CostGenerator(deps.deps);
  });

  it('assigns default region cost when no neighbors are costed', () => {
    const costs = {
      regions: { A: { moveCost: 25 } },
      locations: {},
      defaultRegionCost: 50,
      defaultLocationCost: 10,
    };
    gen.assignedRegions.add('A');
    gen._assignDefaultCosts(costs);
    // B's neighbor A has cost 25 → B gets 25.
    expect(costs.regions.B.moveCost).toBe(25);
    // C's only neighbor has no cost yet → falls back to defaultRegionCost.
    expect(costs.regions.C.moveCost).toBe(50);
  });

  it('uses HIGHEST neighbor cost (not lowest)', () => {
    const costs = {
      regions: { A: { moveCost: 10 }, C: { moveCost: 80 } },
      locations: {},
      defaultRegionCost: 50,
      defaultLocationCost: 10,
    };
    gen.assignedRegions.add('A');
    gen.assignedRegions.add('C');
    gen._assignDefaultCosts(costs);
    expect(costs.regions.B.moveCost).toBe(80);
  });

  it('assigns max(existing locationCost, defaultLocationCost) to unvisited locations', () => {
    const costs = {
      regions: {},
      locations: { Loc1: 200, Loc2: 50 },
      defaultRegionCost: 50,
      defaultLocationCost: 10,
    };
    gen.assignedLocations.add('Loc1');
    gen.assignedLocations.add('Loc2');
    gen._assignDefaultCosts(costs);
    // Highest of {default 10, 200, 50} = 200 → Loc3 gets 200.
    expect(costs.locations.Loc3).toBe(200);
  });

  it('uses defaultLocationCost when no locations have costs yet', () => {
    const costs = { regions: {}, locations: {}, defaultRegionCost: 50, defaultLocationCost: 10 };
    gen._assignDefaultCosts(costs);
    expect(costs.locations.Loc1).toBe(10);
  });

  it('is a no-op when staticData is missing', () => {
    const deps2 = makeStubDeps({ staticData: null });
    const gen2 = new CostGenerator(deps2.deps);
    const costs = { regions: {}, locations: {}, defaultRegionCost: 50, defaultLocationCost: 10 };
    expect(() => gen2._assignDefaultCosts(costs)).not.toThrow();
    expect(costs.regions).toEqual({});
  });
});

describe('CostGenerator — _getHighestNeighborCost', () => {
  let gen;
  beforeEach(() => {
    gen = new CostGenerator(makeStubDeps().deps);
  });

  it('returns 0 when no exits are defined', () => {
    expect(gen._getHighestNeighborCost('A', {}, { regions: {} })).toBe(0);
  });

  it('returns the highest neighbor cost', () => {
    const regionData = {
      exits: [{ connected_region: 'B' }, { connected_region: 'C' }, { connected_region: 'D' }],
    };
    const costs = {
      regions: { B: { moveCost: 30 }, C: { moveCost: 75 }, D: { moveCost: 50 } },
    };
    expect(gen._getHighestNeighborCost('A', regionData, costs)).toBe(75);
  });

  it('ignores neighbors that have no cost yet', () => {
    const regionData = { exits: [{ connected_region: 'B' }, { connected_region: 'C' }] };
    const costs = { regions: { C: { moveCost: 42 } } };
    expect(gen._getHighestNeighborCost('A', regionData, costs)).toBe(42);
  });
});

describe('CostGenerator — save / restore loopState', () => {
  it('round-trips all tracked fields', () => {
    const { deps } = makeStubDeps({ manaState: { currentMana: 70, maxMana: 200 } });
    deps.loopState.regionXP = new Map([['A', { level: 2, xp: 10, xpForNextLevel: 100 }]]);
    deps.loopState.gameSpeed = 7;
    deps.loopState.instantMode = true;
    deps.loopState.noManaDepletionReset = true;

    const gen = new CostGenerator(deps);
    const saved = gen._saveLoopState();
    expect(saved).toMatchObject({
      currentMana: 70, maxMana: 200, gameSpeed: 7,
      instantMode: true, noManaDepletionReset: true,
    });
    // Saved regionXP is a copy, not the same reference.
    expect(saved.regionXP).not.toBe(deps.loopState.regionXP);
    expect(saved.regionXP.get('A').level).toBe(2);

    // Mutate live state, then restore.
    deps.loopState.currentMana = 1;
    deps.loopState.maxMana = 1;
    deps.loopState.gameSpeed = 1;
    deps.loopState.instantMode = false;
    deps.loopState.noManaDepletionReset = false;
    deps.loopState.regionXP = new Map();

    gen._restoreLoopState(saved);
    expect(deps.loopState.currentMana).toBe(70);
    expect(deps.loopState.maxMana).toBe(200);
    expect(deps.loopState.gameSpeed).toBe(7);
    expect(deps.loopState.instantMode).toBe(true);
    expect(deps.loopState.noManaDepletionReset).toBe(true);
    expect(deps.loopState.regionXP.get('A').level).toBe(2);
  });
});

describe('CostGenerator — _configureLoopStateForGeneration', () => {
  it('resets mana to max, clears XP, enables instant + no-mana-reset, unpauses', () => {
    const { deps } = makeStubDeps({ manaState: { currentMana: 30, maxMana: 100 } });
    deps.loopState.regionXP = new Map([['A', { level: 2, xp: 10, xpForNextLevel: 100 }]]);
    deps.loopState.isPaused = true;
    const gen = new CostGenerator(deps);

    gen._configureLoopStateForGeneration();

    expect(deps.loopState.currentMana).toBe(100);
    expect(deps.loopState.regionXP.size).toBe(0);
    expect(deps.loopState.instantMode).toBe(true);
    expect(deps.loopState.noManaDepletionReset).toBe(true);
    expect(deps.loopState.isPaused).toBe(false);
  });
});

describe('CostGenerator — _getFirstRegionFromStaticData', () => {
  it('returns the first region name from staticData', () => {
    const { deps } = makeStubDeps({
      staticData: { regions: new Map([['First', {}], ['Second', {}]]) },
    });
    const gen = new CostGenerator(deps);
    expect(gen._getFirstRegionFromStaticData()).toBe('First');
  });

  it('returns null when staticData has no regions', () => {
    const { deps } = makeStubDeps({ staticData: {} });
    const gen = new CostGenerator(deps);
    expect(gen._getFirstRegionFromStaticData()).toBeNull();
  });
});

describe('CostGenerator — exportToJSON / getCosts', () => {
  it('delegates to costDataManager', () => {
    const { deps } = makeStubDeps();
    deps.costDataManager.setCostData({ regions: { X: { moveCost: 5 } }, locations: {} });
    const gen = new CostGenerator(deps);
    expect(gen.getCosts()).toMatchObject({ regions: { X: { moveCost: 5 } } });
    expect(JSON.parse(gen.exportToJSON())).toMatchObject({ regions: { X: { moveCost: 5 } } });
  });
});

describe('CostGenerator — generate() concurrency guard', () => {
  it('throws when called while a generation is already in progress', async () => {
    const { deps } = makeStubDeps();
    const gen = new CostGenerator(deps);
    gen.isGenerating = true;
    await expect(gen.generate([])).rejects.toThrow('Generation already in progress');
  });
});

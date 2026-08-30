/**
 * Unit tests for CostPlanner's player-slice handling.
 *
 * The planner reads ONE player's slice of a multiworld sphere log against ONE
 * player's static data. Every way those two can disagree used to degrade
 * silently — to zero entries, or to a plan whose locations all belong to
 * somebody else — and the resulting defaults-only cost set is indistinguishable
 * from a legitimate one once it reaches the live store. These tests pin the
 * diagnostics that make the disagreement visible.
 *
 * The full planning walk (explore/check loops, XP, mana) is exercised through
 * the panel and the in-app suite; what's covered here is extraction, counting,
 * reset, and the refusal contract loopUI depends on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CostPlanner } from './costPlanner.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

/** Register (and later remove) sphereState.getCurrentPlayerId. */
function setRegistryPlayerId(id) {
  centralRegistry.publicFunctions.delete('sphereState');
  if (id !== undefined) {
    centralRegistry.registerPublicFunction('sphereState', 'getCurrentPlayerId', () => id);
  }
}

function makeStaticData({ playerId = '1', regions, locations } = {}) {
  return {
    playerId,
    regions: regions || new Map([
      ['Menu', { exits: [{ connected_region: 'Forest', name: 'to Forest' }], locations: [] }],
      ['Forest', { exits: [], locations: [{ name: 'Forest Chest' }] }],
    ]),
    locations: locations || new Map([
      ['Forest Chest', { parent_region: 'Forest', id: 101 }],
    ]),
    eventLocations: {},
  };
}

function makePlanner(staticData = makeStaticData(), startRegions = ['Menu']) {
  return new CostPlanner({
    stateManager: {
      getStaticData: () => staticData,
      getLatestStateSnapshot: () => ({ startRegions }),
    },
    eventBus: null,
  });
}

function sphere(index, playerData) {
  return { type: 'state_update', sphere_index: index, player_data: playerData };
}

describe('CostPlanner — player-slice extraction', () => {
  afterEach(() => setRegistryPlayerId(undefined));

  it('extracts the CURRENT player\'s locations and ignores the other slices', () => {
    setRegistryPlayerId('2');
    const planner = makePlanner();
    const result = planner.loadSphereLog([
      sphere(1, {
        1: { sphere_locations: ['Someone Elses Chest'] },
        2: { sphere_locations: ['Forest Chest'] },
      }),
    ]);

    expect(result.playerId).toBe('2');
    expect(result.entryCount).toBe(1);
    expect(planner.getPlannedSteps()).toEqual([]);
    expect(planner.getLogDiagnostics()).toMatchObject({
      playerId: '2',
      availablePlayers: ['1', '2'],
      stateUpdateCount: 1,
      matchedCount: 1,
    });
    expect(planner.getPlanRejectionReason()).toBeNull();
  });

  it('reports which players the log DOES contain when the slice is missing', () => {
    setRegistryPlayerId('3');
    const planner = makePlanner();
    const result = planner.loadSphereLog([
      sphere(0, { 1: { sphere_locations: [] }, 2: { sphere_locations: ['Forest Chest'] } }),
      sphere(1, { 1: { sphere_locations: ['X'] }, 4: { sphere_locations: ['Y'] } }),
    ]);

    expect(result.entryCount).toBe(0);
    expect(planner.getLogDiagnostics()).toMatchObject({
      playerId: '3',
      availablePlayers: ['1', '2', '4'],
      stateUpdateCount: 2,
      matchedCount: 0,
    });

    const reason = planner.getPlanRejectionReason();
    expect(reason).toContain('no data for player 3');
    expect(reason).toContain('[1, 2, 4]');
  });

  it('falls back to staticData.playerId when sphereState has no id yet', () => {
    setRegistryPlayerId(undefined);
    const planner = makePlanner(makeStaticData({ playerId: '2' }));
    const result = planner.loadSphereLog([
      sphere(1, { 2: { sphere_locations: ['Forest Chest'] } }),
    ]);
    expect(result.playerId).toBe('2');
    expect(result.entryCount).toBe(1);
  });

  it('refuses by name instead of defaulting to player 1 when no id is known', () => {
    setRegistryPlayerId(undefined);
    const planner = makePlanner(makeStaticData({ playerId: null }));
    const result = planner.loadSphereLog([
      sphere(1, { 1: { sphere_locations: ['Forest Chest'] } }),
    ]);

    expect(result.playerId).toBeNull();
    expect(result.entryCount).toBe(0);
    expect(result.playerIdError).toContain('no current player id');
    expect(planner.getLogDiagnostics().error).toContain('no current player id');
    expect(planner.getPlanRejectionReason()).toContain('no current player id');
  });
});

describe('CostPlanner — foreign-location skip counting', () => {
  afterEach(() => setRegistryPlayerId(undefined));

  it('counts sphere-log locations that are absent from this player\'s world', () => {
    setRegistryPlayerId('1');
    const planner = makePlanner();
    planner.loadSphereLog([
      sphere(1, { 1: { sphere_locations: ['Forest Chest', 'Not In This World'] } }),
    ]);
    expect(planner.getTotalEntries()).toBe(2);
    expect(planner.getLocationEntryCount()).toBe(2);

    planner.planAll();

    expect(planner.getSkippedForeignEntries()).toBe(1);
    // One genuine location still planned — not a rejection.
    expect(planner.getPlanRejectionReason()).toBeNull();
  });

  it('rejects the plan when EVERY location belongs to another world', () => {
    setRegistryPlayerId('1');
    const planner = makePlanner();
    planner.loadSphereLog([
      sphere(1, { 1: { sphere_locations: ['Alien A', 'Alien B', 'Alien C'] } }),
    ]);
    planner.planAll();

    expect(planner.getSkippedForeignEntries()).toBe(3);
    const reason = planner.getPlanRejectionReason();
    expect(reason).toContain('All 3 sphere-log locations');
    expect(reason).toContain('wrong player or wrong seed');
  });

  it('does not count phantom (item-only) entries as foreign', () => {
    setRegistryPlayerId('1');
    const planner = makePlanner();
    planner.loadSphereLog([
      sphere(1, {
        1: { sphere_locations: [], new_inventory_details: { base_items: { Sword: 1 } } },
      }),
    ]);
    planner.planAll();

    expect(planner.getTotalEntries()).toBe(1);
    expect(planner.getLocationEntryCount()).toBe(0);
    expect(planner.getSkippedForeignEntries()).toBe(0);
  });
});

describe('CostPlanner — reset()', () => {
  afterEach(() => setRegistryPlayerId(undefined));

  it('clears planned steps and counters', () => {
    setRegistryPlayerId('1');
    const planner = makePlanner();
    planner.loadSphereLog([
      sphere(1, { 1: { sphere_locations: ['Forest Chest', 'Alien A'] } }),
    ]);
    planner.planAll();
    expect(planner.getPlannedSteps().length).toBeGreaterThan(0);
    expect(planner.getSkippedForeignEntries()).toBe(1);

    planner.reset();

    expect(planner.getPlannedSteps()).toEqual([]);
    expect(planner.getSkippedForeignEntries()).toBe(0);
    expect(planner.getSkippedEventEntries()).toBe(0);
    expect(planner.isComplete()).toBe(false);
  });

  it('re-derives entries, start region and adjacency from the CURRENT world', () => {
    setRegistryPlayerId('1');
    // Mutable static data: the planner must not keep the first world's topology.
    const state = { staticData: makeStaticData(), startRegions: ['Menu'] };
    const planner = new CostPlanner({
      stateManager: {
        getStaticData: () => state.staticData,
        getLatestStateSnapshot: () => ({ startRegions: state.startRegions }),
      },
      eventBus: null,
    });
    planner.loadSphereLog([
      sphere(1, { 1: { sphere_locations: ['Forest Chest'] } }),
    ]);
    expect(planner._startRegion).toBe('Menu');
    expect(planner._adjacencyMap.has('Forest')).toBe(true);
    expect(planner.getTotalEntries()).toBe(1);

    // A different world is loaded, and the player switches with it.
    state.startRegions = ['Lobby'];
    state.staticData = makeStaticData({
      playerId: '2',
      regions: new Map([['Lobby', { exits: [], locations: [] }]]),
      locations: new Map(),
    });
    setRegistryPlayerId('2');

    planner.reset();

    expect(planner._startRegion).toBe('Lobby');
    expect(planner._adjacencyMap.has('Forest')).toBe(false);
    // Entries are re-extracted for the NEW player: the log has no slice for 2.
    expect(planner.getTotalEntries()).toBe(0);
    expect(planner.getPlanRejectionReason()).toContain('no data for player 2');
  });
});

describe('CostPlanner — truncation notice', () => {
  afterEach(() => setRegistryPlayerId(undefined));

  it('reports no truncation for a plan that finishes', () => {
    setRegistryPlayerId('1');
    const planner = makePlanner();
    planner.loadSphereLog([sphere(1, { 1: { sphere_locations: ['Forest Chest'] } })]);
    planner.planAll();
    expect(planner.getTruncation()).toBeNull();
  });

  it('records the per-sphere guard when it cuts planning short', () => {
    setRegistryPlayerId('1');
    const planner = makePlanner();
    planner.loadSphereLog([sphere(1, { 1: { sphere_locations: ['Forest Chest'] } })]);
    // A sphere entry that never reaches its CHECK loop (an explore that can
    // never complete) runs the guard out; stubbing the step keeps the test
    // about the bookkeeping rather than about a pathological world.
    planner.planNextStep = () => ({ phase: 'EXPLORE', stepIndex: 0 });

    planner.planCurrentSphere();

    expect(planner.getTruncation()).toEqual({ limit: 1000, scope: 'sphere' });
  });

  it('records the planAll guard and reports it on the allPlanned event', () => {
    setRegistryPlayerId('1');
    const events = [];
    const planner = new CostPlanner({
      stateManager: {
        getStaticData: () => makeStaticData(),
        getLatestStateSnapshot: () => ({ startRegions: ['Menu'] }),
      },
      eventBus: { publish: (name, data) => events.push({ name, data }) },
    });
    planner.loadSphereLog([sphere(1, { 1: { sphere_locations: ['Forest Chest'] } })]);
    planner.planNextStep = () => ({ phase: 'EXPLORE', stepIndex: 0 });

    planner.planAll();

    expect(planner.getTruncation()).toEqual({ limit: 10000, scope: 'all' });
    const allPlanned = events.find(e => e.name === 'loopsCostDebugger:allPlanned');
    expect(allPlanned.data.truncated).toEqual({ limit: 10000, scope: 'all' });
  });
});

/**
 * Entry-shape tests for the runner substrate registry entry (plan
 * §4.7) — the phase-7 gate's unit half. Kept FAST: the default entry's
 * zone table is lazy (generateZoneSet costs seconds), so everything
 * here either reads cheap constants or supplies an explicit fixture
 * zone table; nothing triggers the lazy generation.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    substrateRegistryEntry,
    createRunnerSubstrateEntry,
    setPlaybackProxy,
    setTouchControlsOverride,
    RUNNER_PANEL_COMPONENT_TYPE,
    RUNNER_LOAD_REGION_EVENT,
    RUNNER_IFRAME_ID,
    RUNNER_ZONE_COUNT,
    GATEABLE_ITEMS,
    SWEEP_SATURATING_PROFILES,
    makeExitGateVeto,
    canHostExitGates,
    exitGateVeto,
    backPortalGated,
    hostsSurplusExitsNatively,
    gateHostingHint,
    buildZoneSpecs,
    buildRunnerRegionContract,
} from './runnerDemoLibrary.js';
import {
    RUNNER_LIBRARY_ITEMS, RUNNER_LIBRARY_OBSTACLES, VICTORY_ITEM_NAME,
} from './apRules.js';
import {
    DEFAULT_RUNNER_PROCGEN_PARAMS, buildRunnerRegionParams,
} from './runnerProcgenParams.js';
import { gapJump } from './fixtures.js';

afterEach(() => {
    setPlaybackProxy(null);
    setTouchControlsOverride(undefined);
});

describe('runner substrate registry entry — identity', () => {
    it('declares runner-owned panel identity over the flash base', () => {
        expect(substrateRegistryEntry.id).toBe('runner');
        expect(substrateRegistryEntry.label).toBe('Runner Demo');
        expect(substrateRegistryEntry.panelComponentType).toBe(RUNNER_PANEL_COMPONENT_TYPE);
        expect(substrateRegistryEntry.loadRegionEvent).toBe(RUNNER_LOAD_REGION_EVENT);
        expect(substrateRegistryEntry.iframeId).toBe(RUNNER_IFRAME_ID);
        expect(RUNNER_PANEL_COMPONENT_TYPE).toBe('runnerDemoPanel');
        expect(RUNNER_LOAD_REGION_EVENT).toBe('runner:loadRegion');
        expect(RUNNER_IFRAME_ID).toBe('runnerDemo');
    });

    it('self-registers on library import (headless callers)', () => {
        expect(substrateRegistry.has('runner')).toBe(true);
        expect(substrateRegistry.get('runner')).toBe(substrateRegistryEntry);
    });

    it('is frozen and declares the runner feature set', () => {
        expect(Object.isFrozen(substrateRegistryEntry)).toBe(true);
        expect(substrateRegistryEntry.supportedFeatures)
            .toEqual(['arbitrary_ap_locations', 'runner_abilities']);
    });
});

describe('runner entry — exits-Map de/serializeWorld round-trip', () => {
    const payload = {
        gameId: 'runnerDemo',
        params: { runnerLevel: { id: 'x' }, sidePortals: { E: 'exit_main' } },
        exits: [
            { exitName: 'east', side: 'E', targetRegion: 'r2' },
            { exit_id: 'south_exit', side: 'S' },
        ],
    };

    it('deserializeWorld converts the exits array to a Map keyed by exit name', () => {
        const world = substrateRegistryEntry.deserializeWorld(payload);
        expect(world.exits).toBeInstanceOf(Map);
        expect(world.exits.has('east')).toBe(true);
        expect(world.exits.has('south_exit')).toBe(true);
        expect(world.exits.get('east').targetRegion).toBe('r2');
    });

    it('serializeWorld inverts back to the on-disk array form', () => {
        const world = substrateRegistryEntry.deserializeWorld(payload);
        const out = substrateRegistryEntry.serializeWorld(world);
        expect(Array.isArray(out.exits)).toBe(true);
        expect(out.exits).toEqual(payload.exits);
        expect(out.params).toEqual(payload.params);
    });
});

describe('runner entry — host touch-controls override', () => {
    const payload = { params: { runnerLevel: { id: 'x' } }, exits: [] };

    it('stamps params.touchControls only while the override is set', () => {
        expect(substrateRegistryEntry.deserializeWorld(payload)
            .params.touchControls).toBeUndefined();
        setTouchControlsOverride(true);
        expect(substrateRegistryEntry.deserializeWorld(payload)
            .params.touchControls).toBe(true);
        setTouchControlsOverride(false);
        expect(substrateRegistryEntry.deserializeWorld(payload)
            .params.touchControls).toBe(false);
        setTouchControlsOverride(undefined);
        expect(substrateRegistryEntry.deserializeWorld(payload)
            .params.touchControls).toBeUndefined();
    });

    it('never lets the stamp leak into serialized sidecars', () => {
        setTouchControlsOverride(true);
        const world = substrateRegistryEntry.deserializeWorld(payload);
        expect(world.params.touchControls).toBe(true);
        const out = substrateRegistryEntry.serializeWorld(world);
        expect('touchControls' in out.params).toBe(false);
        expect(out.params).toEqual(payload.params);
    });
});

describe('runner entry — playback + loop support', () => {
    it('getPlaybackController returns the injected proxy (null until phase 8)', () => {
        expect(substrateRegistryEntry.getPlaybackController()).toBeNull();
        const proxy = { walkTo() {} };
        setPlaybackProxy(proxy);
        expect(substrateRegistryEntry.getPlaybackController()).toBe(proxy);
    });

    it('declares the bounce-shaped loop capabilities', () => {
        expect(substrateRegistryEntry.loopSupport).toEqual({
            queueActions: ['regionMove', 'locationCheck'],
            executeVia: 'playbackBot',
            manual: true,
            customQueues: false,
        });
    });
});

describe('runner entry — zone-based build-time hooks', () => {
    it('exposes victoryItem, a constant zoneCount, and the vocabulary libraries', () => {
        expect(substrateRegistryEntry.victoryItem).toBe(VICTORY_ITEM_NAME);
        expect(substrateRegistryEntry.zoneCount).toBe(RUNNER_ZONE_COUNT);
        // The libraries are the apRules.js tables by IDENTITY — the entry
        // must not fork its own copies (import site: apRules.js).
        expect(substrateRegistryEntry.libraryItems).toBe(RUNNER_LIBRARY_ITEMS);
        expect(substrateRegistryEntry.libraryObstacles).toBe(RUNNER_LIBRARY_OBSTACLES);
    });

    it('extractZoneRules rides zoneRules.js (explicit fixture zone table)', () => {
        const entry = createRunnerSubstrateEntry({
            id: 'runner_test_zones',
            zones: [{ level: gapJump, items: { pk_edge: 'Double Jump' } }],
        });
        expect(entry.zoneCount).toBe(1);
        const zone = entry.extractZoneRules(0, {
            region_id: 'region_0_0', exitSides: ['E'],
        });
        expect(zone.locations).toHaveLength(1);
        expect(zone.locations[0]).toMatchObject({ id: 'pk_edge', item: 'Double Jump' });
        expect(zone.exitRules).toHaveProperty('E');
        expect(zone.payload.gameId).toBe('runnerDemo');
        expect(zone.payload.params.runnerLevel.id).toBe('gapJump');
        expect(zone.payload.params.sidePortals).toEqual({ E: 'exit_main' });
        // Physics stamp ALWAYS embedded (zoneRules.js payload contract).
        expect(zone.payload.params.physics).toHaveProperty('profile');
        expect(zone.payload.params.physics).toHaveProperty('constants');
        expect(zone.payload.ap_locations).toEqual({ pk_edge: 'region_0_0__pk_edge' });
    });

    it('out-of-range zone index throws (fail-loudly doctrine)', () => {
        const entry = createRunnerSubstrateEntry({
            id: 'runner_test_range',
            zones: [{ level: gapJump, items: { pk_edge: 'Double Jump' } }],
        });
        expect(() => entry.extractZoneRules(3, {
            region_id: 'r', exitSides: ['E'],
        })).toThrow(/out of range/);
    });
});

describe('runner entry — sphere-growth adapter hooks (plan §4.9)', () => {
    const DJ = 'Double Jump';
    const BLUE = 'Blue Platforms';
    const SPRINGS = 'Springs';

    it('wires the hook set into the entry', () => {
        expect(substrateRegistryEntry.gateableItems).toBe(GATEABLE_ITEMS);
        expect(GATEABLE_ITEMS).toEqual([DJ, BLUE, SPRINGS]);
        expect(substrateRegistryEntry.canHostExitGates).toBe(canHostExitGates);
        expect(substrateRegistryEntry.exitGateVeto).toBe(exitGateVeto);
        expect(substrateRegistryEntry.backPortalGated).toBe(backPortalGated);
        expect(substrateRegistryEntry.hostsSurplusExitsNatively).toBe(hostsSurplusExitsNatively);
        expect(substrateRegistryEntry.gateHostingHint).toBe(gateHostingHint);
        expect(substrateRegistryEntry.buildZoneSpecs).toBe(buildZoneSpecs);
        expect(substrateRegistryEntry.buildRegionContract).toBe(buildRunnerRegionContract);
        expect(typeof substrateRegistryEntry.generateZoneForSpecs).toBe('function');
        expect(typeof substrateRegistryEntry.generateZoneForSpecsGen).toBe('function');
        expect(substrateRegistryEntry.defaultProcgenParams)
            .toBe(DEFAULT_RUNNER_PROCGEN_PARAMS);
        expect(substrateRegistryEntry.buildRegionParams).toBe(buildRunnerRegionParams);
        expect(typeof substrateRegistryEntry.renderProcgenParams).toBe('function');
        // no pre-plan contribution (bounce's arrow has no runner analog)
        expect(substrateRegistryEntry.prepareSphereGrowth).toBeUndefined();
        expect(substrateRegistryEntry.driftItems).toBeUndefined();
    });

    it('backPortalGated is false (ungated early tip) and surplus exits are native', () => {
        expect(backPortalGated({})).toBe(false);
        expect(backPortalGated()).toBe(false);
        expect(hostsSurplusExitsNatively({})).toBe(true);
    });

    it('canHostExitGates: nested chains pass, incomparable gates are vetoed', () => {
        expect(canHostExitGates([], [DJ])).toBe(true);
        expect(canHostExitGates([[DJ]], [DJ, BLUE])).toBe(true);
        expect(canHostExitGates([[DJ, BLUE]], [DJ])).toBe(true);
        expect(canHostExitGates([[DJ]], [DJ])).toBe(true);
        expect(canHostExitGates([[DJ]], [BLUE])).toBe(false);
        expect(canHostExitGates([[DJ], [DJ, BLUE]], [BLUE])).toBe(false);
    });

    it('authored terms (foreign items, count > 1) are structurally free', () => {
        expect(canHostExitGates([[DJ]], ['key_red'])).toBe(true);
        expect(canHostExitGates([[DJ]], [{ item: BLUE, count: 2 }])).toBe(true);
        expect(canHostExitGates([[DJ]], [{ item: BLUE, count: 2 }, DJ])).toBe(true);
        // ...but a count-1 physics part still nests
        expect(canHostExitGates([[DJ]], [{ item: BLUE, count: 1 }])).toBe(false);
    });

    it('sweep-saturating profiles veto ALL physics gates; authored still pass', () => {
        for (const profile of SWEEP_SATURATING_PROFILES) {
            const veto = makeExitGateVeto(profile);
            expect(veto([], [DJ])).toBe(false);
            expect(veto([], [BLUE])).toBe(false);
            expect(veto([], ['key_red'])).toBe(true);
            expect(veto([], [{ item: DJ, count: 2 }])).toBe(true);
        }
        expect(makeExitGateVeto('celeste')([], [DJ])).toBe(true);
    });

    it('exitGateVeto selects by regionParams.runnerPhysicsProfile', () => {
        expect(exitGateVeto({ runnerPhysicsProfile: 'sonic' })([], [DJ])).toBe(false);
        expect(exitGateVeto({ runnerPhysicsProfile: 'celeste' })([], [DJ])).toBe(true);
        expect(exitGateVeto({})([], [DJ])).toBe(true);
        expect(exitGateVeto()([], [DJ])).toBe(true);
    });

    it('gateHostingHint names the saturation veto on saturating profiles', () => {
        expect(gateHostingHint({ runnerPhysicsProfile: 'sonic' })).toMatch(/no physics gates/);
        expect(gateHostingHint({})).toMatch(/nested chain/);
    });

    it('buildZoneSpecs translates the runner regionParams keys, leaving the base otherwise', () => {
        const base = { region_id: 'r', exitSpecs: [], locationSpecs: [], seed: 7 };
        expect(buildZoneSpecs(base, {})).toEqual(base);
        expect(buildZoneSpecs(base, {
            runnerPhysicsProfile: 'nsmbu',
            runnerGapMargin: 0.5,
            runnerHazardDensity: 0.1,
            runnerLengthSteps: 3,
            runnerJitter: 0.4,
            runnerSplitChance: 0.3,
        })).toEqual({
            ...base,
            physicsProfile: 'nsmbu', gapMargin: 0.5, hazardChance: 0.1, stepsBetween: 3,
            jitter: 0.4, splitChance: 0.3,
        });
    });

    it('buildRunnerRegionContract: entrance side joins UNGATED; knobs ride along', () => {
        const contract = buildRunnerRegionContract({
            specs: {
                exitPlans: [{ side: 'E', gate: [DJ], gateCounts: { [DJ]: 1 } }],
                entranceSide: 'W',
            },
            node: { gate: [DJ], items: [{ id: 'it_0', item: 'key_red' }] },
            regionParams: { runnerPhysicsProfile: 'nsmbu', runnerGapMargin: 0.25 },
        });
        expect(contract.exitSpecs).toEqual([
            { side: 'E', requirement: [DJ], counts: { [DJ]: 1 } },
            { side: 'W', requirement: [], counts: {} },
        ]);
        expect(contract.locationSpecs).toEqual([
            { id: 'it_0', item: 'key_red', requirement: [], counts: {} },
        ]);
        expect(contract.physicsProfile).toBe('nsmbu');
        expect(contract.gapMargin).toBe(0.25);
        expect(contract.jitter).toBe(0);
        expect(contract.splitChance).toBe(0);
        expect(contract.entranceSide).toBe('W');
    });

    it('buildRunnerRegionParams: runner-prefixed keys (no collision with bounce)', () => {
        expect(buildRunnerRegionParams({})).toEqual({
            runnerPhysicsProfile: 'celeste',
            runnerGapMargin: 0,
            runnerHazardDensity: 0.35,
            runnerLengthSteps: 2,
            runnerJitter: 0,
            runnerSplitChance: 0,
            runnerCeilingDensity: 0,
            runnerCeilingMargin: 1,
        });
        expect(buildRunnerRegionParams({ params: { runnerGapMargin: 1 } }).runnerGapMargin)
            .toBe(1);
        // the defaults mirror the generator defaults (untouched panel ⇒
        // byte-identical worlds)
        expect(DEFAULT_RUNNER_PROCGEN_PARAMS).toEqual(buildRunnerRegionParams({}));
    });
});

/**
 * Milestone for the unified-substrate-interface refactor (Phase 2d):
 * the BOUNCE substrate — a zone-based substrate — now works through the
 * top-down driver, in a MIXED maze+bounce layout, via the shared
 * generateRegion(spec) contract.
 *
 * Slow because bounce generation is generate-and-test (the verifier is
 * the time sink); runs under vitest.slow.config.js.
 *
 * What this pins:
 *   - The zone region routes through top-down's bidirectional back-exit
 *     pass WITHOUT throwing — the entrance-leak fix (assembleZoneRegion
 *     used to omit playable_payload.entrance, so getRegionEntrance
 *     returned undefined and entranceTile.x threw).
 *   - Exits are keyed by the SOURCE exit_id (not synthesised exit_<side>),
 *     so cross-substrate stitching + back-exit copying resolve.
 *   - A physics ability gate ("Blue platforms") on a bounce exit is
 *     realised as winnable geometry: the realised graph's item spheres
 *     match the source's.
 *
 * See NewDocs/plans/procedural-generation/topdown-bounce-obstacle-refactor.md.
 */

import { describe, it, expect } from 'vitest';

// Side-effect: register the maze + bounce substrates.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import {
    topDownFromRulesJson, buildRulesJson, getRegionEntrance,
} from './procgenPipelineEngine.js';
import { computeItemSpheres } from './spherePlanner.js';

// Hub (maze) → BounceZone (bounce) → End (maze). The bounce region holds
// a "Blue platforms" pickup and its forward exit is gated on it, so the
// zone substrate must realise a physics ability gate. BounceZone is a
// non-start region with both a parent and a child, exercising entrance
// stamping AND the back-exit pass.
function mixedSource() {
    return {
        start_regions: { '1': { default: ['Menu'] } },
        assume_bidirectional_exits: true,
        regions: {
            '1': {
                Menu: {
                    name: 'Menu',
                    exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: { rule: 'True_' } }],
                    locations: [],
                },
                Hub: {
                    name: 'Hub',
                    exits: [
                        { name: 'enterBounce', connected_region: 'BounceZone', access_rule: { rule: 'True_' } },
                    ],
                    locations: [],
                },
                BounceZone: {
                    name: 'BounceZone',
                    exits: [
                        {
                            name: 'leaveBounce',
                            connected_region: 'End',
                            access_rule: { rule: 'Has', args: { item_name: 'Blue platforms' } },
                        },
                    ],
                    locations: [
                        { name: 'Blue Pickup', item: { name: 'Blue platforms' }, access_rule: { rule: 'True_' } },
                    ],
                },
                End: {
                    name: 'End',
                    exits: [],
                    locations: [
                        { name: 'Goal', item: { name: 'Victory' }, access_rule: { rule: 'True_' } },
                    ],
                },
            },
        },
    };
}

describe('top-down — mixed maze + bounce (unified generateRegion contract)', () => {
    const OPTS = {
        gridDims: { width: 5, height: 5 },
        seed: 1,
        substrateByRegion: { Hub: 'maze', BounceZone: 'bounce', End: 'maze' },
    };

    it('realises a bounce region through top-down without throwing (entrance-leak fix)', () => {
        const { grid } = topDownFromRulesJson(mixedSource(), OPTS);
        const bounce = grid.allRegions().find((r) => r.region_id === 'BounceZone');
        expect(bounce).toBeTruthy();
        expect(bounce.substrate).toBe('bounce');
        // The leak fix: zone regions now carry an entrance, so the
        // bidirectional back-exit pass could read it instead of throwing.
        const entrance = getRegionEntrance(bounce);
        expect(entrance).toBeTruthy();
        expect(typeof entrance.x).toBe('number');
        expect(typeof entrance.y).toBe('number');
    });

    it('keys bounce exits by the source exit_id and resolves every target', () => {
        const { grid, startCell } = topDownFromRulesJson(mixedSource(), OPTS);
        const out = buildRulesJson(grid, { startCell });

        // Bounce region present in the emitted sidecars.
        expect(out.preset_sidecars['1'].BounceZone.substrate).toBe('bounce');

        const bounce = out.regions['1'].BounceZone;
        const exitNames = bounce.exits.map((e) => e.name);
        // The source forward exit id survives (NOT exit_<side>); the
        // synthetic back-exit to the BFS parent is keyed by the parent
        // region name.
        expect(exitNames).toContain('leaveBounce');
        expect(exitNames).toContain('Hub');
        expect(exitNames.some((n) => /^exit_[NSEW]$/.test(n))).toBe(false);

        // Cross-substrate stitching: no dangling in-grid exits anywhere.
        for (const region of Object.values(out.regions['1'])) {
            for (const exit of region.exits) {
                expect(exit.connected_region).toBeTruthy();
            }
        }
    });

    it('preserves the source item-reachability spheres (physics gate realised)', () => {
        const source = mixedSource();
        const { grid, startCell } = topDownFromRulesJson(source, OPTS);
        const out = buildRulesJson(grid, { startCell });
        // The bounce exit's "Blue platforms" gate is preserved verbatim
        // and the pickup remains reachable inside the zone, so the
        // realised graph reproduces the source's item spheres exactly.
        expect(computeItemSpheres(out)).toEqual(computeItemSpheres(source));
    });
});

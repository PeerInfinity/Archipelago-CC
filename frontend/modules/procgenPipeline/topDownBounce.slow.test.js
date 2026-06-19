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

import { describe, it, expect, vi } from 'vitest';

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

// A bounce Hub with FOUR trivial forward exits. A bounce region hosts at
// most one arrowless ("column top") exit, so realising this without help
// throws "at most one arrowless-gated exit". The fix: the caller marks the
// substrate's drift arrows as FREE (granted as starting items), and the
// zone realiser puts the surplus exits on those free arrow drifts.
function fourExitBounceSource() {
    const leaf = (name) => ({
        name,
        exits: [],
        locations: [{ name: `${name} Loc`, item: { name: `${name} Item` }, access_rule: { rule: 'True_' } }],
    });
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
                        { name: 'toN', connected_region: 'RoomN', access_rule: { rule: 'True_' } },
                        { name: 'toE', connected_region: 'RoomE', access_rule: { rule: 'True_' } },
                        { name: 'toW', connected_region: 'RoomW', access_rule: { rule: 'True_' } },
                        { name: 'toS', connected_region: 'RoomS', access_rule: { rule: 'True_' } },
                    ],
                    locations: [],
                },
                RoomN: leaf('RoomN'),
                RoomE: leaf('RoomE'),
                RoomW: leaf('RoomW'),
                RoomS: leaf('RoomS'),
            },
        },
    };
}

describe('top-down — bounce region with surplus arrowless exits (free-arrow drifts)', () => {
    const OPTS = {
        gridDims: { width: 6, height: 6 },
        seed: 1,
        substrateByRegion: {
            Hub: 'bounce', RoomN: 'maze', RoomE: 'maze', RoomW: 'maze', RoomS: 'maze',
        },
    };

    it('throws without free drift items (a bounce region hosts one arrowless exit)', () => {
        expect(() => topDownFromRulesJson(fourExitBounceSource(), OPTS))
            .toThrow(/at most one arrowless/);
    });

    it('realises four trivial bounce exits when the drift arrows are free', () => {
        const source = fourExitBounceSource();
        const { grid, startCell } = topDownFromRulesJson(source, {
            ...OPTS,
            freeItems: ['Left arrow', 'Right arrow'],
        });
        const out = buildRulesJson(grid, { startCell });

        // The Hub realised as bounce with all four forward exits present.
        const hub = out.regions['1'].Hub;
        expect(out.preset_sidecars['1'].Hub.substrate).toBe('bounce');
        for (const name of ['toN', 'toE', 'toW', 'toS']) {
            expect(hub.exits.map((e) => e.name)).toContain(name);
        }

        // The free arrow rode only the physics geometry: every forward
        // exit's emitted LOGIC stays the trivial source rule (compileRegion
        // prefers the source access_rule over the synthesised drift paths).
        for (const name of ['toN', 'toE', 'toW', 'toS']) {
            const exit = hub.exits.find((e) => e.name === name);
            expect(exit.access_rule).toEqual({ rule: 'True_' });
        }

        // Logic unchanged end-to-end: the realised world reproduces the
        // source's item spheres (no arrow gate leaked into reachability).
        expect(computeItemSpheres(out)).toEqual(computeItemSpheres(source));
    });

    it('drifts surplus exits whose gate is a non-substrate authored lock', () => {
        // The Adventure shape: each Hub exit is gated on a plain item (a
        // key, NOT a bounce ability, and NOT free). Its PHYSICS core is
        // empty — the gate realises as an authored lock with no geometry —
        // so the exit drifts freely on a free arrow even though the gate
        // item itself isn't free. This is the case a naive "requirement
        // covered by free items" rule would wrongly reject.
        const dirs = ['N', 'E', 'W', 'S'];
        const source = {
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
                        exits: dirs.map((d) => ({
                            name: `to${d}`,
                            connected_region: `Room${d}`,
                            access_rule: { rule: 'Has', args: { item_name: `Relic ${d}` } },
                        })),
                        // The gate items live in the Hub, so they're not free
                        // starting items — yet the exits must still drift.
                        locations: dirs.map((d) => ({
                            name: `Relic ${d} Loc`, item: { name: `Relic ${d}` }, access_rule: { rule: 'True_' },
                        })),
                    },
                    ...Object.fromEntries(dirs.map((d) => [`Room${d}`, {
                        name: `Room${d}`,
                        exits: [],
                        locations: [{ name: `${d} Goal`, item: { name: `${d} Item` }, access_rule: { rule: 'True_' } }],
                    }])),
                },
            },
        };
        const { grid, startCell } = topDownFromRulesJson(source, {
            ...OPTS,
            substrateByRegion: {
                Hub: 'bounce', RoomN: 'maze', RoomE: 'maze', RoomW: 'maze', RoomS: 'maze',
            },
            freeItems: ['Left arrow', 'Right arrow'],
        });
        const out = buildRulesJson(grid, { startCell });

        // Each forward exit keeps its authored key gate verbatim — the
        // free arrow rode only the geometry, never the emitted logic.
        const hub = out.regions['1'].Hub;
        for (const d of dirs) {
            const exit = hub.exits.find((e) => e.name === `to${d}`);
            expect(exit.access_rule).toEqual({ rule: 'Has', args: { item_name: `Relic ${d}` } });
        }

        // The bounce payload's ap_locations — which the bridge resolves an
        // in-game objective through to fire user:locationCheck — must point
        // at the names the stateManager registered. Top-down uses the source
        // location name (not the substrate's `region__id`), so every
        // ap_locations VALUE must be a real compiled location in the region
        // (else: location_not_found on every bounce pickup).
        const hubLocNames = new Set(hub.locations.map((l) => l.name));
        const apLocations = out.preset_sidecars['1'].Hub.playable_payload.ap_locations ?? {};
        expect(Object.keys(apLocations).length).toBeGreaterThan(0);
        for (const apName of Object.values(apLocations)) {
            expect(hubLocNames.has(apName)).toBe(true);
        }
        // The key→room gating still holds: each room item sits one sphere
        // behind its key, exactly as in the source.
        expect(computeItemSpheres(out)).toEqual(computeItemSpheres(source));
    });

    it('realises a multi-exit region as a BRAID (no spurious "both arrows" fallback)', () => {
        // Top-down + braid layout on a 4-way Hub. The free-arrow drift is a
        // COLUMN device; in braid mode it used to inject left+right into the exit
        // requirements, tripping planBraidGatedChain's "cannot gate both arrows"
        // and silently falling back to a column. The fork braid hosts every exit
        // natively on free arrows, so it must realise AS a braid — no warning,
        // source logic intact.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const source = fourExitBounceSource();
            const { grid, startCell } = topDownFromRulesJson(source, {
                ...OPTS,
                freeItems: ['Left arrow', 'Right arrow'],
                regionParams: { maxIterations: 0, bounceMode: 'braid', braidWidth: 240 },
            });
            const out = buildRulesJson(grid, { startCell });

            // The braid-vocabulary fallback never fired.
            const warnings = warn.mock.calls.map((c) => String(c[0]));
            expect(warnings.some((w) => /braid vocabulary|cannot gate both arrows/.test(w)))
                .toBe(false);

            // Realised AS a braid: a braid carries teleport-to-start hosts; the
            // column proposer emits none. All four forward exits present.
            const payload = out.preset_sidecars['1'].Hub.playable_payload;
            expect(payload.params.bounceLevel.teleports.length).toBeGreaterThan(0);
            const hub = out.regions['1'].Hub;
            for (const name of ['toN', 'toE', 'toW', 'toS']) {
                expect(hub.exits.map((e) => e.name)).toContain(name);
            }
            // Logic unchanged: source item spheres reproduced (no arrow gate leaked).
            expect(computeItemSpheres(out)).toEqual(computeItemSpheres(source));
        } finally {
            warn.mockRestore();
        }
    });
});

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

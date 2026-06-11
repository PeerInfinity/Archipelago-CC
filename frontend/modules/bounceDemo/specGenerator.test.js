/**
 * Multi-target generation (sphere-driven growth, step 2): the
 * prefix-graded chain. Every goal — pickups at their rung, arrow exits
 * as branch tips, an arrowless exit on the column top — must derive
 * EXACTLY its spec'd requirement; the same deriveAccessRules verifier
 * gatekeeps as for single-target generation.
 */
import { describe, it, expect } from 'vitest';
import { generateLevelFromSpecs } from './generator.js';
import { PROFILES } from './physics.js';
import {
    generateZoneForSpecs, canHostExitGates, GATEABLE_ITEMS,
    substrateRegistryEntry,
} from './bounceDemoLibrary.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';

const expectGoals = (level, { exits = {}, pickups = {} }) => {
    expect(validateLevel(level)).toEqual([]);
    const derived = deriveAccessRules(level);
    expect(derived.defects).toEqual([]);
    for (const [id, req] of Object.entries(pickups)) {
        expect(derived.pickups[id].minimalSets).toEqual([[...req].sort()]);
    }
    for (const [id, req] of Object.entries(exits)) {
        expect(derived.exits[id].minimalSets).toEqual([[...req].sort()]);
    }
};

describe('generateLevelFromSpecs', () => {
    it('reproduces the single-target shape (arrowless exit on top)', () => {
        const level = generateLevelFromSpecs({
            id: 't0',
            exitSpecs: [{ id: 'exit_up', requirement: ['springs'] }],
            pickupSpecs: [{ id: 'loc_0', requirement: ['springs'] }],
            seed: 1,
        });
        expectGoals(level, {
            exits: { exit_up: ['springs'] },
            pickups: { loc_0: ['springs'] },
        });
    });

    it('grades goals along the chain (the prefix property)', () => {
        const level = generateLevelFromSpecs({
            id: 'graded',
            exitSpecs: [
                { id: 'e_right', requirement: ['right'] },
                { id: 'e_deep', requirement: ['right', 'springs'] },
            ],
            pickupSpecs: [
                { id: 'p_free', requirement: [] },
                { id: 'p_mid', requirement: ['right'] },
                { id: 'p_deep', requirement: ['right', 'springs'] },
            ],
            seed: 1,
        });
        expectGoals(level, {
            exits: { e_right: ['right'], e_deep: ['right', 'springs'] },
            pickups: { p_free: [], p_mid: ['right'], p_deep: ['right', 'springs'] },
        });
    });

    it('mixes an arrowless top exit with branch exits exceeding it by a drift arrow', () => {
        // F = {springs}; e_branch = {springs, right} exceeds F by 'right'.
        const level = generateLevelFromSpecs({
            id: 'mixed',
            exitSpecs: [
                { id: 'e_top', requirement: ['springs'] },
                { id: 'e_branch', requirement: ['springs', 'right'] },
                { id: 'e_left', requirement: ['left'] },
            ],
            pickupSpecs: [
                { id: 'p_free', requirement: [] },
                { id: 'p_spring', requirement: ['springs'] },
            ],
            seed: 2,
        });
        expectGoals(level, {
            exits: {
                e_top: ['springs'],
                e_branch: ['springs', 'right'],
                e_left: ['left'],
            },
            pickups: { p_free: [], p_spring: ['springs'] },
        });
    });

    it('handles every gate ability inside a graded chain across seeds', () => {
        for (const seed of [1, 2, 3]) {
            const level = generateLevelFromSpecs({
                id: `all_${seed}`,
                exitSpecs: [
                    { id: 'e_a', requirement: ['right'] },
                    { id: 'e_b', requirement: ['right', 'blue'] },
                    { id: 'e_c', requirement: ['right', 'blue', 'jetpacks', 'left'] },
                ],
                pickupSpecs: [
                    { id: 'p_a', requirement: [] },
                    { id: 'p_b', requirement: ['right', 'blue'] },
                ],
                seed,
            });
            expectGoals(level, {
                exits: {
                    e_a: ['right'],
                    e_b: ['right', 'blue'],
                    e_c: ['right', 'blue', 'jetpacks', 'left'],
                },
                pickups: { p_a: [], p_b: ['right', 'blue'] },
            });
        }
    }, 60000);

    it('places several same-requirement branch exits on distinct slots', () => {
        const level = generateLevelFromSpecs({
            id: 'multi',
            exitSpecs: [
                { id: 'e_1', requirement: ['right'] },
                { id: 'e_2', requirement: ['right'] },
                { id: 'e_3', requirement: ['right'] },
            ],
            seed: 1,
        });
        expectGoals(level, {
            exits: { e_1: ['right'], e_2: ['right'], e_3: ['right'] },
        });
        const hosts = level.portals.map((p) => p.on);
        expect(new Set(hosts).size).toBe(3);
    });

    it('keeps the spawn column at width/2 with dynamic width', () => {
        const level = generateLevelFromSpecs({
            id: 'wide',
            exitSpecs: [
                { id: 'e_lr', requirement: ['left', 'right'] },
            ],
            seed: 1,
        });
        // entrance platform is the first placed and sits on the spawn column
        expect(level.platforms[0].x).toBe(level.size.width / 2);
        expectGoals(level, { exits: { e_lr: ['left', 'right'] } });
    });

    it('is deterministic for a given seed', () => {
        const args = {
            id: 'd',
            exitSpecs: [{ id: 'e', requirement: ['right', 'springs'] }],
            pickupSpecs: [{ id: 'p', requirement: ['right'] }],
            seed: 7,
        };
        expect(generateLevelFromSpecs(args)).toEqual(generateLevelFromSpecs(args));
    });

    it('realizes incomparable branch-exit requirements via drift fallback', () => {
        // {left,springs} and {right,springs} don't nest as full sets,
        // but one attaches at its own segment and the other drops its
        // arrow onto the drift — both derive exactly.
        const level = generateLevelFromSpecs({
            id: 'incomparable',
            exitSpecs: [
                { id: 'e1', requirement: ['left', 'springs'] },
                { id: 'e2', requirement: ['right', 'springs'] },
            ],
            seed: 1,
        });
        expectGoals(level, {
            exits: { e1: ['left', 'springs'], e2: ['right', 'springs'] },
        });
    });

    describe('spec validation (the decline channel)', () => {
        it('rejects non-nested column goals (pickups)', () => {
            expect(() => generateLevelFromSpecs({
                id: 'x',
                exitSpecs: [{ id: 'e', requirement: ['springs', 'jetpacks', 'right'] }],
                pickupSpecs: [
                    { id: 'p1', requirement: ['springs'] },
                    { id: 'p2', requirement: ['jetpacks'] },
                ],
            })).toThrow(/nested chain/);
        });

        it('rejects two arrowless exits', () => {
            expect(() => generateLevelFromSpecs({
                id: 'x',
                exitSpecs: [
                    { id: 'e1', requirement: [] },
                    { id: 'e2', requirement: ['springs'] },
                ],
            })).toThrow(/at most one arrowless/);
        });

        it('rejects pickups above the arrowless top exit', () => {
            expect(() => generateLevelFromSpecs({
                id: 'x',
                exitSpecs: [{ id: 'e_top', requirement: [] }],
                pickupSpecs: [{ id: 'p', requirement: ['springs'] }],
            })).toThrow(/above the top portal/);
        });

        it('rejects exits exceeding the arrowless exit by more than a drift arrow', () => {
            // F = []: e_far's springs gate would have to sit above the
            // top portal — no attach key fits below it.
            expect(() => generateLevelFromSpecs({
                id: 'x',
                exitSpecs: [
                    { id: 'e_top', requirement: [] },
                    { id: 'e_far', requirement: ['springs', 'right'] },
                ],
            })).toThrow(/no drift arrow whose attach key fits/);
        });

        it('rejects unknown abilities, missing exits, duplicate ids', () => {
            expect(() => generateLevelFromSpecs({
                id: 'x',
                exitSpecs: [{ id: 'e', requirement: ['warp'] }],
            })).toThrow(/unknown ability 'warp'/);
            expect(() => generateLevelFromSpecs({ id: 'x', exitSpecs: [] }))
                .toThrow(/at least one exit/);
            expect(() => generateLevelFromSpecs({
                id: 'x',
                exitSpecs: [
                    { id: 'e', requirement: [] },
                    { id: 'e', requirement: [] },
                ],
            })).toThrow(/duplicate goal id/);
        });
    });
});

describe('generateZoneForSpecs (adapter hook)', () => {
    const SPECS = {
        region_id: 'region_2_1',
        exitSpecs: [
            { side: 'N', requirement: ['Springs'] },
            { side: 'E', requirement: ['Springs', 'Right arrow'] },
        ],
        locationSpecs: [
            { id: 'loc_a', item: 'Jetpacks', requirement: [] },
            { id: 'loc_b', item: 'Blue platforms', requirement: ['Springs'] },
        ],
        seed: 3,
    };

    it('returns the zone-locations channel shape with derived rules', () => {
        const zone = generateZoneForSpecs(SPECS);

        expect(zone.exitRules.N).toEqual({
            rule: 'Has', args: { item_name: 'Springs' },
        });
        expect(zone.exitRules.E).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'Right arrow' } },
                { rule: 'Has', args: { item_name: 'Springs' } },
            ],
        });

        expect(zone.locations).toEqual([
            {
                id: 'loc_a', item: 'Jetpacks', position: null,
                access_rule: { rule: 'True_' },
            },
            {
                id: 'loc_b', item: 'Blue platforms', position: null,
                access_rule: { rule: 'Has', args: { item_name: 'Springs' } },
            },
        ]);

        // payload rides the flash bridge contract
        expect(zone.payload.gameId).toBe('bounceDemo');
        expect(zone.payload.params.sidePortals).toEqual({
            N: 'side_exit_N', E: 'side_exit_E',
        });
        expect(zone.payload.ap_locations).toEqual({
            loc_a: 'region_2_1__loc_a',
            loc_b: 'region_2_1__loc_b',
        });
        expect(validateLevel(zone.payload.params.bounceLevel)).toEqual([]);
    });

    it('is deterministic for a given seed', () => {
        expect(generateZoneForSpecs(SPECS)).toEqual(generateZoneForSpecs(SPECS));
    });

    it('omits gate_rules when no spec carries authored terms', () => {
        expect(generateZoneForSpecs(SPECS).payload.gate_rules).toBeUndefined();
    });

    it('declines unknown sides', () => {
        expect(() => generateZoneForSpecs({
            region_id: 'r',
            exitSpecs: [{ side: 'Q', requirement: [] }],
        })).toThrow(/unknown exit side 'Q'/);
    });

    it('keeps the six abilities as the PHYSICS vocabulary; registry declares full vocabulary', () => {
        expect([...GATEABLE_ITEMS].sort()).toEqual([
            'Blue platforms', 'Brown platforms', 'Jetpacks',
            'Left arrow', 'Right arrow', 'Springs',
        ]);
        // Rule-gated portals make every AP item gateable (authored terms).
        expect(substrateRegistryEntry.gateableItems).toBeNull();
    });
});

describe('generateZoneForSpecs — authored gate terms (rule-gated portals/pickups)', () => {
    it('a non-ability exit gate becomes an authored lock: composed rule + gate_rules', () => {
        const zone = generateZoneForSpecs({
            region_id: 'r_key',
            exitSpecs: [{ side: 'N', requirement: ['key_red'] }],
            seed: 1,
        });
        // No physics part: the emitted rule is the authored term alone.
        expect(zone.exitRules.N).toEqual({
            rule: 'Has', args: { item_name: 'key_red' },
        });
        // The authored lock rides the payload for the host bridge.
        expect(zone.payload.gate_rules).toEqual({
            portals: { side_exit_N: { rule: 'Has', args: { item_name: 'key_red' } } },
            pickups: {},
        });
        // The level itself realises a plain (physics-free) exit.
        const derived = deriveAccessRules(zone.payload.params.bounceLevel);
        expect(derived.exits.side_exit_N.minimalSets).toEqual([[]]);
    });

    it('mixed gate: physics AND authored compose on the emitted rule', () => {
        const zone = generateZoneForSpecs({
            region_id: 'r_mix',
            exitSpecs: [{ side: 'E', requirement: ['Springs', 'Right arrow', 'key_blue'] }],
            seed: 2,
        });
        expect(zone.exitRules.E).toEqual({
            rule: 'And',
            children: [
                {
                    rule: 'And',
                    children: [
                        { rule: 'Has', args: { item_name: 'Right arrow' } },
                        { rule: 'Has', args: { item_name: 'Springs' } },
                    ],
                },
                { rule: 'Has', args: { item_name: 'key_blue' } },
            ],
        });
        expect(zone.payload.gate_rules.portals.side_exit_E).toEqual({
            rule: 'Has', args: { item_name: 'key_blue' },
        });
        // Physics part verified as geometry: the portal derives the abilities.
        const derived = deriveAccessRules(zone.payload.params.bounceLevel);
        expect(derived.exits.side_exit_E.minimalSets).toEqual([['right', 'springs']]);
    });

    it('a count > 1 ability gate is authored, not physics (count gates on bounce)', () => {
        const zone = generateZoneForSpecs({
            region_id: 'r_count',
            exitSpecs: [{ side: 'N', requirement: ['Springs'], counts: { Springs: 2 } }],
            seed: 1,
        });
        expect(zone.exitRules.N).toEqual({
            rule: 'Has', args: { item_name: 'Springs', count: 2 },
        });
        expect(zone.payload.gate_rules.portals.side_exit_N).toEqual({
            rule: 'Has', args: { item_name: 'Springs', count: 2 },
        });
        const derived = deriveAccessRules(zone.payload.params.bounceLevel);
        expect(derived.exits.side_exit_N.minimalSets).toEqual([[]]);
    });

    it('rule-gated pickups: authored terms on locationSpecs (internalRequirement plumbing)', () => {
        const zone = generateZoneForSpecs({
            region_id: 'r_loc',
            exitSpecs: [{ side: 'N', requirement: [] }],
            locationSpecs: [
                { id: 'loc_gated', item: 'victory', requirement: ['key_red'] },
                { id: 'loc_free', item: 'Springs', requirement: [] },
            ],
            seed: 1,
        });
        const gated = zone.locations.find((l) => l.id === 'loc_gated');
        expect(gated.access_rule).toEqual({
            rule: 'Has', args: { item_name: 'key_red' },
        });
        expect(zone.payload.gate_rules.pickups).toEqual({
            loc_gated: { rule: 'Has', args: { item_name: 'key_red' } },
        });
        const free = zone.locations.find((l) => l.id === 'loc_free');
        expect(free.access_rule).toEqual({ rule: 'True_' });
    });

    it('two wholly-authored exits still violate the arrowless-slot structure', () => {
        // Once unlocked, an on-column portal swallows every climb past
        // it — so authored-only gates still compete for the single
        // column-top slot, in the generator and the veto alike.
        expect(() => generateZoneForSpecs({
            region_id: 'r_two',
            exitSpecs: [
                { side: 'N', requirement: ['key_red'] },
                { side: 'E', requirement: ['key_blue'] },
            ],
            seed: 1,
        })).toThrow(/at most one arrowless/);
        expect(canHostExitGates([['key_red']], ['key_blue'])).toBe(false);
    });

    it('canHostExitGates runs the structural veto on physics parts only', () => {
        // Authored terms are structurally free: a key gate + an
        // arrow-drift key gate coexist (the arrow makes it a branch tip).
        expect(canHostExitGates([['key_red']], ['Left arrow', 'key_blue'])).toBe(true);
        // {item, count} terms: count > 1 abilities are authored, so
        // this is two physics-arrowless gates — rejected.
        expect(canHostExitGates(
            [[{ item: 'Springs', count: 2 }]], ['key_red'])).toBe(false);
        // Unknown items no longer reject by vocabulary.
        expect(canHostExitGates([], ['key_red'])).toBe(true);
    });
});

describe('generateZoneForSpecs — physics profile stamp', () => {
    const SPECS = {
        region_id: 'region_p',
        exitSpecs: [{ side: 'N', requirement: [] }],
        locationSpecs: [{ id: 'loc_p', item: 'Springs', requirement: [] }],
        seed: 3,
    };

    it('classic stamps NOTHING — params.physics absent, explicit === default', () => {
        const zone = generateZoneForSpecs(SPECS);
        expect('physics' in zone.payload.params).toBe(false);
        expect(generateZoneForSpecs({ ...SPECS, physicsProfile: 'classic' }))
            .toEqual(zone);
    });

    it('dj stamps { profile, constants } and still derives verified rules', () => {
        const zone = generateZoneForSpecs({ ...SPECS, physicsProfile: 'dj' });
        const stamp = zone.payload.params.physics;
        expect(stamp.profile).toBe('dj');
        expect(stamp.constants.AIR_CONTROL).toBe('flat');
        expect(stamp.constants.GRAVITY).toBeDefined();
        expect(zone.exitRules.N).toEqual({ rule: 'True_' });
        expect(validateLevel(zone.payload.params.bounceLevel)).toEqual([]);
    });

    it('unknown profile fails loudly', () => {
        expect(() => generateZoneForSpecs({ ...SPECS, physicsProfile: 'moon' }))
            .toThrow(/moon/);
    });
});

// ── dj behaviors: colors ride the goal's host platform ──────────────
describe('generateLevelFromSpecs — dj color-as-host mode', () => {
    const DJ = PROFILES.dj.constants;

    const derivedSets = (level) => {
        const d = deriveAccessRules(level, { constants: DJ });
        expect(d.defects).toEqual([]);
        const sets = {};
        for (const [id, a] of Object.entries(d.exits)) sets[id] = a.minimalSets;
        for (const [id, a] of Object.entries(d.pickups)) sets[id] = a.minimalSets;
        return sets;
    };

    it('blue arrowless exit = swept blue host at the column top (∃-phase reachable)', () => {
        const level = generateLevelFromSpecs({
            id: 'dj_blue_top',
            exitSpecs: [
                { id: 'exit_top', requirement: ['blue'] },
                { id: 'exit_e', requirement: ['right'] },
            ],
            pickupSpecs: [{ id: 'loc_a', requirement: [] }],
            physics: 'dj',
            seed: 3,
        });
        const blues = level.platforms.filter((p) => p.type === 'blue');
        expect(blues).toHaveLength(1);
        expect(blues[0].sweep.max - blues[0].sweep.min).toBe(60); // ±BLUE_SWEEP_AMP
        // blue-after-green by construction: the host's exit portal rides it
        const topPortal = level.portals.find((pt) => pt.id === 'exit_top');
        expect(topPortal.on).toBe(blues[0].id);
        expect(derivedSets(level)).toEqual({
            exit_top: [['blue']],
            exit_e: [['right']],
            loc_a: [[]],
        });
    });

    it('brown + arrow exit = breaking brown host on a branch tip', () => {
        const level = generateLevelFromSpecs({
            id: 'dj_brown_tip',
            exitSpecs: [
                { id: 'exit_top', requirement: [] },
                { id: 'exit_w', requirement: ['brown', 'left'] },
            ],
            physics: 'dj',
            seed: 5,
        });
        const tipPortal = level.portals.find((pt) => pt.id === 'exit_w');
        const host = level.platforms.find((p) => p.id === tipPortal.on);
        expect(host.type).toBe('brown');
        expect(derivedSets(level)).toEqual({
            exit_top: [[]],
            exit_w: [['brown', 'left']],
        });
    });

    it('declines: two arrowless colored goals; blue AND brown on one goal', () => {
        expect(() => generateLevelFromSpecs({
            id: 'x',
            exitSpecs: [{ id: 'e', requirement: ['blue'] }],
            pickupSpecs: [{ id: 'p', requirement: ['brown'] }],
            physics: 'dj',
        })).toThrow(/at most one arrowless colored goal/);
        expect(() => generateLevelFromSpecs({
            id: 'x',
            exitSpecs: [{ id: 'e', requirement: ['blue', 'brown'] }],
            physics: 'dj',
        })).toThrow(/both blue.*and brown|blue and brown/);
    });

    it('classic keeps colored stepping-stone gates (no sweep, no host coloring rules)', () => {
        const level = generateLevelFromSpecs({
            id: 'classic_blue',
            exitSpecs: [{ id: 'exit_top', requirement: ['blue'] }],
            seed: 3,
        });
        const blues = level.platforms.filter((p) => p.type === 'blue');
        expect(blues.length).toBeGreaterThan(0);
        expect(blues.every((p) => !p.sweep)).toBe(true); // static stones
    });
});

describe('generateZoneForSpecs — dj profile end-to-end', () => {
    it('generates, verifies and stamps a dj zone with a blue-gated exit', () => {
        const zone = generateZoneForSpecs({
            region_id: 'region_dj',
            exitSpecs: [
                { side: 'N', requirement: ['Blue platforms'] },
                { side: 'E', requirement: ['Right arrow'] },
            ],
            locationSpecs: [{ id: 'loc_0', item: 'Springs', requirement: [] }],
            seed: 7,
            physicsProfile: 'dj',
        });
        expect(zone.exitRules.N).toEqual({ rule: 'Has', args: { item_name: 'Blue platforms' } });
        expect(zone.exitRules.E).toEqual({ rule: 'Has', args: { item_name: 'Right arrow' } });
        const stamp = zone.payload.params.physics;
        expect(stamp.profile).toBe('dj');
        expect(stamp.constants.TICK_HZ).toBe(20);
        const level = zone.payload.params.bounceLevel;
        expect(level.platforms.some((p) => p.type === 'blue' && p.sweep)).toBe(true);
        expect(validateLevel(level)).toEqual([]);
    });
});

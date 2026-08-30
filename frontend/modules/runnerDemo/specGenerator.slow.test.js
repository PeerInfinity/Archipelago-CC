/**
 * Spec-driven generation slow gates (plan §4.9): sphere-shaped specs
 * (ungated entrance back portal + gated forward exits + free pickups)
 * generate-and-verify with EXACT per-goal derivation, the early-tip
 * back-portal geometry, gapMargin still verifying at the cap,
 * byte-identical determinism, and the assembleRunnerRegion emission
 * tail (authored logic_gate locks riding rules, paths, and
 * gate_rules). Run via `npm run test:unit:slow` (the default vitest
 * config excludes *.slow.test.js).
 */

import { describe, it, expect } from 'vitest';
import {
    generateLevelForSpecs, generateLevelForSpecsGen, deriveGeneratedRules,
} from './generator.js';
import { assembleRunnerRegion } from './zoneRules.js';
import { DEFAULTS } from './physics.js';
import { validateLevel } from './level.js';

// The sphere engine's canonical region shape: an ungated entrance-side
// back portal (the player spawns past it), gated forward exits forming
// a nested chain, requirement-free item pickups.
const SPHERE_SPEC = {
    id: 'spec_sphere',
    exitSpecs: [
        { key: 'E', requirement: ['doubleJump'] },
        { key: 'S', requirement: ['doubleJump', 'blue'] },
        { key: 'W', requirement: [] },
    ],
    pickupSpecs: [
        { id: 'it_a', requirement: [] },
        { id: 'it_b', requirement: [] },
    ],
};

describe('generateLevelForSpecs', () => {
    it('sphere-shaped spec: every goal derives EXACTLY its requirement', () => {
        for (const seed of [1, 2, 3]) {
            const { level, derived, portalByKey } = generateLevelForSpecs({
                ...SPHERE_SPEC, seed,
            });
            expect(validateLevel(level, DEFAULTS), `seed ${seed}`).toEqual([]);
            expect(portalByKey).toEqual({ S: 'exit_main', W: 'exit_br0', E: 'exit_br1' });
            expect(derived.exits.exit_br0.minimalSets).toEqual([[]]);
            expect(derived.exits.exit_br1.minimalSets).toEqual([['doubleJump']]);
            expect(derived.exits.exit_main.minimalSets).toEqual([['blue', 'doubleJump']]);
            expect(derived.pickups.it_a.minimalSets).toEqual([[]]);
            expect(derived.pickups.it_b.minimalSets).toEqual([[]]);
            // the cached derivation IS the re-derived truth
            const rederived = deriveGeneratedRules(level, DEFAULTS);
            expect(rederived.defects).toEqual([]);
            expect(JSON.stringify(rederived.exits.exit_main.minimalSets))
                .toBe(JSON.stringify(derived.exits.exit_main.minimalSets));
        }
    }, 120000);

    it('the ungated back portal is an EARLY tip: left of every gate gap', () => {
        const { level } = generateLevelForSpecs({ ...SPHERE_SPEC, seed: 1 });
        const backPortal = level.portals.find((p) => p.id === 'exit_br0');
        const djPortal = level.portals.find((p) => p.id === 'exit_br1');
        const stone = level.platforms.find((p) => p.type === 'blue');
        expect(backPortal.x).toBeLessThan(djPortal.x);
        expect(djPortal.x).toBeLessThan(stone.x);
        // spawns PAST it is the contract's wording: the portal rides an
        // elevated tip, so the spawn (ground level, x=1) never touches it
        expect(level.spawn).toEqual({ x: 1, y: 1 });
        const tip = level.platforms.find((p) => p.id === backPortal.on);
        expect(tip.y).toBeGreaterThan(1);
    }, 60000);

    it('gapMargin 1 (the coyote-aware cap) still verifies', () => {
        const { level, derived } = generateLevelForSpecs({
            id: 'spec_margin',
            exitSpecs: [{ key: 'E', requirement: ['doubleJump'] }],
            pickupSpecs: [{ id: 'p0', requirement: [] }],
            gapMargin: 1,
            seed: 2,
        });
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
        expect(derived.exits.exit_main.minimalSets).toEqual([['doubleJump']]);
    }, 60000);

    it('same seed ⇒ byte-identical level; the Gen form yields attempt events', () => {
        const a = generateLevelForSpecs({ ...SPHERE_SPEC, seed: 4 });
        const gen = generateLevelForSpecsGen({ ...SPHERE_SPEC, seed: 4 });
        const events = [];
        let r = gen.next();
        while (!r.done) { events.push(r.value); r = gen.next(); }
        expect(JSON.stringify(r.value.level)).toBe(JSON.stringify(a.level));
        expect(events.length).toBeGreaterThan(0);
        expect(events[0]).toEqual({ type: 'attempt', attempt: 1, attempts: 8 });
    }, 120000);
});

describe('assembleRunnerRegion (emission tail + authored locks)', () => {
    it('authored terms AND onto rules, ride paths as logic_gate obstacles, and emit gate_rules', () => {
        const { level, derived, portalByKey } = generateLevelForSpecs({
            id: 'spec_authored',
            exitSpecs: [
                { key: 'E', requirement: ['doubleJump'] },
                { key: 'W', requirement: [] },
            ],
            pickupSpecs: [{ id: 'p0', requirement: [] }],
            seed: 5,
        });
        const region = assembleRunnerRegion(level, {
            region_id: 'region_9_9',
            sidePortals: { E: portalByKey.E, W: portalByKey.W },
            locationSpecs: [{ id: 'p0', item: 'Blue Platforms', authored: [{ item: 'key_red', count: 1 }] }],
            exitAuthored: { E: [{ item: 'Double Jump', count: 2 }] },
            derived,
        });
        // exit E: physics dj AND the count-2 authored term
        const eRule = region.exitRules.E;
        expect(JSON.stringify(eRule)).toContain('"Double Jump"');
        expect(JSON.stringify(eRule)).toContain('"count":2');
        expect(region.exitPaths.E[0].obstacles).toContain('runner_gate_doubleJump');
        expect(region.exitPaths.E[0].obstacles).toContain('runner_logic_Double_Jump__x2');
        expect(region.obstacleDefs.runner_logic_Double_Jump__x2.clear_set_type).toBe('rule');
        // pickup p0: pure-authored lock (physics ALWAYS)
        expect(region.locations[0].paths[0].obstacles).toEqual(['runner_logic_key_red']);
        // bridge-evaluated gate_rules ride the payload keyed by GAME ids
        expect(region.payload.gate_rules.portals[portalByKey.E])
            .toEqual({ rule: 'Has', args: { item_name: 'Double Jump', count: 2 } });
        expect(region.payload.gate_rules.pickups.p0).toBeTruthy();
        // ungated back exit emits no gate_rules entry
        expect(region.payload.gate_rules.portals[portalByKey.W]).toBeUndefined();
        // and the ungated side's rule is plain True_
        expect(region.exitRules.W).toEqual({ rule: 'True_' });
    }, 60000);

    it('no authored terms ⇒ no gate_rules key (zone-table byte-identity)', () => {
        const { level, derived, portalByKey } = generateLevelForSpecs({
            id: 'spec_plain',
            exitSpecs: [{ key: 'E', requirement: [] }],
            pickupSpecs: [{ id: 'p0', requirement: [] }],
            seed: 6,
        });
        const region = assembleRunnerRegion(level, {
            region_id: 'region_0_0',
            sidePortals: { E: portalByKey.E },
            locationSpecs: [{ id: 'p0', item: null }],
            derived,
        });
        expect(region.payload.gate_rules).toBeUndefined();
    }, 60000);
});

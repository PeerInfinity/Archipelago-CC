/**
 * Generator fast gates (plan §4.5): geometry derivation/validation,
 * proposal shape, byte-identical determinism, and the dump CLI's
 * --rules output asserted against expected requirement sets. The
 * seed-range generate-and-verify sweep, zone tables, and reach-pin
 * re-sweeps live in generator.slow.test.js.
 */

import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import {
    CELESTE_GEOMETRY, deriveGeometry, validateGeometry, resolveGenPhysics,
    generateLevel, generateZoneSet, planStripSpecs, applyGapMargin,
    deriveGeneratedRules,
} from './generator.js';
import { DEFAULTS } from './physics.js';
import { validateLevel } from './level.js';

describe('geometry', () => {
    it('pinned celeste geometry satisfies its structural constraints', () => {
        expect(validateGeometry(CELESTE_GEOMETRY, DEFAULTS)).toEqual([]);
    });

    it('deriveGeometry from the pinned reaches yields valid windows (no sweep)', () => {
        const G = deriveGeometry(DEFAULTS, {
            reaches: CELESTE_GEOMETRY.REACH, rises: CELESTE_GEOMETRY.RISE,
        });
        expect(validateGeometry(G, DEFAULTS)).toEqual([]);
        // gate boundaries sit strictly between the swept reaches
        expect(G.DJ_GAP.min).toBeGreaterThan(CELESTE_GEOMETRY.REACH.single);
        expect(G.DJ_GAP.min + G.DJ_GAP.span).toBeLessThan(CELESTE_GEOMETRY.REACH.dj);
        expect(2 * G.STONE_HALF.min + G.STONE_W).toBeGreaterThan(CELESTE_GEOMETRY.REACH.dj);
        expect(G.SPRING_TOTAL.min).toBeGreaterThan(CELESTE_GEOMETRY.REACH.dj);
        expect(G.SPRING_TOTAL.min + G.SPRING_TOTAL.span)
            .toBeLessThan(CELESTE_GEOMETRY.REACH.spring);
        // shelf windows sit strictly between the swept rises
        expect(G.DJ_SHELF_RISE.min).toBeGreaterThan(CELESTE_GEOMETRY.RISE.single);
        expect(G.DJ_SHELF_RISE.min + G.DJ_SHELF_RISE.span)
            .toBeLessThan(CELESTE_GEOMETRY.RISE.dj);
        expect(G.SPRING_SHELF_RISE.min).toBeGreaterThan(CELESTE_GEOMETRY.RISE.dj);
    });

    it('resolveGenPhysics: celeste is pinned; unknown profiles throw; explicit passthrough', () => {
        const r = resolveGenPhysics('celeste');
        expect(r.G).toBe(CELESTE_GEOMETRY);
        expect(r.C).toBe(DEFAULTS);
        expect(resolveGenPhysics().G).toBe(CELESTE_GEOMETRY); // default profile
        expect(() => resolveGenPhysics('zelda')).toThrow(/unknown physics profile/);
        const explicit = resolveGenPhysics({ constants: DEFAULTS, geometry: CELESTE_GEOMETRY });
        expect(explicit.G).toBe(CELESTE_GEOMETRY);
    });
});

describe('generateLevel', () => {
    it('empty requirement: a verified plain strip with wake goals', () => {
        const level = generateLevel({ id: 'g0', requirement: [], seed: 1 });
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
        expect(level.pickups).toHaveLength(1);
        expect(level.portals.map((p) => p.id)).toContain('exit_main');
        expect(level.spawn).toEqual({ x: 1, y: 1 });
    });

    it('same seed ⇒ byte-identical level (branches + hazards included)', () => {
        const opts = {
            id: 'gd', requirement: ['doubleJump'], branchCount: 1,
            hazardChance: 0.5, seed: 2,
        };
        expect(JSON.stringify(generateLevel(opts)))
            .toBe(JSON.stringify(generateLevel(opts)));
    });

    it('spring requirement: every goal derives exactly [spring]', () => {
        const level = generateLevel({ id: 'spr', requirement: ['spring'], seed: 3 });
        expect(level.platforms.some((p) => p.type === 'spring')).toBe(true);
        const derived = deriveGeneratedRules(level, DEFAULTS);
        expect(derived.defects).toEqual([]);
        for (const pk of level.pickups) {
            expect(derived.pickups[pk.id].minimalSets).toEqual([['spring']]);
        }
        for (const pt of level.portals) {
            expect(derived.exits[pt.id].minimalSets).toEqual([['spring']]);
        }
    }, 60000);

    it('rejects abilities without a gate template', () => {
        expect(() => generateLevel({ requirement: ['highJump'] }))
            .toThrow(/no gate template/);
    });

    it('reward shelf (shelfChance 1): one oneway shelf over the last gate carries loc_0', () => {
        const level = generateLevel({
            id: 'sh', requirement: ['spring'], pickupCount: 2, shelfChance: 1, seed: 1,
        });
        const shelves = level.platforms.filter((p) => p.type === 'oneway');
        expect(shelves).toHaveLength(1);
        const shelfPickups = level.pickups.filter((pk) => pk.on === shelves[0].id);
        expect(shelfPickups.map((pk) => pk.id)).toEqual(['loc_0']);
        // the other pickup stays a trunk floor; total count is unchanged
        expect(level.pickups).toHaveLength(2);
        // the shelf is dj-proof by construction: its top sits above the
        // swept dj rise over the floors' top (y=1)
        const top = shelves[0].y + shelves[0].h;
        expect(top - 1).toBeGreaterThan(CELESTE_GEOMETRY.RISE.dj + 0.8);
    }, 60000);

    it('reward shelf on a dj gate sits strictly between the swept rises', () => {
        const level = generateLevel({
            id: 'shdj', requirement: ['doubleJump'], pickupCount: 1, shelfChance: 1, seed: 1,
        });
        const shelves = level.platforms.filter((p) => p.type === 'oneway');
        expect(shelves).toHaveLength(1);
        const rise = shelves[0].y + shelves[0].h - 1;
        expect(rise).toBeGreaterThan(CELESTE_GEOMETRY.RISE.single);
        expect(rise).toBeLessThan(CELESTE_GEOMETRY.RISE.dj);
        expect(level.pickups.some((pk) => pk.on === shelves[0].id)).toBe(true);
    }, 60000);

    it('vertical jitter: raised plain floors only; anchors stay at base', () => {
        const opts = {
            id: 'jt', requirement: ['doubleJump'], pickupCount: 2, branchCount: 1,
            hazardChance: 0.5, shelfChance: 1, jitter: 1, seed: 1,
        };
        const level = generateLevel(opts);
        const floors = level.platforms.filter((p) => p.type === 'ground' && p.h === 1);
        // some interior floor rose, and no rise exceeds the cap
        expect(floors.some((p) => p.y > 0)).toBe(true);
        for (const p of floors) {
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(CELESTE_GEOMETRY.JITTER_MAX);
        }
        // entrance (first) and exit (last) floors stay base-anchored
        const byX = [...floors].sort((a, b) => a.x - b.x);
        expect(byX[0].y).toBe(0);
        expect(byX[byX.length - 1].y).toBe(0);
        // gate-adjacent anchoring: the shelf's gate floor is at base
        const shelf = level.platforms.find((p) => p.type === 'oneway');
        expect(shelf).toBeTruthy();
        // pickups ride their host floor's rise (wake invariant intact)
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
        // determinism
        expect(JSON.stringify(generateLevel(opts))).toBe(JSON.stringify(level));
    }, 60000);

    it('split segments (splitChance 1): ramp + one-way top lane + base merge floor', () => {
        const level = generateLevel({
            id: 'sp', requirement: ['doubleJump'], pickupCount: 1,
            splitChance: 1, hazardChance: 0.5, seed: 1,
        });
        const lanes = level.platforms.filter((p) => p.id.startsWith('lane'));
        expect(lanes.length).toBeGreaterThan(0);
        for (const lane of lanes) {
            expect(lane.type).toBe('oneway');
            // the lane hovers over a base-height merge floor with head
            // clearance (validateGeometry's structural bound)
            const below = level.platforms.find((p) => p.type === 'ground'
                && p.y === 0 && p.x <= lane.x && p.x + p.w >= lane.x + lane.w);
            expect(below, `merge floor under ${lane.id}`).toBeTruthy();
            expect(lane.y - (below.y + below.h)).toBeGreaterThan(DEFAULTS.PLAYER_H + 1.3);
        }
        // ramps rose above the base line
        expect(level.platforms.some((p) => p.type === 'ground' && p.y > 1)).toBe(true);
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
    }, 60000);

    it('splitChance 0 is draw-for-draw identical to the no-knob generator', () => {
        const base = {
            id: 'sp0', requirement: ['spring'], pickupCount: 1, branchCount: 1,
            hazardChance: 0.5, shelfChance: 1, seed: 2,
        };
        expect(JSON.stringify(generateLevel({ ...base, splitChance: 0 })))
            .toBe(JSON.stringify(generateLevel(base)));
    }, 60000);

    it('jitter 0 is draw-for-draw identical to the flat generator', () => {
        const base = {
            id: 'j0', requirement: ['spring'], pickupCount: 1, branchCount: 1,
            hazardChance: 0.5, shelfChance: 1, seed: 2,
        };
        expect(JSON.stringify(generateLevel({ ...base, jitter: 0 })))
            .toBe(JSON.stringify(generateLevel(base)));
    }, 60000);

    it('shelfChance 0 or no eligible gate ⇒ no shelf', () => {
        const none = generateLevel({
            id: 'sh0', requirement: ['spring'], pickupCount: 1, shelfChance: 0, seed: 1,
        });
        expect(none.platforms.some((p) => p.type === 'oneway')).toBe(false);
        // blue's stone gate has no descent corridor — never shelved
        const blue = generateLevel({
            id: 'shb', requirement: ['blue'], pickupCount: 1, shelfChance: 1, seed: 1,
        });
        expect(blue.platforms.some((p) => p.type === 'oneway')).toBe(false);
    }, 60000);

    it('generateZoneSet rejects counts below starter+feature+victory', () => {
        expect(() => generateZoneSet({ count: 3 })).toThrow(/count must be >= 4/);
    });
});

describe('planStripSpecs (spec-driven structural plan)', () => {
    it('nested-chain specs plan: max-req exit is main, others tips in level order', () => {
        const plan = planStripSpecs(
            [
                { key: 'E', requirement: ['doubleJump'] },
                { key: 'S', requirement: ['doubleJump', 'blue'] },
                { key: 'W', requirement: [] }, // the ungated entrance back portal
            ],
            [{ id: 'it_a', requirement: [] }, { id: 'it_b', requirement: ['doubleJump'] }]);
        expect(plan.mainKey).toBe('S');
        expect(plan.portalByKey).toEqual({ S: 'exit_main', W: 'exit_br0', E: 'exit_br1' });
        // levels: ∅ (back tip + it_a), {dj} (E tip + it_b), {dj,blue} (main)
        expect(plan.levels.map((l) => l.added)).toEqual([[], ['doubleJump'], ['blue']]);
        expect(plan.levels[0].tips.map((t) => t.portalId)).toEqual(['exit_br0']);
        expect(plan.levels[0].pickups).toEqual(['it_a']);
        expect(plan.levels[1].tips.map((t) => t.portalId)).toEqual(['exit_br1']);
        expect(plan.levels[1].pickups).toEqual(['it_b']);
        expect(plan.levels[2].tips).toEqual([]);
    });

    it('rejects non-nested requirements (a strip realises gates sequentially)', () => {
        expect(() => planStripSpecs([
            { key: 'E', requirement: ['doubleJump'] },
            { key: 'S', requirement: ['blue'] },
        ])).toThrow(/nested chain/);
    });

    it('rejects a maximal requirement carried only by a pickup', () => {
        expect(() => planStripSpecs(
            [{ key: 'E', requirement: [] }],
            [{ id: 'p', requirement: ['doubleJump'] }],
        )).toThrow(/belongs to no exit/);
    });

    it('rejects empty exits, duplicates, and unknown abilities', () => {
        expect(() => planStripSpecs([])).toThrow(/at least one exit/);
        expect(() => planStripSpecs([
            { key: 'E', requirement: [] }, { key: 'E', requirement: [] },
        ])).toThrow(/duplicate goal/);
        expect(() => planStripSpecs([{ key: 'E', requirement: ['highJump'] }]))
            .toThrow(/no gate template/);
    });
});

describe('applyGapMargin', () => {
    it('margin 0 returns the SAME geometry object (byte-identity)', () => {
        expect(applyGapMargin(CELESTE_GEOMETRY, 0)).toBe(CELESTE_GEOMETRY);
        expect(applyGapMargin(CELESTE_GEOMETRY)).toBe(CELESTE_GEOMETRY);
    });

    it('margin 1 widens RUN_GAP max to the 0.75×single structural cap, nothing else', () => {
        const G = applyGapMargin(CELESTE_GEOMETRY, 1);
        expect(G.RUN_GAP.min).toBe(CELESTE_GEOMETRY.RUN_GAP.min);
        expect(G.RUN_GAP.min + G.RUN_GAP.span)
            .toBeCloseTo(0.75 * CELESTE_GEOMETRY.REACH.single, 1);
        expect(validateGeometry(G, DEFAULTS)).toEqual([]);
        expect(G.DJ_GAP).toBe(CELESTE_GEOMETRY.DJ_GAP);
        expect(G.STONE_HALF).toBe(CELESTE_GEOMETRY.STONE_HALF);
    });

    it('margin clamps to [0, 1]', () => {
        expect(JSON.stringify(applyGapMargin(CELESTE_GEOMETRY, 5)))
            .toBe(JSON.stringify(applyGapMargin(CELESTE_GEOMETRY, 1)));
        expect(applyGapMargin(CELESTE_GEOMETRY, -1)).toBe(CELESTE_GEOMETRY);
    });
});

describe('dump-runner-level.js --rules output (the asserted CLI gate)', () => {
    const dump = (flags) => execSync(
        `node scripts/procgen/dump-runner-level.js ${flags}`,
        { cwd: process.cwd().replace(/frontend.*$/, ''), encoding: 'utf8' });

    it('stepStone fixture derives (blue) for stone pickup and exit', () => {
        const out = dump('--fixture stepStone --rules');
        expect(out).toContain('validateLevel: ok');
        expect(out).toContain('pickup pk_stone: (blue)');
        expect(out).toContain('exit exit_main: (blue)');
        expect(out).toContain('defects: none');
    });

    it('a generated plain strip derives ALWAYS everywhere', () => {
        const out = dump('--generate none --seed 1 --branches 0 --rules');
        expect(out).toContain('validateLevel: ok');
        expect(out).toContain('pickup loc_0: ALWAYS');
        expect(out).toContain('exit exit_main: ALWAYS');
        expect(out).toContain('defects: none');
    });
});

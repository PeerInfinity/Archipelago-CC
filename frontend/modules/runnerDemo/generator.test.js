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
    generateLevel, generateZoneSet,
} from './generator.js';
import { DEFAULTS } from './physics.js';
import { validateLevel } from './level.js';

describe('geometry', () => {
    it('pinned celeste geometry satisfies its structural constraints', () => {
        expect(validateGeometry(CELESTE_GEOMETRY, DEFAULTS)).toEqual([]);
    });

    it('deriveGeometry from the pinned reaches yields valid windows (no sweep)', () => {
        const G = deriveGeometry(DEFAULTS, { reaches: CELESTE_GEOMETRY.REACH });
        expect(validateGeometry(G, DEFAULTS)).toEqual([]);
        // gate boundaries sit strictly between the swept reaches
        expect(G.DJ_GAP.min).toBeGreaterThan(CELESTE_GEOMETRY.REACH.single);
        expect(G.DJ_GAP.min + G.DJ_GAP.span).toBeLessThan(CELESTE_GEOMETRY.REACH.dj);
        expect(2 * G.STONE_HALF.min + G.STONE_W).toBeGreaterThan(CELESTE_GEOMETRY.REACH.dj);
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

    it('rejects abilities without a gate template', () => {
        expect(() => generateLevel({ requirement: ['highJump'] }))
            .toThrow(/no gate template/);
    });

    it('generateZoneSet rejects counts below starter+feature+victory', () => {
        expect(() => generateZoneSet({ count: 2 })).toThrow(/count must be >= 3/);
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

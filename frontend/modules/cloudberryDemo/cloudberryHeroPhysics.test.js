/**
 * P5b — the Hero Factory's physics as world settings (⚖ Robert 2026-11-04: the proposed ranges, per world + a
 * variation knob, on the ability levels too). The plan's request carries `heroCustom.phsx`; the document read checks
 * the game's hero matches it.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
    CLOUDBERRY_HERO_PHSX_ORDER, cloudberryAttemptArgs, cloudberryAttemptSeed, cloudberryHeroBase, cloudberryHeroCustom,
    cloudberryHeroMismatch, cloudberryHeroPhsxText, drawCloudberryHero, planCloudberryLevel, readCloudberryDocument,
} from './cloudberryZonePlan.js';
import { clearCloudberryLevelCache, ensureCloudberryLevel, installCloudberryGenerator } from './cloudberryGeneration.js';
import { cloudberryTestDocument } from './cloudberryTestGenerator.js';
import {
    CLOUDBERRY_HERO_PHYSICS, DEFAULT_CLOUDBERRY_PROCGEN_PARAMS, cloudberryProcgenParamsFromPayload,
} from './cloudberryProcgenParams.js';
import { createRng } from '../shared/rng.js';

const specs = (cloudberry = {}) => ({
    region_id: 'region_1_0',
    seed: 12345,
    exitSpecs: [{ side: 'E', requirement: ['Moving Blocks'], counts: {} }, { side: 'W', requirement: [], counts: {} }],
    locationSpecs: [{ id: 'loc_0', item: null, requirement: [] }],
    cloudberry: { cloudberryTileset: 'random', ...cloudberry },
});
const ctx = (gate = []) => ({ entrance: { side: 'W', requirement: gate, counts: {} } });

describe('the settings table', () => {
    it('defaults are the game\'s own hero, inside the ruled ranges; the order is the engine\'s sliders', () => {
        for (const h of CLOUDBERRY_HERO_PHYSICS) {
            expect(DEFAULT_CLOUDBERRY_PROCGEN_PARAMS[h.key]).toBe(h.def);
            expect(h.def).toBeGreaterThanOrEqual(h.min);
            expect(h.def).toBeLessThanOrEqual(h.max);
            expect(CLOUDBERRY_HERO_PHSX_ORDER.find(([n]) => n === h.phsx)?.[1]).toBe(h.def);
        }
        expect(DEFAULT_CLOUDBERRY_PROCGEN_PARAMS.cloudberryHeroVariation).toBe(0);
        // The ruled restrictions (P5b Phase A): size ≥ 0.5, numjumps 2–4, jumplength2 ≤ 1.35; the ladder (option A):
        // gravity ≤ 1.5, jumplength ≥ 0.85.
        const by = Object.fromEntries(CLOUDBERRY_HERO_PHYSICS.map((h) => [h.phsx, h]));
        expect([by.size.min, by.numjumps.min, by.numjumps.max, by.jumplength2.max]).toEqual([0.5, 2, 4, 1.35]);
        expect([by.gravity.max, by.jumplength.min]).toEqual([1.5, 0.85]);
    });
});

describe('the plan\'s hero', () => {
    it('default settings plan today\'s requests (no heroCustom; the ability heroes as P1a/P5a; no extra draw)', () => {
        const plain = planCloudberryLevel(specs(), ctx());
        expect(plain.args.heroCustom).toBeUndefined();
        expect(plain.heroDraw).toBeUndefined();
        const jp = planCloudberryLevel(specs({ cloudberryJetpackChance: 1 }), ctx(['Jetpack']));
        expect(jp.args.heroCustom).toEqual({ move: 'Jetpack', phsx: { jetpackfuel: 1 } });
        const dj = planCloudberryLevel(specs({ cloudberryDoubleJumpChance: 1 }), ctx(['Double Jump']));
        expect(dj.args.heroCustom).toEqual({ move: 'Double', phsx: { numjumps: 2 } });
        // The key order of a default request is the P5a one (heroCustom between pieces and trace).
        expect(Object.keys(jp.args)).toEqual(['seed', 'difficulty', 'tileset', 'pieceLength', 'pieces', 'heroCustom', 'trace', 'settings']);
    });

    it('world values: every level gets the general sliders; the ability sliders only on their own levels', () => {
        const world = { cloudberryHeroGravity: 1.5, cloudberryHeroSize: 0.8, cloudberryHeroNumJumps: 3, cloudberryHeroJetpackFuel: 2 };
        expect(planCloudberryLevel(specs(world), ctx()).args.heroCustom).toEqual({ phsx: { gravity: 1.5, size: 0.8 } });
        expect(planCloudberryLevel(specs({ ...world, cloudberryDoubleJumpChance: 1 }), ctx(['Double Jump'])).args.heroCustom)
            .toEqual({ move: 'Double', phsx: { numjumps: 3, gravity: 1.5, size: 0.8 } });
        expect(planCloudberryLevel(specs({ ...world, cloudberryJetpackChance: 1 }), ctx(['Jetpack'])).args.heroCustom)
            .toEqual({ move: 'Jetpack', phsx: { jetpackfuel: 2, gravity: 1.5, size: 0.8 } });
    });

    it('a value outside its ruled range is refused by name', () => {
        expect(() => planCloudberryLevel(specs({ cloudberryHeroSize: 0.2 }), ctx())).toThrow(/cloudberryHeroSize = 0\.2 is outside 0\.5–2\.1/);
        expect(() => planCloudberryLevel(specs({ cloudberryHeroNumJumps: 2.5 }), ctx())).toThrow(/cloudberryHeroNumJumps .*whole number/);
        expect(() => planCloudberryLevel(specs({ cloudberryHeroVariation: 1.5 }), ctx())).toThrow(/cloudberryHeroVariation = 1\.5 is outside 0–1/);
    });

    it('variation: draw (5) comes last (the tileset draw is unchanged), stays in range, is deterministic', () => {
        const base = planCloudberryLevel(specs(), ctx());
        const v = planCloudberryLevel(specs({ cloudberryHeroVariation: 1 }), ctx());
        expect(v.args.tileset).toBe(base.args.tileset);
        expect(v.args.heroCustom.phsx).toBeTruthy();
        expect(planCloudberryLevel(specs({ cloudberryHeroVariation: 1 }), ctx()).args).toEqual(v.args);
        for (const h of CLOUDBERRY_HERO_PHYSICS.filter((x) => x.levels === 'all')) {
            const val = v.args.heroCustom.phsx[h.phsx] ?? h.def;
            expect(val).toBeGreaterThanOrEqual(h.min);
            expect(val).toBeLessThanOrEqual(h.max);
        }
        // The Double Jump / Jetpack sliders draw nothing on a plain level.
        expect(Object.keys(v.args.heroCustom.phsx).some((k) => ['numjumps', 'jumplength2', 'jumpaccel2', 'jetpackaccel', 'jetpackfuel'].includes(k))).toBe(false);
        expect(v.heroDraw).toEqual({ kind: 'plain', base: cloudberryHeroBase({}), variation: 1 });
        expect(v.key).not.toBe(base.key);
    });

    it('variation moves each slider from the world value toward a uniform point by the knob', () => {
        const base = cloudberryHeroBase({ cloudberryHeroGravity: 1.2 });
        const at = (variation) => drawCloudberryHero('plain', base, variation, createRng(7)).gravity;
        const target = 0.5 + createRng(7).next() * 1.0;
        expect(at(0)).toBe(1.2);
        expect(at(1)).toBeCloseTo(target, 3);
        expect(at(0.5)).toBeCloseTo(1.2 + 0.5 * (target - 1.2), 3);
        // Whole jumps on a Double level.
        const dj = drawCloudberryHero('double', cloudberryHeroBase({}), 1, createRng(3));
        expect(Number.isInteger(dj.numjumps) && dj.numjumps >= 2 && dj.numjumps <= 4).toBe(true);
    });

    it('a retry redraws a varied hero from the attempt\'s seed; without variation only the seed moves', () => {
        const v = planCloudberryLevel(specs({ cloudberryHeroVariation: 1 }), ctx());
        const a2 = cloudberryAttemptArgs(v.args, 2, v);
        expect(a2.seed).toBe(cloudberryAttemptSeed(v.args.seed, 2));
        expect(a2.heroCustom).toEqual(cloudberryHeroCustom('plain', drawCloudberryHero('plain', v.heroDraw.base, 1, createRng(a2.seed))));
        expect(a2.heroCustom).not.toEqual(v.args.heroCustom);
        expect(Object.keys(a2)).toEqual(Object.keys(v.args));
        expect(cloudberryAttemptArgs(v.args, 0, v)).toBe(v.args);
        const fixed = planCloudberryLevel(specs({ cloudberryHeroGravity: 1.5 }), ctx());
        expect(cloudberryAttemptArgs(fixed.args, 2, fixed)).toEqual({ ...fixed.args, seed: cloudberryAttemptSeed(fixed.args.seed, 2) });
    });
});

describe('the document\'s hero', () => {
    const hc = { phsx: { gravity: 1.5, size: 0.8 } };
    const doc = (heroCustom, level = {}) => ({ level: { heroPhsx: cloudberryHeroPhsxText(heroCustom), heroPhsxClamped: [], ...level } });

    it('matches only the request\'s physics, refuses clamped values, and a default request wants no custom hero', () => {
        expect(cloudberryHeroPhsxText(hc)).toBe('ph:1.5,1,1,1,1,1,1,1,1,1,2,0.8,2.08,1,1,1;');
        expect(cloudberryHeroMismatch(doc(hc), hc)).toBeNull();
        expect(cloudberryHeroMismatch(doc({ phsx: { gravity: 1.5 } }), hc)).toMatch(/hero size 1, planned 0\.8/);
        expect(cloudberryHeroMismatch(doc(hc, { heroPhsxClamped: ['size'] }), hc)).toMatch(/clamped/);
        expect(cloudberryHeroMismatch({ level: {} }, hc)).toMatch(/the default hero, planned custom physics/);
        expect(cloudberryHeroMismatch(doc(hc), null)).toMatch(/planned the default hero/);
        expect(cloudberryHeroMismatch({ level: {} }, null)).toBeNull();
    });

    it('readCloudberryDocument refuses a document whose hero is not the attempt\'s, by name', () => {
        const plan = planCloudberryLevel(specs({ cloudberryHeroGravity: 1.5 }), ctx());
        expect(readCloudberryDocument(cloudberryTestDocument(plan.args), plan).ok).toBe(true);
        const other = { ...plan.args, heroCustom: { phsx: { gravity: 1.25 } } };
        expect(readCloudberryDocument(cloudberryTestDocument(other), plan).reason).toMatch(/^CloudberryHeroMismatch: hero gravity 1\.25, planned 1\.5/);
    });

    it('the stored payload\'s hero reads back into the knobs (the panel\'s Edit flow)', () => {
        expect(cloudberryProcgenParamsFromPayload({ params: { generate: { heroCustom: { move: 'Double', phsx: { numjumps: 3, gravity: 1.5 } } } } }))
            .toEqual({ cloudberryHeroNumJumps: 3, cloudberryHeroGravity: 1.5 });
    });
});

describe('generation with a varied hero', () => {
    beforeEach(() => clearCloudberryLevelCache());

    it('a refused attempt retries with a redrawn hero, and the result is read against THAT attempt\'s hero', async () => {
        const plan = planCloudberryLevel(specs({ cloudberryHeroVariation: 1 }), ctx());
        const calls = [];
        installCloudberryGenerator({
            build: 'test-build',
            async generate(args) {
                calls.push(args);
                const doc = calls.length === 1 ? { error: 'RerollExhausted: piece 1 refused in all 16 attempts' } : cloudberryTestDocument(args);
                return { text: JSON.stringify(doc), docSha256: 'b'.repeat(64) };
            },
        }, { store: null });
        const r = await ensureCloudberryLevel(plan);
        expect(r.refused).toBeUndefined();
        expect(r.attempt).toBe(1);
        expect(calls[1].heroCustom).toEqual(cloudberryAttemptArgs(plan.args, 1, plan).heroCustom);
        expect(calls[1].heroCustom).not.toEqual(plan.args.heroCustom);
        expect(r.generate.heroCustom).toEqual(calls[1].heroCustom);
        installCloudberryGenerator(null);
    });
});

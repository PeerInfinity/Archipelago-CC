import { describe, it, expect } from 'vitest';
import { DEFAULTS, step, spawnState, simulate } from './physics.js';
import {
    isPlatformActive,
    activePlatforms,
    activeSprings,
    activeJetpacks,
    noAbilities,
    allAbilities,
} from './suppression.js';
import { bounceStack } from './fixtures/bounceStack.js';

const makeLevel = (over = {}) => ({
    id: 'test',
    size: { width: 400, height: 1200 },
    platforms: [],
    springs: [],
    jetpacks: [],
    pickups: [],
    portals: [],
    ...over,
});

const airborne = (over = {}) => ({
    x: 200, y: 100, vx: 0, vy: 0, fallen: false, landedOn: null, launch: null,
    ...over,
});

describe('suppression', () => {
    it('green platforms are always active', () => {
        expect(isPlatformActive({ type: 'green' }, noAbilities())).toBe(true);
    });

    it('blue/brown platforms gate on their ability', () => {
        expect(isPlatformActive({ type: 'blue' }, noAbilities())).toBe(false);
        expect(isPlatformActive({ type: 'blue' }, { blue: true })).toBe(true);
        expect(isPlatformActive({ type: 'brown' }, noAbilities())).toBe(false);
        expect(isPlatformActive({ type: 'brown' }, { brown: true })).toBe(true);
    });

    it('throws on unknown platform type', () => {
        expect(() => isPlatformActive({ type: 'beige' }, noAbilities())).toThrow(/beige/);
    });

    it('springs require the ability AND an active host platform', () => {
        const level = makeLevel({
            platforms: [{ id: 'pb', x: 200, y: 300, type: 'blue' }],
            springs: [{ id: 's0', x: 200, y: 295, on: 'pb' }],
        });
        expect(activeSprings(level, noAbilities())).toHaveLength(0);
        expect(activeSprings(level, { springs: true })).toHaveLength(0);
        expect(activeSprings(level, { springs: true, blue: true })).toHaveLength(1);
    });

    it('jetpacks follow the same host rule', () => {
        const level = makeLevel({
            platforms: [{ id: 'pg', x: 200, y: 300, type: 'green' }],
            jetpacks: [{ id: 'j0', x: 200, y: 295, on: 'pg' }],
        });
        expect(activeJetpacks(level, noAbilities())).toHaveLength(0);
        expect(activeJetpacks(level, { jetpacks: true })).toHaveLength(1);
    });
});

describe('step: gravity and falling', () => {
    it('accelerates downward under gravity', () => {
        const level = makeLevel();
        const s1 = step(airborne(), null, level, noAbilities());
        expect(s1.vy).toBeCloseTo(DEFAULTS.GRAVITY);
        expect(s1.y).toBeCloseTo(100 + DEFAULTS.GRAVITY);
        const s2 = step(s1, null, level, noAbilities());
        expect(s2.vy).toBeCloseTo(2 * DEFAULTS.GRAVITY);
    });

    it('caps fall speed at MAX_FALL', () => {
        const level = makeLevel({ size: { width: 400, height: 100000 } });
        let s = airborne();
        for (let i = 0; i < 100; i++) s = step(s, null, level, noAbilities());
        expect(s.vy).toBe(DEFAULTS.MAX_FALL);
    });

    it('marks the player fallen below the level bottom and freezes the state', () => {
        const level = makeLevel();
        const { trajectory, fellAtFrame } = simulate(level, noAbilities());
        expect(fellAtFrame).not.toBeNull();
        const last = trajectory[trajectory.length - 1];
        expect(last.fallen).toBe(true);
        expect(step(last, null, level, noAbilities())).toBe(last);
    });
});

describe('step: landing and bouncing', () => {
    const onePlatform = makeLevel({
        platforms: [{ id: 'p', x: 200, y: 300, type: 'green' }],
    });

    it('bounces when falling across a platform top', () => {
        const s = step(airborne({ y: 295, vy: 8 }), null, onePlatform, noAbilities());
        expect(s.landedOn).toBe('p');
        expect(s.launch).toBe('bounce');
        expect(s.y).toBe(300);
        expect(s.vy).toBe(DEFAULTS.BOUNCE_VY);
    });

    it('passes through platforms while rising (one-way collision)', () => {
        const s = step(airborne({ y: 305, vy: -10 }), null, onePlatform, noAbilities());
        expect(s.landedOn).toBeNull();
        expect(s.y).toBeLessThan(300);
    });

    it('misses a platform when horizontally out of range', () => {
        const halfSpan = DEFAULTS.PLATFORM_WIDTH / 2 + DEFAULTS.PLAYER_HALF_WIDTH;
        const s = step(
            airborne({ x: 200 + halfSpan + 5, y: 295, vy: 8 }),
            null, onePlatform, noAbilities(),
        );
        expect(s.landedOn).toBeNull();
    });

    it('lands on the highest platform when the sweep crosses several', () => {
        const stacked = makeLevel({
            platforms: [
                { id: 'low', x: 200, y: 310, type: 'green' },
                { id: 'high', x: 200, y: 301, type: 'green' },
            ],
        });
        const s = step(airborne({ y: 300, vy: 16 }), null, stacked, noAbilities());
        expect(s.landedOn).toBe('high');
    });

    it('falls through suppressed platforms, lands once unlocked', () => {
        const blue = makeLevel({
            platforms: [{ id: 'pb', x: 200, y: 300, type: 'blue' }],
        });
        const locked = step(airborne({ y: 295, vy: 8 }), null, blue, noAbilities());
        expect(locked.landedOn).toBeNull();
        const unlocked = step(airborne({ y: 295, vy: 8 }), null, blue, { blue: true });
        expect(unlocked.landedOn).toBe('pb');
    });
});

describe('step: springs and jetpacks', () => {
    const springLevel = makeLevel({
        platforms: [{ id: 'p', x: 200, y: 300, type: 'green' }],
        springs: [{ id: 's', x: 200, y: 295, on: 'p' }],
    });

    it('spring boosts the launch when unlocked, plain bounce when locked', () => {
        const locked = step(airborne({ y: 295, vy: 8 }), null, springLevel, noAbilities());
        expect(locked.launch).toBe('bounce');
        expect(locked.vy).toBe(DEFAULTS.BOUNCE_VY);
        const unlocked = step(airborne({ y: 295, vy: 8 }), null, springLevel, { springs: true });
        expect(unlocked.launch).toBe('spring');
        expect(unlocked.vy).toBe(DEFAULTS.SPRING_VY);
    });

    it('jetpack outranks spring on the same platform', () => {
        const both = makeLevel({
            platforms: [{ id: 'p', x: 200, y: 300, type: 'green' }],
            springs: [{ id: 's', x: 200, y: 295, on: 'p' }],
            jetpacks: [{ id: 'j', x: 200, y: 295, on: 'p' }],
        });
        const s = step(airborne({ y: 295, vy: 8 }), null, both, allAbilities());
        expect(s.launch).toBe('jetpack');
        expect(s.vy).toBe(DEFAULTS.JETPACK_VY);
    });
});

describe('step: input gating and walls', () => {
    const level = makeLevel();

    it('ignores a held direction until its arrow is unlocked', () => {
        const locked = step(airborne(), { right: true }, level, noAbilities());
        expect(locked.vx).toBe(0);
        const unlocked = step(airborne(), { right: true }, level, { right: true });
        expect(unlocked.vx).toBeCloseTo(DEFAULTS.MOVE_ACCEL);
        expect(unlocked.x).toBeGreaterThan(200);
    });

    it('gates left independently of right', () => {
        const s = step(airborne(), { left: true }, level, { right: true });
        expect(s.vx).toBe(0);
    });

    it('clamps at side walls and zeroes vx', () => {
        let s = airborne({ x: 30 });
        for (let i = 0; i < 60; i++) s = step(s, { left: true }, level, allAbilities());
        expect(s.x).toBe(DEFAULTS.PLAYER_HALF_WIDTH);
        expect(s.vx).toBe(0);
    });

    it('drag decays vx when no direction is held', () => {
        const s = step(airborne({ vx: 5 }), null, level, allAbilities());
        expect(s.vx).toBeCloseTo(5 * DEFAULTS.AIR_DRAG);
    });
});

describe('simulate: determinism', () => {
    it('two identical runs produce identical trajectories', () => {
        const policy = (state, frame) => (frame % 120 < 60 ? { right: true } : { left: true });
        const a = simulate(bounceStack, allAbilities(), policy);
        const b = simulate(bounceStack, allAbilities(), policy);
        expect(a).toEqual(b);
    });
});

describe('fixture ground truth: the no-input bounce stack', () => {
    it('reaches the top, the pickup, and the portal with NO abilities and NO input', () => {
        const r = simulate(bounceStack, noAbilities());
        expect(r.fellAtFrame).toBeNull();
        expect(r.landings[0].platformId).toBe('p0');
        const visited = new Set(r.landings.map((l) => l.platformId));
        for (const p of bounceStack.platforms) expect(visited).toContain(p.id);
        expect(r.pickupsTouched).toContain('loc_arrow');
        expect(r.portalsTouched).toContain('exit_up');
    });

    it('ascends strictly: each new platform reached is higher than the last', () => {
        const r = simulate(bounceStack, noAbilities());
        const tops = [];
        const seen = new Set();
        for (const l of r.landings) {
            if (!seen.has(l.platformId)) {
                seen.add(l.platformId);
                tops.push(bounceStack.platforms.find((p) => p.id === l.platformId).y);
            }
        }
        for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeLessThan(tops[i - 1]);
    });
});

import { describe, it, expect } from 'vitest';
import {
    DEFAULTS, PROFILES, physicsStampFor, resolvePhysicsStamp,
    step, spawnState, simulate, platformXAt,
} from './physics.js';
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

    it('wraps around the sides without losing vx (screen wrap)', () => {
        let s = airborne({ x: 30 });
        for (let i = 0; i < 12; i++) s = step(s, { left: true }, level, allAbilities());
        // moved off the left edge and re-entered on the right
        expect(s.x).toBeGreaterThan(level.size.width / 2);
        expect(s.vx).toBeLessThan(0); // still drifting left
    });

    it('lands across the wrap seam (wrap-aware span check)', () => {
        const seamLevel = {
            ...level,
            platforms: [{ id: 'seam', x: 2, y: 300, type: 'green' }],
        };
        // falling at the far-right edge — the seam platform at x=2 is
        // within wrap distance
        let s = { x: seamLevel.size.width - 2, y: 280, vx: 0, vy: 4, fallen: false, landedOn: null, launch: null };
        for (let i = 0; i < 10 && !s.landedOn; i++) {
            s = step(s, null, seamLevel, allAbilities());
        }
        expect(s.landedOn).toBe('seam');
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

describe('physics profiles (PROFILES / stamp helpers)', () => {
    it('classic profile IS the frozen DEFAULTS object', () => {
        expect(PROFILES.classic.constants).toBe(DEFAULTS);
        expect(Object.isFrozen(DEFAULTS)).toBe(true);
        expect(DEFAULTS.AIR_CONTROL).toBe('accel');
    });

    it('physicsStampFor: classic (and absent) stamp to null — payloads stay unstamped', () => {
        expect(physicsStampFor('classic')).toBeNull();
        expect(physicsStampFor(null)).toBeNull();
        expect(physicsStampFor(undefined)).toBeNull();
    });

    it('physicsStampFor: dj stamps profile id + resolved constants', () => {
        const stamp = physicsStampFor('dj');
        expect(stamp.profile).toBe('dj');
        expect(stamp.constants.AIR_CONTROL).toBe('flat');
        expect(stamp.constants.GRAVITY).toBe(4);   // measured, 20Hz-native
        expect(stamp.constants.TICK_HZ).toBe(20);
    });

    it('physicsStampFor: unknown profile throws', () => {
        expect(() => physicsStampFor('moon')).toThrow(/moon/);
    });

    it('resolvePhysicsStamp: absent stamp = classic DEFAULTS identity', () => {
        expect(resolvePhysicsStamp(undefined)).toBe(DEFAULTS);
        expect(resolvePhysicsStamp(null)).toBe(DEFAULTS);
    });

    it('resolvePhysicsStamp: embedded constants win and merge over DEFAULTS', () => {
        const C = resolvePhysicsStamp({ profile: 'dj', constants: { GRAVITY: 0.25 } });
        expect(C.GRAVITY).toBe(0.25);
        // fields absent from an old stamp fall back to classic behavior
        expect(C.AIR_CONTROL).toBe('accel');
        expect(C.MAX_FALL).toBe(DEFAULTS.MAX_FALL);
    });

    it('resolvePhysicsStamp: bare profile id resolves via the registry', () => {
        expect(resolvePhysicsStamp('dj')).toBe(PROFILES.dj.constants);
        expect(resolvePhysicsStamp({ profile: 'dj' })).toBe(PROFILES.dj.constants);
        expect(resolvePhysicsStamp('moon')).toBe(DEFAULTS); // unknown -> classic
    });
});

describe('flat air control (AIR_CONTROL: "flat")', () => {
    const FLAT = { ...DEFAULTS, AIR_CONTROL: 'flat', MOVE_FLAT: 10 };
    const level = makeLevel();
    const all = allAbilities();

    it('moves exactly MOVE_FLAT px per held tick, regardless of duration', () => {
        let s = airborne();
        s = step(s, { right: true }, level, all, FLAT);
        expect(s.x).toBe(210);
        s = step(s, { right: true }, level, all, FLAT);
        expect(s.x).toBe(220); // no acceleration: still exactly +10
    });

    it('release means instant stop — no momentum, no drag tail', () => {
        let s = airborne();
        s = step(s, { right: true }, level, all, FLAT);
        s = step(s, null, level, all, FLAT);
        expect(s.x).toBe(210); // unchanged after release
        expect(s.vx).toBe(0);
    });

    it('still gates on arrow abilities like the accel model', () => {
        let s = airborne();
        s = step(s, { right: true }, level, noAbilities(), FLAT);
        expect(s.x).toBe(200);
    });

    it('classic accel model is untouched (AIR_CONTROL absent or "accel")', () => {
        let s = airborne();
        s = step(s, { right: true }, level, all, DEFAULTS);
        expect(s.x).toBeCloseTo(200 + DEFAULTS.MOVE_ACCEL);
        expect(s.vx).toBeCloseTo(DEFAULTS.MOVE_ACCEL);
    });
});

// ── DJ calibration tests ─────────────────────────────────────────────
// Ground truth: the SWFRecomp-CC measurements of real Doodle Jump
// (2026-06-11) — summary + per-tick traces in
// NewDocs/plans/procedural-generation/dj-measurements/ (gitignored;
// expectations inlined here with run-id provenance). All values are
// DJ-native px/ticks at 20Hz; the dj profile uses them verbatim.
describe('dj profile calibration (measured 2026-06-11)', () => {
    const DJ = PROFILES.dj.constants;
    const all = allAbilities();
    const IMPULSE = 17 * 1.89999997615814; // jumpspeed * jumpspeed_factor

    const djLevel = (over = {}) => ({
        id: 'dj_test',
        size: { width: 240, height: 400 },
        platforms: [],
        springs: [],
        jetpacks: [],
        pickups: [],
        portals: [],
        ...over,
    });

    const falling = (over = {}) => ({
        x: 158.6, y: 203.2, vx: 0, vy: 12, fallen: false,
        landedOn: null, launch: null, t: 5, broken: [], latched: null, jetpackTicks: 0,
        ...over,
    });

    it('reproduces bounce_ruffle_01 ticks 5-8 exactly (hit, no snap, latched impulse)', () => {
        // Trace: y 203.2 (vy 12) -> 219.2 (vy 16, HIT: vy=0, j latched)
        // -> 190.9 (vy -28.3) -> 166.6 (vy -24.3). Block top at 234.55.
        const level = djLevel({
            platforms: [{ id: 'b2', x: 153.85, y: 234.55, type: 'green' }],
        });
        let s = falling();
        s = step(s, null, level, all, DJ);             // tick 6: hit
        expect(s.y).toBeCloseTo(219.2, 9);             // moved, NOT snapped to 234.55
        expect(s.vy).toBe(0);                          // zeroed in place
        expect(s.landedOn).toBe('b2');
        expect(s.latched).toBe('bounce');
        s = step(s, null, level, all, DJ);             // tick 7: impulse
        expect(s.vy).toBe(0 - IMPULSE + 4);            // -28.2999995946884
        expect(s.y).toBeCloseTo(190.9, 9);
        s = step(s, null, level, all, DJ);             // tick 8
        expect(s.y).toBeCloseTo(166.6, 9);
        expect(s.vy).toBeCloseTo(-24.2999995946884, 9);
    });

    it('plain bounce apex is the discrete-integrator 114.4 above the hover point', () => {
        // Measured 114.1 (bounce_ruffle_01) includes DJ's container
        // scroll truncating each scroll DELTA to twips; our absolute
        // coordinates truncate POSITIONS instead — a documented
        // <=0.05px/tick divergence on scrolled rises (~0.3px/apex).
        const level = djLevel({
            platforms: [{ id: 'p', x: 120, y: 300, type: 'green' }],
        });
        const r = simulate(level, all, () => null, { constants: DJ, maxFrames: 80 });
        // measure ONE flight: a later cycle's hover point differs, so
        // hit-to-its-own-apex is the per-cycle invariant
        const hitIdx = r.trajectory.findIndex((s, i) => i > 0 && s.landedOn === 'p');
        let endIdx = r.trajectory.findIndex((s, i) => i > hitIdx && s.landedOn);
        if (endIdx < 0) endIdx = r.trajectory.length;
        const yHover = r.trajectory[hitIdx].y;
        const yApex = Math.min(...r.trajectory.slice(hitIdx, endIdx).map((s) => s.y));
        expect(yHover - yApex).toBeCloseTo(114.4, 1);
    });

    it('never snaps: the hover gap stays within [0, MAX_FALL) above the line', () => {
        const level = djLevel({
            platforms: [{ id: 'p', x: 120, y: 300, type: 'green' }],
        });
        for (const dropY of [100, 137, 180, 222.2, 260]) {
            const r = simulate(level, all, () => null, {
                constants: DJ, maxFrames: 60,
                start: { ...falling({ x: 120, y: dropY, vy: 0, t: 0 }) },
            });
            const hit = r.trajectory.find((s) => s.landedOn === 'p');
            expect(hit).toBeTruthy();
            const gap = 300 - hit.y;
            expect(gap).toBeGreaterThanOrEqual(0);
            expect(gap).toBeLessThan(DJ.MAX_FALL + 1e-9);
        }
    });

    it('spring apex is exactly 544 (spring_native_01 / bounce_ruffle_01 natural spring)', () => {
        const level = djLevel({
            size: { width: 240, height: 1000 },
            platforms: [{ id: 'p', x: 120, y: 900, type: 'green' }],
            springs: [{ id: 's', x: 120, y: 895, on: 'p' }],
        });
        const r = simulate(level, all, () => null, {
            constants: DJ, maxFrames: 80,
            start: { ...falling({ x: 120, y: 800, vy: 0, t: 0 }) },
        });
        const hitIdx = r.trajectory.findIndex((s) => s.landedOn === 'p');
        expect(r.trajectory[hitIdx + 1].vy).toBe(0 - 17 * 4 + 4); // -64
        const yHover = r.trajectory[hitIdx].y;
        const yApex = Math.min(...r.trajectory.slice(hitIdx).map((s) => s.y));
        expect(yHover - yApex).toBeCloseTo(544, 6);
    });

    it('brown: weakened un-zeroed bounce, breaks same tick, resets on respawn', () => {
        // brown_ruffle_01: vy_next = vy_at_hit - 32.3 + 4 (-6.3 at terminal 22)
        const level = djLevel({
            platforms: [{ id: 'br', x: 120, y: 300, type: 'brown' }],
        });
        // long fall reaches terminal vy 22 before the catch
        let s = { ...falling({ x: 120, y: 80, vy: 0, t: 0 }) };
        let hitState = null;
        for (let i = 0; i < 40 && !hitState; i++) {
            s = step(s, null, level, all, DJ);
            if (s.landedOn === 'br') hitState = s;
        }
        expect(hitState.vy).toBe(DJ.MAX_FALL);          // NOT zeroed on hit
        expect(hitState.latched).toBe('brown');
        expect(hitState.broken).toContain('br');
        s = step(hitState, null, level, all, DJ);
        expect(s.vy).toBe(DJ.MAX_FALL - IMPULSE + 4);   // -6.2999995946884
        // broken platform no longer catches: ride the weak bounce down
        let caughtAgain = false;
        for (let i = 0; i < 200 && !s.fallen; i++) {
            s = step(s, null, level, all, DJ);
            if (s.landedOn) caughtAgain = true;
        }
        expect(caughtAgain).toBe(false);
        expect(s.fallen).toBe(true);
        // respawn = fresh spawnState -> breaks reset
        expect(spawnState(level, DJ).broken).toEqual([]);
    });

    it('brown under classic behaviors stays a static (no break)', () => {
        const level = djLevel({
            platforms: [{ id: 'br', x: 120, y: 300, type: 'brown' }],
        });
        const r = simulate(level, { ...allAbilities() }, () => null, { maxFrames: 200 });
        const landings = r.landings.filter((l) => l.platformId === 'br');
        expect(landings.length).toBeGreaterThan(1);     // bounces forever
    });

    it('flat keys: ±10/tick, both keys cancel, instant stop (keys_*_01)', () => {
        const level = djLevel();
        let s = { ...falling({ x: 100, y: 50, vy: -30, t: 0 }) };
        s = step(s, { right: true }, level, all, DJ);
        expect(s.x).toBe(110);
        s = step(s, { right: true, left: true }, level, all, DJ);
        expect(s.x).toBe(110);                          // both held = 0
        s = step(s, null, level, all, DJ);
        expect(s.x).toBe(110);                          // instant stop
    });

    it('edge wrap: teleports to the bare far edge only when entirely offscreen', () => {
        const level = djLevel();
        // rightward: x - 23 > 240 -> 0 (measured 268.6 -> 0)
        let s = { ...falling({ x: 258.6, y: 50, vy: -30, t: 0 }) };
        s = step(s, { right: true }, level, all, DJ);   // 268.6: fully off
        expect(s.x).toBe(0);
        // partially visible: stays
        s = { ...falling({ x: 250, y: 50, vy: -30, t: 0 }) };
        s = step(s, null, level, all, DJ);
        expect(s.x).toBe(250);
        // leftward: x < -23 -> 240 (measured -30 -> 240)
        s = { ...falling({ x: -20, y: 50, vy: -30, t: 0 }) };
        s = step(s, { left: true }, level, all, DJ);    // -30
        expect(s.x).toBe(240);
    });

    it('catch half-span is 53 (block 60/2 + xradius 23; catch_native_01)', () => {
        const mk = (dx) => {
            const level = djLevel({
                platforms: [{ id: 'p', x: 120, y: 300, type: 'green' }],
            });
            const r = simulate(level, all, () => null, {
                constants: DJ, maxFrames: 60,
                start: { ...falling({ x: 120 + dx, y: 200, vy: 0, t: 0 }) },
            });
            return r.trajectory.some((s) => s.landedOn === 'p');
        };
        expect(mk(53)).toBe(true);
        expect(mk(54)).toBe(false);
    });

    it('terminal fall is 22 with no rising cap', () => {
        const level = djLevel({ size: { width: 240, height: 10000 } });
        let s = { ...falling({ x: 120, y: 100, vy: 0, t: 0 }) };
        for (let i = 0; i < 30; i++) s = step(s, null, level, all, DJ);
        expect(s.vy).toBe(22);
    });

    it('jetpack: sustained net -1/tick² for exactly 100 ticks (jetpack_native_01)', () => {
        const level = djLevel({
            size: { width: 240, height: 12000 },
            platforms: [{ id: 'p', x: 120, y: 11900, type: 'green' }],
            jetpacks: [{ id: 'j', x: 120, y: 11895, on: 'p' }],
        });
        let s = { ...falling({ x: 120, y: 11800, vy: 0, t: 0 }) };
        while (!s.landedOn) s = step(s, null, level, all, DJ);
        expect(s.latched).toBe('jetpack');
        const vys = [];
        for (let i = 0; i < 110; i++) {
            s = step(s, null, level, all, DJ);
            vys.push(s.vy);
        }
        expect(vys[0]).toBe(-1);                        // -5 thrust + 4 gravity
        expect(vys[1]).toBe(-2);
        expect(vys[99]).toBe(-100);                     // peak after 100 thrust ticks
        expect(vys[100]).toBe(-96);                     // ballistic decay (+4)
        expect(Math.min(...vys)).toBe(-100);            // no rising cap engaged
    });

    it('blue mover: deterministic ±5 triangle, period 72 over a 180px span (blue_ruffle_01)', () => {
        const p = { id: 'bl', x: 105, y: 300, type: 'blue', sweep: { min: 15, max: 195 } };
        expect(platformXAt(p, 0, DJ)).toBe(15);
        expect(platformXAt(p, 18, DJ)).toBe(105);
        expect(platformXAt(p, 36, DJ)).toBe(195);       // reverses at the bound
        expect(platformXAt(p, 54, DJ)).toBe(105);
        expect(platformXAt(p, 72, DJ)).toBe(15);        // full period
        expect(platformXAt(p, 73, DJ)).toBe(20);        // moving right again
        // static under classic behaviors (and for sweep-less platforms)
        expect(platformXAt(p, 36, DEFAULTS)).toBe(105);
        expect(platformXAt({ ...p, sweep: undefined }, 36, DJ)).toBe(105);
    });

    it('catch tests the blue at its CURRENT swept x, not the placement x', () => {
        const level = djLevel({
            platforms: [{
                id: 'bl', x: 105, y: 300, type: 'blue', sweep: { min: 15, max: 195 },
            }],
        });
        // drop at x=15 starting at t=0: the platform is AT 15 early on
        const rNear = simulate(level, all, () => null, {
            constants: DJ, maxFrames: 12,
            start: { ...falling({ x: 15, y: 250, vy: 0, t: 0 }) },
        });
        expect(rNear.trajectory.some((s) => s.landedOn === 'bl')).toBe(true);
        // same drop with the platform mid-sweep (t=36 -> x=195): misses
        const rFar = simulate(level, all, () => null, {
            constants: DJ, maxFrames: 12,
            start: { ...falling({ x: 15, y: 250, vy: 0, t: 33 }) },
        });
        expect(rFar.trajectory.some((s) => s.landedOn === 'bl')).toBe(false);
    });

    it('classic states still carry and advance the session fields', () => {
        const s0 = spawnState(makeLevel());
        expect(s0.t).toBe(0);
        expect(s0.broken).toEqual([]);
        const s1 = step(s0, null, makeLevel(), allAbilities(), DEFAULTS);
        expect(s1.t).toBe(1);
        expect(s1.broken).toEqual([]);
        expect(s1.latched).toBeNull();
    });
});

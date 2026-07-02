/**
 * Runner physics — feature goldens for everything the toolkit port
 * ADDS (the ported core itself is pinned per-tick by parity.test.js):
 * auto-run, one-way gated platforms + drop-through, suppression,
 * hazards/respawn, reset key, side walls, goal touches, landing
 * bookkeeping, double jump via abilities, stamps, determinism.
 */

import { describe, it, expect } from 'vitest';
import {
    step, spawnState, PROFILES, DEFAULTS, DEFAULT_PROFILE_ID,
    physicsStampFor, resolvePhysicsStamp,
} from './physics.js';
import { effectiveParams, noAbilities, allAbilities } from './suppression.js';

function makeLevel(over = {}) {
    return {
        id: 'fixture',
        size: { width: 40, height: 20 },
        platforms: [{ id: 'floor', x: 0, y: 0, w: 40, h: 1, type: 'ground' }],
        hazards: [],
        pickups: [],
        portals: [],
        spawn: { x: 2, y: 2 },
        ...over,
    };
}

/** Run `n` ticks; `inputAt(t)` supplies held-state input. Returns the
 *  full state trace (index = tick). */
function run(level, n, inputAt = () => ({}), abilities = {}, C = DEFAULTS) {
    const trace = [];
    let s = spawnState(level, C);
    for (let t = 0; t < n; t++) {
        s = step(s, inputAt(t), level, abilities, C);
        trace.push(s);
    }
    return trace;
}

const holdJumpFrom = (t0, t1 = Infinity) => (t) => (t >= t0 && t < t1 ? { jump: true } : {});

describe('auto-run', () => {
    it('runs right with no input and converges to maxSpeed', () => {
        const level = makeLevel();
        const trace = run(level, 100);
        const last = trace.at(-1);
        expect(last.x).toBeGreaterThan(level.spawn.x + 5);
        expect(last.vx).toBeCloseTo(DEFAULTS.maxSpeed, 5);
    });

    it('is a structural field: AUTO_RUN false stands still without input', () => {
        const C = { ...DEFAULTS, AUTO_RUN: false };
        const trace = run(makeLevel(), 100, () => ({}), {}, C);
        expect(trace.at(-1).x).toBeCloseTo(2, 5);
    });
});

describe('side walls', () => {
    it('stops the auto-runner at the right wall', () => {
        const level = makeLevel({ size: { width: 12, height: 20 } });
        const trace = run(level, 200);
        const last = trace.at(-1);
        expect(last.x).toBeCloseTo(12 - DEFAULTS.PLAYER_W, 10);
        expect(last.vx).toBe(0);
    });
});

describe('jumping', () => {
    /** Max rise above the launch y for a jump held [t0, t1). */
    function apexRise(C, t0 = 20, t1 = 120, abilities = {}, secondPressAt = null) {
        const level = makeLevel();
        const inputAt = (t) => {
            let jump = t >= t0 && t < t1;
            if (secondPressAt !== null) {
                if (t >= secondPressAt - 2 && t < secondPressAt) jump = false; // release
                if (t >= secondPressAt) jump = true;                          // re-press
            }
            return { jump };
        };
        const trace = run(level, 200, inputAt, abilities, C);
        const groundY = 1; // floor top
        return Math.max(...trace.map((s) => s.y)) - groundY;
    }

    for (const [id, profile] of Object.entries(PROFILES)) {
        it(`${id}: full-hold apex tracks jumpHeight; early release cuts it`, () => {
            const C = profile.constants;
            const full = apexRise(C, 20, 120);
            const cut = apexRise(C, 20, 23);
            expect(full).toBeGreaterThan(C.jumpHeight * 0.75);
            expect(full).toBeLessThan(C.jumpHeight * 1.8);
            if (C.jumpCutOff > C.upwardMovementMultiplier) {
                expect(cut).toBeLessThan(full);
            } else {
                // sonic: jumpCutOff === upwardMovementMultiplier — the
                // preset has no effective jump cut, by design
                expect(cut).toBeCloseTo(full, 10);
            }
        });
    }

    it('double jump works only with the ability (and step applies the overlay itself)', () => {
        const C = DEFAULTS;
        const withDj = apexRise(C, 20, Infinity, { doubleJump: true }, 45);
        const without = apexRise(C, 20, Infinity, {}, 45);
        expect(withDj).toBeGreaterThan(without + C.jumpHeight * 0.5);
    });

    it('landedOn fires exactly on the landing tick', () => {
        const trace = run(makeLevel(), 30, () => ({}), {}, { ...DEFAULTS, AUTO_RUN: false });
        const landings = trace
            .map((s, t) => (s.landedOn ? { t, on: s.landedOn } : null))
            .filter(Boolean);
        expect(landings).toHaveLength(1); // the spawn drop, once
        expect(landings[0].on).toBe('floor');
        // grounded ticks after the landing don't re-fire it
        expect(trace.at(-1).onGround).toBe(true);
        expect(trace.at(-1).landedOn).toBe(null);
    });

    it('standingOn tracks support every grounded tick; a flush boundary switches it with NO landing tick', () => {
        const level = makeLevel({
            platforms: [
                { id: 'floorA', x: 0, y: 0, w: 10, h: 1, type: 'ground' },
                { id: 'floorB', x: 10, y: 0, w: 30, h: 1, type: 'ground' },
            ],
        });
        const trace = run(level, 150);
        // airborne spawn drop: standingOn null until the landing tick
        expect(trace[0].standingOn).toBe(null);
        const landTick = trace.findIndex((s) => s.landedOn === 'floorA');
        expect(landTick).toBeGreaterThan(0);
        expect(trace[landTick].standingOn).toBe('floorA');
        // auto-run carries across the flush boundary: support switches…
        const crossTick = trace.findIndex((s) => s.standingOn === 'floorB');
        expect(crossTick).toBeGreaterThan(landTick);
        // …with no airborne phase and no second landing tick anywhere
        const landings = trace.filter((s) => s.landedOn !== null);
        expect(landings).toHaveLength(1);
        for (let t = landTick; t <= crossTick; t++) {
            expect(trace[t].onGround).toBe(true);
        }
    });
});

describe('one-way gated platforms', () => {
    const platformLevel = (extra = {}) => makeLevel({
        platforms: [
            { id: 'floor', x: 0, y: 0, w: 40, h: 1, type: 'ground' },
            { id: 'blue1', x: 4, y: 3, w: 6, h: 0.5, type: 'blue' },
        ],
        spawn: { x: 6, y: 8 }, // directly above blue1
        ...extra,
    });

    it('suppressed without the item: the fall passes through to the floor', () => {
        const trace = run(platformLevel(), 60, () => ({}), noAbilities(),
            { ...DEFAULTS, AUTO_RUN: false });
        const landing = trace.find((s) => s.landedOn);
        expect(landing.landedOn).toBe('floor');
    });

    it('present with the item: catches the fall from above', () => {
        const trace = run(platformLevel(), 60, () => ({}), { blue: true },
            { ...DEFAULTS, AUTO_RUN: false });
        const landing = trace.find((s) => s.landedOn);
        expect(landing.landedOn).toBe('blue1');
        expect(landing.y).toBeCloseTo(3.5, 10);
    });

    it('drop-through: holding drop falls through to the floor', () => {
        const trace = run(platformLevel(), 80, () => ({ drop: true }), { blue: true },
            { ...DEFAULTS, AUTO_RUN: false });
        const landing = trace.find((s) => s.landedOn);
        expect(landing.landedOn).toBe('floor');
    });

    it('never blocks from below: a rising jump passes through, then lands on top', () => {
        // toolkit profile jumps 5 high — through blue1 (top 3.5) from the floor
        const C = { ...PROFILES.toolkit.constants, AUTO_RUN: false };
        const level = platformLevel({ spawn: { x: 6, y: 2 } });
        const trace = run(level, 200, holdJumpFrom(20), { blue: true }, C);
        const landings = trace.filter((s) => s.landedOn).map((s) => s.landedOn);
        expect(landings[0]).toBe('floor');   // spawn drop
        expect(landings).toContain('blue1'); // up through it, down onto it
        // no head-bonk on the way up: vy never zeroed while rising below the top
        const bonk = trace.find((s) => s.y + C.PLAYER_H > 3 && s.y + C.PLAYER_H < 3.5
            && s.vy === 0 && !s.onGround);
        expect(bonk).toBeUndefined();
    });

    it('solid ground DOES block from below (head bonk)', () => {
        const C = { ...PROFILES.toolkit.constants, AUTO_RUN: false };
        const level = makeLevel({
            platforms: [
                { id: 'floor', x: 0, y: 0, w: 40, h: 1, type: 'ground' },
                // lid ABOVE the spawn's standing height (spawn top is
                // 3.125) so the drop doesn't start inside it
                { id: 'lid', x: 0, y: 4, w: 40, h: 0.5, type: 'ground' },
            ],
        });
        const trace = run(level, 100, holdJumpFrom(20), {}, C);
        const peak = Math.max(...trace.map((s) => s.y));
        expect(peak).toBeCloseTo(4 - C.PLAYER_H, 10); // clipped at the lid's underside
    });
});

describe('hazards, falling, reset', () => {
    it('hazard touch respawns at the spawn (v1: any hit kills)', () => {
        const level = makeLevel({
            hazards: [{ id: 'spikes', type: 'spikes', x: 8, y: 1, w: 1, h: 0.8 }],
        });
        const trace = run(level, 120); // auto-run into the spikes
        const hit = trace.find((s) => s.respawned === 'hazard');
        expect(hit).toBeDefined();
        expect(hit.x).toBe(level.spawn.x);
        expect(hit.y).toBe(level.spawn.y);
        expect(hit.hits).toBe(0); // per-attempt state reset
    });

    it('falling below FALL_MARGIN respawns with cause fell', () => {
        const level = makeLevel({
            platforms: [{ id: 'ledge', x: 0, y: 0, w: 4, h: 1, type: 'ground' }],
        });
        const trace = run(level, 200); // auto-run off the ledge into the void
        expect(trace.some((s) => s.respawned === 'fell')).toBe(true);
    });

    it('reset key respawns immediately with cause reset', () => {
        const trace = run(makeLevel(), 60, (t) => (t === 50 ? { reset: true } : {}));
        const r = trace[50];
        expect(r.respawned).toBe('reset');
        expect(r.x).toBe(2);
        expect(trace[51].respawned).toBe(null);
    });

    it('a jump held across a respawn does not re-trigger (no rising edge)', () => {
        const level = makeLevel({
            platforms: [{ id: 'ledge', x: 0, y: 0, w: 4, h: 1, type: 'ground' }],
        });
        // hold jump from tick 0 forever; the auto-run falls off the ledge
        const trace = run(level, 400, () => ({ jump: true }));
        const respawnT = trace.findIndex((s) => s.respawned === 'fell');
        expect(respawnT).toBeGreaterThan(0);
        // after the respawn the held jump must never launch again
        const relaunch = trace.slice(respawnT + 1).find(
            (s) => s.currentlyJumping && s.vy > 1);
        expect(relaunch).toBeUndefined();
    });
});

describe('goal touches', () => {
    it('auto-run crosses a pickup and a portal placed in its wake', () => {
        const level = makeLevel({
            pickups: [{ id: 'pk1', on: 'floor', x: 10, y: 1.5 }],
            portals: [{ id: 'exit1', on: 'floor', x: 20, y: 1.5 }],
        });
        const trace = run(level, 300);
        expect(trace.some((s) => s.touchedPickups.includes('pk1'))).toBe(true);
        expect(trace.some((s) => s.touchedPortals.includes('exit1'))).toBe(true);
        // pickup comes first (it is left of the portal)
        const tPk = trace.findIndex((s) => s.touchedPickups.includes('pk1'));
        const tPt = trace.findIndex((s) => s.touchedPortals.includes('exit1'));
        expect(tPk).toBeLessThan(tPt);
    });
});

describe('determinism and profiles', () => {
    it('identical runs produce identical state streams', () => {
        const level = makeLevel({
            hazards: [{ id: 'hz', type: 'spikes', x: 15, y: 1, w: 1, h: 0.8 }],
        });
        const inputAt = (t) => ({ jump: t % 37 < 5, drop: t % 91 === 0 });
        const a = run(level, 500, inputAt, { doubleJump: true });
        const b = run(level, 500, inputAt, { doubleJump: true });
        for (let t = 0; t < a.length; t++) {
            expect(Object.is(a[t].x, b[t].x) && Object.is(a[t].y, b[t].y)
                && Object.is(a[t].vx, b[t].vx) && Object.is(a[t].vy, b[t].vy)).toBe(true);
        }
    });

    it('stamp round-trip: embedded constants win and reproduce the profile', () => {
        const stamp = physicsStampFor(DEFAULT_PROFILE_ID);
        expect(stamp.profile).toBe(DEFAULT_PROFILE_ID);
        expect(resolvePhysicsStamp(stamp)).toEqual({ ...PROFILES[DEFAULT_PROFILE_ID].constants });
        expect(resolvePhysicsStamp(null)).toBe(DEFAULTS);
        expect(() => physicsStampFor('nope')).toThrow(/unknown physics profile/);
    });

    it('effectiveParams is identity without abilities and overlays doubleJump', () => {
        expect(effectiveParams(DEFAULTS, noAbilities())).toBe(DEFAULTS);
        expect(effectiveParams(DEFAULTS, allAbilities()).maxAirJumps).toBe(1);
        expect(DEFAULTS.maxAirJumps).toBe(0); // base untouched
    });
});

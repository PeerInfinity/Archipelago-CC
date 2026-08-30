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

    it('landing clears currentlyJumping so coyote works after a previous jump', () => {
        // Auto-run across a single floor ending at x=20: tap a jump
        // early, land, then run off the lip and press mid-coyote. The
        // solver's arrivedState assumes every landing yields a fresh
        // coyote window — this pins the engine to that model (the
        // pre-fix port left currentlyJumping stuck true after the
        // first jump, so the coyote counter never accrued again).
        const level = makeLevel({
            platforms: [{ id: 'floor', x: 0, y: 0, w: 20, h: 1, type: 'ground' }],
        });
        // pass 1 — tap jump at t=5, find the landing and the lip fall
        const probe = run(level, 200, holdJumpFrom(5, 9));
        const landTick = probe.findIndex((s, t) => t > 5 && s.landedOn === 'floor');
        expect(landTick).toBeGreaterThan(5);
        expect(probe[landTick].currentlyJumping).toBe(false); // the fix
        const offLip = probe.findIndex((s, t) => t > landTick && !s.onGround);
        expect(offLip).toBeGreaterThan(landTick);
        // the coyote window accrues again on the second lip…
        expect(probe[offLip + 2].coyoteTimeCounter).toBeGreaterThan(0);
        // pass 2 — …and a mid-coyote press actually launches
        const trace = run(level, offLip + 60, (t) =>
            ((t >= 5 && t < 9) || (t >= offLip + 2 && t < offLip + 6) ? { jump: true } : {}));
        const floorTop = 1;
        const risesAfterLip = trace.slice(offLip + 2)
            .some((s) => s.currentlyJumping && s.y > floorTop + 0.5);
        expect(risesAfterLip).toBe(true);
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

describe('oneway platforms (ungated drop-through — reward shelves)', () => {
    const shelfLevel = makeLevel({
        platforms: [
            { id: 'floor', x: 0, y: 0, w: 40, h: 1, type: 'ground' },
            { id: 'shelf', x: 4, y: 3, w: 6, h: 0.5, type: 'oneway' },
        ],
        spawn: { x: 6, y: 8 }, // directly above the shelf
    });

    it('exists under NO abilities: catches the fall from above', () => {
        const trace = run(shelfLevel, 60, () => ({}), noAbilities(),
            { ...DEFAULTS, AUTO_RUN: false });
        const landing = trace.find((s) => s.landedOn);
        expect(landing.landedOn).toBe('shelf');
        expect(landing.y).toBeCloseTo(3.5, 10);
    });

    it('drop-through works regardless of abilities (§8.6: always refusable)', () => {
        for (const abilities of [noAbilities(), { doubleJump: true, blue: true, spring: true }]) {
            const trace = run(shelfLevel, 80, () => ({ drop: true }), abilities,
                { ...DEFAULTS, AUTO_RUN: false });
            const landing = trace.find((s) => s.landedOn);
            expect(landing.landedOn).toBe('floor');
        }
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

describe('hit budget (plan §4.10 — Shield)', () => {
    const SHIELD = { shield: true };
    const twoPatches = () => makeLevel({
        hazards: [
            { id: 'hzA', type: 'spikes', x: 8, y: 1, w: 2, h: 0.8 },
            { id: 'hzB', type: 'spikes', x: 20, y: 1, w: 1, h: 0.8 },
        ],
    });

    it('one contact episode charges ONE hit however long the overlap lasts', () => {
        const trace = run(twoPatches(), 60, () => ({}), SHIELD);
        const contactTicks = trace.filter((s) => s.hazardContacts.includes('hzA'));
        expect(contactTicks.length).toBeGreaterThan(3); // a walk-through overlaps many ticks
        expect(contactTicks.every((s) => s.hits === 1)).toBe(true); // charged once, at entry
        expect(trace.slice(0, 55).some((s) => s.respawned)).toBe(false);
    });

    it('the second hazard exhausts the budget and respawns; the respawn refills it', () => {
        const trace = run(twoPatches(), 400, () => ({}), SHIELD);
        const death = trace.findIndex((s) => s.respawned === 'hazard');
        expect(death).toBeGreaterThan(0);
        expect(trace[death].hits).toBe(0); // per-attempt reset, budget refilled
        expect(trace[death].hazardContacts).toEqual([]);
        // the next life replays the same story: survive A, die at B
        const secondDeath = trace.slice(death + 1).findIndex((s) => s.respawned === 'hazard');
        expect(secondDeath).toBeGreaterThan(0);
        expect(trace.slice(death + 1, death + 1 + secondDeath)
            .some((s) => s.hits === 1)).toBe(true);
    });

    it('leaving and re-entering the SAME hazard is a second episode (second charge)', () => {
        const level = makeLevel({
            hazards: [{ id: 'wide', type: 'spikes', x: 8, y: 1, w: 6, h: 0.8 }],
        });
        // enter the patch (charge 1), then a tap hop that clears its
        // 0.8 top and lands back INSIDE it — the re-entry must charge
        // again and exhaust the budget
        const first = run(level, 60, () => ({}), SHIELD)
            .findIndex((s) => s.hits === 1);
        expect(first).toBeGreaterThan(0);
        const trace = run(level, first + 60,
            (t) => (t >= first + 2 && t < first + 5 ? { jump: true } : {}), SHIELD);
        const death = trace.find((s) => s.respawned === 'hazard');
        expect(death).toBeDefined();
    });

    it('MAX_HITS 0 keeps the first contact tick lethal (v1 byte-identity)', () => {
        const trace = run(twoPatches(), 120); // no shield
        const death = trace.findIndex((s) => s.respawned === 'hazard');
        expect(death).toBeGreaterThan(0);
        expect(trace.slice(0, death).every((s) => s.hits === 0)).toBe(true);
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

    it('effectiveParams is identity without abilities and overlays doubleJump + shield', () => {
        expect(effectiveParams(DEFAULTS, noAbilities())).toBe(DEFAULTS);
        expect(effectiveParams(DEFAULTS, allAbilities()).maxAirJumps).toBe(1);
        expect(effectiveParams(DEFAULTS, allAbilities()).MAX_HITS).toBe(1);
        expect(effectiveParams(DEFAULTS, { shield: true }).maxAirJumps).toBe(0);
        expect(DEFAULTS.maxAirJumps).toBe(0); // base untouched
        expect(DEFAULTS.MAX_HITS).toBe(0);
    });
});

describe('spring platforms', () => {
    const SPR = { id: 'spr', x: 6, y: 0, w: 4, h: 0.5, type: 'spring' };
    /** A spring under the spawn drop: the runner runs off a ledge onto
     *  it (no wall — the ledge ends before the spring). */
    function springLevel(over = {}) {
        return makeLevel({
            platforms: [
                { id: 'ledge', x: 0, y: 4, w: 4, h: 1, type: 'ground' },
                { id: 'floor', x: 14, y: 0, w: 26, h: 1, type: 'ground' },
                SPR,
            ],
            spawn: { x: 1, y: 5 },
            ...over,
        });
    }
    const springTop = SPR.y + SPR.h;
    const abilities = { spring: true };

    function bounceTrace(inputAt = () => ({}), C = DEFAULTS) {
        return run(springLevel(), 260, inputAt, abilities, C);
    }

    for (const [id, profile] of Object.entries(PROFILES)) {
        it(`${id}: bounce rises ~SPRING_RISE above the spring top`, () => {
            const C = profile.constants;
            const trace = run(springLevel(), 400, () => ({}), abilities, C);
            const sprung = trace.findIndex((s) => s.sprungOn === 'spr');
            expect(sprung).toBeGreaterThan(0);
            const apex = Math.max(...trace.slice(sprung).map((s) => s.y));
            const rise = apex - springTop;
            expect(rise).toBeGreaterThan(C.SPRING_RISE * 0.9);
            expect(rise).toBeLessThan(C.SPRING_RISE * 1.25);
        });
    }

    it('bounce height is jump-hold independent (deterministic arc)', () => {
        const free = bounceTrace(() => ({}));
        const held = bounceTrace(() => ({ jump: true }));
        // held-from-spawn: the press fires on the LEDGE (grounded), so
        // compare only from the bounce tick, where the arcs must agree
        const sFree = free.findIndex((s) => s.sprungOn === 'spr');
        const sHeld = held.findIndex((s) => s.sprungOn === 'spr');
        expect(sFree).toBeGreaterThan(0);
        expect(sHeld).toBeGreaterThan(0);
        const apexFree = Math.max(...free.slice(sFree).map((s) => s.y));
        const apexHeld = Math.max(...held.slice(sHeld).map((s) => s.y));
        expect(Math.abs(apexFree - apexHeld)).toBeLessThan(0.15);
    });

    it('never grounds on the spring: sprungOn fires, standingOn/landedOn never', () => {
        const trace = bounceTrace();
        expect(trace.some((s) => s.sprungOn === 'spr')).toBe(true);
        expect(trace.some((s) => s.standingOn === 'spr')).toBe(false);
        expect(trace.some((s) => s.landedOn === 'spr')).toBe(false);
    });

    it('holding drop refuses the bounce (falls through to the kill floor)', () => {
        const level = springLevel({
            platforms: [
                { id: 'ledge', x: 0, y: 4, w: 4, h: 1, type: 'ground' },
                SPR,
            ],
        });
        const trace = run(level, 400, () => ({ drop: true }), abilities);
        expect(trace.some((s) => s.sprungOn === 'spr')).toBe(false);
        expect(trace.some((s) => s.respawned === 'fell')).toBe(true);
    });

    it('is existence-gated: without the item the spring does not catch', () => {
        const level = springLevel({
            platforms: [
                { id: 'ledge', x: 0, y: 4, w: 4, h: 1, type: 'ground' },
                SPR,
            ],
        });
        const trace = run(level, 400, () => ({}), {});
        expect(trace.some((s) => s.sprungOn === 'spr')).toBe(false);
        expect(trace.some((s) => s.respawned === 'fell')).toBe(true);
    });
});

describe('glider pads (plan §8.5/§8.7 step 4 — the Glide item)', () => {
    /** A glider pad high over open ground: run off its right end. */
    function padLevel(padType = 'glider') {
        return makeLevel({
            size: { width: 60, height: 20 },
            platforms: [
                { id: 'pad', x: 0, y: 5, w: 10, h: 1, type: padType },
                { id: 'floor', x: 0, y: 0, w: 60, h: 1, type: 'ground' },
            ],
            spawn: { x: 1, y: 6 },
        });
    }
    const abilities = { glide: true };
    const CAP = DEFAULTS.GLIDE_FALL_CAP;

    it('hop-and-hold: the jump descent falls fast, the walk-off glide is capped', () => {
        // hold jump from the pad: the press fires a grounded hop whose
        // descent must NOT glide (currentlyJumping — jumps own their
        // arcs); it lands back on the pad still holding, runs off the
        // lip, and the non-jump fall glides at the cap all the way down
        const trace = run(padLevel(), 500, holdJumpFrom(1), abilities);
        const land = trace.findIndex((s) => s.landedOn === 'pad');
        expect(land).toBeGreaterThan(0);
        const hopMinVy = Math.min(...trace.slice(0, land + 1).map((s) => s.vy));
        expect(hopMinVy).toBeLessThan(-(CAP + 2));
        const off = trace.findIndex((s, i) => i > land && !s.onGround);
        expect(off).toBeGreaterThan(land);
        const landing = trace.findIndex((s, i) => i > off && s.standingOn === 'floor');
        expect(landing).toBeGreaterThan(off);
        const glideMinVy = Math.min(...trace.slice(off, landing).map((s) => s.vy));
        expect(glideMinVy).toBeGreaterThanOrEqual(-CAP - 1e-9);
        // the glide slope (~maxSpeed : CAP) carries far right of the
        // ballistic landing (~x 12)
        expect(trace[landing].x).toBeGreaterThan(28);
    });

    it('voluntary: not holding, the run-off is tick-identical to an ungated oneway pad', () => {
        // the pad's only behavioral difference is the held-jump glide;
        // with the button up the trajectory must be byte-identical to
        // plain one-way geometry (the monotonicity-by-construction
        // requirement: gaining Glide changes nothing you don't ask for)
        const a = run(padLevel('glider'), 300, () => ({}), abilities);
        const b = run(padLevel('oneway'), 300, () => ({}), {});
        for (let t = 0; t < 300; t++) {
            for (const f of ['x', 'y', 'vx', 'vy', 'onGround', 'standingOn']) {
                expect(a[t][f], `tick ${t} field ${f}`).toStrictEqual(b[t][f]);
            }
        }
    });

    it('a spring flight never glides: the bounce owns its arc (springFlight)', () => {
        const level = makeLevel({
            size: { width: 80, height: 24 },
            platforms: [
                { id: 'pad', x: 0, y: 5, w: 10, h: 1, type: 'glider' },
                { id: 'spr', x: 10.5, y: 0, w: 4, h: 0.5, type: 'spring' },
                { id: 'floor', x: 15, y: 0, w: 65, h: 1, type: 'ground' },
            ],
            spawn: { x: 1, y: 6 },
        });
        const both = { glide: true, spring: true };
        // dry run finds the spring catch, then hold jump only after it:
        // the press is airborne (the bounce pinned coyote closed), so
        // no jump fires — but the held descent must still fall FAST:
        // the flight is the spring's, launched-from-pad or not
        const dry = run(level, 400, () => ({}), both);
        const catchT = dry.findIndex((s) => s.sprungOn === 'spr');
        expect(catchT).toBeGreaterThan(0);
        const trace = run(level, 600, (t) => (t > catchT ? { jump: true } : {}), both);
        expect(trace.findIndex((s) => s.sprungOn === 'spr')).toBe(catchT);
        const landT = trace.findIndex((s, i) => i > catchT && s.standingOn != null);
        expect(landT).toBeGreaterThan(catchT);
        const minVy = Math.min(...trace.slice(catchT, landT).map((s) => s.vy));
        expect(minVy).toBeLessThan(-(CAP + 2));
    });

    it('is existence-gated: without the item the pad does not exist', () => {
        const without = run(padLevel(), 40, () => ({}), {});
        expect(without.some((s) => s.standingOn === 'pad')).toBe(false);
        expect(without.some((s) => s.standingOn === 'floor')).toBe(true);
        const withIt = run(padLevel(), 40, () => ({}), abilities);
        expect(withIt.some((s) => s.standingOn === 'pad')).toBe(true);
    });

    it('drop-through: a glider pad is one-way like every gated platform', () => {
        const trace = run(padLevel(), 60, () => ({ drop: true }), abilities);
        expect(trace.some((s) => s.standingOn === 'pad')).toBe(false);
        expect(trace.some((s) => s.standingOn === 'floor')).toBe(true);
    });
});

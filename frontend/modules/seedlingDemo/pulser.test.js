/**
 * seedlingDemo/pulser.test — the first world-driven hit on the arc.
 *
 * R5 slice 8. The claims that matter are the two SIMULATED numbers (the
 * animation gate and the pulse count), because both are places a closed
 * form gives a different answer from the loop, and the block push — which
 * is the arm five slices read as inert.
 */

import { describe, expect, it } from 'vitest';

import {
    PULSER, PulserError, animGateTicks, createPulser, distanceRectPoint,
    pulsePushes, pulseReaches, pulseTicks, pulserCycle, pulserThreat, stepPulser,
} from './pulser.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { createPushableState } from './pushables.js';

const source = atlasLevelSource();

/** L38's pulser and its block, from the census rather than from literals. */
const l38 = () => buildLevelWorld(source(38), {
    roles: ROLES, inventory: { hasSword: true, hasFire: true },
});

describe('the cycle — transcribed as a loop, because the closed forms lie', () => {
    it('⛔ the animation gate is EIGHT ticks, and a division says five', () => {
        // `add("pulse", [0,1,2,3,4], 20)` at `20 * 0.0333` per update: five
        // frames do NOT take five ticks, they take eight, because the timer
        // crosses 1 on a 0.666 step. §19.5's lesson, one entity later.
        expect(animGateTicks()).toBe(8);
        expect(PULSER.anim.frames).toHaveLength(5);
        expect(PULSER.anim.loop).toBe(true);
    });

    it('⛔ the pulse runs 23 ticks — `18 / 0.8` is 22.5 and the test is `>=` AFTER', () => {
        expect(pulseTicks()).toBe(23);
        expect((PULSER.radiusMax - PULSER.radiusMin) / PULSER.radiusRate).toBe(22.5);
        // A model that divided and floored would be one hit short every cycle.
        expect(pulseTicks()).toBeGreaterThan(
            Math.floor((PULSER.radiusMax - PULSER.radiusMin) / PULSER.radiusRate),
        );
    });

    it('⚠ the period is 51, not 52 — the play tick IS the gate\'s first tick', () => {
        const c = pulserCycle();
        expect(c.totalTicks).toBe(51);
        expect(c.totalTicks).toBe(c.waitTicks + c.animGateTicks + c.pulseTicks);

        // ...and the drive agrees, which is the point of asserting both.
        let s = createPulser(80, 224, 1);
        const pulses = [];
        const hits = [];
        for (let t = 1; t <= 130; t += 1) {
            const r = stepPulser(s, true);
            s = r.state;
            if (r.pulsed) pulses.push(t);
            if (r.hit) hits.push(t);
        }
        expect(pulses).toEqual([1, 52, 103]);
        expect(pulses[1] - pulses[0]).toBe(c.totalTicks);
        // The first burst is ticks 9..31 — the gate, then 23 hits.
        expect(hits.slice(0, 23)).toEqual(
            Array.from({ length: 23 }, (_, i) => 9 + i),
        );
    });

    it('a pulser whose group nobody publishes never hits', () => {
        let s = createPulser(80, 224, 1);
        let hits = 0;
        for (let t = 0; t < 200; t += 1) {
            const r = stepPulser(s, false);
            s = r.state;
            if (r.hit) hits += 1;
        }
        expect(hits).toBe(0);
        expect(s.radius).toBe(PULSER.radiusMin);
    });

    it('⚠ `radius > radiusMin` finishes a ring the flag stopped mid-expansion', () => {
        // The `||` is not decoration: a pulse already expanding completes.
        let s = createPulser(80, 224, 1);
        for (let t = 0; t < 12; t += 1) s = stepPulser(s, true).state;
        expect(s.radius).toBeGreaterThan(PULSER.radiusMin);
        let after = 0;
        for (let t = 0; t < 40; t += 1) {
            const r = stepPulser(s, false);
            s = r.state;
            if (r.hit) after += 1;
        }
        expect(after).toBeGreaterThan(0);
        // ...and then it stops for good.
        expect(s.radius).toBe(PULSER.radiusMin);
    });

    it('`activate` has no default — a quiet pulser and a latched one are the mechanic', () => {
        expect(() => stepPulser(createPulser(80, 224, 1))).toThrow(PulserError);
    });
});

describe('⛔⛔ the arm five slices read as inert: the pulse MOVES a block', () => {
    it('L38\'s block is the pulser\'s north neighbour and goes to the button cell', () => {
        const w = l38();
        const p = createPulser(80, 224, 1);
        const blocks = createPushableState(w);
        const block = [...blocks.byId.values()].find((b) => b.x === 80 && b.y === 208);
        expect(block, 'L38 must hold `pushableblockfire@80,208`').toBeTruthy();

        const out = pulsePushes(p, block);
        expect(out.moved).toBe(true);
        // A pure axis: dx 0, so only the Y target moves.
        expect(out.axes).toEqual(['N']);
        expect(out.both).toBe(false);
        expect(out.block.target.y).toBe(block.target.y - 16);
        expect(out.block.target.x).toBe(block.target.x);

        // ...and the destination cell IS `button@80,192`.
        const button = w.pressers.find((q) => q.t === 0);
        expect(button).toMatchObject({ tag: 'button', x: 80, y: 192 });
        expect(Math.floor((out.block.target.y - 8) / 16)).toBe(Math.floor(button.y / 16));
    });

    it('⛓ "Pulse" is in `moveTypes` — the OTHER member, which has a writer', () => {
        const w = l38();
        const blocks = createPushableState(w);
        const block = [...blocks.byId.values()].find((b) => b.x === 80 && b.y === 208);
        expect(block.as3).toBe('PushableBlockFire');
        // The same non-relative arm a fire press takes; only the `t` differs.
        expect(pulsePushes(createPulser(80, 224, 1), block).moved).toBe(true);
    });

    it('a block already gliding is a no-op — `if (v.length > 0) return`', () => {
        const w = l38();
        const blocks = createPushableState(w);
        const block = [...blocks.byId.values()].find((b) => b.x === 80 && b.y === 208);
        const moving = { ...block, vx: 0.5, vy: 0 };
        expect(pulsePushes(createPulser(80, 224, 1), moving).moved).toBe(false);
    });
});

describe('the reach — ONE vector, iterated ONCE', () => {
    const p = createPulser(80, 224, 1);
    const target = (over) => ({
        id: 't', type: 'Solid', as3: 'PushableBlockFire',
        x: 80, y: 208, originX: 0, originY: 0, w: 16, h: 16, ...over,
    });

    it('⚠ NOT `fire()`\'s nested loop — one dispatch per target per type', () => {
        // `Pulser.hit` fills its vector across three types and iterates it
        // once. The fire arm's 25 dispatches came from exactly this code
        // written one indent differently (§19.4), so it is asserted rather
        // than assumed to be the ordinary shape.
        const hits = pulseReaches(p, [target()]);
        expect(hits).toHaveLength(1);
        expect(hits[0].arm).toBe('pushable');
    });

    it('the filter is 22 px point-to-box, and it is a THIRD radius', () => {
        expect(PULSER.radiusHit).toBe(22);
        expect(PULSER.radiusHit).not.toBe(PULSER.radiusMax);
        expect(PULSER.radiusHit).not.toBe(PULSER.radiusMin);
        // ⚠ THE TWO FILTERS ARE DIFFERENT SHAPES, and only a corner tells
        // them apart: the collide box is a 44x44 SQUARE and the cut is a
        // 22 px RADIUS, so its corners stick out to 31.1 px. A candidate at
        // (108,252) overlaps the box and is 28.28 px away — collected by
        // the first test and dropped by the second, which is the only
        // arrangement that proves both are running.
        const corner = target({ x: 108, y: 252, w: 4, h: 4 });
        expect(distanceRectPoint(p.x, p.y, 108, 252, 4, 4)).toBeCloseTo(28.28, 2);
        expect(pulseReaches(p, [corner])).toEqual([]);
        // ...and one just inside the radius on the same diagonal is kept.
        expect(pulseReaches(p, [target({ x: 100, y: 244, w: 4, h: 4 })])).toHaveLength(1);
    });

    it('a `Solid` that is no known class falls off the `else if` chain', () => {
        const hits = pulseReaches(p, [target({ as3: 'Tile' })]);
        expect(hits).toHaveLength(1);
        expect(hits[0].arm).toBe('none');
    });

    it('a type outside `hitables` is never collected at all', () => {
        expect(pulseReaches(p, [target({ type: 'Tree' })])).toEqual([]);
    });

    it('refuses a target with a missing origin rather than reading it as 0', () => {
        expect(() => pulseReaches(p, [target({ originX: undefined })]))
            .toThrow(/finite `originX`/);
    });

    it('`distanceRectPoint` matches FlashPunk on all nine regions', () => {
        // inside
        expect(distanceRectPoint(10, 10, 0, 0, 20, 20)).toBe(0);
        // straight off each face
        expect(distanceRectPoint(10, 30, 0, 0, 20, 20)).toBe(10);
        expect(distanceRectPoint(10, -5, 0, 0, 20, 20)).toBe(5);
        expect(distanceRectPoint(30, 10, 0, 0, 20, 20)).toBe(10);
        expect(distanceRectPoint(-5, 10, 0, 0, 20, 20)).toBe(5);
        // a corner
        expect(distanceRectPoint(23, 24, 0, 0, 20, 20)).toBeCloseTo(5, 6);
    });
});

describe('the damage ring is a standing cost, not a phase to walk past', () => {
    it('is a `point` volume at the pulser\'s entity position', () => {
        const t = pulserThreat(createPulser(64, 96, 6));
        expect(t).toMatchObject({ kind: 'point', x: 72, y: 104, r: 22, damage: 1, force: 6 });
    });

    it('⛓ L39\'s rope-armed pulser is the one `r5Totem.GROUP_6` prices', () => {
        // §18.7 named the ring at (72,104) and left it unpriced; this is
        // the volume that pricing needs.
        const w = buildLevelWorld(source(39), {
            roles: ROLES, inventory: { hasSword: true, hasFire: true },
        });
        const blocks = createPushableState(w);
        const t = pulserThreat(createPulser(64, 96, 6));
        // ⛓ AND NO BLOCK IS INSIDE IT, which is why L39's pulser is only a
        // damage ring while L38's is a mechanism. Measured, not assumed.
        const reached = pulseReaches(createPulser(64, 96, 6),
            [...blocks.byId.values()].map((b) => ({
                id: b.id, type: 'Solid', as3: b.as3,
                x: b.x, y: b.y, originX: 0, originY: 0, w: 16, h: 16,
            })));
        expect(reached).toEqual([]);
        expect(t.r).toBe(PULSER.radiusHit);
    });
});

/**
 * seedlingDemo/pulser — THE FIRST WORLD-DRIVEN HIT ON THE ARC.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 8, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §21.5.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * Every mover this arc has modelled is a PLAYER PRESS: a slash, a spear
 * thrust, a fire window. `Pulser` is the first thing that hits on its own
 * clock, and it turned up as the engine of L38's opening mechanic — the
 * level between the route and the whole totem cluster.
 *
 * `Pulser.hit()` (`Puzzlements/Pulser.as:88-115`) collides
 * `["Player", "Solid", "Enemy"]` in a `radiusHit * 2` box, filters the
 * candidates on `FP.distanceRectPoint`, and dispatches by class:
 *
 * ```
 *   PushableBlockFire  ->  hit(new Point(x, y), "Pulse")   ⛔⛔ IT MOVES BLOCKS
 *   IceTurret          ->  bump(new Point(x, y), "Pulse")
 *   Enemy              ->  hit(force 6, new Point(x, y), damage 1, "Pulse")
 *   Player             ->  hit(null, force 6, new Point(x, y), damage 1)
 * ```
 *
 * ⚠⚠ THE FIRST ARM IS THE ONE FIVE SLICES MISSED. `PushableBlockFire`'s
 * `moveTypes` is `["Fire", "Pulse"]`, and §18.9, §19.2, §19.8, §20.2 and
 * §20.3 all read that as "Fire is the one that matters". The other member
 * has a writer, it takes the SAME non-relative `hit(Point, t)` arm the fire
 * press takes, and in L38 it is the entire reason the level opens.
 * See [[feedback_inert_for_this_weapon]] from the other side: the question
 * is not only which weapon, it is also who is holding it.
 *
 * ── ⛓ THE CYCLE IS TRANSCRIBED AS A LOOP, NOT AS FOUR NUMBERS ─────────
 *
 * `Pulser.update` is a three-way branch on `pulseTimer` guarded by
 * `currentAnim == ""`, and the animation is what makes the third state
 * exist at all:
 *
 * ```
 *   if (activate || radius > radiusMin)
 *   {
 *       if ((graphic as Spritemap).currentAnim == "")
 *       {
 *           if (pulseTimer > 0)       pulseTimer--;                 // WAIT
 *           else if (pulseTimer == 0) { play("pulse"); pulseTimer = -1; }
 *           else { hit(); radius += radiusRate;                     // PULSE
 *                  if (radius >= radiusMax) { pulseTimer = pulseTimerMax;
 *                                             radius = radiusMin; } }
 *       }
 *   }
 *   else { pulseTimer = -1; radius = radiusMin; }
 * ```
 *
 * ⛔ **THE ANIMATION IS A GATE, AND IT LOOPS.** `add("pulse", [0,1,2,3,4],
 * 20)` takes FlashPunk's default `loop = true`, so `complete` never
 * latches; what ends it is the WRAP, which calls the Spritemap's callback —
 * `endAnim`, which plays `""` again. So the number of dead ticks is
 * whatever `Spritemap.update`'s `while (_timer >= 1)` loop takes to walk
 * five frames at `20 * FP.elapsed`, and that is exactly the arithmetic
 * §19.5 got wrong once already (`25 * 0.0333` stalls on a different frame
 * from `25 * (1/30)`). It is SIMULATED here, per tick, for the same reason.
 *
 * ⛔ **AND `radius` IS A `Number` WITH A `>=` TEST AFTER THE INCREMENT.**
 * `(radiusMax - radiusMin) / radiusRate` is `18 / 0.8 = 22.5`, so the pulse
 * state runs `ceil(22.5) = 23` ticks and the last one overshoots to 28.4.
 * A model that divided would say 22 and be one hit short every cycle.
 *
 * ⚠ **THE ORDER WITHIN A TICK IS `update()` THEN `graphic.update()`**, per
 * entity, from `World.update` (`net/flashpunk/World.as:50-59`) — the same
 * relationship `Player.fire()` has with `sprites()`. So a `play("pulse")`
 * made on tick T is followed by that tick's own spritemap step.
 *
 * ⚠ **WHAT THIS MODULE DOES NOT DO.** It is the CYCLE and the DISPATCH; it
 * does not run the block's glide (that is `pushables.stepPushable`, which
 * already takes a non-relative point hit) and it does not decide the
 * encounter verdict for the damage ring (that is `encounters`). Wiring it
 * into `levelRun` is the next slice's first job, and it is named here
 * rather than half-done.
 */

import { hitPushableFromPoint } from './pushables.js';
import { collideRectInclusive } from './fireVerb.js';

export class PulserError extends Error {
    constructor(message) { super(message); this.name = 'PulserError'; }
}
const fail = (m) => { throw new PulserError(m); };

/** `Engine.as:162` clamps at 30 fps, so this is a constant for every tape. */
const FP_MAX_ELAPSED = 0.0333;

/**
 * The constructor's numbers, verbatim. Every one is `private const` in
 * `Pulser.as:18-37`, so none of them can be varied by placement data — the
 * only thing an `.oel` decides about a Pulser is its position and its `t`.
 */
export const PULSER = Object.freeze({
    radiusMin: 10,
    radiusMax: 28,
    /** ⚠ NOT `radiusMax`. The hit test is a THIRD radius, and it is fixed. */
    radiusHit: 22,
    radiusRate: 0.8,
    pulseTimerMax: 20,
    force: 6,
    damage: 1,
    /** `setHitbox(16, 16, 8, 8)` at `(_x + 8, _y + 8)` — one cell, on the placement. */
    box: Object.freeze({ dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8 }),
    /** `type = "Solid"` in the ctor and never written again. */
    type: 'Solid',
    hitables: Object.freeze(['Player', 'Solid', 'Enemy']),
    anim: Object.freeze({ name: 'pulse', frames: Object.freeze([0, 1, 2, 3, 4]), frameRate: 20, loop: true }),
    src: 'Puzzlements/Pulser.as:18-37 (ctor) + :51-86 (update) + :88-115 (hit)',
});

/**
 * ⛓ THE ANIMATION'S DEAD TICKS, by simulating `Spritemap.update`'s loop.
 *
 * `play("pulse")` sets `_index = 0`, `_timer = 0`, `complete = false`. Each
 * subsequent `graphic.update()` adds `frameRate * FP.elapsed` and walks the
 * `while (_timer >= 1)` loop. The anim LOOPS, so the wrap sets `_index = 0`
 * and calls the callback — `endAnim`, which plays `""` — and THAT is what
 * lets `Pulser.update`'s body run again.
 *
 * @returns {number} ticks from the `play("pulse")` tick to the wrap,
 *                   inclusive of the wrap tick
 */
export function animGateTicks(anim = PULSER.anim, elapsed = FP_MAX_ELAPSED) {
    const step = anim.frameRate * elapsed;
    if (!(step > 0)) fail('animGateTicks: a frameRate of 0 never advances');
    let timer = 0;
    let index = 0;
    // The `play("pulse")` tick is followed by that tick's own graphic step
    // (`World.update` runs `e.update()` then `e._graphic.update()`), so the
    // count starts at one.
    for (let tick = 1; tick <= 1000; tick += 1) {
        timer += step;
        if (timer >= 1) {
            while (timer >= 1) {
                timer -= 1;
                index += 1;
                if (index === anim.frames.length) {
                    // The looping arm: index resets and the callback fires.
                    return tick;
                }
            }
        }
    }
    return fail('animGateTicks: the animation never wrapped in 1000 ticks');
}

/** How many ticks the PULSE state runs — the `>=`-after-increment count. */
export function pulseTicks(p = PULSER) {
    let radius = p.radiusMin;
    let n = 0;
    // Transcribed as the loop rather than as `(max - min) / rate`, because
    // the test is `>=` AFTER the increment and the division is 22.5.
    while (n < 1000) {
        n += 1;
        radius += p.radiusRate;
        if (radius >= p.radiusMax) return n;
    }
    return fail('pulseTicks: radius never reached radiusMax');
}

/** A pulser at rest, exactly as the constructor leaves it. */
export function createPulser(x, y, t) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`createPulser: (${x},${y}) must be the OEL integer placement`);
    }
    return {
        id: `pulser@${x},${y}`,
        t,
        /** The ENTITY position, which is the placement plus the ctor half-tile. */
        x: x + PULSER.box.dx,
        y: y + PULSER.box.dy,
        activate: false,
        radius: PULSER.radiusMin,
        pulseTimer: 0,
        /** `play("")` in the constructor. */
        anim: '',
        animTick: 0,
    };
}

/**
 * One tick of `Pulser.update`, transcribed.
 *
 * @param {object} state    from `createPulser`, or a previous step
 * @param {boolean} activate  the group's published flag
 * @returns {{state: object, hit: boolean, pulsed: boolean}}
 *          `hit` is whether `hit()` ran on THIS tick — the only thing a
 *          consumer needs, because everything else is bookkeeping.
 */
export function stepPulser(state, activate) {
    if (typeof activate !== 'boolean') {
        fail('stepPulser: `activate` is the group\'s published flag and has no default. '
            + 'A pulser whose group nobody publishes is quiet, and a pulser whose group '
            + 'latched is loud FOREVER — the difference is the whole mechanic.');
    }
    const s = { ...state, activate };
    let hit = false;
    let pulsed = false;

    // ⚠ `radius > radiusMin` KEEPS IT GOING after the flag drops, which is
    // why this is an `||` and not the flag alone: a pulse mid-expansion
    // finishes its ring. (In L38 the flag latches and never drops, so this
    // arm is a bounded vacuity there and is transcribed anyway.)
    if (s.activate || s.radius > PULSER.radiusMin) {
        if (s.anim === '') {
            if (s.pulseTimer > 0) {
                s.pulseTimer -= 1;
            } else if (s.pulseTimer === 0) {
                s.anim = PULSER.anim.name;
                s.animTick = 0;
                s.pulseTimer = -1;
                pulsed = true;
            } else {
                hit = true;
                s.radius += PULSER.radiusRate;
                if (s.radius >= PULSER.radiusMax) {
                    s.pulseTimer = PULSER.pulseTimerMax;
                    s.radius = PULSER.radiusMin;
                }
            }
        }
    } else {
        s.pulseTimer = -1;
        s.radius = PULSER.radiusMin;
    }

    // `e._graphic.update()`, immediately after `e.update()` in the same
    // `World.update` iteration.
    if (s.anim === PULSER.anim.name) {
        s.animTick += 1;
        if (s.animTick >= animGateTicks()) {
            // The wrap calls `endAnim`, which plays "" — `Pulser.as:127-133`.
            s.anim = '';
            s.animTick = 0;
        }
    }
    return { state: s, hit, pulsed };
}

/**
 * ⛓ `FP.distanceRectPoint(px, py, rx, ry, rw, rh)` — the filter `hit()`
 * applies to every candidate, transcribed from FlashPunk.
 *
 * ⚠ IT IS THE POINT-TO-BOX DISTANCE AND THE POINT IS THE PULSER'S ENTITY
 * POSITION, not its box centre — they happen to coincide here because the
 * ctor's origin is the half-tile, and that coincidence is named so a
 * different `Activators` subclass cannot inherit the assumption.
 */
export function distanceRectPoint(px, py, rx, ry, rw, rh) {
    if (px >= rx && px <= rx + rw) {
        if (py >= ry && py <= ry + rh) return 0;
        if (py > ry) return py - (ry + rh);
        return ry - py;
    }
    if (py >= ry && py <= ry + rh) {
        if (px > rx) return px - (rx + rw);
        return rx - px;
    }
    let x;
    let y;
    if (px > rx) x = px - (rx + rw); else x = rx - px;
    if (py > ry) y = py - (ry + rh); else y = ry - py;
    return Math.sqrt(x * x + y * y);
}

/**
 * What one `hit()` reaches: the `radiusHit * 2` collide box, then the
 * distance filter.
 *
 * ⚠ NOT A DISPATCH COUNT. `Pulser.hit` builds ONE vector across its three
 * hitable types and iterates it once (`Pulser.as:90-97`) — the ORDINARY
 * shape, and the opposite of `Player.fire()`'s nested loop. So a target is
 * dispatched once per tick per type it belongs to, and no `Solid` is also
 * an `Enemy`. Named because the fire arm's 25 dispatches came from exactly
 * this code written one indent differently.
 *
 * @param {object} pulser  from `createPulser`
 * @param {object[]} targets  `{id, type, x, y, originX, originY, w, h}`
 */
export function pulseReaches(pulser, targets) {
    const r = PULSER.radiusHit;
    const out = [];
    for (const target of targets) {
        for (const k of ['x', 'y', 'originX', 'originY', 'w', 'h']) {
            if (!Number.isFinite(target?.[k])) {
                fail(`pulseReaches target ${target?.id}: needs a finite \`${k}\`. An absent `
                    + 'origin reads as 0, which is a DIFFERENT and plausible-looking '
                    + 'answer rather than an error.');
            }
        }
        if (!PULSER.hitables.includes(target.type)) continue;
        const bx = target.x - target.originX;
        const by = target.y - target.originY;
        // `collideRectInto(type, x - radiusHit, y - radiusHit, radiusHit*2,
        // radiusHit*2)` is `Entity.collideRect`, INCLUSIVE on all four
        // edges — the SAME test the fire census uses, so it is imported
        // rather than written twice. Two transcriptions of one AS3 function
        // is how a ±1 lands in one census and not the other.
        const box = { x: pulser.x - r, y: pulser.y - r, right: pulser.x + r, bottom: pulser.y + r };
        const tRect = { x: bx, y: by, right: bx + target.w, bottom: by + target.h };
        if (!collideRectInclusive(box, tRect)) continue;
        const d = distanceRectPoint(pulser.x, pulser.y, bx, by, target.w, target.h);
        if (d > r) continue;
        out.push({ id: target.id, type: target.type, distance: d, arm: armFor(target) });
    }
    return out;
}

/** `Pulser.hit`'s `else if` chain, in its own order. */
function armFor(target) {
    if (target.as3 === 'PushableBlockFire' || target.as3 === 'PushableBlockSpear') {
        return 'pushable';
    }
    if (target.as3 === 'IceTurret') return 'iceturret';
    if (target.type === 'Enemy') return 'enemy';
    if (target.type === 'Player') return 'player';
    // ⚠ A `Solid` that is none of the above falls off the end of the chain
    // and is a NO-OP. That is most of what the box contains — walls, covers,
    // the pulser's own neighbours — and it is why the arm has to be named
    // per candidate rather than counted.
    return 'none';
}

/**
 * ⛔⛔ THE ARM THIS MODULE EXISTS FOR: the pulse pushes a block.
 *
 * `(c as PushableBlockFire).hit(new Point(x, y), "Pulse")` is the SAME
 * non-relative arm a fire press takes (`Player.as:1123`), so the
 * destination arithmetic is `pushables.hitPushableFromPoint` unchanged —
 * `Math.atan2` away from the source point, snapped to a whole tile. The
 * only thing that differs is the `t`, and `moveTypes` admits both.
 *
 * @param {object} pulser
 * @param {object} block   a `pushables` block state
 */
export function pulsePushes(pulser, block) {
    return hitPushableFromPoint(block, { x: pulser.x, y: pulser.y }, 'Pulse');
}

/**
 * ⚠ THE DAMAGE RING, as a volume the encounter ladder can price.
 *
 * `(c as Player).hit(null, force, new Point(x, y), damage)` is inside the
 * same 22 px filter, so the player's threat volume is the pulser's entity
 * position grown by `radiusHit` — a POINT-TO-BOX radius, not a rect, which
 * is the `point` hazard shape the census already has a word for.
 *
 * ⚠ AND IT IS LIVE FOR THE REST OF THE VISIT ONCE THE GROUP LATCHES. In
 * L38 the group is published by a `room = -1` ButtonRoom, whose setter is
 * behind `if (a)` with the author's own "Can't be reset to false!!" — so
 * there is no "walk past before it arms". The ring is a standing cost.
 */
export function pulserThreat(pulser) {
    return Object.freeze({
        kind: 'point',
        x: pulser.x,
        y: pulser.y,
        r: PULSER.radiusHit,
        damage: PULSER.damage,
        force: PULSER.force,
        why: '`Pulser.hit`\'s Player arm, inside the same `FP.distanceRectPoint <= 22` '
            + 'filter as every other candidate. Live on every tick of the PULSE state '
            + 'and quiet on the rest of the cycle — but the cycle never stops once the '
            + 'group latches, so a route prices the ring rather than the phase.',
    });
}

/**
 * The whole cycle, as the numbers a route quotes — DERIVED from the two
 * simulations above rather than written down beside them.
 */
export function pulserCycle() {
    const gate = animGateTicks();
    const pulse = pulseTicks();
    return Object.freeze({
        animGateTicks: gate,
        pulseTicks: pulse,
        waitTicks: PULSER.pulseTimerMax,
        /**
         * ⚠ THE `play("pulse")` TICK IS THE GATE'S FIRST TICK, not one
         * before it: `World.update` runs `e.update()` and then that same
         * entity's `e._graphic.update()`, so the spritemap takes its first
         * step on the very tick the play was made. Adding a tick for the
         * play is the off-by-one this comment exists to stop — the measured
         * period between two pulses is 51, not 52.
         */
        totalTicks: PULSER.pulseTimerMax + gate + pulse,
        hitsPerCycle: pulse,
    });
}

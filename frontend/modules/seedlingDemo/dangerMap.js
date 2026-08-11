/**
 * dangerMap — the UNION of the four hazard APIs, over LIVE run state.
 *
 * Region-atlas Phase 8, rung R8 (the live solver bot), slice 1. Kickoff
 * `NewDocs/plans/seedling-bot-r8-opus-kickoff.md` §3.3.
 *
 * ⛔⛔⛔ A SEARCH HEURISTIC, NEVER AN ORACLE — and that sentence is
 * `spinnerForecast`'s doctrine repeated on purpose rather than paraphrased.
 * A `danger: false` here is NOT a claim that the tick is safe; it is a claim
 * that none of the four ingredients below could name a reason. The GAME
 * adjudicates, through the differential. What this is FOR is pruning: a
 * policy that must choose a cell this tick, and a `mover.findEarliestArrival`
 * whose `forbiddenAt` hook has been waiting for a timeline since R5.
 *
 * ⇒ so the return value is a REASON LIST, never a boolean alone. A caller
 * that only wants the bit can read `.danger`; a caller that has to explain
 * itself — the decision trace, a red pair, a refusal — needs `.sources`, and
 * a heuristic that could not say WHY it forbade a cell is unauditable.
 *
 * ── THE FOUR INGREDIENTS, AND WHY THEY WERE FOUR APIs ─────────────────
 *
 * Everything here already existed, in four modules, with no combiner:
 *
 *   a. **arrows** — `run.arrowsInFlight` (position + lifetime, no pricing:
 *      R7's carried debt) and `arrowTrap.arrowLane` for the ARMED traps'
 *      columns. The lane is a PLAN-time shape and the flight is a LIVE one;
 *      this is the first consumer that needs both at once.
 *   b. **hazard volumes** — `hazards.hazardVolume`'s per-class rects and
 *      discs, with their `verdict`. Orphaned from the shipping driver since
 *      R5: imported by probe scripts only.
 *   c. **stepped enemies** — `run.chasers`, grown by `combat.stepBoundFor`
 *      plus the class's `threatPad`, using `encounters.chaseEnvelope`'s
 *      arithmetic while the body is inside its leash.
 *   d. **crushers** — `run.crushers` for the live BODY, and the trigger
 *      lanes recomputed at that live position rather than at the `.oel` one
 *      (`hazardVolume`'s crusher arm is keyed on the census placement, and a
 *      crusher is the one hazard on the roster that moves).
 *
 * ── THE HORIZON IS PART OF THE QUESTION ──────────────────────────────
 *
 * `dangerAt(run, tick, box)` takes an ABSOLUTE tick, exactly so it can be
 * handed to `mover.findEarliestArrival`'s `forbiddenAt(tick, x, y)` without
 * an adapter that has to remember which clock it is on. The horizon is
 * `tick - run.ticksCompleted`, clamped at zero: a query about the past is a
 * query about NOW, and every growth term is `horizon x bound`.
 *
 * ⚠ THE GROWTH IS AN OVER-APPROXIMATION AND IS MEANT TO BE. `chaseEnvelope`
 * grows a body by its whole `moveSpeed` per tick rather than by
 * `moveSpeed - friction`, and this does the same, for the same reason: an
 * envelope has to dominate, and a bound loose by a quarter pixel a tick is
 * cheap. A search that refuses a few extra cells finds a longer plan; one
 * that admits a cell it should not have finds a plan the game refutes.
 *
 * ⚠ IT BUILDS NO LIVE-GEOMETRY BAG. Every query here is over rects the run
 * already exposes, so there is no `liveSolidOpts` to brand — R8 slice 0's
 * contract applies to bags handed to `collidesSolid`/`plannerBlockerAt`, and
 * this module hands none. Named rather than left to be inferred from an
 * absence.
 */

import { arrowLane, ARROW } from './arrowTrap.js';
import { ENEMY_CLASSES, stepBoundFor } from './combat.js';
import { chaserBoxAt } from './chasers.js';
import { hazardVolume, volumeHitsBox } from './hazards.js';
import { rect, rectsOverlap } from './levelWorld.js';

export class DangerMapError extends Error {
    constructor(message) { super(message); this.name = 'DangerMapError'; }
}
const fail = (m) => { throw new DangerMapError(m); };

/**
 * `Crusher.as:63-74` — the four trigger rects, each the 32x32 body grown by
 * `intDist` along ONE axis. Transcribed in `hazards.hazardVolume`'s crusher
 * arm against the CENSUS placement; re-derived here at the LIVE centre,
 * because a crusher is the one hazard on the roster that moves and the whole
 * point of a live map is not to ask about where it used to be.
 */
export const CRUSHER_TRIGGER = Object.freeze({
    half: 16,
    intDist: 64,
    src: 'Enemies/Crusher.as:63-74, via hazards.hazardVolume(\'crusher\')',
});

/** The four trigger lanes plus the body, at a live centre. */
export function crusherVolumesAt(cx, cy) {
    const h = CRUSHER_TRIGGER.half;
    const d = CRUSHER_TRIGGER.intDist;
    return [
        { r: rect(cx - h, cy - h, h * 2, h * 2), why: 'the 32x32 body — damage 1000' },
        { r: rect(cx - h, cy - h, h * 2 + d, h * 2), why: 'trigger lane, +x (intDist 64)' },
        { r: rect(cx - h - d, cy - h, h * 2 + d, h * 2), why: 'trigger lane, -x' },
        { r: rect(cx - h, cy - h - d, h * 2, h * 2 + d), why: 'trigger lane, -y' },
        { r: rect(cx - h, cy - h, h * 2, h * 2 + d), why: 'trigger lane, +y' },
    ];
}

/** Grow a rect by `n` on every side. */
const grow = (r, n) => rect(r.x - n, r.y - n, r.w + n * 2, r.h + n * 2);

/**
 * ⛓ INGREDIENT (a) — LIVE ARROWS, swept forward, and the ARMED traps' lanes.
 *
 * Two shapes, one ingredient, and they answer different halves:
 *
 *   · an arrow IN FLIGHT is a 4x4 box at a known position moving at a known
 *     speed, so its danger over a horizon is the box swept `speed x horizon`
 *     along its travel. ⚠ `run.arrowsInFlight` carries POSITION AND LIFETIME
 *     ONLY (R7's debt says so in as many words) — no velocity — so the sweep
 *     uses `ARROW.speed` DOWNWARD, which is the only direction an `ArrowTrap`
 *     ever fires. A trap that fired sideways would need the getter widened,
 *     and the constant is cited rather than typed so that shows up as a
 *     source change.
 *   · an ARMED trap is a column that may fire at any moment, so its lane is
 *     dangerous for ANY horizon at all — including zero. A map that only
 *     knew about arrows already in the air would call the tick before a
 *     volley safe, which is the tick a policy most needs warning on.
 */
export function arrowDanger(run, box, horizon) {
    const out = [];
    for (const a of run.arrowsInFlight ?? []) {
        const body = rect(a.x - ARROW.hitbox.originX, a.y - ARROW.hitbox.originY,
            ARROW.hitbox.w, ARROW.hitbox.h);
        const swept = rect(body.x, body.y, body.w, body.h + ARROW.speed * horizon);
        if (rectsOverlap(box, swept)) {
            out.push({ kind: 'arrow', id: a.id, why: `live arrow swept ${ARROW.speed} px/tick `
                + `x ${horizon} tick(s)` });
        }
    }
    const armed = run.armedArrowTraps;
    // ⚠ `null` under `noclip` and an empty SET otherwise — the two mean
    // different things and only one of them is "no trap is armed".
    if (armed) {
        const world = run.worldFor(run.level);
        for (const trap of (world.arrowTraps ?? [])) {
            if (!armed.has(trap.id)) continue;
            const lane = arrowLane({ id: trap.id, t: trap.t, x: trap.ex, y: trap.ey });
            const laneRect = rect(lane.x0, lane.fromY, lane.x1 - lane.x0,
                Math.max(world.world.height - lane.fromY, 1));
            if (rectsOverlap(box, laneRect)) {
                out.push({ kind: 'arrowLane', id: trap.id,
                    why: 'an ARMED trap\'s lane — dangerous at horizon 0, because the '
                        + 'volley that has not fired yet is the one a policy needs '
                        + 'warning about' });
            }
        }
    }
    return out;
}

/**
 * ⛓ INGREDIENT (b) — the placed puzzlement hazards' verdict volumes.
 *
 * ⛔ THE CRUSHER IS EXCLUDED HERE AND PRICED LIVE IN (d). Its
 * `hazardVolume` arm is keyed on the census placement, and it is the one
 * hazard on the roster that MOVES — so including it would put a 96 px
 * trigger lane wherever `loadlevel` left it, which for a run that has
 * already parked one somewhere else is a wall that is not there and a hole
 * where the real one is. Excluded BY NAME rather than by omission.
 */
export function hazardDanger(run, box) {
    const out = [];
    const world = run.worldFor(run.level);
    for (const h of (world.combat?.hazards ?? [])) {
        if (h.tag === 'crusher') continue;
        const vol = hazardVolume(h, world.world);
        const hit = volumeHitsBox(vol, box);
        if (hit) {
            out.push({ kind: 'hazard', id: `${h.tag}@${h.x},${h.y}`,
                why: `${vol.verdict} (${vol.exactness}) — ${hit.kind}: ${hit.why}` });
        }
    }
    return out;
}

/**
 * ⛓ INGREDIENT (c) — the STEPPED enemy bodies, grown by their own bound.
 *
 * ⛔ THE GROWTH IS CONDITIONAL ON THE LEASH, which is `chaseEnvelope`'s
 * arithmetic and not a simplification of it: a chaser outside `runRange` is
 * not pushed at all, so growing its box by `moveSpeed x horizon` would
 * hard-avoid half a room around a body that is standing still. Inside the
 * leash — measured from the NEAREST point of the envelope, not from the
 * spawn, for the reason `chaseEnvelope` gives — it grows by the full bound
 * per tick.
 *
 * ⚠ AND THE PAD IS NOT DECORATION (`chaseEnvelope` again): a `bobsoldier`'s
 * body is 8x8 and its sword line reaches 16 px past it. `threatPad` is added
 * outside the growth so a class whose THREAT exceeds its body cannot be
 * declared clear by a body-sized measurement.
 *
 * ⛔ AND `run.chasers` IS EMPTY UNDER `noDamage`/`noclip` BY CONSTRUCTION.
 * That is the bridge's own gate showing through, not a bug: under those
 * flags the run does not step a chaser, so it has no live position to offer
 * and this must not invent one from the census.
 */
export function chaserDanger(run, box, horizon) {
    const out = [];
    for (const c of run.chasers ?? []) {
        const row = ENEMY_CLASSES[c.tag];
        const bound = stepBoundFor(c.tag);
        if (bound === null) {
            fail(`chaserDanger: "${c.tag}" has no step bound — a boss (or an unpriced tag) `
                + 'is an ENCOUNTER SCRIPT, and 0 would read as "static" and prove the '
                + 'arena clear.');
        }
        const body = chaserBoxAt(c.tag, c.x, c.y);
        const leash = typeof row.aggro?.range === 'number' ? row.aggro.range : 0;
        const pad = row.threatPad ?? 0;
        // The player's centre against the body's, which is what `Bob.update`'s
        // own `FP.distance(x, y, player.x, player.y)` measures.
        const px = (box.x + box.right) / 2;
        const py = (box.y + box.bottom) / 2;
        const d = Math.hypot(px - c.x, py - c.y);
        const woken = d <= leash;
        const r = woken ? bound * horizon : 0;
        if (rectsOverlap(box, grow(body, r + pad))) {
            out.push({ kind: 'chaser', id: c.id,
                why: woken
                    ? `inside leash ${leash} (d=${d.toFixed(1)}), box grown ${bound} px/tick `
                        + `x ${horizon} + pad ${pad}`
                    : `outside leash ${leash} (d=${d.toFixed(1)}) — the BODY only, ungrown, `
                        + 'because a chaser out of leash is not pushed at all' });
        }
    }
    return out;
}

/**
 * ⛓ INGREDIENT (d) — the crushers, at the position the run has them in.
 *
 * ⛔ TRIGGER LANES AS WELL AS BODIES, and the lanes are the larger claim:
 * entering one ARMS a 1 px/tick charge that runs until a solid stops it, so
 * the lane is where a route stops being able to change its mind. Damage 1000
 * means a contact is `die()` at any `hitsMax` — there is no stance that
 * survives one, which is why `hazardVolume` calls the whole family
 * `hard-avoid`.
 *
 * ⚠ A SNAPSHOT, and the run's own getter says so: a charging crusher does
 * not re-derive `v`, so a plan made against this is sound only while
 * `run.crushersParked`. The caller is told, in the source it consulted.
 */
export function crusherDanger(run, box) {
    const out = [];
    const live = run.crushers;
    if (!live) return out;
    for (const [id, c] of live) {
        for (const v of crusherVolumesAt(c.x, c.y)) {
            if (!rectsOverlap(box, v.r)) continue;
            out.push({ kind: 'crusher', id, why: `${v.why} (LIVE centre ${c.x},${c.y})` });
            break;
        }
    }
    return out;
}

/**
 * The union, over one box at one absolute tick.
 *
 * @param {object} run  a live `createLevelRun` view
 * @param {number} tick ABSOLUTE — the same clock `forbiddenAt(tick, …)` uses
 * @param {object} box  a player box (`playerPhysicsV2.playerBoxAt`)
 * @returns {{danger: boolean, horizon: number, sources: object[]}}
 */
export function dangerAt(run, tick, box) {
    if (!run || typeof run.level !== 'number') {
        fail('dangerAt: needs a live run — the whole point is that the positions are the '
            + 'ones the run has NOW, not the ones a level record was authored with.');
    }
    if (!Number.isFinite(tick)) fail(`dangerAt: tick must be finite, got ${tick}`);
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.right)) {
        fail('dangerAt: needs a rect with `right`/`bottom` — a literal without them NEVER '
            + 'overlaps, silently ([[feedback_rect_literal_never_overlaps]]).');
    }
    // ⚠ CLAMPED, NOT REFUSED. A search asks about ticks in its own future and
    // a policy asks about NOW; a negative horizon is the second question
    // spelled with the first question's clock.
    const horizon = Math.max(0, tick - run.ticksCompleted);
    const sources = [
        ...arrowDanger(run, box, horizon),
        ...hazardDanger(run, box),
        ...chaserDanger(run, box, horizon),
        ...crusherDanger(run, box),
    ];
    return { danger: sources.length > 0, horizon, sources };
}

/**
 * `mover.findEarliestArrival`'s `forbiddenAt(tick, x, y)`, over this map.
 *
 * ⛔ THE ADAPTER EXISTS SO THE BOX IS BUILT ONE WAY. `forbiddenAt` is handed
 * a POSITION and every ingredient here asks about a BOX; a caller that built
 * its own would be a second reading of the player's hitbox, which is the
 * defect this whole package keeps paying for one class at a time.
 *
 * @param {object}   run
 * @param {Function} playerBoxAt `(x, y) => rect` — injected rather than
 *   imported so a caller with a different mover (a block, a probe) can hand
 *   its own box builder and get the same union.
 */
export function forbiddenByDanger(run, playerBoxAt) {
    if (typeof playerBoxAt !== 'function') {
        fail('forbiddenByDanger: pass the box builder. Solidity — and threat — is a '
            + 'property of the thing MOVING, so the box cannot be assumed.');
    }
    return (tick, x, y) => dangerAt(run, tick, playerBoxAt(x, y)).danger;
}

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

import { arrowLane, arrowRect, ARROW, stepArrow } from './arrowTrap.js';
import { contactPricing, contactRect, ENEMY_CLASSES, stepBoundFor } from './combat.js';
import { chaserBoxAt, isBridgedChaser } from './chasers.js';
import { hazardVolume, volumeHitsBox } from './hazards.js';
import { rect, rectsOverlap } from './levelWorld.js';
import { SPINNER } from './spinner.js';

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
 * ⛓⛓⛓ R8 SLICE 5 — WHERE THE ARROWS WILL BE, BY `stepArrow`'s OWN
 * ARITHMETIC. ⚖ §13.10a ruling 2.
 *
 * ⛔ AN ARROW IN FLIGHT IS AUTONOMOUS: nothing about its trajectory reads the
 * player, so where it will be in `horizon` ticks is not a forecast, it is
 * arithmetic — and the arithmetic already exists. This runs the SAME
 * `stepArrow` the run steps its arrows with, over CLONES, rather than
 * multiplying speed by a horizon. A summary would be a second model of the
 * flight, and `Mobile.moveY`'s 1 px sub-steps are exactly the kind of detail a
 * summary drops (trap 118).
 *
 * ⛔ COVER IS INCLUDED, AND THAT IS THE HALF A SWEEP CANNOT DO. An arrow that
 * will die on `torch@48,64` two ticks from now is not a hazard at the cell
 * below it — which is the whole of L5's column-3 shadow, asked forwards.
 *
 * ⚠ BODIES ARE DELIBERATELY EXCLUDED, and the direction is stated: a body that
 * would eat an arrow may have moved or died by the horizon, so pricing it
 * would make arrows vanish that the game still has in the air. Leaving it out
 * lets an arrow fly FURTHER than it might, which forbids more cells and never
 * fewer. An over-approximation, like `chaseEnvelope`'s growth, and for the
 * same reason.
 *
 * ⚠ AND A FADING ARROW IS NOT A HAZARD. `stepArrow` gates its hit test on
 * `v.length > 0`, and an arrow that has hit something has `v = 0` and is
 * spending its eleven fade ticks. `run.arrowFlights` carries `v` precisely so
 * this can be asked rather than assumed.
 *
 * @param {object} run
 * @param {number} horizon ticks from NOW; 0 returns the live positions
 * @returns {Array<{id: string, x: number, y: number, rect: object}>}
 */
export function predictArrows(run, horizon) {
    if (!Number.isInteger(horizon) || horizon < 0) {
        fail(`predictArrows: the horizon must be a non-negative integer tick count, got `
            + `${horizon}. A fractional horizon is a caller that has a distance and wants `
            + 'a time.');
    }
    const flights = (run.arrowFlights ?? []).map((a) => ({
        ...a, v: { x: a.v.x, y: a.v.y },
    }));
    if (flights.length === 0) return [];
    const world = run.worldFor(run.level);
    const bound = { w: world.world.width, h: world.world.height };
    const coverAt = run.arrowCoverAt;
    for (let i = 0; i < horizon; i += 1) {
        for (const a of flights) {
            if (a.removed) continue;
            // ⚠ `frozen: false` — a ceremony would park the volley, and a
            // corridor is planned for a walk, not for a cutscene. `bodies: []`
            // per the docblock.
            stepArrow(a, { frozen: false, bound, coverAt, bodies: [] });
        }
    }
    return flights
        .filter((a) => !a.removed && (a.v.x !== 0 || a.v.y !== 0))
        .map((a) => ({ id: a.id, x: a.x, y: a.y, rect: arrowRect(a) }));
}

/**
 * ⛓⛓⛓ INGREDIENT (a), THE TRANSIT READING — ⚖ §13.10a's TRANSIT half.
 *
 * The WAIT reading (`arrowDanger`) sweeps each arrow's box `speed x horizon`,
 * which is the union over the whole window — the honest answer to *"may I
 * stand here for the next N ticks"*. A WALK is a different question: the
 * player is at THIS cell at THIS tick and nowhere near it before or after, so
 * the union over the window forbids a corridor the arrows have already left.
 * That is trap 161 exactly, and §13.2's deadlock was made of it.
 *
 * ⛔ THE LANE ARM IS UNCHANGED, and that is not an oversight. An ARMED trap
 * may fire at any moment (§9.9 decision 2), which is a STATE question — the
 * caller that knows the group is about to be unpublished is the one holding
 * the presser, and it excludes the lane BY ID. Trap 160's law: the state layer
 * answers the state question and the kinematic layer answers this one.
 */
export function arrowDangerDuringTransit(run, box, horizon, arrows = null) {
    const out = [];
    /**
     * ⛔ A CALLER THAT IS PREVIEWING A WALK HANDS ITS OWN FORECAST, and it
     * must: a walk decides whether the traps keep FIRING, so the arrows at
     * tick T are a function of the walk and not of the room alone. The
     * fallback — `predictArrows`, the arrows already in the air — is the
     * honest answer for a caller with no walk to offer, and it is strictly
     * weaker: it cannot see a volley that has not been fired yet. `r8-solve-5`
     * was hit by exactly such a volley.
     */
    for (const a of (arrows ?? predictArrows(run, horizon))) {
        if (rectsOverlap(box, a.rect)) {
            out.push({ kind: 'arrow', id: a.id, why: `a live arrow AT ITS PREDICTED `
                + `POSITION (${a.x},${a.y}) ${horizon} tick(s) on, by \`stepArrow\`'s own `
                + 'arithmetic with cover' });
        }
    }
    const armed = run.armedArrowTraps;
    if (armed) {
        const world = run.worldFor(run.level);
        for (const trap of (world.arrowTraps ?? [])) {
            if (!armed.has(trap.id)) continue;
            const lane = arrowLane({ id: trap.id, t: trap.t, x: trap.ex, y: trap.ey });
            const laneRect = rect(lane.x0, lane.fromY, lane.x1 - lane.x0,
                Math.max(world.world.height - lane.fromY, 1));
            if (rectsOverlap(box, laneRect)) {
                out.push({ kind: 'arrowLane', id: trap.id,
                    why: 'an ARMED trap\'s lane — a STATE question, and still danger at '
                        + 'every horizon: the volley that has not fired yet is the one a '
                        + 'walk needs warning about' });
            }
        }
    }
    return out;
}

/**
 * ⛔⛔⛔ THE CENSUS ARM DOES NOT PRICE A FAMILY ANOTHER INGREDIENT PRICES
 * LIVE — and this is a TABLE, not two `continue`s buried in a loop.
 *
 * `hazardVolume` is keyed on the CENSUS PLACEMENT and on the census's static
 * reading of the entity. For two families that reading is not the run's:
 *
 *   `crusher`    is the one hazard on the roster that MOVES (§9.9 decision
 *                4). Its census volume is a 96 px trigger lane wherever
 *                `loadlevel` left it — a wall that is not there for a run
 *                that has parked one somewhere else, and a hole where the
 *                real one is. Priced at the LIVE centre by `crusherDanger`.
 *
 *   `arrowtrap`  ⛓⛓⛓ R8 SLICE 3b, AND THE ROW'S OWN `why` SAID SO ALL
 *                ALONG: *"an Activators group gates it, so whether it fires
 *                at all is a STATE question, not a timing one."* The census
 *                arm asked it as if it were unconditional, so **a DISARMED
 *                trap's whole column was forbidden for ever** — which in L4
 *                is the only way north out of the room, and the walk that
 *                takes it does so with the button released and the trap
 *                inert. Priced by ARMED STATE in `arrowDanger`, which has
 *                had exactly that arm since slice 1 (§9.9 decision 2).
 *
 * ⛓ FOUND BY DRIVING, NOT BY READING. The corridor probe refused L4's
 * post-shove walk naming `hazard:arrowtrap@48,16` on a tick when
 * `run.armedArrowTraps` was EMPTY — two cost models for one hazard, and the
 * static one won. [[feedback_two_cost_models_must_agree]]
 *
 * ⚠ THE EXCLUSION IS ONLY HONEST IF THE OTHER INGREDIENT REALLY FIRES, so
 * `by` names it and `dangerMap.test.js` drives the PAIR: armed -> still
 * reported (through the live arm), disarmed -> silent. An exclusion with no
 * positive beside it is a hole with a docblock.
 */
export const HAZARDS_PRICED_LIVE = Object.freeze({
    crusher: Object.freeze({
        by: 'crusherDanger',
        why: 'the census volume is keyed on the `.oel` placement and a crusher MOVES',
    }),
    arrowtrap: Object.freeze({
        by: 'arrowDanger',
        why: 'the census volume is unconditional and a trap\'s firing is an ACTIVATOR '
            + 'GROUP\'s state — the volume\'s own `why` says so',
    }),
});

/**
 * ⛓ INGREDIENT (b) — the placed puzzlement hazards' verdict volumes,
 * excluding the families `HAZARDS_PRICED_LIVE` names.
 */
export function hazardDanger(run, box) {
    const out = [];
    const world = run.worldFor(run.level);
    for (const h of (world.combat?.hazards ?? [])) {
        if (HAZARDS_PRICED_LIVE[h.tag]) continue;
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
 * ⛓⛓⛓ INGREDIENT (e) — R8 SLICE 3b — THE STATIC `"Enemy"` BODIES, AND THE
 * MAP HAD NO ARM FOR THEM AT ALL.
 *
 * ⛔ THE GAP WAS MEASURED, NOT GUESSED. Slice 1 built ingredient (c) for
 * STEPPED bodies (`run.chasers`) and (b) for placed PUZZLEMENT hazards
 * (`world.combat.hazards`). L6's four `sandtrap`s are NEITHER: a `SandTrap`
 * is an `"Enemy"` census row with `speed 0`, so nothing on the roster asked
 * about it — and slice 2's free oracle is the receipt, the GAME hitting
 * `sandtrap@64,16` at t=20 and killing the player TWICE in a room every
 * ingredient of the map called calm (§10.3). A map whose ingredients are
 * three of the four kinds of body in the game is not a union.
 *
 * ⛔ AND THE TWO `"Enemy"` ROSTERS ARE NOT INTERCHANGEABLE — the same law
 * `arrowBodiesNow` states one file over. A body this room STEPS belongs to
 * ingredient (c) at its LIVE position, whether it is alive (in `run.chasers`)
 * or dead (absent from it). Pricing it here as well would (i) double-count a
 * live one at the cell it left on its first chasing tick and (ii) forbid a
 * DEAD one's placement for ever, which is trap 157 wearing the danger map's
 * clothes. The predicate is the RUN's own verdict, never a second reading of
 * it.
 *
 * ⚠ A body in a room the verdict REFUSES is priced HERE, at its placement,
 * and the `why` says that is a placement rather than a position. That is the
 * honest reading available: the model has no live position for it, and a
 * heuristic that said nothing would be a hole exactly where the refusal is.
 *
 * ⚠ A BOSS IS AN ENCOUNTER SCRIPT, not a body — `contactPricing`'s own split
 * — and is skipped here for the reason `stepBoundFor` refuses one in (c): a
 * bound of zero would read as "static" and prove the arena clear.
 */
export function staticEnemyDanger(run, box) {
    const out = [];
    const world = run.worldFor(run.level);
    const stepped = run.chaserRoomVerdict(run.level).stepped;
    /**
     * ⛔ R8 SLICE 6 — AND THE SPINNERS ARE EXCLUDED BY THE RUN'S OWN ROSTER,
     * for the reason the bridged chasers are: this room STEPS them, so they
     * belong to ingredient (f) at their LIVE positions. Pricing them here as
     * well would forbid a cell every spinner in the game leaves on tick one —
     * trap 157 wearing the danger map's clothes, which §12.4 named for the
     * live half and this is the other half of.
     */
    const live = new Set((run.spinnerBodies ?? []).map((b) => b.id));
    for (const inst of (world.combat?.enemies ?? [])) {
        if (stepped && isBridgedChaser(inst.tag)) continue;
        if (live.has(`${inst.tag}@${inst.x},${inst.y}`)) continue;
        const pricing = contactPricing(inst.tag);
        if (pricing.kind === 'boss') continue;
        const r = contactRect(inst);
        if (!r) continue;
        if (rectsOverlap(box, r)) {
            out.push({
                kind: 'enemy',
                id: `${inst.tag}@${inst.x},${inst.y}`,
                why: `a static "Enemy" body at its ${stepped ? 'placement (this room is '
                    + 'stepped, so this class is unbridged and does not move)'
                    : 'PLACEMENT — this room\'s chaser roster is REFUSED, so the model has '
                        + 'no live position for it'}, priced "${pricing.kind}" by `
                    + '`contactPricing`',
            });
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ INGREDIENT (f) — R8 SLICE 6 — THE LIVE SPINNER BODIES, GROWN BY THE
 * HAMMER, and the map had them in the WRONG PLACE rather than not at all.
 *
 * ⛔ THE DEFECT IS §12.4's, ONE FAMILY OVER, AND IT IS WORSE. A `SandTrap`
 * was invisible to every ingredient; a `Spinner` was VISIBLE TO INGREDIENT
 * (e) AT ITS PLACEMENT — a cell it leaves on the first tick of the visit and
 * never returns to. So the map forbade a cell nothing is in, and called the
 * cell the body is actually in calm. A wrong "closed" seals the map and a
 * wrong "open" gets you hit; this managed both at once.
 *
 * ⛔⛔ AND WHAT IT IS GROWN BY IS THE **HAMMER**, NOT THE BODY. The 7x7 box
 * is what a press aims at; what damages the player is
 * `collideLine("Player", x, y, x + 13·cos a, y + 13·sin a)` — a rotating line
 * whose phase is `(Game.time % 45) / 45 · 2π`. ⛔ THIS MODEL DOES NOT CARRY
 * `Game.time`: it counts DEAD FRAMES, which are a per-load variable (§22.6),
 * so the phase is not predictable from the run's own clock. What IS exact is
 * the UNION over all 45 phases — `spinner.hammerReach`, a disc of
 * `hammerLength` about the entity point — and that union is what a stance
 * must clear whether it passes through or waits (trap 154's two questions
 * have the SAME answer here, which is why this ingredient ignores the mode).
 *
 * ⇒ the map forbids the DISC. A bound that says "somewhere on this circle,
 * and I cannot say where" is the ACCURATE WALL; predicting the angle from a
 * clock this model does not have would be the permissive refusal
 * [[feedback_accurate_wall_beats_permissive_refusal]] warns about.
 *
 * ⚠ CARRIED FORWARD IN TIME UNDER §14.2's LAW, and a spinner is the cleanest
 * AUTONOMOUS body on the roster: `runRange` is 0, so its chase arm is dead
 * code and its trajectory is a function of the level's geometry and the tick
 * index ALONE — it cannot read the player even in principle.
 * `run.spinnerForecast` is the run's own stepper run forward, so a transit
 * query gets the body at the cell's own ETA rather than at horizon zero.
 */
export function spinnerDanger(run, box, horizon) {
    const bodies = run.spinnerBodies ?? [];
    if (bodies.length === 0) return [];
    // `forecast[i]` is the state at the top of tick `ticksCompleted + 1 + i`,
    // and it is a list of RECTS in the same order `spinnerBodies` reports.
    const ahead = horizon > 0 ? (run.spinnerForecast(horizon)[horizon - 1] ?? null) : null;
    const out = [];
    bodies.forEach((b, i) => {
        const r = ahead?.[i] ?? null;
        // The ENTITY point — `hammerLine` starts at `x`/`y`, not at a corner.
        const cx = r ? (r.x + r.right) / 2 : b.x;
        const cy = r ? (r.y + r.bottom) / 2 : b.y;
        const disc = {
            x: cx - SPINNER.hammerLength,
            y: cy - SPINNER.hammerLength,
            right: cx + SPINNER.hammerLength,
            bottom: cy + SPINNER.hammerLength,
        };
        if (!rectsOverlap(box, disc)) return;
        out.push({
            kind: 'spinner',
            id: b.id,
            why: `a live Spinner body at (${cx.toFixed(1)},${cy.toFixed(1)}) grown by its `
                + `hammer's ${SPINNER.hammerLength} px reach — the UNION over all `
                + `${SPINNER.hammerPeriod} phases, because the angle rides on `
                + '`Game.time` and this model does not carry it'
                + (horizon > 0 ? ` (forecast to horizon ${horizon})` : ''),
        });
    });
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
 * ⛓⛓⛓ R8 SLICE 3b — THE MAP AS VOLUMES, for the AVOID rung.
 *
 * `dangerAt` answers "is THIS box dangerous"; a static re-plan needs the
 * other shape — the rects themselves, so `plannerObstacleAt`'s
 * `extraVolumes` hook can route the corridor AROUND them. Same ingredients,
 * same reasons, one derivation: a second reading of "where the danger is"
 * would drift from the reading the probe then uses to check the answer.
 *
 * ⚠ IT IS THE STATIC HALF OF THE MAP, and says so. A live arrow's swept box
 * and a chaser's growth are functions of a HORIZON, and a tile path has no
 * time axis at all — so those enter at the horizon the caller names (0 for a
 * plan made now) and the ladder's next rung, TIME, is the one that owns the
 * timeline. An AVOID that pretended to price a moving body over a whole walk
 * would be the timing rung, done badly.
 */
export function dangerVolumes(run, horizon = 0) {
    const out = [];
    const level = run.level;
    const world = run.worldFor(level);
    const armed = run.armedArrowTraps;
    if (armed) {
        for (const trap of (world.arrowTraps ?? [])) {
            if (!armed.has(trap.id)) continue;
            const lane = arrowLane({ id: trap.id, t: trap.t, x: trap.ex, y: trap.ey });
            out.push({
                level, kind: 'danger', id: trap.id,
                rect: rect(lane.x0, lane.fromY, lane.x1 - lane.x0,
                    Math.max(world.world.height - lane.fromY, 1)),
                why: 'an ARMED trap\'s lane',
            });
        }
    }
    for (const a of (run.arrowsInFlight ?? [])) {
        const body = rect(a.x - ARROW.hitbox.originX, a.y - ARROW.hitbox.originY,
            ARROW.hitbox.w, ARROW.hitbox.h);
        out.push({
            level, kind: 'danger', id: a.id,
            rect: rect(body.x, body.y, body.w, body.h + ARROW.speed * horizon),
            why: `a live arrow swept ${ARROW.speed} px/tick x ${horizon}`,
        });
    }
    for (const h of (world.combat?.hazards ?? [])) {
        if (HAZARDS_PRICED_LIVE[h.tag]) continue;
        const vol = hazardVolume(h, world.world);
        for (const r of (vol.rects ?? [])) {
            out.push({ level, kind: 'danger', id: `${h.tag}@${h.x},${h.y}`, rect: r.r ?? r,
                why: `${vol.verdict}: ${r.why ?? vol.why}` });
        }
        /**
         * ⚠ A DISC IS NOT A RECT AND IS NOT APPROXIMATED BY ONE HERE. The
         * point test in `volumeHitsBox` is what prices a disc, and `dangerAt`
         * still runs it — so a disc-only hazard is INVISIBLE to the AVOID
         * rung's corridor and CAUGHT by the probe that checks the corridor.
         * That is a named weakness of this rung rather than a hole: the
         * escalation exists precisely because AVOID can fail.
         */
    }
    const stepped = run.chaserRoomVerdict(level).stepped;
    for (const c of (run.chasers ?? [])) {
        const row = ENEMY_CLASSES[c.tag];
        const bound = stepBoundFor(c.tag) ?? 0;
        const body = chaserBoxAt(c.tag, c.x, c.y);
        out.push({
            level, kind: 'danger', id: c.id,
            rect: grow(body, bound * horizon + (row.threatPad ?? 0)),
            why: `a stepped ${c.tag} at its LIVE position`,
        });
    }
    /**
     * ⛔ R8 SLICE 6 — AND THE SPINNERS ARE EXCLUDED BY THE RUN'S OWN ROSTER,
     * for the reason the bridged chasers are: this room STEPS them, so they
     * belong to ingredient (f) at their LIVE positions. Pricing them here as
     * well would forbid a cell every spinner in the game leaves on tick one —
     * trap 157 wearing the danger map's clothes, which §12.4 named for the
     * live half and this is the other half of.
     */
    const live = new Set((run.spinnerBodies ?? []).map((b) => b.id));
    for (const inst of (world.combat?.enemies ?? [])) {
        if (stepped && isBridgedChaser(inst.tag)) continue;
        if (live.has(`${inst.tag}@${inst.x},${inst.y}`)) continue;
        if (contactPricing(inst.tag).kind === 'boss') continue;
        const r = contactRect(inst);
        if (!r) continue;
        out.push({
            level, kind: 'danger', id: `${inst.tag}@${inst.x},${inst.y}`, rect: r,
            why: 'a static "Enemy" body',
        });
    }
    for (const [id, c] of (run.crushers ?? [])) {
        for (const v of crusherVolumesAt(c.x, c.y)) {
            out.push({ level, kind: 'danger', id, rect: v.r, why: v.why });
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ R8 SLICE 3b — THE REGIONS THAT KILL A *BODY*, which is a different
 * question from the regions that kill the PLAYER and has to be asked
 * separately.
 *
 * ⚖ §11.8a ruling 2's BAIT rung derives its stance from
 * `ARROW_KILL_PLAN.baitRule` — *"choose the stance so the straight line from
 * body to player crosses a lane"* — and the mechanism catalog a room offers
 * is what "a lane" means in it. L5's is an armed arrow lane. L6's is the
 * WATER: `Enemy.update`'s terrain switch (transcribed at slice 1, and the
 * arm that already drowns `bob@112,48` in this model) kills a body that walks
 * into water or lava, and slice 3's pit descent kills one that walks into a
 * pit. All three are transcribed mechanism data, which is the other half of
 * the ruling's own law.
 *
 * ⚠ NOT THE SAME SET AS THE PLAYER'S DANGER. A chaser drowns where the
 * player merely cannot walk, and an arrow lane is lethal to both — so a
 * policy that reused one list for both questions would bait bodies into
 * cells that do nothing to them and refuse stances that are perfectly safe.
 */
export function bodyKillRegions(run) {
    const out = [];
    const level = run.level;
    const world = run.worldFor(level);
    const armed = run.armedArrowTraps;
    if (armed) {
        for (const trap of (world.arrowTraps ?? [])) {
            if (!armed.has(trap.id)) continue;
            const lane = arrowLane({ id: trap.id, t: trap.t, x: trap.ex, y: trap.ey });
            out.push({
                kind: 'arrowLane', id: trap.id,
                rect: rect(lane.x0, lane.fromY, lane.x1 - lane.x0,
                    Math.max(world.world.height - lane.fromY, 1)),
                why: 'an ARMED trap\'s lane — `Enemy.hit` through `hitsMax` i-frames',
            });
        }
    }
    for (const t of (world.lethalTerrainTiles ?? [])) {
        out.push({
            kind: 'terrain', id: `tile:${t.tx},${t.ty}`, rect: t.rect,
            why: `\`Enemy.update\`'s terrain switch — t=${t.t} sets \`destroy\``,
        });
    }
    for (const t of (world.pitTiles ?? [])) {
        out.push({
            kind: 'pit', id: `pit:${t.tx},${t.ty}`, rect: t.rect,
            why: '`Enemy.update`\'s `case 6` — a SCHEDULE (lerp, spin, 20-tick fade), '
                + 'during which the body cannot damage the player at all',
        });
    }
    return out;
}

/**
 * ⛓⛓⛓ R8 SLICE 5 — THE TWO DERIVED QUESTIONS, KEPT APART BY NAME.
 *
 * ⚖ §13.10a: the PRIMITIVE stays `dangerAt(run, tick, box)` — it was built
 * time-indexed at §9.9 and the collapse was the CALLER's. What the ruling adds
 * is that the two questions a policy asks of it are different questions, and
 * trap 154's law is that they must not share a name:
 *
 *   `wait`     may I OCCUPY this box from now to `tick`? The union over the
 *              dwell window — a swept arrow, an armed lane, a chaser grown by
 *              its bound. UNCHANGED, and the default, because a stance, a
 *              settle and a bait are all this question.
 *   `transit`  will something be AT this box when I am, at `tick`? The arrows
 *              at their PREDICTED positions rather than swept through every
 *              position they will pass. This is the question a corridor asks,
 *              and asking it in the other mode is what refuted `r8-solve-5`.
 *
 * ⚠ ONLY THE ARROW ARM DIFFERS, and every other ingredient is shared rather
 * than re-derived. A chaser's growth by `bound x horizon` is already the right
 * shape for both (it is where the body COULD be, and it could be there at the
 * arrival tick); the hazard volumes and the static bodies do not move at all;
 * the crusher is a snapshot whose own getter says so. A second union would be
 * a second cost model.
 */
export const DANGER_MODES = Object.freeze({
    wait: Object.freeze({
        arrows: 'swept `speed x horizon` — the UNION over the dwell window',
        asks: 'may I occupy this box for the whole window',
        cite: 'trap 154 — the question a stance/settle/bait asks',
    }),
    transit: Object.freeze({
        arrows: 'predicted by `stepArrow`\'s own arithmetic, cover included',
        asks: 'will something be at this box at this tick',
        cite: '⚖ §13.10a / trap 161 — the question a corridor asks',
    }),
});

/**
 * ⛓⛓⛓ WHICH INGREDIENTS A TRANSIT QUESTION MAY CARRY FORWARD IN TIME — AND
 * THE CRITERION IS **AUTONOMY**, not convenience. Measured, not chosen.
 *
 * ⚖ §13.10a ruling 2 gives the reason in its own words: *"arrows in flight are
 * autonomous and exactly predictable from run state — their flight does not
 * read the player."* That sentence is a PARTITION, and this table is it.
 *
 *   AUTONOMOUS — an arrow. Its trajectory is a function of its own state, so
 *   "where will it be at tick T" is arithmetic and the answer is exact.
 *
 *   PLAYER-COUPLED — a chaser. `Bob.update` steers at the PLAYER, so a
 *   forecast of it along a walk that has not happened is a forecast of the
 *   walk, not of the body. Growing its envelope by `bound x horizon` over a
 *   whole corridor is formally sound and practically useless: at 0.5 px/tick
 *   over a 120-tick walk the envelope is 60 px in every direction and the
 *   room is one solid refusal. ⛔ MEASURED, not argued — doing it that way
 *   made L6's ladder escalate for ever, in the one room the arc has already
 *   recorded byte-exact.
 *
 * ⇒ a TRANSIT query reads the player-coupled ingredients at HORIZON ZERO,
 * exactly as the static corridor probe always did, and what prices them along
 * the walk is ⚖ §13.10a point 3: **the per-tick next-cell check**, live, every
 * tick, against bodies that have actually moved. The probe PRUNES; the tick
 * ADJUDICATES. A heuristic that tried to be the oracle here would be
 * `spinnerForecast`'s own doctrine broken by its own map.
 *
 * ⚠ THE STATIC INGREDIENTS TAKE NO HORIZON AT ALL and are listed anyway, so
 * this is a partition of the union rather than a note about two of its arms.
 */
export const TRANSIT_INGREDIENTS = Object.freeze({
    arrows: Object.freeze({
        coupling: 'autonomous',
        atEta: true,
        why: '`stepArrow` reads only the arrow: velocity, the level bound, and cover',
    }),
    chasers: Object.freeze({
        coupling: 'player-coupled',
        atEta: false,
        why: '`chaseImpulse` steers at the player, so a long forecast forecasts the '
            + 'walk. Read LIVE; priced along the corridor by the per-tick next-cell check',
    }),
    armedLanes: Object.freeze({
        coupling: 'state',
        atEta: false,
        why: 'whether a trap fires at all is its GROUP\'s state (trap 160) — danger at '
            + 'every horizon while armed, and the caller holding the presser is the one '
            + 'that may exclude it by id',
    }),
    hazards: Object.freeze({
        coupling: 'static', atEta: false, why: 'placed volumes do not move',
    }),
    spinners: Object.freeze({
        coupling: 'autonomous',
        atEta: true,
        why: '⛓ THE CLEANEST AUTONOMOUS BODY ON THE ROSTER — `runRange` is 0, so '
            + '`Spinner.update`\'s chase block is dead code and the trajectory is a '
            + 'function of the level geometry and the tick index alone. It cannot read '
            + 'the player even in principle, so `spinnerForecast` (the run\'s OWN '
            + 'stepper, run forward) is exact. ⚠ What is NOT predictable is the HAMMER '
            + 'ANGLE — it rides on `Game.time`, which counts dead frames — so the '
            + 'ingredient forbids the whole disc at every horizon rather than a line at '
            + 'one of them.',
    }),
    staticEnemies: Object.freeze({
        coupling: 'static', atEta: false, why: 'a `speed 0` census body at its placement',
    }),
    crushers: Object.freeze({
        coupling: 'snapshot', atEta: false,
        why: 'a charging crusher does not re-derive `v`; the run\'s own getter says the '
            + 'plan is sound only while `crushersParked`',
    }),
});

/**
 * The union, over one box at one absolute tick.
 *
 * @param {object} run  a live `createLevelRun` view
 * @param {number} tick ABSOLUTE — the same clock `forbiddenAt(tick, …)` uses
 * @param {object} box  a player box (`playerPhysicsV2.playerBoxAt`)
 * @param {object} [opts]
 * @param {'wait'|'transit'} [opts.mode] see `DANGER_MODES`; `wait` by default,
 *   because it is the older, wider claim and a caller that has not thought
 *   about the difference should get the one that forbids more.
 * @returns {{danger: boolean, horizon: number, mode: string, sources: object[]}}
 */
export function dangerAt(run, tick, box, { mode = 'wait', arrows = null } = {}) {
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
    if (!DANGER_MODES[mode]) {
        fail(`dangerAt: "${mode}" is not a mode. The two questions are `
            + `[${Object.keys(DANGER_MODES).join(', ')}] and they are kept apart by name `
            + 'on purpose (trap 154) — a caller that wants a third one has a third '
            + 'question and should say what it is.');
    }
    // ⛔ THE PLAYER-COUPLED ARM READS LIVE IN TRANSIT MODE — see
    // `TRANSIT_INGREDIENTS` for the criterion and for the measurement that
    // forced it. The horizon is the ARROW arm's alone.
    const coupledHorizon = mode === 'transit' ? 0 : horizon;
    const sources = [
        ...(mode === 'transit'
            ? arrowDangerDuringTransit(run, box, horizon, arrows)
            : arrowDanger(run, box, horizon)),
        ...hazardDanger(run, box),
        ...chaserDanger(run, box, coupledHorizon),
        // ⛓ AUTONOMOUS (§14.2): a spinner cannot read the player, so it is
        // carried to the cell's own ETA in transit mode exactly as an arrow is.
        ...spinnerDanger(run, box, horizon),
        ...staticEnemyDanger(run, box),
        ...crusherDanger(run, box),
    ];
    return { danger: sources.length > 0, horizon, mode, sources };
}

/**
 * ⚖ §13.10a's TRANSIT question, named. `tick` is the cell's own ETA.
 *
 * ⛔ THE ETA IS THE CALLER'S TO DERIVE, and it must come from the controller
 * that will actually drive (`botDriverV1.chooseHeld` plus the run's own
 * physics) — never from a distance divided by a speed. Trap 118's direction
 * applies to time exactly as it does to space: a cruder movement model
 * produces a schedule the walk does not keep, and a probe checked against a
 * schedule nobody drives is a probe of nothing.
 */
export function dangerDuringTransit(run, tick, box, arrows = null) {
    return dangerAt(run, tick, box, { mode: 'transit', arrows });
}

/**
 * ⚖ §13.10a's WAIT question, named — the union over a dwell window.
 *
 * ⚠ THE WINDOW STARTS AT `run.ticksCompleted`, NOT AT `from`, and that is the
 * conservative direction: a dwell that begins in the future is priced from now
 * instead, which can only forbid more. Stated rather than left to be inferred
 * from the horizon arithmetic — a caller that needs the tighter window is
 * asking a question this map has never been able to answer.
 */
export function dangerWhileWaiting(run, untilTick, box) {
    return dangerAt(run, untilTick, box, { mode: 'wait' });
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

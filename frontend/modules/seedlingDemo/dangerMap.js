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
import { contactPricing, contactRect, ENEMY_CLASSES, stepBoundFor } from './combat.js';
import { chaserBoxAt, isBridgedChaser } from './chasers.js';
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
    for (const inst of (world.combat?.enemies ?? [])) {
        if (stepped && isBridgedChaser(inst.tag)) continue;
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
    for (const inst of (world.combat?.enemies ?? [])) {
        if (stepped && isBridgedChaser(inst.tag)) continue;
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
        ...staticEnemyDanger(run, box),
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

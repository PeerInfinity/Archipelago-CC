/**
 * seedlingDemo/strikePolicy — **THE OPPORTUNISTIC STRIKE: ONE PER-TICK POLICY
 * CONSULTED BY EVERY WALK.**
 *
 * R9 slice 12b. ⚖ Ruling 30(b), the user's own words: *"add opportunistic
 * sword attacks to all of the paths, AVOID, TIME, and BAIT, not just KILL.
 * Attacking with the sword when an enemy happens to be in range. There are a
 * few options for how to prioritize which target to attack if more than one
 * are in range, but for a first version we can ignore prioritization, or maybe
 * target the enemy that's closest to the player."*
 *
 * ── WHY IT IS A MODULE AND NOT A BRANCH IN `drive` ────────────────────
 *
 * ⛔⛔ **WHAT THE PROBE CERTIFIES MUST BE WHAT THE WALK DOES** (⚖ ruling
 * 30(c)). `previewWalk` prices a candidate corridor by stepping the chasers
 * against it; `drive` then walks it. If the preview walked a corridor with no
 * strikes and the drive struck, the certified corridor would not be the walked
 * one — the bodies would be somewhere else, having been knocked back, and
 * every ETA in the danger map would be a fact about a walk nobody took. So
 * there is ONE policy object, constructed the same way on both sides, and a
 * unit row asserts the two produce the same held-set sequence over a bob room.
 *
 * ⛓ AND IT NEVER REFUSES A WALK. Every other combat verb on this ladder can
 * say "no". This one only ever ADDS presses to a walk that was already going
 * to happen: if nothing is in reach, or the sword is not held, or the target's
 * class has no modelled press arm, it hands back the walk's own keys unchanged.
 * A rung that refuses is a rung; this is a policy.
 *
 * ── THE TWO-TICK SHAPE, AND WHY IT COSTS THE WALK TWO TICKS ───────────
 *
 * `set slashing` latches `slashDirection = direction`, and `direction` is
 * written by `sprites()` at the END of the update from the tick's VELOCITY. So
 * a press aimed at a body to the north must be preceded by a tick that moves
 * the player north — you cannot aim and press on the same tick. That is the
 * spinner arm's shape (`solverBot.execKillByPress`), lifted: AIM this tick
 * (`FACING_KEYS[facingToward(...)]`), PRESS the next, then resume the walk.
 *
 * ⚠ **THE AIM TICK IS A REAL COST AND THE FORECAST CARRIES IT.** Two ticks of
 * the walk's own input are spent per strike, so the player arrives later and
 * the chasers get two more steps. A policy that priced the press and not the
 * aim would certify corridors the drive cannot keep.
 *
 * ── THE PER-TARGET RULE, WHICH IS NOT A CADENCE ───────────────────────
 *
 * ⚖ Ruling 31(b) retired the 31-tick floor: a press is refused only by what it
 * would DO. What it would do is decided by TWO things, and both are per body:
 *
 *  1. `hitsTimer === 0` — `Enemy.hit`'s first gate. A press into a live i-frame
 *     lands no damage.
 *  2. **NO PRESS OF MINE IS STILL OWED AGAINST THIS BODY.** This is the one a
 *     timer-only rule gets wrong, and `execKillByPress`'s own docblock named it
 *     before anything acted on it: a press's hit tests run over
 *     `T+1 … T+SLASH_HIT_TICKS`, so on the tick AFTER a press the target's
 *     timer is still 0 and a rule reading only the timer presses again into a
 *     hit that has not landed yet. The model would then count a hit the game
 *     never gives it.
 *
 * ⛔ Neither is a rule about how fast the PLAYER may swing. Two bodies in one
 * rect take a hit each from one press, and a second body coming into reach may
 * be struck on the very next tick — see `combatVerbs.ORDINARY_SWING_PERIOD`
 * and `DASH_CHAIN` for what actually bounds the player.
 *
 * ── PRIORITISATION ────────────────────────────────────────────────────
 *
 * NEAREST, by `distanceRectPoint` from the player's centre point to the
 * target's box — which is `Player.slash`'s own second filter, so "nearest" is
 * measured in the metric that decides whether the swing lands at all rather
 * than in centre-to-centre distance. The user offered "none, or nearest" for a
 * first version; nearest is chosen and SAID, because a first-viable pick out of
 * an unordered list is the shape kickoff §22.9 warned about in `deriveStrike`.
 */

import { KILL_ARM_POLICY, MODELLED_KILL_ARMS } from './enemyDamage.js';
import { SLASH_HIT_TICKS, SLASH_REACH, distanceRectPoint, slashRect } from './presses.js';
import { rectsOverlap } from './levelWorld.js';

export class StrikePolicyError extends Error {
    constructor(message) { super(message); this.name = 'StrikePolicyError'; }
}
const fail = (m) => { throw new StrikePolicyError(m); };

/** What a tick's decision can be. */
export const STRIKE_NONE = 'none';
export const STRIKE_AIM = 'aim';
export const STRIKE_PRESS = 'press';

/**
 * ⛔⛔ IS THIS BODY'S PRESS ARM MODELLED — AND THE ANSWER IS KEYED ON THE
 * **CLASS**, NOT ON THE ARM.
 *
 * ⚠ THIS FUNCTION'S FIRST CUT READ `KILL_ARM_POLICY[body.as3]`, WHICH IS
 * ALWAYS `refused` FOR A CHASER. `as3` is the `genericHit` ARM — `"Enemy"` for
 * every bob, jellyfish and flyer alike — and `PRESS_ARM_POLICY.Enemy` is
 * `refused` ON PURPOSE and stays that way: its reason ("a death moves
 * `totalEnemies()`, which opens `tSet == -1` locks") is true OF THE FAMILY and
 * is exactly what a lift has to answer for, one class at a time. The row that
 * decides is the per-CLASS one, `KILL_ARM_POLICY.Bob`, which R9 slice 12
 * lifted to `modelled`.
 *
 * ⛓ Kickoff §22.4 says this in as many words, and it was quoted in this
 * module's own header before the code below was written wrong anyway. The
 * measurement is what caught it: on L6 the policy sat 5.9 px from a live bob
 * and rejected it with `KILL_ARM_POLICY.Enemy is \`refused\``, which is a
 * TRUE sentence about the wrong subject.
 *
 * ⇒ it is `levelRun`'s own `enemyClassModelled` predicate, not a second
 * spelling of it: the family must be `"Enemy"` AND the class must be in
 * `MODELLED_KILL_ARMS`. Classes whose arm is their OWN (`IceTurret`,
 * `ShieldBoss`) are admitted by the same table under their own `as3`.
 */
export function armIsModelled(body) {
    if (body.as3 === 'Enemy') {
        return MODELLED_KILL_ARMS.includes(body.enemyClass);
    }
    return KILL_ARM_POLICY[body.as3]?.policy === 'modelled';
}

/** The reason `armIsModelled` said no, for the trace. */
function armRefusalWhy(body) {
    if (body.as3 === 'Enemy') {
        return `KILL_ARM_POLICY.${body.enemyClass ?? '(no class)'} is `
            + `\`${KILL_ARM_POLICY[body.enemyClass]?.policy ?? 'absent'}\` — the `
            + '`Enemy` ARM is refused for the whole family and the CLASS row decides';
    }
    return `KILL_ARM_POLICY.${body.as3} is `
        + `\`${KILL_ARM_POLICY[body.as3]?.policy ?? 'absent'}\``;
}

/**
 * The bodies a strike may consider, in NEAREST-first order, with the reason
 * every rejected one was rejected.
 *
 * @param {object} player `{x, y}` — the CENTRE, which is what both the rect
 *   and `distanceRectPoint` are built from.
 * @param {object[]} bodies `[{id, as3, rect, hitsTimer}]`
 * @param {function} facingToward `(from, targetRect) => direction`
 * @param {Map<string, number>} owed  body id -> the tick a press of mine was
 *   issued, for as long as its hit tests are still to run.
 * @param {number} tick
 */
export function strikeCandidates(player, bodies, { facingToward, owed, tick }) {
    const chosen = [];
    const rejected = [];
    for (const b of bodies) {
        if (!armIsModelled(b)) {
            rejected.push({ id: b.id, why: armRefusalWhy(b) });
            continue;
        }
        const reach = distanceRectPoint(player.x, player.y, b.rect);
        if (reach > SLASH_REACH) {
            rejected.push({ id: b.id, why: `distanceRectPoint ${reach.toFixed(3)} > `
                + `${SLASH_REACH}` });
            continue;
        }
        // ⛓ THE RECT AS WELL AS THE REACH. `Player.slash` collects with
        // `collideRectInto` FIRST and applies the distance gate second, so a
        // body inside 16 px that the rect does not cover is not a candidate —
        // and at the corners the two disagree by up to the box's half-diagonal.
        const direction = facingToward(player, b.rect);
        if (!rectsOverlap(slashRect(player.x, player.y, direction), b.rect)) {
            rejected.push({ id: b.id, why: `in reach (${reach.toFixed(3)}) but the `
                + `slash rect facing ${direction} does not cover it` });
            continue;
        }
        if (b.hitsTimer > 0) {
            rejected.push({ id: b.id, why: `hitsTimer ${b.hitsTimer} — \`Enemy.hit\` `
                + 'refuses while it is up' });
            continue;
        }
        const mine = owed.get(b.id);
        if (mine !== undefined && tick - mine <= SLASH_HIT_TICKS) {
            /**
             * ⛔ THE ONE A TIMER-ONLY RULE GETS WRONG. The press at `mine` has
             * hit tests still to run (`T+1 … T+SLASH_HIT_TICKS`) and the body's
             * `hitsTimer` will not move until one of them lands — so the timer
             * reads 0 and the hit is already on its way.
             */
            rejected.push({ id: b.id, why: `my own press at tick ${mine} still has hit `
                + `tests to run (through ${mine + SLASH_HIT_TICKS}); its hit has not `
                + 'landed yet, so `hitsTimer` reading 0 is not an invitation' });
            continue;
        }
        chosen.push({ id: b.id, as3: b.as3, enemyClass: b.enemyClass, reach, direction, rect: b.rect });
    }
    // NEAREST first, ties broken by id so the order is total and reproducible
    // on both sides of the preview/drive equality.
    chosen.sort((a, b) => (a.reach - b.reach) || (a.id < b.id ? -1 : 1));
    return { chosen, rejected };
}

/**
 * ONE walk's strike state. Constructed per walk, consulted per tick, and used
 * IDENTICALLY by `previewWalk` and by `drive` — that identity is the point.
 *
 * @param {object} opts.facingToward  `solverBot.facingToward`, injected rather
 *   than imported to keep this module out of `solverBot`'s import cycle.
 * @param {object} opts.facingKeys    `solverBot.FACING_KEYS`.
 * @param {boolean} opts.allowDash    ⚖ ruling 31(c): v1 MAY permit a press
 *   that lands inside `slashTimer` and therefore dashes. Off by default: the
 *   dash is a displacement the corridor must be certified WITH, and the
 *   planner-level primitive is slice 12c's.
 */
export function createStrikePolicy({
    facingToward, facingKeys, allowDash = false, hasSword = true,
} = {}) {
    if (typeof facingToward !== 'function') fail('createStrikePolicy: facingToward is required');
    if (!facingKeys) fail('createStrikePolicy: facingKeys is required');
    /** body id -> the tick I last pressed at it. */
    const owed = new Map();
    /** The aim taken last tick, awaiting its press. */
    let aimed = null;
    const trace = [];

    return {
        /** ⛓ Read-only, for the equality row and for the as-built's counts. */
        get trace() { return trace.map((t) => ({ ...t })); },
        get strikes() { return trace.filter((t) => t.decision === STRIKE_PRESS).length; },
        get aimed() { return aimed; },

        /**
         * One tick. `walkHeld` is what the walk WOULD hold; the return is what
         * it should hold instead, plus the decision for the trace.
         *
         * @param {object} state    the player, `{x, y}`.
         * @param {object[]} bodies `[{id, as3, rect, hitsTimer}]` — live, at
         *   THIS tick, from whichever side is asking.
         * @param {number} tick
         */
        decide(state, bodies, tick, walkHeld) {
            if (!hasSword) return { held: walkHeld, decision: STRIKE_NONE };
            // ── the PRESS half of a two-tick strike ──────────────────
            if (aimed !== null) {
                const target = aimed.id;
                aimed = null;
                owed.set(target, tick);
                const row = { tick, decision: STRIKE_PRESS, target, held: 'primary' };
                trace.push(row);
                return { held: new Set(['primary']), decision: STRIKE_PRESS, target };
            }
            const { chosen, rejected } = strikeCandidates(state, bodies,
                { facingToward, owed, tick });
            if (chosen.length === 0) {
                if (rejected.length > 0) {
                    trace.push({ tick, decision: STRIKE_NONE, saw: bodies.length, rejected });
                }
                return { held: walkHeld, decision: STRIKE_NONE };
            }
            const pick = chosen[0];
            aimed = { id: pick.id, direction: pick.direction, tick };
            trace.push({
                tick,
                decision: STRIKE_AIM,
                target: pick.id,
                reach: pick.reach,
                direction: pick.direction,
                saw: bodies.length,
                // ⛓ The runners-up, so a trace can answer "why that one" and
                // not only "which one".
                alsoInReach: chosen.slice(1).map((c) => ({ id: c.id, reach: c.reach })),
                rejected,
            });
            return {
                held: new Set([facingKeys[pick.direction]]),
                decision: STRIKE_AIM,
                target: pick.id,
            };
        },

        /**
         * ⛔ `allowDash` is carried rather than acted on in v1, and saying so is
         * the point: a press that lands inside `slashTimer` dashes, and a
         * corridor certified without that displacement is not the corridor the
         * drive walks. The planner-level dash primitive is slice 12c's.
         */
        get allowDash() { return allowDash; },
    };
}

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
 * ── `allowDash` IS ENFORCED, AND IT IS THE POLICY THAT ENFORCES IT ────
 *
 * ⛔⛔ R9 SLICE 12b′. The flag arrived in 12b CARRIED and never read, which
 * made its own docblock false: *"a corridor certified without the
 * displacement is not the corridor the drive walks"* is a reason to REFUSE
 * the press, and nothing refused it. The policy had no model of `slashTimer`
 * at all, so it could not tell a swing from a dash — and `Player.as:779`'s
 * dash branch has NO `!slashing` term, so a second press inside 20 ticks
 * dashes whether or not anybody meant it.
 *
 * ⛓ VACUOUS ON EVERY COMMITTED CORRIDOR AND LIVE THE MOMENT L14 IS WALKED.
 * §23.8 measured zero presses anywhere on the roster; L14's own stance dwell
 * emits presses two ticks apart against different bodies (its `owed` rule is
 * per TARGET, and two bodies are two targets).
 *
 * ⇒ with `allowDash` false a press is refused when it would land inside
 * `ORDINARY_SWING_PERIOD` of my previous one — ⚖ ruling 36's own constant,
 * `SLASH_TIMER_MAX` under the name that says what it bounds. THE REFUSAL IS
 * TAKEN AT THE AIM, not at the press: an aim spends a direction key, and a
 * tick spent aiming at a press that will be refused is a tick of drift for
 * nothing.
 *
 * ⚠ IT COSTS NO DAMAGE. One body's damage is bounded by its own 30-tick
 * i-frame (`ENEMY_IFRAMES`), which is above 20 — so the floor this puts under
 * the swing rate is below the floor the receiver already imposes. What it
 * costs is INTERLEAVING: two bodies can no longer be struck two ticks apart.
 *
 * ⛓ AND IT CLOSES §23.15's `slashRepeats` DOUBLE-COUNT FROM THIS SIDE. That
 * defect needs two presses inside `SLASH_HIT_TICKS` (5); a rule that refuses
 * two inside 20 refuses those a fortiori. The MODEL's own repair — a dash
 * press RESTARTS the animation, so the pending repeats are REPLACED rather
 * than appended — is named and is not this slice's.
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

import {
    DASH_DISPLACEMENT, ORDINARY_SWING_PERIOD, SLASH_DASH_FORCE, SLASH_SCALE_NORMAL,
    slashPressForecast,
} from './combatVerbs.js';
import { chaseEnvelope } from './encounters.js';
import { KILL_ARM_POLICY, MODELLED_KILL_ARMS } from './enemyDamage.js';
import {
    SLASH_HIT_TICKS, SLASH_REACH, distanceRectPoint, slashReachFor, slashRect,
} from './presses.js';
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
export function strikeCandidates(player, bodies, {
    facingToward, owed, tick, scale = SLASH_SCALE_NORMAL,
}) {
    /**
     * ⛓⛓⛓ R9 SLICE 12c — **THE SCAN ASKS WITH THE RECT THE PRESS WILL SWING.**
     *
     * `Player.slash` collects with `collideRectInto` against
     * `getSlashRect()` and then filters on `slashingSprite.width * scaleX` —
     * BOTH read the scale, and a dash's is 1.5 x 0.65. So a dash swings 24 x
     * 20.8 at reach 24 where an ordinary swing swings 16 x 32 at 16: WIDER
     * along the swing and SHORTER across it, and **neither rect contains the
     * other**. A scan that used one shape for both is wrong in both
     * directions — it misses bodies a dash would reach and offers bodies a
     * dash would miss.
     *
     * ⛓ THE DEFAULT IS THE PLAIN SWING, so `allowDash: false` — the
     * roster-wide default (⚖ ruling 42) — asks exactly the question it asked
     * before this parameter existed.
     */
    const reachLimit = slashReachFor(scale);
    const chosen = [];
    const rejected = [];
    for (const b of bodies) {
        if (!armIsModelled(b)) {
            rejected.push({ id: b.id, why: armRefusalWhy(b) });
            continue;
        }
        const reach = distanceRectPoint(player.x, player.y, b.rect);
        if (reach > reachLimit) {
            rejected.push({ id: b.id, why: `distanceRectPoint ${reach.toFixed(3)} > `
                + `${reachLimit}` });
            continue;
        }
        // ⛓ THE RECT AS WELL AS THE REACH. `Player.slash` collects with
        // `collideRectInto` FIRST and applies the distance gate second, so a
        // body inside 16 px that the rect does not cover is not a candidate —
        // and at the corners the two disagree by up to the box's half-diagonal.
        const direction = facingToward(player, b.rect);
        if (!rectsOverlap(slashRect(player.x, player.y, direction, scale), b.rect)) {
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
 * ⛓⛓⛓ R9 SLICE 12c — **IS THIS DASH SAFE TO TAKE, ASKED WITH NOTHING BUT
 * WHAT THE WALK ITSELF HAS?** (⚖ ruling 35 safety-first; trap 567.)
 *
 * ⛔⛔ **WHY IT LIVES IN THE POLICY AND NOT IN THE PREVIEW.** The obvious
 * design hands the certification down from `previewWalk`, which owns a chaser
 * FORECAST and could step the bodies over the dash. That is trap 567 exactly:
 * a driver commits its keys for tick k before tick k runs, so `drive` has
 * `run.strikeBodies` — what tick k-1 left — and NOTHING else. A probe better
 * informed than the walk certifies corridors the walk cannot keep, and the
 * preview/drive equality would diverge on the first dash. So the question is
 * asked from `{state, bodies}`, which is what BOTH sides hold.
 *
 * ── WHAT IS PRICED, AND WHAT IS NOT ──────────────────────────────────
 *
 * ⛓ **THE MARGINAL 9 PX, NOT THE CORRIDOR.** The corridor is
 * `probeCorridor`'s and is certified WITH the strikes and now WITH the dash,
 * because the preview steps the impulse. What a dash ADDS is
 * `DASH_DISPLACEMENT` — 8 ticks of surplus velocity carrying the player
 * `DASH_DISPLACEMENT.total` px further along their own travel than the walk
 * would have gone. That extra ground is what nothing has priced, and it is
 * what this prices.
 *
 * ⛓ **THROUGH `encounters.chaseEnvelope`, WHICH IS NOT A SECOND DANGER
 * MODEL.** It is the arc's own sound over-approximation: it grows the body's
 * transcribed hitbox by its class step bound per tick plus its `threatPad`
 * and reports the AABB clearance. Re-used rather than re-spelled, exactly as
 * §23b.4's stance conditions re-used `dangerDuringTransit`.
 *
 * ⛔ **TWO WAYS TO BE UNPRICEABLE, AND BOTH REFUSE BY NAME** rather than
 * assume:
 *  1. **No step bound** — a boss or an unpriced tag. `chaseEnvelope` fails by
 *     name here already ("0 would read as static and prove the arena safe");
 *     this converts that into a `dashRefused` row instead of a throw, because
 *     a policy may decline but may not abort a walk.
 *  2. **A body inside its own i-frame** — i.e. one I have just knocked. This
 *     is `priceCrossing`'s own refusal, verbatim in its reason: *"a knocked
 *     enemy's chase takes the `pushed` branch, which does not re-normalize to
 *     moveSpeed — so the step bound the envelope rests on no longer holds"*.
 *     ⚠ IT IS THE COMMON CASE AND IT IS SUPPOSED TO BE: the dash a policy
 *     most wants is the one two ticks after a press, and two ticks after a
 *     press the body it struck is in flight at up to `SWORD_FORCE`. ⚖ Ruling
 *     35 puts safety over speed, so an unpriceable dash is a refused dash.
 *
 * ⚠ **THE OFFSETS ARE THE IMPULSE'S OWN SHAPE.** `knockbackImpulse` is
 * axis-quantised (a component under half the unit length is dropped), so the
 * direction of travel is taken from the impulse vector itself and scaled by
 * `DASH_DISPLACEMENT.perTick[k] / SLASH_DASH_FORCE`. For a cardinal dash —
 * the only kind any committed corridor takes — that is exact against
 * `DASH_DISPLACEMENT`.
 *
 * @returns {{certified: boolean, why: ?string, worst: ?object}}
 */
export function certifyDash(state, bodies, impulse) {
    if (!impulse || (impulse.dvx === 0 && impulse.dvy === 0)) {
        // ⛓ AT REST THE IMPULSE IS EXACTLY (0,0) — `point_normalize` no-ops at
        // zero length — so the dash moves the player NOWHERE and adds no
        // ground to price. Certified, and said rather than left to the
        // arithmetic returning 0.
        return { certified: true, why: 'the impulse is (0,0) — a dash at rest carries '
            + 'the player nowhere, so it adds no ground to price', worst: null };
    }
    const path = DASH_DISPLACEMENT.perTick.map((carried, k) => ({
        t: k,
        x: state.x + (impulse.dvx / SLASH_DASH_FORCE) * carried,
        y: state.y + (impulse.dvy / SLASH_DASH_FORCE) * carried,
    }));
    let worst = null;
    for (const b of bodies) {
        if (b.hitsTimer > 0) {
            return { certified: false, worst: { id: b.id },
                why: `${b.id} is inside its own i-frame (hitsTimer ${b.hitsTimer}), so it `
                    + 'is in KNOCKBACK: `Enemy.hit` applies `swordForce` and a knocked '
                    + 'chase takes the `pushed` branch, which does not re-normalize to '
                    + '`moveSpeed` — the step bound `chaseEnvelope` rests on does not '
                    + 'hold (`priceCrossing`\'s own refusal). The dash cannot be PRICED '
                    + 'against it, so under ⚖ ruling 35 it is refused rather than taken' };
        }
        let env;
        try {
            env = chaseEnvelope({ tag: b.tag, cx: b.x, cy: b.y }, path);
        } catch (e) {
            return { certified: false, worst: { id: b.id },
                why: `${b.id} cannot be priced by an envelope at all — ${e.message}` };
        }
        for (const row of env.rows) {
            if (worst === null || row.clearance < worst.clearance) {
                worst = { id: b.id, t: row.t, clearance: Number(row.clearance.toFixed(3)) };
            }
            if (row.clearance <= 0) {
                return { certified: false,
                    worst: { id: b.id, t: row.t,
                        clearance: Number(row.clearance.toFixed(3)) },
                    why: `${b.id}'s envelope MEETS the dashed path at offset tick `
                        + `${row.t} (clearance ${row.clearance.toFixed(3)}). The dash `
                        + `carries the player ${DASH_DISPLACEMENT.total} px further `
                        + 'along their own travel than the walk the corridor was '
                        + 'certified on, and that ground is not clear' };
            }
        }
    }
    return { certified: true, why: null, worst };
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
    /**
     * ⛓ MY LAST PRESS AT ANY BODY — the swing-window question, which is about
     * the PLAYER and therefore is not per target the way `owed` is.
     * `slashTimer` is written by the ordinary arm alone and a dash does not
     * refresh it (§23.2 point 2), so the tick of the last press is the whole
     * state this needs.
     */
    let lastPressAt = null;
    /** The aim taken last tick, awaiting its press. */
    let aimed = null;
    const trace = [];

    return {
        /** ⛓ Read-only, for the equality row and for the as-built's counts. */
        get trace() { return trace.map((t) => ({ ...t })); },
        get strikes() { return trace.filter((t) => t.decision === STRIKE_PRESS).length; },
        /**
         * ⛓ R9 slice 12c — the presses that DASHED, derived from the same
         * rows `strikes` counts so the two cannot disagree. Zero on every
         * committed corridor, because the roster-wide default is
         * `allowDash: false` (⚖ ruling 42).
         */
        get dashes() {
            return trace.filter((t) => t.decision === STRIKE_PRESS && t.dash).length;
        },
        /** ⛓ R9 slice 12c — the rows where a dash was refused, either arm. */
        get dashRefusals() { return trace.filter((t) => t.dashRefused).map((t) => ({ ...t })); },
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
        decide(state, bodies, tick, walkHeld, { slash = null } = {}) {
            if (!hasSword) return { held: walkHeld, decision: STRIKE_NONE };
            // ── the PRESS half of a two-tick strike ──────────────────
            if (aimed !== null) {
                const target = aimed.id;
                const dash = aimed.dash ?? false;
                aimed = null;
                owed.set(target, tick);
                lastPressAt = tick;
                const row = { tick, decision: STRIKE_PRESS, target, held: 'primary', dash };
                trace.push(row);
                return { held: new Set(['primary']), decision: STRIKE_PRESS, target, dash };
            }
            /**
             * ⛓⛓⛓ R9 SLICE 12c — **WHAT THIS AIM'S PRESS WILL ACTUALLY DO,
             * BEFORE A DIRECTION KEY IS SPENT ON IT** (⚖ ruling 35).
             *
             * The aim is this tick and the press it earns lands on `tick + 1`,
             * so the forecast ages the run's slash state by exactly that —
             * with the run's own primitives, in the run's own order (see
             * `combatVerbs.slashPressForecast`). Its outcome decides the RECT
             * the scan asks with, because a dash swings a different one.
             *
             * ⛔ `null` WHEN THE CALLER DID NOT SUPPLY IT, and then the scan
             * asks with the plain swing's rect exactly as it did before this
             * parameter existed. That is not a silent default: at
             * `allowDash: false` — the roster-wide default (⚖ ruling 42) — the
             * refusal below already forbids every press that could dash, so
             * the plain rect is the only rect a press can swing and the two
             * arms agree by construction. A row asserts it.
             */
            const forecast = (slash && allowDash)
                ? slashPressForecast(slash, {
                    tick, ticksAhead: 1, direction: state.direction ?? 0,
                    vx: state.vx ?? 0, vy: state.vy ?? 0,
                })
                : null;
            /**
             * ⛔⛔ A PRESS THAT OPENS NO WINDOW CANNOT HIT ANYTHING, so it is
             * not worth an aim tick. `set slashing` has FOUR arms and two of
             * them do nothing at all: `gated` (wanding, firing, spearing, or
             * no sword) and `swallowed` (`slashDashed` up with the swing still
             * open — both arms refused and there is no else). 12b's model
             * scheduled a rect for every one of them; this reads the OUTCOME
             * rather than the flag, which is what makes it a model instead of
             * a guess.
             */
            if (forecast && (forecast.outcome === 'gated' || forecast.outcome === 'swallowed')) {
                trace.push({
                    tick,
                    decision: STRIKE_NONE,
                    saw: bodies.length,
                    pressWouldBe: forecast.outcome,
                    why: `a press at tick ${forecast.at} would be \`${forecast.outcome}\` — `
                        + `${forecast.why} No window opens, so no rect is swung and an aim `
                        + 'tick spent on it would be a direction key of drift for nothing.',
                });
                return { held: walkHeld, decision: STRIKE_NONE };
            }
            const { chosen, rejected } = strikeCandidates(state, bodies,
                { facingToward, owed, tick, scale: forecast?.scale ?? SLASH_SCALE_NORMAL });
            /**
             * ⛔⛔ THE DASH REFUSAL, AND IT IS ASKED AFTER THE SCAN ON PURPOSE.
             *
             * The press this tick's aim earns lands on `tick + 1`; a press
             * lands inside the open swing window — and therefore DASHES —
             * when it is fewer than `ORDINARY_SWING_PERIOD` ticks after my
             * last one. It is taken at the AIM rather than at the press
             * because an aim spends a direction key, and a tick spent aiming
             * at a press that will not be taken is a tick of drift for
             * nothing.
             *
             * ⚠ BELOW THE SCAN BECAUSE THE SCAN IS WHAT WRITES THE TRACE. The
             * dash window (20) strictly contains the own-press-owed window
             * (`SLASH_HIT_TICKS`, 5), so asking this first would swallow the
             * per-target rejections and leave the trace unable to say WHY a
             * body was passed over — the two rules answer different questions
             * and a reader needs both.
             */
            if (!allowDash && chosen.length > 0 && lastPressAt !== null
                && (tick + 1) - lastPressAt < ORDINARY_SWING_PERIOD) {
                trace.push({
                    tick,
                    decision: STRIKE_NONE,
                    saw: bodies.length,
                    rejected,
                    dashRefused: {
                        lastPressAt,
                        wouldPressAt: tick + 1,
                        inReach: chosen.map((c) => c.id),
                        why: `a press at tick ${tick + 1} is ${(tick + 1) - lastPressAt} `
                            + `tick(s) after mine at ${lastPressAt} and \`slashTimer\` runs `
                            + `for ${ORDINARY_SWING_PERIOD} — \`set slashing\`'s dash branch `
                            + 'has no `!slashing` term, so it would DASH: a +2 impulse '
                            + 'along travel that the preview stepper does not carry. '
                            + '`allowDash` is false, so the press is refused rather than '
                            + 'certified against a displacement the probe cannot see.',
                    },
                });
                return { held: walkHeld, decision: STRIKE_NONE };
            }
            /**
             * ⛔⛔⛔ R9 SLICE 12c — **THE `allowDash: true` ARM: A DASH IS
             * TAKEN ONLY WHERE IT IS CERTIFIED, AND REFUSED BY NAME WHERE IT
             * IS NOT** (⚖ ruling 35, the user's own: *"safety over speed, dash
             * wherever there is no reason not to"*).
             *
             * ⛓ IT IS THE SAME REFUSAL SHAPE AS THE `false` ARM ABOVE — a
             * `dashRefused` row with its `why` — because a reader auditing a
             * walk should not have to know which flag produced the silence.
             * What differs is the REASON: `false` refuses because the
             * displacement is uncertified BY POLICY; `true` refuses this one
             * because it was certified and FAILED, or could not be priced.
             *
             * ⛓ AND IT IS TAKEN AT THE AIM, for the same reason 12b′'s is: an
             * aim spends a direction key, and a tick spent aiming at a press
             * that will be refused is a tick of drift for nothing.
             */
            if (allowDash && forecast?.outcome === 'dash' && chosen.length > 0) {
                const verdict = certifyDash(state, bodies, forecast.impulse);
                if (!verdict.certified) {
                    trace.push({
                        tick,
                        decision: STRIKE_NONE,
                        saw: bodies.length,
                        rejected,
                        dashRefused: {
                            lastPressAt,
                            wouldPressAt: forecast.at,
                            inReach: chosen.map((c) => c.id),
                            uncertified: true,
                            worst: verdict.worst,
                            why: `a press at tick ${forecast.at} WOULD DASH (${forecast.why}) `
                                + `and the dash is NOT CERTIFIED: ${verdict.why}. `
                                + '`allowDash` is true, so the refusal is the '
                                + 'CERTIFICATION\'s and not the flag\'s — ⚖ ruling 35 puts '
                                + 'safety over speed, and a dash that cannot be priced is '
                                + 'refused rather than taken.',
                        },
                    });
                    return { held: walkHeld, decision: STRIKE_NONE };
                }
            }
            if (chosen.length === 0) {
                if (rejected.length > 0) {
                    trace.push({ tick, decision: STRIKE_NONE, saw: bodies.length, rejected });
                }
                return { held: walkHeld, decision: STRIKE_NONE };
            }
            const pick = chosen[0];
            aimed = {
                id: pick.id, direction: pick.direction, tick,
                dash: forecast?.outcome === 'dash',
            };
            trace.push({
                tick,
                decision: STRIKE_AIM,
                target: pick.id,
                reach: pick.reach,
                direction: pick.direction,
                saw: bodies.length,
                // ⛓ R9 slice 12c — WHAT THE PRESS THIS AIM EARNS WILL BE, so
                // a trace can answer "which rect did that scan ask with".
                // `null` when the caller supplied no slash state (the
                // `allowDash: false` arm, where the plain rect is the only one
                // a press can swing).
                pressWouldBe: forecast?.outcome ?? null,
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
         * ⛓ R9 slice 12b′: CARRIED **AND ENFORCED** — see the header. False
         * means a press that would land inside `slashTimer` is refused by
         * name; true means the caller has taken responsibility for a corridor
         * certified WITH the +2 displacement, which nothing does yet (the
         * planner-level dash primitive is slice 12c's).
         */
        get allowDash() { return allowDash; },
        /** ⛓ Read-only, for the rows that assert the refusal is not vacuous. */
        get lastPressAt() { return lastPressAt; },
    };
}

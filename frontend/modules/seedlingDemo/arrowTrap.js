/**
 * `arrowTrap.js` — THE ARROW×ENEMY FAMILY: A TRAP THAT KILLS FOR YOU.
 *
 * Region-atlas Phase 8, subtractive ladder rung R7, slice 6b. The
 * **SIXTEENTH** per-visit family, the SECOND projectile (after
 * `iceTurretBlast.js`), and the first projectile in this model that damages
 * an **ENEMY** rather than the player.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §15.7 — *"⚠ WHAT
 * SPHERE 0 STILL NEEDS — the Arrow×Enemy family"*, ruled in by the design
 * session mid-slice-6 and spec'd there with its lane table, its damage
 * arithmetic and a driven three-arm witness already on disk
 * (`scripts/procgen/probe-seedling-r7-l5-arrows.mjs`).
 *
 * Source, all read at first hand on fork `bot` @ `7514b96`:
 * `Puzzlements/ArrowTrap.as` (whole class), `Projectiles/Arrow.as` (whole
 * class), `Puzzlements/Activators.as` (whole class),
 * `Puzzlements/Button.as` (whole class), `Mobile.as:14-45,60-118`,
 * `Enemies/Enemy.as:20-28,62-118,141-181,223-245`,
 * `Enemies/Bob.as:18-42,49-102`, `Game.as:511,915,1930,2141,2202,2204`,
 * `Scenery/Tile.as:22-23`.
 *
 * ── ⛔⛔⛔ WHY THIS FAMILY EXISTS: IT IS THE GAME'S OWN FIRST WEAPON ───
 *
 * Every location in sphere 0 is behind the Sword, and both approaches to
 * L10 are weapon-shaped on their face (§15.3): a `breakablerock` that wants
 * a slash, and `lock@48,112 {5,0}` — a `tSet -1` KILL-LOCK — that wants
 * three dead `Bob`s. `Player.as:782` gates attack on `hasSword ||
 * hasGhostSword`, so a player from `new Game(0, 80, 128)` can do neither.
 *
 * The game's answer is that **the room kills for you**: L5's four
 * `arrowtrap`s and its `button@48,48` share `tSet 0`, `Arrow.as:18` lists
 * `"Enemy"` among its hitables, and `Arrow.as:52` calls `Enemy.hit`. The
 * driven three-arm probe measured it — `{5,0}` CLEARED with no weapon —
 * and this module is the model half of that measurement.
 *
 * ── ⛓⛓⛓ WHAT THE SOURCE SAYS THAT THE BRIEF'S SUMMARY DID NOT ───────
 *
 * Five things, and three of them change a number that was about to be
 * banked as a constant.
 *
 * 1. **THE VOLLEY PERIOD IS 11 TICKS, NOT 10.** `shootTimerMax` is 10 and
 *    every summary in the arc (§15.7, the probe's own header) reads that
 *    as "a volley every 10 ticks". `shoot()` fires when `shootTimer == 0`
 *    and then SETS it to 10; the ten following updates each decrement it
 *    once, and the eleventh update finds 0 and fires. ⇒ fire at T, fire at
 *    T+11. Over the probe's 260-tick hold that is 23 volleys where the
 *    old arithmetic predicted 26 — three volleys of slack nobody had.
 *    [[feedback_fencepost_in_a_rearming_timer]]
 *
 * 2. **THE TRAP'S OWN `y` IS AN INTEGER, AND `combat.js` SAID 2.5.**
 *    `ArrowTrap`'s ctor is `super(_x + Tile.w/2, _y + sprArrowTrap.height/2,
 *    …)` and the sprite is 16x5 — so the offset reads as 2.5. But
 *    `Activators(_x:int, _y:int, …)` TRUNCATES it, so the entity sits at
 *    `oel.y + 2`. Corrected in `PUZZLEMENT_HAZARDS.arrowtrap.ctor` by this
 *    slice; the same shape as trap 143 one class along — the arithmetic
 *    reads off the expression and the SIGNATURE is what decides.
 *
 * 3. **AN ARROW STOPS ON ANYTHING IT TOUCHES, INCLUDING WHAT IT CANNOT
 *    HURT.** `hitables` is `["Player","Enemy","Tree","Solid","Shield"]` and
 *    the `switch` has arms for only two of them — but the removal is
 *    `if (hits.length > 0)`, OUTSIDE the switch. So a `Tree`, a `Solid` and
 *    a `Shield` all eat an arrow, and **cover is a modelled resource here
 *    exactly as it is for the blast**. In L5 that is what makes column 3 a
 *    shadow twice over: no trap above it AND `torch@48,64` (a Solid) in it.
 *
 * 4. **THE TRAP IS NOT FREEZE-GATED AND THE ARROW IS ONLY HALF-GATED.**
 *    `ArrowTrap extends Activators extends Entity` — it is not a `Mobile`,
 *    and its `update()` tests nothing but the activation. `Game.freezeObjects`
 *    is a flag entities check for themselves (`Game.as:915` sets it; the
 *    world keeps updating), so **a trap keeps firing through a ceremony**.
 *    The arrow's MOVE is behind `mobileUpdate`'s freeze test, its HIT TEST
 *    is not — so a ceremony parks a volley in mid-air and every arrow
 *    already overlapping a body lands on the freeze's first frame. Same
 *    shape as `ICE_TURRET_BLAST`'s finding 3, opposite consequence: here
 *    the frozen frames are FREE DAMAGE rather than a free freeze.
 *
 * 5. **AN ENEMY PRESSES THE BUTTON.** `Button.hitables` is
 *    `["Player","Enemy","Solid"]`, and `set activate` calls `activateAll`
 *    UNCONDITIONALLY (only the sound is behind `_active != a`). So the
 *    group is republished every tick, and a `Bob` that wanders onto the
 *    button arms the traps with nobody standing on it. ⚠ This is the
 *    mechanism §15.1's `GROUPED_LOCK_EXCEPTIONS` refutation was about — the
 *    refutation was of a REACHABILITY premise ("the presser is reachable"),
 *    not of this; the mechanism is real and is modelled here.
 *
 * ── ⛔ THE DAMAGE, AND IT IS 1 (trap 143) ────────────────────────────
 *
 * `Enemy.hit(f:Number = 0, p:Point = null, d:Number = 1, t:String = "")`.
 * `Arrow.as:52` is `(hits[i] as Enemy).hit(v.length, new Point(x, y))` —
 * **force 5, damage 1, no type**. Against `Enemy.hitsMax` 3 that is THREE
 * landed arrows per Bob, spaced by `hitsTimerMax` 30, and the volley
 * cadence cannot shorten it: only one arrow of a volley lands while the
 * i-frames run. `stand`'s trace climbing `h0 -> h2` one at a time is the
 * receipt. This module never applies damage itself — it hands the hit to
 * `enemyDamage.enemyHit`, which owns all five of `Enemy.hit`'s gates.
 *
 * ── ⛓⛓ AND THE KNOCKBACK IS THE FORCE, WHICH MOVES THE FIGHT ────────
 *
 * `knockback(5, arrowPoint)` adds `5·(cos a, sin a)` to the body's velocity
 * with `a = atan2(bob.y - arrow.y, bob.x - arrow.x)` — an arrow overlapping
 * from ABOVE pushes the bob DOWN AND AWAY, at ten times its own 0.5
 * moveSpeed, and `Bob.update`'s `pushed` guard declines to renormalise a
 * body already faster than `moveSpeed`. So a hit body SLIDES for the ~20
 * ticks `Mobile.friction` (0.25/tick) takes to bleed 5 back to 0.5, and it
 * can slide OUT OF ITS OWN LANE. ⇒ a lane is not a trap: it is a place a
 * body has to be re-baited into. The choreography's two-phase shape (§15.3)
 * is that fact, not a stylistic choice.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────
 *
 * It is not a fight simulator and it does not decide fights. The GAME
 * adjudicates every kill this arc claims (§1.5, standing). What this gives
 * a planner is the MECHANISM — where arrows go, when, what stops them, what
 * one costs a body — plus the two geometric predicates a route needs
 * (`laneOf`, `shadowOf`) and the doctrine block that says how to use them.
 */

import { rect, rectsOverlap } from './levelWorld.js';
// ⛓ THE CTOR OFFSET IS IMPORTED, NEVER RE-TRANSCRIBED. `combat.js` is the
// census that owns every constructor offset in the game and is deliberately
// dependency-free; `chasers.js` set this precedent for `ENEMY_CLASSES` after
// R5 slice 2's headline defect was a SECOND transcription that disagreed with
// the first by eight pixels on every enemy on the map.
import { PUZZLEMENT_HAZARDS } from './combat.js';

export class ArrowTrapError extends Error {
    constructor(message) { super(message); this.name = 'ArrowTrapError'; }
}
const fail = (m) => { throw new ArrowTrapError(m); };

/** `FP.sign` — `value < 0 ? -1 : (value > 0 ? 1 : 0)` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/** AS3's `int(v)` — truncation TOWARD ZERO, which is not `Math.floor`. */
const toInt = (n) => Math.trunc(n);

/**
 * `ArrowTrap`'s constants, verbatim. Every one is a literal, a
 * `private const`, or a signature in `Puzzlements/ArrowTrap.as`.
 */
export const ARROW_TRAP = Object.freeze({
    as3: 'ArrowTrap',
    tag: 'arrowtrap',
    /** The embedded `Spritemap(imgArrowTrap, 16, 5)`. */
    sprite: Object.freeze({ w: 16, h: 5 }),
    /**
     * ⛔ THE CTOR OFFSET, AND IT IS AN INTEGER.
     *
     * `super(_x + Tile.w/2, _y + sprArrowTrap.height/2, sprArrowTrap, _t)`
     * reads as `(+8, +2.5)`, and `Activators(_x:int, _y:int, …)` truncates
     * the second one. So the entity point is `(oel.x + 8, oel.y + 2)` and
     * NOT the half pixel `combat.js` carried until this slice.
     */
    ctor: PUZZLEMENT_HAZARDS.arrowtrap.ctor,
    ctorSrc: 'ArrowTrap.as:24 `super(_x + Tile.w/2, _y + sprArrowTrap.height/2, …)` '
        + 'through `Activators(_x:int, _y:int, …)` — the int params TRUNCATE 2.5 to 2',
    /** `private const shootTimerMax:int = 10`. */
    shootTimerMax: 10,
    /**
     * ⛔⛔ THE PERIOD, AND IT IS ELEVEN. `shoot()` fires on `shootTimer == 0`
     * and re-arms to 10; the next ten updates each spend one decrement, and
     * the eleventh update finds 0 again. `shootTimerMax + 1`.
     */
    volleyPeriodTicks: 11,
    /**
     * `shootTimer:int = 0` — so an armed trap fires on its FIRST update,
     * with no wind-up at all. A trap disarmed at any point resets the timer
     * to 0 (`update`'s else arm), so re-arming also fires immediately.
     */
    initialShootTimer: 0,
    /** `FP.world.add(new Arrow(x - w/4, y - 2, …))`, `(x, …)`, `(x + w/4, …)`. */
    spawnOffsetsX: Object.freeze([-4, 0, 4]),
    spawnDY: -2,
    /** `new Point(0, 5)` — ALWAYS down, whatever `shoot` says. */
    velocity: Object.freeze({ x: 0, y: 5 }),
    /**
     * ⛔ `_shoot` IS `shootDefault`, AND IT INVERTS *WHEN*, NEVER *WHERE*.
     * `update()` is `if ((activate && !shootDefault) || (!activate &&
     * shootDefault)) shoot(); else shootTimer = 0;` — an XOR. A
     * `shoot="1"` trap fires from the level's first tick and STOPS when
     * its group is pressed.
     */
    firesWhen: 'activate XOR shootDefault',
    /**
     * ⛔ NOT A `Mobile`, so `mobileUpdate`'s freeze test never runs and
     * nothing else in the class tests `Game.freezeObjects`. A trap fires
     * through every ceremony in the game.
     */
    freezeGated: false,
    src: 'Puzzlements/ArrowTrap.as:16-63 + Puzzlements/Activators.as:9-40',
});

/**
 * `Arrow`'s constants, verbatim from `Projectiles/Arrow.as`.
 */
export const ARROW = Object.freeze({
    as3: 'Arrow',
    type: 'Arrow',
    /** `setHitbox(4, 4, 2, 2)` — a 4x4 box CENTRED on the entity point. */
    hitbox: Object.freeze({ w: 4, h: 4, originX: 2, originY: 2 }),
    /**
     * ⛔ FIVE TYPES, TWO ARMS. `Player` and `Enemy` take damage; `Tree`,
     * `Solid` and `Shield` fall to `default:` and take none — and STOP THE
     * ARROW ANYWAY, because the removal is `if (hits.length > 0)` outside
     * the switch. Cover is a resource.
     */
    hitables: Object.freeze(['Player', 'Enemy', 'Tree', 'Solid', 'Shield']),
    /** ⛔ EMPTY. `Mobile.moveY` never blocks; the hitables test is the only stop. */
    solids: Object.freeze([]),
    /** `f = 0` in the ctor — no decay, but `friction()` still runs. */
    friction: 0,
    /** `|v|` at spawn, and the `f` argument every `Enemy.hit` gets. */
    speed: 5,
    /** `(graphic as Image).alpha -= 0.1` once `die`. */
    fadeStep: 0.1,
    /**
     * ⛓ ELEVEN, not ten — `Image.set alpha` clamps to [0,1] and the test is
     * `<= 0` AFTER the subtraction, so ten subtractions leave 1.39e-16.
     * The same fencepost `MOBILE_DEATH_FADE` banks for a corpse.
     */
    fadeTicks: 11,
    /**
     * ⛔ THE OFF-WORLD BOUND IS THE LEVEL, NOT THE SCREEN.
     * `x > FP.width || x < 0 || y < 0 || y > FP.height`, and
     * `Game.as:1930-1931` writes `FP.width/height` from the loading level's
     * own `.oel` dimensions. So the bound moves per level, and it is
     * STRICT on all four sides.
     */
    bound: 'the level rect, strict: x > w, x < 0, y < 0, y > h',
    src: 'Projectiles/Arrow.as:13-74 + Mobile.as:14-45,60-118',
});

/**
 * ⛔ `Arrow.as:52` — `(hits[i] as Enemy).hit(v.length, new Point(x, y))`.
 *
 * `Enemy.hit`'s signature is `hit(f:Number = 0, p:Point = null, d:Number = 1,
 * t:String = "")`. The call passes TWO arguments, so:
 *
 *   f = v.length = 5   the KNOCKBACK FORCE
 *   p = the ARROW's own entity point (not the trap's)
 *   d = 1              the DEFAULT — the damage, and nobody wrote it
 *   t = ""             so `onlyHitBy` and the `"Fire"` gate both pass, and
 *                      `hitByDarkStuff` is set FALSE by the landing hit
 *
 * ⚠ Trap 143 lives here: `hit(5, …)` reads like five damage and is not.
 * The first two commits of slice 6 shipped the 5 and the measurement had
 * disagreed with them all along.
 */
export const ARROW_ENEMY_HIT = Object.freeze({
    force: 5,
    damage: 1,
    type: '',
    knockbackFrom: 'the arrow',
    /**
     * `Enemy.hitsMax` is 3 on the base class and `Bob` does not override it.
     * At 1 damage a Bob is a THREE-arrow body.
     */
    arrowsToKillDefaultEnemy: 3,
    /** `Enemy.hitsTimerMax` — the i-frames one landed arrow buys the body. */
    iFrameTicks: 30,
    /**
     * ⛓ SO THE FLOOR IS 60 TICKS AND THE CADENCE CANNOT BEAT IT. Hit at T,
     * the next arrow that can land is T+30, the third T+60 — three volleys
     * apart at best, and the trap fires eleven volleys in that window.
     */
    minTicksToKillDefaultEnemy: 60,
    /**
     * ⛔⛔ AND THE FORCE MOVES THE FIGHT. `knockback(5, p)` adds
     * `5·(cos a, sin a)` to `v`, `Bob.update`'s `pushed` guard declines to
     * renormalise a body already above `moveSpeed`, and `Mobile.friction`
     * bleeds 0.25/tick — so ~19 ticks of slide covering ~50 px before the
     * chase reasserts. A body CAN be knocked out of the lane that hit it.
     */
    knockbackDisplacesUpTo: 50,
    knockbackDecayTicks: 19,
    gates: Object.freeze(['hitsTimer <= 0 || hitByDarkStuff', '!Game.freezeObjects',
        'canHit', 'onlyHitBy == "" || onlyHitBy == t', 'hitByFire || t != "Fire"',
        'hits < hitsMax']),
    src: 'Projectiles/Arrow.as:51-53 + Enemies/Enemy.as:141-181,247-255',
});

/**
 * ⛓⛓⛓ R8 SLICE 3 — WHAT EACH OF THE FIVE HITABLES DOES TO AN ARROW, AND WHAT
 * THE ARROW DOES TO IT. A TOTAL PARTITION, checked against `ARROW.hitables`
 * itself by `r8Acceptance.assertArrowTargetPartition`.
 *
 * The switch in `Arrow.update` has two arms and a `default:`, and the removal
 * (`v = 0; die = true`) sits OUTSIDE it — so three of the five take no damage
 * and stop the arrow anyway. A model that priced only the damaging arms would
 * fly its arrows through cover, and in L8 cover is what decides which sandtrap
 * the ceiling can reach.
 *
 *   `damaged`          the run stages this body's whole response — `Enemy.hit`'s
 *                      gates, the i-frames, the knockback, the death animation,
 *                      the fade and the removal
 *   `stops`            the arrow dies on it; this rung models no response
 *   `priced-elsewhere` the arrow dies on it and the damage is billed by another
 *                      funnel, so billing it here would double it. ⛔ R8 SLICE
 *                      5: NO type is filed under this any more. `Player` was,
 *                      and the funnel it named did not exist — the value stays
 *                      in the vocabulary (trap 62: a control is replaced, not
 *                      deleted) and the day something is filed under it again,
 *                      the caller it names is what has to be shown.
 *
 * ⚠ THE `Enemy` ROW IS PER CLASS INSIDE THE RUN, not per type: a bridged
 * chaser is `damaged` and a static `SandTrap` is `stops` (its clear is the
 * tape's DECLARED v9 `at` row, and a second writer of one persistence slot is
 * two cost models). `R8_ARROW_ENEMY.refusedHere` carries that split with its
 * bound; this table carries the TYPE-level fact the AS3 states.
 */
export const ARROW_TARGET_DISPOSITIONS = Object.freeze({
    // ⛔ R8 SLICE 5: `damaged`, not `priced-elsewhere`. The switch has an arm
    // for `Player` and this model now bills it — see `ARROW_PLAYER_ARM` for
    // the two slices in which the row said somebody else was paying.
    Player: 'damaged',
    Enemy: 'damaged',
    Tree: 'stops',
    Solid: 'stops',
    Shield: 'stops',
});

/**
 * ⛔⛔⛔ R8 SLICE 5 — THE PLAYER ARM IS A BILL, AND THIS BLOCK USED TO SAY IT
 * WAS SOMEBODY ELSE'S.
 *
 * `Arrow.as:51` calls `Player.hit(null, v.length, new Point(x, y))` — force 5,
 * damage 1 (the default; trap 143 again), from the ARROW's own point. R7 slice
 * 6b filed that as `priced-elsewhere` and named
 * `combat.PUZZLEMENT_HAZARDS.arrowtrap` as the payer, on the reasoning that
 * two funnels for one hit is two cost models.
 *
 * **The reasoning was right and the premise was false.** `PUZZLEMENT_HAZARDS`
 * is the CENSUS — a roster of placements and their damage numbers, consulted
 * by planners — and no line of `levelRun` ever billed the player from it:
 * `applyPlayerHit`'s sources were pulse, crusher, blast, bossShot,
 * shieldBossStab, owlRock, owlGrenade, owlBody, enemy, chaser, bossLaser,
 * bossBody, and no `arrow`. So for two slices an arrow could reach the player,
 * stop dead on them and cost nothing, and every zero-hit claim in a room with
 * a ceiling was vacuous on that one channel.
 *
 * ⛓ THE GAME IS WHAT SAID SO: `r8-solve-5` came back `hits: 1` against the
 * model's 0, and the recording's own x at t=207 is `knockbackDelta`'s answer
 * for this arm and nothing else's (§13.10a / `R8_ETA_PROBE`).
 * ⇒ [[feedback_two_cost_models_must_agree]], with the second cost model
 * MISSING — a `pricedBy` that names a module is a claim about a CALLER, and
 * nobody had asked the caller.
 */
export const ARROW_PLAYER_ARM = Object.freeze({
    stops: true,
    /**
     * ⛔ THE LIVE FUNNEL, NAMED. `PUZZLEMENT_HAZARDS.arrowtrap` keeps its row
     * — it is the CENSUS's price for the placement, which is what a planner
     * reads — and `damagePricedBy` now names the caller that actually bills.
     */
    damagePricedBy: 'levelRun.applyArrowHit -> applyPlayerHit({source: "arrow"})',
    censusRow: 'combat.PUZZLEMENT_HAZARDS.arrowtrap — the PLANNER\'s price for the '
        + 'placement, and not a bill: no consumer of it damages a player',
    force: 5,
    damage: 1,
    src: 'Projectiles/Arrow.as:44-47 + Player.as `hit(e, f, p, d = 1)`',
});

/**
 * ⛓⛓ THE BUTTON, TRANSCRIBED HERE BECAUSE THE TRAP'S WHOLE STATE IS ITS
 * OUTPUT — and because two of its three facts are counter-intuitive.
 */
export const ARROW_TRAP_PRESSER = Object.freeze({
    /**
     * ⛔ AN ENEMY PRESSES IT. `Button.hitables` is
     * `["Player", "Enemy", "Solid"]`, minus anything that `is Cover`.
     */
    hitables: Object.freeze(['Player', 'Enemy', 'Solid']),
    excludes: 'Cover',
    /**
     * ⛔⛔ THE PUBLICATION IS UNCONDITIONAL AND PER TICK. `set activate`
     * calls `activateAll(this, t, activate)` on every write; only the
     * "Switch" sound is behind `_active != a`. So there is no latch and no
     * edge — the group carries the button's CURRENT state every tick.
     */
    republishesEveryTick: true,
    /**
     * ⛓ AND THE TRAP READS IT ONE TICK LATE. `Game.loadlevel` adds `button`
     * at :2202 and `arrowtrap` at :2204, `World.addUpdate` PREPENDS, so the
     * update list is reverse add order and the TRAP updates BEFORE the
     * BUTTON. The value a trap shoots on is the one the previous tick's
     * button push wrote — the same convention `stepPulsersNow` already
     * reads groups under.
     */
    trapReadsPreviousTick: true,
    src: 'Puzzlements/Button.as:16,27-61 + Game.as:2202,2204',
});

// ── the traps ────────────────────────────────────────────────────────

/**
 * One trap's live state. `x`/`y` are the ENTITY point (the roster carries
 * the placement; this carries where the arrows come from).
 */
export function createArrowTrap({ id, tag = 'arrowtrap', x, y, t, shootDefault = false }) {
    if (typeof id !== 'string' || id.length === 0) fail('createArrowTrap: id must be a string');
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createArrowTrap: ${id} entity point (${x},${y}) must be finite`);
    }
    if (!Number.isInteger(t)) fail(`createArrowTrap: ${id} t must be an integer, got ${t}`);
    return {
        id,
        tag,
        x,
        y,
        t,
        shootDefault: shootDefault === true,
        shootTimer: ARROW_TRAP.initialShootTimer,
        /** A monotonic counter, so an arrow id names its volley. */
        volleys: 0,
    };
}

/**
 * The trap's entity point from an `.oel` placement — `(+8, +2)`, with the
 * truncation applied HERE so no caller can forget it.
 */
export function arrowTrapEntityPoint(oelX, oelY) {
    return { x: toInt(oelX + ARROW_TRAP.ctor.dx), y: toInt(oelY + ARROW_TRAP.ctor.dy) };
}

/**
 * `update()`'s gate: `(activate && !shootDefault) || (!activate &&
 * shootDefault)`. An XOR, written as one so a reader can see it is one.
 */
export function arrowTrapFires(state, armed) {
    return (armed === true) !== (state.shootDefault === true);
}

/**
 * ⛓⛓⛓ THE VOLLEY — `shoot()`'s three `FP.world.add(new Arrow(...))`.
 *
 * `x - sprArrowTrap.width/4`, `x`, `x + sprArrowTrap.width/4` at `y - 2`,
 * all with `new Point(0, 5)`. `Arrow(_x:int, _y:int, _v:Point)` truncates
 * the two positions and does NOT touch the velocity.
 *
 * ⚠ THE ORDER IS THE ADD ORDER AND IT IS OBSERVABLE HERE, unlike the ice
 * turret's. `World.addUpdate` PREPENDS, so after `updateLists()` the three
 * sit `+4, centre, -4` at the head — and unlike three parallel blasts,
 * these three can land on the SAME body in the same tick, where only the
 * first through `Enemy.hit`'s i-frame gate does anything. Which one that is
 * is decided by this order.
 */
export function arrowVolley(trapId, volley, x, y) {
    const vy = ARROW_TRAP.velocity.y;
    return ARROW_TRAP.spawnOffsetsX.map((dx, k) => createArrow(
        `${trapId}#${volley}.${k}`, x + dx, y + ARROW_TRAP.spawnDY,
        ARROW_TRAP.velocity.x, vy,
    ));
}

/**
 * ONE GAME TICK of `ArrowTrap.update()`, in the game's own order.
 *
 * ```
 *   if (activate XOR shootDefault) shoot();
 *   else                           shootTimer = 0;
 *
 *   shoot(): if (shootTimer > 0) shootTimer--;
 *            else { …three Arrows…; shootTimer = shootTimerMax; }
 * ```
 *
 * ⚠ NO FREEZE GATE — see `ARROW_TRAP.freezeGated`. `frozen` is accepted and
 * deliberately ignored, with an assertion in the strata rather than a
 * silent absence, because "the model does not take that argument" and "the
 * model decided it does not matter" print the same thing.
 *
 * @param {object} state
 * @param {boolean} armed  the GROUP's published flag, from the PREVIOUS tick
 * @returns {{fired: boolean, arrows: Array}}
 */
export function stepArrowTrap(state, armed) {
    if (!arrowTrapFires(state, armed)) {
        state.shootTimer = 0;
        return { fired: false, arrows: [] };
    }
    if (state.shootTimer > 0) {
        state.shootTimer -= 1;
        return { fired: false, arrows: [] };
    }
    const arrows = arrowVolley(state.id, state.volleys, state.x, state.y);
    state.volleys += 1;
    state.shootTimer = ARROW_TRAP.shootTimerMax;
    return { fired: true, arrows };
}

// ── the arrows ───────────────────────────────────────────────────────

/** One arrow. `id` is `<trapId>#<volley>.<k>`, so a ledger names the shot. */
export function createArrow(id, x, y, vx, vy) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createArrow: ${id} spawn (${x},${y}) must be finite`);
    }
    return {
        id,
        // ⛔ `Arrow(_x:int, _y:int, …)`. Truncation toward zero, applied here.
        x: toInt(x),
        y: toInt(y),
        v: { x: vx, y: vy },
        /** `private var die:Boolean` — the FADE flag, not `Mobile.destroy`. */
        die: false,
        /** `Image.alpha`, once `die`. */
        alpha: 1,
        removed: false,
        /** What it hit, for the ledger — `null` until it hits something. */
        hitTypes: null,
    };
}

/** The 4x4 box, centred on the entity point. */
export function arrowRect(state) {
    const b = ARROW.hitbox;
    return rect(state.x - b.originX, state.y - b.originY, b.w, b.h);
}

/**
 * `Mobile.moveX`/`moveY` with `solids = []` — every sub-step is free, so
 * this is `y += v.y` ACCUMULATED IN 1 px STEPS, which is not the same
 * double as `y + v.y`. Transcribed as the loop for that reason (the
 * `iceTurretBlast` doctrine, one family on).
 */
function moveAxis(state, axis, rel) {
    const n = Math.abs(rel);
    for (let i = 0; i < n; i += 1) {
        state[axis] += Math.min(1, n - i) * fpSign(rel);
    }
}

/**
 * `Mobile.friction()` with `f = 0`: `v.normalize(max(len - 0, 0))` is an
 * exact identity, and the two zeroing tests below it are not. An arrow at
 * `(0, 5)` is untouched; an arrow whose velocity was ZEROED by a hit stays
 * zeroed, which is what makes `v.length > 0` a one-way latch.
 */
function arrowFriction(state) {
    if (Math.abs(state.v.x) < 0.05) state.v.x = 0;
    if (Math.abs(state.v.y) < 0.05) state.v.y = 0;
}

/**
 * ONE GAME TICK of `Arrow.update()`, in the game's own order.
 *
 * ```
 *   super.update()                       // Mobile.mobileUpdate
 *     if (!destroy) {                    // `destroy` is NEVER set on an Arrow
 *       if (!Game.freezeObjects) { friction(); input(); moveX(v.x); moveY(v.y); }
 *       layering();
 *     }
 *     death();                           // dead code for an Arrow
 *   if (v.length > 0) {
 *     collideTypesInto(hitables, x, y, hits);
 *     for each: "Player" -> Player.hit(null, |v|, p); "Enemy" -> Enemy.hit(|v|, p)
 *     if (hits.length > 0) { v = 0; die = true; }
 *   }
 *   if (die) { alpha -= 0.1; if (alpha <= 0) remove(this); }
 *   if (x > FP.width || x < 0 || y < 0 || y > FP.height) remove(this);
 * ```
 *
 * ⛔ THE HIT TEST IS NOT FREEZE-GATED and the FADE is not either. Only the
 * move is. See the header's finding 4.
 *
 * ⛔⛔ AND THE TEST IS AT THE POST-MOVE POSITION ONLY. The arrow travels 5 px
 * in 1 px sub-steps and `Mobile.moveY` does not collide (`solids` is empty),
 * so a target under 5 px tall in `y` is TUNNELLED. Named rather than
 * assumed safe: a `Bob` is `setHitbox(8, 8, 4, 4)` and cannot be, but
 * "nothing in this room is thin" is a claim about this room.
 *
 * @param {object} state
 * @param {object} ctx
 * @param {boolean} ctx.frozen        `Game.freezeObjects` — gates the MOVE only
 * @param {?object} ctx.bound         `{w, h}` — the LEVEL's pixel rect
 * @param {?Array}  ctx.bodies        `[{id, type, rect}]` — every hitable body
 *   whose position the CALLER holds: the player and the live `"Enemy"` bodies.
 *   In hitables order, because `collideTypesInto` walks the type list in the
 *   order it is given and `hitTypes` is a ledger a reader compares.
 * @param {?Function} ctx.coverAt     `(box) => hit|null` — the `Tree`/`Solid`/
 *   `Shield` query, INJECTED rather than imported for `chaserStep`'s own
 *   reason: cover is a property of the world being stepped and this module
 *   has no opinion about which world that is. The three cover types take no
 *   damage and stop the arrow anyway (`ARROW_TARGET_DISPOSITIONS`).
 * @returns {{hits: Array, removed: boolean}}
 */
export function stepArrow(state, ctx = {}) {
    const {
        frozen = false, bound = null, bodies = [], coverAt = null,
    } = ctx;
    if (state.removed) return { hits: [], removed: true };

    if (!frozen) {
        arrowFriction(state);
        // `Mobile.input()` is empty and `Arrow` does not override it.
        moveAxis(state, 'x', state.v.x);
        moveAxis(state, 'y', state.v.y);
    }

    // ⛔ NOT freeze-gated: `update()`'s own body sits below `super.update()`.
    const hits = [];
    if (state.v.x !== 0 || state.v.y !== 0) {
        const box = arrowRect(state);
        for (const b of bodies) {
            if (!ARROW.hitables.includes(b.type)) continue;
            if (rectsOverlap(box, b.rect)) hits.push(b);
        }
        // ⚠ COVER IS ASKED LAST because `Tree`, `Solid` and `Shield` are the
        // last three of the five hitables — and it is asked at ALL because
        // the removal is outside the switch: an arrow that meets a torch dies
        // on the torch, which is what puts L5's column 3 in shadow.
        if (coverAt) {
            const c = coverAt(box);
            if (c) {
                hits.push({
                    id: c.id ?? c.chestId ?? c.pushableId ?? c.treeId ?? c.rockId
                        ?? `${c.tag ?? 'cover'}@${c.x ?? '?'},${c.y ?? '?'}`,
                    type: c.cls?.type ?? 'Solid',
                    rect: c.rect,
                    cover: true,
                });
            }
        }
        if (hits.length > 0) {
            state.v.x = 0;
            state.v.y = 0;
            state.die = true;
            state.hitTypes = hits.map((h) => h.type);
        }
    }
    if (state.die) {
        state.alpha -= ARROW.fadeStep;
        // `Image.set alpha` clamps to [0, 1]; the test is AFTER the subtraction.
        if (state.alpha < 0) state.alpha = 0;
        if (state.alpha <= 0) state.removed = true;
    }
    // ⚠ SEPARATE `if`, NOT an `else` — an arrow can fade out and leave the
    // level on the same tick, and both removals are the same removal.
    if (bound && (state.x > bound.w || state.x < 0 || state.y < 0 || state.y > bound.h)) {
        state.removed = true;
    }
    return { hits, removed: state.removed };
}

// ── the geometry a planner asks for ──────────────────────────────────

/**
 * ⛓⛓⛓ THE LANE — the column of pixels a trap's arrows sweep.
 *
 * Three arrows at `ex - 4`, `ex`, `ex + 4`, each a 4-wide box centred on
 * its own spawn, so the swept x-interval is `[ex - 6, ex + 6)`. It starts
 * at the spawn row and runs to the level's bottom, because nothing slows an
 * arrow down.
 *
 * ⚠ HALF-OPEN, AND IT MATTERS. `rectsOverlap` is half-open on both sides,
 * so a body whose left edge is exactly `ex + 6` is NOT in the lane. A lane
 * computed with an inclusive right edge would call L5's column-3 shadow a
 * lane by two pixels.
 */
export function arrowLane(trap) {
    const b = ARROW.hitbox;
    const off = ARROW_TRAP.spawnOffsetsX;
    return Object.freeze({
        id: trap.id,
        t: trap.t,
        x0: trap.x + Math.min(...off) - b.originX,
        x1: trap.x + Math.max(...off) + (b.w - b.originX),
        fromY: trap.y + ARROW_TRAP.spawnDY,
    });
}

/**
 * Which lanes, if any, a box is inside. A body can be in TWO — L5's traps
 * are 16 px apart at rows 2 and 4 and a 12-px lane leaves a 4-px gap, but
 * a level with traps 8 apart would overlap them.
 *
 * ⚠ THE ANSWER IS A LIST, NEVER A BOOLEAN, because "is it in a lane" and
 * "how many lanes reach it" are different questions and only the second one
 * prices a fight.
 */
export function lanesOver(box, lanes) {
    return lanes.filter((l) => box.x < l.x1 && box.right > l.x0 && box.bottom > l.fromY);
}

/**
 * ⛔⛔ THE SHADOW, and it is the reason the L5 solve is two-phase.
 *
 * A body is in shadow when no lane reaches it — either because no trap
 * stands above its column (L5's column 3) or because a `Tree`/`Solid`/
 * `Shield` between the trap and the body eats every arrow first (the same
 * column's `torch@48,64`). ⇒ this takes the COVER list, because "no trap
 * above" is only half of it and a model that reported only that half would
 * call a body under a wall killable.
 *
 * @param {object} box     the body's rect
 * @param {Array}  lanes   `arrowLane` outputs
 * @param {Array}  cover   rects of every `Tree`/`Solid`/`Shield`
 * @returns {{shadowed: boolean, lanes: Array, blockedBy: Array}}
 */
export function shadowOf(box, lanes, cover = []) {
    const over = lanesOver(box, lanes);
    const blockedBy = [];
    const live = over.filter((l) => {
        // The arrow's own swept column, from the spawn row down to the body.
        const column = rect(l.x0, l.fromY, l.x1 - l.x0, box.y - l.fromY);
        if (column.bottom <= column.y) return true; // the body is at/above the trap
        const hit = cover.filter((c) => rectsOverlap(column, c));
        if (hit.length === 0) return true;
        blockedBy.push(...hit);
        return false;
    });
    return { shadowed: live.length === 0, lanes: live, blockedBy };
}

/**
 * ⛓⛓ THE PLAN'S DOCTRINE FOR A ROOM WHOSE ONLY WEAPON IS ITS CEILING.
 *
 * Written here rather than in a leg because every leg that opens a
 * kill-lock with arrows is subject to all of it, and because §15.3's
 * choreography was four measured cuts and the numbers should not have to
 * be rediscovered.
 */
export const ARROW_KILL_PLAN = Object.freeze({
    /**
     * ⛔ THE PRESSER IS SAFE ONLY WHERE NO TRAP IS. `Button`'s cell is a
     * cell like any other; L5's happens to sit in the one column with no
     * trap above it, and that is a fact about L5's authoring, not a rule.
     * A leg holding a button under a lane is standing in its own volley.
     */
    presserSafety: 'assert `lanesOver(playerBox, lanes)` is EMPTY at the hold point',
    /**
     * ⛓⛓⛓ THE TWO PHASES, AND ORDER IS WHAT MAKES IT WORK (§15.3).
     *
     *   press  arrival -> the button
     *   clear  hold — every body ALREADY in a lane dies where it stands
     *   bait   button -> a stance whose straight line pulls the survivor
     *          THROUGH a lane
     *   dwell  the survivor's travel time at its own `moveSpeed`
     *   back   the stance -> the button
     *   hold   the kill, PLUS the lock's own fade
     *
     * Press first: the traps do two thirds of the work before the player
     * is ever in the room with three chasers. The first cut of the probe
     * did it the other way and got the player killed at t=187 with nothing
     * saying so (trap 142).
     */
    phases: Object.freeze(['press', 'clear', 'bait', 'dwell', 'back', 'hold']),
    /**
     * ⛔ A CHASER HAS NO WALL TEST. `Bob.update`'s `collideLine` guard is
     * COMMENTED OUT (`Bob.as:59`), so a body steers straight at the player
     * and presses against whatever is between them for ever. That is what
     * makes a bait a bait: the stance is chosen so the STRAIGHT LINE
     * crosses a lane, not so the path does.
     */
    baitRule: 'choose the stance so the straight line from body to player crosses a lane',
    /**
     * ⛓ AND THE HOLD OUTLASTS THE KILL BY THE LOCK'S OWN FADE.
     * `Lock.activationStep` drains alpha at 0.01/update and `turnOff()`
     * writes `Game.setPersistence(tag, false)` only at the end — 100 ticks
     * after `checkEnemies()` first reads zero. A hold that stopped at the
     * kill would report a lock that was about to open.
     */
    lockFadeTicks: 100,
    /** `ARROW_ENEMY_HIT.minTicksToKillDefaultEnemy`, plus the fade, plus slack. */
    minHoldAfterBaitTicks: 160,
    /**
     * ⚠ AND THE MEASURED NUMBERS ARE A STARTING POINT, NOT CONSTANTS. They
     * were cut for the probe's boot (L4's arrival at (80,32)); a segment
     * arriving with different momentum re-plans (§15.10).
     */
    measuredL5: Object.freeze({
        stance: Object.freeze({ x: 72, y: 96 }),
        press: Object.freeze({ x: 56, y: 56 }),
        clear: 240,
        dwell: 40,
        hold: 260,
        leftPairDeadByTick: 187,
        src: 'probe-seedling-r7-l5-arrows.mjs — the `bait` arm, four cuts',
    }),
    src: 'kickoff §15.3, §15.7 + Enemies/Bob.as:49-82 + Puzzlements/Lock.as',
});

/**
 * ⛔ THE CENSUS, RE-ASSERTED — and it is the half that can rot QUIETLY.
 *
 * §15.7 ruled that `ACTIVATOR_RESPONDERS` should gain `arrowtrap`. It
 * cannot, and the reason is structural rather than stylistic:
 *
 *   1. `ACTIVATOR_RESPONDERS` is the set whose SOLIDITY answers to a group,
 *      and `buildLevelWorld` only consults it INSIDE the branch that has
 *      already built a `solid`. `arrowtrap` is `notSolid` — `ArrowTrap`
 *      never calls `setHitbox` and never assigns a `type` — so the entry
 *      would be unreachable code.
 *   2. `activators.test.js` pins `ACTIVATOR_RESPONDERS` as exactly
 *      `keys(RESPONDERS) ∪ keys(KEY_RESPONDERS)`, and both of those carry
 *      an opening FADE. A trap has no fade and no open state; it has a
 *      firing state.
 *
 * ⇒ the trap joins the PULSER lane, which exists for exactly this shape:
 * an `Activators` with a `t` whose activation changes what it DOES rather
 * than whether it blocks (§21.65 — *"a pulser group's EFFECT is a different
 * observable"*). The census the ruling wanted is re-asserted here instead,
 * against the map extract: every `arrowtrap` in the game, its group, and
 * whether it is `shootDefault`.
 *
 * ⚠ FIVE LEVELS, ELEVEN TRAPS, AND TWO SENSES. L4/L5/L8 are `shoot="0"`
 * (fire when pressed); L16 and L67 are `shoot="1"` (fire until pressed).
 * A model that had only ever seen L5 would have the sense backwards for
 * four of the eleven.
 */
export const ARROW_TRAP_CENSUS = Object.freeze({
    4: Object.freeze([
        Object.freeze({ x: 48, y: 16, t: 0, shootDefault: false }),
        Object.freeze({ x: 64, y: 16, t: 0, shootDefault: false }),
    ]),
    5: Object.freeze([
        Object.freeze({ x: 32, y: 48, t: 0, shootDefault: false }),
        Object.freeze({ x: 64, y: 48, t: 0, shootDefault: false }),
        Object.freeze({ x: 16, y: 16, t: 0, shootDefault: false }),
        Object.freeze({ x: 80, y: 16, t: 0, shootDefault: false }),
    ]),
    8: Object.freeze([
        Object.freeze({ x: 96, y: 16, t: 0, shootDefault: false }),
    ]),
    16: Object.freeze([
        Object.freeze({ x: 96, y: 32, t: 0, shootDefault: true }),
        Object.freeze({ x: 112, y: 32, t: 0, shootDefault: true }),
        Object.freeze({ x: 128, y: 32, t: 0, shootDefault: true }),
    ]),
    67: Object.freeze([
        Object.freeze({ x: 48, y: 48, t: 0, shootDefault: true }),
    ]),
});

/**
 * The census as a claim rather than a comment: re-derive it from a level
 * source and refuse if the map has moved. `levelSource` is the same
 * `(n) => record` every other consumer takes.
 *
 * ⚠ IT CHECKS BOTH DIRECTIONS. A level that GAINED a trap and a level that
 * LOST one are different defects and a one-sided check finds only the first.
 */
export function assertArrowTrapCensus(levelSource, levels = null) {
    const want = ARROW_TRAP_CENSUS;
    const scan = levels ?? Array.from({ length: 116 }, (_, i) => i);
    const found = {};
    for (const n of scan) {
        let rec = null;
        try { rec = levelSource(n); } catch { continue; }
        if (!rec) continue;
        const traps = (rec.entities ?? [])
            .filter((e) => (e.name ?? e.type) === ARROW_TRAP.tag);
        if (traps.length === 0) continue;
        found[n] = traps.map((e) => ({
            x: e.x,
            y: e.y,
            t: Number(e.attrs?.tset ?? 0),
            shootDefault: Boolean(Number(e.attrs?.shoot ?? 0)),
        }));
    }
    const key = (o) => `${o.x},${o.y} t=${o.t} shootDefault=${o.shootDefault}`;
    const seen = Object.keys(found).sort((a, b) => a - b).join(' ');
    const expect = Object.keys(want).sort((a, b) => a - b).join(' ');
    if (seen !== expect) {
        fail(`assertArrowTrapCensus: the levels holding arrowtraps moved — expected `
            + `[${expect}], found [${seen}]. The census is a claim about the map, so a `
            + 'level that gained or lost one is a finding and not a mismatch to widen.');
    }
    for (const n of Object.keys(want)) {
        const a = want[n].map(key).sort();
        const b = (found[n] ?? []).map(key).sort();
        if (a.join(' | ') !== b.join(' | ')) {
            fail(`assertArrowTrapCensus: level ${n}'s traps moved — expected `
                + `[${a.join(' | ')}], found [${b.join(' | ')}].`);
        }
    }
    return found;
}

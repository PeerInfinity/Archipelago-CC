/**
 * `wandVerb.js` — THE WAND AS A WEAPON, AND A VERB WITH NO TIMER FIELD.
 *
 * Region-atlas Phase 8, subtractive ladder rung **R6, slice 2**. The wand
 * has been an ITEM since R5 (`r5Totem`'s pickup, the tset-0 publisher that
 * seals its own exit) and a `useItem` arm `levelRun` REFUSED by name. This
 * is the verb.
 *
 * Brief: `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4 slice 2,
 * §2.3 (superseded in three places — see below), §8.2 (the anim clock
 * table, CANONICAL) and §8.16 (the corrections).
 * Source, all read at first hand on fork `bot` @ `a9f84ab`:
 * `Player.as:166-167` (`_wanding`, `wandSpeed`), `:414-422` (the two wand
 * sprites' `add()`), `:827-849` (`wanding`'s getter/setter), `:992-1001`
 * (`wand()`), `:1054-1058` (`wandEnd`), `:1573-1611` (`useItem`),
 * `:1614-1622` (`sprites()`), `:476-583` (`update`'s order),
 * `net/flashpunk/graphics/Spritemap.as:70-101` (`update`), `:118-140`
 * (`play`), `net/flashpunk/World.as:47-61` (the update pass),
 * `Projectiles/WandShot.as` (whole class — modelled in `wandShot.js`).
 *
 * ── ⛔⛔⛔ THERE IS NO `wandTimer`, AND THE CADENCE IS AN ACCUMULATOR ───
 *
 * The rate limiter is the `_wanding` boolean plus a 5-frame animation at
 * `frameRate` 20, and `Spritemap.update` advances
 * `_timer += _anim._frameRate * FP.elapsed * rate`. At the runtime's
 * clamped `FP.elapsed = 0.0333` (`Engine.as:270` — the decimal literal,
 * **not** `1/30`) the step is `0.666` frames per update, so the wrap needs
 * **eight** updates. A 60 fps reading gives fifteen and is WRONG; §8.2
 * derived eight and this module re-derives it through `fireVerb`'s own
 * `animTimeline`, which is the loop rather than a division.
 * [[feedback_accumulate_dont_divide_the_fade]] and §19's
 * `FIRE_PRESS_CADENCE` precedent, second customer.
 *
 * ── ⛔⛔ §2.3's GATE IS A THREE-TERM PARAPHRASE OF A FIVE-TERM `if` ────
 *
 * The brief says *"`wanding`'s setter is gated on `!slashing && !firing &&
 * !spearing`"*. `Player.as:834` is
 *
 * ```
 *   if ((hasWand || hasFireWand) && !slashing && (!firing || hasFireWand)
 *       && !deathRaying && !spearing)
 * ```
 *
 * — the item test is missing from the paraphrase, `deathRaying` is missing,
 * and the `firing` term is CONDITIONAL. §8.16 caught it; `canStartWanding`
 * is the five-term version and `WAND_GATE_TERMS` is the table a test walks.
 *
 * ⛓ **AND THE SETTER GATES THE CLEAR TOO.** `wandEnd()` is `wand();
 * wanding = false;` and `false` goes through the SAME setter — so a state
 * in which the gate is shut cannot drop `_wanding` either. On this rung's
 * honest path that never bites, and the reason is an argument rather than
 * an accident: while `_wanding` is up, `set slashing`, `set spearing` and
 * `set deathRaying` all test `!wanding` and refuse, and `set firing` needs
 * `!wanding || hasFireWand`, which a plain-wand run cannot satisfy. So the
 * gate is open at every `wandEnd` a plain wand can reach.
 * `assertClearIsReachable` says that out loud rather than assuming it.
 *
 * ── ⛓⛓⛓ DIRECTION IS READ AT FIRE TIME — AND THAT IS ONE TICK STALE ──
 *
 * `wand()` runs from `wandEnd`, which is `sprWand`'s callback, which fires
 * inside `sprites()`. And `sprites()` is:
 *
 * ```
 *   slashingSprite.update(); sprSpear.update();
 *   sprWand.update();        // <- wandEnd -> wand() reads `direction` HERE
 *   sprDeathRay.update(); sprFire.update(); sprFireWand.update();
 *   if (directionFace >= 0) direction = directionFace; else { ...from v... }
 * ```
 *
 * ⇒ the shot's direction is the value `sprites()` wrote at the END OF THE
 * PREVIOUS TICK — i.e. exactly `levelRun`'s `pressFacing` convention, taken
 * at the START of the fire tick and not at the start of the press tick.
 * "At fire time, not press time" is right and it is not "this tick's
 * facing": a walk that turns on the fire tick itself still shoots the old
 * way. `WAND_FACING_RULE` carries it.
 *
 * ⛓ The POSITION is the opposite: `sprites()` runs AFTER `super.update()`,
 * so `wand()` reads the position this tick's sweeps just wrote. One call,
 * two different tick conventions, and the asymmetry is the `sprites()`
 * line order.
 *
 * ⚠ AND IT IS READ BEFORE `Player.update`'s FINAL CLAMP. `x = min(max(x,
 * originX), FP.width + originX - width)` runs BELOW `sprites()`, so a shot
 * fired while the player is pinned against a level edge spawns off the
 * PRE-clamp position. `wandShotSpawn` takes whatever it is handed and
 * `assertSpawnUnclamped` is how a caller declares it checked.
 *
 * ── ⛓⛓ THE EPSILON TERMS ARE LOAD-BEARING, AND THE TRUNCATION EATS ONE ─
 *
 * `a = direction * Math.PI / 2` and the two vectors are built with `cos`
 * and `sin` of that, so a "cardinal" direction is cardinal only up to
 * `cos(PI/2) = 6.12e-17`:
 *
 * ```
 *   right  v = ( 3,        -0      )   spawn off = ( 16,        -0       )
 *   up     v = ( 1.837e-16, -3     )               ( 9.797e-16, -16      )
 *   left   v = (-3,        -3.674e-16)             (-16,        -1.959e-15)
 *   down   v = (-5.511e-16, 3      )               (-2.939e-15,  16      )
 * ```
 *
 * ⛔ **AND `WandShot`'s CONSTRUCTOR TAKES `_x:int`**, so the spawn point is
 * TRUNCATED toward zero after the offset is added. For the two directions
 * whose x-offset is NEGATIVE the epsilon can cross an integer boundary
 * downwards: at `px = 18`, `18 - 16 - 1.959e-15` is `1.9999999999999980`
 * and `int()` gives **1**, not 2. It bites while the pre-truncation value
 * is an exact integer whose ulp/2 is smaller than the epsilon — i.e. below
 * 32 for both negative cases — and `WAND_SPAWN_EPSILON_BITES` pins the
 * measured boundary rather than describing it. Rounding the epsilon away
 * would delete a real one-pixel shift near a level's west and north walls.
 *
 * ── ⛓ `sprWand.width` IS USED FOR BOTH WANDS ─────────────────────────
 *
 * `wand()` reads `sprWand.width` (16) even when it is spawning a FireWand
 * shot from `sprFireWand` (17). Transcribed, not corrected: the fire wand
 * is not on this rung's honest path and the source is unambiguous.
 */

import { FP_MAX_ELAPSED } from './breakableRocks.js';
import { animTimeline } from './fireVerb.js';

export class WandVerbError extends Error {
    constructor(message) { super(message); this.name = 'WandVerbError'; }
}
const fail = (m) => { throw new WandVerbError(m); };

/**
 * AS3's `int(v)` — truncation TOWARD ZERO, which is not `Math.floor`.
 *
 * ⚠ AND AS3's `int` IS A 32-BIT SIGNED INTEGER, so it has no `-0`:
 * `int(-0.5)` is `0`, where `Math.trunc(-0.5)` is `-0`. The two differ
 * under `Object.is` and nowhere else this model reads — normalised anyway,
 * because a state field that is sometimes `-0` makes an equality-based
 * fixture diff report a change that is not one.
 * (A left shot from a player at `x < 16` is the reachable case: the spawn
 * point goes negative and the fraction lands in `(-1, 0)`.)
 */
const toInt = (n) => {
    const t = Math.trunc(n);
    return t === 0 ? 0 : t;
};

/** `Player.wandSpeed` (`Player.as:167`). */
export const WAND_SPEED = 3;

/**
 * `sprWand` / `sprFireWand`, from the two `Spritemap` constructions and the
 * four lines that configure each (`Player.as:48-51`, `:414-422`).
 *
 * ⚠ `originY = 8` with `y = -8` is the wand's DRAW offset and is read by
 * nothing this model needs; `width` is the one field `wand()` consumes, and
 * it consumes `sprWand`'s for both wands (header note).
 */
export const WAND_SPRITE = Object.freeze({
    w: 16, h: 10, originX: 0, originY: 8, anim: 'wand',
    frames: Object.freeze([0, 1, 2, 3, 4]), frameCount: 5, frameRate: 20, loop: true,
});

export const FIRE_WAND_SPRITE = Object.freeze({
    w: 17, h: 10, originX: 0, originY: 8, anim: 'wand',
    frames: Object.freeze([0, 1, 2, 3, 4]), frameCount: 5, frameRate: 20, loop: true,
});

/**
 * ⛔ THE OFFSET `wand()` ACTUALLY USES, both wands. `Player.as:997` reads
 * `sprWand.width` and nothing else; the fire wand's 17 is never consulted.
 */
export const WAND_SPAWN_REACH = WAND_SPRITE.w;

/**
 * `Spritemap.update` at the clamped elapsed, simulated — never divided.
 * `fireVerb.animTimeline` is the loop; sharing it is what makes "the wand
 * and the fire meter agree about `Spritemap`" a fact rather than a hope.
 */
export const WAND_TIMELINE = Object.freeze(animTimeline(WAND_SPRITE, FP_MAX_ELAPSED, 24));

/**
 * The press -> shot map, DERIVED.
 *
 * `fireUpdate` is the update index on which `sprWand`'s callback runs and
 * therefore the index on which the shot is created. Update `k` runs in
 * `sprites()` at the END of tick `T + (k - 1)` — the press tick's own
 * `sprites()` is update 1, because `set wanding` calls `play("wand", true)`
 * from inside `input()`, which is inside `super.update()`, which is ABOVE
 * `sprites()` in `Player.update`.
 *
 * ⇒ `fireTick` is an offset from the press tick T, and the `FP.world.add`
 * it performs is DEFERRED to `updateLists()` — so the shot's first own
 * update is `fireTick + 1`. Both numbers are here because a window that
 * conflates them is one tick wrong about where the shot is.
 */
function deriveWandWindow() {
    const { callbackUpdates, frames } = WAND_TIMELINE;
    const wrapUpdate = callbackUpdates[0];
    if (wrapUpdate === undefined) fail('deriveWandWindow: the wand animation never wrapped');
    if (frames[0] !== 0) {
        fail('deriveWandWindow: `play("wand", true)` is supposed to leave `_index = 0`; the '
            + `timeline starts at ${frames[0]}, so \`Spritemap.play\` was misread.`);
    }
    return Object.freeze({
        /** `Spritemap.update` call index on which `wandEnd` fires. §8.2: 8. */
        wrapUpdate,
        /** Offset from the press tick T of the tick whose `sprites()` fires it. */
        fireTick: wrapUpdate - 1,
        /**
         * Offset from T of the shot's FIRST own `update()`. `FP.world.add`
         * appends to `_add` and `updateLists()` runs after `World.update`,
         * so the entity does not exist for the pass that created it.
         */
        firstShotUpdateTick: wrapUpdate,
        /**
         * The tick whose `sprites()` drops `_wanding`. Same tick as the
         * fire — `wandEnd` is `wand(); wanding = false;` in that order, and
         * `wand()`'s own `if (wanding)` is what makes the order matter.
         */
        endTick: wrapUpdate - 1,
        frames: Object.freeze([...frames]),
    });
}

export const WAND_WINDOW = deriveWandWindow();

/**
 * The gap between two presses that BOTH fire a shot.
 *
 * ⚠ EXACTLY THE FIRE VERB'S SHAPE AND FOR THE SAME REASON. `useItem`'s wand
 * arm is `if (!wanding) wanding = true`, and it runs inside `input()` —
 * inside `super.update()` — which is ABOVE the `sprites()` that clears
 * `_wanding`. So a press ON `endTick` reads `_wanding` still true and is
 * swallowed SILENTLY; the first tick a second press takes is `endTick + 1`.
 *
 * ⛔ AND IT IS NOT THE KILL CADENCE. Eight ticks is what the PLAYER's
 * animation allows; what one ENEMY absorbs is its own `hitsTimer`
 * (`combatVerbs.KILL_PRESS_CADENCE` = 31 for the generic 30, and
 * `BossTotem`'s own 20). A ten-shot schedule against one body is paced by
 * the body, not by this.
 */
export const WAND_PRESS_CADENCE = WAND_WINDOW.endTick + 1;

/**
 * ⛔ `set wanding`'s five terms (`Player.as:834`), as data.
 *
 * `need` is the value the term must have for the gate to OPEN. The
 * `firing` row is the one §2.3 dropped: it is `(!firing || hasFireWand)`,
 * so it is not a plain `!firing` and cannot be tabulated as one — it
 * carries its own predicate.
 */
export const WAND_GATE_TERMS = Object.freeze([
    Object.freeze({
        term: '(hasWand || hasFireWand)',
        why: 'the ITEM test §2.3 dropped — a slot can hold the wand only because the '
            + 'player has it, so this and the slot say the same thing on the honest path',
    }),
    Object.freeze({ term: '!slashing', why: 'the sword and the wand share the body' }),
    Object.freeze({
        term: '(!firing || hasFireWand)',
        why: '⛔ CONDITIONAL. A FireWand press sets BOTH (`useItem` case 5), so the two '
            + 'flags are up together by design and the gate must not refuse itself.',
    }),
    Object.freeze({ term: '!deathRaying', why: '§2.3 dropped this one too' }),
    Object.freeze({ term: '!spearing', why: '' }),
]);

/**
 * `set wanding`'s gate, transcribed term for term.
 *
 * ⚠ Used for BOTH edges. `wandEnd`'s `wanding = false` goes through the
 * same setter, so a caller asking "will the clear land" asks this too —
 * see `assertClearIsReachable`.
 */
export function canStartWanding({
    hasWand = false, hasFireWand = false, slashing = false,
    firing = false, deathRaying = false, spearing = false,
} = {}) {
    return (hasWand || hasFireWand) && !slashing && (!firing || hasFireWand)
        && !deathRaying && !spearing;
}

/**
 * ⛓ THE ARGUMENT THAT THE CLEAR CANNOT STICK, as an assertion.
 *
 * While `_wanding` is up: `set slashing` (`:782`), `set spearing` (`:815`)
 * and `set deathRaying` (`:882`) each test `!wanding` and refuse, and `set
 * firing` (`:858`) tests `(!wanding || hasFireWand)`. So on a plain-wand
 * run the only way into the gate-shut state is to have LOST the item
 * mid-animation, which nothing in the game does.
 *
 * @param {object} equip `{hasWand, hasFireWand}` — the run's inventory
 * @returns {true} or throws with the term that would trap `_wanding`
 */
export function assertClearIsReachable(equip = {}) {
    const { hasWand = false, hasFireWand = false } = equip;
    if (!hasWand && !hasFireWand) {
        fail('assertClearIsReachable: neither wand is held, so `set wanding` refuses the '
            + 'RISE as well as the fall and no window can open at all. A run that lost '
            + 'the item mid-animation would strand `_wanding` up for ever — named here '
            + 'because the trap is the setter gating BOTH edges, not just the press.');
    }
    // The other four terms are unreachable while `_wanding` is true, by the
    // four setters' own `!wanding` tests. Asserted as a tautology over the
    // gate rather than as prose: with every other flag false (which is what
    // those tests enforce), the gate must be open.
    if (!canStartWanding({ hasWand, hasFireWand })) {
        fail('assertClearIsReachable: the gate is shut with every mutually-exclusive flag '
            + 'down, which means `canStartWanding` and `WAND_GATE_TERMS` disagree.');
    }
    return true;
}

/**
 * ⛓⛓⛓ WHICH TICK'S FACING THE SHOT CARRIES — the header's third finding,
 * as a declaration a test can walk.
 */
export const WAND_FACING_RULE = Object.freeze({
    readAt: 'fire',
    /**
     * `sprites()` updates `sprWand` BEFORE it recomputes `direction`, so
     * `wand()` sees the value the PREVIOUS tick's `sprites()` wrote.
     */
    staleByTicks: 1,
    /** …which is exactly `levelRun`'s existing convention for a press. */
    equivalentTo: 'state.direction captured at the START of the fire tick',
    src: 'Player.as:1614-1622 (`sprites()` line order) + :992-1001 (`wand()`)',
});

/**
 * FlashPunk's direction encoding, and the exact vectors `wand()` builds.
 *
 * ⚠ THE VALUES ARE COMPUTED, NOT TYPED. Writing `1.837e-16` as a literal
 * would be a transcription of a PRINTOUT; `3 * Math.cos(d * Math.PI / 2)`
 * is a transcription of the line. The test pins the printed values against
 * this so a refactor that "tidied" them away fails loudly.
 */
export const WAND_DIRECTIONS = Object.freeze([0, 1, 2, 3].map((d) => {
    const a = d * Math.PI / 2;
    return Object.freeze({
        direction: d,
        name: ['right', 'up', 'left', 'down'][d],
        vx: WAND_SPEED * Math.cos(a),
        vy: -WAND_SPEED * Math.sin(a),
        offsetX: WAND_SPAWN_REACH * Math.cos(a),
        offsetY: -WAND_SPAWN_REACH * Math.sin(a),
    });
}));

function requireDirection(direction, where) {
    if (!Number.isInteger(direction) || direction < 0 || direction > 3) {
        fail(`${where}: direction must be 0..3 (0 right, 1 up, 2 left, 3 down), got `
            + `${direction}. \`Player.direction\` is an int initialised to 3 and written `
            + 'only by `sprites()` and `directionFace`, so an out-of-range value is a '
            + 'model defect rather than an input to clamp.');
    }
}

/**
 * `new Point(wandSpeed * cos(a), -wandSpeed * sin(a))` — `Player.as:998`.
 *
 * ⚠ The epsilon components are NOT zero and must not be rounded. They
 * survive into `Mobile.moveX`/`moveY`, whose loop condition is
 * `i < Math.abs(rel)` — true for `i = 0` at 1.8e-16 — so a "cardinal" shot
 * runs a sub-pixel collision probe on its OTHER axis every update. See
 * `wandShot.stepWandShot`, which is where that probe can stop a shot the
 * geometry only grazes.
 */
export function wandShotVelocity(direction) {
    requireDirection(direction, 'wandShotVelocity');
    const { vx, vy } = WAND_DIRECTIONS[direction];
    return { vx, vy };
}

/**
 * `new Point(x + sprWand.width * cos(a), y - sprWand.width * sin(a))` then
 * `new WandShot(pos.x, pos.y, …)` with `_x:int, _y:int` — `Player.as:997-999`
 * and `Projectiles/WandShot.as:35`.
 *
 * @param {number} direction  0..3
 * @param {number} px  the player's ENTITY x at the fire tick, PRE-clamp
 * @param {number} py  ditto y
 * @returns {{x:number, y:number, exactX:number, exactY:number}} the
 *   truncated spawn point and the pre-truncation values, because the
 *   difference between them is the finding (`WAND_SPAWN_EPSILON_BITES`) and
 *   a caller that only got the answer could not see it.
 */
export function wandShotSpawn(direction, px, py) {
    requireDirection(direction, 'wandShotSpawn');
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
        fail(`wandShotSpawn: px/py must be finite, got (${px}, ${py})`);
    }
    const { offsetX, offsetY } = WAND_DIRECTIONS[direction];
    const exactX = px + offsetX;
    const exactY = py + offsetY;
    return { x: toInt(exactX), y: toInt(exactY), exactX, exactY };
}

/** The next double BELOW `n` — for the "just under an integer" probe. */
function prevDouble(n) {
    const buf = new Float64Array(1);
    const bits = new BigInt64Array(buf.buffer);
    buf[0] = n;
    bits[0] += n > 0 ? -1n : 1n;
    return buf[0];
}

/**
 * ⛔ WHERE ROUNDING THE EPSILON AWAY CHANGES `int()`, MEASURED.
 *
 * The counterfactual is explicit: a model that wrote `-16` and `0` instead
 * of the computed offsets would use `Math.round(off)`. This walks both
 * candidate player coordinates and reports where the two answers differ.
 *
 * ⚠ **BOUNDED, AND THE BOUND IS NAMED.** Two families of base value are
 * swept, integers `0..1024` (every whole pixel a level can hold — the
 * largest room in the game is well inside that) and the double one ulp
 * BELOW each of those integers (which is where a POSITIVE epsilon can
 * cross a boundary upward). A player coordinate that is neither is not
 * covered; the physics produces plenty of them, and the finding is about
 * the two families that are reachable at rest and on a clean axis.
 */
function measureEpsilonBites() {
    const out = {};
    for (const d of WAND_DIRECTIONS) {
        for (const [axis, off] of [['x', d.offsetX], ['y', d.offsetY]]) {
            // What a model that "tidied" the epsilon away would have used.
            const rounded = Math.round(off);
            let onIntegers = null;
            let justBelowIntegers = null;
            for (let n = 0; n <= 1024; n += 1) {
                if (Math.trunc(n + off) !== Math.trunc(n + rounded)) onIntegers = n;
                if (n > 0) {
                    const b = prevDouble(n);
                    if (Math.trunc(b + off) !== Math.trunc(b + rounded)) justBelowIntegers = n;
                }
            }
            out[`${d.name}.${axis}`] = Object.freeze({
                offset: off, rounded, onIntegers, justBelowIntegers,
            });
        }
    }
    return Object.freeze(out);
}

/**
 * The boundary, as data. Per axis: the offset, the value a rounding model
 * would have used, and the LARGEST base of each swept family at which the
 * two disagree (`null` = never, inside the bound above).
 *
 * ⛓ The disagreements are exactly on the axes carrying a signed epsilon —
 * the four clean `±16`/`∓0` axes agree everywhere, which is the negative
 * half of the finding and is asserted rather than left implied.
 */
export const WAND_SPAWN_EPSILON_BITES = measureEpsilonBites();

/**
 * ⚠ THE PRE-CLAMP READ, as a caller's declaration.
 *
 * `Player.update` clamps x and y to the level rect AFTER `sprites()`, so
 * the position `wand()` reads can be outside it. A window that fires while
 * the player is pinned owes the pre-clamp value; every other window can
 * hand over the observed one and say so.
 *
 * @param {object} pre   `{x, y}` the position `sprites()` saw
 * @param {object} post  `{x, y}` the position the tick's clamp left
 */
export function assertSpawnUnclamped(pre, post, where = 'a wand window') {
    if (pre.x !== post.x || pre.y !== post.y) {
        fail(`${where}: the fire tick's final clamp MOVED the player from (${pre.x}, `
            + `${pre.y}) to (${post.x}, ${post.y}), and \`wand()\` reads the PRE-clamp `
            + 'value (`sprites()` runs above the clamp in `Player.update`). Hand '
            + '`wandShotSpawn` the pre-clamp position, or move the stance off the level '
            + 'edge.');
    }
    return true;
}

/**
 * The whole press, as one record — the shape a window schedules from.
 *
 * @param {number} pressTick  the tick `Input.pressed(keys[4])` fires on
 * @param {number} direction  the facing at the START of the FIRE tick
 *   (`WAND_FACING_RULE`), which the caller supplies because only the run
 *   knows it — a press-tick facing here is the one-tick error the rule names
 * @param {object} at  `{x, y}` the player's PRE-clamp entity position on
 *   the fire tick
 */
export function wandPress(pressTick, direction, at, { fire = false } = {}) {
    if (!Number.isInteger(pressTick) || pressTick < 0) {
        fail(`wandPress: pressTick must be a non-negative integer, got ${pressTick}`);
    }
    requireDirection(direction, 'wandPress');
    const fireTick = pressTick + WAND_WINDOW.fireTick;
    const spawn = wandShotSpawn(direction, at.x, at.y);
    const { vx, vy } = wandShotVelocity(direction);
    return Object.freeze({
        pressTick,
        fireTick,
        endTick: pressTick + WAND_WINDOW.endTick,
        firstShotUpdateTick: pressTick + WAND_WINDOW.firstShotUpdateTick,
        nextPressTick: pressTick + WAND_PRESS_CADENCE,
        direction,
        fire,
        spawn: Object.freeze(spawn),
        v: Object.freeze({ vx, vy }),
    });
}

/**
 * ⛔ THE FREEZE SPLIT, and it is not the one `Player.input` draws.
 *
 * `Mobile.mobileUpdate` gates `friction/input/moveX/moveY` on
 * `Game.freezeObjects`, and `useItem` lives inside `input()` — so a PRESS
 * during a ceremony is lost, exactly like the `frozenTimer` case
 * `levelRun` already refuses by name. But `sprites()` is in
 * `Player.update`'s own body BELOW `super.update()` and is gated by
 * NOTHING, so an animation already in flight KEEPS ADVANCING and
 * `wandEnd()` fires its shot mid-ceremony.
 *
 * ⇒ a freeze that opens between the press and the wrap does not delay the
 * shot; it delays nothing at all. And the shot it produces flies (see
 * `wandShot` — `WandShot.update` overrides `Mobile.update` and never
 * consults `Game.freezeObjects`) and can be SPENT: `Enemy.hit`'s own guard
 * is `!Game.freezeObjects`, so a shot that reaches a frozen enemy deals
 * nothing and still dies on contact.
 * [[feedback_freeze_gates_are_not_uniform]], one class further on.
 */
export const WAND_FREEZE_SPLIT = Object.freeze({
    pressBlocked: true,
    animAdvances: true,
    shotFires: true,
    shotMoves: true,
    shotDamages: false,
    src: 'Mobile.as:31-45 + Player.as:566-583 + Projectiles/WandShot.as:78-108 '
        + '+ Enemies/Enemy.as:147',
    why: 'four gates on one flag, and only two of them close. A ten-shot schedule that '
        + 'crosses a ceremony loses the shots it spends inside one, silently.',
});

/**
 * The mixed-window law, carried rather than re-derived.
 *
 * A window that presses BOTH the wand and the sword at one enemy is paced
 * by `combatVerbs.KILL_PRESS_CADENCE` (31), not by `WAND_PRESS_CADENCE`
 * (8): the enemy's `hitsTimer` is what refuses, and both weapons set it.
 * The wand's own eight is a floor on the PLAYER side only.
 */
export const WAND_MIXED_WINDOW_LAW = Object.freeze({
    playerCadence: WAND_PRESS_CADENCE,
    perBodyCadenceIsTheEnemys: true,
    src: 'Enemies/Enemy.as:141-181 (`hitsTimer <= 0`) + combatVerbs.KILL_PRESS_CADENCE',
});

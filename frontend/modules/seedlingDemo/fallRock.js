/**
 * seedlingDemo/fallRock — THE ROCK THE ROPE DROPS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 10, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §23.
 *
 * ── WHY THIS EXISTS: A MODEL SAID "no-op" AND THE GAME WROTE THE FLAG ──
 *
 * `r5Totem.GROUP_6` argued, at length and with citations, that the rope's
 * publication cannot arm `fallrock@144,624`. Two gates, it said, either one
 * sufficient:
 *
 *   1. the constructor parks it at `y = -16` with `type = ""` unless
 *      `!Game.checkPersistence(tag)`, and its tag is 10, *which nothing on
 *      this route writes*;
 *   2. `update()`'s position-writing arm is `if (activate && y >= fallTo)`,
 *      and a parked rock has `y = -16` against `fallTo = 632` — so even
 *      with `activate` published TRUE the arm is unreachable, and the whole
 *      falling branch below it is behind `!checkPersistence(tag)`, which is
 *      the same flag again.
 *
 * Every sentence of that is true about `update()`. **It is an argument
 * about the wrong function.** `FallRock` overrides `set activate`:
 *
 * ```
 *   override public function set activate(a:Boolean):void
 *   {
 *       if (a && !_active) { fall(); _active = a; }
 *   }
 *   public function fall():void
 *   {
 *       Game.setPersistence(tag, false);   // ⛔ THE FLAG, AT TRIGGER TIME
 *       trigger = true;
 *       Game.freezeObjects = true;
 *       waitToFallTimer = waitToFallTimerMax;
 *   }
 * ```
 *
 * ⛔⛔ **THE PUBLICATION IS NOT A READ OF THE FLAG — IT IS THE WRITE OF
 * IT.** `fall()` clears tag 10 itself, so by the time `update()` runs, its
 * `!Game.checkPersistence(tag)` gate is open *because the setter opened
 * it*, and `trigger && y < fallTo` is `true && -16 < 632`. Both of
 * `GROUP_6`'s independent gates are opened by the same line, which is why
 * having two of them read as safety and was not any.
 * [[feedback_two_gates_one_opener]] — and see
 * [[feedback_capability_lights_up_two_controls]] for the same shape from
 * the other side.
 *
 * ⛓⛓ **AND IT IS AN IDIOM, NOT AN ACCIDENT.** Three `RopeStart`s exist in
 * the whole game and **two of them publish to a `FallRock`** — L28's
 * `rope@160,64 {t 1}` reaches `fallrock@112,240 {tag 1}`, L39's
 * `rope@96,384 {t 6}` reaches this one. Pull the rope, drop the rock: that
 * is what the mechanism is FOR. The model read the pair as a coincidence
 * for four slices.
 *
 * ── WHAT A ROUTE PAYS FOR IT ──────────────────────────────────────────
 *
 * `fall()` freezes the game and nothing un-freezes it until this entity's
 * own `update()` decides to, ~197 ticks later (`fallRockFreezeTicks`, and
 * it is SIMULATED — the fall is `vy += 0.6` per tick with the `>= fallTo`
 * test AFTER the move, so a closed form is off by one at both ends). Over
 * that span:
 *
 *   · `Game.cameraTarget` is rewritten to the LANDING every falling tick,
 *     so the camera leaves the player and comes back;
 *   · the landing writes `type = "Solid"`, `Game.shake = 30` and a sound;
 *   · and from the landing onward `update()`'s first arm SNAPS an
 *     overlapping player to the rock's top on every tick, forever.
 *
 * ⚠ **THE CAMERA PAN COSTS L39 NOTHING, AND THAT IS A MEASUREMENT RATHER
 * THAN A HOPE.** `Enemy.update` opens `if (!activeOffScreen && !onScreen())
 * return`, so an off-camera enemy stops — but L39's only enemies are three
 * `Spinner`s and `Spinner.as:44` sets `activeOffScreen = true`. Nothing
 * else in the level is onScreen-gated outside `render()`. See
 * `CAMERA_PAN_AUDIT`.
 *
 * ⚠⚠ **WHAT THE PAN DOES NOT COVER, AND IS THE REAL PHASE HAZARD:**
 * `Game.time` advances OUTSIDE both the `blackCover <= 0` gate and any
 * freeze (`Game.as:823`), so every frozen frame is a frame of
 * `Game.time`-coupled phase the tape's tick index does not have.
 * `Spinner.hammerAngle` reads `Game.time` DIRECTLY. See `TIME_COUPLED`.
 */

import { rect } from './levelWorld.js';

export class FallRockError extends Error {
    constructor(message) { super(message); this.name = 'FallRockError'; }
}
const fail = (m) => { throw new FallRockError(m); };

/**
 * The constructor's numbers, verbatim. Every one is `private const` in
 * `Scenery/FallRock.as:23-31`, so an `.oel` decides only position, `t` and
 * `tag`.
 */
export const FALL_ROCK = Object.freeze({
    /** `super(_x + Tile.w/2, _y + Tile.h/2)` then `setHitbox(16,16,8,8)`. */
    box: Object.freeze({ dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8 }),
    /** `y = -16` — off the top of the map, in ENTITY coordinates. */
    parkedY: -16,
    fallRate: 0.6,
    waitToFallTimerMax: 60,
    cameraTimerMax: 90,
    shake: 30,
    /** `type` is "" while parked and "Solid" from the landing tick. */
    parkedType: '',
    landedType: 'Solid',
    src: 'Scenery/FallRock.as:33-49 (ctor) + :51-101 (update) + :103-118 (fall/activate)',
});

/**
 * ⛓ THE CAMERA-PAN AUDIT, as data rather than as a sentence in a docblock.
 *
 * The brief asked for onScreen-gated classes to be checked for phase shifts
 * across the pan, because the spinners are at the TOP of the shaft and the
 * camera spends the whole fall at the BOTTOM. The answer is that the gate
 * exists and this level's enemies opt out of it — which is a stronger
 * result than "no route notices", because it is a property of the classes.
 */
export const CAMERA_PAN_AUDIT = Object.freeze({
    gate: 'Enemies/Enemy.as:64 — `if (!activeOffScreen && !onScreen()) return`',
    /** Every UPDATE-time onScreen gate in `src/`, and whether L39 holds one. */
    gatedClasses: Object.freeze([
        Object.freeze({ as3: 'Enemy', src: 'Enemies/Enemy.as:64', inL39: true,
            verdict: 'opted out', why: '`Spinner.as:44` sets `activeOffScreen = true`, '
                + 'and L39\'s only enemies are its three spinners' }),
        Object.freeze({ as3: 'LightBossShot', src: 'Projectiles/LightBossShot.as:42', inL39: false, verdict: 'absent' }),
        Object.freeze({ as3: 'BossTotemShot', src: 'Projectiles/BossTotemShot.as:75', inL39: false, verdict: 'absent' }),
        Object.freeze({ as3: 'TurretSpit', src: 'Projectiles/TurretSpit.as:66', inL39: false, verdict: 'absent' }),
        Object.freeze({ as3: 'LavaBall', src: 'Projectiles/LavaBall.as:86', inL39: false, verdict: 'absent' }),
        Object.freeze({ as3: 'Wire', src: 'Scenery/Wire.as:50', inL39: false, verdict: 'absent' }),
        // The remaining three gate RENDER only, which no observation carries.
        Object.freeze({ as3: 'Tile', src: 'Scenery/Tile.as:126', inL39: true, verdict: 'render-only' }),
        Object.freeze({ as3: 'Light', src: 'Scenery/Light.as:49', inL39: true, verdict: 'render-only' }),
        Object.freeze({ as3: 'Tree', src: 'Scenery/Tree.as:38', inL39: false, verdict: 'render-only' }),
    ]),
    conclusion: 'the pan shifts NOTHING in L39',
});

/**
 * ⚠⚠ THE PHASE HAZARD THE PAN AUDIT IS NOT — and it is the one that bites.
 *
 * `Game.as:823`'s `time += timeRate` sits in `Game.update` BELOW the
 * `if (blackCover <= 0) super.update()` gate and outside every freeze, so
 * `Game.time` counts REAL FRAMES: fade frames, frozen frames and live ones
 * alike. A tape's tick index counts only the live ones. So after a freeze
 * of N frames the two are N apart, permanently, and any class reading
 * `Game.time` is N frames of phase away from where a tick-indexed model
 * puts it.
 *
 * `Bot.pinDeadFrames`'s docblock says "the genuinely `Game.time`-coupled
 * family is ONE class" (`BeamTower`'s position bob). It is not: the
 * enumeration below is every UPDATE-time reader, and `Spinner` — whose
 * reader is a DAMAGE LINE rather than a sprite frame — is in L39.
 *
 * ⛓ WHY IT DOES NOT MOVE THE SHAFT WALK ANYWAY: the hammer's only effect
 * is `player.hit(...)`, and `Player.as:1379` is `if (Bot.noDamage) return`
 * — the whole body, knockback included. The shaft tape declares
 * `noDamage: true`. The hazard is REAL and PRICED, not refuted; a future
 * tape that runs a spinner room WITHOUT `noDamage` pays it, and
 * `botStatus.game_time` is the instrument that measures it rather than
 * deriving it.
 */
export const TIME_COUPLED = Object.freeze({
    advance: 'Game.as:823 — `time += timeRate`, outside the blackCover gate and every freeze',
    readout: 'Bot.botStatus().game_time',
    readers: Object.freeze([
        Object.freeze({ as3: 'Spinner', src: 'Enemies/Spinner.as:71', kind: 'DAMAGE LINE',
            what: '`hammerAngle = (Game.time % 45) / 45 * 2π`, then a `collideLine` that '
                + 'calls `player.hit(this, 4, …)`', inL39: true,
            inertFor: 'a `noDamage` tape — `Player.as:1379` returns before the knockback' }),
        Object.freeze({ as3: 'LightBossController', src: 'Enemies/LightBossController.as:111,129,155',
            kind: 'position', what: '`Game.worldFrame(radiusCircleFrames, loopsPerCircle)`', inL39: false }),
        Object.freeze({ as3: 'DustParticle', src: 'DustParticle.as:32-33', kind: 'position',
            what: 'the intro cutscene only', inL39: false }),
    ]),
    /** Every other reader assigns a `Spritemap.frame` in `render()`. */
    renderOnly: 'AdnanCharacter, Yeti, Rekcahdam, Witch, Hermit, Moonrock, BobSoldier, Bob, '
        + 'Grass, Building, BoneTorch, LavaTrap, IceTrap, WallFlyer, Cover, Tile',
});

/**
 * A rock exactly as the constructor leaves it.
 *
 * ⛔ THE CTOR IS PERSISTENCE-CHECKED, so a rock whose tag is ALREADY clear
 * boots FALLEN — at `fallTo`, `type = "Solid"`, and `_active` written
 * DIRECTLY rather than through the setter, so `fall()` does not re-run and
 * the level does not re-freeze on entry. That is what makes the shaft a
 * one-way ceremony: it happens on the visit that pulls the rope and never
 * again.
 *
 * ⚠ ⇒ **ANY WINDOW THAT BOOTS INTO L39 AFTER THE PULL MUST DECLARE {39,10}
 * CLEARED**, or it boots a rock that is still overhead and a route that
 * walks under a solid that is not there yet.
 *
 * @param {number} x   the OEL placement x (integer)
 * @param {number} y   the OEL placement y (integer)
 * @param {number} t   the activator group
 * @param {number} tag the persistence tag, or -1
 * @param {boolean} cleared  `!Game.checkPersistence(tag)` at build time
 */
export function createFallRock(x, y, t, tag, cleared) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`createFallRock: (${x},${y}) must be the OEL integer placement`);
    }
    if (typeof cleared !== 'boolean') {
        fail('createFallRock: `cleared` is `!Game.checkPersistence(tag)` at BUILD time and '
            + 'has no default — it selects between a rock parked overhead and a rock that '
            + 'is already a solid on the floor, which is the whole difference between the '
            + 'visit that pulls the rope and every visit after it.');
    }
    const ex = x + FALL_ROCK.box.dx;
    const fallTo = y + FALL_ROCK.box.dy;
    return {
        id: `fallrock@${x},${y}`,
        t,
        tag,
        x: ex,
        fallTo,
        // `y = -16` comes AFTER `fallTo = y`, so the park is always -16 and
        // never a function of the placement.
        y: cleared ? fallTo : FALL_ROCK.parkedY,
        type: cleared ? FALL_ROCK.landedType : FALL_ROCK.parkedType,
        // ⛔ `_active = true`, NOT `activate = true`: the ctor writes the
        // BACKING FIELD, so the setter's `fall()` never runs for a rock that
        // boots fallen (`FallRock.as:46`, and the author's own comment on the
        // setter says why it cannot be re-entered).
        active: cleared,
        trigger: false,
        vy: 0,
        waitToFallTimer: 0,
        cameraTimer: 0,
    };
}

/** The rock's collision box at its current `y` — `[x-8, x+8) x [y-8, y+8)`. */
export function fallRockRect(state) {
    return rect(state.x - FALL_ROCK.box.originX, state.y - FALL_ROCK.box.originY,
        FALL_ROCK.box.w, FALL_ROCK.box.h);
}

/**
 * ⛓ `set activate` — the whole of it, including the two ways it does
 * nothing.
 *
 * ```
 *   if (a && !_active) { fall(); _active = a; }
 * ```
 *
 * ⚠ A `false` publication is not a write. The author's comment — *"Can only
 * be set to true--cannot be reset back to false without errors in the
 * update"* — is load-bearing: a group that goes quiet leaves an armed rock
 * armed, which is the OPPOSITE of what a `Cover` does with the same
 * publication, and a model that shared one code path for "publish the
 * group" would have had this backwards.
 *
 * @returns {{state: object, fell: boolean, write: ?object, freeze: boolean}}
 *   `write` is `{tag, value: false}` when `fall()` ran — the persistence
 *   clear happens HERE, at trigger time, and NOT at the landing.
 */
export function publishActivate(state, a) {
    if (typeof a !== 'boolean') fail('publishActivate: `a` is the published flag, no default');
    if (!(a && !state.active)) {
        return { state: { ...state }, fell: false, write: null, freeze: false };
    }
    return {
        state: {
            ...state,
            active: true,
            trigger: true,
            waitToFallTimer: FALL_ROCK.waitToFallTimerMax,
        },
        fell: true,
        // `Game.setPersistence(tag, false)` is `fall()`'s FIRST line.
        write: state.tag >= 0 ? { tag: state.tag, value: false } : null,
        // `Game.freezeObjects = true`, with no timer of its own: this entity's
        // own `update()` is the sole writer that clears it again.
        freeze: true,
    };
}

/**
 * One tick of `FallRock.update()`, transcribed in source order.
 *
 * ⚠ THE SNAP ARM IS FIRST AND IT IS OUTSIDE THE PERSISTENCE GATE, so it
 * runs on every tick of every visit from the landing onward — including
 * every later visit, where the rock boots already fallen.
 *
 * @param {object} state
 * @param {?object} playerBox  the player's box this tick, or null
 * @returns {{state, snapY: ?number, cameraTarget: ?object, landed: boolean,
 *            shake: number, unfroze: boolean}}
 *   `snapY` is the y the game WRITES onto the player, returned rather than
 *   applied — this module does not own the player's position.
 */
export function stepFallRock(state, playerBox = null, opts = {}) {
    const { cleared = state.tag < 0 ? true : null, screen = null } = opts;
    if (cleared === null) {
        fail('stepFallRock: `opts.cleared` is `!Game.checkPersistence(tag)` for THIS tick '
            + 'and has no default — `fall()` writes the flag itself, so the gate its '
            + 'update reads is one the setter already opened.');
    }
    const s = { ...state };
    let snapY = null;
    let cameraTarget = null;
    let landed = false;
    let shake = 0;
    let unfroze = false;

    // ── 1. the snap, `FallRock.as:54-61` ─────────────────────────────
    // `p.y = y - originY + p.originY - p.height`. With the rock's originY 8
    // and the player's `setHitbox(4, 5, 2, 2)` that is `y - 11`, which puts
    // the player's box bottom exactly on the rock's box top.
    if (s.active && s.y >= s.fallTo && playerBox
        && overlaps(playerBox, fallRockRect(s))) {
        snapY = s.y - FALL_ROCK.box.originY + PLAYER_SNAP.originY - PLAYER_SNAP.height;
    }

    // ── 2. the falling branch, behind the flag `fall()` itself cleared ──
    if (cleared) {
        if (s.trigger && s.y < s.fallTo) {
            if (screen) {
                cameraTarget = {
                    x: s.x - screen.width / 2,
                    y: s.fallTo - screen.height / 2,
                };
            }
            if (s.waitToFallTimer > 0) {
                s.waitToFallTimer -= 1;
            } else {
                // ⚠ `vy += fallRate` BEFORE `y += vy`, so the first falling
                // tick moves 0.6 and not 0.
                s.vy += FALL_ROCK.fallRate;
                s.y += s.vy;
            }
            // ⚠ AND THE TEST IS AFTER THE MOVE, in the same tick — the tick
            // that overshoots is the tick that lands.
            if (s.y >= s.fallTo) {
                s.cameraTimer = FALL_ROCK.cameraTimerMax;
                s.y = s.fallTo;
                s.type = FALL_ROCK.landedType;
                shake = FALL_ROCK.shake;
                s.trigger = false;
                landed = true;
            }
        } else if (s.cameraTimer > 0) {
            s.cameraTimer -= 1;
        } else if (s.cameraTimer === 0) {
            s.cameraTimer = -1;
            unfroze = true;
        }
    }
    return { state: s, snapY, cameraTarget, landed, shake, unfroze };
}

/**
 * The player's hitbox, for the snap arithmetic only. `Player.as:295` is
 * `new Rectangle(2, 2, 4, 5)` and `:432` feeds it to
 * `setHitbox(width, height, x, y)` — so origin (2,2), 4x5.
 */
export const PLAYER_SNAP = Object.freeze({ originY: 2, height: 5 });

function overlaps(a, b) {
    return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}

/**
 * ⛓⛓ THE FREEZE SPAN, SIMULATED.
 *
 * From the tick `fall()` runs to the tick `Game.freezeObjects` goes false
 * again, counted in `FallRock.update()` calls. It is `60 + fall + 90 + 1`,
 * and every one of those four terms is a fencepost somebody could get
 * wrong:
 *
 *   · the WAIT is 60 decrements and the 61st call is the first that falls,
 *     because `if (waitToFallTimer > 0) …--` spends a whole call reaching 0;
 *   · the FALL is `vy += 0.6; y += vy` from `y = -16`, tested `>=` after
 *     the move — 46 calls for a `fallTo` of 632, where the closed form
 *     `n(n+1) >= 2160` is 45.99 and a `floor` would say 45;
 *   · the CAMERA HOLD is 90 decrements;
 *   · and the RELEASE is its own call, the one that finds `cameraTimer`
 *     already 0.
 *
 * ⚠ IT IS NOT A CONSTANT. `fallTo` is the placement, so a rock lower down
 * the map falls for longer. L39's is 632 and L28's is 248.
 *
 * @returns {{total, wait, fall, hold, release, fallTo}}
 */
export function fallRockFreezeTicks(fallTo, startY = FALL_ROCK.parkedY) {
    let y = startY;
    let vy = 0;
    let wait = 0;
    let fallTicks = 0;
    let waitToFallTimer = FALL_ROCK.waitToFallTimerMax;
    let guard = 0;
    while (y < fallTo) {
        if (guard++ > 100000) fail('fallRockFreezeTicks: the rock never landed');
        if (waitToFallTimer > 0) { waitToFallTimer -= 1; wait += 1; continue; }
        vy += FALL_ROCK.fallRate;
        y += vy;
        fallTicks += 1;
    }
    return Object.freeze({
        wait,
        fall: fallTicks,
        hold: FALL_ROCK.cameraTimerMax,
        release: 1,
        total: wait + fallTicks + FALL_ROCK.cameraTimerMax + 1,
        fallTo,
    });
}

/**
 * ⛓ THE DEAD FRAMES A FALL COSTS A TAPE, which is not the same number.
 *
 * `Bot.update`'s gate is `if (game.blackCover > 0 || Game.freezeObjects)`
 * and it reads at the TOP of the frame, BEFORE `super.update()` — so it
 * sees the value the PREVIOUS frame left. The frame on which `fall()` runs
 * is therefore a LIVE frame (the flag goes true below the gate), and the
 * frame on which the release runs is a DEAD one (the gate saw it still
 * true).
 *
 * ⇒ dead frames = the freeze span exactly, counted from the frame AFTER
 * `fall()` through the release frame inclusive.
 *
 * ⚠ AND THE TWO BOUNDARY FRAMES ARE FREE ONLY BECAUSE THE PLAYER IS STILL.
 * On the onset frame the tape advances and `Mobile.mobileUpdate` has
 * ALREADY moved the player (the move is above `sprites()`, where the fire
 * dispatch lives), so nothing is lost. On the release frame the player
 * moves and the tape does NOT — a ghost step under whatever keys are still
 * held. A route that pulls a rope while walking pays that ghost step; a
 * route that pulls it from a dead stop pays nothing, and the shaft plan
 * pulls from a dead stop.
 */
export function fallRockDeadFrames(fallTo, startY = FALL_ROCK.parkedY) {
    return fallRockFreezeTicks(fallTo, startY).total;
}

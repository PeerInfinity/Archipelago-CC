/**
 * seedlingDemo/moonrock — ⛓⛓⛓ U14-swim D1: `Moonrock.update`, TRANSCRIBED.
 *
 * The rock the shield calls down. `Shield.removed()` writes `Moonrock.beam =
 * true` (`Pickups/Shield.as:46`; `beam` IS `Main.beam`, a save field), and the
 * next frame L0's `moonrock@240,256 {tag 0}` updates with `!Game.moonrockSet`
 * it beams for five seconds, drops from y −1000 onto its placement, and becomes
 * a 48x48 Solid for the rest of the game. Brief: swim U14 (⚖ Q46). U13 stopped
 * the campaign chain at route step 23 on exactly this (its t3 refutation).
 *
 * ── THE AS3 (`Scenery/Moonrock.as:66-153`, the update, in source order) ──
 *
 * ```
 *   if (!Game.moonrockSet) {
 *       if ((beam && canBeam) || trigger) Game.freezeObjects = true;     // (1)
 *       canBeam = false;
 *       for each p: if (FP.distance(x + 26, fallTo + 26, p.x, p.y) > 52 * 3/4) canBeam = true;
 *       if ((beam && canBeam) || trigger) playersDirection(int(p.x > x + 26) * 2);
 *       if (beam && canBeam) {
 *           Game.cameraTarget = (x - screen.w/2, fallTo - screen.h/2);
 *           if (beamTime > 0) { beamTime--; if (beamTime <= 0) { beamTime = 0;
 *                               beam = false; trigger = true; } }
 *           else beam = false;
 *       }
 *       if (trigger) { y += 20; if (y >= fallTo) { y = fallTo; type = "Solid";
 *           Game.shake = 60; cameraTimer = 90; Game.moonrockSet = true; trigger = false; } }
 *   } else {
 *       p = collide("Player", x, y);                                     // (2) the snap
 *       if (p && !p.fallFromCeiling && !p.fallInPit) p.y = y - originY + p.originY - p.height;
 *       stairs = collide("Teleporter", x, y);                            // (3) the stairs
 *       if (stairs is Stairs) { add(new Teleporter(…moonrock_target…));
 *           Game.setPersistence(0, false, namedLevel("moonrock_target")); remove(stairs); }
 *       if (cameraTimer > 0) cameraTimer--;                              // (4) the hold
 *       else if (cameraTimer == 0) { Game.resetCamera(); Game.freezeObjects = false;
 *           playersDirection(-1); cameraTimer = -1; }
 *   }
 * ```
 *
 * ⛔ THE BRIEF'S 150 WAS WRONG: `beamTimeMax = Main.FPS * 5` and `Main.as:27`
 * is `FPS:int = 60`, so the beam is 300 frames. With the fall's 63 (−1000 +
 * 20·63 = 260 ≥ 256) and the 90-frame hold, the span is 451 dead frames —
 * MEASURED on the game (`u14-moonrock-beam`: 471 dead = 20 boot + 451, and the
 * clock 451 ahead), and predicted before the recording.
 *
 * ⛓ (1) READS LAST FRAME'S `canBeam`, so the frame the beam starts is LIVE and
 * unfrozen, and the flag first goes up at the top of the NEXT frame — above the
 * Player (`loadlevel` adds the rock at `Game.as:2345`, after the Player at
 * `:2227`, and `addUpdate` prepends), but below `Bot.update`'s gate, which
 * therefore counts that frame LIVE: one live tape tick with a frozen player.
 *
 * ⛓ (4) RELEASES ABOVE THE PLAYER too, so the release frame — dead to the tape —
 * moves the player once under the keys still held. A `FallRock`'s shape.
 *
 * ⛓ A SET ROCK BOOTS WITH `cameraTimer = 0`, so its first update runs (4)'s
 * release arm on a visit that never froze: `resetCamera`, `freezeObjects =
 * false`, `directionFace = -1`. Nothing else in L0 holds either, so it is
 * observable only as a no-op, and transcribed rather than skipped.
 *
 * ⚠ `Rng.cos()` in `render()` (the flares) draws on the COSMETIC stream under
 * the campaign's `rng.split` (`campaignChain.CAMPAIGN_RNG_SPLIT`), and the
 * landing's `Game.shake` jiggle draws `Math.random()`: neither is a gameplay
 * draw, and neither is modelled here.
 *
 * This module owns the transcription; `levelRun` owns the joins (the freeze
 * accounting, the facing, the camera, the Solid, the persistence write).
 */

import { rect, rectsOverlap } from './levelWorld.js';
import { defineRecord } from './entityRecords.js';
// The player's hitbox for the snap arithmetic, FallRock's record (`Player.as:295`).
import { PLAYER_SNAP } from './fallRock.js';

export class MoonrockError extends Error {
    constructor(message) { super(message); this.name = 'MoonrockError'; }
}
const fail = (m) => { throw new MoonrockError(m); };

/**
 * The class's numbers, verbatim. Every one is a `private const`/ctor literal in
 * `Scenery/Moonrock.as`, so an `.oel` decides only position and `tag`.
 */
export const MOONROCK = defineRecord('moonrock', {
    /** `setHitbox(48, 48)` — origin 0, at the entity's own `x`, `y`. */
    box: Object.freeze({ w: 48, h: 48 }),
    /** `new Spritemap(imgMoonrock, 52, 52)` — `canBeam`'s centre and radius read the SPRITE. */
    sprite: Object.freeze({ w: 52, h: 52 }),
    /** `y = -1000` after `fallTo = _y`, unless `Game.moonrockSet`. */
    parkedY: -1000,
    /** `Main.FPS` (`Main.as:27`) — `beamTimeMax = Main.FPS * 5`. */
    fps: 60,
    beamSeconds: 5,
    fallRate: 20,
    cameraTimerMax: 90,
    parkedType: '',
    landedType: 'Solid',
    /**
     * `Game.setPersistence(0, false, namedLevel("moonrock_target"))` — the
     * vanilla set's `moonrock_target` is `{level: 2, x: 48, y: 32}`
     * (`VanillaSet.as:132`), and `u14-moonrock-beam`'s latch MEASURED {2,0}
     * cleared. A level-set fact, held as `endingChain.WATCHER_FLAG` holds the
     * watcher's: a constant with its source.
     */
    target: Object.freeze({ level: 2, tag: 0 }),
    src: 'Scenery/Moonrock.as:30-55 (fields, ctor) + :66-153 (update) + :155-163 (playersDirection); '
        + 'VanillaSet.as:132 (moonrock_target)',
}, { doc: ['src'], src: 'moonrock.js' });

/** `beamTimeMax`, derived as the AS3 derives it. */
export const BEAM_TIME_MAX = MOONROCK.fps * MOONROCK.beamSeconds;


/**
 * A rock exactly as the constructor leaves it.
 *
 * @param {number} x       the `.oel` placement x
 * @param {number} y       the `.oel` placement y — `fallTo`
 * @param {number} tag     the persistence tag (`check()` removes the rock when
 *                         it is cleared; the caller asks that)
 * @param {boolean} rockSet `Game.moonrockSet` at BUILD time, no default
 */
export function createMoonrock(x, y, tag, rockSet) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`createMoonrock: (${x},${y}) must be the .oel integer placement`);
    }
    if (typeof rockSet !== 'boolean') {
        fail('createMoonrock: `rockSet` is `Game.moonrockSet` at BUILD time and has no default — '
            + 'it is the whole difference between the visit that beams and every visit after it.');
    }
    return {
        id: `moonrock@${x},${y}`,
        tag,
        x,
        fallTo: y,
        y: rockSet ? y : MOONROCK.parkedY,
        type: rockSet ? MOONROCK.landedType : MOONROCK.parkedType,
        canBeam: false,
        beamTime: BEAM_TIME_MAX,
        trigger: false,
        // ⚠ 0, not −1: a rock that boots set runs the release arm on its first update.
        cameraTimer: 0,
        stairsReplaced: false,
    };
}

/** The rock's collision box at its current `y` — `[x, x+48) × [y, y+48)`. */
export function moonrockRect(s) {
    return rect(s.x, s.y, MOONROCK.box.w, MOONROCK.box.h);
}

/**
 * One `Moonrock.update()`, transcribed in source order.
 *
 * @param {object} s       the rock
 * @param {object} ctx
 * @param {boolean} ctx.beam       `Moonrock.beam` (= `Main.beam`) at the top of the call
 * @param {boolean} ctx.rockSet    `Game.moonrockSet` at the top of the call
 * @param {{x: number, y: number}} ctx.player  the player's position (the frame top)
 * @param {object} ctx.playerBox   the player's box at that position
 * @param {boolean} [ctx.playerFalling]  `fallFromCeiling || fallInPit` — the snap's exemption
 * @param {{width: number, height: number}} ctx.screen  `FP.screen`, for the camera target
 * @returns {{state, beam, rockSet, freeze: ?boolean, directionFace: ?number,
 *            cameraTarget: ?object, landed: boolean, snapY: ?number,
 *            stairsCheck: boolean, released: boolean}}
 *   `freeze` is the value written to `Game.freezeObjects` this call, or null for
 *   no write; `directionFace` likewise for `playersDirection`; `cameraTarget` is a
 *   point, `{x: -1, y: -1}` for `resetCamera()`, or null. `landed` is the call that
 *   writes `Game.shake = 60` (`camera.SHAKE_WRITERS.moonrockLanding`, the
 *   caller's). `stairsCheck` asks the caller to run (3) against its stairs.
 */
export function stepMoonrock(s, ctx) {
    const { beam: beamIn, rockSet: rockSetIn, player, playerBox, playerFalling = false, screen } = ctx;
    if (typeof beamIn !== 'boolean' || typeof rockSetIn !== 'boolean') {
        fail('stepMoonrock: `beam` and `rockSet` are the two save statics, with no default');
    }
    const st = { ...s };
    let beam = beamIn;
    let rockSet = rockSetIn;
    let freeze = null;
    let directionFace = null;
    let cameraTarget = null;
    let landed = false;
    let snapY = null;
    let stairsCheck = false;
    let released = false;
    const cx = st.x + MOONROCK.sprite.w / 2;
    const cy = st.fallTo + MOONROCK.sprite.h / 2;
    if (!rockSet) {
        // (1) — LAST frame's `canBeam`.
        if ((beam && st.canBeam) || st.trigger) freeze = true;
        st.canBeam = Math.hypot(cx - player.x, cy - player.y) > MOONROCK.sprite.w * 3 / 4;
        if ((beam && st.canBeam) || st.trigger) {
            // `int(p.x > x + sprMoonrock.width / 2) * 2` — 0 (right) or 2 (left).
            directionFace = (player.x > cx ? 1 : 0) * 2;
        }
        if (beam && st.canBeam) {
            cameraTarget = { x: st.x - screen.width / 2, y: st.fallTo - screen.height / 2 };
            if (st.beamTime > 0) {
                st.beamTime -= 1;
                if (st.beamTime <= 0) {
                    st.beamTime = 0;
                    beam = false;
                    st.trigger = true;
                }
            } else {
                beam = false;
            }
        }
        if (st.trigger) {
            st.y += MOONROCK.fallRate;
            if (st.y >= st.fallTo) {
                st.y = st.fallTo;
                st.type = MOONROCK.landedType;
                // `Game.shake = 60` is the caller's: `camera.SHAKE_WRITERS.moonrockLanding`.
                st.cameraTimer = MOONROCK.cameraTimerMax;
                rockSet = true;
                st.trigger = false;
                landed = true;
            }
        }
    } else {
        // (2) the snap — `collide("Player", x, y)` is the rock's box against the
        // player's, AABB-strict.
        // `p.y = y - originY + p.originY - p.height`; the rock's originY is 0.
        if (playerBox && !playerFalling && rectsOverlap(playerBox, moonrockRect(st))) {
            snapY = st.y + PLAYER_SNAP.originY - PLAYER_SNAP.height;
        }
        // (3) is the caller's: it owns the stairs.
        stairsCheck = true;
        // (4) the hold, and its release.
        if (st.cameraTimer > 0) {
            st.cameraTimer -= 1;
        } else if (st.cameraTimer === 0) {
            cameraTarget = { x: -1, y: -1 };
            freeze = false;
            directionFace = -1;
            st.cameraTimer = -1;
            released = true;
        }
    }
    return { state: st, beam, rockSet, freeze, directionFace, cameraTarget, landed, snapY,
        stairsCheck, released };
}

/**
 * ⛓ THE SPAN, SIMULATED — from the frame the beam starts to the release, in
 * `Moonrock.update()` calls, for a player standing still far from the rock.
 * `stepMoonrock`'s own loop, so the closed form and the stepper cannot
 * disagree; `moonrock.test.js` asserts the 300 + 63 + 90 + 1 split.
 *
 * @returns {{beam, fall, hold, release, total, dead}} `dead` is what `Bot`
 *   counts: every call but the first two (the beam's start, and the first
 *   frozen frame the gate still reads as live).
 */
export function moonrockSpan(x, fallTo, player = { x: x - 200, y: fallTo }) {
    let s = createMoonrock(x, fallTo, -1, false);
    let beam = true;
    let rockSet = false;
    let beamFrames = 0;
    let fallFrames = 0;
    let holdFrames = 0;
    let calls = 0;
    const screen = { width: 160, height: 160 };
    for (;;) {
        if (calls > 100000) fail('moonrockSpan: the rock never released');
        const wasSet = rockSet;
        const r = stepMoonrock(s, { beam, rockSet, player, playerBox: null, screen });
        calls += 1;
        // ⚠ The beam's LAST frame is also the fall's FIRST (`trigger` is set
        // and `y += 20` runs in the same call), so beam + fall + hold + release
        // is one more than `total`.
        if (!wasSet && beam && s.beamTime > 0) beamFrames += 1;
        if (!wasSet && (r.state.trigger || r.landed)) fallFrames += 1;
        if (wasSet && !r.released) holdFrames += 1;
        s = r.state;
        beam = r.beam;
        rockSet = r.rockSet;
        if (r.released) break;
    }
    return Object.freeze({
        beam: beamFrames,
        fall: fallFrames,
        hold: holdFrames,
        release: 1,
        total: calls,
        dead: calls - 2,
    });
}

/**
 * seedlingDemo/sealCeremony — THE PICKUP THAT WALKS ONTO *YOU*, AND THE
 * SECOND CEREMONY CHAINED BEHIND IT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 9, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §21.5; §22 is the
 * as-built.
 *
 * ── ⛔⛔ WHY THE R3 CEREMONY MODEL CANNOT CARRY THIS ONE ───────────────
 *
 * `levelRun.pickupUnderfoot` tests the player's box against the pickup's
 * STATIC placement rect. That has been exactly right for six rungs because
 * every pickup on every route was a thing the walk stepped onto: the
 * attraction in `Pickup.update` only ever pulled a stationary pickup a
 * fraction of a pixel toward a player who was already arriving.
 *
 * `Chest.open()` spawns its `SealPiece` **at the chest's own position**,
 * which is EIGHT TO ELEVEN PIXELS above a player standing in the chest's
 * two-pixel stance band. The static rects never overlap. Under the R3
 * model the ceremony would never fire; in the game the piece accelerates
 * down the gap and lands on a player who has not moved. **The first
 * pickup on the arc whose contact tick is decided by the PICKUP's physics
 * rather than the player's** — so the attraction has to be transcribed,
 * and this module is that transcription.
 *
 * ⚠ AND THE ORDER INSIDE `Pickup.update` IS NOT THE OBVIOUS ONE:
 *
 * ```
 *   if (v.length <= 0) stopped = true;         // never set false again
 *   … attraction …                            // BEFORE the contact test
 *   playerHit = collide("Player", x, y);       // …so the piece is tested
 *   if (playerHit) { pick_up(); return; }      //    where it was LAST tick
 *   super.update();                            // friction, then the move
 * ```
 *
 * so a tick's attraction never reaches that same tick's contact test, and
 * `Mobile.friction()` runs BEFORE `input()` and the move — the velocity
 * that moves the piece is the attracted one MINUS one friction step.
 *
 * ── ⛔⛔ AND `removed()` CHAINS A SECOND FREEZE ────────────────────────
 *
 * `SealPiece.removed()` adds a `new SealController()`, whose CONSTRUCTOR
 * sets `Game.freezeObjects = true`. That is a THIRD freeze shape on this
 * arc, after a pickup's phase A and an NPC dialogue, and it differs from
 * both in the way that matters to the tape:
 *
 * ⚠⚠ **`Bot.autoAdvance` CANNOT DISMISS IT, AND `saw_auto_advance`
 * CANNOT SEE IT.** The gate is `freezeUp = Game.talking || helpUp`
 * (`Bot.as`, v5's "count a FREEZE ARRIVAL, whatever raised it"), and a
 * `SealController` is neither: `Game.talking` is false and it is not a
 * `Help`. So the dead-frame branch runs, `autoAdvance()` returns without
 * dispatching, and the census guard `saw_auto_advance == 0` stays 0 for a
 * ceremony nobody planned for. **The docblock's stated unit and its code
 * disagree for exactly this class** — the same shape §14 recorded when
 * that comment contradicted itself two lines later. It is AS3, this rung
 * is zero-further-AS3, so it is a NAMED FINDING and the JS side asserts
 * the DEAD FRAMES instead. See `SEAL_AUTOADVANCE_BLIND_SPOT`.
 *
 * ⛓ **IT IS NOT A DEADLOCK, and the reason is arithmetic.**
 * `SealController.update`'s dismissal arm needs `Input.released(keys[6])`,
 * which no tape can supply through a dead frame — but the SAME update has
 * an unconditional `else` that removes it once `alphaStep` reaches
 * `alphaSteps * 2`. Derived below as a loop rather than as "about three
 * seconds".
 */

import { pointLength, pointNormalize, sign } from './playerPhysicsV1.js';
import { rectsOverlap } from './levelWorld.js';

export class SealError extends Error {
    constructor(message) { super(message); this.name = 'SealError'; }
}
const fail = (m) => { throw new SealError(m); };

/**
 * `Pickups/SealPiece.as` + the `Pickup` base's constants it inherits.
 * Everything here is `private const` or a field initialiser.
 */
export const SEAL_PIECE = Object.freeze({
    /** `setHitbox(4, 4, 2, 2)` — the smallest body on the arc. */
    box: Object.freeze({ w: 4, h: 4, originX: 2, originY: 2 }),
    type: 'Seal',
    /** `special = true` ⇒ 150 frozen frames; `text = ""` ⇒ no NPC at all. */
    special: true,
    text: '',
    // ── `Pickup`'s attraction constants (`Pickups/Pickup.as:12-16,22`) ──
    attractDistance: 24,
    motionDampener: 20,
    minAttraction: 0.3,
    minSpeedToPlayer: 2,
    specialTimerMax: 150,
    /** `Mobile.DEFAULT_FRICTION`; a `Pickup` never changes `f`. */
    friction: 0.25,
    /** `Mobile.solids` — the list `moveX`/`moveY` test against. */
    solids: Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss']),
    src: 'Pickups/SealPiece.as:17-48 + Pickups/Pickup.as:52-120 + Mobile.as:31-118',
});

/** `SealController.as`'s three timers. */
export const SEAL_CONTROLLER = Object.freeze({
    waitTime: 60,
    alphaSteps: 60,
    /** `Input.released(p.keys[6])` — the X key, which no dead frame can supply. */
    dismissKey: 'X',
    src: 'SealController.as:30-32 (fields) + :44-57 (ctor) + :90-114 (update) '
        + '+ :214-223 (removed)',
});

/**
 * ⛓ HOW LONG THE OVERLAY HOLDS THE FREEZE, by simulating its own update.
 *
 * ```
 *   if (alphaStep >= alphaSteps) { … Input.released -> remove … }
 *   if (alphaStep >= alphaSteps && waitTime > 0)  waitTime--;
 *   else if (alphaStep < alphaSteps * 2)          alphaStep++;
 *   else                                          FP.world.remove(this);
 * ```
 *
 * ⚠ **THE THIRD PHASE IS THE ONE NOBODY EXPECTS.** After the 60-tick fade
 * and the 60-tick wait, `waitTime` is 0 and `alphaStep` is only 60 — so
 * the `else if` arm resumes and runs `alphaStep` from 60 to 120 before the
 * `else` finally removes it. The overlay is ~3x its "60 fade + 60 wait"
 * reading, and the third phase is invisible on screen because `alpha` is
 * `(-cos(alphaStep / alphaSteps * PI) + 1) / 2`, which is back at its peak
 * for the whole of it.
 *
 * Transcribed as the loop rather than as `3 * 60 + 1`, per the standing
 * law: the arithmetic is a coincidence of three constants that are all
 * separately editable.
 *
 * @param {boolean} dismissed  whether an X release lands — for a BOT tape
 *                             it never can (the dead-frame branch does not
 *                             dispatch), so the default is the honest one
 */
export function sealControllerTicks(dismissed = false) {
    if (dismissed) {
        fail('sealControllerTicks(true): a dismissal is `Input.released(keys[6])` read '
            + 'on a FROZEN frame, and `Bot.autoAdvance` refuses to dispatch there '
            + '(`freezeUp` is `Game.talking || helpUp`, and a SealController is '
            + 'neither). There is no execution a tape can produce in which this is '
            + 'true — see `SEAL_AUTOADVANCE_BLIND_SPOT`.');
    }
    let alphaStep = 0;
    let waitTime = SEAL_CONTROLLER.waitTime;
    for (let n = 1; n <= 10000; n += 1) {
        if (alphaStep >= SEAL_CONTROLLER.alphaSteps && waitTime > 0) {
            waitTime -= 1;
        } else if (alphaStep < SEAL_CONTROLLER.alphaSteps * 2) {
            alphaStep += 1;
        } else {
            // `FP.world.remove(this)` — `removed()` clears the freeze.
            return n;
        }
    }
    return fail('sealControllerTicks: the overlay never removed itself');
}

/**
 * ⛓ THE WHOLE DEAD-FRAME COST OF ONE CHEST, derived.
 *
 * `Pickup.specialTimer`'s 150 is MEASURED rather than transcribed — the
 * game reported it as part of `r5-feather`'s 231, and
 * `r5Acceptance.FEATHER_DEAD_FRAMES.ceremony` is the same constant. The
 * controller's share is derived above. Neither is a tape tick: both are
 * invisible to the observation stream and both step the `Music` mixer, so
 * the sound pin sees all of them (`Bot.update` calls `Music.pinStep()`
 * ABOVE the armed check — §16's finding).
 */
export const CEREMONY_DEAD_FRAMES = Object.freeze({
    /** `Pickup.specialTimer`, as the game reported it. */
    pickup: 150,
    get controller() { return sealControllerTicks(); },
    get total() { return this.pickup + this.controller; },
});

/**
 * ⚠⚠ THE THREE THINGS THAT ARE TRUE OF THIS FREEZE AND OF NO OTHER.
 *
 * Written down as data because two of them are AS3 findings this rung is
 * not allowed to fix, and a finding that lives only in a comment is one
 * the next slice re-derives.
 */
export const SEAL_AUTOADVANCE_BLIND_SPOT = Object.freeze({
    what: '`saw_auto_advance` cannot see a SealController ceremony',
    where: 'Bot.as `autoAdvance()` — `var freezeUp:Boolean = Game.talking || helpUp`',
    why: 'v5 unified the counter on "a FREEZE ARRIVAL, whatever raised it", but the '
        + 'predicate it counts is still the two ORIGINAL raisers. A SealController sets '
        + '`Game.freezeObjects` directly and is neither an NPC nor a Help, so the '
        + 'dead-frame branch runs, `autoAdvance` returns early, and the guard reports 0 '
        + 'for a ceremony nobody planned for.',
    consequence: 'the guard is sound as an assertion (it still reads 0 on a clean tape) '
        + 'and UNSOUND as a census (a stray SealController would not raise it). The '
        + 'positive evidence has to be the DEAD FRAMES, which is what '
        + '`CEREMONY_DEAD_FRAMES` is for.',
    fix: 'AS3, next batch: count on `Game.freezeObjects` rising rather than on its two '
        + 'known raisers. Not this rung — R5 closed under zero-further-AS3 (§9.5).',
    /** ⛓ And the good news half: it cannot deadlock. */
    terminates: 'SealController.update\'s unconditional `else` removes it; '
        + 'sealControllerTicks() is the count',
});

/**
 * ⚠ THE TWO `Music` STATICS THE PICKUP MOVES — and why the pin does NOT
 * see them, which is the opposite of what §21.5 feared.
 *
 * `SealPiece`'s ctor writes `Music.bkgdVolumeMaxExtern = 0` and
 * `Music.fadeVolumeMaxExtern = 0`; `SealController.removed()` restores
 * both to 1. §21.5 flagged this as a static the tape's own clock could
 * see, on the strength of "the sound pin reads the Music mixer".
 *
 * ⛓ IT DOES NOT, AND THE REASON IS THAT THE PIN IS A POSITION MODEL.
 * `Music.pinStep()` walks `pinOpen`/`pinPos`/`pinLen` — channel POSITIONS
 * in frames — and `pinPlayed` records a length. No volume is read anywhere
 * in the pinned path, and `swimSoundClock` consumes positions only. So the
 * two statics are inert for every claim the pin carries, for ~332 frames,
 * and this is a bounded vacuity ASSERTED rather than a risk carried.
 *
 * ⚠ The volumes are still real for the actual audio, and
 * `SealController.removed()` restoring them is unconditional — so a run
 * that somehow ended mid-overlay would leave the game silent. No tape can:
 * the overlay removes itself.
 */
export const SEAL_MUSIC_STATICS = Object.freeze({
    written: Object.freeze(['Music.bkgdVolumeMaxExtern', 'Music.fadeVolumeMaxExtern']),
    at: 'Pickups/SealPiece.as:29-30 (to 0) + SealController.as:221 (back to 1)',
    pinReads: Object.freeze(['pinOpen', 'pinPos', 'pinLen']),
    verdict: 'INERT for the sound pin: the pin is a position model and reads no volume. '
        + 'Asserted, not assumed — §21.5 raised it as a live risk on the arc\'s one '
        + 'pinned channel.',
});

// ── the piece's own physics ───────────────────────────────────────────

/** A `SealPiece` as `Chest.open()` leaves it: at the CHEST's entity position. */
export function createSealPiece(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createSealPiece: (${x},${y}) must be the chest's entity position`);
    }
    return {
        x,
        y,
        vx: 0,
        vy: 0,
        /**
         * ⚠ `stopped` IS NEVER SET FALSE. `Pickup`'s ctor sets it false only
         * when a launch velocity `_v` is passed, and `Chest.open()` passes
         * none; the only other writer is `if (v.length <= 0) stopped = true`.
         * So the attraction arm is live on EVERY tick of this piece's life,
         * which is why it accelerates rather than drifting once.
         */
        stopped: true,
        contacted: false,
    };
}

/** The piece's box, from its entity position. */
export function sealPieceBox(p) {
    const b = SEAL_PIECE.box;
    return {
        x: p.x - b.originX,
        y: p.y - b.originY,
        right: p.x - b.originX + b.w,
        bottom: p.y - b.originY + b.h,
    };
}

/**
 * One tick of `Pickup.update` for an uncollected `SealPiece`.
 *
 * @param {object} piece   from `createSealPiece`
 * @param {object} ctx
 * @param {object} ctx.player     `{x, y}` — the entity position
 * @param {object} ctx.playerBox
 * @param {Function} ctx.blockedAt  `(x, y) => boolean` — would the piece's
 *                                  box at this position hit one of
 *                                  `SEAL_PIECE.solids`? `moveX`/`moveY`
 *                                  test it once per pixel step.
 * @returns {{piece: object, contact: boolean}}
 */
export function stepSealPiece(piece, ctx) {
    if (!Number.isFinite(ctx?.player?.x) || !Number.isFinite(ctx?.player?.y)) {
        fail('stepSealPiece: the attraction reads the PLAYER position every tick '
            + '(`FP.world.nearestToPoint("Player", x, y)`), so it has no default. '
            + 'Without it the piece would sit still and the ceremony would never fire.');
    }
    if (typeof ctx.blockedAt !== 'function') {
        fail('stepSealPiece: `moveX`/`moveY` collide against `Mobile.solids` once per '
            + 'pixel step and the caller owns the geometry. Without it the piece would '
            + 'drift through the wall the chest is embedded in.');
    }
    const p = { ...piece };

    // `if (v.length <= 0) stopped = true;`
    if (pointLength(p.vx, p.vy) <= 0) p.stopped = true;

    // ── the attraction, BEFORE the contact test ───────────────────────
    if (p.stopped) {
        const d = Math.sqrt((p.x - ctx.player.x) ** 2 + (p.y - ctx.player.y) ** 2);
        if (d <= SEAL_PIECE.attractDistance) {
            let ax = (ctx.player.x - p.x) / SEAL_PIECE.motionDampener;
            let ay = (ctx.player.y - p.y) / SEAL_PIECE.motionDampener;
            // ⚠ `attraction.normalize(Math.max(attraction.length, minAttraction))`
            // is a FLOOR, not a cap: a distant-but-inside-24px pickup is
            // pulled at 0.3 rather than at d/20.
            const n = pointNormalize(ax, ay, Math.max(pointLength(ax, ay), SEAL_PIECE.minAttraction));
            ax = n.x; ay = n.y;
            p.vx += ax;
            p.vy += ay;
            // `v.normalize(Math.min(v.length, minSpeedToPlayer))` — this one
            // IS a cap.
            const c = pointNormalize(p.vx, p.vy,
                Math.min(pointLength(p.vx, p.vy), SEAL_PIECE.minSpeedToPlayer));
            p.vx = c.x; p.vy = c.y;
        }
    }

    // ── `playerHit = collide("Player", x, y)` — at the position this tick
    //    STARTED with, so the attraction above cannot reach it ──────────
    if (rectsOverlap(sealPieceBox(p), ctx.playerBox)) {
        p.contacted = true;
        // `pick_up(); return;` — no friction, no move, on the contact tick.
        return { piece: p, contact: true };
    }

    // ── `super.update()` -> `Mobile.mobileUpdate()` ───────────────────
    // `friction()` runs ABOVE `input()` and the two moves.
    const m = pointLength(p.vx, p.vy);
    const fr = pointNormalize(p.vx, p.vy, Math.max(m - SEAL_PIECE.friction, 0));
    p.vx = Math.abs(fr.x) < 0.05 ? 0 : fr.x;
    p.vy = Math.abs(fr.y) < 0.05 ? 0 : fr.y;

    p.x = sweep(p.x, p.vx, (nx) => ctx.blockedAt(nx, p.y));
    p.y = sweep(p.y, p.vy, (ny) => ctx.blockedAt(p.x, ny));

    return { piece: p, contact: false };
}

/**
 * `Mobile.moveX` / `moveY`, which are the same loop on different axes.
 *
 * ⚠ THE LOOP CONDITION IS `i < Math.abs(_rel)` WITH AN INTEGER `i`, so a
 * sub-pixel velocity still takes exactly ONE step of its own size — `0 <
 * 0.25` is true. A model that floored the distance would leave a slow
 * pickup motionless forever, which is most of this piece's approach.
 */
function sweep(pos, rel, blocked) {
    const s = sign(rel);
    let out = pos;
    for (let i = 0; i < Math.abs(rel); i += 1) {
        const step = Math.min(1, Math.abs(rel) - i) * s;
        if (blocked(out + step)) return out;
        out += step;
    }
    return out;
}

/**
 * ⛓ HOW MANY LIVE TICKS THE PIECE TAKES TO REACH A STATIONARY PLAYER.
 *
 * The one number a route needs from this module, and the reason it is a
 * simulation rather than a constant: it depends on the gap, which depends
 * on which row of the two-pixel stance band the walk actually stopped in.
 *
 * ⚠ THESE TICKS ARE LIVE. Phase A and the overlay are dead frames the
 * stream cannot see; the approach is not. The player is standing still for
 * all of them, so every observation repeats — but the COUNT still decides
 * which tick the walk resumes on, and everything after it shifts.
 *
 * @returns {{ticks: number, path: {x: number, y: number}[]}}
 */
export function sealApproachTicks(piece, ctx, limit = 600) {
    let cur = piece;
    const path = [];
    for (let n = 1; n <= limit; n += 1) {
        const r = stepSealPiece(cur, ctx);
        cur = r.piece;
        path.push({ x: cur.x, y: cur.y });
        if (r.contact) return { ticks: n, path };
    }
    return fail(`sealApproachTicks: no contact in ${limit} ticks. The piece spawns at the `
        + 'chest and the player is in the stance band 8-11 px below it, so a run of '
        + 'this length means the attraction never engaged — check that the gap is '
        + `inside \`attractDistance\` (${SEAL_PIECE.attractDistance}).`);
}

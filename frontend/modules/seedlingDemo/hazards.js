/**
 * seedlingDemo/hazards — the Puzzlements family as VOLUMES, and the two
 * clocks they run on.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.4, §3.2.
 *
 * ── ⛔ THE FINDING THIS MODULE EXISTS TO RECORD ───────────────────────
 *
 * §2.4 and §8.4 say the `Game.worldFrame`-coupled family is exactly TWO,
 * `BeamTower` and `LavaChain`, and that §6.6's determinism-pin batch would
 * be reopened if the L108 beamtower corridor turned out to need it. Reading
 * `BeamTower.as` line by line says something different, and it is the same
 * correction §8.4 already made ONCE for `ArrowTrap`:
 *
 *   - the beam's FIRING gate is `(sprBeamTower.frame - 1) % 2 == 1` (:59) —
 *     a SPRITEMAP frame, stepped in `Spritemap.update` by
 *     `_anim._frameRate * FP.elapsed`, from `World.update`, which
 *     `Game.update` runs INSIDE the `blackCover <= 0` gate. So the beam
 *     cycle is counted in LIVE ticks since the level loaded, dead frames do
 *     not advance it, and it is exactly modellable from the tape's own
 *     counter.
 *   - the `Game.worldFrame` call at :102 is `y += 0.3 * sin(...)`, a
 *     POSITION bob, not a timer.
 *
 * ⇒ The beamtower's phase uncertainty is not a question about WHEN it
 * fires. It is 8.6 px of vertical bob on a `Game.time` phase, and the ±2
 * dead-frame band moves the beam by at most **0.62 px** (`BEAM_BOB_SPREAD_K2`,
 * derived below and pinned by a test). A corridor crossing needs 0.62 px of
 * margin, not a pinned clock.
 *
 * ⚠ AND `LavaChain` REALLY IS worldFrame-coupled: `if
 * (!Game.worldFrame(Main.FPS, loops))` (:53) starts the extend, so the
 * SWING TIME is uncertain by k. It is the family's only member.
 *
 * ── ⛓ AND WHY `FP.elapsed` IS A CONSTANT FOR THIS BOT ─────────────────
 *
 * §2.1 left "animation advance is wall-clock-shaped" as a soft spot needing
 * a probe. The source closes it: `Engine.as:161-162` is
 *
 *     FP.elapsed = (_time - _last) / 1000;
 *     if (FP.elapsed > MAX_ELAPSED) FP.elapsed = MAX_ELAPSED;   // 0.0333
 *
 * — a CLAMP at 30 fps. The bot's measured rate is ~24 ticks/s on the `--win`
 * path and 0.5 fps on the SwiftShader one, so both are below 30 and both
 * clamp: `FP.elapsed` is exactly 0.0333 on every frame of every recording
 * this arc has ever made. That is why R3's and R4's press fixtures
 * reconciled bit-exact across a 50x frame-rate difference, and it is why
 * §8.8's three full-walk runs produced identical fade counts across an 8%
 * wall-clock spread. ⚠ It is a fact about the REGIME, not about the game: a
 * browser running the page above 30 fps would step animations differently,
 * which is worth knowing before anyone "speeds up" the harness.
 *
 * ── WHAT A VOLUME IS FOR ──────────────────────────────────────────────
 *
 * Every volume here is CONSERVATIVE by construction — a union over the
 * phases a route does not pin. That is the §3.2 ladder's rung 1 and 4:
 * path-avoid is free if the volume is never entered, and hard-avoid is the
 * verdict when simulation cannot pin the phase. A rung that must THREAD one
 * of these transcribes its exact cycle then, with the encounter named.
 */

import { assertRect } from './levelWorld.js';

/** `Engine.as:270` — the 30 fps clamp that makes `FP.elapsed` a constant. */
export const MAX_ELAPSED = 0.0333;

/** `Game.as:488` — `timePerFrame`, the divisor inside `Game.worldFrame`. */
export const TIME_PER_FRAME = 45;

/** `Game.worldFrame(n, loops)` — `Game.as:1776-1779`, verbatim. */
export function worldFrame(time, n, loops = 1) {
    const span = TIME_PER_FRAME * loops;
    return Math.trunc((time % span) / (span / Math.max(n, 1)));
}

/**
 * The beam tower's vertical bob, as an ACCUMULATED position.
 *
 * ⚠ `y += …`, NOT `y = …` (`BeamTower.as:102`). The tower integrates
 * `0.3 * sin(worldFrame(100, 2)/100 * 2π)` once per update, so its y is a
 * running SUM — which happens to return to its starting value at every
 * 90-tick period boundary (`TIME_PER_FRAME * loops`), with no drift, and to
 * peak 8.6 px below it in between.
 *
 * @param {number} ticks  update frames since the tower was constructed
 * @param {number} phase0 the `Game.time` value at construction
 */
export function beamBob(ticks, phase0 = 0) {
    let dy = 0;
    for (let i = 0; i < ticks; i += 1) {
        dy += 0.3 * Math.sin((worldFrame(phase0 + i, 100, 2) / 100) * 2 * Math.PI);
    }
    return dy;
}

/** The bob's full excursion, in pixels — 0 at every period boundary. */
export const BEAM_BOB_SPAN = 8.606;

/**
 * ⛓ THE NUMBER §6.6 TURNS ON: how far the beam moves between two runs whose
 * `Game.time` phases differ by the measured dead-frame band k = 2.
 *
 * Derived by integrating both phases over a full 900-tick sweep and taking
 * the largest divergence. **0.62 px** — so the L108 corridor's phase
 * uncertainty is sub-pixel, and the "reopen the batch if the beamtower
 * corridor blocks" clause of §8.9 needs 0.62 px of margin rather than a
 * determinism pin.
 */
export const BEAM_BOB_SPREAD_K2 = 0.62;

/**
 * The beam-firing gate, in LIVE ticks since the level loaded.
 *
 * `sprBeamTower.add("right", [1, 2], 10 * speed)` then `play("right")`, and
 * the damage arm is `(frame - 1) % 2 == 1` — so frame 1 is dark, frame 2 is
 * beaming, and the pair alternates. `Spritemap.update` advances
 * `_timer += _frameRate * FP.elapsed` with `FP.elapsed` clamped to 0.0333,
 * so one frame lasts `1 / (10 * speed * 0.0333)` ≈ `3 / speed` updates.
 *
 * ⚠ NOT `Game.time`. Dead frames are outside `World.update` and do not
 * advance it. That is the correction this module's header is about.
 */
export function beamFrameRate(speed = 1) {
    return 10 * speed * MAX_ELAPSED;
}

export function beamIsFiring(liveTicks, speed = 1) {
    const perFrame = beamFrameRate(speed);
    // `_timer += rate` each update, `_index++` on each whole unit; the anim
    // has two frames and loops, so the index is the parity.
    const index = Math.floor(liveTicks * perFrame) % 2;
    return index === 1;
}

/**
 * The volume of one Puzzlement instance — a union over every phase the
 * caller has not pinned.
 *
 * `verdict` is the §3.2 ladder's default for the class, not a route
 * decision: `hard-avoid` means no stance can make a contact survivable
 * (Crusher's damage is 1000, so a contact is `die()` at any `hitsMax`), and
 * `avoid` means the encounter ladder may still price a threading.
 *
 * @param {object} instance a `combatCensusOf().hazards` row (`cx`,`cy`,`attrs`)
 * @param {{width:number,height:number}} world level size IN PIXELS
 */
export function hazardVolume(instance, world) {
    const { tag, cx, cy } = instance;
    const attrs = instance.attrs ?? {};
    const mk = (x, y, w, h, why) => {
        const r = { x, y, right: x + w, bottom: y + h, w, h, why };
        assertRect(r, `${tag}@${cx},${cy}`);
        return r;
    };
    switch (tag) {
        case 'crusher': {
            // `Crusher.as:63-74`: FOUR trigger rects, each the body grown by
            // `intDist` = 64 along one axis, and entering ANY of them (with a
            // clear `collideLine("Solid")`) arms a 1 px/tick charge that runs
            // until a solid stops it. So the arming volume is a plus, and the
            // charge itself is the whole lane behind it.
            const body = mk(cx - 16, cy - 16, 32, 32, 'the 32x32 body — damage 1000');
            return {
                tag,
                verdict: 'hard-avoid',
                exactness: 'exact',
                why: '⛔ damage 1000 ("KILL EVERYTHING", Crusher.as:33) — a contact is '
                    + 'die() at any hitsMax, so no stance makes it survivable and the '
                    + 'ladder\'s rung 4 is the only rung it has.',
                rects: [
                    body,
                    mk(cx - 16, cy - 16, 96, 32, 'trigger lane, +x (intDist 64)'),
                    mk(cx - 80, cy - 16, 96, 32, 'trigger lane, -x'),
                    mk(cx - 16, cy - 80, 32, 96, 'trigger lane, -y'),
                    mk(cx - 16, cy - 16, 32, 96, 'trigger lane, +y'),
                ],
                discs: [],
            };
        }
        case 'spinningaxe': {
            // `SpinningAxe.as:19,54-59`: a `collideLine` of length 32 at the
            // sprite's current angle, plus a 12x12 rect at the hub. The union
            // over all angles is a disc.
            return {
                tag,
                verdict: 'avoid',
                exactness: 'exact',
                why: `self-timed at rate ${attrs.rate ?? '?'}: the union over all angles `
                    + 'is a 32 px disc, and a route that must pass inside it prices the '
                    + 'angle from the tick count instead.',
                rects: [mk(cx - 6, cy - 6, 12, 12, 'the 12x12 hub rect (endRectSide)')],
                discs: [{ x: cx, y: cy, r: 32, why: 'the 32 px arm, swept' }],
            };
        }
        case 'pulser': {
            // `Pulser.as:23`: `radiusHit = 22`, the ring's damage radius.
            return {
                tag,
                verdict: 'avoid',
                exactness: 'exact',
                why: `self-timed (pulseTimerMax 20, radiusRate 0.8), group ${attrs.tset ?? 0}. `
                    + '⚠ Also a MECHANIC: the pulse bumps a PushableBlockFire and a dead '
                    + 'IceTurret with type "Pulse", which is one of only two things that '
                    + 'move an iceturret corpse.',
                rects: [],
                discs: [{ x: cx, y: cy, r: 22, why: 'radiusHit' }],
            };
        }
        case 'arrowtrap': {
            // `ArrowTrap.as:48-63`: three `Arrow`s at x-4, x, x+4, y-2, each
            // 4x4 with origin (2,2), moving (0, 5). The swept volume is a
            // column from the trap to the first solid below it — modelled to
            // the level floor, because "the first solid" is a per-level query
            // the caller has and this module does not.
            return {
                tag,
                verdict: 'avoid',
                exactness: 'activator',
                why: `3 arrows every 10 frames, downward at speed 5, damage 1 (NOT the 5, `
                    + `which is the SPEED). Group ${attrs.tset ?? 0}, `
                    + `shootDefault ${attrs.shoot ?? 0} — an Activators group gates it, so `
                    + 'whether it fires at all is a state question, not a timing one.',
                rects: [mk(cx - 6, cy, 12, Math.max(world.height - cy, 1),
                    'the arrow column, to the level floor (clip at the first Solid)')],
                discs: [],
            };
        }
        case 'beamtower': {
            const dir = Number(attrs.direction ?? 0);
            const speed = Number(attrs.speed ?? 1);
            // `getLine` (:156-182), relative to the entity's own y - 8:
            //   d 0 (right): from (x+6, y-19+n) to (FP.width, same)
            //   d 1 (up):    from (x-2+n, y-19)  to (same, 0)
            //   d 2 (left):  from (x-6, y-19+n)  to (0, same)
            //   d 3 (down):  from (x-2+n, y-13)  to (same, FP.height)
            // with n = 0..4, so the band is 5 px across. The whole band then
            // rides the bob, which runs 0..-8.6 px BELOW the construction y
            // — hence `BEAM_BOB_SPAN` added to the vertical extent.
            const bob = BEAM_BOB_SPAN;
            const bands = {
                0: mk(cx + 6, cy - 19 - bob, Math.max(world.width - (cx + 6), 1), 5 + bob,
                    'the beam band, +x, swept over the bob'),
                1: mk(cx - 2, 0, 5, Math.max(cy - 19, 1) + bob,
                    'the beam band, -y, swept over the bob'),
                2: mk(0, cy - 19 - bob, Math.max(cx - 6, 1), 5 + bob,
                    'the beam band, -x, swept over the bob'),
                3: mk(cx - 2, cy - 13 - bob, 5, Math.max(world.height - (cy - 13), 1) + bob,
                    'the beam band, +y, swept over the bob'),
            };
            return {
                tag,
                verdict: 'avoid',
                // ⛓ NOT `phase-band`. The FIRING is animation-clocked, i.e.
                // exact in live ticks; only the beam's POSITION rides
                // Game.time, and only by BEAM_BOB_SPREAD_K2 across the
                // measured dead-frame band.
                exactness: 'exact-timing/sub-pixel-position',
                phaseSpread: BEAM_BOB_SPREAD_K2,
                why: `direction ${dir}, speed ${speed} ⇒ one anim frame every `
                    + `${(1 / beamFrameRate(speed)).toFixed(1)} live ticks, beaming on `
                    + 'every other one. ⚠ The body is `type = "Solid"` and bobs with the '
                    + 'beam, so the BLOCKING geometry moves too.',
                rects: [
                    mk(cx - 8, cy - 24 - bob, 16, 32 + bob, 'the Solid body, swept over the bob'),
                    bands[dir] ?? bands[0],
                ],
                discs: [],
            };
        }
        case 'lavachain': {
            const dir = Number(attrs.dir ?? 0);
            // `LavaChain.getRect` (:96-119): `w = graphic.width - Tile.w` =
            // 64 - 16 = 48, `h = 4`, projected from the 16x16 body in `dir`.
            // The 4 px thickness is deliberately widened to the body's 16
            // here: the arm is centred on the body's mid-line and a 4 px
            // conservative volume would be a claim about the sprite's exact
            // anchor, which is not what an avoid volume is for.
            const arms = {
                0: mk(cx + 8, cy - 8, 48, 16, 'the arm, +x'),
                1: mk(cx - 8, cy - 8 - 48, 16, 48, 'the arm, -y'),
                2: mk(cx - 8 - 48, cy - 8, 48, 16, 'the arm, -x'),
                3: mk(cx - 8, cy + 8, 16, 48, 'the arm, +y'),
            };
            return {
                tag,
                verdict: 'avoid',
                // ⛔ THE ONE GENUINELY worldFrame-COUPLED CLASS ON THE MAP.
                exactness: 'phase-band',
                phaseSpread: null,
                why: '`if (!Game.worldFrame(Main.FPS, loops))` (LavaChain.as:53) starts the '
                    + 'extend, so the SWING TIME rides Game.time and is uncertain by the '
                    + 'accumulated dead-frame count. This is the whole of the '
                    + 'phase-uncertain family — the beamtower is not in it.',
                rects: [
                    mk(cx - 8, cy - 8, 16, 16, 'the body'),
                    arms[dir] ?? arms[0],
                ],
                discs: [],
            };
        }
        case 'whirlpool': {
            // `Whirlpool.as:56-84`: gate is hitbox overlap AND
            // `FP.distance < 16`; then ABSOLUTE position writes at exactly
            // 1 px/tick inward (r is an int and `r *= 0.999` re-truncates)
            // and `drown()` at r <= 1. `noHazards` does not reach it.
            return {
                tag,
                verdict: 'hard-avoid',
                exactness: 'exact',
                why: 'an avoid volume with a KNIFE EDGE: inside 16 px it writes the '
                    + 'player\'s position absolutely, 1 px/tick inward, and drowns them '
                    + '~15 ticks later. Permanent, and `noHazards` does not reach it.',
                rects: [],
                discs: [{ x: cx, y: cy, r: 16, why: 'FP.distance < 16' }],
            };
        }
        case 'pull': {
            return {
                tag,
                verdict: 'avoid',
                exactness: 'exact',
                why: 'adds force every tick to anything overlapping; routed around since '
                    + 'R1 and priced as a proximity hazard by levelWorld, which is where '
                    + 'its rect lives.',
                rects: [],
                discs: [],
                deferredTo: 'levelWorld proximity-hazard',
            };
        }
        case 'pod': {
            // ⛓⛓ R6 SLICE 6b. `Pod.as:24` is `super(_x + Tile.w/2, _y +
            // Tile.h/2)` and `setHitbox(16, 16, 8, 8)`, so the box is the oel
            // CELL and `cx`/`cy` — the constructed centre — put it back:
            // `[cx-8, cx+8) x [cy-8, cy+8)`.
            //
            // ⛔ `hard-avoid`, and NOT because the damage is large. The
            // damage is 1. What makes it unsurvivable is that the position
            // writes are ABOVE `p.hit` and ungated, so the pin outlives
            // `noDamage` and the player can never walk out: the ladder's
            // rung-4 shape with a rung-1 damage number.
            return {
                tag,
                verdict: 'hard-avoid',
                exactness: 'exact',
                why: '⛔ the pin SURVIVES `noDamage`: `p.x = x; p.y = y; p.v.x = p.v.y '
                    + '= 0` (Pod.as:70-72) sits ABOVE `p.hit(null, 0, null, 1)` and is '
                    + 'ungated, so an overlapping player is re-snapped EVERY TICK while '
                    + 'the animation is "closed" and cannot leave. And standing in an '
                    + 'OPEN one plays "close" (Pod.as:78-80), so the player is their own '
                    + 'trigger — 22 updates later it is closed.',
                rects: [mk(cx - 8, cy - 8, 16, 16,
                    'the 16x16 hitbox at its own position — `collideTypesInto(["Player"], '
                    + 'x, y, v)`')],
                discs: [],
                // ⚠ NOT exactly modellable from its own clock: the animation
                // has two writers, the boss's script and the player's own
                // overlap. `combat.PUZZLEMENT_HAZARDS.pod.timing` says
                // `boss-script` for the same reason.
                timing: 'boss-script',
            };
        }
        default:
            throw new Error(`hazardVolume: "${tag}" has no transcribed volume. Every member `
                + 'of PUZZLEMENT_HAZARDS needs one — an unpriced hazard is a contact '
                + 'nobody planned, which is the whole reason the combat role throws.');
    }
}

/** Does a player box overlap this volume? */
export function volumeHitsBox(volume, box, { margin = 0 } = {}) {
    for (const r of volume.rects ?? []) {
        if (box.right > r.x - margin && box.x < r.right + margin
            && box.bottom > r.y - margin && box.y < r.bottom + margin) {
            return { kind: 'rect', why: r.why };
        }
    }
    const cx = (box.x + box.right) / 2;
    const cy = (box.y + box.bottom) / 2;
    for (const d of volume.discs ?? []) {
        if (Math.hypot(cx - d.x, cy - d.y) <= d.r + margin) {
            return { kind: 'disc', why: d.why };
        }
    }
    return null;
}

/**
 * seedlingDemo/lavaChain — ⛓⛓⛓ SEEDLING FIDELITY K2PREP: `Game.worldFrame`, the FlashPunk `Spritemap` step and
 * `Puzzlements/LavaChain.as`, moved VERBATIM out of `hazards.js` (where LADDER2 transcribed them) because the
 * SIMULATION now steps the chain: `levelRun.stepLavaChainsNow` lands `LavaChain.reach`'s `"Enemy"` arm on the
 * stepped chasers. A module `levelRun.js` imports is simulation (`seedlingSolverSurface.js`), so the solver family
 * reaches these through the door (`solverView.js`) — `hazards.js` imports them there and re-exports them, so every
 * consumer of `hazards.js` is unchanged.
 */

import { FP_ELAPSED_CLAMPED } from './r6AnimClock.js';

/** `Game.as:488` — `timePerFrame`, the divisor inside `Game.worldFrame`. */
export const TIME_PER_FRAME = 45;

/** `Game.worldFrame(n, loops)` — `Game.as:1776-1779`, verbatim. */
export function worldFrame(time, n, loops = 1) {
    const span = TIME_PER_FRAME * loops;
    return Math.trunc((time % span) / (span / Math.max(n, 1)));
}

/**
 * `Spritemap.update` + `play` (`net/flashpunk/graphics/Spritemap.as`), for the
 * two puzzlements below: `st = {anim, index, timer, frame, complete}`, `anims`
 * maps a name to `{frames, rate, loop}`, and `onEnd(st)` is the class's
 * `animEnd` (it may `play`). ⚠ SIMULATED at the clamped `FP.elapsed`, never
 * divided — the same law as `r6AnimClock.animCallbackUpdate`.
 */
export function spritemapPlay(st, anims, name, reset = false) {
    if (!reset && st.anim === name) return;
    st.anim = name;
    st.index = 0;
    st.timer = 0;
    st.frame = anims[name].frames[0];
    st.complete = false;
}

export function spritemapUpdate(st, anims, onEnd) {
    if (st.anim === null || st.complete) return;
    const a = anims[st.anim];
    st.timer += (a.rate * FP_ELAPSED_CLAMPED) * 1;
    if (st.timer < 1) return;
    while (st.timer >= 1) {
        st.timer -= 1;
        st.index += 1;
        const cur = anims[st.anim];
        if (st.index === cur.frames.length) {
            if (cur.loop !== false) {
                st.index = 0;
                onEnd(st);
            } else {
                st.index = cur.frames.length - 1;
                st.complete = true;
                onEnd(st);
                break;
            }
        }
    }
    if (st.anim !== null) st.frame = anims[st.anim].frames[st.index];
}

/**
 * `Puzzlements/LavaChain.as`, transcribed. ⛔ `levelWorld`'s row says it
 * *"Damages ENEMIES only (LavaChain.as:86) — no Player branch"*: `reach` walks
 * `hitables = ["Player", "Enemy"]` and its `else if (hit is Player)` arm is
 * `p.hit(null, force 5, (x, y), damage 1)` (`:86-91`). It hurts the player.
 *
 * The clock: `if (!Game.worldFrame(Main.FPS, loops 2)) play("extend")` (`:53`)
 * — `Game.time % 90 < 1.5`, i.e. the two frames whose `Game.time % 90` is 0 or
 * 1 (the second `play` is a no-op on the same anim). `reach()` runs while the
 * anim is `extend` or `hit`, inside the same `update()`, BEFORE the graphic
 * advances. The entity is added after the Player (`Game.as:2359` vs `:2250`),
 * so it updates first and tests the PRE-move box. The ctor plays nothing: the
 * anim is null (frame 0) until the first trigger of the visit.
 */
export const LAVA_CHAIN = Object.freeze({
    reach: 48, thickness: 4, force: 5, damage: 1, loops: 2, fps: 60,
    anims: Object.freeze({
        sit: Object.freeze({ frames: [0], rate: 0 }),
        extend: Object.freeze({ frames: [1, 2], rate: 15 }),
        hit: Object.freeze({ frames: [3, 4, 5, 5, 5, 5, 4, 3], rate: 15 }),
        retract: Object.freeze({ frames: [6, 7, 8, 9, 10, 11, 12], rate: 25 }),
    }),
    src: 'Puzzlements/LavaChain.as:21-27,49-60,78-119,136-152',
});

const LAVA_CHAIN_NEXT = Object.freeze({ extend: 'hit', hit: 'retract', retract: 'sit' });

/** `LavaChain.getRect(dir)` (`:96-119`) for the chain at entity point (cx, cy). */
export function lavaChainRect(cx, cy, dir) {
    const w = 64 - 16;
    const h = LAVA_CHAIN.thickness;
    // originX = originY = 8, width = height = 16 (`setHitbox(16, 16, 8, 8)`).
    switch (Number(dir)) {
        case 0: return { x: cx - 8 + 16, y: cy - 8 + 8 - h / 2, w, h };
        case 1: return { x: cx - 8 + 8 - h / 2, y: cy - 8 - w, w: h, h: w };
        case 2: return { x: cx - 8 - w, y: cy - 8 + 8 - h / 2, w, h };
        case 3: return { x: cx - 8 + 8 - h / 2, y: cy - 8 + 16, w: h, h: w };
        default: return { x: 0, y: 0, w: 0, h: 0 };
    }
}

/** `World.collideRect("Player", …)` → `Entity.collideRect`: INCLUSIVE on all four sides. */
export function rectTouchesBox(r, box) {
    return box.right >= r.x && box.bottom >= r.y && box.x <= r.x + r.w && box.y <= r.y + r.h;
}

export function createLavaChainState() {
    return { anim: null, index: 0, timer: 0, frame: 0, complete: false };
}

/**
 * One `LavaChain.update()` + its graphic's update, at `Game.time` = `time`.
 * Returns `true` when `reach()` ran this update (the arm was out).
 */
export function stepLavaChain(st, time) {
    if (worldFrame(time, LAVA_CHAIN.fps, LAVA_CHAIN.loops) === 0) {
        spritemapPlay(st, LAVA_CHAIN.anims, 'extend');
    }
    const reaching = st.anim === 'hit' || st.anim === 'extend';
    spritemapUpdate(st, LAVA_CHAIN.anims, (s) => {
        const next = LAVA_CHAIN_NEXT[s.anim];
        if (next) spritemapPlay(s, LAVA_CHAIN.anims, next);
    });
    return reaching;
}

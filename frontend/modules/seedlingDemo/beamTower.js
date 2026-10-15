/**
 * seedlingDemo/beamTower — ⛓ SEEDLING FIDELITY BEAMTOWER: `Puzzlements/BeamTower.as`, moved VERBATIM out of
 * `hazards.js` (where LADDER2 transcribed it) because the SIMULATION now steps the tower: `levelRun.stepBeamTowersNow`
 * drifts its 16x32 Solid with its `y` (`CONTACT_FIDELITY.beamTowerDrift`) and lands its beam on the player
 * (`CONTACT_FIDELITY.beamTowerBeamHit`). The K2PREP shape (`lavaChain.js`): a module `levelRun.js` imports is
 * simulation, so the solver family reaches these through the door (`solverView.js`) — `hazards.js` imports them
 * there and re-exports them, so every consumer of `hazards.js` is unchanged.
 */

import { spritemapPlay, spritemapUpdate, worldFrame } from './lavaChain.js';

/**
 * `BeamTower.as`, transcribed (`:26-49,51-104,141-182,184-197`).
 *
 * ⛔ FOUR THINGS THE CENSUS VOLUME (`hazardVolume('beamtower')`) DOES NOT SAY:
 *   1. `const animSpeed:int = 10 * speed` — an INT: speed 0.25 is 2 fps, not 2.5.
 *   2. The direction TURNS. `animEnd` on `sit` is `direction = (direction +
 *      rate + 4) % 4`, so a rate-1 tower sweeps all four sides and a rate-2 one
 *      alternates; only rate 4 (or 0) holds its side.
 *   3. The ctor plays `"right"` WHATEVER the start direction; the beam's side is
 *      `direction`, the anim is cosmetic. Firing is the second frame of each
 *      side anim: `(frame - 1) % 2 == 1`.
 *   4. `getLine` ends at `FP.width`/`FP.height`, which `Game.loadlevel` sets
 *      to the LEVEL's size (`Game.as:2065-2066`, `FP.width = xml.width`) — not
 *      the 160 px screen `Main` constructs. ⛔ Measured: a first cut that read
 *      160 priced L103's right beam as [158, 160] and the game's beam knocked a
 *      walk at x 200 (the `ladder2-l103-beam` recording, t112).
 * The fire test runs before the bob (`y += 0.3·sin(worldFrame(100, 2)…)`), and
 * the whole update is skipped under `Game.freezeObjects`.
 */
export const BEAM_TOWER = Object.freeze({
    force: 5, damage: 1, bobRadius: 0.3, bobPhases: 100, bobLoops: 2,
    sides: Object.freeze(['right', 'up', 'left', 'down']),
    frames: Object.freeze({ right: [1, 2], up: [3, 4], left: [5, 6], down: [7, 8], sit: [0, 0] }),
    src: 'Puzzlements/BeamTower.as:26-49,51-104,141-197',
});

export function beamAnimSpeed(speed) {
    // AS3 `const animSpeed:int = 10 * speed` — `int()` truncates toward zero.
    return Math.trunc(10 * Number(speed));
}

function beamAnims(animSpeed) {
    const out = {};
    for (const [k, frames] of Object.entries(BEAM_TOWER.frames)) out[k] = { frames, rate: animSpeed };
    return out;
}

/**
 * A tower at its census row (`cx`, `cy` = the entity point, attrs as strings)
 * in a level of `size` = `{width, height}` IN PIXELS — `FP.width`/`FP.height`
 * while that level is loaded, where every beam ends.
 */
export function createBeamTower(h, size) {
    if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
        throw new Error('createBeamTower: pass the level size in pixels — the beam ends at '
            + '`FP.width`/`FP.height`, which `Game.loadlevel` sets to the level\'s own size');
    }
    const a = h.attrs ?? {};
    const animSpeed = beamAnimSpeed(a.speed ?? 1);
    const st = {
        cx: h.cx, y: h.cy, direction: Number(a.direction ?? 0), rate: Number(a.rate ?? 1),
        width: size.width, height: size.height,
        animSpeed, anims: beamAnims(animSpeed),
        anim: null, index: 0, timer: 0, frame: 0, complete: false,
    };
    spritemapPlay(st, st.anims, 'right');
    return st;
}

/** `BeamTower.getRect(direction)` at the tower's CURRENT y (a Number). */
export function beamRect(t, direction = t.direction) {
    const x = t.cx;
    const y = t.y;
    const line = (n) => {
        const from = { x, y: y - 8 };
        let to;
        switch (direction) {
            case 0: from.x += 6; from.y -= 11 - n; to = { x: t.width, y: from.y }; break;
            case 1: from.x -= 2 - n; from.y -= 11; to = { x: from.x, y: 0 }; break;
            case 2: from.x -= 6; from.y -= 11 - n; to = { x: 0, y: from.y }; break;
            case 3: from.x -= 2 - n; from.y -= 5; to = { x: from.x, y: t.height }; break;
            default: to = { ...from };
        }
        return [from, to];
    };
    const l0 = line(0);
    const l4 = line(4);
    return {
        x: Math.min(l0[0].x, l4[1].x), y: Math.min(l0[0].y, l4[1].y),
        w: Math.abs(l4[1].x - l0[0].x), h: Math.abs(l4[1].y - l0[0].y),
    };
}

export function beamIsBeaming(t) {
    return (t.frame - 1) % 2 === 1;
}

/**
 * One `BeamTower.update()` + its graphic's update. `time` is `Game.time` for the
 * bob, or `null` (the bob is then NOT applied — the caller widens instead).
 * Returns the beam rect when it fired this update (tested at the pre-bob y),
 * else null.
 */
export function stepBeamTower(t, time) {
    const rect = beamIsBeaming(t) ? beamRect(t) : null;
    if (time !== null) {
        t.y += BEAM_TOWER.bobRadius * Math.sin(
            worldFrame(time, BEAM_TOWER.bobPhases, BEAM_TOWER.bobLoops) / BEAM_TOWER.bobPhases * 2 * Math.PI);
    }
    spritemapUpdate(t, t.anims, (s) => {
        if (s.anim === 'sit') {
            s.direction = (s.direction + s.rate + 4) % 4;
            spritemapPlay(s, s.anims, BEAM_TOWER.sides[s.direction]);
        } else {
            spritemapPlay(s, s.anims, 'sit');
        }
    });
    return rect;
}

// ── ⛓ fidelity BEAMTOWER: one frame of the tower AS THE SIMULATION STEPS IT ─────────────────────────────

/**
 * One `World.update` of a tower: `BeamTower.update()` and then its graphic's update (`World.as:53-58` updates the
 * GRAPHIC of every entity whether or not its own `update()` ran).
 *
 * ```as3
 *   BeamTower.update:  if (Game.freezeObjects) return;           // ← the drift AND the beam test are skipped
 *                      super.update(); if (beaming) { …collideRect("Player", getRect(direction))… p.hit(…) }
 *                      y += 0.3 * Math.sin(Game.worldFrame(100, 2) / 100 * 2 * Math.PI);
 *   World.update:      if (e._graphic && e._graphic.active) e._graphic.update();   // ← the anim runs through a freeze
 * ```
 *
 * `time` is `Game.time` this frame (or `null`: the drift is then unknown and `t.yKnown` goes false for the rest of
 * the visit). Returns the beam rect the update tested (at the PRE-drift y), or null (not beaming, or frozen).
 */
export function stepBeamTowerFrame(t, { time, frozen }) {
    let rect = null;
    if (!frozen) {
        rect = beamIsBeaming(t) ? beamRect(t) : null;
        // `p.hit(null, force, new Point(x, y), damage)` — the point is the tower's, before this update's drift.
        t.testedY = t.y;
        if (time === null) t.yKnown = false;
        else t.y += BEAM_TOWER.bobRadius * Math.sin(
            worldFrame(time, BEAM_TOWER.bobPhases, BEAM_TOWER.bobLoops) / BEAM_TOWER.bobPhases * 2 * Math.PI);
    }
    spritemapUpdate(t, t.anims, (s) => {
        if (s.anim === 'sit') {
            s.direction = (s.direction + s.rate + 4) % 4;
            spritemapPlay(s, s.anims, BEAM_TOWER.sides[s.direction]);
        } else {
            spritemapPlay(s, s.anims, 'sit');
        }
    });
    return rect;
}

/**
 * Every rect the tower's beam can test, over every side its `rate` visits, each widened by the drift's whole span
 * both ways — the union a refusal asks when the tower's anim (or its `y`) is unknown. `span` is `hazards.BEAM_BOB_SPAN`.
 */
export function beamTowerReachRects(t, span) {
    const sides = new Set();
    for (let d = t.direction, i = 0; i < 4; i += 1, d = (d + t.rate + 4) % 4) sides.add(d);
    return [...sides].map((d) => {
        const r = beamRect(t, d);
        return { x: r.x, y: r.y - span, w: r.w, h: r.h + 2 * span };
    });
}

/**
 * The tower's Solid at its CURRENT y: `setHitbox(16, 32, 8, 24)` about the entity point (`cx`, `y`), which
 * `levelWorld`'s `beamtower` row places at [oel.x, +16) x [oel.y - 8, +32) for the constructor's y.
 */
export function beamTowerSolidRect(t) {
    const x = t.cx - 8;
    const y = t.y - 24;
    return { x, y, w: 16, h: 32, right: x + 16, bottom: y + 32 };
}

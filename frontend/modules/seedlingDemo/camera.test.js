/**
 * camera.js — `Game.view()`, and the gate it puts on every enemy update.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2.
 *
 * ⚠ THE STRATA, NAMED. The camera is not in `botStatus` and this rung
 * spends no AS3, so there is no live readout to differential against. The
 * three independent things this suite can lean on instead:
 *
 *   1. HAND-DERIVED AS3 ARITHMETIC — the `playerPhysicsV*.test.js`
 *      tradition: numbers read off `Game.as:1781-1825` and `Main.as:36`,
 *      not produced by this module.
 *   2. `bridges.ON_SCREEN_RADIUS` — R4 derived a CONSERVATIVE 64 px bound
 *      for the same camera, independently and for a different purpose. An
 *      exact transcription that disagreed with an earlier rung's bound
 *      would mean one of them is wrong, and that is worth a test.
 *   3. THE COMMITTED RECORDINGS — real player trajectories, so the track
 *      can be asserted to stay inside the level and inside R4's bound over
 *      ten thousand ticks of a walk that actually happened.
 *
 * ⛔ AND THE BOUNDED VACUITY, STATED: nothing here witnesses the camera
 * against the GAME. It cannot until an enemy's motion is observable, which
 * needs a wake whose consequence reaches the player's own stream — slice 3's
 * first live kill (L60's two jellyfish). Recorded rather than left to be
 * discovered.
 */

import { describe, expect, it } from 'vitest';

import {
    CAMERA_SPEED_DIVISOR,
    INVENTORY_TERM,
    SCREEN_H,
    SCREEN_W,
    cameraTrack,
    initialCamera,
    instanceRect,
    onScreen,
    stepCamera,
} from './camera.js';
import { ON_SCREEN_RADIUS } from './bridges.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { loadExpectation } from './fixtures/index.js';

const source = atlasLevelSource();
const big = { width: 960, height: 928 };

describe('the constants, read off the AS3', () => {
    it('the screen is the ENGINE\'s 160x160, not the level', () => {
        // `Main.as:36` — `super(160, 160, FPS)`. `Game.as:1855-1856`
        // overwrites FP.width/height from the LEVEL on every load, which is
        // why the clamp reads the level and the window reads the screen.
        expect([SCREEN_W, SCREEN_H]).toEqual([160, 160]);
    });

    it('the inventory term is -2, and it is two operands not a magic number', () => {
        // `Inventory.width` is the PNG's 66; `offset` is a static Point the
        // Inventory ctor sets to `offsetMin` (-70), and a closed inventory's
        // `moveToward(-70, -70)` never moves it.
        expect(INVENTORY_TERM).toBe(66 / 2 + -70 / 2);
        expect(INVENTORY_TERM).toBe(-2);
    });

    it('the follow is a tenth of the remaining distance', () => {
        expect(CAMERA_SPEED_DIVISOR).toBe(10);
    });
});

describe('one view()', () => {
    it('targets player - 78 in x and player - 80 in y', () => {
        // Hand-derived: target.x = p.x - 160/2 - (-2) = p.x - 78.
        // From a camera already ON target, the lerp is a no-op.
        const cam = stepCamera({ x: 400 - 78, y: 400 - 80 }, { x: 400, y: 400 }, big);
        expect(cam).toEqual({ x: 322, y: 320 });
    });

    it('lerps a tenth of the way, then ROUNDS', () => {
        // gap 100 in x ⇒ +10; gap 5 in y ⇒ +0.5 ⇒ rounds to +1 (AS3's
        // Math.round and JS's agree: half goes toward +Infinity).
        const cam = stepCamera({ x: 222, y: 315 }, { x: 400, y: 400 }, big);
        expect(cam).toEqual({ x: 232, y: 316 });
    });

    it('clamps to the LEVEL, so a camera never shows outside it', () => {
        expect(stepCamera({ x: 0, y: 0 }, { x: 8, y: 8 }, big)).toEqual({ x: 0, y: 0 });
        const far = stepCamera({ x: 800, y: 768 }, { x: 959, y: 927 }, big);
        expect(far).toEqual({ x: 800, y: 768 }); // 960-160, 928-160
    });

    it('CENTRES rather than clamping when the level is smaller than the screen', () => {
        // `Game.as:1799-1801`: `FP.camera.x = -(FP.screen.width - FP.width)/2`.
        // A 10x10-tile room is 160 wide, so x is 0; a smaller one goes
        // NEGATIVE, which is the arm a clamp would get backwards.
        const small = { width: 128, height: 96 };
        expect(stepCamera({ x: 0, y: 0 }, { x: 64, y: 48 }, small))
            .toEqual({ x: -16, y: -32 });
    });

    it('⛔ REFUSES to model a shaking camera', () => {
        // `Game.shake += 5` on every `Player.hit`, and `view()` then adds
        // `shake * Math.random() - shake/2` to both axes. R5's claim is
        // contact-freedom; a shaking camera means the claim already failed,
        // and answering with a number would be answering a question whose
        // premise is false.
        expect(() => stepCamera({ x: 0, y: 0 }, { x: 8, y: 8 }, big, { shake: 5 }))
            .toThrow(/contact-freedom; a shaking camera means the claim already failed/);
    });

    it('takes a cameraTarget override, and treats (-1,-1) as "none"', () => {
        // `Game.as:568` — `_cameraTarget = new Point(-1, -1)` is the sentinel,
        // not a position.
        const follow = stepCamera({ x: 300, y: 300 }, { x: 400, y: 400 }, big,
            { cameraTarget: { x: -1, y: -1 } });
        expect(follow).toEqual(stepCamera({ x: 300, y: 300 }, { x: 400, y: 400 }, big));
        const forced = stepCamera({ x: 300, y: 300 }, { x: 400, y: 400 }, big,
            { cameraTarget: { x: 500, y: 500 } });
        expect(forced).toEqual({ x: 320, y: 320 });
    });
});

describe('the loadlevel snap', () => {
    it('is RAW — no inventory term, no clamp, no rounding', () => {
        // `Game.as:2041-2042` is `player.x - FP.screen.width/2`, full stop.
        // All three land on the first `view()`, at the END of that tick,
        // which is why an enemy's `onScreen()` on a world's first live tick
        // is tested against a camera that can be outside the level.
        expect(initialCamera(8, 8)).toEqual({ x: -72, y: -72 });
        expect(initialCamera(400, 400)).toEqual({ x: 320, y: 320 });
        // ...and the first view() immediately starts closing the 2 px the
        // inventory term opens: 320 + (322-320)/10 = 320.2, rounded to 320.
        const settled = stepCamera(initialCamera(400, 400), { x: 400, y: 400 }, big);
        expect(settled).toEqual({ x: 320, y: 320 });
    });

    it('⛔ NEVER closes the last 4 px — the round is a DEAD ZONE', () => {
        // The finding this test was written to disprove and found instead.
        // `view()` rounds FP.camera ITSELF, and the next lerp compounds on
        // the rounded value — so a gap under 5 px yields `gap/10 < 0.5`,
        // rounds back to where it was, and never closes. A load leaves the
        // camera exactly 2 px from its x target (the inventory term), and
        // twenty fade frames later it is still 2 px away. Forever.
        let cam = initialCamera(400, 400);
        for (let i = 0; i < 200; i += 1) cam = stepCamera(cam, { x: 400, y: 400 }, big);
        expect(cam).toEqual({ x: 320, y: 320 });
        // The zone is symmetric and its width is 4: a 5 px gap closes by 1.
        let five = { x: 315, y: 320 };
        five = stepCamera(five, { x: 400, y: 400 }, big);
        expect(five.x).toBe(316);
        let four = { x: 318, y: 320 };
        four = stepCamera(four, { x: 400, y: 400 }, big);
        expect(four.x).toBe(318);
    });
});

describe('onScreen — FlashPunk\'s own test, at Enemy.update\'s ZERO margin', () => {
    const cam = { x: 100, y: 100 };
    it('is inclusive on all four edges', () => {
        // `Entity.onScreen`: false only when strictly past an edge.
        expect(onScreen({ x: 84, y: 150, right: 100, bottom: 158 }, cam)).toBe(true);
        expect(onScreen({ x: 83, y: 150, right: 99, bottom: 158 }, cam)).toBe(false);
        expect(onScreen({ x: 260, y: 150, right: 268, bottom: 158 }, cam)).toBe(true);
        expect(onScreen({ x: 261, y: 150, right: 269, bottom: 158 }, cam)).toBe(false);
    });

    it('reads the HITBOX, not the sprite', () => {
        // `Entity.onScreen` uses width/height/originX/originY, which
        // `setHitbox` writes — so a 32x32 iceturret sprite with a 16x16
        // corpse hitbox answers on the hitbox.
        const inst = {
            tag: 'bob', cx: 300, cy: 300,
            row: { hitbox: { w: 8, h: 8, ox: 4, oy: 4 } },
        };
        expect(instanceRect(inst)).toEqual({
            x: 296, y: 296, right: 304, bottom: 304, w: 8, h: 8,
        });
    });

    it('refuses an instance with no transcribed hitbox rather than guessing', () => {
        expect(() => instanceRect({ tag: 'shieldboss', cx: 0, cy: 0, row: {} }))
            .toThrow(/no transcribed hitbox/);
    });
});

describe('the track over a committed recording', () => {
    const worldOf = (() => {
        const cache = new Map();
        return (level) => {
            if (!cache.has(level)) {
                cache.set(level, buildLevelWorld(source(level), { roles: ROLES }).world);
            }
            return cache.get(level);
        };
    })();

    it('⚠ the phase is off by one from the obvious reading, and stated', () => {
        // Under RECORD-THEN-ACT, observation `t` is the state after `t`
        // completed ticks — so the camera the enemies were gated against
        // during tick `t` is the one view() produced at the END of tick
        // `t-1`, from the position that IS observations[t].
        const obs = [
            { t: 0, x: 400, y: 400, level: 0 },
            { t: 1, x: 401, y: 400, level: 0 },
        ];
        const track = cameraTrack(obs, () => big, { settleTicks: 0 });
        expect(track[0]).toEqual({ t: 0, level: 0, x: 320, y: 320 });
        // the second row is view() applied to obs[1]'s position, from row 0
        expect(track[1]).toEqual({
            t: 1, level: 0, ...stepCamera({ x: 320, y: 320 }, { x: 401, y: 400 }, big),
        });
    });

    it('stays inside the level for every tick of R4\'s longest segment', () => {
        const want = loadExpectation('r4-walk-6-health').stream;
        const track = cameraTrack(want.ticks, worldOf);
        expect(track.length).toBe(want.ticks.length);
        for (const row of track) {
            const w = worldOf(row.level);
            if (w.width >= 160) {
                expect(row.x, `L${row.level} t${row.t}`).toBeGreaterThanOrEqual(0);
                expect(row.x).toBeLessThanOrEqual(w.width - 160);
            }
            if (w.height >= 160) {
                expect(row.y, `L${row.level} t${row.t}`).toBeGreaterThanOrEqual(0);
                expect(row.y).toBeLessThanOrEqual(w.height - 160);
            }
        }
    });

    it('⛓ agrees with R4\'s independently-derived 64 px on-screen bound', () => {
        // `bridges.ON_SCREEN_RADIUS` was derived at R4 from the same source
        // lines, for a different purpose, without this module existing: the
        // standing camera error is the steady-state lag, at most 10x the
        // ~1.45 px/tick velocity peak plus half a pixel of rounding. If the
        // exact transcription ever put the player further from the camera's
        // own centre than that bound, one of the two derivations is wrong.
        //
        // Measured over a real 3,050-observation walk, and it is the tightest
        // statement the two can make to each other.
        const want = loadExpectation('r4-walk-6-health').stream;
        const track = cameraTrack(want.ticks, worldOf);
        let worst = 0;
        for (let i = 0; i < track.length; i += 1) {
            const w = worldOf(track[i].level);
            // Only meaningful where the clamp is not what is holding the
            // camera — a level edge legitimately puts the player far from
            // the window's centre.
            const clampedX = w.width >= 160 && (track[i].x === 0 || track[i].x === w.width - 160);
            const clampedY = w.height >= 160
                && (track[i].y === 0 || track[i].y === w.height - 160);
            if (clampedX || clampedY) continue;
            worst = Math.max(worst,
                Math.abs(want.ticks[i].x - (track[i].x + 80)),
                Math.abs(want.ticks[i].y - (track[i].y + 80)));
        }
        expect(worst).toBeLessThan(ON_SCREEN_RADIUS);
        // ...and it is not vacuous: the walk really does lag the camera.
        expect(worst).toBeGreaterThan(1);
    });

    it('a level change is a new Game, hence a new camera and a fade', () => {
        const obs = [
            { t: 0, x: 400, y: 400, level: 0 },
            { t: 1, x: 40, y: 40, level: 1 },
        ];
        // A room only 96 px tall CENTRES in y, and a snap to (40,40) in a
        // 96-wide room lands NEGATIVE — neither of which a lerp from the
        // previous level's (320,320) could ever produce.
        const track = cameraTrack(obs, (l) => (l === 0 ? big : { width: 96, height: 96 }));
        expect(track[0]).toEqual({ t: 0, level: 0, x: 320, y: 320 });
        expect(track[1]).toEqual({ t: 1, level: 1, x: -32, y: -32 });
    });
});

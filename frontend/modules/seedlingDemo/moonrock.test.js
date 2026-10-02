/**
 * moonrock.test — U14-swim D1: `Moonrock.update` as transcribed, and its joins
 * in `levelRun`. The game witnesses are `u14-moonrock-beam` and
 * `u14-moonrock-set` (tapeRunner); these rows pin the pieces.
 */
import { describe, expect, it } from 'vitest';

import { SHAKE_WRITERS } from './camera.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import {
    BEAM_TIME_MAX, MOONROCK, createMoonrock, moonrockRect, moonrockSpan, stepMoonrock,
} from './moonrock.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { PIN_NAMES } from './tapeFormat.js';

const levelSource = atlasLevelSource();
const SCREEN = { width: 160, height: 160 };

function l0Run({ beam, rockSet, x = 48, y = 192, shield = true, persistence = [] }) {
    return createLevelRun({
        levelSource,
        boot: { level: 0, x, y },
        noclip: false,
        noHazards: [],
        noDamage: false,
        grants: [],
        persistence,
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null,
        seam: { items: { hasSword: true, hasShield: shield }, beam, rock_set: rockSet },
    });
}

describe('Moonrock.update, transcribed (Scenery/Moonrock.as)', () => {
    it('the beam is Main.FPS (60) * 5 = 300 frames, not 150', () => {
        expect(BEAM_TIME_MAX).toBe(300);
    });

    it('L0 places one rock, moonrock@240,256 {tag 0}', () => {
        const rocks = levelSource(0).entities.filter((e) => e.type === 'moonrock');
        expect(rocks.map((e) => [e.x, e.y, e.attrs.tag])).toEqual([[240, 256, '0']]);
    });

    it('the span is 300 beam + 63 fall + 90 hold + 1 release over 453 calls: 451 DEAD', () => {
        // The beam's last frame is the fall's first, so the parts sum to one more.
        expect(moonrockSpan(240, 256)).toEqual({
            beam: 300, fall: 63, hold: 90, release: 1, total: 453, dead: 451,
        });
    });

    it('the first frame beams without freezing (it reads LAST frame\'s canBeam); the second freezes', () => {
        const s0 = createMoonrock(240, 256, 0, false);
        const ctx = { beam: true, rockSet: false, player: { x: 56, y: 200 }, playerBox: null, screen: SCREEN };
        const a = stepMoonrock(s0, ctx);
        expect(a.freeze).toBeNull();
        expect(a.state.canBeam).toBe(true);
        expect(a.state.beamTime).toBe(299);
        expect(a.directionFace).toBe(0);
        expect(a.cameraTarget).toEqual({ x: 240 - 80, y: 256 - 80 });
        const b = stepMoonrock(a.state, ctx);
        expect(b.freeze).toBe(true);
    });

    it('a player within 3/4 of the sprite width of the fall point holds the beam off', () => {
        const s0 = createMoonrock(240, 256, 0, false);
        const r = stepMoonrock(s0, { beam: true, rockSet: false, player: { x: 266, y: 282 },
            playerBox: null, screen: SCREEN });
        expect(r.state.canBeam).toBe(false);
        expect(r.state.beamTime).toBe(BEAM_TIME_MAX);
        expect(r.directionFace).toBeNull();
    });

    it('a player right of the rock is turned LEFT (2)', () => {
        const r = stepMoonrock(createMoonrock(240, 256, 0, false), { beam: true, rockSet: false,
            player: { x: 300, y: 200 }, playerBox: null, screen: SCREEN });
        expect(r.directionFace).toBe(2);
    });

    it('a rock built after the landing stands as a Solid and runs the release arm on its first update', () => {
        const s = createMoonrock(240, 256, 0, true);
        expect(s.y).toBe(256);
        expect(s.type).toBe(MOONROCK.landedType);
        const r = stepMoonrock(s, { beam: false, rockSet: true, player: { x: 56, y: 200 },
            playerBox: playerBoxAt(56, 200), screen: SCREEN });
        expect(r.released).toBe(true);
        expect(r.freeze).toBe(false);
        expect(r.directionFace).toBe(-1);
        expect(r.cameraTarget).toEqual({ x: -1, y: -1 });
        expect(r.stairsCheck).toBe(true);
        expect(r.snapY).toBeNull();
    });

    it('the snap puts an overlapping player\'s box on the rock\'s top (y - 0 + 2 - 5)', () => {
        const s = createMoonrock(240, 256, 0, true);
        const r = stepMoonrock(s, { beam: false, rockSet: true, player: { x: 250, y: 258 },
            playerBox: playerBoxAt(250, 258), screen: SCREEN });
        expect(r.snapY).toBe(253);
        const exempt = stepMoonrock(s, { beam: false, rockSet: true, player: { x: 250, y: 258 },
            playerBox: playerBoxAt(250, 258), playerFalling: true, screen: SCREEN });
        expect(exempt.snapY).toBeNull();
    });

    it('the rock\'s box is 48x48 at its own x, y', () => {
        expect(moonrockRect(createMoonrock(240, 256, 0, true)))
            .toMatchObject({ x: 240, y: 256, right: 288, bottom: 304 });
    });

    it('the landing\'s shake is camera.js\'s writer, an assignment of 60', () => {
        expect(SHAKE_WRITERS.moonrockLanding).toMatchObject({ op: '=', value: 60 });
    });
});

describe('the run\'s moonrock (levelRun)', () => {
    it('a pre-shield visit (beam false) never beams, freezes or sets the rock', () => {
        const run = l0Run({ beam: false, rockSet: false, shield: false });
        for (let i = 0; i < 30; i += 1) run.advance(new Set(['right']));
        expect(run.moonrock.events).toEqual([]);
        expect(run.frozenFramesOwed).toBe(0);
        expect(run.moonrock.rockSet).toBe(false);
    });

    it('beam: true resolves the whole span on t1 and owes 451 dead frames', () => {
        const run = l0Run({ beam: true, rockSet: false });
        run.advance(new Set());
        run.advance(new Set());
        const what = run.moonrock.events.map((e) => `${e.what}@${e.t}`);
        expect(what).toEqual(['beam-started@0', 'frozen@1', 'beam-ended@2', 'landed@2',
            'stairs-replaced@2', 'released@2']);
        expect(run.frozenFramesOwed).toBe(451);
        expect(run.moonrock.beam).toBe(false);
        expect(run.moonrock.rockSet).toBe(true);
        expect(run.earnedClears).toContainEqual(expect.objectContaining({ level: 2, tag: 0 }));
    });

    it('a cleared {0,0} removes the rock in check(): no beam at all', () => {
        const run = l0Run({ beam: true, rockSet: false, persistence: [{ level: 0, tag: 0, note: '' }] });
        run.advance(new Set());
        run.advance(new Set());
        expect(run.moonrock.rocks).toEqual([]);
        expect(run.frozenFramesOwed).toBe(0);
    });

    it('the room\'s writers name the landing while it is still ahead, and not after', () => {
        const run = l0Run({ beam: true, rockSet: false });
        expect(run.shakeWritersHere).toContain('moonrockLanding');
        run.advance(new Set());
        run.advance(new Set());
        expect(run.shakeWritersHere).not.toContain('moonrockLanding');
    });
});

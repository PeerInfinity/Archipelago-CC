/**
 * hazards.js — the Puzzlements volumes, and the two clocks.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2.
 *
 * The claims here are hand-derived from the AS3 (the `playerPhysicsV*`
 * tradition) plus the committed extract. The one that matters most to the
 * rung's open rulings is the beamtower pair: its FIRING is animation-clocked
 * and exactly modellable in live ticks, while only its POSITION rides
 * `Game.time` — by 0.62 px across the measured k = 2 band.
 */

import { describe, expect, it } from 'vitest';

import {
    BEAM_BOB_SPAN,
    BEAM_BOB_SPREAD_K2,
    MAX_ELAPSED,
    TIME_PER_FRAME,
    beamBob,
    beamFrameRate,
    beamIsFiring,
    hazardVolume,
    volumeHitsBox,
    worldFrame,
} from './hazards.js';
import { PUZZLEMENT_HAZARDS } from './combat.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

const source = atlasLevelSource();
const LEVEL_COUNT = 116;
const worldOf = (level) => buildLevelWorld(source(level), { roles: ROLES });

describe('the two clocks', () => {
    it('`FP.elapsed` is a CONSTANT for this bot, because of a 30 fps clamp', () => {
        // `Engine.as:161-162,270`: `FP.elapsed = (t - last)/1000`, then
        // `if (FP.elapsed > MAX_ELAPSED) FP.elapsed = MAX_ELAPSED` with
        // MAX_ELAPSED = 0.0333. The bot runs at ~24 ticks/s on the --win
        // path and 0.5 fps on SwiftShader; both are under 30 fps, so both
        // clamp. That is why R3's and R4's press fixtures reconciled
        // bit-exact across a 50x frame-rate difference — §2.1's soft spot,
        // closed at the source rather than by a probe.
        expect(MAX_ELAPSED).toBe(0.0333);
    });

    it('`Game.worldFrame` is transcribed verbatim, divisor and all', () => {
        expect(TIME_PER_FRAME).toBe(45);
        // n=45, loops=1: one index per tick, wrapping at 45.
        expect(worldFrame(0, 45)).toBe(0);
        expect(worldFrame(44, 45)).toBe(44);
        expect(worldFrame(45, 45)).toBe(0);
        // The Spinner's hammer is exactly this: `Game.time % 45`.
        expect(worldFrame(46, 45)).toBe(1);
    });
});

describe('⛓ the beamtower — the finding §6.6 turns on', () => {
    it('FIRES on the SPRITEMAP clock, in live ticks, not on Game.time', () => {
        // `sprBeamTower.add("right", [1,2], 10*speed)`, `play("right")`, and
        // the damage arm is `(frame - 1) % 2 == 1` — so the two-frame anim
        // alternates dark/beaming, and `Spritemap.update` steps
        // `_timer += 10*speed*FP.elapsed` from `World.update`, which
        // `Game.update` runs INSIDE the `blackCover <= 0` gate. Dead frames
        // do not advance it.
        expect(beamFrameRate(1)).toBeCloseTo(0.333, 5);
        // One frame lasts 1/0.333 = 3.003 ticks, so the parity flips at
        // ticks 4, 7, 10 — NOT 3, 6, 9. The .0033 matters and is kept.
        const pattern = Array.from({ length: 12 }, (_, t) => (beamIsFiring(t, 1) ? 1 : 0));
        expect(pattern.join('')).toBe('000011100011');
        // A slower tower stretches the same pattern by 1/speed.
        expect(beamFrameRate(0.25)).toBeCloseTo(0.08325, 5);
        expect(Array.from({ length: 26 }, (_, t) => (beamIsFiring(t, 0.25) ? 1 : 0)).join(''))
            .toBe('00000000000001111111111110');
    });

    it('BOBS on Game.time — 8.6 px, with no drift across a period', () => {
        // `y += 0.3 * sin(worldFrame(100,2)/100 * 2π)` (BeamTower.as:99-102).
        // It is `+=`, so the position is a running SUM; the period is
        // `TIME_PER_FRAME * loops` = 90 ticks, and the sum over one full
        // period is zero.
        expect(beamBob(90)).toBeCloseTo(0, 6);
        expect(beamBob(900)).toBeCloseTo(0, 6);
        let peak = 0;
        for (let t = 0; t <= 900; t += 1) peak = Math.max(peak, Math.abs(beamBob(t)));
        expect(peak).toBeCloseTo(BEAM_BOB_SPAN, 2);
    });

    it('⛓ and the k=2 dead-frame band moves the beam by only 0.62 px', () => {
        // THE NUMBER. §8.9's §6.6 recommendation says the batch would be
        // reopened if the L108 beamtower corridor needed it. It does not:
        // the corridor's phase uncertainty is 0.62 px of beam POSITION, so
        // a crossing needs sub-pixel margin, not a pinned clock.
        let worst = 0;
        for (let t = 0; t <= 900; t += 1) {
            worst = Math.max(worst, Math.abs(beamBob(t) - beamBob(t, 2)));
        }
        expect(worst).toBeLessThanOrEqual(BEAM_BOB_SPREAD_K2);
        expect(worst).toBeGreaterThan(0.5);
    });

    it('is the ONLY phase story that is not about timing; lavachain is', () => {
        // `LavaChain.as:53` — `if (!Game.worldFrame(Main.FPS, loops))` starts
        // the extend, so its SWING TIME rides Game.time. It is the whole of
        // the genuinely phase-uncertain family.
        const l108 = worldOf(108);
        const beam = l108.combat.hazards.find((h) => h.tag === 'beamtower');
        expect(beam).toBeTruthy();
        const v = hazardVolume(beam, l108.world);
        expect(v.exactness).toBe('exact-timing/sub-pixel-position');
        expect(v.phaseSpread).toBe(BEAM_BOB_SPREAD_K2);

        const chainLevel = (() => {
            for (let l = 0; l < LEVEL_COUNT; l += 1) {
                let w;
                try { w = worldOf(l); } catch { continue; }
                if (w.combat.hazards.some((h) => h.tag === 'lavachain')) return w;
            }
            return null;
        })();
        const chain = chainLevel.combat.hazards.find((h) => h.tag === 'lavachain');
        expect(hazardVolume(chain, chainLevel.world).exactness).toBe('phase-band');
    });
});

describe('the volumes', () => {
    it('every placed Puzzlement instance gets one — 83 of them', () => {
        let n = 0;
        const byVerdict = {};
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            let world;
            try { world = worldOf(level); } catch { continue; }
            for (const h of world.combat.hazards) {
                const v = hazardVolume(h, world.world);
                n += 1;
                byVerdict[v.verdict] = (byVerdict[v.verdict] ?? 0) + 1;
                for (const r of v.rects) {
                    // assertRect at every rect birth — the standing law, and
                    // the reason `hazardVolume` builds them through it.
                    expect(Number.isFinite(r.right) && Number.isFinite(r.bottom)).toBe(true);
                    expect(r.right).toBeGreaterThan(r.x);
                    expect(r.bottom).toBeGreaterThan(r.y);
                }
            }
        }
        // ⛓ R6 SLICE 6b: 79 -> 83. L112 stopped refusing the combat role
        // when the Pod bill was paid, so its four pods are counted for the
        // first time — the level was `continue`d past for five rungs.
        expect(n).toBe(83);
        // 4 crushers + 9 whirlpools + THE FOUR PODS are the hard-avoid set.
        // ⛔ The pods are hard-avoid on a damage of ONE: the ladder's rung-4
        // verdict comes from the ungated position write, not the number.
        expect(byVerdict['hard-avoid']).toBe(17);
    });

    it('refuses a hazard with no transcribed volume rather than answering empty', () => {
        expect(() => hazardVolume({ tag: 'nonesuch', cx: 0, cy: 0 }, { width: 160, height: 160 }))
            .toThrow(/has no transcribed volume/);
    });

    it('covers every member of PUZZLEMENT_HAZARDS', () => {
        for (const tag of Object.keys(PUZZLEMENT_HAZARDS)) {
            expect(() => hazardVolume({ tag, cx: 100, cy: 100, attrs: {} },
                { width: 320, height: 320 }), tag).not.toThrow();
        }
    });

    it('the crusher is a PLUS of four 64 px trigger lanes, and hard-avoid', () => {
        // `Crusher.as:63-74`: each direction grows the 32x32 body by
        // `intDist` = 64 along one axis, and entering any of them arms a
        // charge. Damage 1000 means the ladder has only rung 4 for it.
        const v = hazardVolume({ tag: 'crusher', cx: 100, cy: 100, attrs: { tset: '-1' } },
            { width: 320, height: 320 });
        expect(v.verdict).toBe('hard-avoid');
        expect(v.rects).toHaveLength(5);
        // A box 70 px to the +x is inside the lane; 90 px is outside.
        expect(volumeHitsBox(v, { x: 168, y: 96, right: 176, bottom: 104 })).toBeTruthy();
        expect(volumeHitsBox(v, { x: 190, y: 96, right: 198, bottom: 104 })).toBeNull();
        // ...and 70 px on the DIAGONAL is outside: the volume is a plus, not
        // a square, which is the whole reason it is four rects.
        expect(volumeHitsBox(v, { x: 150, y: 150, right: 158, bottom: 158 })).toBeNull();
    });

    it('the whirlpool is a 16 px disc with a knife edge', () => {
        const v = hazardVolume({ tag: 'whirlpool', cx: 100, cy: 100, attrs: {} },
            { width: 320, height: 320 });
        expect(v.verdict).toBe('hard-avoid');
        expect(v.discs).toEqual([{ x: 100, y: 100, r: 16, why: 'FP.distance < 16' }]);
        // centre-to-centre, exactly as `FP.distance` measures it
        expect(volumeHitsBox(v, { x: 110, y: 96, right: 118, bottom: 104 })).toBeTruthy();
        expect(volumeHitsBox(v, { x: 113, y: 96, right: 121, bottom: 104 })).toBeNull();
    });

    it('the arrow trap is a COLUMN, and the arrows are damage 1', () => {
        const v = hazardVolume({ tag: 'arrowtrap', cx: 100, cy: 40, attrs: { tset: '0', shoot: '1' } },
            { width: 320, height: 320 });
        expect(v.exactness).toBe('activator');
        expect(v.rects[0]).toMatchObject({ x: 94, y: 40, w: 12 });
        expect(v.rects[0].bottom).toBe(320);
        expect(v.why).toContain('damage 1 (NOT the 5, which is the SPEED)');
    });

    it('the spinning axe is a 32 px disc — the union over its own angles', () => {
        const v = hazardVolume({ tag: 'spinningaxe', cx: 100, cy: 100, attrs: { rate: '6' } },
            { width: 320, height: 320 });
        expect(v.discs[0].r).toBe(32);
        expect(v.exactness).toBe('exact');
        expect(v.why).toContain('rate 6');
    });

    it('the lavachain arm is 48 px long, in its own declared direction', () => {
        // `w = graphic.width - Tile.w` = 64 - 16 = 48.
        const east = hazardVolume({ tag: 'lavachain', cx: 100, cy: 100, attrs: { dir: '0' } },
            { width: 320, height: 320 });
        expect(east.rects[1]).toMatchObject({ x: 108, y: 92, w: 48, h: 16 });
        const north = hazardVolume({ tag: 'lavachain', cx: 100, cy: 100, attrs: { dir: '1' } },
            { width: 320, height: 320 });
        expect(north.rects[1]).toMatchObject({ x: 92, y: 44, w: 16, h: 48 });
    });

    it('the beamtower band reaches the level edge and carries the bob', () => {
        const v = hazardVolume(
            { tag: 'beamtower', cx: 100, cy: 100, attrs: { direction: '0', speed: '1' } },
            { width: 320, height: 320 },
        );
        const band = v.rects[1];
        expect(band.x).toBe(106);
        expect(band.right).toBe(320);
        // 5 px of beam plus the 8.6 px of bob it rides on.
        expect(band.h).toBeCloseTo(5 + BEAM_BOB_SPAN, 3);
        // ⚠ The body is Solid and bobs with it, so the BLOCKING geometry
        // moves too — which is why the body rect is swept as well.
        expect(v.rects[0].h).toBeCloseTo(32 + BEAM_BOB_SPAN, 3);
    });
});

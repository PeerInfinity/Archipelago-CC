/**
 * pull.test — U12-swim D1/D2: `Pull.update` as transcribed, and the funnel the
 * planner admits as a ride. The game witnesses are `u12-pull-carry` and
 * `u12-pull-cross` (tapeRunner); these rows pin the pieces.
 */
import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createPulls, pullModelled, pullsDrainingInto, pushBody } from './pull.js';
import { PIN_NAMES } from './tapeFormat.js';

const levelSource = atlasLevelSource();
const PIT = Object.freeze({ tx: 36, ty: 43 });
const FROM = Object.freeze({ x: 424, y: 224 });

const l12Pulls = () => createPulls(levelSource(12).entities);

function stepTwentyFourRun() {
    return createLevelRun({
        levelSource,
        boot: { level: 12, x: FROM.x, y: FROM.y },
        noclip: false,
        noHazards: [],
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [0], seal_parts: [] },
        rng: null,
        seam: { items: { hasSword: true, hasShield: true } },
        roles: ROLES,
    });
}

describe('pull — the transcription', () => {
    it('lists L12\'s pulls in UPDATE order — the reverse of the .oel add order', () => {
        const pulls = l12Pulls();
        expect(pulls.map((p) => p.id).slice(0, 2)).toEqual(['pull@592,720', 'pull@560,720']);
        expect(pulls.at(-1).id).toBe('pull@576,640');
    });

    it('keeps the AS3\'s own trigonometry, not a rounded unit vector', () => {
        const south = l12Pulls().find((p) => p.id === 'pull@576,640');
        expect(south.cosTerm).toBe(Math.cos(0.75 * Math.PI * 2));
        expect(south.sinTerm).toBe(-1);
        expect(south.cosTerm).not.toBe(0);
    });

    it('pushes a box straddling two cells of one current TWICE in a frame', () => {
        // y 654: the box [652, 657) overlaps 640's cell and 656's.
        const r = pushBody(l12Pulls(), { x: 584, y: 654 }, playerBoxAt);
        expect(r.by).toEqual(['pull@576,656', 'pull@576,640']);
        expect(r.y).toBe(656);
    });

    it('moves nothing that does not overlap (strict AABB)', () => {
        // y 637: the box's bottom edge is y 640, the cell's top — touching, not overlapping.
        expect(pushBody(l12Pulls(), { x: 584, y: 637 }, playerBoxAt).by).toEqual([]);
    });

    it('refuses a pull whose attributes are not numbers, by name', () => {
        expect(() => createPulls([{ type: 'pull', x: 0, y: 0, attrs: { force: '1' } }]))
            .toThrow(/a NaN/);
    });
});

describe('pull — the funnel (D2)', () => {
    it('drains every L12 current into the pit (36,43), and none into a tile away from the funnel', () => {
        expect(pullsDrainingInto(l12Pulls(), PIT).map((p) => p.id).sort())
            .toEqual(l12Pulls().map((p) => p.id).sort());
        expect(pullsDrainingInto(l12Pulls(), { tx: 30, ty: 30 })).toEqual([]);
    });

    it('reads every L12 pull as MODELLED, and a pull over a solid as not', () => {
        const run = stepTwentyFourRun();
        for (const p of l12Pulls()) expect(pullModelled(p, run.world).modelled).toBe(true);
        const fake = { collidesSolid: () => ({ tag: 'rock', x: 1, y: 2 }) };
        const m = pullModelled(l12Pulls()[0], fake);
        expect(m.modelled).toBe(false);
        expect(m.why).toMatch(/rock@1,2/);
    });
});

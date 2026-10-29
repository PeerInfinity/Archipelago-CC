/**
 * ⛓ RULES offgrid-blockers — THE ROUNDING LAW, MEASURED: a blocker placed off the 16 px grid seals only the
 * tiles it covers whole (`entitySealedTiles`), and the census (`census-seedling-offgrid-blockers.mjs`) asks the
 * physics model whether the player's box really goes round it everywhere else.
 *
 * Pinned so the count cannot drift silently: a new off-grid blocker, a moved one, or a grid change that turns
 * a harmless split into a LOOSER one reds a row here and has to be read.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { buildPlaythroughAtlas, PLAYTHROUGH_MAP } from './make-seedling-playthrough-rules.mjs';
import { censusOffGridBlockers, censusLevel, isFinding } from './census-seedling-offgrid-blockers.mjs';

let atlas;
let rows;
beforeAll(() => {
    atlas = buildPlaythroughAtlas();
    rows = censusOffGridBlockers({ atlas });
}, 300_000);

const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);

describe('the off-grid blocker census', () => {
    it('counts 61 non-open entities off the 16 px grid, in 41 levels', () => {
        expect(rows.length).toBe(61);
        expect(new Set(rows.map((r) => r.level)).size).toBe(41);
    });

    it('six of them split a component the grid calls one room; none of the splits loses anything (0 LOOSER)', () => {
        // Each minor pocket holds no exit or location, and borders only crossing material its room's main pocket
        // borders too (L72's lava, L115's water) or none at all (an NPC's corner, a spire's corner).
        const splits = rows.filter((r) => r.splits.length > 0).map((r) => `L${r.level} ${r.blocker}`);
        expect(splits).toEqual([
            'L34 adnanchar@56,48',
            'L35 forestchar@56,16',
            'L72 lavachain@240,152',
            'L114 dungeonspire@40,112',
            'L114 dungeonspire@104,112',
            'L115 dungeonspire@72,32',
        ]);
        expect(rows.flatMap((r) => r.splits.filter(isFinding).map(() => `L${r.level} ${r.blocker}`))).toEqual([]);
    });

    it('0 TIGHTER: the sealed tiles the box still has room on join nothing and misbind no door', () => {
        // Named, not assumed away: where the semantics' rect is fuller than the model's collider (snowhill's
        // pixel mask; the iceturret and moonrockpile rects the model leaves room in) a tile is sealed whole that
        // the box can stand on. Each joins at most one component, and the doors on two of them bind where the box
        // walks from them (the "door drawn on a wall" convention), so the rules lose nothing.
        const room = rows.flatMap((r) => r.tighter.map((t) => `L${r.level} ${r.blocker} [${t.tile}]`));
        expect(room).toEqual([
            'L2 moonrockpile@40,16 [3,1]',
            'L40 iceturret@472,400 [30,25]',
            'L40 iceturret@472,400 [30,26]',
            'L47 snowhill@184,72 [13,7]',
            'L47 snowhill@184,72 [14,7]',
            'L98 iceturret@104,24 [7,2]',
        ]);
        expect(rows.flatMap((r) => r.tighter.filter((t) => t.finding).map((t) => `L${r.level} [${t.tile}]`))).toEqual([]);
    });
});

describe('the census sees a LOOSER split when there is one (controls)', () => {
    // L114's 2-tile corridor (x 64..96) with a location planted at its north end: two spires shifted off the
    // grid close it to a 2 px gap; one centred spire leaves 8 px each side, which the 4 px box walks.
    const plant = (entities) => {
        const level = levelOf(114);
        const spire = level.entities.find((e) => e.type === 'dungeonspire');
        const region = atlas.regions.find((r) => r.map_ref === 114);
        return censusLevel(
            { ...level, entities: [...level.entities, ...entities.map(([x, y]) => ({ ...spire, x, y }))] },
            { ...region, locations: [...(region.locations ?? []), { name: 'planted', tile: [4, 3] }] },
        );
    };

    it('two spires that close the corridor: LOOSER', () => {
        const row = plant([[66, 104], [82, 104]]).find((r) => r.blocker === 'dungeonspire@66,104');
        expect(row.splits.some(isFinding)).toBe(true);
    });

    it('one spire the box walks round: no split', () => {
        const row = plant([[72, 104]]).find((r) => r.blocker === 'dungeonspire@72,104');
        expect(row.splits).toEqual([]);
    });
});

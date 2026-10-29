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
import {
    censusOffGridBlockers, censusLevel, censusSealedRoom, isFinding, maskPartialTiles, SEAL_KEPT,
} from './census-seedling-offgrid-blockers.mjs';
import { entitySemantics, entityClaims } from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import { ENTITY_COLLIDERS } from '../../frontend/modules/flashPanel/seedlingEntityColliders.js';
import { modelFloodTiles } from '../../frontend/modules/seedlingDemo/seedlingModelOracles.js';

let atlas;
let rows;
let room;
beforeAll(() => {
    atlas = buildPlaythroughAtlas();
    rows = censusOffGridBlockers({ atlas });
    room = censusSealedRoom({ atlas });
}, 300_000);

const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);

describe('the off-grid blocker census', () => {
    it('counts 65 non-open entities off the 16 px grid, in 43 levels', () => {
        // ⛓ rules-collider-mismatch: 61 -> 65, 41 -> 43 — the census now also asks every SEALING pixel-mask entity (its
        // seal is its mask's opaque tiles, as off the grid as its outline): the four grid-placed opentrees (L12 x2, L27,
        // L65); snowhill was already off the grid.
        expect(rows.length).toBe(65);
        expect(new Set(rows.map((r) => r.level)).size).toBe(43);
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

    it('0 TIGHTER: the off-grid sealed tiles the box still has room on join nothing and misbind no door', () => {
        // Off the grid, 4 of the whole game's sealed-with-room tiles (below). The door on one binds where the box
        // walks from it (the "door drawn on a wall" convention), so the rules lose nothing.
        expect(rows.flatMap((r) => r.tighter).length).toBe(4);
        expect(rows.flatMap((r) => r.tighter.filter((t) => t.finding).map((t) => `L${r.level} [${t.tile}]`))).toEqual([]);
    });
});

/**
 * ⛓ RULES collider-mismatch — THE SEAL AND THE MODEL'S COLLIDER CANNOT DISAGREE ON GEOMETRY. `entityClaims` reads
 * the collider the model collides with (a pixel mask's tiles included), so a sealed tile the box has room on is
 * never the collider's SHAPE: it is the model's PRESENCE (L2's moonrockpile, absent until `{2,0}` is cleared,
 * which the delivered set never does) or SOLIDITY (an alive IceTurret is an "Enemy", not a "Solid"; its blasts
 * and contact hold the player off, its corpse latches "Solid"), both witnessed on the game by
 * `probe-seedling-collider-cells.mjs`. Before the fix the census missed 8 of the 14 (grid-aligned opentrees).
 */
describe('every sealed tile, on the grid or off it', () => {
    const collides = (entity, [tx, ty]) => {
        const c = ENTITY_COLLIDERS[entity.type];
        const x = entity.x + c.left;
        const y = entity.y + c.top;
        return tx * 16 >= x && ty * 16 >= y && (tx + 1) * 16 <= x + c.w && (ty + 1) * 16 <= y + c.h;
    };

    it('counts 4 sealed tiles with room for the box, 0 TIGHTER, each kept for a named reason', () => {
        expect(room.length).toBe(4);
        expect(room.filter((t) => t.finding)).toEqual([]);
        expect(room.filter((t) => !SEAL_KEPT[t.blocker.split('@')[0]])).toEqual([]);
    });

    it('THE CONVERSE: 23 pixel-mask tiles a wall leaves walkable, and the box has room on every one', () => {
        // The rounding law over a mask (`entityClaims`): a partly covered tile is open. Each must hold the 4x5 box
        // (model flood), and the LOOSER split test above passes the five pixel-mask walls through it: no split.
        const partial = PLAYTHROUGH_MAP.levels.flatMap(maskPartialTiles);
        expect(partial.length).toBe(23);
        expect(partial.filter((t) => !t.fits)).toEqual([]);
    }, 120_000);

    it('every one is a rect the model collider covers WHOLE (presence or solidity, never shape)', () => {
        const shape = room.filter((t) => {
            const entity = levelOf(t.level).entities.find((e) => `${e.type}@${e.x},${e.y}` === t.blocker);
            return ENTITY_COLLIDERS[entity.type]?.collider !== 'rect' || !collides(entity, t.tile);
        });
        expect(shape).toEqual([]);
    });

    it('control: the rect law over a pixel mask (the pre-fix seal) seals L47\'s notch, where the box has room', () => {
        const level = levelOf(47);
        const hill = level.entities.find((e) => e.type === 'snowhill');
        const sem = entitySemantics(hill);
        const byRect = entityClaims(hill, sem).map((c) => c.tile);
        const byMask = entityClaims(hill, sem, { pixelMaskFootprints: true })
            .filter((c) => c.semantics.kind === 'wall').map((c) => c.tile);
        const notch = byRect.filter(([x, y]) => !byMask.some(([mx, my]) => mx === x && my === y));
        expect(notch).toEqual([[13, 7], [14, 7]]);
        for (const t of notch) expect(modelFloodTiles(level, [t], () => false).length).toBeGreaterThan(0);
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

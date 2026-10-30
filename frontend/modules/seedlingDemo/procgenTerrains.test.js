/**
 * ⛓ seedling-gen-terrains (C3) — THE WALK-CHANGING TERRAINS: ice, igneous-to-lava
 * (`melt`), cliff stairs, ghost step and lava. The fast rows (the heavy ones,
 * certify-N and the lava REQUIRED grade, are `seedlingGenTerrains.slow.test.js`):
 *
 * 1. the TERRAIN rows: the column, the type, and that the engine models the type;
 * 2. the pin rule: a lava record owes `sound`, and its MUTANT (the old water-only
 *    rule) throws `PhysicsV2Error` where the derived pins certify;
 * 3. the floods: lava and igneous block before the dark suit and are walked with it;
 * 4. the opt-in: `withTerrains` appends, refuses an unoffered terrain by name, and
 *    the old biomes' rosters hold no terrain template;
 * 5. each template's placement: a room restricted to it keeps it and paints it.
 */
import { describe, it, expect } from 'vitest';

import {
    TERRAIN, bootAtTile, emptyLevel, floodTerrainsFor, oelAtTile, recordHoldsWater, recordOwesSoundPin,
    terrainAt, withEntities, withTerrain,
} from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import {
    POST_DARK_SUIT_ITEMS, POST_DARK_SUIT_PALETTE, POST_FEATHER_PALETTE, POST_SPEAR_ITEMS, POST_SWIM_PALETTE,
    POST_SWORD_ITEMS, TERRAIN_OFFERS, TERRAIN_TEMPLATES, restrictPalette, withTerrains,
} from './procgenPalette.js';
import { generateSeedlingLevel, pinsForRecord, seedlingModel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { MODELLED_TILE_TYPES } from './levelWorld.js';
import { GENERATE_BIOMES } from './watchGenerate.js';

/** The design's §3.2 band: a two-cell-wide band of one terrain down a bordered 10x10, the torch beyond it. */
const band = (terrain) => {
    const base = emptyLevel({ level: 900 });
    const cells = [];
    for (let ty = 1; ty < base.height - 1; ty += 1) for (const tx of [4, 5]) cells.push({ tx, ty, terrain });
    return withEntities(withTerrain(base, cells),
        [{ type: 'torchpickup', ...oelAtTile(8, 8), attrs: { tag: '0' } }]);
};
const solveBand = (record, items, pins) => solve(record, bootStaging({ boot: bootAtTile(record, 1, 1), items, pins }),
    [collectGoal(8 * 16, 8 * 16)], DEFAULT_BUDGET, { name: 'terrain-band' });

describe('C3 — the TERRAIN rows', () => {
    it.each([['ice', 24, 22], ['lava', 19, 17], ['melt', 38, 31], ['stairs', 12, 10], ['ghoststep', 37, 30]])(
        '%s is column %i, type %i, and the engine models the type', (name, column, type) => {
            expect(TERRAIN[name]).toEqual({ name, column, type });
            expect(MODELLED_TILE_TYPES).toContain(type);
        });
});

describe('C3 — the pin rule: lava owes `sound`, and its mutant throws', () => {
    it('lava and igneous owe the pin; ice, stairs and ghost step do not; water still does', () => {
        for (const t of ['lava', 'melt', 'water', 'waterfall']) expect(recordOwesSoundPin(band(t))).toBe(true);
        for (const t of ['ice', 'stairs', 'ghoststep', 'pit']) expect(recordOwesSoundPin(band(t))).toBe(false);
        expect(pinsForRecord(band('lava'))).toEqual(['dead_frames', 'sound']);
        expect(pinsForRecord(band('ice'))).toEqual(['dead_frames']);
    });

    it('a dark-suit walk across lava CERTIFIES under the derived pins; the old water-only rule THROWS', () => {
        const rec = band('lava');
        const out = solveBand(rec, POST_DARK_SUIT_ITEMS, pinsForRecord(rec));
        expect(out.verdict).toBe('SOLVED');
        expect(out.certification?.certified).toBe(true);
        /** ⛔ The mutant: the rule before this slice read water only, so a lava room got no `sound`. */
        expect(recordHoldsWater(rec)).toBe(false);
        const mutantPins = recordHoldsWater(rec) ? ['dead_frames', 'sound'] : ['dead_frames'];
        expect(() => solveBand(rec, POST_DARK_SUIT_ITEMS, mutantPins)).toThrow(/entered Lava.*does not pin "sound"/s);
    }, 60_000);

    it('without the dark suit the lava band is REFUSED (no corridor), pin or not', () => {
        const out = solveBand(band('lava'), POST_SPEAR_ITEMS, ['dead_frames', 'sound']);
        expect(out.verdict).toBe('REFUSED');
    }, 60_000);
});

describe('C3 — the floods (`floodTerrainsFor`)', () => {
    it('ice, stairs and ghost step are walked at every boot; lava and igneous only with the dark suit', () => {
        for (const [name, palette] of Object.entries(GENERATE_BIOMES)) {
            const walks = floodTerrainsFor(palette.items);
            for (const t of ['ground', 'ice', 'stairs', 'ghoststep']) expect(walks, name).toContain(t);
            const suit = palette.items?.hasDarkSuit === true;
            expect(walks.includes('lava'), name).toBe(suit);
            expect(walks.includes('melt'), name).toBe(suit);
            for (const t of ['wall', 'water', 'pit', 'waterfall']) expect(walks, name).not.toContain(t);
        }
    });

    it('a lava pool that would SEAL the room is refused before the dark suit and legal with it', () => {
        /** A 10x10 whose interior is cut by a wall at x=5 except one gap at (5,4); a 1x1 lava pool on the gap. */
        const lava = TERRAIN_TEMPLATES.find((t) => t.family === 'lava').instantiate(null, { w: 1, h: 1 });
        const verdict = (floodTerrains) => {
            const model = seedlingModel({ seed: 1, floodTerrains });
            const rec0 = model.skeleton();
            const wall = [];
            for (let ty = 1; ty < rec0.height - 1; ty += 1) if (ty !== 4) wall.push({ tx: 5, ty, terrain: 'wall' });
            const rec = withTerrain(rec0, wall);
            expect(model.goalCell.tx === 5).toBe(false);
            return model.refusalAt(rec, lava, 5, 4);
        };
        expect(verdict(floodTerrainsFor(POST_SPEAR_ITEMS))).toMatch(/would SEAL the room/);
        expect(verdict(floodTerrainsFor(POST_DARK_SUIT_ITEMS))).toBe(null);
    });
});

describe('C3 — the opt-in (`withTerrains`, `TERRAIN_OFFERS`)', () => {
    it('no old biome\'s roster holds a terrain template; D7 and later hold lava and igneous', () => {
        const terrainNames = TERRAIN_TEMPLATES.map((t) => t.name);
        for (const name of ['pre-sword', 'post-sword', 'post-shield', 'post-swim', 'post-feather', 'post-fire']) {
            expect(GENERATE_BIOMES[name].templates.map((t) => t.name).filter((n) => terrainNames.includes(n)), name)
                .toEqual([]);
        }
        for (const name of ['post-spear', 'post-dark-suit', 'endgame']) {
            expect(GENERATE_BIOMES[name].templates.map((t) => t.name).slice(-2), name)
                .toEqual(['lava-pool', 'melt-patch']);
        }
    });

    it('the offers are D5\'s ice and the mountain/D6\'s stairs and ghost step', () => {
        expect(TERRAIN_OFFERS).toEqual({ 'post-swim': ['ice'], 'post-feather': ['stairs', 'ghoststep'] });
    });

    it('appends after the roster, names the palette, and an empty list is the palette itself', () => {
        const p = withTerrains(POST_FEATHER_PALETTE, 'stairs+ghoststep');
        expect(p.name).toBe('post-feather+ghoststep+stairs');
        expect(p.templates.slice(0, -2)).toEqual(POST_FEATHER_PALETTE.templates);
        expect(p.templates.slice(-2).map((t) => t.name)).toEqual(['ghoststep-patch', 'stairs-patch']);
        expect(p.items).toBe(POST_FEATHER_PALETTE.items);
        expect(withTerrains(POST_SWIM_PALETTE, '')).toBe(POST_SWIM_PALETTE);
        expect(withTerrains(POST_SWIM_PALETTE, undefined)).toBe(POST_SWIM_PALETTE);
    });

    it('an unoffered terrain REFUSES BY NAME', () => {
        expect(() => withTerrains(POST_SWIM_PALETTE, 'lava'))
            .toThrow(/biome "post-swim" does not offer the terrain "lava" — it offers \[ice\]/);
        expect(() => withTerrains(GENERATE_BIOMES['post-sword'], 'ice')).toThrow(/offers \[\]/);
    });
});

/** Each template alone, one seed, 10x10 `empty`, two obstacles: it is kept, painted, and the room solves. */
const PLACEMENTS = [
    ['ice-sheet', withTerrains(POST_SWIM_PALETTE, 'ice'), 'ice'],
    ['stairs-patch', withTerrains(POST_FEATHER_PALETTE, 'stairs'), 'stairs'],
    ['ghoststep-patch', withTerrains(POST_FEATHER_PALETTE, 'ghoststep'), 'ghoststep'],
    ['lava-pool', POST_DARK_SUIT_PALETTE, 'lava'],
    ['melt-patch', POST_DARK_SUIT_PALETTE, 'melt'],
];
describe('C3 — each template\'s placement (seed 1, the template alone)', () => {
    it.each(PLACEMENTS)('%s', (name, palette, terrain) => {
        const out = generateSeedlingLevel({ seed: 1, palette: restrictPalette(palette, { axis: 'templates', names: [name] }),
            bounds: { obstacleTarget: 2, triesPerStep: 4, saturationK: 3 }, skeleton: seedlingSkeletonSpec('empty'),
            elements: { name: 'none' } });
        expect(out.summary.stop).toBe('TARGET_REACHED');
        const kept = out.summary.kept.filter((k) => k.template === name);
        expect(kept.length).toBe(2);
        for (const k of kept) {
            const t = TERRAIN_TEMPLATES.find((x) => x.name === name).instantiate(null, k.params);
            for (const w of t.terrain) expect(terrainAt(out.record, k.at.tx + w.dx, k.at.ty + w.dy)).toBe(terrain);
        }
        expect(out.summary.pins.includes('sound')).toBe(terrain === 'lava' || terrain === 'melt');
    }, 120_000);
});

it('a pre-dark-suit boot still crosses an igneous band (the walk does not linger)', () => {
    const out = solveBand(band('melt'), POST_SWORD_ITEMS, ['dead_frames', 'sound']);
    expect(out.verdict).toBe('SOLVED');
}, 60_000);

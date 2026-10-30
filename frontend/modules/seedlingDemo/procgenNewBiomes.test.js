/**
 * ⛓ seedling-gen-new-biomes (C4) — THE THREE NEW BIOMES: `caldera`, `frozen-forge`,
 * `flooded-ruins` (the gen-content design's §3.4). The fast rows (certify-N and the
 * byte identity of the existing outputs are `seedlingGenNewBiomes.slow.test.js`):
 *
 * 1. per biome: the boot, the roster (its default terrains), the flood, the look, and
 *    the names (one list in every spelling; opt-in, not in the census default);
 * 2. caldera's FLOOD: melt is walked before the dark suit in caldera ONLY. Every other
 *    biome's flood is its items' own, so no existing output can move through it; a
 *    melt crust on the only gap is legal in caldera and still "would SEAL" elsewhere;
 * 3. caldera's NO-LINGER certificate: the solver crosses a melt band without a death,
 *    and its MUTANT (the same tape, waiting on the crust) dies in lava and is refused
 *    by the oracle's `lavaDeathRefusal`.
 */
import { describe, it, expect } from 'vitest';

import {
    atlasOf, bootAtTile, emptyLevel, floodTerrainsFor, oelAtTile, terrainAt, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, bootStaging, collectGoal, lavaDeathRefusal, lavaDeathsOf, solve,
} from './procgenOracle.js';
import {
    CALDERA_PALETTE, FLOODED_RUINS_PALETTE, FROZEN_FORGE_PALETTE, POST_DARK_SUIT_ITEMS, POST_FEATHER_ITEMS,
    POST_SWORD_ITEMS, POST_SWORD_TEMPLATES, TERRAIN_OFFERS, TERRAIN_TEMPLATES, restrictPalette,
} from './procgenPalette.js';
import { GEN_LOOKS, assertLookCosmetic, labLookOf } from './procgenLook.js';
import { seedlingModel } from './procgenSeedling.js';
import { GEN_ROOM_BIOMES } from './seedlingGenRoom.js';
import { GEN_ROOM_BIOME_NAMES } from './seedlingGenRoomPayload.js';
import { BIOME_NAMES, DEFAULT_CENSUS_BIOMES, GENERATE_BIOMES } from './watchGenerate.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { heldKeysAt } from './tapeFormat.js';
import { levelSourceFromAtlas } from './atlasSource.js';

const NEW = ['caldera', 'frozen-forge', 'flooded-ruins'];
const rosterOf = (p) => p.templates.map((t) => t.name);
const base = POST_SWORD_TEMPLATES.map((t) => t.name);

describe('C4 — each new biome: boot, roster, flood, look', () => {
    it.each([
        ['caldera', CALDERA_PALETTE, POST_SWORD_ITEMS, [...base, 'lava-pool', 'melt-patch'], ['melt'],
            { floor: 44, wall: 17 }],
        ['frozen-forge', FROZEN_FORGE_PALETTE, POST_DARK_SUIT_ITEMS, [...base, 'ice-sheet', 'lava-pool'], undefined,
            { floor: 20, wall: 25 }],
        ['flooded-ruins', FLOODED_RUINS_PALETTE, POST_FEATHER_ITEMS, ['water-pool', 'pit-patch'], undefined,
            { floor: GEN_LOOKS['pre-sword'].floor, wall: GEN_LOOKS['pre-sword'].wall }],
    ])('%s', (name, palette, items, roster, floodWalks, look) => {
        expect(palette.name).toBe(name);
        expect(palette.items).toBe(items);
        expect(rosterOf(palette)).toEqual(roster);
        expect(palette.floodWalks).toEqual(floodWalks);
        expect(GENERATE_BIOMES[name]).toBe(palette);
        expect(GEN_ROOM_BIOMES[name]).toBe(palette);
        expect(GEN_LOOKS[name]).toMatchObject(look);
        expect(assertLookCosmetic(name, GEN_LOOKS[name])).toBe(true);
        /** ⛓ The lab's "own" look draws the biome in its own row. */
        expect(labLookOf('own', name)).toBe(name);
        /** The terrains are the roster's own: a new biome offers none opt-in. */
        expect(TERRAIN_OFFERS[name]).toBeUndefined();
    });

    it('the names: one list in every spelling, appended last; opt-in (not in the census default)', () => {
        expect(BIOME_NAMES.slice(-3)).toEqual(NEW);
        expect(GEN_ROOM_BIOME_NAMES.slice(-3)).toEqual(NEW);
        for (const n of NEW) expect(DEFAULT_CENSUS_BIOMES).not.toContain(n);
    });

    it('frozen-forge walks ice and lava; flooded-ruins walks neither lava nor melt', () => {
        const forge = floodTerrainsFor(FROZEN_FORGE_PALETTE.items, FROZEN_FORGE_PALETTE.floodWalks);
        for (const t of ['ice', 'lava', 'melt']) expect(forge).toContain(t);
        const ruins = floodTerrainsFor(FLOODED_RUINS_PALETTE.items, FLOODED_RUINS_PALETTE.floodWalks);
        for (const t of ['lava', 'melt', 'water', 'waterfall', 'pit']) expect(ruins).not.toContain(t);
    });
});

describe('C4 — caldera\'s flood (`floodWalks`), and that it moves no other biome', () => {
    it('every other biome\'s flood is its items\' own, exactly as before this slice', () => {
        for (const [name, palette] of Object.entries(GENERATE_BIOMES)) {
            if (name === 'caldera') continue;
            expect(palette.floodWalks, name).toBeUndefined();
            expect(floodTerrainsFor(palette.items, palette.floodWalks), name).toEqual(floodTerrainsFor(palette.items));
        }
        /** The item-only sets, spelled out (the terrains slice's rows, unchanged). */
        expect(floodTerrainsFor(POST_SWORD_ITEMS)).toEqual(['ground', 'ice', 'stairs', 'ghoststep']);
        expect(floodTerrainsFor(POST_DARK_SUIT_ITEMS)).toEqual(['ground', 'ice', 'stairs', 'ghoststep', 'lava', 'melt']);
    });

    it('caldera adds melt and nothing else: lava still blocks without the suit', () => {
        expect(floodTerrainsFor(CALDERA_PALETTE.items, CALDERA_PALETTE.floodWalks))
            .toEqual(['ground', 'ice', 'stairs', 'ghoststep', 'melt']);
        expect(() => floodTerrainsFor(POST_SWORD_ITEMS, ['magma'])).toThrow(/"magma" is not a TERRAIN name/);
    });

    it('a roster restriction keeps the flood; other palettes gain no key', () => {
        const r = restrictPalette(CALDERA_PALETTE, { axis: 'templates', names: ['melt-patch'] });
        expect(r.floodWalks).toEqual(['melt']);
        const p = restrictPalette(GENERATE_BIOMES['post-spear'], { axis: 'templates', names: ['melt-patch'] });
        expect('floodWalks' in p).toBe(false);
    });

    it('the "would SEAL" re-measure: a crust on the only gap is legal in caldera, refused at post-sword and post-spear', () => {
        /** The terrains slice's room: a 10x10 cut by a wall at x=5 except one gap at (5,4); a 1x1 patch on the gap. */
        const tpl = (family) => TERRAIN_TEMPLATES.find((t) => t.family === family).instantiate(null, { w: 1, h: 1 });
        const verdict = (floodTerrains, family) => {
            const model = seedlingModel({ seed: 1, floodTerrains });
            const rec0 = model.skeleton();
            const wall = [];
            for (let ty = 1; ty < rec0.height - 1; ty += 1) if (ty !== 4) wall.push({ tx: 5, ty, terrain: 'wall' });
            return model.refusalAt(withTerrain(rec0, wall), tpl(family), 5, 4);
        };
        const caldera = floodTerrainsFor(CALDERA_PALETTE.items, CALDERA_PALETTE.floodWalks);
        expect(verdict(caldera, 'melt')).toBe(null);
        expect(verdict(floodTerrainsFor(POST_SWORD_ITEMS), 'melt')).toMatch(/would SEAL the room/);
        expect(verdict(floodTerrainsFor(GENERATE_BIOMES['post-spear'].items), 'melt')).toMatch(/would SEAL the room/);
        expect(verdict(caldera, 'lava')).toMatch(/would SEAL the room/);
    });
});

/** The design's §3.2 band: a two-cell-wide melt band down a bordered 10x10, the torch beyond it. */
const meltBand = () => {
    const rec = emptyLevel({ level: 900 });
    const cells = [];
    for (let ty = 1; ty < rec.height - 1; ty += 1) for (const tx of [4, 5]) cells.push({ tx, ty, terrain: 'melt' });
    return withEntities(withTerrain(rec, cells), [{ type: 'torchpickup', ...oelAtTile(8, 8), attrs: { tag: '0' } }]);
};

/** Replay a tape on a fresh run; with `stall`, stand still that many ticks the first time the player is on melt. */
const replay = (record, tape, stall = 0) => {
    const run = createRunForStaging(solveStaging(stagingFromTape(tape)), levelSourceFromAtlas(atlasOf(record)));
    let stalled = false;
    for (let t = 0; t < tape.tick_count; t += 1) {
        const onMelt = terrainAt(record, Math.floor(run.state.x / 16), Math.floor(run.state.y / 16)) === 'melt';
        if (stall > 0 && !stalled && onMelt) {
            stalled = true;
            for (let k = 0; k < stall; k += 1) run.advance(new Set());
        }
        run.advance(heldKeysAt(tape, t));
    }
    return { run, stalled };
};

describe('C4 — caldera\'s no-linger certificate', () => {
    it('the solver crosses the crust with no death; the same tape WAITING on it dies in lava and is refused', () => {
        const rec = meltBand();
        const out = solve(rec, bootStaging({ boot: bootAtTile(rec, 1, 1), items: CALDERA_PALETTE.items,
            pins: ['dead_frames', 'sound'] }), [collectGoal(8 * 16, 8 * 16)], DEFAULT_BUDGET, { name: 'caldera-band' });
        expect(out.verdict).toBe('SOLVED');
        const clean = replay(rec, out.tape);
        expect(lavaDeathsOf(clean.run)).toEqual([]);
        expect(lavaDeathRefusal(clean.run)).toBe(null);
        /** ⛔ The mutant: 60 idle ticks on the first melt cell (the crust breaks 36 in-range renders in). */
        const mutant = replay(rec, out.tape, 60);
        expect(mutant.stalled).toBe(true);
        expect(lavaDeathsOf(mutant.run).length).toBeGreaterThan(0);
        const refusal = lavaDeathRefusal(mutant.run);
        expect(refusal.obstacle).toMatchObject({ kind: 'lava-death' });
        expect(refusal.reasonText).toMatch(/LAVA death/);
    }, 60_000);

    it('a wider crust than the walk can outrun does not exist at walk speed: a 10-wide band still solves', () => {
        const rec0 = emptyLevel({ level: 900, width: 14, height: 6 });
        const cells = [];
        for (let ty = 1; ty < rec0.height - 1; ty += 1) for (let tx = 2; tx < 12; tx += 1) cells.push({ tx, ty, terrain: 'melt' });
        const rec = withEntities(withTerrain(rec0, cells), [{ type: 'torchpickup', ...oelAtTile(12, 3), attrs: { tag: '0' } }]);
        const out = solve(rec, bootStaging({ boot: bootAtTile(rec, 1, 2), items: CALDERA_PALETTE.items,
            pins: ['dead_frames', 'sound'] }), [collectGoal(12 * 16, 3 * 16)], DEFAULT_BUDGET, { name: 'caldera-wide' });
        expect(out.verdict).toBe('SOLVED');
        expect(lavaDeathsOf(replay(rec, out.tape).run)).toEqual([]);
    }, 60_000);
});

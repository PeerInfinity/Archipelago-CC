/**
 * The map-document index the analysis glue looks a region's `map_ref` up in
 * (maze-lab arms F-a / plan §17.1 F11).
 *
 * ⛔ `indexSeedlingLevels` was the ONE of the repo's four "index rooms by level"
 * maps keyed by `String(level.level)`. Since it has always accepted "the
 * document or an already-built Map", a number-keyed Map from any of the other
 * three looked up as a string and MISSED — silently, as `undefined`. The key is
 * the number now; these rows are what says so, and what pins the conversion at
 * the lookups.
 *
 * ⛓ The rows go through the PUBLIC entry points as well as the index, because
 * `levelKeyOf` is not exported: what matters is that a region resolves, and
 * that the three shapes that never resolved still do not.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    analyzeSeedlingRegion, indexSeedlingLevels, seedlingMazeProjectionDeps,
} from './seedlingAtlasAnalysis.js';

/**
 * ⛓ THE COMMITTED EXTRACT, not an invented shape — 116 rooms, every `level` an
 * integer, which is the measurement the number key rests on.
 */
const MAP_DOC = JSON.parse(readFileSync(
    fileURLToPath(new URL('./atlases/seedling-map.json', import.meta.url)), 'utf8'));
const LEVEL_19 = MAP_DOC.levels.find((l) => l.level === 19);
const BOUNDS = { x: 0, y: 0, w: 4, h: 4 };
const atlasWith = (mapRef) => ({
    regions: [{ region_id: 'r', map_ref: mapRef, bounds: BOUNDS, exits: [] }],
});
const deps = { mapDoc: MAP_DOC, gameConfig: {} };

describe('indexSeedlingLevels — the number key', () => {
    it('every level in the committed extract has an INTEGER id — the measurement the key rests on', () => {
        expect(MAP_DOC.levels.length).toBeGreaterThan(0);
        expect(MAP_DOC.levels.every((l) => Number.isInteger(l.level))).toBe(true);
    });

    it('keys by the NUMBER, so a stringified lookup misses', () => {
        const levels = indexSeedlingLevels(MAP_DOC);
        expect(levels.get(19)).toBe(LEVEL_19);
        expect(levels.get('19')).toBeUndefined();
    });

    /**
     * ⛔⛔ THE TRAP THIS RUNG CLOSES. `seedlingRandomizerWiring.js` and
     * `atlasSource.js` build NUMBER-keyed maps; handing one here used to be a
     * map whose every lookup returned `undefined`, with nothing to say so.
     */
    it('a number-keyed Map from ANOTHER of the four indexes now looks up', () => {
        const fromElsewhere = new Map(MAP_DOC.levels.map((l) => [l.level, l]));
        expect(indexSeedlingLevels(fromElsewhere).get(19)).toBe(LEVEL_19);
    });
});

describe('a region\'s map_ref resolves through the conversion', () => {
    it('an INTEGER map_ref resolves — the shape every atlas in the repo carries', () => {
        const out = analyzeSeedlingRegion(atlasWith(19), 'r', deps);
        expect(out.level).toBe(19);
        expect(out.skipped).toBeUndefined();
    });

    /**
     * ⛓ `region-atlas.schema.json:126-128` allows *"an integer or non-empty
     * string level id"*, and a Seedling level id IS an integer, so `"19"` named
     * level 19 when this index was string-keyed. It still does — the conversion
     * is at the caller, not a MISS shipped under a byte-inert claim.
     */
    it('a NUMERIC-STRING map_ref still resolves — converted at the lookup, not dropped', () => {
        expect(analyzeSeedlingRegion(atlasWith('19'), 'r', deps).level).toBe('19');
    });

    it('a NON-numeric string still misses, by name', () => {
        expect(() => analyzeSeedlingRegion(atlasWith('mz_3'), 'r', deps))
            .toThrow(/names map_ref "mz_3", which is not a level in the map document/);
    });

    /**
     * ⛔⛔ THE REASON THE CONVERSION IS A ROUND TRIP AND NOT `Number()`.
     * `Number(null)` is 0 and level 0 is the real starting room, so a naive
     * conversion would resolve a `map_ref: null` region to it.
     *
     * ⚠ **AND THE SUBJECT IS SYNTHETIC, BECAUSE NO COMMITTED DOCUMENT HAS ONE**
     * (maze-lab arms F-b, correcting F-a). This comment used to say *"three
     * regions in `atlases/seedling-fixture.json` carry exactly that"*; the row
     * below MEASURES the fixture and it carries none — the three regions OMIT
     * the key, which is what the schema blesses. The rule is unchanged
     * (`Number(undefined)` is NaN and misses either way) and this row's `null`
     * is written here, by hand, precisely because nothing on disk supplies one.
     */
    it('a NULL map_ref does not become LEVEL 0 — it is graph-only, as it always was', () => {
        expect(analyzeSeedlingRegion(atlasWith(null), 'r', deps).skipped).toMatch(/graph-only/);
        const gridFor = seedlingMazeProjectionDeps(deps).gridFor;
        expect(gridFor({ map_ref: null, bounds: BOUNDS })).toBeNull();
        expect(gridFor({ map_ref: undefined, bounds: BOUNDS })).toBeNull();
    });

    /**
     * ⛔ **A CENSUS IN A COMMENT IS UNFALSIFIABLE — so it is a ROW** (F-a's own
     * lesson, applied to F-a's own sentence). The docblock at
     * `seedlingAtlasAnalysis.js` cited three null `map_ref`s in this fixture;
     * this is the measurement, and it reds the day one is written.
     */
    it('⚖ the committed fixture carries NO null map_ref — the three regions OMIT the key', () => {
        const fixture = JSON.parse(readFileSync(
            fileURLToPath(new URL('./atlases/seedling-fixture.json', import.meta.url)), 'utf8'));
        const regions = fixture.regions;
        expect(regions).toHaveLength(3);
        expect(regions.filter((r) => 'map_ref' in r)).toHaveLength(0);
        expect(regions.filter((r) => r.map_ref === null)).toHaveLength(0);
        expect(regions.filter((r) => !('map_ref' in r))).toHaveLength(3);
    });

    it('and the padded / spaced strings that never resolved still do not', () => {
        const gridFor = seedlingMazeProjectionDeps(deps).gridFor;
        for (const mapRef of ['007', ' 19', '', 'mz_3']) {
            expect(gridFor({ map_ref: mapRef, bounds: BOUNDS })).toBeNull();
        }
    });

    it('the projection\'s gridFor answers an integer and a numeric string alike', () => {
        const gridFor = seedlingMazeProjectionDeps(deps).gridFor;
        expect(gridFor({ map_ref: 19, bounds: BOUNDS })).not.toBeNull();
        expect(gridFor({ map_ref: '19', bounds: BOUNDS })).not.toBeNull();
        expect(gridFor({ map_ref: 0, bounds: BOUNDS })).not.toBeNull();
    });
});

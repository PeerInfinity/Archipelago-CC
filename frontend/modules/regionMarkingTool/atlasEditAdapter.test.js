/**
 * ⛓⛓⛓ **THE ATLAS ADAPTER — `editCore`'s six words, spoken by the region
 * atlas.** EDITOR INTEGRATION arc, slice B-a (plan §3.1's marking-tool row).
 *
 * ⛔ THE FIXTURE IS DERIVED, NOT HAND-BUILT: its level's cell space, tile size
 * and `map_ref` come from the COMMITTED `seedling-map.json`, so the rectangle
 * these rows edit is a rectangle of the map the panel actually authors over.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    atlasesEqual, atlasWriteOps, createAtlasEditAdapter, readAtlasCell, regionAt,
} from './atlasEditAdapter.js';
import { AtlasSession, createEmptyAtlas } from './atlasSession.js';
import { applyAtlasOp } from '../procgenCore/atlasOps.js';
import {
    assertAdapter, assertAdapterBehaviour, canonicalJson, foldEdits, group,
} from '../procgenCore/editCore.js';
import { computeAtlasContentHash } from '../procgenPipeline/regionAtlasValidator.js';
import { compactJsonFile } from '../procgenPipeline/compactJson.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(
    path.join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8',
));
const LEVEL = MAP.levels[0];

const REGION = 'fixture_room';
const EXIT = 'north';
// ⛓ Three tiles along the level's TOP bounds line, so `add-exit` DERIVES side
//   `N` from the geometry — nothing here types it.
const EXIT_TILES = [[4, 0], [5, 0], [6, 0]];
const ENTRANCE = EXIT_TILES[1];
const AWAY = EXIT_TILES[2];
const LOC_TILE = [3, 3];
const LOC_NAME = 'Fixture - Chest';
// ⛓ A SUB-RECTANGLE of the level, not the whole of it: the descriptor for a
//   tile in NO region is a case the laws have to be able to reach.
const REGION_BOUNDS = { x: 0, y: 0, w: 10, h: 10 };
const OUTSIDE = [15, 15];

/** The fixture atlas, built the way the panel builds one: through the session. */
function fixture() {
    const s = new AtlasSession(createEmptyAtlas({
        game: 'seedling',
        mapSource: 'ogmo-extract',
        mapDocument: 'seedling-map.json',
        tileSize: MAP.tile_size,
    }));
    s.addRegion({
        region_id: REGION,
        bounds: REGION_BOUNDS,
        map_ref: LEVEL.level,
    });
    s.addExit(REGION, { exit_id: EXIT, tiles: EXIT_TILES, entrance_tile: ENTRANCE });
    s.addLocation(REGION, { name: LOC_NAME, tile: LOC_TILE, vanilla_item: 'Progressive Sword' });
    return s.atlas;
}

const view = () => ({ level: LEVEL.level, width: LEVEL.width, height: LEVEL.height });
const adapter = () => createAtlasEditAdapter({ levelView: view });

describe('atlasEditAdapter — shape and the seven laws', () => {
    it('satisfies assertAdapter, and REFUSES BY NAME with no levelView', () => {
        expect(assertAdapter(adapter())).toBeTruthy();
        // MUTANT: drop the levelView guard -> a `bounds` of undefined reaches
        // the core and law 1 reports a size instead of a missing map.
        expect(() => createAtlasEditAdapter()).toThrow(/`levelView` is REQUIRED/);
        expect(() => createAtlasEditAdapter({ levelView: () => null }).bounds({}))
            .toThrow(/map document is not loaded yet/);
    });

    /**
     * ⛓ LAW 7 RUNS ON THE **ENTRANCE**, and the two cells are two tiles of the
     * SAME exit — see the adapter's docblock. A pair of empty cells in one
     * region would pass with a `writeOps` that returned `[]`, which is the
     * vacuity law 7 exists to catch.
     */
    it('passes assertAdapterBehaviour over the derived fixture', () => {
        expect(assertAdapterBehaviour(adapter(), {
            record: fixture(),
            op: { op: 'add-location', region: REGION, name: 'Fixture - Second', tile: [7, 7] },
            refused: { op: 'add-location', region: 'nope', name: 'X', tile: [7, 7] },
            cell: { x: ENTRANCE[0], y: ENTRANCE[1] },
            other: { x: AWAY[0], y: AWAY[1] },
        })).toBe(true);
    });

    it('law 7 is NOT vacuous — an empty writeOps fails it', () => {
        const bad = { ...adapter(), writeOps: () => [] };
        expect(() => assertAdapterBehaviour(bad, {
            record: fixture(),
            op: { op: 'add-location', region: REGION, name: 'Fixture - Second', tile: [7, 7] },
            refused: { op: 'add-location', region: 'nope', name: 'X', tile: [7, 7] },
            cell: { x: ENTRANCE[0], y: ENTRANCE[1] },
            other: { x: AWAY[0], y: AWAY[1] },
        })).toThrow(/contract law 7/);
    });
});

describe('atlasEditAdapter.equal — KEY ORDER IS CONTENT', () => {
    /**
     * ⛔ THE BYTE ROW, and the reason the brief's `computeAtlasContentHash` was
     * overturned: both candidates sort keys at every depth, so both call these
     * two documents the same one — while the committed bytes differ.
     */
    it('a key-order-only difference is NOT equal, and its BYTES differ', () => {
        const a = fixture();
        const b = { ...a };
        // Same keys, same values, one pair swapped at the root.
        const reordered = {};
        const keys = Object.keys(b);
        [keys[0], keys[1]] = [keys[1], keys[0]];
        for (const k of keys) reordered[k] = b[k];

        expect(compactJsonFile(reordered)).not.toBe(compactJsonFile(a));   // the LAW
        expect(atlasesEqual(a, reordered)).toBe(false);                    // the discriminator

        /**
         * ⛔⛔ AND A PAIR THE VALUE COMPARISON CANNOT ANSWER — because the row
         * above CANNOT SEE THE KEY-NAME CHECK, measured (EDITOR INTEGRATION
         * B-c, trap 951). Delete `if (ka[i] !== kb[i]) return false;` from the
         * predicate and the swap above still reads `false`: the walk lands
         * `a[ka[i]]` against `b[kb[i]]`, finds two DIFFERENT VALUES, and answers
         * for a reason that has nothing to do with key order. The fixture's
         * first two keys hold different values, so it always will.
         *
         * ⇒ Two keys holding THE SAME VALUE, swapped. Only then does the value
         * comparison agree at every position and the key-NAME check become the
         * sole witness.
         */
        const same = { game: 'seedling', name: 'seedling' };
        const sameSwapped = { name: 'seedling', game: 'seedling' };
        expect(atlasesEqual(same, sameSwapped)).toBe(false);
        expect(atlasesEqual(
            { regions: { hall: { map_ref: 1, tile: 1 } } },
            { regions: { hall: { tile: 1, map_ref: 1 } } },
        )).toBe(false);                                                    // …and at DEPTH
        // MUTANT 1: equal = canonicalJson pair.
        expect(canonicalJson(a)).toBe(canonicalJson(reordered));
        // MUTANT 2: equal = computeAtlasContentHash pair.
        expect(computeAtlasContentHash(a)).toBe(computeAtlasContentHash(reordered));
    });

    it('a provenance-only difference is NOT equal (the hash STRIPS provenance)', () => {
        const a = fixture();
        const b = { ...a, provenance: { ...a.provenance, generator: 'somebody-else' } };
        expect(atlasesEqual(a, b)).toBe(false);
        expect(computeAtlasContentHash(a)).toBe(computeAtlasContentHash(b));  // MUTANT 2 again
    });

    it('is reflexive, and sees a real change through structural sharing', () => {
        const a = fixture();
        expect(atlasesEqual(a, a)).toBe(true);
        expect(atlasesEqual(a, JSON.parse(JSON.stringify(a)))).toBe(true);
        const moved = applyAtlasOp(a, { op: 'set-start', region: REGION });
        expect(moved.ok).toBe(true);
        expect(atlasesEqual(a, moved.atlas)).toBe(false);
        // The untouched subtree is the SAME object — what makes the deep walk cheap.
        expect(moved.atlas.regions).toBe(a.regions);
    });

    it('distinguishes a missing key from a null one', () => {
        expect(atlasesEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
        expect(atlasesEqual({ a: 1, b: null }, { a: 1 })).toBe(false);
    });
});

describe('atlasEditAdapter.apply — the refusal text, VERBATIM', () => {
    it('forwards atlasOps own sentence with NO prefix', () => {
        const a = fixture();
        const op = { op: 'add-location', region: 'nope', name: 'X', tile: [1, 1] };
        const direct = applyAtlasOp(a, op);
        const res = adapter().apply(a, op);
        expect(direct.ok).toBe(false);
        expect(res).toEqual({ ok: false, description: direct.error });
        // MUTANT: `atlas: ${res.error}` -> the pinned strings in
        // atlasSession.test.js and the panel's status copy all move.
        expect(res.description.startsWith('atlas:')).toBe(false);
    });

    it('never mutates the record it is handed (law 3, explicitly)', () => {
        const a = fixture();
        const before = JSON.stringify(a);
        const res = adapter().apply(a, { op: 'add-location', region: REGION, name: 'Q', tile: [9, 9] });
        expect(res.ok).toBe(true);
        expect(JSON.stringify(a)).toBe(before);
        expect(res.record).not.toBe(a);
    });

    it('drains the value slot — the node the op created', () => {
        const ad = adapter();
        const a = fixture();
        const res = ad.apply(a, { op: 'add-location', region: REGION, name: 'Q', tile: [9, 9] });
        expect(res.ok).toBe(true);
        const value = ad.takeLastValue();
        expect(value).toEqual({ name: 'Q', tile: [9, 9] });
        // MUTANT: a slot that is never drained hands the PREVIOUS op's node to
        // the next caller.
        expect(ad.takeLastValue()).toBeUndefined();
    });
});

describe('atlasEditAdapter.readCell — `_onPlainClick`, as a descriptor', () => {
    it('reports the region, the exit, the entrance and the location', () => {
        const a = fixture();
        const at = (x, y) => readAtlasCell(a, LEVEL.level, x, y);
        expect(at(ENTRANCE[0], ENTRANCE[1]))
            .toEqual({ region: REGION, exit: EXIT, entrance: true, location: null });
        expect(at(AWAY[0], AWAY[1]))
            .toEqual({ region: REGION, exit: EXIT, entrance: false, location: null });
        expect(at(LOC_TILE[0], LOC_TILE[1])).toEqual({
            region: REGION,
            exit: null,
            entrance: false,
            location: { name: LOC_NAME, vanilla_item: 'Progressive Sword' },
        });
        expect(at(OUTSIDE[0], OUTSIDE[1]))
            .toEqual({ region: null, exit: null, entrance: false, location: null });
    });

    it('is LEVEL-SCOPED — a region on another map_ref is invisible', () => {
        const a = fixture();
        // MUTANT: drop the `r.map_ref === level` filter -> every level's
        // regions answer for every level, because bounds are level-local.
        expect(readAtlasCell(a, LEVEL.level + 1, LOC_TILE[0], LOC_TILE[1]).region).toBe(null);
        expect(regionAt(a, LEVEL.level, LOC_TILE[0], LOC_TILE[1])?.region_id).toBe(REGION);
    });

    it('the SMALLEST containing region wins', () => {
        const inner = applyAtlasOp(fixture(), {
            op: 'add-region',
            region_id: 'inner',
            bounds: { x: 2, y: 2, w: 4, h: 4 },
            map_ref: LEVEL.level,
        });
        expect(inner.ok).toBe(true);
        // MUTANT: drop the area sort -> the first region in document order wins
        // and a nested room can never be clicked.
        expect(readAtlasCell(inner.atlas, LEVEL.level, LOC_TILE[0], LOC_TILE[1]).region).toBe('inner');
    });
});

describe('atlasEditAdapter.writeOps — what a cell can honestly carry', () => {
    it('REFUSES BY NAME a region given as an object', () => {
        expect(() => atlasWriteOps({ region: { region_id: REGION }, exit: null }, 1, 1))
            .toThrow(/RECTANGLE WITH AN ID/);
    });

    it('REFUSES BY NAME an exit given as an object', () => {
        expect(() => atlasWriteOps({ region: REGION, exit: { exit_id: EXIT } }, 1, 1))
            .toThrow(/NAMED run of tiles/);
    });

    it('REFUSES BY NAME a descriptor with no region', () => {
        expect(() => atlasWriteOps({ region: null, exit: null, entrance: false, location: null }, 9, 9))
            .toThrow(/nothing to write into/);
    });

    it('writes the ENTRANCE, and nothing for exit MEMBERSHIP', () => {
        const desc = readAtlasCell(fixture(), LEVEL.level, ENTRANCE[0], ENTRANCE[1]);
        const ops = atlasWriteOps(desc, AWAY[0], AWAY[1]);
        expect(ops).toEqual([
            { op: 'set-entrance-tile', region: REGION, exit: EXIT, tile: AWAY },
        ]);
        // The membership fact has no op in the vocabulary — measured, not omitted.
        expect(ops.some((o) => o.op === 'add-exit' || o.op === 'remove-exit')).toBe(false);

        const notEntrance = readAtlasCell(fixture(), LEVEL.level, AWAY[0], AWAY[1]);
        expect(atlasWriteOps(notEntrance, EXIT_TILES[0][0], EXIT_TILES[0][1])).toEqual([]);
    });

    it('writes a LOCATION where the global name is free, and the op REFUSES where it is not', () => {
        const a = fixture();
        const desc = readAtlasCell(a, LEVEL.level, LOC_TILE[0], LOC_TILE[1]);
        const ops = atlasWriteOps(desc, 8, 8);
        expect(ops).toEqual([{
            op: 'add-location', region: REGION, name: LOC_NAME, tile: [8, 8],
            vanilla_item: 'Progressive Sword',
        }]);
        // Into the document that already holds the name: the EXISTING global
        // refusal, by name.
        expect(applyAtlasOp(a, ops[0]).error).toMatch(/already used — AP location names are global/);
        // Into one that does not: a real inverse.
        const fresh = applyAtlasOp(a, { op: 'remove-location', region: REGION, name: LOC_NAME });
        const written = foldEdits(adapter(), fresh.atlas, [group('paste', ops)]);
        expect(readAtlasCell(written.record, LEVEL.level, 8, 8)).toEqual(desc);
    });

    it('a cross-region paste is refused by the OP, by name', () => {
        const a = applyAtlasOp(fixture(), {
            op: 'add-region', region_id: 'other', bounds: { x: 0, y: 0, w: 4, h: 4 }, map_ref: 99,
        }).atlas;
        const desc = readAtlasCell(a, LEVEL.level, LOC_TILE[0], LOC_TILE[1]);
        const ops = atlasWriteOps(
            { ...desc, region: 'other', location: { ...desc.location, name: 'Fixture - Free' } },
            18, 18,
        );
        expect(applyAtlasOp(a, ops[0]).error).toMatch(/lies outside region "other"/);
    });
});

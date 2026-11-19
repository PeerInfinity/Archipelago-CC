/**
 * CONTENT SETS TILE-3 — **THE `tileKinds` FIELD** (`mazeTileKinds.js`): a pack-declared tile kind placed on a floor
 * cell, look-only and walkable (⚖ the user, 2026-11-17).
 *
 *   1. The payload check refuses by name: malformed, out of bounds, not floor, two on a cell. The declared-kind check
 *      refuses by name: undeclared, wall-based.
 *   2. The field travels: serializer → registry deserializer → serializer is the identity; a world without kinds
 *      writes no key; `cloneWorld` copies the Map and `worldsEqual` sees a kind.
 *   3. ⛔ No logic: a world's extracted paths and compiled region are the same with and without placed kinds.
 *   4. The round trip (`mazeRegionRoundTrip`): open carries the kinds into the lab's library; a save that removed the
 *      last kind writes none (the re-stamp does not put the document's back); a kind on a thing's cell is refused.
 *   5. Outside the engine closure.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { TILE_FLOOR, TILE_WALL, deserializeMazeWorld, extractPathsAndObstacles, getTile } from './mazeRoomEngine.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { serializeMazeWorld, TILE_GRID_SIDECAR_FIELDS } from './mazeSerializer.js';
import { mazeRegionRoundTrip } from './mazeRegionRoundTrip.js';
import { cloneWorld, worldsEqual } from './procgenMaze.js';
import {
    MazeTileKindError, TILE_KINDS_FIELD, TILE_KIND_REFUSALS, deserializeMazeWorldWithKinds, occupiedWorldCells,
    placedTileKindRefusals, tileKindRefusal, tileKindsFromList, tileKindsList, withTileKinds,
} from './mazeTileKinds.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
/** A committed maze region with a thing: the meta trial's (read off the data: the first maze payload that has things). */
const META = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const [REGION_ID, PAYLOAD] = Object.entries(META.preset_sidecars['1'])
    .filter(([, sc]) => sc.substrate === 'maze' && sc.playable_payload?.things?.length)
    .map(([id, sc]) => [id, sc.playable_payload])[0];
const fresh = () => JSON.parse(JSON.stringify(PAYLOAD));

const KIND = 'tile3-fixture:object/lantern';
const DECLARED = Object.freeze({
    [KIND]: { artKey: 'tile3-fixture:tile/lantern', base: 'marker', pack: 'tile3-fixture' },
    'tile3-fixture:object/pillar': { artKey: null, base: 'wall', pack: 'tile3-fixture' },
});

/** The free floor cells of a world: floor, and named by nothing else. */
function freeCells(world) {
    const busy = occupiedWorldCells(world);
    const out = [];
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) if (getTile(world, x, y) === TILE_FLOOR && !busy.has(`${x},${y}`)) out.push({ x, y });
    }
    return out;
}
const wallCell = (world) => {
    for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) if (getTile(world, x, y) === TILE_WALL) return { x, y };
    return null;
};
const refusal = (fn) => {
    try { fn(); } catch (e) { return e; }
    return null;
};

describe('1. refused by name', () => {
    const world = deserializeMazeWorld(fresh());
    const [a, b] = freeCells(world);
    const wall = wallCell(world);
    const opts = { width: world.width, height: world.height, isFloor: (x, y) => getTile(world, x, y) === TILE_FLOOR };

    it('a well-formed list becomes the Map; the list writes back in row order', () => {
        const map = tileKindsFromList([{ ...b, kind: KIND }, { ...a, kind: KIND }], opts);
        expect([...map]).toEqual([[`${b.x},${b.y}`, KIND], [`${a.x},${a.y}`, KIND]]);
        expect(tileKindsList({ tileKinds: map })).toEqual([{ ...a, kind: KIND }, { ...b, kind: KIND }].sort((p, q) => (p.y - q.y) || (p.x - q.x)));
    });

    it.each([
        ['not an array', {}, /tileKinds: must be an array/],
        ['an entry that is not an object', [3], /entry 0 is not an object/],
        ['an unknown field', [{ x: 0, y: 0, kind: KIND, glow: 1 }], /entry 0 has unknown field "glow"/],
        ['no integer x, y', [{ x: '1', y: 0, kind: KIND }], /entry 0 has no integer x, y/],
        ['a kind that is not a pack concept key', [{ x: 0, y: 0, kind: 'lantern' }], /entry 0: kind "lantern" is not a pack concept key/],
    ])('malformed: %s', (_, list, pattern) => {
        const e = refusal(() => tileKindsFromList(list, opts));
        expect(e).toBeInstanceOf(MazeTileKindError);
        expect(e.message).toMatch(pattern);
    });

    it('a cell out of bounds', () => {
        expect(refusal(() => tileKindsFromList([{ x: world.width, y: 0, kind: KIND }], opts)).message)
            .toBe(TILE_KIND_REFUSALS.outOfBounds(world.width, 0));
    });
    it('a cell that is not floor', () => {
        expect(refusal(() => tileKindsFromList([{ ...wall, kind: KIND }], opts)).message).toBe(TILE_KIND_REFUSALS.notFloor(wall.x, wall.y, KIND));
    });
    it('two kinds on one cell', () => {
        expect(refusal(() => tileKindsFromList([{ ...a, kind: KIND }, { ...a, kind: KIND }], opts)).message).toBe(TILE_KIND_REFUSALS.duplicate(a.x, a.y));
    });
    it('the registry deserializer refuses a payload whose kind is on a wall, by name', () => {
        const p = { ...fresh(), [TILE_KINDS_FIELD]: [{ ...wall, kind: KIND }] };
        expect(() => substrateRegistryEntry.deserializeWorld(p)).toThrow(TILE_KIND_REFUSALS.notFloor(wall.x, wall.y, KIND));
    });

    it('a kind no loaded pack declares, and a wall-based kind', () => {
        expect(tileKindRefusal(KIND, DECLARED)).toBeNull();
        expect(tileKindRefusal('other:object/x', DECLARED)).toEqual({
            reason: 'undeclared-tile-kind', description: TILE_KIND_REFUSALS.undeclared('other:object/x', Object.keys(DECLARED)),
        });
        expect(tileKindRefusal('other:object/x', null).description).toMatch(/the stack declares none/);
        expect(tileKindRefusal('tile3-fixture:object/pillar', DECLARED)).toEqual({
            reason: 'wall-base-tile-kind', description: TILE_KIND_REFUSALS.wallBase('tile3-fixture:object/pillar'),
        });
        const w = withTileKinds(deserializeMazeWorld(fresh()), { tileKinds: [{ ...a, kind: KIND }, { ...b, kind: 'other:object/x' }] });
        expect(placedTileKindRefusals(w, DECLARED)).toEqual([{ ...b, kind: 'other:object/x', ...tileKindRefusal('other:object/x', DECLARED) }]);
    });
});

describe('2. the field travels, and its absence is byte-equal', () => {
    it('the declared sidecar field: optional, and a payload carrying it passes the declaration', () => {
        expect(TILE_GRID_SIDECAR_FIELDS.tileKinds.required).toBe(false);
        const w = deserializeMazeWorld(fresh());
        const [a] = freeCells(w);
        const p = { ...fresh(), tileKinds: [{ ...a, kind: KIND }] };
        expect(sidecarPayloadErrors(sidecarFieldsOf(substrateRegistryEntry), p)).toEqual([]);
        expect(sidecarPayloadErrors(sidecarFieldsOf(substrateRegistryEntry), { ...p, tileKinds: [{ ...a, kind: KIND, glow: 1 }] })).not.toEqual([]);
    });

    it('serialize → registry deserialize → serialize is the identity with kinds; without, no key is written', () => {
        const extracted = { region_id: REGION_ID };
        const plain = substrateRegistryEntry.deserializeWorld(fresh());
        expect(plain.tileKinds).toBeUndefined();
        expect(TILE_KINDS_FIELD in serializeMazeWorld(plain, extracted)).toBe(false);
        const [a, b] = freeCells(plain);
        const p = { ...fresh(), tileKinds: [{ ...a, kind: KIND }, { ...b, kind: KIND }] };
        const w = substrateRegistryEntry.deserializeWorld(p);
        expect(w.tileKinds.size).toBe(p.tileKinds.length);
        const out = serializeMazeWorld(w, extracted);
        expect(out.tileKinds).toEqual(tileKindsList(w));
        expect(substrateRegistryEntry.deserializeWorld(out).tileKinds).toEqual(w.tileKinds);
    });

    it('cloneWorld copies the Map (never shares it); worldsEqual sees a placed kind', () => {
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a] = freeCells(w);
        const placed = withTileKinds(deserializeMazeWorld(fresh()), { tileKinds: [{ ...a, kind: KIND }] });
        const c = cloneWorld(placed);
        expect(c.tileKinds).not.toBe(placed.tileKinds);
        expect(c.tileKinds).toEqual(placed.tileKinds);
        expect(worldsEqual(w, placed)).toBe(false);
        expect(worldsEqual(c, placed)).toBe(true);
        expect('tileKinds' in cloneWorld(w)).toBe(false);
    });
});

describe('3. ⛔ no logic: placed kinds are walkable and reachability never sees them', () => {
    it('the extracted paths and the compiled region are the same with every free cell holding a kind', () => {
        const plain = deserializeMazeWorld(fresh());
        const cells = freeCells(plain);
        expect(cells.length).toBeGreaterThan(0);
        const placed = withTileKinds(deserializeMazeWorld(fresh()), { tileKinds: cells.map((c) => ({ ...c, kind: KIND })) });
        const compile = (w) => {
            const ex = extractPathsAndObstacles(w, { regionId: REGION_ID });
            return { ex, compiled: compileRegion(ex, { obstacleLib: { ...DEFAULT_OBSTACLES, ...(PAYLOAD.obstacleLib ?? {}) } }) };
        };
        expect(JSON.stringify(compile(placed))).toBe(JSON.stringify(compile(plain)));
    });
});

describe('4. the round trip', () => {
    const openPayload = (payload) => mazeRegionRoundTrip.open({ regionId: REGION_ID, payload }).session.record.entries[0].payload;
    const saveWith = (edited, original) => mazeRegionRoundTrip.save({ library: { entries: [{ payload: edited }] } }, { regionId: REGION_ID, payload: original });

    it('open carries the placed kinds into the lab\'s library entry; an unedited save writes them back unchanged', () => {
        const w = deserializeMazeWorld(fresh());
        const [a] = freeCells(w);
        const doc = { ...fresh(), tileKinds: [{ ...a, kind: KIND }] };
        const entryPayload = openPayload(doc);
        expect(entryPayload.tileKinds).toEqual(doc.tileKinds);
        expect(saveWith(entryPayload, doc).payload.tileKinds).toEqual(doc.tileKinds);
    });

    it('a save that removed the last kind writes none: the re-stamp does not put the document\'s back', () => {
        const w = deserializeMazeWorld(fresh());
        const [a] = freeCells(w);
        const doc = { ...fresh(), tileKinds: [{ ...a, kind: KIND }] };
        const { tileKinds: _gone, ...edited } = openPayload(doc);
        expect(TILE_KINDS_FIELD in saveWith(edited, doc).payload).toBe(false);
    });

    it('a kind placed on a thing\'s cell is refused at the save, by name', () => {
        const doc = fresh();
        const thing = doc.things[0];
        const edited = { ...openPayload(doc), tileKinds: [{ x: thing.x, y: thing.y, kind: KIND }] };
        expect(() => saveWith(edited, doc)).toThrow(new RegExp(`places the tile kind "${KIND}" on \\(${thing.x},${thing.y}\\), where the region's thing`));
    });
});

describe('5. outside the engine closure', () => {
    it('neither the field module nor its overlay is in the closure `engineMd5` hashes', () => {
        const engine = new Set(importClosure());
        for (const f of ['mazeTileKinds.js', 'mazeTileKindOverlay.js']) {
            expect(importClosure(join(HERE, f))).toContain(relative(ROOT, join(HERE, f)));
            expect(engine.has(relative(ROOT, join(HERE, f)))).toBe(false);
        }
    });
});

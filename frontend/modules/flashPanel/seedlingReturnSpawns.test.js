/**
 * seedlingReturnSpawns (seedling-pipeline T2b, U2b): the game's own spawn when
 * you come back out through a door, off the real map and off small synthetic
 * maps for the branches the real one decides only once.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MAX_RETURN_DISTANCE_TILES, RETURN_LINK_TYPES, returnKey, returnSpawnTable } from './seedlingReturnSpawns.js';
import { LINK_TAGS } from '../seedlingDemo/seedlingAtlasDerivation.js';

const MAP = JSON.parse(readFileSync(fileURLToPath(new URL('./atlases/seedling-map.json', import.meta.url)), 'utf8'));

const link = (type, x, y, to, px, py) => ({ type, x, y, attrs: { to: String(to), playerx: String(px), playery: String(py) } });
const doc = (levels) => ({ tile_size: 16, levels });

describe('returnSpawnTable — the real map', () => {
    const table = returnSpawnTable(MAP);

    it('the house door (level 0, tile 10,17) returns at (160,288) — level 86\'s teleporter back', () => {
        expect(table.get(returnKey(0, 10, 17))).toEqual({ x: 160, y: 288, via: { level: 86, type: 'teleporter', x: 48, y: 64 } });
    });

    it('the owl\'s-nest stairs (level 0, tile 16,17) return at (256,256) — level 2\'s stairs up', () => {
        expect(table.get(returnKey(0, 16, 17))).toMatchObject({ x: 256, y: 256, via: { level: 2, type: 'stairsup' } });
    });

    /**
     * ⛓ THE LIMIT IS MEASURED, NOT ASSUMED (plan §15): over the 280 links,
     * the nearest reverse spawn is ≤ 1 tile for 265, ≤ 2 tiles for 6 more,
     * then nothing until 160 px (another door's), and 8 doors have none.
     */
    it('271 of the 280 links have a return spawn within the limit', () => {
        const links = MAP.levels.reduce((n, L) => n + L.entities.filter((e) => RETURN_LINK_TYPES.includes(e.type)).length, 0);
        expect(links).toBe(280);
        expect(table.size).toBe(271);
        expect(MAX_RETURN_DISTANCE_TILES).toBe(2);
    });

    it('the link types agree with the derivation\'s LINK_TAGS (the pin that licenses the local spelling)', () => {
        expect([...RETURN_LINK_TYPES].sort()).toEqual([...LINK_TAGS].sort());
    });
});

describe('returnSpawnTable — the branches', () => {
    it('no reverse link (a one-way door) → no entry', () => {
        const t = returnSpawnTable(doc([
            { level: 0, entities: [link('teleporter', 32, 32, 5, 10, 10)] },
            { level: 5, entities: [link('teleporter', 64, 64, 7, 0, 0)] },
        ]));
        expect(t.size).toBe(0);
    });

    it('a reverse link that lands further than the limit is another door\'s → no entry', () => {
        const t = returnSpawnTable(doc([
            { level: 0, entities: [link('teleporter', 32, 32, 5, 10, 10)] },
            { level: 5, entities: [link('teleporter', 64, 64, 0, 32 + 16 * 3, 32)] },
        ]));
        expect(t.size).toBe(0);
    });

    it('two reverse links → the NEAREST to the door', () => {
        const t = returnSpawnTable(doc([
            { level: 0, entities: [link('stairsdown', 32, 32, 5, 0, 0)] },
            { level: 5, entities: [link('stairsup', 0, 0, 0, 32 + 32, 32), link('stairsup', 16, 0, 0, 32, 48)] },
        ]));
        expect(t.get(returnKey(0, 2, 2))).toMatchObject({ x: 32, y: 48 });
    });

    it('a link to its own level, a non-link entity and a malformed document are ignored', () => {
        expect(returnSpawnTable(doc([{ level: 0, entities: [link('teleporter', 0, 0, 0, 0, 16), { type: 'chest', x: 0, y: 0, attrs: { to: '1' } }] }])).size).toBe(0);
        expect(returnSpawnTable(null).size).toBe(0);
        expect(returnSpawnTable({ tile_size: 0, levels: [] }).size).toBe(0);
    });
});

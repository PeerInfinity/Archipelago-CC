/**
 * ⛓⛓⛓ **THE SEEDLING MAP IS BYTE-IDENTICAL ACROSS THE LIFT** (maze world map, step A). The layout half of
 * `seedlingSetMap.js` moved to `procgenCore/setMapLayout.js`; this pins everything the Seedling map answers — its
 * links, layout graph, canonical layout, census, fingerprint, frames at three zooms, shapes for four selections,
 * 400 picks (room, link, door tick) per zoom, the provider's state through a `connect` (sticky) and a RE-LAYOUT, and
 * the module's export list and constants — over the editor's vanilla 116 (the game's rooms, `patches: []`) and a
 * generated set (`seedling_generated_chestdoor`).
 *
 * The digests were measured on the base BEFORE the move (origin/main 91117f8d88) and re-measured after it: equal.
 * ⛔ A change to the Seedling map's behaviour must re-measure them and say so; that is the point of the pin.
 *
 * MUTANTS (each turns a digest red): the ring's tie order; the directed-first sort; a pit's offset; the named
 * arrival's label; the sticky rule; the door tick's half-tile.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../flashPanel/seedlingSemantics.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { emptyOverlay } from './seedlingSetOverlay.js';
import { createSeedlingSetAdapter, setRecord } from './seedlingSetAdapter.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import * as SM from './seedlingSetMap.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const DEPS = Object.freeze({
    parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
    atlas: { game: 'digest', mapDocument: 'digest.json' },
});
const adapter = createSeedlingSetAdapter(DEPS);

/** Keys sorted, so the digest is of the VALUE and not of insertion order. */
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x));

/** Everything the Seedling map answers over one set, hashed. */
function mapDigest(set) {
    const rec = setRecord(set, emptyOverlay());
    const o = {};
    const ml = SM.mapLinksOf(rec, DEPS);
    o.mapLinks = ml;
    const g = SM.layoutGraphOf(rec, ml.links);
    o.graph = g;
    const pos = SM.canonicalLayout(g);
    o.pos = pos;
    o.census = SM.layoutCensus(g, pos);
    o.fp = SM.roomFingerprint(rec, ml.sizes);
    const map = SM.createSetMap(DEPS);
    const n = set.rooms.length;
    for (const z of [1, 0.5, 2.2]) {
        map.setZoom(z);
        const f = map.frame(rec);
        o[`frame${z}`] = f;
        for (const sel of [null, 0, 1, Math.min(5, n - 1)]) o[`shapes${z}_${sel}`] = map.shapes(rec, f, { selected: sel });
        const picks = [];
        for (let i = 0; i < 400; i++) {
            const p = { x: (i * 37.3) % f.width, y: (i * 53.7) % f.height };
            picks.push([map.roomAt(rec, f, p), map.linkAt(rec, f, p, { selected: i % 3 ? null : 0 }), map.markerAt(rec, f, p, 0)]);
        }
        o[`picks${z}`] = picks;
    }
    o.state0 = map.state(rec);
    const res = adapter.apply(rec, { op: 'connect', from: [0, 0], to: [n > 5 ? n - 1 : 1, 0], one_way: true });
    o.connect = { ok: res.ok, why: res.ok ? null : res.description };
    if (res.ok) { o.stateConnect = map.state(res.record); o.stateBack = map.state(rec); }
    map.reset();
    o.stateReset = map.state(rec);
    o.edge = [SM.edgeOf({ x: 152, y: 80 }, { w: 160, h: 160 }),
        SM.dirOfExit({ x: 64, y: 64, playerx: 4, playery: 80 }, { w: 160, h: 160 }, { w: 160, h: 160 })];
    o.exports = Object.keys(SM).sort();
    o.geom = SM.MAP_GEOMETRY; o.dirs = SM.DIRS; o.frac = SM.EDGE_FRACTION; o.rings = SM.CONSISTENT_RINGS; o.keys = SM.NAMED_ROOM_KEYS;
    return { digest: createHash('sha256').update(stable(o)).digest('hex'), stateConnect: o.stateConnect };
}

/** ⛓ Measured on 91117f8d88 before the move (the maze world map as-built quotes the same three). */
const BEFORE_THE_LIFT = Object.freeze({
    vanilla: 'f86747bf307d0724cabc510d3ac307991cd334af335ed3903462b8be7b03e752',
    generated: '9a7978b2a6561156c484544bfdbc1350d8bf23509a6c07b7e265eb20491e91be',
});

describe('the Seedling map across the lift to procgenCore/setMapLayout', () => {
    it('the editor\'s vanilla 116 (the game\'s rooms): the same digest as before the move', () => {
        const set = vanillaRecordSet(read('./fixtures/seedling-vanilla-set.json'),
            read('../flashPanel/atlases/seedling-map.json'), { patches: [] }).set;
        const { digest, stateConnect } = mapDigest(set);
        // ⛓ the pin covers the sticky path: the connect kept every position
        expect(stateConnect).toMatchObject({ rule: 'sticky', moved: 0 });
        expect(digest).toBe(BEFORE_THE_LIFT.vanilla);
    });

    it('a generated set (seedling_generated_chestdoor): the same digest as before the move', () => {
        const set = assembleGeneratedSeedlingSet(read('../../presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json')).set;
        expect(mapDigest(set).digest).toBe(BEFORE_THE_LIFT.generated);
    });
});

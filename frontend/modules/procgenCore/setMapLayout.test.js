/**
 * ⛓⛓ **THE SHARED SET-MAP LAYOUT** (`setMapLayout.js`, maze world map step A), over a hand-built reader: no
 * substrate is imported, because the module may not know one. The Seedling map's byte identity across the move is
 * `seedlingDemo/seedlingSetMapLift.test.js`; the maze's provider is `mazeRoom/mazeSetMap.test.js`. Every row names
 * its MUTANT.
 */
import { describe, expect, it } from 'vitest';

import {
    DIRS, canonicalLayout, createSetMapProvider, doorTickShapes, edgeOf, frameOf, layoutCensus, layoutGraph,
    mapLinkShapes, roomFingerprintOf,
} from './setMapLayout.js';

/** A fake substrate: `rooms` is `[{name, size, doors: [{x, y}]}]`, `links` `[{from, to, dir, kind?}]`. */
const reader = () => ({
    linksOf: (rec) => ({
        links: rec.links.map((l, i) => ({ kind: 'exit', index: i, ...l })),
        sizes: rec.rooms.map((r) => r.size ?? null),
        unreadable: rec.rooms.flatMap((r, i) => (r.size ? [] : [i])),
    }),
    graphOf: (rec, links) => layoutGraph(rec.rooms.length, rec.start ?? 0, links),
    fingerprintOf: (rec, sizes) => roomFingerprintOf(rec.rooms.map((r) => r.name), sizes),
    doorsOf: (rec, room) => rec.rooms[room].doors ?? null,
    kinds: { warp: { offset: 5, label: ({ highlight }) => (highlight ? 'WARP!' : 'warp') } },
});
const room = (name, doors = []) => ({ name, size: { w: 10, h: 10 }, doors });
const pos = (layout) => layout.map((p) => [p.gx, p.gy]);

describe('the canonical layout', () => {
    /** MUTANT: ignore a link's direction (every room takes the first ring cell, which is EAST). */
    it('a room reached through a door with a direction lands one cell that way — all four ways', () => {
        const g = layoutGraph(5, 0, [
            { from: 0, to: 1, dir: 'E' }, { from: 0, to: 2, dir: 'S' }, { from: 0, to: 3, dir: 'W' }, { from: 0, to: 4, dir: 'N' },
        ]);
        const p = canonicalLayout(g);
        const at = (i) => [p[i].gx - p[0].gx, p[i].gy - p[0].gy];
        expect([at(1), at(2), at(3), at(4)]).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1]]);
        expect(layoutCensus(g, p)).toMatchObject({ directed: 4, honoured: 4 });
    });

    /** MUTANT: start the walk at room 0 whatever `start` says. */
    it('the walk starts at the substrate\'s start room, and a room no link reaches starts a group to the right', () => {
        // ⛓ rooms 1 and 2 are joined; room 0 is alone. From start 1, room 0 is the unreached group, so it goes right.
        const p = pos(canonicalLayout(layoutGraph(3, 1, [{ from: 1, to: 2, dir: 'E' }])));
        expect(p[2][0] - p[1][0]).toBe(1);
        expect(p[0][0]).toBeGreaterThan(p[2][0]);
        const fromZero = pos(canonicalLayout(layoutGraph(3, 0, [{ from: 1, to: 2, dir: 'E' }])));
        expect(fromZero[0][0]).toBeLessThan(fromZero[1][0]);
    });

    /** MUTANT: let two rooms share a cell when the wanted one is taken. */
    it('a taken cell falls back to the nearest free one on the same side, and no two rooms share a cell', () => {
        const links = [1, 2, 3].map((to) => ({ from: 0, to, dir: 'E' }));
        const p = pos(canonicalLayout(layoutGraph(4, 0, links)));
        expect(new Set(p.map(String)).size).toBe(4);
        expect(p.slice(1).every(([x]) => x > p[0][0])).toBe(true);
    });

    /** MUTANT: a refusal that throws a bare Error (the substrate could not name its own module). */
    it('refuses a non-integer room count through the substrate\'s own `fail`', () => {
        const fail = (m) => { throw new RangeError(`mine: ${m}`); };
        expect(() => canonicalLayout({ n: 1.5, start: 0, links: [] }, fail)).toThrow(RangeError);
        expect(() => canonicalLayout({ n: -1, start: 0, links: [] })).toThrow(/a layout needs a room count/);
    });

    it('edgeOf names the edge within the fraction, and the interior is `null`', () => {
        expect(edgeOf({ x: 9.5, y: 5 }, { w: 10, h: 10 })).toBe('E');
        expect(edgeOf({ x: 5, y: 0.5 }, { w: 10, h: 10 })).toBe('N');
        expect(edgeOf({ x: 5, y: 5 }, { w: 10, h: 10 })).toBe(null);
        expect(Object.keys(DIRS).sort()).toEqual(['E', 'N', 'S', 'W']);
    });
});

describe('the drawn links', () => {
    const frame = frameOf([{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 }], [null, null, null]);

    /** MUTANT: draw a two-way pair as two lines. */
    it('an exit pair is ONE line, two heads when both rooms have a door to the other', () => {
        const two = mapLinkShapes([{ kind: 'exit', from: 0, to: 1 }, { kind: 'exit', from: 1, to: 0 }], frame);
        const one = mapLinkShapes([{ kind: 'exit', from: 1, to: 0 }], frame);
        expect(two).toHaveLength(1);
        expect(two[0].arrowBack).toBe(true);
        expect(one[0]).toMatchObject({ arrowBack: false, link: { from: 1, to: 0 } });
    });

    /** MUTANT: ignore `kinds` (the substrate's other link kind is drawn and labelled as an exit). */
    it('another kind is its own line, offset and labelled by the substrate\'s `kinds`', () => {
        const kinds = reader().kinds;
        const [exit, warp] = mapLinkShapes([{ kind: 'exit', from: 0, to: 2 }, { kind: 'warp', from: 0, to: 2 }], frame,
            { selected: 2, kinds });
        expect(warp.label).toBe('WARP!');
        expect(warp.points[0].x).not.toBe(exit.points[0].x);
        expect(mapLinkShapes([{ kind: 'warp', from: 0, to: 2 }], frame, { kinds })[0].label).toBe('warp');
    });

    /** MUTANT: highlight only the links INTO the selected room. */
    it('a link touching the selected room, in or out, is highlighted', () => {
        const shapes = mapLinkShapes([{ kind: 'exit', from: 0, to: 1 }, { kind: 'exit', from: 2, to: 0 }], frame, { selected: 0 });
        expect(shapes.every((s) => s.highlight)).toBe(true);
    });

    /** MUTANT: place a tick in canvas units rather than the room's own (the size is ignored). */
    it('a door tick lands at the door\'s point scaled onto the room\'s still', () => {
        const f = frameOf([{ gx: 0, gy: 0 }], [{ w: 10, h: 10 }]);
        const [t] = doorTickShapes(0, f, { w: 10, h: 10 }, [{ x: 10, y: 5 }]);
        const s = f.cells[0].still;
        expect(t.marker).toMatchObject({ room: 0, index: 0, x: s.x + s.w, y: s.y + s.h / 2 });
        expect(doorTickShapes(0, f, { w: 10, h: 10 }, null)).toEqual([]);
    });
});

describe('the provider: the sticky rule, and nothing stored', () => {
    const rec0 = {
        rooms: [room('a', [{ x: 10, y: 5 }]), room('b'), room('c')],
        links: [{ from: 0, to: 1, dir: 'E' }, { from: 1, to: 2, dir: 'S' }],
    };

    /** MUTANT: re-derive the canonical layout on every changed graph (no sticky rule). */
    it('a changed graph over the SAME rooms moves nothing; RE-LAYOUT is canonical', () => {
        const map = createSetMapProvider(reader());
        const p0 = map.state(rec0).positions;
        // a link that, canonically, would put room 2 west of room 0
        const rec1 = { ...rec0, links: [...rec0.links, { from: 0, to: 2, dir: 'W' }] };
        expect(pos(canonicalLayout(layoutGraph(3, 0, reader().linksOf(rec1).links)))).not.toEqual(p0);
        expect(map.state(rec1)).toMatchObject({ rule: 'sticky', moved: 0, positions: p0 });
        map.reset();
        expect(map.state(rec1)).toMatchObject({ rule: 'canonical', relayouts: 1 });
    });

    /** MUTANT: a fingerprint that is the room COUNT (a renamed or resized room keeps stale positions). */
    it('different rooms (a resized one) re-derive the canonical layout', () => {
        const map = createSetMapProvider(reader());
        map.state(rec0);
        const resized = { ...rec0, rooms: [rec0.rooms[0], { ...rec0.rooms[1], size: { w: 4, h: 4 } }, rec0.rooms[2]] };
        expect(map.state(resized).rule).toBe('canonical');
    });

    it('the door ticks come from the reader, the zoom is clamped, and the state names unreadable rooms', () => {
        const map = createSetMapProvider(reader());
        const f = map.frame(rec0);
        expect(map.shapes(rec0, f, { selected: 0 }).filter((s) => s.marker)).toHaveLength(1);
        const t = map.shapes(rec0, f, { selected: 0 }).find((s) => s.marker).marker;
        expect(map.markerAt(rec0, f, { x: t.x, y: t.y }, 0)).toMatchObject({ room: 0, index: 0 });
        expect(map.roomAt(rec0, f, { x: f.cells[2].x + 1, y: f.cells[2].y + 1 })).toBe(2);
        expect(map.setZoom(100)).toBeLessThan(100);
        expect(map.state({ ...rec0, rooms: [rec0.rooms[0], { name: 'b' }, rec0.rooms[2]] }).unreadable).toEqual([1]);
    });
});

/**
 * ⛓⛓⛓ **THE MAZE WORLD MAP** (`mazeSetMap.js`, step A): which way a maze door leads, which links a library has,
 * the layout over the committed pack and a generated library, the sticky rule under the ADAPTER's own `connect` /
 * `disconnect`, and the DISCONNECT preview. Every row names its MUTANT.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { canonicalLayout, layoutCensus } from '../procgenCore/setMapLayout.js';
import { validateRegionLibrary } from '../procgenPipeline/regionLibraryValidator.js';
import { emptyMazeOverlay } from './mazeAtlasDerivation.js';
import { createMazeSetAdapter, exitsOfRoom, setRecord } from './mazeSetAdapter.js';
import { mazeDisconnectEffectOf } from './mazeSetLab.js';
import {
    createMazeSetMap, dirOfMazeExit, mazeDoorPointsOf, mazeLayoutGraphOf, mazeMapLinksOf, mazeRoomFingerprint,
    sideOfMazeExit,
} from './mazeSetMap.js';
import { generatedMazeLibrary } from './mazeSetMap.fixtures.js';

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'));
const PACK = read('../../region-libraries/demo-maze-pack.json');
const adapter = createMazeSetAdapter({});
const exitOn = (entry, side) => entry.payload.exits.find((e) => e.side === side).exit_id;
const n = PACK.entries.length;
/** The pack's ring: each room's EAST exit to the next room's WEST exit. */
const RING = PACK.entries.map((e, i) => ({ from: [i, exitOn(e, 'E')], to: [(i + 1) % n, exitOn(PACK.entries[(i + 1) % n], 'W')] }));
const overlayWith = (links, extra = {}) => ({ ...emptyMazeOverlay(), links, ...extra });
const layoutOf = (rec) => canonicalLayout(mazeLayoutGraphOf(rec, mazeMapLinksOf(rec).links));
const apply = (rec, op) => {
    const res = adapter.apply(rec, op);
    if (!res.ok) throw new Error(res.description);
    return res.record;
};
const size = { w: 11, h: 11 };

describe('which way a maze door leads (the census: every committed and generated maze exit names its side)', () => {
    /** MUTANT: ignore `side` and read only the tile (a side-less tile reading would still pass on edge tiles). */
    it('the exit\'s own `side` first, even where its tile says otherwise', () => {
        expect(sideOfMazeExit({ side: 'N', x: 5, y: 10 }, size)).toEqual({ side: 'N', from: 'side' });
    });

    /** MUTANT: drop the fallbacks (a Seedling-derived maze exit has no `side`). */
    it('no side: the edge its tile is on; else the arrival\'s side in the target, reversed; else null', () => {
        expect(dirOfMazeExit({ x: 10, y: 5 }, size, null, size)).toEqual({ dir: 'E', from: 'tile' });
        expect(dirOfMazeExit({ x: 5, y: 5 }, size, { side: 'W' }, size)).toEqual({ dir: 'E', from: 'arrival' });
        expect(dirOfMazeExit({ x: 5, y: 5 }, size, { x: 5, y: 0 }, size)).toEqual({ dir: 'S', from: 'arrival' });
        expect(dirOfMazeExit({ x: 5, y: 5 }, size, { x: 5, y: 5 }, size)).toEqual({ dir: null, from: null });
    });
});

describe('the links a library has', () => {
    /** MUTANT: read a two-way link from its `from` end only (the far room's door would draw no line back). */
    it('a two-way link is one directed link per end; a one-way link only its `from` end', () => {
        const rec = setRecord(PACK, overlayWith([RING[0], { ...RING[1], one_way: true }]));
        const { links, unreadable } = mazeMapLinksOf(rec);
        expect(unreadable).toEqual([]);
        // ⛓ room by room, each room's exits by ordinal: room 1's EAST exit (to 2) is before its WEST one (back to 0)
        const ordinal = (room, id) => PACK.entries[room].payload.exits.findIndex((e) => e.exit_id === id);
        expect(ordinal(1, RING[1].from[1])).toBeLessThan(ordinal(1, RING[0].to[1]));
        expect(links.map((l) => [l.from, l.to, l.dir])).toEqual([[0, 1, 'E'], [1, 2, 'E'], [1, 0, 'W']]);
        const two = createMazeSetMap();
        const shapes = two.shapes(rec, two.frame(rec));
        expect(shapes.map((s) => [s.link.a, s.link.b, s.arrowBack])).toEqual([[0, 1, true], [1, 2, false]]);
    });

    /** MUTANT: follow the overlay's list order (a reordered overlay — the same doors — would lay out differently). */
    it('the order is the DOOR graph\'s (room, then exit ordinal), not the overlay list\'s', () => {
        const a = mazeMapLinksOf(setRecord(PACK, overlayWith(RING))).links;
        const b = mazeMapLinksOf(setRecord(PACK, overlayWith([...RING].reverse()))).links;
        expect(b.map((l) => [l.from, l.index, l.to])).toEqual(a.map((l) => [l.from, l.index, l.to]));
    });

    /** MUTANT: start at room 0 whatever the overlay says. */
    it('the walk starts at `overlay.start`; absent, entry 0', () => {
        expect(mazeLayoutGraphOf(setRecord(PACK, overlayWith(RING, { start: 2 })), []).start).toBe(2);
        expect(mazeLayoutGraphOf(setRecord(PACK, overlayWith(RING)), []).start).toBe(0);
    });

    it('a door tick is the exit tile\'s centre, by ordinal', () => {
        const rec = setRecord(PACK, emptyMazeOverlay());
        expect(mazeDoorPointsOf(rec, 0)).toEqual(PACK.entries[0].payload.exits.map((e) => ({ x: e.x + 0.5, y: e.y + 0.5 })));
    });
});

describe('THE MAP — the committed pack and a generated library', () => {
    /** MUTANT: invert a direction (`OPPOSITE` misapplied) — the ring would run west. */
    it('the committed pack\'s ring: walked from room 0, east through its EAST doors and west through its WEST one', () => {
        const p = layoutOf(setRecord(PACK, overlayWith(RING)));
        const d = (a, b) => [p[b].gx - p[a].gx, p[b].gy - p[a].gy];
        // ⛓ the closing link is two-way, so room 0's WEST door reaches the last room before the chain does
        expect(d(0, n - 1)).toEqual([-1, 0]);
        for (let i = 1; i < n - 1; i += 1) expect(d(i - 1, i)).toEqual([1, 0]);
    });

    it('the bare pack (no overlay, so no links): unreached rooms in groups, lowest index first', () => {
        const p = layoutOf(setRecord(PACK, emptyMazeOverlay()));
        expect(p.map((c) => c.gy)).toEqual(Array(n).fill(0));
        expect([...p].map((c) => c.gx)).toEqual([...p].map((c) => c.gx).sort((a, b) => a - b));
    });

    /** MUTANT: lose the generated library's wiring (the fixture's overlay), or misread a captured exit's side. */
    it('a generated library (procgen_maze/AP_3, wired by its sidecars): every door lands its room on its side', () => {
        const gen = generatedMazeLibrary(read('../../presets/procgen_maze/AP_3/AP_3_rules.json'));
        expect(validateRegionLibrary(gen.library).ok).toBe(true);
        expect(gen.census).toMatchObject({ oneWay: 0, dropped: 0, conflicts: 0 });
        const rec = setRecord(gen.library, gen.overlay);
        const { links } = mazeMapLinksOf(rec);
        expect(links).toHaveLength(gen.census.twoWay * 2);
        const c = layoutCensus(mazeLayoutGraphOf(rec, links), layoutOf(rec));
        expect(c.directed).toBe(links.length);
        expect(c.honoured).toBe(c.directed);
    });

    /** MUTANT: the same, over a larger generated world, where a hub has several doors on one side. */
    it('a larger generated library (procgen_topdown/AP_4): most doors honoured, nearly all on their side', () => {
        const gen = generatedMazeLibrary(read('../../presets/procgen_topdown/AP_4/AP_4_rules.json'));
        const rec = setRecord(gen.library, gen.overlay);
        const { links } = mazeMapLinksOf(rec);
        const c = layoutCensus(mazeLayoutGraphOf(rec, links), layoutOf(rec));
        expect(c.directed).toBe(links.length);
        expect(c.honoured * 2).toBeGreaterThan(c.directed);
        expect(c.consistent * 10).toBeGreaterThan(c.directed * 9);
    });
});

describe('LAYOUT STABILITY under the adapter\'s own ops — the map is a view', () => {
    const chain = () => setRecord(PACK, overlayWith(RING.slice(0, 2)));

    /** MUTANT: no sticky rule (the provider re-derives on every changed graph). */
    it('connect, disconnect and their undo move NO room; a reorder re-derives', () => {
        const map = createMazeSetMap();
        const r0 = chain();
        const p0 = map.state(r0).positions;
        const r1 = apply(r0, { op: 'connect', from: RING[3].from, to: RING[3].to, one_way: false });
        // ⛓ canonically the closing link moves the rooms — the sticky rule is what keeps them
        expect(layoutOf(r1).map((p) => [p.gx, p.gy])).not.toEqual(p0);
        expect(map.state(r1)).toMatchObject({ rule: 'sticky', moved: 0, positions: p0 });
        const r2 = apply(r1, { op: 'disconnect', room: 0, exit_id: RING[0].from[1] });
        expect(map.state(r2)).toMatchObject({ rule: 'sticky', moved: 0, positions: p0 });
        expect(map.state(r0)).toMatchObject({ moved: 0, positions: p0 });
        const r3 = apply(r0, { op: 'reorder', order: [3, 2, 1, 0] });
        expect(map.state(r3).rule).toBe('canonical');
        expect(mazeRoomFingerprint(r3, mazeMapLinksOf(r3).sizes)).not.toBe(mazeRoomFingerprint(r0, mazeMapLinksOf(r0).sizes));
    });

    it('nothing about the map is written into the record', () => {
        const r0 = chain();
        const before = JSON.stringify(r0);
        const map = createMazeSetMap();
        map.shapes(r0, map.frame(r0), { selected: 1 });
        map.reset();
        map.state(r0);
        expect(JSON.stringify(r0)).toBe(before);
    });
});

describe('the DISCONNECT preview (`mazeDisconnectEffectOf`)', () => {
    const rowsOf = (rec) => rec.library.entries.map((_e, i) => ({ exitList: exitsOfRoom(rec, i) }));

    /** MUTANT: say an ordinal shift (the Seedling sentence) — a maze exit is addressed by `exit_id`. */
    it('names the one link removed, both ends, and that nothing renumbers', () => {
        const rec = setRecord(PACK, overlayWith(RING.slice(0, 2)));
        const s = mazeDisconnectEffectOf(rowsOf(rec), 0, RING[0].from[1]);
        expect(s).toContain(`0/${RING[0].from[1]} — 1/${RING[0].to[1]}`);
        expect(s).toContain('two-way');
        expect(s).toContain('no exit renumbers');
        expect(s).toContain('no link remains between rooms 0 and 1');
    });

    it('an unlinked exit is said to be refused, before the press', () => {
        const rec = setRecord(PACK, emptyMazeOverlay());
        expect(mazeDisconnectEffectOf(rowsOf(rec), 0, RING[0].from[1])).toMatch(/not linked — the op would be refused/);
    });
});

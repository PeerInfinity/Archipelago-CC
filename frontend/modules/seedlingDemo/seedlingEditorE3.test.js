/**
 * ⛓⛓⛓ **SEEDLING EDITOR E3 — THE WORLD MAP.** `seedlingSetMap.js`: which way a door leads, the canonical layout,
 * the drawn links, the sticky rule under `connect` / `disconnect`, and the disconnect preview's ordinal shift.
 * Every row names its MUTANT.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../flashPanel/seedlingSemantics.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { assertShape } from '../procgenCore/editorView.js';
import { buildLevelSet, vanillaRecordSet } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { emptyOverlay } from './seedlingSetOverlay.js';
import { createSeedlingSetAdapter, createSetSession, exitsOfRoom, setRecord } from './seedlingSetAdapter.js';
import {
    canonicalLayout, createSetMap, dirOfExit, edgeOf, frameOf, layoutCensus, layoutGraphOf, mapLinkShapes,
    mapLinksOf,
} from './seedlingSetMap.js';
import { disconnectEffectOf, roomRowsOf } from './watchSetEditor.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const MAP = JSON.parse(readFileSync(here('../flashPanel/atlases/seedling-map.json'), 'utf8'));
const EMBED = JSON.parse(readFileSync(here('./fixtures/seedling-vanilla-set.json'), 'utf8'));
const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: SEEDLING_TILE_SIZE,
    tileTypeForPlacement,
    rulesSchema: loadRulesSchema(),
    atlas: { game: 'seedling-editor-e3-test', mapDocument: 'seedling-editor-e3-test.json' },
});
const adapter = createSeedlingSetAdapter(DEPS);
const VANILLA = setRecord(vanillaRecordSet(EMBED, MAP).set, emptyOverlay());
const vanillaSession = () => createSetSession(adapter, VANILLA, { base: { kind: 'set', set_id: VANILLA.set.set_id } });
const layoutOf = (record) => canonicalLayout(layoutGraphOf(record, mapLinksOf(record, DEPS).links));
const apply = (s, op) => {
    const res = s.apply(op);
    if (!res.ok || !res.applied) throw new Error(res.description);
    return res;
};
const moved = (a, b) => a.filter((p, i) => p.gx !== b[i].gx || p.gy !== b[i].gy).length;

/** A small set built by hand: room 0 with a door on its EAST edge to room 1, whose return door is on its WEST edge. */
const door = (x, y, to, px, py) => ({ type: 'teleporter', x, y, attrs: { to: String(to), playerx: String(px), playery: String(py) } });
const smallSet = (doors) => {
    const levels = doors.map((ds, level) => ({ ...emptyLevel({ level, width: 10, height: 10 }), entities: ds }));
    return setRecord(buildLevelSet(levels, { setId: 'seedling-editor-e3-test' }).set, emptyOverlay());
};

describe('which way a door leads (the census decides what "placed by their exits" can mean)', () => {
    /** MUTANT: read the side from the arrival only, or call every door interior. */
    it('a door on an edge leads through that edge; an interior door falls back to its arrival, reversed', () => {
        const size = { w: 160, h: 160 };
        expect(edgeOf({ x: 152, y: 80 }, size)).toBe('E');
        expect(edgeOf({ x: 80, y: 8 }, size)).toBe('N');
        expect(edgeOf({ x: 80, y: 80 }, size)).toBe(null);
        expect(dirOfExit({ x: 144, y: 64, playerx: 8, playery: 64 }, size, size)).toEqual({ dir: 'E', from: 'source' });
        // ⛓ interior door, arrival on the target's WEST edge ⇒ the target lies EAST.
        expect(dirOfExit({ x: 64, y: 64, playerx: 4, playery: 80 }, size, size)).toEqual({ dir: 'E', from: 'arrival' });
        expect(dirOfExit({ x: 64, y: 64, playerx: 80, playery: 80 }, size, size)).toEqual({ dir: null, from: null });
    });

    /** MUTANT: drop pits or `named_rooms` arrivals from the map, or keep a link that leaves the set. */
    it('over the vanilla 116: every door, pit and named_rooms arrival is a link, and most doors have a direction', () => {
        const { links, unreadable } = mapLinksOf(VANILLA, DEPS);
        const docs = VANILLA.set.rooms.map((r, i) => exitsOfRoom(VANILLA, i).length);
        expect(unreadable).toEqual([]);
        expect(links.filter((l) => l.kind === 'exit').length).toBe(docs.reduce((a, b) => a + b, 0));
        expect(links.some((l) => l.kind === 'pit')).toBe(true);
        expect(new Set(links.filter((l) => l.kind === 'named').map((l) => l.key)))
            .toContain('tentacle_beast_mouth');
        const exitLinks = links.filter((l) => l.kind === 'exit');
        expect(exitLinks.filter((l) => l.dir).length * 2).toBeGreaterThan(exitLinks.length);
        expect(links.every((l) => l.to >= 0 && l.to < VANILLA.set.rooms.length)).toBe(true);
    });
});

describe('THE MAP — the canonical layout', () => {
    /** MUTANT: place a directed neighbour without its direction (any free cell). */
    it('a room reached through an EAST door sits one cell east', () => {
        const rec = smallSet([[door(144, 64, 1, 8, 64)], [door(0, 64, 0, 150, 64)]]);
        const pos = layoutOf(rec);
        expect(pos[1].gx - pos[0].gx).toBe(1);
        expect(pos[1].gy).toBe(pos[0].gy);
        // ⛓ …and WEST and NORTH too: the nearest-free-cell search tries east first, so east alone cannot tell a
        //   directed placement from an undirected one.
        const west = layoutOf(smallSet([[door(0, 64, 1, 150, 64)], []]));
        expect([west[1].gx - west[0].gx, west[1].gy - west[0].gy]).toEqual([-1, 0]);
        const north = layoutOf(smallSet([[door(64, 0, 1, 64, 150)], []]));
        expect([north[1].gx - north[0].gx, north[1].gy - north[0].gy]).toEqual([0, -1]);
    });

    /** MUTANT: read `start` as an integer (it is `{level}`), so every set lays out from room 0. */
    it('the layout grows from the manifest\'s start room', () => {
        const set = JSON.parse(JSON.stringify(VANILLA.set));
        set.start = { ...set.start, level: 5 };
        const g = layoutGraphOf(setRecord(set, emptyOverlay()), mapLinksOf(VANILLA, DEPS).links);
        expect(g.start).toBe(5);
        expect(layoutGraphOf(VANILLA, []).start).toBe(VANILLA.set.start.level);
    });

    /** MUTANT: a layout that reads a clock, a Math.random, or object identity — two derivations disagree. */
    it('same set → same layout, and every room has its own cell', () => {
        const a = layoutOf(VANILLA);
        const b = layoutOf(setRecord(JSON.parse(JSON.stringify(VANILLA.set)), emptyOverlay()));
        expect(b).toEqual(a);
        expect(new Set(a.map((p) => `${p.gx},${p.gy}`)).size).toBe(VANILLA.set.rooms.length);
        expect(Math.min(...a.map((p) => p.gx))).toBe(0);
        expect(Math.min(...a.map((p) => p.gy))).toBe(0);
    });

    /** MUTANT: ignore every direction — the census must say the directions are what place the rooms. */
    it('the directions buy legibility: more links land on their side than a direction-blind layout manages', () => {
        const g = layoutGraphOf(VANILLA, mapLinksOf(VANILLA, DEPS).links);
        const real = layoutCensus(g, canonicalLayout(g));
        const blind = layoutCensus(g, canonicalLayout({ ...g, links: g.links.map((l) => ({ ...l, dir: null })) }));
        expect(real.consistent).toBeGreaterThan(blind.consistent);
        expect(real.honoured).toBeGreaterThan(blind.honoured);
    });

    /** MUTANT: let a tile edit (no door touched) change the layout graph. */
    it('an edit that does not change the exit graph moves no room', () => {
        const s = vanillaSession();
        const room = s.record().set.rooms[3].source.record;
        apply(s, { op: 'set-room-field', room: 3, field: 'music', value: 2 });
        // ⛓ and a room edit that touches no door: the room replaced with one more (non-door) body.
        apply(s, { op: 'replace-room', room: 3, record: {
            ...room, entities: [...room.entities, { type: 'grass', x: 16, y: 16, attrs: {} }],
        } });
        expect(layoutGraphOf(s.record(), mapLinksOf(s.record(), DEPS).links).key)
            .toBe(layoutGraphOf(VANILLA, mapLinksOf(VANILLA, DEPS).links).key);
        const map = createSetMap(DEPS);
        map.frame(VANILLA);
        map.frame(s.record());
        expect(map.state(s.record()).rule).toBe('unchanged');
        expect(map.state(s.record()).moved).toBe(0);
    });
});

describe('LAYOUT STABILITY — connect / disconnect move nothing; a renumbering re-derives', () => {
    /** Find a connect from room 0 that WOULD move rooms under the canonical layout, so the sticky row discriminates. */
    const movingConnect = () => {
        const before = layoutOf(VANILLA);
        for (let to = VANILLA.set.rooms.length - 1; to > 0; to -= 1) {
            const s = vanillaSession();
            const res = s.apply({ op: 'connect', from: [0, 0], to: [to, 0], one_way: true });
            if (!res.ok || !res.applied) continue;
            if (moved(before, layoutOf(s.record())) > 0) return { s, to };
        }
        return null;
    };

    /** MUTANT: re-derive the canonical layout on every graph change (the sticky branch removed). */
    it('a connect keeps every room where it was (and the canonical layout alone would have moved some)', () => {
        const found = movingConnect();
        expect(found).not.toBeNull();
        const map = createSetMap(DEPS);
        const f0 = map.frame(VANILLA);
        const f1 = map.frame(found.s.record());
        expect(map.state(found.s.record())).toMatchObject({ rule: 'sticky', moved: 0 });
        expect(f1.cells).toEqual(f0.cells);
        // ⛓ …and the new link IS drawn.
        const links = map.state(found.s.record()).links;
        expect(links.some((l) => l.kind === 'exit' && l.from === 0 && l.to === found.to)).toBe(true);
    });

    /** MUTANT: same as above, from the other side. */
    it('a disconnect, and its undo, keep every room where it was', () => {
        const s = vanillaSession();
        const map = createSetMap(DEPS);
        const f0 = map.frame(s.record());
        apply(s, { op: 'disconnect', room: 0, exitIndex: 0 });
        expect(map.frame(s.record()).cells).toEqual(f0.cells);
        expect(map.state(s.record()).moved).toBe(0);
        s.undo();
        expect(map.frame(s.record()).cells).toEqual(f0.cells);
    });

    /** MUTANT: keep positions across a reorder (index-keyed positions would put the wrong room in each cell). */
    it('a reorder re-derives the canonical layout of the new order; RE-LAYOUT asks for the canonical one', () => {
        const s = vanillaSession();
        const map = createSetMap(DEPS);
        map.frame(s.record());
        const n = s.record().set.rooms.length;
        const order = [1, 0, ...Array.from({ length: n - 2 }, (_, i) => i + 2)];
        apply(s, { op: 'reorder', order });
        map.frame(s.record());
        expect(map.state(s.record()).rule).toBe('canonical');
        expect(map.state(s.record()).positions).toEqual(layoutOf(s.record()).map((p) => [p.gx, p.gy]));
        map.reset();
        expect(map.state(s.record()).rule).toBe('canonical');
    });
});

describe('THE LINKS as drawn', () => {
    const rec = smallSet([
        [door(144, 64, 1, 8, 64), door(64, 144, 2, 80, 8)],
        [door(0, 64, 0, 150, 64)],
        [],
    ]);
    const map = createSetMap(DEPS);
    const frame = map.frame(rec);

    /** MUTANT: draw a two-way door as two lines, or lose its second head. */
    it('one line per pair; a two-way pair has two heads, a one-way pair one', () => {
        const shapes = mapLinkShapes(mapLinksOf(rec, DEPS).links, frame);
        expect(shapes.length).toBe(2);
        const two = shapes.find((s) => s.link.a === 0 && s.link.b === 1);
        const one = shapes.find((s) => s.link.a === 0 && s.link.b === 2);
        expect(two.arrowBack).toBe(true);
        expect(Boolean(one.arrowBack)).toBe(false);
        for (const s of shapes) {
            const { link, ...rest } = s;
            expect(() => assertShape(rest)).not.toThrow();
        }
    });

    /** MUTANT: highlight only the INCOMING links of the selected room (the strip's rule). */
    it('selecting a room highlights its links in AND out', () => {
        const shapes = mapLinkShapes(mapLinksOf(rec, DEPS).links, frame, { selected: 2 });
        expect(shapes.find((s) => s.link.b === 2).highlight).toBe(true);
        const from0 = mapLinkShapes(mapLinksOf(rec, DEPS).links, frame, { selected: 0 });
        expect(from0.every((s) => s.highlight)).toBe(true);
    });

    /** MUTANT: draw a named_rooms arrival as an ordinary door. */
    it('a named_rooms arrival is its own line, marked as one', () => {
        const { links } = mapLinksOf(VANILLA, DEPS);
        const f = frameOf(layoutOf(VANILLA), mapLinksOf(VANILLA, DEPS).sizes);
        const named = mapLinkShapes(links, f).filter((s) => s.link.kind === 'named');
        expect(named.length).toBe(links.filter((l) => l.kind === 'named').length);
        expect(named.every((s) => s.label?.startsWith('★'))).toBe(true);
        const hi = mapLinkShapes(links, f, { selected: named[0].link.a });
        expect(hi.find((s) => s.link.kind === 'named' && s.link.a === named[0].link.a).label)
            .toMatch(/named_rooms\./);
    });

    /** MUTANT: answer a click in a room's cell with a neighbour, or a click in the gap with a room. */
    it('a click answers the room under it, a click between rooms answers none, and a link is picked near its line', () => {
        const c = frame.cells[1];
        expect(map.roomAt(rec, frame, { x: c.x + 5, y: c.y + 5 })).toBe(1);
        const shapes = map.shapes(rec, frame);
        const s = shapes.find((sh) => sh.link?.a === 0 && sh.link?.b === 1);
        const mid = { x: (s.points[0].x + s.points[1].x) / 2, y: (s.points[0].y + s.points[1].y) / 2 };
        expect(map.roomAt(rec, frame, mid)).toBe(null);
        expect(map.linkAt(rec, frame, mid)?.link).toMatchObject({ kind: 'exit', a: 0, b: 1 });
        expect(map.linkAt(rec, frame, { x: mid.x, y: mid.y + 40 })).toBe(null);
    });
});

describe('the DISCONNECT preview — the ordinal shift, said before the press', () => {
    const rows = roomRowsOf(VANILLA);

    /** MUTANT: say nothing about the later exits, or shift them the wrong way. */
    it('every later exit of the room moves down one ordinal, and the sentence says which', () => {
        const room = rows.findIndex((r) => r.exitList.length >= 3);
        const text = disconnectEffectOf(rows, room, 0);
        const later = rows[room].exitList.slice(1);
        for (const e of later) expect(text).toContain(`#${e.index}→#${e.index - 1}`);
        // ⛓ and the adapter agrees: after the op, the old #1 is the new #0.
        const s = vanillaSession();
        apply(s, { op: 'disconnect', room, exitIndex: 0 });
        const after = exitsOfRoom(s.record(), room);
        expect(after[0].x).toBe(later[0].x);
        expect(after[0].y).toBe(later[0].y);
        expect(after.length).toBe(rows[room].exitList.length - 1);
    });

    /** MUTANT: report a two-way pair as fully cut when the return door remains. */
    it('what remains between the two rooms is named', () => {
        const rec = smallSet([[door(144, 64, 1, 8, 64)], [door(0, 64, 0, 150, 64)]]);
        const r = roomRowsOf(rec);
        expect(disconnectEffectOf(r, 0, 0)).toMatch(/ONE-WAY: room 1 → room 0/);
        const one = smallSet([[door(144, 64, 1, 8, 64)], []]);
        expect(disconnectEffectOf(roomRowsOf(one), 0, 0)).toMatch(/no link remains/);
        expect(disconnectEffectOf(roomRowsOf(one), 0, 5)).toMatch(/has no exit #5 \(it has 1\)/);
    });
});

describe('the generated set (a pipeline preset) lays out too', () => {
    /** MUTANT: a layout that needs a vanilla-shaped set (a start of 0, all rooms linked). */
    it('every room placed, no two in one cell', () => {
        const rules = JSON.parse(readFileSync(here('../../presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json'), 'utf8'));
        return import('./seedlingGeneratedSet.js').then(({ assembleGeneratedSeedlingSet }) => {
            const rec = setRecord(assembleGeneratedSeedlingSet(rules).set, emptyOverlay());
            const pos = layoutOf(rec);
            expect(pos.length).toBe(rec.set.rooms.length);
            expect(new Set(pos.map((p) => `${p.gx},${p.gy}`)).size).toBe(pos.length);
        });
    });
});

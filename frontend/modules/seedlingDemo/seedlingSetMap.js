/**
 * seedlingDemo/seedlingSetMap — **THE LEVEL SET AS A 2D MAP** (Seedling editor E3).
 *
 * A DERIVED VIEW. The game knows nothing about where a room is (a room is an id; nothing in the set, the map
 * extract or the AS3 source carries a position), so nothing here is stored in the set or its OEL, and the set
 * adapter's one-row grid is untouched: the map is a picture of `{w: rooms.length, h: 1}`, and every click it
 * takes is answered as a room INDEX.
 *
 * ── WHAT "PLACED BY THEIR EXITS" CAN HONESTLY MEAN (the E3 census, vanilla 116) ──
 *
 * A door is an entity with a pixel position in its own room and an arrival point (`playerx`, `playery`) in the
 * target. 228 `teleporter`s, 26 `stairsup`, 26 `stairsdown`, and 12 pit fallthroughs (`<control fallthrough>`,
 * which carry no position at all). 146 of the 228 teleporters leave from one edge of their room and arrive at the
 * OPPOSITE edge of the target: that is a direction, and the layout uses it. A door in the interior of its room
 * (most stairs, some teleporters) says nothing about direction; neither does a pit nor a `named_rooms` arrival.
 *
 * ⇒ `dirOfExit`: the SOURCE side when the door is within `EDGE_FRACTION` of an edge; else the arrival's side in
 * the target, reversed (arriving on the target's west edge means the target lies east); else `null`. A link with
 * no direction places its room in the nearest free cell around the room that reached it (ring order below), so a
 * set joined only by teleporters in room interiors still gets a deterministic, compact layout.
 *
 * ── THE TWO LAYOUT RULES ──
 *
 *   · CANONICAL — `canonicalLayout(graph)` is a pure function of the LAYOUT GRAPH (room count, start, and every
 *     link's endpoints + direction). Same set → same layout. An edit that does not change that graph (a painted
 *     tile, a renamed room, a music change) moves nothing, because the graph is all it reads.
 *   · STICKY — `createSetMap()` remembers the last positions. While the rooms are the same rooms (same count, same
 *     name and size at every index), a changed graph — a `connect`, a `disconnect`, their undo — KEEPS EVERY
 *     POSITION: the new link is drawn where it falls, and zero rooms move. A renumbering (add, remove, reorder) or a
 *     new document re-derives the canonical layout. `reset()` (RE-LAYOUT on the page) asks for the canonical one.
 *
 * Positions live only in this object. No manual position is stored anywhere (not in the overlay either): a set
 * always renders as derived.
 *
 * ── ⛓ WHAT LIVES HERE AND WHAT IS SHARED (maze world map, step A) ──
 *
 * The layout, the frame, the drawn links, the picking and the provider were MOVED to `procgenCore/setMapLayout.js`
 * (behaviour-neutral: `seedlingSetMapLift.test.js` pins this map's digest, unchanged by the move). What stays is
 * Seedling's half: which way a door leads (`dirOfExit`), which links a set has (`mapLinksOf`: exits, pits,
 * `named_rooms` arrivals), the start and the fingerprint off `set`, the door ticks off the room's document, and how
 * a pit and a named arrival are drawn (`SEEDLING_LINK_KINDS`). Every name this module exported before the move it
 * still exports, with the same signature.
 */

import { NAMED_ROOMS, TILE_PX, indexOfRoom, roomRecordOf } from './levelSetValidator.js';
import { namedRoomArrivals } from './seedlingAtlasDerivation.js';
import {
    CONSISTENT_RINGS, DIRS, EDGE_FRACTION, MAP_GEOMETRY, OPPOSITE, canonicalLayout as layoutOfGraph, clampZoom,
    createSetMapProvider, distToSegment, doorTickShapes, edgeOf, frameOf, layoutCensus, layoutGraph,
    mapLinkShapes as linkShapesOf, roomFingerprintOf,
} from '../procgenCore/setMapLayout.js';

export { CONSISTENT_RINGS, DIRS, EDGE_FRACTION, MAP_GEOMETRY, clampZoom, distToSegment, edgeOf, frameOf, layoutCensus };

export class SeedlingSetMapError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedlingSetMapError';
    }
}
const fail = (m) => { throw new SeedlingSetMapError(m); };

/**
 * The direction a door leads in: from the source room's side, else from the arrival's side in the target
 * (reversed), else `null`.
 * @returns {{dir: 'N'|'S'|'E'|'W'|null, from: 'source'|'arrival'|null}}
 */
export function dirOfExit(exit, sourceSize, targetSize, tileSize = TILE_PX) {
    const half = tileSize / 2;
    const src = edgeOf({ x: exit.x + half, y: exit.y + half }, sourceSize);
    if (src) return { dir: src, from: 'source' };
    if (Number.isFinite(exit.playerx) && Number.isFinite(exit.playery)) {
        const arr = edgeOf({ x: exit.playerx, y: exit.playery }, targetSize);
        if (arr) return { dir: OPPOSITE[arr], from: 'arrival' };
    }
    return { dir: null, from: null };
}

/**
 * Every link the map draws, in a stable order: each room's exits (by ordinal), then its pits, then the
 * `named_rooms` arrivals (in `namedRoomArrivals`' own order). A link whose target is outside the set is dropped:
 * the map has nowhere to draw it, and the REPORT already names it.
 *
 * @param {object} record  the set session's `{set, overlay}`
 * @param {{parseOel?: Function, tileSize?: number}} deps
 * @returns {{links: object[], sizes: (object|null)[], unreadable: number[]}}
 */
export function mapLinksOf(record, { parseOel = null, tileSize = TILE_PX } = {}) {
    const rooms = record?.set?.rooms ?? [];
    const n = rooms.length;
    const docs = rooms.map((r) => indexOfRoom(r));
    const sizes = docs.map((d) => d?.size ?? null);
    const unreadable = docs.flatMap((d, i) => (d === null ? [i] : []));
    const inSet = (to) => Number.isInteger(to) && to >= 0 && to < n;
    const links = [];
    docs.forEach((d, from) => {
        if (!d) return;
        d.exits.forEach((e, index) => {
            if (!inSet(e.to)) return;
            const { dir, from: dirFrom } = dirOfExit(e, sizes[from], sizes[e.to], tileSize);
            links.push(Object.freeze({
                kind: 'exit', from, to: e.to, index, element: e.element, dir, dirFrom,
                x: e.x, y: e.y,
            }));
        });
        d.fallthroughs.forEach((f, index) => {
            if (!inSet(f.to)) return;
            links.push(Object.freeze({ kind: 'pit', from, to: f.to, index, element: f.element, dir: null, dirFrom: null }));
        });
    });
    /**
     * `named_rooms` arrivals: the derivation's own reader, over the rooms it can read. An `embed` room cannot be
     * read on a page and is in `unreadable` already.
     */
    const named = record?.set?.named_rooms ?? {};
    if (Object.keys(named).length > 0) {
        const recs = [];
        rooms.forEach((r, level) => {
            if (docs[level] === null || !docs[level].triggers?.size) return;
            try {
                recs.push({ level, entities: roomRecordOf(r, { parseOel }).entities ?? [] });
            } catch (e) {
                if (!(e instanceof Error)) throw e;
            }
        });
        const roomById = new Map(rooms.map((r, i) => [i, r]));
        for (const a of namedRoomArrivals(recs, named, { roomById })) {
            if (!inSet(a.to)) continue;
            links.push(Object.freeze({
                kind: 'named', from: a.from, to: a.to, key: a.key, element: a.trigger, dir: null, dirFrom: null,
            }));
        }
    }
    return { links, sizes, unreadable };
}

/** The keys `NAMED_ROOMS` declares — re-exported so a reader names them off this module. */
export const NAMED_ROOM_KEYS = Object.freeze(Object.keys(NAMED_ROOMS));

/** A room's doors as points in room PIXELS, by ordinal (the tile's centre), or `null` when it cannot be read. */
const doorPointsOf = (record, room, tileSize) => {
    const doc = indexOfRoom(record.set.rooms[room]);
    return doc ? doc.exits.map((e) => ({ x: e.x + tileSize / 2, y: e.y + tileSize / 2 })) : null;
};

/** The selected room's doors as small labelled ticks on its still, in canvas pixels (`#ordinal`). */
export function exitMarkerShapes(record, room, frame, sizes, { tileSize = TILE_PX } = {}) {
    const cell = frame.cells[room];
    const size = sizes[room];
    return doorTickShapes(room, frame, size, cell && size ? doorPointsOf(record, room, tileSize) : null);
}

/**
 * The LAYOUT GRAPH: everything the canonical layout reads, and nothing else.
 * @returns {{n:number, start:number, links:{from,to,dir}[], key:string}}
 */
export function layoutGraphOf(record, links) {
    const n = record?.set?.rooms?.length ?? 0;
    // ⛓ `start` is `{level, x?, y?}` in the schema; a bare integer is read too.
    const raw = record?.set?.start;
    const s = Number(raw !== null && typeof raw === 'object' ? raw.level : raw);
    const start = Number.isInteger(s) && s >= 0 && s < n ? s : 0;
    return layoutGraph(n, start, links);
}

/** The canonical layout of a layout graph (`procgenCore/setMapLayout.canonicalLayout`), refusing as this module. */
export const canonicalLayout = (graph) => layoutOfGraph(graph, (m) => fail(m.replace(/^setMapLayout:/, 'seedlingSetMap:')));

/** What makes two records "the same rooms" for the sticky rule: count, and every room's name and size. */
export function roomFingerprint(record, sizes) {
    return roomFingerprintOf((record?.set?.rooms ?? []).map((r) => r?.name ?? ''), sizes);
}

/**
 * ⛓ How Seedling's two non-exit link kinds are drawn: separate, offset lines. A named arrival is always MARKED (★);
 * its key is spelled out when it is highlighted, because one key can have several trigger rooms and the full label
 * on every line buries the map.
 */
const SEEDLING_LINK_KINDS = Object.freeze({
    pit: Object.freeze({
        offset: 7,
        label: ({ highlight, fromIdx, toIdx }) => (highlight ? `pit L${fromIdx} → L${toIdx}` : 'pit'),
    }),
    named: Object.freeze({
        offset: -7,
        label: ({ link, highlight }) => (highlight ? `★ named_rooms.${link.key}` : '★'),
    }),
});

/**
 * The drawn links, in canvas pixels: ONE line per unordered pair of rooms for exits (two heads when both rooms
 * have a door to the other), and separate, offset lines for pits and `named_rooms` arrivals, each labelled as
 * what it is (`SEEDLING_LINK_KINDS`). A link touching `selected` (in OR out) is highlighted and labelled.
 */
export const mapLinkShapes = (links, frame, { selected = null } = {}) => linkShapesOf(links, frame,
    { selected, kinds: SEEDLING_LINK_KINDS });

/**
 * ⛓⛓ THE PROVIDER `setEditorView`'s `overviewMap` takes — `procgenCore/setMapLayout.createSetMapProvider` over
 * Seedling's reader. One per mount; it holds the last positions (the sticky rule) and the zoom.
 *
 * @param {{parseOel?: Function, tileSize?: number}} deps
 */
export function createSetMap(deps = {}) {
    const { tileSize = TILE_PX } = deps;
    return createSetMapProvider({
        linksOf: (record) => mapLinksOf(record, deps),
        graphOf: layoutGraphOf,
        fingerprintOf: roomFingerprint,
        doorsOf: (record, room) => doorPointsOf(record, room, tileSize),
        kinds: SEEDLING_LINK_KINDS,
        fail: (m) => fail(m.replace(/^setMapLayout:/, 'seedlingSetMap:')),
    });
}

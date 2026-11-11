/**
 * mazeRoom/mazeSetMap — **A REGION LIBRARY AS A 2D MAP** (maze world map, step A of A → B → C).
 *
 * The maze lab's set arm mounts the shared set view (`procgenCore/setEditorView.mountSetEditor`), which draws a 2D
 * map in place of the one-row strip when it is handed an `overviewMap` provider. Seedling's provider is
 * `seedlingDemo/seedlingSetMap.createSetMap`; this is the maze's. Both are `procgenCore/setMapLayout`'s
 * `createSetMapProvider` over a READER, and the reader is the only part that knows the documents. Seedling's reads
 * a door's pixel position and its arrival; this one reads the library's entries and the overlay's links.
 *
 * ⛔ A VIEW. Nothing here is stored: not in the library, not in the overlay. The adapter's one-row grid, its ops and
 * its payloads are unchanged, and every click the map takes is still answered as a room INDEX.
 *
 * ── WHAT A MAZE DOOR CARRIES (the census in the maze world map as-built) ──
 *
 * A maze exit is `{exit_id, x, y, side, …}` in its entry's payload: a TILE on the room's border and the side it is
 * on. Which room it leads to is NOT in the entry (a region library forbids wiring inside its entries); it is an
 * overlay LINK, `{from: [room, exit_id], to: [room, exit_id], one_way}`, and `one_way` defaults to two-way
 * (`LINK_ONE_WAY_DEFAULT`). Over the committed `demo-maze-pack` every exit names a side and sits on that edge;
 * over the generated maze presets (`procgen_maze`, `procgen_topdown`) every exit does too, and the arrival is on
 * the opposite edge of the target for every two-way pair in `procgen_maze` and for 472 of 504 matched exits in
 * `procgen_topdown/AP_7`. Seedling-derived mazes (`seedling_playthrough_maze`) carry no `side`; their tiles are
 * on an edge for 252 of 326 exits by Seedling's 20% rule.
 *
 * ⇒ `dirOfMazeExit`: the exit's own `side`; else the edge its tile is on (`edgeOf`, `EDGE_FRACTION`); else the
 * arrival's side (or edge) in the target, reversed; else `null`.
 *
 * ⇒ the links (`mazeMapLinksOf`), in a stable order that is a function of the DOOR GRAPH and not of the overlay's
 * list order: each room's exits by ordinal, and for each exit every overlay link it leaves through — the `from`
 * end, or either end of a two-way link. A two-way link is therefore two directed links (one per end), drawn as one
 * line with two heads; a one-way link is one.
 */

import {
    createSetMapProvider, edgeOf, layoutGraph, OPPOSITE, roomFingerprintOf,
} from '../procgenCore/setMapLayout.js';
import { LINK_ONE_WAY_DEFAULT } from './mazeAtlasDerivation.js';

export class MazeSetMapError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeSetMapError';
    }
}
const fail = (m) => { throw new MazeSetMapError(m.replace(/^setMapLayout:/, 'mazeSetMap:')); };

const SIDES = Object.freeze(['N', 'S', 'E', 'W']);
const entriesOf = (record) => record?.library?.entries ?? [];

/** A room's size in TILES, or `null` when its payload names none. */
export function mazeRoomSize(entry) {
    const p = entry?.payload;
    return Number.isInteger(p?.width) && Number.isInteger(p?.height) && p.width > 0 && p.height > 0
        ? Object.freeze({ w: p.width, h: p.height }) : null;
}

/** The side an exit is on: its own `side`, else the edge its tile is on (tile centre, `EDGE_FRACTION`), else `null`. */
export function sideOfMazeExit(exit, size) {
    if (SIDES.includes(exit?.side)) return { side: exit.side, from: 'side' };
    if (Number.isFinite(exit?.x) && Number.isFinite(exit?.y)) {
        const e = edgeOf({ x: exit.x + 0.5, y: exit.y + 0.5 }, size);
        if (e) return { side: e, from: 'tile' };
    }
    return { side: null, from: null };
}

/**
 * The direction a maze door leads in: its own side, else the side its arrival is on in the target, reversed.
 * @returns {{dir: 'N'|'S'|'E'|'W'|null, from: 'side'|'tile'|'arrival'|null}}
 */
export function dirOfMazeExit(exit, sourceSize, arrival, targetSize) {
    const own = sideOfMazeExit(exit, sourceSize);
    if (own.side) return { dir: own.side, from: own.from };
    const far = arrival ? sideOfMazeExit(arrival, targetSize) : { side: null };
    if (far.side) return { dir: OPPOSITE[far.side], from: 'arrival' };
    return { dir: null, from: null };
}

/**
 * Every link the map draws (see the header for the order). A link naming a room or an exit the library does not
 * have is dropped: the adapter refuses such an overlay by name before the map ever sees it, and the map has nowhere
 * to draw it.
 *
 * @param {object} record  the set session's `{library, overlay}`
 * @returns {{links: object[], sizes: (object|null)[], unreadable: number[]}}
 */
export function mazeMapLinksOf(record) {
    const entries = entriesOf(record);
    const n = entries.length;
    const sizes = entries.map(mazeRoomSize);
    const unreadable = sizes.flatMap((s, i) => (s === null ? [i] : []));
    const exitOf = (room, id) => (Number.isInteger(room) && room >= 0 && room < n
        ? (entries[room].payload?.exits ?? []).find((e) => e.exit_id === id) ?? null : null);
    const overlayLinks = record?.overlay?.links ?? [];
    const links = [];
    entries.forEach((entry, from) => {
        (entry.payload?.exits ?? []).forEach((exit, index) => {
            overlayLinks.forEach((l, li) => {
                const oneWay = l.one_way ?? LINK_ONE_WAY_DEFAULT;
                const isFrom = l.from?.[0] === from && l.from?.[1] === exit.exit_id;
                const isTo = !oneWay && l.to?.[0] === from && l.to?.[1] === exit.exit_id;
                if (!isFrom && !isTo) return;
                const [to, toExit] = isFrom ? l.to : l.from;
                const arrival = exitOf(to, toExit);
                if (!arrival) return;
                const { dir, from: dirFrom } = dirOfMazeExit(exit, sizes[from], arrival, sizes[to]);
                links.push(Object.freeze({
                    kind: 'exit', from, to, index, exit_id: exit.exit_id, toExit, link: li, one_way: oneWay,
                    dir, dirFrom,
                }));
            });
        });
    });
    return { links, sizes, unreadable };
}

/**
 * The LAYOUT GRAPH. The start is `overlay.start` (a room index; absent means entry 0, which is what the atlas
 * derivation reads too).
 */
export function mazeLayoutGraphOf(record, links) {
    const n = entriesOf(record).length;
    const s = record?.overlay?.start;
    const start = Number.isInteger(s) && s >= 0 && s < n ? s : 0;
    return layoutGraph(n, start, links);
}

/** "The same rooms" for the sticky rule: count, and every entry's id, name and size. */
export function mazeRoomFingerprint(record, sizes) {
    return roomFingerprintOf(entriesOf(record).map((e) => `${e?.entry_id ?? ''}/${e?.name ?? ''}`), sizes);
}

/** A room's doors as points in TILES (the tile's centre), by ordinal, or `null`. */
export function mazeDoorPointsOf(record, room) {
    const entry = entriesOf(record)[room];
    if (!entry || !mazeRoomSize(entry)) return null;
    return (entry.payload?.exits ?? []).map((e) => ({ x: e.x + 0.5, y: e.y + 0.5 }));
}

/**
 * ⛓⛓ THE PROVIDER the maze lab hands `mountSetEditor` as `overviewMap`. One per mount, so its remembered
 * positions die with the document they were laid out for.
 */
export function createMazeSetMap() {
    return createSetMapProvider({
        linksOf: mazeMapLinksOf,
        graphOf: mazeLayoutGraphOf,
        fingerprintOf: mazeRoomFingerprint,
        doorsOf: mazeDoorPointsOf,
        fail,
    });
}

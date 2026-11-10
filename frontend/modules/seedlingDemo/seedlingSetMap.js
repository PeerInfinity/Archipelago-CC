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
 */

import { NAMED_ROOMS, TILE_PX, indexOfRoom, roomRecordOf } from './levelSetValidator.js';
import { namedRoomArrivals } from './seedlingAtlasDerivation.js';

export class SeedlingSetMapError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedlingSetMapError';
    }
}
const fail = (m) => { throw new SeedlingSetMapError(m); };

/** A door within this fraction of a room edge leaves through that edge. Measured choice: see the census above. */
export const EDGE_FRACTION = 0.2;

/** The map's geometry at zoom 1, in canvas pixels. */
export const MAP_GEOMETRY = Object.freeze({
    cellPx: 88,
    gapPx: 44,
    marginPx: 20,
    minZoom: 0.25,
    maxZoom: 3,
    zoomStep: 1.25,
    /** How far from a link (canvas px) a click still picks it. */
    pickPx: 7,
});

export const DIRS = Object.freeze({
    N: Object.freeze({ dx: 0, dy: -1 }),
    S: Object.freeze({ dx: 0, dy: 1 }),
    E: Object.freeze({ dx: 1, dy: 0 }),
    W: Object.freeze({ dx: -1, dy: 0 }),
});
const OPPOSITE = Object.freeze({ N: 'S', S: 'N', E: 'W', W: 'E' });

/**
 * Which edge a point lies on, or `null` for the interior.
 * @param {{x:number,y:number}} p  centre point, room pixels
 * @param {{w:number,h:number}} size  room size, pixels
 */
export function edgeOf(p, size, fraction = EDGE_FRACTION) {
    if (!size || !(size.w > 0) || !(size.h > 0) || !Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
    const d = [['W', p.x / size.w], ['E', (size.w - p.x) / size.w], ['N', p.y / size.h], ['S', (size.h - p.y) / size.h]];
    let best = d[0];
    for (const c of d) if (c[1] < best[1]) best = c;
    return best[1] < fraction ? best[0] : null;
}

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
    const lg = links.filter((l) => l.from !== l.to).map((l) => ({ from: l.from, to: l.to, dir: l.dir }));
    const key = `${n}|${start}|${lg.map((l) => `${l.from}>${l.to}${l.dir ?? '.'}`).join(',')}`;
    return { n, start, links: lg, key };
}

/** The ring of cells at Chebyshev distance `r`, in a fixed order: nearest (Manhattan) first, then E, S, W, N. */
function ring(r) {
    if (r === 0) return [{ dx: 0, dy: 0 }];
    const out = [];
    for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ dx, dy });
        }
    }
    const order = (c) => {
        // ⛓ E, S, W, N quadrant order for ties: a deterministic sweep, not a meaning.
        const a = Math.atan2(c.dy, c.dx);
        return a < 0 ? a + 2 * Math.PI : a;
    };
    return out.sort((a, b) => (Math.abs(a.dx) + Math.abs(a.dy)) - (Math.abs(b.dx) + Math.abs(b.dy))
        || order(a) - order(b));
}
/** How many rings around the wanted cell a directed placement searches before it gives up on the direction. */
export const CONSISTENT_RINGS = 4;
const RINGS = Array.from({ length: 40 }, (_, r) => ring(r));

/**
 * ⛓⛓ THE CANONICAL LAYOUT — breadth-first from the start room. A room reached by a link WITH a direction is
 * placed one cell that way from the room that reached it; one reached without a direction, or whose wanted cell
 * is taken, takes the nearest free cell (rings of growing distance, fixed order). Rooms no link reaches from the
 * start begin a new group to the right of everything placed so far, lowest index first.
 *
 * @param {{n, start, links}} graph
 * @returns {{gx:number, gy:number}[]} one grid cell per room, normalised so the smallest x and y are 0
 */
export function canonicalLayout(graph) {
    const { n, start } = graph;
    if (!Number.isInteger(n) || n < 0) fail(`seedlingSetMap: a layout needs a room count, got ${n}`);
    const adj = Array.from({ length: n }, () => []);
    for (const l of graph.links) {
        if (l.from === l.to) continue;
        adj[l.from].push({ to: l.to, d: l.dir ? DIRS[l.dir] : null });
    }
    // ⛓ Inbound links come after every outbound one, reversed, so a room reached only INTO still lands beside it.
    for (const l of graph.links) {
        if (l.from === l.to) continue;
        const d = l.dir ? DIRS[OPPOSITE[l.dir]] : null;
        adj[l.to].push({ to: l.from, d, inbound: true });
    }
    /**
     * ⛓ Directed links first (outbound before inbound, each in link order), then the undirected ones: a door with
     * no direction must not take the cell a directed door of the same room wants. MEASURED on the vanilla 116:
     * link order alone honoured 35 of 253 directed links; this order is what the census in the as-built quotes.
     */
    for (const list of adj) {
        list.forEach((e, i) => { e.order = i; });
        list.sort((a, b) => (a.d ? 0 : 1) - (b.d ? 0 : 1) || a.order - b.order);
    }
    const pos = new Array(n).fill(null);
    const taken = new Set();
    const k = (x, y) => `${x},${y}`;
    /**
     * Take the nearest free cell to `(x, y)`. With `toward` = `{u, d}` (the room that reached `v`, and the link's
     * direction) a cell must also lie in that direction's quarter-plane from `u` — so a second door on the same side
     * of a room still lands on that side — until `CONSISTENT_RINGS` rings have been tried; then any free cell.
     */
    const place = (v, x, y, toward = null) => {
        const ok = (gx, gy) => {
            if (!toward) return true;
            const dx = gx - pos[toward.u].gx;
            const dy = gy - pos[toward.u].gy;
            const along = toward.d.dx * dx + toward.d.dy * dy;
            return along > 0 && Math.abs(toward.d.dy * dx + toward.d.dx * dy) <= along;
        };
        for (let r = 0; ; r += 1) {
            const cells = RINGS[r] ?? ring(r);
            const strict = toward && r < CONSISTENT_RINGS;
            for (const c of cells) {
                const gx = x + c.dx;
                const gy = y + c.dy;
                if (!taken.has(k(gx, gy)) && (!strict || ok(gx, gy))) {
                    pos[v] = { gx, gy };
                    taken.add(k(gx, gy));
                    return;
                }
            }
        }
    };
    const bfs = (root) => {
        const queue = [root];
        while (queue.length) {
            const u = queue.shift();
            for (const { to, d } of adj[u]) {
                if (pos[to] !== null) continue;
                if (d) place(to, pos[u].gx + d.dx, pos[u].gy + d.dy, { u, d });
                else place(to, pos[u].gx, pos[u].gy);
                queue.push(to);
            }
        }
    };
    if (n === 0) return [];
    place(start, 0, 0);
    bfs(start);
    for (let v = 0; v < n; v += 1) {
        if (pos[v] !== null) continue;
        const maxX = Math.max(...pos.filter(Boolean).map((p) => p.gx));
        const minY = Math.min(...pos.filter(Boolean).map((p) => p.gy));
        place(v, maxX + 2, minY);
        bfs(v);
    }
    const mx = Math.min(...pos.map((p) => p.gx));
    const my = Math.min(...pos.map((p) => p.gy));
    return pos.map((p) => Object.freeze({ gx: p.gx - mx, gy: p.gy - my }));
}

/** What makes two records "the same rooms" for the sticky rule: count, and every room's name and size. */
export function roomFingerprint(record, sizes) {
    return (record?.set?.rooms ?? []).map((r, i) => `${r?.name ?? ''}|${sizes[i] ? `${sizes[i].w}x${sizes[i].h}` : '?'}`).join('\n');
}

/**
 * How well a layout honours its directions — the legibility census the as-built quotes.
 * @returns {{links, directed, honoured, consistent, adjacent, meanLength, cols, rows}}
 */
export function layoutCensus(graph, positions) {
    let directed = 0;
    let honoured = 0;
    let consistent = 0;
    let adjacent = 0;
    let total = 0;
    for (const l of graph.links) {
        const a = positions[l.from];
        const b = positions[l.to];
        const dx = b.gx - a.gx;
        const dy = b.gy - a.gy;
        total += Math.hypot(dx, dy);
        if (Math.abs(dx) + Math.abs(dy) === 1) adjacent += 1;
        if (l.dir) {
            directed += 1;
            if (dx === DIRS[l.dir].dx && dy === DIRS[l.dir].dy) honoured += 1;
            // ⛓ the softer reading: the target lies in the right quarter-plane (east: dx > 0 and |dy| <= dx).
            const along = DIRS[l.dir].dx * dx + DIRS[l.dir].dy * dy;
            const across = Math.abs(DIRS[l.dir].dy * dx + DIRS[l.dir].dx * dy);
            if (along > 0 && across <= along) consistent += 1;
        }
    }
    return {
        links: graph.links.length,
        directed,
        honoured,
        consistent,
        adjacent,
        meanLength: graph.links.length ? total / graph.links.length : 0,
        cols: positions.length ? Math.max(...positions.map((p) => p.gx)) + 1 : 0,
        rows: positions.length ? Math.max(...positions.map((p) => p.gy)) + 1 : 0,
    };
}

/** Clamp a zoom to the map's range. */
export const clampZoom = (z) => Math.min(MAP_GEOMETRY.maxZoom, Math.max(MAP_GEOMETRY.minZoom, Number(z) || 1));

/**
 * The canvas geometry of a layout at a zoom: one square cell per room, and the room's still letterboxed inside it.
 * @returns {{width, height, zoom, cells: {x,y,w,h, still:{x,y,w,h}}[]}}
 */
export function frameOf(positions, sizes, zoom = 1) {
    const z = clampZoom(zoom);
    const cell = Math.max(12, Math.round(MAP_GEOMETRY.cellPx * z));
    const gap = Math.max(6, Math.round(MAP_GEOMETRY.gapPx * z));
    const m = MAP_GEOMETRY.marginPx;
    const cols = positions.length ? Math.max(...positions.map((p) => p.gx)) + 1 : 1;
    const rows = positions.length ? Math.max(...positions.map((p) => p.gy)) + 1 : 1;
    const cells = positions.map((p, i) => {
        const x = m + p.gx * (cell + gap);
        const y = m + p.gy * (cell + gap);
        const s = sizes[i];
        let still = { x: x + 2, y: y + 2, w: cell - 4, h: cell - 4 };
        if (s && s.w > 0 && s.h > 0) {
            const k = Math.min((cell - 4) / s.w, (cell - 4) / s.h);
            const w = s.w * k;
            const h = s.h * k;
            still = { x: x + (cell - w) / 2, y: y + (cell - h) / 2, w, h };
        }
        return Object.freeze({ x, y, w: cell, h: cell, still: Object.freeze(still) });
    });
    return Object.freeze({
        width: m * 2 + cols * cell + (cols - 1) * gap,
        height: m * 2 + rows * cell + (rows - 1) * gap,
        zoom: z,
        cells: Object.freeze(cells),
    });
}

/** Where the segment from a rect's centre toward `p` leaves the rect, pulled out by `pad`. */
function rim(rect, p, pad = 3) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const sx = dx === 0 ? Infinity : (rect.w / 2 + pad) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (rect.h / 2 + pad) / Math.abs(dy);
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * The drawn links, in canvas pixels: ONE line per unordered pair of rooms for exits (two heads when both rooms
 * have a door to the other), and separate, offset lines for pits and `named_rooms` arrivals, each labelled as
 * what it is. A link touching `selected` (in OR out) is highlighted and labelled.
 *
 * @returns {object[]} `{kind:'polyline', points, arrow, arrowBack, highlight, label?, link}` — `link` is
 *   `{kind, a, b, ab: exit links a→b, ba: exit links b→a}` for picking; it is stripped before a shape is handed on.
 */
export function mapLinkShapes(links, frame, { selected = null } = {}) {
    const pairs = new Map();
    const extra = [];
    for (const l of links) {
        if (l.from === l.to) {
            extra.push({ kind: l.kind, a: l.from, b: l.to, ab: [l], ba: [], key: l.key });
            continue;
        }
        if (l.kind !== 'exit') {
            extra.push({ kind: l.kind, a: l.from, b: l.to, ab: [l], ba: [], key: l.key });
            continue;
        }
        const a = Math.min(l.from, l.to);
        const b = Math.max(l.from, l.to);
        const key = `${a}-${b}`;
        if (!pairs.has(key)) pairs.set(key, { kind: 'exit', a, b, ab: [], ba: [] });
        (l.from === a ? pairs.get(key).ab : pairs.get(key).ba).push(l);
    }
    const out = [];
    const offsetFor = { exit: 0, pit: 7, named: -7 };
    const draw = (link) => {
        const ra = frame.cells[link.a];
        const rb = frame.cells[link.b];
        if (!ra || !rb) return;
        const highlight = selected !== null && (link.a === selected || link.b === selected);
        if (link.a === link.b) {
            const c = centre(ra);
            out.push({
                kind: 'polyline',
                points: [{ x: c.x - ra.w * 0.2, y: ra.y }, { x: c.x - ra.w * 0.15, y: ra.y - 12 },
                    { x: c.x + ra.w * 0.15, y: ra.y - 12 }, { x: c.x + ra.w * 0.2, y: ra.y }],
                arrow: true,
                highlight,
                label: `L${link.a} ↺${link.kind === 'exit' ? '' : ` ${link.kind}`}`,
                link,
            });
            return;
        }
        // ⛓ Drawn from→to: for an exit pair `a` is the lower index; a one-way pair whose only door is b→a is drawn b→a.
        const [f, t] = link.kind === 'exit' && link.ab.length === 0 ? [rb, ra] : [ra, rb];
        const fromIdx = f === ra ? link.a : link.b;
        const toIdx = f === ra ? link.b : link.a;
        const cf = centre(f);
        const ct = centre(t);
        const len = Math.hypot(ct.x - cf.x, ct.y - cf.y) || 1;
        const off = offsetFor[link.kind] ?? 0;
        const ox = (-(ct.y - cf.y) / len) * off;
        const oy = ((ct.x - cf.x) / len) * off;
        const p0 = rim(f, ct);
        const p1 = rim(t, cf);
        const twoWay = link.kind === 'exit' && link.ab.length > 0 && link.ba.length > 0;
        let label;
        // ⛓ A named arrival is always MARKED (★); its key is spelled out when it is highlighted, because one key
        //   can have several trigger rooms and the full label on every line buries the map.
        if (link.kind === 'named') label = highlight ? `★ named_rooms.${link.key}` : '★';
        else if (link.kind === 'pit') label = highlight ? `pit L${fromIdx} → L${toIdx}` : 'pit';
        else if (highlight) label = twoWay ? `L${fromIdx} ↔ L${toIdx}` : `L${fromIdx} → L${toIdx}`;
        out.push({
            kind: 'polyline',
            points: [{ x: p0.x + ox, y: p0.y + oy }, { x: p1.x + ox, y: p1.y + oy }],
            arrow: true,
            arrowBack: twoWay,
            highlight,
            ...(label ? { label } : {}),
            link: { ...link, from: fromIdx, to: toIdx },
        });
    };
    for (const p of pairs.values()) draw(p);
    for (const e of extra) draw(e);
    return out;
}

/** The selected room's doors as small labelled ticks on its still, in canvas pixels (`#ordinal`). */
export function exitMarkerShapes(record, room, frame, sizes, { tileSize = TILE_PX } = {}) {
    const cell = frame.cells[room];
    const size = sizes[room];
    const doc = cell && size ? indexOfRoom(record.set.rooms[room]) : null;
    if (!doc) return [];
    const k = cell.still.w / size.w;
    return doc.exits.map((e, index) => {
        const x = cell.still.x + (e.x + tileSize / 2) * k;
        const y = cell.still.y + (e.y + tileSize / 2) * k;
        return {
            kind: 'polyline',
            points: [{ x: x - 3, y }, { x: x + 3, y }],
            highlight: true,
            label: `#${index}`,
            marker: { room, index, x, y },
        };
    });
}

/** Distance from a point to a segment, in the same units. */
export function distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * ⛓⛓ THE PROVIDER `setEditorView`'s `overviewMap` takes. One per mount; it holds the last positions (the sticky
 * rule) and the zoom. Everything it answers is in canvas pixels; the mount converts for the overlay.
 *
 * @param {{parseOel?: Function, tileSize?: number}} deps
 */
export function createSetMap(deps = {}) {
    let last = null; // {record, fingerprint, graphKey, positions, links, sizes, unreadable}
    let zoom = 1;
    let relayouts = 0;
    let lastMoved = 0;
    let lastRule = 'canonical';
    const layoutOf = (record) => {
        if (last && last.record === record) return last;
        const { links, sizes, unreadable } = mapLinksOf(record, deps);
        const graph = layoutGraphOf(record, links);
        const fingerprint = roomFingerprint(record, sizes);
        let positions;
        let rule;
        if (last && last.graphKey === graph.key && last.fingerprint === fingerprint) {
            positions = last.positions;
            rule = 'unchanged';
        } else if (last && last.fingerprint === fingerprint) {
            positions = last.positions;
            rule = 'sticky';
        } else {
            positions = canonicalLayout(graph);
            rule = 'canonical';
        }
        const prev = last?.positions ?? null;
        lastMoved = prev && prev.length === positions.length
            ? positions.filter((p, i) => p.gx !== prev[i].gx || p.gy !== prev[i].gy).length
            : positions.length;
        lastRule = rule;
        last = { record, fingerprint, graphKey: graph.key, graph, positions, links, sizes, unreadable };
        return last;
    };
    return {
        /** The canvas geometry for this record at the current zoom. */
        frame(record) {
            const l = layoutOf(record);
            return frameOf(l.positions, l.sizes, zoom);
        },
        /** The links and (for the selected room) its door markers, in canvas pixels. */
        shapes(record, frame, { selected = null } = {}) {
            const l = layoutOf(record);
            const shapes = mapLinkShapes(l.links, frame, { selected });
            if (selected !== null) shapes.push(...exitMarkerShapes(record, selected, frame, l.sizes, deps));
            return shapes;
        },
        /** The room under a canvas point, or `null`. */
        roomAt(record, frame, p) {
            const i = frame.cells.findIndex((c) => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h);
            return i >= 0 ? i : null;
        },
        /** The nearest drawn link within `pickPx` of a canvas point, or `null`. */
        linkAt(record, frame, p, { selected = null } = {}) {
            let best = null;
            for (const s of this.shapes(record, frame, { selected })) {
                if (!s.link) continue;
                for (let i = 1; i < s.points.length; i += 1) {
                    const d = distToSegment(p, s.points[i - 1], s.points[i]);
                    if (d <= MAP_GEOMETRY.pickPx && (!best || d < best.d)) best = { d, shape: s };
                }
            }
            if (!best) return null;
            const s = best.shape;
            // ⛓ The end nearer the click is the room whose door the pick means.
            const a = s.points[0];
            const b = s.points[s.points.length - 1];
            const nearFrom = Math.hypot(p.x - a.x, p.y - a.y) <= Math.hypot(p.x - b.x, p.y - b.y);
            return { link: s.link, nearRoom: nearFrom ? s.link.from : s.link.to };
        },
        /** A door marker of the selected room under a canvas point, or `null`. */
        markerAt(record, frame, p, room) {
            const l = layoutOf(record);
            for (const s of exitMarkerShapes(record, room, frame, l.sizes, deps)) {
                if (Math.hypot(p.x - s.marker.x, p.y - s.marker.y) <= MAP_GEOMETRY.pickPx) return s.marker;
            }
            return null;
        },
        get zoom() { return zoom; },
        setZoom(z) { zoom = clampZoom(z); return zoom; },
        /** Forget the remembered positions: the next frame is the canonical layout. */
        reset() { last = null; relayouts += 1; },
        /** What the last layout decided, for a readout. */
        state(record) {
            const l = layoutOf(record);
            return {
                rule: lastRule,
                moved: lastMoved,
                relayouts,
                zoom,
                positions: l.positions.map((p) => [p.gx, p.gy]),
                links: l.links.map((k) => ({
                    kind: k.kind, from: k.from, to: k.to, index: k.index ?? null, key: k.key ?? null, dir: k.dir,
                })),
                unreadable: [...l.unreadable],
                census: layoutCensus(l.graph, l.positions),
            };
        },
    };
}

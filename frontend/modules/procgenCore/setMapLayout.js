/**
 * procgenCore/setMapLayout — **THE SET MAP'S LAYOUT, SHARED BY EVERY SUBSTRATE** (maze world map, step A).
 *
 * Seedling editor E3 drew a level set as a 2D map (`seedlingDemo/seedlingSetMap.js`). Everything in that file
 * except WHICH WAY A DOOR LEADS was already substrate-agnostic: the canonical layout, the sticky rule, the frame,
 * the drawn links, the picking. This file is that half, MOVED (the Seedling map is byte-identical: its digest pin
 * is `seedlingSetMapLift.test.js`). A substrate builds its provider with `createSetMapProvider(reader)`, and the
 * reader is the only part that knows the substrate's documents.
 *
 * ── THE READER (what a substrate supplies) ──
 *
 *   · `linksOf(record)` → `{links, sizes, unreadable}`. `links` are `{kind, from, to, index?, key?, dir, …}` in a
 *     STABLE order (the layout's breadth-first walk reads them in that order); `dir` is `'N'|'S'|'E'|'W'|null`.
 *     `sizes[i]` is room i's `{w, h}` in any unit the reader also uses for door points (pixels, tiles), or `null`.
 *     `unreadable` lists rooms the reader could not read.
 *   · `graphOf(record, links)` → `layoutGraph(n, start, links)`: the room count and the start room are the
 *     substrate's facts; the key is built here.
 *   · `fingerprintOf(record, sizes)` → a string: "the same rooms" for the sticky rule (see `roomFingerprintOf`).
 *   · `doorsOf(record, room)` → the room's doors as points `{x, y}` in `sizes`' unit, by ordinal (the exit list's
 *     order), or `null` when the room cannot be read. These are the ticks a CONNECT click picks an exit by.
 *   · `kinds` (optional) → `{[kind]: {offset, label({link, highlight, fromIdx, toIdx})}}` for link kinds other than
 *     `exit` (Seedling's `pit` and `named`). An exit pair is always one line, two heads when both rooms have a door
 *     to the other.
 *
 * ── THE TWO LAYOUT RULES ──
 *
 *   · CANONICAL — `canonicalLayout(graph)` is a pure function of the LAYOUT GRAPH (room count, start, and every
 *     link's endpoints + direction). Same set → same layout. An edit that does not change that graph moves nothing,
 *     because the graph is all it reads.
 *   · STICKY — the provider remembers the last positions. While the rooms are the same rooms (the reader's
 *     fingerprint), a changed graph — a `connect`, a `disconnect`, their undo — KEEPS EVERY POSITION: the new link
 *     is drawn where it falls, and zero rooms move. A renumbering or a new document re-derives the canonical layout.
 *     `reset()` (RE-LAYOUT on the page) asks for the canonical one.
 *
 * Positions live only in the provider. No position is stored anywhere: a set always renders as derived.
 *
 * ⛔ No substrate import here (`bindingContract.test.js` refuses one in `procgenCore/`).
 */

export class SetMapLayoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SetMapLayoutError';
    }
}
const defaultFail = (m) => { throw new SetMapLayoutError(m); };

/**
 * A door within this fraction of a room edge leaves through that edge. Measured choice: Seedling's vanilla 116
 * (`seedlingSetMap.js`'s census) and the maze's side-less exits (the maze world map as-built).
 */
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
export const OPPOSITE = Object.freeze({ N: 'S', S: 'N', E: 'W', W: 'E' });

/**
 * Which edge a point lies on, or `null` for the interior.
 * @param {{x:number,y:number}} p  centre point, in the room's unit
 * @param {{w:number,h:number}} size  room size, same unit
 */
export function edgeOf(p, size, fraction = EDGE_FRACTION) {
    if (!size || !(size.w > 0) || !(size.h > 0) || !Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
    const d = [['W', p.x / size.w], ['E', (size.w - p.x) / size.w], ['N', p.y / size.h], ['S', (size.h - p.y) / size.h]];
    let best = d[0];
    for (const c of d) if (c[1] < best[1]) best = c;
    return best[1] < fraction ? best[0] : null;
}

/**
 * The LAYOUT GRAPH: everything the canonical layout reads, and nothing else. `n` and `start` are the substrate's.
 * @returns {{n:number, start:number, links:{from,to,dir}[], key:string}}
 */
export function layoutGraph(n, start, links) {
    const lg = links.filter((l) => l.from !== l.to).map((l) => ({ from: l.from, to: l.to, dir: l.dir }));
    const key = `${n}|${start}|${lg.map((l) => `${l.from}>${l.to}${l.dir ?? '.'}`).join(',')}`;
    return { n, start, links: lg, key };
}

/** What makes two records "the same rooms" for the sticky rule: count, and every room's name and size. */
export function roomFingerprintOf(names, sizes) {
    return names.map((name, i) => `${name}|${sizes[i] ? `${sizes[i].w}x${sizes[i].h}` : '?'}`).join('\n');
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
 * @param {Function} [fail] how a refusal is thrown — the substrate's own error class and module name
 * @returns {{gx:number, gy:number}[]} one grid cell per room, normalised so the smallest x and y are 0
 */
export function canonicalLayout(graph, fail = defaultFail) {
    const { n, start } = graph;
    if (!Number.isInteger(n) || n < 0) fail(`setMapLayout: a layout needs a room count, got ${n}`);
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
     * link order alone honoured 35 of 253 directed links; this order is what the E3 census in the as-built quotes.
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
 * have a door to the other), and separate, offset lines for any other kind, each labelled by its `kinds` entry. A
 * link touching `selected` (in OR out) is highlighted and labelled.
 *
 * @param {{selected?: number|null, kinds?: object}} o  `kinds` — see the reader in the header
 * @returns {object[]} `{kind:'polyline', points, arrow, arrowBack, highlight, label?, link}` — `link` is
 *   `{kind, a, b, ab: exit links a→b, ba: exit links b→a}` for picking; it is stripped before a shape is handed on.
 */
export function mapLinkShapes(links, frame, { selected = null, kinds = {} } = {}) {
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
        const style = link.kind === 'exit' ? null : (kinds[link.kind] ?? null);
        const off = style?.offset ?? 0;
        const ox = (-(ct.y - cf.y) / len) * off;
        const oy = ((ct.x - cf.x) / len) * off;
        const p0 = rim(f, ct);
        const p1 = rim(t, cf);
        const twoWay = link.kind === 'exit' && link.ab.length > 0 && link.ba.length > 0;
        let label;
        if (style?.label) label = style.label({ link, highlight, fromIdx, toIdx });
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

/**
 * A room's doors as small labelled ticks on its still, in canvas pixels (`#ordinal`).
 * @param {{x:number,y:number}[]|null} points  the doors, in the unit of `size`, by ordinal
 */
export function doorTickShapes(room, frame, size, points) {
    const cell = frame.cells[room];
    if (!cell || !size || !points) return [];
    const k = cell.still.w / size.w;
    return points.map((pt, index) => {
        const x = cell.still.x + pt.x * k;
        const y = cell.still.y + pt.y * k;
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
 * @param {{linksOf: Function, graphOf: Function, fingerprintOf: Function, doorsOf: Function, kinds?: object,
 *   fail?: Function}} reader  see the header
 */
export function createSetMapProvider(reader) {
    const { linksOf, graphOf, fingerprintOf, doorsOf, kinds = {}, fail = defaultFail } = reader;
    let last = null; // {record, fingerprint, graphKey, positions, links, sizes, unreadable}
    let zoom = 1;
    let relayouts = 0;
    let lastMoved = 0;
    let lastRule = 'canonical';
    const layoutOf = (record) => {
        if (last && last.record === record) return last;
        const { links, sizes, unreadable } = linksOf(record);
        const graph = graphOf(record, links);
        const fingerprint = fingerprintOf(record, sizes);
        let positions;
        let rule;
        if (last && last.graphKey === graph.key && last.fingerprint === fingerprint) {
            positions = last.positions;
            rule = 'unchanged';
        } else if (last && last.fingerprint === fingerprint) {
            positions = last.positions;
            rule = 'sticky';
        } else {
            positions = canonicalLayout(graph, fail);
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
    const ticksOf = (record, room, frame, sizes) => doorTickShapes(room, frame, sizes[room],
        frame.cells[room] && sizes[room] ? doorsOf(record, room) : null);
    return {
        /** The canvas geometry for this record at the current zoom. */
        frame(record) {
            const l = layoutOf(record);
            return frameOf(l.positions, l.sizes, zoom);
        },
        /** The links and (for the selected room) its door markers, in canvas pixels. */
        shapes(record, frame, { selected = null } = {}) {
            const l = layoutOf(record);
            const shapes = mapLinkShapes(l.links, frame, { selected, kinds });
            if (selected !== null) shapes.push(...ticksOf(record, selected, frame, l.sizes));
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
            for (const s of ticksOf(record, room, frame, l.sizes)) {
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

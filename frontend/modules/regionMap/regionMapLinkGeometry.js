/**
 * regionMap/regionMapLinkGeometry — **WHERE A LINK'S LINE STARTS AND ENDS** (region-map link-ends).
 *
 * ⛔ PURE: no imports but the frames' tile maths, no DOM. World px in, world px out; the panel maps to the screen.
 *
 * ⚖ The user, session 84c8ab35, 2026-11-22T21:55:35Z: *"For arrows between adjacent nodes, I want just a yellow line
 * in the gap between the squares, not an arrow pointing to the center of the square. Also, for nodes that aren't
 * adjacent, I would like the arrow to end at the edge of the square, not the middle of the square, if possible."*
 * And at 21:55Z, "No arrowhead on joins": an edge transition (`join`) has no arrowhead; down / up / warp keep theirs.
 *
 * Adjacency is on the CELL (`f.cell`): the rectangle the panel strokes in `COLORS.cellBorder`. A LINE between cells that
 * are not adjacent ends at the level ART or at the door tile (region-map art-ends; see `linkShape`).
 *
 * ⛓ THE ADJACENCY RULE (`cellsAdjacent`): two cells are adjacent when they face each other across ONE gap of at most
 * `tol` world px (default `GUTTER_PX`, the gutter between two neighbouring slots; the gap between GROUPS is
 * `GAP_PX` + a gutter, so it never counts) AND their facing sides overlap by a positive length. A corner touch
 * (overlap 0) is NOT adjacent: there is no shared border to put a mark on.
 */
import { GUTTER_PX, tileCentre } from './regionMapFrames.js';

const EPS = 1e-9;

/**
 * Do two rectangles `{x, y, w, h}` share a border across a gap ≤ `tol`?
 * @returns {null|{axis:'x'|'y', gap:number, lo:number, hi:number, at0:number, at1:number}}  `axis` the direction you
 *   cross the gap in; `at0` / `at1` the coordinate (on that axis) of `a`'s / `b`'s facing side; `lo..hi` the shared
 *   stretch of the border on the other axis.
 */
export function cellsAdjacent(a, b, tol = GUTTER_PX) {
    if (!a || !b) return null;
    const ovY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const ovX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (ovY > EPS) {
        if (b.x >= a.x + a.w - EPS && b.x - (a.x + a.w) <= tol + EPS) {
            return { axis: 'x', gap: b.x - (a.x + a.w), lo: Math.max(a.y, b.y), hi: Math.min(a.y + a.h, b.y + b.h), at0: a.x + a.w, at1: b.x };
        }
        if (a.x >= b.x + b.w - EPS && a.x - (b.x + b.w) <= tol + EPS) {
            return { axis: 'x', gap: a.x - (b.x + b.w), lo: Math.max(a.y, b.y), hi: Math.min(a.y + a.h, b.y + b.h), at0: a.x, at1: b.x + b.w };
        }
    }
    if (ovX > EPS) {
        if (b.y >= a.y + a.h - EPS && b.y - (a.y + a.h) <= tol + EPS) {
            return { axis: 'y', gap: b.y - (a.y + a.h), lo: Math.max(a.x, b.x), hi: Math.min(a.x + a.w, b.x + b.w), at0: a.y + a.h, at1: b.y };
        }
        if (a.y >= b.y + b.h - EPS && a.y - (b.y + b.h) <= tol + EPS) {
            return { axis: 'y', gap: a.y - (b.y + b.h), lo: Math.max(a.x, b.x), hi: Math.min(a.x + a.w, b.x + b.w), at0: a.y, at1: b.y + b.h };
        }
    }
    return null;
}

/**
 * The mark across the gap between two adjacent cells: from `a`'s facing side to `b`'s, at the door tiles' place along
 * the shared border (their mean, each projected onto it) when given, else the border's middle; clamped to the shared
 * stretch. `pa` / `pb`: world points (a door tile's centre) or null.
 * @returns {{x0:number,y0:number,x1:number,y1:number}}
 */
export function gapSegment(adj, pa = null, pb = null) {
    const along = (p) => (p ? (adj.axis === 'x' ? p.y : p.x) : null);
    const ps = [along(pa), along(pb)].filter((v) => v != null && Number.isFinite(v));
    let t = ps.length ? ps.reduce((s, v) => s + v, 0) / ps.length : (adj.lo + adj.hi) / 2;
    t = Math.min(adj.hi, Math.max(adj.lo, t));
    return adj.axis === 'x'
        ? { x0: adj.at0, y0: t, x1: adj.at1, y1: t }
        : { x0: t, y0: adj.at0, x1: t, y1: adj.at1 };
}

/**
 * Liang–Barsky: the parameters `[t0, t1]` (0..1) of the part of the segment p→q inside the rectangle (border
 * included), or null when the segment misses it.
 */
export function segmentInRect(p, q, r) {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    let t0 = 0;
    let t1 = 1;
    const edges = [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]];
    for (const [pp, qq] of edges) {
        if (Math.abs(pp) < EPS) {
            if (qq < -EPS) return null;
            continue;
        }
        const t = qq / pp;
        if (pp < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
        if (t0 > t1 + EPS) return null;
    }
    return [t0, t1];
}

/**
 * The line from `p` (in the source rectangle `ra`) toward `q` (in the target `rb`), cut so it starts where it LEAVES
 * `ra` and ends where it ENTERS `rb`; a null rectangle leaves that end uncut. The direction is p→q's, unchanged. A point outside its own
 * cell is kept as it is. If the cut would leave nothing (overlapping cells), the uncut segment is returned.
 * @returns {{x0:number,y0:number,x1:number,y1:number, clipped:boolean}}
 */
export function clipBetweenRects(p, q, ra, rb) {
    // t = 0 / 1 return p / q themselves (an unclipped end is EXACTLY its point: a door tile's centre).
    const at = (t) => (t <= 0 ? { x: p.x, y: p.y } : t >= 1 ? { x: q.x, y: q.y } : { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const sa = ra ? segmentInRect(p, q, ra) : null;
    const sb = rb ? segmentInRect(p, q, rb) : null;
    const tStart = sa && sa[0] <= EPS ? sa[1] : 0;
    const tEnd = sb && sb[1] >= 1 - EPS ? sb[0] : 1;
    if (!(tEnd > tStart + EPS)) return { x0: p.x, y0: p.y, x1: q.x, y1: q.y, clipped: false };
    const s = at(tStart);
    const e = at(tEnd);
    return { x0: s.x, y0: s.y, x1: e.x, y1: e.y, clipped: tStart > 0 || tEnd < 1 };
}

/** ⛓ An arrowhead on a link of this kind? Every kind but `join` (⚖ "No arrowhead on joins"). */
export const linkHasArrowhead = (kind) => (kind ?? 'join') !== 'join';

/** The drawn level ART's rectangle (`f.x / y / w / h`), as opposed to the cell around it (`f.cell`). */
export const artRect = (f) => ({ x: f.x, y: f.y, w: f.w, h: f.h });

/**
 * ⛓⛓ **THE ONE ANSWER FOR A LINK'S DRAWN SHAPE** — the panel draws it, the census counts it.
 *
 * Adjacent cells (`cellsAdjacent` on `f.cell`): a GAP mark, unchanged since link-ends.
 *
 * Otherwise a LINE (⚖ the user, session 84c8ab35, 2026-11-23T01:20:20.902Z: *"End lines at the art. Also, if the arrows
 * have a known source or destination tile, then the arrow should start or end at that tile, if possible."*):
 *   · each end's AIM point is its door tile's CENTRE (`link.a` in `from`'s level, `link.b` in `to`'s: the link's OWN
 *     exit and its reciprocal, as the model reads them — never "the nearest" of several), else its art's centre;
 *     A door tile counts only on a frame whose extent is real (not `ext.estimated`): see below;
 *   · an end WITH a door tile is that tile's centre: not clipped (the line runs over its own level's art to the door);
 *   · an end WITHOUT one is clipped to its level's ART rectangle (`artRect`, not `f.cell`), on the straight line
 *     between the two aim points. So a tile → no-tile link runs from the tile toward the other art's centre and stops
 *     on that art's border; no-tile → tile runs from where the line leaves its own art to the tile.
 *   · the arrowhead (down / up / warp) has its tip at the `to` end: the door tile's centre, or the art's border.
 * `ends.from` / `ends.to`: 'tile' (a door tile's centre), 'art' (clipped to the art's border) or 'centre' (no tile
 * and nothing to clip: the art centre, kept — the census lists these).
 * @param {{from:string,to:string,kind?:string,a?:number[]|null,b?:number[]|null}} link
 * @param {Map<string,object>} frames  `cellFrames` output
 * @returns {null|{form:'gap'|'line', seg:{x0,y0,x1,y1}, head:boolean, axis?:'x'|'y', ends?:{from:string,to:string}}}
 *   null when an end has no frame
 */
export function linkShape(link, frames, tol = GUTTER_PX) {
    const fa = frames.get(link.from);
    const fb = frames.get(link.to);
    if (!fa || !fb) return null;
    const end = (f, tile) => (tile ? tileCentre(f, tile[0], tile[1]) : null);
    const da = end(fa, link.a);
    const db = end(fb, link.b);
    const head = linkHasArrowhead(link.kind);
    const adj = cellsAdjacent(fa.cell, fb.cell, tol);
    if (adj) return { form: 'gap', seg: gapSegment(adj, da, db), head, axis: adj.axis };
    const centre = (f) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
    // A door tile is only a place on a level whose extent is REAL: an `estimated` frame (no extent from the substrate,
    // drawn as a `DEFAULT_EXTENT` square) has no true spot for it, so that end is clipped to the art instead.
    const ta = da && !fa.ext?.estimated ? da : null;
    const tb = db && !fb.ext?.estimated ? db : null;
    const p = ta ?? centre(fa);
    const q = tb ?? centre(fb);
    const { clipped: _c, ...seg } = clipBetweenRects(p, q, ta ? null : artRect(fa), tb ? null : artRect(fb));
    const moved = (x, y, r) => Math.abs(x - r.x) > EPS || Math.abs(y - r.y) > EPS;
    const ends = {
        from: ta ? 'tile' : moved(seg.x0, seg.y0, p) ? 'art' : 'centre',
        to: tb ? 'tile' : moved(seg.x1, seg.y1, q) ? 'art' : 'centre',
    };
    return { form: 'line', seg, head, ends };
}

/**
 * Stretch a segment about its middle to at least `minLen` (same units). A zero-length one (a gutter of 0) is
 * stretched along `axis` ('x' or 'y', the gap's crossing direction) when given, else left alone.
 */
export function atLeast(seg, minLen, axis = null) {
    let dx = seg.x1 - seg.x0;
    let dy = seg.y1 - seg.y0;
    let len = Math.hypot(dx, dy);
    if (len < EPS && axis) {
        dx = axis === 'x' ? 1 : 0;
        dy = axis === 'y' ? 1 : 0;
        len = 1;
    }
    if (len >= minLen || len < EPS) return seg;
    const k = minLen / len / 2;
    const mx = (seg.x0 + seg.x1) / 2;
    const my = (seg.y0 + seg.y1) / 2;
    return { x0: mx - dx * k, y0: my - dy * k, x1: mx + dx * k, y1: my + dy * k };
}

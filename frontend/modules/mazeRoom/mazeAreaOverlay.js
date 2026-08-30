/**
 * mazeRoom/mazeAreaOverlay — **THE AREA GRAPH, DRAWN OVER THE GRID.**
 *
 * PROCGEN ELEMENTS arc 1, slice 3 (`NewDocs/plans/procgen-elements-arc1-
 * kickoff.md` §3.6): *"area shading by key level, doors and keys labelled,
 * graphify edges dashed, the solution path; STEP through the layers."*
 *
 * ── ⛓⛓⛓ WHY THIS IS A **SIBLING** OF `drawWorld` AND NOT NEW `view` FIELDS
 *
 * ⚖ The slice was offered both. The sibling was taken, and the forcing line is
 * the one `mazeLabView.draw` already wrote down for the plan and the hover
 * overlays: **a graph is not a property of the world.** `drawWorld(ctx, world,
 * view)`'s whole contract is that `view` is the WHOLE input and every field is
 * a fact about how to PRESENT the world it was handed (fog, inventory,
 * discovery filters); an area partition is a fact about a MODEL that produced
 * the world, and the panel — the renderer's other caller — has no model at all
 * and would have to pass `areas: null` forever to say so.
 *
 * ⛓ AND IT IS THE CHEAPER CLAIM TO MAKE AND TO CHECK. `mazeRoomRender.test.js`
 * gates the panel's draw with SEVEN captured op-log hashes taken at
 * `868c39266`, before `drawWorld` existed. Extending `drawWorld` would expire
 * every one of them and the re-capture would come out of the code under test —
 * a fixed point (⚖ kickoff §5). As a sibling, those seven stay byte-identical
 * (asserted) and this file brings its own op-log fixture for its own ops.
 *
 * ── THE LAYERS, AND WHAT EACH ADDS ────────────────────────────────────
 *
 * They are CUMULATIVE, because "step through the layers" is a reader building
 * up one picture rather than four unrelated ones:
 *
 *   `off`        nothing at all — the level as `drawWorld` left it
 *   `partition`  every AREA shaded by its own hue; a SYNTHETIC (1-cell,
 *                grown on the entrance or the goal) area outlined DASHED
 *                instead of filled, so it cannot be read as a chamber
 *   `locks`      the shading switches to the KEY LEVEL ramp; every door cell
 *                gets its symbol's border; graphify edges are drawn DASHED
 *                between area centroids (tree edges solid)
 *   `keys`       + the key cells (a ring) and the SOLUTION PATH through the
 *                area centroids
 *   `all`        everything above (today `keys` and `all` differ only in name;
 *                the name exists because arc 2's switches land in `all`)
 *
 * ⛔ **NOTHING IS LABELLED PER CELL.** ⚠ §9.11(6): door counts are not small —
 * up to 50 over eight 15x15 cells — so a drawing that wrote `K0` on every door
 * would be unreadable. The symbols are named ONCE each, in the page's LEGEND,
 * and the canvas carries only colour. This file therefore draws no text at all,
 * which is also why its op log is short enough to check by eye.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: this is on the lab page's path and in a node
 * unit runner.
 */

export class AreaOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AreaOverlayError';
    }
}

const fail = (message) => { throw new AreaOverlayError(message); };

/** ⛓ THE LAYERS, in the order the page steps through them. */
export const AREA_LAYERS = Object.freeze(['off', 'partition', 'locks', 'keys', 'all']);

/** How far up the list a layer is — the one place "cumulative" is spelled. */
export const layerRank = (layer) => AREA_LAYERS.indexOf(layer);

/**
 * ⛓ THE KEY-LEVEL RAMP. Level 0 (free) is cold, and each lock is warmer — the
 * reader's question is *"how deep is this?"* and a hue ramp answers it without
 * a legend. ⛔ Indexed with a modulo rather than clamped, because `maxKeys` is
 * a caller's bound and a level past the ramp must still be a colour.
 */
export const LEVEL_COLORS = Object.freeze([
    'hsl(200, 60%, 45%)', 'hsl(90, 55%, 40%)', 'hsl(45, 70%, 45%)', 'hsl(15, 70%, 45%)',
    'hsl(320, 55%, 45%)',
]);

/** ⛓ THE PARTITION'S OWN COLOURS — a hue per area INDEX, because before the
 *  graph runs there are no key levels and an area is only itself. */
export const areaColor = (index) => `hsl(${(index * 47) % 360}, 45%, 45%)`;

export const OVERLAY_COLORS = Object.freeze({
    door: '#ffd75f',
    key: '#7fe0ff',
    solution: '#ffffff',
    graphify: '#ff8fd0',
    tree: '#c8c8d8',
    synthetic: '#9a9aa8',
});

/** The fields this draw reads. Named, so a caller cannot forget one silently. */
export const OVERLAY_VIEW_FIELDS = Object.freeze(['tilePx', 'layer']);

export function assertOverlayView(view) {
    if (!view || typeof view !== 'object') {
        fail('mazeAreaOverlay: drawAreaOverlay needs a view object '
            + `(fields: ${OVERLAY_VIEW_FIELDS.join(', ')}).`);
    }
    for (const key of OVERLAY_VIEW_FIELDS) {
        if (!(key in view)) {
            fail(`mazeAreaOverlay: the view is missing "${key}". ⛔ A default here would be a `
                + 'picture this file chose under the caller\'s name — the same law '
                + '`mazeRoomRender.assertView` states.');
        }
    }
    if (!(typeof view.tilePx === 'number' && view.tilePx > 0)) {
        fail('mazeAreaOverlay: view.tilePx must be a positive number of canvas pixels.');
    }
    if (!AREA_LAYERS.includes(view.layer)) {
        fail(`mazeAreaOverlay: view.layer ${JSON.stringify(view.layer)} is not one of `
            + `[${AREA_LAYERS.join(', ')}].`);
    }
    return view;
}

/** The centre of an area, in TILE coordinates — where an edge line ends. */
export function areaCentre(area) {
    const n = area.cells.length;
    let sx = 0;
    let sy = 0;
    for (const c of area.cells) { sx += c.x; sy += c.y; }
    return { x: sx / n + 0.5, y: sy / n + 0.5 };
}

/**
 * ⛓⛓⛓ THE DRAW. ⛔ It is a no-op — **zero ops** — when there is nothing to
 * draw (`layer: 'off'`, no partition, or an area binding that REFUSED), and
 * that is asserted rather than assumed: a page whose graph was refused shows
 * the level exactly as `drawWorld` painted it, and the reason goes in the
 * page's own refusal box where a reader can read it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object|null} areas  `model.areas` — `{ran, partition, graph, doors, keys}`
 * @param {{tilePx:number, layer:string}} view
 */
export function drawAreaOverlay(ctx, areas, view) {
    const v = assertOverlayView(view);
    if (v.layer === 'off') return;
    const partition = areas?.partition ?? null;
    if (!partition || !areas?.ran) return;
    const px = v.tilePx;
    const rank = layerRank(v.layer);
    const graph = areas.graph ?? null;
    const levelOf = (id) => graph?.areas?.[id]?.keyLevel ?? 0;

    /* ── THE AREAS ──────────────────────────────────────────────────── */
    ctx.save();
    for (const [i, area] of partition.areas.entries()) {
        /**
         * ⛔ A SYNTHETIC AREA IS NOT A CHAMBER and must not read as one: it is
         * the 1-cell area grown on the entrance or the goal when neither lands
         * inside a real blob, which the census says is the COMMON case
         * (§9.1). It gets a dashed outline and no fill.
         */
        if (area.synthetic) {
            ctx.strokeStyle = OVERLAY_COLORS.synthetic;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            for (const c of area.cells) {
                ctx.strokeRect(c.x * px + 2, c.y * px + 2, px - 4, px - 4);
            }
            ctx.setLineDash([]);
            continue;
        }
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = rank >= layerRank('locks')
            ? LEVEL_COLORS[levelOf(area.id) % LEVEL_COLORS.length] : areaColor(i);
        for (const c of area.cells) ctx.fillRect(c.x * px, c.y * px, px, px);
        ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (rank < layerRank('locks') || !graph) return;

    /* ── THE EDGES — tree solid, graphify DASHED ────────────────────── */
    const byId = new Map(partition.areas.map((a) => [a.id, a]));
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    for (const e of graph.edges) {
        const a = byId.get(e.a);
        const b = byId.get(e.b);
        if (!a || !b) continue;
        const pa = areaCentre(a);
        const pb = areaCentre(b);
        ctx.strokeStyle = e.kind === 'graphify' ? OVERLAY_COLORS.graphify : OVERLAY_COLORS.tree;
        ctx.setLineDash(e.kind === 'graphify' ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(pa.x * px, pa.y * px);
        ctx.lineTo(pb.x * px, pb.y * px);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    /* ── THE DOORS — a border per door CELL, coloured, never labelled ─ */
    ctx.save();
    ctx.strokeStyle = OVERLAY_COLORS.door;
    ctx.lineWidth = 2;
    for (const d of areas.doors ?? []) {
        ctx.strokeRect(d.x * px + 1, d.y * px + 1, px - 2, px - 2);
    }
    ctx.restore();

    if (rank < layerRank('keys')) return;

    /* ── THE KEYS AND THE SOLUTION PATH ─────────────────────────────── */
    ctx.save();
    ctx.strokeStyle = OVERLAY_COLORS.key;
    ctx.lineWidth = 2;
    for (const k of areas.keys ?? []) {
        ctx.beginPath();
        ctx.arc(k.x * px + px / 2, k.y * px + px / 2, px / 3, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();

    const path = (graph.solutionPath ?? []).map((id) => byId.get(id)).filter(Boolean);
    if (path.length > 1) {
        ctx.save();
        ctx.strokeStyle = OVERLAY_COLORS.solution;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        path.forEach((area, i) => {
            const p = areaCentre(area);
            if (i === 0) ctx.moveTo(p.x * px, p.y * px);
            else ctx.lineTo(p.x * px, p.y * px);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
}

/**
 * ⛓⛓ THE LEGEND, AS DATA — one row per SYMBOL, which is the ⚠ §9.11(6) rule
 * ("label per SYMBOL, not per cell") made into a shape the page can render and
 * a browser row can compare against the payload. ⛔ It is derived from
 * `model.areas` alone, so the page cannot show a symbol the run did not place.
 */
export function areaLegend(areas) {
    if (!areas?.ran || !areas.graph) return Object.freeze([]);
    const levelOf = (id) => areas.graph.areas[id]?.keyLevel ?? 0;
    return Object.freeze(areas.graph.symbols.map((symbol) => {
        const doors = (areas.doors ?? []).filter((d) => d.symbol === symbol);
        const key = (areas.keys ?? []).find((k) => k.symbol === symbol) ?? null;
        return Object.freeze({
            symbol,
            doorCount: doors.length,
            /** ⛓ Which AREAS this symbol locks — the reader's actual question. */
            areas: Object.freeze([...new Set(doors.map((d) => d.area))].sort()),
            level: doors.length ? doors[0].level : null,
            key: key && Object.freeze({ x: key.x, y: key.y, area: key.area, level:
                levelOf(key.area) }),
            color: LEVEL_COLORS[(doors.length ? doors[0].level : 0) % LEVEL_COLORS.length],
        });
    }));
}

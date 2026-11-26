/**
 * ⛓ THE MAP NODE LOOK (region-graph-map-look; `nodeLook.js`). With `nodeLook` = `map` and `subRegionView` = `merged`,
 * each region node of the Region Graph draws as its Region Map cell: the level art, the location squares coloured by
 * state, and the label. Node POSITIONS are the Graph's own layouts', untouched.
 *
 * ⛓ SHARED CODE, NOT A COPY. The cells are the Region Map's model (`regionMap/regionMapModel.js` `buildRegionMapModel`:
 * each display region's region object, extent and location tiles), its frames (`regionMap/regionMapFrames.js`
 * `cellFrames`, one per cell, in the Map's `level` mode) and its drawing (`regionMap/regionMapCellDraw.js`: the art, the
 * squares, the label, the fog placeholder), coloured by the shared region view (`regionView/regionViewState.js`).
 * Nothing in this file draws a pixel of its own.
 *
 * ⛓ HOW IT IS ATTACHED. One canvas UNDER Cytoscape's own (`z-index: -1` in the cy container, made a stacking context
 * while the layer is on), the size of the container, redrawn on every Cytoscape `render` (pan, zoom, drag, a class
 * change), on each region-view recompute (a snapshot: the squares re-colour, nothing is rebuilt) and when a painter's
 * bake lands. Each map node gets a STYLE BYPASS: a rectangle at its cell's aspect ratio (`MAP_NODE_LONG_PX` on its
 * long side), its body and label transparent. So Cytoscape still draws the node's BORDER (accessible, current, path,
 * selected) and every edge, location node and the player marker ABOVE the cell; edges end on the rectangle's border.
 * A cell is drawn under its node's rendered box through a camera onto that box (`cameraOntoBox`), so the art, squares
 * and label are drawn at SCREEN resolution at every zoom: no bake of our own, no re-bake thresholds (the painter's
 * bakes are its own, at the art's 16 px per tile, shared with the Region Map).
 *
 * Off (any other `nodeLook` / `subRegionView`): no canvas, no view, no bypass, no listener. `graph` is byte-identical.
 */
import eventBus from '../../app/core/eventBus.js';
import settingsManager from '../../app/core/settingsManager.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createRegionViewState } from '../regionView/regionViewState.js';
import { regionOfCell } from '../regionView/regionViewModel.js';
import { hookCtxFor } from '../procgenCore/atlasCache.js';
import { buildRegionMapModel } from '../regionMap/regionMapModel.js';
import { cellFrames } from '../regionMap/regionMapFrames.js';
import { MIN_SQUARE_PX, squareAt } from '../regionMap/regionMapOverlay.js';
import {
    cameraOntoBox, drawCellArt, drawCellLabel, drawCellSquares, drawPlaceholderCell,
} from '../regionMap/regionMapCellDraw.js';
import { nodeLookApplies } from './nodeLook.js';
import { isRegionGroupNode } from './subRegionGroups.js';

/** A map node's long side (model px): the merged node's width, so the graph's spacing still fits it. */
export const MAP_NODE_LONG_PX = 72;
/** A map node's short side never goes under this (model px), however thin its level. */
export const MAP_NODE_MIN_PX = 16;
/** The style bypass a map node carries (and loses when the layer turns off). */
export const MAP_NODE_STYLE_KEYS = Object.freeze(['shape', 'width', 'height', 'background-opacity', 'text-opacity']);
const SCRATCH_KEY = '_rgMapKey';
const OWNER = 'regionGraph:mapLook';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A map node's size (model px) for a frame: the cell's aspect ratio, `MAP_NODE_LONG_PX` on its long side. */
export function mapNodeSize(frame) {
    const ar = frame.cell.w / frame.cell.h;
    const w = ar >= 1 ? MAP_NODE_LONG_PX : Math.max(MAP_NODE_MIN_PX, MAP_NODE_LONG_PX * ar);
    const h = ar >= 1 ? Math.max(MAP_NODE_MIN_PX, MAP_NODE_LONG_PX / ar) : MAP_NODE_LONG_PX;
    return { w, h };
}

/**
 * The Region Map cell a Region Graph node draws as: a merged node → its display key; a region node → the cell its
 * region folds into; anything else (the player marker, a location node, a nested box) → null.
 */
export function cellKeyOfNode(node, keyOfRegion) {
    if (!node || node.hasClass('player') || node.hasClass('location-node') || isRegionGroupNode(node, 'box')) return null;
    if (isRegionGroupNode(node, 'merged')) return node.data('groupKey') ?? null;
    return keyOfRegion.get(node.data('regionName') ?? node.id()) ?? null;
}

/** One frame per cell, each in the Region Map's `level` mode on its own (so its cell is exactly its level). */
export function framesOfModel(model) {
    const frames = new Map();
    for (const [key, cell] of model.cells) {
        const one = cellFrames(new Map([[key, { gx: 0, gy: 0 }]]), new Map([[key, cell.extent]]), 'level');
        frames.set(key, one.get(key));
    }
    return frames;
}

export class MapLookLayer {
    /** @param {object} ui - the RegionGraphUI (cy, graphContainer, nodeLook, subRegionView) */
    constructor(ui, { registry = substrateRegistry } = {}) {
        this.ui = ui;
        this.registry = registry;
        this.on = false;
        this.model = null;
        this.frames = new Map();
        this.keyOfRegion = new Map();
        this._modelRules = null;
        this.source = null;
        this.canvas = null;
        this.view = null;
        this.vp = { w: 0, h: 0 };
        this.dpr = 1;
        this._nodes = [];
        this._squares = [];
        this._paintHandle = null;
        this._onRender = () => this.paint();
        this._onArt = () => { if (this.on) this.requestPaint(); };
        this.stats = this._freshStats();
    }

    _freshStats() {
        return {
            nodes: 0, cells: 0, art: 0, generic: 0, fogged: 0, squares: 0, paints: 0, lastPaintMs: null, maxPaintMs: 0,
            modelMs: null, applyMs: null, recolours: 0, lastRecolourMs: null, maxRecolourMs: 0, firstPaintMs: null,
        };
    }

    /** Does the map look draw now? */
    get wanted() {
        return !!this.ui.cy && nodeLookApplies(this.ui.nodeLook, this.ui.subRegionView);
    }

    /** Turn the layer on or off to match the settings, and (on) re-apply it to the nodes the graph holds now. */
    sync() {
        if (!this.wanted) {
            if (this.on) this._off();
            return false;
        }
        const t0 = now();
        if (!this._ensureModel()) {
            if (this.on) this._off();
            return false;
        }
        if (!this.on) this._turnOn(t0);
        this._applyNodes();
        this.paint();
        return true;
    }

    /** After the graph rebuilt its elements (the old nodes, and their bypasses, are gone). */
    onGraphBuilt() {
        if (this.on || this.wanted) this.sync();
    }

    _rules() {
        const last = getLastRawJsonData();
        if (!last?.rawJsonData) return null;
        return { rules: last.rawJsonData, playerId: String(last.selectedPlayerInfo?.playerId ?? '1') };
    }

    /** The Region Map's model for the loaded rules (rebuilt only when the rules document changes). */
    _ensureModel() {
        const got = this._rules();
        if (!got) return false;
        if (this.model && this._modelRules === got.rules && this.source?.playerId === got.playerId) return true;
        const t0 = now();
        try {
            this.model = buildRegionMapModel({
                rules: got.rules, player: got.playerId, registry: this.registry, hookCtx: hookCtxFor(got.rules, got.playerId),
            });
        } catch (e) {
            console.warn('regionGraph: the map look could not build the Region Map model', e);
            this.model = null;
            return false;
        }
        this._modelRules = got.rules;
        this.source = { rules: got.rules, playerId: got.playerId };
        this.frames = framesOfModel(this.model);
        this.keyOfRegion = new Map();
        for (const [key, cell] of this.model.cells) for (const m of cell.members) this.keyOfRegion.set(m, key);
        this.stats.modelMs = now() - t0;
        return true;
    }

    _turnOn(t0) {
        this.on = true;
        this._onAt = t0;
        this.stats = { ...this._freshStats(), modelMs: this.stats.modelMs };
        const host = this.ui.graphContainer;
        if (host && typeof document !== 'undefined') {
            this.canvas = document.createElement('canvas');
            this.canvas.className = 'rg-map-look-canvas';
            // The in-app rows and the probes read the layer through its canvas (`.rg-map-look-canvas`).
            this.canvas.mapLook = this;
            Object.assign(this.canvas.style, {
                position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '-1',
            });
            this._hostIsolation = host.style.isolation;
            host.style.isolation = 'isolate';
            host.appendChild(this.canvas);
        }
        // ⛓ The squares' colours: the shared region view, as the Region Map reads it. A recompute (≤ 1 per frame)
        // re-colours by repainting; the time from the recompute's start to the end of that paint is `lastRecolourMs`.
        this.view = createRegionViewState({
            stateManager, eventBus, discovery: discoveryStateSingleton, gameState: safeGameState(),
            registry: this.registry, settings: settingsManager,
            getRules: () => this._rules(),
            showUndiscovered: () => this.ui.controlPanel?.querySelector?.('#graph-show-undiscovered')?.checked ?? true,
            owner: OWNER,
            schedule: (fn) => {
                const run = () => {
                    const s = now();
                    fn();
                    const ms = now() - s;
                    this.stats.recolours += 1;
                    this.stats.lastRecolourMs = ms;
                    this.stats.maxRecolourMs = Math.max(this.stats.maxRecolourMs, ms);
                };
                return typeof requestAnimationFrame === 'function' ? { raf: requestAnimationFrame(run) } : { timeout: setTimeout(run, 16) };
            },
        });
        this._unsubView = this.view.subscribe(() => this.paint());
        this.ui.cy.on('render', this._onRender);
    }

    _off() {
        this.on = false;
        const cy = this.ui.cy;
        cy?.off?.('render', this._onRender);
        cy?.batch?.(() => {
            for (const n of this._nodes) {
                if (n.removed?.()) continue;
                n.removeStyle(MAP_NODE_STYLE_KEYS.join(' '));
                n.removeScratch(SCRATCH_KEY);
            }
        });
        this._nodes = [];
        this._squares = [];
        try { this._unsubView?.(); } catch { /* gone */ }
        this.view?.dispose();
        this.view = null;
        if (this._paintHandle != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._paintHandle);
        this._paintHandle = null;
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
            if (this.ui.graphContainer) this.ui.graphContainer.style.isolation = this._hostIsolation ?? '';
        }
    }

    /** Give every node that draws a cell its bypass (rectangle, cell aspect, transparent body and label). */
    _applyNodes() {
        const t0 = now();
        const cy = this.ui.cy;
        this._nodes = [];
        cy.batch(() => {
            cy.nodes().forEach((n) => {
                const key = cellKeyOfNode(n, this.keyOfRegion);
                const f = key != null ? this.frames.get(key) : null;
                if (!f) return;
                const { w, h } = mapNodeSize(f);
                n.style({ shape: 'rectangle', width: w, height: h, 'background-opacity': 0, 'text-opacity': 0 });
                n.scratch(SCRATCH_KEY, key);
                this._nodes.push(n);
            });
        });
        this.stats.nodes = this._nodes.length;
        this.stats.applyMs = now() - t0;
    }

    requestPaint() {
        if (!this.on || this._paintHandle != null) return;
        if (typeof requestAnimationFrame !== 'function') { this.paint(); return; }
        this._paintHandle = requestAnimationFrame(() => { this._paintHandle = null; this.paint(); });
    }

    _resize() {
        const host = this.ui.graphContainer;
        const w = Math.max(0, Math.round(host?.clientWidth ?? 0));
        const h = Math.max(0, Math.round(host?.clientHeight ?? 0));
        const dpr = globalThis.devicePixelRatio || 1;
        if (w === this.vp.w && h === this.vp.h && dpr === this.dpr) return;
        this.vp = { w, h };
        this.dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
    }

    /** Draw every visible map node's cell under its rendered box: art (or fog), then squares, then labels. */
    paint() {
        if (!this.on || !this.canvas || !this.model) return;
        const t0 = now();
        if (!this.canvas.isConnected && this.ui.graphContainer) this.ui.graphContainer.appendChild(this.canvas);
        this._resize();
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        const { dpr, vp } = this;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, vp.w, vp.h);
        const view = this.view?.get();
        const stats = { cells: 0, art: 0, generic: 0, fogged: 0 };
        const shown = [];
        this._squares = [];
        for (const n of this._nodes) {
            if (n.removed() || !n.visible()) continue;
            const key = n.scratch(SCRATCH_KEY);
            const f = this.frames.get(key);
            const p = n.renderedPosition();
            const w = n.renderedWidth();
            const h = n.renderedHeight();
            const box = { x: p.x - w / 2, y: p.y - h / 2, w, h };
            if (!(w > 0) || box.x > vp.w || box.y > vp.h || box.x + w < 0 || box.y + h < 0) continue;
            const camera = cameraOntoBox(f, box, vp);
            stats.cells += 1;
            if (n.hasClass('undiscovered-placeholder') || n.hasClass('group-placeholder')) {
                stats.fogged += 1;
                drawPlaceholderCell(ctx, { frame: f, camera, vp });
                continue;
            }
            const cell = this.model.cells.get(key);
            drawCellArt(ctx, {
                frame: f, cell, camera, vp, dpr, source: this.source, onArt: this._onArt, registry: this.registry, stats,
                warnTag: 'regionGraph',
            });
            shown.push({ f, cell, camera });
        }
        for (const s of shown) {
            drawCellSquares(ctx, { frame: s.f, cell: s.cell, camera: s.camera, vp, minSquarePx: MIN_SQUARE_PX, view, out: this._squares });
        }
        for (const s of shown) drawCellLabel(ctx, { frame: s.f, cell: s.cell, camera: s.camera, vp });
        const ms = now() - t0;
        Object.assign(this.stats, stats, { squares: this._squares.length, paints: this.stats.paints + 1, lastPaintMs: ms,
            maxPaintMs: Math.max(this.stats.maxPaintMs, ms) });
        if (this.stats.firstPaintMs == null && stats.cells > 0) this.stats.firstPaintMs = now() - this._onAt;
        if (this.canvas.dataset) {
            this.canvas.dataset.cells = String(stats.cells);
            this.canvas.dataset.squares = String(this._squares.length);
        }
    }

    /**
     * The location square of map node `node` under the rendered point `pos` (the last drawn wins), or null.
     * → `{ location, region }`: the region is the location's rules region (as the Region Map's square click picks it).
     */
    squareAtNode(node, pos) {
        if (!this.on || !pos) return null;
        const key = node?.scratch?.(SCRATCH_KEY);
        if (key == null) return null;
        const q = squareAt(this._squares.filter((s) => s.key === key), pos.x, pos.y);
        if (!q) return null;
        const view = this.view?.get();
        const members = this.model?.cells.get(key)?.members ?? [];
        return { location: q.location, region: view?.locations?.get(q.location)?.region ?? regionOfCell(key, members) };
    }

    /** A plain snapshot for the in-app rows and the probes. */
    getDebugState() {
        return {
            on: this.on,
            wanted: this.wanted,
            nodes: this._nodes.length,
            stats: { ...this.stats },
            squares: this._squares.map((q) => ({ location: q.location, key: q.key, color: q.color, sx: q.sx, sy: q.sy, side: q.side })),
            nodeKeys: this._nodes.map((n) => [n.id(), n.scratch(SCRATCH_KEY)]),
            canvas: !!this.canvas?.isConnected,
        };
    }

    dispose() {
        if (this.on) this._off();
    }
}

function safeGameState() {
    try { return getGameStateSingleton(); } catch { return null; }
}

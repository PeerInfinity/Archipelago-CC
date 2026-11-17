/**
 * regionMap/regionMapUI — **THE REGION MAP PANEL'S CANVAS VIEWER** (region-map step 3b).
 *
 * Two halves, rebuilt at different rates:
 *   · STATIC — the model (`regionMapModel.js`: layout, cells, tiles, links) is rebuilt on a rules load or a
 *     grouping change; the frames (`regionMapFrames.js` `cellFrames`) on a cell-size change. Never per snapshot.
 *   · LIVE — the region view (`regionView/regionViewState.js`, one recompute per frame) re-colours the squares,
 *     hides/fogs by discovery and moves the current-region marker.
 *
 * ⛓ PAINTING: only the cells that meet the viewport are drawn (`visibleFrames`), from the painter's cached bakes;
 * every repaint request — a pan, a zoom, a view change, a bake landing (`geom.requestRedraw`) — is COALESCED into
 * one paint per animation frame (`_requestPaint`). Step 1 measured 115 bakes → 99 full repaints of a 4760×4480
 * canvas on the composite map; here a repaint is the viewport only, and bakes are requested for visible cells only.
 * Each level is baked ONCE, at the art's own 16 px per tile (`BAKE_TILE_PX`), and drawn under a canvas transform,
 * so zooming never re-bakes.
 *
 * The camera: `screen = (world − camera) · zoom + viewport / 2` (`regionMapCamera.js`). Drag pans, the wheel zooms
 * around the cursor. A click (no drag) SELECTS the cell under it and does what a Region Graph click does
 * (`regionMapClicks.js`, step 4): a location square → that location's click; elsewhere in a cell → its region's.
 */
import settingsManager from '../../app/core/settingsManager.js';
import eventBus from '../../app/core/eventBus.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createRegionViewState, readDiscoverySettings } from '../regionView/regionViewState.js';
import { PathFinder } from '../shared/pathfinder.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { GROUPING_RULES } from '../procgenCore/regionLayout.js';
import { COLORS, compositeMapPainterFor, drawGenericRegion } from '../procgenCore/compositeMapRenderer.js';
import { buildRegionMapModel } from './regionMapModel.js';
import { cellFrames, frameAt, framesBounds, tileCentre, visibleFrames } from './regionMapFrames.js';
import {
    centreOn, easeCamera, fitCamera, panBy, screenToWorld, viewRect, worldToScreen, zoomAround,
} from '../procgenCore/mapCamera.js';
import { SQUARE_COLORS, frameSquares, squareAt, squareColorKey } from './regionMapOverlay.js';
import { REGION_MAP_SETTING_DEFAULTS, SETTINGS_PREFIX, moduleHandles, panelInstances } from './regionMapSettings.js';
import { onLocationClick, onRegionClick, readClickOptions, regionOfCell } from './regionMapClicks.js';

/** The tile size every level is baked at (the art's own); drawn scaled by the camera. */
export const BAKE_TILE_PX = 16;
const OWNER = 'regionMap';
const FOLLOW_EASE_MS = 350;
const LINK_COLORS = Object.freeze({ down: '#7fb3ff', up: '#ffb37f', join: '#e6c84a' });
const BG = '#0b0b10';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class RegionMapUI {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        this.settings = { ...REGION_MAP_SETTING_DEFAULTS };
        this.follow = this.settings.followPlayer;
        this.model = null;
        this.frames = new Map();
        this.frameList = [];
        this.source = null;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.vp = { w: 0, h: 0 };
        this.dpr = 1;
        this.selected = null;
        this.hover = null;
        this.pathFinder = new PathFinder(stateManager);
        this.lastClick = null;
        this.clickCount = 0;
        this._statusTimer = null;
        this._anim = null;
        this._paintHandle = null;
        this._disposed = false;
        this._cameraPlaced = false;
        this._lastCurrent = undefined;
        this._squares = [];
        this._lastPaint = null;
        this.counters = { paints: 0, paintRequests: 0, artRedraws: 0, modelBuilds: 0, firstPaintMs: null, modelMs: null };
        this._mountedAt = now();
        this._unsubs = [];
        this._requestPaint = () => {
            this.counters.paintRequests += 1;
            if (this._disposed || this._paintHandle != null) return;
            this._paintHandle = requestAnimationFrame(() => { this._paintHandle = null; this.paint(); });
        };
        // The painter's `requestRedraw`: one stable function (the painter dedupes its waiters on it), a no-op once
        // the panel is disposed (the painter keeps no other reference to the panel).
        this._onArt = () => {
            if (this._disposed) return;
            this.counters.artRedraws += 1;
            this._requestPaint();
        };

        this._buildDom();
        panelInstances.add(this);
        container.on?.('resize', () => this._resize());
        container.on?.('show', () => this._resize());
        container.on?.('destroy', () => this.dispose());

        this.view = createRegionViewState({
            stateManager, eventBus, discovery: discoveryStateSingleton, gameState: safeGameState(),
            registry: substrateRegistry, settings: settingsManager,
            getRules: () => this._rulesOf(),
            showUndiscovered: () => this.settings.showUndiscovered,
            owner: OWNER,
        });
        this._unsubs.push(this.view.subscribe(() => this._onView()));
        this._sub('stateManager:rulesLoaded', () => this._rebuild());
        this._sub('app:readyForUiDataLoad', () => this._rebuild());
        this._sub('settings:changed', (d) => {
            const key = String(d?.key ?? '');
            if (key === '*' || key.startsWith(SETTINGS_PREFIX)) this._loadSettings();
        });
        this._loadSettings().then(() => this._rebuild());
    }

    getRootElement() { return this.root; }

    /* ── DOM ─────────────────────────────────────────────────────────── */

    _buildDom() {
        const el = (tag, cls, style = {}) => {
            const e = document.createElement(tag);
            if (cls) e.className = cls;
            Object.assign(e.style, style);
            return e;
        };
        this.root = el('div', 'region-map-panel-container panel-container', {
            width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
            background: BG, color: '#ddd', fontSize: '12px', overflow: 'hidden',
        });
        const bar = el('div', 'region-map-toolbar', {
            display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', padding: '4px 6px',
            background: '#15151d', borderBottom: '1px solid #2a2a3a',
        });
        const check = (cls, text, key) => {
            const label = el('label', cls, { display: 'inline-flex', alignItems: 'center', gap: '3px' });
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.addEventListener('change', () => this._setSetting(key, box.checked));
            label.append(box, document.createTextNode(text));
            bar.appendChild(label);
            return box;
        };
        const select = (cls, text, key, options) => {
            const label = el('label', cls, { display: 'inline-flex', alignItems: 'center', gap: '3px' });
            const sel = document.createElement('select');
            for (const [value, name] of options) {
                const o = document.createElement('option');
                o.value = value;
                o.textContent = name;
                sel.appendChild(o);
            }
            sel.addEventListener('change', () => this._setSetting(key, sel.value));
            label.append(document.createTextNode(text), sel);
            bar.appendChild(label);
            return sel;
        };
        const button = (cls, text, fn) => {
            const b = el('button', cls, { fontSize: '11px' });
            b.textContent = text;
            b.addEventListener('click', fn);
            bar.appendChild(b);
            return b;
        };
        this.controls = {
            follow: check('region-map-follow', 'Follow player', 'followPlayer'),
            undiscovered: check('region-map-show-undiscovered', 'Show undiscovered', 'showUndiscovered'),
            links: check('region-map-show-links', 'Links', 'showLinks'),
            cellSize: select('region-map-cell-size', 'Cells:', 'cellSize', [['level', 'sized by level'], ['uniform', 'uniform']]),
            grouping: select('region-map-grouping', 'Grouping:', 'groupingRule', Object.keys(GROUPING_RULES).map((k) => [k, k])),
        };
        // ⛓ Follow is PANEL state seeded from the setting: ticking the box saves the setting; a manual pan or zoom
        // only unticks the box (`_manualCamera`), it does not rewrite the saved setting.
        button('region-map-centre-start', 'Centre on start', () => this.centreOnStart());
        button('region-map-fit-all', 'Fit all', () => this.fitAll());
        this.info = el('div', 'region-map-info', { padding: '2px 6px', color: '#9ab', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
        // An overlay over the canvas (not a row above it): showing it must not resize the canvas.
        this.status = el('div', 'region-map-status', {
            position: 'absolute', left: '4px', top: '4px', pointerEvents: 'none', display: 'none', zIndex: '2',
            background: 'rgba(0,0,0,0.75)', color: '#dfe6a0', padding: '2px 6px', borderRadius: '3px', fontSize: '11px',
        });
        this.notOnMap = el('div', 'region-map-not-on-map', { padding: '2px 6px', color: '#c9a227', fontSize: '11px', display: 'none' });
        this.wrap = el('div', 'region-map-canvas-wrap', { position: 'relative', flex: '1 1 auto', minHeight: '0' });
        this.canvas = el('canvas', 'region-map-canvas', { position: 'absolute', inset: '0', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' });
        this.tooltip = el('div', 'region-map-tooltip', {
            position: 'absolute', pointerEvents: 'none', display: 'none', background: 'rgba(0,0,0,0.85)', color: '#fff',
            padding: '3px 6px', borderRadius: '3px', fontSize: '11px', whiteSpace: 'pre', zIndex: '2',
        });
        this.wrap.append(this.canvas, this.tooltip, this.status);
        this.root.append(bar, this.info, this.notOnMap, this.wrap);
        this.container.element?.appendChild(this.root);

        const c = this.canvas;
        this._onPointerDown = (e) => {
            this._drag = { x: e.clientX, y: e.clientY, moved: false };
            try { c.setPointerCapture?.(e.pointerId); } catch { /* a synthetic pointer (the in-app rows) has none */ }
            c.style.cursor = 'grabbing';
        };
        this._onPointerMove = (e) => {
            const p = this._local(e);
            if (this._drag) {
                const dx = e.clientX - this._drag.x;
                const dy = e.clientY - this._drag.y;
                if (!this._drag.moved && Math.hypot(dx, dy) < 3) return;
                if (!this._drag.moved) this._manualCamera();
                this._drag.moved = true;
                this._drag.x = e.clientX;
                this._drag.y = e.clientY;
                this.camera = panBy(this.camera, dx, dy);
                this._requestPaint();
                return;
            }
            this._hoverAt(p.x, p.y);
        };
        this._onPointerUp = (e) => {
            const d = this._drag;
            this._drag = null;
            c.style.cursor = 'grab';
            if (d && !d.moved) {
                const p = this._local(e);
                const w = screenToWorld(this.camera, this.vp, p.x, p.y);
                const f = frameAt(this.frameList, w.x, w.y);
                const q = squareAt(this._squares, p.x, p.y);
                const visible = f && this._visibilityOf(f.key, this.view?.get()) !== 'hidden';
                this.selected = visible ? f.key : null;
                this._requestPaint();
                if (visible) this.clickAt(f, q);
            }
        };
        this._onWheel = (e) => {
            e.preventDefault();
            const p = this._local(e);
            this._manualCamera();
            this.camera = zoomAround(this.camera, this.vp, p.x, p.y, Math.exp(-e.deltaY * 0.0015));
            this._requestPaint();
        };
        this._onLeave = () => { this.hover = null; this.tooltip.style.display = 'none'; this._requestPaint(); };
        c.addEventListener('pointerdown', this._onPointerDown);
        c.addEventListener('pointermove', this._onPointerMove);
        c.addEventListener('pointerup', this._onPointerUp);
        c.addEventListener('pointerleave', this._onLeave);
        c.addEventListener('wheel', this._onWheel, { passive: false });
        if (typeof ResizeObserver === 'function') {
            this._ro = new ResizeObserver(() => this._resize());
            this._ro.observe(this.wrap);
        }
    }

    _local(e) {
        const r = this.canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    _sub(event, fn) {
        const u = eventBus.subscribe(event, fn, OWNER);
        this._unsubs.push(typeof u === 'function' ? u : () => eventBus.unsubscribe?.(event, fn, OWNER));
    }

    /* ── SETTINGS ────────────────────────────────────────────────────── */

    async _loadSettings() {
        const before = { ...this.settings };
        for (const [k, dflt] of Object.entries(REGION_MAP_SETTING_DEFAULTS)) {
            try {
                this.settings[k] = await settingsManager.getSetting(`${SETTINGS_PREFIX}${k}`, dflt);
            } catch { this.settings[k] = dflt; }
        }
        if (!['level', 'uniform'].includes(this.settings.cellSize)) this.settings.cellSize = 'level';
        if (!GROUPING_RULES[this.settings.groupingRule]) this.settings.groupingRule = 'R1';
        if (this._disposed) return;
        if (before.followPlayer !== this.settings.followPlayer) this.follow = this.settings.followPlayer;
        this._syncControls();
        if (before.groupingRule !== this.settings.groupingRule && this.model) this._rebuild();
        else if (before.cellSize !== this.settings.cellSize && this.model) this._reframe();
        if (before.showUndiscovered !== this.settings.showUndiscovered) this.view?.refresh();
        this._requestPaint();
    }

    _syncControls() {
        this.controls.follow.checked = this.follow;
        this.controls.undiscovered.checked = !!this.settings.showUndiscovered;
        this.controls.links.checked = !!this.settings.showLinks;
        this.controls.cellSize.value = this.settings.cellSize;
        this.controls.grouping.value = this.settings.groupingRule;
    }

    async _setSetting(key, value) {
        if (key === 'followPlayer') {
            this.follow = !!value;
            if (this.follow) this._followNow();
        }
        try {
            await settingsManager.updateSetting(`${SETTINGS_PREFIX}${key}`, value);
        } catch (e) { console.warn('regionMap: could not save a setting', key, e); }
    }

    /* ── THE STATIC HALF ─────────────────────────────────────────────── */

    _rulesOf() {
        const last = getLastRawJsonData();
        if (!last?.rawJsonData) return null;
        return { rules: last.rawJsonData, playerId: String(last.selectedPlayerInfo?.playerId ?? '1') };
    }

    /** ⛓ The hook context: a custom Seedling world's derived atlas would go here (`atlases`) — see the report. */
    _hookCtx() { return {}; }

    _rebuild() {
        if (this._disposed) return;
        const got = this._rulesOf();
        if (!got) { this.model = null; this._reframe(); return; }
        const t0 = now();
        try {
            this.model = buildRegionMapModel({
                rules: got.rules, player: got.playerId, registry: substrateRegistry, hookCtx: this._hookCtx(),
                rule: this.settings.groupingRule,
            });
            this.modelError = null;
        } catch (e) {
            this.model = null;
            this.modelError = String(e?.message ?? e);
            console.warn('regionMap: the layout failed', e);
        }
        this.counters.modelMs = now() - t0;
        this.counters.modelBuilds += 1;
        this.source = { rules: got.rules, playerId: got.playerId };
        this._cameraPlaced = false;
        this._lastCurrent = undefined;
        this.selected = null;
        this._reframe();
        this.view?.refresh();
    }

    _reframe() {
        if (!this.model) {
            this.frames = new Map();
            this.frameList = [];
        } else {
            const ext = new Map([...this.model.cells].map(([k, c]) => [k, c.extent]));
            const keep = this._cameraPlaced ? this._cameraAnchor() : null;
            this.frames = cellFrames(this.model.layout.positions, ext, this.settings.cellSize);
            this.frameList = [...this.frames.values()];
            if (keep) this._restoreAnchor(keep);
        }
        this._updateInfo();
        this._placeCamera();
        this._requestPaint();
    }

    /** The cell nearest the view centre, and where in it — so a cell-size toggle keeps the view on the same level. */
    _cameraAnchor() {
        const f = frameAt(this.frameList, this.camera.x, this.camera.y)
            ?? (this.model ? this.frames.get(this.model.layout.start) : null);
        if (!f) return null;
        return { key: f.key, u: (this.camera.x - f.cell.x) / f.cell.w, v: (this.camera.y - f.cell.y) / f.cell.h, scale: f.cell.w * this.camera.zoom };
    }

    _restoreAnchor(a) {
        const f = this.frames.get(a.key);
        if (!f) return;
        this.camera = { x: f.cell.x + a.u * f.cell.w, y: f.cell.y + a.v * f.cell.h, zoom: a.scale / f.cell.w };
    }

    _updateInfo() {
        if (!this.model) {
            this.info.textContent = this.modelError ? `Region Map: the layout failed — ${this.modelError}` : 'Region Map: no world loaded.';
            this.notOnMap.style.display = 'none';
            return;
        }
        const s = this.model.layout.stats;
        const parts = [
            `${this.settings.groupingRule}`,
            `${this.model.layout.groups.length} group(s)`,
            `${this.frames.size} cell(s)`,
            `down ${s.down?.across ?? 0} across → ${s.down?.below ?? 0} below`,
            `up ${s.up?.across ?? 0} across → ${s.up?.above ?? 0} above`,
            `layout: ${s.source}${s.substrate ? ` (${s.substrate})` : ''}`,
            this.settings.cellSize === 'level' ? 'cells sized by level' : 'uniform cells',
        ];
        if (s.mixedGridCell) parts.push(`mixed grid_cell ${s.mixedGridCell.with}/${s.mixedGridCell.with + s.mixedGridCell.without}`);
        this.info.textContent = parts.join(' · ');
        this.info.title = this.info.textContent;
    }

    _updateNotOnMap(view) {
        const rows = (this.model?.unplaced ?? []).filter((u) => view?.displayGroups?.get(u.key)?.visibility !== 'hidden');
        this.notOnMap.style.display = rows.length ? 'block' : 'none';
        this.notOnMap.textContent = rows.length ? `Not on map (${rows.length}): ${rows.map((r) => r.location).join(', ')}` : '';
        this.notOnMap.title = rows.map((r) => `${r.location} — ${r.region}`).join('\n');
    }

    /* ── CAMERA ──────────────────────────────────────────────────────── */

    _resize() {
        const r = this.wrap.getBoundingClientRect();
        const w = Math.max(0, Math.round(r.width));
        const h = Math.max(0, Math.round(r.height));
        const dpr = globalThis.devicePixelRatio || 1;
        if (w === this.vp.w && h === this.vp.h && dpr === this.dpr) return;
        this.vp = { w, h };
        this.dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this._placeCamera();
        this._requestPaint();
    }

    _visibleBounds() {
        const view = this.view?.get();
        return framesBounds(this.frameList.filter((f) => this._visibilityOf(f.key, view) !== 'hidden'));
    }

    /** First camera for a world, once the viewport has a size: on the player's region (follow) or the whole map. */
    _placeCamera() {
        if (this._cameraPlaced || !this.frameList.length || this.vp.w < 2 || this.vp.h < 2) return;
        this._cameraPlaced = true;
        const cur = this._currentFrame();
        if (this.follow && cur) this.camera = this._focusCamera(cur);
        else this.camera = fitCamera(this._visibleBounds(), this.vp);
    }

    /** A camera on one frame: its cell at about half the viewport. */
    _focusCamera(f) {
        const zoom = Math.min(this.vp.w / f.cell.w, this.vp.h / f.cell.h) * 0.5;
        return centreOn({ x0: f.cell.x, y0: f.cell.y, x1: f.cell.x + f.cell.w, y1: f.cell.y + f.cell.h }, zoom);
    }

    _currentFrame() {
        const key = this.view?.get()?.currentDisplayRegion;
        return key != null ? this.frames.get(key) ?? null : null;
    }

    _manualCamera() {
        this._anim = null;
        if (this.follow) {
            this.follow = false;
            this.controls.follow.checked = false;
        }
    }

    _animateTo(target) {
        this._anim = { from: { ...this.camera }, to: target, t0: now() };
        this._requestPaint();
    }

    _followNow() {
        const f = this._currentFrame();
        if (!f) return;
        this._animateTo(centreOn({ x0: f.cell.x, y0: f.cell.y, x1: f.cell.x + f.cell.w, y1: f.cell.y + f.cell.h }, this.camera.zoom));
    }

    centreOnStart() {
        const f = this.model ? this.frames.get(this.model.layout.start) : null;
        if (!f) return;
        this._manualCamera();
        this.camera = this._focusCamera(f);
        this._requestPaint();
    }

    fitAll() {
        this._manualCamera();
        this.camera = fitCamera(this._visibleBounds(), this.vp);
        this._requestPaint();
    }

    /* ── THE LIVE HALF ───────────────────────────────────────────────── */

    _onView() {
        const view = this.view.get();
        this._updateNotOnMap(view);
        const cur = view.currentDisplayRegion;
        if (cur !== this._lastCurrent) {
            this._lastCurrent = cur;
            if (!this._cameraPlaced) this._placeCamera();
            else if (this.follow) this._followNow();
        }
        this._requestPaint();
    }

    _visibilityOf(key, view) {
        return view?.displayGroups?.get(key)?.visibility ?? view?.regions?.get(key)?.visibility ?? 'shown';
    }

    _hoverAt(sx, sy) {
        const q = squareAt(this._squares, sx, sy);
        const w = screenToWorld(this.camera, this.vp, sx, sy);
        const f = frameAt(this.frameList, w.x, w.y);
        const view = this.view?.get();
        const vis = f ? this._visibilityOf(f.key, view) : null;
        const key = f && vis !== 'hidden' ? f.key : null;
        if (key !== this.hover) {
            this.hover = key;
            this._requestPaint();
        }
        if (!key) { this.tooltip.style.display = 'none'; return; }
        let text;
        if (vis === 'placeholder') text = 'Undiscovered region';
        else {
            const g = view?.displayGroups?.get(key);
            const c = g?.counts ?? { checked: 0, accessible: 0, inaccessible: 0, total: 0 };
            text = `${key}${g && g.members.length > 1 ? ` (${g.members.length} regions)` : ''}\n`
                + `${c.checked} checked · ${c.accessible} accessible · ${c.inaccessible} inaccessible / ${c.total}`;
            if (q) {
                const loc = view?.locations?.get(q.location);
                // ⛓ step 4: the Region Graph's location-node label — '???' while discovery shows it as a placeholder.
                text = loc?.visibility === 'placeholder'
                    ? `???\n${text}`
                    : `${q.location}${q.kind === 'event' ? ' (event)' : ''}: ${loc?.state ?? '?'}\n${text}`;
            }
        }
        this.tooltip.textContent = text;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${Math.min(sx + 12, Math.max(0, this.vp.w - 220))}px`;
        this.tooltip.style.top = `${sy + 14}px`;
    }

    /* ── CLICKS (step 4) ─────────────────────────────────────────────── */

    /** The action handles (`regionView/regionActions.js`): THIS module's dispatcher and event bus. */
    _handles() {
        return {
            dispatcher: moduleHandles.dispatcher,
            eventBus: moduleHandles.eventBus ?? { publish: (event, data) => eventBus.publish(event, data, OWNER) },
            stateManager,
            pathFinder: this.pathFinder,
            get gameState() { return getGameStateSingleton(); },
            getRules: () => this._rulesOf() ?? { rules: null, playerId: '1' },
            restart: () => centralRegistry.getPublicFunction?.('menuPanel', 'restart')?.(),
        };
    }

    /**
     * ⛓ A CLICK on cell `frame` — on location square `square` when there is one (`squareAt`), else on the cell's
     * region. The toggles and discovery settings are read at click time (async), then the click runs synchronously.
     * Resolves to the click's record (also kept as `lastClick`, for the in-app rows).
     */
    async clickAt(frame, square = null) {
        const view = this.view?.get();
        const members = view?.displayGroups?.get(frame.key)?.members ?? this.model?.cells.get(frame.key)?.members ?? [];
        const [opts, discovery] = await Promise.all([readClickOptions(settingsManager), readDiscoverySettings(settingsManager)]);
        const onStatus = (text) => this._flashStatus(text);
        const h = this._handles();
        let record;
        if (square) {
            const regionName = view?.locations?.get(square.location)?.region ?? regionOfCell(frame.key, members);
            const result = onLocationClick(h, { locationName: square.location, regionName }, opts, discovery, { onStatus });
            record = { target: 'location', location: square.location, region: regionName, opts, result };
        } else {
            const region = regionOfCell(frame.key, members);
            const result = onRegionClick(h, region, opts, discovery, { onStatus, data: { id: region, displayKey: frame.key } });
            record = { target: 'region', region, cell: frame.key, opts, result };
        }
        this.clickCount += 1;
        this.lastClick = { n: this.clickCount, ...record };
        return this.lastClick;
    }

    /** A click's status text (the Region Graph's status-bar texts) for 2 s. */
    _flashStatus(text) {
        this.status.textContent = text;
        this.status.style.display = 'block';
        if (this._statusTimer) clearTimeout(this._statusTimer);
        this._statusTimer = setTimeout(() => {
            this._statusTimer = null;
            if (!this._disposed) this.status.style.display = 'none';
        }, 2000);
    }

    /* ── PAINT ───────────────────────────────────────────────────────── */

    paint() {
        if (this._disposed) return;
        const t0 = now();
        if (this._anim) {
            const t = (t0 - this._anim.t0) / FOLLOW_EASE_MS;
            this.camera = easeCamera(this._anim.from, this._anim.to, t);
            if (t >= 1) this._anim = null;
        }
        const ctx = this.canvas.getContext('2d');
        const { dpr, vp, camera: cam } = this;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, vp.w, vp.h);
        const stats = { cells: 0, art: 0, generic: 0, fogged: 0, hidden: 0, links: 0, keys: [] };
        this._squares = [];
        if (!this.model || !vp.w) {
            this._lastPaint = stats;
            this.counters.paints += 1;
            return;
        }
        const view = this.view?.get();
        const vis = visibleFrames(this.frameList, viewRect(cam, vp));
        const shown = [];
        for (const f of vis) {
            const v = this._visibilityOf(f.key, view);
            if (v === 'hidden') { stats.hidden += 1; continue; }
            stats.cells += 1;
            stats.keys.push(f.key);
            const s = worldToScreen(cam, vp, f.cell.x, f.cell.y);
            const cw = f.cell.w * cam.zoom;
            const ch = f.cell.h * cam.zoom;
            if (v === 'placeholder') {
                stats.fogged += 1;
                ctx.fillStyle = '#2b2b33';
                ctx.fillRect(s.x, s.y, cw, ch);
                ctx.strokeStyle = '#44444f';
                ctx.lineWidth = 1;
                ctx.strokeRect(s.x + 0.5, s.y + 0.5, cw - 1, ch - 1);
                if (cw > 24) {
                    ctx.fillStyle = '#777';
                    ctx.font = `${Math.min(28, Math.max(10, cw / 6))}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('?', s.x + cw / 2, s.y + ch / 2);
                    ctx.textAlign = 'start';
                    ctx.textBaseline = 'alphabetic';
                }
                continue;
            }
            shown.push(f);
            this._drawArt(ctx, f, stats);
        }
        if (this.settings.showLinks) this._drawLinks(ctx, view, stats);
        for (const f of shown) this._drawSquares(ctx, f, view);
        this._drawMarkers(ctx, view);
        for (const f of shown) this._drawLabel(ctx, f);
        stats.squares = this._squares.length;
        stats.minSquareSide = this._squares.reduce((m, q) => Math.min(m, q.side), Infinity);
        this._lastPaint = stats;
        this.counters.paints += 1;
        if (this.counters.firstPaintMs == null && stats.cells > 0) this.counters.firstPaintMs = now() - this._mountedAt;
        if (this._anim) this._requestPaint();
    }

    _drawArt(ctx, f, stats) {
        const cell = this.model.cells.get(f.key);
        const { dpr, camera: cam, vp } = this;
        const s = worldToScreen(cam, vp, f.x, f.y);
        if (cell?.region) {
            const k = (f.tilePx * cam.zoom) / BAKE_TILE_PX;
            ctx.save();
            ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * s.x, dpr * s.y);
            const geom = {
                offX: 0, offY: 0, regionSize: { width: f.ext.w, height: f.ext.h }, tilePx: BAKE_TILE_PX, colors: COLORS,
                source: this.source, requestRedraw: this._onArt,
            };
            const painter = compositeMapPainterFor(cell.region, substrateRegistry);
            try {
                if (painter) painter(ctx, cell.region, geom);
                else drawGenericRegion(ctx, cell.region, geom);
            } catch (e) {
                console.warn('regionMap: a painter threw', f.key, e);
            }
            ctx.restore();
            stats.art += painter ? 1 : 0;
            stats.generic += painter ? 0 : 1;
        } else {
            const w = f.w * cam.zoom;
            const h = f.h * cam.zoom;
            ctx.fillStyle = COLORS.genericBg;
            ctx.fillRect(s.x, s.y, w, h);
            stats.generic += 1;
        }
        const c = worldToScreen(cam, vp, f.cell.x, f.cell.y);
        ctx.strokeStyle = COLORS.cellBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x + 0.5, c.y + 0.5, f.cell.w * cam.zoom - 1, f.cell.h * cam.zoom - 1);
    }

    _drawLabel(ctx, f) {
        const cam = this.camera;
        const cw = f.cell.w * cam.zoom;
        if (cw < 60) return;
        const c = worldToScreen(cam, this.vp, f.cell.x, f.cell.y);
        const cell = this.model.cells.get(f.key);
        const size = Math.max(9, Math.min(13, cw / 14));
        ctx.font = `${size}px sans-serif`;
        const text = f.key.length > 40 ? `${f.key.slice(0, 39)}…` : f.key;
        const tw = Math.min(ctx.measureText(text).width, cw - 4);
        ctx.fillStyle = cell?.region ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)';
        ctx.fillRect(c.x + 2, c.y + 2, tw + 6, size + 5);
        ctx.fillStyle = '#e8e8f0';
        ctx.fillText(text, c.x + 5, c.y + size + 3, cw - 8);
    }

    _drawSquares(ctx, f, view) {
        const cell = this.model.cells.get(f.key);
        if (!cell?.tiles?.length) return;
        const squares = frameSquares(f, cell.tiles, this.camera, this.vp, this.settings.minSquarePx);
        for (const q of squares) {
            const loc = view?.locations?.get(q.location);
            if (loc?.visibility === 'hidden') continue;
            const colorKey = loc?.visibility === 'placeholder' ? 'unknown' : squareColorKey(loc, view?.regions?.get(loc?.region));
            q.color = colorKey;
            const h = q.side / 2;
            ctx.fillStyle = SQUARE_COLORS[colorKey];
            ctx.globalAlpha = colorKey === 'checked' ? 0.6 : 1;
            if (q.kind === 'event') {
                // Events: a diamond, so they read apart from items at any size.
                ctx.beginPath();
                ctx.moveTo(q.sx, q.sy - h * 1.15);
                ctx.lineTo(q.sx + h * 1.15, q.sy);
                ctx.lineTo(q.sx, q.sy + h * 1.15);
                ctx.lineTo(q.sx - h * 1.15, q.sy);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else {
                ctx.fillRect(q.sx - h, q.sy - h, q.side, q.side);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(q.sx - h + 0.5, q.sy - h + 0.5, q.side - 1, q.side - 1);
            }
            ctx.globalAlpha = 1;
            q.key = f.key;
            this._squares.push(q);
        }
    }

    _drawLinks(ctx, view, stats) {
        const rect = viewRect(this.camera, this.vp);
        const pt = (key, tile) => {
            const f = this.frames.get(key);
            if (!f) return null;
            if (tile) return tileCentre(f, tile[0], tile[1]);
            return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
        };
        ctx.lineWidth = 1.5;
        // Half-transparent: a link between two far groups crosses other levels' art.
        ctx.globalAlpha = 0.55;
        for (const l of this.model.links) {
            if (this._visibilityOf(l.from, view) === 'hidden' || this._visibilityOf(l.to, view) === 'hidden') continue;
            const a = pt(l.from, l.a);
            const b = pt(l.to, l.b);
            if (!a || !b) continue;
            if (Math.max(a.x, b.x) < rect.x0 || Math.min(a.x, b.x) > rect.x1 || Math.max(a.y, b.y) < rect.y0 || Math.min(a.y, b.y) > rect.y1) continue;
            const sa = worldToScreen(this.camera, this.vp, a.x, a.y);
            const sb = worldToScreen(this.camera, this.vp, b.x, b.y);
            ctx.strokeStyle = LINK_COLORS[l.kind] ?? LINK_COLORS.join;
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(sa.x, sa.y);
            ctx.lineTo(sb.x, sb.y);
            ctx.stroke();
            const ang = Math.atan2(sb.y - sa.y, sb.x - sa.x);
            ctx.beginPath();
            ctx.moveTo(sb.x, sb.y);
            ctx.lineTo(sb.x - 8 * Math.cos(ang - 0.4), sb.y - 8 * Math.sin(ang - 0.4));
            ctx.lineTo(sb.x - 8 * Math.cos(ang + 0.4), sb.y - 8 * Math.sin(ang + 0.4));
            ctx.closePath();
            ctx.fill();
            stats.links += 1;
        }
        ctx.globalAlpha = 1;
    }

    _drawMarkers(ctx, view) {
        const outline = (key, color, width) => {
            const f = key != null ? this.frames.get(key) : null;
            if (!f || this._visibilityOf(f.key, view) === 'hidden') return;
            const c = worldToScreen(this.camera, this.vp, f.cell.x, f.cell.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.strokeRect(c.x - width / 2, c.y - width / 2, f.cell.w * this.camera.zoom + width, f.cell.h * this.camera.zoom + width);
        };
        const pathKeys = new Set();
        for (const step of view?.path ?? []) {
            const k = view.regions.get(step.destinationRegion)?.displayKey;
            if (k != null) pathKeys.add(k);
        }
        for (const k of pathKeys) outline(k, '#4fc3f7', 1.5);
        if (this.hover) outline(this.hover, 'rgba(255,255,255,0.6)', 1.5);
        if (this.selected) outline(this.selected, COLORS.selection, 2.5);
        outline(view?.currentDisplayRegion, '#ffffff', 3);
    }

    /* ── TESTS ───────────────────────────────────────────────────────── */

    /** A plain snapshot of what the panel holds and last painted (the in-app rows read this, never pixels). */
    getDebugState() {
        const view = this.view?.get();
        return {
            hasModel: !!this.model,
            modelError: this.modelError ?? null,
            displayRegions: this.model ? [...this.model.cells.keys()] : [],
            groups: this.model?.layout.groups.length ?? 0,
            layoutStats: this.model ? { ...this.model.layout.stats } : null,
            start: this.model?.layout.start ?? null,
            frames: Object.fromEntries([...this.frames].map(([k, f]) => [k, { x: f.x, y: f.y, w: f.w, h: f.h, tilePx: f.tilePx, cell: { ...f.cell } }])),
            tiles: this.model ? Object.fromEntries([...this.model.cells].map(([k, c]) => [k, c.tiles.map((t) => t.location)])) : {},
            unplaced: this.model?.unplaced.map((u) => u.location) ?? [],
            links: this.model?.links.length ?? 0,
            camera: { ...this.camera },
            viewport: { ...this.vp },
            follow: this.follow,
            settings: { ...this.settings },
            currentDisplayRegion: view?.currentDisplayRegion ?? null,
            discoveryActive: !!view?.discoveryActive,
            visibility: Object.fromEntries([...(view?.displayGroups ?? new Map())].map(([k, g]) => [k, g.visibility])),
            lastPaint: this._lastPaint ? { ...this._lastPaint, keys: [...this._lastPaint.keys] } : null,
            squares: this._squares.map((q) => ({ location: q.location, kind: q.kind, side: q.side, color: q.color, key: q.key, sx: q.sx, sy: q.sy })),
            counters: { ...this.counters },
            selected: this.selected,
            clickCount: this.clickCount,
            lastClick: this.lastClick ? JSON.parse(JSON.stringify(this.lastClick)) : null,
            status: this.status?.style.display === 'none' ? null : this.status?.textContent ?? null,
        };
    }

    /** Set the camera (tests and the screenshot script): `{x, y, zoom}`; turns follow off like a manual pan. */
    setCamera(cam) {
        this._manualCamera();
        this.camera = { ...this.camera, ...cam };
        this._requestPaint();
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        panelInstances.delete(this);
        if (this._paintHandle != null) cancelAnimationFrame(this._paintHandle);
        this._paintHandle = null;
        if (this._statusTimer) clearTimeout(this._statusTimer);
        this.view?.dispose();
        for (const u of this._unsubs.splice(0)) {
            try { u(); } catch { /* already gone */ }
        }
        this._ro?.disconnect();
        const c = this.canvas;
        c.removeEventListener('pointerdown', this._onPointerDown);
        c.removeEventListener('pointermove', this._onPointerMove);
        c.removeEventListener('pointerup', this._onPointerUp);
        c.removeEventListener('pointerleave', this._onLeave);
        c.removeEventListener('wheel', this._onWheel);
    }

    destroy() { this.dispose(); }
}

function safeGameState() {
    try { return getGameStateSingleton(); } catch { return null; }
}

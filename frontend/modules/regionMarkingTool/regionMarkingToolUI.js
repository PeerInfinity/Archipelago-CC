// regionMarkingToolUI — the Golden Layout panel that authors a region atlas
// over a real game's map (CC/docs/plans/region-atlas-plan.md, Phase 2).
//
// Left: the level, drawn by RegionMarkingRenderer (the tile map analyzer's
// renderer plus rectangle/line drags and a region overlay). Right: the
// inspector for whatever is selected.
//
// All editing goes through AtlasSession, which enforces the format's authoring
// rules by throwing (no '__' in ids, entrance_tile ∈ exit_tiles, sub_region
// present iff the region has a subgraph, explicit `bidirectional`). This file
// turns those throws into a status line; it never re-implements a rule, and it
// never re-implements the content hash — saving stamps through the validator's
// own stampAtlasIdentity.

import {
    getModuleEventBus, setActivePanelInstance, consumePendingSession,
    LOAD_EVENT, MAP_DOCUMENT_URL,
} from './index.js';
import { AtlasSession, createEmptyAtlas, rectBounds } from './atlasSession.js';
import { RegionMarkingRenderer, MARK_MODES } from './markingRenderer.js';
import { buildLevelView, indexLevels, levelLabel, entityMarkers } from './mapSource.js';
import { compactJsonFile } from '../procgenPipeline/compactJson.js';

function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) window.logger[level]('regionMarkingToolUI', message, ...data);
    else (console[level === 'info' ? 'log' : level] || console.log)(`[regionMarkingToolUI] ${message}`, ...data);
}

// Entities worth showing by default: the pickups a location is usually placed
// on, and the links between levels. Everything else is scenery and would bury
// the map in labels.
const DEFAULT_MARKER_TYPES = new Set([
    'chest', 'sword', 'shield', 'darkshield', 'ghostsword', 'ghostspear', 'wand', 'firewand',
    'feather', 'conch', 'health', 'darksuit', 'torchpickup', 'seed', 'totem', 'totempart',
    'bosskey', 'moonrock', 'moonrockpile', 'teleporter', 'stairsdown', 'stairsup',
]);

const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'style') node.style.cssText = v;
        else if (k === 'class') node.className = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v !== null && v !== undefined) node[k] = v;
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
};

export class RegionMarkingToolUI {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState || {};
        Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });

        this.mapDoc = null;
        this.levelsById = new Map();
        this.levelId = null;
        this.session = new AtlasSession(createEmptyAtlas({ mapSource: 'ogmo-extract' }));
        this.selectedRegionId = null;
        this.selectedExitId = null;
        this.pendingExitKind = null;
        this.showEntities = true;
        this.status = 'loading map…';

        this._buildDom();
        setActivePanelInstance(this);

        // A caller may have stashed a session before this panel existed, or may
        // stash one while it is already mounted — both paths land here.
        this._onLoadEvent = () => this._consumeSession();
        this.eventBus.subscribe(LOAD_EVENT, this._onLoadEvent);
        this.container.on('destroy', () => this._destroy());

        this._loadMapDocument()
            .then(() => this._consumeSession())
            .catch((e) => {
                log('error', 'map load failed', e);
                this._setStatus(`map load failed: ${e.message}`, true);
            });
    }

    /** Adopt a stashed hand-off session, if there is one. */
    _consumeSession() {
        const session = consumePendingSession();
        if (!session) return;
        if (session.atlas) {
            this.session = new AtlasSession(session.atlas);
            this.selectedRegionId = this.session.regions()[0]?.region_id ?? null;
            this.selectedExitId = null;
        }
        const level = session.levelId
            ?? this.session.regions().find((r) => r.map_ref !== undefined)?.map_ref;
        if (level !== undefined && level !== null) this._selectLevel(level);
        this._validate();
    }

    getRootElement() { return this.rootElement; }

    _destroy() {
        this.eventBus.unsubscribe(LOAD_EVENT, this._onLoadEvent);
        setActivePanelInstance(null);
        this.renderer = null;
    }

    // ── DOM ──────────────────────────────────────────────────────────────
    _buildDom() {
        this.rootElement = el('div', { class: 'rmt-panel panel-container' });
        // A handle on the root element rather than a global: the UI verifier
        // (scripts/procgen/verify-region-marking-tool.mjs) drives real canvas
        // drags, which needs the renderer's current pan/zoom to aim at a tile.
        this.rootElement.__panel = this;

        this.levelSelect = el('select', { class: 'rmt-select', onChange: () => this._selectLevel(Number(this.levelSelect.value)) });
        this.modeButtons = new Map();
        const modeBar = el('div', { class: 'rmt-modes' });
        const modes = [
            [MARK_MODES.NONE, 'Pan', 'drag to pan; shift-drag always pans'],
            [MARK_MODES.REGION, 'Region', 'drag a rectangle to define a region'],
            [MARK_MODES.EDGE, 'Edge exit', 'drag along a bounds line — the side is derived'],
            [MARK_MODES.TELEPORTER, 'Teleporter', 'drag or click the tiles of a teleporter exit'],
            [MARK_MODES.ENTRANCE, 'Entrance', 'click a tile of the selected exit to make it the spawn'],
            [MARK_MODES.LOCATION, 'Location', 'click the tile a location sits on'],
        ];
        for (const [mode, label, title] of modes) {
            const b = el('button', { class: 'rmt-btn', textContent: label, title, onClick: () => this._setMode(mode) });
            this.modeButtons.set(mode, b);
            modeBar.append(b);
        }

        const toolbar = el('div', { class: 'rmt-toolbar' }, [
            el('label', { class: 'rmt-label' }, ['Level ']), this.levelSelect,
            modeBar,
            el('span', { class: 'rmt-spacer' }),
            el('label', { class: 'rmt-check', title: 'show pickups, chests and level links as reference markers' }, [
                this.entityToggle = el('input', { type: 'checkbox', checked: true, onChange: () => { this.showEntities = this.entityToggle.checked; this._refreshCanvas(); } }),
                document.createTextNode(' entities'),
            ]),
            el('button', { class: 'rmt-btn', textContent: '−', title: 'zoom out', onClick: () => this.renderer.zoomOut() }),
            el('button', { class: 'rmt-btn', textContent: '+', title: 'zoom in', onClick: () => this.renderer.zoomIn() }),
            el('button', { class: 'rmt-btn', textContent: 'Fit', title: 'zoom so the level fills the canvas', onClick: () => this.fitLevel() }),
            el('button', { class: 'rmt-btn', textContent: 'New', onClick: () => this._newAtlas() }),
            el('button', { class: 'rmt-btn', textContent: 'Load', onClick: () => this.loadFile.click() }),
            el('button', { class: 'rmt-btn', textContent: 'Validate', onClick: () => this._validate() }),
            el('button', { class: 'rmt-btn rmt-primary', textContent: 'Save', onClick: () => this._save() }),
        ]);

        this.loadFile = el('input', {
            type: 'file', accept: '.json', style: 'display:none',
            onChange: (e) => this._loadFromFile(e.target.files?.[0]),
        });

        this.canvasWrap = el('div', { class: 'rmt-canvas-wrap' });
        this.canvas = el('canvas', { class: 'rmt-canvas' });
        this.canvasWrap.append(this.canvas);

        this.sidebar = el('div', { class: 'rmt-sidebar' });
        this.statusBar = el('div', { class: 'rmt-status' });

        this.rootElement.append(
            toolbar,
            this.loadFile,
            el('div', { class: 'rmt-body' }, [this.canvasWrap, this.sidebar]),
            this.statusBar,
        );

        this.renderer = new RegionMarkingRenderer(this.canvas, this.canvasWrap);
        this.renderer.onMarkRect = (bounds) => this._onRect(bounds);
        this.renderer.onMarkLine = (tiles, mode) => this._onLine(tiles, mode);
        this.renderer.onMarkTile = (tile, mode) => this._onTile(tile, mode);
        this.renderer.onTileSelected = (x, y) => this._onPlainClick([x, y]);
        this._setMode(MARK_MODES.NONE);
    }

    // ── map loading ──────────────────────────────────────────────────────
    async _loadMapDocument() {
        const response = await fetch(MAP_DOCUMENT_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${MAP_DOCUMENT_URL}`);
        this.mapDoc = await response.json();
        this.levelsById = indexLevels(this.mapDoc);
        this.session.atlas.tile_space.tile_size = this.mapDoc.tile_size ?? 16;
        this.session.atlas.tile_space.map_document = MAP_DOCUMENT_URL.split('/').pop();

        this.levelSelect.replaceChildren(...this.mapDoc.levels.map(
            (lvl) => el('option', { value: String(lvl.level), textContent: levelLabel(lvl) }),
        ));
        this._selectLevel(this.mapDoc.levels[0]?.level ?? 0);
        this._setStatus(`${this.mapDoc.levels.length} levels loaded — drag a rectangle in Region mode to begin`);
    }

    _selectLevel(levelId) {
        const level = this.levelsById.get(levelId);
        if (!level) return;
        this.levelId = levelId;
        this.levelSelect.value = String(levelId);
        const view = buildLevelView(level);
        this.renderer.setData(view.tilemap, view.categoryGrid, view.config);
        this.fitLevel();
        this._refreshCanvas();
        this.render();
    }

    /** Zoom to the largest step that keeps the whole level on screen. */
    fitLevel() {
        const level = this.levelsById.get(this.levelId);
        if (!level || !this.canvas.width || !this.canvas.height) return;
        const fit = Math.min(this.canvas.width / level.width, this.canvas.height / level.height);
        const steps = [1, 2, 3, 4, 6, 8, 12, 16, 24];
        const size = [...steps].reverse().find((s) => s <= fit) ?? steps[0];
        this.renderer.panX = 0;
        this.renderer.panY = 0;
        this.renderer.setTilePixelSize(size);
    }

    // ── marking ──────────────────────────────────────────────────────────
    _setMode(mode) {
        this.mode = mode;
        this.renderer.setMarkMode(mode);
        for (const [m, btn] of this.modeButtons) btn.classList.toggle('rmt-active', m === mode);
        if (mode === MARK_MODES.ENTRANCE && !this.selectedExitId) {
            this._setStatus('select an exit first — Entrance mode retargets the selected exit\'s spawn tile', true);
        }
    }

    _try(fn, success) {
        try {
            const result = fn();
            if (success) this._setStatus(typeof success === 'function' ? success(result) : success);
            this.render();
            return result;
        } catch (e) {
            this._setStatus(e.message, true);
            this.render();
            return null;
        }
    }

    _onRect(bounds) {
        const suggested = `region_${this.session.regions().length + 1}`;
        // eslint-disable-next-line no-alert
        const id = window.prompt(`Region id for ${bounds.w}×${bounds.h} at ${bounds.x},${bounds.y} (no "__"):`, suggested);
        if (!id) return;
        const region = this._try(
            () => this.session.addRegion({ region_id: id.trim(), bounds, map_ref: this.levelId }),
            `added region "${id.trim()}"`,
        );
        if (region) { this.selectedRegionId = region.region_id; this.selectedExitId = null; this.render(); }
    }

    _onLine(tiles, mode) {
        const region = this._currentRegion();
        if (!region) { this._setStatus('select a region first', true); return; }
        const suggested = mode === MARK_MODES.EDGE
            ? `exit_${region.exits.length + 1}`
            : `warp_${region.exits.length + 1}`;
        // eslint-disable-next-line no-alert
        const id = window.prompt(`Exit id for ${tiles.length} tile(s):`, suggested);
        if (!id) return;
        const exit = this._try(() => this.session.addExit(region.region_id, {
            exit_id: id.trim(),
            tiles,
            kind: mode === MARK_MODES.EDGE ? 'edge' : 'teleporter',
            sub_region: this.session.subRegions(region.region_id)?.[0],
        }), (e) => `added ${e.kind} exit "${e.exit_id}"${e.side ? ` on side ${e.side}` : ''}`);
        if (exit) this.selectedExitId = exit.exit_id;
    }

    _onTile(tile, mode) {
        const region = this._currentRegion();
        if (!region) { this._setStatus('select a region first', true); return; }
        if (mode === MARK_MODES.ENTRANCE) {
            if (!this.selectedExitId) { this._setStatus('select an exit first', true); return; }
            this._try(() => this.session.setEntranceTile(region.region_id, this.selectedExitId, tile),
                `entrance of "${this.selectedExitId}" is now [${tile}]`);
            return;
        }
        if (mode === MARK_MODES.LOCATION) {
            const near = this._entityAt(tile);
            const suggested = `${region.name ?? region.region_id} - ${near ? near.type : 'Chest'}`;
            // eslint-disable-next-line no-alert
            const name = window.prompt('Location name (globally unique):', suggested);
            if (!name) return;
            this._try(() => this.session.addLocation(region.region_id, {
                name: name.trim(),
                tile,
                sub_region: this.session.subRegions(region.region_id)?.[0],
            }), `added location "${name.trim()}" — set its vanilla item in the inspector`);
            return;
        }
        if (mode === MARK_MODES.TELEPORTER) this._onLine([tile], mode);
    }

    // A plain click with no mode armed selects whatever is under it: the
    // smallest region containing the tile, and an exit if one covers it.
    _onPlainClick(tile) {
        const hit = this.session.regions()
            .filter((r) => r.map_ref === this.levelId
                && tile[0] >= r.bounds.x && tile[0] < r.bounds.x + r.bounds.w
                && tile[1] >= r.bounds.y && tile[1] < r.bounds.y + r.bounds.h)
            .sort((a, b) => a.bounds.w * a.bounds.h - b.bounds.w * b.bounds.h)[0];
        if (!hit) return;
        this.selectedRegionId = hit.region_id;
        const exit = hit.exits.find((e) => e.exit_tiles.some((t) => t[0] === tile[0] && t[1] === tile[1]));
        this.selectedExitId = exit?.exit_id ?? null;
        this.render();
    }

    _entityAt(tile) {
        const size = this.mapDoc?.tile_size ?? 16;
        return (this.levelsById.get(this.levelId)?.entities ?? []).find(
            (e) => Math.floor(e.x / size) === tile[0] && Math.floor(e.y / size) === tile[1],
        );
    }

    _currentRegion() {
        return this.session.regions().find((r) => r.region_id === this.selectedRegionId) ?? null;
    }

    _refreshCanvas() {
        if (!this.renderer) return;
        const level = this.levelsById.get(this.levelId);
        this.renderer.setRegionOverlays(this.session.regions()
            .filter((r) => r.map_ref === this.levelId)
            .map((r) => ({ ...r, selected: r.region_id === this.selectedRegionId })));
        this.renderer.setMarkers(this.showEntities && level
            ? entityMarkers(level, this.mapDoc.tile_size ?? 16, { types: DEFAULT_MARKER_TYPES })
            : []);
    }

    // ── save / load ──────────────────────────────────────────────────────
    _newAtlas() {
        // eslint-disable-next-line no-alert
        if (this.session.regions().length > 0 && !window.confirm('Discard the current atlas?')) return;
        this.session = new AtlasSession(createEmptyAtlas({
            mapSource: 'ogmo-extract',
            mapDocument: MAP_DOCUMENT_URL.split('/').pop(),
            tileSize: this.mapDoc?.tile_size ?? 16,
        }));
        this.selectedRegionId = null;
        this.selectedExitId = null;
        this._setStatus('new atlas');
        this.render();
    }

    async _loadFromFile(file) {
        if (!file) return;
        try {
            this.session = new AtlasSession(JSON.parse(await file.text()));
            this.selectedRegionId = this.session.regions()[0]?.region_id ?? null;
            this.selectedExitId = null;
            const first = this.session.regions().find((r) => r.map_ref !== undefined);
            if (first) this._selectLevel(first.map_ref);
            this._validate();
        } catch (e) {
            this._setStatus(`load failed: ${e.message}`, true);
        }
        this.render();
    }

    _validate() {
        const result = this.session.validate(this.mapDoc ? { mapDoc: this.mapDoc } : {});
        this.lastResult = result;
        const unwired = this.session.unwiredExits().length;
        this._setStatus(
            result.ok
                ? `valid — ${result.stats.regions} regions, ${result.stats.exits} exits, ${result.stats.locations} locations, `
                  + `${result.warnings.length} warning(s)${unwired ? `, ${unwired} exit(s) unwired` : ''}`
                : `${result.errors.length} error(s): ${result.errors[0]}`,
            !result.ok,
        );
        this.render();
        return result;
    }

    // Save follows bounceRegionEditor's standalone precedent: serialize and
    // download. The document is stamped through the validator's own
    // stampAtlasIdentity (never a re-implemented hash) and written with the
    // compact writer, so what lands on disk is byte-identical to what
    // `region-atlas-validate.mjs --restamp` would produce.
    _save() {
        const result = this._validate();
        if (!result.ok) {
            // eslint-disable-next-line no-alert
            if (!window.confirm(`This atlas has ${result.errors.length} validation error(s). Save anyway?`)) return;
        }
        const doc = this.session.toDocument();
        const text = compactJsonFile(doc);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: `${this.session.baseId}.json` });
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this._setStatus(`saved ${doc.atlas_id}${result.ok ? '' : ' (with errors)'}`);
    }

    /** The exact bytes Save would download — the seam the UI verifier reads. */
    serialize() { return compactJsonFile(this.session.toDocument()); }

    _setStatus(message, isError = false) {
        this.status = message;
        this.statusBar.textContent = message;
        this.statusBar.classList.toggle('rmt-error', Boolean(isError));
    }

    // ── inspector ────────────────────────────────────────────────────────
    render() {
        this._refreshCanvas();
        const region = this._currentRegion();
        this.sidebar.replaceChildren(
            this._atlasSection(),
            this._regionListSection(),
            ...(region ? [
                this._regionSection(region),
                this._subgraphSection(region),
                this._exitsSection(region),
                this._locationsSection(region),
            ] : []),
            this._layoutSection(),
        );
    }

    _section(title, children) {
        return el('div', { class: 'rmt-section' }, [el('h4', { textContent: title }), ...[].concat(children)]);
    }

    _field(label, value, onChange, { placeholder = '' } = {}) {
        const input = el('input', {
            class: 'rmt-input', type: 'text', value: value ?? '', placeholder,
            onChange: (e) => onChange(e.target.value),
        });
        return el('label', { class: 'rmt-field' }, [el('span', { textContent: label }), input]);
    }

    _atlasSection() {
        const a = this.session.atlas;
        return this._section('Atlas', [
            this._field('game', a.game, (v) => { a.game = v; this.session.baseId = v || 'atlas'; }),
            this._field('name', a.name ?? '', (v) => { if (v) a.name = v; else delete a.name; }),
            el('div', { class: 'rmt-note', textContent: `map: ${a.tile_space.map_document ?? '(none)'} · ${a.tile_space.tile_size}px tiles · id ${this.session.baseId}-${this.session.contentHash()}` }),
        ]);
    }

    _regionListSection() {
        const list = el('div', { class: 'rmt-list' });
        for (const r of this.session.regions()) {
            const row = el('div', { class: `rmt-row${r.region_id === this.selectedRegionId ? ' rmt-selected' : ''}` }, [
                el('button', {
                    class: 'rmt-link',
                    textContent: `${r.region_id}${r.map_ref !== undefined ? ` @${r.map_ref}` : ''}`,
                    title: `${r.exits.length} exits, ${r.locations.length} locations`,
                    onClick: () => {
                        this.selectedRegionId = r.region_id;
                        this.selectedExitId = null;
                        if (r.map_ref !== undefined && r.map_ref !== this.levelId) this._selectLevel(r.map_ref);
                        else this.render();
                    },
                }),
                el('button', { class: 'rmt-x', textContent: '×', title: 'remove region', onClick: () => {
                    this._try(() => this.session.removeRegion(r.region_id), `removed "${r.region_id}"`);
                    if (this.selectedRegionId === r.region_id) this.selectedRegionId = null;
                    this.render();
                } }),
            ]);
            list.append(row);
        }
        if (this.session.regions().length === 0) {
            list.append(el('div', { class: 'rmt-note', textContent: 'no regions yet — pick Region mode and drag' }));
        }
        return this._section(`Regions (${this.session.regions().length})`, list);
    }

    _regionSection(region) {
        const b = region.bounds;
        return this._section(`Region "${region.region_id}"`, [
            this._field('name', region.name ?? '', (v) => { if (v) region.name = v; else delete region.name; this.render(); }),
            el('div', { class: 'rmt-note', textContent: `bounds ${b.x},${b.y} ${b.w}×${b.h} · level ${region.map_ref ?? '(none)'}` }),
            this._select('rules_source', ['analyzer', 'manual', 'mixed'], region.annotations?.rules_source ?? 'manual',
                (v) => { region.annotations = { ...region.annotations, rules_source: v }; }),
            el('button', {
                class: 'rmt-btn', textContent: 'Set as start',
                onClick: () => this._try(
                    () => this.session.setStart(region.region_id, this.session.subRegions(region.region_id)?.[0] ?? null),
                    `start region is "${region.region_id}"`,
                ),
            }),
        ]);
    }

    _select(label, options, value, onChange) {
        const sel = el('select', { class: 'rmt-select', onChange: (e) => { onChange(e.target.value); this.render(); } },
            options.map((o) => el('option', { value: o, textContent: o, selected: o === value })));
        return el('label', { class: 'rmt-field' }, [el('span', { textContent: label }), sel]);
    }

    _subgraphSection(region) {
        const subs = region.subgraph?.sub_regions ?? [];
        const children = [
            this._field('sub-regions (comma-separated; empty = none)', subs.join(', '),
                (v) => this._try(() => this.session.setSubRegions(
                    region.region_id, v.split(',').map((s) => s.trim()).filter(Boolean),
                ), 'sub-regions updated')),
        ];
        if (subs.length > 0) {
            const list = el('div', { class: 'rmt-list' });
            (region.subgraph.internal_exits ?? []).forEach((ie, i) => {
                list.append(el('div', { class: 'rmt-row' }, [
                    el('span', { class: 'rmt-mono', textContent: `${ie.from} ${ie.bidirectional ? '↔' : '→'} ${ie.to}${ie.access_rule ? ' ⚿' : ''}` }),
                    el('button', { class: 'rmt-x', textContent: '×', onClick: () => this._try(
                        () => this.session.removeInternalExit(region.region_id, i), 'internal exit removed',
                    ) }),
                ]));
            });
            const from = el('select', { class: 'rmt-select' }, subs.map((s) => el('option', { value: s, textContent: s })));
            const to = el('select', { class: 'rmt-select' }, subs.map((s) => el('option', { value: s, textContent: s })));
            const bidi = el('input', { type: 'checkbox', checked: true });
            const rule = el('textarea', { class: 'rmt-rule', rows: 2, placeholder: 'access_rule JSON, e.g. { "rule": "Has", "args": { "item_name": "Fire" } }' });
            list.append(el('div', { class: 'rmt-addrow' }, [
                from, to,
                el('label', { class: 'rmt-check' }, [bidi, document.createTextNode(' both ways')]),
                rule,
                el('button', { class: 'rmt-btn', textContent: 'Add internal exit', onClick: () => this._try(() => {
                    const access_rule = this._parseRule(rule.value);
                    return this.session.addInternalExit(region.region_id, {
                        from: from.value, to: to.value, bidirectional: bidi.checked, access_rule,
                    });
                }, 'internal exit added') }),
            ]));
            children.push(list);
        }
        return this._section('Subgraph', children);
    }

    // A raw rule field kept honest: empty means "no rule", anything else must
    // parse AND look like a Rule Builder node, so a typo cannot reach the
    // document as a string.
    _parseRule(text) {
        const trimmed = (text ?? '').trim();
        if (!trimmed) return undefined;
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        } catch (e) {
            throw new Error(`access_rule is not valid JSON: ${e.message}`);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.rule !== 'string') {
            throw new Error('access_rule must be a Rule Builder object, e.g. { "rule": "Has", "args": { "item_name": "Fire" } }');
        }
        return parsed;
    }

    _subRegionPicker(region, current, onChange) {
        const subs = region.subgraph?.sub_regions ?? null;
        if (!subs) return null;
        return el('select', { class: 'rmt-select rmt-sub', onChange: (e) => { onChange(e.target.value); this.render(); } },
            subs.map((s) => el('option', { value: s, textContent: s, selected: s === current })));
    }

    _exitsSection(region) {
        const list = el('div', { class: 'rmt-list' });
        for (const exit of region.exits) {
            const selected = exit.exit_id === this.selectedExitId;
            const rule = el('textarea', {
                class: 'rmt-rule', rows: 1, value: exit.access_rule ? JSON.stringify(exit.access_rule) : '',
                placeholder: 'access_rule JSON (optional)',
                onChange: (e) => this._try(() => {
                    const parsed = this._parseRule(e.target.value);
                    if (parsed === undefined) delete exit.access_rule; else exit.access_rule = parsed;
                    return parsed;
                }, 'exit rule updated'),
            });
            list.append(el('div', { class: `rmt-row rmt-block${selected ? ' rmt-selected' : ''}` }, [
                el('button', {
                    class: 'rmt-link',
                    textContent: `${exit.exit_id} · ${exit.kind}${exit.side ? ` ${exit.side}` : ''} · ${exit.exit_tiles.length} tile(s) · spawn [${exit.entrance_tile}]`,
                    onClick: () => { this.selectedExitId = selected ? null : exit.exit_id; this.render(); },
                }),
                this._subRegionPicker(region, exit.sub_region,
                    (v) => this._try(() => this.session.assignSubRegion(region.region_id, 'exit', exit.exit_id, v), 'exit reassigned')),
                rule,
                el('button', { class: 'rmt-x', textContent: '×', onClick: () => {
                    this._try(() => this.session.removeExit(region.region_id, exit.exit_id), `removed exit "${exit.exit_id}"`);
                    if (selected) this.selectedExitId = null;
                    this.render();
                } }),
            ]));
        }
        if (region.exits.length === 0) {
            list.append(el('div', { class: 'rmt-note', textContent: 'no exits — use Edge exit / Teleporter mode' }));
        }
        return this._section(`Exits (${region.exits.length})`, list);
    }

    _locationsSection(region) {
        const list = el('div', { class: 'rmt-list' });
        for (const loc of region.locations) {
            list.append(el('div', { class: 'rmt-row rmt-block' }, [
                el('span', { class: 'rmt-mono', textContent: `${loc.name} @ [${loc.tile}]` }),
                el('input', {
                    class: 'rmt-input', type: 'text', value: loc.vanilla_item ?? '', placeholder: 'vanilla item',
                    onChange: (e) => { const v = e.target.value.trim(); if (v) loc.vanilla_item = v; else delete loc.vanilla_item; },
                }),
                this._subRegionPicker(region, loc.sub_region,
                    (v) => this._try(() => this.session.assignSubRegion(region.region_id, 'location', loc.name, v), 'location reassigned')),
                el('button', { class: 'rmt-x', textContent: '×', onClick: () => {
                    this._try(() => this.session.removeLocation(region.region_id, loc.name), `removed "${loc.name}"`);
                } }),
            ]));
        }
        if (region.locations.length === 0) {
            list.append(el('div', { class: 'rmt-note', textContent: 'no locations — use Location mode; pickups show as yellow markers' }));
        }
        return this._section(`Locations (${region.locations.length})`, list);
    }

    _layoutSection() {
        const layout = this.session.atlas.vanilla_layout;
        const list = el('div', { class: 'rmt-list' });
        layout.connections.forEach((c, i) => {
            list.append(el('div', { class: 'rmt-row' }, [
                el('span', { class: 'rmt-mono', textContent: `${c.from[0]}/${c.from[1]} ↔ ${c.to[0]}/${c.to[1]}` }),
                el('button', { class: 'rmt-x', textContent: '×', onClick: () => this._try(() => this.session.disconnect(i), 'disconnected') }),
            ]));
        });

        const endpoints = this.session.regions().flatMap(
            (r) => r.exits.map((e) => ({ value: `${r.region_id} ${e.exit_id}`, label: `${r.region_id}/${e.exit_id}` })),
        );
        const mkPicker = () => el('select', { class: 'rmt-select' },
            endpoints.map((o) => el('option', { value: o.value, textContent: o.label })));
        const from = mkPicker();
        const to = mkPicker();
        list.append(el('div', { class: 'rmt-addrow' }, [
            from, to,
            el('button', { class: 'rmt-btn', textContent: 'Connect', onClick: () => this._try(
                () => this.session.connect(from.value.split(' '), to.value.split(' ')), 'connected',
            ) }),
        ]));

        const startSubs = this.session.regions().find((r) => r.region_id === layout.start_region)?.subgraph?.sub_regions;
        return this._section('Vanilla layout', [
            el('div', { class: 'rmt-note', textContent: `start: ${layout.start_region || '(unset)'}${layout.start_sub_region ? ` / ${layout.start_sub_region}` : ''}` }),
            startSubs ? this._select('start sub-region', startSubs, layout.start_sub_region ?? startSubs[0],
                (v) => this._try(() => this.session.setStart(layout.start_region, v), 'start sub-region set')) : null,
            list,
        ]);
    }
}

export { rectBounds };

/**
 * procgenPipeline UI — two-section library picker, pipeline
 * parameters, a Generate button, a composited grid canvas, and a
 * collapsible compiled-rules JSON block.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import eventBus from '../../app/core/eventBus.js';
import {
    growMaze,
    buildRulesJson,
    stringifyRulesJson,
    topDownFromRulesJson,
} from './procgenPipelineEngine.js';
import {
    TILE_WALL, getTile, getObstacle, getItem,
} from '../mazeRoom/mazeRoomEngine.js';
import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES,
    isObstacleCleared, getItemRenderHints,
} from '../shared/procgen/library.js';

const LS_KEY = 'procgenPipeline_params';
const TILE_PX = 14;

const COLORS = {
    floor: '#2a2a2a',
    wall: '#000000',
    // Same §5 palette as mazeRoomUI — keep the two views consistent.
    entrance: '#3aa85a',
    exit: '#3aa85a',
    exitBlocked: '#d04040',
    locationBlocked: '#d04040',
    grid: '#1a1a1a',
    cellBorder: '#3a3a50',
    emptyCell: '#141414',
};

const DEFAULT_PARAMS = {
    seed: 1,
    gridWidth: 3,
    gridHeight: 3,
    regionWidth: 8,
    regionHeight: 6,
    minSuccessPct: 30,
    maxSuccessPct: 60,
    walkerTrials: 15,
    maxItemsPerRegion: 2,
    maxRegions: null,
};

const DEFAULT_SCENARIO = {
    items: { key_red: 2 },
    obstacles: { door_red: 2 },
};

export class ProcgenPipelineUI {
    static moduleApis = null;
    static setModuleApis(apis) { ProcgenPipelineUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.params = { ...DEFAULT_PARAMS };
        this.scenario = {
            items: { ...DEFAULT_SCENARIO.items },
            obstacles: { ...DEFAULT_SCENARIO.obstacles },
        };
        // 'gridGrowth' (default) builds a fresh world from a scenario
        // pool. 'topDown' realises an existing rules.json as maze
        // regions on a grid.
        this.mode = 'gridGrowth';
        // Top-down's source rules.json (raw object) and a friendly
        // label used in the panel UI. null until the user picks a file
        // or copies in the currently-loaded rules.json.
        this.topDownSource = null;
        this.topDownSourceLabel = '';
        // Cache of the latest rules.json the frontend has loaded —
        // populated via stateManager:rawJsonDataLoaded. Lets the user
        // re-feed whatever's currently active without a file picker.
        this.loadedRulesJson = null;
        this.loadedRulesJsonLabel = '';
        this.result = null;
        this.isGenerating = false;
        this.message = '';

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'procgen-pipeline-panel';
        setPanelInstance(this);
        this._loadFromLocalStorage();
        // Subscribe through the raw eventBus so the panel sees raw-
        // json-loaded events even when constructed before the module's
        // initialize() has wired up apis. Same workaround the maze
        // panel uses (procgen-player.md "Substrate adapter contract:
        // addendum from the smoke test").
        const handler = (data) => {
            if (!data?.rawJsonData) return;
            this.loadedRulesJson = data.rawJsonData;
            this.loadedRulesJsonLabel = data.source || data.selectedPlayerInfo?.playerName || 'currently loaded';
            // Re-render so the "Use currently-loaded" button enables.
            this.render();
        };
        eventBus.subscribe('stateManager:rawJsonDataLoaded', handler, 'procgenPipeline');
        this._unsubRawJsonLoaded = () => eventBus.unsubscribe(
            'stateManager:rawJsonDataLoaded', handler, 'procgenPipeline',
        );
        this.render();
    }

    get apis() { return ProcgenPipelineUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() {
        if (this._unsubRawJsonLoaded) { this._unsubRawJsonLoaded(); this._unsubRawJsonLoaded = null; }
        setPanelInstance(null);
    }
    onPanelShow() { this.render(); }
    onPanelResize() {}

    render() {
        this.rootElement.innerHTML = '';
        this.rootElement.appendChild(this._renderModeToggle());
        if (this.mode === 'gridGrowth') {
            this.rootElement.appendChild(this._renderScenarioPicker());
        } else {
            this.rootElement.appendChild(this._renderTopDownSourcePicker());
        }
        this.rootElement.appendChild(this._renderParams());
        this.rootElement.appendChild(this._renderActions());
        this.rootElement.appendChild(this._renderStats());
        this.rootElement.appendChild(this._renderGrid());
        this.rootElement.appendChild(this._renderCompiled());
    }

    // --- Mode toggle ---

    _renderModeToggle() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-mode';
        const title = document.createElement('div');
        title.className = 'procgen-pipeline-section-title';
        title.textContent = 'Mode';
        section.appendChild(title);

        const row = document.createElement('div');
        row.className = 'procgen-pipeline-mode-row';
        for (const [value, label] of [
            ['gridGrowth', 'Grid growth (build from a scenario pool)'],
            ['topDown', 'Top-down (realise an existing rules.json)'],
        ]) {
            const btn = document.createElement('label');
            btn.className = 'procgen-pipeline-mode-option';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'procgen-pipeline-mode';
            input.value = value;
            input.checked = this.mode === value;
            input.addEventListener('change', () => {
                this.mode = value;
                this.result = null;
                this.message = '';
                this.render();
            });
            const span = document.createElement('span');
            span.textContent = label;
            btn.appendChild(input);
            btn.appendChild(span);
            row.appendChild(btn);
        }
        section.appendChild(row);
        return section;
    }

    // --- Top-down source picker ---

    _renderTopDownSourcePicker() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-source';
        const title = document.createElement('div');
        title.className = 'procgen-pipeline-section-title';
        title.textContent = 'Source rules.json';
        section.appendChild(title);

        const row = document.createElement('div');
        row.className = 'procgen-pipeline-source-row';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.className = 'procgen-pipeline-source-input';
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                this.topDownSource = parsed;
                this.topDownSourceLabel = file.name;
                this._applyGridDimsFromSource(parsed);
                this.message = `Loaded source: ${file.name}`;
            } catch (e) {
                this.topDownSource = null;
                this.topDownSourceLabel = '';
                this.message = `ERROR parsing ${file.name}: ${e.message}`;
            }
            this.render();
        });
        row.appendChild(fileInput);

        // Quick path: use whatever rules.json the frontend currently
        // has loaded (via Presets panel or ?game= URL). Disabled
        // until a stateManager:rawJsonDataLoaded event has populated
        // our cache.
        const useLoadedBtn = this._btn('Use currently-loaded rules.json', () => {
            if (!this.loadedRulesJson) return;
            this.topDownSource = this.loadedRulesJson;
            this.topDownSourceLabel = `loaded (${this.loadedRulesJsonLabel})`;
            this._applyGridDimsFromSource(this.loadedRulesJson);
            this.message = `Using currently-loaded rules.json`;
            this.render();
        });
        if (!this.loadedRulesJson) {
            useLoadedBtn.disabled = true;
            useLoadedBtn.title = 'Load any preset (Presets panel) or open a ?game= URL first.';
        }
        row.appendChild(useLoadedBtn);

        const status = document.createElement('span');
        status.className = 'procgen-pipeline-source-status';
        status.textContent = this.topDownSource
            ? `Loaded: ${this.topDownSourceLabel}`
            : '(no source loaded)';
        row.appendChild(status);

        if (this.topDownSource) {
            const clearBtn = this._btn('Clear', () => {
                this.topDownSource = null;
                this.topDownSourceLabel = '';
                this.result = null;
                this.message = '';
                this.render();
            });
            row.appendChild(clearBtn);
        }

        section.appendChild(row);
        return section;
    }

    // --- Scenario pool picker ---

    _renderScenarioPicker() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-scenario';

        const title = document.createElement('div');
        title.className = 'procgen-pipeline-section-title';
        title.textContent = 'Scenario Pool';
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-scenario-grid';

        // Left: library (click to add)
        const left = document.createElement('div');
        left.className = 'procgen-pipeline-scenario-library';
        const leftHeader = document.createElement('div');
        leftHeader.className = 'procgen-pipeline-scenario-subheader';
        leftHeader.textContent = 'Library (click to add)';
        left.appendChild(leftHeader);
        for (const [id, def] of Object.entries(DEFAULT_ITEMS)) {
            left.appendChild(this._renderLibraryRow(id, def, 'item'));
        }
        for (const [id, def] of Object.entries(DEFAULT_OBSTACLES)) {
            left.appendChild(this._renderLibraryRow(id, def, 'obstacle'));
        }

        // Right: selected (with counts)
        const right = document.createElement('div');
        right.className = 'procgen-pipeline-scenario-selected';
        const rightHeader = document.createElement('div');
        rightHeader.className = 'procgen-pipeline-scenario-subheader';
        rightHeader.textContent = 'Scenario (counts)';
        right.appendChild(rightHeader);
        for (const [id, count] of Object.entries(this.scenario.items)) {
            right.appendChild(this._renderSelectedRow(id, count, 'item'));
        }
        for (const [id, count] of Object.entries(this.scenario.obstacles)) {
            right.appendChild(this._renderSelectedRow(id, count, 'obstacle'));
        }
        if (Object.keys(this.scenario.items).length === 0
            && Object.keys(this.scenario.obstacles).length === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = '(no items/obstacles selected)';
            right.appendChild(empty);
        }

        grid.appendChild(left);
        grid.appendChild(right);
        section.appendChild(grid);
        return section;
    }

    _renderLibraryRow(id, def, kind) {
        const row = document.createElement('div');
        row.className = `procgen-pipeline-library-row procgen-pipeline-library-row-${kind}`;
        if (def.color) {
            const swatch = document.createElement('span');
            swatch.className = 'procgen-pipeline-swatch';
            swatch.style.background = def.color;
            row.appendChild(swatch);
        }
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-library-name';
        name.textContent = `${def.name ?? id} (${kind})`;
        row.appendChild(name);
        row.addEventListener('click', () => {
            const bucket = kind === 'item' ? this.scenario.items : this.scenario.obstacles;
            bucket[id] = (bucket[id] || 0) + 1;
            this.render();
        });
        return row;
    }

    _renderSelectedRow(id, count, kind) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-selected-row';
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-selected-name';
        name.textContent = `${id} (${kind})`;
        row.appendChild(name);

        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 999;
        input.value = count;
        input.className = 'procgen-pipeline-count-input';
        input.addEventListener('change', () => {
            const v = parseInt(input.value, 10);
            const bucket = kind === 'item' ? this.scenario.items : this.scenario.obstacles;
            if (Number.isFinite(v) && v > 0) bucket[id] = v;
            else delete bucket[id];
            this.render();
        });
        row.appendChild(input);

        const rm = document.createElement('button');
        rm.className = 'procgen-pipeline-btn-small';
        rm.textContent = '×';
        rm.addEventListener('click', () => {
            const bucket = kind === 'item' ? this.scenario.items : this.scenario.obstacles;
            delete bucket[id];
            this.render();
        });
        row.appendChild(rm);
        return row;
    }

    // --- Parameters ---

    _renderParams() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-params';

        const title = document.createElement('div');
        title.className = 'procgen-pipeline-section-title';
        title.textContent = 'Parameters';
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-grid';

        const fields = [
            { key: 'seed',              label: 'Seed',             min: 0 },
            { key: 'gridWidth',         label: 'Grid width',       min: 1, max: 10 },
            { key: 'gridHeight',        label: 'Grid height',      min: 1, max: 10 },
            { key: 'regionWidth',       label: 'Region width',     min: 2, max: 40 },
            { key: 'regionHeight',      label: 'Region height',    min: 2, max: 40 },
            { key: 'minSuccessPct',     label: 'Walker min %',     min: 0, max: 100 },
            { key: 'maxSuccessPct',     label: 'Walker max %',     min: 0, max: 100 },
            { key: 'walkerTrials',      label: 'Walker trials',    min: 1, max: 100 },
            { key: 'maxItemsPerRegion', label: 'Max items/region', min: 0, max: 10 },
            { key: 'maxRegions',        label: 'Max regions',      min: 1, max: 99, nullable: true, placeholder: 'auto' },
        ];

        for (const f of fields) {
            const row = document.createElement('div');
            row.className = 'procgen-pipeline-field';
            const label = document.createElement('label');
            label.textContent = f.label;
            const input = document.createElement('input');
            input.type = 'number';
            input.value = this.params[f.key] ?? '';
            if (f.min !== undefined) input.min = f.min;
            if (f.max !== undefined) input.max = f.max;
            if (f.placeholder) input.placeholder = f.placeholder;
            input.addEventListener('change', () => {
                if (input.value === '' && f.nullable) {
                    this.params[f.key] = null;
                } else {
                    const v = parseInt(input.value, 10);
                    if (Number.isFinite(v)) this.params[f.key] = v;
                }
            });
            row.appendChild(label);
            row.appendChild(input);
            grid.appendChild(row);
        }
        section.appendChild(grid);

        const btnRow = document.createElement('div');
        btnRow.className = 'procgen-pipeline-btn-row';
        const saveBtn = this._btn('Save Params', () => this._saveToLocalStorage());
        const loadBtn = this._btn('Load Params', () => { this._loadFromLocalStorage(); this.render(); });
        const resetBtn = this._btn('Reset Defaults', () => {
            this.params = { ...DEFAULT_PARAMS };
            this.scenario = {
                items: { ...DEFAULT_SCENARIO.items },
                obstacles: { ...DEFAULT_SCENARIO.obstacles },
            };
            this.render();
        });
        btnRow.appendChild(saveBtn);
        btnRow.appendChild(loadBtn);
        btnRow.appendChild(resetBtn);
        section.appendChild(btnRow);
        return section;
    }

    // --- Actions + stats ---

    _renderActions() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-actions';
        const gen = document.createElement('button');
        gen.className = 'procgen-pipeline-btn procgen-pipeline-btn-primary';
        gen.textContent = this.isGenerating ? 'Generating…' : 'Generate';
        gen.disabled = this.isGenerating;
        gen.addEventListener('click', () => this._runGeneration());
        section.appendChild(gen);

        // Post-generation export actions, shown next to Generate once
        // a result is available. Hidden until then to keep the panel
        // uncluttered before there's anything to export.
        if (this.result) {
            const json = stringifyRulesJson(this.result.rulesJson);
            const seedName = this.result.rulesJson?.seed_name || String(this.params.seed);
            const filename = `AP_${seedName}_rules.json`;

            const loadBtn = this._btn('Load into frontend', (e) => {
                e.preventDefault();
                this._loadIntoFrontend(this.result.rulesJson, loadBtn);
            });
            const downloadBtn = this._btn('Download rules.json', (e) => {
                e.preventDefault();
                this._downloadText(json, filename);
            });
            const copyBtn = this._btn('Copy JSON', (e) => {
                e.preventDefault();
                this._copyToClipboard(json, copyBtn);
            });
            section.appendChild(loadBtn);
            section.appendChild(downloadBtn);
            section.appendChild(copyBtn);
        }

        if (this.message) {
            const msg = document.createElement('span');
            msg.className = 'procgen-pipeline-message';
            msg.textContent = this.message;
            section.appendChild(msg);
        }
        return section;
    }

    _renderStats() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-stats';
        if (!this.result) return section;
        const { stats, poolRemaining } = this.result;
        const parts = [
            `regions ${stats.regionsBuilt}`,
            `skipped ${stats.regionsSkipped}`,
            `stop: ${stats.stopReason}`,
        ];
        if (poolRemaining) {
            parts.push(
                `pool rem: items=${this._sumCounts(poolRemaining.items)} obs=${this._sumCounts(poolRemaining.obstacles)}`,
            );
        }
        if (stats.teleportersPlaced) {
            parts.push(`teleporters ${stats.teleportersPlaced}`);
        }
        section.textContent = parts.join(' · ');
        return section;
    }

    _sumCounts(d) {
        return Object.values(d).reduce((a, b) => a + b, 0);
    }

    // --- Grid canvas ---

    _renderGrid() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-canvas-wrap';
        if (!this.result) {
            const hint = document.createElement('div');
            hint.className = 'procgen-pipeline-hint';
            hint.textContent = 'Click Generate to run the pipeline.';
            section.appendChild(hint);
            return section;
        }
        const { grid, regionSize } = this.result;
        const canvas = document.createElement('canvas');
        canvas.className = 'procgen-pipeline-canvas';
        canvas.width = grid.width * regionSize.width * TILE_PX;
        canvas.height = grid.height * regionSize.height * TILE_PX;
        this._drawGrid(canvas, grid, regionSize);
        section.appendChild(canvas);
        return section;
    }

    _drawGrid(canvas, grid, regionSize) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = COLORS.emptyCell;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let gy = 0; gy < grid.height; gy++) {
            for (let gx = 0; gx < grid.width; gx++) {
                const region = grid.getRegion({ gx, gy });
                const offX = gx * regionSize.width * TILE_PX;
                const offY = gy * regionSize.height * TILE_PX;
                if (!region) {
                    ctx.strokeStyle = COLORS.cellBorder;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(offX + 0.5, offY + 0.5,
                        regionSize.width * TILE_PX - 1, regionSize.height * TILE_PX - 1);
                    continue;
                }
                this._drawRegion(ctx, region.playable_payload, offX, offY);
            }
        }

        // Cell borders so regions are visually distinct.
        ctx.strokeStyle = COLORS.cellBorder;
        ctx.lineWidth = 1;
        for (let gx = 0; gx <= grid.width; gx++) {
            ctx.beginPath();
            ctx.moveTo(gx * regionSize.width * TILE_PX + 0.5, 0);
            ctx.lineTo(gx * regionSize.width * TILE_PX + 0.5, canvas.height);
            ctx.stroke();
        }
        for (let gy = 0; gy <= grid.height; gy++) {
            ctx.beginPath();
            ctx.moveTo(0, gy * regionSize.height * TILE_PX + 0.5);
            ctx.lineTo(canvas.width, gy * regionSize.height * TILE_PX + 0.5);
            ctx.stroke();
        }
    }

    _drawRegion(ctx, world, offX, offY) {
        const obsLib = world.obstacleLib ?? DEFAULT_OBSTACLES;
        const itemLib = world.itemLib ?? DEFAULT_ITEMS;
        // Composite view doesn't have a player inventory — gates
        // always render closed here. (The maze panel's playable view
        // is the right place to see them open as the player picks up
        // keys.)
        const inventory = new Set();

        // Tile base layer
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                const tile = getTile(world, x, y);
                ctx.fillStyle = tile === TILE_WALL ? COLORS.wall : COLORS.floor;
                ctx.fillRect(offX + x * TILE_PX, offY + y * TILE_PX, TILE_PX, TILE_PX);
            }
        }

        // Quick lookup from tile coords to the exit at that position.
        const exitAt = new Map();
        for (const e of world.exits.values()) {
            exitAt.set(`${e.x},${e.y}`, e);
        }

        // §5 rendering pass — same shape as mazeRoomUI._drawWorld.
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                const key = `${x},${y}`;
                const obstacleId = world.obstacles.get(key);
                const obstacle = obstacleId ? obsLib[obstacleId] : null;
                const isLogicGate = obstacle?.clear_set_type === 'rule';
                const gateClosed = isLogicGate
                    && !isObstacleCleared(obstacleId, inventory, obsLib);
                const exit = exitAt.get(key);
                const isExit = !!exit;
                const isEntrance = (x === world.entrance.x && y === world.entrance.y);
                const itemId = world.items.get(key);

                if (isExit) {
                    ctx.fillStyle = (isLogicGate && gateClosed) ? COLORS.exitBlocked : COLORS.exit;
                    ctx.fillRect(offX + x * TILE_PX, offY + y * TILE_PX, TILE_PX, TILE_PX);
                }
                if (obstacle && !isLogicGate) {
                    const color = obstacle.color ?? '#b84040';
                    ctx.fillStyle = color;
                    ctx.fillRect(offX + x * TILE_PX + 2, offY + y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
                }
                if (itemId) {
                    const hints = getItemRenderHints(itemId, itemLib);
                    const cx = offX + x * TILE_PX + TILE_PX / 2;
                    const cy = offY + y * TILE_PX + TILE_PX / 2;
                    ctx.fillStyle = hints.color;
                    ctx.beginPath();
                    ctx.arc(cx, cy, TILE_PX * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    if (hints.label) {
                        ctx.save();
                        ctx.fillStyle = '#000';
                        ctx.font = `bold ${Math.floor(TILE_PX * 0.55)}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(hints.label, cx, cy);
                        ctx.restore();
                    }
                    if (isLogicGate && gateClosed) {
                        ctx.strokeStyle = COLORS.locationBlocked;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(offX + x * TILE_PX + 1, offY + y * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
                    }
                }
                if (isEntrance && !isExit) {
                    ctx.strokeStyle = COLORS.entrance;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(offX + x * TILE_PX + 1, offY + y * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
                }
            }
        }
    }

    // --- rules.json export ---

    _renderCompiled() {
        const container = document.createElement('div');
        container.className = 'procgen-pipeline-rules-container';
        if (!this.result) { container.style.display = 'none'; return container; }

        const details = document.createElement('details');
        details.className = 'procgen-pipeline-rules';
        const summary = document.createElement('summary');
        summary.textContent = 'rules.json (with preset_sidecars)';
        details.appendChild(summary);

        // Export buttons (Load / Download / Copy) live next to Generate
        // in _renderActions; this section is just the JSON preview now.
        const json = stringifyRulesJson(this.result.rulesJson);
        const pre = document.createElement('pre');
        pre.className = 'procgen-pipeline-rules-json';
        pre.textContent = json;
        details.appendChild(pre);

        container.appendChild(details);
        return container;
    }

    _downloadText(text, filename) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke after a tick so the download has a chance to start.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    _loadIntoFrontend(rulesJson, button) {
        const restore = () => { button.textContent = 'Load into frontend'; };
        const eventBus = this.apis?.eventBus;
        if (!eventBus || typeof eventBus.publish !== 'function') {
            button.textContent = 'No eventBus';
            setTimeout(restore, 1500);
            return;
        }
        // Matches the editor's Apply flow — same event name, same payload shape.
        eventBus.publish('files:jsonLoaded', {
            jsonData: rulesJson,
            selectedPlayerId: '1',
            sourceName: 'procgenPipeline',
        });
        button.textContent = 'Loaded';
        setTimeout(restore, 1200);
    }

    _copyToClipboard(text, button) {
        const restore = () => { button.textContent = 'Copy JSON'; };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => { button.textContent = 'Copied'; setTimeout(restore, 1200); })
                .catch(() => { button.textContent = 'Copy failed'; });
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try {
            document.execCommand('copy');
            button.textContent = 'Copied'; setTimeout(restore, 1200);
        } catch {
            button.textContent = 'Copy failed';
        }
        document.body.removeChild(ta);
    }

    // --- Run ---

    _runGeneration() {
        if (this.isGenerating) return;
        if (this.mode === 'topDown' && !this.topDownSource) {
            this.message = 'Pick a source rules.json first.';
            this.render();
            return;
        }
        this.isGenerating = true;
        this.message = '';
        this.result = null;
        this.render();

        try {
            if (this.mode === 'topDown') {
                this._runTopDown();
            } else {
                this._runGridGrowth();
            }
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }

        this.isGenerating = false;
        this.render();
    }

    _runGridGrowth() {
        const { seed, gridWidth, gridHeight, regionWidth, regionHeight,
            minSuccessPct, maxSuccessPct, walkerTrials,
            maxItemsPerRegion, maxRegions } = this.params;
        const { grid, pool, stats, startCell } = growMaze({
            gridDims: { width: gridWidth, height: gridHeight },
            regionSize: { width: regionWidth, height: regionHeight },
            itemPool: { ...this.scenario.items },
            obstaclePool: { ...this.scenario.obstacles },
            seed,
            regionParams: {
                minSuccessPct: minSuccessPct / 100,
                maxSuccessPct: maxSuccessPct / 100,
                walkerTrials,
            },
            growthParams: {
                maxItemsPerRegion,
                maxRegions: maxRegions ?? null,
            },
        });
        const rulesJson = buildRulesJson(grid, { startCell, seed });
        this.result = {
            grid,
            regionSize: { width: regionWidth, height: regionHeight },
            stats,
            poolRemaining: pool.snapshot(),
            rulesJson,
        };
    }

    _runTopDown() {
        const { seed, gridWidth, gridHeight, regionWidth, regionHeight } = this.params;
        const { grid, stats, startCell } = topDownFromRulesJson(this.topDownSource, {
            gridDims: { width: gridWidth, height: gridHeight },
            regionSizeBase: { width: regionWidth, height: regionHeight },
            seed,
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed,
            assumeBidirectional: this.topDownSource.assume_bidirectional_exits !== false,
        });
        this.result = {
            grid,
            regionSize: { width: regionWidth, height: regionHeight },
            stats,
            // No pool in top-down mode — keep the field present so the
            // stats renderer can branch cleanly.
            poolRemaining: null,
            rulesJson,
        };
    }

    // Auto-size the grid to fit the source rules.json's region count.
    // Top-down places one grid cell per non-Menu region (plus extra
    // for teleporter targets that can't fit adjacent), so a square
    // grid sized to ceil(sqrt(N * 1.5)) gives BFS room to lay out
    // without immediately falling back to teleporters. Floor at the
    // panel's defaults so a small source doesn't shrink the grid.
    _applyGridDimsFromSource(rulesJson) {
        const regions = rulesJson?.regions?.['1'] ?? {};
        const count = Object.keys(regions).length;
        if (count === 0) return;
        const dim = Math.max(
            DEFAULT_PARAMS.gridWidth,
            Math.ceil(Math.sqrt(count * 1.5)),
        );
        this.params.gridWidth = dim;
        this.params.gridHeight = dim;
    }

    // --- helpers ---

    _btn(label, onClick) {
        const b = document.createElement('button');
        b.className = 'procgen-pipeline-btn';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }

    _saveToLocalStorage() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify({
                params: this.params,
                scenario: this.scenario,
                mode: this.mode,
            }));
            this.message = 'Saved.';
            this.render();
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
            this.render();
        }
    }

    _loadFromLocalStorage() {
        try {
            const s = localStorage.getItem(LS_KEY);
            if (!s) return;
            const parsed = JSON.parse(s);
            if (parsed.params) this.params = { ...DEFAULT_PARAMS, ...parsed.params };
            if (parsed.scenario) {
                this.scenario = {
                    items: { ...(parsed.scenario.items ?? {}) },
                    obstacles: { ...(parsed.scenario.obstacles ?? {}) },
                };
            }
            if (parsed.mode === 'gridGrowth' || parsed.mode === 'topDown') {
                this.mode = parsed.mode;
            }
        } catch (e) {
            // ignore
        }
    }
}

/**
 * mazeRoom UI panel — generator controls + canvas renderer + keyboard
 * play for the walls-only maze. The engine (mazeRoomEngine.js) is
 * headless; this file is the thin DOM wrapper over it.
 */

import { setPanelInstance, getModuleApis, consumePendingLoadRegion } from './index.js';
import {
    TILE_WALL,
    INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    createState,
    getTile,
    getObstacle, getItem,
    step,
    detectStepEvents,
    generateMaze,
    extractPathsAndObstacles,
} from './mazeRoomEngine.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES, isObstacleCleared } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
// Imported directly so the panel can subscribe even when its
// constructor runs before its module's initialize() (Golden Layout
// may build panels during its own init, ahead of module init — at
// which point `this.apis.eventBus` is still null).
import eventBus from '../../app/core/eventBus.js';

// stateManager's snapshot.inventory is a plain object { itemName: count }.
// Convert to a Set of item ids that the player currently holds (count > 0)
// — that's what step() and the rendering code want.
function inventoryFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.inventory) return new Set();
    const set = new Set();
    for (const [id, count] of Object.entries(snapshot.inventory)) {
        if (count > 0) set.add(id);
    }
    return set;
}

const LS_KEY = 'mazeRoom_params';

const DEFAULT_PARAMS = {
    seed: 1,
    width: 16,
    height: 12,
    maxIterations: 2000,
    stallLimit: 200,
    walkerTrials: 20,
    walkerStepBudget: null, // null = auto (4 * width * height)
    minSuccessPct: 30,      // percent; null disables the difficulty gate
    maxSuccessPct: 90,      // percent; null disables the difficulty gate
};

const TILE_PX = 20;
const COLORS = {
    floor: '#2a2a2a',
    wall: '#000000',
    entrance: '#3aa85a',
    exit: '#d04040',
    player: '#4aa8ff',
    grid: '#1a1a1a',
};

const KEY_MAP = {
    ArrowUp: INPUT_N, w: INPUT_N, W: INPUT_N,
    ArrowDown: INPUT_S, s: INPUT_S, S: INPUT_S,
    ArrowLeft: INPUT_W, a: INPUT_W, A: INPUT_W,
    ArrowRight: INPUT_E, d: INPUT_E, D: INPUT_E,
};

export class MazeRoomUI {
    static moduleApis = null;
    static setModuleApis(apis) { MazeRoomUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.params = { ...DEFAULT_PARAMS };
        this.world = null;
        this.state = null;
        this.stats = null;
        this.isGenerating = false;
        this.message = '';

        // Inventory truth in playback mode (after a maze:loadRegion).
        // null means we're in the standalone "Generate" dev flow and
        // the panel should fall back to state.inventory — which step()
        // continues to maintain in that mode (see mazeRoomEngine.js
        // step's inventoryOverride contract).
        this.externalInventory = null;
        // AP-canonical region name for the currently-loaded region.
        // Set in playback mode; null in Generate dev flow. Used as
        // sourceRegion / regionName when publishing dispatcher events.
        this.currentRegionId = null;
        this._unsubSnapshot = null;

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'maze-room-panel';
        this.rootElement.tabIndex = 0;
        this.rootElement.addEventListener('keydown', (e) => this._handleKeydown(e));

        setPanelInstance(this);
        this._loadFromLocalStorage();
        this._subscribeToSnapshotUpdates();

        // If a maze:loadRegion event was published before this panel
        // mounted, the index.js handler buffered the payload. Pick it
        // up here so the panel comes up showing the loaded region
        // instead of the empty "click Generate" hint.
        const pending = consumePendingLoadRegion();
        if (pending) {
            this._adoptLoadedRegion(pending, { skipRender: true });
        }

        this.render();
    }

    _subscribeToSnapshotUpdates() {
        // Subscribe through the raw eventBus with an explicit module
        // name. Can't use this.apis.eventBus here: Golden Layout may
        // build the panel before maze/index.js's initialize() has run,
        // so the per-module wrapper isn't set up yet.
        const handler = (data) => {
            // Only the playback flow cares about the snapshot's inventory;
            // the Generate dev flow keeps using state.inventory directly.
            if (this.externalInventory === null) return;
            this.externalInventory = inventoryFromSnapshot(data?.snapshot);
            this.render();
        };
        eventBus.subscribe('stateManager:snapshotUpdated', handler, 'mazeRoom');
        this._unsubSnapshot = () => eventBus.unsubscribe('stateManager:snapshotUpdated', handler, 'mazeRoom');
    }

    _currentInventory() {
        if (this.externalInventory !== null) return this.externalInventory;
        return this.state?.inventory ?? new Set();
    }

    /**
     * Apply a region payload published via maze:loadRegion. Called by
     * the module-level handler when this panel is already mounted, and
     * (via constructor) on initial mount with any buffered payload.
     */
    applyLoadedRegion(payload) {
        this._adoptLoadedRegion(payload);
    }

    _adoptLoadedRegion(payload, { skipRender = false } = {}) {
        // Payload shape (per procgen-player.md §"Event flow"):
        //   { region_id, world, arrivedFrom }
        // v1 maze ignores arrivedFrom — every region has exactly one
        // entrance, so the player always spawns at world.entrance.
        // arrivedFrom becomes meaningful when v2 substrates support
        // multiple entrances per region.
        this.world = payload.world;
        this.state = createState(this.world);
        this.stats = null;
        this.message = payload.region_id
            ? `Loaded region: ${payload.region_id}`
            : 'Loaded region';
        this.currentRegionId = payload.region_id ?? null;
        // Switch into playback mode: inventory truth comes from
        // stateManager snapshots from now on. Seed from the current
        // cached snapshot if one exists; further updates arrive via
        // the snapshot subscription.
        this.externalInventory = inventoryFromSnapshot(stateManagerProxySingleton.getSnapshot());
        if (!skipRender) {
            this.render();
            this.rootElement?.focus();
        }
    }

    get apis() { return MazeRoomUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() {
        if (this._unsubSnapshot) { this._unsubSnapshot(); this._unsubSnapshot = null; }
        setPanelInstance(null);
    }
    onPanelShow() { this.render(); this.rootElement.focus(); }
    onPanelResize() {}

    render() {
        this.rootElement.innerHTML = '';
        this.rootElement.appendChild(this._renderParams());
        this.rootElement.appendChild(this._renderActions());
        this.rootElement.appendChild(this._renderStats());
        this.rootElement.appendChild(this._renderMaze());
        this.rootElement.appendChild(this._renderRules());
    }

    // --- Parameter UI ---

    _renderParams() {
        const section = document.createElement('div');
        section.className = 'maze-room-params';
        section.innerHTML = '<div class="maze-room-section-title">Parameters</div>';

        const grid = document.createElement('div');
        grid.className = 'maze-room-grid';

        const fields = [
            { key: 'seed',             label: 'Seed',              min: 0 },
            { key: 'width',            label: 'Width',             min: 2,   max: 80 },
            { key: 'height',           label: 'Height',            min: 2,   max: 80 },
            { key: 'maxIterations',    label: 'Max iterations',    min: 1,   max: 100000 },
            { key: 'stallLimit',       label: 'Stall limit',       min: 1,   max: 10000 },
            { key: 'walkerTrials',     label: 'Walker trials',     min: 1,   max: 500 },
            { key: 'walkerStepBudget', label: 'Step budget',       min: 1,   max: 100000, nullable: true, placeholder: 'auto' },
            { key: 'minSuccessPct',    label: 'Min success %',     min: 0,   max: 100,    nullable: true, placeholder: 'off' },
            { key: 'maxSuccessPct',    label: 'Max success %',     min: 0,   max: 100,    nullable: true, placeholder: 'off' },
        ];

        for (const f of fields) {
            const row = document.createElement('div');
            row.className = 'maze-room-field';

            const label = document.createElement('label');
            label.textContent = f.label;
            label.htmlFor = `maze-room-${f.key}`;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `maze-room-${f.key}`;
            const currentValue = this.params[f.key];
            input.value = currentValue == null ? '' : currentValue;
            if (f.min !== undefined) input.min = f.min;
            if (f.max !== undefined) input.max = f.max;
            if (f.placeholder) input.placeholder = f.placeholder;
            input.addEventListener('change', () => {
                if (input.value === '' && f.nullable) {
                    this.params[f.key] = null;
                    return;
                }
                const v = parseInt(input.value, 10);
                if (Number.isFinite(v)) this.params[f.key] = v;
            });

            row.appendChild(label);
            row.appendChild(input);
            grid.appendChild(row);
        }

        section.appendChild(grid);

        const btnRow = document.createElement('div');
        btnRow.className = 'maze-room-btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'maze-room-btn';
        saveBtn.textContent = 'Save Params';
        saveBtn.addEventListener('click', () => this._saveToLocalStorage());

        const loadBtn = document.createElement('button');
        loadBtn.className = 'maze-room-btn';
        loadBtn.textContent = 'Load Params';
        loadBtn.addEventListener('click', () => {
            this._loadFromLocalStorage();
            this.render();
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'maze-room-btn';
        resetBtn.textContent = 'Reset Defaults';
        resetBtn.addEventListener('click', () => {
            this.params = { ...DEFAULT_PARAMS };
            this.render();
        });

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(loadBtn);
        btnRow.appendChild(resetBtn);
        section.appendChild(btnRow);

        return section;
    }

    // --- Actions ---

    _renderActions() {
        const section = document.createElement('div');
        section.className = 'maze-room-actions';

        const genBtn = document.createElement('button');
        genBtn.className = 'maze-room-btn maze-room-btn-primary';
        genBtn.textContent = this.isGenerating ? 'Generating…' : 'Generate';
        genBtn.disabled = this.isGenerating;
        genBtn.addEventListener('click', () => this._runGeneration());
        section.appendChild(genBtn);

        if (this.world) {
            const resetPlayerBtn = document.createElement('button');
            resetPlayerBtn.className = 'maze-room-btn';
            resetPlayerBtn.textContent = 'Reset Player';
            resetPlayerBtn.addEventListener('click', () => {
                this.state = createState(this.world);
                this.message = '';
                this.render();
                this.rootElement.focus();
            });
            section.appendChild(resetPlayerBtn);
        }

        if (this.message) {
            const msg = document.createElement('span');
            msg.className = 'maze-room-message';
            msg.textContent = this.message;
            section.appendChild(msg);
        }

        return section;
    }

    // --- Stats ---

    _renderStats() {
        const section = document.createElement('div');
        section.className = 'maze-room-stats';
        if (!this.stats) return section;

        const parts = [
            `iter ${this.stats.iterations}`,
            `accepted ${this.stats.accepted}`,
            `rej ${this.stats.rejected} (feas ${this.stats.rejectedFeasibility}, diff ${this.stats.rejectedDifficulty})`,
            `path ${this.stats.shortestPath ?? '—'}`,
        ];
        if (this.stats.difficultyGateOn && this.stats.finalSuccessFraction != null) {
            parts.push(`walker ${(this.stats.finalSuccessFraction * 100).toFixed(0)}%`);
        }
        if (this.stats.gateKeyPlaced) {
            parts.push('gate+key');
        } else if (this.stats.gateKeyReason && this.stats.gateKeyReason !== 'disabled') {
            parts.push(`no-gate (${this.stats.gateKeyReason})`);
        }
        let status = 'complete';
        if (this.stats.stalled) status = 'stalled';
        else if (this.stats.reachedTarget) status = 'target';
        parts.push(status);

        const line = document.createElement('div');
        line.textContent = parts.join(' · ');
        section.appendChild(line);

        const currentInv = this._currentInventory();
        if (this.state && currentInv.size > 0) {
            const inv = document.createElement('div');
            inv.className = 'maze-room-inventory';
            const itemNames = [...currentInv].map((id) => {
                const item = (this.world?.itemLib ?? DEFAULT_ITEMS)[id];
                return item?.name ?? id;
            });
            inv.textContent = `inventory: ${itemNames.join(', ')}`;
            section.appendChild(inv);
        }
        return section;
    }

    // --- Rules (paths-and-obstacles) ---

    _renderRules() {
        const container = document.createElement('div');
        container.className = 'maze-room-rules-container';
        if (!this.world) {
            container.style.display = 'none';
            return container;
        }

        const extracted = extractPathsAndObstacles(this.world);
        const compiled = compileRegion(extracted, {
            obstacleLib: this.world.obstacleLib ?? DEFAULT_OBSTACLES,
        });

        container.appendChild(this._renderJsonBlock(
            'Paths & obstacles (extracted)',
            extracted,
        ));
        container.appendChild(this._renderJsonBlock(
            'Compiled rules (Rule Builder JSON)',
            compiled,
        ));
        return container;
    }

    _renderJsonBlock(title, data) {
        const section = document.createElement('details');
        section.className = 'maze-room-rules';

        const summary = document.createElement('summary');
        summary.textContent = title;
        section.appendChild(summary);

        const json = JSON.stringify(data, null, 2);

        const btnRow = document.createElement('div');
        btnRow.className = 'maze-room-btn-row';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'maze-room-btn';
        copyBtn.textContent = 'Copy JSON';
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Fall back to the legacy execCommand path if clipboard API
            // isn't available — some embedded contexts (iframes without
            // focus, older browsers) don't expose navigator.clipboard.
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(json)
                    .then(() => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1200); })
                    .catch(() => { copyBtn.textContent = 'Copy failed'; });
            } else {
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1200); }
                catch (err) { copyBtn.textContent = 'Copy failed'; }
                document.body.removeChild(ta);
            }
        });
        btnRow.appendChild(copyBtn);
        section.appendChild(btnRow);

        const pre = document.createElement('pre');
        pre.className = 'maze-room-rules-json';
        pre.textContent = json;
        section.appendChild(pre);
        return section;
    }

    // --- Canvas rendering ---

    _renderMaze() {
        const section = document.createElement('div');
        section.className = 'maze-room-canvas-wrap';

        if (!this.world) {
            const hint = document.createElement('div');
            hint.className = 'maze-room-hint';
            hint.textContent = 'Click Generate to build a maze. Use arrow keys or WASD to play.';
            section.appendChild(hint);
            return section;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'maze-room-canvas';
        canvas.width = this.world.width * TILE_PX;
        canvas.height = this.world.height * TILE_PX;
        this._drawWorld(canvas);
        section.appendChild(canvas);
        return section;
    }

    _drawWorld(canvas) {
        const ctx = canvas.getContext('2d');
        const w = this.world;
        const itemLib = w.itemLib ?? DEFAULT_ITEMS;
        const obstacleLib = w.obstacleLib ?? DEFAULT_OBSTACLES;

        for (let y = 0; y < w.height; y++) {
            for (let x = 0; x < w.width; x++) {
                const tile = getTile(w, x, y);
                ctx.fillStyle = tile === TILE_WALL ? COLORS.wall : COLORS.floor;
                ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
            }
        }

        ctx.fillStyle = COLORS.entrance;
        ctx.fillRect(w.entrance.x * TILE_PX, w.entrance.y * TILE_PX, TILE_PX, TILE_PX);

        ctx.fillStyle = COLORS.exit;
        ctx.fillRect(w.exit.x * TILE_PX, w.exit.y * TILE_PX, TILE_PX, TILE_PX);

        // Obstacles — filled tile in the library's color when still
        // blocking, faded to an outlined ghost when the current
        // inventory clears them (the player can walk through without
        // further action).
        const currentInv = this._currentInventory();
        for (const [posKey, obstacleId] of w.obstacles) {
            const [x, y] = posKey.split(',').map(Number);
            const obstacle = obstacleLib[obstacleId];
            const color = obstacle?.color ?? '#b84040';
            const cleared = isObstacleCleared(obstacleId, currentInv, obstacleLib);
            if (cleared) {
                // Open — dashed outline, no solid fill, so the tile
                // reads as "was a door, now walk-through."
                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(x * TILE_PX + 3, y * TILE_PX + 3, TILE_PX - 6, TILE_PX - 6);
                ctx.restore();
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(x * TILE_PX + 2, y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x * TILE_PX + 2, y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
            }
        }

        // Items — a smaller filled circle in the library's color, skipped
        // if the player has already collected the item.
        for (const [posKey, itemId] of w.items) {
            if (currentInv.has(itemId)) continue;
            const [x, y] = posKey.split(',').map(Number);
            const item = itemLib[itemId];
            const color = item?.color ?? '#e6a817';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x * TILE_PX + TILE_PX / 2, y * TILE_PX + TILE_PX / 2, TILE_PX * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 0; x <= w.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * TILE_PX + 0.5, 0);
            ctx.lineTo(x * TILE_PX + 0.5, w.height * TILE_PX);
            ctx.stroke();
        }
        for (let y = 0; y <= w.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * TILE_PX + 0.5);
            ctx.lineTo(w.width * TILE_PX, y * TILE_PX + 0.5);
            ctx.stroke();
        }

        if (this.state) {
            const { x, y } = this.state.player_pos;
            ctx.fillStyle = COLORS.player;
            ctx.beginPath();
            ctx.arc(x * TILE_PX + TILE_PX / 2, y * TILE_PX + TILE_PX / 2, TILE_PX * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- Generation ---

    _runGeneration() {
        if (this.isGenerating) return;
        this.isGenerating = true;
        this.message = '';
        this.render();

        try {
            const { world, stats } = generateMaze({
                width: this.params.width,
                height: this.params.height,
                seed: this.params.seed,
                params: {
                    maxIterations: this.params.maxIterations,
                    stallLimit: this.params.stallLimit,
                    walkerTrials: this.params.walkerTrials,
                    walkerStepBudget: this.params.walkerStepBudget,
                    minSuccessPct: this.params.minSuccessPct == null ? null : this.params.minSuccessPct / 100,
                    maxSuccessPct: this.params.maxSuccessPct == null ? null : this.params.maxSuccessPct / 100,
                },
            });
            this.world = world;
            this.state = createState(world);
            this.stats = stats;
            // Generate dev flow uses state.inventory directly — drop
            // any external inventory left over from a prior LoadRegion
            // session in this panel.
            this.externalInventory = null;
            this.currentRegionId = null;
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }

        this.isGenerating = false;
        this.render();
        this.rootElement.focus();
    }

    // --- Play ---

    _handleKeydown(e) {
        if (!this.world || !this.state) return;
        const input = KEY_MAP[e.key];
        if (!input) return;
        e.preventDefault();
        // In playback mode (externalInventory non-null) the snapshot is
        // truth and step() must not mutate state.inventory; in Generate
        // dev mode the override is undefined and step keeps its
        // historical pickup-into-state.inventory behavior.
        const oldPos = { x: this.state.player_pos.x, y: this.state.player_pos.y };
        const next = step(this.world, this.state, input, this.externalInventory ?? undefined);
        if (next === null) return;
        this.state = next;
        if (this.externalInventory !== null) {
            this._publishPlaybackEvents(oldPos, next.player_pos);
        }
        if (this.state.player_pos.x === this.world.exit.x && this.state.player_pos.y === this.world.exit.y) {
            this.message = `Reached exit in ${this.state.turn} steps.`;
        }
        this.render();
    }

    /**
     * Translate substrate-internal step events into AP-level
     * dispatcher events. Only called in playback mode (after a
     * maze:loadRegion). Skips events that lack the AP metadata they
     * would need (no locationName for a pickup, no targetRegion for
     * an exit cross — both can be null when the sidecar didn't have
     * them, e.g. unstitched grid-edge exits).
     */
    _publishPlaybackEvents(oldPos, newPos) {
        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        const events = detectStepEvents(this.world, oldPos, newPos, this.externalInventory);
        for (const ev of events) {
            if (ev.type === 'pickup') {
                const key = `${ev.position.x},${ev.position.y}`;
                const locationName = this.world.itemLocationNames?.get(key);
                if (!locationName) continue;
                dispatcher.publish('user:locationCheck', {
                    locationName,
                    regionName: this.currentRegionId,
                }, { initialTarget: 'bottom' });
            } else if (ev.type === 'exit_cross') {
                const targetRegion = this.world.exit.targetRegion;
                if (!targetRegion) continue;
                dispatcher.publish('user:regionMove', {
                    sourceRegion: this.currentRegionId,
                    targetRegion,
                    exitName: this.world.exit.exitName ?? null,
                }, { initialTarget: 'bottom' });
            }
        }
    }

    // --- localStorage ---

    _saveToLocalStorage() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this.params));
            this.message = 'Parameters saved.';
            this.render();
        } catch (e) {
            this.message = `ERROR saving params: ${e.message}`;
            this.render();
        }
    }

    _loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(LS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.params = { ...DEFAULT_PARAMS, ...parsed };
            }
        } catch (e) {
            // ignore
        }
    }
}

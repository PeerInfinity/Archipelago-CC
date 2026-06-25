/**
 * Bounce region editor — Golden Layout panel.
 *
 * Edits ONE bounce region's geometry (its level.js level) in two modes:
 *   - pipeline: opened by the procgen panel's 3 Edit ▸ with a live region +
 *     a write-back hook (onSave). Saving re-assembles the region and splices
 *     it back into the grid (chunk 5).
 *   - standalone: opened directly (no onSave). Loads a fixture / file / blank
 *     level, edits, and exports a level JSON.
 *
 * The edit surface is the same in both modes; only the data source/sink
 * differs. v1 is click/button driven (NO drag — consistent with the rest of
 * the procgen panel). Access rules are DERIVED for display, never stored.
 */
import rawEventBus from '../../app/core/eventBus.js';
import { renderLevel } from './levelRenderer.js';
import {
    assembleBounceRegionFromLevel, generateZoneForSpecs, BOUNCE_LIBRARY_ITEMS,
} from '../bounceDemo/bounceDemoLibrary.js';
import { validateLevel, braidBlueInvariantErrors } from '../bounceDemo/level.js';
import {
    deriveAccessRules, deriveBraidAccessRules, formatRule,
} from '../bounceDemo/deriveRules.js';
import { resolvePhysicsStamp } from '../bounceDemo/physics.js';
import { bounceStack } from '../bounceDemo/fixtures/bounceStack.js';
import { easyTower } from '../bounceDemo/fixtures/easyTower.js';
import { springGap } from '../bounceDemo/fixtures/springGap.js';
import { fork } from '../bounceDemo/fixtures/fork.js';
import { fillerClimb } from '../bounceDemo/fixtures/fillerClimb.js';
import {
    getModuleApis, setPanelInstance, consumePendingSession, LOAD_EVENT,
} from './index.js';

const FIXTURES = {
    bounceStack, easyTower, springGap, fork, fillerClimb,
};

// Canvas width (px) for the whole-level view; height scales with the level.
const CANVAS_W = 340;

function deepClone(obj) {
    return (typeof structuredClone === 'function')
        ? structuredClone(obj)
        : JSON.parse(JSON.stringify(obj));
}

export class BounceRegionEditorUI {
    static moduleApis = null;
    static setModuleApis(apis) { BounceRegionEditorUI.moduleApis = apis; }

    constructor(container, _componentState, _componentType) {
        this.container = container;
        // The active editing session: { level, contract, onSave, mode, label }.
        this._session = null;
        this._selectedId = null;
        this._message = '';
        this._settingsOpen = false; // "Region generation" section collapsed by default

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'bounce-region-editor-panel';
        setPanelInstance(this);

        // Pick up a pending pipeline session if Edit ▸ opened us; otherwise
        // boot standalone with a fixture so the panel is never empty.
        const pending = consumePendingSession();
        if (pending) this._loadSession(pending);
        else this._loadFixture('bounceStack');

        // Re-render when a (later) Edit ▸ launch publishes a new session.
        // Subscribe through the raw eventBus singleton (NOT this.apis, which can
        // be null at layout-build time before the module's initialize() runs —
        // same workaround procgenPipelineUI uses for rawJsonDataLoaded).
        const onLoad = () => {
            const next = consumePendingSession();
            if (next) { this._loadSession(next); this.render(); }
        };
        rawEventBus.subscribe(LOAD_EVENT, onLoad, 'bounceRegionEditor');
        this._unsub = () => rawEventBus.unsubscribe(LOAD_EVENT, onLoad, 'bounceRegionEditor');
        this.render();
    }

    get apis() { return BounceRegionEditorUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    onPanelShow() { this.render(); }
    onPanelResize() {}
    destroy() {
        if (this._unsub) { this._unsub(); this._unsub = null; }
        setPanelInstance(null);
    }

    // ── Session loading ─────────────────────────────────────────────────
    _loadSession({ region, contract, onSave }) {
        const level = deepClone(region?.playable_payload?.params?.bounceLevel ?? {});
        const c = contract ?? {};
        this._session = {
            region: region ?? null, // the live region (write-back base in _buildEditedRegion)
            level,
            contract: c,
            onSave: onSave ?? null,
            mode: onSave ? 'pipeline' : 'standalone',
            label: region?.region_id ?? 'region',
        };
        this._initSessionExtras(c);
        this._selectedId = null;
        this._message = this._session.mode === 'pipeline'
            ? `Editing ${this._session.label} (pipeline — Save writes back to 3).`
            : `Viewing ${this._session.label} (standalone).`;
    }

    _loadFixture(name) {
        const fixture = FIXTURES[name];
        if (!fixture) return;
        const contract = { physicsProfile: 'experimental' };
        this._session = {
            level: deepClone(fixture),
            contract,
            onSave: null,
            mode: 'standalone',
            label: name,
        };
        this._initSessionExtras(contract);
        this._selectedId = null;
        this._message = `Loaded fixture "${name}" (standalone).`;
    }

    // Derive the editor-only session extras from the contract: the world item
    // pool (per-pickup item picker), the generation-settings (seeded from the
    // region's actual params), and the default Regenerate mode (keep the
    // exit/location contract in pipeline; free in standalone). Also backfill
    // each level pickup's `item` from the contract's locationSpecs (the level
    // model itself doesn't store the item — it lives in extracted_rules).
    _initSessionExtras(contract) {
        const sess = this._session;
        sess.itemPool = (contract.itemPool && contract.itemPool.length)
            ? [...contract.itemPool]
            : [...Object.keys(BOUNCE_LIBRARY_ITEMS), 'Victory'];
        // Items the player is expected to already hold on entering this region
        // (from spheres before this region's wave). Authoring context only —
        // distinct from itemPool, which is what a pickup here can GRANT. An
        // empty array (e.g. a wave-0 start region) is meaningfully different
        // from null (no sphere context at all, e.g. standalone), so preserve it.
        sess.expectedItems = Array.isArray(contract.expectedItems)
            ? [...contract.expectedItems]
            : null;
        sess.settings = this._settingsFromParams(contract.regionParams ?? {}, contract);
        sess.regenMode = (contract.exitSpecs && contract.exitSpecs.length) ? 'keep' : 'free';
        const itemById = new Map((contract.locationSpecs ?? []).map((l) => [l.id, l.item]));
        for (const pk of sess.level.pickups ?? []) {
            if (pk.item == null && itemById.has(pk.id)) pk.item = itemById.get(pk.id);
        }
    }

    // Map the bounce regionParams (panel vocabulary) into the editor's
    // generation-settings (generateZoneForSpecs vocabulary). See buildZoneSpecs.
    _settingsFromParams(rp = {}, contract = {}) {
        const decor = rp.bounceDecorChance ?? {};
        return {
            seed: 1,
            physicsProfile: rp.physicsProfile ?? contract.physicsProfile ?? 'experimental',
            freeArrow: rp.bounceFreeArrow ?? contract.freeArrow ?? 'right',
            mode: (rp.bounceMode ?? contract.mode ?? 'braid') === 'braid' ? 'braid' : 'column',
            braidWidth: rp.braidWidth ?? 240,
            jitter: rp.bounceJitter ?? 0,
            platformRows: rp.platformRows ?? 0,
            decor: {
                blue: decor.blue ?? 0, brown: decor.brown ?? 0,
                spring: decor.spring ?? 0, jetpack: decor.jetpack ?? 0, fork: decor.fork ?? 0,
            },
        };
    }

    // ── Validation + rule derivation (for display) ──────────────────────
    _analyze(level, contract) {
        const errors = [
            ...validateLevel(level),
            ...braidBlueInvariantErrors(level),
        ];
        let ruleLines = [];
        try {
            // Derive under the editor's effective settings (seeded from the
            // contract, so initial display matches the generator).
            const s = this._session?.settings ?? {};
            const freeArrow = s.freeArrow ?? contract.freeArrow;
            const braid = (s.mode === 'braid') || !!(contract?.mode === 'braid') || !!freeArrow;
            const derived = braid
                ? deriveBraidAccessRules(level, { freeArrow })
                : deriveAccessRules(level);
            for (const [id, a] of Object.entries(derived.exits ?? {})) {
                ruleLines.push(`exit ${id}: ${formatRule(a.minimalSets)}`);
            }
            for (const [id, a] of Object.entries(derived.pickups ?? {})) {
                ruleLines.push(`pickup ${id}: ${formatRule(a.minimalSets)}`);
            }
            if (derived.defects?.length) {
                for (const d of derived.defects) errors.push(`derive: ${d}`);
            }
        } catch (err) {
            errors.push(`derive failed: ${err.message}`);
        }
        return { errors, ruleLines };
    }

    // ── Render ──────────────────────────────────────────────────────────
    render() {
        this.rootElement.innerHTML = '';
        const sess = this._session;
        if (!sess) {
            const hint = document.createElement('div');
            hint.className = 'bre-hint';
            hint.textContent = 'No level loaded.';
            this.rootElement.appendChild(hint);
            return;
        }

        this.rootElement.appendChild(this._renderToolbar(sess));
        if (this._message) {
            const msg = document.createElement('div');
            msg.className = 'bre-message';
            msg.textContent = this._message;
            this.rootElement.appendChild(msg);
        }

        const cols = document.createElement('div');
        cols.className = 'bre-cols';
        cols.appendChild(this._renderCanvas(sess));
        cols.appendChild(this._renderSidebar(sess));
        this.rootElement.appendChild(cols);
    }

    _renderToolbar(sess) {
        const bar = document.createElement('div');
        bar.className = 'bre-toolbar';

        const title = document.createElement('span');
        title.className = 'bre-title';
        title.textContent = `Bounce editor — ${sess.label} [${sess.mode}]`;
        bar.appendChild(title);

        // Fixture loader (standalone authoring).
        const sel = document.createElement('select');
        sel.title = 'Load a fixture level';
        const blank = document.createElement('option');
        blank.value = ''; blank.textContent = 'Load fixture…';
        sel.appendChild(blank);
        for (const name of Object.keys(FIXTURES)) {
            const o = document.createElement('option');
            o.value = name; o.textContent = name;
            sel.appendChild(o);
        }
        sel.addEventListener('change', () => {
            if (sel.value) { this._loadFixture(sel.value); this.render(); }
        });
        bar.appendChild(sel);

        // Export the current level as JSON (both modes).
        bar.appendChild(this._btn('Export level JSON', () => this._exportLevel()));

        // Save: pipeline write-back (chunk 5) or download in standalone.
        const save = this._btn('Save', () => this._save());
        save.title = sess.mode === 'pipeline'
            ? 'Write the edited region back into the pipeline (3)'
            : 'Export the level JSON (standalone)';
        bar.appendChild(save);
        return bar;
    }

    _renderCanvas(sess) {
        const wrap = document.createElement('div');
        wrap.className = 'bre-canvas-wrap';
        const level = sess.level;
        const constants = resolvePhysicsStamp(sess.contract?.physicsProfile ?? 'experimental');
        const scale = CANVAS_W / level.size.width;
        const canvas = document.createElement('canvas');
        canvas.className = 'bre-canvas';
        canvas.width = CANVAS_W;
        canvas.height = Math.max(1, Math.round(level.size.height * scale));
        renderLevel(canvas.getContext('2d'), level, {
            constants, scale, selectedId: this._selectedId,
        });
        // Click-to-select the nearest platform (no drag — selection + the
        // sidebar's numeric/button controls do the editing).
        canvas.style.cursor = 'pointer';
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const lx = (e.clientX - rect.left) * (canvas.width / rect.width) / scale;
            const ly = (e.clientY - rect.top) * (canvas.height / rect.height) / scale;
            const hit = this._hitTestPlatform(level, lx, ly, constants);
            this._selectedId = hit ? hit.id : null;
            this.render();
        });
        wrap.appendChild(canvas);
        return wrap;
    }

    // Nearest platform whose bar the click lands on (or closest within a
    // tolerance). Platforms are horizontal bars centred on (x, y).
    _hitTestPlatform(level, lx, ly, constants) {
        const halfW = (constants?.PLATFORM_WIDTH ?? 60) / 2 + 6;
        let best = null;
        let bestD = Infinity;
        for (const p of level.platforms ?? []) {
            const dx = Math.abs(p.x - lx);
            const dy = Math.abs(p.y - ly);
            if (dx > halfW || dy > 14) continue;
            const d = dx + dy;
            if (d < bestD) { bestD = d; best = p; }
        }
        return best;
    }

    _renderSidebar(sess) {
        const side = document.createElement('div');
        side.className = 'bre-sidebar';

        const { errors, ruleLines } = this._analyze(sess.level, sess.contract);

        const status = document.createElement('div');
        status.className = errors.length ? 'bre-status bre-bad' : 'bre-status bre-ok';
        status.textContent = errors.length
            ? `⚠ ${errors.length} issue(s)`
            : '✓ valid';
        side.appendChild(status);

        if (errors.length) {
            const ul = document.createElement('div');
            ul.className = 'bre-errors';
            ul.textContent = errors.slice(0, 12).join(' · ');
            side.appendChild(ul);
        }

        const counts = document.createElement('div');
        counts.className = 'bre-counts';
        const l = sess.level;
        counts.textContent = `${(l.platforms ?? []).length} platforms · `
            + `${(l.pickups ?? []).length} pickups · ${(l.portals ?? []).length} portals · `
            + `${(l.springs ?? []).length}S/${(l.jetpacks ?? []).length}J/`
            + `${(l.teleports ?? []).length}⟲ · ${l.size.width}×${l.size.height}`;
        side.appendChild(counts);

        // Authoring context: items the player is expected to already hold on
        // entering this region (from earlier spheres). Read-only; informs
        // difficulty/traversal design. Deduped for display (count gates repeat).
        // Shown whenever sphere context exists — including '(none)' for a wave-0
        // start region — but hidden entirely when there's no context (null).
        if (sess.expectedItems != null) {
            const expected = [...new Set(sess.expectedItems)];
            const exp = document.createElement('div');
            exp.className = 'bre-expected';
            exp.textContent = `Expected on entry: ${expected.length ? expected.join(', ') : '(none)'}`;
            exp.title = 'Items the player is expected to hold when this region '
                + 'first becomes accessible (placed in earlier spheres).';
            side.appendChild(exp);
        }

        side.appendChild(this._renderGlobalEdit(sess.level));
        side.appendChild(this._renderPlatformEdit(sess.level));
        side.appendChild(this._renderGenSettings(sess));

        const rules = document.createElement('div');
        rules.className = 'bre-rules';
        const rh = document.createElement('div');
        rh.className = 'bre-subhead';
        rh.textContent = 'Derived access rules';
        rules.appendChild(rh);
        for (const line of ruleLines) {
            const r = document.createElement('div');
            r.className = 'bre-rule';
            r.textContent = line;
            rules.appendChild(r);
        }
        if (ruleLines.length === 0) {
            const r = document.createElement('div');
            r.className = 'bre-rule';
            r.textContent = '(none)';
            rules.appendChild(r);
        }
        side.appendChild(rules);
        return side;
    }

    // ── Actions ─────────────────────────────────────────────────────────
    _exportLevel() {
        const json = JSON.stringify(this._session.level, null, 2);
        this._download(`${this._session.label}.level.json`, json);
        this._message = 'Exported level JSON.';
        this.render();
    }

    // Save. Pipeline mode: re-assemble the region from the edited level (same
    // rule-emission the generator runs) and hand it back via onSave, which
    // splices it into the grid + invalidates 4 (the oracle is the backstop).
    // Standalone: export the level JSON.
    _save() {
        const sess = this._session;
        if (sess.mode === 'pipeline' && sess.onSave) {
            try {
                const edited = this._buildEditedRegion();
                sess.onSave(edited);
                this._message = `Saved ${sess.label} back to the pipeline. Re-run 4 to recheck.`;
            } catch (err) {
                this._message = `Save failed (contract): ${err.message}`;
            }
            this.render();
            return;
        }
        this._exportLevel();
    }

    // Merge re-emitted rules from the edited level into a clone of the original
    // region, preserving the grid-level wiring (exit ids/sides/targets,
    // exits_placed, the back-exit, placed_items). Access rules live only in
    // extracted_rules, so the structural exits Map is left untouched. Forward
    // exits map to sides via exits_placed; the driver back-exit (not placed) is
    // left alone. The EXITS keep the contract (their gates aren't editable
    // here); the LOCATIONS come from the edited level's pickups so item picks +
    // add/remove flow through (an off-plan item is the oracle's to flag).
    _buildEditedRegion() {
        const { region, contract, level } = this._session;
        const locationSpecs = (level.pickups ?? []).map((pk) => ({
            id: pk.id, item: pk.item ?? null, requirement: [], counts: {},
        }));
        const s = this._session.settings ?? {};
        const built = assembleBounceRegionFromLevel(level, {
            region_id: region.region_id,
            exitSpecs: contract.exitSpecs ?? [],
            locationSpecs,
            physicsProfile: s.physicsProfile ?? contract.physicsProfile ?? 'experimental',
            mode: s.mode ?? contract.mode ?? 'column',
            freeArrow: s.freeArrow ?? contract.freeArrow ?? 'right',
        });
        const next = deepClone(region);
        next.playable_payload = built.payload;
        next.obstacle_defs = built.obstacleDefs;

        const sideByExitId = new Map(
            (region.exits_placed ?? []).map((p) => [p.exit_id, p.side]));
        for (const ex of next.extracted_rules?.exits ?? []) {
            const side = sideByExitId.get(ex.id);
            if (side && built.exitPaths[side]) {
                ex.paths = built.exitPaths[side];
                ex.access_rule = built.exitRules[side];
            }
        }
        // built.locations is one-per-edited-pickup (id + chosen item + paths +
        // access_rule) — replace the region's locations wholesale so item edits,
        // additions and removals all take effect.
        if (next.extracted_rules) next.extracted_rules.locations = built.locations;
        return next;
    }

    _download(filename, text) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }

    _btn(label, onClick) {
        const b = document.createElement('button');
        b.className = 'bre-btn';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }

    _numField(label, value, onChange, { step = 10, min = 0 } = {}) {
        const row = document.createElement('label');
        row.className = 'bre-field';
        const span = document.createElement('span');
        span.textContent = label;
        row.appendChild(span);
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = String(value);
        inp.step = String(step);
        inp.min = String(min);
        inp.addEventListener('change', () => {
            const v = Number(inp.value);
            if (Number.isFinite(v)) onChange(v);
        });
        row.appendChild(inp);
        return row;
    }

    _selectField(label, value, options, onChange) {
        const row = document.createElement('label');
        row.className = 'bre-field';
        const span = document.createElement('span');
        span.textContent = label;
        row.appendChild(span);
        const sel = document.createElement('select');
        for (const opt of options) {
            const o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            if (opt === value) o.selected = true;
            sel.appendChild(o);
        }
        sel.addEventListener('change', () => onChange(sel.value));
        row.appendChild(sel);
        return row;
    }

    // ── Region generation settings + Regenerate ─────────────────────────
    // A collapsible section: the bounce generation params (seeded from the
    // region's actual params) + a Regenerate button. Field edits stage into
    // sess.settings WITHOUT re-rendering (so editing several fields keeps
    // focus); Regenerate applies them. Regen mode toggles whether the region's
    // exit/location contract is preserved (keep — pipeline default, oracle-safe)
    // or rebuilt from the current level (free — standalone default).
    _renderGenSettings(sess) {
        const block = document.createElement('div');
        block.className = 'bre-edit-block';
        const h = document.createElement('div');
        h.className = 'bre-subhead bre-collapsible';
        h.textContent = `${this._settingsOpen ? '▾' : '▸'} Region generation`;
        h.addEventListener('click', () => { this._settingsOpen = !this._settingsOpen; this.render(); });
        block.appendChild(h);
        if (!this._settingsOpen) return block;

        const s = sess.settings;
        block.appendChild(this._numField('seed', s.seed, (v) => { s.seed = Math.round(v); }, { step: 1 }));
        block.appendChild(this._selectField('physics', s.physicsProfile,
            ['dj', 'experimental'], (v) => { s.physicsProfile = v; }));
        block.appendChild(this._selectField('free arrow', s.freeArrow,
            ['right', 'left'], (v) => { s.freeArrow = v; }));
        block.appendChild(this._selectField('mode', s.mode,
            ['braid', 'column'], (v) => { s.mode = v; }));
        block.appendChild(this._numField('braid width', s.braidWidth,
            (v) => { s.braidWidth = Math.max(1, Math.round(v)); }, { step: 10, min: 1 }));
        block.appendChild(this._numField('jitter', s.jitter,
            (v) => { s.jitter = Math.max(0, Math.round(v)); }, { step: 5 }));
        block.appendChild(this._numField('platform rows', s.platformRows,
            (v) => { s.platformRows = Math.max(0, Math.round(v)); }, { step: 1 }));
        for (const k of ['blue', 'brown', 'spring', 'jetpack', 'fork']) {
            block.appendChild(this._numField(`decor ${k}`, s.decor[k],
                (v) => { s.decor[k] = Math.max(0, Math.min(1, v)); }, { step: 0.1, min: 0 }));
        }

        const hasContract = !!(sess.contract.exitSpecs && sess.contract.exitSpecs.length);
        block.appendChild(this._selectField('regen mode', sess.regenMode,
            hasContract ? ['keep', 'free'] : ['free'], (v) => { sess.regenMode = v; }));
        block.appendChild(this._btn('Regenerate 🎲', () => this._regenerate()));
        return block;
    }

    // Rebuild the level geometry from the staged settings. keep → reuse the
    // region's exit/location contract (oracle-safe); free → derive specs from
    // the current level's portals + pickups (exploratory; may change structure).
    _regenerate() {
        const sess = this._session;
        const s = sess.settings;
        const keep = sess.regenMode === 'keep' && sess.contract.exitSpecs?.length;
        let exitSpecs;
        let locationSpecs;
        if (keep) {
            exitSpecs = sess.contract.exitSpecs;
            locationSpecs = (sess.contract.locationSpecs ?? []).map((l) => ({ ...l }));
        } else {
            exitSpecs = this._specsFromLevelPortals(sess.level);
            locationSpecs = (sess.level.pickups ?? []).map((pk) => ({
                id: pk.id, item: pk.item ?? null, requirement: [], counts: {},
            }));
        }
        try {
            const built = generateZoneForSpecs({
                region_id: sess.label,
                exitSpecs,
                locationSpecs,
                seed: s.seed,
                mode: s.mode,
                braidWidth: s.braidWidth,
                jitter: s.jitter,
                decorChance: s.decor,
                freeArrow: s.freeArrow,
                platformRows: s.platformRows,
                physicsProfile: s.physicsProfile,
            });
            const level = built.payload.params.bounceLevel;
            // The generated level's pickups carry no item — backfill from specs.
            const itemById = new Map(locationSpecs.map((l) => [l.id, l.item]));
            for (const pk of level.pickups ?? []) {
                if (itemById.has(pk.id)) pk.item = itemById.get(pk.id);
            }
            sess.level = level;
            this._selectedId = null;
            this._message = `Regenerated (seed ${s.seed}, ${keep ? 'kept contract' : 'free'}).`;
        } catch (err) {
            this._message = `Regenerate failed: ${err.message}`;
        }
        this.render();
    }

    // Derive exit specs from a level's portals for free-mode regenerate: the
    // side comes from a `side_exit_<side>` id, else from the portal direction,
    // else the first free side. Deduped to the 4 grid sides.
    _specsFromLevelPortals(level) {
        const DIR_TO_SIDE = { up: 'N', down: 'S', right: 'E', left: 'W' };
        const ALL = ['N', 'S', 'E', 'W'];
        const used = new Set();
        const specs = [];
        for (const p of level.portals ?? []) {
            let side = null;
            const m = /^side_exit_([NSEW])$/.exec(p.id || '');
            if (m) side = m[1];
            else if (p.direction && DIR_TO_SIDE[p.direction]) side = DIR_TO_SIDE[p.direction];
            if (!side || used.has(side)) side = ALL.find((x) => !used.has(x)) ?? null;
            if (!side) continue;
            used.add(side);
            specs.push({ side, requirement: [], counts: {} });
        }
        return specs;
    }

    // ── Edit controls ───────────────────────────────────────────────────
    _renderGlobalEdit(level) {
        const block = document.createElement('div');
        block.className = 'bre-edit-block';
        const h = document.createElement('div');
        h.className = 'bre-subhead';
        h.textContent = 'Level';
        block.appendChild(h);
        block.appendChild(this._numField('width', level.size.width,
            (v) => this._resizeLevel('width', v), { step: 10, min: 1 }));
        block.appendChild(this._numField('height', level.size.height,
            (v) => this._resizeLevel('height', v), { step: 10, min: 1 }));
        block.appendChild(this._btn('+ platform', () => this._addPlatform()));
        return block;
    }

    _renderPlatformEdit(level) {
        const block = document.createElement('div');
        block.className = 'bre-edit-block';
        const h = document.createElement('div');
        h.className = 'bre-subhead';
        h.textContent = 'Platform';
        block.appendChild(h);

        const p = (level.platforms ?? []).find((x) => x.id === this._selectedId);
        if (!p) {
            const hint = document.createElement('div');
            hint.className = 'bre-counts';
            hint.textContent = 'Click a platform to edit it.';
            block.appendChild(hint);
            return block;
        }

        const idline = document.createElement('div');
        idline.className = 'bre-counts';
        idline.textContent = `selected: ${p.id}`;
        block.appendChild(idline);

        block.appendChild(this._numField('x', p.x, (v) => this._setPlatform(p.id, { x: v })));
        block.appendChild(this._numField('y', p.y, (v) => this._setPlatform(p.id, { y: v })));

        // type
        const typeRow = document.createElement('label');
        typeRow.className = 'bre-field';
        const ts = document.createElement('span'); ts.textContent = 'type';
        typeRow.appendChild(ts);
        const typeSel = document.createElement('select');
        for (const t of ['green', 'blue', 'brown']) {
            const o = document.createElement('option');
            o.value = t; o.textContent = t;
            if (p.type === t) o.selected = true;
            typeSel.appendChild(o);
        }
        typeSel.addEventListener('change', () => this._setPlatform(p.id, { type: typeSel.value }));
        typeRow.appendChild(typeSel);
        block.appendChild(typeRow);

        // entity toggles (host = this platform)
        const toggles = document.createElement('div');
        toggles.className = 'bre-toggles';
        for (const kind of ['springs', 'jetpacks', 'pickups', 'portals', 'teleports']) {
            const on = (level[kind] ?? []).some((e) => e.on === p.id);
            const b = this._btn(`${on ? '✓ ' : '+ '}${kind.replace(/s$/, '')}`,
                () => this._toggleEntity(p.id, kind));
            if (on) b.classList.add('bre-on');
            toggles.appendChild(b);
        }
        block.appendChild(toggles);

        // pickup item (when this platform hosts a pickup): choose which item
        // the location grants, from the world item pool.
        const pickup = (level.pickups ?? []).find((e) => e.on === p.id);
        if (pickup) {
            const iRow = document.createElement('label');
            iRow.className = 'bre-field';
            const is = document.createElement('span'); is.textContent = 'pickup item';
            iRow.appendChild(is);
            const iSel = document.createElement('select');
            const pool = this._session.itemPool ?? [];
            const held = new Set(this._session.expectedItems ?? []);
            const opts = [...pool];
            // Keep the current item selectable even if it's not in the pool.
            if (pickup.item && !opts.includes(pickup.item)) opts.unshift(pickup.item);
            if (!opts.length) opts.push('(none)');
            const addOption = (parent, item) => {
                const o = document.createElement('option');
                o.value = item; o.textContent = item;
                if (pickup.item === item) o.selected = true;
                parent.appendChild(o);
            };
            // Split the pool into items the player is expected to already hold
            // (granting them again here is redundant) vs. the rest, so the
            // author sees that distinction. Group whenever sphere context exists
            // — including a wave-0 region, where everything is 'grantable' and
            // only that one category shows. Flat list when there's no context.
            if (Array.isArray(this._session.expectedItems)) {
                const heldOpts = opts.filter((it) => held.has(it));
                const freeOpts = opts.filter((it) => !held.has(it));
                if (heldOpts.length) {
                    const g1 = document.createElement('optgroup'); g1.label = 'already held';
                    heldOpts.forEach((it) => addOption(g1, it));
                    iSel.appendChild(g1);
                }
                if (freeOpts.length) {
                    const g2 = document.createElement('optgroup'); g2.label = 'grantable';
                    freeOpts.forEach((it) => addOption(g2, it));
                    iSel.appendChild(g2);
                }
            } else {
                opts.forEach((it) => addOption(iSel, it));
            }
            iSel.addEventListener('change', () => {
                pickup.item = iSel.value === '(none)' ? null : iSel.value;
                this.render();
            });
            iRow.appendChild(iSel);
            block.appendChild(iRow);
        }

        // portal direction (when this platform hosts a portal)
        const portal = (level.portals ?? []).find((e) => e.on === p.id);
        if (portal) {
            const dRow = document.createElement('label');
            dRow.className = 'bre-field';
            const ds = document.createElement('span'); ds.textContent = 'portal dir';
            dRow.appendChild(ds);
            const dSel = document.createElement('select');
            for (const d of ['up', 'down', 'left', 'right']) {
                const o = document.createElement('option');
                o.value = d; o.textContent = d;
                if ((portal.direction ?? 'up') === d) o.selected = true;
                dSel.appendChild(o);
            }
            dSel.addEventListener('change', () => {
                portal.direction = dSel.value;
                this.render();
            });
            dRow.appendChild(dSel);
            block.appendChild(dRow);
        }

        block.appendChild(this._btn('Delete platform', () => this._deletePlatform(p.id)));
        return block;
    }

    // ── Edit operations (mutate this._session.level, then re-render — live
    // validation re-runs in _renderSidebar) ────────────────────────────
    _resizeLevel(dim, value) {
        this._session.level.size[dim] = Math.max(1, Math.round(value));
        this.render();
    }

    _addPlatform() {
        const level = this._session.level;
        level.platforms = level.platforms ?? [];
        const id = this._nextId('p', level.platforms);
        level.platforms.push({
            id, type: 'green',
            x: Math.round(level.size.width / 2),
            y: Math.round(level.size.height / 2),
        });
        this._selectedId = id;
        this.render();
    }

    _setPlatform(id, patch) {
        const p = (this._session.level.platforms ?? []).find((x) => x.id === id);
        if (!p) return;
        Object.assign(p, patch);
        this.render();
    }

    _deletePlatform(id) {
        const level = this._session.level;
        level.platforms = (level.platforms ?? []).filter((p) => p.id !== id);
        // Drop entities orphaned by the deletion (their host is gone).
        for (const kind of ['springs', 'jetpacks', 'pickups', 'portals', 'teleports']) {
            if (Array.isArray(level[kind])) {
                level[kind] = level[kind].filter((e) => e.on !== id);
            }
        }
        if (this._selectedId === id) this._selectedId = null;
        this.render();
    }

    // Add/remove an entity of `kind` hosted on platform `hostId`.
    _toggleEntity(hostId, kind) {
        const level = this._session.level;
        const host = (level.platforms ?? []).find((p) => p.id === hostId);
        if (!host) return;
        level[kind] = level[kind] ?? [];
        const existing = level[kind].findIndex((e) => e.on === hostId);
        if (existing >= 0) {
            level[kind].splice(existing, 1);
        } else {
            const prefix = kind === 'pickups' ? 'loc' : kind.replace(/s$/, '');
            const entity = {
                id: this._nextId(prefix, level[kind]),
                x: host.x, y: host.y, on: hostId,
            };
            if (kind === 'portals') entity.direction = 'up';
            // A pickup grants an item: default to the first world-pool item so
            // the location is meaningful (the user picks the exact item below).
            if (kind === 'pickups') entity.item = (this._session.itemPool ?? [])[0] ?? null;
            level[kind].push(entity);
        }
        this.render();
    }

    // First free `${prefix}N` id not already used in `list`.
    _nextId(prefix, list) {
        const used = new Set((list ?? []).map((e) => e.id));
        let n = 0;
        while (used.has(`${prefix}${n}`) || used.has(`${prefix}_${n}`)) n++;
        return prefix === 'loc' ? `loc_${n}` : `${prefix}${n}`;
    }
}

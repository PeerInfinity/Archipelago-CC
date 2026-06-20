/**
 * Bounce region editor — Golden Layout panel.
 *
 * Edits ONE bounce region's geometry (its level.js level) in two modes:
 *   - pipeline: opened by the procgen panel's ③ Edit ▸ with a live region +
 *     a write-back hook (onSave). Saving re-assembles the region and splices
 *     it back into the grid (chunk 5).
 *   - standalone: opened directly (no onSave). Loads a fixture / file / blank
 *     level, edits, and exports a level JSON.
 *
 * The edit surface is the same in both modes; only the data source/sink
 * differs. v1 is click/button driven (NO drag — consistent with the rest of
 * the procgen panel). Access rules are DERIVED for display, never stored.
 */
import { renderLevel } from './levelRenderer.js';
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

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'bounce-region-editor-panel';
        setPanelInstance(this);

        // Pick up a pending pipeline session if Edit ▸ opened us; otherwise
        // boot standalone with a fixture so the panel is never empty.
        const pending = consumePendingSession();
        if (pending) this._loadSession(pending);
        else this._loadFixture('bounceStack');

        // Re-render when a (later) Edit ▸ launch publishes a new session.
        const onLoad = () => {
            const next = consumePendingSession();
            if (next) { this._loadSession(next); this.render(); }
        };
        const bus = this.apis.eventBus;
        if (bus) {
            bus.subscribe(LOAD_EVENT, onLoad, 'bounceRegionEditor');
            this._unsub = () => bus.unsubscribe(LOAD_EVENT, onLoad, 'bounceRegionEditor');
        }
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
        this._session = {
            level,
            contract: contract ?? {},
            onSave: onSave ?? null,
            mode: onSave ? 'pipeline' : 'standalone',
            label: region?.region_id ?? 'region',
        };
        this._selectedId = null;
        this._message = this._session.mode === 'pipeline'
            ? `Editing ${this._session.label} (pipeline — Save writes back to ③).`
            : `Viewing ${this._session.label} (standalone).`;
    }

    _loadFixture(name) {
        const fixture = FIXTURES[name];
        if (!fixture) return;
        this._session = {
            level: deepClone(fixture),
            contract: { physicsProfile: 'experimental' },
            onSave: null,
            mode: 'standalone',
            label: name,
        };
        this._selectedId = null;
        this._message = `Loaded fixture "${name}" (standalone).`;
    }

    // ── Validation + rule derivation (for display) ──────────────────────
    _analyze(level, contract) {
        const errors = [
            ...validateLevel(level),
            ...braidBlueInvariantErrors(level),
        ];
        let ruleLines = [];
        try {
            const braid = !!(contract?.freeArrow || contract?.mode === 'braid');
            const derived = braid
                ? deriveBraidAccessRules(level, { freeArrow: contract.freeArrow })
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
            ? 'Write the edited region back into the pipeline (③)'
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

        side.appendChild(this._renderGlobalEdit(sess.level));
        side.appendChild(this._renderPlatformEdit(sess.level));

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

    // Save: pipeline write-back is wired in chunk 5 (assembleBounceRegionFromLevel
    // + onSave). For now standalone export; pipeline mode notes the pending wiring.
    _save() {
        if (this._session.mode === 'pipeline' && this._session.onSave) {
            this._message = 'Pipeline save wiring lands in the next step.';
            this.render();
            return;
        }
        this._exportLevel();
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

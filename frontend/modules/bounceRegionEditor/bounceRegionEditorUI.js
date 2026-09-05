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
 *
 * ── ⛓⛓⛓ THE DOCUMENT IS AN `editCore` SESSION (EDITOR INTEGRATION B-b) ──
 *
 * Every mutator here routes through `session.apply(op)` over
 * `bounceEditAdapter`, so the level is `base + ops` and UNDO is the fold over
 * a shorter list. `_session.level` is a GETTER over `session.record()` — every
 * reader of it (`_renderCanvas`, `_hitTestPlatform`, `_exportLevel`,
 * `_specsFromLevelPortals`, `_analyze`, `_renderSidebar`'s counts) is
 * unchanged, and an assignment to it now THROWS, which is the guard that keeps
 * a ninth mutator from writing the record in place where undo cannot see it.
 *
 * ⛔ **THE GENERATION SETTINGS ARE NOT DOCUMENT EDITS.** `sess.settings`
 * (seed, physicsProfile, mode, freeArrow, braidWidth, jitter, platformRows,
 * decor) and `sess.regenMode` stay on the PANEL: they are inputs to
 * `buildEditedRegion` and to Regenerate — how the rules are DERIVED from a
 * level, not what the level is. An undo does not touch them, and it should
 * not: undoing a platform must not silently restore a physics profile the
 * person changed on purpose.
 *
 * ⛔ **AND `editorView` IS NOT MOUNTED.** The canvas keeps its own click
 * listener because a bounce level has no cell space at all — platforms live at
 * FLOAT pixel centres and `editorView.js`'s cell reader discards a non-integer
 * cell BY NAME. That refusal is the measured reason `editCore` gained its
 * no-cell-space widening, and `mountEditorView` now refuses this adapter by
 * name rather than mounting a view whose every tool would die on first press.
 */
import rawEventBus from '../../app/core/eventBus.js';
import { renderLevel } from './levelRenderer.js';
import {
    generateZoneForSpecs, BOUNCE_LIBRARY_ITEMS,
} from '../bounceDemo/bounceDemoLibrary.js';
import { validateLevel, braidBlueInvariantErrors } from '../bounceDemo/level.js';
import {
    deriveAccessRules, deriveBraidAccessRules, formatRule,
} from '../bounceDemo/deriveRules.js';
import { resolvePhysicsStamp } from '../bounceDemo/physics.js';
import { portalSide } from '../bounceDemo/sideExits.js';
import { bounceStack } from '../bounceDemo/fixtures/bounceStack.js';
import { easyTower } from '../bounceDemo/fixtures/easyTower.js';
import { springGap } from '../bounceDemo/fixtures/springGap.js';
import { fork } from '../bounceDemo/fixtures/fork.js';
import { fillerClimb } from '../bounceDemo/fixtures/fillerClimb.js';
import {
    getModuleApis, setPanelInstance, consumePendingSession, LOAD_EVENT,
    openRegionInApworldEditor,
} from './index.js';
import { createEditSession, describeOps, group } from '../procgenCore/editCore.js';
import { bounceEditAdapter } from './bounceEditAdapter.js';
import { deletePlatformOps, ENTITY_KINDS } from './bounceLevelOps.js';
import { buildEditedRegion } from './buildEditedRegion.js';

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

/**
 * ⛓ **THE PICKUP-ITEM BACKFILL IS PART OF THE BASE, NOT AN EDIT.** The level
 * model does not store which item a location grants — it lives in
 * `extracted_rules` and reaches the editor through the contract's
 * `locationSpecs`. ⛔ Doing it as an op would put a fact the person never
 * typed into `payload().edits`, and undoing back to zero would leave a level
 * whose pickups grant nothing.
 */
function backfillPickupItems(level, contract) {
    const itemById = new Map((contract.locationSpecs ?? []).map((l) => [l.id, l.item]));
    for (const pk of level.pickups ?? []) {
        if (pk.item == null && itemById.has(pk.id)) pk.item = itemById.get(pk.id);
    }
    return level;
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
        /**
         * ⛓⛓ **THE ROOT IS FOCUSABLE, AND SOMETHING HAS TO GIVE IT FOCUS**
         * (B-a's precedent, trap 874). A key binding on a panel root is
         * unreachable until the root is in the focus chain, and `tabIndex = -1`
         * alone does not put it there — so the canvas click below takes focus
         * as well as selecting, which is the gesture a person makes anyway
         * before wanting to undo it.
         */
        this.rootElement.tabIndex = -1;
        this.rootElement.addEventListener('keydown', (e) => this._onKeyDown(e));
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
        backfillPickupItems(level, c);
        this._openSession(level, {
            region: region ?? null, // the live region (write-back base in _buildEditedRegion)
            contract: c,
            onSave: onSave ?? null,
            mode: onSave ? 'pipeline' : 'standalone',
            label: region?.region_id ?? 'region',
        }, { kind: 'bounce-level', region_id: region?.region_id ?? null });
        this._message = this._session.mode === 'pipeline'
            ? `Editing ${this._session.label} (pipeline — Save writes back to 3).`
            : `Viewing ${this._session.label} (standalone).`;
    }

    _loadFixture(name) {
        const fixture = FIXTURES[name];
        if (!fixture) return;
        const contract = { physicsProfile: 'experimental' };
        const level = deepClone(fixture);
        backfillPickupItems(level, contract);
        this._openSession(level, {
            region: null,
            contract,
            onSave: null,
            mode: 'standalone',
            label: name,
        }, { kind: 'bounce-fixture', fixture: name });
        this._message = `Loaded fixture "${name}" (standalone).`;
    }

    /**
     * ⛓⛓⛓ **ONE PLACE OPENS A SESSION.** The base record is `level`, already
     * backfilled; the base TAG is the opaque `{kind, …}` the payload carries
     * and `editCore` never interprets.
     *
     * ⛔ `level` is a GETTER with no setter, so `sess.level = x` THROWS in a
     * module's strict mode. That is not decoration: `_regenerate` used to
     * assign it, and a mutator that still did would be writing a record undo
     * re-folds away — a bug with no visible cause until the first undo.
     */
    _openSession(level, spec, baseTag) {
        this._edit = createEditSession(bounceEditAdapter, level, { base: baseTag });
        const sess = { ...spec };
        Object.defineProperty(sess, 'level', {
            get: () => this._edit.record(),
            enumerable: true,
        });
        this._session = sess;
        this._initSessionExtras(spec.contract ?? {});
        this._selectedId = null;
    }

    /**
     * ⛓ ONE OP → the session → a re-render. ⛔ The THREE outcomes are told
     * apart by name, exactly as `editCore` reports them: a refusal prints the
     * substrate's own sentence, a no-op says so rather than claiming an edit,
     * and only an applied op moves the readout.
     */
    _applyOp(op, { message = null, select = undefined } = {}) {
        const res = this._edit.apply(op);
        if (!res.ok) {
            this._message = `Refused: ${res.description}`;
        } else if (!res.applied) {
            this._message = `No change (${res.description}).`;
        } else {
            this._message = message ? message(res) : res.description;
            if (select !== undefined) {
                this._selectedId = typeof select === 'function' ? select(res) : select;
            }
        }
        this._resolveSelection();
        this.render();
        return res;
    }

    /**
     * ⛓⛓⛓ **THE DERIVED-STATE SWEEP (§14.10 #3), AND WHAT IT ACTUALLY FOUND.**
     *
     * `_selectedId` is the ONLY panel state that points back at the document —
     * after undoing an `add-platform` it names a platform that no longer
     * exists. ⛔ **AND THAT STALE ID IS INVISIBLE, MEASURED.** Every reader of
     * it resolves by `find(x => x.id === this._selectedId)`, so a stale id
     * renders exactly as no selection: the sidebar falls back to *"Click a
     * platform to edit it."* either way. The browser mutant that made this
     * method a no-op came back **GREEN** for that reason, and the row it was
     * meant to red is a row about the sidebar's fallback rather than about
     * this guard.
     *
     * ⇒ THE SWEEP FOUND NO LIVE DEFECT, and this is a PROPHYLACTIC invariant
     * rather than a fix: *`_selectedId` names a platform the level holds, or
     * nothing.* It is worth keeping because the thing a stale id could still
     * do is re-attach silently — `nextId` reissues a freed `pN`, so a stale
     * `p10` would become a selection of a DIFFERENT platform the moment one is
     * created with that id — and because the invariant is one line where every
     * future reader of the selection would otherwise owe a `find`.
     *
     * ⚠ Everything else the panel derives is rebuilt per render from
     * `sess.level` (the counts, the rule lines, the toggles, the item and
     * direction pickers) or by `buildEditedRegion` from the level on save
     * (`sidePortals`, `exits_placed`, `extracted_rules`). No stale copy
     * survives an undo because none is kept.
     */
    _resolveSelection() {
        if (this._selectedId == null) return;
        const level = this._session?.level;
        if (!(level?.platforms ?? []).some((p) => p.id === this._selectedId)) {
            this._selectedId = null;
        }
    }

    /**
     * ⛓⛓ **Ctrl/Cmd+Z, AND IT REFUSES INSIDE AN INPUT.** ⛔ The sidebar is
     * built out of number fields and selects, and a browser's own undo inside
     * one of them is what a person means by ⌘Z while their cursor is in it.
     * Stealing it would make a half-typed `width` un-retractable and would
     * undo a document edit the person was not looking at.
     */
    _onKeyDown(e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        if ((e.key ?? '').toLowerCase() !== 'z') return;
        const t = e.target;
        if (t && typeof t.closest === 'function' && t.closest('input, select, textarea')) return;
        e.preventDefault();
        this._undo();
    }

    /** ⛓ UNDO — the fold over a shorter list. `false` at zero ops, so the
     *  button can be pressed and the readout cannot claim an undo that did not
     *  happen. */
    _undo() {
        if (!this._edit || !this._edit.undo()) {
            this._message = 'Nothing to undo.';
        } else {
            this._message = `Undone — ${describeOps(this._edit.ops())} left.`;
        }
        this._resolveSelection();
        this.render();
    }

    // Derive the editor-only session extras from the contract: the world item
    // pool (per-pickup item picker), the generation-settings (seeded from the
    // region's actual params), and the default Regenerate mode (keep the
    // exit/location contract in pipeline; free in standalone). The pickup-item
    // backfill is NOT here: it is part of the base record, applied before the
    // session opens (see `backfillPickupItems`).
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
        // ⛔ NOT document edits — see the file header. An undo leaves them alone.
        sess.settings = this._settingsFromParams(contract.regionParams ?? {}, contract);
        sess.regenMode = (contract.exitSpecs && contract.exitSpecs.length) ? 'keep' : 'free';
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

        /**
         * ⛓⛓⛓ **UNDO** — `describeOps` is the core's own readout, so the count
         * is of TOP-LEVEL ops: a delete cascade of three reads as ONE edit,
         * which is what undo is a count of.
         */
        const ops = this._edit ? this._edit.ops() : [];
        const undo = this._btn(`↶ Undo (${describeOps(ops)})`, () => this._undo());
        undo.className = 'bre-btn bre-undo';
        undo.disabled = ops.length === 0;
        undo.title = 'Undo the last edit (Ctrl/Cmd+Z) — the level is re-folded from '
            + 'the base, so it is byte-identical to one that never had that edit';
        bar.appendChild(undo);

        // Export the current level as JSON (both modes).
        bar.appendChild(this._btn('Export level JSON', () => this._exportLevel()));

        // Save: pipeline write-back (chunk 5) or download in standalone.
        const save = this._btn('Save', () => this._save());
        save.title = sess.mode === 'pipeline'
            ? 'Write the edited region back into the pipeline (3)'
            : 'Export the level JSON (standalone)';
        bar.appendChild(save);

        /**
         * ⛓⛓⛓ APWORLD EDITOR HUB, H4c — **THE REVERSE LINK** (plan §3 idea 6).
         *
         * ⛔ **ONLY WHEN THIS SESSION IS ON A REAL REGION.** A FIXTURE has a
         * label (`bounceStack`) and no `region_id`, and no document anywhere
         * holds a region by that name — a button offered there would raise the
         * hub and hand it a name it can only refuse. `sess.region?.region_id`
         * is the one test, and it is the same field the write-back keys on.
         *
         * ⛓ IT CARRIES NO DOCUMENT AND NO LEVEL. The hub already holds a
         * rules.json; this says *"look at this region of it"*. A link that
         * pushed a document would replace whatever the reader was editing —
         * and the level in front of this panel is a WORKING COPY that has not
         * been saved back yet, so pushing it would also publish edits nobody
         * committed.
         */
        const regionId = sess.region?.region_id ?? null;
        if (regionId) {
            const open = this._btn('Open in APWorld Editor', () => this._openInApworldEditor());
            open.title = `Raise the APWorld Editor and select region "${regionId}" in it. `
                + 'The hub keeps its own document — nothing from this panel is sent.';
            bar.appendChild(open);
        }
        return bar;
    }

    /**
     * ⛓ TWO EVENTS, the app's own pair: name the region, then raise the panel.
     * ⛔ In that order — reversed, the hub would come forward showing whatever
     * it was showing before and jump a frame later.
     *
     * ⚠ NO `player`. This editor is opened on ONE region and does not carry the
     * slot it came from; `null` means *"whichever slot the hub is showing"*,
     * which is a smaller claim than a guess would be.
     */
    _openInApworldEditor() {
        const regionId = this._session?.region?.region_id ?? null;
        if (!regionId) {
            this._message = 'No region to open — this is a fixture, not a document\'s region.';
            this.render();
            return;
        }
        this._message = openRegionInApworldEditor(regionId)
            ? `Opened ${regionId} in the APWorld Editor.`
            : `Could not open ${regionId} — this module has not been initialized, so it has `
              + 'no bus to publish on.';
        this.render();
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
            // ⛓ trap 874 — the root must HOLD focus for its key binding to be
            //   reachable; `tabIndex = -1` alone does not put it in the chain.
            this.rootElement.focus({ preventScroll: true });
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

    /**
     * ⛓⛓⛓ **THE SAVE MERGE IS AN IMPORT** (EDITOR INTEGRATION B-b). The body
     * moved to `buildEditedRegion.js` because
     * `scripts/procgen/check-region-step-editing.mjs` held a COPY of it, and
     * that verifier's byte-shaped Phases were pinning the copy rather than
     * this file. Both callers import the one body now.
     *
     * ⚠ `settings` are handed in because they are the panel's, not the
     * document's: they change how the rules are DERIVED, not what the level
     * is, and the verifier (which has none) reproduces the contract's own
     * values exactly.
     */
    _buildEditedRegion() {
        const { region, contract, level, settings } = this._session;
        return buildEditedRegion({ region, contract, level, settings });
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
            /**
             * ⛓⛓⛓ **ONE `replace-level` OP CARRYING THE RESULT.** The
             * generator ran ONCE, here, with this seed; the op records the
             * level that came out of it. ⛔ An op that carried the recipe and
             * re-ran the generator on the fold would reconstruct a DIFFERENT
             * level the day any input to `generateZoneForSpecs` moved — a
             * recorded edit list that does not reproduce what the person saw
             * (trap 787's family). ⇒ one undo restores the pre-regenerate
             * level exactly, because the fold of the shorter list is it.
             */
            this._applyOp({
                op: 'replace-level',
                level,
                why: `Regenerated (seed ${s.seed}, ${keep ? 'kept contract' : 'free'})`,
            }, { select: null });
            return;
        } catch (err) {
            this._message = `Regenerate failed: ${err.message}`;
        }
        this.render();
    }

    // Derive exit specs from a level's portals for free-mode regenerate: the
    // side is `sideExits.portalSide`'s — ⛓ H6b made that ONE function, shared
    // with `assembleBounceRegionFromLevel`, which asks the same question from
    // the other end (side → portal id). This file used to carry its own copy of
    // the id regex + arrow table; two answers to one question is how the
    // assembler and the editor came to disagree about `exit_up`.
    // A portal naming no side at all still takes the first free side.
    _specsFromLevelPortals(level) {
        const ALL = ['N', 'S', 'E', 'W'];
        const used = new Set();
        const specs = [];
        for (const p of level.portals ?? []) {
            let side = portalSide(p);
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
        for (const kind of ENTITY_KINDS) {
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
            // ⛓ `set-pickup-item` — an op, so an item pick is undoable.
            iSel.addEventListener('change', () => {
                this._applyOp({
                    op: 'set-pickup-item',
                    id: pickup.id,
                    item: iSel.value === '(none)' ? null : iSel.value,
                });
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
            // ⛓ `set-portal-direction` — an op, so aiming an exit is undoable.
            dSel.addEventListener('change', () => {
                this._applyOp({
                    op: 'set-portal-direction', id: portal.id, direction: dSel.value,
                });
            });
            dRow.appendChild(dSel);
            block.appendChild(dRow);
        }

        block.appendChild(this._btn('Delete platform', () => this._deletePlatform(p.id)));
        return block;
    }

    // ── Edit operations — EVERY ONE IS AN OP ON THE SESSION ─────────────
    //
    // ⛓⛓⛓ There is no in-place write left in this file. Each mutator names
    // its op and hands it to `_applyOp`, which folds it, prints the outcome
    // (refused / no change / applied) and re-renders. ⛔ A mutator that wrote
    // `this._session.level` instead would be editing a record the very next
    // undo re-folds away — and it cannot, because `level` is a getter.

    /** `resize {dim, value}` — the op does the rounding and the floor of 1, so
     *  the list records the number APPLIED rather than the number typed. */
    _resizeLevel(dim, value) {
        this._applyOp({ op: 'resize', dim, value });
    }

    /** `add-platform` — `value` is the new platform, and it becomes the
     *  selection. ⛓ trap 857: this is the field the session now forwards. */
    _addPlatform() {
        this._applyOp({ op: 'add-platform' }, { select: (res) => res.value.id });
    }

    /** `set-platform {id, patch}` — x, y and type from the sidebar. */
    _setPlatform(id, patch) {
        this._applyOp({ op: 'set-platform', id, patch });
    }

    /**
     * ⛓⛓ `delete-platform` AS A GROUP — one `remove-entity` per orphan, then
     * the delete. ⛔ The cascade is in the OP LIST rather than inside the op,
     * so one undo restores the platform AND everything that was hosted on it,
     * and a reader of `payload().edits` can see what the delete took with it.
     */
    _deletePlatform(id) {
        const ops = deletePlatformOps(this._session.level, id);
        const orphans = ops.length - 1;
        this._applyOp(group(`delete platform ${id}`, ops), {
            select: null,
            message: () => `Deleted ${id}${orphans
                ? ` and ${orphans} entit${orphans === 1 ? 'y' : 'ies'} hosted on it` : ''}.`,
        });
    }

    /**
     * Add/remove an entity of `kind` hosted on platform `hostId` — the toggle
     * is TWO ops, and which one it is depends on the level, so the panel picks.
     *
     * ⚠ A new pickup's default `item` is the PANEL's choice (the first entry of
     * the world pool) and rides IN the op: the ops module cannot invent a fact
     * about a world it has never seen.
     */
    _toggleEntity(hostId, kind) {
        const level = this._session.level;
        const existing = (level[kind] ?? []).find((e) => e.on === hostId);
        if (existing) {
            this._applyOp({ op: 'remove-entity', kind, id: existing.id });
            return;
        }
        const op = { op: 'add-entity', kind, on: hostId };
        if (kind === 'pickups') op.item = (this._session.itemPool ?? [])[0] ?? null;
        this._applyOp(op);
    }
}

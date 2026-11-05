/**
 * ⛓⛓ A SAME-WIRING PRESET SWITCH WHILE THE GAME RUNS LOADS THE NEW PRESET'S ROOMS (`flashPanelUI._mountedRoomsDiffer`,
 * `seedlingMountKey.js`; ⚖ Robert, 2026-11-02 — "Fix it", a visible restart accepted).
 *
 * `seedling_atlas_location` and `seedling_atlas` wire the SAME `flash_panel`, so a switch between them re-mounted
 * nothing, and the rooms the AP load (`_startSeedlingRandomizer`) had bound at bridge ready stayed the PREVIOUS
 * preset's (the isolation probe: `"overworld_start__r8c0 -> owls_nest_entrance" is not an exit of the atlas rooms`).
 *
 * Driven on a bare panel (`flashPanelRulesDerived.test.js`'s pattern) over the two REAL presets: the REAL AP load
 * (the wiring module by its computed URL, the real atlas arm, the real atlas index and map document off disk), every
 * fetch HELD per call so the race is ordered by the test. The init flow is the one stand-in: `_initializeAdapter`
 * builds a fresh adapter and goes straight to the AP load, which is where the real flow arrives at bridge ready.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = { payload: null, staticData: null, glue: null };

vi.mock('../stateManager/index.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getLastRawJsonData: () => state.payload,
    stateManagerProxySingleton: { getStaticData: () => state.staticData },
}));
vi.mock('./index.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getSeedlingRegionGlue: () => state.glue,
}));

const { FlashPanelUI } = await import('./flashPanelUI.js');
const { SeedlingRegionGlue } = await import('./seedlingRegionGlue.js');
const { seedlingMountKey } = await import('./seedlingMountKey.js');
const { atlasRoomRegions } = await import('../seedlingDemo/seedlingAtlasCheckTable.js');
const { AP_ASSET_PATHS } = await import('./seedlingRandomizerWiring.js');
const { atlasIndexPath } = await import('./mapDocumentPath.js');

const FRONTEND = path.resolve(import.meta.dirname, '../..');
const BASE = pathToFileURL(FRONTEND + path.sep).href;
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(FRONTEND, rel), 'utf8'));
const ATLAS = readJson('presets/seedling_atlas/AP_1/AP_1_rules.json');
const LOCATION = readJson('presets/seedling_atlas_location/AP_1/AP_1_rules.json');
const clone = (o) => JSON.parse(JSON.stringify(o));

/** `staticData.locations` as the worker builds it (name → the location record, `item` included). */
function locationsMapOf(rules) {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [regionName, region] of Object.entries(rules.regions[slot])) {
            for (const loc of region.locations ?? []) out.set(loc.name, { ...loc, region: regionName });
        }
    }
    return out;
}

/**
 * What `files:jsonLoaded` → `stateManager:rulesLoaded` leaves behind: the raw payload and the static data. The panel
 * reads nothing else of the publish (⚖ Robert, 2026-11-03: an editor's republish is not told apart from a preset).
 */
function loadRules(panel, rules, eventData = {}) {
    const jsonData = rules;
    state.payload = { source: eventData.sourceName ?? 'presets/x', rawJsonData: jsonData, selectedPlayerInfo: { playerId: '1' } };
    state.staticData = { flash_panel: rules.flash_panel['1'], playerId: '1', locations: locationsMapOf(rules), game_name: rules.game_name };
}

const roomsOf = (rules) => atlasRoomRegions(rules).map((r) => r.region).sort();
const boundRooms = (panel) => [...(panel._seedlingAtlas?.regions?.keys() ?? [])].sort();

function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

/** `fetch` held per call (`calls[i].release()`), answered from disk by its file URL. */
function heldFetch() {
    const calls = [];
    const fn = vi.fn((url) => {
        const gate = deferred();
        calls.push({ url: String(url), release: () => gate.resolve() });
        return gate.promise.then(() => {
            const file = fileURLToPath(String(url));
            if (!fs.existsSync(file)) return { ok: false, status: 404, statusText: 'Not Found', json: async () => null };
            return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
        });
    });
    return { fn, calls, releaseAll: () => { for (const c of calls) c.release(); } };
}

const fakeOverlay = () => ({ element: null, sticky: false, show() {}, setText() {}, hide() {}, remove() {}, detachSafetyNet() {} });
const fakeAdapter = (id) => ({ id, detach() {}, teleport: () => true, bot: () => null });

/**
 * A bare panel on the JS runtime with the game RUNNING: its first adapter attached and its AP load run (by the test).
 * `inits` lists every adapter a (re-)mount built.
 */
function barePanel({ transport = 'js' } = {}) {
    const panel = Object.create(FlashPanelUI.prototype);
    const inits = [];
    const logs = [];
    Object.assign(panel, {
        componentState: {},
        transport,
        isInitialized: true,
        _initEpoch: 0,
        _initRuntime: transport,
        _lastFlashPanelKey: JSON.stringify(state.staticData.flash_panel),
        _panelLog: (m) => logs.push(m),
        _seedlingOverlay: fakeOverlay,
        _heldKeys: { uninstall() {}, install() {} },
        swfContainer: { innerHTML: '', style: {} },
        teleportRow: { style: {} },
        // ⛓ the init flow, from its adapter to bridge ready: what a re-mount ends in
        _initializeAdapter() {
            this.isInitialized = true;
            const adapter = fakeAdapter(inits.length + 1);
            this.adapter = adapter;
            inits.push(adapter);
            this._loads.push(this._startSeedlingRandomizer(adapter));
        },
        _loads: [],
    });
    return { panel, inits, logs };
}

/**
 * Release every held fetch until the in-flight loads settle (each answer can ask for the next document, and the real
 * modules' first import takes real time), then a few more rounds for the region-data fetches no load awaits.
 */
async function settle(fetchStub, loads) {
    let done = false;
    Promise.allSettled(loads).then(() => { done = true; });
    for (let i = 0; i < 4000 && !done; i += 1) {
        fetchStub.releaseAll();
        await new Promise((r) => setTimeout(r, 5));
    }
    for (let i = 0; i < 20; i += 1) {
        fetchStub.releaseAll();
        await new Promise((r) => setTimeout(r, 0));
    }
    await Promise.all(loads);
}

describe('a same-wiring rules load while the game runs', () => {
    let hadDocument;
    let previousDocument;
    let fetchStub;
    beforeEach(() => {
        hadDocument = 'document' in globalThis;
        previousDocument = globalThis.document;
        globalThis.document = { baseURI: BASE };
        fetchStub = heldFetch();
        vi.stubGlobal('fetch', fetchStub.fn);
        state.glue = new SeedlingRegionGlue({});
        // ⛔ The two presets wire the SAME game: the wiring check alone re-mounts nothing.
        expect(JSON.stringify(LOCATION.flash_panel)).toBe(JSON.stringify(ATLAS.flash_panel));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        if (hadDocument) globalThis.document = previousDocument;
        else delete globalThis.document;
    });

    /** Boot `rules` and run the first mount's AP load to its end: the game is running on `rules`' rooms. */
    async function running(rules, opts) {
        state.payload = null;
        state.staticData = { flash_panel: rules.flash_panel['1'] };
        const made = barePanel(opts);
        loadRules(made.panel, rules);
        made.panel._initializeAdapter();
        await settle(fetchStub, made.panel._loads);
        return made;
    }

    it('the fixture discriminates: the two presets\' rooms and mount keys differ', () => {
        expect(roomsOf(ATLAS).length).toBeGreaterThan(0);
        expect(roomsOf(ATLAS)).not.toEqual(roomsOf(LOCATION));
        const key = (r) => seedlingMountKey({ rules: r, playerId: '1', locations: locationsMapOf(r) });
        expect(key(ATLAS)).not.toBe(key(LOCATION));
        expect(key(clone(ATLAS))).toBe(key(ATLAS));
    });

    it('a preset switch to other rooms re-runs the AP load against the NEW rules (a re-mount)', async () => {
        const { panel, inits } = await running(LOCATION);
        expect(boundRooms(panel)).toEqual(roomsOf(LOCATION));
        expect(inits.length).toBe(1);

        loadRules(panel, ATLAS);
        panel._onRulesLoaded();
        await settle(fetchStub, panel._loads);
        expect(inits.length).toBe(2);
        expect(panel.adapter).toBe(inits[1]);
        expect(boundRooms(panel)).toEqual(roomsOf(ATLAS));
        // the probe's own refusal, gone: the exit the ATLAS rooms carry and the LOCATION ones do not
        const only = [...panel._seedlingAtlas.regions.keys()].find((r) => !roomsOf(LOCATION).includes(r));
        expect(only).toBeTruthy();
    });

    it('the OLD load still in flight when the switch lands: its answer is dropped', async () => {
        state.payload = null;
        state.staticData = { flash_panel: LOCATION.flash_panel['1'] };
        const { panel, inits } = barePanel();
        loadRules(panel, LOCATION);
        panel._initializeAdapter();
        await new Promise((r) => setTimeout(r, 0)); // the first load has read LOCATION and awaits its import / fetches
        loadRules(panel, ATLAS);
        panel._onRulesLoaded();
        expect(inits.length).toBe(2);
        await settle(fetchStub, panel._loads);
        expect(boundRooms(panel)).toEqual(roomsOf(ATLAS));
    });

    it('a load of the SAME payload (and of an identical copy) re-mounts nothing and fetches nothing', async () => {
        const { panel, inits } = await running(ATLAS);
        const n = fetchStub.calls.length;
        panel._onRulesLoaded(); // the same object
        loadRules(panel, clone(ATLAS)); // a fresh object, the same rooms
        panel._onRulesLoaded();
        await settle(fetchStub, panel._loads);
        expect(inits.length).toBe(1);
        // ⛓ only 619fceea9a's region-data rebuild (for the copy) may fetch — never the AP load's own documents (the
        // vanilla record set it fetches first, the atlas index the atlas arm reads)
        const apLoadDocs = [AP_ASSET_PATHS.recordSet, atlasIndexPath()].map((p) => new URL(p, BASE).href);
        expect(fetchStub.calls.slice(0, n).some((c) => apLoadDocs.includes(c.url))).toBe(true); // the first load's (non-vacuous)
        expect(fetchStub.calls.slice(n).filter((c) => apLoadDocs.includes(c.url))).toEqual([]);
        expect(boundRooms(panel)).toEqual(roomsOf(ATLAS));
    });

    it('an editor-style republish that leaves the rooms unchanged re-mounts nothing', async () => {
        const { panel, inits, logs } = await running(ATLAS);
        const edited = clone(ATLAS);
        edited.game_info = { ...(edited.game_info ?? {}), edited_by_test: true }; // an edit outside what the load reads
        loadRules(panel, edited, { sourceName: 'procgenPipeline' });
        panel._onRulesLoaded();
        // …and the APWorld editor's Apply, under its ORIGIN preset's name with the `appliedBy` marker
        const applied = clone(edited);
        loadRules(panel, applied, { sourceName: 'presets/seedling_atlas/AP_1/AP_1_rules.json', appliedBy: 'apworldEditorApply' });
        panel._onRulesLoaded();
        // …and a JSON editor's Apply
        loadRules(panel, clone(edited), { sourceName: 'editorApply' });
        panel._onRulesLoaded();
        // …and the same edit loaded as a plain preset: the KEY says the rooms are the same
        loadRules(panel, clone(edited));
        panel._onRulesLoaded();
        await settle(fetchStub, panel._loads);
        expect(inits.length).toBe(1);
        expect(logs.filter((l) => /re-mounting/.test(l))).toEqual([]);
    });

    // ⚖ Robert, 2026-11-03: an editor's Apply / "Load into frontend" that changes the running game's rooms RESTARTS it
    // on the edited rooms — the same visible restart as a preset switch.
    it.each([
        ['the procgen pipeline\'s "Load into frontend"', { sourceName: 'procgenPipeline' }],
        ['the APWorld editor\'s Apply (origin preset name + `appliedBy`)',
            { sourceName: 'presets/seedling_location/AP_1/AP_1_rules.json', appliedBy: 'apworldEditorApply' }],
        ['a JSON editor\'s Apply', { sourceName: 'editorApply' }],
    ])('an editor republish that DOES change the rooms re-mounts on the edited rooms: %s', async (_label, eventData) => {
        const { panel, inits, logs } = await running(LOCATION);
        expect(boundRooms(panel)).toEqual(roomsOf(LOCATION));
        loadRules(panel, clone(ATLAS), eventData);
        panel._onRulesLoaded();
        await settle(fetchStub, panel._loads);
        expect(inits.length).toBe(2);
        expect(panel.adapter).toBe(inits[1]);
        expect(boundRooms(panel)).toEqual(roomsOf(ATLAS));
        expect(logs.some((l) => /different rooms\) — re-mounting/.test(l))).toBe(true);
    });

    it('a load refused on the WIRING (the build: no readable manifest) restarts on no same-wiring rules change', async () => {
        // the wasm transport, its manifest unreadable here (a relative `builds.json` path): refused by `capability`,
        // which reads the wiring and the build, never the rules — no rules change can make this game load rooms
        const { panel, inits } = await running(LOCATION, { transport: 'wasm' });
        expect(panel._apLoadRefusal).toMatch(/^capability:/);
        loadRules(panel, ATLAS);
        panel._onRulesLoaded();
        await settle(fetchStub, panel._loads);
        expect(inits.length).toBe(1);
    });
});

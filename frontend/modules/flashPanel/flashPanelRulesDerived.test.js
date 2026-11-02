/**
 * ⛓⛓ THE REGION DATA FOLLOWS THE RULES, NOT THE ATTACH (`flashPanelUI._loadRulesDerived`).
 *
 * The sub-region map (the logical links a Bot block credits) is built from the rules loaded when the adapter
 * ATTACHES. Measured (Test Templates 41252552833, both attempts, `seedling-wasm-runtime-loop-bot-blocks-cross-
 * atlas-rooms`): the row's runtime switch re-initialized the panel, whose wasm init attached while the PREVIOUS
 * row's seedling_atlas_location rules were still the loaded ones; seedling_atlas's rules landed next, with the
 * SAME `flash_panel` wiring, so `_onRulesLoaded` re-mounted nothing — and the map stayed the previous preset's:
 * the credited link was "not a logical sub-region link of this preset".
 *
 * Driven on a bare panel (the prototype's own methods; `flashPanelInitEpoch.test.js`'s pattern) over the two
 * REAL presets and the REAL partition document, the fetch held per call so the race is ordered by the test.
 */
import fs from 'node:fs';
import path from 'node:path';
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
const { buildSubRegionMap, SUB_REGION_PARTITION_PATH } = await import('./seedlingSubRegions.js');

const FRONTEND = path.resolve(import.meta.dirname, '../..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(FRONTEND, rel), 'utf8'));
const ATLAS = readJson('presets/seedling_atlas/AP_1/AP_1_rules.json');
const LOCATION = readJson('presets/seedling_atlas_location/AP_1/AP_1_rules.json');
const PARTITION = readJson(SUB_REGION_PARTITION_PATH.replace(/^\.\//, ''));

const payloadOf = (rules, source) => ({ source, rawJsonData: rules, selectedPlayerInfo: { playerId: '1' } });
/** Every link name the map a preset's rules build carries (sorted). */
const linkNames = (map) => [...(map?.links?.values() ?? [])].flat().map((l) => l.name).sort();
const expectedLinks = (rules) => linkNames(buildSubRegionMap({ rules, partition: PARTITION, player: '1' }).map);

function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

/** `fetch` held per call: `calls[i].release()` answers the i-th request (by URL, from disk). */
function heldFetch() {
    const calls = [];
    const fn = vi.fn((url) => {
        const gate = deferred();
        const rel = new URL(url).pathname.replace(/^\/frontend\//, '');
        calls.push({ url, release: () => gate.resolve() });
        return gate.promise.then(() => ({ ok: true, json: async () => readJson(rel) }));
    });
    return { fn, calls, releaseAll: () => { for (const c of calls) c.release(); } };
}

function barePanel(adapter) {
    const panel = Object.create(FlashPanelUI.prototype);
    Object.assign(panel, {
        componentState: {},
        adapter,
        isInitialized: true,
        _lastFlashPanelKey: JSON.stringify(state.staticData.flash_panel),
        _panelLog: () => {},
    });
    return panel;
}

async function settle() {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
}

describe('the region data follows the loaded rules', () => {
    let hadDocument;
    let previousDocument;
    let fetchStub;
    beforeEach(() => {
        hadDocument = 'document' in globalThis;
        previousDocument = globalThis.document;
        globalThis.document = { baseURI: 'http://localhost/frontend/' };
        fetchStub = heldFetch();
        vi.stubGlobal('fetch', fetchStub.fn);
        state.glue = new SeedlingRegionGlue({});
        // ⛔ The two presets wire the SAME game: a switch between them re-mounts nothing.
        expect(JSON.stringify(LOCATION.flash_panel)).toBe(JSON.stringify(ATLAS.flash_panel));
        state.staticData = { flash_panel: ATLAS.flash_panel };
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        if (hadDocument) globalThis.document = previousDocument;
        else delete globalThis.document;
    });

    it('the fixture discriminates: the two presets build different link sets', () => {
        expect(expectedLinks(ATLAS).length).toBeGreaterThan(0);
        expect(expectedLinks(ATLAS)).not.toEqual(expectedLinks(LOCATION));
    });

    it('an attach under the PREVIOUS preset\'s rules, then a same-wiring rules load: the map is the loaded preset\'s', async () => {
        const adapter = {};
        state.payload = payloadOf(LOCATION, 'location');
        const panel = barePanel(adapter);
        panel._attachRegionGlue(adapter);
        fetchStub.releaseAll();
        await settle();
        expect(linkNames(state.glue.binding.subRegions)).toEqual(expectedLinks(LOCATION));

        state.payload = payloadOf(ATLAS, 'atlas'); // files:jsonLoaded → …
        panel._onRulesLoaded(); // … stateManager:rulesLoaded, same flash_panel wiring
        fetchStub.releaseAll();
        await settle();
        expect(linkNames(state.glue.binding.subRegions)).toEqual(expectedLinks(ATLAS));
        const link = expectedLinks(ATLAS).find((n) => !expectedLinks(LOCATION).includes(n));
        expect(state.glue.binding.creditLink(link).reason ?? '').not.toMatch(/is not a logical sub-region link/);
    });

    it('the attach\'s fetch answers AFTER the newer rules\' one: the stale answer is dropped', async () => {
        const adapter = {};
        state.payload = payloadOf(LOCATION, 'location');
        const panel = barePanel(adapter);
        panel._attachRegionGlue(adapter);
        const first = fetchStub.calls.length;
        state.payload = payloadOf(ATLAS, 'atlas');
        panel._onRulesLoaded();
        // the newer load's requests answer first, then the attach's (the race the CI box lost, reversed)
        for (const c of fetchStub.calls.slice(first)) c.release();
        await settle();
        for (const c of fetchStub.calls.slice(0, first)) c.release();
        await settle();
        expect(linkNames(state.glue.binding.subRegions)).toEqual(expectedLinks(ATLAS));
    });

    it('…and the other way round: a stale answer built for the OLD preset is not installed over the new one\'s', async () => {
        const adapter = {};
        state.payload = payloadOf(ATLAS, 'atlas');
        const panel = barePanel(adapter);
        panel._attachRegionGlue(adapter);
        const first = fetchStub.calls.length;
        state.payload = payloadOf(LOCATION, 'location');
        panel._onRulesLoaded();
        for (const c of fetchStub.calls.slice(first)) c.release();
        await settle();
        for (const c of fetchStub.calls.slice(0, first)) c.release();
        await settle();
        expect(linkNames(state.glue.binding.subRegions)).toEqual(expectedLinks(LOCATION));
    });

    it('a rules load of the SAME payload rebuilds nothing (no fetch)', async () => {
        const adapter = {};
        state.payload = payloadOf(ATLAS, 'atlas');
        const panel = barePanel(adapter);
        panel._attachRegionGlue(adapter);
        fetchStub.releaseAll();
        await settle();
        const n = fetchStub.calls.length;
        panel._onRulesLoaded();
        await settle();
        expect(fetchStub.calls.length).toBe(n);
        expect(linkNames(state.glue.binding.subRegions)).toEqual(expectedLinks(ATLAS));
    });
});

/**
 * ⛓⛓ Document library B5 — **THE FLASH PANEL PLAYS FROM THE LIBRARY.** A set the front (`levelSetCache`) does not
 * hold is read from the document library by its fingerprint before the load's first read of the front, on both
 * runtimes; the running game holds its version; a load that stopped being the panel's during that read drops out
 * by name. Over the WATCH PAGE'S OWN compile (`seedlingCustomSetArm.test.js`'s recipe) and B1's memory backend.
 *
 * Mutants this file reds (each driven by hand, quoted in the as-built):
 *   · the wiring's fill removed → the library-fill rows (G refuses);
 *   · the stale re-check removed → the stale row;
 *   · `ensureHeld` moved inside the no-await window → the placement pin;
 *   · the panel does not hold its game's version → the hold rows.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = { payload: null, staticData: null };
vi.mock('../stateManager/index.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getLastRawJsonData: () => state.payload,
    stateManagerProxySingleton: { getStaticData: () => state.staticData },
}));

const { FlashPanelUI } = await import('./flashPanelUI.js');
const { tileTypeForPlacement } = await import('./seedlingSemantics.js');
const { loadRulesSchema } = await import('../procgenCore/jsonSchemaFiles.js');
const { createAtlasCache, putAtlases } = await import('../procgenCore/atlasCache.js');
const { createLevelSetCache, levelSetCache } = await import('../procgenCore/levelSetCache.js');
const { levelSetReferenceOf } = await import('../procgenCore/levelSetReference.js');
const core = await import('../procgenCore/documentLibrary.js');
const { createMemoryBackend } = await import('../procgenCore/documentLibraryMemory.js');
const { createLevelSetHolder } = await import('../procgenCore/levelSetLibrary.js');
const { compileRegionAtlas } = await import('../procgenPipeline/regionAtlasCompiler.js');
const { stampAtlasIdentity } = await import('../procgenPipeline/regionAtlasValidator.js');
const { TILE_SIZE } = await import('../seedlingDemo/levelWorld.js');
const { parseOelLevel } = await import('../seedlingDemo/procgenLevelOel.js');
const SA = await import('../seedlingDemo/seedlingSetAdapter.js');
const { emptyOverlay } = await import('../seedlingDemo/seedlingSetOverlay.js');
const { editorVanillaSet } = await import('../seedlingDemo/watchSetEditor.js');
const { WATCH_SET_ATLAS, labSetIdentity } = await import('../seedlingDemo/watchSetIdentity.js');
const { STALE_LOAD_VERDICT, STALE_LOAD_WHY, loadSeedlingRandomizer } = await import('./seedlingRandomizerWiring.js');
const { unservedAtlasWhy } = await import('./seedlingRandomizerEligibility.js');

const FRONTEND = new URL('../../', import.meta.url);
const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, FRONTEND)), 'utf8'));
const diskFetch = async (u) => {
    if (!String(u).startsWith('file:')) throw new Error(`not fetchable here: ${u}`);
    return JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));
};
const GAME_CONFIG = read('modules/flashPanel/games/seedling.json');
const MANIFEST = read('modules/flashPanel/wasm/builds.json');
const MAP = read('modules/flashPanel/atlases/seedling-map.json');
const VANILLA = editorVanillaSet(read('modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), MAP).set;
const TREE = { type: 'tree', x: 16, y: 80 };
const DEPS = Object.freeze({
    parseOel: parseOelLevel, tileSize: TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(), atlas: WATCH_SET_ATLAS,
});

function labWorld(set) {
    const lab = labSetIdentity({ compileRegionAtlas, stampAtlasIdentity });
    const session = SA.createSetSession(SA.createSeedlingSetAdapter(DEPS), SA.setRecord(set, emptyOverlay()),
        { base: { kind: 'set', set_id: set.set_id } });
    const out = SA.rulesJsonOf(session, DEPS, { compileRegionAtlas: lab.compileRegionAtlas });
    return { rules: out.rules, levelSet: SA.downloadSet(session).set, atlas: lab.atlasAtDoor(out.atlas, out.rules) };
}
const withTree = () => {
    const s = structuredClone(VANILLA);
    s.rooms[10].source.record.entities.push({ ...TREE });
    return s;
};
/** v1: the tree in room 10. v2: the same set edited again (a second tree) — a later version of the same lineage. */
const V1 = labWorld(withTree());
const V2 = (() => {
    const s = withTree();
    s.rooms[10].source.record.entities.push({ type: 'tree', x: 48, y: 80 });
    return labWorld(s);
})();
const hasTree = (room) => (room?.source?.record?.entities ?? []).some((e) => e.type === TREE.type && e.x === TREE.x && e.y === TREE.y);
const treeCount = (room) => (room?.source?.record?.entities ?? []).filter((e) => e.type === 'tree').length;
const roomOf = (set, id) => set.rooms.find((r) => r.id === id);
const locationsOf = (rules) => Object.fromEntries(Object.values(rules.regions['1']).flatMap((r) => r.locations ?? []).map((l) => [l.name, l]));

/** The lab's saves: v1, then v2, one lineage (the set + its rules, as the writer files them). */
async function labSaved(...worlds) {
    const lib = core.createDocumentLibrary({ backend: createMemoryBackend() });
    let lineageId = null;
    const saved = [];
    for (const w of worlds) {
        const r = await lib.saveVersion({ lineageId, parent: saved.at(-1)?.entry_id ?? null, draft: false, savedBecause: 'report',
            substrate: 'demo', source: { page: 'lab', tab_id: 'labtab' }, label: 'Lab',
            members: [{ role: 'set', idKey: 'set_id', doc: w.levelSet }, { role: 'rules', idKey: null, doc: w.rules }] });
        expect(r.status).toBe('saved');
        lineageId = r.lineage_id;
        saved.push(r);
    }
    return { lib, saved };
}

const load = (world, transport, extra) => loadSeedlingRandomizer({
    flashPanel: world.rules.flash_panel?.['1'] ?? null, manifest: MANIFEST, transport, rawRules: world.rules,
    locations: locationsOf(world.rules), playerId: '1', gameConfig: GAME_CONFIG,
    baseUrl: pathToFileURL(fileURLToPath(FRONTEND)).href, fetchJson: diskFetch,
    importModule: (u) => import(/* @vite-ignore */ u), log: () => {}, ...extra,
});
const host = (...worlds) => {
    const atlases = createAtlasCache();
    putAtlases(worlds.map((w) => w.atlas), atlases);
    return { levelSets: createLevelSetCache(), atlases };
};

describe('B5 — the wiring: an EMPTY front, the set in the library, both runtimes', () => {
    for (const transport of ['js', 'wasm']) {
        it(`${transport}: the library fills the front before the read, and v1's OWN rooms are delivered (room 10's tree)`, async () => {
            const { lib } = await labSaved(V1, V2);
            const h = host(V1);
            const r = await load(V1, transport, { ...h, library: async () => lib });
            expect(r.eligibility).toMatchObject({ eligible: true, arm: 'atlas' });
            expect(r.set.set_id).toBe(V1.levelSet.set_id);
            expect(hasTree(roomOf(r.set, 10))).toBe(true);
            expect(treeCount(roomOf(r.set, 10))).toBe(treeCount(roomOf(V1.levelSet, 10)));
            expect(r.assets.recordSet).toMatchObject({ ok: true, held: V1.rules.region_atlas['1'].level_set });
            expect(h.levelSets.refs().map((x) => x.set_id)).toEqual([V1.levelSet.set_id]);
        });
    }
    it('⛓ pin 5 — rules naming v2 play v2\'s rooms, rules naming v1 play v1\'s: never the other version', async () => {
        const { lib } = await labSaved(V1, V2);
        const two = await load(V2, 'js', { ...host(V2), library: lib });
        expect(two.set.set_id).toBe(V2.levelSet.set_id);
        expect(treeCount(roomOf(two.set, 10))).toBe(treeCount(roomOf(V2.levelSet, 10)));
        const one = await load(V1, 'js', { ...host(V1), library: lib });
        expect(treeCount(roomOf(one.set, 10))).toBe(treeCount(roomOf(V1.levelSet, 10)));
        expect(treeCount(roomOf(one.set, 10))).not.toBe(treeCount(roomOf(two.set, 10)));
    });
    it('⛔ pin 5 — v1 DELETED from the library: G\'s named refusal (never vanilla, never v2), the front still empty', async () => {
        const { lib, saved } = await labSaved(V1);
        await expect(lib.deleteLineage(saved[0].lineage_id)).resolves.toMatchObject({ status: 'deleted' });
        const { lib: libV2 } = await labSaved(V2);
        for (const library of [lib, libV2]) {
            const h = host(V1);
            const r = await load(V1, 'wasm', { ...h, library });
            expect(r.delivery).toBeNull();
            expect(r.why).toBe(`atlas: ${unservedAtlasWhy(V1.rules.region_atlas['1'].atlas_id)}`);
            expect(h.levelSets.size).toBe(0);
        }
    });
    it('no library handed (a node caller): today\'s answer, unchanged', async () => {
        const r = await load(V1, 'js', host(V1));
        expect(r.why).toBe(`atlas: ${unservedAtlasWhy(V1.rules.region_atlas['1'].atlas_id)}`);
    });
    it('⛔ (a) STALE: the load stopped being the caller\'s during the library read → it drops out BY NAME, delivers nothing', async () => {
        const { lib } = await labSaved(V1);
        let current = true;
        const library = async () => { current = false; return lib; };
        const r = await load(V1, 'wasm', { ...host(V1), library, isCurrent: () => current });
        expect(r).toMatchObject({ stale: true, verdict: STALE_LOAD_VERDICT, why: STALE_LOAD_WHY, delivery: null, set: null });
        // still current → the same load plays
        const ok = await load(V1, 'wasm', { ...host(V1), library: lib, isCurrent: () => true });
        expect(ok.stale).toBeUndefined();
        expect(ok.eligibility.eligible).toBe(true);
    });
});

describe('B5 — (a) the placement, pinned over the wiring\'s source (the window found by its ⛔ marker)', () => {
    const src = readFileSync(fileURLToPath(new URL('./seedlingRandomizerWiring.js', import.meta.url)), 'utf8');
    const MARKER = '⛔ NO `await` FROM HERE TO `deliver()`';
    it('ensureHeld is NOT inside the no-await window, and the window still holds no await', () => {
        const at = src.indexOf(MARKER);
        expect(at).toBeGreaterThan(0);
        const end = src.indexOf('.deliver()', at);
        expect(end).toBeGreaterThan(at);
        const windowText = src.slice(at + MARKER.length, end);
        expect(windowText).not.toMatch(/ensureHeld|\bawait\b/);
        // …and not anywhere in the delivery steps' function
        const steps = src.slice(src.indexOf('async function runSeedlingRandomizerLoadSteps'), src.indexOf('export function heldSetMapDocument'));
        expect(steps).not.toMatch(/ensureHeld/);
    });
    it('inside loadSeedlingRandomizer the fill comes BEFORE the first read of the front, then the stale re-check', () => {
        const fn = src.slice(src.indexOf('export async function loadSeedlingRandomizer'), src.indexOf('export async function loadSeedlingGenerated'));
        const fill = fn.indexOf('await ensureHeld(levelSets');
        const recheck = fn.indexOf('!isCurrent()');
        const read = fn.indexOf('heldLevelSetOf(rawRules, playerId, levelSets)');
        expect(fill).toBeGreaterThan(0);
        expect(fill).toBeLessThan(recheck);
        expect(recheck).toBeLessThan(read);
        expect(fn.slice(0, fill)).not.toMatch(/levelSets\.(get|has|refs)\(|heldLevelSetOf\(/);
    });
    it('⛔ (d) no swap: neither the wiring nor the panel listens for library saves or live notices', () => {
        const panel = readFileSync(fileURLToPath(new URL('./flashPanelUI.js', import.meta.url)), 'utf8');
        for (const text of [src, panel]) expect(text).not.toMatch(/BroadcastChannel|versionSaved|draftUpdated/);
    });
});

/* ── the panel: its two read points fill first; its game holds its version ── */

const BASE = pathToFileURL(fileURLToPath(FRONTEND)).href;
const loadRules = (rules) => {
    state.payload = { source: 'bundle', rawJsonData: rules, selectedPlayerInfo: { playerId: '1' } };
    state.staticData = { flash_panel: rules.flash_panel?.['1'] ?? null, playerId: '1' };
};
function barePanel(lib, { level = 10 } = {}) {
    const panel = Object.create(FlashPanelUI.prototype);
    const logs = [];
    const holder = createLevelSetHolder({ cache: levelSetCache, front: { tabId: 'apptab', open: async () => lib, modules: async () => ({ core }) },
        timers: { setInterval: () => 1, clearInterval: () => {} }, win: new EventTarget(), doc: new EventTarget() });
    Object.assign(panel, {
        _panelLog: (m) => logs.push(m),
        _loadConfig: async (url) => JSON.parse(readFileSync(new URL(url), 'utf8')),
        _levelSetLibrary: async () => lib,
        _levelSetHolder: () => holder,
        editRoomButton: { style: { display: 'none' } },
        adapter: { bot: (name) => (name === 'botStatus' ? JSON.stringify({ level }) : null) },
    });
    return { panel, logs };
}

describe('B5 — the panel', () => {
    let hadDocument;
    let previousDocument;
    beforeEach(() => {
        hadDocument = 'document' in globalThis;
        previousDocument = globalThis.document;
        globalThis.document = { baseURI: BASE };
        levelSetCache.clear();
    });
    afterEach(() => {
        levelSetCache.clear();
        if (hadDocument) globalThis.document = previousDocument;
        else delete globalThis.document;
    });

    it('_customSetRefusal on an EMPTY front: the library fills it → no refusal (the game starts); nothing in it → G', async () => {
        const { lib } = await labSaved(V1);
        loadRules(V1.rules);
        const { panel, logs } = barePanel(lib);
        expect(await panel._customSetRefusal()).toBeNull();
        expect(levelSetCache.get(V1.levelSet.set_id, levelSetReferenceOf(V1.levelSet).content_hash).status).toBe('held');
        expect(logs.some((m) => /document library filled level set/.test(m))).toBe(true);
        levelSetCache.clear();
        const empty = core.createDocumentLibrary({ backend: createMemoryBackend() });
        const id = V1.rules.region_atlas['1'].atlas_id;
        expect(await barePanel(empty).panel._customSetRefusal()).toEqual({ why: `atlas: ${unservedAtlasWhy(id)}`, reason: unservedAtlasWhy(id) });
    });

    it('⛓ (b) the game HOLDS its version (front + library) from _setHeldSetEdit; the next load and destroy release it', async () => {
        const { lib, saved } = await labSaved(V1);
        const ref = levelSetReferenceOf(V1.levelSet);
        levelSetCache.put(ref.set_id, V1.levelSet, { contentHash: ref.content_hash });
        const { panel } = barePanel(lib);
        panel._setHeldSetEdit(ref);
        await panel._levelSetHold.ready;
        expect(levelSetCache.holdsOf(ref)).toBe(1);
        expect(panel._levelSetHold.state()).toMatchObject({ library: 'held', entry_id: saved[0].entry_id });
        // the same ref again (a re-set of Edit ▸) keeps ONE hold
        panel._setHeldSetEdit(ref);
        expect(levelSetCache.holdsOf(ref)).toBe(1);
        await expect(lib.deleteLineage(saved[0].lineage_id)).resolves.toMatchObject({ status: 'refused', why: 'held' });
        const hold = panel._levelSetHold;
        panel._setHeldSetEdit(null);
        await vi.waitFor(() => expect(hold.state().library).toBe('released'));
        expect(levelSetCache.holdsOf(ref)).toBe(0);
        await expect(lib.deleteLineage(saved[0].lineage_id)).resolves.toMatchObject({ status: 'deleted' });
    });

    it('⛓ J2 retired, at the panel: a playing set survives four later puts, and Edit ▸ still answers held', async () => {
        const { lib } = await labSaved(V1);
        const ref = levelSetReferenceOf(V1.levelSet);
        levelSetCache.put(ref.set_id, V1.levelSet, { contentHash: ref.content_hash });
        const { panel } = barePanel(lib);
        panel._setHeldSetEdit(ref);
        for (let i = 0; i < 5; i += 1) levelSetCache.put(`other-${i}`, { set_id: `other-${i}`, rooms: [] }, { contentHash: `0000000${i}` });
        expect(levelSetCache.get(ref.set_id, ref.content_hash).status).toBe('held');
        const opened = [];
        const answer = await panel._editHeldSetRoom({ open: async (kind, o) => { opened.push(o.room); return { ok: true }; } });
        expect(answer).toMatchObject({ ok: true, room: 10, set_id: ref.set_id });
        // the panel goes (destroy releases it: pinned over its source, the bare panel has no DOM to tear down)
        const destroySrc = FlashPanelUI.prototype.destroy.toString();
        expect(destroySrc).toMatch(/this\._levelSetHold\?\.release\(\);\s*this\._levelSetHold = null;/);
        void panel._levelSetHold.release();
        await vi.waitFor(() => expect(levelSetCache.holdsOf(ref)).toBe(0));
    });

    it('Edit ▸ on an EMPTY front (the page lost it) fills from the library first; a library without it → the named refusal', async () => {
        const { lib } = await labSaved(V1);
        const ref = levelSetReferenceOf(V1.levelSet);
        const { panel } = barePanel(lib);
        panel._heldSetEdit = ref;
        const answer = await panel._editHeldSetRoom({ open: async () => ({ ok: true }) });
        expect(answer).toMatchObject({ ok: true, room: 10 });
        levelSetCache.clear();
        const empty = core.createDocumentLibrary({ backend: createMemoryBackend() });
        const { panel: p2 } = barePanel(empty);
        p2._heldSetEdit = ref;
        await expect(p2._editHeldSetRoom({ open: async () => ({ ok: true }) })).resolves.toMatchObject({
            ok: false, why: `no level set with set_id ${JSON.stringify(ref.set_id)} is held` });
    });
});

/**
 * ⛓⛓ S4 (seedling-custom-set-arm) — **THE FLASH PANEL'S HALF: A HELD SET STARTS, AN UNHELD ONE IS STILL REFUSED, AND
 * EDIT ▸ HANDS THE LAB THE HELD SET AND THE ROOM THE GAME IS IN.** Driven on a bare panel
 * (`flashPanelSameWiringRemount.test.js`'s pattern) over the WATCH PAGE'S OWN rules (its compile, through
 * `seedlingSetAdapter.rulesJsonOf`): `flash_panel` on (S4 flipped S1's option back), `region_atlas[1].level_set` naming
 * the set.
 *
 * ⛓ lab-7's addition 2 — **A LAB SET THAT IS NOT HELD** (its rules.json downloaded alone, or through the APWorld door,
 * without the bundle) now carries `flash_panel` + `level_set`, and the panel asks G's question before any game starts:
 * refused with G's sentence, unchanged. (The load itself refuses on both runtimes: `seedlingCustomSetArm.test.js`.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = { payload: null, staticData: null };

vi.mock('../stateManager/index.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getLastRawJsonData: () => state.payload,
    stateManagerProxySingleton: { getStaticData: () => state.staticData },
}));

const { FlashPanelUI } = await import('./flashPanelUI.js');
const { levelSetCache } = await import('../procgenCore/levelSetCache.js');
const { putLevelSets, levelSetContentHash } = await import('../procgenCore/levelSetReference.js');
const { unservedAtlasWhy } = await import('./seedlingRandomizerEligibility.js');
const { tileTypeForPlacement } = await import('./seedlingSemantics.js');
const { loadRulesSchema } = await import('../procgenCore/jsonSchemaFiles.js');
const { compileRegionAtlas } = await import('../procgenPipeline/regionAtlasCompiler.js');
const { stampAtlasIdentity } = await import('../procgenPipeline/regionAtlasValidator.js');
const { TILE_SIZE } = await import('../seedlingDemo/levelWorld.js');
const { parseOelLevel } = await import('../seedlingDemo/procgenLevelOel.js');
const SA = await import('../seedlingDemo/seedlingSetAdapter.js');
const { emptyOverlay } = await import('../seedlingDemo/seedlingSetOverlay.js');
const { editorVanillaSet } = await import('../seedlingDemo/watchSetEditor.js');
const { WATCH_SET_ATLAS, labSetIdentity } = await import('../seedlingDemo/watchSetIdentity.js');

const FRONTEND = path.resolve(import.meta.dirname, '../..');
const BASE = pathToFileURL(FRONTEND + path.sep).href;
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(FRONTEND, rel), 'utf8'));
const PRESET = readJson('presets/seedling_atlas/AP_1/AP_1_rules.json');

/** The watch page's rules for the vanilla 116 + a tree in room 10, and the stamped set they name. */
function labWorld() {
    const set = editorVanillaSet(readJson('modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('modules/flashPanel/atlases/seedling-map.json')).set;
    set.rooms[10].source.record.entities.push({ type: 'tree', x: 16, y: 80 });
    const deps = { parseOel: parseOelLevel, tileSize: TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
        atlas: WATCH_SET_ATLAS };
    const lab = labSetIdentity({ compileRegionAtlas, stampAtlasIdentity });
    const session = SA.createSetSession(SA.createSeedlingSetAdapter(deps), SA.setRecord(set, emptyOverlay()),
        { base: { kind: 'set', set_id: set.set_id } });
    return { rules: SA.rulesJsonOf(session, deps, { compileRegionAtlas: lab.compileRegionAtlas }).rules,
        levelSet: SA.downloadSet(session).set };
}
const WORLD = labWorld();

const loadRules = (rules) => {
    state.payload = { source: 'bundle', rawJsonData: rules, selectedPlayerInfo: { playerId: '1' } };
    state.staticData = { flash_panel: rules.flash_panel?.['1'] ?? null, playerId: '1' };
};

function barePanel({ level = 10 } = {}) {
    const panel = Object.create(FlashPanelUI.prototype);
    const logs = [];
    Object.assign(panel, {
        _panelLog: (m) => logs.push(m),
        _loadConfig: async (url) => JSON.parse(fs.readFileSync(new URL(url), 'utf8')),
        editRoomButton: { style: { display: 'none' } },
        adapter: { bot: (name) => (name === 'botStatus' ? JSON.stringify({ level }) : null) },
    });
    return { panel, logs };
}

describe('S4 — the panel\'s question before a game starts', () => {
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

    it('the lab rules are the S4 shape: flash_panel ON and level_set naming the set', () => {
        expect(WORLD.rules.flash_panel?.['1']?.wasm).toBeTruthy();
        expect(WORLD.rules.region_atlas['1'].level_set.set_id).toBe(WORLD.levelSet.set_id);
    });

    it('lab-7 #2 — NOT held (rules alone, WITH flash_panel + level_set): G\'s refusal, its sentence unchanged', async () => {
        loadRules(WORLD.rules);
        const { panel } = barePanel();
        const id = WORLD.rules.region_atlas['1'].atlas_id;
        expect(await panel._customSetRefusal()).toEqual({ why: `atlas: ${unservedAtlasWhy(id)}`, reason: unservedAtlasWhy(id) });
    });

    it('held under ANOTHER hash: still G\'s refusal', async () => {
        const other = structuredClone(WORLD.levelSet);
        other.rooms[10].source.record.entities.pop();
        levelSetCache.put(other.set_id, other, { contentHash: levelSetContentHash(other) });
        loadRules(WORLD.rules);
        expect((await barePanel().panel._customSetRefusal())?.why).toMatch(/^atlas: these rules name a region atlas/);
    });

    it('HELD (the bundle\'s member): no refusal — the game starts and the AP load delivers the set', async () => {
        putLevelSets([WORLD.levelSet]);
        loadRules(WORLD.rules);
        expect(await barePanel().panel._customSetRefusal()).toBeNull();
    });

    it('a served preset is asked the same question and answers as before (no refusal)', async () => {
        loadRules(PRESET);
        expect(await barePanel().panel._customSetRefusal()).toBeNull();
    });
});

describe('S4 — Edit ▸ (⚖ Robert Q4 "Open back in the lab")', () => {
    beforeEach(() => levelSetCache.clear());
    afterEach(() => levelSetCache.clear());
    const REF = () => WORLD.rules.region_atlas['1'].level_set;

    it('hidden until a HELD set was delivered; shown for one; hidden again on teardown', () => {
        const { panel } = barePanel();
        panel._setHeldSetEdit(null);
        expect(panel.editRoomButton.style.display).toBe('none');
        panel._setHeldSetEdit(REF());
        expect(panel.editRoomButton.style.display).toBe('');
        panel._setHeldSetEdit(null);
        expect(panel.editRoomButton.style.display).toBe('none');
    });

    it('what crosses: the held SET DOCUMENT (its set_id + stamped content_hash) and the room the game is in', async () => {
        putLevelSets([WORLD.levelSet]);
        const { panel } = barePanel({ level: 10 });
        panel._setHeldSetEdit(REF());
        const calls = [];
        const answer = await panel._editHeldSetRoom({ open: async (substrate, session) => {
            calls.push({ substrate, session });
            return { ok: true, close() {} };
        } });
        expect(answer).toMatchObject({ ok: true, room: 10, set_id: WORLD.levelSet.set_id });
        expect(calls).toHaveLength(1);
        expect(calls[0].substrate).toBe('flash_seedling');
        expect(calls[0].session.room).toBe(10);
        expect(calls[0].session.record).toEqual(WORLD.levelSet);
        expect(calls[0].session.record).not.toBe(WORLD.levelSet); // a copy: the lab's edits never touch the held body
        expect(calls[0].session.record.provenance.content_hash).toBe(REF().content_hash);
        expect(typeof calls[0].session.onSave).toBe('function');
    });

    it('refused by name: nothing held / the set no longer held / a room outside the set', async () => {
        const open = vi.fn(async () => ({ ok: true }));
        const { panel } = barePanel({ level: 10 });
        expect((await panel._editHeldSetRoom({ open })).ok).toBe(false);
        panel._setHeldSetEdit(REF());
        expect(await panel._editHeldSetRoom({ open })).toMatchObject({ ok: false, why: expect.stringMatching(/is held/) });
        putLevelSets([WORLD.levelSet]);
        const far = barePanel({ level: 500 }).panel;
        far._setHeldSetEdit(REF());
        expect(await far._editHeldSetRoom({ open })).toMatchObject({ ok: false, why: expect.stringMatching(/no room of this set/) });
        expect(open).not.toHaveBeenCalled();
    });

    it('the lab door\'s own refusal is reported, not swallowed', async () => {
        putLevelSets([WORLD.levelSet]);
        const { panel } = barePanel();
        panel._setHeldSetEdit(REF());
        const answer = await panel._editHeldSetRoom({ open: async () => ({ ok: false, why: 'no Procgen Lab panel' }) });
        expect(answer).toMatchObject({ ok: false, why: 'no Procgen Lab panel' });
    });
});

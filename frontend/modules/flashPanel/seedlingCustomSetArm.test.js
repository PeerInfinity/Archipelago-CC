/**
 * ⛓⛓ S4 (seedling-custom-set-arm) — **A HELD CUSTOM SET PLAYS ITS OWN ROOMS; ANY OTHER CUSTOM SET IS STILL REFUSED.**
 * (⚖ Robert 2026-11-20, "Make lab sets playable": "the player delivers THOSE rooms on both runtimes (no rebuild)".)
 *
 * ⛓ THE INVERSE OF THE STUDY'S PROBE p5, built through the WATCH PAGE'S OWN compile (`watchSetIdentity.js`'s
 * `labSetIdentity` over `seedlingSetAdapter.rulesJsonOf`, the doors' recipe): the vanilla 116 with ONE tree added
 * to room 10. The bundle's two members are held the way `presetUI.loadDocumentFile` holds them (`putLevelSets` +
 * `putAtlases`), into instances this file builds, and the REAL `loadSeedlingRandomizer` runs on both transports.
 *   · held, matching hash → eligible, and the delivered room 10 HAS the tree;
 *   · nothing held (the rules alone: a rules.json download, the APWorld door) → slice G's sentence, unchanged,
 *     nothing delivered;
 *   · held under another hash → G's sentence, unchanged (a mismatched body is never served).
 *
 * Mutants this file must red (each driven by hand, quoted in CC/docs/seedling-custom-set-arm.md):
 *   · the held set ignored (`heldSet` never passed / vanilla join always) → the tree rows;
 *   · `mismatch` served → the mismatch rows;
 *   · G lifted for an unheld set → the not-held rows.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tileTypeForPlacement } from './seedlingSemantics.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { createAtlasCache, putAtlases } from '../procgenCore/atlasCache.js';
import { createLevelSetCache } from '../procgenCore/levelSetCache.js';
import { heldLevelSetOf, levelSetContentHash, levelSetReferenceOf, putLevelSets } from '../procgenCore/levelSetReference.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { stampAtlasIdentity } from '../procgenPipeline/regionAtlasValidator.js';
import { TILE_SIZE } from '../seedlingDemo/levelWorld.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import * as SA from '../seedlingDemo/seedlingSetAdapter.js';
import { emptyOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import { editorVanillaSet } from '../seedlingDemo/watchSetEditor.js';
import { WATCH_SET_ATLAS, labSetIdentity } from '../seedlingDemo/watchSetIdentity.js';
import { heldSetMapDocument, loadSeedlingRandomizer } from './seedlingRandomizerWiring.js';
import { CUSTOM_SET_NOT_PLAYABLE, unservedAtlasWhy } from './seedlingRandomizerEligibility.js';
import { seedlingMountKey } from './seedlingMountKey.js';

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

/** ⛓ The watch page's set deps (`watchSetIdentity.test.js`'s DEPS). */
const DEPS = Object.freeze({
    parseOel: parseOelLevel, tileSize: TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
    atlas: WATCH_SET_ATLAS,
});

/** A lab set through the page's own compile: the rules a door writes, and the bundle's two members. */
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
const TREE_WORLD = labWorld(withTree());

/** The host after the bundle loaded: both members held (what `presetUI.loadDocumentFile` does). */
const hostHolding = (...worlds) => {
    const levelSets = createLevelSetCache();
    const atlases = createAtlasCache();
    putLevelSets(worlds.map((w) => w.levelSet), levelSets);
    putAtlases(worlds.map((w) => w.atlas), atlases);
    return { levelSets, atlases };
};

const locationsOf = (rules) => Object.fromEntries(Object.values(rules.regions['1'])
    .flatMap((r) => r.locations ?? []).map((l) => [l.name, l]));

const load = (world, transport, host) => loadSeedlingRandomizer({
    flashPanel: world.rules.flash_panel?.['1'] ?? null, manifest: MANIFEST, transport, rawRules: world.rules,
    locations: locationsOf(world.rules), playerId: '1', gameConfig: GAME_CONFIG,
    baseUrl: pathToFileURL(fileURLToPath(FRONTEND)).href, fetchJson: diskFetch,
    importModule: (u) => import(/* @vite-ignore */ u), log: () => {}, ...host,
});

const hasTree = (room) => (room?.source?.record?.entities ?? [])
    .some((e) => e.type === TREE.type && e.x === TREE.x && e.y === TREE.y);
const roomOf = (set, id) => set.rooms.find((r) => r.id === id);

describe('S4 — the lab world is the shape the brief names', () => {
    it('S1\'s unserved id, the lab label, a flash_panel block (flipped back ON), and level_set naming the member', () => {
        const ra = TREE_WORLD.rules.region_atlas['1'];
        expect(ra.atlas_id).toMatch(/^seedling-lab-[0-9a-f]{8}$/);
        expect(ra.map_document).toBe('watch.html set editor');
        expect(TREE_WORLD.rules.flash_panel?.['1']?.wasm).toBeTruthy();
        expect(ra.level_set).toEqual({ set_id: TREE_WORLD.levelSet.set_id,
            content_hash: levelSetContentHash(TREE_WORLD.levelSet) });
        expect(hasTree(roomOf(TREE_WORLD.levelSet, 10))).toBe(true);
    });
});

describe('S4 — the inverse of p5: a HELD edited set delivers its OWN room 10, WITH the tree', () => {
    for (const transport of ['js', 'wasm']) {
        it(`${transport}: eligible, the held set is what is delivered, and room 10 has the tree`, async () => {
            const r = await load(TREE_WORLD, transport, hostHolding(TREE_WORLD));
            expect(r.why).not.toMatch(/does not serve/);
            // ⛓ a lab set names its locations by atlas region, so it is the ATLAS arm's (G7) — now DELIVERED.
            expect(r.eligibility).toMatchObject({ eligible: true, arm: 'atlas' });
            expect(r.assets.atlas).toMatchObject({ ok: true, url: `atlasCache:${TREE_WORLD.atlas.atlas_id}` });
            expect(r.delivery).not.toBeNull();
            expect(r.set.rooms).toHaveLength(116);
            expect(r.set.set_id).toBe(TREE_WORLD.levelSet.set_id);
            expect(hasTree(roomOf(r.set, 10))).toBe(true);
            // …and NOTHING else of the set moved but the placement's own rewrite: every room's geometry is the
            // held set's (tiles and non-placement entities), room for room.
            for (const room of r.set.rooms) {
                const heldRoom = roomOf(TREE_WORLD.levelSet, room.id);
                expect(room.source.record.layers).toEqual(heldRoom.source.record.layers);
            }
            // ⛓ nothing was fetched for the set: its two documents are the held one.
            expect(r.assets.recordSet).toMatchObject({ ok: true, held: TREE_WORLD.rules.region_atlas['1'].level_set });
            expect(r.assets.map.url).toBe(`levelSetCache:${TREE_WORLD.levelSet.set_id}`);
        });
    }

    it('CONTROL — the vanilla 116 through the same lab compile, held: room 10 is delivered WITHOUT the tree', async () => {
        const van = labWorld(structuredClone(VANILLA));
        const r = await load(van, 'js', hostHolding(van));
        expect(r.eligibility).toMatchObject({ eligible: true });
        expect(hasTree(roomOf(r.set, 10))).toBe(false);
    });

    it('two held sets: each load delivers its own (the host holds both, keyed apart)', async () => {
        const van = labWorld(structuredClone(VANILLA));
        const host = hostHolding(van, TREE_WORLD);
        expect(hasTree(roomOf((await load(TREE_WORLD, 'js', host)).set, 10))).toBe(true);
        expect(hasTree(roomOf((await load(van, 'js', host)).set, 10))).toBe(false);
    });
});

describe('S4 — the VANILLA arm\'s held path (p5\'s own rules: the ledger resolves, so it is not the atlas arm)', () => {
    /** G's p5 rules (`seedlingUnservedAtlasGuard.test.js`), naming the stamped set they were compiled from. */
    const p5 = () => {
        const deps = { ...DEPS, atlas: { game: 'seedling', mapDocument: 'seedling-map.json' } };
        const session = SA.createSetSession(SA.createSeedlingSetAdapter(deps),
            SA.setRecord(withTree(), read('modules/seedlingDemo/fixtures/seedling-vanilla-overlay.json')),
            { base: { kind: 'set', set_id: VANILLA.set_id } });
        const rules = SA.rulesJsonOf(session, deps, { compileRegionAtlas }).rules;
        const levelSet = SA.downloadSet(session).set;
        rules.region_atlas['1'] = { ...rules.region_atlas['1'], level_set: levelSetReferenceOf(levelSet) };
        return { rules, levelSet, atlas: { atlas_id: 'unused-p5' } };
    };
    for (const transport of ['js', 'wasm']) {
        it(`${transport}: held → eligible on the VANILLA arm, and its delivered room 10 HAS the tree`, async () => {
            const w = p5();
            const r = await load(w, transport, hostHolding(w));
            expect(r.eligibility).toMatchObject({ eligible: true, arm: 'vanilla' });
            expect(r.replaced).toBeGreaterThan(0);
            expect(hasTree(roomOf(r.set, 10))).toBe(true);
        });
    }
});

describe('S4 — G STAYS for every set that is not held (its sentence unchanged, nothing delivered)', () => {
    const expectG = (r) => {
        expect(r.eligibility).toMatchObject({ eligible: false, verdict: 'ineligible', arm: null, failed: 'atlas' });
        expect(r.why).toBe(`atlas: ${unservedAtlasWhy(TREE_WORLD.rules.region_atlas['1'].atlas_id)}`);
        expect(r.delivery).toBeNull();
        expect(r.set).toBeNull();
        expect(r.assets).toBeNull();
    };
    for (const transport of ['js', 'wasm']) {
        it(`${transport}: the rules ALONE (rules.json / the APWorld door — flash_panel + level_set, no body) → G`, async () => {
            expect(TREE_WORLD.rules.flash_panel?.['1']).toBeTruthy();
            expectG(await load(TREE_WORLD, transport, { levelSets: createLevelSetCache(), atlases: createAtlasCache() }));
        });
        it(`${transport}: a set held under that id with ANOTHER content hash → G (never served)`, async () => {
            const levelSets = createLevelSetCache();
            const other = structuredClone(TREE_WORLD.levelSet);
            other.rooms[10].source.record.entities.pop();
            levelSets.put(other.set_id, other, { contentHash: levelSetContentHash(other) });
            expect(heldLevelSetOf(TREE_WORLD.rules, '1', levelSets).status).toBe('mismatch');
            expectG(await load(TREE_WORLD, transport, { levelSets, atlases: createAtlasCache() }));
        });
    }
    it('the sentence a person reads is still G\'s (CUSTOM_SET_NOT_PLAYABLE unchanged)', () => {
        expect(CUSTOM_SET_NOT_PLAYABLE).toBe('This set can\'t be played yet');
    });
});

describe('S4 — a held set\'s map document is its own rooms', () => {
    it('levels[i] is room i\'s record, on the 16-px grid', () => {
        const doc = heldSetMapDocument(TREE_WORLD.levelSet);
        expect(doc.levels).toHaveLength(116);
        expect(doc.levels[10]).toEqual({ ...roomOf(TREE_WORLD.levelSet, 10).source.record, level: 10 });
        expect(hasTree({ source: { record: doc.levels[10] } })).toBe(true);
        expect(doc.tile_size).toBe(MAP.tile_size);
    });
    it('a room that is not record-sourced is refused by name', () => {
        const bad = structuredClone(TREE_WORLD.levelSet);
        bad.rooms[3].source = { embed: 'levels/x.oel' };
        expect(() => heldSetMapDocument(bad)).toThrow(/rooms\[3\].*not record-sourced/);
    });
});

describe('S4 — the mount key (and so the JS save) keeps a held set apart', () => {
    it('the tree set, the vanilla lab set and the vanilla preset key three ways', () => {
        const van = labWorld(structuredClone(VANILLA));
        const preset = read('presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');
        const keyOf = (rules) => seedlingMountKey({ rules, playerId: '1' });
        const keys = [keyOf(TREE_WORLD.rules), keyOf(van.rules), keyOf(preset)];
        expect(new Set(keys).size).toBe(3);
    });
});

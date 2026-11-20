/**
 * ⛓⛓ SLICE G — **A SET WHOSE REGION ATLAS THIS PAGE DOES NOT SERVE IS REFUSED BY NAME**, and is never played as the
 * original game (⚖ Robert 2026-11-20, Q1 "G + S1", Q3 "Stay empty, say why").
 *
 * ⛔ THE HAZARD IS REBUILT HERE THROUGH THE LAB'S OWN COMPILE, not typed by hand: the vanilla set with ONE tree added
 * to room 10, made into rules by `rulesJsonOf` + `compileRegionAtlas` under `atlas: {game: 'seedling',
 * mapDocument: 'seedling-map.json'}` — the one `map_document` the player accepts. Before the guard the real
 * `loadSeedlingRandomizer` answered `eligible`, arm `vanilla`, 116 rooms, and the delivered room 10 had NO tree:
 * the original room, under the set's rules, with no warning.
 *
 * ⛓ THE CONTROL ROW is the same load with `seedling` ADDED to the served index: it is eligible on the vanilla arm and
 * room 10 is delivered without the edit. That is exactly what the guard stands between, so a guard that stopped
 * firing turns the first rows red (measured as a source mutant too: CC/docs/seedling-unserved-atlas-guard.md).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SEEDLING_TILE_SIZE, tileTypeForPlacement } from './seedlingSemantics.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import * as SA from '../seedlingDemo/seedlingSetAdapter.js';
import { editorVanillaSet } from '../seedlingDemo/watchSetEditor.js';
import { loadSeedlingRandomizer } from './seedlingRandomizerWiring.js';
import { unservedAtlasWhy } from './seedlingRandomizerEligibility.js';
import { ATLAS_INDEX_FILE } from './mapDocumentPath.js';

const FRONTEND = new URL('../../', import.meta.url);
const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, FRONTEND)), 'utf8'));
const diskFetch = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));
const GAME_CONFIG = read('modules/flashPanel/games/seedling.json');
const MANIFEST = read('modules/flashPanel/wasm/builds.json');
const TREE = { type: 'tree', x: 16, y: 80 };

/** The study's p5 rules: the vanilla set, a tree added to room 10, compiled as `'seedling'`. */
function p5Rules() {
    const set = structuredClone(editorVanillaSet(read('modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        read('modules/flashPanel/atlases/seedling-map.json')).set);
    set.rooms[10].source.record.entities.push({ ...TREE });
    const deps = { parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement,
        rulesSchema: loadRulesSchema(), atlas: { game: 'seedling', mapDocument: 'seedling-map.json' } };
    const record = SA.setRecord(set, read('modules/seedlingDemo/fixtures/seedling-vanilla-overlay.json'));
    const session = SA.createSetSession(SA.createSeedlingSetAdapter(deps), record,
        { base: { kind: 'set', set_id: record.set.set_id } });
    return SA.rulesJsonOf(session, deps, { compileRegionAtlas }).rules;
}

const RULES = p5Rules();
const LOCATIONS = Object.fromEntries(Object.values(RULES.regions['1'])
    .flatMap((r) => r.locations ?? []).map((l) => [l.name, l]));

const load = (transport, fetchJson = diskFetch) => loadSeedlingRandomizer({
    flashPanel: RULES.flash_panel?.['1'] ?? null, manifest: MANIFEST, transport, rawRules: RULES,
    locations: LOCATIONS, playerId: '1', gameConfig: GAME_CONFIG,
    baseUrl: pathToFileURL(fileURLToPath(FRONTEND)).href, fetchJson,
    importModule: (u) => import(/* @vite-ignore */ u), log: () => {},
});

/** The served index with `seedling` listed too — the guard's input made to say "served". */
const servingSeedling = async (u) => {
    const doc = await diskFetch(u);
    if (!String(u).endsWith(`/${ATLAS_INDEX_FILE}`)) return doc;
    return { ...doc, atlases: [...doc.atlases, { file: 'seedling.json', atlas_id: 'seedling', game: 'seedling' }] };
};

const hasTree = (room) => (room?.source?.record?.entities ?? [])
    .some((e) => e.type === TREE.type && e.x === TREE.x && e.y === TREE.y);

describe('slice G — the p5 hazard (a tree added to room 10, compiled as `seedling`) is refused by name', () => {
    it('the rules are the measured shape: atlas id `seedling`, the vanilla map document, a flash_panel block', () => {
        expect(RULES.region_atlas['1']).toMatchObject({ atlas_id: 'seedling', map_document: 'seedling-map.json' });
        expect(RULES.flash_panel?.['1']?.wasm).toBeTruthy();
    });

    for (const transport of ['js', 'wasm']) {
        it(`${transport}: ineligible on check \`atlas\`, with the sentence, and nothing is delivered`, async () => {
            const r = await load(transport);
            expect(r.eligibility).toMatchObject({ eligible: false, verdict: 'ineligible', arm: null, failed: 'atlas' });
            expect(r.why).toBe(`atlas: ${unservedAtlasWhy('seedling')}`);
            expect(r.delivery).toBeNull();
            expect(r.set).toBeNull();
            // ⛔ refused BEFORE the two documents: the vanilla rewrite is never built.
            expect(r.assets).toBeNull();
        });
    }

    it('CONTROL — the same load with `seedling` served: eligible on the VANILLA arm, and room 10 has NO tree', async () => {
        const r = await load('js', servingSeedling);
        expect(r.eligibility).toMatchObject({ eligible: true, arm: 'vanilla' });
        expect(r.set.rooms).toHaveLength(116);
        const room10 = r.set.rooms.find((x) => x.id === 10) ?? r.set.rooms[10];
        expect(hasTree(room10)).toBe(false);
        // …while the set the rules were compiled from DOES carry it.
        expect(RULES.region_atlas['1'].atlas_id).toBe('seedling');
    });

    it('an unreadable atlas index refuses too (an id that cannot be told from a custom set\'s)', async () => {
        const r = await load('js', async (u) => {
            if (String(u).endsWith(`/${ATLAS_INDEX_FILE}`)) throw new Error('404 Not Found');
            return diskFetch(u);
        });
        expect(r.eligibility).toMatchObject({ verdict: 'ineligible', failed: 'atlas' });
        expect(r.why).toMatch(/atlas_files\.json could not be read/);
    });
});

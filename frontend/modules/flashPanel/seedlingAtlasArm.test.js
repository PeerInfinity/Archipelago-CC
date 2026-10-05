/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G7 task 2 — **THE ATLAS ARM**, in node with the
 * fetch and the importer injected. A world of REAL atlas rooms whose locations
 * the goal ledger cannot name DIVERTS (check `atlas`, decided by (iii)'s own
 * count) and is BOUND where it stands: no rewrite, no delivery, no reset, no
 * overlay. The vanilla arm keeps every world it served (seedling_playthrough
 * resolves 41 of 41 with 250 real-room sidecars; stage 1 has none), and the
 * generated arm still diverts first and still refuses a mixed world. The two
 * other arms' own rows live in `seedlingRandomizerWiring.test.js` and
 * `seedlingGeneratedArm.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { placementKey } from '../seedlingDemo/apPlacementRewriter.js';
import { atlasRoomRegions } from '../seedlingDemo/seedlingAtlasCheckTable.js';
import { generatedRoomCensus } from '../seedlingDemo/seedlingGenRoomPayload.js';
import {
    AP_ITEM_CAPABILITY, RANDOMIZER_ARMS, seedlingRandomizerEligibility,
} from './seedlingRandomizerEligibility.js';
import {
    AP_ATLAS_MODULE_PATHS, loadSeedlingAtlas, loadSeedlingRandomizer, runSeedlingRandomizerLoad,
} from './seedlingRandomizerWiring.js';
import { SeedlingCheckBinding } from './seedlingCheckBinding.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const BASE = pathToFileURL(join(ROOT, 'frontend/')).href;
const MANIFEST = readJson('frontend/modules/flashPanel/wasm/builds.json');
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const rulesOf = (id) => readJson(id === 'seedling'
    ? 'frontend/presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json'
    : `frontend/presets/${id}/AP_1/AP_1_rules.json`);
const PIPELINE_REAL_ROOM_PRESETS = Object.freeze(['seedling_atlas', 'seedling_spiral_room', 'seedling_sphere_room',
    'seedling_atlas_host', 'seedling_atlas_location']);

const locationsMapOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [regionName, region] of Object.entries(rules.regions[slot])) {
            for (const loc of region.locations ?? []) out.set(loc.name, { ...loc, region: regionName });
        }
    }
    return out;
};
const diskFetch = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));

const load = (rules, over = {}) => {
    const logs = [];
    const imports = [];
    return loadSeedlingRandomizer({
        flashPanel: rules.flash_panel,
        manifest: MANIFEST,
        rawRules: rules,
        locations: locationsMapOf(rules),
        playerId: '1',
        gameConfig: GAME_CONFIG,
        baseUrl: BASE,
        fetchJson: diskFetch,
        importModule: (u) => { imports.push(u); return import(/* @vite-ignore */ u); },
        log: (m, cls) => logs.push([m, cls ?? null]),
        ...over,
    }).then((r) => ({ r, logs, imports }));
};

const WASM = {
    flashPanel: { config: 'seedling.json', wasm: 'seedling_bot_ap_p4d/game.html' },
    transport: 'wasm',
    manifest: { builds: [{ name: 'seedling_bot_ap_p4d', capabilities: [AP_ITEM_CAPABILITY] }] },
};
const ASSETS = { recordSet: { url: '/a', ok: true }, map: { url: '/b', ok: true, source: 'x' } };

describe('the sixth fact — `atlas`, decided by (iii)\'s own count', () => {
    it('undecided at the cheap call (no count yet), exactly as before', () => {
        const v = seedlingRandomizerEligibility({ ...WASM, generated: { rooms: [], mixed: [] },
            atlas: { rooms: ['starting_house'] } });
        expect(v).toMatchObject({ verdict: 'undecided', arm: null });
        expect(v.why).toMatch(/^atlas: the rules carry 1 real Seedling room\(s\), and the goal ledger has not been resolved yet/);
    });

    it('real rooms and 0 resolved DIVERT: eligible on the atlas arm, placement and assets skipped', () => {
        const v = seedlingRandomizerEligibility({ ...WASM, atlas: { rooms: ['starting_house'] },
            placement: { resolved: 0, total: 41 }, assets: ASSETS });
        expect(v).toMatchObject({ eligible: true, verdict: 'eligible', arm: RANDOMIZER_ARMS.ATLAS, failed: null });
        expect(v.checks.map((c) => [c.id, c.status])).toEqual([
            ['transport', 'pass'], ['capability', 'pass'], ['generated', 'pass'], ['atlas', 'divert'],
            ['placement', 'skipped'], ['assets', 'skipped']]);
    });

    it('ANY resolved ledger row keeps the vanilla arm — real rooms or not', () => {
        const v = seedlingRandomizerEligibility({ ...WASM, atlas: { rooms: ['level_10'] },
            placement: { resolved: 41, total: 41 }, assets: ASSETS });
        expect(v).toMatchObject({ verdict: 'eligible', arm: RANDOMIZER_ARMS.VANILLA });
        expect(v.checks.find((c) => c.id === 'atlas').why).toMatch(/41 goal-ledger location\(s\) resolve — the vanilla placement applies/);
    });

    it('no real rooms and 0 resolved is still the (iii) refusal, by count', () => {
        const v = seedlingRandomizerEligibility({ ...WASM, atlas: { rooms: [] },
            placement: { resolved: 0, total: 41 }, assets: ASSETS });
        expect(v).toMatchObject({ verdict: 'ineligible', failed: 'placement' });
    });

    it('a MIXED world is still refused at `generated`, before `atlas` is asked', () => {
        const v = seedlingRandomizerEligibility({ ...WASM, generated: { rooms: ['g'], mixed: ['r'] },
            atlas: { rooms: ['r'] }, placement: { resolved: 0, total: 41 }, assets: ASSETS });
        expect(v).toMatchObject({ verdict: 'ineligible', failed: 'generated' });
    });

    it('the census is DATA: every committed preset, by its sidecars', () => {
        for (const id of PIPELINE_REAL_ROOM_PRESETS) {
            expect(atlasRoomRegions(rulesOf(id)).length, id).toBeGreaterThan(0);
            expect(generatedRoomCensus(rulesOf(id)).rooms, id).toEqual([]);
        }
        // ⛓ RULES logical-links: 250 -> 247, three pockets only a model-sealed True_ row reached are pruned.
        // ⛓ RULES burnable-trees: 247 -> 251, four sub-regions split off along the burnable trees (L12, L37, L40, L44).
        expect(atlasRoomRegions(rulesOf('seedling_playthrough'))).toHaveLength(251);
        expect(atlasRoomRegions(rulesOf('seedling'))).toHaveLength(0);
        expect(atlasRoomRegions(rulesOf('seedling_generated_room'))).toHaveLength(0);
    });
});

describe('loadSeedlingRandomizer hands the four pipeline real-room worlds to the atlas arm', () => {
    it.each(PIPELINE_REAL_ROOM_PRESETS)('%s: eligible on the atlas arm, nothing to deliver', async (id) => {
        const { r, logs, imports } = await load(rulesOf(id));
        expect(r.verdict, r.why).toBe('eligible');
        expect(r).toMatchObject({ arm: RANDOMIZER_ARMS.ATLAS, delivery: null, set: null, replaced: 0,
            selfPlayer: 1, tileSize: 16 });
        expect(r.checkBinding).toBeInstanceOf(SeedlingCheckBinding);
        expect(r.assets.atlas).toMatchObject({ ok: true, atlasId: rulesOf(id).region_atlas.atlas_id });
        expect(imports.some((u) => u.endsWith(AP_ATLAS_MODULE_PATHS.levelWorld))).toBe(true);
        expect(logs.at(-1)[0]).toMatch(/^\[ap placement\] atlas arm: \d+ real room\(s\), \d+ of \d+ location\(s\) bound where they stand/);
    });

    it('seedling_atlas: Starting House - Chest, owned by the host; the chest\'s report checks it ONCE', async () => {
        const { r } = await load(rulesOf('seedling_atlas'));
        expect([...r.table.keys()]).toEqual([placementKey(86, 0)]);
        expect([...r.checkBinding.hostOwnedLocations()]).toEqual(['Starting House - Chest']);
        const fx = r.checkBinding.onStateReport('pendingCheck', '1|86|0|0');
        expect(fx).toEqual([
            expect.objectContaining({ type: 'locationCheck', location: 'Starting House - Chest', level: 86, tag: 0 }),
            expect.objectContaining({ type: 'apItemFound', location: 'Starting House - Chest', item: 'Seal',
                player: 1, forSelf: true }),
        ]);
        expect(r.checkBinding.onStateReport('pendingCheck', '2|86|0|0')).toEqual([]);
        // A restore and a foreign address check nothing.
        expect(r.checkBinding.onStateReport('pendingCheck', '3|86|0|1')).toEqual([]);
        expect(r.checkBinding.onStateReport('pendingCheck', '4|0|0|0')).toEqual([]);
    });

    it('seedling_atlas_location: the chest checks Starting House - Chest and FINDS key_blue for this player', async () => {
        const { r } = await load(rulesOf('seedling_atlas_location'));
        expect([...r.checkBinding.hostOwnedLocations()]).toEqual(['Starting House - Chest']);
        expect(r.checkBinding.onStateReport('pendingCheck', '1|86|0|0')).toEqual([
            expect.objectContaining({ type: 'locationCheck', location: 'Starting House - Chest' }),
            expect.objectContaining({ type: 'apItemFound', item: 'key_blue', player: 1, forSelf: true }),
        ]);
    });

    it('seedling_atlas_location is a FUNCTION of SEEDLING_ATLAS_LOCATION_STATE (the committed bytes, rebuilt headless)', async () => {
        const { REGISTRY_LIBRARIES } = await import('../../../scripts/procgen/reference/registry.mjs');
        for (const rel of REGISTRY_LIBRARIES) {
            // eslint-disable-next-line no-await-in-loop
            await import(join(ROOT, rel));
        }
        const { buildRunFromState, runPresetHeadless } = await import('../procgenPipeline/presetRun.js');
        const { SEEDLING_ATLAS_LOCATION_STATE } = await import('../procgenPipeline/presetDefs.js');
        const { rulesJson } = await runPresetHeadless(buildRunFromState(structuredClone(SEEDLING_ATLAS_LOCATION_STATE)));
        expect(JSON.stringify(rulesJson, null, 2)).toBe(readFileSync(
            join(ROOT, 'frontend/presets/seedling_atlas_location/AP_1/AP_1_rules.json'), 'utf8'));
    }, 60000);

    it.each(['seedling_spiral_room', 'seedling_sphere_room', 'seedling_atlas_host'])(
        '%s: its real room holds no location — the arm binds an EMPTY table and owns nothing', async (id) => {
            const { r } = await load(rulesOf(id));
            expect(r.table.size).toBe(0);
            expect(r.checkBinding.hostOwnedLocations().size).toBe(0);
        });

    it('the vanilla arm keeps its worlds: seedling_playthrough (250 real-room sidecars, 41 resolve) and stage 1', async () => {
        for (const id of ['seedling_playthrough', 'seedling']) {
            // eslint-disable-next-line no-await-in-loop
            const { r } = await load(rulesOf(id));
            expect(r.verdict, `${id}: ${r.why}`).toBe('eligible');
            expect(r.arm, id).toBeUndefined();
            expect(r.delivery, id).not.toBeNull();
            expect(r.eligibility.arm, id).toBe(RANDOMIZER_ARMS.VANILLA);
        }
    });

    it('a refused location is LOGGED BY NAME and the world still binds the rest', async () => {
        const rules = rulesOf('seedling_atlas');
        const map = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
        const chest = map.levels.find((l) => l.level === 86).entities.find((e) => e.type === 'chest');
        delete chest.attrs.tag;
        const { r, logs } = await load(rules, {
            fetchJson: async (u) => (u.endsWith('seedling-map.json') ? structuredClone(map) : diskFetch(u)),
        });
        expect(r.verdict).toBe('eligible');
        expect(r.table.size).toBe(0);
        expect(r.refused).toHaveLength(1);
        const warn = logs.find(([m]) => /is NOT bound/.test(m));
        expect(warn[0]).toMatch(/"Starting House - Chest" \(starting_house\) is NOT bound — the chest in level 86 carries no persistence tag/);
        expect(warn[1]).toBe('warn');
        expect(logs.at(-1)[0]).toMatch(/0 of 1 location\(s\) bound .*; 1 refused by name/);
    });

    it('an atlas the index does not list is refused by sentence, before anything is bound', async () => {
        const rules = rulesOf('seedling_atlas');
        rules.region_atlas.atlas_id = 'seedling-nowhere';
        const { r } = await load(rules);
        expect(r).toMatchObject({ verdict: 'ineligible', arm: RANDOMIZER_ARMS.ATLAS, checkBinding: null });
        expect(r.why).toMatch(/^atlas: the atlas index lists no atlas "seedling-nowhere"/);
    });

    it('loadSeedlingAtlas refuses a verdict that does not name its arm, and a blank slot', async () => {
        const none = await loadSeedlingAtlas({ eligibility: { eligible: true, arm: RANDOMIZER_ARMS.VANILLA } });
        expect(none.why).toMatch(/does not name the atlas arm/);
        const blank = await loadSeedlingAtlas({ eligibility: { eligible: true, arm: RANDOMIZER_ARMS.ATLAS }, playerId: '' });
        expect(blank.why).toMatch(/is not an integer player id/);
    });
});

describe('runSeedlingRandomizerLoad with no delivery: bind at once, no overlay, no reset', () => {
    it('binds the table and does nothing else', async () => {
        const { r: loaded } = await load(rulesOf('seedling_atlas'));
        const order = [];
        const overlay = { calls: [], show() { this.calls.push('show'); }, hide() { this.calls.push('hide'); },
            setText(t) { this.calls.push(`text:${t}`); } };
        const glue = {
            setDelivery() { order.push('setDelivery'); },
            setCheckBinding(b) { order.push('setCheckBinding'); this.bound = b; },
        };
        const teleports = [];
        const logs = [];
        const res = await runSeedlingRandomizerLoad({
            loaded, glue, overlay, teleport: (t) => teleports.push(t), bot: () => { throw new Error('no bot call'); },
            log: (m) => logs.push(m), waitFrame: async () => {},
        });
        expect(res).toMatchObject({ ok: true, why: null, reset: null, delivered: null });
        expect(res.steps.map((s) => s.name)).toEqual(['bind']);
        expect(order).toEqual(['setCheckBinding']);
        expect(glue.bound).toBe(loaded.checkBinding);
        expect(overlay.calls).toEqual([]);
        expect(teleports).toEqual([]);
        expect(logs).toEqual(['[ap placement] 1 location(s) bound on the atlas arm — nothing delivered, nothing reset']);
    });
});

// ── Seedling JS J3: the atlas arm on the JS runtime ─────────────────────────

describe('⛓ J3 — the atlas arm on the Seedling JS runtime (transport js, no manifest)', () => {
    it('seedling_atlas_location loads on the ATLAS arm with no wasm manifest: bound, no delivery, no tag', async () => {
        const rules = rulesOf('seedling_atlas_location');
        const { r } = await load(rules, { transport: 'js', manifest: null });
        expect(r).toMatchObject({ verdict: 'eligible', arm: RANDOMIZER_ARMS.ATLAS, delivery: null, set: null });
        expect(r.entries.map((e) => [e.location, e.level, e.tag, e.entityType]))
            .toEqual([['Starting House - Chest', 86, 0, 'chest']]);
        expect(r.retags).toEqual([]);
    });

    it('⛓ §5.18: a VANILLA-arm world (seedling_playthrough: 41/41 resolve) LOADS on js — the rewritten set, no manifest', async () => {
        const { r } = await load(rulesOf('seedling_playthrough'), { transport: 'js', manifest: null });
        expect(r).toMatchObject({ verdict: 'eligible' });
        expect(r.eligibility.arm).toBe(RANDOMIZER_ARMS.VANILLA);
        expect(r.delivery).not.toBeNull();
        expect(r.replaced).toBe(r.table.size);
    });

    it('⛔ the wasm answers do not move: the same atlas preset with the manifest, transport defaulted', async () => {
        const { r } = await load(rulesOf('seedling_atlas_location'));
        expect(r).toMatchObject({ verdict: 'eligible', arm: RANDOMIZER_ARMS.ATLAS });
    });
});

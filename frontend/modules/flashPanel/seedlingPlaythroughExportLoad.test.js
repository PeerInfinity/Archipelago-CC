/**
 * ⛓ THE SEED-1 EXPORT DRIVES THE WASM PAGE AS AP_1 DOES — `seedling_playthrough`.
 *
 * The committed seed-1 export (`Generate.py` over `worlds/seedling_playthrough`) is the preset the
 * Presets panel lists for this game. Its page blocks — `flash_panel`, `region_atlas` and
 * `preset_sidecars` — reach it only through the Python round trip: world_generator writes the slot's
 * blocks into the package (`_worldgen_*.json`) and the export handler re-injects them by presence.
 * Before that, the export shipped none of the three, and the page stopped at "no game configured".
 *
 * ⛔ THE FIXTURE IS THE PRODUCTION LOAD (`loadSeedlingRandomizer` + `realRoomPlaybackMap`, the
 * `seedlingVanillaArmMap.test.js` arrangement) over AP_1 and over the export, compared value for value:
 * the delivered record set and placement table by md5, the bot map's regions / doors / links, and the
 * location goals. Nothing is typed from a measurement, so a moved ledger row moves both sides.
 * Then each block is dropped from the export IN MEMORY: every drop must change the result, so the
 * next regeneration that silently loses one is red here.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { realRoomPlaybackMap, resolveSeedlingAtlasGoal } from './seedlingPlaybackController.js';
import { loadSeedlingRandomizer } from './seedlingRandomizerWiring.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const BASE = pathToFileURL(abs('../../')).href;
const GAME_CONFIG = readJson('./games/seedling.json');
const MANIFEST = readJson('./wasm/builds.json');
const fetchJson = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));

const PRESETS = '../../presets/seedling_playthrough';
const AP1 = readJson(`${PRESETS}/AP_1/AP_1_rules.json`);
const INDEX = readJson('../../presets/preset_files.json');
// The seed-1 folder, read off the preset index (not typed): the folder whose `seed` is 1.
const SEED1_FOLDER = Object.entries(INDEX.seedling_playthrough.folders).find(([, f]) => f.seed === 1)?.[0];
const EXPORT = readJson(`${PRESETS}/${SEED1_FOLDER}/${SEED1_FOLDER}_rules.json`);
const PAGE_BLOCKS = ['flash_panel', 'region_atlas', 'preset_sidecars'];
const SLOT = '1';

const md5 = (x) => createHash('md5').update(JSON.stringify(x)).digest('hex');
const entriesOf = (t) => (t instanceof Map ? [...t] : Object.entries(t ?? {}));
const locationsOf = (rules) => {
    const out = new Map();
    for (const [region, r] of Object.entries(rules.regions[SLOT])) {
        for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
    }
    return out;
};

/** What the page and the bot get from `rules`: the load's verdict, its delivered set and table, the bot map. */
async function pageLoad(rules) {
    const flashPanel = rules.flash_panel?.[SLOT] ?? null;
    if (!flashPanel?.wasm) return { verdict: 'no game configured' };
    const L = await loadSeedlingRandomizer({
        flashPanel, manifest: MANIFEST, rawRules: rules, locations: locationsOf(rules), playerId: SLOT,
        gameConfig: GAME_CONFIG, baseUrl: BASE, fetchJson, importModule: (u) => import(/* @vite-ignore */ u),
    });
    const out = { verdict: L.verdict, setMd5: md5(L.set ?? null), tableMd5: md5(entriesOf(L.table)) };
    const M = realRoomPlaybackMap(L, rules);
    if (!M) return out;
    let goals = 0;
    let real = 0;
    for (const [name, loc] of locationsOf(rules)) {
        if (loc.id === null || loc.id === undefined) continue;
        real++;
        if (resolveSeedlingAtlasGoal({ kind: 'location', name }, M, { region: loc.region }).goal) goals++;
    }
    let doors = 0;
    for (const [region, r] of Object.entries(rules.regions[SLOT])) {
        for (const e of r.exits ?? []) {
            if (resolveSeedlingAtlasGoal({ kind: 'exit', name: e.name }, M, { region }).goal) doors++;
        }
    }
    return { ...out, mapRegions: M.regions.size, mapLinks: M.links.length, doors, locationGoals: `${goals}/${real}` };
}

const AP1_LOAD = await pageLoad(AP1);
const EXPORT_LOAD = await pageLoad(EXPORT);

describe('the seedling_playthrough seed-1 export drives the wasm page as AP_1 does', () => {
    // ⛓ R4b (rules-boss-locations): every location a goal BUT the seven boss kills, which the vanilla arm refuses
    //   by name until the bot has a fight executor (`BOSS_REPORT_REFUSAL`; R4b part 2 / fidelity).
    it('the premise: AP_1 loads eligible, with a bot map and every location a goal but the seven boss kills', () => {
        expect(AP1_LOAD.verdict).toBe('eligible');
        expect(AP1_LOAD.mapRegions).toBeGreaterThan(0);
        expect(AP1_LOAD.mapLinks).toBeGreaterThan(0);
        const [goals, real] = AP1_LOAD.locationGoals.split('/');
        expect(Number(real) - Number(goals)).toBe(7);
    });

    it.each(PAGE_BLOCKS)('the export carries AP_1\'s `%s` for its slot, as a per-slot map', (key) => {
        expect(Object.keys(EXPORT[key] ?? {})).toEqual([SLOT]);
        expect(EXPORT[key][SLOT]).toEqual(AP1[key][SLOT]);
    });

    it('the export\'s production load equals AP_1\'s: delivered set, placement table, bot map, goals', () => {
        expect(EXPORT_LOAD).toEqual(AP1_LOAD);
    });

    it.each(PAGE_BLOCKS)('MUTANT: the export without `%s` (in memory) no longer loads as AP_1', async (key) => {
        const mutant = structuredClone(EXPORT);
        delete mutant[key];
        expect(await pageLoad(mutant)).not.toEqual(AP1_LOAD);
    });
});

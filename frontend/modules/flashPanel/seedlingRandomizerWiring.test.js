/**
 * P1-b — the lazy constructor, the JOIN, and the FILTERED ledger (EDITOR
 * INTEGRATION slice P1; plan §17.1.4, §17.2.5, §17.5).
 *
 * ⛔ THE THREE SHIPPED PRESETS ARE THE FIXTURES, LOADED THE WAY PRODUCTION
 * LOADS THEM — a `Map` of location name → the record `stateManager`'s
 * `getStaticData().locations` holds, built here by the same rule
 * `stateManager/core/initialization.js:298` uses (spread the region's location
 * object, key it by `name`). ⚠ A row below measures that rule against the real
 * builder rather than trusting this restatement.
 *
 * ⛓ AND THE IMPORTER IS INJECTED, so these rows run in node with no browser
 * and no bundler: `importModule` is handed node's own `import()` over a file
 * URL, `fetchJson` reads the two documents off disk. What the browser adds is
 * only the transport — which P1-e measures on the real page.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildPlacementTable, placementKey } from '../seedlingDemo/apPlacementRewriter.js';
import { R7_GOAL_LEDGER } from '../seedlingDemo/r7Acceptance.js';
import { SeedlingLevelSetDelivery } from './seedlingLevelSetDelivery.js';
import { SeedlingCheckBinding } from './seedlingCheckBinding.js';
import {
    AP_ASSET_PATHS,
    AP_MODULE_PATHS,
    LEDGER_FLASH_NAME_REMAINDER,
    buildLocationResolver,
    flashNameForLedgerRow,
    loadSeedlingRandomizer,
    resolveMapPath,
    selfPlayerOf,
} from './seedlingRandomizerWiring.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

/** The document base a browser would use: `frontend/`. */
const BASE = pathToFileURL(abs('../../')).href;

const GAME_CONFIG = readJson('./games/seedling.json');
const MAP = readJson('./atlases/seedling-map.json');
const MANIFEST_PATH = './wasm/builds.json';
const RULES = {
    seedling: readJson('../../presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json'),
    seedling_atlas: readJson('../../presets/seedling_atlas/AP_1/AP_1_rules.json'),
    seedling_playthrough: readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json'),
};

/**
 * ⛓ THE PRODUCTION SHAPE, BUILT BY THE PRODUCTION RULE. `initialization.js`
 * spreads each region's location object and keys it by `name`; the record
 * therefore carries BOTH `item {name, player}` and `id`, which is what makes
 * the AP-id path possible at all.
 */
const locationsMapOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [regionName, region] of Object.entries(rules.regions[slot])) {
            for (const loc of region.locations ?? []) {
                out.set(loc.name, { ...loc, region: regionName, parent_region_name: regionName });
            }
        }
    }
    return out;
};

const ROOMS_BY_LEVEL = new Map(MAP.levels.map((r) => [r.level, r]));
const DERIV = await import('../seedlingDemo/seedlingAtlasDerivation.js');
const RESOLVER_DEPS = {
    entityForLedgerRow: DERIV.entityForLedgerRow,
    itemForTag: DERIV.ITEM_FOR_TAG,
    labelFor: DERIV.labelFor,
    levelName: DERIV.levelName,
};

const resolverFor = (preset) => buildLocationResolver({
    ledger: R7_GOAL_LEDGER,
    gameConfig: GAME_CONFIG,
    locations: locationsMapOf(RULES[preset]),
    roomsByLevel: ROOMS_BY_LEVEL,
    deps: RESOLVER_DEPS,
});

describe('the ledger row → flash_name derivation', () => {
    const AP_NAMES = new Set(GAME_CONFIG.ap_locations.map((l) => l.flash_name));
    const FLASH_FOR_AP_NAME = new Map(GAME_CONFIG.locations.map((l) => [l.ap_name, l.flash_name]));
    const nameOf = (row) => flashNameForLedgerRow(row, {
        apLocationNames: AP_NAMES,
        itemForTag: DERIV.ITEM_FOR_TAG,
        flashNameForApName: FLASH_FOR_AP_NAME,
        entityForLedgerRow: DERIV.entityForLedgerRow,
        roomsByLevel: ROOMS_BY_LEVEL,
    });
    const byId = Object.fromEntries(R7_GOAL_LEDGER.map((r) => [r.id, nameOf(r)]));

    it('EVERY ledger row derives a flash_name, and they do not collide', () => {
        const names = R7_GOAL_LEDGER.map((r) => nameOf(r));
        expect(names.filter((n) => n === null)).toEqual([]);
        expect(new Set(names).size).toBe(names.length);
    });

    it('a key names itself out of its own id, and a totem out of its ENTITY', () => {
        expect(byId['bosskey0@L19']).toBe('key0');
        expect(byId['bosskey4@L67']).toBe('key4');
        // ⛔ The totem index is NOT the ledger row's order: the row at L39 is
        // totem 2. Only the entity's `@totempart` says so.
        expect(byId['totempart@L39:72,40']).toBe('totem2');
        expect(byId['totempart@L40:64,144']).toBe('totem0');
    });

    it('a chest names its LEVEL, and the 16 levels are exactly the 16 chestNN entries', () => {
        const fromLedger = new Set(R7_GOAL_LEDGER.filter((r) => r.kind === 'chest')
            .map((r) => `chest${r.level}`));
        const fromConfig = new Set(GAME_CONFIG.ap_locations
            .map((l) => l.flash_name).filter((n) => /^chest\d+$/.test(n)));
        expect(fromLedger).toEqual(fromConfig);
    });

    /**
     * ⛓ THE ONE DERIVED HOP, AND WHY NO ALIAS IS TYPED. `torchpickup` is not an
     * `ap_locations` name; `ITEM_FOR_TAG.torchpickup` is `"Light"`, and the
     * game config's own property table maps `"Light"` → `torch`.
     */
    it('torchpickup reaches `torch` THROUGH THE ITEM NAME, not through a table', () => {
        expect(DERIV.ITEM_FOR_TAG.torchpickup).toBe('Light');
        expect(byId['torchpickup@L30']).toBe('torch');
    });

    it('the explicit remainder table is EMPTY, and this row is what keeps it so', () => {
        expect(Object.keys(LEDGER_FLASH_NAME_REMAINDER)).toEqual([]);
    });

    it('exactly ONE derived name is absent from ap_locations: the Seed', () => {
        const missing = R7_GOAL_LEDGER.filter((r) => !AP_NAMES.has(nameOf(r))).map((r) => r.id);
        expect(missing).toEqual(['seed@L115']);
    });
});

describe('the per-preset census — direct, via the AP id, unjoined', () => {
    it('seedling_playthrough: 41 DIRECT, nothing joined by id, nothing dropped', () => {
        const { census, ledgerUsed } = resolverFor('seedling_playthrough');
        expect(census).toMatchObject({ direct: 41, viaApId: 0, total: 41 });
        expect(census.unjoined).toEqual([]);
        expect(ledgerUsed).toHaveLength(R7_GOAL_LEDGER.length);
    });

    it('seedling (stage 1): 0 direct, 40 VIA THE AP ID, and only the Seed dropped', () => {
        const { census, ledgerUsed } = resolverFor('seedling');
        expect(census).toMatchObject({ direct: 0, viaApId: 40, total: 41 });
        expect(census.unjoined).toEqual(['seed@L115 (seed)']);
        expect(ledgerUsed).toHaveLength(40);
    });

    it('seedling_atlas: one location, nothing joins ⇒ the (iii) refusal', () => {
        const { census } = resolverFor('seedling_atlas');
        expect(census.direct + census.viaApId).toBe(0);
        expect(census.unjoined).toHaveLength(41);
    });

    /**
     * ⛔⛔ THE MUTANT THIS FILE IS BUILT AROUND: `locationItemOf` MUST read the
     * loaded rules and not a stand-in. Mutate ONE location's item in the rules
     * document and the resolver's answer must move with it — a resolver that
     * had quietly used the fixture's own placement would be unmoved.
     */
    it('locationItemOf reads THE LOADED RULES — a mutated item moves the answer', () => {
        const rules = structuredClone(RULES.seedling);
        const [slot] = Object.keys(rules.regions);
        let target = null;
        for (const region of Object.values(rules.regions[slot])) {
            for (const loc of region.locations ?? []) {
                if (loc.name === "Penguin's Feather") { target = loc; }
            }
        }
        expect(target).not.toBeNull();
        const before = resolverFor('seedling').locationItemOf('Level 089 - Feather');
        target.item = { ...target.item, name: 'A DIFFERENT ITEM', player: 7 };
        const after = buildLocationResolver({
            ledger: R7_GOAL_LEDGER,
            gameConfig: GAME_CONFIG,
            locations: locationsMapOf(rules),
            roomsByLevel: ROOMS_BY_LEVEL,
            deps: RESOLVER_DEPS,
        }).locationItemOf('Level 089 - Feather');
        expect(before).not.toEqual(after);
        expect(after).toEqual({ name: 'A DIFFERENT ITEM', player: 7 });
    });
});

describe('`selfPlayer` — the M1-b trap', () => {
    it('accepts a slot, refuses the blanks Number() turns into 0', () => {
        expect(selfPlayerOf('1')).toBe(1);
        expect(selfPlayerOf(2)).toBe(2);
        for (const blank of ['', '  ', null, undefined, 'p1', '1.5', NaN]) {
            expect(selfPlayerOf(blank), JSON.stringify(blank)).toBeNull();
        }
    });
});

describe('the map document is NAMED by the preset when the preset names one', () => {
    it('takes region_atlas.map_document, and says where the answer came from', () => {
        expect(resolveMapPath(RULES.seedling_playthrough))
            .toEqual({ path: `${AP_ASSET_PATHS.atlasDir}seedling-map.json`,
                source: 'region_atlas.map_document' });
    });

    it('falls back to the atlases default for a preset with no region_atlas', () => {
        expect(resolveMapPath(RULES.seedling).source).toBe('the atlases default');
        expect(resolveMapPath(RULES.seedling).path).toBe(AP_ASSET_PATHS.defaultMap);
    });

    it('both answers name the SAME document for every shipped seedling preset', () => {
        const paths = new Set(Object.values(RULES).map((r) => resolveMapPath(r).path));
        expect([...paths]).toEqual([AP_ASSET_PATHS.defaultMap]);
    });
});

/**
 * ⛔⛔ THE PRODUCTION BUILDER, NOT A RESTATEMENT OF IT. Every row above builds
 * the locations Map by the rule `stateManager/core/initialization.js:298`
 * uses; this block builds it with THAT FILE, by constructing the real
 * `StateManager` the worker constructs (`stateManagerWorker.js:460` —
 * `new StateManager(evaluateRule, workerLoggerInstance, commandQueue)`) and
 * reading `getStaticGameData()`, which is verbatim what the worker posts to
 * the proxy as `newStaticData` and what `getStaticData()` then answers.
 *
 * ⛓ MEASURED: it runs in node with no worker and no browser. The one thing
 * the panel adds is the structured-clone round trip, which turns the Map into
 * an array and back (`stateManagerProxy.js:398-404`) — a shape P1-e asserts on
 * the live page, because that is the only place it exists.
 */
describe('the REAL stateManager builder, driven in node', () => {
    const manifest = readJson(MANIFEST_PATH);
    const fetchJson = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));

    const staticDataFor = async (preset) => {
        const { StateManager } = await import('../stateManager/stateManager.js');
        const { evaluateRule } = await import('../shared/ruleEngine.js');
        const { workerLoggerInstance } = await import('../../app/core/universalLogger.js');
        const sm = new StateManager(evaluateRule, workerLoggerInstance);
        sm.loadFromJSON(structuredClone(RULES[preset]), Object.keys(RULES[preset].regions)[0]);
        return sm.getStaticGameData();
    };

    it('answers `locations` as a Map of name -> {id, item{name, player}}', async () => {
        const sd = await staticDataFor('seedling');
        expect(sd.locations).toBeInstanceOf(Map);
        expect(typeof sd.playerId).toBe('string');
        expect(sd.flash_panel).toEqual(RULES.seedling.flash_panel);
        const rec = sd.locations.get("Penguin's Feather");
        expect(rec.id).toBe(20000000);
        expect(rec.item).toMatchObject({ name: expect.any(String), player: 1 });
    });

    it('and the whole load runs off it, for all three presets, with the census intact', async () => {
        const want = {
            seedling: { verdict: 'eligible', direct: 0, viaApId: 40 },
            seedling_playthrough: { verdict: 'eligible', direct: 41, viaApId: 0 },
            seedling_atlas: { verdict: 'ineligible', direct: 0, viaApId: 0 },
        };
        for (const [preset, expected] of Object.entries(want)) {
            const sd = await staticDataFor(preset);
            const r = await loadSeedlingRandomizer({
                flashPanel: sd.flash_panel,
                manifest,
                rawRules: RULES[preset],
                locations: sd.locations,
                playerId: sd.playerId,
                gameConfig: GAME_CONFIG,
                baseUrl: BASE,
                fetchJson,
                importModule: (u) => import(/* @vite-ignore */ u),
            });
            expect(r.verdict, `${preset}: ${r.why}`).toBe(expected.verdict);
            if (expected.verdict === 'eligible') {
                expect(r.census, preset).toMatchObject(
                    { direct: expected.direct, viaApId: expected.viaApId });
            }
        }
    });
});

describe('the whole construction, driven in node', () => {
    const manifest = readJson(MANIFEST_PATH);
    const fetchJson = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));
    const importModule = (u) => import(/* @vite-ignore */ u);

    const load = (preset, over = {}) => loadSeedlingRandomizer({
        flashPanel: RULES[preset].flash_panel,
        manifest,
        rawRules: RULES[preset],
        locations: locationsMapOf(RULES[preset]),
        playerId: Object.keys(RULES[preset].regions)[0],
        gameConfig: GAME_CONFIG,
        baseUrl: BASE,
        fetchJson,
        importModule,
        ...over,
    });

    /**
     * ⛔⛔ THE EQUALITY ROW. The table built through the REAL resolver over the
     * REAL rules must be the table `verify-seedling-ap-placement.mjs` builds
     * from the same three documents — same addresses, same items, same looks.
     * Nothing here is compared against a literal.
     */
    it('seedling_playthrough: the table EQUALS the verifier\'s, and `replaced` agrees', async () => {
        const r = await load('seedling_playthrough');
        expect(r.verdict, r.why).toBe('eligible');

        const placed = new Map();
        const [slot] = Object.keys(RULES.seedling_playthrough.regions);
        for (const region of Object.values(RULES.seedling_playthrough.regions[slot])) {
            for (const loc of region.locations ?? []) {
                placed.set(loc.name, { name: loc.item.name, player: loc.item.player });
            }
        }
        const { table: want } = buildPlacementTable({
            locationItemOf: (n) => placed.get(n) ?? null,
            ledger: R7_GOAL_LEDGER,
            rooms: MAP.levels,
            selfPlayer: Number(slot),
        });
        expect([...r.table.keys()].sort()).toEqual([...want.keys()].sort());
        for (const [k, v] of want) expect(r.table.get(k)).toEqual(v);
        expect(r.replaced).toBe(39);
    });

    it('it hands back a delivery ARMED with its own companion, and a check binding', async () => {
        const r = await load('seedling_playthrough');
        expect(r.delivery).toBeInstanceOf(SeedlingLevelSetDelivery);
        expect(r.delivery.state).toBe('armed');
        expect(r.invalidation.set_id).toBe(r.set.set_id);
        expect(r.checkBinding).toBeInstanceOf(SeedlingCheckBinding);
        expect(r.checkBinding.selfPlayer).toBe(1);
        expect(r.checkBinding.placementKey).toBe(placementKey);
    });

    it('seedling (stage 1) is ELIGIBLE through the AP id, on a FILTERED ledger', async () => {
        const r = await load('seedling');
        expect(r.verdict, r.why).toBe('eligible');
        expect(r.census).toMatchObject({ direct: 0, viaApId: 40 });
        expect(r.replaced).toBe(38);
    });

    /**
     * ⛓ THE DROPPED ROW STAYS ON THE PROPERTY PATH. `hostOwnedLocations()` is
     * built from the table, so a filtered row cannot be in it — which is the
     * adapter's stand-down contract (H6) doing exactly what it was written for.
     */
    it('a dropped ledger row is NOT host-owned — the Seed keeps the property path', async () => {
        const r = await load('seedling');
        const owned = r.checkBinding.hostOwnedLocations();
        expect([...owned].some((n) => /The Seed/.test(n))).toBe(false);
        const pt = await load('seedling_playthrough');
        expect([...pt.checkBinding.hostOwnedLocations()].some((n) => /The Seed/.test(n))).toBe(true);
    });

    it('seedling_atlas refuses at PLACEMENT, and the refusal carries the count', async () => {
        const r = await load('seedling_atlas');
        expect(r.verdict).toBe('ineligible');
        expect(r.eligibility.failed).toBe('placement');
        expect(r.why).toMatch(/0 of 41/);
        expect(r.delivery).toBeNull();
        expect(r.checkBinding).toBeNull();
    });

    it('a build declaring no apitem refuses BEFORE anything heavy is fetched', async () => {
        let fetches = 0;
        const r = await load('seedling_playthrough', {
            manifest: { builds: manifest.builds.map((b) => ({ ...b, capabilities: [] })) },
            fetchJson: async (u) => { fetches += 1; return fetchJson(u); },
        });
        expect(r.eligibility.failed).toBe('capability');
        expect(fetches).toBe(0);
    });

    it('an unreachable map refuses at ASSETS and names the url', async () => {
        const r = await load('seedling_playthrough', {
            fetchJson: async (u) => {
                if (u.endsWith('seedling-map.json')) throw new Error('404 Not Found');
                return fetchJson(u);
            },
        });
        expect(r.eligibility.failed).toBe('assets');
        expect(r.why).toMatch(/seedling-map\.json/);
    });

    it('a blank slot is refused rather than read as player 0', async () => {
        const r = await load('seedling_playthrough', { playerId: '' });
        expect(r.verdict).toBe('ineligible');
        expect(r.why).toMatch(/not an integer player id/);
    });

    /**
     * ⛔ THE MODULE PATHS ARE DOCUMENT-RELATIVE AND THE IMPORTER IS HANDED A
     * RESOLVED URL — the bundle measurement in the header is only true while
     * no literal specifier names these files.
     */
    it('every heavy module is reached through the injected importer', async () => {
        const seen = [];
        await load('seedling_playthrough', {
            importModule: (u) => { seen.push(u); return import(/* @vite-ignore */ u); },
        });
        for (const p of Object.values(AP_MODULE_PATHS)) {
            expect(seen.some((u) => u.endsWith(p)), p).toBe(true);
        }
    });
});

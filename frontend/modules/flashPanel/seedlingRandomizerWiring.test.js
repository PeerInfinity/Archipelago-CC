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
    RESET_MODES,
    loadSeedlingRandomizer,
    readWorld,
    resetTargetFor,
    resolveMapPath,
    runSeedlingRandomizerLoad,
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
    it(`seedling_playthrough: all ${R7_GOAL_LEDGER.length} DIRECT, nothing joined by id, \
        nothing dropped`, () => {
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
     * REAL rules must be the table `check-seedling-ap-placement.mjs` builds
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

/**
 * P1-c — THE LOAD SEQUENCE, driven with fakes so every step is an assertion
 * rather than a screenshot. The browser adds exactly two things these rows
 * cannot have: a real DOM element and a real world swap, and P1-e measures
 * both on `--win`.
 */
describe('the reset target is chosen by the SET, not by preference', () => {
    it('a start with a POSITION takes the explicit teleport', () => {
        const t = resetTargetFor({ start: { level: 7, x: 32, y: 64 } });
        expect(t).toMatchObject({ mode: RESET_MODES.EXPLICIT_START, level: 7, x: 32, y: 64,
            expectLevel: 7 });
    });

    /**
     * ⛔ THE VANILLA-DERIVED SET IS THIS CASE, MEASURED: its `start` is
     * `{"level": 0}` and nothing else. `levelSetExporter.js:225` says the
     * arrival position "falls to the Game constructor's own (80, 128)" — a
     * constant that belongs to `Main.as`, not to the host, and `region_coords`
     * has no level-0 row to derive it from. So the game's own arm answers.
     */
    /**
     * ⛔⛔ AND THE CONSTRUCTOR ARGS COME FROM THE GAME, NOT FROM ZERO. Run 4
     * sent `Game(-1, 0, 0)` on the assumption that the new-game arm would
     * place the player; it does not when the set carries no position, so the
     * player landed at pixel (0, 0) — and **level 0 has `tree@0,0`**. The
     * fallback is the position the GAME booted at, read live.
     */
    it('a start with only a LEVEL takes the new-game arm with the GAME\'s own position', () => {
        const t = resetTargetFor({ start: { level: 0 } }, { x: 80, y: 128 });
        expect(t).toMatchObject({ mode: RESET_MODES.NEW_GAME_ARM, level: -1, expectLevel: 0,
            x: 80, y: 128 });
        expect(t.why).toMatch(/the position the GAME itself booted at/);
    });

    it('…and with NO boot position it carries null rather than zero', () => {
        const t = resetTargetFor({ start: { level: 0 } }, null);
        expect(t).toMatchObject({ mode: RESET_MODES.NEW_GAME_ARM, level: -1 });
        expect(t.x).toBeNull();
        expect(t.y).toBeNull();
    });

    /**
     * ⛔⛔ **A BORROWED POSITION IS ONLY VALID IN THE ROOM IT WAS READ IN.**
     * `(80, 128)` is a standable tile OF LEVEL 0. A set whose start names a
     * different level — a generated one that lost its `summary.startCell` —
     * would have that coordinate applied to a room whose geometry nobody
     * consulted: not an invented coordinate, but a real one from the wrong
     * room, which is the tree defect one step less obvious.
     *
     * ⚠ In production the guard is currently INERT and the row says so:
     * `botStatus.level` is −1 before any bot run, so the level is carried as
     * null and the comparison never fires. Pinned here rather than left to be
     * discovered; arming it needs a real read of `Main.level`.
     */
    it('a level-only start in a DIFFERENT room refuses rather than borrowing the spawn', () => {
        const t = resetTargetFor({ start: { level: 47 } }, { x: 80, y: 128, level: 0 });
        expect(t.refused).toBe(true);
        expect(t.x).toBeNull();
        expect(t.y).toBeNull();
        expect(t.why).toMatch(/says nothing about this one/);
        // …and the SAME room is still served
        const ok = resetTargetFor({ start: { level: 0 } }, { x: 80, y: 128, level: 0 });
        expect(ok.refused).toBeUndefined();
        expect(ok).toMatchObject({ x: 80, y: 128 });
        // …and an UNREPORTED level (production today) does not refuse
        const unknown = resetTargetFor({ start: { level: 47 } }, { x: 80, y: 128, level: null });
        expect(unknown.refused).toBeUndefined();
    });

    it('no start at all is REFUSED rather than guessed as level 0', () => {
        expect(resetTargetFor({})).toBeNull();
        expect(resetTargetFor({ start: { x: 1, y: 2 } })).toBeNull();
    });
});

describe('readWorld reads the WORLD, and survives a game that answers nothing', () => {
    it('finds the Player in the roster whatever its qualified name', () => {
        const bot = (n) => (n === 'botStatus' ? '{"level":3}'
            : '{"mobiles":[{"cls":"Enemies::Bob","x":1,"y":2},{"cls":"Player","x":88,"y":136}]}');
        expect(readWorld(bot)).toMatchObject({ level: 3, rosterSize: 2 });
        expect(readWorld(bot).player).toMatchObject({ x: 88, y: 136 });
    });

    it('answers nulls rather than throwing when the game is not up', () => {
        const bot = () => { throw new Error('no bridge'); };
        expect(readWorld(bot)).toMatchObject({ level: null, rosterSize: null, player: null });
    });
});

describe('the load sequence — overlay on, deliver, reset, overlay off', () => {
    const fakeOverlay = () => {
        const o = { calls: [], shown: false, text: null, cls: null, sticky: false };
        o.show = () => { o.shown = true; o.calls.push('show'); };
        o.setText = (t, c) => { o.text = t; o.cls = c ?? null; if (c === 'error') o.sticky = true; o.calls.push(`text:${c ?? 'info'}`); };
        o.hide = () => { o.shown = false; o.sticky = false; o.calls.push('hide'); };
        o.remove = () => { o.shown = false; o.calls.push('remove'); };
        return o;
    };
    /**
     * ⛔⛔ ONE ORDER LOG, SHARED BY THE GLUE AND THE DELIVERY — and it is the
     * SECOND shape of this row, because the first was VACUOUS. Asserting
     * `glue.order[0] === 'setDelivery'` passes under the mutant that moves
     * `setDelivery` to AFTER `deliver()`, since the glue still only ever sees
     * the two calls in that relative order. The claim is not "the glue was
     * told first", it is **"the glue was told BEFORE THE SET WAS SENT"** — a
     * region load arriving in that gap runs on the vanilla rooms — so the SEND
     * has to appear in the same sequence. Measured: the repaired row reds
     * under that mutant and the original did not.
     */
    const fakeGlue = (order, binding = null) => {
        const g = { order, delivery: null, checkBinding: null, binding };
        g.setDelivery = (d) => { g.delivery = d; order.push('setDelivery'); return g; };
        g.setCheckBinding = (b) => { g.checkBinding = b; order.push('setCheckBinding'); return g; };
        return g;
    };
    const fakeDelivery = (result, order) => {
        const d = { state: 'armed', bot: null, attached: 0 };
        d.attachBot = (b) => { d.bot = b; d.attached += 1; return d; };
        d.deliver = () => { d.delivered = true; order.push('deliver'); return result; };
        return d;
    };
    const loadedFor = (result, start = { level: 0 }, order = []) => ({
        tileSize: 16,
        set: { rooms: new Array(116), start },
        delivery: fakeDelivery(result, order),
        checkBinding: { id: 'the-binding' },
        replaced: 39,
    });

    const run = (over = {}) => {
        const order = over.order ?? [];
        const overlay = over.overlay ?? fakeOverlay();
        const glue = over.glue ?? fakeGlue(order, over.binding ?? null);
        const teleports = [];
        let polls = 0;
        return runSeedlingRandomizerLoad({
            loaded: over.loaded ?? loadedFor({ ok: true, chunks: 9, why: null }, undefined, order),
            glue,
            overlay,
            teleport: over.teleport ?? ((t) => teleports.push(t)),
            bot: over.bot ?? ((n) => {
                polls += 1;
                return n === 'botStatus' ? '{"level":0}' : '{"mobiles":[{"cls":"Player","x":88,"y":136}]}';
            }),
            waitFrame: async () => {},
            sleep: async () => {},
            now: (() => { let t = 0; return () => { t += 10; return t; }; })(),
            ...over.opts,
        }).then((r) => ({ r, overlay, glue, teleports, order, polls: () => polls }));
    };

    it('the happy path: on → deliver → reset → bind → off, IN THAT ORDER', async () => {
        const { r, overlay, glue, teleports } = await run();
        expect(r.ok).toBe(true);
        expect(r.steps.map((s) => s.name)).toEqual(
            ['overlay-on', 'deliver-begin', 'deliver-end', 'reset-begin', 'reset-end',
                'bind', 'overlay-off']);
        expect(glue.order).toEqual(['setDelivery', 'deliver', 'setCheckBinding']);
        // ⛓ the args are the GAME's boot position recovered from the roster
        // (88,136) minus the map's own half-tile (16/2) — never zeros.
        expect(teleports).toEqual([{ level: -1, x: 80, y: 128 }]);
        expect(overlay.shown).toBe(false);
        expect(overlay.calls[0]).toBe('show');
        expect(overlay.calls.at(-1)).toBe('hide');
    });

    /**
     * ⛔⛔ THE ORDERING CLAIM, AS A ROW. `setDelivery` reaches the glue BEFORE
     * `deliver()` runs, so a `loadRegion` arriving mid-load meets an armed
     * delivery and is GATED (H8's `gateLoadRegion`) rather than running on the
     * vanilla rooms. And `setCheckBinding` is last: until the rewritten rooms
     * are the ones being played, the property path is still the right owner.
     */
    it('the delivery reaches the glue BEFORE it is SENT, and the binding AFTER the reset', async () => {
        const { r, order } = await run();
        expect(order).toEqual(['setDelivery', 'deliver', 'setCheckBinding']);
        const names = r.steps.map((s) => s.name);
        expect(names.indexOf('bind')).toBeGreaterThan(names.indexOf('reset-end'));
    });

    it('A REFUSED delivery does NOT reset and does NOT bind, and the overlay STICKS', async () => {
        const ORDER_A = [];
        const { r, overlay, glue, teleports } = await run({
            order: ORDER_A,
            loaded: loadedFor({ ok: false, chunks: 0, why: 'botLoadLevels answered "error:x"' }, undefined, ORDER_A),
        });
        expect(r.ok).toBe(false);
        expect(teleports).toEqual([]);
        expect(glue.order).toEqual(['setDelivery', 'deliver']);
        expect(glue.checkBinding).toBeNull();
        expect(overlay.cls).toBe('error');
        expect(overlay.sticky).toBe(true);
        expect(overlay.calls).not.toContain('hide');
        expect(overlay.text).toMatch(/vanilla rooms/);
    });

    it('a set with a POSITIONED start teleports there instead', async () => {
        const { teleports, r } = await run({
            loaded: loadedFor({ ok: true, chunks: 1, why: null }, { level: 12, x: 48, y: 64 }),
            bot: (n) => (n === 'botStatus' ? '{"level":12}'
                : '{"mobiles":[{"cls":"Player","x":56,"y":72}]}'),
        });
        expect(teleports).toEqual([{ level: 12, x: 48, y: 64 }]);
        expect(r.reset.mode).toBe(RESET_MODES.EXPLICIT_START);
    });

    /**
     * ⛔ POLLED, NEVER SLEPT. A world that never reports the expected level
     * must time OUT and say so — and must still leave the rooms mounted,
     * because they are.
     */
    it('a reset that is never observed times out, says so, and does NOT bind', async () => {
        // ⛓ A roster WITH a player (so a boot position exists and the reset is
        // actually issued) but a level that never becomes the expected one.
        const { r, glue, overlay } = await run({
            // ⛓ `-1` is what the real game reports before a bot run, so the
            // room guard stays quiet and the RESET is genuinely issued — the
            // level then never becomes the expected one, which is the case
            // this row is about. (A positive mismatch would be refused by the
            // wrong-room guard and never reach the poll at all.)
            bot: (n) => (n === 'botStatus' ? '{"level":-1}'
                : '{"mobiles":[{"cls":"Player","x":88,"y":136}]}'),
        });
        expect(r.ok).toBe(true);
        expect(r.why).toBe('reset not observed');
        expect(glue.order).toEqual(['setDelivery', 'deliver']);
        expect(overlay.cls).toBe('error');
    });

    /**
     * ⛔⛔ THE ROW RUN 4 OWED. A game that reports no player gives the host no
     * position to send, and sending zeros is what parked the player inside
     * `tree@0,0`. The reset is REFUSED, the rooms stay mounted, and nothing is
     * bound — because the world is not where the set says it should be.
     */
    /**
     * ⛔⛔ **THE DECLARED SPAWN WINS, AND IT NEEDS NO HALF-TILE.**
     * `SeedlingRegionBinding.lastSpawn` is `Main.playerPositionX/Y` — the
     * CONSTRUCTOR's own arguments — so when the binding has seen them the
     * reset sends them verbatim, and `lastLevel` ARMS the wrong-room guard
     * that is otherwise inert (`botStatus.level` is −1 before a bot run).
     */
    it('prefers the BINDING\'s declared spawn over the roster, with no half-tile', async () => {
        const { teleports, r } = await run({
            binding: { lastSpawn: { x: 64, y: 96 }, lastLevel: 0 },
        });
        expect(teleports).toEqual([{ level: -1, x: 64, y: 96 }]);
        const began = r.steps.find((s) => s.name === 'reset-begin');
        expect(began.detail.bootPosition).toMatchObject({ x: 64, y: 96, level: 0 });
        expect(began.detail.bootPosition.source).toMatch(/declared playerPosition/);
    });

    it('…and with the binding ARMED, a start in another room is REFUSED', async () => {
        const order = [];
        const { r, teleports, glue } = await run({
            order,
            binding: { lastSpawn: { x: 64, y: 96 }, lastLevel: 0 },
            loaded: loadedFor({ ok: true, chunks: 1, why: null }, { level: 47 }, order),
        });
        expect(teleports).toEqual([]);
        expect(r.why).toBe('no position to reset to');
        expect(glue.checkBinding).toBeNull();
    });

    it('falls back to the roster when the binding has seen nothing', async () => {
        const { teleports, r } = await run({ binding: { lastSpawn: { x: null, y: null } } });
        expect(teleports).toEqual([{ level: -1, x: 80, y: 128 }]);
        expect(r.steps.find((s) => s.name === 'reset-begin').detail.bootPosition.source)
            .toMatch(/half-tile/);
    });

    it('a game that reports NO player refuses the reset rather than sending zeros', async () => {
        const { r, teleports, glue, overlay } = await run({
            bot: (n) => (n === 'botStatus' ? '{"level":0}' : '{"mobiles":[]}'),
        });
        expect(teleports).toEqual([]);
        expect(r.why).toBe('no position to reset to');
        expect(glue.order).toEqual(['setDelivery', 'deliver']);
        expect(glue.checkBinding).toBeNull();
        expect(overlay.cls).toBe('error');
    });

    it('a delivered set with NO start is refused rather than reset to level 0', async () => {
        const { r, teleports } = await run({
            loaded: loadedFor({ ok: true, chunks: 1, why: null }, null),
        });
        expect(r.reset).toBeNull();
        expect(teleports).toEqual([]);
    });

    it('the bot handle the delivery is given is the one it sends through', async () => {
        const seen = [];
        const { r } = await run({
            bot: (n) => { seen.push(n); return n === 'botStatus' ? '{"level":0}'
                : '{"mobiles":[{"cls":"Player","x":88,"y":136}]}'; },
        });
        expect(r.ok).toBe(true);
        // the poll asks the world; the delivery was handed the same callable
        expect(seen).toContain('botStatus');
        expect(seen).toContain('botMobiles');
    });
});

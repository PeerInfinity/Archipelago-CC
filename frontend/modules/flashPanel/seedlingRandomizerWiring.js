/**
 * flashPanel/seedlingRandomizerWiring — **THE LAZY HALF**: the heavy modules,
 * the two fetches, the location join, and the construction the verifier
 * mirrors (EDITOR INTEGRATION slice P1-b; plan §17.1.4, §17.2.5, §17.5).
 *
 * ── ⛔⛔ WHY EVERY IMPORT HERE IS A COMPUTED SPECIFIER ────────────────────
 *
 * `frontend/init-bundled.js` reaches 494 files and not one level-set module is
 * among them. MEASURED at `f5d7b43fc`, four builds of
 * `node scripts/build/bundle-frontend.js --no-minify`, which prints its own
 * input count:
 *
 *   baseline                                              494 files  8,584,629 B
 *   static  `import {X} from '…/apPlacementRewriter.js'`   574 (+80)  9,394,789 B
 *   dynamic `await import('…/apPlacementRewriter.js')`     581 (+87)  9,481,672 B
 *   dynamic with a NON-LITERAL specifier                   494 (+0)   8,584,894 B
 *
 * ⛔ **A DYNAMIC IMPORT WITH A LITERAL SPECIFIER COSTS MORE THAN A STATIC
 * ONE.** The bundler is esbuild with `bundle: true` and **`splitting: false`**
 * (`scripts/build/bundle-frontend.js:53-66`), so it resolves a literal
 * specifier at build time and INLINES the module — and it inlines seven files
 * MORE than the static form, because a namespace object defeats tree-shaking.
 * "Lazy" is not a property of the `await`; it is a property of whether the
 * bundler can see the string.
 *
 * ⇒ the only form that keeps the bundle unmoved is a specifier the bundler
 * cannot evaluate, and **+265 B IS the loader stub**. The base is
 * `document.baseURI`, never `import.meta.url`: in the bundled build this
 * module's own URL is `frontend/dist/bundle.js`, so a module-relative resolve
 * would look for `dist/modules/…`. The document is `frontend/index.html` in
 * BOTH builds, which is the same convention `flashPanelUI`'s
 * `GAMES_DIR = './modules/flashPanel/games/'` already fetches against.
 *
 * ⛓ AND THIS WHOLE FILE IS BEHIND THAT STUB. `flashPanelUI` reaches it the
 * same computed way, so its own static imports (`apPlacementRewriter` and
 * friends) never enter the bundler's graph at all.
 *
 * ── ⛓⛓ THE JOIN: A LEDGER ROW → THE LOADED PRESET'S PLACEMENT ───────────
 *
 * Two of the three seedling presets are not written in the goal ledger's
 * vocabulary, and finding that out is what this module is shaped by.
 *
 *   `seedling_playthrough`  41 locations, named `"Level 010 - Sword"` — the
 *                           ledger's own derived spelling. 41/41 DIRECT.
 *   `seedling` (stage 1)    40 locations from the upstream Seedling APWorld,
 *                           named `"Penguin's Feather"`, `"Chest (Waterfall)"`.
 *                           0 direct — and 40/41 through the AP ID.
 *   `seedling_atlas`        1 location. 0 either way ⇒ ineligible at (iii).
 *
 * ⛔ **THE SECOND PATH IS THE AP ID, WHICH IS EXACT — NOT A NAME MATCH.** The
 * stage-1 preset's location records carry `"id": 20000000…`, which is
 * literally `games/seedling.json`'s `ap_id_offset + ap_locations[k].id`. So
 * the chain is ledger row → `flash_name` → AP id → the loaded location with
 * that id. No tolerance, no nearest-match, no spelling family.
 *
 * ⛓ AND `ledger row → flash_name` IS DERIVED FOUR WAYS, EACH FROM DATA THAT
 * ALREADY EXISTS — see `flashNameForLedgerRow`. **The explicit remainder table
 * is EMPTY**, and a row asserts it never grows.
 *
 * ── ⛓ THE FILTERED LEDGER, AND WHY IT IS NOT A SILENT SKIP ──────────────
 *
 * `buildPlacementTable` REFUSES BY NAME when a rewritable row has no
 * placement — deliberately: *"a location AP will hand an item to and the
 * player can never find"*. The stage-1 preset has no location for
 * `seed@L115`, because in the upstream world the goal is an EVENT, not a
 * check. Refusing 38 good placements over one absent goal row is the wrong
 * trade, so the LEDGER — which is already an injected parameter of
 * `buildPlacementTable` — is filtered to the rows that resolve, and the
 * dropped ones are REPORTED by name. A dropped location keeps the adapter's
 * property path, because `hostOwnedLocations()` is built from the table and
 * cannot contain it. ⚠ For `seedling_playthrough` NOTHING is filtered, so the
 * table is byte-for-byte the one `verify-seedling-ap-placement.mjs` builds.
 */

import {
    AP_ITEM_CAPABILITY,
    seedlingRandomizerEligibility,
} from './seedlingRandomizerEligibility.js';
import { SeedlingCheckBinding } from './seedlingCheckBinding.js';
import { SeedlingLevelSetDelivery } from './seedlingLevelSetDelivery.js';

/**
 * The four modules the rewrite needs, as DOCUMENT-relative specifiers. ⛔ They
 * are data, not import statements: `loadApModules` hands each one to an
 * injected importer, and the default importer's specifier is a parameter —
 * which is the whole point (see the header's measurement).
 */
export const AP_MODULE_PATHS = Object.freeze({
    rewriter: 'modules/seedlingDemo/apPlacementRewriter.js',
    exporter: 'modules/seedlingDemo/levelSetExporter.js',
    validator: 'modules/seedlingDemo/levelSetValidator.js',
    ledger: 'modules/seedlingDemo/r7Acceptance.js',
    derivation: 'modules/seedlingDemo/seedlingAtlasDerivation.js',
});

/** The two documents the rewrite is built FROM, likewise document-relative. */
export const AP_ASSET_PATHS = Object.freeze({
    recordSet: 'modules/seedlingDemo/fixtures/seedling-vanilla-set.json',
    atlasDir: 'modules/flashPanel/atlases/',
    defaultMap: 'modules/flashPanel/atlases/seedling-map.json',
});

/**
 * ⛓⛓ **THE REMAINDER TABLE, AND IT IS EMPTY.** Every ledger row's
 * `flash_name` is derived; nothing is aliased by hand. It exists as a named
 * empty object rather than not existing, because the row below asserts it
 * NEVER GROWS — a future ledger row that cannot be derived must be an
 * explicit, reviewed entry rather than a silent `undefined` that reads as
 * "this location has no AP placement".
 */
export const LEDGER_FLASH_NAME_REMAINDER = Object.freeze({});

/**
 * A ledger row's `flash_name`, DERIVED. The four arms, and what each is
 * measured against:
 *
 *  - `key`       → `key<N>`, N parsed from the row's OWN id (`bosskey<N>@L…`),
 *                  the same regex `entityForLedgerRow` uses. Cross-checked
 *                  against the entity's `@keyType`: 0…4 agree.
 *  - `chest`     → `chest<level>`. MEASURED: the ledger's 16 chest levels are
 *                  EXACTLY the 16 `chestNN` suffixes in `ap_locations`, so NN
 *                  is the level and not an index.
 *  - `totempart` → `totem<N>`, N the entity's own `@totempart` attribute. ⛔
 *                  This is the one arm the ledger id cannot answer — it
 *                  addresses by pixel position — so it needs the room map,
 *                  which this module has fetched anyway.
 *  - everything else → the `tag`, unless the tag is not an `ap_locations`
 *                  name; then the `games/*.json` `locations[]` row whose
 *                  `ap_name` is `ITEM_FOR_TAG[tag]`. MEASURED: that second
 *                  hop is needed exactly once and derives `torchpickup` →
 *                  `Light` → `torch`, which is why no alias is typed here.
 *
 * @returns {string|null}
 */
export function flashNameForLedgerRow(row, deps) {
    const { apLocationNames, itemForTag, flashNameForApName, entityForLedgerRow, roomsByLevel } = deps;
    if (!row) return null;
    if (LEDGER_FLASH_NAME_REMAINDER[row.id]) return LEDGER_FLASH_NAME_REMAINDER[row.id];
    if (row.kind === 'key') {
        const m = /bosskey(\d)@/.exec(row.id);
        return m ? `key${m[1]}` : null;
    }
    if (row.kind === 'chest') return `chest${row.level}`;
    if (row.kind === 'totempart') {
        const room = roomsByLevel.get(row.level);
        const { entity } = room ? entityForLedgerRow(room, row) : { entity: null };
        const index = entity?.attrs?.totempart;
        return index === undefined || index === null ? null : `totem${index}`;
    }
    const tag = row.kind === 'encounter' ? String(row.id).split('@')[0] : row.tag;
    if (typeof tag !== 'string' || tag === '') return null;
    if (apLocationNames.has(tag)) return tag;
    // The one derived hop: the tag names an item, and the game config's own
    // property table names that item's flash_name.
    const viaItem = flashNameForApName.get(itemForTag[tag]);
    return viaItem ?? tag;
}

/** `stateManager`'s slot, as an integer. ⛔ `Number('') === 0` and
 *  `Number(null) === 0` (M1-b's trap): a blank slot would make every item read
 *  as foreign rather than as this player's. */
export function selfPlayerOf(playerId) {
    const s = typeof playerId === 'number' ? String(playerId) : playerId;
    return typeof s === 'string' && /^\d+$/.test(s.trim()) ? Number(s.trim()) : null;
}

const itemOfRecord = (rec) => (
    rec && typeof rec.item?.name === 'string' && Number.isInteger(rec.item?.player)
        ? { name: rec.item.name, player: rec.item.player }
        : null);

/**
 * The production `locationItemOf`, plus the census the eligibility predicate's
 * check (iii) is answered from.
 *
 * ⚠ `locations` IS `stateManager.getStaticData()?.locations`, a Map of name →
 * the full location record. The panel holds the PROXY
 * (`flashPanelUI.js:1` imports `stateManagerProxySingleton`) and the proxy has
 * NO `getLocationItem` — that method is on the worker-side class. Reading the
 * Map is also what makes the AP-id path possible at all, since
 * `getLocationItem` returns `{name, player}` and never the id.
 *
 * @returns {{locationItemOf: Function, ledgerUsed: object[], census: object}}
 */
export function buildLocationResolver({ ledger, gameConfig, locations, roomsByLevel, deps }) {
    const { entityForLedgerRow, itemForTag, labelFor, levelName } = deps;
    const apLocations = Array.isArray(gameConfig?.ap_locations) ? gameConfig.ap_locations : [];
    const offset = Number(gameConfig?.ap_id_offset) || 0;
    const apLocationNames = new Set(apLocations.map((l) => l.flash_name));
    const apIdOf = new Map(apLocations.map((l) => [l.flash_name, offset + Number(l.id)]));
    const flashNameForApName = new Map(
        (gameConfig?.locations ?? []).map((l) => [l.ap_name, l.flash_name]));

    const byName = locations instanceof Map ? locations : new Map(Object.entries(locations ?? {}));
    const byApId = new Map();
    for (const rec of byName.values()) {
        if (Number.isInteger(rec?.id)) byApId.set(rec.id, rec);
    }

    const resolved = new Map();   // ledger location name -> the loaded record
    const census = { direct: 0, viaApId: 0, unjoined: [], total: ledger.length };
    const ledgerUsed = [];
    for (const row of ledger) {
        const name = `${levelName(row.level)} - ${labelFor(row)}`;
        const direct = byName.get(name);
        if (itemOfRecord(direct)) {
            resolved.set(name, direct);
            census.direct += 1;
            ledgerUsed.push(row);
            continue;
        }
        const flashName = flashNameForLedgerRow(row, {
            apLocationNames, itemForTag, flashNameForApName, entityForLedgerRow, roomsByLevel,
        });
        const rec = flashName === null ? null : byApId.get(apIdOf.get(flashName));
        if (itemOfRecord(rec)) {
            resolved.set(name, rec);
            census.viaApId += 1;
            ledgerUsed.push(row);
            continue;
        }
        // ⛓ REPORTED, never silently skipped: the row names itself and the
        // flash_name it looked for, so "why is the Seed still vanilla?" has an
        // answer in the log rather than in a debugger.
        census.unjoined.push(`${row.id}${flashName ? ` (${flashName})` : ' (no flash_name)'}`);
    }
    return {
        locationItemOf: (name) => itemOfRecord(resolved.get(name)),
        ledgerUsed,
        census,
    };
}

/** The map document this preset declares, and where that answer came from. */
export function resolveMapPath(rawRules) {
    const named = rawRules?.region_atlas?.map_document;
    return typeof named === 'string' && named !== ''
        ? { path: AP_ASSET_PATHS.atlasDir + named, source: 'region_atlas.map_document' }
        : { path: AP_ASSET_PATHS.defaultMap, source: 'the atlases default' };
}

const defaultFetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
};

/**
 * ⛔ THE DEFAULT IMPORTER'S SPECIFIER IS A PARAMETER, and that is the whole
 * bundle measurement in one line. Written as a literal here it would inline
 * 87 files; written as `url` the bundler cannot evaluate it and emits the
 * runtime import instead.
 */
const defaultImportModule = (url) => import(/* @vite-ignore */ url);

/**
 * Everything the panel needs to hand the glue, or a refusal that says why.
 *
 * The construction MIRRORS `verify-seedling-ap-placement.mjs:96-137, 311-323,
 * 1077-1078` verbatim — `vanillaRecordSet` → `buildPlacementTable` →
 * `rewriteRecordSet` → `apMappingInvalidation` → `SeedlingLevelSetDelivery` →
 * `SeedlingCheckBinding` — because that gate is the only other constructor of
 * these two modules and a second recipe would be a second thing to be right.
 *
 * @returns {Promise<{verdict: string, why: string, eligibility: object,
 *   delivery: object|null, checkBinding: object|null, table: Map|null,
 *   replaced: number, set: object|null, invalidation: object|null,
 *   census: object|null, assets: object|null, selfPlayer: number|null}>}
 */
export async function loadSeedlingRandomizer({
    flashPanel,
    manifest,
    rawRules = null,
    locations,
    playerId,
    gameConfig,
    bot = null,
    baseUrl,
    fetchJson = defaultFetchJson,
    importModule = defaultImportModule,
    log = () => {},
} = {}) {
    const url = (rel) => new URL(rel, baseUrl).href;
    const refuse = (eligibility, extra = {}) => ({
        verdict: eligibility.verdict,
        why: eligibility.why,
        eligibility,
        delivery: null,
        checkBinding: null,
        table: null,
        replaced: 0,
        set: null,
        invalidation: null,
        census: null,
        assets: null,
        selfPlayer: null,
        ...extra,
    });

    // ── the cheap two, first: nothing heavy is fetched for a preset that
    //    cannot use it ────────────────────────────────────────────────────
    const cheap = seedlingRandomizerEligibility({ flashPanel, transport: 'wasm', manifest });
    if (cheap.verdict === 'ineligible') return refuse(cheap);

    // ── (iv) the two documents ──────────────────────────────────────────
    const mapPath = resolveMapPath(rawRules);
    const assets = {
        recordSet: { url: url(AP_ASSET_PATHS.recordSet), ok: false },
        map: { url: url(mapPath.path), ok: false, source: mapPath.source },
    };
    let embed = null;
    let mapDoc = null;
    try {
        embed = await fetchJson(assets.recordSet.url);
        assets.recordSet.ok = true;
    } catch (e) { assets.recordSet.why = e.message; }
    try {
        mapDoc = await fetchJson(assets.map.url);
        assets.map.ok = true;
    } catch (e) { assets.map.why = e.message; }

    if (!assets.recordSet.ok || !assets.map.ok) {
        return refuse(seedlingRandomizerEligibility(
            { flashPanel, transport: 'wasm', manifest, assets }), { assets });
    }

    // ── the heavy modules ───────────────────────────────────────────────
    const [rewriter, exporter, validator, ledgerMod, derivation] = await Promise.all(
        [AP_MODULE_PATHS.rewriter, AP_MODULE_PATHS.exporter, AP_MODULE_PATHS.validator,
            AP_MODULE_PATHS.ledger, AP_MODULE_PATHS.derivation].map((p) => importModule(url(p))));

    const roomsByLevel = new Map((mapDoc.levels ?? []).map((r) => [r.level, r]));
    const { locationItemOf, ledgerUsed, census } = buildLocationResolver({
        ledger: ledgerMod.R7_GOAL_LEDGER,
        gameConfig,
        locations,
        roomsByLevel,
        deps: {
            entityForLedgerRow: derivation.entityForLedgerRow,
            itemForTag: derivation.ITEM_FOR_TAG,
            labelFor: derivation.labelFor,
            levelName: derivation.levelName,
        },
    });

    // ── (iii) the placement, and the full verdict ───────────────────────
    const eligibility = seedlingRandomizerEligibility({
        flashPanel,
        transport: 'wasm',
        manifest,
        placement: { resolved: census.direct + census.viaApId, total: census.total,
            unresolved: census.unjoined },
        assets,
    });
    if (!eligibility.eligible) return refuse(eligibility, { census, assets });

    const selfPlayer = selfPlayerOf(playerId);
    if (selfPlayer === null) {
        return refuse({
            ...eligibility,
            eligible: false,
            verdict: 'ineligible',
            failed: 'placement',
            why: `placement: the loaded slot ${JSON.stringify(playerId)} is not an integer `
                + 'player id — every `look` decision is relative to it, and a blank one would '
                + 'make every item read as foreign',
        }, { census, assets });
    }

    if (census.unjoined.length > 0) {
        log(`[ap placement] ${census.unjoined.length} goal-ledger row(s) have no AP location in `
            + `these rules and stay VANILLA: ${census.unjoined.join(', ')}`);
    }

    const { set: vanilla } = exporter.vanillaRecordSet(embed, mapDoc);
    const { table, entries, encounters } = rewriter.buildPlacementTable({
        locationItemOf,
        ledger: ledgerUsed,
        rooms: mapDoc.levels,
        selfPlayer,
    });
    const { set, replaced } = rewriter.rewriteRecordSet(vanilla, table);
    const invalidation = exporter.apMappingInvalidation(set);

    const delivery = new SeedlingLevelSetDelivery({
        planChunks: validator.planLevelSetChunks,
        bot,
        log,
    }).arm(set, invalidation);
    const checkBinding = new SeedlingCheckBinding({
        table, placementKey: rewriter.placementKey, selfPlayer,
    });

    return {
        verdict: 'eligible',
        why: eligibility.why,
        eligibility,
        delivery,
        checkBinding,
        table,
        entries,
        encounters,
        replaced,
        set,
        invalidation,
        census,
        assets,
        selfPlayer,
        capability: AP_ITEM_CAPABILITY,
    };
}

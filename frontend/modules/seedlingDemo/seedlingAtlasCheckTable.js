/**
 * seedlingDemo/seedlingAtlasCheckTable — **A REAL ROOM'S OWN LOCATION, AS A
 * CHECK ADDRESS** (seedling generated G7; plan `seedling-generated-plan.md`
 * §12.4, §13).
 *
 * The check binding (`flashPanel/seedlingCheckBinding.js`) turns the game's
 * `pendingCheck "<seq>|<level>|<tag>|0"` into `user:locationCheck` through a
 * `placementKey(level, tag)` → `{location, item, player}` table. Two arms built
 * that table before this one: the VANILLA rewrite (its rows are the 41-row goal
 * ledger, joined by vanilla names) and the GENERATED assembler (its rows are
 * the `apitem`s it placed). A world of REAL atlas rooms built by the pipeline
 * had neither — the atlas compiler names a location by its atlas region
 * (`Starting House - Chest`), so 0 of 41 ledger rows resolve and the vanilla
 * arm refuses the whole world — and so the chest fired `pendingCheck "1|86|0|0"`
 * and nothing was checked (§12.4, measured on the box).
 *
 * ── ⛓ THE CHAIN, EVERY HOP A DOCUMENT THE PAGE ALREADY HOLDS ─────────────
 *
 *   rules region (a `flash_seedling` sidecar: `atlas_region`, `level`)
 *     → its `regions[].locations[]` (the COMPILED names)
 *     → the atlas region's location of that name (`tile`, `vanilla_item`)
 *     → the map document's entity ON that tile in that level whose vanilla
 *       item IS the location's `vanilla_item`
 *     → the engine's own `tagOf(type, attrs)`
 *     → `placementKey(level, tag)`.
 *
 * The tile is in the LEVEL's own space: the derivation writes it as
 * `tileOf(entity, tile_size)` of the room's entity (`seedlingAtlasDerivation.
 * locationsFor`), never offset by the region's bounds.
 *
 * ⛔ **BY ITEM, NOT BY "WHATEVER IS ON THE TILE".** Five of the playthrough
 * atlas's 41 locations share a tile with another entity (`chest`+`cover`,
 * `wire`+`chest`, `bosskey`+`orb`, `lightray`+`shadow`+`seed`,
 * `stairsdown`+`fallrocklarge`); the entity a location MARKS is the one that
 * grants its vanilla item, and exactly one must — two or none is a refusal.
 *
 * ── ⛔⛔ NOTHING IS REWRITTEN, SO THREE KINDS OF LOCATION ARE REFUSED ──────
 *
 * This arm does not rewrite the room: the entity the player collects is the
 * vanilla one, and hands the vanilla item in-game as well. That is what makes
 * the table cheap, and it is what decides the law — *a location AP will hand
 * an item to and the player can never check* is refused BY NAME, never bound
 * (the vanilla arm's own law, `apPlacementRewriter.buildPlacementTable`):
 *
 *   1. **untagged** — `tagOf` answers −1 (`bosskey`, `totempart`, `seed`: the
 *      game's XML loop builds them with no tag). The vanilla arm ALLOCATES a
 *      tag for these and writes it into the rewritten `apitem`; without a
 *      rewrite the entity keeps its absent tag and `setPersistence` is never
 *      called, so an allocated tag here would be an address nothing reports.
 *   2. **reported by the property path too** — the adapter's
 *      `propertyToLocationFlash` watches eleven `Main.*` flags (`hasSword`,
 *      `hasWand`, …). Collecting that vanilla pickup would fire the check here
 *      AND a vanilla-named `user:locationCheck` there, whose UNDO then takes
 *      the item back. (A chest grants a Seal, which no property reports.)
 *   3. **no single granting entity** on the tile — the two encounters (the
 *      Witch, Bob Boss's rock) grant through a trade and a drop, not a pickup.
 *
 * ── ⛓ PURE, AND EVERY GAME FACT IS INJECTED ─────────────────────────────
 *
 * `placementKey` is the rewriter's (the binding's own rule: the two spellings
 * of the address must not drift), `tagOf` is `levelWorld`'s, `itemOfEntity` is
 * the derivation's item tables, `propertyLocationOf` is the adapter's
 * property table. None is imported: the wiring that calls this already holds
 * them, lazily, and a static import here would put the level-set graph in
 * whatever imports this file.
 */

/** The player whose sidecars and regions a rules.json keys under `'1'`. */
export const ATLAS_CHECK_PLAYER = '1';

/** The sidecar substrate this table reads — the REAL-room one. */
export const ATLAS_ROOM_SUBSTRATE_ID = 'flash_seedling';

/** Why a location is refused, as sentences (the `why` of a `refused` row). */
export const ATLAS_CHECK_REFUSALS = Object.freeze({
    noAtlasRegion: (region, atlasRegion) => `region ${region}'s sidecar names atlas region `
        + `${JSON.stringify(atlasRegion)}, which the atlas does not carry`,
    notInAtlas: (atlasRegion) => `the atlas region ${JSON.stringify(atlasRegion)} carries no `
        + 'location of that name, so there is no tile to find its entity on',
    noLevel: (level) => `level ${level} is not in the map document`,
    noEntity: (level, tile, item, onTile) => `no entity on tile ${tile.join(',')} of level ${level} `
        + `grants ${JSON.stringify(item)} (the tile holds ${onTile.length === 0 ? 'nothing'
            : onTile.join(', ')}) — an encounter or a moved entity, not a pickup the player collects`,
    ambiguous: (level, tile, item, n) => `${n} entities on tile ${tile.join(',')} of level ${level} `
        + `grant ${JSON.stringify(item)} — the location cannot say which one it marks`,
    untagged: (type, level) => `the ${type} in level ${level} carries no persistence tag, so `
        + 'collecting it reports nothing — without a rewrite there is no tag to allocate it '
        + 'into, and AP would hand an item to a location the player can never check',
    propertyPath: (type, apName) => `collecting the vanilla ${type} is ALSO reported by the `
        + `adapter's property path as ${JSON.stringify(apName)} — the location would be checked `
        + 'twice and the property path\'s undo would take the item back',
    noPlacement: (placed) => `the rules place no item here (got ${JSON.stringify(placed)})`,
    sameAddress: (key, other) => `the address ${key} is already ${JSON.stringify(other)}'s`,
});

const refusalsOf = ATLAS_CHECK_REFUSALS;

/**
 * `itemOfEntity` from the derivation's own item tables (`ITEM_FOR_TAG`,
 * `ITEM_FOR_KEY`, `VICTORY_ITEM`) — the item a vanilla entity grants, the same
 * vocabulary the atlas's `vanilla_item` was written in.
 */
export function itemOfEntityFrom({ itemForTag, itemForKey, victoryItem }) {
    return (e) => {
        if (e?.type === 'bosskey') return itemForKey?.[Number(e.attrs?.keyType)];
        if (e?.type === 'seed') return victoryItem;
        return Object.hasOwn(itemForTag ?? {}, e?.type) ? itemForTag[e.type] : undefined;
    };
}

/**
 * `propertyLocationOf` from the game config the adapter builds its property
 * path from (`games/seedling.json` `locations[]`: `{property, flash_name,
 * ap_name}`) — the AP name that path would dispatch when this entity's pickup
 * flips its flag, or null. The hop is `flashPanel/seedlingRandomizerWiring.
 * flashNameForLedgerRow`'s: the entity type IS a `flash_name`, else the item
 * it grants is some row's `ap_name` (`torchpickup` → `Light` → `torch`).
 */
export function propertyLocationOfFrom(gameConfig, itemForTag) {
    const rows = Array.isArray(gameConfig?.locations) ? gameConfig.locations : [];
    const byFlash = new Map(rows.map((l) => [l.flash_name, l]));
    const byApName = new Map(rows.map((l) => [l.ap_name, l]));
    return (e) => {
        const row = byFlash.get(e?.type) ?? byApName.get(itemForTag?.[e?.type]) ?? null;
        return row ? (row.ap_name || row.flash_name) : null;
    };
}

/**
 * The `flash_seedling` regions of `rules`, in the rules' own region order —
 * `{region, atlasRegion, level}` off each sidecar's payload.
 */
export function atlasRoomRegions(rules) {
    const sidecars = rules?.preset_sidecars?.[ATLAS_CHECK_PLAYER] ?? {};
    return Object.entries(sidecars)
        .filter(([, s]) => s?.substrate === ATLAS_ROOM_SUBSTRATE_ID)
        .map(([region, s]) => ({
            region,
            atlasRegion: s.playable_payload?.atlas_region ?? null,
            level: s.playable_payload?.level,
        }));
}

/**
 * The `(level|tag)` → atlas-location table for every `flash_seedling` region of
 * `rules`, with each location that cannot be bound REFUSED by name.
 *
 * @param {object} args
 * @param {object} args.rules      the raw rules.json
 * @param {object} args.atlasDoc   the region atlas `region_atlas.atlas_id` names
 * @param {object} args.mapDoc     the map document (`levels[]` of `{level, entities}`)
 * @param {(name: string) => ({name: string, player: number}|null)} args.locationItemOf
 * @param {number|null} [args.selfPlayer]
 * @param {(level: number, tag: number) => string} args.placementKey
 * @param {(type: string, attrs: object) => number} args.tagOf
 * @param {(entity: object) => (string|undefined)} args.itemOfEntity
 * @param {(entity: object) => (string|null)} [args.propertyLocationOf]
 *   the AP name the adapter's property path would dispatch for this entity, or null
 * @returns {{table: Map<string, object>, entries: object[],
 *   refused: {location: string, region: string, why: string}[], census: object}}
 */
export function buildAtlasCheckTable({
    rules, atlasDoc, mapDoc, locationItemOf, selfPlayer = null,
    placementKey, tagOf, itemOfEntity, propertyLocationOf = () => null,
} = {}) {
    for (const [name, fn] of [['locationItemOf', locationItemOf], ['placementKey', placementKey],
        ['tagOf', tagOf], ['itemOfEntity', itemOfEntity]]) {
        if (typeof fn !== 'function') {
            throw new Error(`buildAtlasCheckTable: \`${name}\` is required — it is injected so this `
                + 'module imports nothing of the level-set graph');
        }
    }
    const tileSize = Number(atlasDoc?.tile_space?.tile_size ?? mapDoc?.tile_size);
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
        throw new Error('buildAtlasCheckTable: neither the atlas nor the map document names a '
            + 'tile_size, so no location tile can be matched to an entity');
    }
    const atlasRegions = new Map((atlasDoc?.regions ?? []).map((r) => [r.region_id, r]));
    const levels = new Map((mapDoc?.levels ?? []).map((l) => [l.level, l]));
    const rulesRegions = rules?.regions?.[ATLAS_CHECK_PLAYER] ?? {};

    const table = new Map();
    const entries = [];
    const refused = [];
    const census = { regions: 0, locations: 0, bound: 0, refused: 0, byEntity: {} };
    const count = (type, field) => {
        census.byEntity[type] ??= { bound: 0, untagged: 0, propertyPath: 0 };
        census.byEntity[type][field] += 1;
    };

    for (const { region, atlasRegion, level } of atlasRoomRegions(rules)) {
        census.regions += 1;
        const locations = rulesRegions[region]?.locations ?? [];
        const atlasRegionDoc = atlasRegions.get(atlasRegion);
        for (const loc of locations) {
            census.locations += 1;
            const refuse = (why) => { refused.push({ location: loc.name, region, why }); };
            if (!atlasRegionDoc) { refuse(refusalsOf.noAtlasRegion(region, atlasRegion)); continue; }
            const atlasLoc = (atlasRegionDoc.locations ?? []).find((l) => l.name === loc.name);
            if (!atlasLoc) { refuse(refusalsOf.notInAtlas(atlasRegion)); continue; }
            const room = levels.get(level);
            if (!room) { refuse(refusalsOf.noLevel(level)); continue; }
            const [tx, ty] = atlasLoc.tile;
            const onTile = (room.entities ?? []).filter((e) => Math.floor(e.x / tileSize) === tx
                && Math.floor(e.y / tileSize) === ty);
            const granting = onTile.filter((e) => itemOfEntity(e) === atlasLoc.vanilla_item);
            if (granting.length === 0) {
                refuse(refusalsOf.noEntity(level, atlasLoc.tile, atlasLoc.vanilla_item, onTile.map((e) => e.type)));
                continue;
            }
            if (granting.length > 1) {
                refuse(refusalsOf.ambiguous(level, atlasLoc.tile, atlasLoc.vanilla_item, granting.length));
                continue;
            }
            const [entity] = granting;
            const tag = tagOf(entity.type, entity.attrs);
            if (!Number.isInteger(tag) || tag < 0) {
                count(entity.type, 'untagged');
                refuse(refusalsOf.untagged(entity.type, level));
                continue;
            }
            const apName = propertyLocationOf(entity);
            if (apName) {
                count(entity.type, 'propertyPath');
                refuse(refusalsOf.propertyPath(entity.type, apName));
                continue;
            }
            const placed = locationItemOf(loc.name);
            if (!placed || typeof placed.name !== 'string' || !Number.isInteger(placed.player)) {
                refuse(refusalsOf.noPlacement(placed));
                continue;
            }
            const key = placementKey(level, tag);
            if (table.has(key)) { refuse(refusalsOf.sameAddress(key, table.get(key).location)); continue; }
            const entry = {
                ledgerId: `${atlasRegion}:${entity.type}@${entity.x},${entity.y}`,
                level,
                tag,
                location: loc.name,
                item: placed.name,
                player: placed.player,
                forSelf: placed.player === selfPlayer,
                region,
                entityType: entity.type,
                vanillaItem: atlasLoc.vanilla_item,
            };
            table.set(key, entry);
            entries.push({ key, ...entry });
            count(entity.type, 'bound');
        }
    }
    census.bound = entries.length;
    census.refused = refused.length;
    return { table, entries, refused, census };
}

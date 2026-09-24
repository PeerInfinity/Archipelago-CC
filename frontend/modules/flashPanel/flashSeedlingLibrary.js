/**
 * `flash_seedling` — the region-atlas play-time substrate (projection 3;
 * CC/docs/plans/region-atlas-plan.md, Phase 4).
 *
 * A region of this substrate is a REAL Seedling level, marked out in the
 * region atlas and compiled into `preset_sidecars` by
 * `procgenPipeline/regionAtlasCompiler.js`. Walking through one of the game's
 * own level transitions crosses the AP region boundary; arriving in a region
 * teleports the player to the marked entrance spawn.
 *
 * Two things make this entry different from the generic `flash` one, and both
 * are deliberate:
 *
 *   - **It renders in the flashPanel panel, not flashSubstratePanel.** The
 *     game is driven by flashPanel's shipped `WasmBridgeAdapter` — teleports,
 *     item writes, progressive/fusion expansion and location checks are all
 *     Stage-1-verified there. Building a second AP<->game translation inside
 *     flashSubstrate's in-iframe bridge would be a second implementation of a
 *     solved problem (ruling 2, 2026-07-27), and it speaks the wrong dialect
 *     anyway: the SWFRecomp wasm shim exposes `game.configure(json)` +
 *     `queueItems`, not the substrate bridge's `__swfBridge.configure(obj)` +
 *     `pollItems`.
 *   - **It owns its load event.** The bounce precedent: a per-game entry with
 *     its own panel gets its own `loadRegion` event, so the shared flash
 *     bridge never sees regions it cannot render.
 *
 * Everything else — the exits-Map `deserializeWorld`/`serializeWorld` round
 * trip, the null playback stub, the loop-mode declaration — comes from
 * `createFlashSubstrateEntry`, unchanged.
 *
 * Payload shape (emitted by regionAtlasCompiler, consumed by
 * `seedlingRegionBinding.js`):
 *
 *   {
 *     gameId: 'seedling',
 *     atlas_ref: '<atlas_id>',        // content-hashed: a restamp invalidates
 *     atlas_region: '<region_id>',
 *     atlas_sub_region?: '<sub_region>',
 *     level: <int>,                   // the Seedling level this region IS
 *     tile_size: <int>,
 *     exits: [{
 *       exit_id, kind, side?, exit_tiles, entrance_tile,
 *       entrance_spawn: {x, y},       // where an ARRIVAL through this exit lands
 *       exitName,                     // === the AP exit's `name` (required)
 *       targetRegion, targetExitId,
 *       target_level, target_spawn,   // where a CROSSING through it goes
 *     }],
 *   }
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { REQUIRED_ENVELOPE_FIELD } from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { boundaryRule } from '../procgenPipeline/regionAtlasPool.js';
// ⛓ The jta precedent (`jtaSubstrateWrapper/vanillaDataset.js`): a static JSON
// module import is ONE spelling of the document's location for the browser's
// raw ES modules, the esbuild bundle, node CLIs and vitest alike — no fetch, so
// the synchronous `applyPipelineConfig` seam can install it.
import SEEDLING_STARTER_ATLAS_DOC from './atlases/seedling.json' with { type: 'json' };
import { atlasIndexPath, atlasPathInIndex } from './mapDocumentPath.js';

export const FLASH_SEEDLING_SUBSTRATE_ID = 'flash_seedling';

/** The atlas this substrate places when no `substrateConfig.flash_seedling.atlasDoc` is given. */
export const SEEDLING_STARTER_ATLAS = SEEDLING_STARTER_ATLAS_DOC;
export const FLASH_SEEDLING_PANEL_COMPONENT_TYPE = 'flashPanel';
export const FLASH_SEEDLING_LOAD_REGION_EVENT = 'flashSeedling:loadRegion';

/** The one writer of this payload — every field below is its output. */
const COMPILER = '`buildFlashRegionSidecars` (`procgenPipeline/regionAtlasCompiler.js`)';

/**
 * ⛓⛓ PRESET SIDECARS D0 — **THE SEEDLING PAYLOAD, DECLARED** (the registry's
 * `sidecarFields` slot; vocabulary in `procgenCore/sidecarFields.js`). The
 * shape in this file's docblock, and ALL of it is DERIVED: the region atlas
 * compiler is the only writer, and the payload is a compiled SNAPSHOT of the
 * atlas — an atlas REFERENCE into a level, not a room record (the same fact
 * `regionRoundTrip.refused` states below). `exits` is the engine envelope's
 * field; its Seedling-only item keys (`kind`, `exit_tiles`, `entrance_tile`,
 * `entrance_spawn`, `target_level`, `target_spawn`, `external`,
 * `target_substrate`) ride through the envelope's open item schema.
 * `required` is read off the committed corpus.
 */
export const FLASH_SEEDLING_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    gameId: Object.freeze({
        type: 'string', required: true, derived: true,
        description: `The atlas's \`game\`, copied by ${COMPILER}. Ignored at play.`,
    }),
    atlas_ref: Object.freeze({
        type: 'string', required: true, derived: true,
        description: `The atlas's content-hashed \`atlas_id\`, copied by ${COMPILER}. It RESOLVES TO `
            + 'NOTHING at runtime — no play-time reader looks an atlas up by it; it is provenance.',
    }),
    atlas_region: Object.freeze({
        type: 'string', required: true, derived: true,
        description: `The atlas region this AP region projects, copied by ${COMPILER}. Ignored at play.`,
    }),
    atlas_sub_region: Object.freeze({
        type: 'string', required: false, derived: true,
        description: `The sub-region this AP region binds to, written by ${COMPILER} only when the atlas `
            + 'region has a subgraph. Ignored at play.',
    }),
    level: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: `The Seedling level this region IS (the atlas region's \`map_ref\`), copied by `
            + `${COMPILER}; \`seedlingRegionBinding.js\` loads it on arrival — a wrong one sends the `
            + 'player to the wrong level and every crossing then warns.',
    }),
    tile_size: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: `The atlas's tile size, copied by ${COMPILER} (it scales each exit's `
            + '`entrance_spawn`). Ignored at play.',
    }),
});

/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T1 — **A REAL ROOM AS SPIRAL CONTENT.**
 *
 * The zone content-source contract (`substrate-registry.md` § *Build-time —
 * content sources*): `zoneCount` + `extractZoneRules(zoneIdx, {region_id,
 * exitSides})`. An entry of the pool is ONE AP region of the installed atlas —
 * a sub-region where the atlas region has a subgraph — and it plays as the
 * real level, exactly as `seedling_atlas` does.
 *
 * ⛔ **EVERYTHING IS READ OFF `compileRegionAtlas`, NOTHING IS RESTATED.** The
 * pool is the compile's own `preset_sidecars` (its payload IS the one
 * `buildFlashRegionSidecars` writes for `seedling_atlas`), its locations are the
 * compile's own region locations, and a door's rule is `boundaryRule` — the
 * reader the atlas pool uses. So the pool, the committed atlas preset and this
 * source cannot drift apart: they are one compile.
 *
 * ⛔ **THE POOL IS THE REGIONS WITH ≥1 WIRED DOOR, AND THAT IS NOT A FILTER OF
 * TASTE.** A placed room is entered through a door: `seedlingRegionBinding.
 * resolveArrivalSpawn` lands the player on the arrival exit's `entrance_spawn`,
 * and a region whose payload lists no exit has no spawn to land on — the
 * binding warns and does not teleport. The compile lists only WIRED doors (an
 * unwired one has no destination in the atlas; the compiler omits it by
 * design), so the predicate is "the compiled payload lists ≥1 exit", over the
 * compile's own output, never a list of names. Measured on the starter atlas:
 * 4 of its 10 AP regions — the other six hold only map edges and walk
 * crossings. Order is the compile's (atlas region order × sub-region order).
 *
 * ⛓ **A DOOR IS BOUND TO A SIDE BY ORDER, AND BECOMES `external`** (⚖ the
 * user, 2026-09-22, Q10 — the maze atlas hook's relabel rule,
 * `mazeLibraryEntry.js`). A Seedling door has no side; the grid asks for sides.
 * The k-th side the driver asks for takes the k-th door in payload order, and
 * the door keeps its `exit_id` (the atlas's own spelling — what the binding
 * matches a departure against) while the engine's `exit_<side>` rides
 * `exitName`. Every bound door is `external: true` with `target_level`/
 * `target_spawn` NULL: its far side is whatever the grid put there, never the
 * level the real game's door leads to. A surplus door is dropped with a
 * `pruned_exit` note; a side beyond the room's doors is REFUSED by name —
 * the spiral's quota check cannot see a door count.
 *
 * @param {object} atlasDoc a region atlas document
 * @returns {{atlasDoc: object, atlasId: string, zones: object[], doorless: string[], blocks: object}}
 */
export function buildSeedlingContentSource(atlasDoc) {
    const validation = validateRegionAtlas(atlasDoc);
    if (!validation.ok) {
        throw new Error(`${FLASH_SEEDLING_SUBSTRATE_ID}: the atlas document handed to applyPipelineConfig `
            + `({atlasDoc}) does not validate, so none of its rooms can be placed as content: `
            + validation.errors.join('; '));
    }
    const { rules } = compileRegionAtlas(atlasDoc);
    const apRegions = rules.regions['1'];
    const zones = [];
    const doorless = [];
    for (const [apName, sidecar] of Object.entries(rules.preset_sidecars?.['1'] ?? {})) {
        if (sidecar.substrate !== FLASH_SEEDLING_SUBSTRATE_ID) continue;
        const payload = sidecar.playable_payload;
        if (payload.exits.length === 0) { doorless.push(apName); continue; }
        zones.push({
            apName,
            region: atlasDoc.regions.find((r) => r.region_id === payload.atlas_region),
            payload,
            locations: apRegions[apName].locations,
        });
    }
    return {
        atlasDoc,
        atlasId: atlasDoc.atlas_id,
        zones,
        doorless,
        // The two top-level blocks the flash panel engages on, as THIS compile
        // wrote them (`rulesJsonBlocks` below).
        blocks: {
            region_atlas: rules.region_atlas,
            ...(rules.flash_panel ? { flash_panel: rules.flash_panel } : {}),
        },
    };
}

/**
 * ⛓ A content source per atlas DOCUMENT, built once — the hub's read-back asks
 * for the same fetched atlas many times per picker draw (`zoneOfPayload` per
 * sibling), and a build compiles the atlas. Pure: nothing is installed.
 */
const builtSources = new WeakMap();
function sourceOf(atlasDoc) {
    if (atlasDoc === SEEDLING_STARTER_ATLAS) return contentSourceOfStarter();
    let src = builtSources.get(atlasDoc);
    if (!src) {
        src = buildSeedlingContentSource(atlasDoc);
        builtSources.set(atlasDoc, src);
    }
    return src;
}

let starterSource = null;
function contentSourceOfStarter() {
    starterSource ??= buildSeedlingContentSource(SEEDLING_STARTER_ATLAS);
    return starterSource;
}

let installedSource = null;
/** The installed content source — the starter atlas until `applyPipelineConfig` installs another. */
function contentSource() {
    installedSource ??= contentSourceOfStarter();
    return installedSource;
}

/**
 * ⛓ SEEDLING GENERATED LEVELS G1 — **THE `flash_panel` BLOCK, READ OFF THE
 * INSTALLED SOURCE** (a copy). `FLASH_PANEL_WIRING` (`regionAtlasCompiler.js`) is
 * the ONLY code source of a preset's `flash_panel` block, and the compile of the
 * installed atlas is where it is written; `flash_seedling_gen`'s
 * `rulesJsonBlocks` reads it here rather than typing the wiring a second time.
 */
export function seedlingFlashPanelBlock() {
    return structuredClone(contentSource().blocks.flash_panel);
}

/**
 * ⛓ THE ONE BINDER (the spiral's `extractZoneRules` and sphere growth's
 * `generateZoneForSpecs` both call it): the k-th requested side takes the k-th
 * door in payload order, `external`, keeping its `exit_id`; a door beyond the
 * sides is dropped with a `pruned_exit` note. The caller has already refused a
 * side count the room cannot meet, in its own mode's sentence.
 */
function bindDoorsToSides(zone, regionId, exitSides) {
    const { exits: doors, ...payload } = zone.payload;
    const boundDoors = {};
    const exitRules = {};
    exitSides.forEach((side, k) => {
        boundDoors[side] = { ...doors[k], side, external: true };
        const rule = boundaryRule(zone.region, doors[k].exit_id);
        if (rule) exitRules[side] = rule;
    });
    const notes = doors.slice(exitSides.length).map((door) => ({
        kind: 'pruned_exit', region_id: regionId, exit_id: door.exit_id,
        message: `"${zone.apName}" door "${door.exit_id}" has no side to route to in this world `
            + `(its cell asks for ${exitSides.length} side(s)) — it is left out of the sidecar; the `
            + 'real door stays in the level and fires the real game\'s own transition',
    }));
    return { payload: { ...payload, bound_doors: boundDoors }, exitRules, notes };
}

/**
 * The zone channel for one placed room (see `buildSeedlingContentSource`).
 * `payload` is the compile's payload for the region with `exits` REPLACED by
 * `bound_doors` — `{<side>: door}` — because `buildPresetSidecars` overwrites a
 * payload's `exits` with the engine's own exit table before serializing; this
 * entry's `serializeWorld` joins the two back into the sidecar's exit list.
 */
function extractZoneRules(zoneIdx, { region_id: regionId, exitSides = [] } = {}) {
    const source = contentSource();
    const zone = source.zones[zoneIdx];
    if (!zone) {
        throw new Error(`${FLASH_SEEDLING_SUBSTRATE_ID}: zone ordinal ${zoneIdx} is out of range — the `
            + `installed atlas "${source.atlasId}" offers ${source.zones.length} placeable room(s) `
            + `[${source.zones.map((z) => z.apName).join(', ')}]; ${source.doorless.length} more have no `
            + `wired door [${source.doorless.join(', ')}] and cannot be placed, because a room with no `
            + 'door has no arrival spawn.');
    }
    const doors = zone.payload.exits;
    if (exitSides.length > doors.length) {
        throw new Error(`${FLASH_SEEDLING_SUBSTRATE_ID}: region "${regionId}" places the real room `
            + `"${zone.apName}", which has ${doors.length} wired door(s) `
            + `[${doors.map((d) => d.exit_id).join(', ')}], but its grid cell needs ${exitSides.length} `
            + `exit side(s) [${exitSides.join(', ')}], one per occupied neighbour. A real room has the `
            + `doors it has: lower the quotas so the spiral leaves this cell at most ${doors.length} `
            + 'neighbour(s), or install an atlas whose room at this ordinal has more wired doors.');
    }
    const { payload, exitRules, notes } = bindDoorsToSides(zone, regionId, exitSides);
    return {
        locations: zone.locations.map((loc) => ({
            id: loc.name,
            global_name: loc.name,
            item: loc.item?.name ?? null,
            ...(loc.access_rule ? { access_rule: loc.access_rule } : {}),
        })),
        exitRules,
        payload,
        ...(notes.length ? { notes } : {}),
    };
}

/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T3 — **A REAL ROOM AS A SPHERE-GROWTH LEAF.**
 *
 * Sphere growth realises a node's ENTRY gate on its PARENT's forward exit and
 * its children's gates on the node's own forward exits. A real Seedling door
 * cannot enforce an AP item gate — the game opens it for whoever walks onto
 * it — so a placed room hosts NO children (`canHostExitGates` declines every
 * one) and its door back to the parent is UNGATED (`backPortalGated`): the
 * entry gate stays on the parent's exit, where the parent's substrate
 * enforces it. So the one spec this realiser can meet is a LEAF: exactly one
 * exit side (the back door) and the node's items.
 *
 * ⛓ A real room is a SPECIFIC place, so it is placed AT MOST ONCE per
 * generation — sphere growth never consults `zoneCount` (that is the
 * spiral's), so this law is the entry's own. The placed rooms are keyed by
 * the region that took them: a region realised again (a re-roll) keeps its
 * room. `prepareSphereGrowth`, which sphere growth's config assembly calls once
 * per generation (`sphereConfigHooks.collectSphereGrowthPrep`), clears them.
 */
const sphereRooms = new Map(); // region_id -> the placed room's apName

/**
 * Choose the room for a leaf needing `nSides` door(s) and `nItems` location(s):
 * the TIGHTEST room no other region holds that fits —
 * fewest locations, then fewest doors, then declaration order (the atlas
 * source's rule, `buildSphereAtlasSource`: a leaf needing no location must not
 * take the one room with a chest). Refused by name when none fits.
 */
function chooseSphereRoom(source, regionId, nSides, nItems) {
    // ⛓ The rooms OTHER regions hold. A region realised again sees its own room
    //   as free, and it is still the tightest fit (placements since then only
    //   removed candidates), so it keeps it.
    const placed = new Set([...sphereRooms].filter(([r]) => r !== regionId).map(([, room]) => room));
    const fits = (z) => z.payload.exits.length >= nSides && z.locations.length >= nItems;
    const pick = source.zones.map((z, i) => ({ z, i }))
        .filter(({ z }) => !placed.has(z.apName) && fits(z))
        .sort((a, b) => (a.z.locations.length - b.z.locations.length)
            || (a.z.payload.exits.length - b.z.payload.exits.length) || (a.i - b.i))[0]?.z;
    if (!pick) {
        const table = source.zones.map((z) => `${z.apName} (${z.payload.exits.length} door(s), `
            + `${z.locations.length} location(s)${placed.has(z.apName) ? ', placed' : ''})`).join('; ');
        throw new Error(`${FLASH_SEEDLING_SUBSTRATE_ID}: no unplaced room of the installed atlas `
            + `"${source.atlasId}" fits region "${regionId}" (needs ${nSides} door(s) + ${nItems} `
            + `location(s)); the rooms are [${table}]. A real room is a SPECIFIC place and is placed at `
            + `most once per world — lower the ${FLASH_SEEDLING_SUBSTRATE_ID} quota, lower `
            + 'maxItemsPerRegion or raise fillerCount (a filler leaf needs no location), or install an '
            + 'atlas with more rooms.');
    }
    sphereRooms.set(regionId, pick.apName);
    return pick;
}

/**
 * The sphere-growth zone realiser (`generateRegionZoneGen`'s contract). The
 * room's marked locations take the node's items in order, under the COMPILER's
 * names (`global_name` — the names the check binding reports); `exitRules` is
 * EMPTY: the room hosts no child gate, and the back door's logic is the
 * parent's forward gate, which `buildRulesJson`'s bidirectional pass copies onto
 * it. `payload` is the spiral's atlas-reference payload, bound by the one binder.
 */
function generateZoneForSpecs({ region_id: regionId, exitSpecs = [], locationSpecs = [] } = {}) {
    if (exitSpecs.length !== 1) {
        throw new Error(`${FLASH_SEEDLING_SUBSTRATE_ID}: region "${regionId}" asks a real Seedling room `
            + `for ${exitSpecs.length} exit side(s) [${exitSpecs.map((e) => e.side).join(', ')}], but a `
            + 'room is placed only as a LEAF: its one exit is the door back to its parent. A real door '
            + 'cannot enforce an AP gate, so the room hosts no children (canHostExitGates declines them) '
            + 'and cannot be a start region — place it with sphere growth behind a parent of another '
            + 'substrate, or with the shuffled spiral, which binds a door per neighbour.');
    }
    const source = contentSource();
    const zone = chooseSphereRoom(source, regionId, exitSpecs.length, locationSpecs.length);
    const { payload } = bindDoorsToSides(zone, regionId, exitSpecs.map((e) => e.side));
    return {
        locations: locationSpecs.map((spec, k) => ({
            id: spec.id,
            global_name: zone.locations[k].name,
            item: spec.item ?? null,
        })),
        exitRules: {},
        payload,
    };
}

/* ── APWORLD SUBSTRATE CHANGE R5c — the hub's ATLAS-ROOM source ────────── */

/** ⛓ The Source row's word for this entry's zones (the hub reads it; default *Zone N*). */
export const FLASH_SEEDLING_ZONE_SOURCE_LABEL = 'Atlas room';

/** ⛓ Why a doorless room cannot be picked — the channel's own reason, said once. */
export const FLASH_SEEDLING_DOORLESS_REASON = 'no wired door — a placed room is entered through a door, and a '
    + 'room with none has no arrival spawn';

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * ⛓⛓⛓ **THE ATLAS A DOCUMENT'S ROOMS WERE PLACED FROM, READ BACK** (the hub's
 * `zoneConfigFromSlot` contract, `apworldEditor/regionContent.js`). What the
 * document records, and where:
 *
 *   · the atlas's IDENTITY — `region_atlas.atlas_id` (a document-level block
 *     this entry's `rulesJsonBlocks` writes; the hub hands it in as
 *     `blocks.region_atlas`), which every placed room's `atlas_ref` repeats;
 *   · NOT the atlas itself — `region_atlas.map_document` names the LEVEL map,
 *     not an atlas. The id is resolved through the served index
 *     (`atlas_files.json`), and the atlas is FETCHED: the answer is `{ok: false,
 *     needs: [path]}` until the caller hands the fetched documents back in
 *     `fetched` (`{[path]: doc}`). The bundled starter atlas needs no fetch.
 *
 * Refused by name: a missing block (the flash panel engages on
 * `flash_panel`, and the atlas is named only in `region_atlas`); a room whose
 * `atlas_ref` is not the document's `atlas_id`; an id the index does not list;
 * a fetched atlas whose `atlas_id` is not the one asked for; an atlas that
 * does not validate. Nothing is `assumed` — the atlas is the whole config.
 */
function zoneConfigFromSlot({ entries = {}, blocks = {}, fetched = {} } = {}) {
    for (const key of Object.keys(blocks)) {
        if (!isPlainObject(blocks[key])) {
            return {
                ok: false,
                why: `the document carries no \`${key}\` block — a placed room needs both top-level blocks this `
                    + `entry writes [${Object.keys(blocks).join(', ')}] (\`region_atlas\` names the atlas the room `
                    + 'is read from; the flash panel engages on `flash_panel`)',
            };
        }
    }
    const atlasId = blocks.region_atlas?.atlas_id;
    if (typeof atlasId !== 'string' || atlasId === '') {
        return { ok: false, why: 'its `region_atlas` block names no `atlas_id`' };
    }
    for (const [region, e] of Object.entries(entries)) {
        const ref = e?.playable_payload?.atlas_ref;
        if (typeof ref !== 'string') continue;
        if (ref !== atlasId) {
            return {
                ok: false,
                why: `region "${region}" plays a room of atlas \`${ref}\`, but the document's \`region_atlas\` `
                    + `names \`${atlasId}\` — one slot reads its rooms from one atlas`,
            };
        }
        // ⛓ A PLACED room's exits are doors bound to sides (`bindDoorsToSides`:
        //   `side` + `external`). The atlas COMPILER's projection writes the
        //   level's own transitions instead — a whole-atlas world, not rooms
        //   placed as content — so the channel never made it and cannot rebuild it.
        const exits = Array.isArray(e.playable_payload.exits) ? e.playable_payload.exits : [];
        const unbound = exits.filter((x) => typeof x?.side !== 'string' || x?.external !== true);
        if (unbound.length) {
            return {
                ok: false,
                why: `region "${region}" is the region atlas COMPILER's projection of its room, not a room placed as `
                    + `content — ${unbound.length} of its ${exits.length} exit(s) are the level's own transitions `
                    + `[${unbound.slice(0, 3).map((x) => x?.exit_id).join(', ')}${unbound.length > 3 ? ', …' : ''}], `
                    + 'not doors bound to sides, so the content source never made this slot and cannot rebuild it',
            };
        }
    }
    let atlasDoc = null;
    if (atlasId === SEEDLING_STARTER_ATLAS.atlas_id) {
        atlasDoc = SEEDLING_STARTER_ATLAS;
    } else {
        const indexPath = atlasIndexPath();
        if (!(indexPath in fetched)) return { ok: false, needs: [indexPath] };
        const atlasPath = atlasPathInIndex(fetched[indexPath], atlasId);
        if (!atlasPath) {
            return {
                ok: false,
                why: `the atlas index \`${indexPath}\` lists no atlas \`${atlasId}\` — the document's `
                    + '`region_atlas` names an atlas this site does not serve (restamped, or never committed)',
            };
        }
        if (!(atlasPath in fetched)) return { ok: false, needs: [atlasPath] };
        atlasDoc = fetched[atlasPath];
        if (atlasDoc?.atlas_id !== atlasId) {
            return {
                ok: false,
                why: `the served atlas \`${atlasPath}\` is \`${atlasDoc?.atlas_id}\`, not the \`${atlasId}\` the `
                    + 'document names — the index is stale, or the atlas was restamped after this document was built',
            };
        }
    }
    let source;
    try {
        source = sourceOf(atlasDoc);
    } catch (e) {
        return { ok: false, why: String(e?.message ?? e) };
    }
    return {
        ok: true,
        cfg: { atlasDoc },
        assumed: {},
        zoneCount: source.zones.length,
        zoneNames: source.zones.map((z) => z.apName),
        unplaceable: source.doorless.map((name) => ({ name, why: FLASH_SEEDLING_DOORLESS_REASON })),
        host: null,
    };
}

/**
 * ⛓ The room a payload plays, as an ordinal of `cfg.atlasDoc`'s placeable
 * rooms (the hub's held-room test) — matched by `atlas_region` +
 * `atlas_sub_region`, the payload's own spelling of the room; null without the
 * config, for another atlas's room, or for a room this atlas cannot place.
 */
function zoneOfPayload(payload, cfg) {
    if (!isPlainObject(payload) || !isPlainObject(cfg?.atlasDoc)) return null;
    let source;
    try { source = sourceOf(cfg.atlasDoc); } catch { return null; }
    if (payload.atlas_ref !== source.atlasId) return null;
    const i = source.zones.findIndex((z) => z.payload.atlas_region === payload.atlas_region
        && (z.payload.atlas_sub_region ?? null) === (payload.atlas_sub_region ?? null));
    return i < 0 ? null : i;
}

const base = createFlashSubstrateEntry({
    id: FLASH_SEEDLING_SUBSTRATE_ID,
    label: 'Seedling (region atlas)',
    sidecarFields: FLASH_SEEDLING_SIDECAR_FIELDS,
    // v1 keeps the flash family's default (`arbitrary_ap_locations`). An atlas
    // region has real NESW boundary exits and intrinsic frontier rules, but
    // nothing consumes them at build time until Phase 6 teaches sphere growth
    // to place pre-built regions — declaring the features before then would be
    // a vacuous capability claim.
});
// The flashPanel embed is a plain <iframe>, not an iframeAdapter-managed one:
// it never announces `iframe:appReady`, so the factory's default iframeId
// (the shared flash panel's) would only ever mis-fire. Drop it rather than
// leave a claim nothing honours.
//
// ⛓ PRESET SIDECARS V0 — and the factory's two AP-name carriers go the same
// way, for the same reason: neither is true of THIS payload. The atlas compiler
// writes no `ap_locations` (a Seedling region's locations come from the atlas
// graph's projection, not the payload), and its `exits` are the TELEPORTER doors
// only — a walk crossing between two sub-regions of one level is geometry the
// binding reads off the level, so the region's exit list is not the payload's.
// Absent, the hub's validity report says it did not check them.
const {
    iframeId: _unusedIframeId,
    apLocationNamesOf: _noLocationCarrier,
    apExitNamesOf: _noCompleteExitList,
    ...runtime
} = base;

/**
 * The sidecar of a PLACED room: the compile's payload with `bound_doors`
 * joined onto the engine's exit table (see `extractZoneRules`). Each engine
 * exit contributes what only stitching knows — `exitName`, `targetRegion`,
 * `targetExitId` — and, through the 5th argument `buildPresetSidecars` passes,
 * `target_substrate`. A payload with no `bound_doors` (every compiled
 * `seedling_atlas` room) takes the flash family's pass-through unchanged.
 */
function serializeWorld(world, extractedRules, obstacleLib, itemLib, context) {
    const { bound_doors: boundDoors, ...rest } = world ?? {};
    if (boundDoors === undefined) return runtime.serializeWorld(world, extractedRules, obstacleLib, itemLib);
    const engineExits = rest.exits instanceof Map ? [...rest.exits.values()] : (rest.exits ?? []);
    const exits = engineExits.map((e) => {
        const door = boundDoors[e.side];
        if (!door) {
            throw new Error(`${FLASH_SEEDLING_SUBSTRATE_ID}: the region's exit "${e.exitName ?? e.exit_id}" `
                + `(side ${e.side}) has no real door bound to it — extractZoneRules binds one door per side `
                + `it is asked for [${Object.keys(boundDoors).join(', ')}], so this exit was added after `
                + 'extraction and there is no door in the level for it to be.');
        }
        return {
            ...door,
            exitName: e.exitName ?? e.exit_id,
            targetRegion: e.targetRegion ?? null,
            targetExitId: e.targetExitId ?? null,
            // ⛓ T2: the side law's flag, as every stitched maze exit carries it.
            //   Absent, the editor's `move-exit-side` writes `true` out and an
            //   explicit `false` back, and the room does not round-trip
            //   (`apworldEditor/exitSides.test.js`'s corpus control).
            isTeleporter: !!e.isTeleporter,
            target_level: null,
            target_spawn: null,
            // `external: true` is the bound door's own (extractZoneRules wrote it).
            target_substrate: context?.substrateOfRegion?.(e.targetRegion) ?? null,
        };
    });
    return { ...rest, exits };
}

export const substrateRegistryEntry = Object.freeze({
    ...runtime,
    panelComponentType: FLASH_SEEDLING_PANEL_COMPONENT_TYPE,
    loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
    serializeWorld,

    /**
     * ⛓⛓⛓ SEEDLING IN THE PIPELINE T1 — **THE CONTENT SOURCE** (see
     * `buildSeedlingContentSource`). A placed room's exits are its SIDES — the
     * door it is bound to stays where the level put it — so the engine mints
     * no fictional tile for it, and its side is only a label.
     */
    regionGeometry: REGION_GEOMETRY.SIDES,
    exitSides: SIDE_AGNOSTIC_EXIT_SIDES,
    /** Placeable rooms in the installed atlas — a getter, so the spiral's quota check sees the live document. */
    get zoneCount() { return contentSource().zones.length; },
    extractZoneRules,
    /**
     * ⛓⛓⛓ T3 — **SPHERE GROWTH PLACES A ROOM AS A LEAF** (see
     * `generateZoneForSpecs`). A real door enforces no AP gate: the room hosts
     * no child exit, and its back door is ungated — the entry gate stays on
     * the parent's exit.
     */
    generateZoneForSpecs,
    canHostExitGates: () => false,
    backPortalGated: () => false,
    /** Once per sphere generation: every room is unplaced again. Contributes nothing to the plan. */
    prepareSphereGrowth: () => {
        sphereRooms.clear();
        return {};
    },
    /**
     * Install `cfg.atlasDoc`, or the starter atlas when absent — a preset
     * carries no `substrateConfig`, so the default IS the path every preset
     * takes (jta's `applyPipelineConfig({})` precedent). Refused by name when
     * the document does not validate.
     */
    applyPipelineConfig: (cfg) => {
        installedSource = sourceOf(cfg?.atlasDoc ?? SEEDLING_STARTER_ATLAS);
        // A room placed from the atlas this replaces is not a room of the new one.
        sphereRooms.clear();
        return installedSource.atlasDoc;
    },
    /**
     * ⛓ APWORLD SUBSTRATE CHANGE R6b — the one key `applyPipelineConfig` reads.
     * No `recordablePipelineConfig`: the atlas is the whole config, and the
     * document already names it (`region_atlas.atlas_id`).
     */
    pipelineConfigKeys: Object.freeze(['atlasDoc']),
    /**
     * The two top-level blocks the flash panel needs in the rules.json of a
     * world that placed a room — `region_atlas` (`mapDocumentPath.js` resolves
     * the map document through it) and `flash_panel` (the panel engages on it,
     * `flashPanelUI.js`) — exactly as the installed atlas's own compile writes
     * them. `buildRulesJson` asks only when ≥1 region of this substrate was
     * realised.
     */
    rulesJsonBlocks: () => structuredClone(contentSource().blocks),
    /**
     * ⛓⛓ APWORLD SUBSTRATE CHANGE R5c — **THE HUB'S ATLAS-ROOM SOURCE**: the
     * read-back pair `apworldEditor/regionContent.js` asks (see
     * `zoneConfigFromSlot` above), and the Source row's word for it.
     */
    zoneConfigFromSlot,
    zoneOfPayload,
    zoneSourceLabel: FLASH_SEEDLING_ZONE_SOURCE_LABEL,
    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W3 — **THE ROOM-EDITOR DECLARATION**
     * (the editor-integration plan §3.2). Seedling's room editor is
     * `watch.html`'s EDIT arm holding a LEVEL SET, hosted in `procgenLabPanel`;
     * `regionEditors.getRegionEditor('flash_seedling')` binds
     * `procgenLabPanel/labRoomEditor` to it.
     *
     * ⛔ **`page` IS `seedling`, NOT `flash_seedling`.** The registry id names
     * the SUBSTRATE and `labProtocol.SUBSTRATES` names the two LAB PAGES; they
     * are different vocabularies that happen to agree for the maze, and one
     * field doing both jobs would be the two-spellings failure this arc keeps
     * paying for.
     *
     * ⚠ AND THE ARM IS `edit`, NOT `set`. `watch.html` holds a level set on its
     * EDIT arm (`?source=edit`, editor-v3 C2/D1); the maze mints a fourth arm
     * for it (`?source=set`). Two pages, two grammars, and the entry is where
     * each one says which is its own.
     */
    roomEditor: Object.freeze({ kind: 'lab', page: 'seedling', arm: 'edit' }),

    /**
     * ⛓⛓⛓ APWORLD EDITOR HUB H4b — **THERE IS NO DOCUMENT ⇄ ROOM ROUND TRIP
     * FOR SEEDLING, AND THE ENTRY SAYS WHY** (rather than the hub inferring it
     * from an absent field, which would read as *"nobody has written it yet"*).
     *
     * ⛔ MEASURED: a Seedling sidecar's `playable_payload` is
     * `{gameId, atlas_ref, atlas_region, atlas_sub_region, level, tile_size,
     * exits}` — an ATLAS REFERENCE into a level, not an authored room record.
     * The room itself lives in the LEVEL SET and the atlas that the region
     * marking tool and `watch.html` own, and a rules.json carries neither. So
     * there is no one-room set document for the lab's EDIT arm to open, and
     * nothing a save could be written back INTO on this side.
     *
     * ⛓ `roomEditor` above stays exactly as it is: the pipeline's own Edit
     * still opens a Seedling room from a LIVE run, where the level set is in
     * hand. It is the DOCUMENT direction that has no answer.
     */
    regionRoundTrip: Object.freeze({
        refused: 'a Seedling sidecar payload is an ATLAS REFERENCE '
            + '(`atlas_ref` / `atlas_region` / `atlas_sub_region` / `level`), not an authored '
            + 'room record — the room lives in the level set and the atlas that the region '
            + 'marking tool and `watch.html` own, and a rules.json carries neither, so there '
            + 'is no one-room document to hand the lab\'s edit arm.',
    }),
});

// Side-effect on import — the standing convention (see
// docs/json/developer/procgen/substrate-registry.md): headless callers get a
// populated registry from the import alone, and the module's own register()
// hook repeats it idempotently in the live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}

/**
 * ⛓⛓⛓ **WHAT A WATCH-PAGE SET IS WHEN IT LEAVES THE LAB** (lab-set-seedling-identity,
 * the study's S1; ⚖ Robert 2026-11-19, Q2 *"Seedling + own fingerprint"*, Q3 *"stay empty,
 * say why"*).
 *
 * Three facts, one place, read by the page (`watchViewer.js`) AND by its node checks
 * (`check-seedling-editor-arm.mjs`, `vanillaOverlay.test.js`), so the checks can never
 * agree with a copy of the page's choice that the page itself no longer makes:
 *
 *  1. **THE GAME IS SEEDLING.** `WATCH_SET_ATLAS.game` is `SEEDLING_ATLAS_GAME`, the one
 *     spelling both labs read (`seedlingAtlasDerivation.js`). Every room therefore
 *     compiles as `flash_seedling`, so the Region Map's Seedling hook, the census and the
 *     APWorld Editor's door see Seedling rooms. Until this slice the page said
 *     `'seedling-watch-edit'`, which slugs to `flash_seedling_watch_edit`, a substrate
 *     nothing registers.
 *     ⛓ The GAME is separated from the map-document LABEL. `mapDocument` stays
 *     `'watch.html set editor'`: it is the `region_atlas[p].map_document` a reader
 *     prints, and it is NOT a file the player can fetch. That is deliberate, because a
 *     label that named `seedling-map.json` is the one value that makes the player load
 *     the ORIGINAL rooms under these rules (the study's probe p5).
 *
 *  2. **EACH SET HAS ITS OWN FINGERPRINT.** The atlas that is COMPILED is a stamped
 *     COPY, made in two steps:
 *       a. `tile_space.map_source` = `level-set-rooms-<8 hex>`, the FNV-1a of the ROOMS
 *          the compile was handed (`options.mapDoc.levels`, the parsed records of every
 *          room: size, tiles, entities). ⛔ This step is needed, and was MEASURED: the
 *          derived atlas does NOT see a room's tiles or its non-location entities
 *          (regions, bounds, exits and locations only). At 3a1909b2dc, the vanilla 116,
 *          the same set with one tile changed, and the same set with one tree added all
 *          stamped to ONE id without it. `map_source` is the schema's own field for
 *          "where the tile map came from" (the atlas references its tile grid and never
 *          embeds it), so the rooms' fingerprint is a reference, not a smuggled field;
 *       b. `stampAtlasIdentity(copy, LAB_SET_ATLAS_BASE)`, so the id is
 *          `seedling-lab-<8-hex FNV-1a of the atlas minus atlas_id and provenance>`,
 *          and through (a) that hash covers the rooms.
 *     It is stamped BEFORE the compile, so `region_atlas[p].atlas_id` and every sidecar's
 *     `playable_payload.atlas_ref` carry the same id by construction (the compiler
 *     writes both from `atlas.atlas_id`). Rewriting them after the compile would mean
 *     editing ~115 payloads by hand.
 *     ⛔ **THE BASE IS NOT `seedling`.** The served ids have the same shape
 *     (`seedling-9ff3df2a`, `seedling-ea1ef5ba` in `flashPanel/atlases/atlas_files.json`),
 *     and the player's guard (slice G) keys "a custom set" on "an atlas id the page
 *     does not serve". With base `seedling`, a lab set whose content equalled a served
 *     atlas would get the served id. That is harmless for an unedited set (its rooms
 *     ARE the original's) but not for an edited one. The distinct base rules it out by
 *     construction, for every set.
 *     ⚠ The REPORT's own atlas (`reportOver`'s `derived.atlas`) stays DELIBERATELY
 *     UNSTAMPED (§19.10 hard #1): it is rebuilt on every report and is not a document
 *     anybody keeps. Only the copies that leave through a door are stamped. The bundle's
 *     `region-atlas` member is the atlas the compile stamped, looked up by the id the
 *     rules name (`atlasAtDoor`). ⛔ It is NOT re-stamped from the live session: the
 *     mount's doors read the LAST REPORT, and a fingerprint of the current rooms would
 *     disagree with that report's rules whenever the set changed after REPORT.
 *
 *  3. **NOTHING PRETENDS TO PLAY.** The compile runs with `flashPanel: false`
 *     (`regionAtlasCompiler.js`, where `options.flashPanel ?? FLASH_PANEL_WIRING[game]`
 *     keeps `false`), so the rules carry no `flash_panel` block. The player cannot
 *     deliver a lab set's rooms yet (the study's S4). Q3's message *"this set can't be
 *     played yet"* is the PLAYER's (slice G, `flashPanel/`), not this file's.
 *
 * ⛔ **THE PAGE INJECTS.** Like `watchSetEditor.js` and `seedlingSetAdapter.js`, this
 * file names no `procgenPipeline/` dependency: `compileRegionAtlas` and
 * `stampAtlasIdentity` are handed in.
 */
import { fnv1a32, stableStringify } from '../procgenCore/contentIdentity.js';
import { SEEDLING_ATLAS_GAME } from './seedlingAtlasDerivation.js';

/** ⛓ The set adapter's `deps.atlas` on the watch page: the GAME and the map-document LABEL. */
export const WATCH_SET_ATLAS = Object.freeze({
    game: SEEDLING_ATLAS_GAME,
    mapDocument: 'watch.html set editor',
});

/** ⛓ The id base of every atlas that leaves the watch page: `seedling-lab-<8 hex>`. */
export const LAB_SET_ATLAS_BASE = `${SEEDLING_ATLAS_GAME}-lab`;

/** ⛓ The compile options the lab adds: no `flash_panel` block until a lab set can play. */
export const LAB_SET_COMPILE_OPTIONS = Object.freeze({ flashPanel: false });

/** ⛓ The prefix of the rooms' fingerprint in `tile_space.map_source`. */
export const LAB_SET_ROOMS_SOURCE = 'level-set-rooms';

/** ⛓ How many compiled atlases the door remembers, newest kept (a report compiles one). */
const DOOR_MEMORY = 8;

/**
 * ⛓⛓ **THE HOOKS A WATCH-PAGE MOUNT TAKES**, built over the injected pipeline.
 *
 * @param {object} o
 * @param {Function} o.compileRegionAtlas  `procgenPipeline/regionAtlasCompiler.js`'s
 * @param {Function} o.stampAtlasIdentity  `procgenPipeline/regionAtlasValidator.js`'s
 * @returns {{compileRegionAtlas: Function, atlasAtDoor: Function, stamp: Function}}
 *   · `stamp(atlas, mapDoc)`: the stamped COPY (map_source, then the id);
 *   · `compileRegionAtlas(atlas, options)`: compiles `stamp(atlas, options.mapDoc)` with
 *     `LAB_SET_COMPILE_OPTIONS`, and remembers the stamped atlas under its id;
 *   · `atlasAtDoor(atlas, rules)`: the stamped atlas the rules were compiled from, found
 *     by `rules.region_atlas[p].atlas_id`. It refuses by name when the rules name no
 *     single atlas, when no compile here made that id, or when the remembered atlas is
 *     not a stamp of the `atlas` handed in.
 *   None of them mutates its argument.
 */
export function labSetIdentity({ compileRegionAtlas, stampAtlasIdentity } = {}) {
    if (typeof compileRegionAtlas !== 'function' || typeof stampAtlasIdentity !== 'function') {
        throw new Error('watchSetIdentity: labSetIdentity needs `compileRegionAtlas` and '
            + '`stampAtlasIdentity` injected. Both live in `procgenPipeline/`, and this module '
            + 'names no pipeline dependency of its own');
    }
    const stamp = (atlas, mapDoc) => {
        if (!Array.isArray(mapDoc?.levels)) {
            throw new Error('watchSetIdentity: a lab set\'s atlas is stamped over its ROOMS, '
                + 'and this compile was handed no `mapDoc.levels`. The atlas alone does not see '
                + 'a room\'s tiles, so an id made without them would give two different sets '
                + 'one fingerprint');
        }
        const copy = structuredClone(atlas);
        copy.tile_space = {
            ...(copy.tile_space ?? {}),
            map_source: `${LAB_SET_ROOMS_SOURCE}-${fnv1a32(stableStringify(mapDoc.levels))}`,
        };
        return stampAtlasIdentity(copy, LAB_SET_ATLAS_BASE);
    };
    const made = new Map();
    const remember = (stamped) => {
        made.delete(stamped.atlas_id);
        made.set(stamped.atlas_id, stamped);
        while (made.size > DOOR_MEMORY) made.delete(made.keys().next().value);
    };
    const sameRegions = (a, b) => stableStringify(a?.regions ?? null) === stableStringify(b?.regions ?? null);
    return Object.freeze({
        stamp,
        compileRegionAtlas: (atlas, options = {}) => {
            const stamped = stamp(atlas, options.mapDoc);
            const out = compileRegionAtlas(stamped, { ...options, ...LAB_SET_COMPILE_OPTIONS });
            remember(stamped);
            return out;
        },
        atlasAtDoor: (atlas, rules) => {
            const refs = Object.values(rules?.region_atlas ?? {});
            if (refs.length !== 1 || typeof refs[0]?.atlas_id !== 'string') {
                throw new Error(`the rules name ${refs.length} region atlas(es), not one, so the `
                    + 'bundle cannot say which atlas they were compiled from');
            }
            const hit = made.get(refs[0].atlas_id);
            if (!hit) {
                throw new Error(`no compile on this page made the atlas the rules name `
                    + `(\`${refs[0].atlas_id}\`); press REPORT and bundle again`);
            }
            if (!sameRegions(hit, atlas)) {
                throw new Error(`the atlas \`${refs[0].atlas_id}\` the rules were compiled from `
                    + 'does not match the report\'s atlas; press REPORT and bundle again');
            }
            return structuredClone(hit);
        },
    });
}

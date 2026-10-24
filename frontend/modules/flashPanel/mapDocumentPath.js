/**
 * flashPanel/mapDocumentPath — **WHERE THE MAP DOCUMENT IS, SPELLED ONCE**
 * (maze-lab arms F-b / plan §17.1 F7).
 *
 * ── ⛔⛔ THREE SPELLINGS OF ONE LOCATION ─────────────────────────────────
 *
 *   `seedlingDemo/watchViewer.js`   `ATLAS_URL` — `repoUrl('frontend/modules/
 *                                   flashPanel/atlases/seedling-map.json')`
 *   `seedlingDemo/levelSource.js`   `ATLAS_PATH` — `new URL('../flashPanel/
 *                                   atlases/seedling-map.json', …)`, node
 *   `flashPanel/seedlingRandomizer
 *   Wiring.resolveMapPath`          `AP_ASSET_PATHS.atlasDir + rules.
 *                                   region_atlas.map_document`, else the default
 *
 * ⛓ **WHAT IS SHARED IS THE RELATIVE PATH, AND ONLY THAT.** The three resolve
 * it against three different bases — `repoUrl`'s `import.meta.url` walk, node's
 * `fileURLToPath`, and the panel's `document.baseURI` — and those bases are
 * facts about the three CALLERS (a browser page two levels under `frontend/`, a
 * node process, a bundled panel served from the site root). The PATH is not.
 *
 * ── ⚖ AND THE OVERRIDE REACHES EXACTLY ONE OF THEM, WHICH WAS MEASURED ──
 *
 * The survey's finding was *"only the panel honours `rules.json`'s
 * `region_atlas.map_document`, so a preset pointing at an alternate map gets it
 * in the game and the vanilla extract in the lab"*. MEASURED before this file
 * was written:
 *
 *   · `grep -rl map_document frontend/presets --include=*_rules.json` = **3
 *     presets** (`seedling_atlas`, `seedling_atlas_maze`,
 *     `seedling_playthrough`) and **all three name `seedling-map.json`**, which
 *     is the default. The divergence has ZERO instances in the tree.
 *   · the hosted lab receives no rules at all: `procgenCore/labProtocol`'s
 *     `LAB_PAYLOAD_FIELDS[load]` is an address plus a `payload`, and
 *     `watchViewer.hostLoad` sniffs a set / an overlay / a gen payload. There
 *     is no CHANNEL by which an override could reach the lab today.
 *
 * ⇒ this file is the ONE relative-path derivation, and nothing more. *"The lab
 * honours the override when hosted"* is a `labProtocol` field for a case with
 * no instance — residue **F7b**, ⚖ for the user, deliberately NOT built here.
 *
 * ⛔ **DEPENDENCY-FREE, AND THAT IS WHY IT IS ITS OWN FILE.** The obvious home
 * is `seedlingRandomizerWiring.js`, where `resolveMapPath` lives — but that
 * module is behind the panel's loader stub and imports the delivery, the
 * binding and `atlasSource`, so a LAB file importing it would drag all of that
 * onto the lab page to read one string. This file imports nothing.
 */

/**
 * ⛓ DOCUMENT-RELATIVE, from `frontend/`. It is the panel's base (its bundle is
 * served from the site root) and the other two callers each prepend their own
 * walk to it — which is exactly the split this file draws.
 */
export const ATLAS_DIR = 'modules/flashPanel/atlases/';

/** The committed Seedling extract every preset in the tree names. */
export const DEFAULT_MAP_DOCUMENT = 'seedling-map.json';

/**
 * ⛓⛓ APWORLD SUBSTRATE CHANGE R5c — **THE ATLAS INDEX: `atlas_id` → FILE.**
 * A rules.json names its atlas only by id (`region_atlas.atlas_id`, and every
 * payload's `atlas_ref`); `map_document` is the LEVEL map, not an atlas. The
 * index is DERIVED from this directory (`atlasIndex.test.js` pins it), served
 * beside the atlases so a page or worker can resolve an id with one fetch.
 */
export const ATLAS_INDEX_FILE = 'atlas_files.json';

/** The served path of the atlas index, from `frontend/`. */
export function atlasIndexPath() {
    return ATLAS_DIR + ATLAS_INDEX_FILE;
}

/**
 * The served path of the atlas `atlasId` names in `index` (the parsed
 * `atlas_files.json`), or null when the index lists no such atlas.
 */
export function atlasPathInIndex(index, atlasId) {
    const hit = (Array.isArray(index?.atlases) ? index.atlases : [])
        .find((a) => a && a.atlas_id === atlasId && typeof a.file === 'string' && a.file !== '');
    return hit ? ATLAS_DIR + hit.file : null;
}

/**
 * The map document a preset declares, and where that answer came from.
 *
 * ⛔ **THE EVENT WRAPPER IS REFUSED BY NAME** (seedling-pipeline T4, trap 1405).
 * `stateManager`'s catch-up `getLastRawJsonData()` answers the
 * `stateManager:rawJsonDataLoaded` payload `{source, rawJsonData,
 * selectedPlayerInfo}`, not the rules. Read as rules it has no `region_atlas`,
 * so this reader answered the default for EVERY preset, silently. Unwrap with
 * `rulesOfRawPayload`; a wrapper handed here throws instead.
 *
 * ⛓ rules F2 — the block is the SLOT's (`region_atlas["<p>"]`), so the reader
 * names the slot: `player` is the LOADED one. No document-level read exists.
 *
 * @param {object|null} rawRules  a preset's `rules.json`, or null/anything for
 *   the default — the LAB calls it with nothing, because the lab is never told.
 * @param {string|number|null} [player]  the loaded slot; required whenever
 *   `rawRules` carries a `region_atlas` (an omitted one throws rather than
 *   answer the default for a preset that named its map).
 * @returns {{path: string, name: string, source: string}} `path` is relative to
 *   `frontend/`; `name` is the document's own file name; `source` says whether
 *   the preset asked for it.
 */
export function mapDocumentPath(rawRules, player) {
    if (rawRules && typeof rawRules === 'object' && 'rawJsonData' in rawRules) {
        throw new TypeError('mapDocumentPath: handed the stateManager:rawJsonDataLoaded '
            + 'WRAPPER ({source, rawJsonData, selectedPlayerInfo}), not the rules — '
            + 'unwrap it with rulesOfRawPayload()');
    }
    const named = regionAtlasOf(rawRules, player)?.map_document;
    const declared = typeof named === 'string' && named !== '';
    const name = declared ? named : DEFAULT_MAP_DOCUMENT;
    return {
        path: ATLAS_DIR + name,
        name,
        source: declared ? 'region_atlas.map_document' : 'the atlases default',
    };
}

/**
 * The rules OF a `stateManager:rawJsonDataLoaded` payload (what
 * `getLastRawJsonData()` answers): its `rawJsonData`, else null.
 *
 * @param {{rawJsonData?: object}|null|undefined} payload
 * @returns {object|null}
 */
export function rulesOfRawPayload(payload) {
    return payload?.rawJsonData ?? null;
}

/**
 * ⛓ rules F2 — the loaded SLOT of a `stateManager:rawJsonDataLoaded` payload
 * (its `selectedPlayerInfo.playerId`), else null: the slot whose
 * `region_atlas["<p>"]` the raw rules answer for.
 *
 * @param {{selectedPlayerInfo?: {playerId?: string|number}}|null|undefined} payload
 * @returns {string|null}
 */
export function playerOfRawPayload(payload) {
    const p = payload?.selectedPlayerInfo?.playerId;
    return p === undefined || p === null ? null : String(p);
}

/**
 * ⛓ rules F2 — **THE SLOT'S `region_atlas` BLOCK**, the one read of it.
 * `region_atlas` is `{"<p>": block}`; a document-level block is the RETIRED
 * shape (the loader refuses it by name), never read here. A document carrying
 * the key read with the slot argument OMITTED throws: answering "no atlas" for
 * a caller that forgot the slot would be the silent default trap 1405 was. A
 * slot that is PASSED but blank (`null`, `''`) names no slot and reads no
 * atlas — the caller's own slot check refuses it by name (the wiring's
 * *"not an integer player id"*).
 *
 * @param {object|null} rules  a rules.json (never the event wrapper)
 * @param {string|number|null} player  the slot
 * @returns {object|null} `{atlas_id, game, map_document?}` or null
 */
export function regionAtlasOf(rules, player) {
    const map = rules?.region_atlas;
    if (map === undefined || map === null) return null;
    if (player === undefined) {
        throw new TypeError('regionAtlasOf: the rules carry `region_atlas`, which is per player '
            + '(`region_atlas["<p>"]`), and no slot was named — pass the loaded player');
    }
    if (player === null || player === '') return null;
    return map[String(player)] ?? null;
}

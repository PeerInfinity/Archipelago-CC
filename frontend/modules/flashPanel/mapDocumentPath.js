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
 * The map document a preset declares, and where that answer came from.
 *
 * @param {object|null} rawRules  a preset's `rules.json`, or null/anything for
 *   the default — the LAB calls it with nothing, because the lab is never told.
 * @returns {{path: string, name: string, source: string}} `path` is relative to
 *   `frontend/`; `name` is the document's own file name; `source` says whether
 *   the preset asked for it.
 */
export function mapDocumentPath(rawRules) {
    const named = rawRules?.region_atlas?.map_document;
    const declared = typeof named === 'string' && named !== '';
    const name = declared ? named : DEFAULT_MAP_DOCUMENT;
    return {
        path: ATLAS_DIR + name,
        name,
        source: declared ? 'region_atlas.map_document' : 'the atlases default',
    };
}

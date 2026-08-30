/**
 * seedlingDemo/levelSource — the NODE-ONLY edge that hands the engine level
 * records from the committed atlas.
 *
 * The engine modules (`tapeFormat`, `playerPhysicsV1`, `playerPhysicsV2`,
 * `levelWorld`, `tapeRunner`, `botDriverV1`) are dependency-free and
 * browser-usable, and `buildLevelWorld` takes a level RECORD rather than
 * reading anything. So somebody has to inject the records, and this is that
 * somebody for node — tests, the differential harness, the driver scripts.
 * `fixtures/index.js` is the same kind of edge for tapes and expectations.
 *
 * A browser caller writes the same seam over a `fetch`ed atlas, and must
 * import it from `./atlasSource.js` rather than from here:
 *
 *     import { levelSourceFromAtlas } from './atlasSource.js';
 *     const atlas = await (await fetch('.../seedling-map.json')).json();
 *     runTape(tape, { levelSource: levelSourceFromAtlas(atlas) });
 *
 * — which is why the shape is a plain `(level) => record` function and not
 * a class, a path, or a preloaded map of worlds. ⚠ It is re-exported from
 * here for the node callers that already import it, but this FILE is
 * node-only: see the note at the import.
 *
 * The atlas is `frontend/modules/flashPanel/atlases/seedling-map.json`, the
 * committed Phase-2 extract: all 116 levels, tile placements and entities
 * verbatim, with its own `--check` regen gate. There is deliberately NO new
 * artifact and no new regen chain for the bot — the extract and
 * `seedlingSemantics.js` are the whole data surface, and a welcome side
 * effect is that the oracle differential now live-tests the same tables the
 * Phase-5a region analyzer trusts.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { levelSourceFromAtlas } from './atlasSource.js';

// ⚠ RE-EXPORTED, NOT DEFINED HERE. This file imports `node:fs` at the top,
// and an ES module runs its imports before any export is reachable — so a
// BROWSER importing `levelSourceFromAtlas` from here dies on `node:fs` and
// never reaches the function, however node-free the function itself is.
// "The function has no node dependency" and "the module loads in a browser"
// are different claims, and only the first was ever true. The watch page is
// the first real browser caller and found it immediately.
export { levelSourceFromAtlas };

/** The committed extract. */
export const ATLAS_PATH = fileURLToPath(
    new URL('../flashPanel/atlases/seedling-map.json', import.meta.url),
);

let cachedAtlas = null;

/** Read (and memoise) the atlas. ~975 KB, so once per process is plenty. */
export function loadAtlas() {
    if (!cachedAtlas) cachedAtlas = JSON.parse(readFileSync(ATLAS_PATH, 'utf8'));
    return cachedAtlas;
}

/** The node convenience: a `levelSource` over the committed extract. */
export function atlasLevelSource() {
    return levelSourceFromAtlas(loadAtlas());
}

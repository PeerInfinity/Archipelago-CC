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
 * A browser caller writes the same seam over a `fetch`ed atlas:
 *
 *     const atlas = await (await fetch('.../seedling-map.json')).json();
 *     const source = levelSourceFromAtlas(atlas);
 *     runTape(tape, { levelSource: source });
 *
 * — which is why the shape is a plain `(level) => record` function and not
 * a class, a path, or a preloaded map of worlds. `levelSourceFromAtlas` is
 * exported and has no node dependency; only `atlasLevelSource` reads disk.
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

/**
 * A `levelSource` over an already-loaded atlas object.
 *
 * Throws by name on a level the atlas does not have, rather than returning
 * undefined for `buildLevelWorld` to trip over one frame later — the level
 * number in a teleporter's `to` attribute is the kind of thing that is
 * wrong by transcription, and it should say so.
 */
export function levelSourceFromAtlas(atlas) {
    const byLevel = new Map((atlas?.levels ?? []).map((l) => [l.level, l]));
    return (level) => {
        const record = byLevel.get(level);
        if (!record) {
            throw new Error(`seedling atlas has no level ${level} (it has `
                + `${byLevel.size} levels)`);
        }
        return record;
    };
}

/** The node convenience: a `levelSource` over the committed extract. */
export function atlasLevelSource() {
    return levelSourceFromAtlas(loadAtlas());
}

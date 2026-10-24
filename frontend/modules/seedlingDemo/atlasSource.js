/**
 * seedlingDemo/atlasSource — the BROWSER-SAFE half of `levelSource`.
 *
 * ⚠ This module exists because "the function has no node dependency" and
 * "the module can be imported in a browser" are not the same claim, and
 * `levelSource.js` only ever satisfied the first. Its docblock has always
 * said `levelSourceFromAtlas` is the browser seam and has no node
 * dependency — true of the function, false of the file, which imports
 * `node:fs` and `node:url` at the top so that `atlasLevelSource()` can read
 * the committed extract off disk. An ES module runs its imports before any
 * export is reachable, so a browser importing `levelSourceFromAtlas` from
 * there fails on `node:fs` and never gets to the function at all.
 *
 * Nothing was wrong until something tried it: the watch page is the first
 * real browser caller, and it found this immediately. So the function moved
 * here, with NO imports of any kind, and `levelSource.js` re-exports it —
 * every existing node caller is untouched and the browser has a file it can
 * actually load.
 *
 * The general shape, worth carrying: a "browser-usable" export in a file
 * with a node-only import is browser-usable only in theory. The engine
 * modules (`tapeFormat`, `playerPhysicsV1/V2`, `levelWorld`, `tapeRunner`,
 * `botDriverV1/V2`) are dependency-free for exactly this reason; this file
 * puts the injection seam on the same footing.
 */

/**
 * ⛓ **INDEX A MAP DOCUMENT'S ROOMS BY LEVEL — THE ONE SPELLING** (maze-lab arms
 * F-a / plan §17.1 F11).
 *
 * `{ levels: [{level, …}] }` is the shape the committed Seedling extract
 * (`flashPanel/atlases/seedling-map.json`, 116 rooms) and every derived room set
 * carry, and three places built the same Map from it — here,
 * `flashPanel/seedlingRandomizerWiring.js`, and
 * `flashPanel/seedlingAtlasAnalysis.indexSeedlingLevels`. The third keyed it by
 * `String(level.level)` while the other two used the number, so a number-keyed
 * Map handed to it looked up as a string and MISSED — silently, as `undefined`.
 * ⇒ ONE key type, and it is the number the documents actually carry (measured:
 * all 116 `level` fields in the extract are integers).
 *
 * ⛔ THIS FILE, and not `flashPanel/seedlingSemantics.js`, because the panel is
 * the side with the bundle constraint and this direction is the cheap one.
 * MEASURED at `8a1eb6b1a` over the static-import closure: `atlasSource.js` has
 * no imports at all, so importing it costs a flashPanel module **+1 file,
 * +2,138 B** (`seedlingRandomizerWiring` 6 files/78,888 B → 7/81,026;
 * `seedlingAtlasAnalysis` 6/162,009 → 7/164,147). The reverse — the panel's
 * semantics module reaching seedlingDemo — is what §5i priced at 1 MB.
 *
 * ⛔ `apPlacementRewriter.recordsByLevel` is NOT a caller and that is
 * deliberate: it indexes to `{record, i}` rather than to the record, and it
 * REFUSES a non-integer level and a duplicate one by name, because the ledger
 * addresses rooms by level and an array position would silently address the
 * neighbour. A refusing index with a different value type is a different
 * function, not a fourth copy of this one.
 *
 * @param {{levels?: object[]}|Map} doc  the document, or an already-built Map,
 *   which is returned unchanged — `indexSeedlingLevels` has always accepted
 *   both and its callers rely on it.
 * @returns {Map<number, object>} level number -> the room record.
 */
export function indexLevels(doc) {
    if (doc instanceof Map) return doc;
    return new Map((doc?.levels ?? []).map((l) => [l.level, l]));
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
    const byLevel = indexLevels(atlas);
    return (level) => {
        const record = byLevel.get(level);
        if (!record) {
            throw new Error(`seedling atlas has no level ${level} (it has `
                + `${byLevel.size} levels)`);
        }
        return record;
    };
}

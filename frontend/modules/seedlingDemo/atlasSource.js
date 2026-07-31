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

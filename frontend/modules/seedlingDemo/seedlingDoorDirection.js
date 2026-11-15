/**
 * seedlingDemo/seedlingDoorDirection — **WHICH WAY A SEEDLING DOOR LEADS** (Seedling editor E3's `dirOfExit`, MOVED
 * here verbatim by region-map step 3a so `flashPanel/seedlingCompositeMap.js`'s `layoutGraph` hook can reuse it
 * without `seedlingSetMap.js`'s import of `seedlingAtlasDerivation` — the flash panel's static closure must not reach
 * that module (`seedlingRegionBinding.test.js`, F6). `seedlingSetMap.js` re-exports it unchanged.
 *
 * ⛔ Keep this file's imports this small: `procgenCore/setMapLayout.js` and the tile size, nothing else.
 */
import { TILE_PX } from './levelSetValidator.js';
import { OPPOSITE, edgeOf } from '../procgenCore/setMapLayout.js';

/**
 * The direction a door leads in: from the source room's side, else from the arrival's side in the target
 * (reversed), else `null`.
 * @returns {{dir: 'N'|'S'|'E'|'W'|null, from: 'source'|'arrival'|null}}
 */
export function dirOfExit(exit, sourceSize, targetSize, tileSize = TILE_PX) {
    const half = tileSize / 2;
    const src = edgeOf({ x: exit.x + half, y: exit.y + half }, sourceSize);
    if (src) return { dir: src, from: 'source' };
    if (Number.isFinite(exit.playerx) && Number.isFinite(exit.playery)) {
        const arr = edgeOf({ x: exit.playerx, y: exit.playery }, targetSize);
        if (arr) return { dir: OPPOSITE[arr], from: 'arrival' };
    }
    return { dir: null, from: null };
}

/**
 * flashPanel/seedlingWallFlyerBands — **A WALLFLYER'S FLIGHT BAND, FROM THE CLASS'S OWN TRANSCRIPTION** (slice
 * rules-no-hit-l22; ⚖ Robert 2026-10-21 "the logic shouldn't expect" a tanked hit, generalised 2026-11-11).
 *
 * `Enemies/WallFlyer.as` sits against a wall and, when the player stands on the ray away from that wall, launches down
 * it at `moveSpeed` until a solid stops it; from there its next ray points back. The cells its 14x14 body covers on
 * that flight are its BAND: a player who crosses them meets the body. Nothing here names a room. Each band is read by
 * running `seedlingDemo/wallFlyer.js` (the transcription `levelRun` steps) on the room's own solids:
 *   1. `check()`: the body settles INTO its wall (`decideMotion(-moveSpeed)`), which gives its rest pose;
 *   2. one update with the player on its ray: the launch vector (`decideMotion(moveSpeed)`);
 *   3. updates with no player until it stops: every tile its box overlaps on the way is a band tile.
 *
 * ⚠ A BAND IS NOT A RULE, and nothing in the rules reads this module. Charged as crossing material (the way a rope's
 * lane is), the bands split L25 and L27 as well as L22, and the game says otherwise in both: L27 is crossed with no
 * item in either direction, L25 from its east side, and L22 itself from north to south
 * (`scripts/procgen/probe-seedling-wallflyer-nohit.mjs`, which prints these bands as its `BAND` rows). What a band
 * costs depends on which way it is crossed and on what stands beside it, which the band alone does not say.
 *
 * ⛓ The flight is the FIRST one, from the placement. A flyer redirected in mid-flight (it passes under a solid with
 * the player below: `decideMotion` answers again wherever a wall is adjacent) leaves this band; that flight depends on
 * where the player stands, so it is not a property of the room and is not derived here.
 */
import { newWallFlyer, stepWallFlyer, wallFlyerRect } from '../seedlingDemo/wallFlyer.js';

const TILE = 16;
/** A player box that every ray meets: the one launch of step 2. */
const ON_EVERY_RAY = Object.freeze({ x: -1e6, y: -1e6, w: 2e6, h: 2e6, right: 1e6, bottom: 1e6 });
/** A flight that has not stopped after this many updates is refused (no room is this long at 4 px a tick). */
const MAX_TICKS = 4096;

/**
 * Every wallflyer of one level: its rest pose, launch vector, stop pose and band tiles (in flight order).
 *
 * @param {{level:number, entities?:object[]}} level a map level record
 * @param {{collidesSolid:(rect:object)=>boolean}} world `levelWorld.buildLevelWorld(level)`
 * @returns {{id:string, rest:{x:number,y:number}, launch:{x:number,y:number}, stop:{x:number,y:number}, tiles:[number,number][]}[]}
 */
export function wallFlyerBands(level, world) {
    const collides = (rect) => world.collidesSolid(rect);
    const ctx = (playerBox) => ({ collides, probe: collides, tileTypeAt: () => 0, onScreen: () => true, playerBox, hitPlayer: (b) => b });
    return (level.entities ?? []).filter((e) => e.type === 'wallflyer').map((e) => {
        let w = newWallFlyer({ id: `wallflyer@${e.x},${e.y}`, x: e.x, y: e.y });
        const fly = (what) => {
            for (let n = 0; n < MAX_TICKS; n += 1) {
                w = stepWallFlyer(w, ctx(null)).w;
                what();
                if (w.vx === 0 && w.vy === 0) return;
            }
            throw new Error(`wallFlyerBands: ${w.id} in level ${level.level} has not stopped after ${MAX_TICKS} updates`);
        };
        fly(() => {});
        const rest = { x: w.x, y: w.y };
        const tiles = new Map();
        const cover = () => {
            const r = wallFlyerRect(w);
            for (let ty = Math.floor(r.y / TILE); ty * TILE < r.bottom; ty += 1) {
                for (let tx = Math.floor(r.x / TILE); tx * TILE < r.right; tx += 1) tiles.set(`${tx},${ty}`, [tx, ty]);
            }
        };
        cover();
        w = stepWallFlyer(w, ctx(ON_EVERY_RAY)).w;
        const launch = { x: w.vx, y: w.vy };
        if (launch.x !== 0 || launch.y !== 0) fly(cover);
        return { id: w.id, rest, launch, stop: { x: w.x, y: w.y }, tiles: [...tiles.values()] };
    });
}

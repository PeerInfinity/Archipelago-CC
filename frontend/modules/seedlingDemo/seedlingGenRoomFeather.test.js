/**
 * ⛓⛓ SEEDLING SWIM T4, D1 (R-g) — **THE FEATHER BIOME IN THE GEN ROOM.** T2 shipped
 * `waterfallgate` and `POST_FEATHER_PALETTE` and stopped one line short:
 * `GEN_ROOM_BIOMES` (`seedlingGenRoom.js`) is asserted equal to
 * `GEN_ROOM_BIOME_NAMES` (`seedlingGenRoomPayload.js`) at module load, so the
 * name could not be added alone. Both lines landed together.
 *
 * ⚠ THE MEASURED SEAT (report `CC/docs/cloud-reports/seedling-swim-t4.md` § D1):
 * a waterfall tile is not lethal, so `hazardCells` does not wall it and T1's
 * approach rule (`keepReachable.approachWalls`, a set of CELLS) cannot say "not
 * UP this tile". Over seeds 1–12 at 10×10 with `skeleton: 'winding'` and
 * `require: 'hasFeather'`, 8 rooms met the directive and 4 of those 8 seat the
 * door PAST the fall — the arrival reaches the goal without the feather. The
 * last row pins one such room BY NAME as the standing finding, so the fix (a
 * directed approach flood) flips it visibly rather than silently.
 */
import { describe, it, expect } from 'vitest';

import { buildLevelWorld } from './levelWorld.js';
import { walkableCellsFrom } from './levelSetExits.js';
import { POST_FEATHER_PALETTE } from './procgenPalette.js';
import { GEN_ROOM_BIOMES, generateGenRoom } from './seedlingGenRoom.js';
import { GEN_ROOM_BIOME_NAMES } from './seedlingGenRoomPayload.js';

const key = (c) => `${c.tx},${c.ty}`;
/** An rng whose first draw yields `seed` as the room's drawn seed. */
const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const room = (seed, extra = {}) => generateGenRoom({
    region_id: 'fall', exits: [{}], size: { width: 10, height: 10 }, rng: rngDrawing(seed),
    params: { seedlingGen: { biome: 'post-feather', elements: 'waterfallgate', ...extra } },
}).world;

/**
 * ⛔ The test's OWN flood: 4-connected over the walkable cells, pits and lava
 * walled (the biome grants the swim), and — unless `climb` — no step UP into or
 * out of a waterfall tile (type 25; `climbsArmedWaterfall`'s rule).
 */
function reach(w, from, climb) {
    const terr = new Map(buildLevelWorld(w.record).walkableTiles.map((t) => [key(t), t.t]));
    const flood = walkableCellsFrom(w.record, w.start);
    const seen = new Set([key(from)]);
    const queue = [from];
    for (let i = 0; i < queue.length; i += 1) {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const c = { tx: queue[i].tx + dx, ty: queue[i].ty + dy };
            if (seen.has(key(c)) || !flood.has(key(c)) || [6, 17].includes(terr.get(key(c)))) continue;
            if (!climb && dy === -1 && (terr.get(key(queue[i])) === 25 || terr.get(key(c)) === 25)) continue;
            seen.add(key(c));
            queue.push(c);
        }
    }
    return seen;
}
const seatOf = (w) => {
    const door = [...w.exits.values()][0];
    const approach = { tx: door.entrance_spawn.x / 16, ty: door.entrance_spawn.y / 16 };
    return {
        falls: buildLevelWorld(w.record).walkableTiles.filter((t) => t.t === 25).length,
        drySide: reach(w, w.start, false).has(key(approach)),
        goalWithoutFeather: reach(w, approach, false).has(key(w.goalCell)),
        goalWithFeather: reach(w, approach, true).has(key(w.goalCell)),
    };
};

describe('SWIM T4 D1 — post-feather is a gen-room biome', () => {
    it('the two spellings agree, and post-feather is T2\'s palette by identity', () => {
        expect(GEN_ROOM_BIOME_NAMES).toEqual(Object.keys(GEN_ROOM_BIOMES));
        expect(GEN_ROOM_BIOME_NAMES).toContain('post-feather');
        expect(GEN_ROOM_BIOMES['post-feather']).toBe(POST_FEATHER_PALETTE);
    });
    it('`{biome: post-feather, elements: waterfallgate}` builds (seed 1, default skeleton: re-roll 0, no fall seated)', () => {
        const w = room(1);
        expect(w.generation.biome).toBe('post-feather');
        expect(w.generation.rerolls).toBe(0);
        expect(w.size).toEqual({ width: 10, height: 10 });
        expect(seatOf(w).falls).toBe(0);
    }, 60_000);
    it('winding seed 11 + `require: hasFeather`: met at re-roll 0, the door on the dry side, the fall between the arrival and the goal', () => {
        const w = room(11, { skeleton: 'winding', require: 'hasFeather' });
        expect(w.generation.require).toBe('hasFeather');
        expect(w.generation.rerolls).toBe(0);
        expect(seatOf(w)).toEqual({ falls: 1, drySide: true, goalWithoutFeather: false, goalWithFeather: true });
    }, 60_000);
    it('⚠ THE STANDING FINDING — winding seed 9 + `require: hasFeather`: met, but the door is seated PAST the fall', () => {
        const w = room(9, { skeleton: 'winding', require: 'hasFeather' });
        expect(w.generation.require).toBe('hasFeather');
        expect(w.generation.rerolls).toBe(1);
        // `require` grades start → goal; the arrival is the door's approach, and from there the goal
        // needs no feather. A directed approach flood (T1's rule extended to the climb) would flip this.
        expect(seatOf(w)).toEqual({ falls: 1, drySide: false, goalWithoutFeather: true, goalWithFeather: true });
    }, 60_000);
});

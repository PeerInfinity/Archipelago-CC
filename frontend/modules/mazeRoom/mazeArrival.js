/**
 * mazeRoom/mazeArrival — **WHERE A MAZE ARRIVAL LANDS** (seedling-pipeline
 * T2b, F1: the maze-side twin of the flash binding's arrival arm 3).
 *
 * `arrivedFrom.exit_id` is procgenPlayer's answer: the SOURCE exit's
 * `targetExitId` when the world links reverse exits, else the source exit's
 * OWN name. A world that links none (the shuffled spiral) therefore hands a
 * name that may mean nothing here. Measured on `seedling_spiral_room`: a return
 * from the placed Seedling room names `exit_S` / `exit_E`, which no maze region
 * has, so the player landed on the maze's `entrance`. In `region_1_0` that is a
 * six-tile POCKET whose only way out leads elsewhere, so the exit back to the
 * room was out of reach.
 *
 * ⇒ THREE ARMS, IN THIS ORDER: the exit `exit_id` names; else the exit whose
 * `targetRegion` is `arrivedFrom.source_region` (the one leading back to where
 * the player came from; two such exits → the first in the world's order);
 * else `null`, and the caller keeps the world's entrance. Generic: no substrate
 * is named, and any world whose exits carry `targetRegion` gets the arm.
 *
 * @returns {{exitId: string, x: number, y: number, by: 'exit_id'|'source_region'}|null}
 */
export function resolveMazeArrival(world, arrivedFrom) {
    const exits = world?.exits;
    if (!exits || typeof exits.values !== 'function') return null;
    const id = arrivedFrom?.exit_id ?? null;
    if (id && typeof exits.has === 'function' && exits.has(id)) {
        const e = exits.get(id);
        return { exitId: id, x: e.x, y: e.y, by: 'exit_id' };
    }
    const source = arrivedFrom?.source_region ?? null;
    if (source) {
        for (const [key, e] of exits.entries()) {
            if (e?.targetRegion === source) return { exitId: e.exit_id ?? key, x: e.x, y: e.y, by: 'source_region' };
        }
    }
    return null;
}

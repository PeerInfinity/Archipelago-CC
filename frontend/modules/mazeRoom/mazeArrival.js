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
 * ⇒ THREE ARMS: the exit `exit_id` names; the exit whose `targetRegion` is
 * `arrivedFrom.source_region` (the one leading back to where the player came
 * from; two such exits → the first in the world's order); else `null`, and
 * the caller keeps the world's entrance. Generic: no substrate is named, and
 * any world whose exits carry `targetRegion` gets the arm.
 *
 * ⛓ THE ORDER DEPENDS ON THE WORLD (seedling-pipeline T4, trap 1392). In a
 * world that LINKS reverse exits (any exit carries a `targetExitId`: grid,
 * sphere, top-down) `exit_id` is an authored answer and goes first. In a world
 * that links none (the spiral), `exit_id` is the SOURCE exit's own name, and
 * when the target happens to have an exit of that name it is a coincidence:
 * `seedling_spiral_room`'s maze↔maze pairs all landed right by it, a spiral
 * whose names collide otherwise would not. There `source_region` goes first,
 * and `exit_id` is the fallback.
 *
 * ⛓⛓ ZONE OR REGION (tutorial-bugs, ⚖ the user, 2026-10-10: *"add the option
 * for maze regions to work like zones"*). A room whose payload says
 * `arrival: 'zone'` is entered at its `entrance` every time — `null` here — which
 * is where its compiled logic is measured from. The `source_region` arm above
 * was added for an entrance POCKET that reached the exit back only over another
 * exit's tile; the generator can no longer build that (an exit tile is a dead
 * end, mazeRoomEngine `isDeadEndExit`), and in a spiral world the arm landed a
 * player behind a door its logic put in front of them (procgen-mixed-world:
 * key_blue past door_blue). `arrival: 'region'` (or absent) keeps the arms.
 *
 * @returns {{exitId: string, x: number, y: number, by: 'exit_id'|'source_region'}|null}
 */
export function resolveMazeArrival(world, arrivedFrom) {
    if (world?.arrival === 'zone') return null;
    const exits = world?.exits;
    if (!exits || typeof exits.values !== 'function') return null;
    const byExitId = () => {
        const id = arrivedFrom?.exit_id ?? null;
        if (!id || typeof exits.has !== 'function' || !exits.has(id)) return null;
        const e = exits.get(id);
        return { exitId: id, x: e.x, y: e.y, by: 'exit_id' };
    };
    const bySource = () => {
        const source = arrivedFrom?.source_region ?? null;
        if (!source) return null;
        for (const [key, e] of exits.entries()) {
            if (e?.targetRegion === source) return { exitId: e.exit_id ?? key, x: e.x, y: e.y, by: 'source_region' };
        }
        return null;
    };
    const linked = [...exits.values()].some((e) => e?.targetExitId);
    return linked ? (byExitId() ?? bySource()) : (bySource() ?? byExitId());
}

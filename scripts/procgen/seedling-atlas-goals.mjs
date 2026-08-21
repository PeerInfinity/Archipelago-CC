/**
 * seedling-atlas-goals — THE ONE PLACE A SEEDLING GOAL COORDINATE COMES FROM.
 *
 * ⚖ Ruling 17 (the user, 2026-08-21: *"I want to minimize hardcoding in
 * general"*). `solve-seedling-r9-campaign.mjs` already derived every goal it
 * hands the solver out of the atlas — a room's pickup by ENTITY TYPE and a
 * crossing by the game's own `attrs.to` — while `solve-seedling-r8-battery.mjs`
 * and `solve-seedling-r8-tail.mjs` derived theirs from the hand chain
 * `act2-the-sword`'s `walk.units`. ⚖ Ruling 14 retired that chain, and the two
 * derivations were MEASURED against each other before this module existed:
 * **all eleven goal lists came out IDENTICAL, coordinate for coordinate** (R9
 * slice 7 §15). So there is one derivation, and this is it.
 *
 * ⛔ WHAT IS DERIVED AND WHAT IS DECLARED. The COORDINATES are derived — never
 * typed, because a tile centre typed by hand spawns a whole tile away (R6 slice
 * 0's lesson). The ROOM ORDER is a DECLARATION: which rooms a chain crosses, in
 * which direction, is a statement about a playthrough and each producer makes
 * its own. `solve-seedling-r9-campaign.mjs`'s docblock has said so since slice
 * 6 and that has not changed.
 *
 * ⚠ BOTH LOOKUPS REFUSE AMBIGUITY rather than picking. A room with two exits to
 * the same level, or none, throws — the goal would otherwise be a coin flip
 * that reproduced until the atlas moved.
 */

/** A room's own placement, from the atlas — never a coordinate typed by hand. */
export function placementIn(levelSource, level, type) {
    const e = (levelSource(level).entities ?? []).find((x) => x.type === type);
    if (!e) throw new Error(`L${level} has no ${type}`);
    return { x: e.x, y: e.y };
}

/** The exit to a named level, from the atlas — `attrs.to` is the game's own. */
export function exitFromTo(levelSource, level, to) {
    const hits = (levelSource(level).entities ?? []).filter(
        (x) => (x.type === 'stairsup' || x.type === 'stairsdown' || x.type === 'teleporter')
            && Number(x.attrs?.to) === to);
    if (hits.length !== 1) {
        throw new Error(`L${level} has ${hits.length} exits to L${to}; the goal would be `
            + 'ambiguous');
    }
    return { x: hits[0].x, y: hits[0].y };
}

/** A `collect-placement` goal for a room's pickup, by entity type. */
export const collectGoal = (levelSource, level, type) => ({
    kind: 'collect-placement', placement: placementIn(levelSource, level, type),
});

/** A `reach-exit` goal for a crossing, by the atlas's own `attrs.to`. */
export const reachGoal = (levelSource, level, to) => ({
    kind: 'reach-exit', exit: exitFromTo(levelSource, level, to),
});

/**
 * procgenCore/goalContainer — **THE GOAL-CONTAINERS REPORT**: how many regions
 * configured for a goal CONTAINER (a generated Seedling room asked for a goal
 * chest) got one, and why the rest kept their default goal (goal-chest-pipeline;
 * ⚖ the user 2026-11-04, *"I agree with your recommendations"*: rule 3, a room
 * that cannot fit a goal chest KEEPS the torch goal and that is REPORTED, the
 * way unplaced key gates are — `procgenCore/itemIntroduction.js`'s
 * `introductions` is the precedent, and this module is its shape).
 *
 *   procgen_metadata[<player>].goalContainers =
 *       { requested, placed, notPlaced: { [reason]: count } }
 *
 * ── THE SUBSTRATE DECLARES, THE ENGINE FOLDS (substrate-agnostic) ─────────
 *
 * A substrate opts in with ONE registry field:
 *
 *   goalContainer: { noteOf(payload) -> null | {placed: true} | {placed: false, reason} }
 *
 * read off the region's SERIALISED sidecar payload (`preset_sidecars[p][r]
 * .playable_payload`): the bytes the world ships, after every re-roll, so the
 * report cannot disagree with what is played. `null` = this region was not
 * configured for a goal container. `reason` is a name the SUBSTRATE declares
 * once (Seedling: the generator's own refusal names, `procgenSeedling.
 * GOAL_CHEST_REFUSALS`) or one of `GOAL_CONTAINER_NOT_PLACED_REASONS` below.
 *
 * The field is ABSENT, never empty, on a world with no configured region, so
 * every other world's metadata is what it was. Pure: no registry, no engine.
 */

/** ⛓ The NOT-PLACED reasons this module names, spelled once (a substrate's own refusal names are its own). */
export const GOAL_CONTAINER_NOT_PLACED_REASONS = Object.freeze({
    /** the container stands as the region's goal, but the region holds no AP location to be it */
    noLocation: 'no-ap-location',
});

/** Does `entry` (a registry entry) declare the goal-container note? */
export const declaresGoalContainer = (entry) => typeof entry?.goalContainer?.noteOf === 'function';

/**
 * The note of one region's serialised payload under `entry`, or `null` (not declared, or not configured).
 * A malformed answer THROWS by name: a report built on it would count something nobody declared.
 */
export function goalContainerNoteOf(entry, payload) {
    if (!declaresGoalContainer(entry)) return null;
    const note = entry.goalContainer.noteOf(payload);
    if (note == null) return null;
    const ok = note.placed === true
        || (note.placed === false && typeof note.reason === 'string' && note.reason !== '');
    if (!ok) {
        throw new Error(`goalContainer: substrate '${entry.id ?? '?'}' answered noteOf with ${JSON.stringify(note)}, `
            + 'not {placed: true} or {placed: false, reason: <name>}');
    }
    return note;
}

/** Fold the notes of a world's regions into the report, or `null` when none was configured (the field is ABSENT). */
export function goalContainerReport(notes) {
    const ns = [...(notes ?? [])].filter(Boolean);
    if (ns.length === 0) return null;
    const notPlaced = {};
    let placed = 0;
    for (const n of ns) {
        if (n.placed) placed += 1;
        else notPlaced[n.reason] = (notPlaced[n.reason] ?? 0) + 1;
    }
    return { requested: ns.length, placed, notPlaced };
}

/**
 * The report of ONE slot's sidecars (`preset_sidecars[p]`, `{regionId: {substrate, playable_payload}}`), each
 * region's entry looked up by its sidecar's `substrate` through `entryOf`. `null` when none was configured.
 */
export function goalContainerReportOfSidecars(slotSidecars, entryOf) {
    return goalContainerReport(Object.values(slotSidecars ?? {})
        .map((sc) => goalContainerNoteOf(entryOf(sc?.substrate), sc?.playable_payload)));
}

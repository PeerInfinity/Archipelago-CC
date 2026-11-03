/**
 * chestLegDelta — ⛓⛓⛓ SEEDLING HAMMER-PHASE CHEST-INCIDENTAL: THE CHEST LEG'S EXACT SET IS THE LEG'S OWN DELTA
 * (`CHEST_LEG_DELTA`, OFF).
 *
 * ⚖ The user queued this on 2026-11-03 (the hammer-phase CHEST-INCIDENTAL slice), from the lab's named gap in
 * `seedling-gen-chest-loot-goal` (B1 + B3): a loot chest in a goal-chest room is DROPPED, graded
 * `the-skeleton-does-not-solve-with-the-element` in 11/12 rooms, and the certification's text is `runChest`'s
 * *"A chest the leg did not name is a wall somewhere else that the plan still believes is standing."*
 *
 * ⛔ THE BRIEF'S CAUSE WAS NOT THE MEASURED ONE. The brief (and the lab's note) read the refusal as an INCIDENTAL
 * open — the walk to one chest crossing the other chest's trigger line. Measured on all 11 refusals (and on 32 of 32
 * hand-built two-chest rooms that name both chests): the "unnamed" chest is the one the PREVIOUS chest leg of the same
 * visit opened, BY NAME, and `runChest`'s effect check compares `run.entities('openChests')` — the VISIT's open set,
 * which a chest never leaves (`Chest.open()` sets `type = ""` and clears its persistence flag; the cell stays open
 * for the rest of the visit, `levelRun.openChestIdsNow`) — against `{target}`. So every second chest leg of a visit
 * refused, whatever it crossed. No measured walk (100 lab rooms, 64 hand-built rooms with adjacent and diagonal
 * chests) opened a chest it did not name.
 *
 * ⇒ ON, the exact set is the LEG'S DELTA: the chests open now, minus the chests open before the leg's approach (the
 * `before.chests` snapshot the call site already takes, for the positive control). It must still be exactly
 * `{target}`, so a chest the leg itself opened beyond its target — a real incidental open, which the model would
 * see in the same set — still refuses by the same text. The record carries `openBefore` (the chests the check
 * excluded, sorted), present only when non-empty, so a one-chest leg's record is byte-identical ON and OFF.
 *
 * ⛓ THE SWITCH: `SEEDLING_CHEST_LEG_DELTA=1` in a node process (or the page's
 * `?seedlingSolverEnv=SEEDLING_CHEST_LEG_DELTA=1` through `solverEnvChannel`), `withChestLegDelta(enabled, fn)` for a
 * row or a witness. OFF, nothing new is read: the check reads the whole set, as before the slice.
 */

export const CHEST_LEG_DELTA = {
    enabled: globalThis.process?.env?.SEEDLING_CHEST_LEG_DELTA === '1',
};
export const CHEST_LEG_DELTA_DEFAULT = false;

/** Run `fn` with `CHEST_LEG_DELTA` set to `enabled`, restoring the previous value (`withStrikeSlot`'s shape). */
export function withChestLegDelta(enabled, fn) {
    const was = CHEST_LEG_DELTA.enabled;
    CHEST_LEG_DELTA.enabled = enabled === true;
    const restore = () => { CHEST_LEG_DELTA.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/**
 * The set `runChest`'s exact-set check reads, what it left out, and its verdict.
 * @param {Iterable<string>} openNow     `run.entities('openChests')` after the leg
 * @param {Iterable<string>|null} openBefore  the chests open before the leg's approach (`before.chests`)
 * @param {string} targetId              the chest the leg names
 * @returns {{opened: string[], openBefore: string[], exact: boolean}} OFF: `opened` is the whole set (insertion
 *   order, as before the slice) and `openBefore` is `[]`. ON: `opened` is the set minus `openBefore`, and
 *   `openBefore` is the excluded chests that are still open, sorted. `exact` is the check itself, either way:
 *   `opened` is exactly `[targetId]` — a chest the leg opened beyond its target is never excused.
 */
export function chestLegOpened(openNow, openBefore, targetId) {
    const now = [...openNow];
    let opened = now;
    let excluded = [];
    if (CHEST_LEG_DELTA.enabled) {
        const prior = new Set(openBefore ?? []);
        opened = now.filter((id) => !prior.has(id));
        excluded = now.filter((id) => prior.has(id)).sort();
    }
    return { opened, openBefore: excluded, exact: opened.length === 1 && opened[0] === targetId };
}

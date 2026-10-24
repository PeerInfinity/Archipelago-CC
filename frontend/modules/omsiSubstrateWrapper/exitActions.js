/**
 * The synthetic EXIT ACTIONS an omsi region registers with the fork — one per
 * graph exit that leads somewhere (PIPELINE RELAYOUT R2; the bridge's
 * `_installRegionExits` calls this).
 *
 * ── Why the name carries the exit's id ───────────────────────────────────
 *
 * The fork's `injectSyntheticAction({name})` (`omsi-loops/managed.js`) KEYS the
 * action by its name with the spaces removed (`Action[key]`, refusing a key that
 * already exists), and displays that same name in the queue. The name used to be
 * the exit's LABEL alone — "Go West (to region_0_1)" — so two exits of one region
 * on one side leading to one target would collide, and the second would never be
 * registered. Since R2 an exit may be moved onto a side another exit holds
 * (jta/omsi declare the side-agnostic `exitSides`), so the name is keyed by the
 * exit's `exitName` — unique within a region — with the label kept as the
 * readable part: "Go West (to region_0_1) [exit_W]".
 *
 * ⛔ Pure, no DOM, no fork: the bridge runs inside the iframe, and this is the
 * part of it a unit row can reach.
 */

/** Grid side → the word the label uses. */
export const EXIT_SIDE_WORDS = Object.freeze({ N: 'North', E: 'East', S: 'South', W: 'West' });

/** The readable label of an exit action (the jta `_exitLabel` port). */
export function exitActionLabel(exit) {
    const target = exit?.targetRegion;
    const side = exit?.side;
    if (side && EXIT_SIDE_WORDS[side] && target) return `Go ${EXIT_SIDE_WORDS[side]} (to ${target})`;
    if (side && EXIT_SIDE_WORDS[side]) return `Go ${EXIT_SIDE_WORDS[side]}`;
    if (target) return `Take exit: ${exit?.exitName ?? '?'} (to ${target})`;
    return `Take exit: ${exit?.exitName ?? '?'}`;
}

/**
 * One synthetic exit action per exit with a `targetRegion`, in exit order:
 * `name` (what the fork keys and shows — the label plus the exit's id),
 * `label`, `exitName` (the GRAPH exit id the move carries) and `targetRegion`.
 *
 * @param {object[]} exits the active region's world exits
 * @returns {Array<{name: string, label: string, exitName: string, targetRegion: string}>}
 */
export function syntheticExitActions(exits) {
    const out = [];
    for (const exit of exits ?? []) {
        if (!exit?.targetRegion) continue; // a dangling exit routes nowhere
        const label = exitActionLabel(exit);
        const exitName = exit.exitName ?? exit.exit_id ?? label;
        out.push({ name: `${label} [${exitName}]`, label, exitName, targetRegion: exit.targetRegion });
    }
    return out;
}

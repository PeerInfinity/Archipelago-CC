/**
 * ⛓ KNOWN DIVERGENCES (§5.124, ruling `seedling-js-planning-8` 2026-10-22) — the EXACT divergences a walk probe
 * names instead of failing: each entry matches one leg, one tick, a bounded offset and a bounded recovery. Anything
 * else (another leg, a second divergence in the leg, a larger offset, a slow recovery) is NOT known and fails the
 * row as before. Pure (no browser, no repo imports): the probe and a unit test import it.
 *
 * An entry is a FINDING handed to its owner, never a fix: delete it when the owner's fix lands (the row then
 * demands 0 again).
 */

// ⛓ RETIRED — `l15-post-chest-walk` (§5.124: L15 post-chest exit, +0.25 px x @ t18) was the HOLD SEAM, not a model gap
// (fidelity SLOWFIX D-B): the held chest leg's frames stepped the game's pinned swim channel. js slice
// `seedling-js-hold-seam` steps the shadow across the hold (`wasmHoldSeam.js`); logical-links B at c2390b3e8b played
// the leg on plan (`divergences 0`, battery 40042527104). The row demands 0 again.
export const KNOWN_DIVERGENCES = Object.freeze([]);

/** Whether the history entry at `i` (a diverged play) is `entry`'s divergence, else the why not. */
function matchEntry(history, i, entry) {
    const h = history[i];
    const d = h.divergence;
    if (h.goal !== entry.goal) return `goal ${h.goal}`;
    const before = history.slice(0, i).reverse().find((p) => p.goal !== entry.goal);
    if (before?.goal !== entry.after || before?.outcome !== 'done') return `not after a done "${entry.after}"`;
    // A second diverged play of the same goal in a row is a second divergence in the leg.
    if (history[i - 1]?.goal === entry.goal) return 'a second divergence in the leg';
    if (d?.t !== entry.t) return `t ${d?.t} (known: ${entry.t})`;
    if (d.expected?.level !== entry.level || d.got?.level !== entry.level) return `level ${d.got?.level}`;
    const dx = Math.abs(d.got.x - d.expected.x);
    if (!(dx <= entry.maxDx)) return `|dx| ${dx} > ${entry.maxDx}`;
    if (d.got.y !== d.expected.y) return `dy ${d.got.y - d.expected.y}`;
    const next = history[i + 1];
    if (next?.goal !== entry.goal || next.outcome !== 'done' || next.divergence || !(next.ticks <= entry.maxRecoveryTicks)) {
        return `not recovered within ${entry.maxRecoveryTicks} t (${next ? `${next.goal} ${next.outcome} ${next.ticks}t` : 'no next leg'})`;
    }
    return null;
}

/**
 * Split a walk's engine history into its KNOWN divergences and the rest. `reached` = per entry, whether the walk
 * played the leg at all (reach varies within a budget: not reaching it is INFO, never a failure).
 * @returns {{known: Array<{entry, index, divergence}>, unknown: Array<{index, goal, divergence, why}>, reached: object}}
 */
export function classifyDivergences(history, entries = KNOWN_DIVERGENCES) {
    const known = [];
    const unknown = [];
    (history ?? []).forEach((h, index) => {
        if (!h?.divergence) return;
        const whys = [];
        const hit = entries.find((e) => { const why = matchEntry(history, index, e); if (why) whys.push(`${e.id}: ${why}`); return !why; });
        if (hit) known.push({ entry: hit, index, divergence: h.divergence });
        else unknown.push({ index, goal: h.goal, divergence: h.divergence, why: whys.join('; ') });
    });
    const reached = Object.fromEntries(entries.map((e) => [e.id, (history ?? []).some((h) => h?.goal === e.goal)]));
    return { known, unknown, reached };
}

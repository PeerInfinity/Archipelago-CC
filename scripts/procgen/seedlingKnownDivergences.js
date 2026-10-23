/**
 * ⛓ KNOWN DIVERGENCES (§5.124, ruling `seedling-js-planning-8` 2026-10-22) — the EXACT divergences a walk probe
 * names instead of failing: each entry matches one leg, one tick, a bounded offset and a bounded recovery. Anything
 * else (another leg, a second divergence in the leg, a larger offset, a slow recovery) is NOT known and fails the
 * row as before. Pure (no browser, no repo imports): the probe and a unit test import it.
 *
 * An entry is a FINDING handed to its owner, never a fix: delete it when the owner's fix lands (the row then
 * demands 0 again).
 */

export const KNOWN_DIVERGENCES = Object.freeze([
    Object.freeze({
        id: 'l15-post-chest-walk',
        // The message the probe prints, loudly, for each match.
        finding: 'fidelity finding: L15 post-chest walk +0.25 px x @ t18',
        // The leg: the exit continuation right after this location's leg.
        goal: 'level_15__r1c5 -> level_14',
        after: 'Level 015 - Chest',
        level: 15,
        t: 18,
        // |got.x − expected.x| ≤ this (measured +0.25: battery 39870675057, repeat 39873208691), y equal.
        maxDx: 0.5,
        // The recovered re-solve of the same goal is done, on plan, within this many ticks (measured 5).
        maxRecoveryTicks: 10,
    }),
]);

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

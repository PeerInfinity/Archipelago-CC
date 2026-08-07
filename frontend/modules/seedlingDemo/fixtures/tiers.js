/**
 * seedlingDemo/fixtures/tiers — the roster's TIER assignment, pinned by
 * name, with a completeness assertion so it cannot rot.
 *
 * Ruled by the user at R6 slice 0 (`NewDocs/plans/seedling-bot-r6-opus-kickoff.md`
 * §6.3, and `note_roster_trim_evaluation`'s five criteria). The parked
 * request was "evaluate which tests from previous rungs aren't worth
 * including in the full test run"; the answer had to be MEASURED, and it
 * was — `scripts/procgen/mine-seedling-roster-history.mjs` is the evidence.
 *
 * ── ⛔ WHAT THE EVIDENCE ACTUALLY SAID ────────────────────────────────
 *
 * In TWENTY recorded sweeps the roster produced exactly TWO sole
 * detectors: `transition-west-return` (run 1) and `r5-l42-part4-control`
 * (run 16). Two of the red runs were model-wide breakages that reddened 4
 * and 37 tapes at once, and a tape that failed inside one of those has
 * demonstrated nothing about itself. Forty-three of the hundred tapes are
 * R5's and carry one to seven runs of history. ⇒ **the failure history
 * cannot justify a cut**, and ranking tapes by it would be reading a
 * number as if it meant what a ranking implies.
 *
 * So the cut was made on MEASURED REDUNDANCY instead, two ways:
 *
 * 1. **Strict domination, provable.** `r3-walk-{1,2,3}` have
 *    BYTE-IDENTICAL `inputs` to `r4-walk-{1,2,3}` and differ only in
 *    `tape_version`, `noHazards` and `persistence` — the same walk with
 *    strictly FEWER crutches. That is exactly the ruled criterion ("cut
 *    only tapes whose mechanism set is a strict subset of a kept tape's"),
 *    satisfied outright.
 *
 * 2. **The noclip era.** All seven `r1-walk-*` tapes are `noclip: true`,
 *    granted and relaxed; R2 re-walks the same game with solids restored,
 *    R3 removes the grants, R4 restores hazards. None has ever been a sole
 *    detector, and their ONLY unique level coverage is L49.
 *
 * ⚠⚠ **AND THE COVERAGE THAT LEAVES IS NAMED, because a bounded sweep must
 * name what it bounded.** Demoting the R1 walks takes **L49** — the 5x9
 * conch room (`conch@32,80` + a teleporter) — out of the default gate.
 * No other tape in the roster reaches it. That is the price of the 23%,
 * stated rather than discovered later.
 *
 * ⛔ WHAT WAS *NOT* CUT, AND WHY. A first pass at "strict domination" also
 * flagged `r5-bobboss-fire`, `l71-shieldlock-open` and `r5-karlore-fire`,
 * on a crutch-count heuristic. Those are PAIR ARMS: the whole point of a
 * pair is that both arms run, and calling the treatment arm "dominated" by
 * its control is the mistake
 * [[feedback_control_that_removes_treatment_changes_the_world]] is about.
 * The heuristic was wrong, not the fixtures. Pairs are never demoted.
 *
 * And the ten noclip PRE-WALK oracles are not walks at all:
 * `straight-run` / `diagonal-run` / `friction-stop` / `direction-flip` /
 * `shuffle-stop` are the v1 physics transcription's own oracles, and
 * `pit-fall-83` / `pit-fall-chain-85` / `hazard-boot-pit` are the only
 * coverage of the pit transport and of L83. The whole pre-walk set is 4%
 * of the sweep. Cutting it would buy nothing and remove the floor.
 *
 * ── ⛓⛓ WHY THIS IS A NAMED LIST AND STILL CANNOT ROT ─────────────────
 *
 * `--tier=fast` is deliberately TICK-DERIVED, and its docblock says why: a
 * hand-kept list "would go stale the first time a fixture was added and
 * nobody thought about which tier it belonged in"
 * ([[feedback_coincidental_predicate_rots]]). A named tier assignment
 * reintroduces exactly that hazard — so it is built the only way that
 * defuses it:
 *
 *   · **`LEGACY` is the ONLY named set.** Every other tier is its
 *     COMPLEMENT over `fixtureNames()`, so a fixture added tomorrow lands
 *     in the default gate automatically. The list can only ever fail
 *     SAFE — by running something, never by skipping it.
 *   · **Every name in `LEGACY` is asserted to be a real fixture**
 *     (`assertTiersComplete`). A rename or a typo is a NAMED FAILURE, not
 *     a silently empty demotion.
 *   · **`full` still means EVERYTHING.** The pre-push gate is unchanged
 *     and never skips a tape; `legacy` only leaves the per-slice `gate`.
 */

/**
 * The demoted set, by name. Ruled 2026-08-07.
 *
 * ⚠ These tapes are NOT deleted and NOT excluded from `--tier=full`. They
 * leave the per-slice `gate` tier only, and `--tier=legacy` runs them on
 * demand. The cut is reversible by construction because it is a list.
 */
export const LEGACY_TAPES = Object.freeze([
    // The noclip era. `noclip: true`, granted, relaxed; never a sole
    // detector in 20 sweeps. ⚠ L49 (the conch room) leaves with them.
    'r1-walk-1-sword-shield',
    'r1-walk-2-feather-conch',
    'r1-walk-3-wand-darksword',
    'r1-walk-4-torch',
    'r1-walk-5-spear-health',
    'r1-walk-6-cluster',
    'r1-walk-full',
    // Strictly dominated: byte-identical `inputs` to the r4 twin, with
    // `noHazards` ["water","lava","ice","waterfall"] against the twin's
    // ["water","waterfall"]. The same walk, more crutches.
    // ⛓ r3-walk-{4,5,6} and r3-walk-full DIVERGE from the r4 route (the
    //   first differing span is index 98 of r3-walk-4-spear), so they are
    //   NOT dominated and stay in the gate.
    'r3-walk-1-sword',
    'r3-walk-2-feather',
    'r3-walk-3-torch',
]);

/** Level coverage that leaves the default gate with `LEGACY_TAPES`. */
export const LEGACY_ONLY_LEVELS = Object.freeze([49]);

/** The tiers a sweep can ask for, and what each means. */
export const TIERS = Object.freeze({
    /** Tick-derived (< 600 ticks). Unchanged, and still not a named list. */
    fast: 'every tape under the tick threshold — the iteration loop',
    /** The complement of LEGACY. The per-slice gate. */
    gate: 'everything except LEGACY_TAPES — the per-slice gate',
    /** The named demoted set, on demand. */
    legacy: 'the demoted set, by name — run on demand, never skipped by `full`',
    /** Unchanged: EVERYTHING. */
    full: 'the whole roster — the pre-push / rung-close gate, skips nothing',
});

export class TierError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TierError';
    }
}

/**
 * Every `LEGACY_TAPES` entry must be a real fixture, and the tiers must
 * partition the roster.
 *
 * ⛔ THE POINT IS THE FIRST HALF. A demotion list whose names no longer
 * exist reads as a clean, working cut and quietly demotes nothing — the
 * shape [[feedback_coincidental_predicate_rots]] describes. This throws
 * instead, so a rename surfaces as a failure at the moment it happens.
 *
 * @param {string[]} rosterNames `fixtureNames()`
 */
export function assertTiersComplete(rosterNames) {
    const roster = new Set(rosterNames);
    const unknown = LEGACY_TAPES.filter((n) => !roster.has(n));
    if (unknown.length) {
        throw new TierError(
            `LEGACY_TAPES names ${unknown.length} tape(s) the roster does not have: `
            + `${unknown.join(', ')}. A demotion list that names nothing demotes `
            + 'nothing and reads exactly like one that works — fix the name or drop it.');
    }
    const dupes = LEGACY_TAPES.filter((n, i) => LEGACY_TAPES.indexOf(n) !== i);
    if (dupes.length) {
        throw new TierError(`LEGACY_TAPES repeats ${dupes.join(', ')}`);
    }
    const gate = rosterNames.filter((n) => !LEGACY_TAPES.includes(n));
    if (gate.length + LEGACY_TAPES.length !== rosterNames.length) {
        throw new TierError('gate + legacy does not partition the roster: '
            + `${gate.length} + ${LEGACY_TAPES.length} != ${rosterNames.length}`);
    }
    return { gate, legacy: [...LEGACY_TAPES] };
}

/**
 * The tapes a tier selects, out of the roster.
 *
 * `fast` is not answered here — it is TICK-DERIVED and the verifier owns
 * the threshold, which is the whole reason it cannot rot. Asking for it
 * here would create a second definition of one tier.
 */
export function tapesInTier(tier, rosterNames) {
    const { gate, legacy } = assertTiersComplete(rosterNames);
    switch (tier) {
        case 'full': return [...rosterNames];
        case 'gate': return gate;
        case 'legacy': return legacy;
        default:
            throw new TierError(`tapesInTier: "${tier}" is not a named tier `
                + `(${Object.keys(TIERS).join(', ')}); "fast" is tick-derived and `
                + 'is resolved by the verifier, not here');
    }
}

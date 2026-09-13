// frontend/modules/procgenCore/roundTripRules.js
//
// ⛓⛓ PRESET SIDECARS slice G2b-1 — **WHERE A ROUND TRIP'S RULES COME FROM**, as
// a member of the registry entry's `regionRoundTrip` declaration
// (`regionRoundTrip.rules`), read by the gate-agreement control.
//
//   · `'authored'` — the payload CARRIES the region's rule trees (a gate on an
//     exit, a rule on a location) and the round trip re-emits them verbatim.
//     The document's rule and the payload's must therefore AGREE on every
//     endpoint; a disagreement is a STALE gate (a hub `set-rule-tree` edit the
//     payload never saw, which a rebuild from the payload would revert
//     silently) and the control FAILS on it.
//   · `'derived'` — the round trip DERIVES rules from the payload's geometry
//     (a BFS over tiles, a level's platforms). A document rule the derivation
//     does not reproduce is one the pipeline COMPOSED or the source game named
//     (MEASURED at G2b-1: 827 maze and 15 bounce endpoints), and the hub
//     already FREEZES it — so the control COUNTS it and never fails on it.
//
// ⛔ ABSENT = `'derived'` — the reading that asks the least of a payload, so
// declaring the member on one entry moves nothing on another. The
// `regionGeometry` slot's shape (`regionGeometry.js`).
//
// ⛔ It lives here because a substrate library DECLARES with the constant below
// (never a literal) and the hub READS it, and neither may import the other.
// This module imports nothing (`bindingContract.test.js` reads its roster off
// the directory).

/** The closed vocabulary of the `regionRoundTrip.rules` member. */
export const ROUND_TRIP_RULES = Object.freeze({
    AUTHORED: 'authored',
    DERIVED: 'derived',
});

/** Every legal `regionRoundTrip.rules` value, in declaration order. */
export const ROUND_TRIP_RULE_SOURCES = Object.freeze(Object.values(ROUND_TRIP_RULES));

/** What a round trip that does not declare the member gets. */
export const DEFAULT_ROUND_TRIP_RULES = ROUND_TRIP_RULES.DERIVED;

/**
 * Where a registry entry's round trip says its rules come from. An absent
 * entry, an absent round trip and an absent member all read as the default; a
 * value outside the vocabulary is REFUSED BY NAME — ⛔ never silently read as
 * derived, which would switch the control OFF for that substrate.
 *
 * @param {object|undefined} entry a substrate registry entry
 * @returns {'authored'|'derived'}
 */
export function roundTripRulesOf(entry) {
    const declared = entry?.regionRoundTrip?.rules;
    if (declared === undefined) return DEFAULT_ROUND_TRIP_RULES;
    if (!ROUND_TRIP_RULE_SOURCES.includes(declared)) {
        throw new Error(`regionRoundTrip.rules: substrate '${entry.id}' declares `
            + `${JSON.stringify(declared)} — not one of `
            + `${ROUND_TRIP_RULE_SOURCES.map((s) => `'${s}'`).join(', ')}`);
    }
    return declared;
}

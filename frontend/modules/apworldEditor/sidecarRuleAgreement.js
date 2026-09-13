/**
 * apworldEditor/sidecarRuleAgreement — **DOES A REGION'S PAYLOAD STILL SAY
 * WHAT ITS DOCUMENT SAYS ABOUT ITS RULES?** (PRESET SIDECARS G2b-1; plan
 * §25.2, §26).
 *
 * ── ⛓⛓ THE GAP IT CLOSES ─────────────────────────────────────────────
 *
 * A payload that CARRIES its region's rules (a text-adventure room's
 * `exitGates` and `locations[].access_rule`) holds a second copy of what the
 * document's `regions[p][name].exits[].access_rule` says. Nothing compared the
 * two: `sidecarIssues` checks a payload's shape, names and cells, and no RULE.
 * So the hub's own `set-rule-tree` could edit a document rule while the payload
 * kept the old gate — and a rebuild (`rebuildEnvelopeFromRulesJson`, rules
 * FROM the payload) would put the old rule back without a word. `Re-derive
 * rules ▸` answers it for one region on press; this answers it for every
 * region, for the corpus gate (`scripts/procgen/check-sidecar-fields.mjs`, its
 * third layer). One predicate, two askers — the `sidecarIssues` shape.
 *
 * ⛓ The derivation is `deriveRegionRules` — the SAME call `Re-derive rules ▸`
 * makes — and the comparison is `sameRule`, the door's own equivalence. So
 * "the gate agrees" and "Re-derive would move nothing" are one fact.
 *
 * ── ⛔ WHAT A DISAGREEMENT MEANS DEPENDS ON THE DECLARATION ───────────
 *
 * `regionRoundTrip.rules` (`procgenCore/roundTripRules.js`): an AUTHORED round
 * trip re-emits the payload's own rules, so a disagreement is a stale copy and
 * a FAILURE; a DERIVED one (absent = derived) re-derives from geometry, so a
 * rule it does not reproduce is one the pipeline composed — the hub FREEZES
 * it, and this COUNTS it. ⛔ Nothing here names a substrate.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ROUND_TRIP_RULES, roundTripRulesOf } from '../procgenCore/roundTripRules.js';
import { deriveRegionRules, regionRoundTripOf, sameRule, sidecarOf } from './regionRoundTrip.js';

/** ⛓ The four answers, one spelling. */
export const RULE_AGREEMENT = Object.freeze({
    /** the substrate declares no usable round trip: out of this check's reach */
    NO_ROUND_TRIP: 'no-round-trip',
    /** the round trip refused this payload (or its `rules` member is malformed) */
    NOT_CHECKED: 'not-checked',
    /** every document endpoint's rule is the one the payload re-emits */
    AGREED: 'agreed',
    /** at least one is not — see `disagreements` */
    DISAGREED: 'disagreed',
});

const isGated = (rule) => !!rule && rule.rule !== 'True_';

/**
 * ⛓⛓ One region of one slot.
 *
 * @returns {Promise<object>} `{status, substrate, rules?, why?, endpoints,
 *   gated, disagreements}` — `rules` the declaration's reading
 *   (`ROUND_TRIP_RULES`), `endpoints` the document endpoints compared, `gated`
 *   how many of those carry a rule other than `True_` in the document,
 *   `disagreements` `[{endpoint, document, payload}]` (`endpoint` spelled
 *   `exit "<name>"` / `location "<name>"`, `payload` `undefined` where the room
 *   no longer has the endpoint). `why` is a sentence for the two statuses that
 *   compare nothing; a malformed `rules` member sets `declarationError` too.
 */
export async function regionRuleAgreement(doc, player, name) {
    const substrate = sidecarOf(doc, player, name)?.substrate ?? null;
    const empty = { substrate, endpoints: 0, gated: 0, disagreements: [] };
    const { rt, why } = regionRoundTripOf(substrate);
    if (!rt) return { ...empty, status: RULE_AGREEMENT.NO_ROUND_TRIP, why };
    let rules;
    try {
        rules = roundTripRulesOf(substrateRegistry.get(substrate));
    } catch (e) {
        return { ...empty, status: RULE_AGREEMENT.NOT_CHECKED, why: e.message, declarationError: true };
    }
    const d = await deriveRegionRules(doc, player, name);
    if (!d.ok) return { ...empty, rules, status: RULE_AGREEMENT.NOT_CHECKED, why: d.why };
    const region = doc.regions[player][name];
    const disagreements = [];
    let endpoints = 0;
    let gated = 0;
    for (const [kind, list, derived] of [
        ['exit', region.exits ?? [], d.exits],
        ['location', region.locations ?? [], d.locations],
    ]) {
        for (const e of list) {
            endpoints += 1;
            if (isGated(e.access_rule)) gated += 1;
            const payload = derived.get(e.name);
            if (!sameRule(payload, e.access_rule)) {
                disagreements.push({ endpoint: `${kind} "${e.name}"`, document: e.access_rule, payload });
            }
        }
    }
    return {
        substrate,
        rules,
        status: disagreements.length ? RULE_AGREEMENT.DISAGREED : RULE_AGREEMENT.AGREED,
        endpoints,
        gated,
        disagreements,
    };
}

/** ⛓ Does this answer FAIL the control? Only an AUTHORED disagreement, or a malformed declaration. */
export const ruleAgreementFails = (answer) => answer.declarationError === true
    || (answer.status === RULE_AGREEMENT.DISAGREED && answer.rules === ROUND_TRIP_RULES.AUTHORED);

/** ⛓ One disagreement as the sentence a report line carries — both rules, byte for byte. */
export const describeDisagreement = (d) => `${d.endpoint}: the document says ${JSON.stringify(d.document)}, `
    + `the payload re-emits ${d.payload === undefined ? 'nothing (the room has no such endpoint)' : JSON.stringify(d.payload)}`;

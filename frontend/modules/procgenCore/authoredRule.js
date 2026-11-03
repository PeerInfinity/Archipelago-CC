/**
 * ⛓⛓ procgen-region-authored-rules — **A RULE THE SUBSTRATE AUTHORS, MARKED SO THE PIPELINE KEEPS IT**
 * (⚖ the user 2026-11-03: *"A: Fix, marked rules only"*).
 *
 * A region generator hands the engine its rules through `extractPathsAndObstacles`. Where the pipeline has its own
 * rule for a location or exit (sphere growth's composed gate, top-down's source rule, the sphere library's driver
 * gate), the engine REPLACES the extracted rule with it — on purpose: an extracted rule may carry path-walk
 * pollution that must not leak into the world's logic. A rule the substrate itself AUTHORS (a key gate's
 * `Has(<key>)` on the cell behind its lock) is not pollution, and replacing it ships a world whose logic says the
 * goal needs no key while the lock says it does.
 *
 * THE MARKER: `markAuthoredRule(entry, rule)` attaches `rule` — ONLY the part the substrate authored, not the whole
 * extracted rule — to an extracted location or exit `entry`. Where the engine would replace that entry's rule with
 * the pipeline's, it ANDs the two instead (`authoredRuleOf`); where the pipeline has no rule, the extracted rule
 * stays as it is. An UNMARKED entry keeps today's behaviour exactly.
 *
 * ⛔ The mark is a NON-ENUMERABLE, SYMBOL-keyed property, so it never reaches a serialised rules.json, a
 * `structuredClone`, an object spread or a deep-equality assertion: it lives only on the object the substrate
 * returned, between extraction and the engine's override, which is the one place it is read. A consumer that
 * copies the entry before the engine reads it loses the mark (and so falls back to today's replace).
 */

/** The property key (registered, so two copies of this module agree). */
export const AUTHORED_RULE = Symbol.for('procgen.authoredRule');

/** Mark `rule` as the part of `entry`'s rule the substrate authored. Returns `entry`. A falsy rule marks nothing. */
export function markAuthoredRule(entry, rule) {
    if (entry && rule) {
        Object.defineProperty(entry, AUTHORED_RULE, {
            value: rule, enumerable: false, writable: true, configurable: true,
        });
    }
    return entry;
}

/** The substrate-authored rule marked on `entry`, or `null`. */
export function authoredRuleOf(entry) {
    return entry?.[AUTHORED_RULE] ?? null;
}

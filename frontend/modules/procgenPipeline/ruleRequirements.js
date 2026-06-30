/**
 * Rule Builder access rule -> item requirement extraction.
 *
 * The inverse direction of pathsAndObstaclesCompiler / bounce's
 * minimalSetsToRule: given a rule, which items must the player hold? Used
 * when a layout driver realises an EXISTING rules.json (top-down) onto a
 * substrate whose geometry is gated by items (bounce). The substrate needs
 * to know which items to gate on physically; the rule TEXT is preserved by
 * the driver, so this only has to drive geometry, not reproduce the rule.
 *
 * Returns { requirement: string[], counts: {item: n}, exact: boolean }.
 *   - True_ / Has / And / HasAll extract EXACTLY (exact: true): the
 *     requirement is logically equivalent to the rule.
 *   - Or / HasAny(>1) / unsupported constructs can't be expressed as one
 *     AND-of-items, so the requirement falls back to the items required in
 *     EVERY branch (the necessary subset — possibly empty) and exact: false.
 *     A caller realising a preserved-rule world can treat exact:false as
 *     "build open-enough geometry; the preserved access_rule still gates."
 *
 * See NewDocs/plans/procedural-generation/topdown-bounce-obstacle-refactor.md.
 */

function extractRec(rule) {
    if (!rule || typeof rule !== 'object') return { items: new Map(), exact: false };
    switch (rule.rule) {
        case 'True_':
            return { items: new Map(), exact: true };
        case 'Has': {
            const name = rule.args?.item_name;
            if (name == null) return { items: new Map(), exact: false };
            return { items: new Map([[name, rule.args?.count ?? 1]]), exact: true };
        }
        case 'HasAll': {
            const items = rule.args?.items ?? rule.args?.item_names ?? [];
            return { items: new Map(items.map((i) => [i, 1])), exact: true };
        }
        case 'And': {
            const acc = new Map();
            let exact = true;
            for (const child of rule.children ?? []) {
                const r = extractRec(child);
                exact = exact && r.exact;
                for (const [k, v] of r.items) acc.set(k, Math.max(acc.get(k) ?? 0, v));
            }
            return { items: acc, exact };
        }
        case 'Or': {
            const childResults = (rule.children ?? []).map(extractRec);
            if (childResults.length === 0) return { items: new Map(), exact: false };
            // Necessary subset = items present in EVERY branch; count = min
            // across branches (a player satisfying any branch holds at least
            // that many).
            let inter = null;
            for (const r of childResults) {
                if (inter === null) {
                    inter = new Map(r.items);
                    continue;
                }
                const next = new Map();
                for (const [k, v] of inter) {
                    if (r.items.has(k)) next.set(k, Math.min(v, r.items.get(k)));
                }
                inter = next;
            }
            return { items: inter ?? new Map(), exact: false };
        }
        case 'HasAny': {
            // OR of Has(item). One item ≡ Has; more ≡ a disjunction with
            // empty necessary subset.
            const items = rule.args?.items ?? rule.args?.item_names ?? [];
            if (items.length === 1) return { items: new Map([[items[0], 1]]), exact: true };
            return { items: new Map(), exact: false };
        }
        case 'AtLeast': {
            // "At least N of M children." count == M ≡ And (exact). count < M
            // is a disjunction over which N branches satisfy: the only items we
            // can guarantee are those required by EVERY branch (necessary
            // subset, like Or), so exact: false.
            const childResults = (rule.children ?? []).map(extractRec);
            const required = rule.count ?? rule.args?.count ?? 0;
            if (required <= 0) return { items: new Map(), exact: true };
            if (childResults.length < required) return { items: new Map(), exact: false };
            if (required === childResults.length) {
                const acc = new Map();
                let exact = true;
                for (const r of childResults) {
                    exact = exact && r.exact;
                    for (const [k, v] of r.items) acc.set(k, Math.max(acc.get(k) ?? 0, v));
                }
                return { items: acc, exact };
            }
            let inter = null;
            for (const r of childResults) {
                if (inter === null) {
                    inter = new Map(r.items);
                    continue;
                }
                const next = new Map();
                for (const [k, v] of inter) {
                    if (r.items.has(k)) next.set(k, Math.min(v, r.items.get(k)));
                }
                inter = next;
            }
            return { items: inter ?? new Map(), exact: false };
        }
        default:
            // CountItem, helpers, False_, count_check, … — not expressible
            // as an AND-of-items. Fall back to "no physics requirement".
            return { items: new Map(), exact: false };
    }
}

export function extractItemRequirementFromRule(rule) {
    const { items, exact } = extractRec(rule);
    const requirement = [...items.keys()];
    const counts = {};
    for (const [k, v] of items) {
        if (v > 1) counts[k] = v;
    }
    return { requirement, counts, exact };
}

/**
 * procgenCore/ruleWithOwned — **A RULE, WITH THE ITEMS THE PLAYER ALREADY OWNS
 * TREATED AS HELD** (APWORLD SUBSTRATE CHANGE R3; the substrate-change plan
 * §9.2, ⚖ user 2026-09-23).
 *
 * Play already treats the starting inventory as owned: the inventory starts
 * with `starting_items[slot]`, so `Has Right arrow` passes at once. A realiser
 * asked to build a region from its access rules, though, reads the rule TEXT —
 * so a region gated on an item the player starts with is built as if it were
 * gated. This rewrites the rule so the realiser sees what play sees; for every
 * inventory that holds the owned multiset the rewritten rule EVALUATES the same
 * as the original (the property row, `ruleWithOwned.test.js`).
 *
 * Modelled (Rule Builder form — `{rule, args, children}`):
 *   · `Has X` (count c)  → `True_` when the owned list holds X at least c times
 *     (the starting list is a MULTISET — `set-starting-count` repeats a name);
 *     otherwise unchanged.
 *   · `HasAll [..]`      → minus the owned names; empty → `True_`, one → `Has`.
 *   · `HasAny [..]`      → `True_` when any name is owned; otherwise unchanged.
 *   · `And`              → children rewritten, `True_` children dropped; no
 *     children left → `True_`.
 *   · `Or`               → children rewritten; `True_` when any child is.
 * Everything else — `Count`, `HasFromListUnique`, `HasGroup`, `Not`, helpers,
 * reachability — is returned UNCHANGED (unchanged is always equivalent), and
 * its construct name is listed in `unmodelled` so a caller can say what it
 * did not look inside.
 *
 * ⛔ Pure, and names no substrate and no item: the owned list is the caller's.
 */

/** A fresh `True_` each time — a realiser may annotate the rule it is handed. */
const TRUE = () => ({ rule: 'True_' });

const isTrue = (r) => !!r && typeof r === 'object' && r.rule === 'True_';

/** ⛓ The owned list as a multiset: name → how many times it is held. */
export function ownedCounts(owned) {
    const counts = new Map();
    for (const n of owned ?? []) {
        if (typeof n === 'string' && n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    return counts;
}

/** ⛓ The list of names a `HasAll` / `HasAny` carries, and the key it rides under
 *  (`items` from `Resolved._get_args_dict`, `item_names` from `Rule.to_dict` — the
 *  evaluator reads both), or `null` when it carries none as a list. */
function namesOf(rule) {
    for (const key of ['items', 'item_names']) {
        if (Array.isArray(rule.args?.[key])) return { key, names: rule.args[key] };
    }
    return null;
}

/** ⛓ The children of an `And` / `Or` and the place they ride (`args.rules` wins,
 *  as in the evaluator). */
function childrenOf(rule) {
    if (Array.isArray(rule.args?.rules)) return { where: 'args', kids: rule.args.rules };
    return { where: 'children', kids: Array.isArray(rule.children) ? rule.children : [] };
}

function withChildren(rule, where, kids) {
    return where === 'args'
        ? { ...rule, args: { ...rule.args, rules: kids } }
        : { ...rule, children: kids };
}

function rewrite(rule, owned, acc) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) || typeof rule.rule !== 'string') {
        return rule;
    }
    switch (rule.rule) {
        case 'True_':
        case 'False_':
            return rule;
        case 'Has': {
            const name = rule.args?.item_name;
            const need = rule.args?.count ?? 1;
            if (typeof name !== 'string' || !Number.isFinite(need)) {
                acc.unmodelled.add('Has');
                return rule;
            }
            if ((owned.get(name) ?? 0) >= need) {
                acc.changed += 1;
                return TRUE();
            }
            return rule;
        }
        case 'HasAll': {
            const list = namesOf(rule);
            if (!list) {
                acc.unmodelled.add('HasAll');
                return rule;
            }
            const left = list.names.filter((n) => !owned.has(n));
            if (left.length === list.names.length) return rule;
            acc.changed += 1;
            if (left.length === 0) return TRUE();
            if (left.length === 1) {
                return { rule: 'Has', ...(rule.options ? { options: rule.options } : {}), args: { item_name: left[0] } };
            }
            return { ...rule, args: { ...rule.args, [list.key]: left } };
        }
        case 'HasAny': {
            const list = namesOf(rule);
            if (!list) {
                acc.unmodelled.add('HasAny');
                return rule;
            }
            if (list.names.some((n) => owned.has(n))) {
                acc.changed += 1;
                return TRUE();
            }
            return rule;
        }
        case 'And': {
            const { where, kids } = childrenOf(rule);
            const next = kids.map((k) => rewrite(k, owned, acc));
            if (next.every((k, i) => k === kids[i])) return rule;
            const kept = next.filter((k) => !isTrue(k));
            return kept.length === 0 ? TRUE() : withChildren(rule, where, kept);
        }
        case 'Or': {
            const { where, kids } = childrenOf(rule);
            const next = kids.map((k) => rewrite(k, owned, acc));
            if (next.every((k, i) => k === kids[i])) return rule;
            return next.some(isTrue) ? TRUE() : withChildren(rule, where, next);
        }
        default:
            acc.unmodelled.add(rule.rule);
            return rule;
    }
}

/**
 * ⛓⛓⛓ **THE RULE AS A PLAYER WHO OWNS `owned` SEES IT.**
 *
 * @param {object} rule a Rule Builder access rule (a non-rule is returned as is)
 * @param {Iterable<string>} owned the owned names — a multiset: repeat a name to
 *   own it more than once (the `starting_items` list is exactly this)
 * @returns {{rule: object, changed: number, unmodelled: string[]}} `changed` =
 *   how many `Has`/`HasAll`/`HasAny` nodes the owned list rewrote (0 → `rule`
 *   is the SAME object); `unmodelled` = the construct names returned unchanged
 *   without looking inside, sorted.
 */
export function ruleWithOwned(rule, owned) {
    const acc = { changed: 0, unmodelled: new Set() };
    const out = rewrite(rule, owned instanceof Map ? owned : ownedCounts(owned), acc);
    return { rule: acc.changed ? out : rule, changed: acc.changed, unmodelled: [...acc.unmodelled].sort() };
}

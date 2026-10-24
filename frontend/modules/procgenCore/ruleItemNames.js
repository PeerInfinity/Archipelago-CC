/**
 * procgenCore/ruleItemNames — **THE ITEM NAMES A RULE REFERENCES** (APWORLD
 * SUBSTRATE CHANGE B1; the substrate-change plan §26.8 #1, ruled §25.10).
 *
 * A compile that defines only the items some placed location holds leaves every
 * rule naming any OTHER item pointing at nothing (`unknown item`). The cure
 * starts by knowing which names a document's rules reference — this module.
 *
 * Read (the corpus's shapes, measured over every committed `_rules.json`):
 *   · Rule Builder form `{rule, args, children}` — a string under
 *     `args.item_name` or `args.item`, a string list under `args.item_names` or
 *     `args.items` (`Resolved._get_args_dict` spells a list `items`,
 *     `Rule.to_dict` spells it `item_names`; the evaluator reads both — the same
 *     two spellings `ruleWithOwned.js` reads). Keyed on the ARG, not the rule
 *     kind: a kind nobody listed that carries one of these keys is read too.
 *   · the exporter's typed form — `{type: 'item_check', item: '<name>'}` (every
 *     `completion_condition` of that shape, and some access rules). An `item`
 *     that is itself an expression (`{type: 'name', …}`) names nothing
 *     literally, so it is walked, not read.
 * Everything nested is walked — `children`, `args.rules`, `Not`'s `condition`,
 * `Compare`'s sides, `Has`'s rule-valued `count` — so a name inside any
 * sub-rule is found; a kind carrying none of the keys contributes only what
 * its children carry.
 *
 * ⛔ Pure; names no item, no rule kind, no game.
 */

import { walkRulesGraph } from './rulesGraph.js';

/** ⛓ The arg keys whose value is ONE item name. */
export const ITEM_NAME_KEYS = Object.freeze(['item_name', 'item']);
/** ⛓ The arg keys whose value is a LIST of item names. */
export const ITEM_LIST_KEYS = Object.freeze(['item_names', 'items']);
/** ⛓ The exporter's typed item check (`{type, item}`). */
export const TYPED_ITEM_CHECK = 'item_check';

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The names ONE node carries itself (not its children), in key order.
 *  Exported (T1) as `ownItemNames`: `validateRules` reads each node its walker
 *  visits through this, so the validator and this module agree on WHICH args
 *  name an item — keyed on the arg, never on the rule kind. */
export function ownItemNames(node) {
    const out = [];
    if (typeof node.rule === 'string') {
        const args = node.args;
        if (!isPlainObject(args)) return out;
        for (const [key, value] of Object.entries(args)) {
            if (ITEM_NAME_KEYS.includes(key)) {
                if (typeof value === 'string' && value) out.push(value);
            } else if (ITEM_LIST_KEYS.includes(key) && Array.isArray(value)) {
                for (const name of value) if (typeof name === 'string' && name) out.push(name);
            }
        }
    } else if (node.type === TYPED_ITEM_CHECK && typeof node.item === 'string' && node.item) {
        out.push(node.item);
    }
    return out;
}

function collect(node, out) {
    if (Array.isArray(node)) {
        for (const child of node) collect(child, out);
        return;
    }
    if (!isPlainObject(node)) return;
    for (const name of ownItemNames(node)) out.push(name);
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') collect(value, out);
    }
}

const unique = (names) => [...new Set(names)];

/**
 * Every item name `rule` references, once each, in first-reference order
 * (depth first, keys in document order). `[]` for a missing / non-object rule.
 *
 * @param {object|null|undefined} rule
 * @returns {string[]}
 */
export function itemNamesInRule(rule) {
    const out = [];
    collect(rule, out);
    return unique(out);
}

/**
 * Every item REFERENCE in one player's document, in document order: each
 * region's exits (their `access_rule`), then its locations (`access_rule`, then
 * `item_rule`), region by region; then `game_info[p].completion_condition`.
 * One entry per (rule, name) — a name two rules carry appears twice, so a
 * caller can say WHERE; `itemNamesInDocument` is the de-duplicated list.
 *
 * @param {object} doc
 * @param {string} playerId
 * @returns {Array<{name: string, regionName?: string, exitName?: string,
 *   locationName?: string, fieldName?: string, completion?: true}>}
 */
export function itemReferencesInDocument(doc, playerId) {
    const refs = [];
    const add = (rule, ctx) => {
        for (const name of itemNamesInRule(rule)) refs.push({ name, ...ctx });
    };
    walkRulesGraph(doc, playerId, {
        exit: (exit, ctx) => add(exit?.access_rule, ctx),
        location: (loc, ctx) => {
            add(loc?.access_rule, ctx);
            if (loc?.item_rule) add(loc.item_rule, { ...ctx, fieldName: 'item_rule' });
        },
    });
    add(doc?.game_info?.[playerId]?.completion_condition, { completion: true });
    return refs;
}

/**
 * The item names one player's rules reference, once each, in first-reference
 * (document) order.
 *
 * @param {object} doc
 * @param {string} playerId
 * @returns {string[]}
 */
export function itemNamesInDocument(doc, playerId) {
    return unique(itemReferencesInDocument(doc, playerId).map((r) => r.name));
}

/**
 * The FIRST reference of every name the rules carry that `doc.items[p]` does
 * not define — one entry per name, in first-reference order. `[]` when every
 * referenced name is defined.
 *
 * @param {object} doc
 * @param {string} playerId
 */
export function undefinedRuleItems(doc, playerId) {
    const defined = doc?.items?.[playerId] ?? {};
    const seen = new Set();
    const out = [];
    for (const ref of itemReferencesInDocument(doc, playerId)) {
        if (Object.hasOwn(defined, ref.name) || seen.has(ref.name)) continue;
        seen.add(ref.name);
        out.push(ref);
    }
    return out;
}

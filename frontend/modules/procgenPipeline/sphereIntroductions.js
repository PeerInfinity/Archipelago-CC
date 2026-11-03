/**
 * Sphere growth — **THE PLANNER'S REQUESTS FOR SUBSTRATE-INTRODUCED ITEMS** (⚖ the
 * user, 2026-11-03: *"Alternatively, items could be introduced only if the procgen
 * pipeline specifically requests them"*. That became the DEFAULT, and the GATE, in
 * sphere growth). The vocabulary is `procgenCore/itemIntroduction.js`.
 *
 * ── WHAT IT DOES (after ②c item placement, before ③ realisation) ──────
 *
 * For each node whose substrate DECLARES `itemIntroduction` with a non-empty
 * list under the world's region params, in node-index order, rng-free:
 *
 *   1. ELIGIBLE when the plan has a sphere after the node's own (w+1 < N) and a
 *      wave-(w+1) non-filler host holds an item: the first holding ≥ 2, else the
 *      first holding one (it is left a pass-through region), in index order. The
 *      item is its LAST DEALT one (no rule, not an introduced item: R1), so the
 *      host keeps every other location id. Otherwise the
 *      node is decided NONE (`introduces: []`).
 *   2. The ITEM is the first declared one in neither the plan (any sphere's items
 *      or introductions) nor another node's request. Distinct BY CONSTRUCTION.
 *      None free → refused by name (`exhaustedRefusalOf`).
 *   3. The PLAN is augmented. The item joins sphere w+1 as an INTRODUCED item
 *      (`spheres[w].introduced`, never `items`, so the round-robin deal never
 *      hands it to another node). The oracle and `held` count it.
 *   4. The NODE takes it: a location holding it (vanilla placement, made by the
 *      pipeline), plus the host's moved item on a location ruled `Has(<item>)`.
 *      That item is a sphere-(w+2) item, and behind the lock it is reachable
 *      exactly at sphere w+2, so the plan stays exact.
 *   5. The decision is RECORDED on the node: `introduces: [{item, lockedItem,
 *      lockedFrom}]` (compacted into `sphere_tree` only when present). On every
 *      later call (a batched run re-deals all items each batch) the recorded
 *      decision is REPLAYED, never re-decided.
 *
 * A node of a non-declaring substrate is never touched, and the plan gains no key,
 * so worlds without one are byte-identical.
 */

import {
    exhaustedRefusalOf, introducibleItemsOf,
} from '../procgenCore/itemIntroduction.js';

const hasRule = (item) => ({ rule: 'Has', args: { item_name: item } });

/** Every item name the plan already deals or introduces. */
function planItems(plan) {
    const out = new Set();
    for (const s of plan.spheres ?? []) {
        for (const i of s.items ?? []) out.add(i);
        for (const i of s.introduced ?? []) out.add(i);
    }
    return out;
}

/**
 * ⛓ R1 (js-16) — a DEALT item: no rule, and not an introduced item. A host that is itself a declaring node may
 * already hold its own key and its own locked item. Taking either would lock a key, or re-gate a sphere-(w+3)
 * item as sphere w+2, so only dealt items are ever moved, whatever order the nodes come in.
 */
const isDealt = (introduced) => (it) => !it.rule && !introduced.has(it.item);
const lastDealtIndex = (host, introduced, name = null) => (host?.items ?? [])
    .findLastIndex((it) => isDealt(introduced)(it) && (name === null || it.item === name));

/** Apply one recorded decision onto the freshly dealt items (idempotent per deal). */
function applyDecision(node, nodes, decision, introduced) {
    const host = nodes[decision.lockedFrom]?.index === decision.lockedFrom
        ? nodes[decision.lockedFrom] : nodes.find((n) => n.index === decision.lockedFrom);
    const at = lastDealtIndex(host, introduced, decision.lockedItem);
    if (!host || at < 0) {
        throw new Error(`scheduleSphereIntroductions: node ${node.index}'s recorded introduction of `
            + `'${decision.item}' locks '${decision.lockedItem}' from node ${decision.lockedFrom}, which no longer `
            + 'holds it. The tree was edited after the decision; re-plan the world.');
    }
    host.items.splice(at, 1);
    node.items.push({ id: `loc_${node.items.length}`, item: decision.item });
    node.items.push({ id: `loc_${node.items.length}`, item: decision.lockedItem, rule: hasRule(decision.item) });
}

/**
 * The pre-pass. `entryOf(substrateId)` is the registry lookup (`undefined` for an
 * id it does not hold: a library or atlas source). Mutates `plan` (introductions)
 * and `nodes` (items, `introduces`). Returns the nodes.
 */
export function scheduleSphereIntroductions(plan, nodes, { regionParams = {}, entryOf } = {}) {
    const spheres = plan?.spheres ?? [];
    const declaredFor = new Map();
    const declared = (node) => {
        if (!declaredFor.has(node.substrate)) {
            declaredFor.set(node.substrate, introducibleItemsOf(entryOf?.(node.substrate), regionParams));
        }
        return declaredFor.get(node.substrate);
    };
    const taken = planItems(plan);
    const introduced = new Set(spheres.flatMap((s) => s.introduced ?? []));
    const dealtCount = (n) => (n.items ?? []).filter(isDealt(introduced)).length;
    for (const node of nodes) {
        if (node.isFiller || declared(node).length === 0) continue;
        if (Array.isArray(node.introduces)) {
            for (const d of node.introduces) applyDecision(node, nodes, d, introduced);
            continue;
        }
        const w = node.wave;
        const hosts = w + 1 < spheres.length ? nodes.filter((n) => n.wave === w + 1 && !n.isFiller) : [];
        const host = hosts.find((n) => dealtCount(n) >= 2) ?? hosts.find((n) => dealtCount(n) >= 1);
        if (!host) { node.introduces = []; continue; }
        const item = declared(node).find((k) => !taken.has(k));
        if (item === undefined) {
            throw new Error(exhaustedRefusalOf(entryOf?.(node.substrate), node.region_id ?? `node ${node.index}`,
                declared(node)));
        }
        taken.add(item);
        introduced.add(item);
        spheres[w].introduced = [...(spheres[w].introduced ?? []), item];
        const decision = { item, lockedItem: host.items[lastDealtIndex(host, introduced)].item, lockedFrom: host.index };
        node.introduces = [decision];
        applyDecision(node, nodes, decision, introduced);
    }
    return nodes;
}

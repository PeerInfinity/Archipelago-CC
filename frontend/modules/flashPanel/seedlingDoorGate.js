/**
 * ⛓⛓⛓ SEEDLING GENERATED LEVELS G4 — **THE HOST ENFORCES A DOOR'S AP GATE.**
 *
 * The game cannot hold the pipeline's items (`key_*`), so it cannot lock a
 * generated room's teleporter on one. The host can: when a door fires, the
 * binding asks `canPass(exit)` before it publishes the crossing, and a refused
 * door BOUNCES the player back onto its approach cell instead
 * (`seedlingRegionBinding.js`, the `pendingBounce` mark). This module builds
 * that predicate from the state manager — the same evaluator the logic uses
 * (`stateManager/index.js` evaluates location rules the same way), so the door
 * refuses exactly what the logic says the player cannot yet do.
 *
 * ⛔ `createSnapshotInterface` IS HANDED IN, NEVER IMPORTED. Its static closure
 * is the game-logic registry of every game — measured (G4 W0 #4): +19 files /
 * 634,636 B on `flashPanel/index.js`'s static closure. `evaluateRule` costs the
 * panel nothing (its closure is already there), so it is imported. The panel
 * loads the interface through a COMPUTED specifier (`loadSnapshotInterface`,
 * the generator's pattern); until it lands the gate answers with an ERROR,
 * which the binding turns into the declared default, loudly.
 *
 * ⛔ THREE WAYS AN EVALUATION FAILS, AND ONLY ONE THROWS (G4 W0 #2, measured):
 * a NULL snapshot evaluates to `false` — a state manager that has not loaded
 * would silently LOCK every door — and an unknown rule evaluates to `undefined`.
 * Each is refused here as an error by sentence, never read as an answer.
 *
 * ⛓⛓ SEEDLING GENERATED G6 — **THE RULE IS READ FROM THE STATE MANAGER'S STATIC
 * DATA**, by the region the player is in and the exit's AP name (`exitName` —
 * the name the binding publishes a crossing under; never `exit_id`, which is
 * the door's own tile/atlas id): `staticData.regions[region].exits[].{name,
 * access_rule}`, the shape the text adventure bridge reads. One source of truth
 * — the very rule the logic evaluates — for EVERY Seedling room: a real-atlas
 * room's payload carries no rule at all, and a generated room's `exitGates`
 * never saw an engine-inserted exit (plan §9.0 #5). The world's own
 * `access_rule` is the FALLBACK, taken only when static data has no such exit,
 * and the verdict says so (`fallback`). A `True_` rule is UNGATED: no evaluator
 * is asked, so an ungated door never depends on the lazy load.
 */

import { evaluateRule } from '../shared/ruleEngine.js';

/** The evaluator's context builder, loaded lazily (see the header). */
export const SNAPSHOT_INTERFACE_MODULE_PATH = 'modules/shared/snapshotInterface.js';

/**
 * ⚖ What a door does when its rule cannot be evaluated: OPEN (the crossing
 * proceeds as it would with no gate) — and the binding says why, loudly. Every
 * failure measured is SYSTEMIC (no snapshot yet, the evaluator not loaded, a
 * rule the engine does not know), so a LOCKED default would lock every gated
 * door of the room at once and strand the player; OPEN costs at most a
 * sequence break the panel names. AP's own logic never asked the door.
 */
export const DOOR_GATE_ERROR_DEFAULT = 'open';

export const DOOR_GATE_ERRORS = Object.freeze({
    notLoaded: () => 'the rule evaluator (createSnapshotInterface) is not loaded yet',
    noSnapshot: () => 'the state manager has no state snapshot yet',
    notBoolean: (answer) => `the rule evaluated to ${answer === undefined ? 'undefined' : JSON.stringify(answer)}, `
        + 'not true or false — the rule engine does not know this rule',
    noStaticData: () => 'the state manager has no static data yet, so the door\'s rule cannot be looked up',
});

/** ⛓ G6 — why a door's rule came off the room's payload instead of static data (the verdict's `fallback`). */
export const DOOR_RULE_FALLBACK = (region, exitName) => `the rule is the room's own payload's — the state `
    + `manager's static data has no exit "${exitName}" out of region "${region}"`;

/** A region of static data — a `Map` in the state manager proxy, a plain object in a rules.json. */
function staticRegionOf(staticData, region) {
    const regions = staticData?.regions;
    if (!regions || region == null) return null;
    return (regions instanceof Map ? regions.get(region) : regions[region]) ?? null;
}

/**
 * ⛓ G6 — the static-data exit a door is, by its region and AP name, or null.
 * `{name, connected_region, access_rule}` as the rules.json writes it.
 */
export function staticExitOf(staticData, region, exitName) {
    const exits = staticRegionOf(staticData, region)?.exits;
    if (!Array.isArray(exits) || exitName == null) return null;
    return exits.find((e) => e?.name === exitName) ?? null;
}

/** A rule that gates nothing: absent, or `True_`. */
const isOpenRule = (rule) => !rule || rule.rule === 'True_';

/**
 * The item names a rule mentions, in the order it names them, once each. Read
 * off the rule's own fields — `args.item_name` / `args.item_names` (the Rule
 * Builder spelling the pipeline writes) and `item` on an `item_check` /
 * `count_check` node (the compiled spelling) — so the refusal names what the
 * rule names, never a hand-typed string.
 */
export function ruleItemNames(rule) {
    const out = [];
    const add = (name) => { if (typeof name === 'string' && name !== '' && !out.includes(name)) out.push(name); };
    const visit = (node) => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (node.type === 'item_check' || node.type === 'count_check') {
            add(typeof node.item === 'string' ? node.item : node.item?.value);
        }
        const args = node.args;
        if (args && typeof args === 'object' && !Array.isArray(args)) {
            add(args.item_name);
            if (Array.isArray(args.item_names)) args.item_names.forEach(add);
        }
        for (const [key, value] of Object.entries(node)) {
            if (key !== 'args' && value && typeof value === 'object') visit(value);
        }
        if (args && typeof args === 'object') visit(Object.values(args));
    };
    visit(rule);
    return out;
}

/**
 * The sentence a locked door says. `needs` are the items the player lacks (or,
 * when the rule is not a plain item list, every item it names).
 */
export function lockedDoorMessage(region, needs = []) {
    if (!needs.length) return `the door to ${region} is locked — its rule is not met yet`;
    const list = needs.length === 1 ? needs[0]
        : `${needs.slice(0, -1).join(', ')} and ${needs[needs.length - 1]}`;
    return `the door to ${region} is locked — you need ${list}`;
}

/**
 * The `canPass(exit, {region})` predicate the binding consults.
 *
 * @param {object} deps
 * @param {function} deps.getSnapshot            the state manager's latest snapshot (or null)
 * @param {function} deps.getStaticData          its static data (or null) — the rule's SOURCE (G6)
 * @param {function} deps.getSnapshotInterface   → `createSnapshotInterface`, or null while it loads
 * @param {function} [deps.evaluate]             `evaluateRule` (injectable for tests)
 * @returns {function(object, {region}=): {pass: boolean, gated: boolean, needs: string[], missing: string[],
 *   source: 'static'|'world', fallback?: string}}
 *   The rule is static data's exit `exitName` out of `region`; the world's
 *   `access_rule` only when static data has no such exit (`fallback` says so).
 *   An absent or `True_` rule passes without asking anything. THROWS a sentence
 *   when the rule cannot be evaluated — static data not loaded included (the
 *   binding catches it and takes the declared default, loudly).
 */
export function createDoorGate({ getSnapshot, getStaticData, getSnapshotInterface, evaluate = evaluateRule } = {}) {
    return function canPass(exit, { region = null } = {}) {
        const staticData = getStaticData?.() ?? null;
        if (!staticData) throw new Error(DOOR_GATE_ERRORS.noStaticData());
        const exitName = exit?.exitName ?? exit?.exit_id ?? null;
        const hit = staticExitOf(staticData, region, exitName);
        const source = hit ? 'static' : 'world';
        const rule = hit ? (hit.access_rule ?? null) : (exit?.access_rule ?? null);
        const fallback = !hit && !isOpenRule(rule) ? { fallback: DOOR_RULE_FALLBACK(region, exitName) } : {};
        if (isOpenRule(rule)) return { pass: true, gated: false, needs: [], missing: [], source };
        const make = getSnapshotInterface?.() ?? null;
        if (typeof make !== 'function') throw new Error(DOOR_GATE_ERRORS.notLoaded());
        const snapshot = getSnapshot?.() ?? null;
        if (!snapshot) throw new Error(DOOR_GATE_ERRORS.noSnapshot());
        const answer = evaluate(rule, make(snapshot, staticData));
        if (typeof answer !== 'boolean') throw new Error(DOOR_GATE_ERRORS.notBoolean(answer));
        const needs = ruleItemNames(rule);
        const inventory = snapshot.inventory ?? {};
        const missing = needs.filter((item) => !(Number(inventory[item]) > 0));
        return { pass: answer, gated: true, needs, missing, source, ...fallback };
    };
}

/**
 * ⛓ The panel's lazy load of `createSnapshotInterface` — a COMPUTED specifier
 * against `document.baseURI`, so esbuild cannot see it and the panel's static
 * closure does not grow. One load per page; a failure is reported through `log`
 * and may be retried.
 */
export function createSnapshotInterfaceLoader({
    baseURI = globalThis.document?.baseURI,
    importer = (url) => import(/* @vite-ignore */ url),
    log = () => {},
} = {}) {
    let make = null;
    let pending = null;
    return {
        get: () => make,
        load() {
            if (make) return Promise.resolve(true);
            if (!baseURI) return Promise.resolve(false);
            pending ??= importer(new URL(SNAPSHOT_INTERFACE_MODULE_PATH, baseURI).href)
                .then((mod) => {
                    if (typeof mod?.createSnapshotInterface !== 'function') {
                        throw new Error(`${SNAPSHOT_INTERFACE_MODULE_PATH} has no createSnapshotInterface export`);
                    }
                    make = mod.createSnapshotInterface;
                    return true;
                })
                .catch((err) => {
                    pending = null;
                    log(`the rule evaluator (${SNAPSHOT_INTERFACE_MODULE_PATH}) did not load — a gated generated `
                        + `door will stay OPEN until the page is reloaded: ${err?.message ?? err}`);
                    return false;
                });
            return pending;
        },
    };
}

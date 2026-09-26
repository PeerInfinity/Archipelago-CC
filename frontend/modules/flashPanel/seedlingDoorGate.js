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
});

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
 * The `canPass(exit)` predicate the binding consults.
 *
 * @param {object} deps
 * @param {function} deps.getSnapshot            the state manager's latest snapshot (or null)
 * @param {function} deps.getStaticData          its static data (or null)
 * @param {function} deps.getSnapshotInterface   → `createSnapshotInterface`, or null while it loads
 * @param {function} [deps.evaluate]             `evaluateRule` (injectable for tests)
 * @returns {function(object): {pass: boolean, gated: boolean, needs: string[], missing: string[]}}
 *   An exit with no `access_rule` passes without asking anything. THROWS a
 *   sentence when the rule cannot be evaluated (the binding catches it).
 */
export function createDoorGate({ getSnapshot, getStaticData, getSnapshotInterface, evaluate = evaluateRule } = {}) {
    return function canPass(exit) {
        const rule = exit?.access_rule ?? null;
        if (!rule) return { pass: true, gated: false, needs: [], missing: [] };
        const make = getSnapshotInterface?.() ?? null;
        if (typeof make !== 'function') throw new Error(DOOR_GATE_ERRORS.notLoaded());
        const snapshot = getSnapshot?.() ?? null;
        if (!snapshot) throw new Error(DOOR_GATE_ERRORS.noSnapshot());
        const answer = evaluate(rule, make(snapshot, getStaticData?.() ?? null));
        if (typeof answer !== 'boolean') throw new Error(DOOR_GATE_ERRORS.notBoolean(answer));
        const needs = ruleItemNames(rule);
        const inventory = snapshot.inventory ?? {};
        const missing = needs.filter((item) => !(Number(inventory[item]) > 0));
        return { pass: answer, gated: true, needs, missing };
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

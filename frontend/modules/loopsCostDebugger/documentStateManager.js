/**
 * loopsCostDebugger/documentStateManager — **A WORKING COPY, WEARING THE STATE
 * MANAGER'S FACE** (APWORLD EDITOR HUB slice H5; plan §4's working-copy
 * hand-off, §1's ⚖ *"Linked editors open from the WORKING COPY"*).
 *
 * ── ⛓⛓⛓ THE SEAM WAS ALREADY NARROW, AND THAT IS WHY THIS IS CHEAP ────
 *
 * `CostPlanner` takes its state manager as a CONSTRUCTOR ARGUMENT and touches
 * it through exactly two methods, measured over the whole file:
 *
 *     getStaticData()            → `{regions: Map, locations: Map,
 *                                    eventLocations: {}, playerId, …}`
 *     getLatestStateSnapshot()   → `{startRegions, …}`
 *
 * So *"plan against a document nobody has applied"* does not need the worker,
 * the proxy, or a second parse of a rules.json — it needs an object with those
 * two methods over the document in hand. Before H5 the panel's link from the
 * hub was going to be plan §4's named fallback, *"Apply, then open"*; it is not,
 * and the measurement is below.
 *
 * ── ⛔⛔ NOTHING HERE RE-IMPLEMENTS THE PARSE ──────────────────────────
 *
 * The translation from a rules.json to those Maps is `StateManager
 * .loadFromJSON` + `getStaticGameData`, which is the SAME code the worker runs
 * on an app-wide load (`stateManagerWorker.js:560-565`). A hand-rolled
 * "documents to regions" walk here would be a second answer to a question the
 * state manager already answers, and the two would disagree the first time a
 * rules.json grew a field. ⇒ this module constructs a real `StateManager` on
 * the main thread and reads it.
 *
 * ⚠ **IT NEEDS THE RULE ENGINE INJECTED.** `loadFromJSON` finishes with an
 * initial reachability computation, and a `StateManager` built with no
 * `evaluateRuleFunction` dies there with `sm.evaluateRuleFromEngine is not a
 * function` — measured: the regions, locations and exits are all parsed by then,
 * so the failure looks like a working intake right up to the last statement.
 * `shared/ruleEngine.js`'s `evaluateRule` is what the worker passes.
 *
 * ── ⛓ MEASURED COST (H5, this box, node 18) ───────────────────────────
 *
 *     procgen_maze/AP_1        4 regions, 3 locations       4.4 ms
 *     jta_substrate_test      17 regions, 22 locations     21.3 ms
 *     stardew_valley         209 regions, 489 locations   305.7 ms   ← the
 *                                                                     corpus's
 *                                                                     heaviest
 *
 * plus a ONE-TIME ~117 ms module import, which is why both imports are DYNAMIC:
 * `stateManager.js` runs in the WORKER in this app, and a static import here
 * would put its whole graph on the main thread for every consumer of this
 * module — the same measurement `bounceDemoLibrary.js:835-852` records about
 * `roomEditor.open`.
 *
 * ── ⛓ THE STATIC DATA IS BUILT ONCE ───────────────────────────────────
 *
 * `getStaticGameData` rebuilds its Maps and stamps `displayName` on every
 * location, item and region each call, and the planner asks for it once per
 * region, per location and per planned step. Caching it is not an optimisation
 * — a planner that got a FRESH object graph on every call would be comparing
 * identities across copies.
 */

import { regionSubstratesFromRulesJson } from '../shared/procgen/loopCostPlanner.js';

/**
 * Build a `CostPlanner`-shaped state manager over a rules.json working copy.
 *
 * @param {object} jsonData the working copy (`session.record()`), never applied
 * @param {string} playerId the slot to plan — the DOCUMENT's, not the app's
 * @returns {Promise<{getStaticData: function, getLatestStateSnapshot: function,
 *   regionSubstrates: Map<string,string>, playerId: string,
 *   stats: {regions: number, locations: number, ms: number}}>}
 */
export async function documentStateManager(jsonData, playerId) {
    if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('documentStateManager: needs a rules.json working copy — '
            + `got ${jsonData === null ? 'null' : typeof jsonData}`);
    }
    const started = (typeof performance !== 'undefined' ? performance : Date).now();
    const [{ StateManager }, { evaluateRule }] = await Promise.all([
        import('../stateManager/stateManager.js'),
        import('../shared/ruleEngine.js'),
    ]);
    const sm = new StateManager(evaluateRule);
    sm.loadFromJSON(jsonData, String(playerId));
    const staticData = sm.getStaticGameData();
    // ⛓ L2 — the WRITE-BY-CLASS rule needs to know which substrate each region
    // has, and static data does not carry `preset_sidecars`. The applied-state
    // path asks `procgenPlayer.getRegionInfo`; a working copy the app has never
    // applied has no such answer, so the map comes from the DOCUMENT itself.
    const regionSubstrates = regionSubstratesFromRulesJson(jsonData, String(playerId));
    const elapsed = (typeof performance !== 'undefined' ? performance : Date).now() - started;
    return {
        getStaticData: () => staticData,
        getLatestStateSnapshot: () => sm.getSnapshot(),
        regionSubstrates,
        playerId: String(playerId),
        stats: {
            regions: staticData.regions?.size ?? 0,
            locations: staticData.locations?.size ?? 0,
            ms: Math.round(elapsed),
        },
    };
}

/**
 * ⛓⛓ **WHICH SLOT A DOCUMENT IS ABOUT**, in the order H1's registry settled on
 * (`apworldEditor/documentKeys.defaultPlayerOf`, plan §10.5 ⚖ 2): the
 * document's own `playerId` first — it is the only top-level key that says so,
 * and a per-player export names its own slot — then the first slot its
 * `regions` block carries, then `'1'`.
 *
 * ⛔ NOT the app's current player. The whole point of a working copy is that
 * the app may be holding a different world entirely.
 */
export function documentPlayerId(jsonData, fallback = '1') {
    const declared = jsonData?.playerId;
    const regions = jsonData?.regions;
    const slots = regions && typeof regions === 'object' && !Array.isArray(regions)
        ? Object.keys(regions).filter((k) => /^[0-9]+$/.test(k)) : [];
    if (typeof declared === 'string' && declared !== ''
        && (slots.length === 0 || slots.includes(declared))) {
        return declared;
    }
    return slots.length > 0 ? slots[0] : fallback;
}

/**
 * ⛓⛓ **THE LOG A WORKING COPY CAN BE PLANNED AGAINST IS ITS OWN.**
 *
 * ⛔ A document handed over here must NOT be planned against the app's applied
 * sphere log: that log describes whatever world is loaded, and the panel
 * already carries a warning for exactly this failure (*"ALL n sphere-log
 * locations are not in this player's world — wrong player or wrong seed"*).
 * Silently borrowing it would manufacture that condition rather than report it.
 * So: the document's embedded `sphere_log` or nothing, and "nothing" is said
 * out loud.
 *
 * Measured over the committed corpus: 26 presets embed `sphere_log`, 12 carry
 * `loop_costs`, and TEN carry both — `jta_mixed_test` and `jta_substrate_test`
 * carry costs with no embedded log, which is exactly the case this refusal is
 * about.
 *
 * @returns {{entries: Array}|{refusal: string}}
 */
export function documentSphereLog(jsonData) {
    const log = jsonData?.sphere_log;
    if (Array.isArray(log) && log.length > 0) return { entries: log };
    return {
        refusal: 'This working copy embeds no `sphere_log`, and the app\'s log belongs to '
            + 'whatever world is currently applied — planning one against the other would '
            + 'report every location as foreign. Press "Use applied state" to plan the loaded '
            + 'world, or hand over a document that carries its own log.',
    };
}

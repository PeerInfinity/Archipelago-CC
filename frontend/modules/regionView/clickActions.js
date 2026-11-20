/**
 * ⛓ CLICK ACTIONS — what a click on a region or a location in a map panel RUNS (mode-toggle design, slice CA-S1).
 *
 * A registry of named actions, owned by panels, and a per-panel settings object that says which of them a click
 * runs. It replaces the Region Graph's seven "On Region Node Click" checkboxes with named choices (route from path
 * end / start / player, always all the way), and lets other panels add their own actions (the Regions panel's
 * "open at it", Flash's teleport, …). The shared "On click" strip (`clickActionsUI.js`) renders and edits a panel's
 * settings; the Region Graph runs its clicks through `runClickActions` (CA-S2), the Region Map follows in CA-S3,
 * the other panel-owned actions in CA-S4.
 *
 * ⚖ NO "ONE STEP" (user, 2026-11-17T23:00:54Z, session 84c8ab35): *"I think I want to entirely remove the "move
 * player one step" option."* A route always goes all the way; there is no distance choice. The migration treats the
 * old `movePlayerOneStep` key as false, and a stored route that still carries a `distance` is read without it.
 *
 * PURE. No DOM, no event bus, no singleton: every collaborator comes in through the handles `h` (the same handles as
 * `regionActions.js`, plus the few named below) and the click's `ctx`.
 *
 * AN ACTION is `{ id, owner, label, target: 'region'|'location', kind: 'toggle'|'choice', choices?, order?, run,
 *   summary?, choiceLabels? }`.
 *   - `id` is namespaced by its owner: `path.route`, `path.checkAll`, `path.check`, `regions.open`, `flash.teleport`.
 *   - `kind: 'toggle'` is on when the panel's setting for it is `true`. `kind: 'choice'` is on when the setting is a
 *     value (`choices` lists the allowed values), off when it is `false`, `null` or absent.
 *   - `order` places it in the R8 run order: `ORDER.path` (100) first, then `ORDER.check` (200), then the panel
 *     actions (`ORDER.panel`, 300, the default). Equal orders run in registration order.
 *   - `summary` (optional, for the strip's collapsed line): a string, or `(value) => string | null`. Default: `label`.
 *   - `choiceLabels` (optional, for the strip): `{ <choice value>: <text> }`. An unlabelled value shows as itself.
 *   - `run(h, ctx)` gets the panel's handles and `{ panelId, target, regionName, locationName?, discovery?, settings,
 *     value }` (`value` = this action's setting). It returns the `regionActions` result shape (`{ ok, … }`).
 *
 * SETTINGS (per panel, R4: `moduleSettings.<panel>.clickActions`):
 *     { enabled: true,                                   // the master switch (false → a click runs nothing)
 *       region:   { 'path.route': { from: 'pathEnd' | 'start' | 'player' } | false,
 *                   'path.checkAll': false,
 *                   'regions.open': true, … },           // ids of actions not registered here are KEPT
 *       location: { 'path.check': 'now' | 'addToPath' | false, … } }
 *
 * The built-in actions (owner `path`, "Path & movement") call `regionActions.js` only, in the same sequence the
 * Region Graph's handlers do today (`regionGraph/graphInteractionManager.js` `handleRegionNodeClick` /
 * `handleLocationNodeClick`, via `navigationManager.js`). Their path moves go out under
 * `source: 'regionView-path-<panelId>'` (R7), which `loops/loopModeExemptions.js` classifies as planning.
 *
 * EXTRA HANDLES the built-ins read, beyond `regionActions`':
 *   - `h.originators` = `{ check, bulkCheck }` — the panel's `user:locationCheck` originator strings;
 *   - `h.beforePathExecute()` (optional) — passed as the path edits' `beforeExecute` (the Region Graph turns the
 *     Regions panel's "Show All Regions" off there);
 *   - `h.onError(e)` (optional) — passed to the move planners as their `onError`.
 */
import * as actions from './regionActions.js';

/** The R8 run order: path first, then checks, then panel actions. */
export const ORDER = Object.freeze({ path: 100, check: 200, panel: 300 });

/** The `source` prefix of every built-in path move (R7). `loops/loopModeExemptions.js` plans on it. */
export const PATH_SOURCE_PREFIX = 'regionView-path';

/** The `source` a built-in path move from panel `panelId` carries. */
export function pathSourceFor(panelId) {
    return `${PATH_SOURCE_PREFIX}-${panelId}`;
}

export const TARGETS = Object.freeze(['region', 'location']);

/** The built-in ids. */
export const BUILT_IN_IDS = Object.freeze({
    route: 'path.route',
    checkAll: 'path.checkAll',
    check: 'path.check',
});

/** The route choice: where the walk starts. It always goes all the way (no "one step", ⚖ 2026-11-17). */
export const ROUTE_FROM = Object.freeze(['pathEnd', 'start', 'player']);
export const LOCATION_CHECK = Object.freeze(['now', 'addToPath']);

/* ── the registry ────────────────────────────────────────────────────── */

const registry = new Map(); // id → { desc, seq }
let seq = 0;
const listeners = new Set(); // () => void, told after every register / unregister (the strip re-renders)

function notifyChanged() {
    for (const fn of [...listeners]) {
        try { fn(); } catch { /* a listener's failure must not break a registration */ }
    }
}

/**
 * Be told when the registry changes (an action registered or unregistered). A plain listener list: no event bus.
 * Returns the unsubscribe function.
 */
export function onClickActionsChanged(listener) {
    if (typeof listener !== 'function') throw new Error('onClickActionsChanged: a function is required');
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/**
 * Register an action. Throws on a malformed descriptor, and on a duplicate id (by name: the owner that holds it).
 * Returns the frozen descriptor.
 */
export function registerClickAction(desc) {
    if (!desc || typeof desc !== 'object') throw new Error('registerClickAction: a descriptor object is required');
    const { id, owner, label, target, kind, choices, order, run, summary, choiceLabels } = desc;
    if (typeof id !== 'string' || !id) throw new Error('registerClickAction: `id` must be a non-empty string');
    if (typeof owner !== 'string' || !owner) throw new Error(`registerClickAction(${id}): \`owner\` must be a non-empty string`);
    if (!id.startsWith(`${owner}.`)) {
        throw new Error(`registerClickAction(${id}): the id must be namespaced by its owner ("${owner}.…")`);
    }
    if (!TARGETS.includes(target)) throw new Error(`registerClickAction(${id}): \`target\` must be 'region' or 'location'`);
    if (kind !== 'toggle' && kind !== 'choice') throw new Error(`registerClickAction(${id}): \`kind\` must be 'toggle' or 'choice'`);
    if (kind === 'choice' && (choices == null || typeof choices !== 'object')) {
        throw new Error(`registerClickAction(${id}): a 'choice' action needs \`choices\``);
    }
    if (typeof run !== 'function') throw new Error(`registerClickAction(${id}): \`run\` must be a function`);
    if (order !== undefined && !Number.isFinite(order)) throw new Error(`registerClickAction(${id}): \`order\` must be a number`);
    if (summary !== undefined && typeof summary !== 'string' && typeof summary !== 'function') {
        throw new Error(`registerClickAction(${id}): \`summary\` must be a string or a function`);
    }
    if (choiceLabels !== undefined && (choiceLabels === null || typeof choiceLabels !== 'object')) {
        throw new Error(`registerClickAction(${id}): \`choiceLabels\` must be an object`);
    }
    const held = registry.get(id);
    if (held) {
        throw new Error(`registerClickAction: duplicate id "${id}" (already registered by "${held.desc.owner}")`);
    }
    const frozen = Object.freeze({ id, owner, label: label ?? id, target, kind, choices, order: order ?? ORDER.panel, run,
        summary, choiceLabels: choiceLabels ? Object.freeze({ ...choiceLabels }) : undefined });
    registry.set(id, { desc: frozen, seq: seq++ });
    notifyChanged();
    return frozen;
}

/** Unregister an action. Returns true when it was registered. */
export function unregisterClickAction(id) {
    const had = registry.delete(id);
    if (had) notifyChanged();
    return had;
}

/** The registered descriptor of `id`, or null. */
export function getClickAction(id) {
    return registry.get(id)?.desc ?? null;
}

/** The registered actions for `target`, in run order (`order`, then registration order). */
export function listClickActions(target) {
    return [...registry.values()]
        .filter((e) => e.desc.target === target)
        .sort((a, b) => (a.desc.order - b.desc.order) || (a.seq - b.seq))
        .map((e) => e.desc);
}

/** Is `value` an "on" setting for `desc`? A toggle: `true`. A choice: any value but `false` / `null` / absent. */
export function isOn(desc, value) {
    if (desc.kind === 'toggle') return value === true;
    return value !== false && value !== null && value !== undefined;
}

/**
 * Run every action this panel's settings enable for one click, in the R8 order.
 * @param {string} panelId - the clicking panel ('regionGraph', 'regionMap'); names the path `source`
 * @param {'region'|'location'} target
 * @param {object} ctx - { regionName, locationName?, discovery? } (discovery = { active, settings })
 * @param {object} settings - the panel's `clickActions` object (never written)
 * @param {object} h - the panel's handles (see the file header)
 * → { ran: false, reason: 'disabled' | 'no-settings' }
 *   | { ran: true, results: [{ id, owner, result }], skipped: [{ id, reason: 'unregistered' }] }
 * An enabled id with no registered action is skipped and reported; `settings` keeps it.
 */
export function runClickActions(panelId, target, ctx, settings, h) {
    if (!TARGETS.includes(target)) throw new Error(`runClickActions: unknown target "${target}"`);
    if (!settings || typeof settings !== 'object') return { ran: false, reason: 'no-settings', results: [], skipped: [] };
    if (settings.enabled === false) return { ran: false, reason: 'disabled', results: [], skipped: [] };
    const wanted = settings[target] ?? {};
    const results = [];
    const skipped = [];
    const registered = listClickActions(target);
    const known = new Set(registered.map((d) => d.id));
    for (const [id, value] of Object.entries(wanted)) {
        if (known.has(id)) continue;
        if (value === false || value === null || value === undefined) continue;
        skipped.push({ id, reason: 'unregistered' });
    }
    for (const desc of registered) {
        const value = wanted[desc.id];
        if (!isOn(desc, value)) continue;
        const result = desc.run(h, { ...ctx, panelId, target, settings, value });
        results.push({ id: desc.id, owner: desc.owner, result });
    }
    return { ran: true, results, skipped };
}

/* ── the built-in actions ────────────────────────────────────────────── */

const noop = () => {};

/** A route value is `{ from }` with a known `from`. Any other field (a pre-ruling `distance`) is ignored, not refused. */
function validRoute(value) {
    return !!value && typeof value === 'object' && ROUTE_FROM.includes(value.from);
}

/**
 * Route to `regionName` the way `route` says, from panel `panelId`, ALL THE WAY (the Region Graph's precedence,
 * re-expressed; its `navigationManager.js` moves before CA-S2):
 *   pathEnd → `actions.addToPath`; start → `actions.overwritePath`; player → `planDirectMove`, then
 *   `publishRegionMove` when it plans a move.
 * `moveOnlyOneStep: false` is `regionActions`' own option, passed as the Region Graph always passed it with the
 * one-step box unticked.
 */
export function routeTo(h, regionName, route, panelId) {
    if (!validRoute(route)) return { ok: false, reason: 'invalid-route' };
    const source = pathSourceFor(panelId);
    const beforeExecute = h.beforePathExecute ?? null;
    if (route.from === 'pathEnd') return actions.addToPath(h, regionName, { moveOnlyOneStep: false, source, beforeExecute });
    if (route.from === 'start') return actions.overwritePath(h, regionName, { moveOnlyOneStep: false, source, beforeExecute });
    const plan = actions.planDirectMove(h, regionName, { onError: h.onError ?? noop });
    if (plan.ok && plan.kind === 'move') actions.publishRegionMove(h, plan.move, source);
    return plan;
}

/**
 * The status-bar text of one route result (the Region Graph's `navigationManager.js` texts before CA-S2), or null
 * for a silent one. `from` is the route's `from`.
 */
export function routeStatusText(from, target, r) {
    if (!r) return null;
    if (!r.ok) {
        if (r.reason !== 'no-path') return null;
        return from === 'player' ? `No path to ${target}` : `No path from ${r.from} to ${target}`;
    }
    if (r.kind === 'restart') return `Restart → ${r.region} (no walk from ${r.from} to ${target})`;
    if (from === 'player') {
        return r.path.length === 1 ? `Moving directly to ${target}` : `Moving directly to ${target} (skipping ${r.path.length - 1} steps)`;
    }
    if (from === 'pathEnd') return r.kind === 'path' ? `Added ${r.dispatched} region(s) to path` : null;
    if (from === 'start') return `Created path: ${r.from} → ${target} (${r.dispatched} steps)`;
    return null;
}

/**
 * The status text of a whole `runClickActions` answer: the route's (a region click's `path.route`, or a location
 * click's `path.check: 'addToPath'`, whose `moved` is the route result). → { text, from } | null.
 */
export function clickStatusOf(run, ctx, settings) {
    if (!run?.ran) return null;
    const route = settings?.region?.[BUILT_IN_IDS.route];
    if (!validRoute(route)) return null;
    for (const { id, result } of run.results) {
        const r = id === BUILT_IN_IDS.route ? result : (id === BUILT_IN_IDS.check ? result?.moved : null);
        const text = routeStatusText(route.from, ctx.regionName, r);
        if (text) return { text, from: route.from };
    }
    return null;
}

function checksBlocked(ctx) {
    return !actions.locationChecksAllowed(ctx.discovery ?? {});
}

/** The built-in descriptors (owner `path`). Registered at module load; `resetClickActionsForTests` re-registers them. */
export const BUILT_IN_ACTIONS = Object.freeze([
    {
        id: BUILT_IN_IDS.route,
        owner: 'path',
        label: 'Route to the region',
        target: 'region',
        kind: 'choice',
        choices: { from: ROUTE_FROM },
        choiceLabels: { pathEnd: 'Extend the path from its end', start: 'Restart the path from the start',
            player: 'Move the player there' },
        summary: (v) => ({ pathEnd: 'extend path', start: 'restart path', player: 'move player' })[v?.from] ?? null,
        order: ORDER.path,
        run: (h, ctx) => routeTo(h, ctx.regionName, ctx.value, ctx.panelId),
    },
    {
        id: BUILT_IN_IDS.checkAll,
        owner: 'path',
        label: 'Check all accessible locations there',
        summary: 'check all',
        target: 'region',
        kind: 'toggle',
        order: ORDER.check,
        // graphInteractionManager.checkAllLocationsInRegion: the discovery gate, then (only when the region has
        // locations) the state read at click time, then the bulk check.
        run: (h, ctx) => {
            if (checksBlocked(ctx)) return { ok: false, reason: 'checks-disabled' };
            const staticData = h.stateManager.getStaticData();
            const regionData = staticData?.regions?.get(ctx.regionName);
            if (!(regionData && regionData.locations && regionData.locations.length > 0)) return { ok: true, checked: 0 };
            const snapshot = h.stateManager.getLatestStateSnapshot();
            return actions.checkAccessibleLocationsInRegion(h, ctx.regionName,
                { originator: h.originators?.bulkCheck, snapshot, staticData });
        },
    },
    {
        id: BUILT_IN_IDS.check,
        owner: 'path',
        label: 'Check the location',
        target: 'location',
        kind: 'choice',
        choices: LOCATION_CHECK,
        choiceLabels: { now: 'Check it now', addToPath: 'Add the check to the path' },
        summary: (v) => ({ now: 'check', addToPath: 'add check to path' })[v] ?? null,
        order: ORDER.check,
        // graphInteractionManager.handleLocationNodeClick: the discovery gate first (it blocks the moves too); then
        // either "add to path" (the parent region's route, by the panel's REGION route setting, then the path check)
        // or one user:locationCheck.
        run: (h, ctx) => {
            if (checksBlocked(ctx)) return { ok: false, reason: 'checks-disabled' };
            if (ctx.value === 'addToPath') {
                const route = ctx.settings?.region?.[BUILT_IN_IDS.route];
                const moved = validRoute(route) ? routeTo(h, ctx.regionName, route, ctx.panelId) : null;
                const added = actions.addLocationCheckToPath(h, ctx.locationName, ctx.regionName);
                return { ...added, moved };
            }
            if (ctx.value === 'now') {
                return actions.checkLocation(h, { locationName: ctx.locationName, regionName: ctx.regionName,
                    originator: h.originators?.check });
            }
            return { ok: false, reason: 'invalid-choice' };
        },
    },
]);

function registerBuiltIns() {
    for (const d of BUILT_IN_ACTIONS) registerClickAction(d);
}
registerBuiltIns();

/** Tests only: drop every registration and put the built-ins back. */
export function resetClickActionsForTests() {
    registry.clear();
    seq = 0;
    registerBuiltIns();
    notifyChanged();
}

/* ── settings: the migration from the Region Graph's seven keys ──────── */

/**
 * The seven `moduleSettings.regionGraph.*` click keys and their defaults (`regionGraph/layoutControlsManager.js`'s
 * checkbox list, pinned by the tests).
 */
export const LEGACY_REGION_GRAPH_CLICK_DEFAULTS = Object.freeze({
    movePlayerOneStep: false,
    movePlayerDirectly: true,
    showRegionInPanel: true,
    addToPath: true,
    overwritePath: false,
    addLocationsToPath: false,
    checkAllLocationsInRegion: false,
});

/** The Regions panel's "open at the region" action id (registered by the Regions panel, CA-S4). */
export const REGIONS_OPEN_ID = 'regions.open';

/**
 * The one-time migration (design §4.4) from the seven booleans to a `clickActions` object, preserving today's
 * EFFECTIVE behaviour for every config with `movePlayerOneStep` false. A missing key takes its default.
 *   - addToPath → route from 'pathEnd'; else overwritePath → 'start'; else movePlayerDirectly → 'player'; all three
 *     off → the route is off (`false`).
 *   - ⚖ `movePlayerOneStep` is IGNORED (user, 2026-11-17T23:00:54Z: the option is removed): the answer is the one
 *     the same keys give with it false. Alone it migrates to the route OFF.
 *   - showRegionInPanel → `regions.open`; checkAllLocationsInRegion → `path.checkAll`;
 *     addLocationsToPath → location `path.check: 'addToPath'`, else 'now'.
 */
export function migrateRegionGraphClickKeys(old7 = {}) {
    const o = { ...LEGACY_REGION_GRAPH_CLICK_DEFAULTS };
    for (const k of Object.keys(LEGACY_REGION_GRAPH_CLICK_DEFAULTS)) {
        if (old7 && typeof old7[k] === 'boolean') o[k] = old7[k];
    }
    let route = false;
    if (o.addToPath) route = { from: 'pathEnd' };
    else if (o.overwritePath) route = { from: 'start' };
    else if (o.movePlayerDirectly) route = { from: 'player' };
    return {
        enabled: true,
        region: {
            [BUILT_IN_IDS.route]: route,
            [BUILT_IN_IDS.checkAll]: o.checkAllLocationsInRegion,
            [REGIONS_OPEN_ID]: o.showRegionInPanel,
        },
        location: {
            [BUILT_IN_IDS.check]: o.addLocationsToPath ? 'addToPath' : 'now',
        },
    };
}

/** The default `clickActions`: the migration of today's seven defaults. A fresh object each call. */
export function defaultClickActions() {
    return migrateRegionGraphClickKeys(LEGACY_REGION_GRAPH_CLICK_DEFAULTS);
}

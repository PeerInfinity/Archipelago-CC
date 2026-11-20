/**
 * ⛓ REGION ACTIONS — the moves, path edits and location checks a region view offers (region map step 2).
 *
 * ONE place for what a click on a region or a location DOES, so the Region Graph and the Region Map (step 3b) — and
 * the user's coming rethink of the Region Graph's click UI — share it. No Cytoscape, no DOM, no flashing: each action
 * returns a result (`{ ok: false, reason: 'no-path' }`, …) and the calling panel shows it its own way.
 *
 * HANDLES. Every action takes its collaborators explicitly — `h` = { dispatcher, eventBus, gameState, stateManager,
 * pathFinder, getRules?, restart? } — never a singleton. Which handles an action reads is named on it.
 *
 * ⚠ DISPATCHER SENDERS ARE PER MODULE. `dispatcher` is the calling module's own dispatcher
 * (`initializationApi.getDispatcher()`), and a dispatch goes out under THAT module's id; the module must have
 * registered the sender in its `register()`:
 *     registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
 *     registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
 * and, for `publishNodeSelected` / `showRegionInRegionsPanel`, its event-bus publishers:
 *     registrationApi.registerEventBusPublisher('ui:activatePanel');
 *     registrationApi.registerEventBusPublisher('ui:navigateToRegion');
 *     registrationApi.registerEventBusPublisher('<module>:nodeSelected');
 * The Region Graph does this in `regionGraph/index.js`. A second panel (the Region Map) registers its OWN senders
 * and passes its OWN dispatcher and event bus: moving the code here never moves a dispatch to another module id.
 *
 * ORIGINATOR / SOURCE STRINGS are the caller's: a `user:regionMove` carries `source`, a `user:locationCheck` carries
 * `originator`, and other code keys on them (see `regionGraph/regionGraphOriginators.js` for the Region Graph's and
 * the step 2 report for their readers). A new panel picks its own.
 */
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import { executeRegionMovePath, buildStepsFromRegionList } from '../shared/pathExecutor.js';
import { planRoute, isRestartStep } from '../procgenCore/restartRoute.js';
import { evaluateRule } from '../shared/ruleEngine.js';

/* ── where the player is ─────────────────────────────────────────────── */

/** The player's region, or null (no game state, or it threw — `onError(error)` hears it). Reads `h.gameState`. */
export function currentRegionOf(h, { onError = null } = {}) {
    try {
        return h.gameState ? h.gameState.getCurrentRegion() : null;
    } catch (e) {
        onError?.(e);
        return null;
    }
}

/** The primary start region: `stateManager.getStartRegions()[0]`, else the first static region, else null. */
export function primaryStartRegion(h) {
    const startRegions = h.stateManager.getStartRegions?.();
    if (Array.isArray(startRegions) && startRegions.length > 0) return startRegions[0];
    const staticData = h.stateManager.getStaticData?.();
    if (staticData && staticData.regions && staticData.regions.size > 0) return staticData.regions.keys().next().value;
    return null;
}

/** Is `regionName` a start region? Reads `h.stateManager`. */
export function isStartRegion(h, regionName) {
    const startRegions = h.stateManager.getStartRegions?.() || [];
    return startRegions.includes(regionName);
}

/**
 * The adjacency map `pathFinder.findExitBetweenRegions` reads, from the latest snapshot.
 * Reads `h.stateManager`, `h.pathFinder`.
 */
export function buildAdjacencyMap(h) {
    const staticData = h.stateManager.getStaticData();
    const snapshot = h.stateManager.getLatestStateSnapshot();
    const snapshotInterface = createSnapshotInterface(snapshot, staticData);
    return h.pathFinder.buildAccessibilityMap(staticData, snapshot, snapshotInterface);
}

/* ── moves ───────────────────────────────────────────────────────────── */

/**
 * Publish one `user:regionMove` — the payload a graph-based move sends. Reads `h.dispatcher`.
 * @param {object} move - { sourceRegion, targetRegion, exitName }
 * @param {string} source - the caller's source string (e.g. 'regionGraph-oneStep')
 */
export function publishRegionMove(h, move, source) {
    h.dispatcher.publish('user:regionMove', {
        sourceRegion: move.sourceRegion,
        sourceUID: undefined, // no specific UID for a graph-based move
        targetRegion: move.targetRegion,
        exitName: move.exitName,
        updatePath: false,
        source,
    }, 'bottom');
}

/**
 * ⛓ RETURN TO MENU (procgenCore/restartRoute.js) — when the route from `from` to `to` begins with RESTART (no walk,
 * the slot declares `return_to_menu`, a walk from the restart target), take the Menu panel's Restart.
 * → { ok: true, region } (the restart target) | { ok: false }.
 * Reads `h.pathFinder`, `h.getRules()` → { rules, playerId } and `h.restart()` (the Menu panel's restart, or null).
 */
export function takeRestartStep(h, from, to) {
    const { rules = null, playerId = '1' } = h.getRules?.() ?? {};
    const { route } = planRoute({
        from,
        to,
        findPath: (a, b) => h.pathFinder.findPathWithExits(a, b),
        rules,
        playerId,
    });
    if (!route || !isRestartStep(route.steps[1])) return { ok: false };
    const result = h.restart?.();
    if (!result) return { ok: false };
    return { ok: true, region: route.steps[1].region };
}

/**
 * Plan a DIRECT move to `target`: the path's final exit, taken from its second-to-last region.
 * → { ok: false, reason: 'no-current' | 'already-there' | 'no-path' | 'no-final-exit', from? }
 *   | { ok: true, kind: 'move', from, path, move }
 * Reads `h.gameState`, `h.pathFinder` (and its `stateManager`).
 */
export function planDirectMove(h, target, { onError = null } = {}) {
    const from = currentRegionOf(h, { onError });
    if (!from) return { ok: false, reason: 'no-current' };
    if (from === target) return { ok: false, reason: 'already-there', from };
    const path = h.pathFinder.findPath(from, target);
    if (!path || path.length === 0) return { ok: false, reason: 'no-path', from };
    const finalSourceRegion = path.steps[path.steps.length - 2];
    const sm = h.pathFinder.stateManager;
    const staticData = sm.getStaticData();
    const snapshot = sm.getLatestStateSnapshot();
    const snapshotInterface = createSnapshotInterface(snapshot, staticData);
    const adjacencyMap = h.pathFinder.buildAccessibilityMap(staticData, snapshot, snapshotInterface);
    const exitName = h.pathFinder.findExitBetweenRegions(finalSourceRegion, target, adjacencyMap);
    if (!exitName) return { ok: false, reason: 'no-final-exit', from, path };
    return { ok: true, kind: 'move', from, path, move: { sourceRegion: finalSourceRegion, targetRegion: target, exitName } };
}

/* ── path edits ──────────────────────────────────────────────────────── */

/**
 * Extend the game-state path to `target`. With no path yet, publish one `user:regionMove` and let gameState build
 * it. Else walk from the path's last region, all the way (⚖ no "one step", user 2026-11-17; its option and the
 * one-step moves left this file in CA-S3 with their last caller, the Region Map's interim click reader).
 * → { ok: false, reason: 'already-there' | 'no-path', from? }
 *   | { ok: true, kind: 'single', from }                 (no path yet: one move published)
 *   | { ok: true, kind: 'path', from, dispatched, regions }
 * `beforeExecute()` runs after a path is found, before any step is dispatched (the Region Graph turns the Regions
 * panel's "Show All Regions" off there). Reads `h.gameState`, `h.dispatcher`, `h.pathFinder`, `h.stateManager`.
 */
export function addToPath(h, target, { source, beforeExecute = null } = {}) {
    const gameState = h.gameState;
    const currentPath = gameState.getPath();
    if (!currentPath || currentPath.length === 0) {
        const currentRegion = gameState.getCurrentRegion();
        if (currentRegion === target) return { ok: false, reason: 'already-there', from: currentRegion };
        h.dispatcher.publish('user:regionMove', {
            targetRegion: target,
            sourceRegion: currentRegion,
            source,
        }, { initialTarget: 'bottom' });
        return { ok: true, kind: 'single', from: currentRegion };
    }
    const from = gameState.getLastRegionInPath() || gameState.getCurrentRegion();
    if (from === target) return { ok: false, reason: 'already-there', from };
    return walkAndDispatch(h, from, target, { source, beforeExecute });
}

/**
 * Reset the player to the primary start region, trim the path back to it, then walk to `target`.
 * → { ok: false, reason: 'already-there' | 'no-path', from } | { ok: true, kind: 'path', from, dispatched, regions }
 * `beforeExecute()` runs right after the reset (before the walk is planned) — the Region Graph's ordering.
 * Reads `h.gameState`, `h.dispatcher`, `h.pathFinder`, `h.stateManager`.
 */
export function overwritePath(h, target, { source, beforeExecute = null } = {}) {
    const from = primaryStartRegion(h);
    h.gameState.setCurrentRegion(from);
    h.gameState.trimPath(from, 1);
    beforeExecute?.();
    if (from === target) return { ok: false, reason: 'already-there', from };
    return walkAndDispatch(h, from, target, { source });
}

function walkAndDispatch(h, from, target, { source, beforeExecute = null }) {
    const path = h.pathFinder.findPath(from, target);
    if (!path || path.length === 0) return { ok: false, reason: 'no-path', from };
    beforeExecute?.();
    // path.steps[0] is the start; the rest are the regions moved through.
    const regions = path.steps.slice(1);
    const adjacencyMap = buildAdjacencyMap(h);
    const steps = buildStepsFromRegionList({
        startRegion: from,
        regions,
        findExit: (s, t) => h.pathFinder.findExitBetweenRegions(s, t, adjacencyMap),
    });
    const dispatched = executeRegionMovePath({
        steps,
        dispatcher: h.dispatcher,
        gameState: h.gameState, // sync updatePath per step
        source,
    });
    return { ok: true, kind: 'path', from, dispatched, regions };
}

/* ── location checks ─────────────────────────────────────────────────── */

/**
 * May the view check locations? False only when discovery is on and its `disableLocationCheckUI` is set.
 * @param {object} discovery - { active, settings }
 */
export function locationChecksAllowed({ active = false, settings = {} } = {}) {
    return !(active && settings?.disableLocationCheckUI);
}

/**
 * Publish one `user:locationCheck` under `originator`. Reads `h.dispatcher`.
 * → { ok: true } | { ok: false, reason: 'no-dispatcher' }
 */
export function checkLocation(h, { locationName, regionName, originator }) {
    if (!h.dispatcher) return { ok: false, reason: 'no-dispatcher' };
    h.dispatcher.publish('user:locationCheck', {
        locationName,
        regionName,
        originator,
        originalDOMEvent: true,
    }, {
        initialTarget: 'bottom',
    });
    return { ok: true };
}

/**
 * The locations of `regionName` a bulk check would check: not checked yet, and accessible by their own rule.
 * ⚠ No region-reachability test: the Region Graph's bulk check never had one (a rule-less location in an
 * unreachable region is listed). `snapshot` / `staticData` default to the latest. A rule that THROWS propagates.
 */
export function bulkCheckCandidates(h, regionName, { snapshot = null, staticData = null } = {}) {
    const sd = staticData ?? h.stateManager.getStaticData();
    const regionData = sd?.regions?.get(regionName);
    if (!regionData || !regionData.locations || regionData.locations.length === 0) return [];
    const snap = snapshot ?? h.stateManager.getLatestStateSnapshot();
    const snapshotInterface = createSnapshotInterface(snap, sd);
    const checked = new Set(snap.checkedLocations || []);
    const out = [];
    for (const location of regionData.locations) {
        if (checked.has(location.name)) continue;
        const ok = location.access_rule ? evaluateRule(location.access_rule, snapshotInterface) : true;
        if (ok) out.push(location.name);
    }
    return out;
}

/** Check every `bulkCheckCandidates` location under `originator`. → { ok: true, checked: n } */
export function checkAccessibleLocationsInRegion(h, regionName, { originator, snapshot = null, staticData = null } = {}) {
    let checked = 0;
    for (const locationName of bulkCheckCandidates(h, regionName, { snapshot, staticData })) {
        if (checkLocation(h, { locationName, regionName, originator }).ok) checked++;
    }
    return { ok: true, checked };
}

/** Add a location check to the game-state path (the "Add locations to path" option). Reads `h.gameState`. */
export function addLocationCheckToPath(h, locationName, regionName) {
    h.gameState.addLocationCheck(locationName, regionName);
    return { ok: true };
}

/* ── select / show ───────────────────────────────────────────────────── */

/** Publish `<event>` = { nodeId, data } (the Region Graph's is 'regionGraph:nodeSelected'). Reads `h.eventBus`. */
export function publishNodeSelected(h, event, regionName, data) {
    h.eventBus.publish(event, { nodeId: regionName, data });
}

/** Activate the Regions panel and navigate it to `regionName`. Reads `h.eventBus`. */
export function showRegionInRegionsPanel(h, regionName) {
    h.eventBus.publish('ui:activatePanel', { panelId: 'regionsPanel' });
    h.eventBus.publish('ui:navigateToRegion', { regionName });
}

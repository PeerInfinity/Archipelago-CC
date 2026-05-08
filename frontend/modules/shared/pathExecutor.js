/**
 * pathExecutor.js — shared utility for emitting a sequence of
 * `user:regionMove` events to walk a path through the region graph.
 *
 * Three modules build paths and execute them:
 *   - regionGraph/navigationManager.addToPath     (extends current path)
 *   - regionGraph/navigationManager.overwritePath (resets and rebuilds)
 *   - loops/costGenerator._processLocationEntry   (cost-gen playback)
 *
 * They differ in HOW they construct the step list (raw region names
 * + adjacency lookup vs. pre-computed {region, exitUsed} pairs from
 * findPathWithExits) but the dispatch loop is identical:
 *
 *   for each (sourceRegion, targetRegion, exitName):
 *     [optionally] gameState.updatePath(targetRegion, exitName, sourceRegion)
 *     dispatcher.publish('user:regionMove', { ... }, { initialTarget: 'bottom' })
 *
 * Callers pass their already-resolved `steps` array; this helper owns
 * only the dispatch loop. The `gameState` parameter is optional —
 * regionGraph calls updatePath synchronously per step (so subsequent
 * steps see the updated path), then dispatches with `updatePath: false`.
 * Cost generator dispatches with `updatePath: true` and lets a
 * downstream handler do the path mutation.
 */

/**
 * @typedef {Object} RegionMoveStep
 * @property {string} sourceRegion
 * @property {string} targetRegion
 * @property {string} exitName
 */

/**
 * Emit a sequence of `user:regionMove` events for a sequence of moves.
 *
 * @param {Object} args
 * @param {RegionMoveStep[]} args.steps - The moves to execute, in order.
 * @param {{ publish: Function }} args.dispatcher - Module-bound dispatcher
 *   (the object returned by initializationApi.getDispatcher()). Its
 *   `publish(eventName, data, options)` signature is the per-module
 *   wrapper around dispatcher.publish; the moduleId is already bound.
 * @param {string} args.source - Tag for the event payload's `source`
 *   field (e.g. 'regionGraph-addToPath') used by downstream handlers
 *   for telemetry/branching.
 * @param {Object} [args.gameState=null] - When provided, calls
 *   `gameState.updatePath(targetRegion, exitName, sourceRegion)`
 *   synchronously per step before dispatching the event. The dispatched
 *   event payload then carries `updatePath: false` so downstream
 *   handlers don't re-apply the change.
 * @param {'top'|'bottom'} [args.initialTarget='bottom'] - Forwarded to
 *   the dispatcher's options. Loop-mode and graph-driven moves want
 *   `'bottom'` so high-load-priority modules (procgenPlayer etc.) see
 *   the event.
 * @returns {number} The number of steps dispatched.
 */
export function executeRegionMovePath({
  steps,
  dispatcher,
  source,
  gameState = null,
  initialTarget = 'bottom',
}) {
  if (!dispatcher || typeof dispatcher.publish !== 'function') {
    return 0;
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return 0;
  }

  let dispatched = 0;
  for (const step of steps) {
    if (gameState && typeof gameState.updatePath === 'function') {
      gameState.updatePath(step.targetRegion, step.exitName, step.sourceRegion);
    }
    dispatcher.publish('user:regionMove', {
      sourceRegion: step.sourceRegion,
      targetRegion: step.targetRegion,
      exitName: step.exitName,
      updatePath: !gameState,
      source,
    }, { initialTarget });
    dispatched++;
  }
  return dispatched;
}

/**
 * Build a canonical {sourceRegion, targetRegion, exitName} step list
 * from a sequence of region names plus an exit lookup. Used by
 * regionGraph callers whose `pathFinder.findPath` returns just region
 * names; the cost generator's `pathFinder.findPathWithExits` already
 * yields steps with exits attached, so it constructs steps directly.
 *
 * @param {Object} args
 * @param {string} args.startRegion - Region the player is in BEFORE
 *   the first step in `regions` runs.
 * @param {string[]} args.regions - Target regions, in order. Each
 *   element becomes the targetRegion of one step; the previous
 *   element (or startRegion for index 0) becomes its sourceRegion.
 * @param {(source: string, target: string) => string|null} args.findExit -
 *   Lookup function, typically a closure over the pathFinder + adjacency
 *   map. Returns the exit name connecting source → target, or null.
 * @returns {RegionMoveStep[]}
 */
export function buildStepsFromRegionList({ startRegion, regions, findExit }) {
  if (!Array.isArray(regions) || regions.length === 0) return [];
  return regions.map((targetRegion, index) => {
    const sourceRegion = index === 0 ? startRegion : regions[index - 1];
    return {
      sourceRegion,
      targetRegion,
      exitName: findExit(sourceRegion, targetRegion),
    };
  });
}

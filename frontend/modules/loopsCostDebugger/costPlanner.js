/**
 * `loopsCostDebugger/costPlanner.js` — **THE APP-SIDE DRIVER of the one cost
 * algorithm.** The algorithm itself is `shared/procgen/loopCostPlanner.js`.
 *
 * ── ⚖ WHAT MOVED, AND WHY THIS FILE STILL EXISTS ──────────────────────
 *
 * This class WAS the algorithm — 1,288 lines of it — and the procgen pipeline
 * had a different one. ⚖ The user ruled (2026-09-06) *"Let's make the planner
 * the official algorithm"*, so `SimulatedState`, the explore/check/defaults
 * state machine, the sphere-log slice extraction and the rejection contract all
 * moved into `shared/procgen/loopCostPlanner.js`, where `generateLoopCosts` can
 * call them too. `check-loop-costs-one-model.mjs` proves the pipeline's block
 * and this planner's plan are the same bytes.
 *
 * What is LEFT here is everything the shared module must not know:
 *
 *   • a **state manager** — the constructor argument H5 swaps to plan a WORKING
 *     COPY the app has never applied (`documentStateManager.js`). The shared
 *     core reads a TOPOLOGY; this subclass is what turns `getStaticData()` +
 *     `getLatestStateSnapshot()` into one, and re-reads it on every load/reset
 *     so a rules reload is picked up.
 *   • the **player id** resolution through `centralRegistry`'s sphereState.
 *   • **which substrate a region has** — `procgenPlayer.getRegionInfo`, the
 *     runtime's own answer. The shared core cannot ask; the write-by-class rule
 *     needs it.
 *   • `getCostData()`, which applies **write-by-class** so the store receives
 *     exactly the block the pipeline would have embedded.
 *
 * ⛔ Everything else is INHERITED. Do not re-add a method here that the shared
 * core already has — that is how the two models diverged the first time.
 */

import { centralRegistry } from '../../app/core/centralRegistry.js';
import {
  CostPlanner as SharedCostPlanner,
  topologyFromStaticData,
} from '../shared/procgen/loopCostPlanner.js';
import {
  writeCostsByClass,
  classifyRegions,
  DEFAULT_REGION_COST,
  DEFAULT_LOCATION_COST,
  DEFAULT_REGION_XP_EFFECT,
} from '../shared/procgen/loopCostGenerator.js';

export class CostPlanner extends SharedCostPlanner {
  constructor({ stateManager, eventBus } = {}) {
    super({ eventBus });
    this.stateManager = stateManager;

    /**
     * ⛓ H5 — the slot this planner is about, when a caller KNOWS it. Null =
     * ask sphereState, which is what the applied-state path has always done.
     */
    this._playerIdOverride = null;
  }

  /**
   * ⛓⛓⛓ APWORLD EDITOR HUB slice H5 — **PLAN AGAINST A DIFFERENT WORLD.**
   * The state manager was a constructor argument and nothing else in this class
   * assumes it is the app's; swapping it is how the panel plans a WORKING COPY
   * the app has never applied (`loopsCostDebugger/documentStateManager.js`).
   *
   * ⛔ **IT DROPS THE LOADED PLAN, and that is not tidiness.** Every planned
   * step names regions and locations of the world it was planned against; a
   * planner that kept them while its topology changed underneath would show a
   * plan through a world that is no longer there. `isLoaded()` goes false, the
   * panel's Load is how a person opts back in.
   *
   * ⚠ `playerId` OVERRIDES sphereState. `_resolvePlayerId` asks the app's
   * sphereState first, which is right for applied state and wrong for a working
   * copy: the document names its own slot and the app may be holding a
   * different world entirely.
   */
  useStateManager(stateManager, { playerId = null } = {}) {
    this.stateManager = stateManager;
    this._playerIdOverride = playerId === null || playerId === undefined
      ? null : String(playerId);
    this.setTopology(this._buildTopology());
  }

  /** @private Rebuild the topology from the CURRENT state manager. */
  _buildTopology() {
    const staticData = this.stateManager?.getStaticData?.() ?? null;
    const snapshot = this.stateManager?.getLatestStateSnapshot?.() ?? null;
    return topologyFromStaticData(staticData, snapshot, {
      regionSubstrates: this._resolveRegionSubstrates(staticData),
    });
  }

  /**
   * The shared core's hook: re-derive the topology before every plan and reset,
   * so a player switch or a rules reload is picked up instead of replanning
   * against the previous world.
   * @private
   */
  _refreshTopology() {
    this._topology = this._buildTopology();
  }

  /**
   * ⛓ **REGION → SUBSTRATE, the runtime's own answer.** `getStaticData()` does
   * not carry `preset_sidecars`; the app resolves a region's substrate through
   * `procgenPlayer.getRegionInfo`, which is exactly what
   * `loopState._lookupSubstrateId` calls. A working copy hands the map over
   * directly instead (`documentStateManager` exposes `regionSubstrates`),
   * because the app may be holding a different world entirely.
   *
   * An empty map ⇒ every region classifies COARSE, which is what this planner
   * did before write-by-class existed and is the safe direction.
   * @private
   */
  _resolveRegionSubstrates(staticData) {
    const supplied = this.stateManager?.regionSubstrates;
    if (supplied instanceof Map) return supplied;

    const out = new Map();
    if (!staticData?.regions) return out;
    let getRegionInfo = null;
    try {
      getRegionInfo = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
    } catch { /* registry unavailable — every region is coarse */ }
    if (typeof getRegionInfo !== 'function') return out;
    for (const regionName of staticData.regions.keys()) {
      try {
        const id = getRegionInfo(regionName)?.substrate;
        if (id) out.set(regionName, id);
      } catch { /* one bad region must not lose the rest */ }
    }
    return out;
  }

  /**
   * The player whose slice of the sphere log is being planned.
   * sphereState learns the id from `stateManager:rulesLoaded` even when no
   * sphere log is present; staticData.playerId is the same value stamped by
   * the state manager, kept as a fallback for callers that run before
   * sphereState is up. Returns null rather than defaulting to player 1 —
   * planning the wrong slice fails silently, an unset id must not.
   * @returns {string|null}
   */
  _resolvePlayerId() {
    // ⛓ H5 — a caller that KNOWS the slot wins over sphereState: a working copy
    //   names its own, and sphereState's belongs to the applied world.
    if (this._playerIdOverride) return this._playerIdOverride;
    const getIdFn = centralRegistry.getPublicFunction('sphereState', 'getCurrentPlayerId');
    const id = getIdFn?.();
    if (id) return String(id);

    const fromStatic = this.stateManager?.getStaticData?.()?.playerId;
    return fromStatic ? String(fromStatic) : null;
  }

  /**
   * The planned costs as the `loop_costs` BLOCK — **write-by-class applied**,
   * so what the Loops panel's Generate Costs stamps into the store is exactly
   * what the procgen pipeline would have embedded for the same world (⚖ 2026-
   * 09-06, one algorithm and one block). The raw plan, with every region priced,
   * is `super.getCostData()`.
   */
  getCostData() {
    const raw = super.getCostData();
    if (!raw) return null;

    const topology = this._topology;
    const { regions, locations } = writeCostsByClass(raw, {
      topology,
      regionClasses: classifyRegions(topology),
      xpEffect: DEFAULT_REGION_XP_EFFECT,
    });

    return {
      version: '1.0',
      generatedAt: raw.generatedAt,
      generatedFrom: 'loopsCostDebugger',
      regions,
      locations,
      defaultRegionCost: DEFAULT_REGION_COST,
      defaultLocationCost: DEFAULT_LOCATION_COST,
      defaultRegionXpEffect: DEFAULT_REGION_XP_EFFECT,
    };
  }
}

export default CostPlanner;

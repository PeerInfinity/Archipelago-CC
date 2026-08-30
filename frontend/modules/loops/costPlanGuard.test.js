/**
 * The headless cost-generation path: LoopUI._handleGenerateCostsInline runs the
 * loopsCostDebugger's CostPlanner and stamps the result into the LIVE cost
 * store. A player/seed mismatch plans zero entries and still yields a complete
 * defaults-only cost set, which is indistinguishable from a real one once it is
 * in the store — so the planner's refusal has to be honoured here.
 *
 * Only the guard is under test; the planner is a double, and the full planning
 * walk is covered by loopsCostDebugger/costPlanner.test.js.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const costDataManager = {
  setCalls: [],
  setCostData(data, source) { this.setCalls.push({ data, source }); return true; },
  getCostData() { return null; },
  isLoaded() { return false; },
};

vi.mock('./index.js', () => ({
  getCostDataManager: () => costDataManager,
  getGameStateAPI: () => null,
  getLoopsModuleDispatcher: () => ({ publish: () => {} }),
  getModuleEventBus: () => ({ publish: () => {}, subscribe: () => () => {} }),
  getPathFinder: () => null,
  moduleInfo: { name: 'loops' },
}));

const { LoopUI } = await import('./loopUI.js');
const { centralRegistry } = await import('../../app/core/centralRegistry.js');

/** Minimal planner double: only what _handleGenerateCostsInline touches. */
function makePlannerDouble({ entryCount = 1, rejection = null } = {}) {
  return {
    resetCalls: 0,
    reset() { this.resetCalls++; },
    loadSphereLog: () => ({ entryCount, playerId: '1' }),
    getPlanRejectionReason: () => rejection,
    getTotalEntries: () => entryCount,
    _planned: false,
    isComplete() { return this._planned; },
    planNextStep() {
      if (this._planned) return null;
      this._planned = true;
      return { sphereIndex: 1, sphereEntryIndex: 0, stepIndex: 1 };
    },
    getCostData: () => ({ regions: { Menu: { moveCost: 0 } }, locations: { L: 5 } }),
  };
}

/** A `this` for the prototype method — no GoldenLayout, no DOM. */
function makeUiDouble() {
  const elements = new Map();
  return {
    renderCalls: 0,
    published: [],
    isLoopModeActive: false,
    eventBus: { publish(name, data) { this.owner.published.push({ name, data }); } },
    rootElement: {
      // The refusal path only reads/writes style + disabled on these.
      querySelector(sel) {
        if (!elements.has(sel)) elements.set(sel, { style: {}, disabled: false, textContent: '' });
        return elements.get(sel);
      },
    },
    elements,
    renderLoopPanel() { this.renderCalls++; },
    _handleGenerateCostsInline: LoopUI.prototype._handleGenerateCostsInline,
    _reportCostGenerationRefusal: LoopUI.prototype._reportCostGenerationRefusal,
  };
}

function registerPlanner(planner, sphereLog) {
  centralRegistry.publicFunctions.delete('loopsCostDebugger');
  centralRegistry.registerPublicFunction('loopsCostDebugger', 'getCostPlanner', () => planner);
  centralRegistry.registerPublicFunction('loopsCostDebugger', 'getSphereLog', () => sphereLog);
}

const SPHERE_LOG = [{ type: 'state_update', sphere_index: 1, player_data: { 1: {} } }];

describe('LoopUI._handleGenerateCostsInline — mismatch guard', () => {
  beforeEach(() => { costDataManager.setCalls = []; });
  afterEach(() => centralRegistry.publicFunctions.delete('loopsCostDebugger'));

  it('stamps the live cost store for a legitimate plan', async () => {
    registerPlanner(makePlannerDouble({ entryCount: 3 }), SPHERE_LOG);
    const ui = makeUiDouble();
    ui.eventBus.owner = ui;

    await ui._handleGenerateCostsInline();

    expect(costDataManager.setCalls.length).toBe(1);
    expect(costDataManager.setCalls[0].source).toBe('costPlanner');
    expect(ui.published.map(p => p.name)).toContain('loops:setLoopMode');
  });

  it('refuses to stamp when the log has no slice for this player', async () => {
    registerPlanner(
      makePlannerDouble({ entryCount: 0, rejection: 'Sphere log has no data for player 3' }),
      SPHERE_LOG
    );
    const ui = makeUiDouble();
    ui.eventBus.owner = ui;

    await ui._handleGenerateCostsInline();

    expect(costDataManager.setCalls).toEqual([]);
    // Loop mode is NOT entered on a refusal.
    expect(ui.published).toEqual([]);
    const label = ui.elements.get('#loop-ui-cost-progress-label');
    expect(label.textContent).toContain('Cost generation refused');
    expect(label.textContent).toContain('no data for player 3');
    // The prompt stays usable so Accept Defaults is still reachable.
    expect(ui.elements.get('#loop-ui-generate-costs-inline').disabled).toBe(false);
    expect(ui.elements.get('#loop-ui-accept-defaults').disabled).toBe(false);
  });

  it('refuses AFTER planning when every location turns out to be foreign', async () => {
    // entryCount > 0, so the early check passes; the reason only appears once
    // the entries have been walked.
    const planner = makePlannerDouble({ entryCount: 4 });
    let planned = false;
    planner.getPlanRejectionReason = () =>
      (planned ? "All 4 sphere-log locations are missing from this player's world" : null);
    const realPlanNextStep = planner.planNextStep.bind(planner);
    planner.planNextStep = () => { planned = true; return realPlanNextStep(); };
    registerPlanner(planner, SPHERE_LOG);

    const ui = makeUiDouble();
    ui.eventBus.owner = ui;

    await ui._handleGenerateCostsInline();

    expect(costDataManager.setCalls).toEqual([]);
    expect(ui.elements.get('#loop-ui-cost-progress-label').textContent)
      .toContain('missing from this player');
  });
});

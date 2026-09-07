/**
 * The free-by-rule start-region move, at the two DISPLAY pricers inside
 * `loops/` — ⚖ user ruling 2026-09-06, model (A).
 *
 * There are FOUR sites that price a `regionMove` out of a region, and they must
 * not disagree about a NUMBER:
 *   - `loopState._calculateActionCost` — the one that CHARGES (rows in
 *     `loopState.test.js`);
 *   - `shared/queueAnalysis.getBaseCost` — the queue analysis the Loops panel
 *     and the Loop Stats panel both render from (rows in
 *     `shared/queueAnalysis.test.js`);
 *   - `loopUI._estimateActionCost` — the current-action display and the
 *     per-entry cost badge;
 *   - `loopBlockBuilder._exitMoveCost` — the region block's per-exit cost label,
 *     the visible "what does leaving Menu cost" readout.
 * The last two are here. All four read `START_REGION_MOVE_COST`.
 *
 * ⚠ `_exitMoveCost` was extracted out of `addExits` to be reachable at all: the
 * vitest environment is `node` and jsdom is not in the tree, so no row can drive
 * the DOM that renders the label. The in-app measurement covers that half.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const store = vi.hoisted(() => ({ loaded: true, regionCost: 50 }));

vi.mock('./index.js', () => ({
  getCostDataManager: () => ({
    isLoaded: () => store.loaded,
    getRegionCost: () => store.regionCost,
    getLocationCost: () => 10,
    getRegionXpEffect: () => 'cost',
  }),
  getGameStateAPI: () => null,
  getLoopsModuleDispatcher: () => null,
  getModuleEventBus: () => null,
}));

const { LoopUI } = await import('./loopUI.js');
const { LoopBlockBuilder } = await import('./loopBlockBuilder.js');
const loopState = (await import('./loopStateSingleton.js')).default;
const { GameState } = await import('../gameState/state.js');
const { DEFAULT_REGION_COST, START_REGION_MOVE_COST } =
  await import('../shared/procgen/loopCostGenerator.js');

const estimate = (action) => LoopUI.prototype._estimateActionCost.call(null, action);
const exitCost = (regionName) => new LoopBlockBuilder({})._exitMoveCost(regionName);

const move = (sourceRegion) => ({
  type: 'regionMove', sourceRegion, destinationRegion: 'A', exitUsed: 'to_a',
});

describe('the start-region move is free at the display pricers too', () => {
  let savedGameState;
  let savedInstance;

  beforeEach(() => {
    store.loaded = true;
    store.regionCost = DEFAULT_REGION_COST;
    // The singleton is shared across files in a run — save and restore.
    savedGameState = loopState.gameState;
    savedInstance = loopState._gameStateInstance;
    const gs = new GameState({ publish: () => {} });
    gs.setStartRegions(['Menu']);
    loopState._gameStateInstance = gs;
    loopState.gameState = {
      getState: () => gs,
      isStartRegion: (r) => gs.isStartRegion(r),
    };
  });

  afterEach(() => {
    loopState.gameState = savedGameState;
    loopState._gameStateInstance = savedInstance;
  });

  describe('loopUI._estimateActionCost', () => {
    it('estimates the start-region move at START_REGION_MOVE_COST, block or no block', () => {
      expect(estimate(move('Menu'))).toBe(START_REGION_MOVE_COST);
      store.loaded = false;
      expect(estimate(move('Menu'))).toBe(START_REGION_MOVE_COST);
    });

    it('leaves a NON-start move at the block price, and at the fallback with no block', () => {
      expect(estimate(move('A'))).toBe(DEFAULT_REGION_COST);
      store.loaded = false;
      expect(estimate(move('A'))).toBe(DEFAULT_REGION_COST);
    });

    it('does not free an explore in the start region', () => {
      expect(estimate({ type: 'customAction', actionName: 'explore', sourceRegion: 'Menu' }))
        .toBe(DEFAULT_REGION_COST * 2);
    });
  });

  describe('loopBlockBuilder._exitMoveCost — the per-exit label', () => {
    it("reads 0 for a start region's exit even though the block prices it 50", () => {
      expect(store.regionCost).toBe(50);
      expect(exitCost('Menu')).toBe(START_REGION_MOVE_COST);
      expect(exitCost('Menu').toFixed(1)).toBe('0.0');
    });

    it('reads the block price for a non-start region', () => {
      expect(exitCost('A')).toBe(50);
      expect(exitCost('A').toFixed(1)).toBe('50.0');
    });

    it('falls back to DEFAULT_REGION_COST, not a typed 50, when no block is loaded', () => {
      store.loaded = false;
      expect(exitCost('A')).toBe(DEFAULT_REGION_COST);
      expect(exitCost('Menu')).toBe(START_REGION_MOVE_COST);
    });

    it('stays 0 under an XP discount on the start region', () => {
      loopState.addRegionXP('Menu', 500);
      expect(loopState.getRegionXP('Menu').level).toBeGreaterThan(0);
      expect(exitCost('Menu')).toBe(0);
    });
  });
});

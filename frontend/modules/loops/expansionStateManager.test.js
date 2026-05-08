/**
 * Tests for ExpansionStateManager — the per-region/per-action collapse
 * tracking the loops panel uses to keep blocks open across re-renders.
 *
 * Pure logic, no DOM, no event bus.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ExpansionStateManager } from './expansionStateManager.js';

describe('ExpansionStateManager', () => {
  let mgr;
  beforeEach(() => {
    mgr = new ExpansionStateManager();
  });

  describe('region expansion', () => {
    it('starts with everything collapsed', () => {
      expect(mgr.isRegionExpanded('Forest')).toBe(false);
      expect(mgr.isRegionExpanded('Forest', 2)).toBe(false);
    });

    it('setRegionExpanded(true) and isRegionExpanded round-trip', () => {
      mgr.setRegionExpanded('Forest', true);
      expect(mgr.isRegionExpanded('Forest')).toBe(true);
    });

    it('setRegionExpanded(false) removes expansion', () => {
      mgr.setRegionExpanded('Forest', true);
      mgr.setRegionExpanded('Forest', false);
      expect(mgr.isRegionExpanded('Forest')).toBe(false);
    });

    it('different instanceNumbers are independent (revisits get their own block)', () => {
      mgr.setRegionExpanded('Forest', true, 1);
      expect(mgr.isRegionExpanded('Forest', 1)).toBe(true);
      expect(mgr.isRegionExpanded('Forest', 2)).toBe(false);

      mgr.setRegionExpanded('Forest', true, 2);
      mgr.setRegionExpanded('Forest', false, 1);
      expect(mgr.isRegionExpanded('Forest', 1)).toBe(false);
      expect(mgr.isRegionExpanded('Forest', 2)).toBe(true);
    });

    it('default instanceNumber is 1 across set/is/toggle', () => {
      mgr.setRegionExpanded('Forest', true);
      expect(mgr.isRegionExpanded('Forest', 1)).toBe(true);
      mgr.toggleRegion('Forest');
      expect(mgr.isRegionExpanded('Forest', 1)).toBe(false);
    });

    it('instanceNumber=0 falls back to 1 (regionKey treats falsy as 1)', () => {
      // The constructor's regionKey() helper does `instanceNumber || 1`
      // — both calls below resolve to the same key.
      mgr.setRegionExpanded('Forest', true, 0);
      expect(mgr.isRegionExpanded('Forest', 1)).toBe(true);
    });

    it('toggleRegion returns the new state', () => {
      expect(mgr.toggleRegion('Forest')).toBe(true);
      expect(mgr.isRegionExpanded('Forest')).toBe(true);
      expect(mgr.toggleRegion('Forest')).toBe(false);
      expect(mgr.isRegionExpanded('Forest')).toBe(false);
    });
  });

  describe('action expansion', () => {
    it('isActionExpanded false by default', () => {
      expect(mgr.isActionExpanded('action-1')).toBe(false);
    });

    it('setActionExpanded round-trips', () => {
      mgr.setActionExpanded('action-1', true);
      expect(mgr.isActionExpanded('action-1')).toBe(true);
      mgr.setActionExpanded('action-1', false);
      expect(mgr.isActionExpanded('action-1')).toBe(false);
    });

    it('toggleAction returns the new state and flips it', () => {
      expect(mgr.toggleAction('action-1')).toBe(true);
      expect(mgr.toggleAction('action-1')).toBe(false);
    });

    it('action expansion is independent of region expansion', () => {
      mgr.setRegionExpanded('Forest', true);
      mgr.setActionExpanded('action-1', true);
      mgr.collapseAll();
      // collapseAll only touches regions; actions stay.
      expect(mgr.isActionExpanded('action-1')).toBe(true);
      expect(mgr.isRegionExpanded('Forest')).toBe(false);
    });
  });

  describe('expandAll / collapseAll / clear', () => {
    it('expandAll sets every visit expanded', () => {
      mgr.expandAll([
        { name: 'A', instance: 1 },
        { name: 'A', instance: 2 },
        { name: 'B', instance: 1 },
      ]);
      expect(mgr.isRegionExpanded('A', 1)).toBe(true);
      expect(mgr.isRegionExpanded('A', 2)).toBe(true);
      expect(mgr.isRegionExpanded('B', 1)).toBe(true);
    });

    it('expandAll on an empty list is a no-op', () => {
      expect(() => mgr.expandAll([])).not.toThrow();
      expect(mgr.getDebugState().regions).toEqual([]);
    });

    it('collapseAll clears regions only', () => {
      mgr.setRegionExpanded('A', true);
      mgr.setActionExpanded('act', true);
      mgr.collapseAll();
      expect(mgr.isRegionExpanded('A')).toBe(false);
      expect(mgr.isActionExpanded('act')).toBe(true);
    });

    it('clear() clears both regions and actions', () => {
      mgr.setRegionExpanded('A', true);
      mgr.setActionExpanded('act', true);
      mgr.clear();
      expect(mgr.isRegionExpanded('A')).toBe(false);
      expect(mgr.isActionExpanded('act')).toBe(false);
    });
  });

  describe('getDebugState', () => {
    it('returns serializable arrays of current state', () => {
      mgr.setRegionExpanded('A', true, 1);
      mgr.setRegionExpanded('B', true, 3);
      mgr.setActionExpanded('act-1', true);
      const state = mgr.getDebugState();
      expect(state.regions.sort()).toEqual(['A#1', 'B#3']);
      expect(state.actions).toEqual(['act-1']);
    });
  });
});

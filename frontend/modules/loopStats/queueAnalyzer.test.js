/**
 * Unit tests for QueueAnalyzer
 * Uses Vitest for testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueueAnalyzer } from './queueAnalyzer.js';

describe('QueueAnalyzer', () => {
  let analyzer;
  let mockLoopState;

  beforeEach(() => {
    analyzer = new QueueAnalyzer();

    // Create mock loopState
    mockLoopState = {
      currentMana: 100,
      maxMana: 100,
      regionXP: new Map(),
      getRegionXP: function(regionName) {
        if (!this.regionXP.has(regionName)) {
          this.regionXP.set(regionName, { level: 0, xp: 0, xpForNextLevel: 100 });
        }
        return this.regionXP.get(regionName);
      },
      playerState: {
        isStartRegion: (region) => region === 'Menu',
      },
    };
  });

  describe('getBaseCost', () => {
    it('returns correct base cost for explore action', () => {
      expect(analyzer.getBaseCost('explore')).toBe(50);
    });

    it('returns correct base cost for checkLocation action', () => {
      expect(analyzer.getBaseCost('checkLocation')).toBe(100);
    });

    it('returns correct base cost for moveToRegion action', () => {
      expect(analyzer.getBaseCost('moveToRegion')).toBe(10);
    });

    it('returns default cost for unknown action type', () => {
      expect(analyzer.getBaseCost('unknown')).toBe(50);
    });
  });

  describe('calculateActionCost', () => {
    it('calculates base cost without XP reduction at level 0', () => {
      const action = { type: 'explore', regionName: 'TestRegion' };
      const result = analyzer.calculateActionCost(action, mockLoopState);

      expect(result.baseCost).toBe(50);
      expect(result.levelDiscount).toBeCloseTo(0, 1);
      expect(result.finalCost).toBe(50);
    });

    it('applies XP reduction at higher levels', () => {
      // Set region level to 10
      mockLoopState.regionXP.set('TestRegion', { level: 10, xp: 0, xpForNextLevel: 300 });

      const action = { type: 'explore', regionName: 'TestRegion' };
      const result = analyzer.calculateActionCost(action, mockLoopState);

      // Level 10 = 1 + 10*0.05 = 1.5 reduction factor
      // Final cost = 50 / 1.5 = 33.33
      expect(result.baseCost).toBe(50);
      expect(result.finalCost).toBeLessThan(50);
      expect(result.levelDiscount).toBeGreaterThan(0);
    });
  });

  describe('getActionDescription', () => {
    it('returns correct description for explore action', () => {
      const action = { type: 'explore', regionName: 'Forest' };
      expect(analyzer.getActionDescription(action)).toBe('Explore: Forest');
    });

    it('returns correct description for checkLocation action', () => {
      const action = { type: 'checkLocation', locationName: 'Chest 1', regionName: 'Forest' };
      expect(analyzer.getActionDescription(action)).toBe('Check: Chest 1');
    });

    it('returns correct description for moveToRegion action', () => {
      const action = { type: 'moveToRegion', destinationRegion: 'Village', regionName: 'Forest' };
      expect(analyzer.getActionDescription(action)).toBe('Move: Village');
    });
  });

  describe('truncateDescription', () => {
    it('does not truncate short strings', () => {
      expect(analyzer.truncateDescription('Short', 20)).toBe('Short');
    });

    it('truncates long strings with ellipsis', () => {
      const longString = 'This is a very long description that should be truncated';
      const result = analyzer.truncateDescription(longString, 20);
      expect(result.length).toBe(20);
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('isInitialStartEntry', () => {
    it('identifies Menu region as initial start', () => {
      const action = { type: 'moveToRegion', regionName: 'Menu', exitUsed: null };
      expect(analyzer.isInitialStartEntry(action, mockLoopState)).toBe(true);
    });

    it('does not identify non-Menu region as initial start', () => {
      const action = { type: 'moveToRegion', regionName: 'Forest', exitUsed: null };
      expect(analyzer.isInitialStartEntry(action, mockLoopState)).toBe(false);
    });

    it('does not identify move with exit as initial start', () => {
      const action = { type: 'moveToRegion', regionName: 'Menu', exitUsed: 'Door' };
      expect(analyzer.isInitialStartEntry(action, mockLoopState)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('returns empty analysis for null input', () => {
      const result = analyzer.analyze(null, null);
      expect(result.entries).toHaveLength(0);
      expect(result.totalCost).toBe(0);
    });

    it('skips initial Menu entry', () => {
      const queue = [
        { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
        { type: 'explore', regionName: 'Forest' },
      ];

      const result = analyzer.analyze(queue, mockLoopState);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].type).toBe('explore');
    });

    it('calculates mana correctly for multiple actions', () => {
      const queue = [
        { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
        { type: 'moveToRegion', regionName: 'Forest', exitUsed: 'Door', pathIndex: 1 },
        { type: 'explore', regionName: 'Forest', pathIndex: 2 },
      ];

      const result = analyzer.analyze(queue, mockLoopState);

      // Move: 10 mana, Explore: 50 mana
      // Starting 100, after move: 90, after explore: 40
      expect(result.entries[0].manaAfterAction).toBe(90);
      expect(result.entries[1].manaAfterAction).toBe(40);
      expect(result.totalCost).toBe(60);
      expect(result.finalMana).toBe(40);
    });

    it('marks insufficient mana correctly', () => {
      mockLoopState.currentMana = 30; // Not enough for explore (50)

      const queue = [
        { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
        { type: 'explore', regionName: 'Forest', pathIndex: 1 },
      ];

      const result = analyzer.analyze(queue, mockLoopState);
      expect(result.entries[0].hasInsufficientMana).toBe(true);
    });

    it('handles completed actions correctly', () => {
      const queue = [
        { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
        { type: 'explore', regionName: 'Forest', pathIndex: 1, completed: true },
        { type: 'explore', regionName: 'Forest', pathIndex: 2 },
      ];

      const result = analyzer.analyze(queue, mockLoopState);

      // Completed actions don't affect mana
      expect(result.entries[0].isCompleted).toBe(true);
      expect(result.entries[1].manaBeforeAction).toBe(100);
    });
  });

  describe('archiveCurrentAnalysis', () => {
    it('archives current analysis as previous', () => {
      const queue = [
        { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
        { type: 'explore', regionName: 'Forest', pathIndex: 1 },
      ];

      analyzer.analyze(queue, mockLoopState);
      analyzer.archiveCurrentAnalysis();

      expect(analyzer.getPreviousAnalysis()).not.toBeNull();
      expect(analyzer.getPreviousAnalysis().entries).toHaveLength(1);
    });
  });

  describe('getSerializableState', () => {
    it('returns serializable state object', () => {
      const queue = [
        { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
        { type: 'explore', regionName: 'Forest', pathIndex: 1 },
      ];

      analyzer.analyze(queue, mockLoopState);
      const state = analyzer.getSerializableState();

      expect(state).toHaveProperty('currentAnalysis');
      expect(state).toHaveProperty('previousAnalysis');
      expect(state).toHaveProperty('baseCosts');
      expect(state.baseCosts.explore).toBe(50);
    });
  });
});

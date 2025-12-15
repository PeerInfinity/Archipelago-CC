/**
 * Unit tests for ruleEngine.js using shared JSON fixtures.
 *
 * These tests validate that the JavaScript rule evaluator produces
 * the same results as the Python evaluator, ensuring consistency
 * between the frontend and analyzer.
 *
 * @see tests/fixtures/rule_type_tests.json - Shared test fixtures
 * @see tests/test_rule_fixtures.py - Python test runner
 */

import { describe, it, expect } from 'vitest';
import { evaluateRule } from './ruleEngine.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Path to shared fixtures (relative to project root where tests are run)
const FIXTURES_PATH = join(process.cwd(), 'tests/fixtures/rule_type_tests.json');

// Load fixtures synchronously
const fixtureContent = readFileSync(FIXTURES_PATH, 'utf-8');
const fixtures = JSON.parse(fixtureContent);

/**
 * MockContext - Simulates StateManager interface for testing.
 *
 * This provides the same interface that ruleEngine.js expects from
 * the context object (SnapshotInterface), allowing isolated unit tests.
 */
class MockContext {
  constructor({
    inventory = {},
    groups = {},
    settings = {},
    regions = [],
    playerId = 1,
    helpers = {},
    capabilities = {},
  } = {}) {
    // Mark as a valid snapshot interface for ruleEngine validation
    this._isSnapshotInterface = true;

    this.inventory = inventory;
    this.groups = groups;
    this.settings = settings;
    this.regions = new Set(regions);
    this.playerId = playerId;
    this.helpers = helpers; // Pre-configured helper results: { helperName: result }
    this.capabilities = capabilities; // Pre-configured capability results: { capName: result }
  }

  /**
   * Check if player has at least one of the item.
   * @param {string} itemName - Name of the item
   * @returns {boolean}
   */
  hasItem(itemName) {
    return (this.inventory[itemName] || 0) > 0;
  }

  /**
   * Get the count of an item.
   * @param {string} itemName - Name of the item
   * @returns {number}
   */
  countItem(itemName) {
    return this.inventory[itemName] || 0;
  }

  /**
   * Check if player has items from a group.
   * @param {string} groupName - Name of the group
   * @param {number} count - Required count (default 1)
   * @returns {boolean}
   */
  hasGroup(groupName, count = 1) {
    return (this.groups[groupName] || 0) >= count;
  }

  /**
   * Get the count of items in a group.
   * @param {string} groupName - Name of the group
   * @returns {number}
   */
  countGroup(groupName) {
    return this.groups[groupName] || 0;
  }

  /**
   * Check if a region is reachable.
   * @param {string} regionName - Name of the region
   * @returns {boolean}
   */
  canReach(regionName) {
    return this.regions.has(regionName);
  }

  /**
   * Alias for canReach - used by ruleEngine for can_reach rule type.
   * @param {string} regionName - Name of the region
   * @returns {boolean}
   */
  isRegionReachable(regionName) {
    return this.regions.has(regionName);
  }

  /**
   * Get the current player ID.
   * @returns {number}
   */
  getPlayerId() {
    return this.playerId;
  }

  /**
   * Get a setting value.
   * @param {string} settingName - Name of the setting
   * @returns {*}
   */
  getSetting(settingName) {
    return this.settings[settingName];
  }

  /**
   * Execute a helper function.
   * Returns pre-configured result from helpers map, or implements common helpers.
   * @param {string} helperName - Name of the helper
   * @param {...*} args - Arguments to the helper
   * @returns {*}
   */
  executeHelper(helperName, ...args) {
    // Check for pre-configured result
    if (helperName in this.helpers) {
      const result = this.helpers[helperName];
      // If result is a function, call it with args
      return typeof result === 'function' ? result(...args) : result;
    }

    // Implement common helpers
    switch (helperName) {
      case 'has':
        return this.hasItem(args[0]);
      case 'count':
        return this.countItem(args[0]);
      case 'has_group':
        return this.hasGroup(args[0], args[1] || 1);
      case 'count_group':
        return this.countGroup(args[0]);
      default:
        // Unknown helper - return undefined
        return undefined;
    }
  }

  /**
   * Execute a StateManager method.
   * Returns pre-configured result or implements common methods.
   * @param {string} methodName - Name of the method
   * @param {...*} args - Arguments to the method
   * @returns {*}
   */
  executeStateManagerMethod(methodName, ...args) {
    switch (methodName) {
      case 'can_reach':
        return this.canReach(args[0]);
      case 'has':
        return this.hasItem(args[0]);
      case 'count':
        return this.countItem(args[0]);
      case 'has_group':
        return this.hasGroup(args[0], args[1] || 1);
      case 'count_group':
        return this.countGroup(args[0]);
      case 'has_any':
        // Check if player has any of the items in the list
        if (Array.isArray(args[0])) {
          return args[0].some((item) => this.hasItem(item));
        }
        return false;
      case 'has_all':
        // Check if player has all items in the list
        if (Array.isArray(args[0])) {
          return args[0].every((item) => this.hasItem(item));
        }
        return false;
      default:
        return undefined;
    }
  }

  /**
   * Create a MockContext from a test case context dictionary.
   * @param {Object} contextDict - Test case context
   * @returns {MockContext}
   */
  static fromTestContext(contextDict = {}) {
    return new MockContext({
      inventory: contextDict.inventory || {},
      groups: contextDict.groups || {},
      settings: contextDict.settings || {},
      regions: contextDict.regions || [],
      playerId: contextDict.playerId || 1,
      helpers: contextDict.helpers || {},
      capabilities: contextDict.capabilities || {},
    });
  }
}

/**
 * Test cases that use features not yet implemented in the frontend.
 * These will be skipped until the features are added to ruleEngine.js.
 */
const SKIP_TESTS = new Set([
  // All block/for_range tests now pass after implementing var support
]);

/**
 * Run a single fixture test case.
 * @param {string} suiteName - Name of the test suite
 * @param {Object} testCase - The test case object
 */
function runFixtureTest(suiteName, testCase) {
  const context = MockContext.fromTestContext(testCase.context);
  const result = evaluateRule(testCase.rule, context);

  // Handle special comparisons
  if (Array.isArray(testCase.expected)) {
    expect(result).toEqual(testCase.expected);
  } else if (testCase.expected === null) {
    // null should match null or undefined in JS context
    expect(result == null).toBe(true);
  } else if (typeof testCase.expected === 'number') {
    // Convert -0 to 0 for comparison (JS quirk: -0 !== 0 with Object.is)
    const normalizedResult = Object.is(result, -0) ? 0 : result;
    const normalizedExpected = Object.is(testCase.expected, -0) ? 0 : testCase.expected;
    expect(normalizedResult).toBe(normalizedExpected);
  } else {
    expect(result).toBe(testCase.expected);
  }
}

// Generate tests from fixtures
describe('Rule Engine - Shared Fixtures', () => {
  for (const [suiteName, suite] of Object.entries(fixtures.test_suites || {})) {
    describe(suiteName, () => {
      for (const testCase of suite.tests || []) {
        const testKey = `${suiteName}:${testCase.name}`;
        if (SKIP_TESTS.has(testKey)) {
          it.skip(`${testCase.name} (not implemented)`, () => {
            runFixtureTest(suiteName, testCase);
          });
        } else {
          it(testCase.name, () => {
            runFixtureTest(suiteName, testCase);
          });
        }
      }
    });
  }
});

describe('MockContext', () => {
  describe('inventory operations', () => {
    it('hasItem returns true for items with count > 0', () => {
      const ctx = new MockContext({ inventory: { Sword: 1, Key: 5 } });
      expect(ctx.hasItem('Sword')).toBe(true);
      expect(ctx.hasItem('Shield')).toBe(false);
    });

    it('countItem returns correct counts', () => {
      const ctx = new MockContext({ inventory: { Key: 5 } });
      expect(ctx.countItem('Key')).toBe(5);
      expect(ctx.countItem('Shield')).toBe(0);
    });
  });

  describe('group operations', () => {
    it('hasGroup returns true when count is met', () => {
      const ctx = new MockContext({ groups: { swords: 3, keys: 7 } });
      expect(ctx.hasGroup('swords')).toBe(true);
      expect(ctx.hasGroup('swords', 3)).toBe(true);
      expect(ctx.hasGroup('swords', 4)).toBe(false);
    });

    it('countGroup returns correct counts', () => {
      const ctx = new MockContext({ groups: { keys: 7 } });
      expect(ctx.countGroup('keys')).toBe(7);
      expect(ctx.countGroup('swords')).toBe(0);
    });
  });

  describe('settings', () => {
    it('getSetting returns correct values', () => {
      const ctx = new MockContext({ settings: { difficulty: 'hard', hearts: 3 } });
      expect(ctx.getSetting('difficulty')).toBe('hard');
      expect(ctx.getSetting('hearts')).toBe(3);
      expect(ctx.getSetting('unknown')).toBeUndefined();
    });
  });

  describe('player ID', () => {
    it('returns default player ID of 1', () => {
      const ctx = new MockContext();
      expect(ctx.getPlayerId()).toBe(1);
    });

    it('returns custom player ID', () => {
      const ctx = new MockContext({ playerId: 2 });
      expect(ctx.getPlayerId()).toBe(2);
    });
  });

  describe('regions', () => {
    it('canReach returns true for reachable regions', () => {
      const ctx = new MockContext({ regions: ['Castle', 'Town'] });
      expect(ctx.canReach('Castle')).toBe(true);
      expect(ctx.canReach('Forest')).toBe(false);
    });
  });
});

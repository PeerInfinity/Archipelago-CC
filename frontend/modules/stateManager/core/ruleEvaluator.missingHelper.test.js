/**
 * ⚖ D3 (rule-node-registry R2a, 2026-10-21): the worker's executeHelper answers UNDETERMINED
 * (`undefined`) for a helper that exists nowhere — not in rules.json `helpers`, not in the game's JS
 * logic. It used to return `false`, silently (measured: procgen_topdown AP_7–9 and jakanddaxter).
 * The reachability loop reads `undefined` as not traversable, so reachability is unchanged.
 */

import { describe, it, expect } from 'vitest';
import { executeHelper } from './ruleEvaluator.js';

function manager({ helpers = {}, helperFunctions = {} } = {}) {
  return { playerId: '1', getStaticGameData: () => ({ helpers: { 1: helpers } }), helperFunctions };
}

describe('worker executeHelper', () => {
  it('a helper that exists nowhere is undetermined, not false', () => {
    expect(executeHelper(manager(), 'can_jump_farther')).toBeUndefined();
  });

  it('a JS game-logic helper still answers', () => {
    const m = manager({ helperFunctions: { can_fly: () => false } });
    m.getSnapshot = () => ({});
    expect(executeHelper(m, 'can_fly')).toBe(false);
  });

  it('restores the in-helper flag on the undetermined path', () => {
    const m = manager();
    m._inHelperExecution = false;
    executeHelper(m, 'nope');
    expect(m._inHelperExecution).toBe(false);
  });
});

/**
 * goalCheck decides when a false "goal reached" could be sent, and a goal cannot
 * be undone on the server, so each way of saying no has its own row.
 */
import { describe, it, expect } from 'vitest';
import { applyReceivedItems, goalMet } from './goalCheck.js';
import { GENERATED_WORLD_OPTION } from './localRulesOverlay.js';

const GAME = 'Some Generated World';
const HAS_VICTORY = { type: 'item_check', item: 'Victory' };
const docWith = (rule, { slot = '1', generated = true, game = GAME, progression } = {}) => ({
  world: { [slot]: { game, options: generated ? { [GENERATED_WORLD_OPTION]: 0 } : { accessibility: 0 } } },
  game_info: { [slot]: rule === undefined ? {} : { completion_condition: rule } },
  progression_mapping: progression ? { [slot]: progression } : undefined,
});
const items = (...names) => new Map(names.map((n) => [n, 1]));

describe('goalMet', () => {
  it('is true once the server has delivered the goal item', () => {
    expect(goalMet(docWith(HAS_VICTORY), 1, GAME, items('Victory'))).toBe(true);
  });

  it('is false before the goal item is delivered', () => {
    expect(goalMet(docWith(HAS_VICTORY), 1, GAME, items('Sword'))).toBe(false);
  });

  it('reads the rule of the connected slot, not slot 1', () => {
    const doc = docWith(HAS_VICTORY, { slot: '2' });
    expect(goalMet(doc, 2, GAME, items('Victory'))).toBe(true);
    expect(goalMet(doc, 1, GAME, items('Victory'))).toBe(false);
  });

  it('accepts the Rule Builder form and compound rules', () => {
    const all = { rule: 'HasAll', args: { item_names: ['A', 'B'] } };
    expect(goalMet(docWith(all), 1, GAME, items('A'))).toBe(false);
    expect(goalMet(docWith(all), 1, GAME, items('A', 'B'))).toBe(true);
  });

  it('resolves progressive items through the document mapping', () => {
    const progression = { 'Progressive Sword': { items: [{ name: 'Sword', level: 1 }, { name: 'Master Sword', level: 2 }] } };
    const rule = { type: 'item_check', item: 'Master Sword' };
    const doc = docWith(rule, { progression });
    expect(goalMet(doc, 1, GAME, new Map([['Progressive Sword', 1]]))).toBe(false);
    expect(goalMet(doc, 1, GAME, new Map([['Progressive Sword', 2]]))).toBe(true);
  });

  describe('gate: only our generated worlds', () => {
    it('is false for an upstream document holding the goal item', () => {
      expect(goalMet(docWith(HAS_VICTORY, { generated: false }), 1, GAME, items('Victory'))).toBe(false);
    });
  });

  describe('gate: the loaded document is for the connected game and slot', () => {
    it('is false for a document of another game', () => {
      expect(goalMet(docWith(HAS_VICTORY, { game: 'Adventure' }), 1, GAME, items('Victory'))).toBe(false);
    });
    it('is false with no game, no document or no such slot', () => {
      expect(goalMet(docWith(HAS_VICTORY), 1, null, items('Victory'))).toBe(false);
      expect(goalMet(null, 1, GAME, items('Victory'))).toBe(false);
      expect(goalMet(docWith(HAS_VICTORY), 3, GAME, items('Victory'))).toBe(false);
    });
  });

  describe('gate: the rule needs items from the server', () => {
    it('is false for constant true', () => {
      expect(goalMet(docWith({ type: 'constant', value: true }), 1, GAME, items('Victory'))).toBe(false);
    });
    it('is false with no completion condition', () => {
      expect(goalMet(docWith(undefined), 1, GAME, items('Victory'))).toBe(false);
    });
    it('is false for a rule that names an item but holds with none', () => {
      const rule = { rule: 'Or', children: [{ rule: 'Has', args: { item_name: 'Victory' } }, { rule: 'True_' }] };
      expect(goalMet(docWith(rule), 1, GAME, items('Victory'))).toBe(false);
    });
  });

  describe('gate: a strict true', () => {
    it('is false when an inventory cannot answer the rule (undefined)', () => {
      const rule = { type: 'helper', name: 'some_game_helper', args: [] };
      expect(goalMet(docWith(rule), 1, GAME, items('Victory'))).toBe(false);
    });
    it('is false when only part of a compound rule is undefined', () => {
      const rule = { type: 'and', conditions: [HAS_VICTORY, { type: 'helper', name: 'some_game_helper', args: [] }] };
      expect(goalMet(docWith(rule), 1, GAME, items('Victory'))).toBe(false);
    });
  });
});

describe('applyReceivedItems', () => {
  it('adds on a later index, counting repeats', () => {
    const map = items('A');
    applyReceivedItems(map, 5, ['A', 'B']);
    expect([...map]).toEqual([['A', 2], ['B', 1]]);
  });
  it('replaces on index 0', () => {
    const map = items('Stale');
    applyReceivedItems(map, 0, ['A']);
    expect([...map]).toEqual([['A', 1]]);
  });
});

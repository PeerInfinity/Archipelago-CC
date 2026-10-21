import { describe, it, expect } from 'vitest';

import { loadedRulesForOptions, parseHelpersJson } from './exactEngine.js';

describe('parseHelpersJson', () => {
  it('accepts a helpers dict, including parameterised entries', () => {
    const helpers = {
      has_light: { type: 'item_check', item: 'Lantern' },
      can_enter: { params: ['keys'], body: { type: 'helper', name: 'has_light' } },
    };
    expect(parseHelpersJson(JSON.stringify(helpers))).toEqual({ helpers });
    expect(parseHelpersJson('{}')).toEqual({ helpers: {} });
  });

  it('refuses a single rule by name, and anything not an object', () => {
    expect(parseHelpersJson('{"type": "item_check", "item": "A"}').error).toMatch(/single rule/);
    expect(parseHelpersJson('{"rule": "Has", "args": {}}').error).toMatch(/single rule/);
    expect(parseHelpersJson('[1, 2]').error).toMatch(/helpers dict/);
    expect(parseHelpersJson('null').error).toMatch(/helpers dict/);
    expect(parseHelpersJson('{nope').error).toMatch(/^Invalid JSON/);
  });
});

describe('loadedRulesForOptions', () => {
  it('takes the loaded document and the selected slot as a string', () => {
    const doc = { game_name: 'G' };
    expect(loadedRulesForOptions({ rawJsonData: doc, selectedPlayerInfo: { playerId: 2 } }))
      .toEqual({ rules: doc, playerId: '2' });
    expect(loadedRulesForOptions({ rawJsonData: doc })).toEqual({ rules: doc, playerId: '1' });
  });

  it('is null when nothing is loaded', () => {
    expect(loadedRulesForOptions(null)).toBe(null);
    expect(loadedRulesForOptions({ rawJsonData: null })).toBe(null);
  });
});

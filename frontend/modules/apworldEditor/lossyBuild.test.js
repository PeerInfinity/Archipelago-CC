import { describe, it, expect } from 'vitest';

import {
  LOSSY_BUILD_DEFAULT, LOSSY_BUILD_KEY, LOSSY_BUILD_SCHEMA, LOSSY_BUILD_SETTING,
  isLossyRefusal, lossyBuildOn, lossyRecordView,
} from './lossyBuild.js';

describe('the lossy-build setting', () => {
  it('is OFF by default (strict, ⚖ D3) and lives under the module\'s settings', () => {
    expect(LOSSY_BUILD_DEFAULT).toBe(false);
    expect(LOSSY_BUILD_SCHEMA.default).toBe(LOSSY_BUILD_DEFAULT);
    expect(LOSSY_BUILD_SETTING).toBe(`moduleSettings.apworldEditor.${LOSSY_BUILD_KEY}`);
  });

  it('is ON only for a stored `true`', () => {
    expect(lossyBuildOn(true)).toBe(true);
    for (const v of [false, undefined, null, 'true', 1]) expect(lossyBuildOn(v)).toBe(false);
  });
});

describe('isLossyRefusal', () => {
  it('recognises world_generator\'s strict errors, both kinds', () => {
    expect(isLossyRefusal("UnknownHelperNameError: world_generator has no definition for helper 'h' "
      + "(rule_builder helper) for game 'G': … Export the body, or generate with --lossy to emit …")).toBe(true);
    expect(isLossyRefusal("UnknownRuleKindError: … Handle the kind, or generate with --lossy to emit …")).toBe(true);
    expect(isLossyRefusal("KeyError: 'regions'")).toBe(false);
  });
});

describe('lossyRecordView', () => {
  it('heads with the total and lists every name with its count', () => {
    const view = lossyRecordView({ 'rule_builder helper:helper h': 90, 'helper body:Attribute': 2 });
    expect(view.total).toBe(92);
    expect(view.heading).toMatch(/^Lossy build: 92 always-true placeholders for 2 rule kinds or helper names/);
    expect(view.lines).toEqual(['rule_builder helper:helper h ×90', 'helper body:Attribute ×2']);
  });

  it('says so when a lossy build replaced nothing', () => {
    const view = lossyRecordView({});
    expect(view).toMatchObject({ total: 0, lines: [] });
    expect(view.heading).toMatch(/nothing was replaced/);
  });
});

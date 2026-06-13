/**
 * Unit tests for the pure (DOM-free) logic behind the Options panel's
 * auto-generated "All Settings" view. The DOM rendering + live write-through
 * are verified headlessly (Playwright); these cover the decision logic.
 */
import { describe, it, expect } from 'vitest';
import {
  humanizeKey,
  chooseControlType,
  resolveLabel,
  coerceNumber,
  coerceEnum,
  buildSearchText,
} from './schemaControlHelpers.js';

describe('humanizeKey', () => {
  it('splits camelCase', () => {
    expect(humanizeKey('defaultSpeed')).toBe('Default Speed');
  });
  it('splits letter→digit boundaries', () => {
    expect(humanizeKey('showLabel1')).toBe('Show Label 1');
    expect(humanizeKey('showLabel2')).toBe('Show Label 2');
  });
  it('normalizes snake_case and kebab-case', () => {
    expect(humanizeKey('max_iframes')).toBe('Max Iframes');
    expect(humanizeKey('auto-load-mode')).toBe('Auto Load Mode');
  });
  it('keeps acronyms (only word-starts are upcased)', () => {
    expect(humanizeKey('commonUI')).toBe('Common UI');
  });
  it('handles empty / nullish input', () => {
    expect(humanizeKey('')).toBe('');
    expect(humanizeKey(undefined)).toBe('');
    expect(humanizeKey(null)).toBe('');
  });
});

describe('chooseControlType', () => {
  it('boolean → boolean', () => {
    expect(chooseControlType({ type: 'boolean' })).toBe('boolean');
  });
  it('number / integer → number', () => {
    expect(chooseControlType({ type: 'number' })).toBe('number');
    expect(chooseControlType({ type: 'integer' })).toBe('number');
  });
  it('string → string', () => {
    expect(chooseControlType({ type: 'string' })).toBe('string');
  });
  it('enum wins over type', () => {
    expect(chooseControlType({ type: 'string', enum: ['a', 'b'] })).toBe('enum');
    expect(chooseControlType({ type: 'number', enum: [1, 2] })).toBe('enum');
  });
  it('empty enum does NOT trigger enum', () => {
    expect(chooseControlType({ type: 'string', enum: [] })).toBe('string');
  });
  it('array / object / unknown / missing → json', () => {
    expect(chooseControlType({ type: 'array' })).toBe('json');
    expect(chooseControlType({ type: 'object' })).toBe('json');
    expect(chooseControlType({ type: 'wat' })).toBe('json');
    expect(chooseControlType({})).toBe('json');
    expect(chooseControlType(null)).toBe('json');
  });
});

describe('resolveLabel', () => {
  it('prefers the explicit label', () => {
    expect(resolveLabel({ prop: 'showLabel1', spec: { label: 'Custom' } })).toBe('Custom');
  });
  it('falls back to the humanized prop', () => {
    expect(resolveLabel({ prop: 'showLabel1', spec: {} })).toBe('Show Label 1');
    expect(resolveLabel({ prop: 'defaultSpeed' })).toBe('Default Speed');
  });
});

describe('coerceNumber', () => {
  it('parses a plain number', () => {
    expect(coerceNumber({ type: 'number' }, '12.5')).toEqual({ ok: true, value: 12.5 });
  });
  it('truncates for integer', () => {
    expect(coerceNumber({ type: 'integer' }, '7.9')).toEqual({ ok: true, value: 7 });
  });
  it('rejects empty string', () => {
    expect(coerceNumber({ type: 'number' }, '')).toEqual({ ok: false });
    expect(coerceNumber({ type: 'number' }, '   ')).toEqual({ ok: false });
  });
  it('rejects NaN', () => {
    expect(coerceNumber({ type: 'number' }, 'abc')).toEqual({ ok: false });
  });
  it('does not coerce empty to 0', () => {
    expect(coerceNumber({ type: 'number' }, '').ok).toBe(false);
  });
});

describe('coerceEnum', () => {
  it('maps a raw string back to the original-typed enum member', () => {
    expect(coerceEnum({ enum: [1, 2, 3] }, '2')).toEqual({ ok: true, value: 2 });
    expect(coerceEnum({ enum: ['js', 'dj'] }, 'dj')).toEqual({ ok: true, value: 'dj' });
    expect(coerceEnum({ enum: [true, false] }, 'true')).toEqual({ ok: true, value: true });
  });
  it('rejects a value not in the enum', () => {
    expect(coerceEnum({ enum: [1, 2] }, '9')).toEqual({ ok: false });
  });
  it('rejects a spec with no enum', () => {
    expect(coerceEnum({ type: 'string' }, 'x')).toEqual({ ok: false });
    expect(coerceEnum(null, 'x')).toEqual({ ok: false });
  });
});

describe('buildSearchText', () => {
  it('lower-cases and joins module, prop, label, key, description', () => {
    const entry = {
      moduleId: 'Inventory',
      prop: 'showLabel1',
      key: 'moduleSettings.inventory.showLabel1',
      spec: { description: 'Show the FIRST column' },
    };
    const text = buildSearchText(entry, 'Show Label 1');
    expect(text).toContain('inventory');
    expect(text).toContain('showlabel1');
    expect(text).toContain('show label 1');
    expect(text).toContain('modulesettings.inventory.showlabel1');
    expect(text).toContain('show the first column');
    expect(text).toBe(text.toLowerCase());
  });
});

/**
 * Tests for centralRegistry's settings-schema accessors:
 *   - _normalizeSchemaProps (the shared shape normalizer)
 *   - getModuleSettingSchema / getAllSettingSchemas (drive the Options
 *     panel's auto-generated "All Settings" view)
 *   - getSchemaDefault (refactored onto the shared normalizer; consumed by
 *     settingsManager.getSetting — see settingsManager.test.js for the full
 *     precedence chain).
 *
 * Schema snippets are registered on the singleton and cleaned up after each
 * test so they don't leak into sibling suites.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { centralRegistry } from './centralRegistry.js';

// Three heterogeneous shapes the normalizer must handle.
const STD = {
  type: 'object',
  properties: {
    widgetSize: { type: 'number', default: 42 },
    enabled: { type: 'boolean', default: true },
    noDefaultProp: { type: 'string' },           // type, no default
  },
};
const WRAPPED = {
  wrappedMod: {
    type: 'object',
    properties: { toggle: { type: 'boolean', default: false } },
  },
};
const FLAT = {
  color: { type: 'string', default: '#abc' },
  size: { type: 'integer', default: 3 },
};

const MODS = ['stdMod', 'wrappedMod', 'flatMod', 'junkMod', 'emptyMod'];

function clearMods() {
  for (const m of MODS) centralRegistry.settingsSchemas.delete(m);
}

afterEach(clearMods);

describe('centralRegistry — getModuleSettingSchema', () => {
  it('extracts props from the standard {properties} shape', () => {
    centralRegistry.settingsSchemas.set('stdMod', STD);
    const entries = centralRegistry.getModuleSettingSchema('stdMod');
    expect(entries.map((e) => e.prop)).toEqual(['widgetSize', 'enabled', 'noDefaultProp']);
    expect(entries[0]).toMatchObject({
      key: 'moduleSettings.stdMod.widgetSize',
      moduleId: 'stdMod',
      prop: 'widgetSize',
    });
    expect(entries[0].spec.default).toBe(42);
  });

  it('extracts props from the double-wrapped {<mod>:{...}} shape', () => {
    centralRegistry.settingsSchemas.set('wrappedMod', WRAPPED);
    const entries = centralRegistry.getModuleSettingSchema('wrappedMod');
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('moduleSettings.wrappedMod.toggle');
    expect(entries[0].spec.default).toBe(false);
  });

  it('extracts props from the flat {<prop>:{...}} shape', () => {
    centralRegistry.settingsSchemas.set('flatMod', FLAT);
    const entries = centralRegistry.getModuleSettingSchema('flatMod');
    expect(entries.map((e) => e.prop)).toEqual(['color', 'size']);
    expect(entries.map((e) => e.key)).toEqual([
      'moduleSettings.flatMod.color',
      'moduleSettings.flatMod.size',
    ]);
  });

  it('preserves schema-declared property order', () => {
    centralRegistry.settingsSchemas.set('stdMod', STD);
    const order = centralRegistry.getModuleSettingSchema('stdMod').map((e) => e.prop);
    expect(order).toEqual(['widgetSize', 'enabled', 'noDefaultProp']);
  });

  it('returns [] for an unregistered module', () => {
    expect(centralRegistry.getModuleSettingSchema('nope')).toEqual([]);
  });

  it('returns [] for a malformed (string) schema', () => {
    centralRegistry.settingsSchemas.set('junkMod', 'someModuleId');
    expect(centralRegistry.getModuleSettingSchema('junkMod')).toEqual([]);
  });

  it('skips entries that are not spec-like (no type and no default)', () => {
    // A flat shape where one key is not a property spec.
    centralRegistry.settingsSchemas.set('flatMod', {
      real: { type: 'boolean', default: true },
      bogus: { somethingElse: 1 },
    });
    const entries = centralRegistry.getModuleSettingSchema('flatMod');
    expect(entries.map((e) => e.prop)).toEqual(['real']);
  });
});

describe('centralRegistry — getAllSettingSchemas', () => {
  it('flattens across modules, sorted by module id, props in declared order', () => {
    centralRegistry.settingsSchemas.set('stdMod', STD);
    centralRegistry.settingsSchemas.set('flatMod', FLAT);
    centralRegistry.settingsSchemas.set('wrappedMod', WRAPPED);
    const keys = centralRegistry.getAllSettingSchemas().map((e) => e.key);
    // Filter to just our test modules (the live singleton may carry others
    // if a sibling test registered them — afterEach clears ours).
    const ours = keys.filter((k) => /^moduleSettings\.(stdMod|flatMod|wrappedMod)\./.test(k));
    expect(ours).toEqual([
      'moduleSettings.flatMod.color',
      'moduleSettings.flatMod.size',
      'moduleSettings.stdMod.widgetSize',
      'moduleSettings.stdMod.enabled',
      'moduleSettings.stdMod.noDefaultProp',
      'moduleSettings.wrappedMod.toggle',
    ]);
  });
});

describe('centralRegistry — getSchemaDefault (refactored onto shared normalizer)', () => {
  it('returns the default for a standard-shape prop', () => {
    centralRegistry.settingsSchemas.set('stdMod', STD);
    expect(centralRegistry.getSchemaDefault('moduleSettings.stdMod.widgetSize'))
      .toEqual({ found: true, value: 42 });
  });

  it('returns the default for a double-wrapped prop', () => {
    centralRegistry.settingsSchemas.set('wrappedMod', WRAPPED);
    expect(centralRegistry.getSchemaDefault('moduleSettings.wrappedMod.toggle'))
      .toEqual({ found: true, value: false });
  });

  it('returns the default for a flat-shape prop', () => {
    centralRegistry.settingsSchemas.set('flatMod', FLAT);
    expect(centralRegistry.getSchemaDefault('moduleSettings.flatMod.color'))
      .toEqual({ found: true, value: '#abc' });
  });

  it('reports found:false when the prop has no default', () => {
    centralRegistry.settingsSchemas.set('stdMod', STD);
    expect(centralRegistry.getSchemaDefault('moduleSettings.stdMod.noDefaultProp'))
      .toEqual({ found: false, value: undefined });
  });

  it('reports found:false for non-moduleSettings keys', () => {
    expect(centralRegistry.getSchemaDefault('generalSettings.theme').found).toBe(false);
    expect(centralRegistry.getSchemaDefault('moduleSettings.stdMod').found).toBe(false);
    expect(centralRegistry.getSchemaDefault('moduleSettings.a.b.c').found).toBe(false);
    expect(centralRegistry.getSchemaDefault(null).found).toBe(false);
  });

  it('reports found:false for an unregistered module', () => {
    expect(centralRegistry.getSchemaDefault('moduleSettings.nope.prop').found).toBe(false);
  });
});

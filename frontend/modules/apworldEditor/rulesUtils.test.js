import { describe, it, expect } from 'vitest';

import {
  cloneFullRulesDoc,
  renameRegionInRules,
  validateRules,
} from './rulesUtils.js';

// A minimal rules.json carrying the non-standard top-level keys the editor
// must preserve so a procgen-generated world stays re-growable after a manual
// edit pass. sphere_tree/sphere_plan live under procgen_metadata.
function procgenWorld() {
  return {
    regions: {
      1: {
        Menu: { exits: [{ name: 'to_A', connects_to: 'A', access_rule: { rule: 'True_' } }], locations: [] },
        A: {
          exits: [{ name: 'to_B', connects_to: 'B', access_rule: { rule: 'Has', args: { item: 'Key' } } }],
          locations: [{ name: 'A_chest', access_rule: { rule: 'True_' } }],
        },
        B: { exits: [], locations: [] },
      },
    },
    items: { 1: { Key: { classification: 'progression' } } },
    procgen_metadata: {
      driver: 'sphere-growth',
      sphere_tree: [
        { index: 0, wave: 0, cell: [0, 0], substrate: 'bounce', parent: null },
        { index: 1, wave: 1, cell: [1, 0], substrate: 'bounce', parent: 0, gate: 'Key' },
      ],
      sphere_plan: [{ sphere: 0, items: [] }, { sphere: 1, items: ['Key'] }],
    },
    loop_costs: { move: 1 },
    preset_sidecars: { 1: { foo: 'bar' } },
  };
}

describe('cloneFullRulesDoc', () => {
  it('preserves every top-level key, including non-standard procgen/loop metadata', () => {
    const doc = procgenWorld();
    const out = cloneFullRulesDoc(doc);
    expect(out.procgen_metadata).toEqual(doc.procgen_metadata);
    expect(out.loop_costs).toEqual(doc.loop_costs);
    expect(out.preset_sidecars).toEqual(doc.preset_sidecars);
    expect(Object.keys(out).sort()).toEqual(Object.keys(doc).sort());
  });

  it('returns a deep copy (mutating the clone does not touch the source)', () => {
    const doc = procgenWorld();
    const out = cloneFullRulesDoc(doc);
    expect(out.procgen_metadata).not.toBe(doc.procgen_metadata);
    out.procgen_metadata.sphere_tree[0].wave = 999;
    expect(doc.procgen_metadata.sphere_tree[0].wave).toBe(0);
  });
});

// Simulates the editor's load → edit → apply round-trip without the DOM-bound
// UI class: load-clone, mutate via the same rename cascade the editor uses,
// then apply-clone. procgen_metadata must survive byte-identical — this is the
// §2.1 round-trip guarantee the integration depends on.
describe('APWorld Editor round-trip preservation', () => {
  it('keeps procgen_metadata byte-identical through a region rename + apply', () => {
    const original = procgenWorld();
    const metaBefore = structuredClone(original.procgen_metadata);

    // load: editor adopts a full clone of the incoming doc.
    const working = cloneFullRulesDoc(original);

    // edit: rename region A -> Atrium (key move + rule-reference cascade, the
    // two things the editor's _handleRenameRegion does to the doc).
    working.regions[1].Atrium = working.regions[1].A;
    delete working.regions[1].A;
    renameRegionInRules(working, '1', 'A', 'Atrium');

    // apply: editor emits a full clone of its working doc.
    const emitted = cloneFullRulesDoc(working);

    // The edit landed...
    expect(emitted.regions[1].Atrium).toBeDefined();
    expect(emitted.regions[1].A).toBeUndefined();
    // ...and the procgen metadata is untouched by load, edit, or apply.
    expect(emitted.procgen_metadata).toEqual(metaBefore);
  });

  it('rename cascade never mutates procgen_metadata', () => {
    const doc = procgenWorld();
    const metaBefore = structuredClone(doc.procgen_metadata);
    renameRegionInRules(doc, '1', 'A', 'Atrium');
    expect(doc.procgen_metadata).toEqual(metaBefore);
  });
});

// EDITOR v3 slice D0a — the defect the rulesGraph adoption CURED, pinned.
describe('validateRules reads BOTH start_regions shapes', () => {
  const twoRegions = () => ({
    regions: { 1: { Menu: { exits: [], locations: [] }, A: { exits: [], locations: [] } } },
    items: { 1: {} },
  });
  const startWarning = (doc) => validateRules(doc, '1')
    .filter((i) => i.message === 'No start region set.');

  it('the OBJECT shape every committed rules.json uses — no warning', () => {
    const doc = { ...twoRegions(), start_regions: { 1: { default: ['Menu'], available: [] } } };
    expect(startWarning(doc)).toEqual([]);
  });

  it('⛓ the ARRAY shape — no warning EITHER (it used to false-warn)', () => {
    // Before D0a this read `start_regions['1'].default` on an array, got
    // undefined, and reported "No start region set." about a doc that names
    // Menu as its start. The array shape lives in procgenPlayer/index.test.js:75.
    const doc = { ...twoRegions(), start_regions: { 1: ['Menu'] } };
    expect(startWarning(doc)).toEqual([]);
  });

  it('a start region that does not EXIST is still an error, in both shapes', () => {
    for (const start of [{ default: ['Ghost'] }, ['Ghost']]) {
      const issues = validateRules({ ...twoRegions(), start_regions: { 1: start } }, '1');
      expect(issues).toContainEqual({
        severity: 'error', tab: 'meta', message: 'Start region "Ghost" doesn\'t exist.',
      });
    }
  });

  it('genuinely absent → the warning still fires', () => {
    expect(startWarning(twoRegions())).toHaveLength(1);
  });
});

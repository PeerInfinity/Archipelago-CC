import { describe, it, expect } from 'vitest';

import {
  cloneFullRulesDoc,
  renameItemInRules,
  renameLocationInRules,
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
    procgen_metadata: { 1: {
      driver: 'sphere-growth',
      sphere_tree: [
        { index: 0, wave: 0, cell: [0, 0], substrate: 'bounce', parent: null },
        { index: 1, wave: 1, cell: [1, 0], substrate: 'bounce', parent: 0, gate: 'Key' },
      ],
      sphere_plan: [{ sphere: 0, items: [] }, { sphere: 1, items: ['Key'] }],
    } },
    loop_costs: { 1: { move: 1 } },
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
    out.procgen_metadata[1].sphere_tree[0].wave = 999;
    expect(doc.procgen_metadata[1].sphere_tree[0].wave).toBe(0);
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

// ⚖ D3 (rule-node-registry R2b): the cascades read names by ARG, as the validator does. Before, they
// keyed on six rule kinds and left stale names in every other kind carrying the same arg — measured
// over the committed presets: HasFromListUnique ×156, CountFromList, AST_count_item, AST_placement_search,
// typed item_check; AST_region_check ×1218, typed region_check / can_reach / region_reference;
// AST_location_rule_ref ×264, AST_placement_lookup ×211.
describe('rename cascades find a name by its arg, whatever the rule kind', () => {
  const docWith = (rule) => ({
    regions: { 1: { Menu: { exits: [{ name: 'e', connects_to: 'A', access_rule: rule }], locations: [] }, A: { exits: [], locations: [] } } },
    items: { 1: {} },
  });
  const ruleOf = (doc) => doc.regions[1].Menu.exits[0].access_rule;

  it('items: listed and unlisted RB kinds, and a typed item_check nested in an RB node', () => {
    const doc = docWith({ rule: 'And', children: [
      { rule: 'Has', args: { item_name: 'Old' } },
      { rule: 'HasFromListUnique', args: { item_names: ['Old', 'Other'], count: 2 } },
      { rule: 'AST_count_item', args: { item: 'Old' } },
      { rule: 'ASTRule', args: { rule_data: { type: 'item_check', item: 'Old' } } },
    ] });
    renameItemInRules(doc, '1', 'Old', 'New');
    expect(JSON.stringify(ruleOf(doc))).not.toContain('"Old"');
    expect(ruleOf(doc).children[1].args.item_names).toEqual(['New', 'Other']);
    expect(ruleOf(doc).children[3].args.rule_data.item).toBe('New');
  });

  it('regions: CanReachRegion, AST_region_check and a typed region_check', () => {
    const doc = docWith({ rule: 'Or', children: [
      { rule: 'CanReachRegion', args: { region_name: 'Old' } },
      { rule: 'AST_region_check', args: { region: 'Old' } },
      { rule: 'ASTRule', args: { rule_data: { type: 'region_check', region: 'Old' } } },
    ] });
    renameRegionInRules(doc, '1', 'Old', 'New');
    expect(JSON.stringify(ruleOf(doc))).not.toContain('"Old"');
  });

  it('locations: CanReachLocation, AST_location_rule_ref, AST_placement_lookup', () => {
    const doc = docWith({ rule: 'And', children: [
      { rule: 'CanReachLocation', args: { location_name: 'Old' } },
      { rule: 'AST_location_rule_ref', args: { location: 'Old' } },
      { rule: 'AST_placement_lookup', args: { location: 'Old' } },
    ] });
    renameLocationInRules(doc, '1', 'Old', 'New');
    expect(JSON.stringify(ruleOf(doc))).not.toContain('"Old"');
  });

  it('leaves another kind of name alone (an item rename does not touch a region arg)', () => {
    const doc = docWith({ rule: 'AST_region_check', args: { region: 'Old' } });
    renameItemInRules(doc, '1', 'Old', 'New');
    expect(ruleOf(doc).args.region).toBe('Old');
  });

  it('the validator reports an unknown region under an unlisted kind too', () => {
    const issues = validateRules({ ...docWith({ rule: 'AST_region_check', args: { region: 'Ghost' } }), start_regions: { 1: ['Menu'] } }, '1');
    expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining('unknown region "Ghost"'));
  });
});

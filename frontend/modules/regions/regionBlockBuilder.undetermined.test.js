/**
 * The Regions panel gives an UNDETERMINED rule exactly one presentation: "not met",
 * i.e. the row is 'inaccessible' and never also 'accessible'.
 *
 * The defect (measured on 18 of 224 presets, 2026-10-31): `evaluateRule` returns `undefined`
 * for an undetermined rule, the builder carried that value through `&&`, and
 * `classList.toggle('accessible', undefined)` is a PLAIN toggle under the DOM spec (an
 * omitted/undefined `force`), so the row got BOTH classes. The Locations panel and the spoiler
 * comparison already read a rule as met only when it is `=== true`; `ruleMet` does the same here.
 *
 * The rows are built by the REAL builder methods (`addEntrances` / `addExits` / `addLocations`)
 * and the rules go through the REAL `evaluateRule` + `createSnapshotInterface`. The DOM is a
 * minimal stand-in whose `classList.toggle` follows the spec, `force === undefined` included;
 * that is the half of the defect the fake has to get right, and the first row pins it.
 *
 * Mutant: undo `ruleMet` at the evaluation sites (the old `x = evaluateRule(...)`) and the
 * double-class rows below go red.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../app/core/settingsManager.js', () => ({
  default: { getSetting: async () => undefined, getSettings: async () => ({}) },
}));
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getStaticData: () => null,
    getLatestStateSnapshot: () => null,
    getEffectiveBidirectionalSetting: () => ({ assumeBidirectional: false }),
  },
}));
vi.mock('../discovery/singleton.js', () => ({
  default: {
    isRegionDiscovered: () => true,
    isExitDiscovered: () => true,
    isLocationDiscovered: () => true,
  },
}));
vi.mock('../commonUI/index.js', () => {
  const link = () => globalThis.document.createElement('span');
  return {
    default: { createRegionLink: link, createLocationLink: link },
    renderLogicTree: () => globalThis.document.createElement('div'),
  };
});
vi.mock('./index.js', () => ({ getModuleEventBus: () => null }));

import { evaluateRule } from '../shared/ruleEngine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';

/** DOMTokenList.toggle, per the DOM spec: an undefined `force` means "flip". */
class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...names) { names.forEach((n) => this.set.add(n)); }
  remove(...names) { names.forEach((n) => this.set.delete(n)); }
  contains(n) { return this.set.has(n); }
  toggle(name, force) {
    if (force === undefined) {
      if (this.set.has(name)) { this.set.delete(name); return false; }
      this.set.add(name); return true;
    }
    if (force) this.set.add(name); else this.set.delete(name);
    return !!force;
  }
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this.innerHTML = '';
  }
  set className(v) { this.classList = new FakeClassList(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get className() { return [...this.classList.set].join(' '); }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  prepend(c) { this.children.unshift(c); }
  insertBefore(c) { this.children.push(c); return c; }
  setAttribute() {}
  addEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  /** every descendant (depth first), this element excluded */
  *walk() { for (const c of this.children) { if (c instanceof FakeElement) { yield c; yield* c.walk(); } } }
}

let savedDocument;
beforeAll(() => {
  savedDocument = globalThis.document;
  globalThis.document = {
    createElement: (t) => new FakeElement(t),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  };
});
afterAll(() => { globalThis.document = savedDocument; });

const UNDETERMINED = { type: 'name', name: 'not_in_scope' };
const MET = { type: 'constant', value: true };
const NOT_MET = { type: 'constant', value: false };

/** One reachable region, 'Hub', with an exit and a location per verdict, plus a reachable 'Next'. */
const REGIONS = {
  Hub: {
    name: 'Hub',
    exits: [
      { name: 'Undetermined Door', connected_region: 'Next', access_rule: UNDETERMINED },
      { name: 'Open Door', connected_region: 'Next', access_rule: MET },
      { name: 'Shut Door', connected_region: 'Next', access_rule: NOT_MET },
    ],
    locations: [
      { name: 'Undetermined Chest', access_rule: UNDETERMINED },
      { name: 'Open Chest', access_rule: MET },
      { name: 'Shut Chest', access_rule: NOT_MET },
    ],
  },
  Next: {
    name: 'Next',
    exits: [{ name: 'Undetermined Return', connected_region: 'Hub', access_rule: UNDETERMINED }],
    locations: [],
  },
};
const SNAPSHOT = {
  inventory: {},
  player: { id: 1 },
  regionReachability: { Hub: 'reachable', Next: 'reachable' },
  checkedLocations: [],
};
const STATIC = {
  game_name: 'Test Game',
  regions: new Map(Object.entries(REGIONS)),
  locations: new Map(REGIONS.Hub.locations.map((l) => [l.name, { ...l, parent_region: 'Hub' }])),
  exits: new Map(),
  helpers: { 1: {} },
};

let builder;
let snapshotInterface;
beforeAll(async () => {
  const { RegionBlockBuilder } = await import('./regionBlockBuilder.js');
  builder = new RegionBlockBuilder({ visitedRegions: [], showAll: true, nextUID: 1, rootElement: null });
  snapshotInterface = createSnapshotInterface(SNAPSHOT, STATIC);
});

/** The <li> rows the builder appended, keyed by the row's own entity name (found in its text). */
function rows(container, rowClass) {
  return [...container.walk()].filter((el) => el.tagName === 'LI' && el.classList.contains(rowClass));
}
const accessClasses = (li) => ['accessible', 'inaccessible'].filter((c) => li.classList.contains(c));
/** All text under a node: its own textContent plus every child's, text nodes included. */
const textOf = (node) => [node.textContent ?? '', ...(node.children ?? []).map(textOf)].join(' ');

describe('the fixture really is undetermined, and the fake classList follows the DOM spec', () => {
  it('evaluateRule gives undefined for the undetermined rule, true/false for the others', () => {
    expect(evaluateRule(UNDETERMINED, snapshotInterface)).toBeUndefined();
    expect(evaluateRule(MET, snapshotInterface)).toBe(true);
    expect(evaluateRule(NOT_MET, snapshotInterface)).toBe(false);
  });

  it("toggle(name, undefined) flips, so the old expression gave BOTH classes on a fresh row", () => {
    const cl = new FakeClassList();
    const old = true && undefined; // regionIsReachable && evaluateRule(...) on an undetermined rule
    cl.toggle('accessible', old);
    cl.toggle('inaccessible', !old);
    expect([...cl.set].sort()).toEqual(['accessible', 'inaccessible']);
  });
});

describe('ruleMet', () => {
  it('only true is met', async () => {
    const { ruleMet } = await import('./regionBlockBuilder.js');
    expect([true, false, undefined, null, 1, 'true', {}].map(ruleMet))
      .toEqual([true, false, false, false, false, false, false]);
  });
});

describe('Regions panel rows: one presentation per verdict', () => {
  const build = (method) => {
    const content = new FakeElement('div');
    if (method === 'exits') {
      builder.addExits(content, 'Hub', REGIONS.Hub, SNAPSHOT, snapshotInterface, true, false, 1, false, true, {}, null);
    } else if (method === 'locations') {
      builder.addLocations(content, 'Hub', REGIONS.Hub, SNAPSHOT, snapshotInterface, true, false, false, STATIC, true, {});
    } else {
      builder.addEntrances(content, 'Hub', STATIC, SNAPSHOT, snapshotInterface, false, null, false, {});
    }
    return content;
  };
  const byName = (list, name) => {
    const hit = list.filter((li) => textOf(li).includes(name));
    expect(hit, `exactly one row for ${name}`).toHaveLength(1);
    return hit[0];
  };

  it('an UNDETERMINED exit is inaccessible only, and its status reads Blocked', () => {
    const list = rows(build('exits'), 'exit-item');
    expect(list).toHaveLength(3);
    const li = byName(list, 'Undetermined Door');
    expect(accessClasses(li)).toEqual(['inaccessible']);
    expect(textOf(li)).toContain('Blocked');
    expect(accessClasses(byName(list, 'Open Door'))).toEqual(['accessible']);
    expect(accessClasses(byName(list, 'Shut Door'))).toEqual(['inaccessible']);
  });

  it('an UNDETERMINED location is inaccessible only, and its status reads Locked', () => {
    const list = rows(build('locations'), 'location-item');
    expect(list).toHaveLength(3);
    const li = byName(list, 'Undetermined Chest');
    expect(accessClasses(li)).toEqual(['inaccessible']);
    expect(textOf(li)).toContain('Locked');
    expect(accessClasses(byName(list, 'Open Chest'))).toEqual(['accessible']);
    expect(accessClasses(byName(list, 'Shut Chest'))).toEqual(['inaccessible']);
  });

  it('an UNDETERMINED entrance (the Undetermined Return from Next into Hub) is inaccessible only', () => {
    const list = rows(build('entrances'), 'entrance-item');
    expect(list.length).toBeGreaterThan(0);
    for (const li of list) expect(accessClasses(li)).toHaveLength(1);
    expect(accessClasses(byName(list, 'Undetermined Return'))).toEqual(['inaccessible']);
  });

  it('no row of any section carries both classes', () => {
    for (const [m, cls] of [['exits', 'exit-item'], ['locations', 'location-item'], ['entrances', 'entrance-item']]) {
      for (const li of rows(build(m), cls)) expect(accessClasses(li), `${m}`).toHaveLength(1);
    }
  });
});

/**
 * The Exits panel's "Sort by Accessibility (Original)" sort reads region reachability through `isRegionReachable`
 * (region-view-findings; `CC/docs/region-map/findings-fix.md`).
 *
 * The defect: the sort tested `regionReachability[r] === true || === 'checked'`. The state manager writes only
 * `'reachable'` / `'unreachable'` (measured in every live snapshot, the findings census), so EVERY region read as
 * locked: every exit landed in `parent_locked_rule_ok` or `parent_locked_rule_fails`, and a traversable exit sorted
 * behind nothing but its original index. The `accessibility` sort (`isRegionReachable` since region-view-dedup) put
 * the same exit first.
 *
 * The snapshot below is a cut of a real one: alttp seed 1, the initial load (S1), its exits named as the preset names
 * them, its `regionReachability` values as the live snapshot held them, and the exits in the preset's original order.
 *
 * Mutant: put the `=== true || === 'checked'` pair back in `exitUI.js`'s `accessibility_original` branch and the
 * first row reads the BEFORE order.
 *
 * The test drives the REAL `ExitUI.prototype.updateExitDisplay` (the sort and the card loop) against a permissive fake
 * DOM, and reads the order back off the cards' `data-exit`.
 */
import { describe, it, expect, vi } from 'vitest';

vi.spyOn(console, 'log').mockImplementation(() => {}); // exitUI's own info lines

let snapshot = null;
let staticData = null;
let originalOrder = [];
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async () => undefined } }));
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => snapshot,
    getStaticData: () => staticData,
    getOriginalExitOrder: () => originalOrder,
  },
}));
// A rule here is `{ pass: boolean }`: the sort sees what a real evaluation would return.
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.pass }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../discovery/singleton.js', () => ({
  default: { isRegionDiscovered: () => true, isExitDiscovered: () => true },
}));
vi.mock('../commonUI/index.js', () => ({
  default: { applyColorblindSymbol: () => {}, createRegionLink: () => fakeNode() },
  debounce: (f) => f,
  renderLogicTree: () => fakeNode(),
  resetUnknownEvaluationCounter: () => {},
  logAndGetUnknownEvaluationCounter: () => 0,
}));
vi.mock('./index.js', () => ({ getModuleEventBus: () => null }));

/** A node that accepts anything: real `children`, `dataset`, `style`, `classList`; any other method is a no-op. */
function fakeNode() {
  const classes = new Set();
  const node = {
    children: [],
    dataset: {},
    style: {},
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => ((force ?? !classes.has(c)) ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    appendChild(c) { node.children.push(c); return c; },
  };
  return new Proxy(node, {
    get: (t, k) => (k in t ? t[k] : (typeof k === 'symbol' ? undefined : () => fakeNode())),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
globalThis.document = {
  createElement: () => fakeNode(),
  createDocumentFragment: () => fakeNode(),
  createTextNode: () => fakeNode(),
};

const { ExitUI } = await import('./exitUI.js');

/** The panel's controls: every filter box ticked, the sort set to `sortMethod`, no search. */
function panel(sortMethod) {
  const controls = {
    '#exit-show-traversable': { checked: true },
    '#exit-show-non-traversable': { checked: true },
    '#exit-show-explored': { checked: true },
    '#exit-show-undiscovered': { checked: true },
    '#exit-sort-select': { value: sortMethod },
    '#exit-search': { value: '' },
  };
  return {
    isInitialized: true,
    rootElement: { querySelector: (sel) => controls[sel] ?? null },
    exitsGrid: fakeNode(),
    originalExitOrder: originalOrder,
    columns: 2,
    colorblindSettings: false,
    isDiscoveryModeActive: false,
    discoverySettings: {},
  };
}

/** The rendered order, read off the cards. */
function render(sortMethod) {
  const ui = panel(sortMethod);
  ExitUI.prototype.updateExitDisplay.call(ui);
  const [fragment] = ui.exitsGrid.children;
  return fragment.children.map((card) => ({
    name: JSON.parse(decodeURIComponent(card.dataset.exit)).name,
    state: card.classList.contains('traversable') ? 'traversable' : 'locked',
  }));
}

function load(exits, reach) {
  snapshot = { regionReachability: reach, checkedLocations: [] };
  staticData = {
    exits: new Map(exits.map(([name, parentRegion, connectedRegion, pass]) =>
      [name, { name, parentRegion, connectedRegion, access_rule: { pass } }])),
    items: new Map(),
    regions: new Map(),
  };
  originalOrder = exits.map(([name]) => name);
}
const names = (rows) => rows.map((r) => r.name);

// alttp seed 1 at S1 (the initial load), from the live snapshot: five of its 391 exits, in the preset's original
// order (their original indexes 0, 2, 70, 72, 73), with their regions' `regionReachability` values and each rule's
// result as the live page held them (the findings census's BEFORE capture, `exits-sort-original.html`).
const ALTTP_S1_EXITS = [
  // [name, parentRegion, connectedRegion, rule passes]  — the card's status at S1
  ['Links House S&Q', 'Menu', 'Links House', true], //                                         Traversable
  ['Old Man S&Q', 'Menu', 'Old Man House', false], //                                          Rule Fails
  ['Death Mountain Entrance Drop', 'Death Mountain Entrance', 'Light World', true], //         From Locked Region, Rule OK
  ['Lake Hylia Central Island Teleporter', 'Lake Hylia Central Island', 'Dark Lake Hylia Central Island', false], // Fully Locked
  ['Hyrule Castle Secret Entrance Exit', 'Hyrule Castle Secret Entrance', 'Hyrule Castle Courtyard', true], // Traversable
];
const ALTTP_S1_REACH = {
  Menu: 'reachable',
  'Links House': 'reachable',
  'Old Man House': 'unreachable',
  'Death Mountain Entrance': 'unreachable',
  'Light World': 'reachable',
  'Lake Hylia Central Island': 'unreachable',
  'Dark Lake Hylia Central Island': 'unreachable',
  'Hyrule Castle Secret Entrance': 'reachable',
  'Hyrule Castle Courtyard': 'reachable',
};

describe("Exits 'Sort by Accessibility (Original)' (alttp seed 1, S1)", () => {
  it('lists the traversable exits first, then by status, then in original order', () => {
    load(ALTTP_S1_EXITS, ALTTP_S1_REACH);
    expect(names(render('accessibility_original'))).toEqual([
      'Links House S&Q', //                       traversable
      'Hyrule Castle Secret Entrance Exit', //    traversable
      'Old Man S&Q', //                           parent reachable, rule fails
      'Death Mountain Entrance Drop', //          parent locked, rule OK
      'Lake Hylia Central Island Teleporter', //  parent locked, rule fails
    ]);
    // BEFORE the fix (every 'reachable' region read as locked, so only the rule split the exits) this read:
    //   Links House S&Q, Death Mountain Entrance Drop, Hyrule Castle Secret Entrance Exit, Old Man S&Q,
    //   Lake Hylia Central Island Teleporter
  });

  it("differs from 'Sort by Accessibility (Name)' only in the tie-break inside a status", () => {
    load(ALTTP_S1_EXITS, ALTTP_S1_REACH);
    expect(names(render('accessibility'))).toEqual([
      'Hyrule Castle Secret Entrance Exit', // the two traversable exits, by NAME
      'Links House S&Q',
      'Old Man S&Q',
      'Death Mountain Entrance Drop',
      'Lake Hylia Central Island Teleporter',
    ]);
    // The cards' own status is unchanged by the sort (it always read isRegionReachable).
    expect(render('accessibility_original').filter((r) => r.state === 'traversable').map((r) => r.name))
      .toEqual(['Links House S&Q', 'Hyrule Castle Secret Entrance Exit']);
  });
});

// The region-view-dedup equivalence space (`regionView/reachabilityCopies.equivalence.test.js`): 15 values.
const VALUES = [true, false, 'reachable', 'checked', 'unreachable', 'locked', 'Reachable', 'true', '', 0, 1, null,
  undefined, {}, []];

describe("'accessibility_original' over the generated space", () => {
  // One exit per (parent value, connected value, rule result): 15 × 15 × 2 = 450 exits. Names follow the original
  // order, so the two accessibility sorts' tie-breaks agree and their orders must be equal.
  const exits = [];
  const reach = {};
  VALUES.forEach((v, i) => { reach[`P${i}`] = v; reach[`C${i}`] = v; });
  let n = 0;
  VALUES.forEach((_, i) => VALUES.forEach((__, j) => [true, false].forEach((pass) => {
    exits.push([`e${String(n++).padStart(3, '0')}`, `P${i}`, `C${j}`, pass]);
  })));

  it('orders every exit exactly as the accessibility sort does', () => {
    load(exits, reach);
    const original = names(render('accessibility_original'));
    expect(original).toHaveLength(450);
    expect(original).toEqual(names(render('accessibility')));
  });

  it("the one intended difference from BEFORE: 32 of 450 exits change status, every one through a 'reachable' region", async () => {
    const legacy = await import('../regionView/legacyReachabilityCopies.testkit.js');
    const { isRegionReachable } = await import('../regionView/regionViewModel.js');
    const status = (p, c, pass) => (p && pass && c ? 0 : p && pass ? 1 : p ? 2 : pass ? 3 : 4);
    const snap = { regionReachability: reach };
    const moved = exits.filter(([, p, c, pass]) => {
      const [bp, bc] = legacy.exitSortOriginalA(snap, { parentRegion: p, connectedRegion: c });
      return status(bp, bc, pass) !== status(isRegionReachable(snap, p), isRegionReachable(snap, c), pass);
    });
    expect(moved.every(([, p, c]) => reach[p] === 'reachable' || reach[c] === 'reachable')).toBe(true);
    expect(moved).toHaveLength(32);
  });
});

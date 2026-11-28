/**
 * The Regions panel's loading state keeps its skeleton (`regionsLoadingState.js`).
 *
 * The defect (measured 2026-11-24 at 817d620e30, `CC/docs/region-map/walk-order.md`): `renderAllRegions` bailed for
 * want of data during a world load and wrote `regionsContainer.innerHTML = '<p>Loading region data...</p>'`. That
 * destroyed `#available-content` and the other sections the renderer only looks up, so every later render drew
 * nothing ("available-content element not found") and the panel said "Loading region data..." until a reload.
 *
 * The DOM is a minimal stand-in whose `innerHTML` setter drops the element's children, as the real one does: that
 * is the half of the defect the fake has to get right. The bail runs through the REAL `RegionUI.renderAllRegions`
 * (its imports mocked), and the render after it through the REAL `RegionRenderer.renderRegions`.
 *
 * Mutant: put the old `this.regionsContainer.innerHTML = '<p>Loading region data...</p>'` back in the bail and the
 * "bail keeps the skeleton" row goes red; drop the `clearRegionsLoading` call and the "render after the bail" row does.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sm = vi.hoisted(() => ({ snapshot: null, staticData: null }));

vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => sm.snapshot,
    getStaticData: () => sm.staticData,
    getOriginalRegionOrder: () => [],
  },
}));
vi.mock('../pathAnalyzer/index.js', () => ({ PathAnalyzerUI: class {} }));
vi.mock('../commonUI/index.js', () => ({
  default: {},
  debounce: (fn) => fn,
  resetUnknownEvaluationCounter: () => {},
  logAndGetUnknownEvaluationCounter: () => 0,
}));
vi.mock('../client/core/messageHandler.js', () => ({ default: {} }));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async () => undefined } }));
vi.mock('./index.js', () => ({ moduleDispatcher: null, getModuleEventBus: () => null }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));

import { RegionUI } from './regionUI.js';
import { RegionRenderer } from './regionRenderer.js';
import { REGIONS_LOADING_CLASS, REGIONS_LOADING_TEXT, clearRegionsLoading, showRegionsLoading } from './regionsLoadingState.js';

/** A DOM element, enough for the loading state and the renderer: ids, classes, children, attributes. */
class El {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = []; this.parent = null;
    this.attrs = new Map(); this.style = {}; this.className = ''; this._text = '';
  }
  get id() { return this.attrs.get('id') ?? ''; }
  set id(v) { this.attrs.set('id', v); }
  get hidden() { return this.attrs.has('hidden'); }
  set hidden(v) { if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); }
  removeAttribute(n) { this.attrs.delete(n); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  /** As the real setter: the old children are gone (this fake only ever assigns text or ''). */
  set innerHTML(v) { this.children.forEach((c) => { c.parent = null; }); this.children = []; this._text = String(v).replace(/<[^>]*>/g, ''); }
  appendChild(c) { c.parent?.children.splice(c.parent.children.indexOf(c), 1); c.parent = this; this.children.push(c); return c; }
  prepend(c) { c.parent = this; this.children.unshift(c); }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  *descendants() { for (const c of this.children) { yield c; yield* c.descendants(); } }
  querySelector(sel) {
    const m = /^([#.])([\w-]+)$/.exec(sel);
    if (!m) throw new Error(`fake querySelector: unsupported ${sel}`);
    for (const d of this.descendants()) {
      if (m[1] === '#' ? d.id === m[2] : d.className.split(/\s+/).includes(m[2])) return d;
    }
    return null;
  }
}
const doc = { createElement: (tag) => new El(doc, tag) };
const el = (tag, id, ...kids) => { const e = doc.createElement(tag); if (id) e.id = id; kids.forEach((k) => e.appendChild(k)); return e; };

/** `#region-details-container` as `RegionUI.createRootElement` builds it. */
function skeleton() {
  return el('div', 'region-details-container',
    el('div', 'accessibility-sorted-sections',
      el('div', 'available-regions-section', el('div', 'available-content')),
      el('div', 'unavailable-regions-section', el('div', 'unavailable-content'))),
    el('div', 'general-sorted-list-section', el('div', 'general-sorted-list-content')));
}
const IDS = ['accessibility-sorted-sections', 'available-content', 'unavailable-content', 'general-sorted-list-section', 'general-sorted-list-content'];
const missing = (c) => IDS.filter((id) => !c.querySelector(`#${id}`));

/** The fields `renderAllRegions` reads before it draws; `#region-sort-select` absent ends it right after the data check. */
const panel = (container) => ({
  isInitialized: true,
  regionsContainer: container,
  originalRegionOrder: ['Menu'],
  displaySettings: { getSetting: () => false },
  rootElement: { querySelector: () => null },
});

beforeEach(() => { sm.snapshot = null; sm.staticData = null; });

describe('Regions panel: the loading state keeps the skeleton', () => {
  it('showRegionsLoading: message shown, sections hidden and emptied, none destroyed; clear puts them back', () => {
    const c = skeleton();
    c.querySelector('#available-content').appendChild(el('div', 'stale-block'));
    showRegionsLoading(c);
    showRegionsLoading(c); // idempotent
    expect(missing(c)).toEqual([]);
    expect(c.children.filter((k) => k.className === REGIONS_LOADING_CLASS)).toHaveLength(1);
    expect(c.querySelector(`.${REGIONS_LOADING_CLASS}`).textContent).toBe(REGIONS_LOADING_TEXT);
    expect(c.querySelector('#stale-block')).toBeNull();
    expect(c.querySelector('#accessibility-sorted-sections').hidden).toBe(true);
    expect(c.querySelector('#general-sorted-list-section').hidden).toBe(true);
    clearRegionsLoading(c);
    expect(c.querySelector(`.${REGIONS_LOADING_CLASS}`)).toBeNull();
    expect(c.querySelector('#accessibility-sorted-sections').attrs.has('hidden')).toBe(false);
    expect(c.querySelector('#general-sorted-list-section').attrs.has('hidden')).toBe(false);
    expect(missing(c)).toEqual([]);
  });

  it('the REAL renderAllRegions bail (no snapshot mid world load) keeps the skeleton and shows the message', () => {
    const c = skeleton();
    RegionUI.prototype.renderAllRegions.call(panel(c));
    expect(missing(c)).toEqual([]);
    expect(c.textContent).toBe(REGIONS_LOADING_TEXT);
  });

  it('the render after the bail clears the message, and the REAL renderer finds every section', () => {
    const c = skeleton();
    const ui = panel(c);
    RegionUI.prototype.renderAllRegions.call(ui);
    sm.snapshot = {}; sm.staticData = { regions: new Map(), items: new Map() };
    RegionUI.prototype.renderAllRegions.call(ui);
    expect(c.querySelector(`.${REGIONS_LOADING_CLASS}`)).toBeNull();

    const renderer = new RegionRenderer(null);
    const frag = { available: el('div', 'a-frag'), unavailable: el('div', 'u-frag'), general: el('div', 'g-frag') };
    renderer.buildRegionFragments = () => frag;
    renderer.renderRegions(c, [], {}, {}, {}, { sortMethod: 'accessibility' });
    expect(c.querySelector('#available-content').querySelector('#a-frag')).not.toBeNull();
    expect(c.querySelector('#unavailable-content').querySelector('#u-frag')).not.toBeNull();
    expect(c.querySelector('#general-sorted-list-content').querySelector('#g-frag')).not.toBeNull();
    expect(c.querySelector('#accessibility-sorted-sections').style.display).toBe('block');
    expect(c.querySelector('#general-sorted-list-section').style.display).toBe('none');
  });
});

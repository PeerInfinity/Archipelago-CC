/**
 * sdc-offer-tab-marker: the Console tab shows " •" while an offline-progress offer waits
 * and the panel is not visible (offerTabMarker.js). DOM only: Golden Layout's setTitle is
 * never called, so the layout config cannot carry the marker.
 *
 * The suite runs in node (no jsdom here), so the tab is a small fake element with
 * the few DOM calls the marker makes; the container is a fake GL ComponentContainer
 * (visible, tab, on/off/emit). Real saveLayout() byte-identity is checked live.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createOfferTabMarker,
  OFFER_TAB_CLASS,
  OFFER_MARKER_CLASS,
  OFFER_MARKER_TEXT,
  OFFER_TOOLTIP_SUFFIX,
} from './offerTabMarker.js';

// ── a fake DOM, just enough ─────────────────────────────────────────────────
class FakeEl {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.style = {};
    this.textContent = '';
    this._classes = new Set();
    const self = this;
    this.classList = {
      add: (...c) => c.forEach((x) => self._classes.add(x)),
      remove: (...c) => c.forEach((x) => self._classes.delete(x)),
      contains: (c) => self._classes.has(c),
    };
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  prepend(c) { c.parentNode = this; this.children.unshift(c); }
  after(c) {
    const p = this.parentNode;
    c.parentNode = p;
    p.children.splice(p.children.indexOf(this) + 1, 0, c);
  }
  remove() {
    const p = this.parentNode;
    if (p) p.children.splice(p.children.indexOf(this), 1);
    this.parentNode = null;
  }
  // Only the selectors the marker uses: ':scope > .cls' and '.cls' (children only).
  querySelectorAll(sel) {
    const cls = sel.replace(/^:scope > /, '').replace(/^\./, '');
    return this.children.filter((c) => c.classList.contains(cls));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  // What a person reads on the tab: title text then the marker span.
  get renderedText() { return this.children.map((c) => c.textContent).join(''); }
}
const doc = { createElement: (t) => new FakeEl(doc, t) };

/** A GL Tab: .lm_tab element holding .lm_title and .lm_close_tab; setTitle like GL's. */
function fakeTab(title, { withTitleAttr = true } = {}) {
  const element = new FakeEl(doc, 'div');
  element.classList.add('lm_tab');
  const titleElement = new FakeEl(doc, 'span');
  titleElement.classList.add('lm_title');
  const close = new FakeEl(doc, 'div');
  close.classList.add('lm_close_tab');
  element.appendChild(titleElement);
  element.appendChild(close);
  const tab = {
    element,
    titleElement,
    setTitle(t) { titleElement.textContent = t; element.setAttribute('title', t); },
  };
  titleElement.textContent = title;
  if (withTitleAttr) element.setAttribute('title', title);
  return tab;
}

/** A GL ComponentContainer with a ComponentItem behind it (whose title is the config's). */
function fakeContainer({ visible = false, title = 'Console', tabOpts } = {}) {
  const handlers = new Map();
  const item = { title, setTitle: vi.fn((t) => { item.title = t; }) };
  const tab = fakeTab(title, tabOpts);
  const c = {
    visible,
    tab,
    item,
    setTitle: vi.fn((t) => item.setTitle(t)),
    focus: vi.fn(),
    on: (ev, cb) => { if (!handlers.has(ev)) handlers.set(ev, []); handlers.get(ev).push(cb); },
    off: (ev, cb) => { handlers.set(ev, (handlers.get(ev) ?? []).filter((h) => h !== cb)); },
    emit: (ev, arg) => (handlers.get(ev) ?? []).slice().forEach((h) => h(arg)),
    listenerCount: () => [...handlers.values()].reduce((n, l) => n + l.length, 0),
    // GL's setVisibility: the flag flips, then show/hide is emitted.
    setVisibility(v) { if (c.visible === v) return; c.visible = v; c.emit(v ? 'show' : 'hide'); },
    setTab(t) { c.tab = t; c.emit('tab', t); },
    // What saveLayout() serialises for this component.
    toConfig: () => JSON.stringify({ type: 'component', componentType: 'clientPanel', title: item.title }),
  };
  return c;
}

function fakeBus() {
  const subs = new Map();
  return {
    subscribe: vi.fn((ev, cb) => { if (!subs.has(ev)) subs.set(ev, []); subs.get(ev).push(cb); }),
    unsubscribe: vi.fn((ev, cb) => { subs.set(ev, (subs.get(ev) ?? []).filter((h) => h !== cb)); }),
    publish: (ev, d) => (subs.get(ev) ?? []).slice().forEach((h) => h(d)),
    count: () => [...subs.values()].reduce((n, l) => n + l.length, 0),
  };
}

/** The messageHandler side: an offer opens/closes and the events go out, as messageHandler does. */
function harness(opts) {
  const container = fakeContainer(opts);
  const bus = fakeBus();
  let offer = null;
  const marker = createOfferTabMarker({ container, bus, getOffer: () => offer });
  const open = () => {
    offer = { key: 'k', count: 3, goal: false, message: 'm' };
    bus.publish('client:offlineProgressOffer', offer);
  };
  const close = (choice) => {
    if (!offer) return;
    offer = null;
    bus.publish('client:offlineProgressOfferClosed', { choice });
  };
  return { container, bus, marker, open, close };
}

const isMarked = (tab) =>
  tab.element.classList.contains(OFFER_TAB_CLASS) && tab.element.querySelectorAll(`.${OFFER_MARKER_CLASS}`).length === 1;

// ── rows ───────────────────────────────────────────────────────────────────
describe('offer tab marker', () => {
  it('marks the tab when an offer opens while the panel is hidden', () => {
    const h = harness({ visible: false });
    expect(isMarked(h.container.tab)).toBe(false);
    h.open();
    expect(isMarked(h.container.tab)).toBe(true);
    expect(h.container.tab.element.renderedText).toBe(`Console${OFFER_MARKER_TEXT}`);
    expect(h.container.tab.element.getAttribute('title')).toBe(`Console${OFFER_TOOLTIP_SUFFIX}`);
    // The span sits right after the title, before the close button.
    expect(h.container.tab.element.children.map((c) => c.className)).toEqual(['lm_title', OFFER_MARKER_CLASS, 'lm_close_tab']);
  });

  it('does not mark a visible panel (active tab, or side by side with the game)', () => {
    const h = harness({ visible: true });
    h.open();
    expect(isMarked(h.container.tab)).toBe(false);
    expect(h.container.tab.element.getAttribute('title')).toBe('Console');
  });

  it.each(['send', 'later', 'discard'])('clears on the answer %s, title and tooltip exactly restored', (choice) => {
    const h = harness({ visible: false });
    h.open();
    h.close(choice);
    expect(isMarked(h.container.tab)).toBe(false);
    expect(h.container.tab.element.children.map((c) => c.className)).toEqual(['lm_title', 'lm_close_tab']);
    expect(h.container.tab.element.renderedText).toBe('Console');
    expect(h.container.tab.element.getAttribute('title')).toBe('Console');
    expect(h.container.tab.element.classList.contains(OFFER_TAB_CLASS)).toBe(false);
  });

  it('clears when the offer goes away without an answer (rules loaded, disconnect: closed with choice null)', () => {
    const h = harness({ visible: false });
    h.open();
    h.close(null);
    expect(isMarked(h.container.tab)).toBe(false);
    expect(h.container.tab.element.getAttribute('title')).toBe('Console');
  });

  it('repeated offers do not stack markers, and many cycles leave no drift', () => {
    const h = harness({ visible: false, title: 'Client' });
    const before = JSON.stringify([...h.container.tab.element.attrs]) + h.container.tab.element.renderedText;
    for (let i = 0; i < 5; i++) {
      h.open();
      h.open(); // a re-offer while one is open (messageHandler closes then re-opens; both orders converge)
      expect(h.container.tab.element.querySelectorAll(`.${OFFER_MARKER_CLASS}`)).toHaveLength(1);
      expect(h.container.tab.element.getAttribute('title')).toBe(`Client${OFFER_TOOLTIP_SUFFIX}`);
      h.close('later');
    }
    expect(JSON.stringify([...h.container.tab.element.attrs]) + h.container.tab.element.renderedText).toBe(before);
  });

  it('showing the panel hides the marker only while it shows; it returns if the offer is still open', () => {
    const h = harness({ visible: false });
    h.open();
    h.container.setVisibility(true);
    expect(isMarked(h.container.tab)).toBe(false);
    expect(h.container.tab.element.getAttribute('title')).toBe('Console');
    h.container.setVisibility(false);
    expect(isMarked(h.container.tab)).toBe(true);
    h.close('send');
    h.container.setVisibility(true);
    h.container.setVisibility(false);
    expect(isMarked(h.container.tab)).toBe(false);
  });

  it('never activates a tab, moves focus, or calls setTitle; the layout config is byte-identical', () => {
    const h = harness({ visible: false });
    const configBefore = h.container.toConfig();
    h.open();
    expect(h.container.toConfig()).toBe(configBefore);
    h.container.setVisibility(true);
    h.container.setVisibility(false);
    h.close('discard');
    expect(h.container.toConfig()).toBe(configBefore);
    expect(h.container.setTitle).not.toHaveBeenCalled();
    expect(h.container.item.setTitle).not.toHaveBeenCalled();
    expect(h.container.focus).not.toHaveBeenCalled();
    expect(h.container.visible).toBe(false); // nothing raised the panel
  });

  it('restores a tab that had no title attribute to having none', () => {
    const h = harness({ visible: false, tabOpts: { withTitleAttr: false } });
    h.open();
    expect(h.container.tab.element.getAttribute('title')).toBe(OFFER_TOOLTIP_SUFFIX);
    h.close('later');
    expect(h.container.tab.element.hasAttribute('title')).toBe(false);
  });

  it("leaves the tooltip alone when GL's own setTitle rewrote it while marked", () => {
    const h = harness({ visible: false });
    h.open();
    h.container.tab.setTitle('Renamed');
    h.close('send');
    expect(h.container.tab.element.getAttribute('title')).toBe('Renamed');
    expect(h.container.tab.element.renderedText).toBe('Renamed');
  });

  it("re-applies on the 'tab' event (panel dragged to another stack) and unmarks the old tab", () => {
    const h = harness({ visible: false });
    h.open();
    const oldTab = h.container.tab;
    const newTab = fakeTab('Console');
    h.container.setTab(newTab);
    expect(isMarked(newTab)).toBe(true);
    expect(isMarked(oldTab)).toBe(false);
    expect(oldTab.element.getAttribute('title')).toBe('Console');
  });

  it('marks an offer already open when the panel mounts (tab arrives later)', () => {
    const container = fakeContainer({ visible: false });
    const tab = container.tab;
    container.tab = undefined; // GL sets the tab after the component is constructed
    const bus = fakeBus();
    createOfferTabMarker({ container, bus, getOffer: () => ({ key: 'k' }) });
    container.setTab(tab);
    expect(isMarked(tab)).toBe(true);
  });

  it('after dispose(): unmarked, listeners gone, later events mark nothing and throw nothing', () => {
    const h = harness({ visible: false });
    h.open();
    h.marker.dispose();
    expect(isMarked(h.container.tab)).toBe(false);
    expect(h.container.tab.element.getAttribute('title')).toBe('Console');
    expect(h.bus.count()).toBe(0);
    expect(h.container.listenerCount()).toBe(0);
    expect(() => {
      h.open();
      h.container.setVisibility(true);
      h.container.setVisibility(false);
      h.container.setTab(fakeTab('Console'));
      h.marker.update();
      h.marker.dispose();
    }).not.toThrow();
    expect(isMarked(h.container.tab)).toBe(false);
  });

  it('a remounted panel: the dead instance marks nothing, the live one marks its own tab', () => {
    const bus = fakeBus();
    let offer = null;
    const dead = fakeContainer({ visible: false });
    const m1 = createOfferTabMarker({ container: dead, bus, getOffer: () => offer });
    m1.dispose();
    const live = fakeContainer({ visible: false });
    createOfferTabMarker({ container: live, bus, getOffer: () => offer });
    offer = { key: 'k' };
    bus.publish('client:offlineProgressOffer', offer);
    expect(isMarked(dead.tab)).toBe(false);
    expect(isMarked(live.tab)).toBe(true);
  });
});

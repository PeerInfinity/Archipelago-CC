/**
 * rulesLoadFailedNotice: the page's visible named error for `stateManager:loadFailed`.
 * The formatter is pinned exactly; the install is driven against a minimal fake DOM
 * and bus (vitest runs in node here). The browser row
 * (test_core_rules_load_failed_named, coreTests.js) drives the real page.
 */

import { describe, expect, it } from 'vitest';

import {
  RULES_LOAD_FAILED_BANNER_ID,
  formatRulesLoadFailure,
  installRulesLoadFailedNotice,
} from './rulesLoadFailedNotice.js';

const FAILURE = {
  game: 'Procgen Maze', player: '1', phase: 'processStartingItems', where: null,
  message: 'region.exits is not iterable', source: 'broken.json',
};

describe('formatRulesLoadFailure', () => {
  it('names the game, the player, the phase and the message', () => {
    expect(formatRulesLoadFailure(FAILURE)).toEqual({
      title: 'The rules could not be loaded.',
      lines: [
        'Game: Procgen Maze',
        'Player: 1',
        'Phase: processStartingItems',
        'Error: region.exits is not iterable',
        'Rules file: broken.json',
      ],
    });
  });

  it('adds the region when the loader had one', () => {
    const { lines } = formatRulesLoadFailure({ ...FAILURE, phase: 'loadPlayerData/loadLocations', where: 'region_2_2' });
    expect(lines[2]).toBe("Phase: loadPlayerData/loadLocations (region 'region_2_2')");
  });

  it('a missing field is named as missing, never blank', () => {
    expect(formatRulesLoadFailure({}).lines).toEqual([
      'Game: unknown game', 'Player: unknown player', 'Phase: unknown phase', 'Error: no message',
    ]);
  });
});

/** Just enough DOM for the banner. */
function fakeDoc() {
  const byId = new Map();
  const make = (tag) => {
    const el = {
      tag, id: '', style: {}, children: [], textContent: '', className: '', attrs: {},
      classList: { added: new Set(), add(c) { this.added.add(c); } },
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(type, fn) { this[`on${type}`] = fn; },
      append(...kids) { this.children.push(...kids); },
      appendChild(kid) { this.children.push(kid); kid.parent = this; if (kid.id) byId.set(kid.id, kid); return kid; },
      remove() {
        if (byId.get(this.id) === this) byId.delete(this.id);
        if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
      },
    };
    return el;
  };
  const body = make('body');
  const loading = make('div');
  loading.id = 'loading-screen';
  byId.set('loading-screen', loading);
  return { body, loading, createElement: make, getElementById: (id) => byId.get(id) || null };
}

function fakeBus() {
  const subs = new Map();
  return {
    subscribe: (ev, fn) => { subs.set(ev, [...(subs.get(ev) || []), fn]); },
    unsubscribe: (ev, fn) => { subs.set(ev, (subs.get(ev) || []).filter((f) => f !== fn)); },
    emit: (ev, data) => (subs.get(ev) || []).forEach((fn) => fn(data)),
    count: (ev) => (subs.get(ev) || []).length,
  };
}

describe('installRulesLoadFailedNotice', () => {
  it('shows one banner on loadFailed, hides the loading screen, and a good load removes it', () => {
    const doc = fakeDoc();
    const bus = fakeBus();
    const uninstall = installRulesLoadFailedNotice(bus, doc);
    bus.emit('stateManager:loadFailed', FAILURE);
    bus.emit('stateManager:loadFailed', FAILURE); // a second failure replaces, never stacks
    const banner = doc.getElementById(RULES_LOAD_FAILED_BANNER_ID);
    expect(banner).toBeTruthy();
    expect(doc.body.children.filter((c) => c.id === RULES_LOAD_FAILED_BANNER_ID)).toHaveLength(1);
    expect(banner.attrs.role).toBe('alert');
    expect(banner.children[1].textContent).toContain('Phase: processStartingItems');
    expect(doc.loading.classList.added.has('hidden')).toBe(true);
    bus.emit('stateManager:rulesLoaded', {});
    expect(doc.getElementById(RULES_LOAD_FAILED_BANNER_ID)).toBe(null);
    uninstall();
    expect(bus.count('stateManager:loadFailed')).toBe(0);
    expect(bus.count('stateManager:rulesLoaded')).toBe(0);
  });
});

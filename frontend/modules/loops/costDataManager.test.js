/**
 * Tests for CostDataManager — caches per-region/per-location mana
 * costs loaded from sidecar files or generated in-memory.
 *
 * Stubs fetch and the eventBus.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CostDataManager } from './costDataManager.js';

function makeBus() {
  const events = [];
  return {
    events,
    publish: (name, data) => events.push({ name, data }),
  };
}

function validData(extra = {}) {
  return {
    regions: { Forest: { moveCost: 30 }, Cave: { moveCost: 70 } },
    locations: { Loc1: 90, Loc2: 110 },
    defaultRegionCost: 50,
    defaultLocationCost: 100,
    ...extra,
  };
}

describe('CostDataManager — getters with no data loaded', () => {
  let mgr;
  beforeEach(() => {
    mgr = new CostDataManager();
  });

  it('isLoaded() returns false initially', () => {
    expect(mgr.isLoaded()).toBe(false);
  });

  it('getRegionCost falls back to default 50', () => {
    expect(mgr.getRegionCost('Anywhere')).toBe(50);
  });

  it('getLocationCost falls back to default 100', () => {
    expect(mgr.getLocationCost('Anywhere')).toBe(100);
  });

  it('getRegionXpEffect returns the global default ("cost")', () => {
    expect(mgr.getRegionXpEffect('Anywhere')).toBe('cost');
  });

  it('getCostData returns null', () => {
    expect(mgr.getCostData()).toBeNull();
  });

  it('exportToJSON returns null', () => {
    expect(mgr.exportToJSON()).toBeNull();
  });

  it('getStatus reflects empty state', () => {
    const s = mgr.getStatus();
    expect(s).toMatchObject({
      isLoaded: false,
      isLoading: false,
      regionCount: 0,
      locationCount: 0,
    });
  });
});

describe('CostDataManager — setCostData and lookups', () => {
  let mgr, bus;
  beforeEach(() => {
    bus = makeBus();
    mgr = new CostDataManager(bus);
  });

  it('setCostData stores valid data and publishes loaded event', () => {
    expect(mgr.setCostData(validData(), 'unit-test')).toBe(true);
    expect(mgr.isLoaded()).toBe(true);
    const evt = bus.events.find(e => e.name === 'costDataManager:loaded');
    expect(evt.data).toMatchObject({ source: 'unit-test', regionCount: 2, locationCount: 2 });
  });

  it('setCostData rejects malformed data', () => {
    expect(mgr.setCostData(null)).toBe(false);
    expect(mgr.setCostData({})).toBe(false);
    expect(mgr.setCostData({ regions: {} })).toBe(false); // missing locations
    expect(mgr.setCostData({ locations: {} })).toBe(false); // missing regions
  });

  it('getRegionCost prefers per-region moveCost', () => {
    mgr.setCostData(validData());
    expect(mgr.getRegionCost('Forest')).toBe(30);
    expect(mgr.getRegionCost('Cave')).toBe(70);
  });

  it('getRegionCost falls back to defaultRegionCost when region missing', () => {
    mgr.setCostData(validData());
    expect(mgr.getRegionCost('Unknown')).toBe(50);
  });

  it('getRegionCost falls back to literal 50 when defaultRegionCost is missing', () => {
    mgr.setCostData({ regions: { A: { moveCost: 10 } }, locations: {} });
    expect(mgr.getRegionCost('B')).toBe(50);
  });

  it('getLocationCost prefers per-location numeric cost', () => {
    mgr.setCostData(validData());
    expect(mgr.getLocationCost('Loc1')).toBe(90);
  });

  it('getLocationCost falls back to defaultLocationCost when location missing', () => {
    mgr.setCostData(validData());
    expect(mgr.getLocationCost('Unknown')).toBe(100);
  });

  it('getLocationCost falls back to literal 100 when defaultLocationCost is missing', () => {
    mgr.setCostData({ regions: {}, locations: { L: 5 } });
    expect(mgr.getLocationCost('Other')).toBe(100);
  });
});

describe('CostDataManager — getRegionXpEffect resolution', () => {
  let mgr;
  beforeEach(() => {
    mgr = new CostDataManager();
  });

  it('returns per-region xpEffect when set', () => {
    mgr.setCostData({
      regions: { A: { moveCost: 20, xpEffect: 'speed' } },
      locations: {},
    });
    expect(mgr.getRegionXpEffect('A')).toBe('speed');
  });

  it('falls back to defaultRegionXpEffect when per-region missing', () => {
    mgr.setCostData({
      regions: { A: { moveCost: 20 } },
      locations: {},
      defaultRegionXpEffect: 'both',
    });
    expect(mgr.getRegionXpEffect('A')).toBe('both');
  });

  it('falls back to global default ("cost") when neither set', () => {
    mgr.setCostData(validData());
    expect(mgr.getRegionXpEffect('Forest')).toBe('cost');
  });

  it('normalizes invalid xpEffect strings to the default', () => {
    mgr.setCostData({
      regions: { A: { moveCost: 20, xpEffect: 'banana' } },
      locations: {},
    });
    expect(mgr.getRegionXpEffect('A')).toBe('cost');
  });
});

describe('CostDataManager — applyEmbeddedLoopCosts', () => {
  let mgr, bus;
  beforeEach(() => {
    bus = makeBus();
    mgr = new CostDataManager(bus);
  });

  it('applies a valid embedded object and tags loadedFrom with embedded:source', () => {
    expect(mgr.applyEmbeddedLoopCosts(validData(), 'procgenPipeline')).toBe(true);
    expect(mgr.loadedFrom).toBe('embedded:procgenPipeline');
    expect(mgr.isLoaded()).toBe(true);
  });

  it('returns false for null/undefined/non-object', () => {
    expect(mgr.applyEmbeddedLoopCosts(null)).toBe(false);
    expect(mgr.applyEmbeddedLoopCosts(undefined)).toBe(false);
    expect(mgr.applyEmbeddedLoopCosts('not an object')).toBe(false);
  });

  it('skips when embedded.error is set (pipeline failure marker)', () => {
    expect(mgr.applyEmbeddedLoopCosts({ error: 'no sphere log', regions: {}, locations: {} })).toBe(false);
    expect(mgr.isLoaded()).toBe(false);
  });

  it('returns false when embedded payload fails validation', () => {
    expect(mgr.applyEmbeddedLoopCosts({ regions: {} })).toBe(false); // missing locations
  });
});

describe('CostDataManager — loadFromUrl (fetch path)', () => {
  let mgr, bus;
  beforeEach(() => {
    bus = makeBus();
    mgr = new CostDataManager(bus);
  });
  afterEach(() => {
    delete globalThis.fetch;
  });

  it('loads valid data and emits loaded event', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => validData(),
    }));
    const data = await mgr.loadFromUrl('/some/path/costs.json');
    expect(data).not.toBeNull();
    expect(mgr.isLoaded()).toBe(true);
    expect(mgr.loadedFrom).toBe('/some/path/costs.json');
    expect(bus.events.find(e => e.name === 'costDataManager:loaded')).toBeDefined();
  });

  it('emits loadError event and stores loadError on HTTP failure', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' }));
    const result = await mgr.loadFromUrl('/missing.json');
    expect(result).toBeNull();
    expect(mgr.loadError).toContain('404');
    expect(bus.events.find(e => e.name === 'costDataManager:loadError')).toBeDefined();
  });

  it('rejects malformed payloads even on a 200 response', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const result = await mgr.loadFromUrl('/bad.json');
    expect(result).toBeNull();
    expect(mgr.loadError).toContain('Invalid');
  });

  it('returns null when called concurrently while another load is in flight', async () => {
    let resolveFirst;
    globalThis.fetch = vi.fn(() => new Promise((resolve) => {
      resolveFirst = () => resolve({
        ok: true, status: 200, json: async () => validData(),
      });
    }));
    const first = mgr.loadFromUrl('/a.json');
    const second = await mgr.loadFromUrl('/b.json'); // returns immediately with null
    expect(second).toBeNull();
    resolveFirst();
    await first;
  });

  it('isLoading flag is cleared after both success and failure', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, statusText: 'oops' }));
    await mgr.loadFromUrl('/x.json');
    expect(mgr.isLoading).toBe(false);
  });
});

describe('CostDataManager — loadFromFile (File path)', () => {
  let mgr;
  beforeEach(() => {
    mgr = new CostDataManager();
  });

  it('loads data from a File-like object', async () => {
    const file = {
      name: 'my-costs.json',
      text: async () => JSON.stringify(validData()),
    };
    const data = await mgr.loadFromFile(file);
    expect(data).not.toBeNull();
    expect(mgr.loadedFrom).toBe('file:my-costs.json');
  });

  it('records loadError on JSON parse failure', async () => {
    const file = { name: 'broken.json', text: async () => 'not-json' };
    const result = await mgr.loadFromFile(file);
    expect(result).toBeNull();
    expect(mgr.loadError).toBeTruthy();
  });
});

describe('CostDataManager — tryLoadEmbedded path filtering', () => {
  let mgr;
  beforeEach(() => {
    mgr = new CostDataManager();
  });
  afterEach(() => {
    delete globalThis.fetch;
  });

  it('returns false (no fetch) for synthetic source labels', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    expect(await mgr.tryLoadEmbedded('procgenPipeline')).toBe(false);
    expect(await mgr.tryLoadEmbedded('editorApply')).toBe(false);
    expect(await mgr.tryLoadEmbedded('moduleSpecificConfigProvidedRules')).toBe(false);
    expect(await mgr.tryLoadEmbedded('hardcodedFallback:foo')).toBe(false);
    expect(await mgr.tryLoadEmbedded('')).toBe(false);
    expect(await mgr.tryLoadEmbedded(null)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches and applies embedded loop_costs when the URL resolves', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ loop_costs: validData() }),
    }));
    expect(await mgr.tryLoadEmbedded('/path/to/rules.json')).toBe(true);
    expect(mgr.isLoaded()).toBe(true);
    expect(mgr.loadedFrom).toBe('embedded:/path/to/rules.json');
  });

  it('returns false (no apply) when rules.json has no loop_costs', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    expect(await mgr.tryLoadEmbedded('/path/to/rules.json')).toBe(false);
    expect(mgr.isLoaded()).toBe(false);
  });

  it('returns false on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); });
    expect(await mgr.tryLoadEmbedded('/path/to/rules.json')).toBe(false);
  });
});

describe('CostDataManager — tryLoadFromPreset', () => {
  let mgr;
  beforeEach(() => {
    mgr = new CostDataManager();
  });
  afterEach(() => {
    delete globalThis.fetch;
  });

  it('derives the costs path from the rules path', () => {
    expect(mgr.getCostsPathFromRulesPath('presets/g/AP_X/AP_X_rules.json'))
      .toBe('presets/g/AP_X/AP_X_costs.json');
  });

  it('loads when the preset directory has a costs.json next to it', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => validData() }));
    const data = await mgr.tryLoadFromPreset('presets/g/AP_X/AP_X_rules.json');
    expect(data).not.toBeNull();
    expect(mgr.loadedFrom).toBe('presets/g/AP_X/AP_X_costs.json');
  });

  it('returns null and stays unloaded when costs file is 404', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const result = await mgr.tryLoadFromPreset('presets/g/AP_X/AP_X_rules.json');
    expect(result).toBeNull();
    expect(mgr.isLoaded()).toBe(false);
  });

  it('returns null when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); });
    expect(await mgr.tryLoadFromPreset('presets/g/AP_X/AP_X_rules.json')).toBeNull();
  });
});

describe('CostDataManager — clear / exportToJSON', () => {
  let mgr, bus;
  beforeEach(() => {
    bus = makeBus();
    mgr = new CostDataManager(bus);
    mgr.setCostData(validData());
  });

  it('clear() drops all state and emits a cleared event', () => {
    bus.events.length = 0;
    mgr.clear();
    expect(mgr.isLoaded()).toBe(false);
    expect(mgr.loadedFrom).toBeNull();
    expect(mgr.loadError).toBeNull();
    expect(bus.events.find(e => e.name === 'costDataManager:cleared')).toBeDefined();
  });

  it('exportToJSON round-trips through JSON.parse', () => {
    const text = mgr.exportToJSON();
    expect(typeof text).toBe('string');
    expect(JSON.parse(text)).toMatchObject({ regions: { Forest: { moveCost: 30 } } });
  });

  it('getCostDataForSaving bundles path/filename/content', () => {
    const out = mgr.getCostDataForSaving('presets/g/AP_X/AP_X_rules.json');
    expect(out.path).toBe('presets/g/AP_X/AP_X_costs.json');
    expect(out.filename).toBe('AP_X_costs.json');
    expect(JSON.parse(out.content)).toMatchObject({ regions: { Forest: { moveCost: 30 } } });
  });
});

describe('CostDataManager — explicit-only costs and the time drain (M5)', () => {
  // Summary substrates (runner, bounce) are priced by TIME. Their per-action
  // costs apply only where the sidecar names one EXPLICITLY — a sidecar-level
  // default exists precisely for regions the data did not mention, which is
  // the case that must read as free.
  function loaded(data) {
    const m = new CostDataManager();
    m.setCostData(data, 'test');
    return m;
  }

  const SIDECAR = {
    regions: {
      Costed: { moveCost: 30 },
      Timed: { timeDrainPerSecond: 4 },
      Bare: {},
    },
    locations: { CostedLoc: 70 },
    defaultRegionCost: 50,
    defaultLocationCost: 100,
  };

  it('explicit lookups answer null where the sidecar states nothing', () => {
    const m = loaded(SIDECAR);
    expect(m.getExplicitRegionCost('Costed')).toBe(30);
    expect(m.getExplicitRegionCost('Bare')).toBeNull();
    expect(m.getExplicitRegionCost('Unmentioned')).toBeNull();
    expect(m.getExplicitLocationCost('CostedLoc')).toBe(70);
    expect(m.getExplicitLocationCost('Unmentioned')).toBeNull();

    // ...while the ordinary lookups still answer with the fallbacks. The
    // whole point of the split: the summary economy must not see these.
    expect(m.getRegionCost('Unmentioned')).toBe(50);
    expect(m.getLocationCost('Unmentioned')).toBe(100);
  });

  it('the drain rate falls back per-region → sidecar → 1/s', () => {
    const m = loaded(SIDECAR);
    expect(m.getTimeDrainPerSecond('Timed')).toBe(4);
    expect(m.getTimeDrainPerSecond('Costed')).toBe(1);

    const withDefault = loaded({ ...SIDECAR, defaultTimeDrainPerSecond: 7 });
    expect(withDefault.getTimeDrainPerSecond('Timed')).toBe(4);
    expect(withDefault.getTimeDrainPerSecond('Costed')).toBe(7);

    // Nothing loaded at all → the 1/s default, not a crash.
    expect(new CostDataManager().getTimeDrainPerSecond('Anything')).toBe(1);
  });

  it('a negative rate is clamped to zero (a drain never refunds mana)', () => {
    const m = loaded({ ...SIDECAR, regions: { ...SIDECAR.regions, Timed: { timeDrainPerSecond: -5 } } });
    expect(m.getTimeDrainPerSecond('Timed')).toBe(0);
  });
});

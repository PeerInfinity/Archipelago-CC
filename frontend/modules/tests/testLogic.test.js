/**
 * testLogic auto-start — ONE start per page load, whichever order the two
 * halves arrive in (trap 1426).
 *
 * The start needs the loaded state (applyLoadedState) AND the event bus
 * (setEventBus). Unbundled, applyLoadedState is still importing test cases
 * when the bus arrives; bundled, the cases are pre-imported and it finishes
 * FIRST. Before the fix each arrival started its own loop when it found the
 * other done, so bundled ran two loops at once. These rows drive both orders
 * with a stub roster and count the loops.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The test files discovery failed to import — set per row (slice C6).
const discovery = vi.hoisted(() => ({ importFailures: [] }));

vi.mock('../stateManager/index.js', () => ({ stateManagerProxySingleton: {} }));
vi.mock('./testDiscovery.js', () => ({
  discoverTests: async () => {},
  getDiscoveredTests: () => [
    { id: 'row-a', name: 'Row A', order: 0, category: 'Stub', enabled: true },
    { id: 'row-b', name: 'Row B', order: 1, category: 'Stub', enabled: true },
  ],
  getDiscoveredCategories: () => ({ Stub: {} }),
  getDiscoveredTestFunctionById: () => async () => true,
  getImportFailures: () => discovery.importFailures.map((f) => ({ ...f })),
  isDiscoveryComplete: () => true,
}));

/** A minimal event bus that records what was published. */
function makeBus() {
  const subs = new Map();
  const published = [];
  return {
    published,
    subscribe(name, fn) {
      if (!subs.has(name)) subs.set(name, new Set());
      subs.get(name).add(fn);
    },
    unsubscribe(name, fn) { subs.get(name)?.delete(fn); },
    publish(name, data) {
      published.push(name);
      for (const fn of [...(subs.get(name) || [])]) fn(data);
    },
  };
}

const LOADED = { autoStartTestsOnLoad: true, tests: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let testLogic;
let bus;
let rowStarts;

beforeEach(async () => {
  vi.resetModules();
  globalThis.window = { location: { search: '' } };
  ({ testLogic } = await import('./testLogic.js'));
  bus = makeBus();
  rowStarts = [];
  // A row "runs" for 30 ms and then reports completion, like the real
  // controller's completeTest -> tests:completed.
  vi.spyOn(testLogic, 'runTest').mockImplementation(async (id) => {
    rowStarts.push(id);
    setTimeout(() => bus.publish('tests:completed', { testId: id }), 30);
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  discovery.importFailures = [];
  vi.restoreAllMocks();
  delete globalThis.window;
});

async function untilComplete() {
  for (let i = 0; i < 100 && !window.__playwrightTestsComplete__; i += 1) await sleep(20);
  // Room for a second (wrong) loop to show itself: the old setEventBus site
  // started its loop 1000 ms after the bus arrived, so a shorter grace here
  // passed against the very bug it exists for (measured).
  await sleep(1500);
}

describe('testLogic auto-start', () => {
  it('BUNDLED order (loaded state first, then the bus) starts exactly one run', async () => {
    await testLogic.applyLoadedState(LOADED);
    await testLogic.setEventBus(bus);
    await untilComplete();
    expect(bus.published.filter((n) => n === 'tests:allRunsStarted')).toHaveLength(1);
    expect(rowStarts).toEqual(['row-a', 'row-b']);
    // One completion, from the one loop — not the 30 s race's error summary.
    expect(window.__playwrightTestResults__.summary.totalRun).toBe(2);
    expect(window.__playwrightTestResults__.summary.error).toBeUndefined();
  });

  it('UNBUNDLED order (the bus first, then the loaded state) starts exactly one run', async () => {
    await testLogic.setEventBus(bus);
    await testLogic.applyLoadedState(LOADED);
    await untilComplete();
    expect(bus.published.filter((n) => n === 'tests:allRunsStarted')).toHaveLength(1);
    expect(rowStarts).toEqual(['row-a', 'row-b']);
  });

  it('does not start without auto-start, in either order', async () => {
    await testLogic.applyLoadedState({ autoStartTestsOnLoad: false, tests: [] });
    await testLogic.setEventBus(bus);
    await sleep(300);
    expect(bus.published).not.toContain('tests:allRunsStarted');
    expect(rowStarts).toEqual([]);
  });

  it('a second runAllEnabledTests during a run JOINS it — one loop, each row once', async () => {
    await testLogic.setEventBus(bus);
    await testLogic.applyLoadedState({ autoStartTestsOnLoad: false, tests: [] });
    const first = testLogic.runAllEnabledTests();
    const second = testLogic.runAllEnabledTests();
    expect(second).toBe(first);
    await first;
    expect(rowStarts).toEqual(['row-a', 'row-b']);
    expect(bus.published.filter((n) => n === 'tests:allRunsStarted')).toHaveLength(1);
    // …and once it has finished, a new call starts a fresh run.
    await testLogic.runAllEnabledTests();
    expect(rowStarts).toEqual(['row-a', 'row-b', 'row-a', 'row-b']);
  });
});

describe('the in-app budget override (?autoStartTimeoutMs=)', () => {
  it('reads a positive integer, else the default', async () => {
    const { autoStartTimeoutMsFrom, AUTO_START_TIMEOUT_MS } = await import('./testLogic.js');
    expect(autoStartTimeoutMsFrom('')).toBe(AUTO_START_TIMEOUT_MS);
    expect(autoStartTimeoutMsFrom('?mode=test&autoStartTimeoutMs=90000')).toBe(90000);
    for (const bad of ['0', '-5', '1.5', 'abc', '']) {
      expect(autoStartTimeoutMsFrom(`?autoStartTimeoutMs=${bad}`)).toBe(AUTO_START_TIMEOUT_MS);
    }
  });

  it('an overridden budget expires the run and publishes it as timedOut with THAT budget', async () => {
    // Rows take 30 ms; a 40 ms budget cuts the run inside row-b.
    window.location.search = '?autoStartTimeoutMs=40';
    await testLogic.applyLoadedState(LOADED);
    await testLogic.setEventBus(bus);
    for (let i = 0; i < 100 && !window.__playwrightTestsComplete__; i += 1) await sleep(20);
    const { summary } = window.__playwrightTestResults__;
    expect(summary.timedOut).toBe(true);
    expect(summary.timeoutMs).toBe(40);
    expect(summary.error).toMatch(/^Auto-start timeout after/);
    expect(summary.notRunIds).toContain('row-b');
  });
});

describe('test files that failed to import (slice C6)', () => {
  it('a green roster still CARRIES each import failure in the results', async () => {
    discovery.importFailures = [
      { file: './testCases/brokenTests.js', error: "SyntaxError: Unexpected token ';'" },
    ];
    await testLogic.applyLoadedState(LOADED);
    await testLogic.setEventBus(bus);
    await untilComplete();
    const results = window.__playwrightTestResults__;
    expect(results.summary.failedCount).toBe(0);
    expect(results.summary.importFailureCount).toBe(1);
    expect(results.importFailures).toEqual([
      { file: './testCases/brokenTests.js', error: "SyntaxError: Unexpected token ';'" },
    ]);
  });

  it('none failed → an empty list and a zero count, not an absent field', async () => {
    await testLogic.applyLoadedState(LOADED);
    await testLogic.setEventBus(bus);
    await untilComplete();
    expect(window.__playwrightTestResults__.importFailures).toEqual([]);
    expect(window.__playwrightTestResults__.summary.importFailureCount).toBe(0);
  });
});

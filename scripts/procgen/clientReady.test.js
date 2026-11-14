/**
 * clientReady.js: the probes' wait for the Archipelago client.
 *
 * The page double follows Playwright's waitForFunction semantics: poll the
 * predicate, resolve on the first truthy value (a Promise counts as truthy;
 * that is the trap), reject if the predicate throws or the timeout passes.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  assertSyncPredicate,
  waitForSyncFunction,
  waitForClientReady,
} from './clientReady.js';

function makePage() {
  return {
    waitForFunction: vi.fn((fn, arg, { timeout = 1000, polling = 5 } = {}) =>
      new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          let value;
          try {
            value = fn(arg);
          } catch (error) {
            reject(error);
            return;
          }
          if (value) {
            // Playwright resolves with a handle to the value, never adopting it.
            resolve({ value });
            return;
          }
          if (Date.now() - started >= timeout) {
            reject(new Error(`Timeout ${timeout}ms exceeded.`));
            return;
          }
          setTimeout(tick, polling);
        };
        tick();
      })
    ),
    evaluate: vi.fn(async (fn, arg) => fn(arg)),
  };
}

afterEach(() => {
  delete globalThis.window;
});

describe('the trap this module exists for', () => {
  it('a raw waitForFunction on an async predicate resolves without waiting', async () => {
    // The double reproduces Playwright: never-true page state, yet it resolves.
    globalThis.window = { ready: false };
    const page = makePage();
    const handle = await page.waitForFunction(async () => window.ready, undefined, { timeout: 200 });
    expect(handle.value).toBeInstanceOf(Promise);
    expect(window.ready).toBe(false);
  });
});

describe('assertSyncPredicate / waitForSyncFunction', () => {
  it('refuses an async predicate before it reaches the page', async () => {
    const page = makePage();
    expect(() => assertSyncPredicate(async () => true)).toThrow(/async function/);
    await expect(waitForSyncFunction(page, async () => true)).rejects.toThrow(/treats the Promise/);
    expect(page.waitForFunction).not.toHaveBeenCalled();
  });

  it('fails the wait when a plain predicate returns a Promise', async () => {
    globalThis.window = {};
    const page = makePage();
    await expect(
      waitForSyncFunction(page, () => Promise.resolve(false), undefined, { timeout: 200 })
    ).rejects.toThrow(/returned a Promise/);
  });

  it('waits until a synchronous predicate holds, passing its argument', async () => {
    globalThis.window = { count: 0 };
    const page = makePage();
    const timer = setInterval(() => { window.count += 1; }, 5);
    try {
      await waitForSyncFunction(page, (n) => window.count >= n, 5, { timeout: 2000, polling: 2 });
    } finally {
      clearInterval(timer);
    }
    expect(window.count).toBeGreaterThanOrEqual(5);
  });
});

describe('waitForClientReady', () => {
  it('does not resolve before isReady() turns true', async () => {
    let ready = false;
    globalThis.window = { __apSpike: { isReady: () => ready } };
    const page = makePage();
    let resolved = false;
    const wait = waitForClientReady(page, { timeoutMs: 2000, polling: 5 }).then(() => { resolved = true; });
    await new Promise((r) => setTimeout(r, 60));
    expect(resolved).toBe(false);
    ready = true;
    await wait;
    expect(resolved).toBe(true);
  });

  it('times out naming what it saw', async () => {
    globalThis.window = { __apSpike: { isReady: () => false } };
    await expect(waitForClientReady(makePage(), { timeoutMs: 50, polling: 5 })).rejects.toThrow(
      /not ready within 50 ms: window\.__apSpike\.isReady\(\) is false/
    );
  });

  it('names a page whose client never loaded', async () => {
    globalThis.window = {};
    await expect(waitForClientReady(makePage(), { timeoutMs: 30, polling: 5 })).rejects.toThrow(
      /__apSpike is not defined/
    );
  });

  it('names a tree older than the guard (no isReady)', async () => {
    globalThis.window = { __apSpike: { eventBus: {} } };
    await expect(waitForClientReady(makePage(), { timeoutMs: 30, polling: 5 })).rejects.toThrow(
      /isReady is missing/
    );
  });
});

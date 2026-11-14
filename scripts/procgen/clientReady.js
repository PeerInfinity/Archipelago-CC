/**
 * clientReady: the ONE way a Playwright probe waits for the Archipelago client
 * to be ready before it connects programmatically (slice sdc-early-connect-guard,
 * 2026-11-12).
 *
 * Why it exists: two traps, and together they dropped real-server connects.
 *
 * 1. A connect made before the client module's `initialize()` loses the server's
 *    RoomInfo, because the ApClient has no event bus to publish it on. Nothing then
 *    sends Connect. The Client now refuses such a connect loudly (it throws
 *    `ClientNotReadyError`, `frontend/modules/client/core/apClient.js`), and
 *    `window.__apSpike.isReady()` says when connecting is safe.
 *
 * 2. `page.waitForFunction(async () => ...)` does not wait. An async predicate
 *    returns a Promise, and Playwright treats any Promise as truthy, so the wait
 *    resolves on its first poll (measured 105-178 ms after boot, with nothing
 *    loaded). The same holds for a plain arrow that returns a Promise, such as
 *    `() => import(...).then(...)`.
 *
 * `waitForSyncFunction` refuses an async predicate before it reaches the page, and
 * fails the wait if a predicate returns a Promise at run time. `waitForClientReady`
 * uses it to poll `isReady()`. Usage:
 *
 *     import { waitForClientReady } from '<repo>/scripts/procgen/clientReady.js';
 *     await page.goto(url);
 *     await waitForClientReady(page);            // throws on timeout, with what it saw
 *     await page.evaluate((u) => window.__apSpike.connect(u), wsUrl);
 *
 * Players never hit trap 1: the connect form's listeners attach after
 * initialize, and `?autoConnect=true` connects from postInitialize.
 */

const ASYNC_FUNCTION = Object.getPrototypeOf(async function () {}).constructor;

/** Default wait for the client: a cold boot on a loaded box can take tens of seconds. */
export const CLIENT_READY_TIMEOUT_MS = 90_000;

/**
 * Throws when `predicate` is an async function: Playwright would resolve a wait
 * on it immediately. Returns the predicate otherwise.
 */
export function assertSyncPredicate(predicate, what = 'predicate') {
  if (typeof predicate !== 'function') {
    throw new TypeError(`${what} must be a function, got ${typeof predicate}`);
  }
  if (predicate instanceof ASYNC_FUNCTION) {
    throw new TypeError(
      `${what} is an async function. page.waitForFunction treats the Promise it ` +
        'returns as truthy and resolves at once without waiting. Write it as a ' +
        'synchronous function that reads page state.'
    );
  }
  return predicate;
}

/**
 * `page.waitForFunction` for a synchronous predicate only. The predicate runs in
 * the page with `arg`, as Playwright's would. A predicate declared async is refused
 * here, and one that returns a Promise in the page fails the wait.
 */
export async function waitForSyncFunction(page, predicate, arg = undefined, options = {}) {
  assertSyncPredicate(predicate);
  const source = predicate.toString();
  return page.waitForFunction(
    ({ source: src, arg: value }) => {
      // Indirect eval: rebuild the predicate in the page's global scope.
      const fn = (0, eval)(`(${src})`);
      const result = fn(value);
      if (result && typeof result.then === 'function') {
        throw new Error(
          'waitForSyncFunction: the predicate returned a Promise, which ' +
            'waitForFunction would treat as truthy. Make it synchronous.'
        );
      }
      return result;
    },
    { source, arg },
    options
  );
}

/**
 * Wait until the client can connect: `window.__apSpike.isReady()` is true, i.e.
 * the client module's initialize() has set the event bus. Throws, naming what it
 * saw, if that does not happen within `timeoutMs`.
 */
export async function waitForClientReady(page, { timeoutMs = CLIENT_READY_TIMEOUT_MS, polling = 50 } = {}) {
  try {
    await waitForSyncFunction(
      page,
      () => typeof window.__apSpike?.isReady === 'function' && window.__apSpike.isReady() === true,
      undefined,
      { timeout: timeoutMs, polling }
    );
  } catch (error) {
    let seen = 'unknown (the page could not be read)';
    try {
      seen = await page.evaluate(() => {
        if (!window.__apSpike) return 'window.__apSpike is not defined (the client module has not loaded)';
        if (typeof window.__apSpike.isReady !== 'function') {
          return 'window.__apSpike.isReady is missing (a tree older than the early-connect guard)';
        }
        return 'window.__apSpike.isReady() is false (the client module has not initialised)';
      });
    } catch { /* keep the default */ }
    throw new Error(
      `waitForClientReady: the client was not ready within ${timeoutMs} ms: ${seen}. ` +
        `(${error?.message ?? error})`
    );
  }
}

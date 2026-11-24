/**
 * stateManagerProxy.queryIds.test: every awaited proxy call settles, and the
 * reply it settles with is its own.
 *
 * The defect (sdc-proxy-lost-ping, found live by sdc-offline-progress-op1, about
 * 1 play in 3 of a 100-check offline push): ONE map, `pendingQueries`, held
 * entries keyed by TWO independent counters. `pingWorker` and `sendQueryToWorker`
 * took `nextQueryId` (from 1); `_sendCommand` took `nextMessageId` (from 0). When
 * the two counters met, a `_sendCommand(..., expectResponse=true)` (checkLocation,
 * syncCheckedLocationsFromServer: both fire during a push) registered under the
 * number of a ping still in flight and OVERWROTE its entry. The ping's reply then
 * resolved the command's promise and deleted the entry as `success`; the ping's
 * own caller never heard. Its 5 s timeout did not rescue it either: the timer
 * looked the entry up BY ID, found nothing (or the other caller's entry), and
 * never rejected. The caller waited forever.
 *
 * The worker is faked: it records what was posted and the test answers in the
 * order the live run did (the ping's reply first, then the command's).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

import { StateManagerProxy } from './stateManagerProxy.js';

const originalWorker = globalThis.Worker;
beforeAll(() => {
  globalThis.Worker = class { postMessage() {} terminate() {} addEventListener() {} };
});
afterAll(() => { globalThis.Worker = originalWorker; });
afterEach(() => { vi.useRealTimers(); });

function makeProxy() {
  const proxy = new StateManagerProxy({ publish: () => {}, subscribe: () => () => {} });
  const posted = [];
  proxy.worker = { postMessage: (m) => posted.push(m), terminate() {} };
  return { proxy, posted };
}

/** Wrap a promise so a test can read whether (and how) it settled without awaiting it. */
function track(promise) {
  const t = { state: 'pending', value: undefined };
  promise.then((v) => { t.state = 'resolved'; t.value = v; }, (e) => { t.state = 'rejected'; t.value = e; });
  return t;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('StateManagerProxy: query ids', () => {
  it('no two in-flight calls share an id, whichever path sent them', async () => {
    const { proxy, posted } = makeProxy();
    // Interleave every sending path a gate check and a push use.
    proxy._sendCommand('beginBatchUpdate', {}, false);
    for (let i = 0; i < 20; i += 1) {
      proxy.pingWorker(`ping${i}`, 60000).catch(() => {});
      proxy.checkLocation(`Loc${i}`).catch(() => {});
      proxy.syncCheckedLocationsFromServer([i]).catch(() => {});
      proxy.sendQueryToWorker({ command: 'getFullSnapshot' }, 60000).catch(() => {});
    }
    const ids = posted.map((m) => m.queryId);
    expect(new Set(ids).size).toBe(ids.length);
    // Every expect-response call is still registered under its own id.
    expect(proxy.pendingQueries.size).toBe(80);
  });

  it('a ping and a checkLocation in flight together each settle with their OWN reply (the MW-P3 hang)', async () => {
    const { proxy, posted } = makeProxy();
    // One fire-and-forget command first, as in a live session, so that the
    // command counter and the query counter stand on the same number.
    proxy._sendCommand('beginBatchUpdate', {}, false);
    const ping = track(proxy.pingWorker('client:checkGate', 60000));
    const check = track(proxy.checkLocation('Some Location'));
    const pingMsg = posted.find((m) => m.command === 'ping');
    const checkMsg = posted.find((m) => m.command === 'checkLocation');

    // The worker answers the ping first (its echo is the spread payload, as the real worker's is) ...
    proxy.handleWorkerMessage({
      type: 'pingResponse', queryId: pingMsg.queryId,
      payload: { ...'client:checkGate', expectResponse: undefined, correlationId: pingMsg.correlationId },
    });
    // ... then the check.
    proxy.handleWorkerMessage({ type: 'queryResponse', queryId: checkMsg.queryId, result: { success: true, locationName: 'Some Location' } });
    await flush();

    expect(ping.state).toBe('resolved');
    expect(ping.value).toMatchObject({ correlationId: pingMsg.correlationId });
    expect(check.state).toBe('resolved');
    expect(check.value).toEqual({ success: true, locationName: 'Some Location' });
    expect(proxy.pendingQueries.size).toBe(0);
  });

  it('the colliding ping is not even rescued by its own timeout (control for the timer fix)', async () => {
    vi.useFakeTimers();
    const { proxy, posted } = makeProxy();
    proxy._sendCommand('beginBatchUpdate', {}, false);
    const ping = track(proxy.pingWorker('client:checkGate', 5000));
    const check = track(proxy.checkLocation('Some Location'));
    const pingMsg = posted.find((m) => m.command === 'ping');
    const checkMsg = posted.find((m) => m.command === 'checkLocation');
    proxy.handleWorkerMessage({ type: 'pingResponse', queryId: pingMsg.queryId, payload: 'echo' });
    proxy.handleWorkerMessage({ type: 'queryResponse', queryId: checkMsg.queryId, result: { success: true } });
    await vi.advanceTimersByTimeAsync(15000);
    expect(ping.state).not.toBe('pending');
    expect(check.state).not.toBe('pending');
  });

  it('a call whose entry was taken over still settles: its own timeout rejects it', async () => {
    vi.useFakeTimers();
    const { proxy } = makeProxy();
    const ping = track(proxy.pingWorker('client:checkGate', 5000));
    // Simulate ANY path that removes the entry without settling its caller (the live
    // hang: the other caller's reply deleted it as `success`). The timer used to look
    // the entry up by id, find nothing, and never reject.
    const [id] = proxy.pendingQueries.keys();
    proxy.pendingQueries.delete(id);
    await vi.advanceTimersByTimeAsync(5001);
    expect(ping.state).toBe('rejected');
    expect(String(ping.value)).toMatch(/Timeout waiting for ping response/);
  });

  it('registering a second entry under an id in use is refused, not silently overwritten', async () => {
    const { proxy } = makeProxy();
    const first = track(proxy.pingWorker('first', 60000));
    const [id] = proxy.pendingQueries.keys();
    proxy.nextQueryId = id; // force a reuse
    const second = track(proxy.pingWorker('second', 60000));
    await flush();
    // The first caller keeps its entry ...
    expect(proxy.pendingQueries.get(id).command).toBe('ping');
    proxy.handleWorkerMessage({ type: 'pingResponse', queryId: id, payload: 'first-echo' });
    await flush();
    expect(first.state).toBe('resolved');
    expect(first.value).toBe('first-echo');
    // ... and the second is not left hanging on a lost entry: it was given a fresh id.
    expect(second.state).toBe('pending');
    expect(proxy.pendingQueries.size).toBe(1);
  });
});

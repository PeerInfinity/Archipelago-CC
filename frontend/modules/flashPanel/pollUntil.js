/**
 * ⛓ **ONE "POLL A PREDICATE UNTIL A DEADLINE" LOOP FOR THE PANEL'S THREE
 * READINESS WAITS** (maze-lab arms F-a / plan §17.1 F3).
 *
 * `FlashBridgeAdapter.waitForBridge`, `WasmBridgeAdapter.waitForShim` and
 * `WasmBridgeAdapter.waitForBridge` were the same eight lines three times over
 * — a `Date.now()` deadline, a 100 ms sleep, a throw naming the timeout — and
 * two of them carried a cancellation check the third did not. This is the loop;
 * WHAT is waited for, HOW LONG, and WHAT THE REFUSAL SAYS stay at the callers,
 * because those are the three things that actually differ.
 *
 * ⛔⛔ **`watchWasm.until()` IS NOT A CALLER, AND THAT IS MEASURED, NOT
 * CONCEDED.** The lab's poll (`seedlingDemo/watchWasm.js:1119`) looks like a
 * fourth copy and is not one. Four differences, each observable:
 *
 *  1. Its tick is wrapped in `lifetime.guard('wasm-until', …)`, and the guard
 *     RECORDS the blocked call in the arm's `stopped` list
 *     (`procgenCore/pageLifetime.js:160-171`). That list is the page's LEAK
 *     WITNESS — "a loop was running and has now stopped" is positive evidence
 *     an empty list would deny. A `cancelled` predicate polled at the top of an
 *     iteration cannot record it, so routing `until` through here would delete
 *     evidence, not duplication.
 *  2. It rejects the INSTANT the arm retires (`lifetime.onRetire`), not at the
 *     next tick — up to 200 ms earlier — and with its own message.
 *  3. It swallows a throw from the predicate (`try { v = pred(); } catch`); the
 *     adapters let one propagate.
 *  4. Its cadence and fuse are the lab's own (200 ms / 180 s), chosen against a
 *     user who has not yet pressed ▶ Start.
 *
 * ⇒ `until` keeps its lifetime binding and its numbers. The comment at its head
 * names this file so the next reader does not re-derive the same four lines.
 */

/**
 * Poll `pred` until it returns something truthy, the deadline passes, or the
 * caller's `cancelled` says stop.
 *
 * ⛔ THE ORDER INSIDE ONE ITERATION IS PART OF THE CONTRACT, because it is what
 * the three loops did: deadline, then cancellation, then the predicate, then
 * the sleep. A detached adapter therefore refuses BEFORE it touches the DOM
 * again — a replacement iframe reuses the same element id, so a stale loop that
 * probed first would resolve against the NEW game page.
 *
 * @param {() => any} pred  probed once per interval; its truthy value is the
 *   result, so a caller that wants the element gets the element.
 * @param {object} opts
 * @param {number} opts.maxMs  the deadline, measured from entry.
 * @param {number} [opts.intervalMs=100]  the sleep between probes.
 * @param {(() => boolean)|null} [opts.cancelled]  asked at the top of every
 *   iteration; omitted, the loop cannot be aborted (the real-Flash transport
 *   never could).
 * @param {string} [opts.cancelledMessage]  what the abort throws. ⛔ The
 *   default is deliberately COLOURLESS: "adapter detached" is the wasm
 *   transport's word for its own cancellation and belongs in the file that owns
 *   the notion, not in a loop that knows nothing about adapters.
 * @param {string} [opts.timeoutMessage]  what the deadline throws.
 * @returns {Promise<any>} the predicate's truthy value.
 */
export async function pollUntil(pred, {
  maxMs,
  intervalMs = 100,
  cancelled = null,
  cancelledMessage = 'poll cancelled',
  timeoutMessage = `poll did not succeed within ${maxMs}ms`,
} = {}) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (cancelled?.()) throw new Error(cancelledMessage);
    const value = pred();
    if (value) return value;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(timeoutMessage);
}

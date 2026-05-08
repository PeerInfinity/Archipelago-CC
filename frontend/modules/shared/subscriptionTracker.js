/**
 * subscriptionTracker.js — bookkeeping for eventBus subscriptions.
 *
 * Most modules in this codebase repeat the same pattern: keep an
 * array of unsubscribe handles, push on each subscribe, drain on
 * cleanup. ~169 occurrences across the codebase as of 2026-05-07.
 *
 * SubscriptionTracker centralizes the bookkeeping so callers don't
 * need to manage the array directly. Two subscription paths:
 *
 *   tracker.subscribe(eventBus, name, handler)
 *     → calls eventBus.subscribe(name, handler), tracks the handle.
 *
 *   tracker.add(externalUnsubscribeHandle)
 *     → tracks a handle the caller created elsewhere (e.g. a
 *       wrapped subscription with a pre-applied gate).
 *
 * Cleanup:
 *
 *   tracker.unsubscribeAll()
 *     → calls every tracked unsubscribe (in order) and clears the
 *       internal list. Per-handle exceptions are swallowed so a
 *       single bad handle can't strand the rest.
 */
export class SubscriptionTracker {
  constructor() {
    this._handles = [];
  }

  /**
   * Subscribe to an event and track the returned unsubscribe handle.
   *
   * @param {Object} eventBus - Object with a `subscribe(name, handler)`
   *   method that returns an unsubscribe function. Both the global
   *   eventBus and per-module wrappers from getEventBus() qualify.
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function} the unsubscribe handle (also tracked).
   */
  subscribe(eventBus, eventName, handler) {
    const unsubscribe = eventBus.subscribe(eventName, handler);
    if (typeof unsubscribe === 'function') {
      this._handles.push(unsubscribe);
    }
    return unsubscribe;
  }

  /**
   * Track an unsubscribe handle that was produced elsewhere — e.g. a
   * subscription wrapped with a per-event gate, or a subscribe call
   * to a non-standard bus.
   *
   * @param {Function|null|undefined} unsubscribe
   * @returns {Function|null|undefined} the handle, unchanged.
   */
  add(unsubscribe) {
    if (typeof unsubscribe === 'function') {
      this._handles.push(unsubscribe);
    }
    return unsubscribe;
  }

  /**
   * Drain every tracked handle. Safe to call multiple times — the
   * second call is a no-op (the list is cleared after each drain).
   * Per-handle exceptions are caught and ignored so one broken
   * handle can't prevent the rest from running.
   */
  unsubscribeAll() {
    const handles = this._handles;
    this._handles = [];
    for (const h of handles) {
      try {
        h();
      } catch (e) {
        // Intentionally swallowed: keep draining the rest.
      }
    }
  }

  /**
   * Number of currently-tracked handles.
   */
  size() {
    return this._handles.length;
  }
}

export default SubscriptionTracker;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionTracker } from './subscriptionTracker.js';

function makeBus() {
  const calls = [];
  let nextId = 1;
  return {
    calls,
    subscribe: vi.fn((eventName, handler) => {
      const id = nextId++;
      calls.push({ method: 'subscribe', eventName, id });
      return () => calls.push({ method: 'unsubscribe', eventName, id });
    }),
  };
}

describe('SubscriptionTracker — initial state', () => {
  it('starts with zero handles', () => {
    expect(new SubscriptionTracker().size()).toBe(0);
  });
});

describe('SubscriptionTracker — subscribe', () => {
  let tracker, bus;
  beforeEach(() => {
    tracker = new SubscriptionTracker();
    bus = makeBus();
  });

  it('forwards to eventBus.subscribe with the given args', () => {
    const handler = () => {};
    tracker.subscribe(bus, 'foo:event', handler);
    expect(bus.subscribe).toHaveBeenCalledWith('foo:event', handler);
  });

  it('tracks the returned unsubscribe handle', () => {
    tracker.subscribe(bus, 'foo:event', () => {});
    tracker.subscribe(bus, 'bar:event', () => {});
    expect(tracker.size()).toBe(2);
  });

  it('returns the unsubscribe handle to the caller', () => {
    const unsub = tracker.subscribe(bus, 'foo:event', () => {});
    expect(typeof unsub).toBe('function');
  });

  it('does NOT track when the bus returns a non-function (defensive)', () => {
    const oddBus = { subscribe: () => 'not a function' };
    tracker.subscribe(oddBus, 'foo:event', () => {});
    expect(tracker.size()).toBe(0);
  });
});

describe('SubscriptionTracker — add', () => {
  let tracker;
  beforeEach(() => {
    tracker = new SubscriptionTracker();
  });

  it('tracks an externally-provided unsubscribe function', () => {
    const unsub = vi.fn();
    tracker.add(unsub);
    expect(tracker.size()).toBe(1);
  });

  it('returns the handle unchanged', () => {
    const unsub = () => {};
    expect(tracker.add(unsub)).toBe(unsub);
  });

  it('is a no-op for null / undefined / non-function values', () => {
    tracker.add(null);
    tracker.add(undefined);
    tracker.add('string');
    tracker.add(42);
    tracker.add({});
    expect(tracker.size()).toBe(0);
  });
});

describe('SubscriptionTracker — unsubscribeAll', () => {
  let tracker, bus;
  beforeEach(() => {
    tracker = new SubscriptionTracker();
    bus = makeBus();
  });

  it('calls every tracked unsubscribe handle in subscribe order', () => {
    tracker.subscribe(bus, 'a:event', () => {});
    tracker.subscribe(bus, 'b:event', () => {});
    tracker.subscribe(bus, 'c:event', () => {});

    tracker.unsubscribeAll();

    const unsubCalls = bus.calls.filter(c => c.method === 'unsubscribe');
    expect(unsubCalls.map(c => c.eventName)).toEqual(['a:event', 'b:event', 'c:event']);
  });

  it('clears the tracker so size() returns 0 afterward', () => {
    tracker.subscribe(bus, 'a:event', () => {});
    tracker.subscribe(bus, 'b:event', () => {});
    expect(tracker.size()).toBe(2);
    tracker.unsubscribeAll();
    expect(tracker.size()).toBe(0);
  });

  it('is a no-op when called twice in a row', () => {
    tracker.subscribe(bus, 'a:event', () => {});
    tracker.unsubscribeAll();
    bus.calls.length = 0;
    tracker.unsubscribeAll();
    expect(bus.calls.filter(c => c.method === 'unsubscribe')).toEqual([]);
  });

  it('is a no-op on an empty tracker', () => {
    expect(() => tracker.unsubscribeAll()).not.toThrow();
  });

  it('keeps draining when one handle throws', () => {
    const calls = [];
    tracker.add(() => calls.push('a'));
    tracker.add(() => { calls.push('b'); throw new Error('boom'); });
    tracker.add(() => calls.push('c'));

    expect(() => tracker.unsubscribeAll()).not.toThrow();
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(tracker.size()).toBe(0);
  });
});

describe('SubscriptionTracker — interleaved subscribe + add', () => {
  it('tracks both subscription paths together and unsubscribes both', () => {
    const tracker = new SubscriptionTracker();
    const bus = makeBus();
    const externalUnsub = vi.fn();

    tracker.subscribe(bus, 'a:event', () => {});
    tracker.add(externalUnsub);
    tracker.subscribe(bus, 'b:event', () => {});

    expect(tracker.size()).toBe(3);
    tracker.unsubscribeAll();

    expect(externalUnsub).toHaveBeenCalledTimes(1);
    expect(bus.calls.filter(c => c.method === 'unsubscribe').length).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';

import { yieldedWait } from './procgenPipelineEngine.js';

// ⛓ cloudberry P2b (js-14's pin): what the async drainers wait for between two events.
describe('yieldedWait', () => {
    it('a plain event waits ONE MACROTASK (setTimeout 0), not a microtask — a microtask queued after it runs first', async () => {
        const order = [];
        const waited = yieldedWait({ type: 'region' }).then(() => order.push('wait'));
        Promise.resolve().then(() => order.push('micro'));
        await waited;
        expect(order).toEqual(['micro', 'wait']);
        expect(yieldedWait(null)).toBeInstanceOf(Promise);
    });

    it('an event carrying a thenable `await` waits on exactly that', () => {
        const p = Promise.resolve(42);
        expect(yieldedWait({ type: 'attempt', await: p })).toBe(p);
        expect(yieldedWait({ await: 'not a promise' })).not.toBe('not a promise');
    });
});

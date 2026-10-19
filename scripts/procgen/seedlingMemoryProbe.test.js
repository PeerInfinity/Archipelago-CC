import { describe, expect, it, vi } from 'vitest';
import { MEMORY_PROBE_MIN_MS, callDelta, createMemorySampler, formatMemorySample, parseMemoryProbeMs, readGameMemoryInPage,
    slope, summarizeMemory } from './seedlingMemoryProbe.js';

describe('seedlingMemoryProbe — parseMemoryProbeMs', () => {
    it('empty / 0 = off; an integer ≥ the floor = on; anything else throws by name', () => {
        expect(parseMemoryProbeMs('')).toBe(0);
        expect(parseMemoryProbeMs(undefined)).toBe(0);
        expect(parseMemoryProbeMs('0')).toBe(0);
        expect(parseMemoryProbeMs('2000')).toBe(2000);
        expect(parseMemoryProbeMs(String(MEMORY_PROBE_MIN_MS))).toBe(MEMORY_PROBE_MIN_MS);
        expect(() => parseMemoryProbeMs('100')).toThrow(/--memory-probe-ms=100/);
        expect(() => parseMemoryProbeMs('1.5e3x')).toThrow(/--memory-probe-ms/);
    });
});

describe('seedlingMemoryProbe — createMemorySampler', () => {
    it('OFF takes no sample and never reads (the default run is untouched)', async () => {
        const read = vi.fn(async () => ({ v: 1 }));
        const setTimer = vi.fn();
        const s = createMemorySampler({ intervalMs: 0, read, setTimer });
        s.start();
        expect(await s.sampleNow()).toBe(null);
        const out = await s.stop();
        expect(read).not.toHaveBeenCalled();
        expect(setTimer).not.toHaveBeenCalled();
        expect(out.samples).toEqual([]);
        expect(s.enabled).toBe(false);
    });

    it('ON samples at start, on each timer tick, and once at stop', async () => {
        let tick = null;
        let t = 1000;
        const read = vi.fn(async () => ({ v: t }));
        const s = createMemorySampler({ intervalMs: 500, read, now: () => t, setTimer: (f) => { tick = f; return 7; }, clearTimer: vi.fn() });
        s.start();
        await Promise.resolve();
        t = 1500; await tick();
        t = 2000; await tick();
        const out = await s.stop();
        expect(out.samples.map((x) => [x.t, x.tag ?? null])).toEqual([[0, 'start'], [500, null], [1000, null], [1000, 'stop']]);
        expect(out.stats.taken).toBe(4);
    });

    it('the buffer is BOUNDED: past max it halves, keeping the first sample and the whole span', async () => {
        let t = 0;
        const s = createMemorySampler({ intervalMs: 250, read: async () => ({}), max: 10, now: () => t, setTimer: () => 1, clearTimer: () => {} });
        s.start();
        await Promise.resolve();
        for (let i = 1; i <= 100; i++) { t = i * 250; await s.sampleNow(); }
        const kept = s.samples;
        expect(kept.length).toBeLessThanOrEqual(10);
        expect(kept[0].tag).toBe('start');
        expect(kept.at(-1).t).toBe(100 * 250);
        expect(s.stats.decimations).toBeGreaterThan(0);
        expect(s.stats.taken).toBe(101);
        // still ordered in time
        expect(kept.every((x, i) => i === 0 || x.t > kept[i - 1].t)).toBe(true);
    });

    it('a read still in flight is SKIPPED (counted), never stacked; a throwing read is kept as an error row', async () => {
        let release;
        let calls = 0;
        const read = () => { calls += 1; if (calls === 1) return new Promise((r) => { release = r; }); throw new Error('ExitStatus'); };
        const s = createMemorySampler({ intervalMs: 300, read, now: () => 0, setTimer: () => 1, clearTimer: () => {} });
        const first = s.sampleNow();
        expect(await s.sampleNow()).toBe(null);
        expect(s.stats.skipped).toBe(1);
        release({ a: 1 });
        await first;
        const e = await s.sampleNow();
        expect(e.error).toMatch(/ExitStatus/);
        expect(s.stats.errors).toBe(1);
        expect(calls).toBe(2);
    });

    it('a printer that throws never stops the sampler', async () => {
        const s = createMemorySampler({ intervalMs: 300, read: async () => ({}), onSample: () => { throw new Error('boom'); },
            setTimer: () => 1, clearTimer: () => {} });
        await s.sampleNow();
        await s.sampleNow();
        expect(s.samples.length).toBe(2);
    });
});

describe('seedlingMemoryProbe — readGameMemoryInPage (o1heap diagnostics out of linear memory)', () => {
    it('finds the instance by its capacity word and reads allocated / peak / oom; no HEAPU32 = not found', () => {
        const MiB = 1024 * 1024;
        const cap = 32 * MiB - 192;
        const u = new Uint32Array((33 * MiB) / 4);
        const base = 4096;
        u[base / 4 + 3] = base + 176 + 64; // one non-empty bin, inside the arena
        const c = (base + 136) / 4;
        u[c] = cap; u[c + 1] = 5 * MiB; u[c + 2] = 9 * MiB; u[c + 3] = 2048; u[c + 4] = 0; u[c + 5] = 0;
        const prev = globalThis.window;
        try {
            globalThis.window = { HEAPU32: u, __swfPerf: { frames: 42 } };
            const r = readGameMemoryInPage();
            expect(r).toMatchObject({ found: true, capacity: cap, allocated: 5 * MiB, peak: 9 * MiB, peakRequest: 2048, oom: 0, frames: 42 });
            u[c + 1] = 6 * MiB;
            expect(readGameMemoryInPage().allocated).toBe(6 * MiB); // the cached index re-reads live memory
            globalThis.window = {};
            expect(readGameMemoryInPage()).toMatchObject({ found: false, frames: null });
        } finally { globalThis.window = prev; }
    });
});

describe('seedlingMemoryProbe — summarizeMemory / slope / callDelta / format', () => {
    const row = (t, alloc, phase, gameTime, js, calls) => ({ t, phase, gameTime, jsHeap: js, calls: { total: calls },
        game: { found: true, allocated: alloc, peak: alloc, capacity: 100, oom: 0, frames: null } });

    it('slope is least squares; under two points it is null', () => {
        expect(slope([0, 1, 2], [10, 12, 14])).toBe(2);
        expect(slope([1], [1])).toBe(null);
    });

    it('splits the whole leg from its SOLVING span (the game clock frozen there = the latch held)', () => {
        const s = [row(0, 100, 'await-arrival', 10, 5, 0), row(1000, 200, 'solving', 30, 6, 10), row(2000, 300, 'solving', 30, 7, 20),
            row(3000, 400, 'solving', 30, 8, 30), { t: 3500, error: 'ExitStatus' }];
        const m = summarizeMemory(s);
        expect(m.all.allocated).toMatchObject({ first: 100, last: 400, max: 400, bytesPerSec: 100 });
        expect(m.all.gameTime.advanced).toBe(20);
        expect(m.solving.n).toBe(3);
        expect(m.solving.gameTime.advanced).toBe(0);
        expect(m.solving.allocated.bytesPerSec).toBe(100);
        expect(m.solving.calls).toBe(20);
        expect(m.errors).toBe(1);
    });

    it('callDelta: per-callback deltas, busiest first; null when a read is missing', () => {
        const a = { total: 5, queueItems: 1, queuedItems: 2, by: { botStatus: { n: 4, chars: 400 }, readState: { n: 1, chars: 10 } } };
        const b = { total: 25, queueItems: 4, queuedItems: 8, by: { botStatus: { n: 6, chars: 600 }, readState: { n: 19, chars: 190 }, botSeam: { n: 0, chars: 0 } } };
        const d = callDelta(a, b);
        expect(d.total).toBe(20);
        expect(Object.keys(d.by)).toEqual(['readState', 'botStatus']);
        expect(d.by.botStatus).toEqual({ n: 2, chars: 200 });
        expect(d.queueItems).toBe(3);
        expect(callDelta(null, b)).toBe(null);
    });

    it('formats a sample line (and an error row)', () => {
        expect(formatMemorySample(397, row(1500, 3 * 1048576, 'solving', 40, 1048576, 9))).toMatch(/^MEMPROBE leg 397 t=1\.5s phase=solving alloc=3\.0MB/);
        expect(formatMemorySample(397, { t: 0, error: 'x' })).toBe('MEMPROBE leg 397 t=0.0s error x');
    });
});

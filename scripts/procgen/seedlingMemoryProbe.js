/**
 * Measure-only (slice `seedling-js-wasm-oom`) — THE MEMORY PROBE of `probe-seedling-divergence-sweep.mjs`
 * (`--memory-probe-ms=<ms>`, default OFF: no sample is taken, no row field is written, no call is wrapped).
 *
 * Leg 397 (L40, arrive 480,896) ended `probe-error` / `page.evaluate: ExitStatus` on a FRESH page, ~180 s into a
 * 400 s leg budget, with `heap_alloc(2048) failed - out of memory` (CI sweep 39196052141). The question is WHO
 * allocates while the leg waits: the game (still stepping while the worker solves — the freeze not holding), the
 * room build itself, or the parent page's JS. So each sample reads, on one clock:
 *   - the GAME's heap: SWFModernRuntime's AVM2 heap is ONE o1heap arena, so `HEAPU8.buffer.byteLength` is flat by
 *     construction (the 2026-10-02 OOM report). `readGameMemoryInPage` reads o1heap's own `O1HeapDiagnostics` out of
 *     linear memory with pure `HEAPU32` reads — no call into the game: `{capacity, allocated, peak_allocated,
 *     peak_request_size, oom_count}` at instance+136 (wasm32: `bins[32]` + mask + pad). The instance is found once
 *     by its capacity word. Plus the runtime's own frame counter (`__swfPerf.frames`, when the build reports one);
 *   - the GAME's clock and hold (`botStatus` — ONE bridge call per sample, counted with the rest): `game_time`
 *     advancing while the engine's phase is `solving` = the game steps during the wait;
 *   - the bridge traffic (the lab's opt-in call counter): calls and reply characters per callback, `queueItems`;
 *   - the parent page's JS heap (CDP `Performance.getMetrics` `JSHeapUsedSize`, the page's whole isolate).
 *
 * The sampler holds a BOUNDED buffer: past `max` samples it drops every other one (the first kept), so a long leg
 * keeps its whole span at half the resolution, never an unbounded array. Nothing here is product.
 */

/** The smallest interval the probe accepts (a sample costs one `botStatus` and a few evaluates). */
export const MEMORY_PROBE_MIN_MS = 250;
/** The sampler's default bound on kept samples. */
export const MEMORY_PROBE_MAX_SAMPLES = 1200;

/**
 * `--memory-probe-ms` → `{ms, hitSampleMs, holdL0Sec, holdArrivalSec, runArrivalSec, liveObjects}`: `ms` 0 (off, the
 * default) or an interval (≥ MEMORY_PROBE_MIN_MS), then comma options — the probe's MEASUREMENT-ONLY ARMS (every row
 * stamped with the ones set):
 *   hit-sample-ms=<n>   the SPLIT ARM: the lab's 25 ms `botStatus` hit sampler runs every <n> ms (per-call vs per-frame)
 *   hold-l0=<s>         before the grants, freeze the boot room (L0) with `botHold("on")` for <s> s, then release
 *   quiet-l0=<s>        after that, freeze L0 again for <s> s with the panel's item-only `queueItems` pushes DROPPED
 *                       (the lab's counter; a teleport push still goes) — the host push vs the runtime's own frames
 *   run-arrival=<s>     after the jump, let the arrival room RUN unheld for <s> s before the serve
 *   hold-arrival=<s>    after that, freeze the arrival room with `botHold("on")` for <s> s, then release
 *   live-objects        the runtime's per-frame live AVM2 object/array counts (`swf_perf_report`'s arguments), kept
 *                       on `__swfPerf` by a one-token rewrite of the SERVED glue JS (the wasm is untouched)
 * Throws by name.
 */
export function parseMemoryProbe(spec) {
    const [head, ...opts] = String(spec ?? '').split(',').map((x) => x.trim());
    const ms = parseMemoryProbeMs(head);
    const out = { ms, hitSampleMs: null, holdL0Sec: null, quietL0Sec: null, holdArrivalSec: null, runArrivalSec: null, liveObjects: false };
    const SEC = { 'hold-l0': 'holdL0Sec', 'quiet-l0': 'quietL0Sec', 'hold-arrival': 'holdArrivalSec', 'run-arrival': 'runArrivalSec' };
    for (const o of opts.filter(Boolean)) {
        let m;
        if (o === 'live-objects') out.liveObjects = true;
        else if ((m = /^hit-sample-ms=(\d+)$/.exec(o)) && Number(m[1]) >= 5) out.hitSampleMs = Number(m[1]);
        else if ((m = /^(hold-l0|quiet-l0|hold-arrival|run-arrival)=(\d+)$/.exec(o)) && Number(m[2]) >= 1) out[SEC[m[1]]] = Number(m[2]);
        else throw new Error(`--memory-probe-ms: ${JSON.stringify(o)} is not hit-sample-ms=<ms >= 5>, hold-l0=<s>, quiet-l0=<s>, `
            + 'hold-arrival=<s>, run-arrival=<s> or live-objects');
    }
    if (!ms && opts.some(Boolean)) throw new Error('--memory-probe-ms: an arm needs the probe on (an interval first)');
    return out;
}

/** The row stamp of the arms set (`{}` when none): a row measured under an arm says so. */
export function memoryArmStamp(p) {
    return { ...(p.hitSampleMs ? { hitSampleMs: p.hitSampleMs } : {}), ...(p.holdL0Sec ? { holdL0Sec: p.holdL0Sec } : {}),
        ...(p.quietL0Sec ? { quietL0Sec: p.quietL0Sec } : {}),
        ...(p.runArrivalSec ? { runArrivalSec: p.runArrivalSec } : {}), ...(p.holdArrivalSec ? { holdArrivalSec: p.holdArrivalSec } : {}),
        ...(p.liveObjects ? { liveObjects: true } : {}) };
}

/** The served glue JS's `swf_perf_report` keeps its live-object arguments (`live-objects`); null = the token moved. */
export const LIVE_OBJECTS_TOKEN = 'S.frames++;';
export function withLiveObjects(js) {
    const n = js.split(LIVE_OBJECTS_TOKEN).length - 1;
    return n === 1 ? js.replace(LIVE_OBJECTS_TOKEN, `${LIVE_OBJECTS_TOKEN}S.liveObj=live_obj;S.liveArr=live_arr;`) : null;
}

/** `--memory-probe-ms`'s interval → 0 (off, the default) or ms (≥ MEMORY_PROBE_MIN_MS). Throws by name. */
export function parseMemoryProbeMs(spec) {
    const s = String(spec ?? '').trim();
    if (!s || s === '0') return 0;
    const n = Number(s);
    if (!Number.isInteger(n) || n < MEMORY_PROBE_MIN_MS) {
        throw new Error(`--memory-probe-ms=${s}: an integer interval >= ${MEMORY_PROBE_MIN_MS} ms (empty or 0 = off)`);
    }
    return n;
}

/**
 * A periodic sampler over an async `read()`. Off (`intervalMs` 0) = start/stop do nothing and no read is ever made.
 * A read still in flight when the timer fires is skipped (counted), never stacked; a read that throws is kept as
 * `{t, error}`. Returns `{start, stop, sampleNow, samples, stats}`.
 */
export function createMemorySampler({ intervalMs = 0, read, max = MEMORY_PROBE_MAX_SAMPLES, now = () => Date.now(),
    setTimer = (f, ms) => setInterval(f, ms), clearTimer = (h) => clearInterval(h), onSample = null } = {}) {
    if (max < 2) throw new Error('createMemorySampler: max must be >= 2');
    const samples = [];
    const stats = { taken: 0, skipped: 0, errors: 0, decimations: 0 };
    let timer = null;
    let t0 = null;
    let inFlight = false;
    const enabled = intervalMs > 0;
    function keep(s) {
        if (samples.length >= max) {
            // drop every other sample, the first kept: the whole span at half the resolution
            const kept = samples.filter((_, i) => i % 2 === 0);
            samples.length = 0;
            samples.push(...kept);
            stats.decimations += 1;
        }
        samples.push(s);
    }
    async function sampleNow(tag = null) {
        if (!enabled) return null;
        if (inFlight) { stats.skipped += 1; return null; }
        inFlight = true;
        const t = now() - (t0 ?? now());
        let s;
        try {
            s = { t, ...(await read()) };
        } catch (e) {
            stats.errors += 1;
            s = { t, error: String(e?.message ?? e).split('\n')[0].slice(0, 200) };
        } finally {
            inFlight = false;
        }
        if (tag) s.tag = tag;
        stats.taken += 1;
        keep(s);
        try { onSample?.(s); } catch { /* a printer's throw never stops the sampler */ }
        return s;
    }
    return {
        enabled,
        start() {
            if (!enabled || timer !== null) return;
            t0 = now();
            sampleNow('start');
            timer = setTimer(() => { sampleNow(); }, intervalMs);
        },
        async stop() {
            if (!enabled) return { samples: [], stats: { ...stats } };
            if (timer !== null) { clearTimer(timer); timer = null; }
            // the closing sample (the state the leg ended in), once any read in flight has settled
            for (let i = 0; i < 50 && inFlight; i++) await new Promise((r) => { setTimeout(r, 20); });
            await sampleNow('stop');
            return { samples: samples.slice(), stats: { ...stats } };
        },
        sampleNow,
        get samples() { return samples.slice(); },
        get stats() { return { ...stats }; },
    };
}

/**
 * IN-PAGE (the GAME frame), self-contained (serialised by `frame.evaluate`): the o1heap diagnostics read out of
 * linear memory, the wasm memory's length, and the runtime's frame counter. No call into the game.
 */
export function readGameMemoryInPage() {
    const u = window.HEAPU32;
    const frames = window.__swfPerf?.frames ?? null;
    // ⛓ `live-objects` arm only (absent otherwise): the runtime's own per-frame live counts
    const live = typeof window.__swfPerf?.liveObj === 'number' ? { liveObj: window.__swfPerf.liveObj, liveArr: window.__swfPerf.liveArr } : {};
    if (!u) return { found: false, wasmBytes: null, frames, ...live };
    let c = window.__memProbeCapIdx;
    if (c === undefined) {
        c = -1;
        // `capacity` = arena − 176 rounded DOWN to 32 (512 MiB − 192 on the default arena; any whole-MiB arena is
        // accepted); the 32 bins before the diagnostics are null or point INTO the arena right after the instance
        for (let i = 33; i < u.length - 6; i++) {
            const cap = u[i];
            if (cap < 16 * 1024 * 1024 || cap > u.length * 4 || cap % 32 !== 0 || (1024 * 1024 - (cap % (1024 * 1024))) > 256
                || ((i * 4 - 136) % 16) !== 0) continue;
            if (!(u[i + 1] <= cap && u[i + 2] >= u[i + 1] && u[i + 2] <= cap && u[i + 5] === 0)) continue;
            const base = i * 4 - 136;
            let ok = true;
            for (let b = 0; b < 32 && ok; b++) {
                const ptr = u[base / 4 + b];
                ok = ptr === 0 || (ptr >= base + 176 && ptr < base + 176 + cap);
            }
            if (ok) { c = i; break; }
        }
        window.__memProbeCapIdx = c;
    }
    if (c < 0) return { found: false, wasmBytes: u.buffer.byteLength, frames, ...live };
    return { found: true, wasmBytes: u.buffer.byteLength, frames, ...live, capacity: u[c], allocated: u[c + 1], peak: u[c + 2],
        peakRequest: u[c + 3], oom: u[c + 4] };
}

/** Least-squares slope of `ys` over `xs` (null under two points). */
export function slope(xs, ys) {
    const n = xs.length;
    if (n < 2) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    return sxx ? sxy / sxx : null;
}

/**
 * The curve in a few numbers: the game heap's first/last/max allocated and peak, its oom count, the slope of
 * `allocated` over time (B/s), the game clock's and frames' advance, the parent JS heap, and the bridge calls.
 * Two spans: the whole leg and the WAIT (samples whose engine phase is `solving`).
 */
export function summarizeMemory(samples) {
    const ok = (samples ?? []).filter((s) => !s.error);
    const span = (rows) => {
        const heap = rows.filter((s) => s.game?.found);
        const xs = heap.map((s) => s.t / 1000);
        const alloc = heap.map((s) => s.game.allocated);
        const clock = rows.filter((s) => Number.isFinite(s.gameTime));
        const js = rows.filter((s) => Number.isFinite(s.jsHeap));
        const calls = rows.filter((s) => Number.isFinite(s.calls?.total));
        const first = (a) => a[0];
        const last = (a) => a[a.length - 1];
        return {
            n: rows.length,
            ms: rows.length ? last(rows).t - first(rows).t : 0,
            allocated: heap.length ? { first: first(alloc), last: last(alloc), max: Math.max(...alloc),
                bytesPerSec: slope(xs, alloc) === null ? null : Math.round(slope(xs, alloc)) } : null,
            peak: heap.length ? last(heap).game.peak : null,
            capacity: heap.length ? last(heap).game.capacity : null,
            oom: heap.length ? last(heap).game.oom : null,
            gameTime: clock.length ? { first: first(clock).gameTime, last: last(clock).gameTime, advanced: last(clock).gameTime - first(clock).gameTime } : null,
            frames: heap.length && Number.isFinite(first(heap).game.frames) ? last(heap).game.frames - first(heap).game.frames : null,
            jsHeap: js.length ? { first: first(js).jsHeap, last: last(js).jsHeap, max: Math.max(...js.map((s) => s.jsHeap)) } : null,
            calls: calls.length ? last(calls).calls.total - first(calls).calls.total : null,
        };
    };
    return { all: span(ok), solving: span(ok.filter((s) => s.phase === 'solving')), errors: (samples ?? []).length - ok.length };
}

const MB = (b) => (Number.isFinite(b) ? (b / 1048576).toFixed(1) : '-');

/** One sample as a shard-log line (`MEMPROBE leg <id> …`). */
export function formatMemorySample(legId, s) {
    if (s.error) return `MEMPROBE leg ${legId} t=${(s.t / 1000).toFixed(1)}s error ${s.error}`;
    const g = s.game ?? {};
    return `MEMPROBE leg ${legId} t=${(s.t / 1000).toFixed(1)}s${s.tag ? ` [${s.tag}]` : ''}${s.arm ? ` arm=${s.arm}` : ''} phase=${s.phase ?? '-'}`
        + ` alloc=${g.found ? MB(g.allocated) : '?'}MB peak=${g.found ? MB(g.peak) : '?'}MB oom=${g.found ? g.oom : '?'}`
        + ` frames=${g.frames ?? '-'}${typeof g.liveObj === 'number' ? ` live=${g.liveObj}/${g.liveArr}` : ''} game_time=${s.gameTime ?? '-'} level=${s.level ?? '-'} jsHeap=${MB(s.jsHeap)}MB`
        + ` calls=${s.calls?.total ?? '-'} reply=${MB(s.calls?.replyChars)}Mch queue=${s.calls?.queueItems ?? '-'}`
        + `${s.calls?.dropped ? ` dropped=${s.calls.dropped}` : ''}`;
}

/**
 * The lab's per-callback counts between two reads (`callCounts()`), busiest first: `{name: {n, chars}}`, plus the
 * `queueItems` pushes. Null when either read is missing (the page died before the second).
 */
export function callDelta(before, after) {
    if (!before || !after) return null;
    const by = {};
    for (const [name, b] of Object.entries(after.by ?? {})) {
        const a = before.by?.[name] ?? { n: 0, chars: 0 };
        if (b.n - a.n > 0) by[name] = { n: b.n - a.n, chars: b.chars - a.chars };
    }
    const sorted = Object.fromEntries(Object.entries(by).sort((x, y) => y[1].n - x[1].n));
    return { total: (after.total ?? 0) - (before.total ?? 0), queueItems: (after.queueItems ?? 0) - (before.queueItems ?? 0),
        queuedItems: (after.queuedItems ?? 0) - (before.queuedItems ?? 0), by: sorted };
}

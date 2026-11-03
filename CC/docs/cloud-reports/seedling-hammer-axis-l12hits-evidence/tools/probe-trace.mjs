// MEASUREMENT ONLY. `node --import ./probe-trace.mjs axis-replay.mjs …`: every axis-aligned `probeCorridor` call is a
// line on stderr: its start tick, waypoints, the stand tail asked, the samples (transit / dwell counts, last tick, the
// last sample's player), the strikes its policy pressed, and the hit it returned (null = clean). Also loads l12-trace.
import { register } from 'node:module';
register(new URL('./probe-loader.mjs', import.meta.url).href);
await import('./l12-trace.mjs');
globalThis.__probe = ({ run, wps, axisAligned, stand, walk, hit }) => {
    if (!axisAligned || run.level !== 12) return;
    const sm = walk.samples;
    const ph = {};
    for (const s of sm) ph[s.phase ?? 'transit'] = (ph[s.phase ?? 'transit'] ?? 0) + 1;
    const last = sm.at(-1);
    process.stderr.write('PROBE ' + JSON.stringify({ t0: walk.startTick, wps: wps.length, end: wps.at(-1),
        stand: stand ? { ticks: stand.ticks } : null, n: sm.length, phases: ph, lastTick: last?.tick,
        lastAt: last ? [+last.x.toFixed(2), +last.y.toFixed(2)] : null, truncated: walk.truncated ?? null,
        chasersLast: (last?.chasers ?? []).map?.((c) => [c.id, +(c.x ?? c.rect?.x ?? 0).toFixed?.(2), c.punch ?? c.attack ?? null]) ?? null,
        hit: hit ? { tick: hit.tick, sources: hit.sources?.map((s) => s.id + ':' + s.kind) } : null }) + '\n');
};

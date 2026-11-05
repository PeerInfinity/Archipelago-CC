// MEASUREMENT ONLY (load hook): every `probeCorridor` answer is reported to globalThis.__ctsProbe(run, info): the
// probe's start tick, its tail (stand ticks), and its first hit (tick, eta, position, sources, waiting).
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const a = '    const probeCorridor = (wps, except = null, { axisAligned = false, walkCheck = false, stand = null,\n'
        + '        iframeLapse = true, requireArrival = false } = {}) => {\n';
    if (!src.includes(a)) throw new Error('probe-loader: anchor not found');
    src = src.replace(a, '    const probeCorridor = (...pa) => { const t0p = run.ticksCompleted; const r = probeCorridor0(...pa);'
        + ' globalThis.__ctsProbe?.(run, { t0: t0p, n: pa[0]?.length ?? 0, end: pa[0]?.at?.(-1) ?? null, last: (pa[0] ?? []).slice(-4).map((w) => [w.x, w.y]),'
        + ' stand: pa[2]?.stand?.ticks ?? null, hit: r ? { tick: r.tick, eta: r.eta, at: r.at ?? (r.x !== undefined ? [r.x, r.y] : null),'
        + ' waiting: r.waiting ?? false, src: (r.sources ?? []).map((s) => s.id ?? s).slice(0, 3) } : null }); return r; };\n'
        + a.replace('const probeCorridor = ', 'const probeCorridor0 = '));
    return { ...out, source: src, shortCircuit: true };
}

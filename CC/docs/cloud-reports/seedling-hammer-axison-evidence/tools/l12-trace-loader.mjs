// MEASUREMENT ONLY (load hook): botDriverV2's `drive` publishes its `what` / `axisAligned` / `strike` as globals, and
// `driveStepHeld` calls globalThis.__l12Tick(run, target, strike, axisAligned, held) just before it returns, so
// `l12-trace.mjs` sees every DRIVEN tick (not a preview) with its walk's name and its final keys.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/botDriverV2.js')) return out;
    let src = String(out.source);
    const a1 = '    if (axisAligned) held = holdOneAxis(held, run.state, target);\n    return held;\n}';
    const a2 = '    let ticks = 0;\n    const touched = [];\n    for (;;) {\n        if (until === \'arrival\' && waypointReached(';
    if (!src.includes(a1) || !src.includes(a2)) throw new Error('l12-trace-loader: anchor not found');
    src = src.replace(a1, '    if (axisAligned) held = holdOneAxis(held, run.state, target);\n'
        + '    globalThis.__l12Tick?.(run, target, strike, axisAligned, held);\n    return held;\n}');
    src = src.replace(a2, '    globalThis.__l12What = what;\n' + a2);
    return { ...out, source: src, shortCircuit: true };
}

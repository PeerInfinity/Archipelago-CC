// MEASUREMENT ONLY (load hook): solverBot's `probeCorridor` reports every probe of an AXIS-ALIGNED walk to
// globalThis.__probe({axisAligned, stand, walk, hit}) (`probe-trace.mjs`), and botDriverV2 gets `l12-trace-loader`'s hooks.
export async function load(url, context, next) {
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return next(url, context);
    const out = await next(url, context);
    let src = String(out.source);
    const a = '        const hit = probeSamples(walk.samples, except, { walkCheck });\n        if (hit) {\n            return { ...hit, eta:';
    if (!src.includes(a)) throw new Error('probe-loader: anchor not found');
    src = src.replace(a, '        const hit = probeSamples(walk.samples, except, { walkCheck });\n'
        + '        globalThis.__probe?.({ run, wps, axisAligned, stand, walk, hit });\n'
        + '        if (hit) {\n            return { ...hit, eta:');
    return { ...out, source: src, shortCircuit: true };
}

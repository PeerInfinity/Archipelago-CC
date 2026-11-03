// MEASUREMENT ONLY (load hook): botDriverV2.driveStepHeld calls globalThis.__axisDrive(run, target, strike,
// axisAligned, held) just before it returns, so the census sees every DRIVEN tick (not previews) with its keys.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/botDriverV2.js')) return out;
    let src = String(out.source);
    const anchor = '    if (axisAligned) held = holdOneAxis(held, run.state, target);\n    return held;\n}';
    if (!src.includes(anchor)) throw new Error('axis-loader: driveStepHeld anchor not found');
    src = src.replace(anchor, '    if (axisAligned) held = holdOneAxis(held, run.state, target);\n'
        + '    globalThis.__axisDrive?.(run, target, strike, axisAligned, held);\n    return held;\n}');
    return { ...out, source: src, shortCircuit: true };
}

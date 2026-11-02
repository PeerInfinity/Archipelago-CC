// MEASUREMENT ONLY (load hook): `solverBot.strikePolicyFor` hands each policy it builds to globalThis.__slotWrap(run,
// policy) before it returns, so the census can wrap that policy's `decide` with the run it was built for.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const anchor = '    if (!axisAlong) return policy;\n';
    if (!src.includes(anchor)) throw new Error('slot-loader: strikePolicyFor anchor not found');
    src = src.replace(anchor, '    globalThis.__slotWrap?.(run, policy);\n' + anchor);
    return { ...out, source: src, shortCircuit: true };
}

// MEASUREMENT ONLY (load hook): split AXIS_STRIKE ON into its two parts on a scratch copy of solverBot.js.
//   AXISON_NO_STAND=1  — the clear-tag keylock stance walk is NOT handed `axisClearTagStand`'s tail (the strikes alone)
//   AXISON_NO_STRIKE=1 — `axisStrikeFor` returns null (the clear-tag stand alone)
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const sub = (a, b) => { if (!src.includes(a)) throw new Error('arm-loader: anchor not found: ' + a); src = src.replace(a, b); };
    if (process.env.AXISON_NO_STAND === '1') sub('                ...axisClearTagStand(run, verb, resolved),\n', '');
    if (process.env.AXISON_NO_STRIKE === '1') sub("    return AXIS_STRIKE.enabled ? strikePolicyFor(run, { dashMode, axisAlong: true }) : null;",
        '    return null;');
    return { ...out, source: src, shortCircuit: true };
}

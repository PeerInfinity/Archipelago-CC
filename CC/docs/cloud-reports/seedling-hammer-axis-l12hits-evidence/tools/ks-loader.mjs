// MEASUREMENT ONLY (load hook): solverBot's `keylockStandWalk` reports its inputs (the resolution's hold, target and
// the lock's key line) to stderr as `KSW {…}` each time it is asked.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const a = '    if (!(resolved.hold?.ticks > 0) || !keyLine || !resolved.target) return {};\n';
    if (!src.includes(a)) throw new Error('ks-loader: anchor not found');
    src = src.replace(a, '    process.stderr.write("KSW " + JSON.stringify({ lock: resolved.lock, hold: resolved.hold ?? null, '
        + 'target: resolved.target ?? null, stance: resolved.stance ?? null, approach: resolved.approach ?? null, '
        + 'keyLine: keyLine ?? null, keys: Object.keys(resolved) }) + "\\n");\n' + a);
    return { ...out, source: src, shortCircuit: true };
}

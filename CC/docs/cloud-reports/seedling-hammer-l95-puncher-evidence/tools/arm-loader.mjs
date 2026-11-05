// MEASUREMENT ONLY (load hook): every candidate the kill rung's chaser arm (`deriveKillByChaser`) previews is reported
// to globalThis.__armCand({run, target, c, walk, danger, deathTick}) before it is scored or rejected. Also walk-loader's
// walk register (chained). Nothing it records decides anything.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const a = "        if (danger) {\n            rejected.push({ ...c, why: `${danger.phase === 'dwell' ? 'the WAIT' : 'the APPROACH'} `";
    if (src.split(a).length !== 2) throw new Error('arm-loader: anchor not unique/found');
    src = src.replace(a, "        globalThis.__armCand?.({ run, target, c, walk, danger, deathTick });\n" + a);
    return { ...out, source: src, shortCircuit: true };
}

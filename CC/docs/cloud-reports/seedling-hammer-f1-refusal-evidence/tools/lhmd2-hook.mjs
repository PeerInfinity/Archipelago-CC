// MEASUREMENT-ONLY loader hook (in memory): seg-hook's stash + a per-cell log of latchedHoldCells' filters (stderr `LHC`).
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  let src = String(r.source);
  const rep = (a, b) => { if (!src.includes(a)) throw new Error('needle missing: ' + a); src = src.replace(a, b); };
  if (url.endsWith('/seedlingDemo/jsRuntimeSolver.js')) {
    rep('const solveMs = clock() - t1;', 'const solveMs = clock() - t1; (globalThis.__SEG ??= []).push(out);');
    return { ...r, source: src, shortCircuit: true };
  }
  if (url.endsWith('/seedlingDemo/solverBot.js')) {
    const L = (w) => `{ process.stderr.write("LHC " + JSON.stringify({ t: run.ticksCompleted, at: [+x0.toFixed(1), +y0.toFixed(1)], p, d: +d.toFixed(1), why: ${w} }) + "\\n"); continue; }`;
    rep('            if (run.world.collidesSolid(box, geo)) continue;', `            if (run.world.collidesSolid(box, geo)) ${L('"solid"')}`);
    rep('            if (plannerObstacleAt(run.world, p.x, p.y, null, opts) !== null) continue;', `            if (plannerObstacleAt(run.world, p.x, p.y, null, opts) !== null) ${L('"obstacle:" + JSON.stringify(plannerObstacleAt(run.world, p.x, p.y, null, opts)).slice(0,80)')}`);
    rep('            if (others.some((q) => q.rect && rectsOverlap(box, q.rect))) continue;', `            if (others.some((q) => q.rect && rectsOverlap(box, q.rect))) ${L('"presser"')}`);
    rep('            if (wps === null) continue;\n            if (latchedHoldPreview(run, wps, p, standTo, bound, others) !== null) continue;',
      `            if (wps === null) ${L('"noplan"')}\n            { const pv = latchedHoldPreview(run, wps, p, standTo, bound, others); if (pv !== null) ${L('"preview: " + pv + " bound=" + bound + " standTo=" + standTo')} }\n            process.stderr.write("LHC " + JSON.stringify({ p, d, why: "KEPT" }) + "\\n");`);
    if (process.env.LHM_DELAY) rep('        const held = arrived ? NONE : chooseHeld(st, aims[i], DEFAULT_TOLERANCE);', '        const held = (arrived || k < Number(process.env.LHM_DELAY)) ? NONE : chooseHeld(st, aims[i], DEFAULT_TOLERANCE);');
    if (process.env.LHM_DELAY) rep('            w = forkWalkTo(f, keys, c, opts, null, hits0, deaths0);', '            { let dw = null; for (let q = 0; q < Number(process.env.LHM_DELAY) && !dw; q += 1) dw = forkStep(f, keys, new Set(), hits0, deaths0); w = dw ? { why: dw + " (delay)" } : forkWalkTo(f, keys, c, opts, null, hits0, deaths0); }');
    return { ...r, source: src, shortCircuit: true };
  }
  return r;
}

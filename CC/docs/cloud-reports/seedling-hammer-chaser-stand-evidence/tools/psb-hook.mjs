// MEASUREMENT-ONLY loader hook (in memory): seg-hook's patch, plus a SHADOW of PRESS_KILL_STRIKE_BOMBS' stand question:
// every strike the press kill TAKES (bounded pass) is stamped with what `standBlastAt` would say, refusing nothing;
// each taken strike is logged to stderr as `PSB {t, body, cell, pressAt, eta, shadow}`.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  let src = String(r.source);
  const rep = (a, b) => { if (!src.includes(a)) throw new Error('needle missing: ' + a); src = src.replace(a, b); };
  if (url.endsWith('/seedlingDemo/jsRuntimeSolver.js')) {
    rep('const solveMs = clock() - t1;', 'const solveMs = clock() - t1; (globalThis.__SEG ??= []).push(out);');
    return { ...r, source: src, shortCircuit: true };
  }
  if (url.endsWith('/seedlingDemo/solverBot.js')) {
    rep('            ...(bombs ? { bombed } : {}),\n            ...(walk.previewStrikes',
      '            ...(bombs ? { bombed } : {}), __shadow: bombsInPlay(run) ? standBlastAt(o.cell, walk, o.i) : null,\n            ...(walk.previewStrikes');
    rep('                        cycles.push({\n                            body: plan.id,',
      '                        process.stderr.write("PSB " + JSON.stringify({ t: run.ticksCompleted, body: plan.id, cell: next.cell, pressAt: next.pressAt, eta: next.eta, shadow: next.__shadow ?? null }) + "\\n");\n                        cycles.push({\n                            body: plan.id,');
    return { ...r, source: src, shortCircuit: true };
  }
  return r;
}

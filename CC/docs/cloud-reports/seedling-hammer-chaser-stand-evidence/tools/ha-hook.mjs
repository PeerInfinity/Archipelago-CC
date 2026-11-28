// MEASUREMENT-ONLY loader hook (in memory): seg-hook's patch, plus HA_WIDE=1 gives the hit-avoid pass the attempt's
// whole remaining budget instead of its upgrade window (to measure what a try needs); HA_LOG=1 logs each try.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  if (url.endsWith('/seedlingDemo/jsRuntimeSolver.js')) {
    let src = String(r.source);
    const rep = (a, b) => { if (!src.includes(a)) throw new Error('needle missing: ' + a); src = src.replace(a, b); };
    rep('const solveMs = clock() - t1;', 'const solveMs = clock() - t1; (globalThis.__SEG ??= []).push(out);');
    if (process.env.HA_WIDE === '1') rep('const stopAt = budgeted ? Math.min(budgetWork, w0 + upgradeWindowWork(budgetWork, windowWork)) : null;', 'const stopAt = budgeted ? budgetWork : null;');
    rep('        if (!one.ok || one.plan.deadline) continue;', '        process.env.HA_LOG && process.stderr.write(`HA delay=${delay} ok=${one.ok} work=${work.units} ticks=${one.ok ? one.plan.solution.length : null} hits=${one.ok ? JSON.stringify(one.plan.modelHits) : null} dl=${JSON.stringify(one.ok ? one.plan.deadline : one.deadline ?? null)} ${one.ok ? "" : String(one.message).slice(0, 160)}\\n`);\n        if (!one.ok || one.plan.deadline) continue;');
    return { ...r, source: src, shortCircuit: true };
  }
  return r;
}

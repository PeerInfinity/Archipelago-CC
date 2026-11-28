// MEASUREMENT-ONLY loader hook (in memory, no repo edit): seg-hook's patch plus PKSW-HITS' per-tick press-kill
// branch log (globalThis.__KT: body, fight/following/aimed, strike cell, refuge, stall, escape, held keys).
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  const patch = (src, needle, add, before = false) => {
    if (!src.includes(needle)) throw new Error(`needle missing: ${needle}`);
    return src.replace(needle, before ? `${add}${needle}` : `${needle}${add}`);
  };
  if (url.endsWith('/seedlingDemo/jsRuntimeSolver.js')) {
    return { ...r, source: patch(String(r.source), 'const solveMs = clock() - t1;', ' (globalThis.__SEG ??= []).push(out);'), shortCircuit: true };
  }
  if (url.endsWith('/seedlingDemo/solverBot.js')) {
    const src = patch(String(r.source), 'const diedBefore = PRESS_KILL_REBOOT_GUARD.enabled',
      `(globalThis.__KT ??= []).push({ k: perTick.length, body: plan.id, fight: fightKeys !== null, following: following !== null, aimed, strike: strike ? strike.cell : null, refuge, stall: !!phaseStall, escape: !!escape, held: [...held].join('+'), x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1) });\n            `, true);
    return { ...r, source: src, shortCircuit: true };
  }
  return r;
}

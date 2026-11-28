// MEASUREMENT-ONLY loader hook (in memory, no repo edit): seg-hook's patch, plus a per-tick log of the press kill's
// key choice around the OPP and safeStep (globalThis.__CS), and every landsClearOfChasers verdict.
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
    let src = String(r.source);
    src = patch(src, '            let oppTook = STRIKE_NONE;\n',
      `            const __pre = [...held].join('+'); globalThis.__CSK = perTick.length; globalThis.__CSL = [];\n`, true);
    src = patch(src, '            const before = (run.ledger(\'spinnerPressHits\') ?? []).length;\n',
      `            globalThis.__CSOUT?.({ k: perTick.length, pre: __pre, opp: oppTook, held: [...held].join('+'), aim: strike ? 'strike' : (refuge ? 'refuge' : null), charted: strike?.approach ? true : false, stall: !!phaseStall, x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1), pkc: globalThis.__CSL });\n`, true);
    src = patch(src, `    return chaserDanger(run, playerBoxAt(next.x, next.y), 0, rows, { perTick: true }).length === 0;\n}`,
      '', true);
    src = src.replace(`    return chaserDanger(run, playerBoxAt(next.x, next.y), 0, rows, { perTick: true }).length === 0;\n}`,
      `    const __v = chaserDanger(run, playerBoxAt(next.x, next.y), 0, rows, { perTick: true }).length === 0; globalThis.__CSL?.push([...keys].join('+') + (__v ? ':ok' : ':HIT')); return __v;\n}`);
    return { ...r, source: src, shortCircuit: true };
  }
  return r;
}

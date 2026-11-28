// MEASUREMENT-ONLY loader hook (in memory, no repo edit): stash each solveSegment result so the
// instrument can read the plan's verb rows (owner of each hit). Same patch as PKSW-HITS' trace-hooks.mjs, minimal.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  if (url.endsWith('/seedlingDemo/jsRuntimeSolver.js')) {
    const needle = 'const solveMs = clock() - t1;';
    const src = String(r.source);
    if (!src.includes(needle)) throw new Error(`needle missing: ${needle}`);
    return { ...r, source: src.replace(needle, `${needle} (globalThis.__SEG ??= []).push(out);`), shortCircuit: true };
  }
  return r;
}

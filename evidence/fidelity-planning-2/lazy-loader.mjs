// Scratch instrumentation: in solverBot.js, deriveSwingStance's stance hypothesis is computed LAZILY
// (only when a candidate's direct plan fails). Nothing in the tree changes.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  if (!url.endsWith('/seedlingDemo/solverBot.js')) return r;
  let src = String(r.source);
  const a = "    const hypothesis = stanceHypothesis(run, blocked, contacts);\n    let unsafe = 0;";
  if (!src.includes(a)) throw new Error('lazy-loader: deriveSwingStance site not found');
  src = src.replace(a, "    let __hv; const hypothesis = () => (__hv ??= stanceHypothesis(run, blocked, contacts));\n    let unsafe = 0;");
  const b = "    if (!hypothesis.length) return null;";
  if (!src.includes(b)) throw new Error('lazy-loader: stanceReaches site not found');
  src = src.replace(b, "    if (typeof hypothesis === 'function') hypothesis = hypothesis();\n" + b);
  globalThis.__lazyHook = true;
  return { ...r, source: src };
}

// Loader hook (measure only): injects a recorder into seedlingDemo/solveProgress.js as it loads — no tracked edit.
// Every rejection the tree tallies is recorded with its VERBATIM payload (the error / the rung's refused row / the
// search result), through globalThis.__rkRec (defined by census-preload.mjs).
export async function load(url, context, nextLoad) {
    const r = await nextLoad(url, context);
    if (!url.endsWith('/seedlingDemo/solveProgress.js')) return r;
    let src = String(r.source);
    const sub = (a, b) => { if (!src.includes(a)) throw new Error(`census-loader: anchor missing: ${a}`); src = src.replace(a, b); };
    sub("    const reason = err === null ? null : progressReason(err);\n",
        "    const reason = err === null ? null : progressReason(err);\n"
        + "    if (err !== null) globalThis.__rkRec?.('leave', err, seg.stack.slice(at).map((f) => f.node.key));\n");
    sub("        reject(childOf(f.node, `rung:${refused.rung}`, 'rung', refused.rung), progressReason(refused.why));\n",
        "        reject(childOf(f.node, `rung:${refused.rung}`, 'rung', refused.rung), progressReason(refused.why));\n"
        + "        globalThis.__rkRec?.('row', refused, [`${f.node.key}/rung:${refused.rung}`]);\n");
    sub("    else reject(node, progressReason(r.bound ?? r));\n",
        "    else { reject(node, progressReason(r.bound ?? r)); globalThis.__rkRec?.('search', r, [node.key]); }\n");
    return { ...r, source: src, shortCircuit: true };
}

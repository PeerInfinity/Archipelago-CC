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
    // ⛓ RK2: the anchors of the v2 code (RK's were v1's, at 3f5c3ff0fd)
    sub("        reject(node, progressReason(refused.why), kind);\n",
        "        reject(node, progressReason(refused.why), kind);\n"
        + "        globalThis.__rkRec?.('row', refused, [`${f.node.key}/rung:${refused.rung}`]);\n");
    sub("        reject(node, progressReason(r.bound ?? r), kind);\n",
        "        reject(node, progressReason(r.bound ?? r), kind); globalThis.__rkRec?.('search', r, [node.key]);\n");
    return { ...r, source: src, shortCircuit: true };
}

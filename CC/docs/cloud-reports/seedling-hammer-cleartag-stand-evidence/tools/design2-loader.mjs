// MEASUREMENT ONLY (load hook), design (2): the clear-tag keylock stance walk stays transit-only, and the HOLD is
// certified as its own stand probe after the walk (from where the walk arrived, the tail's keys, no strike). A hit in
// it refuses the clear-tag order by name (`hold-hit`); there is no rung to climb once the walk is driven.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const a = '                ...clearTagStandWalk(run, verb, resolved),\n            });\n        }\n';
    if (!src.includes(a)) throw new Error('design2-loader: anchor not found');
    src = src.replace(a, a + '        { const tail2 = clearTagKeylockStand(run, verb, resolved);\n'
        + '          if (resolved.stance && tail2.stand) { const w2 = previewWalk(run, [{ x: run.state.x, y: run.state.y }], 1,'
        + ' { strike: null, ...standTailOpts(tail2.stand) }); const h2 = probeSamples(w2.samples, new Set(resolved.exempt ?? []), {});'
        + ' globalThis.__ctsD2 = (globalThis.__ctsD2 ?? 0) + 1;'
        + ' if (h2) refuseCT(\'hold-hit\', `the hold at the stance is hit at probe tick ${h2.tick} (${JSON.stringify(h2.sources ?? h2).slice(0, 120)})`); } }\n');
    return { ...out, source: src, shortCircuit: true };
}

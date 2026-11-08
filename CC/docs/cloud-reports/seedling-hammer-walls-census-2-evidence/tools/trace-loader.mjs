export async function load(url, context, next) {
    const r = await next(url, context);
    if (url.endsWith('/seedlingDemo/spinner.js')) {
        let sp = String(r.source);
        const a = 'export function hitSpinner(s, { force = 0, from = null, damage = 1, t = \'\', frozen = false } = {}) {';
        if (!sp.includes(a)) throw new Error('trace-loader: hitSpinner anchor not found');
        sp = sp.replace(a, 'export function hitSpinner(s, o = {}) { const out = __hitSpinner(s, o); if (out?.destroy && !s?.destroy) { const at = (new Error().stack.split(\'\\n\')[2] ?? \'\').trim(); process.stderr.write(\'SPINKILL \' + JSON.stringify({ id: s.id, t: o.t ?? \'\', damage: o.damage ?? 1, x: s.x, y: s.y, at }) + \'\\n\'); } return out; }\nfunction __hitSpinner(s, { force = 0, from = null, damage = 1, t = \'\', frozen = false } = {}) {');
        return { ...r, source: sp, shortCircuit: true };
    }
    if (url.endsWith('/seedlingDemo/solverBot.js') && (process.env.WC2_TRACE_WAIT === '1' || process.env.WC2_REWIND_WAIT === '1')) {
        let sb = String(r.source);
        if (process.env.WC2_REWIND_WAIT === '1') {
            const P = await import('./rewind-wait-patch.mjs');
            for (const [a, b] of [[P.PARK_FROM, P.PARK_TO], [P.PRESS_FROM, P.PRESS_TO]]) {
                if (!sb.includes(a)) throw new Error('trace-loader: rewind-wait anchor not found');
                sb = sb.replace(a, b);
            }
            if (process.env.WC2_TRACE_WAIT !== '1') return { ...r, source: sb, shortCircuit: true };
        }
        const w = "            if (!billiard || perTick.length !== t0 || waited + L39_SHAFT_WAIT_STEP > L39_SHAFT_WAIT_MAX) throw e;";
        if (!sb.includes(w)) throw new Error('trace-loader: l39ShaftWalk anchor not found');
        sb = sb.replace(w, "            process.stderr.write('WAITTRACE ' + JSON.stringify({ what: opts.what, billiard, kind: e?.obstacle?.kind ?? null, id: e?.obstacle?.id ?? null, refusal: e instanceof SolverRefusal, ticksSpent: perTick.length - t0, waited }) + '\\n');\n" + w);
        return { ...r, source: sb, shortCircuit: true };
    }
    if (!url.endsWith('/seedlingDemo/dangerMap.js')) return r;
    let src = String(r.source);
    const a0 = "    const live = spinnersTheRunSteps(run);\n";
    // ⛓ WC2_PHANTOM_FIX=1 — THE CANDIDATE (measurement only, never shipped from here): in a room whose spinner roster the
    // run TRACKS (`spinnerBodies` is an array), a census spinner absent from it is gone (killed by any source — press,
    // pulser, bomb, dark hit, ghost swing — or never built), so it is not priced at its placement either.
    if (process.env.WC2_PHANTOM_FIX === '1') {
        src = src.replace(a0, a0 + "    { const ros = run.entities('spinnerBodies'); if (Array.isArray(ros)) { const have = new Set(ros.map((b) => b.id)); for (const inst of (world.combat?.enemies ?? [])) { const id = `${inst.tag}@${inst.x},${inst.y}`; if (/^spinner$/.test(inst.tag) && !have.has(id)) live.add(id); } } }\n");
    }
    if (!src.includes(a0)) throw new Error('trace-loader: roster anchor not found');
    src = src.replace(a0, a0 + "    { const k = (run.entities('spinnerBodies') ?? []).map((b) => b.id).join(','); if (k !== globalThis.__lastRoster) { globalThis.__lastRoster = k; process.stderr.write('SPINROSTER ' + JSON.stringify({ roster: k, ticks: run.ledger('playerHits') ? undefined : undefined, x: run.state?.x, y: run.state?.y }) + '\\n'); } }\n");
    const anchor = "        if (rectsOverlap(box, r)) {\n            out.push({\n                kind: 'enemy',";
    if (!src.includes(anchor)) throw new Error('trace-loader: anchor not found in dangerMap.js');
    src = src.replace(anchor, "        if (rectsOverlap(box, r) && /^spinner/.test(inst.tag) && !globalThis.__spinSeen?.has(`${inst.tag}@${inst.x},${inst.y}:${run.tick ?? ''}`)) {\n"
        + "            (globalThis.__spinSeen ??= new Set()).add(`${inst.tag}@${inst.x},${inst.y}:${run.tick ?? ''}`);\n"
        + "            if ((globalThis.__spinN = (globalThis.__spinN ?? 0) + 1) <= 40) process.stderr.write('SPINTRACE ' + JSON.stringify({ id: `${inst.tag}@${inst.x},${inst.y}`, level: run.level,"
        + " t: run.state?.t ?? null, live: (run.entities('spinnerBodies') ?? []).map((b) => b.id), press: (run.ledger('spinnerPressHits') ?? []).map((h) => ({ id: h.id, landed: h.landed })),"
        + " ledgers: Object.fromEntries(['enemyKills','spinnerKills','removed','kills'].map((k) => { try { return [k, (run.ledger(k) ?? []).length]; } catch { return [k, 'x']; } })) }) + '\\n');\n"
        + "        }\n" + anchor);
    return { ...r, source: src, shortCircuit: true };
}

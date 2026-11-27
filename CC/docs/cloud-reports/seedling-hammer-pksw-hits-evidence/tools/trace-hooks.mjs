// MEASUREMENT-ONLY loader hook (in memory, no repo edit): stash solveSegment results; log the press kill's per-tick branch.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  const patch = (src, needle, add, before = false) => {
    if (!src.includes(needle)) throw new Error(`needle missing: ${needle}`);
    return src.replace(needle, before ? `${add}${needle}` : `${needle}${add}`);
  };
  if (url.endsWith('/seedlingDemo/jsRuntimeSolver.js')) {
    const src = patch(String(r.source), 'const solveMs = clock() - t1;', ' (globalThis.__SEG ??= []).push(out);');
    return { ...r, source: src, shortCircuit: true };
  }
  if (url.endsWith('/seedlingDemo/twoPassSolve.js') && process.env.TRACE_OUT) {
    const src = patch(String(r.source), "checkPrefix(out.perTick, 'the solving pass');",
      " (await import('node:fs')).writeFileSync(process.env.TRACE_OUT, JSON.stringify({ rows: out.trace?.rows ?? null, kt: globalThis.__KT ?? [], prev: globalThis.__PREV ?? null, sdw: globalThis.__SDW ?? null }));");
    return { ...r, source: src, shortCircuit: true };
  }
  if (url.endsWith('/seedlingDemo/solverBot.js')) {
    const src = patch(String(r.source), 'const diedBefore = PRESS_KILL_REBOOT_GUARD.enabled',
      `(globalThis.__KT ??= []).push({ k: perTick.length, body: plan.id, fight: fightKeys !== null, following: following !== null, aimed, strike: strike ? strike.cell : null, refuge, stall: !!phaseStall, escape: !!escape, held: [...held].join('+'), bodyIn: (run.entities('spinnerBodies') ?? []).map((b) => b.id + ':' + b.hitsTimer + ':' + (b.hits ?? '')).join(' ') });\n            `, true);
    let src2 = src;
    if (process.env.REFUGE_BOMBS === '1') src2 = patch(src2, 'asked of each previewed refuge (`PRESS_KILL_BOMBS`, ON since PKB)\n    const bombs = PRESS_KILL_BOMBS.enabled'.replace('\\n', '\n'), ' || true');
    if (process.env.DEAD_NOSTRIKE === '1') src2 = patch(src2, '                if (derived === undefined) {', "                if (derived === undefined && body.hits >= SPINNER.hitsMax) derived = null;\n", true);
    if (process.env.STAND_SIGHT === '1') {
      const a = "                            : planSwordDash(run, wps, { tolerance, dashMode,\n                                certify: (samples) => probeSamples(samples, except),\n                                ...(stand ? { stand } : {}), ...(narrow ? { iframeLapse: false } : {}) });";
      if (!src2.includes(a)) throw new Error('stand sight needle');
      src2 = src2.replace(a, "                            : (() => { const __s = stand !== null && DASH_CERT_SIGHT.enabled; if (__s) dashCertSightDepth += 1; try { return planSwordDash(run, wps, { tolerance, dashMode,\n                                certify: (samples) => probeSamples(samples, except),\n                                ...(stand ? { stand } : {}), ...(narrow ? { iframeLapse: false } : {}) }); } finally { if (__s) dashCertSightDepth -= 1; } })();");
    }
    if (process.env.SDW_AT) {
      const a = "        const c = planSwordDash(run, wps, { ...opts, certify: blind });";
      const b = "        return planSwordDash(run, wps, { ...opts, certify: (samples) => probeSamples(samples, except) });\n    };";
      const w = "        if (arrived && !wholeHit) {\n            return { ...c, why: stand";
      if (!src2.includes(a) || !src2.includes(b) || !src2.includes(w)) throw new Error('sdw needles');
      src2 = src2.replace(a, a + " const __sdw = String(perTick.length) === process.env.SDW_AT ? { depth: dashCertSightDepth, t: perTick.length, blind: c.windows ?? null, blindWhy: c.why ?? null } : null; if (__sdw) (globalThis.__SDW ??= []).push(__sdw);");
      src2 = src2.replace(w, "        if (__sdw) { __sdw.arrived = arrived; __sdw.wholeHit = wholeHit ? { tick: wholeHit.tick, src: (wholeHit.sources ?? []).map((q) => q.id) } : null; }\n" + w);
      src2 = src2.replace(b, "        { const __f = planSwordDash(run, wps, { ...opts, certify: (samples) => probeSamples(samples, except) }); if (__sdw) { __sdw.fallback = __f.windows ?? null; __sdw.fallbackWhy = __f.why ?? null; } return __f; }\n    };");
    }
    if (process.env.PREVIEW_AT) {
      const n = "            // ⛓ hammer DASH: a measurement's row per corridor whose `stand` tail decided";
      if (!src2.includes(n)) throw new Error('preview needle');
      src2 = src2.replace(n, `            if (String(perTick.length) === process.env.PREVIEW_AT && dash?.plan) { if (process.env.PREVIEW_SIGHT === '1') dashCertSightDepth += 1; let pw; try { pw = previewWalk(run, wps, tolerance, { strike: strikePolicyFor(run, { dashPlan: dash.plan, dashMode }) }); } finally { if (process.env.PREVIEW_SIGHT === '1') dashCertSightDepth -= 1; } const ph = probeSamples(pw.samples, except); globalThis.__PREV = { probeHit: ph ? { x: ph.x, y: ph.y, tick: ph.tick, sources: (ph.sources ?? []).map((q) => q.id ?? q.kind) } : null, except: except ? [...except].map(String) : null, wps, why: dash.why, branch: (dashFirst && !narrow) ? 'dashFirst' : (!narrow && corridorDashCertified?.wps === wps) ? 'corridorDashCertified' : wholeAsk ? 'spinnerDashWhole' : 'planSwordDash', startTick: pw.startTick, truncated: pw.truncated ?? null, samples: pw.samples.map((s) => ({ t: s.tick, x: s.x, y: s.y, ch: (s.chasers ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hit: c.hitsTimer ?? c.hits ?? null })) })) }; }\n${n}`);
    }
    if (process.env.NODASH_AT) {
      const n = "            const dash = (dashMode === 'none' || axisAligned";
      if (!src2.includes(n)) throw new Error('nodash needle');
      src2 = src2.replace(n, "            const dash = (String(perTick.length) === process.env.NODASH_AT || dashMode === 'none' || axisAligned");
    }
    return { ...r, source: src2, shortCircuit: true };
  }
  return r;
}

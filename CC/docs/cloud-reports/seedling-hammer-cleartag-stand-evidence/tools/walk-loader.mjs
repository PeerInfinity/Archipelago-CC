// MEASUREMENT ONLY (load hook): solverBot's `walkToRun` reports every walk it runs to globalThis.__ctsWalk:
// {run, what, t0 (run.ticksCompleted at entry), t1 (at exit, or null on a throw), stand (the tail's ticks or null)}.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const a = '    const walkToRun = (goal, aim, opts) => (activeProgress === null ? walkToUnder(goal, aim, opts)\n'
        + '        : progressRun(\'walk\', \'walk\', \'walk\', () => walkToUnder(goal, aim, opts)));';
    if (!src.includes(a)) throw new Error('walk-loader: anchor not found');
    src = src.replace(a, '    const walkToRun0 = (goal, aim, opts) => (activeProgress === null ? walkToUnder(goal, aim, opts)\n'
        + '        : progressRun(\'walk\', \'walk\', \'walk\', () => walkToUnder(goal, aim, opts)));\n'
        + '    const walkToRun = (goal, aim, opts) => { const rec = { run, what: opts?.what ?? null, t0: run.ticksCompleted,'
        + ' t1: null, aim: aim ? { x: aim.x, y: aim.y } : null, stand: opts?.stand?.ticks ?? null,'
        + ' axisAligned: Boolean(opts?.axisAligned) }; globalThis.__ctsWalk?.(rec);'
        + ' const r = walkToRun0(goal, aim, opts); rec.t1 = run.ticksCompleted; rec.x = run.state.x; rec.y = run.state.y; return r; };');
    return { ...out, source: src, shortCircuit: true };
}

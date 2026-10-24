#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-escape-cache D1): instrument a COPY of solverBot.js so every pressEscape call writes one
JSON line (the call's inputs hashed, its answer hashed, its wall clock, its shouldStop asks and onNode count).
usage: make-lab.py <solverBot.js>   (edits in place; refuses the tracked tree)"""
import sys
p = sys.argv[1]
assert '/scratchpad/' in p, p
s = open(p).read()

def sub(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:80], s.count(old))
    s = s.replace(old, new)

# 1. strikeEscape passes its cell through (pressEscapeOnce ignores the extra field)
sub("""    return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys,
        pressAt: run.ticksCompleted + i, id: bodyId, caller });""",
"""    return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys,
        pressAt: run.ticksCompleted + i, id: bodyId, caller, labCell: cell });""")

# 2. the lab wrapper around pressEscape
sub("""function pressEscape(run, opts) {
    const sink = HAMMER_ESCAPE_TRACE.sink;""",
"""function pressEscape(run, opts) {
    if (EX_LAB !== null) return EX_LAB.call(run, opts, () => pressEscapeTraced(run, opts));
    return pressEscapeTraced(run, opts);
}
const EX_LAB = globalThis.process?.env?.EX_LAB_OUT ? await (async () => {
    const fs = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const fd = fs.openSync(globalThis.process.env.EX_LAB_OUT, 'a');
    const h = (x) => createHash('md5').update(x).digest('hex').slice(0, 16);
    const ser = (v) => {
        if (v === null) return 'null';
        if (v === undefined) return 'u';
        if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
        if (typeof v === 'string') return JSON.stringify(v);
        if (typeof v === 'boolean') return v ? 'T' : 'F';
        if (typeof v === 'symbol') return `sym(${v.description})`;
        if (typeof v === 'function') return 'fn';
        if (v instanceof Set) return `S[${[...v].map(ser).sort().join(',')}]`;
        if (v instanceof Map) return `M[${[...v].map(([k, x]) => `${ser(k)}:${ser(x)}`).join(',')}]`;
        if (Array.isArray(v)) return `[${v.map(ser).join(',')}]`;
        const ks = Object.keys(v).sort().map((k) => `${k}:${ser(v[k])}`);
        for (const sy of Object.getOwnPropertySymbols(v)) ks.push(`${ser(sy)}:${ser(v[sy])}`);
        return `{${ks.join(',')}}`;
    };
    const runs = new WeakMap();
    let nextRun = 0;
    const counters = { asks: 0, nodes: 0, seg: 0 };
    return {
        counters,
        call(run, opts, fn) {
            if (!runs.has(run)) runs.set(run, nextRun++);
            const d = activeDeadline;
            const globals = h(ser({ cf: { ...CONTACT_FIDELITY }, ghost: GHOST_SPINNER_PRESS.enabled,
                dl: d === null ? 'none' : (d.tripped.has('hammer-escape') ? 'tripped' : 'live'),
                fine: d?.fine ?? null, prog: activeProgress !== null }));
            const args = h(ser({ state: opts.state, at: opts.at, keys: opts.keys, pressAt: opts.pressAt, id: opts.id,
                deadline: opts.deadline ?? true }));
            const world = h(ser({ level: run.level, n: run.ticksCompleted, live: run.entities('spinnerBodies'),
                st: run.state, gt: run.gameTime }));
            const a0 = counters.asks;
            const n0 = counters.nodes;
            const t0 = globalThis.performance.now();
            const out = fn();
            const ms = globalThis.performance.now() - t0;
            fs.writeSync(fd, JSON.stringify({ run: runs.get(run), n: run.ticksCompleted, level: run.level,
                caller: opts.caller ?? 'aim', id: opts.id, pressAt: opts.pressAt, at: opts.at,
                cell: opts.labCell ? [opts.labCell.x, opts.labCell.y] : null, args, globals, world,
                player: h(ser(opts.state)), ans: h(ser(out)), seg: counters.seg,
                cert: h(ser({ ok: out.ok, claim: out.claim, bound: out.bound ?? null, keys: out.keys ?? null,
                    states: out.states ?? null, landing: out.landing ?? null })), ok: out.ok, claim: out.claim, bound: out.bound ?? null,
                asks: counters.asks - a0, nodes: counters.nodes - n0, ms: Math.round(ms * 1000) / 1000 }) + '\\n');
            return out;
        },
    };
})() : null;
function pressEscapeTraced(run, opts) {
    const sink = HAMMER_ESCAPE_TRACE.sink;""")

# 3. count every ask point and every kept node (a non-null shouldStop answering false asks nothing of the deadline)
sub("""        shouldStop: deadline && activeDeadline !== null ? () => deadlineReached('hammer-escape') : null,
        onNode: activeProgress === null ? null : progressStatesFor(run, n),
    }));""",
"""        shouldStop: EX_LAB === null ? (deadline && activeDeadline !== null ? () => deadlineReached('hammer-escape') : null)
            : (() => { EX_LAB.counters.asks += 1;
                return deadline && activeDeadline !== null ? deadlineReached('hammer-escape') : false; }),
        onNode: EX_LAB === null ? (activeProgress === null ? null : progressStatesFor(run, n))
            : ((on) => (q, i) => { EX_LAB.counters.nodes += 1; if (on !== null) on(q, i); })(
                activeProgress === null ? null : progressStatesFor(run, n)),
    }));""")
sub("""function solveSegmentDeadlined(o) {
    const shouldStop = o?.shouldStop ?? null;""", """function solveSegmentDeadlined(o) {
    if (EX_LAB !== null) EX_LAB.counters.seg += 1;
    const shouldStop = o?.shouldStop ?? null;""")
open(p, 'w').write(s)
print('lab applied', p)

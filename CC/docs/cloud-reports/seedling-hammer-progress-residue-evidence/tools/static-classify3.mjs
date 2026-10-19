// Measure only (PR): static-classify.mjs over static-sites3's rows — every file of the closure, the `filled` head
// (`${…}` → `7`) unless --raw, and the plain `new Error(` form rebuilt as a plain Error (its kind is `error` unless a
// sentence rule names it). An INDICATOR, as RK's and RK2's were: a wrapped inner `why` is unknown statically.
// node static-classify3.mjs <static-sites3.jsonl> <solveProgress.js> [--raw] → one JSON line per site, then the summary
import { readFileSync } from 'node:fs';
const [sites, mod] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const raw = process.argv.includes('--raw');
const { progressKind } = await import(mod);
const R = '/home/user/Archipelago-CC';
const srcOf = new Map();
const lineOf = (f, n) => { if (!srcOf.has(f)) srcOf.set(f, readFileSync(`${R}/${f}`, 'utf8').split('\n')); return srcOf.get(f)[n - 1]; };
const by = {};
for (const r of readFileSync(sites, 'utf8').trim().split('\n').map((l) => JSON.parse(l))) {
    // a BARE literal (`'deadline'`) is its text unless --raw: a run writes no quotes
    const h = raw ? r.head : (/^(['"`])([^'"`]*)\1$/.exec(r.filled)?.[2] ?? r.filled);
    const ob = /obstacle: \{ kind: '([a-z-]+)'/.exec(r.head)?.[1] ?? null;
    let x;
    let kind;
    if (r.file.endsWith('/solveProgress.js')) continue;   // the emitter itself (its `lastWhy = {why: …}`) is no site
    if (r.form === 'kind=') kind = 'n/a (planSwordDash window row)';
    else {
        // ⚠ a `refuse(` OUTSIDE solverBot.js throws its module's own Error subclass (EntityRecordError,
        // ProfileOverrideError, R7AcceptanceError, tapeEnvelope's `fail`): only solverBot.js builds a SolverRefusal
        const bot = r.file.endsWith('/solverBot.js');
        if (r.form === 'Error' || (!bot && (r.form === 'refuse' || r.form === 'fail'))) x = new Error(h);
        else if (r.form === 'PendingDeclaration') x = Object.assign(new Error(h), { name: 'PendingDeclaration' });
        else if (r.form === 'refuseCT') x = Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: { kind: 'clear-tag', reason: /^'([a-z-]+)'/.exec(r.head)?.[1] } });
        else if (r.form === 'refuseDanger') x = Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: { kind: 'danger' } });
        else if (r.form === 'fail' || r.form === 'SolverBotError') x = Object.assign(new Error(h), { name: 'SolverBotError', code: /code: (HAMMER_SAFETY|STRIKE_BOUND_EXHAUSTED)/.exec(r.head)?.[1] ?? null });
        else if (r.form === 'SolverRefusal' || r.form === 'refuse') x = Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: ob ? { kind: ob } : null });
        else if (r.form === 'bound:') x = { ok: false, bound: /bound: '([a-z-]+)'/.exec(lineOf(r.file, r.line))?.[1] ?? null, why: h };
        else x = { why: h };
        kind = progressKind(x);
    }
    by[r.file] ??= {};
    by[r.file][kind] = (by[r.file][kind] ?? 0) + 1;
    console.log(JSON.stringify({ file: r.file, line: r.line, form: r.form, kind, head: r.head }));
}
const total = {};
for (const k of Object.values(by)) for (const [kk, v] of Object.entries(k)) total[kk] = (total[kk] ?? 0) + v;
console.log(JSON.stringify({ summary: true, files: Object.keys(by).length, total, solverBot: by['frontend/modules/seedlingDemo/solverBot.js'] }));

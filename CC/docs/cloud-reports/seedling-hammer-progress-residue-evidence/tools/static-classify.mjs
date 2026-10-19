// Measure only: classify every static refusal site (static-sites.jsonl) with progressKind, from the site's literal
// head and the fields its form carries. Approximate by construction (a head is the sentence's first ~200 source
// chars with `${…}` unexpanded, and a wrapped inner `why` is unknown), so it is an INDICATOR of coverage, not a gate.
// node static-classify.mjs <static-sites.jsonl> <solveProgress.js> [solverBot.js]
import { readFileSync } from 'node:fs';
const [sites, mod] = process.argv.slice(2);
const { progressKind } = await import(mod);
const src = readFileSync(process.argv[4] ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js', 'utf8').split('\n');
const rows = readFileSync(sites, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const out = [];
for (const r of rows) {
    const h = r.head;
    const ob = /obstacle: \{ kind: '([a-z-]+)'/.exec(h)?.[1] ?? null;
    let x;
    if (r.form === 'kind=') { out.push({ ...r, kind: 'n/a (planSwordDash window row)' }); continue; }
    if (r.form === 'PendingDeclaration') x = Object.assign(new Error(h), { name: 'PendingDeclaration' });
    else if (r.form === 'refuseCT') x = Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: { kind: 'clear-tag', reason: /^'([a-z-]+)'/.exec(h)?.[1] } });
    else if (r.form === 'refuseDanger') x = Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: { kind: 'danger' } });
    else if (r.form === 'fail' || r.form === 'SolverBotError') x = Object.assign(new Error(h), { name: 'SolverBotError', code: /code: (HAMMER_SAFETY|STRIKE_BOUND_EXHAUSTED)/.exec(h)?.[1] ?? null });
    else if (r.form === 'SolverRefusal' || r.form === 'refuse') x = Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: ob ? { kind: ob } : null });
    else if (r.form === 'bound:') x = { ok: false, bound: /bound: '([a-z-]+)'/.exec(src[r.line - 1])?.[1] ?? null, why: h };
    else x = { why: h };
    out.push({ ...r, kind: progressKind(x) });
}
const by = {};
for (const o of out) { by[o.form] ??= {}; by[o.form][o.kind] = (by[o.form][o.kind] ?? 0) + 1; }
console.log(JSON.stringify({ sites: out.length, byForm: by }));
for (const o of out) console.log(JSON.stringify({ line: o.line, form: o.form, kind: o.kind, head: process.env.RK2_FULL ? o.head : o.head.slice(0, 140) }));

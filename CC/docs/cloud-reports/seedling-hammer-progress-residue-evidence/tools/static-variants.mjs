// Measure only (PR D1): RK2's instrument reads a site's head with every `${…}` UNEXPANDED, so the words a run writes
// can differ from the words it classifies: a variable NAME can match a rule (`${bound}` matches `\bbound\b`, though a
// run writes a number), and a literal BRANCH of a ternary is read only fused with the others. Here each `${…}` is
// expanded to each string literal inside it (recursively) and to `7` (a value), and every VARIANT is classified.
// A site whose variants include `other` is in the runtime residue (over-approximate: a `7` variant of an expression
// that is always one of its literals does not occur at run time — each such site is read by hand in the report).
// node static-variants.mjs <static-sites3.jsonl> <solveProgress.js> [file-suffix=solverBot.js]
import { readFileSync } from 'node:fs';
const [sites, mod, suffix = 'solverBot.js'] = process.argv.slice(2);
const { progressKind } = await import(mod);
const CAP = 256;
/** The end index (exclusive) of the `${…}` whose `$` is at k (braces counted, quoted text skipped). */
function closeOf(s, k) {
    let depth = 0;
    for (let e = k + 1; e < s.length; e += 1) {
        const c = s[e];
        if (c === '\'' || c === '"') { e = skipQ(s, e); continue; }
        if (c === '`') { e = skipT(s, e); continue; }
        if (c === '{') depth += 1;
        if (c === '}' && --depth === 0) return e + 1;
    }
    return s.length;
}
function skipQ(s, i) { const q = s[i]; for (let e = i + 1; e < s.length; e += 1) { if (s[e] === '\\') { e += 1; continue; } if (s[e] === q) return e; } return s.length; }
function skipT(s, i) {
    for (let e = i + 1; e < s.length; e += 1) {
        if (s[e] === '\\') { e += 1; continue; }
        if (s[e] === '`') return e;
        if (s[e] === '$' && s[e + 1] === '{') e = closeOf(s, e) - 1;
    }
    return s.length;
}
/** The string literals of an expression (top level of the expression; a template's text keeps its own `${…}`). */
function literalsIn(expr) {
    const out = [];
    for (let i = 0; i < expr.length; i += 1) {
        const c = expr[i];
        if (c === '\'' || c === '"') { const e = skipQ(expr, i); out.push(expr.slice(i + 1, e)); i = e; } else if (c === '`') { const e = skipT(expr, i); out.push(expr.slice(i + 1, e)); i = e; }
    }
    return out;
}
/** Every spelling of `s` with its `${…}` expanded (capped). */
function variants(s) {
    // a BARE literal (`'deadline'`) is its text: a run writes no quotes
    const bare = /^(['"`])([^'"`]*)\1$/.exec(s);
    if (bare) return [bare[2]];
    const k = s.indexOf('${');
    if (k < 0) return [s.replace(/\\(['`"])/g, '$1')];
    const e = closeOf(s, k);
    const expr = s.slice(k + 2, e - 1);
    const opts = ['7', ...literalsIn(expr).flatMap(variants)];
    const rest = variants(s.slice(e));
    const out = [];
    for (const o of new Set(opts)) for (const r of rest) { if (out.length < CAP) out.push(s.slice(0, k) + o + r); }
    return out;
}
const wrapper = (r) => /^`\$\{[\w.]+\}: \$\{[\w.]+\}`/.test(r.head) || /^[a-z][\w.]*\s*[,)]/.test(r.head)
    || (r.form === 'why=' && !/^['"`]/.test(r.head))
    || /why: [A-Za-z]\w*\s*$/.test(r.head) || /^[a-z]\w*\(/.test(r.head) || /^[a-z][\w.]*$/.test(r.head)
    || /\$\{(?:[\w.]*[wW]hy|[\w.]*\.message)\}`\s*(?:,|$)/.test(r.head) || /\$\{r\.why\}`\)\.join/.test(r.head)
    || /^`\$\{[\w.]*[wW]hy\} /.test(r.head) || /\$\{String\([\w.]+\.message\)[^}]*\}`\s*(?:,|$)/.test(r.head);
const payload = (r, h) => {
    const ob = /obstacle: \{ kind: '([a-z-]+)'/.exec(r.head)?.[1] ?? null;
    if (r.form === 'Error') return new Error(h);
    if (r.form === 'PendingDeclaration') return Object.assign(new Error(h), { name: 'PendingDeclaration' });
    if (r.form === 'refuseCT') return Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: { kind: 'clear-tag', reason: /^'([a-z-]+)'/.exec(r.head)?.[1] } });
    if (r.form === 'refuseDanger') return Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: { kind: 'danger' } });
    if (r.form === 'fail' || r.form === 'SolverBotError') return Object.assign(new Error(h), { name: 'SolverBotError', code: /code: (HAMMER_SAFETY|STRIKE_BOUND_EXHAUSTED)/.exec(r.head)?.[1] ?? null });
    if (r.form === 'SolverRefusal' || r.form === 'refuse') return Object.assign(new Error(h), { name: 'SolverRefusal', obstacle: ob ? { kind: ob } : null });
    return { why: h };   // a row / a why= / a bound: (its bound field is read by static-classify3; here, the words)
};
let n = 0;
const res = [];
const multi = [];
for (const r of readFileSync(sites, 'utf8').trim().split('\n').map((l) => JSON.parse(l))) {
    if (!r.file.endsWith(suffix) || r.form === 'kind=' || r.form === 'bound:' || wrapper(r)) continue;
    n += 1;
    const kinds = {};
    for (const v of variants(r.head)) { const k = progressKind(payload(r, v)); (kinds[k] ??= []).push(v); }
    const ks = Object.keys(kinds);
    if (ks.includes('other')) res.push({ line: r.line, form: r.form, kinds: ks, other: kinds.other.slice(0, 3).map((v) => v.slice(0, 400)) });
    else if (ks.length > 1) multi.push({ line: r.line, kinds: ks });
}
console.log(JSON.stringify({ sites: n, residue: res.length, branchDependent: multi.length }));
for (const r of res) console.log(JSON.stringify(r));

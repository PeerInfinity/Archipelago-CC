// SCRATCH (seedling-fidelity-digest D1): the BY-CODE census of createLevelRun's closure state.
// For every binding declared at createLevelRun's top scope (params, let/const/var, function decls):
//   kind (param / let / const-fn / const-data / fn), its writers (assignments, update exprs, member writes,
//   mutating calls), its readers — each attributed to the top-scope FUNCTION (or run-object member) it sits in.
// Then: the call graph among top-scope functions + run members, and the closure reached from given run members.
// usage: node closure-census.mjs <levelRun.js> [--from=m1,m2] [--json=out.json]
import fs from 'node:fs';
import { parse } from '/home/user/Archipelago-CC/node_modules/@babel/parser/lib/index.js';
const file = process.argv[2];
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const src = fs.readFileSync(file, 'utf8');
const ast = parse(src, { sourceType: 'module', plugins: ['topLevelAwait'], errorRecovery: true });
let fn = null;
for (const s of ast.program.body) {
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
    if (d?.type === 'FunctionDeclaration' && d.id?.name === 'createLevelRun') fn = d;
}
const KEYS = (n) => Object.keys(n).filter((k) => !['loc', 'start', 'end', 'leadingComments', 'trailingComments',
    'innerComments', 'extra', 'range'].includes(k));
function walk(n, f, parent = null, pkey = null) {
    if (!n || typeof n.type !== 'string') return;
    if (f(n, parent, pkey) === false) return;
    for (const k of KEYS(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach((x) => walk(x, f, n, k));
        else if (v && typeof v.type === 'string') walk(v, f, n, k);
    }
}
const isFn = (n) => n && ['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration', 'ObjectMethod'].includes(n.type);
// 1. top-scope bindings
const B = new Map();
const add = (name, kind, line, init = null) => B.set(name, { name, kind, line, init, writers: new Map(), readers: new Map() });
const patNames = (p, out = []) => {
    if (!p) return out;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'AssignmentPattern') patNames(p.left, out);
    else if (p.type === 'ObjectPattern') p.properties.forEach((q) => patNames(q.type === 'RestElement' ? q.argument : q.value, out));
    else if (p.type === 'ArrayPattern') p.elements.forEach((q) => patNames(q, out));
    else if (p.type === 'RestElement') patNames(p.argument, out);
    return out;
};
for (const p of fn.params) for (const nm of patNames(p)) add(nm, 'param', p.loc.start.line);
let runObj = null;
for (const s of fn.body.body) {
    if (s.type === 'VariableDeclaration') {
        for (const d of s.declarations) {
            for (const nm of patNames(d.id)) {
                const k = s.kind === 'let' || s.kind === 'var' ? 'let' : (isFn(d.init) ? 'const-fn' : 'const-data');
                add(nm, k, d.loc.start.line, d.init);
            }
        }
    } else if (s.type === 'FunctionDeclaration') add(s.id.name, 'fn', s.loc.start.line, s);
    else if (s.type === 'ReturnStatement' && s.argument?.type === 'ObjectExpression') runObj = s.argument;
}
// 2. the "owner" of every node: the top-scope function binding / run member it is inside
const units = new Map(); // unitName -> node
for (const b of B.values()) if (b.kind === 'fn' || b.kind === 'const-fn') units.set(b.name, b.init);
// const-data whose init contains functions (objects of closures) — treat each as a unit too
for (const b of B.values()) if (b.kind === 'const-data' || b.kind === 'let') if (b.init) units.set(`=${b.name}`, b.init);
for (const p of runObj.properties) {
    const nm = p.key?.name ?? p.key?.value;
    units.set(`run.${nm}`, p);
}
// statements at top scope that are not declarations (loops, calls at construction)
units.set('<construction>', { type: 'Block', body: fn.body.body.filter((s) => s.type !== 'VariableDeclaration'
    && s.type !== 'FunctionDeclaration' && s !== runObj && !(s.type === 'ReturnStatement')) });
const MUT = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin', 'set', 'add',
    'delete', 'clear']);
const rootIdent = (n) => { while (n && (n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression')) n = n.object; return n?.type === 'Identifier' ? n.name : null; };
const calls = new Map();
const note = (map, unit, line) => { if (!map.has(unit)) map.set(unit, []); map.get(unit).push(line); };
for (const [unit, node] of units) {
    // shadowing: collect names declared INSIDE the unit (params / local decls) — a coarse but conservative filter
    const local = new Set();
    walk(node, (n) => {
        if (isFn(n)) for (const p of n.params) patNames(p).forEach((x) => local.add(x));
        if (n.type === 'VariableDeclarator') patNames(n.id).forEach((x) => local.add(x));
        if (n.type === 'CatchClause' && n.param) patNames(n.param).forEach((x) => local.add(x));
    });
    calls.set(unit, new Set());
    const node0 = node.type === 'Block' ? { type: 'Program', body: node.body } : node;
    walk(node0, (n, parent, pkey) => {
        if (n.type !== 'Identifier' || !B.has(n.name)) return;
        if (process.env.NOSHADOW !== "1" && local.has(n.name) && !(unit.startsWith('=') && unit.slice(1) === n.name)) return;
        if (parent && (parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && pkey === 'property' && !parent.computed) return;
        if (parent && (parent.type === 'ObjectProperty') && pkey === 'key' && !parent.computed) { if (!parent.shorthand) return; }
        if (parent && parent.type === 'ObjectMethod' && pkey === 'key') return;
        const b = B.get(n.name);
        const line = n.loc.start.line;
        // writes
        if (parent?.type === 'AssignmentExpression' && pkey === 'left') return note(b.writers, unit, line);
        if (parent?.type === 'UpdateExpression') return note(b.writers, unit, line);
        let top = n; let p = parent; let k = pkey;
        // climb member chain: x.a.b = …  /  x.a.push(…)
        const chain = [];
        let cur = n; let up = parent;
        // find full member chain rooted at n
        void top; void p; void k; void chain; void cur; void up;
        note(b.readers, unit, line);
        if (b.kind === 'fn' || b.kind === 'const-fn') calls.get(unit).add(n.name);
        if (b.kind === 'const-data' || b.kind === 'let') calls.get(unit).add(`=${n.name}`);
    });
    // member writes / mutating calls rooted at a binding
    walk(node0, (n) => {
        if (n.type === 'AssignmentExpression' && (n.left.type === 'MemberExpression')) {
            const r = rootIdent(n.left); if (r && B.has(r) && !local.has(r)) note(B.get(r).writers, unit, n.loc.start.line);
        }
        if (n.type === 'UpdateExpression' && n.argument.type === 'MemberExpression') {
            const r = rootIdent(n.argument); if (r && B.has(r) && !local.has(r)) note(B.get(r).writers, unit, n.loc.start.line);
        }
        if ((n.type === 'CallExpression' || n.type === 'OptionalCallExpression') && (n.callee.type === 'MemberExpression' || n.callee.type === 'OptionalMemberExpression')
            && !n.callee.computed && MUT.has(n.callee.property.name)) {
            const r = rootIdent(n.callee.object); if (r && B.has(r) && !local.has(r)) note(B.get(r).writers, unit, n.loc.start.line);
        }
    });
}
const from = arg('from', '').split(',').filter(Boolean);
const reach = new Set();
const q = from.map((m) => `run.${m}`);
while (q.length) {
    const u = q.pop(); if (reach.has(u)) continue; reach.add(u);
    for (const c of calls.get(u) ?? []) if (units.has(c)) q.push(c);
}
// module-level flag-shaped names (UPPER_CASE) read inside the reach — the globals a reader consults
const mod = new Map();
for (const s0 of ast.program.body) {
    if (s0.type === 'ImportDeclaration') for (const sp of s0.specifiers) mod.set(sp.local.name, `import ${s0.source.value}`);
    const d = s0.type === 'ExportNamedDeclaration' ? s0.declaration : s0;
    if (d?.type === 'VariableDeclaration') for (const x of d.declarations) if (x.id.type === 'Identifier') mod.set(x.id.name, `levelRun.js:${x.loc.start.line}`);
    if (d?.type === 'FunctionDeclaration') mod.set(d.id.name, `fn levelRun.js:${d.loc.start.line}`);
}
const modReads = new Map();
const modFnSeen = new Set();
const modFnQ = [];
const scanMod = (unit, node) => walk(node.type === 'Block' ? { type: 'Program', body: node.body } : node, (n, parent, pkey) => {
    if (n.type !== 'Identifier' || !mod.has(n.name) || B.has(n.name)) return;
    if (parent && (parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && pkey === 'property' && !parent.computed) return;
    if (/^[A-Z][A-Z0-9_]+$/.test(n.name)) { if (!modReads.has(n.name)) modReads.set(n.name, new Set()); modReads.get(n.name).add(unit); }
    if (mod.get(n.name).startsWith('fn ') && !modFnSeen.has(n.name)) { modFnSeen.add(n.name); modFnQ.push(n.name); }
});
for (const u of reach) scanMod(u, units.get(u));
const modFns = new Map();
for (const s0 of ast.program.body) { const d = s0.type === 'ExportNamedDeclaration' ? s0.declaration : s0; if (d?.type === 'FunctionDeclaration') modFns.set(d.id.name, d); }
while (modFnQ.length) { const f = modFnQ.pop(); scanMod(`fn:${f}`, modFns.get(f)); }
const rows = [...B.values()].map((b) => ({
    name: b.name, kind: b.kind, line: b.line,
    writers: Object.fromEntries([...b.writers].map(([u, ls]) => [u, [...new Set(ls)]])),
    readers: Object.fromEntries([...b.readers].map(([u, ls]) => [u, [...new Set(ls)]])),
    reachedRead: [...b.readers.keys()].filter((u) => reach.has(u)),
    reachedWrite: [...b.writers.keys()].filter((u) => reach.has(u)),
}));
const out = { modReads: Object.fromEntries([...modReads].map(([k, v]) => [k, { from: mod.get(k), units: [...v] }])), file, runObject: [runObj.loc.start.line, runObj.loc.end.line], units: units.size, bindings: rows.length,
    reach: [...reach].sort(), rows };
if (arg('json', '')) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
const mutable = rows.filter((r) => r.kind === 'let' || (r.kind === 'const-data' && Object.keys(r.writers).some((u) => u !== '<construction>' && u !== `=${r.name}`)));
console.log(`bindings ${rows.length}; units ${units.size}; reached from [${from}] ${reach.size} units`);
console.log(`mutable after construction: ${mutable.length}; of them read inside the reach: ${mutable.filter((r) => r.reachedRead.length).length}`);
console.log(`module-level UPPER names read in the reach (${modReads.size}): ${[...modReads.keys()].sort().join(' ')}`);
for (const r of mutable) {
    const w = Object.keys(r.writers).filter((u) => u !== '<construction>');
    console.log(`${r.reachedRead.length ? 'R' : '-'} ${r.kind.padEnd(10)} ${r.name.padEnd(34)} :${r.line}  W[${w.join(' ')}]`);
}

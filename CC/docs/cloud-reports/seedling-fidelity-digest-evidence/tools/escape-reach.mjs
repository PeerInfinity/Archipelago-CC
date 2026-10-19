// SCRATCH (seedling-fidelity-digest D1): which RUN members a call can read, by code. Starting at the named top-level
// functions, follow every call to a top-level function of the given modules (by name), and collect the members read
// on the identifier `run` (and on `run`'s const aliases), plus every module-level binding read (the "globals").
// usage: node escape-reach.mjs <entry1,entry2> <file>...
import fs from 'node:fs';
import { parse } from '/home/user/Archipelago-CC/node_modules/@babel/parser/lib/index.js';
const [entries, ...files] = process.argv.slice(2);
const fns = new Map(); const topBindings = new Map();
const KEYS = (n) => Object.keys(n).filter((k) => !['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra'].includes(k));
function walk(n, f, parent = null, pkey = null) {
    if (!n || typeof n.type !== 'string') return;
    if (f(n, parent, pkey) === false) return;
    for (const k of KEYS(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => walk(x, f, n, k)); else if (v && typeof v.type === 'string') walk(v, f, n, k); }
}
for (const file of files) {
    const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['topLevelAwait'], errorRecovery: true });
    for (const s of ast.program.body) {
        if (s.type === 'ImportDeclaration') for (const sp of s.specifiers) topBindings.set(sp.local.name, { file: `${file}<-${s.source.value}`, line: s.loc.start.line, imported: true });
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        if (d?.type === 'FunctionDeclaration') fns.set(d.id.name, { file, node: d });
        if (d?.type === 'VariableDeclaration') for (const x of d.declarations) if (x.id.type === 'Identifier') {
            if (x.init && ['ArrowFunctionExpression', 'FunctionExpression'].includes(x.init.type)) fns.set(x.id.name, { file, node: x.init });
            else topBindings.set(x.id.name, { file, line: x.loc.start.line });
        }
    }
}
const seen = new Set(); const q = entries.split(',');
const runReads = new Map(); const globals = new Map();
while (q.length) {
    const name = q.pop(); if (seen.has(name) || !fns.has(name)) continue; seen.add(name);
    const { file, node } = fns.get(name);
    const runNames = new Set(['run']);
    walk(node, (n) => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init?.type === 'Identifier' && runNames.has(n.init.name)) runNames.add(n.id.name); });
    walk(node, (n, parent, pkey) => {
        if (n.type === 'Identifier' && parent && !((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && pkey === 'property' && !parent.computed)
            && !(parent.type === 'ObjectProperty' && pkey === 'key' && !parent.shorthand)) {
            if (fns.has(n.name)) q.push(n.name);
            else if (topBindings.get(n.name)?.imported && /^[A-Z][A-Z0-9_]+$/.test(n.name)) { const k = `${n.name} (import ${topBindings.get(n.name).file.split('<-')[1]})`; if (!globals.has(k)) globals.set(k, new Set()); globals.get(k).add(name); }
            if (topBindings.has(n.name) && !topBindings.get(n.name).imported) { const k = `${n.name} (${topBindings.get(n.name).file.split('/').pop()}:${topBindings.get(n.name).line})`; if (!globals.has(k)) globals.set(k, new Set()); globals.get(k).add(name); }
        }
        if ((n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') && n.object.type === 'Identifier' && runNames.has(n.object.name) && !n.computed) {
            const k = n.property.name; if (!runReads.has(k)) runReads.set(k, new Set()); runReads.get(k).add(`${name}:${n.loc.start.line}`);
        }
    });
}
console.log(`functions reached (${seen.size}): ${[...seen].sort().join(' ')}`);
console.log(`\nrun members read (${runReads.size}):`);
for (const [k, v] of [...runReads].sort()) console.log(`  run.${k.padEnd(28)} ${[...v].join(' ')}`);
console.log(`\nmodule-level bindings read (${globals.size}):`);
for (const [k, v] of [...globals].sort()) console.log(`  ${k.padEnd(60)} ${[...v].slice(0, 6).join(' ')}`);

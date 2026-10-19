#!/usr/bin/env node
/**
 * HOUSEKEEP D1 — census, BY CODE, of every plain-`Error` throw reachable from `solveSegment` / `twoPassSolve`.
 *
 * 1. the import closure of `solverBot.js` + `twoPassSolve.js` (non-test modules under frontend/);
 * 2. every function-like node (declaration, `const f = () =>`, method, object property) in it, with the names it calls
 *    (`f()`, `x.f()`, and identifiers passed as values — an OVER-approximation: a name matches every function so named);
 * 3. reachability from the two roots over that by-name graph;
 * 4. every `throw new Error(...)` / `throw Error(...)` (and `throw e` where `e = new Error(...)` in the same function),
 *    attributed to its innermost NAMED enclosing function (anonymous closures fold into their parent).
 * Output: JSON lines `{file, line, fn, reachable, msg}` on stdout; a summary on stderr.
 * Usage: node census-throws.mjs [--all] [--root=name,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const DEMO = path.join(REPO, 'frontend/modules/seedlingDemo');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const rootsArg = args.find((a) => a.startsWith('--root='));
const ROOTS = rootsArg ? rootsArg.slice(7).split(',') : ['solveSegment', 'twoPassSolve'];

const files = new Map(); // abs -> ast
const queue = [path.join(DEMO, 'solverBot.js'), path.join(DEMO, 'twoPassSolve.js')];
while (queue.length) {
    const f = queue.shift();
    if (files.has(f) || !fs.existsSync(f) || /\.test\.js$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    let ast;
    try { ast = parse(src, { sourceType: 'module', plugins: ['importAttributes'], errorRecovery: true }); }
    catch (e) { process.stderr.write(`parse fail ${f}: ${e.message}\n`); continue; }
    files.set(f, ast);
    for (const n of ast.program.body) {
        const s = (n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') ? n.source?.value : null;
        if (s && s.startsWith('.')) queue.push(path.resolve(path.dirname(f), s));
    }
}

const fns = new Map(); // name -> [{file, calls:Set}]
const throws = [];
const isFn = (n) => /Function|ArrowFunction|ObjectMethod|ClassMethod|ClassPrivateMethod/.test(n.type);
function nameOf(node, parent) {
    if (node.id?.name) return node.id.name;
    if ((node.type === 'ObjectMethod' || node.type === 'ClassMethod' || node.type === 'ClassPrivateMethod') && node.key) return node.key.name ?? node.key.id?.name ?? node.key.value ?? null;
    if (parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') return parent.id.name;
    if (parent?.type === 'ObjectProperty' && parent.key) return parent.key.name ?? parent.key.value ?? null;
    if (parent?.type === 'AssignmentExpression' && parent.left?.type === 'MemberExpression') return parent.left.property?.name ?? null;
    if (parent?.type === 'AssignmentExpression' && parent.left?.type === 'Identifier') return parent.left.name;
    return null;
}
function walk(node, parent, ctx, file) {
    if (!node || typeof node.type !== 'string') return;
    let c = ctx;
    if (isFn(node)) {
        const nm = nameOf(node, parent);
        if (nm) {
            c = { name: nm, calls: new Set(), errVars: new Set() };
            if (!fns.has(nm)) fns.set(nm, []);
            fns.get(nm).push({ file, calls: c.calls });
            if (ctx) ctx.calls.add(nm); // a nested named closure is reachable from its parent
        }
    }
    if (c) {
        if (node.type === 'CallExpression' || node.type === 'NewExpression') {
            const cal = node.callee;
            if (cal.type === 'Identifier') c.calls.add(cal.name);
            else if (cal.type === 'MemberExpression' && cal.property?.type === 'Identifier') c.calls.add(cal.property.name);
            for (const a of node.arguments) if (a.type === 'Identifier') c.calls.add(a.name);
        }
        if (node.type === 'VariableDeclarator' && node.init?.type === 'NewExpression' && node.init.callee.name === 'Error' && node.id.type === 'Identifier') c.errVars.add(node.id.name);
        if (node.type === 'ObjectProperty' && node.value?.type === 'Identifier') c.calls.add(node.value.name);
        if (node.type === 'ThrowStatement') {
            let a = node.argument;
            let code = null;
            // `throw Object.assign(new Error(…), { code })` — the coded form (housekeep D1)
            if (a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && a.callee.object.name === 'Object'
                && a.callee.property.name === 'assign' && a.arguments[0]?.type === 'NewExpression') {
                code = (a.arguments[1]?.properties ?? []).find((q) => q.key?.name === 'code')?.value?.value ?? null;
                a = a.arguments[0];
            }
            const plain = (a.type === 'NewExpression' || a.type === 'CallExpression') && a.callee.type === 'Identifier' && a.callee.name === 'Error';
            const viaVar = a.type === 'Identifier' && c.errVars.has(a.name);
            if (plain || viaVar) {
                let msg = '';
                const m = plain ? a.arguments[0] : null;
                if (m?.type === 'StringLiteral') msg = m.value;
                else if (m?.type === 'TemplateLiteral') msg = m.quasis.map((q) => q.value.cooked).join('${}');
                else if (m?.type === 'BinaryExpression') { let x = m; while (x.type === 'BinaryExpression') x = x.left; msg = x.type === 'StringLiteral' ? x.value : x.type === 'TemplateLiteral' ? x.quasis.map((q) => q.value.cooked).join('${}') : ''; }
                throws.push({ file: path.relative(REPO, file), line: node.loc.start.line, fn: c.name, code, msg: msg.slice(0, 140) });
            }
        }
    }
    for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
        const v = node[k];
        if (Array.isArray(v)) for (const x of v) walk(x, node, c, file);
        else if (v && typeof v.type === 'string') walk(v, node, c, file);
    }
}
for (const [f, ast] of files) walk(ast.program, null, null, f);

const reach = new Set();
const st = [...ROOTS];
while (st.length) {
    const n = st.pop();
    if (reach.has(n) || !fns.has(n)) continue;
    reach.add(n);
    for (const d of fns.get(n)) for (const x of d.calls) if (!reach.has(x)) st.push(x);
}
let nr = 0;
const byFile = {};
for (const t of throws) {
    t.reachable = reach.has(t.fn);
    if (t.reachable) { nr += 1; byFile[t.file] = (byFile[t.file] ?? 0) + 1; }
    if (ALL || t.reachable) process.stdout.write(JSON.stringify(t) + '\n');
}
process.stderr.write(`modules ${files.size}, named fns ${fns.size}, reachable fns ${reach.size}, plain-Error throws ${throws.length}, reachable ${nr}\n`);
for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) process.stderr.write(`  ${n}\t${f}\n`);

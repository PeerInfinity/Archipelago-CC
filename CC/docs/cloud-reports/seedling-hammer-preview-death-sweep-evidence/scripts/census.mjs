// SCRATCH census: every preview call in the named files, its enclosing function, and its catch cover.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/user/Archipelago-CC/package.json');
const { parse } = require('@babel/parser');
const files = process.argv.slice(2);
for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const ast = parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
    const rows = [];
    const scopes = [new Map()]; // per-function: name -> raw|wrapped
    const lookup = (n) => { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(n)) return scopes[i].get(n); return undefined; };
    function fnName(stack) {
        const names = [];
        for (const n of stack) {
            if (n.type === 'FunctionDeclaration') names.push(n.id?.name ?? '<anon>');
            else if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'ObjectMethod' || n.type === 'ClassMethod')) {
                names.push(n.__name ?? (n.key?.name) ?? '<λ>');
            }
        }
        return names;
    }
    function covered(stack, node) {
        // a TryStatement whose block contains node and whose handler mentions PhysicsV2Error
        const out = [];
        for (let i = 0; i < stack.length; i++) {
            const n = stack[i];
            if (n.type === 'TryStatement' && stack[i + 1] === n.block && n.handler) {
                const h = src.slice(n.handler.start, n.handler.end);
                out.push(/PhysicsV2Error/.test(h) ? 'P2E' : (/throw\s/.test(h) ? 'catch(rethrow?)' : 'catch-all'));
            }
            // a function boundary resets: a catch outside the closure does not cover a call made later
        }
        return out;
    }
    function walk(node, stack) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'VariableDeclarator' && node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) node.init.__name = node.id?.name;
        if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init) {
            const t = src.slice(node.init.start, node.init.end);
            if (/previewStepper\(\)/.test(t)) scopes[scopes.length-1].set(node.id.name, /previewOrDeath/.test(t) ? 'wrapped' : 'raw');
            else if (node.init.type === 'CallExpression' && src.slice(node.init.callee.start, node.init.callee.end) === 'previewOrDeath') scopes[scopes.length-1].set(node.id.name, 'wrapped');
            else if (node.init.type === 'Identifier' && lookup(node.init.name)) scopes[scopes.length-1].set(node.id.name, lookup(node.init.name));
        }
        if (node.type === 'CallExpression') {
            const c = src.slice(node.callee.start, node.callee.end);
            let kind = null;
            if (c === 'previewWalk') kind = 'previewWalk';
            else if (/previewStepper$/.test(c)) kind = 'previewStepper()';
            else if (node.callee.type === 'Identifier' && lookup(c)) kind = `${c}(…) [${lookup(c)}]`;
            if (kind) {
                const line = src.slice(0, node.start).split('\n').length;
                const parentText = src.slice(stack[stack.length - 1]?.start ?? node.start, node.end);
                const wrappedInline = kind === 'previewStepper()' && /previewOrDeath\(\s*[\w.]*previewStepper/.test(src.slice(Math.max(0, node.start - 40), node.end));
                rows.push({ line, kind: wrappedInline ? 'previewStepper() [wrapped inline]' : kind, fn: fnName(stack).join(' › '), cover: covered([...stack, node], node).join(',') || '-' });
            }
        }
        const isFn = /Function|Method/.test(node.type);
        if (isFn) { scopes.push(new Map()); for (const p of node.params ?? []) if (p.type === 'Identifier' && /^(step|stepper|rawStep)$/.test(p.name)) scopes[scopes.length-1].set(p.name, 'param'); }
        for (const k of Object.keys(node)) {
            if (k === 'loc' || k.startsWith('__') || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach((x) => walk(x, [...stack, node]));
            else if (v && typeof v.type === 'string') walk(v, [...stack, node]);
        }
        if (isFn) scopes.pop();
    }
    walk(ast.program, []);
    for (const r of rows) console.log(`${f.split('/').pop()}:${r.line}\t${r.kind}\t${r.fn}\t${r.cover}`);
}

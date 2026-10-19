// SCRATCH (seedling-fidelity-digest D1): the MUTABLE module-level switches in levelRun.js's static import closure —
// every exported `const NAME = {...}` object literal (not frozen) or `let` in a module levelRun reaches, and whether
// levelRun.js imports it directly. usage: node flag-closure.mjs <entry.js>
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '/home/user/Archipelago-CC/node_modules/@babel/parser/lib/index.js';
const entry = path.resolve(process.argv[2]);
const seen = new Set(); const q = [entry]; const flags = [];
while (q.length) {
    const f = q.pop(); if (seen.has(f)) continue; seen.add(f);
    let ast; try { ast = parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['topLevelAwait'], errorRecovery: true }); } catch { continue; }
    for (const s of ast.program.body) {
        if ((s.type === 'ImportDeclaration' || s.type === 'ExportNamedDeclaration' || s.type === 'ExportAllDeclaration') && s.source?.value?.startsWith('.')) q.push(path.resolve(path.dirname(f), s.source.value));
        if (s.type === 'ExportNamedDeclaration' && s.declaration?.type === 'VariableDeclaration') {
            for (const d of s.declaration.declarations) {
                if (d.id.type !== 'Identifier') continue;
                const init = d.init;
                if (s.declaration.kind === 'let') flags.push({ f, name: d.id.name, kind: 'let' });
                else if (init?.type === 'ObjectExpression' && /^[A-Z][A-Z0-9_]+$/.test(d.id.name)) flags.push({ f, name: d.id.name, kind: 'switch', keys: init.properties.map((p) => p.key?.name).filter(Boolean).join(',') });
            }
        }
    }
}
const direct = fs.readFileSync(entry, 'utf8');
console.log(`modules in the closure: ${seen.size}; mutable switches: ${flags.length}`);
for (const x of flags) {
    const imported = new RegExp(`\\b${x.name}\\b`).test(direct);
    console.log(`${imported ? 'L' : '-'} ${x.kind.padEnd(6)} ${x.name.padEnd(36)} ${path.relative(process.cwd(), x.f)}  {${x.keys ?? ''}}`);
}

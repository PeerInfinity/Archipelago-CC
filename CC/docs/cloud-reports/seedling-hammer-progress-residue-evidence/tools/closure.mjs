// Measure only (PR D1): the static import closure of solverBot.js + twoPassSolve.js (relative imports, followed).
// node closure.mjs → one repo-relative path per line
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
const R = '/home/user/Archipelago-CC';
const roots = ['frontend/modules/seedlingDemo/solverBot.js', 'frontend/modules/seedlingDemo/twoPassSolve.js'].map((p) => resolve(R, p));
const seen = new Set();
const todo = [...roots];
while (todo.length) {
    const f = todo.pop();
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) todo.push(resolve(dirname(f), m[1]));
    for (const m of src.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) todo.push(resolve(dirname(f), m[1]));
}
for (const f of [...seen].sort()) console.log(relative(R, f));

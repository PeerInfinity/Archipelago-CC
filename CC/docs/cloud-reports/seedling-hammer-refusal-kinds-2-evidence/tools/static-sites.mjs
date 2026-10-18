// Measure only: every refusal / rejection SITE in solverBot.js, with its line and the head of its sentence.
// node static-sites.mjs [file] → JSON lines {line, form, head}
import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
const src = readFileSync(file, 'utf8');
const lines = src.split('\n');
const FORMS = [
    ['SolverRefusal', /new SolverRefusal\(/], ['PendingDeclaration', /new PendingDeclaration\(/],
    ['SolverBotError', /new SolverBotError\(/], ['fail', /(?<![\w.])fail\(/], ['refuseCT', /\brefuseCT\(/],
    ['refuseDanger', /\brefuseDanger\(/], ['refuse', /(?<![\w.])refuse\(/], ['why=', /\b[a-z][A-Za-z]*Why = /],
    ['refused=', /refused = \{ rung:/], ['bound:', /\bbound: '[a-z-]+'/], ['kind=', /row\.kind = '/],
];
for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*(\*|\/\/)/.test(l)) continue;
    for (const [form, re] of FORMS) {
        const m = re.exec(l);
        if (!m) continue;
        if (/=>\s*\{?\s*$/.test(l) && /const (refuse|fail|refuseCT|refuseDanger) = /.test(l)) break; // a definition
        const tail = (l.slice(m.index + m[0].length) + ' ' + (lines[i + 1] ?? '').trim() + ' ' + (lines[i + 2] ?? '').trim());
        console.log(JSON.stringify({ line: i + 1, form, head: tail.slice(0, 200) }));
        break;
    }
}

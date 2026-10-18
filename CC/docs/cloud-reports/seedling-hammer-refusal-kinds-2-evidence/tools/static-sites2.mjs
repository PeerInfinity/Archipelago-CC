// Measure only (RK2): RK's static-sites.mjs with a FULLER head. RK's head was the site's next ~200 source characters,
// so a sentence's deciding words past them (or split by a `' + '` concatenation) were invisible to the classifier.
// Here the head is the site's whole argument text — from the match to the call's closing paren (or, for an
// assignment / a row / a bound, to the statement's `;` at depth 0), at most 1600 characters — with adjacent string
// literals JOINED (`'a ' + 'b'` → `'a b'`), so the classifier reads the sentence as the solver writes it at run time.
// `${…}` is still unexpanded, so it remains an INDICATOR, not a gate.
// node static-sites2.mjs [file] → JSON lines {line, form, head}
import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
const src = readFileSync(file, 'utf8');
const lines = src.split('\n');
const starts = [];
for (let i = 0, at = 0; i < lines.length; i += 1) { starts.push(at); at += lines[i].length + 1; }
const FORMS = [
    ['SolverRefusal', /new SolverRefusal\(/], ['PendingDeclaration', /new PendingDeclaration\(/],
    ['SolverBotError', /new SolverBotError\(/], ['fail', /(?<![\w.])fail\(/], ['refuseCT', /\brefuseCT\(/],
    ['refuseDanger', /\brefuseDanger\(/], ['refuse', /(?<![\w.])refuse\(/], ['why=', /\b[a-z][A-Za-z]*Why = /],
    ['refused=', /refused = \{ rung:/], ['bound:', /\bbound: '[a-z-]+'/], ['kind=', /row\.kind = '/],
];
const CALLS = new Set(['SolverRefusal', 'PendingDeclaration', 'SolverBotError', 'fail', 'refuseCT', 'refuseDanger', 'refuse']);
/** The argument text from `from` to the closing paren (a call) or the `;` (a statement) at depth 0. */
function argText(from, call) {
    let depth = 0;
    let out = '';
    // a small lexer: brackets count only in CODE; a quote opens a string, a backtick a template whose `${` returns
    // to code until its own `}` (a stack, so templates nest)
    const stack = [];   // 'q' (a '/" string, with its quote in quoteOf), 't' (a template), or a number (a ${ depth)
    let quote = null;
    for (let j = from; j < src.length && out.length < 1600; j += 1) {
        const c = src[j];
        const mode = stack.at(-1);
        out += c;
        if (mode === 'q') {
            if (c === '\\') { out += src[j + 1] ?? ''; j += 1; } else if (c === quote) stack.pop();
            continue;
        }
        if (mode === 't') {
            if (c === '\\') { out += src[j + 1] ?? ''; j += 1; } else if (c === '`') stack.pop();
            else if (c === '$' && src[j + 1] === '{') { out += '{'; j += 1; stack.push(depth); depth += 1; }
            continue;
        }
        if (c === '\'' || c === '"') { quote = c; stack.push('q'); continue; }
        if (c === '`') { stack.push('t'); continue; }
        if (c === '(' || c === '[' || c === '{') depth += 1;
        if (c === ')' || c === ']' || c === '}') {
            depth -= 1;
            if (typeof mode === 'number' && depth === mode) { stack.pop(); continue; }
            if (depth < 0) { out = out.slice(0, -1); break; }
        }
        if (!call && c === ';' && depth === 0) { out = out.slice(0, -1); break; }
    }
    return out;
}
/** Join adjacent literals: `'a ' + 'b'`, `` `a ` + 'b' `` etc. (also across newlines), and collapse whitespace runs. */
const joined = (s) => s.replace(/(['"`])\s*\+\s*(['"`])/g, '').replace(/\s+/g, ' ');
for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*(\*|\/\/)/.test(l)) continue;
    for (const [form, re] of FORMS) {
        const m = re.exec(l);
        if (!m) continue;
        if (/=>\s*\{?\s*$/.test(l) && /const (refuse|fail|refuseCT|refuseDanger) = /.test(l)) break; // a definition
        const head = joined(argText(starts[i] + m.index + m[0].length, CALLS.has(form)));
        console.log(JSON.stringify({ line: i + 1, form, head }));
        break;
    }
}

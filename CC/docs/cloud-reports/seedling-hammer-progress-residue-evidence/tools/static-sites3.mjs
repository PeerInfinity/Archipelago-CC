// Measure only (RK2): RK's static-sites.mjs with a FULLER head. RK's head was the site's next ~200 source characters,
// so a sentence's deciding words past them (or split by a `' + '` concatenation) were invisible to the classifier.
// Here the head is the site's whole argument text — from the match to the call's closing paren (or, for an
// assignment / a row / a bound, to the statement's `;` at depth 0), at most 1600 characters — with adjacent string
// literals JOINED (`'a ' + 'b'` → `'a b'`), so the classifier reads the sentence as the solver writes it at run time.
// `${…}` is still unexpanded, so it remains an INDICATOR, not a gate.
// ⛓ PR (static-sites3): every file of the import closure (closure.txt), plain `new Error(` / `TypeError` / `RangeError`
// forms added, and a `filled` head (each `${…}` → `7`, as solveProgress.test.js's fromSource writes it).
// node static-sites3.mjs <closure.txt> → JSON lines {file, line, form, head, filled}
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const files = readFileSync(process.argv[2], 'utf8').trim().split('\n');
for (const file of files) {
const src = readFileSync(`${R}/${file}`, 'utf8');
const lines = src.split('\n');
const starts = [];
for (let i = 0, at = 0; i < lines.length; i += 1) { starts.push(at); at += lines[i].length + 1; }
const FORMS = [
    ['SolverRefusal', /new SolverRefusal\(/], ['PendingDeclaration', /new PendingDeclaration\(/],
    ['SolverBotError', /new SolverBotError\(/], ['Error', /new (?:Error|TypeError|RangeError)\(/], ['fail', /(?<![\w.])fail\(/], ['refuseCT', /\brefuseCT\(/],
    ['refuseDanger', /\brefuseDanger\(/], ['refuse', /(?<![\w.])refuse\(/], ['why=', /\b[a-z][A-Za-z]*Why = /],
    ['refused=', /refused = \{ rung:/], ['bound:', /\bbound: '[a-z-]+'/], ['kind=', /row\.kind = '/],
];
const CALLS = new Set(['Error', 'SolverRefusal', 'PendingDeclaration', 'SolverBotError', 'fail', 'refuseCT', 'refuseDanger', 'refuse']);
/** Each `${…}` → `7` (nesting counted), and an escaped quote unescaped — the sentence as a run would write it. */
function fill(s) {
    for (let k = s.indexOf('${'); k >= 0; k = s.indexOf('${')) {
        let depth = 0;
        let e = k + 1;
        for (; e < s.length; e += 1) {
            if (s[e] === '{') depth += 1;
            if (s[e] === '}' && --depth === 0) break;
        }
        s = `${s.slice(0, k)}7${s.slice(e + 1)}`;
    }
    return s.replace(/\\(['`])/g, '$1');
}
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
        console.log(JSON.stringify({ file, line: i + 1, form, head, filled: fill(head) }));
        break;
    }
}
}

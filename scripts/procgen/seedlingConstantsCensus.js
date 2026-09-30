/**
 * seedlingConstantsCensus — **EVERY NUMERIC LITERAL IN SEEDLING'S JS
 * SIMULATION, WITH A REVIEWED CLASS** (engine-prep arc, slice A1; plan
 * `seedling-engine-prep-plan.md`). The pure half of
 * `census-seedling-constants.mjs`: closure, rows, keys, the classification
 * join, and the drift verdict the gate reads.
 *
 * ── WHAT IS COUNTED ──────────────────────────────────────────────────
 *
 * The simulation is the STATIC import closure of
 * `frontend/modules/seedlingDemo/levelRun.js`: every `import … from './x'` and
 * `export … from './x'` whose specifier is relative. Dynamic `import()` and
 * bare specifiers are not followed. Every `NumericLiteral` node in those files
 * is one row, in one of three syntactic POSITIONS:
 *
 *   · `scalar` — the initialiser of a TOP-LEVEL `const NAME = <n>` or
 *     `= -<n>`, `NAME` matching `^[A-Z][A-Z0-9_]*$`;
 *   · `table`  — anywhere inside the initialiser of any other top-level
 *     `const x = <not a function>` (frozen objects, arrays, `new Set`,
 *     arithmetic, and the functions nested inside those);
 *   · `inline` — everything else.
 *
 * ── THE KEY, AND WHY IT HAS NO LINE IN IT ────────────────────────────
 *
 *   `<file>|<function>|h<8 hex of md5(unit)>|<literal>|<ordinal>`
 *
 * `unit` is the whitespace-normalised (runs collapsed; dropped beside
 * punctuation), comment-stripped text of the smallest
 * syntactic unit that holds the literal: its statement (with any nested block
 * or statement that does NOT hold the literal replaced by `{…}`, so an edit in
 * an `if`'s body moves no key in its test), or — in a table — its innermost
 * `key: value` property prefixed by the property path from the table's name.
 * `ordinal` numbers the rows that agree on everything before it, in source
 * order. The LINE is a column, never part of the key: an edit that shifts lines
 * moves no key. A VALUE never selects a class on its own — the same 16 is a
 * tile size in one statement and a frame count in another — which is why the
 * key carries the statement.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { parse } from '@babel/parser';

/** The closure's root, repo-relative. */
export const ENTRY = 'frontend/modules/seedlingDemo/levelRun.js';
/** The committed classification (reviewed) and census (generated). */
export const FIELDS_CSV = 'scripts/procgen/seedling-constants-fields.csv';
export const CENSUS_CSV = 'scripts/procgen/seedling-constants-census.csv';
export const DOC_MD = 'docs/json/developer/procgen/seedling-constants.md';
/** The AS3 source, when the submodule is initialised. */
export const AS3_SRC = 'vendor/seedling/src';

export const CLASSES = ['physics', 'rule', 'cosmetic', 'structural', 'unclassified'];
/** The second axis, owed by every `physics` and `rule` row and by no other. */
export const KINDS = ['magnitude', 'count', 'bound', 'sign', 'sentinel', 'derivation'];
/** The classes a gate protects: a new one is RED, a vanished one must be RETIRED. */
export const GUARDED = new Set(['physics', 'rule']);

export const SCALAR_NAME = /^[A-Z][A-Z0-9_]*$/;

export const CENSUS_COLUMNS = ['key', 'file', 'line', 'function', 'position', 'enclosing',
    'literal', 'class', 'kind', 'as3', 'note', 'context'];
export const FIELDS_COLUMNS = ['target', 'class', 'kind', 'as3', 'note'];

const toPosix = (p) => p.split(sep).join('/');
const PARSE_OPTS = { sourceType: 'module', errorRecovery: false };

/**
 * One parse per distinct source text. The gate builds the census several
 * times over copies that differ in one file (the mutants), so a memo keyed on
 * the text keeps each rebuild to the file that moved. Nothing downstream
 * mutates an AST.
 */
const AST_MEMO = new Map();
export function parseSource(src) {
    let ast = AST_MEMO.get(src);
    if (!ast) {
        ast = parse(src, PARSE_OPTS);
        if (AST_MEMO.size > 256) AST_MEMO.clear();
        AST_MEMO.set(src, ast);
    }
    return ast;
}

// ── the closure ──────────────────────────────────────────────────────

/**
 * The static relative import closure of `entry`, in discovery order.
 * @returns {{ file: string, src: string }[]}  repo-relative posix paths
 */
export function buildClosure(root, entry = ENTRY) {
    const seen = new Map();
    const queue = [resolve(root, entry)];
    while (queue.length) {
        const abs = queue.shift();
        if (seen.has(abs)) continue;
        const src = readFileSync(abs, 'utf8');
        seen.set(abs, src);
        const ast = parseSource(src);
        for (const n of ast.program.body) {
            if (!n.source || typeof n.source.value !== 'string') continue;
            if (!/^(ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration)$/.test(n.type)) continue;
            if (n.source.value.startsWith('.')) queue.push(resolve(dirname(abs), n.source.value));
        }
    }
    return [...seen].map(([abs, src]) => ({ file: toPosix(relative(root, abs)), src }));
}

// ── the AST walk ─────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['loc', 'start', 'end', 'extra', 'leadingComments', 'trailingComments',
    'innerComments', 'comments', 'tokens', 'range']);

function walk(node, visit, parents = []) {
    if (!node || typeof node.type !== 'string') return;
    visit(node, parents);
    parents.push(node);
    for (const k of Object.keys(node)) {
        if (SKIP_KEYS.has(k)) continue;
        const v = node[k];
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, visit, parents); }
        else if (v && typeof v.type === 'string') walk(v, visit, parents);
    }
    parents.pop();
}

const isFunction = (n) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod|ClassPrivateMethod|ObjectMethod)$/.test(n.type);
const isStatement = (n) => /(Statement|Declaration)$/.test(n.type) && n.type !== 'BlockStatement'
    && !/^(ImportDeclaration)$/.test(n.type) || n.type === 'SwitchCase';
const isNegLiteral = (n) => n && n.type === 'UnaryExpression' && n.operator === '-'
    && n.argument.type === 'NumericLiteral';
const isNumInit = (n) => n && (n.type === 'NumericLiteral' || isNegLiteral(n));
const keyName = (k) => (k.type === 'Identifier' ? k.name : k.type === 'StringLiteral' ? k.value
    : k.type === 'NumericLiteral' ? String(k.value) : k.type === 'PrivateName' ? `#${k.id.name}` : '[computed]');

/** The name a function frame is known by, or null for an anonymous one. */
function frameName(fn, parent, classNode) {
    if (fn.type === 'FunctionDeclaration' && fn.id) return fn.id.name;
    if (/^(ClassMethod|ClassPrivateMethod)$/.test(fn.type)) {
        const m = keyName(fn.key);
        return classNode?.id ? `${classNode.id.name}.${m}` : m;
    }
    if (fn.type === 'ObjectMethod') return keyName(fn.key);
    if (fn.id) return fn.id.name;
    if (!parent) return null;
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
    if (parent.type === 'ObjectProperty' && parent.value === fn) return keyName(parent.key);
    if (/^(ClassProperty|ClassPrivateProperty)$/.test(parent.type)) {
        const m = keyName(parent.key);
        return classNode?.id ? `${classNode.id.name}.${m}` : m;
    }
    if (parent.type === 'AssignmentExpression' && parent.right === fn) {
        const l = parent.left;
        if (l.type === 'Identifier') return l.name;
        if (l.type === 'MemberExpression' && !l.computed) return keyName(l.property);
    }
    return null;
}

/** The name of a top-level statement's declaration, when it has one. */
function topName(stmt) {
    const d = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
        ? stmt.declaration : stmt;
    if (!d) return '';
    if (stmt.type === 'ExportDefaultDeclaration' && !d.id) return 'default';
    if (d.type === 'VariableDeclaration') return d.declarations.map((x) => (x.id.type === 'Identifier' ? x.id.name : '')).filter(Boolean).join(',');
    if (d.id?.name) return d.id.name;
    return '';
}

// ── the unit text the key hashes ─────────────────────────────────────

/**
 * The text of `unit` with comments stripped, every nested statement/block that
 * does not contain `[lo,hi)` replaced by `{…}`, and whitespace collapsed.
 */
function unitText(src, unit, comments, lo, hi) {
    const holes = [];
    walk(unit, (n, ps) => {
        if (n === unit) return;
        if (!(n.type === 'BlockStatement' || isStatement(n))) return;
        if (n.start <= lo && hi <= n.end) return;
        if (ps.some((p) => p !== unit && holes.includes(p))) return;
        holes.push(n);
    });
    for (const c of comments) if (c.start >= unit.start && c.end <= unit.end) holes.push({ start: c.start, end: c.end, comment: true });
    holes.sort((a, b) => a.start - b.start);
    let out = '';
    let at = unit.start;
    for (const h of holes) {
        if (h.start < at) continue;
        out += src.slice(at, h.start) + (h.comment ? ' ' : '{…}');
        at = h.end;
    }
    out += src.slice(at, unit.end);
    // collapse whitespace, then drop it wherever it touches punctuation: only a
    // space BETWEEN two word characters (`return 4`) can carry meaning
    // collapse whitespace, then drop it wherever it touches punctuation: only a
    // space BETWEEN two word characters (`return 4`) can carry meaning
    return out.replace(/\s+/g, ' ').replace(/ ?([^\w$ ]) ?/g, '$1').trim();
}

export const md5h8 = (s) => createHash('md5').update(s).digest('hex').slice(0, 8);

// ── the rows ─────────────────────────────────────────────────────────

/**
 * Every NumericLiteral in one file.
 * @returns {object[]} rows without class/kind/as3/note, in source order
 */
export function rowsOfFile(file, src) {
    const ast = parseSource(src);
    const comments = ast.comments ?? [];
    const rows = [];
    for (const stmt of ast.program.body) {
        const enclosing = topName(stmt);
        const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
        const topConst = decl && decl.type === 'VariableDeclaration' && decl.kind === 'const' ? decl : null;
        walk(stmt, (n, ps) => {
            if (n.type !== 'NumericLiteral') return;
            const parent = ps[ps.length - 1];
            const neg = parent.type === 'UnaryExpression' && parent.operator === '-' && parent.argument === n;
            const outer = neg ? parent : n;
            // the top-level declarator this literal sits under, if any
            const declarator = topConst ? ps.find((p) => p.type === 'VariableDeclarator' && topConst.declarations.includes(p)) : null;
            let position = 'inline';
            let encl = enclosing;
            if (declarator && declarator.init && declarator.id.type === 'Identifier') {
                encl = declarator.id.name;
                if (declarator.init === outer && SCALAR_NAME.test(declarator.id.name)) position = 'scalar';
                else if (!/^(ArrowFunctionExpression|FunctionExpression)$/.test(declarator.init.type)
                    && ps.includes(declarator.init) || declarator.init === outer) position = 'table';
            }
            // the function frame
            let fnName = null;
            for (let i = ps.length - 1; i >= 0 && !fnName; i--) {
                if (!isFunction(ps[i])) continue;
                const cls = ps.slice(0, i).reverse().find((p) => /^Class(Declaration|Expression)$/.test(p.type));
                fnName = frameName(ps[i], ps[i - 1], cls);
            }
            // the unit
            const all = [...ps, n];
            let unit = null;
            let path = '';
            if (position === 'scalar') unit = declarator;
            else if (position === 'table') {
                for (let i = all.length - 1; i >= 0; i--) {
                    const p = all[i];
                    if (p === declarator) { unit = p; break; }
                    if (p.type === 'ObjectProperty' || isStatement(p) || /^(ClassProperty|ClassPrivateProperty)$/.test(p.type)) { unit = p; break; }
                }
                const keys = [];
                for (const p of all.slice(all.indexOf(declarator) + 1, all.indexOf(unit) + 1)) {
                    if (p.type === 'ObjectProperty') keys.push(keyName(p.key));
                    else if (p.type === 'ArrayExpression') keys.push('[]');
                }
                path = `${declarator.id.name}${keys.length ? '.' : ''}${keys.join('.')}: `;
            } else {
                for (let i = all.length - 1; i >= 0; i--) {
                    const p = all[i];
                    if (isStatement(p) || /^(ClassProperty|ClassPrivateProperty)$/.test(p.type)) { unit = p; break; }
                }
            }
            const text = path + unitText(src, unit, comments, outer.start, outer.end);
            const raw = src.slice(n.start, n.end);
            rows.push({
                file,
                line: n.loc.start.line,
                function: fnName ?? '(module)',
                position,
                enclosing: encl,
                literal: neg ? `-${raw}` : raw,
                value: neg ? -n.value : n.value,
                hash: md5h8(text),
                context: text.length > 90 ? `${text.slice(0, 87)}...` : text,
                start: n.start,
                trailingComment: sameLineComment(src, comments, n.loc.start.line, n.end),
            });
        });
    }
    // ordinals
    const seen = new Map();
    for (const r of rows) {
        const base = `${r.file}|${r.function}|h${r.hash}|${r.literal}`;
        const k = seen.get(base) ?? 0;
        seen.set(base, k + 1);
        r.key = `${base}|${k}`;
    }
    return rows;
}

function sameLineComment(src, comments, line, from) {
    const c = comments.find((x) => x.loc.start.line === line && x.start >= from);
    return c ? c.value.trim() : '';
}

/** The top-level facts the doc renders: named scalars, duplicates, derived. */
export function topLevelFacts(files) {
    const scalars = [];
    const derived = [];
    const tables = [];
    for (const { file, src } of files) {
        const ast = parseSource(src);
        for (const stmt of ast.program.body) {
            const exported = stmt.type === 'ExportNamedDeclaration';
            const d = exported ? stmt.declaration : stmt;
            if (!d || d.type !== 'VariableDeclaration' || d.kind !== 'const') continue;
            const lead = (stmt.leadingComments ?? []).map((c) => c.value).join(' ');
            const refs = [...new Set(lead.match(/\b[A-Z][\w/]*\.as(?::\d+(?:-\d+)?)?/g) ?? [])];
            for (const x of d.declarations) {
                if (x.id.type === 'Identifier' && x.init && !isNumInit(x.init)
                    && !/^(ArrowFunctionExpression|FunctionExpression)$/.test(x.init.type)) {
                    tables.push({ name: x.id.name, file, line: x.loc.start.line, exported, as3Refs: refs });
                }
                if (x.id.type !== 'Identifier' || !x.init || !SCALAR_NAME.test(x.id.name)) continue;
                const text = src.slice(x.init.start, x.init.end).replace(/\s+/g, ' ');
                if (isNumInit(x.init)) {
                    scalars.push({ name: x.id.name, file, line: x.loc.start.line, exported, literal: text });
                } else if (/^(BinaryExpression|MemberExpression|Identifier|UnaryExpression)$/.test(x.init.type)) {
                    derived.push({ name: x.id.name, file, line: x.loc.start.line, exported, init: text });
                }
            }
        }
    }
    const byName = new Map();
    for (const s of scalars) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
    const duplicates = [...byName].filter(([, v]) => v.length > 1)
        .map(([name, v]) => ({ name, sites: v, agree: new Set(v.map((s) => Number(s.literal))).size === 1 }));
    return { scalars, derived, duplicates, tables, distinct: byName.size };
}

// ── the AS3 anchors ──────────────────────────────────────────────────

/**
 * Every `(const|var) name:(Number|int|uint) = <number>` in the AS3 source,
 * or null when the submodule is not initialised.
 */
export function as3Declarations(root) {
    const dir = join(root, AS3_SRC);
    if (!existsSync(dir)) return null;
    const out = [];
    const re = /(?:const|var)\s+(\w+)\s*:\s*(?:Number|int|uint)\s*=\s*(-?(?:0x[0-9a-fA-F]+|\d*\.?\d+(?:e-?\d+)?))/g;
    const visit = (d) => {
        for (const e of readdirSync(d).sort()) {
            const p = join(d, e);
            if (statSync(p).isDirectory()) visit(p);
            else if (e.endsWith('.as')) {
                const src = readFileSync(p, 'latin1');
                for (const m of src.matchAll(re)) {
                    out.push({ file: toPosix(relative(dir, p)), name: m[1], value: Number(m[2]),
                        line: src.slice(0, m.index).split('\n').length });
                }
            }
        }
    };
    visit(dir);
    return out;
}

const camel = (NAME) => NAME.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

/**
 * The AS3 anchor `File.as:name` a NAMED SCALAR's comment or name identifies,
 * or ''. Only scalars are anchored automatically: a table or inline literal
 * shares its line with prose that names AS3 fields in passing (measured: a
 * `0` beside a comment mentioning `hitsTimer` anchored to `Enemy.as:hitsTimer`),
 * so those anchors come from the reviewed table's `as3` column instead. A
 * reviewed `as3` of `-` SUPPRESSES an automatic anchor that is a coincidence
 * of name and value (`DOWN = 3` is not `Player.as:direction`'s default 3).
 * The AS3 declaration's value must EQUAL the literal: a name match with a
 * different value is not an anchor. When several files declare the name, the
 * one the comment names (`Player.as`, `Mobile.DEFAULT_FRICTION`) wins; still
 * several, and no anchor is given.
 */
export function anchorFor(row, leading, as3) {
    if (!as3 || row.position !== 'scalar') return '';
    const text = `${leading} ${row.trailingComment}`;
    const baseOf = (f) => f.split('/').pop().replace(/\.as$/, '');
    const bases = new Set(as3.map((d) => baseOf(d.file)));
    const mentioned = new Set();
    for (const m of text.matchAll(/\b([A-Z]\w*)\.(?:as\b|[A-Za-z_]\w*)/g)) if (bases.has(m[1])) mentioned.add(m[1]);
    const strong = new Set(row.trailingComment.match(/\b[A-Za-z_]\w+\b/g) ?? []);
    if (row.position === 'scalar') { strong.add(row.enclosing); strong.add(camel(row.enclosing)); }
    const weak = new Set(leading.match(/\b[A-Za-z_]\w+\b/g) ?? []);
    const cands = as3.filter((d) => d.value === row.value && d.name.length > 1
        && (strong.has(d.name) || (weak.has(d.name) && mentioned.has(baseOf(d.file)))));
    let pick = cands;
    if (new Set(pick.map((d) => d.file)).size > 1 && mentioned.size) pick = pick.filter((d) => mentioned.has(baseOf(d.file)));
    const uniq = [...new Set(pick.map((d) => `${d.file}:${d.name}`))];
    return uniq.length === 1 ? uniq[0] : '';
}

/** The leading comment text of each top-level statement, inherited down an unbroken run of consts. */
function leadingByLine(src) {
    const ast = parseSource(src);
    const out = new Map();
    let prev = null;
    for (const stmt of ast.program.body) {
        const own = (stmt.leadingComments ?? []).map((c) => c.value).join(' ');
        let text = own;
        if (!own && prev && stmt.loc.start.line === prev.end + 1) text = prev.text;
        for (let l = stmt.loc.start.line; l <= stmt.loc.end.line; l++) out.set(l, text);
        prev = { end: stmt.loc.end.line, text };
    }
    return out;
}

// ── the classification ───────────────────────────────────────────────

/** A minimal RFC-4180 CSV reader. */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const [head, ...body] = rows.filter((r) => !(r.length === 1 && r[0] === ''));
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows, cols) => `${[cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')}\n`;

const globRe = (g) => new RegExp(`^${g.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/**
 * The reviewed table's rows, compiled. A `target` holding `|h` is an exact
 * KEY override; any other target is a SELECTOR `file|enclosing|function[|literal]`
 * whose parts are globs (`*`), the literal part defaulting to `*`.
 */
export function compileFields(fields) {
    return fields.map((f, i) => {
        const t = f.target;
        if (/\|h[0-9a-f]{8}\|/.test(t)) return { ...f, index: i, exact: true };
        const parts = t.split('|');
        if (parts.length < 3 || parts.length > 4) throw new Error(`fields row ${i + 2}: target "${t}" is neither a key nor file|enclosing|function[|literal]`);
        while (parts.length < 4) parts.push('*');
        const res = parts.map(globRe);
        // specificity: parts with no glob, then literal characters
        const spec = [parts.filter((p) => !p.includes('*')).length, parts.join('').replace(/\*/g, '').length];
        return { ...f, index: i, exact: false, parts, res, spec };
    });
}

/**
 * Join one row to the reviewed table: an exact key wins; otherwise the most
 * specific matching selector. Two selectors equally specific is an AMBIGUITY
 * (returned, so the gate names it) — never resolved by row order.
 */
export function classify(row, compiled, exactIndex) {
    const exact = exactIndex.get(row.key);
    if (exact) return { hit: exact };
    const fields = [row.file, row.enclosing, row.function, row.literal];
    let best = [];
    for (const c of compiled) {
        if (c.exact || !c.res.every((re, i) => re.test(fields[i]))) continue;
        const cmp = best.length ? (c.spec[0] - best[0].spec[0]) || (c.spec[1] - best[0].spec[1]) : 1;
        if (cmp > 0) best = [c];
        else if (cmp === 0) best.push(c);
    }
    if (best.length > 1) return { hit: best[0], ambiguous: best.map((b) => b.target) };
    return { hit: best[0] ?? null };
}

// ── the census ───────────────────────────────────────────────────────

/**
 * The full census at `root`.
 * @returns {{ rows: object[], files: object[], as3: object[]|null, ambiguous: object[], unusedTargets: string[] }}
 */
export function buildCensus(root, { fieldsText } = {}) {
    const files = buildClosure(root);
    const text = fieldsText ?? (existsSync(join(root, FIELDS_CSV)) ? readFileSync(join(root, FIELDS_CSV), 'utf8') : 'target,class,kind,as3,note\n');
    const compiled = compileFields(parseCsv(text));
    const exactIndex = new Map(compiled.filter((c) => c.exact).map((c) => [c.target, c]));
    const as3 = as3Declarations(root);
    const rows = [];
    const ambiguous = [];
    const used = new Set();
    for (const { file, src } of [...files].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) {
        const leading = leadingByLine(src);
        for (const r of rowsOfFile(file, src)) {
            const { hit, ambiguous: amb } = classify(r, compiled, exactIndex);
            if (amb) ambiguous.push({ key: r.key, targets: amb });
            if (hit) used.add(hit.index);
            const cls = hit?.class || 'unclassified';
            const auto = anchorFor(r, leading.get(r.line) ?? '', as3);
            rows.push({
                key: r.key, file: r.file, line: r.line, function: r.function, position: r.position,
                enclosing: r.enclosing, literal: r.literal, class: cls, kind: hit?.kind ?? '',
                as3: hit?.as3 === '-' ? '' : (hit?.as3 || auto), note: hit?.note ?? '', context: r.context, value: r.value,
            });
        }
    }
    const unusedTargets = compiled.filter((c) => !used.has(c.index)).map((c) => c.target);
    return { rows, files, as3, ambiguous, unusedTargets };
}

/** The census file's text. */
export const censusCsv = (rows) => toCsv(rows, CENSUS_COLUMNS);

/**
 * The gate's verdict, committed census against a fresh one.
 *
 * RED: a NEW key whose class is physics, rule or unclassified; a committed
 * physics/rule key that VANISHED ("must be RETIRED"); a key in both whose
 * reviewed columns (class, kind, as3, note) disagree — the record is stale.
 * GREEN, reported: a new or vanished cosmetic/structural key; a moved line or
 * context. `compareAs3: false` drops the as3 column when the AS3 source is
 * absent, so the check runs where the submodule does not.
 */
export function diffCensus(committed, fresh, { compareAs3 = true } = {}) {
    const red = [];
    const green = [];
    const c = new Map(committed.map((r) => [r.key, r]));
    const f = new Map(fresh.map((r) => [r.key, r]));
    for (const [k, r] of f) {
        const old = c.get(k);
        if (!old) {
            if (GUARDED.has(r.class) || r.class === 'unclassified') red.push({ why: 'NEW', key: k, class: r.class, line: r.line });
            else green.push({ why: 'new', key: k, class: r.class });
            continue;
        }
        const cols = ['class', 'kind', 'note', ...(compareAs3 ? ['as3'] : [])];
        const moved = cols.filter((col) => String(old[col] ?? '') !== String(r[col] ?? ''));
        if (moved.length) red.push({ why: 'STALE', key: k, cols: moved });
        else if (String(old.line) !== String(r.line) || old.context !== r.context) green.push({ why: 'moved', key: k });
    }
    for (const [k, r] of c) {
        if (f.has(k)) continue;
        if (GUARDED.has(r.class)) red.push({ why: 'RETIRED', key: k, class: r.class, line: r.line });
        else green.push({ why: 'vanished', key: k, class: r.class });
    }
    return { red, green };
}

/** One human line per red item. */
export function redLine(x) {
    if (x.why === 'NEW') return `RED  new ${x.class} literal ${x.key} (line ${x.line}) — classify it in ${FIELDS_CSV} and --write`;
    if (x.why === 'RETIRED') return `RED  committed ${x.class} row ${x.key} (line ${x.line}) is gone from the source — it must be RETIRED: --write, and say why in the commit`;
    return `RED  ${x.key}: the committed census is stale in ${x.cols.join(', ')} — --write`;
}

// ── the counts the doc renders ───────────────────────────────────────

export function crossTab(rows, a, b, aVals, bVals) {
    const t = Object.fromEntries(aVals.map((x) => [x, Object.fromEntries(bVals.map((y) => [y, 0]))]));
    for (const r of rows) if (t[r[a]] && r[b] in t[r[a]]) t[r[a]][r[b]]++;
    return t;
}

// ── the doc region ───────────────────────────────────────────────────

export const REGION_BEGIN = '<!-- CENSUS:seedling-constants BEGIN — by scripts/procgen/census-seedling-constants.mjs --write; do not edit; regenerate -->';
export const REGION_END = '<!-- CENSUS:seedling-constants END -->';

/** The largest table whose physics/rule literals the candidate list names as ONE entry. */
export const SMALL_TABLE_MAX = 16;

const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`)].join('\n');
const short = (f) => f.replace(/^frontend\/modules\//, '');

/** The profile candidates: every physics/rule named scalar, and every small table holding one. */
export function profileCandidates(census) {
    const facts = topLevelFacts(census.files);
    const rows = census.rows;
    const scalarRows = rows.filter((r) => r.position === 'scalar' && GUARDED.has(r.class));
    const tables = [];
    for (const t of facts.tables) {
        const mine = rows.filter((r) => r.file === t.file && r.position === 'table' && r.enclosing === t.name);
        if (!mine.length || mine.length > SMALL_TABLE_MAX) continue;
        const guarded = mine.filter((r) => GUARDED.has(r.class));
        if (!guarded.length) continue;
        const rowAnchors = [...new Set(mine.map((r) => r.as3).filter(Boolean))];
        tables.push({ ...t, literals: mine.length, guarded: guarded.length,
            classes: [...new Set(guarded.map((r) => r.class))].sort().join('/'),
            kinds: [...new Set(guarded.map((r) => r.kind))].sort().join('/'),
            as3: rowAnchors.length ? rowAnchors.join(' ') : t.as3Refs.join(' ') });
    }
    return { scalarRows, tables, facts };
}

/**
 * The markdown between the CENSUS markers. ⛔ No LINE numbers: a moved line is
 * green drift, and a line in the doc would turn every such edit into a stale
 * page. The file and the name locate a row; the census CSV has the line.
 */
export function renderDocRegion(census) {
    const { rows } = census;
    const pos = ['scalar', 'table', 'inline'];
    const out = [REGION_BEGIN, ''];
    out.push(`**${census.files.length} files, ${rows.length} literals.** Class × position:`, '');
    out.push(mdTable(['class', ...pos, 'total'], [...CLASSES.map((c) => {
        const n = pos.map((p) => rows.filter((r) => r.class === c && r.position === p).length);
        return [c, ...n, n.reduce((a, b) => a + b, 0)];
    }), ['total', ...pos.map((p) => rows.filter((r) => r.position === p).length), rows.length]]));
    out.push('', 'Class × kind (physics and rule rows only):', '');
    out.push(mdTable(['class', ...KINDS, 'total'], ['physics', 'rule'].map((c) => {
        const n = KINDS.map((k) => rows.filter((r) => r.class === c && r.kind === k).length);
        return [c, ...n, n.reduce((a, b) => a + b, 0)];
    })));
    out.push('', `Rows whose note starts \`REVIEW:\`: **${rows.filter((r) => r.note.startsWith('REVIEW:')).length}**.`);

    const { scalarRows, tables, facts } = profileCandidates(census);
    out.push('', `### The ${facts.duplicates.length} names declared in more than one file`, '');
    out.push(mdTable(['name', 'values agree', 'files'], facts.duplicates.map((d) => [
        `\`${d.name}\``, d.agree ? 'yes' : '**NO**', d.sites.map((s) => `${short(s.file)} = ${s.literal}`).join('; ')])));
    out.push('', `### The ${facts.derived.length} derived or aliased top-level constants`, '');
    out.push(mdTable(['name', 'file', 'initialiser'], facts.derived.map((d) => [
        `\`${d.name}\``, short(d.file), `\`${d.init.length > 80 ? `${d.init.slice(0, 77)}...` : d.init}\``])));

    const anchoredS = scalarRows.filter((r) => r.as3).length;
    const anchoredT = tables.filter((t) => t.as3).length;
    out.push('', '### The profile candidates', '',
        `**${scalarRows.length} named scalars** are \`physics\` or \`rule\` (${anchoredS} with an AS3 anchor), and `
        + `**${tables.length} small tables** (at most ${SMALL_TABLE_MAX} literals) hold at least one (${anchoredT} with an AS3 reference).`, '');
    out.push(mdTable(['name', 'file', 'value', 'class', 'kind', 'AS3'], scalarRows.map((r) => [
        `\`${r.enclosing}\``, short(r.file), r.literal, r.class, r.kind, r.as3])));
    out.push('');
    out.push(mdTable(['table', 'file', 'literals', 'physics/rule', 'classes', 'kinds', 'AS3'], tables.map((t) => [
        `\`${t.name}\``, short(t.file), t.literals, t.guarded, t.classes, t.kinds, t.as3])));
    out.push('', REGION_END);
    return out.join('\n');
}

/** `doc` with its CENSUS region replaced by `region` (appended when absent). */
export function spliceDocRegion(doc, region) {
    const a = doc.indexOf(REGION_BEGIN);
    const b = doc.indexOf(REGION_END);
    if (a < 0 || b < a) return `${doc.replace(/\n*$/, '\n\n')}${region}\n`;
    return doc.slice(0, a) + region + doc.slice(b + REGION_END.length);
}

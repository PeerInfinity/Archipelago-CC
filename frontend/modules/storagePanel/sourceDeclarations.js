/**
 * Read every module's `moduleInfo.storage` declarations from SOURCE (node only),
 * the way the Quick Launch pins read `docs` / `category`: importing the modules
 * would need a DOM. Used by storageDeclarationPins.test.js (shape) and
 * storageCensus.test.js (coverage).
 *
 * The format it reads is the one storageKinds.js documents: a `storage: [` line
 * inside the `export const moduleInfo = {…}` block, then one entry object per
 * line, closed by `],`. `STORAGE_KINDS.<name>` resolves through the real
 * constant. A line in the block that is not an entry, a comment or the closer is
 * reported as a problem, never skipped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';

export const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function evalEntry(text) {
    // The entry is a literal object of strings, arrays of strings and STORAGE_KINDS.<x>.
    // eslint-disable-next-line no-new-func
    return new Function('STORAGE_KINDS', `"use strict"; return (${text});`)(STORAGE_KINDS);
}

/**
 * [{ moduleId, owner, storage: [...] | undefined, problems: [...] }] for every
 * `modules/<dir>/index.js` with a moduleInfo block.
 */
export function readSourceDeclarations(modulesDir = MODULES_DIR) {
    const out = [];
    for (const dir of readdirSync(modulesDir, { withFileTypes: true })) {
        const file = join(modulesDir, dir.name, 'index.js');
        if (!dir.isDirectory() || !existsSync(file)) continue;
        const text = readFileSync(file, 'utf8');
        const start = text.indexOf('export const moduleInfo');
        if (start === -1) continue;
        const end = text.indexOf('\n};', start);
        const block = text.slice(start, end === -1 ? undefined : end);
        const name = block.match(/^\s*name\s*:\s*['"]([^'"]+)['"]/m)?.[1] ?? dir.name;
        const title = block.match(/^\s*title\s*:\s*['"]([^'"]+)['"]/m)?.[1] ?? null;
        const entry = { moduleId: name, dir: dir.name, owner: title || name, storage: undefined, problems: [] };
        const lines = block.split('\n');
        const at = lines.findIndex((l) => /^\s*storage\s*:/.test(l));
        if (at !== -1) {
            if (!/^\s*storage\s*:\s*\[\s*$/.test(lines[at])) {
                entry.problems.push(`${dir.name}: "storage:" must open a list on its own line ("storage: [")`);
            } else {
                entry.storage = [];
                let closed = false;
                for (let i = at + 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line === '],' || line === ']') { closed = true; break; }
                    if (line === '' || line.startsWith('//')) continue;
                    if (!line.startsWith('{') || !/},?$/.test(line)) {
                        entry.problems.push(`${dir.name}: line ${i + 1} of moduleInfo is not a one-line entry: ${line}`);
                        continue;
                    }
                    try {
                        entry.storage.push(evalEntry(line.replace(/,$/, '')));
                    } catch (e) {
                        entry.problems.push(`${dir.name}: entry does not parse (${e.message}): ${line}`);
                    }
                }
                if (!closed) entry.problems.push(`${dir.name}: the storage list is not closed with "],"`);
            }
        }
        out.push(entry);
    }
    return out;
}

/* ── IndexedDB census: which databases the sources open ──────────────────── */

/** An open call on `indexedDB`, or on an IDBFactory held in a local named `factory` (documentLibraryIdb.js). */
const IDB_OPEN_RE = /\b(?:indexedDB|factory)\s*\.\s*open\s*\(\s*([^,)\s]+)/g;
const LITERAL_RE = /^(['"`])([^'"`$\\]+)\1$/;
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The database names `text` opens: `[{ arg, name | null, via }]`. The first
 * argument resolves as a string literal; or an identifier bound in the same
 * text to a literal (`const IDB_NAME = 'x'`, or a default parameter
 * `dbName = 'x'`); or bound to another identifier that some source EXPORTS as
 * a literal (`dbName = DEFAULT_LIBRARY_DB_NAME`, exported by documentLibrary.js)
 * — `exportedLiteral(name)` answers that lookup. Anything else is `name: null`
 * (unresolved), which the census reports instead of skipping.
 */
export function idbOpensInText(text, exportedLiteral = () => null) {
    const out = [];
    for (const m of text.matchAll(IDB_OPEN_RE)) {
        const arg = m[1];
        const lit = arg.match(LITERAL_RE);
        if (lit) { out.push({ arg, name: lit[2], via: 'literal' }); continue; }
        if (!IDENT_RE.test(arg)) { out.push({ arg, name: null, via: 'unresolved' }); continue; }
        const bound = text.match(new RegExp(`\\b${escapeRe(arg)}\\s*=(?!=)\\s*(['"\`][^'"\`\\n]*['"\`]|[A-Za-z_$][\\w$]*)`));
        const rhs = bound?.[1].trim() ?? '';
        const boundLit = rhs.match(LITERAL_RE);
        if (boundLit) { out.push({ arg, name: boundLit[2], via: `${arg} = literal` }); continue; }
        const exported = IDENT_RE.test(rhs) ? exportedLiteral(rhs) : null;
        out.push(exported ? { arg, name: exported, via: `${arg} = ${rhs} (exported)` } : { arg, name: null, via: 'unresolved' });
    }
    return out;
}

/** `export const NAME = '<literal>'` across `texts`, as a lookup. */
export function exportedLiterals(texts) {
    const map = new Map();
    for (const { text } of texts) {
        for (const m of text.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`$\\]+)\2\s*;/gm)) {
            if (!map.has(m[1])) map.set(m[1], m[3]);
        }
    }
    return (name) => map.get(name) ?? null;
}

/**
 * Every app source under `frontendDir` (`.js/.mjs/.ts/.html`, not `*.test.js`),
 * read NUL-safe (latin1, so a NUL-bearing file is never skipped), with
 * node_modules, libs, dist, external, .git and the git submodules left out —
 * the same walk as documentLibrary.test.js's IndexedDB-open pin (B1).
 */
export function appSourceTexts(frontendDir = join(MODULES_DIR, '..')) {
    const repo = join(frontendDir, '..');
    const gitmodules = join(repo, '.gitmodules');
    const submodules = existsSync(gitmodules)
        ? [...readFileSync(gitmodules, 'latin1').matchAll(/^\s*path\s*=\s*(.+)$/gm)].map((m) => join(repo, m[1].trim()))
        : [];
    const skip = new Set(['node_modules', 'libs', 'dist', 'external', '.git']);
    const texts = [];
    const walk = (dir) => {
        for (const d of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, d.name);
            if (skip.has(d.name) || submodules.includes(p)) continue;
            if (d.isDirectory()) { walk(p); continue; }
            if (!/\.(m?js|ts|html)$/.test(d.name) || /\.test\.m?js$/.test(d.name)) continue;
            texts.push({ path: p.slice(frontendDir.length + 1), text: readFileSync(p, 'latin1') });
        }
    };
    walk(frontendDir);
    return texts;
}

/** `[{ path, arg, name | null, via }]`: every IndexedDB open in the app's sources, its name resolved. */
export function readSourceIdbOpens(texts = appSourceTexts()) {
    const lookup = exportedLiterals(texts);
    return texts.flatMap(({ path, text }) => idbOpensInText(text, lookup).map((o) => ({ path, ...o })));
}

/**
 * The census, both ways (pure). `opened`: readSourceIdbOpens' rows; `declared`:
 * the idb names the modules declare; `allowed`: `{ name: reason }` for a
 * database opened outside the app's module boot that the panel does not list.
 * Every list it returns is RED when non-empty.
 */
export function idbCensus({ opened, declared, allowed = {} }) {
    const openedNames = new Set(opened.filter((o) => o.name).map((o) => o.name));
    const declaredSet = new Set(declared);
    return {
        unresolved: opened.filter((o) => !o.name).map((o) => `${o.path}: open(${o.arg})`),
        undeclared: [...openedNames].filter((n) => !declaredSet.has(n) && !(n in allowed)).sort(),
        unopened: [...declaredSet].filter((n) => !openedNames.has(n)).sort(),
        staleAllowed: Object.keys(allowed).filter((n) => !openedNames.has(n) || declaredSet.has(n)).sort(),
    };
}

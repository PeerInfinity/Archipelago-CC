/**
 * reachClosure — **WHAT A CHANGED FILE CAN REACH**, as a graph rather than
 * as a grep. R9 slice 11b, ⚖ ruling 32 B.
 *
 * ── ⛔⛔ WHY THIS EXISTS: A DEPTH-1 IMPORT GREP IS NOT AN ANSWER ───────
 *
 * R9 slice 11 sealed *"`dump-seedling-kind-pairs` does not import the oracle
 * at all"* from a grep of the ENTRY SCRIPT, and four identity rows moved that
 * the seal had called held (kickoff §21.5, trap 555). The entry imports
 * `procgenSeedling.js`, which imports `procgenOracle.js` at `:54` — so
 * GENERATING A LEVEL RUNS THE CERTIFY SOLVE, and the repaired kill arm
 * reached the census transitively. One hop further than the grep looked.
 *
 * ⇒ the honest instrument is the TRANSITIVE CLOSURE, and it runs in the
 * DEPENDENT direction: from the files a change touches, to everything that
 * imports them, however far away. `reachFrom` walks the REVERSE graph.
 *
 * ── ⚠⚠ AND IT IS AN UPPER BOUND, WHICH IS THE POINT AND THE LIMIT ─────
 *
 * A reach says what CAN move, not what WILL. `census-seedling-elements.mjs`
 * reaches the solver exactly the way `census-seedling-enemies.mjs` does and
 * slice 11 moved only the second one — the first holds no spinner traffic at
 * all. The closure is the set a seal has to have an OPINION about; it is not
 * a prediction that every member moves. Every printed report says that
 * sentence out loud (`UPPER_BOUND_SENTENCE`) so a reader cannot take the
 * list for a forecast.
 *
 * ── ⛔ THE DYNAMIC FORM SURVIVES EVERY GREP — trap 543 ────────────────
 *
 * `verify-seedling-bot-differential.mjs:207` reads
 *
 *     const { playthroughAcceptanceFindings } =
 *         await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughAcceptance.js'));
 *
 * and there is no `from '…'` anywhere on the line. 400-odd edges in this repo
 * are spelled that way over three bases (`REPO`, `MODULE`, `HERE`) — and the
 * bases are DERIVED per file (⚖ ruling 17), never listed: `pathBindings`
 * symbolically evaluates each file's own top-level `const X = …` over
 * `join`/`resolve`/`dirname`/`fileURLToPath(import.meta.url)`, so a file that
 * invents `const ROOT = …` is resolved for the same reason `REPO` is.
 *
 * ⛔ WHAT CANNOT BE RESOLVED IS REPORTED, NEVER DROPPED. `join(REPO,
 * 'frontend/modules/seedlingDemo', p)` has a VARIABLE last segment; a scanner
 * that quietly skipped it would under-report a reach and an under-reported
 * upper bound is worse than none. Those edges come back in `unresolved` and
 * the CLI prints them as a named caveat.
 *
 * Exports are consumed by `reach-seedling-change.mjs` (the CLI) and pinned by
 * `reachClosure.test.js` (a synthetic three-file graph whose middle edge is
 * the dynamic form, plus slice 11's own change as a reproduction row).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');

/** ⚠ The sentence every report carries. A reach is a BOUND, not a forecast. */
export const UPPER_BOUND_SENTENCE =
    '⚠ A REACH IS AN UPPER BOUND — it says what CAN move, not what WILL.';

/** The two trees a Seedling change can travel through. */
export const DEFAULT_ROOTS = Object.freeze(['frontend/modules', 'scripts/procgen']);

/** Extensions that are graph NODES. `.html` is here for `watch.html`. */
const NODE_EXT = Object.freeze(['.js', '.mjs', '.html']);

/** Extensionless specifiers are tried in this order, then as a directory. */
const RESOLVE_ORDER = Object.freeze(['.js', '.mjs', '/index.js', '/index.mjs']);

// ── the file set ──────────────────────────────────────────────────────

/**
 * Every tracked `.js` / `.mjs` / `.html` under `roots`, submodules included.
 *
 * ⛔ `git ls-files` in a superproject stops at the GITLINK, so
 * `frontend/modules/shared/*.js` would be invisible to a single call — and a
 * closure that cannot see a file cannot report a reach through it, which
 * breaks the upper-bound claim quietly. Each submodule whose path lies under
 * a root is listed in its OWN repo and its rows are re-prefixed.
 */
export function trackedFiles({ repo = REPO, roots = DEFAULT_ROOTS } = {}) {
    const git = (args, cwd) =>
        execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            .split('\n').filter(Boolean);
    const keep = (p) => NODE_EXT.some((e) => p.endsWith(e));
    const out = new Set(git(['ls-files', '--', ...roots], repo).filter(keep));
    let submodulePaths = [];
    try {
        submodulePaths = git(['config', '--file', '.gitmodules', '--get-regexp', 'path'], repo)
            .map((l) => l.split(/\s+/)[1]).filter(Boolean);
    } catch { /* no .gitmodules — nothing to descend into */ }
    for (const sub of submodulePaths) {
        if (!roots.some((r) => sub === r || sub.startsWith(`${r}/`))) continue;
        const abs = join(repo, sub);
        if (!existsSync(join(abs, '.git'))) continue;
        for (const f of git(['ls-files'], abs).filter(keep)) out.add(`${sub}/${f}`);
    }
    return [...out].sort();
}

// ── the symbolic path evaluator ───────────────────────────────────────

/** Read a balanced `(...)` argument list starting at `open` (the `(`). */
function balancedArgs(text, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < text.length; i += 1) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') { i += 1; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '(') depth += 1;
        else if (ch === ')') {
            depth -= 1;
            if (depth === 0) return { inner: text.slice(open + 1, i), end: i };
        }
    }
    return null;
}

/** Split an argument list on top-level commas. */
function splitArgs(inner) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let start = 0;
    for (let i = 0; i < inner.length; i += 1) {
        const ch = inner[i];
        if (quote) {
            if (ch === '\\') { i += 1; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if ('([{'.includes(ch)) depth += 1;
        else if (')]}'.includes(ch)) depth -= 1;
        else if (ch === ',' && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
    }
    parts.push(inner.slice(start));
    return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Evaluate a path expression symbolically. Returns an absolute path, or
 * `null` when any part of it is a value only the runtime knows.
 *
 * The grammar is exactly what this repo writes: string literals,
 * `fileURLToPath(import.meta.url)`, `dirname`/`path.dirname`,
 * `join`/`path.join`, `resolve`/`path.resolve`, and identifiers bound
 * earlier in the same file.
 */
export function evalPathExpr(expr, { filePath, bindings = new Map() }) {
    const text = expr.trim();
    const lit = /^(['"`])((?:[^\\]|\\.)*?)\1$/.exec(text);
    if (lit && !(lit[1] === '`' && lit[2].includes('${'))) return lit[2];
    if (/^import\.meta\.url$/.test(text)) return `file://${filePath}`;
    // ⛓ `pathToFileURL(x).href` and `new URL('..', import.meta.url).pathname` —
    // two spellings of the same hop, and BOTH are load-bearing in this repo
    // (`dump-seedling-kind-pairs.mjs:43-44` uses one on top of the other).
    const member = /^([\s\S]+)\.(href|pathname)$/.exec(text);
    if (member) {
        const inner = evalPathExpr(member[1], { filePath, bindings });
        if (inner === null) return null;
        if (member[2] === 'pathname') {
            return inner.startsWith('file://') ? inner.slice('file://'.length) : inner;
        }
        return inner;
    }
    if (/^new\s+URL\s*\(/.test(text)) {
        const args = balancedArgs(text, text.indexOf('('));
        if (!args || text.slice(args.end + 1).trim() !== '') return null;
        const parts = splitArgs(args.inner)
            .map((a) => evalPathExpr(a, { filePath, bindings }));
        if (parts.some((p) => p === null)) return null;
        try { return new URL(parts[0], parts[1] ?? `file://${filePath}`).href; } catch { return null; }
    }
    const call = /^(?:path\.)?(join|resolve|dirname|fileURLToPath|pathToFileURL)\s*\(/.exec(text);
    if (call) {
        const args = balancedArgs(text, text.indexOf('('));
        if (!args || text.slice(args.end + 1).trim() !== '') return null;
        const parts = splitArgs(args.inner)
            .map((a) => evalPathExpr(a, { filePath, bindings }));
        if (parts.some((p) => p === null)) return null;
        switch (call[1]) {
            case 'fileURLToPath':
                return parts[0].startsWith('file://') ? parts[0].slice('file://'.length) : null;
            case 'pathToFileURL': return `file://${parts[0]}`;
            case 'dirname': return dirname(parts[0]);
            case 'join': return join(...parts);
            case 'resolve': return resolve(...parts);
            default: return null;
        }
    }
    if (/^[A-Za-z_$][\w$]*$/.test(text) && bindings.has(text)) return bindings.get(text);
    return null;
}

/**
 * Every top-level `const NAME = <path expression>` in a file, resolved.
 *
 * ⛓ TWO PASSES, because `const REPO = join(HERE, '..', '..')` needs `HERE`
 * and the file is free to declare them in either order. A third pass buys
 * nothing this repo writes; if it ever does, the unresolved base shows up in
 * `unresolved` rather than silently pruning an edge.
 */
export function pathBindings(source, filePath) {
    const bindings = new Map();
    const decl = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);?\s*$/gm;
    for (let pass = 0; pass < 2; pass += 1) {
        decl.lastIndex = 0;
        let m = decl.exec(source);
        while (m !== null) {
            const [, name, expr] = m;
            if (!bindings.has(name)) {
                const value = evalPathExpr(expr, { filePath, bindings });
                if (value !== null && isAbsolute(value)) bindings.set(name, value);
            }
            m = decl.exec(source);
        }
    }
    return bindings;
}

// ── the edges ─────────────────────────────────────────────────────────

/**
 * ⛓⛓⛓ THE LOADER HELPER — **the form that hid slice 11's four rows.**
 *
 * `dump-seedling-kind-pairs.mjs:44` and `census-seedling-enemies.mjs:67` do not
 * import anything at all in a way a grep can see:
 *
 *     const mod = async (p) => import(pathToFileURL(path.join(ROOT, p)).href);
 *     const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
 *
 * The literal is at the CALL SITE — `M('procgenSeedling.js')` — and the import
 * site has no literal at all. A scanner that read only import expressions
 * would report BOTH of these files as importing nothing, which is exactly the
 * false-inertia answer §21.5 paid for.
 *
 * ⇒ the helpers are DISCOVERED, not listed — the same construction
 * `reference/instruments.mjs` uses for argv helpers, and for the same reason
 * ("a hand list of helper names is the same defect as a hand list of anything
 * else in this directory"). A top-level `const NAME = (param) => import(EXPR)`
 * makes every `NAME('literal')` in the file an edge, evaluated with `param`
 * bound to that literal.
 */
export function loaderHelpers(source, filePath) {
    const out = new Map();
    const re = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*(?:await\s+)?import\s*\(/gm;
    let m = re.exec(source);
    while (m !== null) {
        const args = balancedArgs(source, m.index + m[0].length - 1);
        if (args) out.set(m[1], { param: m[2], expr: args.inner.trim() });
        m = re.exec(source);
    }
    return out;
}

const FROM_RE = /\b(?:import|export)\b[^;'"()]*?\bfrom\s*(['"])([^'"]+)\1/g;
const BARE_IMPORT_RE = /\bimport\s*(['"])([^'"]+)\1/g;
const HTML_SRC_RE = /<script[^>]*\bsrc\s*=\s*(['"])([^'"]+)\1/gi;

/**
 * The specifiers one file names — static, bare, dynamic-literal and the
 * `import(join(BASE, '…'))` form. Returns `{specs, unresolved}`; `specs` are
 * absolute paths where the expression resolved and raw specifier strings
 * where it is a module id.
 */
export function fileEdges(source, filePath) {
    const bindings = pathBindings(source, filePath);
    const helpers = loaderHelpers(source, filePath);
    const specs = [];
    const unresolved = [];
    const push = (s) => { if (s) specs.push(s); };
    for (const re of [FROM_RE, BARE_IMPORT_RE, HTML_SRC_RE]) {
        re.lastIndex = 0;
        let m = re.exec(source);
        while (m !== null) { push(m[2]); m = re.exec(source); }
    }
    // ⛔ the dynamic form, balanced-paren scanned — `[^)]*` stops at the
    // FIRST `)` and `import(join(REPO, 'x'))` has two.
    const dyn = /\bimport\s*\(/g;
    let d = dyn.exec(source);
    while (d !== null) {
        const args = balancedArgs(source, d.index + d[0].length - 1);
        if (args) {
            const first = splitArgs(args.inner)[0] ?? '';
            const value = evalPathExpr(first, { filePath, bindings });
            if (value !== null) push(value);
            else if (first && !/^['"`]/.test(first.trim())) {
                unresolved.push({ file: filePath, expr: args.inner.trim() });
            }
        }
        d = dyn.exec(source);
    }
    // every `helper('literal')` call site, with the parameter bound
    for (const [name, { param, expr }] of helpers) {
        const callRe = new RegExp(`\\b${name}\\s*\\(`, 'g');
        let c = callRe.exec(source);
        while (c !== null) {
            const args = balancedArgs(source, c.index + c[0].length - 1);
            if (args) {
                const first = splitArgs(args.inner)[0] ?? '';
                const bound = new Map(bindings);
                const literal = evalPathExpr(first, { filePath, bindings });
                if (literal !== null) {
                    bound.set(param, literal);
                    const value = evalPathExpr(expr, { filePath, bindings: bound });
                    if (value !== null) push(value);
                    else unresolved.push({ file: filePath, expr: `${name}(${first})` });
                } else if (first.trim() && !first.trim().startsWith(param)) {
                    unresolved.push({ file: filePath, expr: `${name}(${args.inner.trim()})` });
                }
            }
            c = callRe.exec(source);
        }
    }
    return { specs, unresolved };
}

/** Resolve one specifier against a file, to a repo-relative node or null. */
export function resolveSpec(spec, { filePath, repo, nodes }) {
    let base;
    const plain = spec.startsWith('file://') ? spec.slice('file://'.length) : spec;
    if (isAbsolute(plain)) base = plain;
    else if (plain.startsWith('.')) base = resolve(dirname(filePath), plain);
    else return null; // `node:fs`, an npm package — outside both roots by construction
    const tryPaths = [base, ...RESOLVE_ORDER.map((e) => `${base}${e}`)];
    for (const p of tryPaths) {
        const rel = relative(repo, p).split(sep).join('/');
        if (nodes.has(rel)) return rel;
    }
    return null;
}

/**
 * The forward and reverse import graphs over the tracked file set.
 *
 * `forward.get(f)` = the nodes `f` imports; `reverse.get(f)` = the nodes that
 * import `f` — and the reverse map is the one a REACH walks.
 */
export function buildGraph({ repo = REPO, roots = DEFAULT_ROOTS, files } = {}) {
    const list = files ?? trackedFiles({ repo, roots });
    const nodes = new Set(list);
    const forward = new Map();
    const reverse = new Map();
    const unresolved = [];
    for (const rel of list) {
        forward.set(rel, new Set());
        if (!reverse.has(rel)) reverse.set(rel, new Set());
    }
    for (const rel of list) {
        const abs = join(repo, rel);
        let source;
        try {
            if (statSync(abs).size > 8 * 1024 * 1024) continue;
            source = readFileSync(abs, 'utf8');
        } catch { continue; }
        const { specs, unresolved: raw } = fileEdges(source, abs);
        unresolved.push(...raw.map((u) => ({
            file: rel, expr: u.expr,
        })));
        for (const spec of specs) {
            const target = resolveSpec(spec, { filePath: abs, repo, nodes });
            if (!target || target === rel) continue;
            forward.get(rel).add(target);
            reverse.get(target).add(rel);
        }
    }
    addPageDriveEdges({ repo, nodes, forward, reverse });
    return { nodes, forward, reverse, unresolved };
}

/**
 * ⛔⛔ THE EDGE THAT IS NOT AN IMPORT — **a gate DRIVES a page over HTTP.**
 *
 * `check-seedling-editor-sequence.mjs` never imports `watch.html`; it points a
 * browser at it. So the import closure alone answers "a change to
 * `watchViewer.js` reaches NO gate", which is a claim of inertia and is FALSE
 * — that gate reads the page's every readout. An upper bound that under-reports
 * is worse than none, which is this file's own rule applied to itself.
 *
 * ⇒ every `scripts/procgen/*` that NAMES a page file gets an edge to it. The
 * page set is the graph's own `.html` nodes, so nothing is listed; a docblock
 * mention counts, deliberately — a bound is allowed to be generous and is not
 * allowed to be short.
 */
function addPageDriveEdges({ repo, nodes, forward, reverse }) {
    const pages = new Map();
    for (const rel of nodes) {
        if (rel.endsWith('.html')) pages.set(rel.split('/').pop(), rel);
    }
    if (pages.size === 0) return;
    for (const rel of nodes) {
        if (!rel.startsWith('scripts/procgen/')) continue;
        let source;
        try { source = readFileSync(join(repo, rel), 'utf8'); } catch { continue; }
        for (const m of source.matchAll(/([A-Za-z0-9_.-]+\.html)\b/g)) {
            const page = pages.get(m[1]);
            if (!page || page === rel) continue;
            forward.get(rel).add(page);
            reverse.get(page).add(rel);
        }
    }
}

/** Everything that transitively IMPORTS any of `seeds` (seeds included). */
export function reachFrom(graph, seeds) {
    const out = new Set();
    const queue = [...seeds].filter((s) => graph.nodes.has(s));
    for (const s of queue) out.add(s);
    while (queue.length > 0) {
        const cur = queue.pop();
        for (const dep of graph.reverse.get(cur) ?? []) {
            if (out.has(dep)) continue;
            out.add(dep);
            queue.push(dep);
        }
    }
    return out;
}

/**
 * The files that import a NAMED EXPORT of one module, then their own
 * dependents. `--symbol=<file>#<export>` narrows a reach to one symbol's
 * blast radius rather than the whole module's.
 *
 * ⚠ A file that imports the module for a DIFFERENT symbol is excluded here
 * and is still a legitimate dependent of the FILE — which is why the CLI
 * prints both counts. `import * as ns` counts as naming everything, because
 * it can.
 */
export function symbolSeeds({ file, exportName, repo = REPO, graph }) {
    const direct = [];
    for (const importer of graph.reverse.get(file) ?? []) {
        const source = readFileSync(join(repo, importer), 'utf8');
        const abs = join(repo, importer);
        const bindings = pathBindings(source, abs);
        const nodes = graph.nodes;
        let names = false;
        const scan = (re, group) => {
            re.lastIndex = 0;
            let m = re.exec(source);
            while (m !== null) {
                const spec = m[group];
                const target = resolveSpec(
                    evalPathExpr(`'${spec}'`, { filePath: abs, bindings }) ?? spec,
                    { filePath: abs, repo, nodes },
                );
                if (target === file) {
                    const clause = source.slice(Math.max(0, m.index - 400), m.index + m[0].length);
                    if (/import\s*\*\s*as/.test(clause)
                        || new RegExp(`\\b${exportName}\\b`).test(clause)) names = true;
                }
                m = re.exec(source);
            }
        };
        scan(FROM_RE, 2);
        // the destructured dynamic form: `const { x } = await import(join(…))`
        const dyn = new RegExp(`\\{[^{}]*\\b${exportName}\\b[^{}]*\\}\\s*=\\s*(?:await\\s+)?import\\s*\\(`, 'g');
        if (dyn.test(source)) names = true;
        if (names) direct.push(importer);
    }
    return direct;
}

// ── the partitions ────────────────────────────────────────────────────

const isProducerName = (rel) => /^scripts\/procgen\/(solve|plan|rerecord)-[^/]+\.mjs$/.test(rel);
const isGateName = (rel) => /^scripts\/procgen\/(check|verify)-[^/]+\.mjs$/.test(rel);
const isTestName = (rel) => rel.endsWith('.test.js');
const isPageName = (rel) => /(^|\/)watch[^/]*\.(js|html)$/.test(rel);

/**
 * Split a reached set into the kinds a seal has to have an opinion about.
 *
 * ⛔ A PRODUCER IS ONE THAT CAN DRIFT — `solve-*`/`plan-*`/`rerecord-*` WITH a
 * `--check`. The flag is read out of the file rather than assumed: a producer
 * without one has no committed artifact to disagree with, so it is a script
 * and not a mover, and calling it one would put a row in the seal that has
 * nothing to measure.
 */
export function partition(reached, { repo = REPO } = {}) {
    const producers = [];
    const gates = [];
    const tests = [];
    const pages = [];
    const modules = [];
    for (const rel of [...reached].sort()) {
        if (isProducerName(rel)) {
            const src = readFileSync(join(repo, rel), 'utf8');
            if (src.includes("'--check'") || src.includes('--check=') || src.includes('"--check"')) {
                producers.push(rel);
                continue;
            }
        }
        if (isGateName(rel)) gates.push(rel);
        else if (isTestName(rel)) tests.push(rel);
        else if (isPageName(rel)) pages.push(rel);
        else modules.push(rel);
    }
    return { producers, gates, tests, pages, modules };
}

// ── the tapes, the chains and the identity rows ───────────────────────

const TAPES_REL = 'frontend/modules/seedlingDemo/fixtures/tapes';
const TAPE_INDEX_FILE = 'index.json';

/**
 * Every committed tape whose OWN `description` names one of `producers`.
 *
 * ⛓ This is §16.11's roster selection, re-used rather than re-invented: *"the
 * 26-name selection is DERIVED, not typed — every tape whose own
 * `description` names a `solve-seedling-*` producer"*. A tape that names no
 * producer is not silently dropped from the world; it is simply not reachable
 * THROUGH one, which is a different claim and the report says so.
 */
export function tapesForProducers(producers, { repo = REPO } = {}) {
    const dir = join(repo, TAPES_REL);
    if (!existsSync(dir)) return [];
    const wanted = new Map(producers.map((p) => [p.split('/').pop(), p]));
    if (wanted.size === 0) return [];
    const rows = [];
    for (const f of readdirSync(dir).sort()) {
        if (!f.endsWith('.json') || f === TAPE_INDEX_FILE) continue;
        let tape;
        try { tape = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
        const desc = tape.description ?? '';
        for (const [base, rel] of wanted) {
            const stem = base.replace(/\.mjs$/, '');
            if (desc.includes(base) || new RegExp(`\\b${stem}\\b`).test(desc)) {
                rows.push({ tape: f.slice(0, -'.json'.length), producer: rel });
                break;
            }
        }
    }
    return rows;
}

/**
 * The chains any of `tapeNames` belongs to — as a SEGMENT or as the HEADLINE.
 * A moved segment moves its chain's arithmetic even when the chain's own
 * declaration is untouched (kickoff §21.6 is that exact failure).
 */
export async function chainsForTapes(tapeNames, { repo = REPO } = {}) {
    const names = new Set(tapeNames);
    if (names.size === 0) return [];
    const walk = join(repo, 'frontend/modules/seedlingDemo/playthroughWalk.js');
    if (!existsSync(walk)) return [];
    const { PLAYTHROUGH_CHAINS } = await import(pathToFileURL(walk).href);
    return PLAYTHROUGH_CHAINS
        .filter((c) => c.headline && names.has(c.headline)
            || c.segments.some((s) => names.has(s)))
        .map((c) => c.id);
}

/**
 * The identity block's rows, read out of `identity-block.sh` itself — the
 * label it prints and the script the label's command runs.
 *
 * ⛔ DERIVED FROM THE SHELL, not re-typed here (⚖ ruling 17): the block's
 * membership has changed three times in this arc and a second list would be
 * wrong the first time somebody added a row.
 */
export function identityRows({ repo = REPO } = {}) {
    const path = join(repo, 'scripts/procgen/identity-block.sh');
    if (!existsSync(path)) return [];
    const src = readFileSync(path, 'utf8');
    const rows = [];
    const seen = new Set();
    /**
     * ⛓ `for s in 2 5 9; do r "killgate s$s" …` — three rows, one line. The
     * loop variable is EXPANDED so the labels read `killgate s2/s5/s9`, which
     * is how the block prints them and how every plan quotes them; a row
     * called `killgate s$s` would be a name no reader could match to a value.
     */
    const loopVars = new Map();
    // ⚠ a `for` list may run over several lines with `\` continuations — the
    // producer loop does exactly that, and a newline-stopping pattern silently
    // read only its first two names.
    const forRe = /^[ \t]*for\s+([A-Za-z_][\w]*)\s+in\s+((?:[^;\n]|\\\r?\n)+?)\s*;?\s*do\b/gm;
    let f = forRe.exec(src);
    while (f !== null) {
        loopVars.set(f[1], f[2].split(/[\s\\]+/).filter(Boolean));
        f = forRe.exec(src);
    }
    const expand = (label) => {
        let out = [label];
        for (const [name, values] of loopVars) {
            if (!out.some((l) => l.includes(`$${name}`))) continue;
            out = out.flatMap((l) => values.map((v) => l.split(`$${name}`).join(v)));
        }
        return out;
    };
    const rRe = /^\s*r\s+"([^"]+)"\s+"\$\(node\s+(?:"?)(scripts\/procgen\/[A-Za-z0-9._-]+)/gm;
    let m = rRe.exec(src);
    while (m !== null) {
        const raw = m[1].replace(/\s*\[\*\]\s*$/, '').trim();
        for (const label of expand(raw)) {
            const key = `${label}::${m[2]}`;
            if (!seen.has(key)) { seen.add(key); rows.push({ label, script: m[2] }); }
        }
        m = rRe.exec(src);
    }
    // the `for p in <producers>` loop, whose command is `scripts/procgen/$p.mjs`
    if (loopVars.has('p')) {
        for (const name of loopVars.get('p')) {
            const script = `scripts/procgen/${name}.mjs`;
            const key = `${name} --check::${script}`;
            if (!seen.has(key)) { seen.add(key); rows.push({ label: `${name} --check`, script }); }
        }
    }
    // the standalone lines this script runs without the `r` helper
    const bare = /^\s*node\s+(scripts\/procgen\/[A-Za-z0-9._-]+)/gm;
    let b = bare.exec(src);
    while (b !== null) {
        const key = `${b[1]}::${b[1]}`;
        if (!seen.has(key)) { seen.add(key); rows.push({ label: b[1].split('/').pop(), script: b[1] }); }
        b = bare.exec(src);
    }
    return rows;
}

/**
 * The whole answer for one set of changed files: the closure, its partitions,
 * the tapes and chains its producers own, and the identity rows it reaches.
 */
export async function reachReport(changed, { repo = REPO, roots = DEFAULT_ROOTS, graph } = {}) {
    const g = graph ?? buildGraph({ repo, roots });
    const seeds = changed.filter((f) => g.nodes.has(f));
    const offGraph = changed.filter((f) => !g.nodes.has(f));
    const reached = reachFrom(g, seeds);
    const parts = partition(reached, { repo });
    const tapes = tapesForProducers(parts.producers, { repo });
    const chains = await chainsForTapes(tapes.map((t) => t.tape), { repo });
    const identity = identityRows({ repo }).filter((r) => reached.has(r.script));
    return {
        seeds, offGraph, reached, ...parts, tapes, chains, identity,
        unresolved: g.unresolved,
    };
}

/** Every named thing a report claims can move — the set a seal must cover. */
export function movers(report) {
    return [
        ...report.producers, ...report.gates, ...report.tests, ...report.pages,
        ...report.tapes.map((t) => `tape:${t.tape}`),
        ...report.chains.map((c) => `chain:${c}`),
        ...report.identity.map((r) => `identity:${r.label}`),
    ].sort();
}

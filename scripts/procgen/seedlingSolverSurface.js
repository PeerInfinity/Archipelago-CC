/**
 * THE SEEDLING SOLVER'S SURFACE — a static census of everything the solver
 * family reaches in the simulation (engine-prep slice C1).
 *
 * ⛔ PURE: every function takes source text (or a `read(path)` callback) and
 * returns data. Nothing here writes, and nothing here imports the simulation
 * — it reads it as text and parses it with `@babel/parser`.
 *
 * Three populations, all by static import closure (relative `import … from`
 * and `export … from`; dynamic `import()` is ignored):
 *   - the SIMULATION = the closure of `levelRun.js`;
 *   - the solver FAMILY = the closure of `solverBot.js` + `director.js`,
 *     minus the simulation;
 *   - the RUN OBJECT = the object literal `createLevelRun` returns.
 *
 * What the family reaches:
 *   - `run` surface: a non-computed member read on a binding that holds the
 *     run — an identifier spelled `run`, a `const` alias of one, or a
 *     parameter a run was passed into under any name (followed across files);
 *   - `world` / `state` surfaces: the same, one level down, for values that
 *     came from `run.world` / `run.state` (direct spelling `run.world.x`,
 *     `const w = run.world`, or a parameter `run.world` was passed into).
 *     `run.level` is a NUMBER (the current level id), so it has no members;
 *   - `import` surface: every named symbol a family file imports from a
 *     simulation module — through the import door `solverView.js`, whose
 *     `export { … } from` table resolves each name to the module that
 *     defines it, so a row's `module` is the simulation module, never the door.
 *
 * And the door's two rules: a family file imports a `seedlingDemo` module
 * only if it is another family file or the door; the door exports only what
 * some family file imports, and pulls in no family file.
 *
 * And what it CANNOT see, reported rather than guessed: computed access
 * (`run[k]`), destructuring of a tracked value, a tracked value stored into
 * an object/array, returned, reassigned, held in a `let`, or handed to a
 * callee the census cannot resolve to a family function.
 */
import { parse } from '@babel/parser';
import path from 'node:path';

export const DIR = 'frontend/modules/seedlingDemo';
export const SIM_ENTRY = `${DIR}/levelRun.js`;
export const FAMILY_ENTRIES = [`${DIR}/solverBot.js`, `${DIR}/director.js`];
/**
 * The family's ONE import door (engine-prep C2): a family file imports a
 * simulation symbol from here, never from its defining module. It is not a
 * family file — it holds no solver code — so it is taken out of the family
 * closure, and an import through it is resolved to the module it re-exports.
 */
export const DOOR = `${DIR}/solverView.js`;
/** The four files the planner's §1 numbers were measured over. */
export const CORE_FOUR = ['solverBot.js', 'botDriverV2.js', 'dangerMap.js', 'director.js']
    .map((f) => `${DIR}/${f}`);
/** Where the world object's members are defined. */
export const WORLD_BUILDER = { file: `${DIR}/levelWorld.js`, fn: 'buildLevelWorld' };
/** Where a `state` member the boot literal lacks is defined: the stepper's returned object. */
export const STATE_STEPPER = { file: `${DIR}/playerPhysicsV2.js`, fn: 'step' };

export function parseSource(src) {
    return parse(src, {
        sourceType: 'module',
        errorRecovery: false,
        plugins: ['importMeta', 'topLevelAwait', 'classProperties', 'classPrivateProperties',
            'classPrivateMethods', 'optionalChaining', 'nullishCoalescingOperator'],
    });
}

// ── generic AST walking ─────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['loc', 'start', 'end', 'extra', 'leadingComments',
    'trailingComments', 'innerComments', 'comments', 'range', 'errors', 'tokens']);

/** Depth-first walk calling `enter(node, parent, key)`; `false` skips children. */
export function walk(node, enter, parent = null, key = null) {
    if (!node || typeof node.type !== 'string') return;
    if (enter(node, parent, key) === false) return;
    for (const k of Object.keys(node)) {
        if (SKIP_KEYS.has(k)) continue;
        const v = node[k];
        if (Array.isArray(v)) {
            for (const c of v) if (c && typeof c.type === 'string') walk(c, enter, node, k);
        } else if (v && typeof v.type === 'string') {
            walk(v, enter, node, k);
        }
    }
}

const isFunction = (n) => n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression'
    || n.type === 'ArrowFunctionExpression' || n.type === 'ObjectMethod' || n.type === 'ClassMethod'
    || n.type === 'ClassPrivateMethod');
const isMember = (n) => n && (n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression');
const isCall = (n) => n && (n.type === 'CallExpression' || n.type === 'OptionalCallExpression'
    || n.type === 'NewExpression');

/** A non-computed member's property name, or null. */
function memberName(n) {
    if (!isMember(n) || n.computed) return null;
    if (n.property.type === 'Identifier') return n.property.name;
    if (n.property.type === 'PrivateName') return null;
    return null;
}

// ── imports and the closure ─────────────────────────────────────────────────

/** Relative module specifiers a file statically imports or re-exports. */
export function staticImports(ast) {
    const out = [];
    for (const s of ast.program.body) {
        if ((s.type === 'ImportDeclaration' || s.type === 'ExportNamedDeclaration'
            || s.type === 'ExportAllDeclaration') && s.source && s.source.value.startsWith('.')) {
            out.push({ node: s, spec: s.source.value });
        }
    }
    return out;
}

export function resolveSpec(fromFile, spec) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
}

/** Sorted repo-relative paths of the static relative-import closure of `entries`. */
export function importClosure(entries, read, astCache = new Map()) {
    const seen = new Set();
    const stack = [...entries];
    while (stack.length) {
        const f = stack.pop();
        if (seen.has(f)) continue;
        seen.add(f);
        const ast = astOf(f, read, astCache);
        for (const { spec } of staticImports(ast)) stack.push(resolveSpec(f, spec));
    }
    return [...seen].sort();
}

function astOf(file, read, cache) {
    if (!cache.has(file)) cache.set(file, parseSource(read(file)));
    return cache.get(file);
}

// ── the run object ──────────────────────────────────────────────────────────

/** The top-level `return { … }` of a named function declaration in `ast`. */
function returnedObjectOf(ast, fnName) {
    let fn = null;
    for (const s of ast.program.body) {
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        if (d && d.type === 'FunctionDeclaration' && d.id?.name === fnName) fn = d;
    }
    if (!fn) throw new Error(`function ${fnName} not found`);
    const rets = fn.body.body.filter((s) => s.type === 'ReturnStatement'
        && s.argument?.type === 'ObjectExpression');
    if (rets.length !== 1) throw new Error(`${fnName}: expected ONE top-level object return, `
        + `found ${rets.length}`);
    return rets[0].argument;
}

function propsOf(obj) {
    const out = [];
    for (const p of obj.properties) {
        if (p.type === 'SpreadElement') {
            out.push({ name: null, kind: 'spread', line: p.loc.start.line });
            continue;
        }
        const name = p.key.type === 'Identifier' ? p.key.name
            : p.key.type === 'StringLiteral' ? p.key.value : null;
        let kind;
        if (p.type === 'ObjectMethod') kind = p.kind === 'get' ? 'getter' : p.kind === 'set' ? 'setter' : 'method';
        else if (p.shorthand) kind = 'shorthand';
        else if (isFunction(p.value)) kind = 'method';
        else kind = 'value';
        out.push({ name, kind, line: p.loc.start.line, endLine: p.loc.end.line });
    }
    return out;
}

/** The properties of the object `createLevelRun` returns, in source order. */
export function runObjectMembers(levelRunSrc) {
    const obj = returnedObjectOf(parseSource(levelRunSrc), 'createLevelRun');
    return {
        startLine: obj.loc.start.line, endLine: obj.loc.end.line,
        members: propsOf(obj),
    };
}

/** The properties of the object `buildLevelWorld` returns. */
export function worldObjectMembers(levelWorldSrc) {
    return propsOf(returnedObjectOf(parseSource(levelWorldSrc), WORLD_BUILDER.fn));
}

/**
 * Properties of the LAST top-level `return { … }` of `fnName` — for the
 * physics stepper, whose returned object is the next `state`.
 */
export function lastReturnedMembers(src, fnName) {
    const ast = parseSource(src);
    for (const s of ast.program.body) {
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        if (d?.type !== 'FunctionDeclaration' || d.id?.name !== fnName) continue;
        const rets = d.body.body.filter((x) => x.type === 'ReturnStatement' && x.argument?.type === 'ObjectExpression');
        return rets.length ? propsOf(rets[rets.length - 1].argument) : [];
    }
    return [];
}

/** Properties of the literal `let state = { … }` inside `createLevelRun`. */
export function stateLiteralMembers(levelRunSrc) {
    const ast = parseSource(levelRunSrc);
    let found = null;
    walk(ast.program, (n) => {
        if (found) return false;
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'state'
            && n.init?.type === 'ObjectExpression') {
            found = { line: n.loc.start.line, members: propsOf(n.init) };
            return false;
        }
        return undefined;
    });
    return found;
}

/** `name → line` of every export of a module, following `export … from`. */
export function exportLines(file, read, astCache, seen = new Set()) {
    const out = new Map();
    if (seen.has(file)) return out;
    seen.add(file);
    const ast = astOf(file, read, astCache);
    for (const s of ast.program.body) {
        if (s.type === 'ExportNamedDeclaration') {
            if (s.source) {
                const sub = exportLines(resolveSpec(file, s.source.value), read, astCache, seen);
                for (const sp of s.specifiers) {
                    const hit = sub.get(sp.local.name);
                    if (hit) out.set(sp.exported.name, hit);
                }
                continue;
            }
            if (s.declaration) {
                const d = s.declaration;
                if (d.id) out.set(d.id.name, { file, line: d.loc.start.line });
                for (const v of d.declarations ?? []) {
                    if (v.id.type === 'Identifier') out.set(v.id.name, { file, line: v.loc.start.line });
                }
            }
            for (const sp of s.specifiers) {
                out.set(sp.exported.name, { file, line: localDeclLine(ast, sp.local.name) ?? s.loc.start.line });
            }
        } else if (s.type === 'ExportAllDeclaration') {
            const sub = exportLines(resolveSpec(file, s.source.value), read, astCache, seen);
            for (const [k, v] of sub) if (!out.has(k)) out.set(k, v);
        } else if (s.type === 'ExportDefaultDeclaration') {
            out.set('default', { file, line: s.loc.start.line });
        }
    }
    return out;
}

function localDeclLine(ast, name) {
    for (const s of ast.program.body) {
        if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id?.name === name) {
            return s.loc.start.line;
        }
        if (s.type === 'VariableDeclaration') {
            for (const v of s.declarations) if (v.id.type === 'Identifier' && v.id.name === name) return v.loc.start.line;
        }
    }
    return null;
}

// ── scopes ──────────────────────────────────────────────────────────────────

/**
 * A small lexical scope analysis: every scope-creating node gets the set of
 * names it declares, and every Identifier REFERENCE is resolved to the
 * (scope node, name) that declares it — `null` for a global/free name.
 */
function patternNames(p, out = []) {
    if (!p) return out;
    switch (p.type) {
        case 'Identifier': out.push(p.name); break;
        case 'ObjectPattern':
            for (const q of p.properties) patternNames(q.type === 'RestElement' ? q.argument : q.value, out);
            break;
        case 'ArrayPattern': for (const q of p.elements) patternNames(q, out); break;
        case 'AssignmentPattern': patternNames(p.left, out); break;
        case 'RestElement': patternNames(p.argument, out); break;
        default: break;
    }
    return out;
}

function collectVarNames(body, out) {
    // `var` and function declarations hoist to the function scope.
    walk(body, (n) => {
        if (isFunction(n) && n !== body) {
            if (n.type === 'FunctionDeclaration' && n.id) out.add(n.id.name);
            return false;
        }
        if (n.type === 'VariableDeclaration' && n.kind === 'var') {
            for (const d of n.declarations) for (const nm of patternNames(d.id)) out.add(nm);
        }
        return undefined;
    });
}

function blockNames(stmts, out) {
    for (const s of stmts) {
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        if (!d) continue;
        if (d.type === 'VariableDeclaration' && d.kind !== 'var') {
            for (const v of d.declarations) for (const nm of patternNames(v.id)) out.add(nm);
        } else if (d.type === 'ClassDeclaration' && d.id) out.add(d.id.name);
        else if (d.type === 'FunctionDeclaration' && d.id) out.add(d.id.name);
        else if (d.type === 'ImportDeclaration') for (const sp of d.specifiers) out.add(sp.local.name);
    }
}

/** Is `node` (child `key` of `parent`) an Identifier REFERENCE (not a key or a declaration)? */
function isReference(node, parent, key) {
    if (!parent) return true;
    if (isMember(parent) && key === 'property' && !parent.computed) return false;
    if ((parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod' || parent.type === 'ClassMethod'
        || parent.type === 'ClassProperty') && key === 'key' && !parent.computed) return false;
    if ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement'
        || parent.type === 'ContinueStatement') && key === 'label') return false;
    if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier'
        || parent.type === 'ImportNamespaceSpecifier' || parent.type === 'ExportSpecifier') return false;
    if (parent.type === 'MetaProperty') return false;
    return true;
}

/**
 * Walk `ast` with a scope stack. `visit(node, parent, key, resolve, ancestors)`
 * sees every node; `resolve(name)` returns the declaring scope's node or null.
 */
function walkScoped(ast, visit) {
    const stack = [];
    const ancestors = [];
    const resolve = (name) => {
        for (let i = stack.length - 1; i >= 0; i--) if (stack[i].names.has(name)) return stack[i].node;
        return null;
    };
    const rec = (node, parent, key) => {
        if (!node || typeof node.type !== 'string') return;
        let pushed = 0;
        if (node.type === 'Program') {
            const names = new Set();
            blockNames(node.body, names);
            collectVarNames(node, names);
            stack.push({ node, names }); pushed++;
        } else if (isFunction(node)) {
            const names = new Set();
            for (const p of node.params) for (const nm of patternNames(p)) names.add(nm);
            if (node.type === 'FunctionExpression' && node.id) names.add(node.id.name);
            if (node.body.type === 'BlockStatement') {
                blockNames(node.body.body, names);
                collectVarNames(node.body, names);
            }
            stack.push({ node, names }); pushed++;
        } else if ((node.type === 'BlockStatement' && !isFunction(parent)) || node.type === 'StaticBlock') {
            const names = new Set();
            blockNames(node.body, names);
            stack.push({ node, names }); pushed++;
        } else if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
            const decl = node.type === 'ForStatement' ? node.init : node.left;
            const names = new Set();
            if (decl?.type === 'VariableDeclaration' && decl.kind !== 'var') {
                for (const v of decl.declarations) for (const nm of patternNames(v.id)) names.add(nm);
            }
            stack.push({ node, names }); pushed++;
        } else if (node.type === 'CatchClause') {
            stack.push({ node, names: new Set(patternNames(node.param)) }); pushed++;
        } else if (node.type === 'SwitchStatement') {
            const names = new Set();
            for (const c of node.cases) blockNames(c.consequent, names);
            stack.push({ node, names }); pushed++;
        } else if (node.type === 'ClassExpression' && node.id) {
            stack.push({ node, names: new Set([node.id.name]) }); pushed++;
        }
        visit(node, parent, key, resolve, ancestors);
        ancestors.push(node);
        for (const k of Object.keys(node)) {
            if (SKIP_KEYS.has(k)) continue;
            const v = node[k];
            if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') rec(c, node, k); }
            else if (v && typeof v.type === 'string') rec(v, node, k);
        }
        ancestors.pop();
        while (pushed--) stack.pop();
    };
    rec(ast.program, null, null);
}

// ── the per-file index ──────────────────────────────────────────────────────

/**
 * Index one file: its functions (by declaration binding), its imports, and
 * every Identifier reference with its binding and syntactic context.
 */
function indexFile(file, ast) {
    const refs = [];         // { name, bind, node, parent, key, grand, line }
    const functions = new Map(); // bindKey → function node
    const declInit = new Map();  // bindKey → { kind, id, init, line }
    const imports = new Map();   // local name (top-level) → { imported, spec, line }
    for (const s of ast.program.body) {
        if (s.type !== 'ImportDeclaration') continue;
        for (const sp of s.specifiers) {
            imports.set(sp.local.name, {
                imported: sp.type === 'ImportSpecifier' ? (sp.imported.name ?? sp.imported.value)
                    : sp.type === 'ImportDefaultSpecifier' ? 'default' : '*',
                spec: s.source.value, line: sp.loc.start.line,
            });
        }
    }
    const bindKey = (scopeNode, name) => `${scopeNode ? scopeNode.start : 'global'}:${name}`;
    walkScoped(ast, (node, parent, key, resolve, ancestors) => {
        if (node.type === 'FunctionDeclaration' && node.id) {
            // the declaring scope is the enclosing one: resolve BEFORE this fn's scope is live
            // (walkScoped pushes the function's own scope before visit — so look one up).
            functions.set(`${file}#${node.id.name}@${node.start}`, node);
        }
        if (node.type === 'Identifier' && isReference(node, parent, key)) {
            const scope = resolve(node.name);
            refs.push({
                name: node.name, bind: bindKey(scope, node.name), node, parent, key,
                grand: ancestors[ancestors.length - 2] ?? null,
                ancestors: ancestors.slice(), line: node.loc.start.line,
            });
        }
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
            const decl = parent; // VariableDeclaration
            const scope = resolve(node.id.name);
            declInit.set(bindKey(scope, node.id.name), {
                kind: decl.kind, init: node.init, line: node.loc.start.line, id: node.id,
            });
        }
    });
    const refByNode = new Map(refs.map((r) => [r.node, r]));
    return { file, ast, refs, refByNode, imports, bindKey, declInit };
}

/** The binding key a function's parameter `i` gets, and its node. */
function paramBinding(fnNode, i) {
    const p = fnNode.params[i];
    if (!p) return null;
    const core = p.type === 'AssignmentPattern' ? p.left : p;
    return core;
}

/** Map every top-level function (declared or `const f = () => …`) and exported name. */
function topFunctions(ast) {
    const out = new Map();
    for (const s of ast.program.body) {
        const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
        if (!d) continue;
        if (d.type === 'FunctionDeclaration' && d.id) out.set(d.id.name, d);
        if (d.type === 'VariableDeclaration') {
            for (const v of d.declarations) {
                if (v.id.type === 'Identifier' && isFunction(v.init)) out.set(v.id.name, v.init);
            }
        }
    }
    return out;
}

/** Nested function declarations and const-arrow functions, by the scope they are declared in. */
function allNamedFunctions(ast) {
    const out = []; // { name, fn, scopeNode }
    walkScoped(ast, (node, parent, key, resolve) => {
        if (node.type === 'FunctionDeclaration' && node.id) {
            out.push({ name: node.id.name, fn: node });
        } else if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && isFunction(node.init)) {
            out.push({ name: node.id.name, fn: node.init, declScope: resolve(node.id.name) });
        }
    });
    return out;
}

// ── the census ──────────────────────────────────────────────────────────────

const BASE_MEMBER = { world: 'world', state: 'state' };

/**
 * Run the census.
 *
 * @param {(path: string) => string} read  repo-relative path → source text
 * @returns {object} populations, per-file reads, imports and blind spots
 */
export function census(read) {
    const astCache = new Map();
    const simulation = importClosure([SIM_ENTRY], read, astCache);
    const simSet = new Set(simulation);
    const familyClosure = importClosure(FAMILY_ENTRIES, read, astCache);
    const family = familyClosure.filter((f) => !simSet.has(f) && f !== DOOR);
    const runObj = runObjectMembers(read(SIM_ENTRY));
    const runMembers = new Map(runObj.members.filter((m) => m.name).map((m) => [m.name, m]));
    const worldMembers = new Map(worldObjectMembers(read(WORLD_BUILDER.file))
        .filter((m) => m.name).map((m) => [m.name, m]));
    const stateLit = stateLiteralMembers(read(SIM_ENTRY));
    const stateMembers = new Map(stateLit.members.filter((m) => m.name)
        .map((m) => [m.name, { ...m, file: SIM_ENTRY }]));
    for (const m of lastReturnedMembers(read(STATE_STEPPER.file), STATE_STEPPER.fn)) {
        if (m.name && !stateMembers.has(m.name)) stateMembers.set(m.name, { ...m, file: STATE_STEPPER.file });
    }

    const idx = new Map(family.map((f) => [f, indexFile(f, astOf(f, read, astCache))]));

    // Resolve a callee identifier (in `file`) to a family function node + its file.
    const fnByNode = new Map();
    const namedFns = new Map(); // file → [{name, fn}]
    for (const f of family) namedFns.set(f, allNamedFunctions(astOf(f, read, astCache)));
    const topFns = new Map(family.map((f) => [f, topFunctions(astOf(f, read, astCache))]));
    const resolveCallee = (file, ref) => {
        // local function whose name matches and whose declaration encloses the call
        const fi = idx.get(file);
        const imp = fi.imports.get(ref.name);
        const cands = namedFns.get(file).filter((c) => c.name === ref.name
            && ancestorsContainDecl(ref, c));
        if (cands.length) return { file, fn: cands[cands.length - 1].fn };
        if (imp && imp.spec.startsWith('.')) {
            const target = resolveSpec(file, imp.spec);
            if (topFns.has(target)) {
                const fn = topFns.get(target).get(imp.imported);
                if (fn) return { file: target, fn };
            }
            return { external: target, name: imp.imported };
        }
        return null;
    };

    // tracked: bindKey(file-qualified) → base ('run' | 'world' | 'state')
    const tracked = new Map();
    const trackedWhy = new Map();
    const keyOf = (file, bind) => `${file}|${bind}`;
    for (const [f, fi] of idx) {
        for (const r of fi.refs) {
            if (r.name === 'run') tracked.set(keyOf(f, r.bind), 'run');
        }
    }

    // The base a value-expression carries, or null.
    const baseOf = (file, expr) => {
        const fi = idx.get(file);
        if (!expr) return null;
        if (expr.type === 'Identifier') {
            const r = fi.refByNode.get(expr);
            return r ? tracked.get(keyOf(file, r.bind)) ?? null : null;
        }
        if (isMember(expr)) {
            const nm = memberName(expr);
            if (nm && BASE_MEMBER[nm] && baseOf(file, expr.object) === 'run') return BASE_MEMBER[nm];
        }
        return null;
    };

    // Fixpoint over const aliases and parameter passing.
    const bindingOfParam = (file, fnNode, i) => {
        const p = paramBinding(fnNode, i);
        if (!p) return null;
        if (p.type !== 'Identifier') return { pattern: true, node: p };
        const fi = idx.get(file);
        // the param's binding key is keyed by the function node's start
        return { key: keyOf(file, `${fnNode.start}:${p.name}`), name: p.name, fi };
    };
    const blind = [];
    const blindSeen = new Set();
    const addBlind = (b) => {
        const k = `${b.file}:${b.line}:${b.kind}:${b.detail}`;
        if (!blindSeen.has(k)) { blindSeen.add(k); blind.push(b); }
    };
    const passes = [];
    let changed = true;
    let rounds = 0;
    while (changed && rounds++ < 20) {
        changed = false;
        for (const [f, fi] of idx) {
            for (const r of fi.refs) {
                const base = tracked.get(keyOf(f, r.bind));
                // a reference to a tracked binding, or the object of `run.world` / `run.state`
                let expr = r.node; let exprBase = base; let parent = r.parent; let key = r.key;
                let depth = r.ancestors.length - 1;
                if (!exprBase) continue;
                if (exprBase === 'run' && isMember(parent) && key === 'object') {
                    const nm = memberName(parent);
                    if (nm && BASE_MEMBER[nm]) {
                        expr = parent; exprBase = BASE_MEMBER[nm];
                        parent = r.ancestors[depth - 1] ?? null;
                        key = keyInParent(parent, expr);
                        depth -= 1;
                    }
                }
                // unwrap `x ?? fallback`, `(x)`
                while (parent && parent.type === 'LogicalExpression' && key === 'left'
                    && (parent.operator === '??' || parent.operator === '||')) {
                    expr = parent; parent = r.ancestors[depth - 1] ?? null; key = keyInParent(parent, expr); depth -= 1;
                }
                if (!parent) continue;
                if (parent.type === 'VariableDeclarator' && key === 'init') {
                    const declaration = r.ancestors[depth - 1];
                    if (parent.id.type === 'Identifier') {
                        if (declaration?.kind === 'const') {
                            const k2 = keyOf(f, bindOfDeclarator(fi, parent));
                            if (!tracked.has(k2)) {
                                tracked.set(k2, exprBase); changed = true;
                                trackedWhy.set(k2, { file: f, line: parent.loc.start.line,
                                    how: 'const-alias', name: parent.id.name, base: exprBase });
                            }
                        } else {
                            addBlind({ file: f, line: r.line, kind: 'let-alias', base: exprBase,
                                detail: `${declaration?.kind} ${parent.id.name} = ${exprBase}` });
                        }
                    } else {
                        addBlind({ file: f, line: r.line, kind: 'destructure', base: exprBase,
                            detail: `{${patternNames(parent.id).join(', ')}} = ${exprBase}` });
                    }
                } else if (isCall(parent) && key === 'arguments') {
                    const i = parent.arguments.indexOf(expr);
                    if (parent.callee.type !== 'Identifier') {
                        const calleeText = parent.callee.type === 'MemberExpression' || parent.callee.type === 'OptionalMemberExpression'
                            ? memberText(parent.callee) : parent.callee.type;
                        if (exprBase === 'run' && baseOf(f, parent.callee.object ?? null) === 'run') continue;
                        addBlind({ file: f, line: r.line, kind: 'passed-unresolved', base: exprBase,
                            detail: `${exprBase} → ${calleeText}(arg ${i})` });
                        continue;
                    }
                    const cref = fi.refByNode.get(parent.callee);
                    const target = resolveCallee(f, cref);
                    if (!target) {
                        addBlind({ file: f, line: r.line, kind: 'passed-unresolved', base: exprBase,
                            detail: `${exprBase} → ${parent.callee.name}(arg ${i})` });
                    } else if (target.external) {
                        passes.push({ file: f, line: r.line, base: exprBase, callee: target.name,
                            module: target.external, arg: i,
                            where: simSet.has(target.external) ? 'simulation' : 'other' });
                    } else {
                        const pb = bindingOfParam(target.file, target.fn, i);
                        if (!pb) continue;
                        if (pb.pattern) {
                            addBlind({ file: f, line: r.line, kind: 'destructure-param', base: exprBase,
                                detail: `${exprBase} → ${parent.callee.name}(arg ${i}) destructured` });
                        } else if (!tracked.has(pb.key)) {
                            tracked.set(pb.key, exprBase); changed = true;
                            trackedWhy.set(pb.key, { file: target.file, line: target.fn.loc.start.line,
                                how: 'param', name: pb.name, base: exprBase,
                                from: `${f}:${r.line}`, callee: parent.callee.name });
                            if (exprBase === 'run' && pb.name !== 'run') {
                                addBlind({ file: f, line: r.line, kind: 'run-renamed-param', base: 'run',
                                    detail: `run → ${parent.callee.name}(${pb.name}) — followed` });
                            }
                        }
                    }
                } else if (parent.type === 'ObjectProperty' && key === 'value') {
                    addBlind({ file: f, line: r.line, kind: 'stored-in-object', base: exprBase,
                        detail: `${exprBase} as .${parent.key.name ?? parent.key.value}` });
                } else if (parent.type === 'SpreadElement' && r.ancestors[depth - 1]?.type === 'ObjectExpression') {
                    // `{ ...run.state }` reads EVERY own key — the census cannot name them.
                    addBlind({ file: f, line: r.line, kind: 'spread-copy', base: exprBase,
                        detail: `{ ...${exprBase} } copies every member` });
                } else if (parent.type === 'ArrayExpression' || parent.type === 'SpreadElement') {
                    addBlind({ file: f, line: r.line, kind: 'stored-in-array', base: exprBase, detail: exprBase });
                } else if (parent.type === 'ReturnStatement' || (parent.type === 'ArrowFunctionExpression' && key === 'body')) {
                    addBlind({ file: f, line: r.line, kind: 'returned', base: exprBase, detail: exprBase });
                } else if (parent.type === 'AssignmentExpression' && key === 'right') {
                    addBlind({ file: f, line: r.line, kind: 'assigned', base: exprBase, detail: exprBase });
                } else if (isMember(parent) && key === 'object' && parent.computed) {
                    addBlind({ file: f, line: r.line, kind: 'computed', base: exprBase,
                        detail: `${exprBase}[${parent.property.type === 'StringLiteral' ? JSON.stringify(parent.property.value) : '…'}]` });
                }
            }
        }
    }

    // Reads: a non-computed member on a tracked value.
    const reads = []; // { file, line, base, name, via }
    for (const [f, fi] of idx) {
        for (const r of fi.refs) {
            const base = tracked.get(keyOf(f, r.bind));
            if (!base) continue;
            if (!(isMember(r.parent) && r.key === 'object')) continue;
            const nm = memberName(r.parent);
            if (!nm) continue;
            const via = base === 'run' && r.name === 'run' ? 'direct' : `${trackedWhy.get(keyOf(f, r.bind))?.how ?? 'direct'}:${r.name}`;
            reads.push({ file: f, line: r.line, base, name: nm, via, spelled: `${r.name}.${nm}` });
            if (base === 'run' && BASE_MEMBER[nm]) {
                const up = r.ancestors[r.ancestors.length - 2];
                if (isMember(up) && keyInParent(up, r.parent) === 'object') {
                    const nm2 = memberName(up);
                    if (nm2) {
                        reads.push({ file: f, line: r.line, base: BASE_MEMBER[nm], name: nm2,
                            via: via === 'direct' ? 'direct' : via, spelled: `${r.name}.${nm}.${nm2}` });
                    } else if (up.computed) {
                        addBlind({ file: f, line: r.line, kind: 'computed', base: BASE_MEMBER[nm],
                            detail: `${r.name}.${nm}[…]` });
                    }
                }
            }
        }
    }

    // Imports from simulation modules (and re-exports of them) — through the
    // door, resolved to the module the door re-exports.
    const imports = [];
    const exportCache = new Map();
    const exportsOf = (m) => {
        if (!exportCache.has(m)) exportCache.set(m, exportLines(m, read, astCache));
        return exportCache.get(m);
    };
    const door = doorOf(read, astCache, simSet, family);
    const allowed = new Set([...family, DOOR]);
    const doorUsed = new Set();
    for (const [f, fi] of idx) {
        for (const s of fi.ast.program.body) {
            if (!(s.type === 'ImportDeclaration' || ((s.type === 'ExportNamedDeclaration'
                || s.type === 'ExportAllDeclaration') && s.source))) continue;
            if (!s.source.value.startsWith('.')) continue;
            let mod = resolveSpec(f, s.source.value);
            const viaDoor = mod === DOOR;
            if (!viaDoor && mod.startsWith(`${DIR}/`) && !allowed.has(mod)) {
                door.bypass.push({ file: f, line: s.loc.start.line, module: mod });
            }
            if (!viaDoor && !simSet.has(mod)) continue;
            for (const sp of s.specifiers ?? []) {
                let imported = s.type === 'ImportDeclaration'
                    ? (sp.type === 'ImportSpecifier' ? (sp.imported.name ?? sp.imported.value)
                        : sp.type === 'ImportDefaultSpecifier' ? 'default' : '*')
                    : sp.local.name;
                if (viaDoor && imported === '*') {
                    addBlind({ file: f, line: sp.loc.start.line, kind: 'namespace-import', base: 'import',
                        detail: `* as ${sp.local.name} from ${DOOR}` });
                    continue;
                }
                if (viaDoor) {
                    const through = door.exports.get(imported);
                    doorUsed.add(imported);
                    if (!through) {
                        door.unknown.push({ file: f, line: sp.loc.start.line, name: imported });
                        continue;
                    }
                    mod = through.module;
                    imported = through.name;
                }
                if (imported === '*') {
                    addBlind({ file: f, line: sp.loc.start.line, kind: 'namespace-import', base: 'import',
                        detail: `* as ${sp.local.name} from ${mod}` });
                }
                const local = s.type === 'ImportDeclaration' ? sp.local.name : null;
                const sites = local ? fi.refs.filter((r) => r.name === local
                    && r.bind === fi.bindKey(fi.ast.program, local)).length : 0;
                const def = exportsOf(mod).get(imported) ?? null;
                imports.push({ file: f, line: sp.loc.start.line, name: imported, local, module: mod,
                    sites, reexport: s.type !== 'ImportDeclaration', door: viaDoor,
                    definedAt: def ? `${def.file}:${def.line}` : null });
            }
        }
    }
    door.unused = [...door.exports].filter(([name]) => !doorUsed.has(name))
        .map(([name, t]) => ({ name, module: t.module, line: t.line }));

    return {
        simulation, family, familyClosure,
        runObject: runObj, runMembers, worldMembers, stateMembers, stateLine: stateLit.line,
        reads, imports, blind, passes, door,
        tracked: [...trackedWhy.values()],
    };
}

/**
 * The import door, read as text: `exports` maps each exported name to the
 * simulation module and name it re-exports. Anything else in the door — a
 * local declaration, a re-export of a non-simulation module, a family file in
 * its closure — is a `leak`. `bypass` / `unknown` / `unused` are filled by the
 * census from the family's side.
 */
function doorOf(read, astCache, simSet, family) {
    const out = { exports: new Map(), leaks: [], bypass: [], unknown: [], unused: [] };
    let ast;
    try { ast = astOf(DOOR, read, astCache); } catch { return out; } // no door yet
    for (const s of ast.program.body) {
        const mod = s.source ? resolveSpec(DOOR, s.source.value) : null;
        if (s.type === 'ExportNamedDeclaration' && mod && simSet.has(mod)) {
            const has = exportLines(mod, read, astCache);
            for (const sp of s.specifiers) {
                if (!has.has(sp.local.name ?? sp.local.value)) {
                    out.leaks.push({ line: sp.loc.start.line,
                        what: `a re-export of ${sp.local.name ?? sp.local.value}, which ${mod} does not export` });
                }
                out.exports.set(sp.exported.name ?? sp.exported.value, {
                    module: mod, name: sp.local.name ?? sp.local.value, line: sp.loc.start.line,
                });
            }
        } else {
            out.leaks.push({ line: s.loc.start.line, what: `${s.type}${mod ? ` of ${mod}` : ''}` });
        }
    }
    const fam = new Set(family);
    for (const f of importClosure([DOOR], read, astCache)) {
        if (fam.has(f)) out.leaks.push({ line: null, what: `its closure pulls in the family file ${f}` });
    }
    return out;
}

function ancestorsContainDecl(ref, cand) {
    // A nested function declared inside some other function is visible only
    // below that function; a top-level one everywhere.
    const fn = cand.fn;
    // find the declaring container: search the ref's ancestors for a node whose
    // body directly contains the declaration.
    const container = (n) => {
        const body = n.type === 'Program' ? n.body : n.body?.type === 'BlockStatement' ? n.body.body
            : n.type === 'BlockStatement' ? n.body : null;
        if (!body) return false;
        return body.some((s) => s === fn || (s.type === 'ExportNamedDeclaration' && s.declaration === fn)
            || (s.type === 'VariableDeclaration' && s.declarations.some((d) => d.init === fn)));
    };
    return ref.ancestors.some(container);
}

function keyInParent(parent, child) {
    if (!parent) return null;
    for (const k of Object.keys(parent)) {
        if (SKIP_KEYS.has(k)) continue;
        const v = parent[k];
        if (v === child) return k;
        if (Array.isArray(v) && v.includes(child)) return k;
    }
    return null;
}

function bindOfDeclarator(fi, declarator) {
    // declarator ids are not references: the declInit map holds their binding.
    for (const [k, v] of fi.declInit) if (v.id === declarator.id) return k;
    return `?:${declarator.id.name}`;
}

function memberText(n) {
    if (n.type === 'Identifier') return n.name;
    if (isMember(n)) return `${memberText(n.object)}.${n.computed ? '[…]' : n.property.name}`;
    if (n.type === 'ThisExpression') return 'this';
    return n.type;
}

// ── summaries ───────────────────────────────────────────────────────────────

/** Group reads by (base, name) → {sites, files:Map(file→sites), lines}. */
export function groupReads(reads, { base = null, files = null, directOnly = false } = {}) {
    const out = new Map();
    for (const r of reads) {
        if (base && r.base !== base) continue;
        if (files && !files.includes(r.file)) continue;
        if (directOnly && r.via !== 'direct') continue;
        const k = `${r.base}:${r.name}`;
        if (!out.has(k)) out.set(k, { base: r.base, name: r.name, sites: 0, files: new Map(), vias: new Set() });
        const g = out.get(k);
        g.sites++;
        g.files.set(r.file, (g.files.get(r.file) ?? 0) + 1);
        g.vias.add(r.via.split(':')[0]);
    }
    return out;
}

/** The brief's Surface A: non-computed `run.x` / `run?.x` on the identifier `run`. */
export function surfaceA(c, files) {
    return groupReads(c.reads.filter((r) => r.spelled.split('.').length === 2), { base: 'run', files, directOnly: true });
}

/** Where a member of `surface` is defined, as `file:line`. */
export function definedAt(c, surface, name) {
    if (surface === 'run') {
        const m = c.runMembers.get(name);
        return m ? `${SIM_ENTRY}:${m.line}` : null;
    }
    if (surface === 'world') {
        const m = c.worldMembers.get(name);
        return m ? `${WORLD_BUILDER.file}:${m.line}` : null;
    }
    if (surface === 'state') {
        const m = c.stateMembers.get(name);
        return m ? `${m.file}:${m.line}` : null;
    }
    return null;
}

/**
 * The census's STATIC rows, keyed `surface:name` — the shape the committed
 * table's rows are compared against.
 */
export function staticRows(c) {
    const rows = new Map();
    for (const g of groupReads(c.reads).values()) {
        rows.set(`${g.base}:${g.name}`, {
            surface: g.base, name: g.name,
            files: Object.fromEntries([...g.files].map(([f, n]) => [path.posix.basename(f), n])
                .sort(([a], [b]) => a.localeCompare(b))),
            sites: g.sites,
            via: [...g.vias].sort(),
        });
    }
    const byImport = new Map();
    for (const im of c.imports) {
        const k = `import:${path.posix.basename(im.module)}#${im.name}`;
        if (!byImport.has(k)) byImport.set(k, { surface: 'import', name: im.name, module: im.module,
            definedAt: im.definedAt, files: {}, sites: 0, via: ['import'] });
        const row = byImport.get(k);
        const b = path.posix.basename(im.file);
        row.files[b] = (row.files[b] ?? 0) + im.sites;
        row.sites += im.sites;
    }
    for (const [k, v] of byImport) {
        v.files = Object.fromEntries(Object.entries(v.files).sort(([a], [b]) => a.localeCompare(b)));
        rows.set(k, v);
    }
    return rows;
}

/** The key a table row is compared under. */
export function rowKey(row) {
    return row.surface === 'import'
        ? `import:${path.posix.basename(row.module)}#${row.name}` : `${row.surface}:${row.name}`;
}

/**
 * Compare a fresh census against the committed table. Returns the findings a
 * gate turns RED on:
 *   - `unlisted`: a family file reaches a member / imports a symbol the table
 *     lacks, or reaches a listed one from a file the row does not name;
 *   - `retired`: a static row nothing reaches any more;
 *   - `family`: the family file list differs from the closure;
 *   - `door`: a family file importing a simulation module around the door,
 *     a name the door does not export, or a door that is not pure re-exports
 *     of the simulation (an UNUSED door export is `retired`).
 */
export function compareToTable(c, table) {
    const fresh = staticRows(c);
    const committed = new Map(table.rows.filter((r) => r.seen !== 'dynamic').map((r) => [rowKey(r), r]));
    const unlisted = [];
    const retired = [];
    const siteOf = (key, file) => {
        const [surface, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
        if (surface === 'import') {
            const [mod, name] = rest.split('#');
            const im = c.imports.find((i) => i.name === name && path.posix.basename(i.module) === mod
                && path.posix.basename(i.file) === file);
            return im ? `${im.file}:${im.line}` : file;
        }
        const r = c.reads.find((x) => x.base === surface && x.name === rest && path.posix.basename(x.file) === file);
        return r ? `${r.file}:${r.line}` : file;
    };
    for (const [k, row] of fresh) {
        const have = committed.get(k);
        if (!have) {
            for (const f of Object.keys(row.files)) {
                unlisted.push({ key: k, file: f, at: siteOf(k, f), why: 'not in the contract table' });
            }
            continue;
        }
        for (const f of Object.keys(row.files)) {
            if (!(f in (have.files ?? {}))) {
                unlisted.push({ key: k, file: f, at: siteOf(k, f),
                    why: `the row names only ${Object.keys(have.files ?? {}).join(', ') || 'no file'}` });
            }
        }
    }
    for (const [k, row] of committed) {
        if (!fresh.has(k)) { retired.push({ key: k, why: 'nothing reaches it — it must be RETIRED' }); continue; }
        const now = fresh.get(k).files;
        for (const f of Object.keys(row.files ?? {})) {
            if (!(f in now)) retired.push({ key: k, file: f, why: `${f} no longer reaches it — the file must be RETIRED from the row` });
        }
    }
    const famNow = c.family.map((f) => path.posix.basename(f));
    const famTable = table.family ?? [];
    const family = JSON.stringify(famNow) === JSON.stringify(famTable) ? null
        : { closure: famNow, table: famTable };
    const doorName = path.posix.basename(DOOR);
    for (const u of c.door?.unused ?? []) {
        retired.push({ key: `door:${doorName}#${u.name}`, at: `${DOOR}:${u.line}`,
            why: `no family file imports it — the export must be RETIRED from ${doorName}` });
    }
    const door = [
        ...(c.door?.bypass ?? []).map((b) => ({ at: `${b.file}:${b.line}`,
            why: `imports ${path.posix.basename(b.module)} directly — a family file imports a seedlingDemo module `
                + `only if it is a family file or the door, ${doorName}` })),
        ...(c.door?.unknown ?? []).map((u) => ({ at: `${u.file}:${u.line}`,
            why: `imports ${u.name} through ${doorName}, which does not export it` })),
        ...(c.door?.leaks ?? []).map((l) => ({ at: `${DOOR}${l.line ? `:${l.line}` : ''}`,
            why: `the door holds only \`export { … } from\` a simulation module — found ${l.what}` })),
    ];
    return { unlisted, retired, family, door };
}

// ── the contract table ──────────────────────────────────────────────────────

const SURFACE_ORDER = { run: 0, world: 1, state: 2, import: 3 };

/**
 * Compose the contract table from a census, the previous table (whose
 * hand-written `class` / `form` / `why` survive by row key) and the dynamic
 * measurement (`seedling-solver-surface-dynamic.json`, or null).
 *
 * A row the previous table did not classify comes out `class: "UNCLASSIFIED"`
 * — the gate refuses those, so adding a member is: `--write`, then read the
 * member and fill in its class, form and why.
 */
export function buildTable(c, { previous = null, dynamic = null } = {}) {
    const prev = new Map((previous?.rows ?? []).map((r) => [rowKey(r), r]));
    const famPaths = new Set(c.family);
    const dyn = new Map();
    for (const m of dynamic?.members ?? []) {
        const files = {};
        for (const [f, n] of Object.entries(m.files)) if (famPaths.has(f)) files[path.posix.basename(f)] = n;
        if (!Object.keys(files).length) continue;
        dyn.set(`${m.surface}:${m.name}`, {
            reads: Object.values(files).reduce((a, b) => a + b, 0), files,
            sites: m.sites.filter((s) => famPaths.has(s.replace(/:\d+$/, ''))).length,
        });
    }
    const fresh = staticRows(c);
    const keys = new Set([...fresh.keys(), ...dyn.keys()]);
    const rows = [];
    for (const k of keys) {
        const st = fresh.get(k);
        const dy = dyn.get(k) ?? null;
        const surface = st?.surface ?? k.slice(0, k.indexOf(':'));
        const name = st?.name ?? k.slice(k.indexOf(':') + 1);
        const def = st?.surface === 'import' ? st.definedAt : definedAt(c, surface, name);
        const p = prev.get(k);
        rows.push({
            surface, name,
            module: def ? def.replace(/:\d+$/, '') : (st?.module ?? null),
            line: def ? Number(def.match(/:(\d+)$/)[1]) : null,
            class: p?.class ?? 'UNCLASSIFIED',
            form: p?.form ?? null,
            files: st?.files ?? {},
            sites: st?.sites ?? 0,
            seen: st && dy ? 'both' : st ? 'static' : 'dynamic',
            via: st?.via ?? [],
            dynamic: surface === 'import' ? null : dy,
            why: p?.why ?? null,
        });
    }
    rows.sort((a, b) => (SURFACE_ORDER[a.surface] - SURFACE_ORDER[b.surface])
        || (a.module ?? '').localeCompare(b.module ?? '') * (a.surface === 'import' ? 1 : 0)
        || a.name.localeCompare(b.name));
    const kinds = {};
    for (const m of c.runObject.members) kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
    return {
        note: 'GENERATED by scripts/procgen/census-seedling-solver-surface.mjs --write, EXCEPT class / form / why, '
            + 'which are written by hand from reading each member and survive --write by row key. '
            + 'seedlingSolverSurface.test.js gates the static rows: a member the family reaches that is not here is '
            + 'RED, and a row nothing reaches any more is RED until it is retired. `line` is informational.',
        family: c.family.map((f) => path.posix.basename(f)),
        simulation: { entry: SIM_ENTRY, files: c.simulation.length },
        runObject: { properties: c.runObject.members.length, ...kinds },
        dynamicRoutes: (dynamic?.routes ?? []).map((r) => r.command),
        rows,
    };
}

/** Static rows whose `files` / `sites` no longer equal a fresh census (gate i). */
export function staticDrift(c, table) {
    const fresh = staticRows(c);
    const out = [];
    for (const r of table.rows) {
        if (r.seen === 'dynamic') continue;
        const f = fresh.get(rowKey(r));
        if (!f) continue; // retired — reported by compareToTable
        if (f.sites !== r.sites || JSON.stringify(f.files) !== JSON.stringify(r.files)) {
            out.push({ key: rowKey(r), table: { sites: r.sites, files: r.files }, fresh: { sites: f.sites, files: f.files } });
        }
    }
    return out;
}

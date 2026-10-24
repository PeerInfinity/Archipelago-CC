/**
 * ruleKindCensus — the CROSS-LAYER rule-node kind census (rule-node-registry R1, ⚖ D2 2026-10-21).
 *
 * A rules.json rule node has a KIND: AST `{"type": "item_check"}` or Rule Builder `{"rule": "Has"}`.
 * Many layers produce or consume kinds, and a kind one layer emits but another does not handle
 * fails SILENTLY (world_generator writes `True_()`, the helper codegen writes `'True'`, the JS
 * worker evaluates an unknown Rule Builder name as a missing helper → `false`). This census puts
 * every layer's vocabulary side by side and names each gap.
 *
 * Inputs:
 *   - `frontend/schema/rule-kinds.json` — the REGISTRY (hand-edited): every kind, what it needs
 *     from its evaluation context, the known gaps and their ceiling.
 *   - `frontend/schema/rule-kinds.python-vocab.json` — the Python layers' vocabularies, GENERATED
 *     by `scripts/rules/rule_kind_vocab.py` (pytest keeps it fresh).
 *   - the JS rule engine, LIVE: the AST handler registry is built from the same factories
 *     `core.js` assembles; the Rule Builder switch is PROBED — a name it does not handle is the
 *     one that falls to the default branch and becomes a helper call of that name.
 *   - committed preset data: every kind used in a rule position of `frontend/presets/**_rules.json`.
 *
 * Usage: node scripts/rules/ruleKindCensus.js [--json]
 * The gate is `scripts/rules/ruleKindCensus.test.js`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REGISTRY_PATH = join(REPO, 'frontend/schema/rule-kinds.json');
export const PYTHON_VOCAB_PATH = join(REPO, 'frontend/schema/rule-kinds.python-vocab.json');
const ENGINE_DIR = join(REPO, 'frontend/modules/shared/ruleEngine');

/** The AST handler factories `core.js` merges into its registry, by module. */
export const AST_FACTORIES = {
    'astLogic.js': 'createLogicHandlers',
    'astChecks.js': 'createCheckHandlers',
    'astAttributes.js': 'createAttributeHandlers',
    'astFunctionCalls.js': 'createFunctionCallHandlers',
    'astCollections.js': 'createCollectionHandlers',
    'astImperative.js': 'createImperativeHandlers',
    'astReachability.js': 'createReachabilityHandlers',
    'astHelpers.js': 'createHelperHandlers',
};

/** The `create*Handlers` names `core.js` imports — the census's drift guard on AST_FACTORIES. */
export function coreFactoryImports() {
    const src = readFileSync(join(ENGINE_DIR, 'core.js'), 'utf8');
    return [...src.matchAll(/import\s*\{\s*(create\w+Handlers)\s*\}\s*from\s*'\.\/(\w+\.js)'/g)]
        .map(([, fn, file]) => `${file}:${fn}`).sort();
}

/** Every AST `type` the JS engine has a handler for. */
export async function jsAstKinds() {
    const kinds = new Set();
    for (const [file, factory] of Object.entries(AST_FACTORIES)) {
        const mod = await import(pathToFileURL(join(ENGINE_DIR, file)).href);
        for (const k of Object.keys(mod[factory](() => undefined))) kinds.add(k);
    }
    return kinds;
}

/**
 * The Rule Builder names the engine's switch handles, out of `names`. A name the switch does not
 * list reaches the default branch, which (with no `_original_ast_type`) evaluates it as a helper
 * call OF THAT NAME — the probe's signal. A case that throws on empty args is a handled case.
 */
export async function jsRbHandled(names) {
    const { createRuleBuilderEvaluator } = await import(pathToFileURL(join(ENGINE_DIR, 'ruleBuilderEvaluator.js')).href);
    const handled = new Set();
    // probing every case with empty args makes the engine warn once per case
    const quiet = ['log', 'info', 'warn', 'error', 'debug'].map((m) => [m, console[m]]);
    for (const [m] of quiet) console[m] = () => {};
    try {
        for (const name of names) {
            let coerced = false;
            const evaluate = (node) => {
                if (node && node.type === 'helper' && node.name === name) coerced = true;
                return undefined;
            };
            try {
                createRuleBuilderEvaluator(evaluate)({ rule: name, args: {} }, {}, 5, null);
            } catch {
                // a handled case reading args it did not get
            }
            if (!coerced) handled.add(name);
        }
    } finally {
        for (const [m, fn] of quiet) console[m] = fn;
    }
    return handled;
}

/** Keys whose value is a rule tree, wherever they appear in a rules.json (sphere_log excluded). */
export const RULE_ROOT_KEYS = ['access_rule', 'item_rule', 'completion_condition', 'defeat_rule', 'clear_rule', 'gateRule'];

function walkRule(node, onKind) {
    if (Array.isArray(node)) {
        for (const x of node) walkRule(x, onKind);
    } else if (node && typeof node === 'object') {
        if (typeof node.rule === 'string' && typeof node.type !== 'string') onKind('rb', node.rule);
        else if (typeof node.type === 'string') onKind('ast', node.type);
        for (const x of Object.values(node)) walkRule(x, onKind);
    }
}

function findRoots(node, onKind) {
    if (Array.isArray(node)) {
        for (const x of node) findRoots(x, onKind);
    } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
            if (RULE_ROOT_KEYS.includes(k)) walkRule(v, onKind);
            else findRoots(v, onKind);
        }
    }
}

function rulesFiles(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...rulesFiles(p));
        else if (e.name.endsWith('_rules.json')) out.push(p);
    }
    return out.sort();
}

/** `{ast: Map<kind, Set<preset>>, rb: Map<kind, Set<preset>>, files}` over committed presets. */
export function presetKinds(presetsDir = join(REPO, 'frontend/presets')) {
    const used = { ast: new Map(), rb: new Map() };
    const files = rulesFiles(presetsDir);
    for (const f of files) {
        const preset = relative(presetsDir, f);
        const onKind = (fmt, kind) => {
            if (!used[fmt].has(kind)) used[fmt].set(kind, new Set());
            used[fmt].get(kind).add(preset);
        };
        const doc = JSON.parse(readFileSync(f, 'utf8'));
        for (const [k, v] of Object.entries(doc)) {
            if (k === 'sphere_log') continue;
            if (k === 'helpers' && v && typeof v === 'object') {
                // helpers.<player>.<name>: a rule tree, or a {params, body} function
                for (const fns of Object.values(v)) {
                    for (const fn of Object.values(fns || {})) {
                        const isFunction = fn && typeof fn === 'object' && typeof fn.type !== 'string' && typeof fn.rule !== 'string';
                        walkRule(isFunction ? fn.body : fn, onKind);
                    }
                }
            } else {
                findRoots(v, onKind);
            }
        }
    }
    return { ...used, files: files.length };
}

const sorted = (s) => [...s].sort();

/**
 * Compute the census. Returns:
 *   gaps        {obligation: [kind]}  — what a layer must handle and does not
 *   unregistered [fmt:kind]           — a kind some layer knows that the registry lacks
 *   stale        [fmt:kind]           — a registry kind no layer knows any more
 *   badCapability [fmt:kind]          — a capability outside the registry's list
 */
export async function census({ registry, python, presets } = {}) {
    registry ??= JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
    python ??= JSON.parse(readFileSync(PYTHON_VOCAB_PATH, 'utf8'));
    presets ??= presetKinds();
    const py = Object.fromEntries(Object.entries(python.layers).map(([k, v]) => [k, new Set(v)]));
    const notRule = {
        ast: new Set(Object.keys(registry.not_rule_kinds.ast)),
        rb: new Set(Object.keys(registry.not_rule_kinds.rb)),
    };
    const reg = { ast: new Set(Object.keys(registry.kinds.ast)), rb: new Set(Object.keys(registry.kinds.rb)) };
    const minus = (s, drop) => new Set([...s].filter((x) => !drop.has(x)));

    const jsAst = await jsAstKinds();

    // Rule Builder names in data are kinds when the registry knows them or the engine's switch
    // handles them; every other name is a game helper (the engine's default branch).
    const dataRbNames = [...presets.rb.keys()];
    const dataRbSwitch = await jsRbHandled(dataRbNames);
    const dataRb = new Set(dataRbNames.filter((k) => reg.rb.has(k) || dataRbSwitch.has(k)));
    const dataAst = new Set(presets.ast.keys());

    // PRODUCED kinds: what can reach rules.json.
    const emitsAst = minus(py['exporter.emits_ast'], notRule.ast);
    const producedAst = minus(new Set([...emitsAst, ...dataAst]), notRule.ast);
    // the default export runs AST→RB; an EXPRESSION type with no converter is written as
    // `AST_<type>`. Statements stay AST inside helper bodies (an `AST_block` carries them).
    const statement = (t) => registry.kinds.ast[t]?.statement === true;
    const bridged = new Set([...emitsAst]
        .filter((t) => !py['converter.ast_to_rb.converts'].has(t) && !statement(t)).map((t) => `AST_${t}`));
    const producedRb = minus(new Set([
        ...py['rule_builder.serialises'], ...py['exporter.games_emit_rb'], ...py['exporter.foreign_rb'],
        ...py['converter.ast_to_rb.emits_rb'], ...bridged, ...dataRb,
    ]), notRule.rb);

    const rbSwitch = await jsRbHandled(sorted(producedRb));
    const astOf = (k) => (k.startsWith('AST_') ? k.slice(4) : null);
    // the engine's default branch rebuilds `AST_<t>` (with `_original_ast_type`) as an AST node
    const jsHandlesRb = (k) => rbSwitch.has(k) || (astOf(k) !== null && jsAst.has(astOf(k)));
    // so does the helper-body generator (`_generate_expression` unwraps `AST_<t>` and generates `t`)
    const helperHandlesRb = (k) => py['world_generator.helper_rb'].has(k)
        || (astOf(k) !== null && py['world_generator.helper_ast'].has(astOf(k)));

    const obligations = {
        'js.ast': [producedAst, (t) => jsAst.has(t)],
        'js.rb': [producedRb, jsHandlesRb],
        'world_generator.rb': [producedRb, (k) => py['world_generator.rb'].has(k)],
        'world_generator.rb_map_without_handler': [py['world_generator.rb_map_without_handler'], () => false],
        'helper_codegen.ast': [producedAst, (t) => py['world_generator.helper_ast'].has(t)],
        'helper_codegen.rb': [producedRb, helperHandlesRb],
        'converter.rb_to_ast': [new Set([...producedRb].filter((k) => !k.startsWith('AST_'))),
            (k) => py['converter.rb_to_ast.converts'].has(k)],
    };
    const gaps = {};
    for (const [id, [produced, handles]] of Object.entries(obligations)) {
        gaps[id] = sorted([...produced].filter((k) => !handles(k)));
    }

    // REGISTRATION: every kind any layer knows is in the registry, and nothing else is.
    const AST_LAYERS = ['exporter.emits_ast', 'converter.ast_to_rb.converts', 'rule_builder.parse_ast',
        'world_generator.ast', 'world_generator.helper_ast'];
    const known = { ast: new Set([...jsAst, ...dataAst]), rb: new Set([...dataRb, ...bridged]) };
    for (const [layer, kinds] of Object.entries(py)) {
        const fmt = AST_LAYERS.includes(layer) ? 'ast' : 'rb';
        for (const k of kinds) known[fmt].add(k);
    }
    const unregistered = [];
    const stale = [];
    for (const fmt of ['ast', 'rb']) {
        for (const k of minus(known[fmt], notRule[fmt])) if (!reg[fmt].has(k)) unregistered.push(`${fmt}:${k}`);
        for (const k of reg[fmt]) if (!known[fmt].has(k)) stale.push(`${fmt}:${k}`);
    }
    const capabilities = new Set(Object.keys(registry.capabilities));
    const badCapability = [];
    for (const fmt of ['ast', 'rb']) {
        for (const [k, entry] of Object.entries(registry.kinds[fmt])) {
            if (!capabilities.has(entry.capability)) badCapability.push(`${fmt}:${k}`);
        }
    }
    return {
        gaps, unregistered: unregistered.sort(), stale: stale.sort(), badCapability,
        totalGaps: Object.values(gaps).reduce((n, g) => n + g.length, 0),
        dataAstWithoutHandler: sorted([...dataAst].filter((t) => !notRule.ast.has(t)).filter((t) => !jsAst.has(t)))
            .map((t) => `${t} (${presets.ast.get(t).size} preset files, e.g. ${sorted(presets.ast.get(t))[0]})`),
        counts: { presetFiles: presets.files, producedAst: producedAst.size, producedRb: producedRb.size, jsAst: jsAst.size },
    };
}

/** Differences between computed gaps and the registry's known gaps: [{obligation, kind, change}]. */
export function gapDrift(gaps, knownGaps) {
    const drift = [];
    for (const id of new Set([...Object.keys(gaps), ...Object.keys(knownGaps)])) {
        const now = new Set(gaps[id] || []);
        const known = new Set(knownGaps[id] || []);
        for (const k of now) if (!known.has(k)) drift.push({ obligation: id, kind: k, change: 'NEW gap' });
        for (const k of known) if (!now.has(k)) drift.push({ obligation: id, kind: k, change: 'CLOSED — remove it from known_gaps' });
    }
    return drift;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const result = await census();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(result, null, 1));
    } else {
        const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
        for (const [id, kinds] of Object.entries(result.gaps)) console.log(`${id} (${kinds.length}): ${kinds.join(' ')}`);
        console.log(`total gaps ${result.totalGaps} (ceiling ${registry.gap_ceiling})`);
        for (const d of gapDrift(result.gaps, registry.known_gaps)) console.log(`DRIFT ${d.obligation} ${d.kind}: ${d.change}`);
        if (result.unregistered.length) console.log(`UNREGISTERED: ${result.unregistered.join(' ')}`);
        if (result.stale.length) console.log(`STALE registry entries: ${result.stale.join(' ')}`);
        if (result.badCapability.length) console.log(`BAD capability: ${result.badCapability.join(' ')}`);
        console.log('preset AST kinds with no JS handler:', result.dataAstWithoutHandler.join('; ') || 'none');
        console.log(result.counts);
    }
}

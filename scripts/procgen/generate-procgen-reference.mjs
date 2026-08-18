#!/usr/bin/env node
/**
 * generate-procgen-reference — **THE THREE REFERENCE TABLES, GENERATED FROM THE
 * CODE THEY DESCRIBE** (PROCGEN DOCS · P3a).
 *
 * ⚖ The user, 2026-08-18: the docs that are DATA IN DISGUISE become pages
 * *"that interact with the scripts directly, rather than having to be manually
 * edited"*. P1 did that for the demo catalogue and P2 for the glossary — both
 * by AUTHORING a data module. This slice does it for the three tables nobody
 * should ever author, because the code already knows the answer:
 *
 *   `urlGrammar.js`  the URL parameter grammar of the two lab pages
 *   `catalogue.js`   the generation catalogue — biomes, templates, elements,
 *                    skeleton kinds
 *   `refusals.js`    the refusal vocabulary — every name a run can refuse BY
 *
 * ⛔⛔ **THE RULE OF THE SLICE: a table whose answer the CODE already knows is
 * GENERATED, CHECKED IN, and gated by `--check` = no diff** — the same shape as
 * a recorded md5. The three modules under `frontend/modules/procgenDocs/
 * generated/` are OUTPUT: they are committed so the page (a browser, no build
 * step) can import them, and `--check` regenerates into memory and refuses if
 * what is on disk differs.
 *
 * ⛔ **THE GENERATOR NEVER EDITS THE CODE IT READS.** Where a hand-kept list and
 * the code DISAGREE, this prints the CODE's answer and records the disagreement
 * as a FINDING (`REFUSALS.findings`) — never a fix.
 *
 * ⛔ **AND IT EMITS NO TIMESTAMP.** A stamp would make every regeneration a
 * diff, which would make the `--check` gate unfailable-by-being-always-red.
 * Object keys are SORTED; arrays keep the order their source declares.
 *
 * ── ⛓ WHERE EACH FIELD COMES FROM, AND THE THREE PROVENANCES ──────────
 *
 * Every row carries what produced it, because "the code knows this" is a claim
 * a reader is entitled to check:
 *
 *   `import`  the value IS the imported constant / the reader's own answer,
 *             MEASURED by calling it (e.g. `readGenerateParams('')`).
 *   `scan`    a DECLARED regex over the source of a NAMED region (a top-level
 *             function, a top-level `const`). The region rule is: from the line
 *             that matches the region's opener to the first later line that is
 *             `}` / `)` / `]` (optionally `;`) at COLUMN 0 — every subject here
 *             is top-level, which is what makes that rule exact.
 *   `declared` this file said so. Only three things are: which glossary term a
 *             parameter is, which READER FIELD a parameter's default lands in
 *             (the VALUE is still measured), and which channel surfaces a
 *             refusal. ⛔ Each one is CHECKED — a declared field that does not
 *             resolve, or a scanned parameter with no declaration, is a hard
 *             error here rather than a silently missing row.
 *
 * Run:
 *   node scripts/procgen/generate-procgen-reference.mjs            # write
 *   node scripts/procgen/generate-procgen-reference.mjs --check    # gate
 *   node scripts/procgen/generate-procgen-reference.mjs --out=/tmp/x
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const DEFAULT_OUT = join(REPO, 'frontend/modules/procgenDocs/generated');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const flag = (name) => process.argv.includes(`--${name}`);

const src = (rel) => readFileSync(join(REPO, rel), 'utf8');

/* ══════════════════════════════════════════════════════════════════════
 * THE SCAN — one region rule, three declared patterns
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * The source of ONE top-level region. `opener` is a regex matched against a
 * LINE; the region ends at the first later line that closes at column 0.
 *
 * ⛔ It THROWS when the opener matches nothing: a scan whose subject moved is a
 * scan that would otherwise report an empty set as a finding about the code.
 */
export function regionOf(source, opener, { what = String(opener) } = {}) {
    const lines = source.split('\n');
    const start = lines.findIndex((l) => opener.test(l));
    if (start < 0) throw new Error(`generate-procgen-reference: no region matches ${what}`);
    for (let i = start + 1; i < lines.length; i += 1) {
        if (/^[)}\]];?$/.test(lines[i])) {
            return { text: lines.slice(start, i + 1).join('\n'), fromLine: start + 1, toLine: i + 1 };
        }
    }
    throw new Error(`generate-procgen-reference: region ${what} never closes at column 0`);
}

/** ⛓ THE PARAMETER PATTERNS — every way this tree names a URL key. */
export const PARAM_PATTERNS = Object.freeze([
    Object.freeze({ id: 'get', re: /\bq\.get\('([a-zA-Z]+)'\)/g, mode: 'read' }),
    Object.freeze({ id: 'set', re: /\bq\.set\('([a-zA-Z]+)'/g, mode: 'write' }),
    Object.freeze({ id: 'delete', re: /\bq\.delete\('([a-zA-Z]+)'\)/g, mode: 'delete' }),
    Object.freeze({ id: 'intParam', re: /\bintParam\(q, '([a-zA-Z]+)'/g, mode: 'read' }),
    Object.freeze({ id: 'int', re: /\bint\('([a-zA-Z]+)'/g, mode: 'read' }),
    Object.freeze({ id: 'writeInt', re: /\bwriteInt\(q, '([a-zA-Z]+)'/g, mode: 'write' }),
]);

/**
 * ⛓ THE REFUSAL-NAME PATTERN — every way this tree spells a refusal BY NAME.
 *
 * ⛔ THE TWO TERNARY ARMS ARE IN IT AND THEY WERE NOT IN THE FIRST CUT, which
 * reported `no-pocket` and `pocket-not-legal` as DECLARED-BUT-NEVER-FIRING in
 * `killGate.js`. They fire from `refused: sawCandidate ? 'pocket-not-legal' :
 * 'no-pocket'` — a scan that cannot see a ternary reports a false finding about
 * the code, which is the worst thing this table could do. ⚠ The `:` arm demands
 * WHITESPACE BEFORE THE COLON, which is what separates a ternary's ` : 'x'`
 * from an object property's `key: 'x'` — otherwise every string-valued key in
 * the tree would read as a refusal.
 */
export const REFUSAL_LITERAL_RE = /(?:seen\.add|refused:\s*|reason:\s*|refuse\(|refuseArea\(|\?\?\s*|\?\s*|\s:\s*)\(?'([a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)+)'/g;

/** ⛓ A refusal name COMPOSED into a template literal — a second, narrower
 *  pattern, because `the-certification-solve-exhausted-${kind}` is a name a
 *  reader meets and the single-quote pattern cannot see it. */
export const REFUSAL_TEMPLATE_RE = /(?:return |reason: |no\()`([a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)+)(?=[-:]?\$\{)/g;

/** ⛓ A key of an UNEXPORTED reason table — `KEY: 'the-name'`. */
export const REASON_TABLE_RE = /:\s*'([a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)+)'/g;

function allMatches(text, re) {
    const out = [];
    const r = new RegExp(re.source, re.flags);
    let m = r.exec(text);
    while (m) { out.push(m); m = r.exec(text); }
    return out;
}

/** The parameter names a region touches, by mode. */
function paramsIn(text) {
    const out = new Map();
    for (const p of PARAM_PATTERNS) {
        for (const m of allMatches(text, p.re)) {
            const row = out.get(m[1]) ?? { read: false, write: false, delete: false, how: [] };
            row[p.mode] = true;
            if (!row.how.includes(p.id)) row.how.push(p.id);
            out.set(m[1], row);
        }
    }
    for (const row of out.values()) row.how.sort();
    return out;
}

/**
 * ⛓ THE STRING RUN after an index — a `'a' + 'b'` concatenation or one template
 * literal, read as text. `${…}` placeholders become `…`, because the value is a
 * run-time fact and this table is a static one.
 */
function stringRunAt(text, from) {
    let i = from;
    const parts = [];
    const skip = () => { while (i < text.length && /[\s+]/.test(text[i])) i += 1; };
    skip();
    while (i < text.length && (text[i] === "'" || text[i] === '"' || text[i] === '`')) {
        const quote = text[i];
        i += 1;
        let buf = '';
        let depth = 0;
        while (i < text.length) {
            const c = text[i];
            if (c === '\\') { buf += text[i + 1] === 'n' ? ' ' : text[i + 1]; i += 2; continue; }
            if (quote === '`' && c === '$' && text[i + 1] === '{') { depth += 1; i += 2; buf += '…'; continue; }
            if (depth > 0) {
                if (c === '{') depth += 1;
                else if (c === '}') depth -= 1;
                i += 1;
                continue;
            }
            if (c === quote) { i += 1; break; }
            buf += c;
            i += 1;
        }
        parts.push(buf);
        const before = i;
        skip();
        if (i === before && !/[\s+]/.test(text[before] ?? '')) break;
    }
    return parts.join('').replace(/\s+/g, ' ').trim();
}

/** The `detail:` sentence that belongs to a refusal name matched at `end`. */
function detailAfter(text, end) {
    const window = text.slice(end, end + 400);
    const at = window.indexOf('detail:');
    if (at >= 0 && (window.indexOf('reason:') < 0 || at < window.indexOf('reason:'))) {
        return stringRunAt(text, end + at + 'detail:'.length);
    }
    let i = end;
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (text[i] === "'" || text[i] === '"' || text[i] === '`') return stringRunAt(text, i);
    return null;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE IMPORTS — everything below is the code's own answer
 * ══════════════════════════════════════════════════════════════════════ */

const M = {
    urlParams: await import('../../frontend/modules/procgenCore/urlParams.js'),
    levelGenerator: await import('../../frontend/modules/procgenCore/levelGenerator.js'),
    skeletonKinds: await import('../../frontend/modules/procgenCore/skeletonKinds.js'),
    elementSpec: await import('../../frontend/modules/procgenCore/elementSpec.js'),
    areaSpec: await import('../../frontend/modules/procgenCore/areaSpec.js'),
    killGate: await import('../../frontend/modules/procgenCore/elements/killGate.js'),
    blockPocket: await import('../../frontend/modules/procgenCore/elements/blockPocket.js'),
    palette: await import('../../frontend/modules/seedlingDemo/procgenPalette.js'),
    seedling: await import('../../frontend/modules/seedlingDemo/procgenSeedling.js'),
    seedlingElements: await import('../../frontend/modules/seedlingDemo/procgenSeedlingElements.js'),
    watchGenerate: await import('../../frontend/modules/seedlingDemo/watchGenerate.js'),
    oracle: await import('../../frontend/modules/seedlingDemo/procgenOracle.js'),
    mazeLab: await import('../../frontend/modules/mazeRoom/mazeLab.js'),
    maze: await import('../../frontend/modules/mazeRoom/procgenMaze.js'),
    glossary: await import('../../frontend/modules/procgenDocs/glossary.js'),
};

const SOURCES = {
    urlParams: 'frontend/modules/procgenCore/urlParams.js',
    watchGenerate: 'frontend/modules/seedlingDemo/watchGenerate.js',
    watchViewer: 'frontend/modules/seedlingDemo/watchViewer.js',
    watchSolve: 'frontend/modules/seedlingDemo/watchSolve.js',
    watchManual: 'frontend/modules/seedlingDemo/watchManual.js',
    mazeLab: 'frontend/modules/mazeRoom/mazeLab.js',
    mazeLabView: 'frontend/modules/mazeRoom/mazeLabView.js',
    killGate: 'frontend/modules/procgenCore/elements/killGate.js',
    blockPocket: 'frontend/modules/procgenCore/elements/blockPocket.js',
    seedlingElements: 'frontend/modules/seedlingDemo/procgenSeedlingElements.js',
    seedling: 'frontend/modules/seedlingDemo/procgenSeedling.js',
    elementSpec: 'frontend/modules/procgenCore/elementSpec.js',
    areaGraph: 'frontend/modules/procgenCore/areaGraph.js',
    maze: 'frontend/modules/mazeRoom/procgenMaze.js',
    oracle: 'frontend/modules/seedlingDemo/procgenOracle.js',
    levelGenerator: 'frontend/modules/procgenCore/levelGenerator.js',
};

/* ══════════════════════════════════════════════════════════════════════
 * TABLE 1 — THE URL GRAMMAR
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE SHARED READERS/WRITERS, and which parameter each owns — SCANNED out of
 * `urlParams.js` rather than listed, so a reader that grows a key is a row here
 * without an edit.
 */
function urlParamsFunctions() {
    const text = src(SOURCES.urlParams);
    const out = {};
    for (const m of allMatches(text, /^export function ([a-zA-Z]+)\(/gm)) {
        const region = regionOf(text, new RegExp(`^export function ${m[1]}\\(`), { what: m[1] });
        out[m[1]] = { params: paramsIn(region.text), fromLine: region.fromLine, body: region.text };
    }
    /**
     * ⛓⛓⛓ **A PROJECTION OWNS WHAT THE FUNCTION IT PROJECTS OWNS** — and this
     * was FOUND BY READING THE RENDER, which is the only way it could have been.
     * `readSkeleton` is one line: `return readSkeletonTyped(q, …).spec`, and
     * `q.get('skeleton')` happens ONCE, in the typed reader. So a per-body scan
     * gave `readSkeleton` no parameters at all, and the maze lab's `?skeleton=`
     * row rendered with a WRITER and no READER — a table that said the page
     * never reads a key it reads on every load. `readElements` / `readRequire`
     * are the same shape.
     *
     * ⛔ Propagated to a FIXED POINT rather than one level: a second projection
     * of a projection would otherwise be the same defect one call deeper.
     */
    const names = Object.keys(out);
    let changed = true;
    while (changed) {
        changed = false;
        for (const fn of names) {
            for (const other of names) {
                if (other === fn) continue;
                if (!new RegExp(`\\b${other}\\(`).test(out[fn].body)) continue;
                for (const [name, how] of out[other].params) {
                    if (out[fn].params.has(name)) continue;
                    out[fn].params.set(name, how);
                    changed = true;
                }
            }
        }
    }
    for (const fn of names) delete out[fn].body;
    return out;
}

const URLPARAMS_FNS = urlParamsFunctions();

/**
 * ⛓ THE PAGES. Each names its reader/writer REGIONS; every parameter below is
 * scanned out of one of them, or out of a shared `urlParams` function one of
 * them CALLS.
 */
const PAGE_REGIONS = [
    {
        id: 'watch',
        page: '/frontend/modules/seedlingDemo/watch.html',
        title: 'The Seedling watch page',
        blurb: 'The real recompiled game, its bot, and the GENERATE arm that builds levels for '
            + 'it. Four readers share the bar: the generate arm\'s, the viewer\'s own, the '
            + 'SOLVE arm\'s and the VIEW parameters.',
        regions: [
            { file: 'watchGenerate', fn: 'readGenerateParams', role: 'read' },
            { file: 'watchGenerate', fn: 'writeGenerateParams', role: 'write' },
            { file: 'watchViewer', fn: 'readParams', role: 'read' },
            { file: 'watchSolve', fn: 'readSolveParams', role: 'read' },
            { file: 'watchManual', fn: 'readViewParams', role: 'read' },
        ],
    },
    {
        id: 'lab',
        page: '/frontend/modules/mazeRoom/lab.html',
        title: 'The maze lab page',
        blurb: 'The grid-of-tiles substrate and the same loop core, with an exact BFS solver — '
            + 'one reader and one writer for the whole bar.',
        regions: [
            { file: 'mazeLab', fn: 'readLabParams', role: 'read' },
            { file: 'mazeLab', fn: 'writeLabParams', role: 'write' },
        ],
    },
];

/**
 * ⛓⛓ **THE ONLY DECLARED HALF OF TABLE 1**, and each entry is CHECKED.
 *
 *   `field`  where this parameter's value lands in the READER's answer. The
 *            path is declared; the VALUE is read out of the reader's own output
 *            on an EMPTY search, so a default that changes changes the table.
 *            ⛔ A path that does not resolve is a hard error.
 *   `terms`  the glossary slugs (`procgenDocs/glossary.js`) that define this
 *            parameter. `[]` is a parameter the glossary does not define, and
 *            the page SAYS SO rather than leaving the line blank.
 *   `codec`  which value grammar reads the string.
 */
const PARAM_NOTES = {
    source: { field: { watch: 'source', lab: 'source' }, codec: 'a lower-cased enum', terms: ['lab-page'] },
    seed: { field: { watch: 'seed', lab: 'seed' }, codec: 'intParam', terms: ['seed', 'rng-stream'] },
    biome: { field: { watch: 'biome', lab: 'biome' }, codec: 'a lower-cased name', terms: ['biome', 'palette'] },
    count: { field: { watch: 'bounds.obstacleTarget', lab: 'bounds.obstacleTarget' }, codec: 'intParam', terms: ['obstacle-target', 'keep-or-revert'] },
    tries: { field: { watch: 'bounds.triesPerStep', lab: 'bounds.triesPerStep' }, codec: 'intParam', terms: ['keep-or-revert'] },
    k: { field: { watch: 'bounds.saturationK', lab: 'bounds.saturationK' }, codec: 'intParam', terms: ['saturation'] },
    anchortries: { field: { watch: 'bounds.anchorTriesPerCandidate', lab: 'bounds.anchorTriesPerCandidate' }, codec: 'intParam', terms: ['anchor', 'anchor-search'] },
    families: { field: { watch: 'roster', lab: 'roster' }, codec: 'a comma list, validated against the palette', terms: ['family', 'roster', 'restrict'] },
    templates: { field: { watch: 'roster', lab: 'roster' }, codec: 'a comma list, validated against the palette', terms: ['template', 'roster', 'restrict'] },
    skeleton: { field: { watch: 'skeleton', lab: 'skeleton' }, codec: 'parseSkeleton', terms: ['skeleton', 'skeleton-kind', 'the-carve'] },
    elements: {
        field: { watch: 'elements', lab: 'elements' },
        codec: 'parseElementSpec',
        terms: ['element', 'element-head', 'draw'],
        absentMeans: {
            watch: '⛔ ABSENT IS NOT `none` HERE. The reader answers `undefined` — *nobody '
                + 'said* — and `seedlingSeam` turns that into the BIOME DEFAULT (see '
                + '`catalogue.js` → the biome\'s `defaultElements`). An explicit '
                + '`?elements=none` is a CHOICE that turns the default OFF, so the writer '
                + 'SPELLS it where the maze deletes it (`deleteAt: null`).',
            lab: 'Absent ≡ `{name: \'none\'}` ≡ the element machinery does not run at all: no '
                + 'site drawn, nothing constructed, no draw spent (⚖ arc-2 ruling 5).',
        },
    },
    areas: { field: { watch: 'areas', lab: 'areas' }, codec: 'parseAreaSpec', terms: ['area-graph', 'area-partition', 'key-level'] },
    require: { field: { watch: 'require', lab: 'require' }, codec: 'parseRequireList / parseItemRequireList', terms: ['require-directive', 'symbol', 'flag'] },
    run: { field: { watch: 'run', lab: 'run' }, codec: 'the literal `1`', terms: ['generation-ladder'] },
    gen: { field: { watch: 'gen', lab: 'gen' }, codec: 'a path to a payload JSON', terms: ['payload'] },
    tickbudget: { field: { watch: 'budget.maxTicksPerTarget', lab: null }, codec: 'intParam', terms: ['tick-budget', 'solver'] },
    expansions: { field: { watch: null, lab: 'budget.maxExpansions' }, codec: 'intParam', terms: ['bfs-oracle', 'certification'] },
    width: { field: { watch: null, lab: 'width' }, codec: 'intParam', terms: ['skeleton'] },
    height: { field: { watch: null, lab: 'height' }, codec: 'intParam', terms: ['skeleton'] },
    tape: { field: { watch: 'tape', lab: null }, codec: 'a path to a tape JSON', terms: ['tape'] },
    side: { field: { watch: 'side', lab: null }, codec: 'a lower-cased enum', terms: ['seedling-differential'] },
    speed: { field: { watch: 'speed', lab: null }, codec: 'Number()', terms: [] },
    layers: { field: { watch: 'layers', lab: null }, codec: 'parseLayersParam (a comma list)', terms: ['overlay-layer'] },
    attackhold: { field: { watch: 'attackHold', lab: null }, codec: 'parseAttackHold', terms: [] },
    level: { field: { watch: 'level', lab: null }, codec: 'Number()', terms: [] },
    boot: { field: { watch: 'boot', lab: null }, codec: 'a JSON boot block', terms: ['boot-items'] },
    goals: { field: { watch: 'goals', lab: null }, codec: 'a goal list', terms: ['solver'] },
    name: { field: { watch: 'name', lab: null }, codec: 'a string', terms: [] },
    solve: { field: { watch: 'solve', lab: null }, codec: 'the literal `1`', terms: ['solver'] },
    tick: { field: { watch: 'tick', lab: null }, codec: 'readViewParams (a whole tick index)', terms: [] },
    shot: { field: { watch: 'shot', lab: null }, codec: 'the literal `1`', terms: [] },
    directed: { field: { watch: null, lab: null }, codec: 'RETIRED — refuses by name', terms: ['directive', 'directed-attempt'] },
    budgetms: { field: { watch: null, lab: null }, codec: 'RETIRED — warns and is ignored', terms: [] },
};

/**
 * ⛓ A declared path, walked with PRESENCE tracked separately from VALUE. ⛔ The
 * two are different facts and the table needs both: `?elements=` on the Seedling
 * page resolves to `undefined` ON PURPOSE (*nobody said*), and a walk that
 * reported that as "the path does not resolve" would have deleted the one row
 * whose absence is the whole feature.
 */
function digPath(o, path) {
    let v = o;
    for (const k of String(path).split('.')) {
        if (v === null || typeof v !== 'object' || !(k in v)) return { found: false };
        v = v[k];
    }
    return { found: true, value: v };
}

/** ⛓ The reader's OWN answer on an empty search — every default, measured. */
const DEFAULTS_ON_EMPTY = {
    watch: {
        ...M.watchGenerate.readGenerateParams(''),
        ...(await import('../../frontend/modules/seedlingDemo/watchSolve.js')).readSolveParams(''),
        ...(await import('../../frontend/modules/seedlingDemo/watchManual.js')).readViewParams(''),
        tape: null,
        side: 'js',
        speed: 1,
        layers: null,
        attackHold: null,
    },
    lab: M.mazeLab.readLabParams(''),
};

/** ⛓ What the WRITER emits for a page sitting at its own defaults — the
 *  measurement behind "absent is the default, and the default is not written". */
const WRITTEN_AT_DEFAULTS = {
    watch: M.watchGenerate.writeGenerateParams('', {
        seed: 1,
        biome: 'pre-sword',
        bounds: M.levelGenerator.DEFAULT_BOUNDS,
        step: 0,
    }),
    lab: M.mazeLab.writeLabParams('', {
        seed: 1,
        biome: 'maze-v1',
        width: 11,
        height: 11,
        bounds: M.levelGenerator.DEFAULT_BOUNDS,
        budget: { maxExpansions: 20000 },
        step: 0,
    }),
};

/** ⛓ A refusal text MEASURED by running the refusal, never retyped. */
function refusalTextOf(run) {
    try { run(); } catch (e) { return String(e.message).replace(/\s+/g, ' ').trim(); }
    return null;
}

/** ⛓ The keys a page's reader still SEES but no longer honours — marked on the
 *  parameter row so a reader meets the retirement where they look the key up. */
const RETIRED_NAMES = new Set(['directed', 'budgetms']);

function buildUrlGrammar() {
    const pages = [];
    const unknown = [];
    for (const spec of PAGE_REGIONS) {
        const rows = new Map();
        const regionRows = [];
        for (const r of spec.regions) {
            const text = src(SOURCES[r.file]);
            const region = regionOf(text, new RegExp(`^(?:export )?(?:async )?function ${r.fn}\\(`),
                { what: `${r.file}.${r.fn}` });
            regionRows.push({
                fn: r.fn, file: SOURCES[r.file], role: r.role, line: region.fromLine,
            });
            /* the region's OWN keys */
            for (const [name, how] of paramsIn(region.text)) {
                const row = rows.get(name) ?? { name, via: [] };
                row.via.push({ fn: r.fn, file: SOURCES[r.file], role: r.role, how: how.how.join('+') });
                if (how.write) row.written = true;
                if (how.delete) row.deleted = true;
                rows.set(name, row);
            }
            /* …and the keys of every shared `urlParams` function it CALLS */
            for (const fn of Object.keys(URLPARAMS_FNS)) {
                if (!new RegExp(`\\b${fn}\\(`).test(region.text)) continue;
                for (const [name, how] of URLPARAMS_FNS[fn].params) {
                    const row = rows.get(name) ?? { name, via: [] };
                    row.via.push({
                        fn: `${r.fn} → urlParams.${fn}`, file: SOURCES.urlParams,
                        role: r.role, how: how.how.join('+'),
                    });
                    if (how.write) row.written = true;
                    if (how.delete) row.deleted = true;
                    rows.set(name, row);
                }
            }
        }
        const written = new Set([...new URLSearchParams(WRITTEN_AT_DEFAULTS[spec.id]).keys()]);
        const params = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)).map((row) => {
            const note = PARAM_NOTES[row.name];
            if (!note) { unknown.push(`${spec.id}: ?${row.name}= is scanned but PARAM_NOTES has no row`); }
            const field = note?.field?.[spec.id] ?? null;
            let value = null;
            let isUndefined = false;
            if (field) {
                const hit = digPath(DEFAULTS_ON_EMPTY[spec.id], field);
                if (!hit.found) {
                    throw new Error(`generate-procgen-reference: PARAM_NOTES.${row.name}.field.`
                        + `${spec.id} = ${JSON.stringify(field)} does not resolve in the `
                        + 'reader\'s own answer on an empty search');
                }
                isUndefined = hit.value === undefined;
                value = isUndefined ? null : hit.value;
            }
            for (const t of note?.terms ?? []) {
                if (!M.glossary.termById(t)) {
                    throw new Error(`generate-procgen-reference: PARAM_NOTES.${row.name}.terms `
                        + `names ${JSON.stringify(t)}, which the GLOSSARY does not define. ⛔ A `
                        + 'dead slug would render as a link a reader cannot follow — say a real '
                        + 'term or say none, and the page names the parameters that have none.');
                }
            }
            return {
                name: row.name,
                defaultField: field,
                defaultValue: value,
                defaultIsUndefined: isUndefined,
                absentMeans: note?.absentMeans?.[spec.id] ?? null,
                retired: RETIRED_NAMES.has(row.name),
                atDefault: row.written === true
                    ? (written.has(row.name) ? 'written at the default' : 'DELETED at the default')
                    : 'not written by this page',
                codec: note?.codec ?? null,
                terms: [...(note?.terms ?? [])].sort(),
                via: row.via.sort((a, b) => `${a.role}${a.fn}`.localeCompare(`${b.role}${b.fn}`)),
            };
        });
        pages.push({
            id: spec.id,
            page: spec.page,
            title: spec.title,
            blurb: spec.blurb,
            readers: regionRows.filter((r) => r.role === 'read'),
            writers: regionRows.filter((r) => r.role === 'write'),
            defaultsOnEmpty: JSON.parse(JSON.stringify(DEFAULTS_ON_EMPTY[spec.id])),
            writtenAtDefaults: WRITTEN_AT_DEFAULTS[spec.id],
            params,
        });
    }
    if (unknown.length) {
        throw new Error(`generate-procgen-reference: ${unknown.join('; ')}. ⛔ A scanned `
            + 'parameter with no declaration would ship a row with no default, no codec and '
            + 'no term — declare it in PARAM_NOTES.');
    }

    /* ⛓ THE RETIRED PARAMETERS — their refusals RUN, never retyped. */
    const palette = M.maze.MAZE_PALETTE;
    const retired = [
        {
            name: 'directed',
            what: 'the DIRECTIVE LIST',
            retiredBy: 'constructive-mode slice 12 (⚖ kickoff §3.9)',
            wayIn: M.urlParams.DIRECTED_RETIRED,
            refusals: [
                {
                    page: 'watch',
                    text: refusalTextOf(() => M.urlParams.refuseDirectedParam(
                        new URLSearchParams('directed=x'), { substrate: 'the Seedling page' })),
                },
                {
                    page: 'lab',
                    text: refusalTextOf(() => M.urlParams.refuseDirectedParam(
                        new URLSearchParams('directed=x'), { substrate: 'the maze lab page' })),
                },
            ],
        },
        {
            name: 'the `d|s` keep-policy letter on a directive bound',
            what: 'the KEEP POLICY of one directed attempt',
            retiredBy: 'PROCGEN ELEMENTS arc 3, slice 4c (⚖ user, 2026-08-17)',
            wayIn: `every directive runs under ${JSON.stringify(M.urlParams.DIRECTIVE_KEEP_POLICY)}`,
            refusals: [
                {
                    page: 'both (the `--directed=` grammar)',
                    text: refusalTextOf(() => M.urlParams.parseDirective('wall-segment@12d', palette)),
                },
            ],
        },
        {
            name: 'budgetms',
            what: 'a WALL-CLOCK budget per solve',
            retiredBy: '2026-08-14 — elapsed time no longer classifies a solve',
            wayIn: 'use ?tickbudget=',
            refusals: [{
                page: 'watch',
                text: 'watchGenerate: ?budgetms is GONE and was IGNORED. Elapsed time no longer '
                    + 'classifies a solve — it is not a property of the candidate. Use '
                    + '?tickbudget= instead. (⚠ a WARNING on the console, not a refusal — a '
                    + 'stale bookmark must not hard-fail a page.)',
            }],
        },
    ];

    /* ⛓ THE CODECS — declared by NAME, and every name is checked to EXIST. */
    const codecs = [
        { id: 'intParam', module: 'procgenCore/urlParams.js', functions: ['intParam', 'writeInt'], mod: M.urlParams },
        { id: 'parseSkeleton', module: 'procgenCore/skeletonKinds.js', functions: ['parseSkeleton', 'formatSkeleton', 'normalizeSkeleton'], mod: M.skeletonKinds },
        { id: 'areaSpec', module: 'procgenCore/areaSpec.js', functions: ['parseAreaSpec', 'formatAreaSpec', 'parseRequireList', 'formatRequireList'], mod: M.areaSpec },
        { id: 'elementSpec', module: 'procgenCore/elementSpec.js', functions: ['parseElementSpec', 'formatElementSpec', 'parseItemRequireList'], mod: M.elementSpec },
    ].map((c) => {
        for (const fn of c.functions) {
            if (typeof c.mod[fn] !== 'function') {
                throw new Error(`generate-procgen-reference: codec ${c.id} names ${fn}, which `
                    + `${c.module} does not export`);
            }
        }
        return { id: c.id, module: c.module, functions: c.functions };
    });

    return {
        pages,
        retired,
        codecs,
        sharedReaders: Object.keys(URLPARAMS_FNS).sort().map((fn) => ({
            fn,
            file: SOURCES.urlParams,
            line: URLPARAMS_FNS[fn].fromLine,
            params: [...URLPARAMS_FNS[fn].params.keys()].sort(),
        })),
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * TABLE 2 — THE GENERATION CATALOGUE
 * ══════════════════════════════════════════════════════════════════════ */

const paramRow = (p) => ({
    key: p.key,
    domain: [...p.domain],
    default: p.default,
    why: p.why ?? null,
});

const templateRow = (t) => ({
    name: t.name,
    family: t.family,
    site: t.site ?? null,
    why: t.why ?? null,
    params: (t.params ?? []).map(paramRow),
});

const excludedRow = (t) => ({
    name: t.name,
    family: t.family,
    cause: t.cause,
    measured: t.measured,
    wouldNeed: t.wouldNeed,
    hasRefusalText: Boolean(t.refusalText),
});

function skeletonRows(substrate) {
    const simulator = substrate === 'maze';
    return M.skeletonKinds.skeletonCatalogue({ simulator }).map((k) => {
        const codecDefaults = M.skeletonKinds.resolveSkeletonParams(k.kind, {});
        const effective = simulator
            ? codecDefaults
            : (M.seedling.seedlingSkeletonSpec({ kind: k.kind }).params ?? {});
        return {
            kind: k.kind,
            name: k.name,
            description: k.description,
            backend: k.backend,
            postProcessors: [...k.postProcessors],
            isDefault: k.isDefault,
            offered: k.offered,
            needs: k.why,
            params: (k.params ?? []).map(paramRow),
            codecDefaults: { ...codecDefaults },
            effectiveDefaults: { ...codecDefaults, ...effective },
            spelledExplicitlyInTheUrl: simulator
                ? [] : [...M.seedling.seedlingExplicitSkeletonParams(k.kind)],
        };
    });
}

function buildCatalogue() {
    const { PRE_SWORD_PALETTE, POST_SWORD_PALETTE, EXCLUDED_TEMPLATES,
        POST_SWORD_EXCLUDED_TEMPLATES } = M.palette;

    const biomes = [
        {
            id: 'pre-sword',
            substrate: 'seedling',
            page: '/frontend/modules/seedlingDemo/watch.html',
            items: { ...PRE_SWORD_PALETTE.items },
            templates: PRE_SWORD_PALETTE.templates.map(templateRow),
            excluded: EXCLUDED_TEMPLATES.map(excludedRow),
            defaultElements: M.elementSpec.formatElementSpec(
                M.seedling.defaultElementsFor(PRE_SWORD_PALETTE.items),
            ),
            skeletonKinds: skeletonRows('seedling'),
        },
        {
            id: 'post-sword',
            substrate: 'seedling',
            page: '/frontend/modules/seedlingDemo/watch.html',
            items: { ...POST_SWORD_PALETTE.items },
            templates: POST_SWORD_PALETTE.templates.map(templateRow),
            excluded: [...EXCLUDED_TEMPLATES, ...POST_SWORD_EXCLUDED_TEMPLATES].map(excludedRow),
            defaultElements: M.elementSpec.formatElementSpec(
                M.seedling.defaultElementsFor(POST_SWORD_PALETTE.items),
            ),
            skeletonKinds: skeletonRows('seedling'),
        },
        {
            id: 'maze-v1',
            substrate: 'maze',
            page: '/frontend/modules/mazeRoom/lab.html',
            items: M.maze.MAZE_PALETTE.items,
            templates: M.maze.MAZE_PALETTE.templates.map(templateRow),
            excluded: [],
            defaultElements: M.elementSpec.formatElementSpec(M.elementSpec.DEFAULT_ELEMENTS),
            skeletonKinds: skeletonRows('maze'),
        },
    ];

    const elements = Object.entries(M.elementSpec.ELEMENT_TABLE).map(([head, entry]) => ({
        head,
        why: entry.why,
        needs: [...(entry.needs ?? [])],
        module: entry.element?.name ?? null,
        params: M.elementSpec.paramSchemaFor(head).map(paramRow),
    }));

    return {
        biomes,
        elements,
        elementNames: [...M.elementSpec.ELEMENT_NAMES],
        elementListSeparator: '+',
        itemsElementsNeed: [...M.elementSpec.ITEMS_ELEMENTS_NEED],
        killLockTemplates: {
            count: M.palette.POST_SWORD_TEMPLATES.length - M.palette.PRE_SWORD_TEMPLATES.length,
            note: 'The post-sword-EXCLUSIVE roster. It is EMPTY by design since arc 3 slice 4c '
                + 'retired `wall-gap-spinner-killlock`: the room-aware `killgate` ELEMENT does '
                + 'its job, gated by `needs: [\'hasSword\']` in ELEMENT_TABLE. The array stays '
                + 'so POST_SWORD_TEMPLATES is a superset BY CONSTRUCTION.',
        },
        bounds: { ...M.levelGenerator.DEFAULT_BOUNDS },
        vocabulary: {
            keepPolicy: { ...M.levelGenerator.KEEP_POLICY },
            keptKind: { ...M.levelGenerator.KEPT_KIND },
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * TABLE 3 — THE REFUSAL VOCABULARY
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ THE SOURCES. `kind: 'constant'` is IMPORTED and then SCANNED for
 * coverage — the scan is the non-vacuity witness for the constant, and a name
 * the scan finds that the constant lacks is a FINDING, never an edit.
 * `kind: 'literal-scan'` has no constant at all, and saying which is which is
 * half of what this table is for.
 */
const REFUSAL_SOURCES = [
    {
        id: 'kill-gate',
        title: 'The KILL GATE element',
        kind: 'constant',
        constant: 'KILL_GATE_REFUSALS',
        names: M.killGate.KILL_GATE_REFUSALS,
        file: SOURCES.killGate,
        channel: 'the element\'s `{refused:{reason, detail}}` → `summary.elementInfo.refused` '
            + 'on both pages, and the ELEMENTS CENSUS counts them',
    },
    {
        id: 'block-pocket',
        title: 'The BLOCK POCKET element',
        kind: 'constant',
        constant: 'BLOCK_POCKET_REFUSALS',
        names: M.blockPocket.BLOCK_POCKET_REFUSALS,
        file: SOURCES.blockPocket,
        channel: 'the element\'s `{refused:{reason, detail}}` → `summary.elementInfo.refused` '
            + 'on both pages, and the ELEMENTS CENSUS counts them',
    },
    {
        id: 'seedling-element-binding',
        title: 'The SEEDLING element binding',
        kind: 'constant',
        constant: 'SEEDLING_ELEMENT_REFUSALS',
        names: M.seedlingElements.SEEDLING_ELEMENT_REFUSALS,
        file: SOURCES.seedlingElements,
        channel: '`summary.elementInfo.refused` on `watch.html`; '
            + '`generate-seedling-level.mjs --json` `elementInfo.refused`',
    },
    {
        id: 'require-directive',
        title: 'The `?require=` directive (the ITEM vocabulary)',
        kind: 'literal-scan',
        file: SOURCES.elementSpec,
        region: /^export function resolveRequireDirective\(/,
        regionName: 'elementSpec.resolveRequireDirective',
        channel: '`summary.require.refused` on `watch.html`; the CLI exits 6',
    },
    {
        id: 'maze-require-directive',
        title: 'The `?require=` directive (the AREA-GRAPH SYMBOL vocabulary)',
        kind: 'literal-scan',
        file: SOURCES.maze,
        region: /^export function requireOutcome\(/,
        regionName: 'procgenMaze.requireOutcome',
        channel: '`summary.require.refused` on `lab.html`; `generate-maze-level.mjs` exits 6',
    },
    {
        id: 'area-graph',
        title: 'The AREA GRAPH itself',
        kind: 'literal-scan',
        file: SOURCES.areaGraph,
        region: /^const REASONS = Object\.freeze\(\{/,
        regionName: 'areaGraph.REASONS (an UNEXPORTED constant)',
        pattern: REASON_TABLE_RE,
        channel: '`buildAreaGraph(...).refused.reason` → `summary.areaGraph.refused` on both pages',
    },
    {
        id: 'seedling-area-binding',
        title: 'The SEEDLING area binding',
        kind: 'literal-scan',
        file: SOURCES.seedling,
        regionName: 'procgenSeedling.js (the whole module)',
        channel: '`summary.areas.refused` / `summary.elementInfo.refused` on `watch.html`',
    },
    {
        id: 'maze-area-binding',
        title: 'The MAZE area + element binding',
        kind: 'literal-scan',
        file: SOURCES.maze,
        regionName: 'procgenMaze.js (the whole module)',
        channel: '`summary.areas.refused` / `summary.elementInfo.refused` on `lab.html`',
    },
    {
        id: 'oracle-budget',
        title: 'Which BUDGET a thrown solve exhausted',
        kind: 'literal-scan',
        file: SOURCES.oracle,
        region: /^export function budgetKindFor\(/,
        regionName: 'procgenOracle.budgetKindFor',
        /** ⛓ TWO patterns, because this function answers in TWO SHAPES: a bare
         *  slug and a composed sentence with the bound's own number in it. A
         *  single slug pattern captured `strike-schedule` — a PREFIX of a value
         *  nothing ever carries — and missed the other one entirely. */
        patterns: [REFUSAL_LITERAL_RE, /return `([^`]*)`/g],
        channel: '`trace[].budgetKind`, and it is part of the determinism payload\'s sha',
    },
];

/** ⛓ The loop core's OUTCOME/STOP/VERDICT vocabulary — enums, not refusals, and
 *  the table says which is which because a reader meets them in the same
 *  readouts. */
const OUTCOME_ENUMS = [
    { id: 'VERDICT', title: 'What the ORACLE answered about a level', values: M.levelGenerator.VERDICT, channel: '`trace[].verdict`, the page\'s certification line' },
    { id: 'ATTEMPT', title: 'What ONE pass-2 attempt did', values: M.levelGenerator.ATTEMPT, channel: '`trace[].outcome`, the attempt pane' },
    { id: 'KEEP_POLICY', title: 'What an anchor walk ACCEPTS', values: M.levelGenerator.KEEP_POLICY, channel: 'a directive\'s `keepPolicy`' },
    { id: 'KEPT_KIND', title: 'Which KIND of keep it was', values: M.levelGenerator.KEPT_KIND, channel: '`trace[].keptKind` — `null` when the policy did not ask' },
    { id: 'STOP', title: 'Why the LOOP stopped', values: M.levelGenerator.STOP, channel: '`summary.stop`' },
];

function buildRefusals() {
    const rows = [];
    const findings = [];
    const sources = [];

    /* ⛓ EVERY SOURCE IS SCANNED FIRST, so a finding can say where else a name
     * fires. "Declared here, raised one module over" and "declared here, raised
     * nowhere at all" are two very different facts about a list. */
    const scans = REFUSAL_SOURCES.map((s) => {
        const text = src(s.file);
        const region = s.region
            ? regionOf(text, s.region, { what: s.regionName })
            : { text, fromLine: 1 };
        const patterns = s.patterns ?? [s.pattern ?? REFUSAL_LITERAL_RE];
        const scanned = new Map();
        /** ⛔ THE LONGEST DETAIL WINS, not the first. A name is often raised
         *  twice — once with a terse LEDGER detail (`(3,4), area 2, key level 1`)
         *  and once with the sentence a reader is meant to act on. Taking the
         *  first would have published the terse one for
         *  `a-lock-on-the-goals-doorstep`, measured. */
        for (const pattern of patterns) {
            for (const m of allMatches(region.text, pattern)) {
                /** ⛓ A name COMPOSED at run time keeps its shape with the
                 *  run-time half elided — `strike-schedule bound (… driven
                 *  ticks)` is what a trace carries, and a slug that dropped the
                 *  tail would name nothing. */
                const name = m[1].replace(/\$\{[^}]*\}/g, '…').trim();
                const detail = detailAfter(region.text, m.index + m[0].length);
                const have = scanned.get(name);
                if (!scanned.has(name) || (detail?.length ?? 0) > (have?.length ?? 0)) {
                    scanned.set(name, detail ?? have ?? null);
                }
            }
        }
        for (const m of allMatches(region.text, REFUSAL_TEMPLATE_RE)) {
            if (!scanned.has(m[1])) scanned.set(m[1], null);
        }
        return { s, patterns, scanned, declared: s.names ? [...s.names] : null };
    });
    const firesIn = (name, exceptId) => scans
        .filter((x) => x.s.id !== exceptId && x.scanned.has(name)).map((x) => x.s.id);

    for (const { s, patterns, scanned, declared } of scans) {
        if (declared) {
            for (const name of [...scanned.keys()]) {
                if (!declared.includes(name)) {
                    findings.push({
                        source: s.id,
                        name,
                        severity: 'the list is INCOMPLETE',
                        what: `\`${name}\` FIRES in ${s.file} but is not in \`${s.constant}\`, `
                            + 'whose own docblock says it names *every* refusal this can '
                            + 'produce — so a census keyed on the constant cannot count it. '
                            + '⛔ Reported, not fixed: the generator never edits the code it '
                            + 'reads.',
                    });
                }
            }
            for (const name of declared) {
                if (scanned.has(name)) continue;
                const elsewhere = firesIn(name, s.id);
                findings.push({
                    source: s.id,
                    name,
                    severity: elsewhere.length ? 'the list reaches ACROSS a module' : 'unreached',
                    what: elsewhere.length
                        ? `\`${name}\` is declared in \`${s.constant}\` and the declared scan `
                            + `of ${s.file} does not find it firing there — it is raised in `
                            + `[${elsewhere.join(', ')}] instead. The list is a CENSUS KEY `
                            + 'rather than a description of one module, which is worth saying '
                            + 'out loud.'
                        : `\`${name}\` is declared in \`${s.constant}\` and the declared scan `
                            + 'finds it firing NOWHERE — it is raised by a helper this scan '
                            + 'does not cover, or it is dead.',
                });
            }
        }
        const names = declared
            ? [...new Set([...declared, ...scanned.keys()])].sort()
            : [...scanned.keys()].sort();
        for (const name of names) {
            rows.push({
                name,
                source: s.id,
                sourceTitle: s.title,
                file: s.file,
                where: s.regionName ?? `${s.file} — \`${s.constant}\``,
                kind: s.kind,
                constant: s.constant ?? null,
                inTheConstant: declared ? declared.includes(name) : null,
                scanFound: scanned.has(name),
                alsoFiresIn: firesIn(name, s.id),
                meaning: scanned.get(name) ?? null,
                channel: s.channel,
                named: true,
            });
        }
        sources.push({
            id: s.id,
            title: s.title,
            kind: s.kind,
            file: s.file,
            where: s.regionName ?? `${s.file} — \`${s.constant}\``,
            constant: s.constant ?? null,
            channel: s.channel,
            declaredCount: declared ? declared.length : null,
            scannedCount: scanned.size,
            patterns: patterns.map(String),
        });
    }

    /* ⛓⛓ THE UNNAMED HALF — `urlParams` refuses in SENTENCES, not in names, so
     * a row here is addressed by its enclosing function rather than by a slug.
     * ⛔ No name is invented for one: the address is a fact, a name would not
     * be. That every one of them is unnamed is itself the finding. */
    const urlText = src(SOURCES.urlParams);
    const unnamed = [];
    for (const m of allMatches(urlText, /^export function ([a-zA-Z]+)\(/gm)) {
        const region = regionOf(urlText, new RegExp(`^export function ${m[1]}\\(`), { what: m[1] });
        const fails = allMatches(region.text, /\bfail\(/g);
        fails.forEach((f, i) => {
            const text = stringRunAt(region.text, f.index + f[0].length);
            if (!text) return;
            unnamed.push({
                name: `urlParams.${m[1]}${fails.length > 1 ? ` #${i + 1}` : ''}`,
                source: 'url-params',
                sourceTitle: 'The URL grammar itself',
                file: SOURCES.urlParams,
                where: `urlParams.${m[1]}`,
                kind: 'literal-scan',
                constant: null,
                inTheConstant: null,
                scanFound: true,
                alsoFiresIn: [],
                meaning: text,
                channel: 'a `UrlParamsError` thrown at READ time — the page\'s fatal line, '
                    + 'and the CLI\'s stderr',
                named: false,
            });
        });
    }
    sources.push({
        id: 'url-params',
        title: 'The URL grammar itself',
        kind: 'literal-scan',
        file: SOURCES.urlParams,
        where: 'every `export function` in urlParams.js',
        constant: null,
        channel: 'a `UrlParamsError` thrown at READ time',
        declaredCount: null,
        scannedCount: unnamed.length,
        patterns: ['/\\bfail\\(/g + the string run after it'],
    });
    if (unnamed.length) {
        findings.push({
            source: 'url-params',
            name: '(the whole source)',
            severity: 'the vocabulary is UNNAMED',
            what: `${unnamed.length} refusals in \`urlParams.js\` are SENTENCES with no name. `
                + 'Every other refusal in this table is addressable by a slug a census can '
                + 'count; these can only be addressed by their function. ⇒ **wants a '
                + 'constant.**',
        });
    }

    return {
        rows: [...rows, ...unnamed].sort((a, b) => a.name.localeCompare(b.name)),
        sources: sources.sort((a, b) => a.id.localeCompare(b.id)),
        enums: OUTCOME_ENUMS.map((e) => ({
            id: e.id,
            title: e.title,
            file: SOURCES.levelGenerator,
            channel: e.channel,
            values: Object.entries(e.values).map(([k, v]) => ({ key: k, value: v })),
        })),
        findings,
        patterns: {
            literal: String(REFUSAL_LITERAL_RE),
            template: String(REFUSAL_TEMPLATE_RE),
            reasonTable: String(REASON_TABLE_RE),
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE EMIT — deterministic, no timestamp
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛔ SORTED OBJECT KEYS; array order is the source's. */
function stableJson(value, indent = 0) {
    const pad = ' '.repeat(indent);
    const inner = ' '.repeat(indent + 4);
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return `[\n${value.map((v) => inner + stableJson(v, indent + 4)).join(',\n')}\n${pad}]`;
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value).sort();
        if (keys.length === 0) return '{}';
        return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: `
            + `${stableJson(value[k], indent + 4)}`).join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

const HEADER = '// GENERATED by scripts/procgen/generate-procgen-reference.mjs — do not edit; '
    + 'regenerate.';

function moduleText({ file, exportName, doc, value }) {
    return `${HEADER}\n`
        + `/**\n * procgenDocs/generated/${file} — ${doc}\n *\n`
        + ' * ⛔⛔ **THIS FILE IS OUTPUT.** Editing it is how the gate FAILS:\n'
        + ' * `node scripts/procgen/generate-procgen-reference.mjs --check` regenerates into\n'
        + ' * memory and refuses if what is on disk differs. To change what it says, change\n'
        + ' * the CODE it reads, then regenerate:\n *\n'
        + ' *     node scripts/procgen/generate-procgen-reference.mjs\n *\n'
        + ' * ⛔ There is no timestamp in here, deliberately: one would make every\n'
        + ' * regeneration a diff and the gate unfailable.\n'
        + ' */\n\n'
        + '/** ⛓ DEEP-frozen: every nested row too, so a reader cannot mutate the table it\n'
        + ' *  is rendering and a shape gate can assert one word. */\n'
        + 'const frz = (v) => {\n'
        + '    if (v && typeof v === \'object\') Object.values(v).forEach(frz);\n'
        + '    return Object.isFrozen(v) ? v : Object.freeze(v);\n'
        + '};\n\n'
        + `export const ${exportName} = frz(${stableJson(value, 0)});\n\n`
        + `export default ${exportName};\n`;
}

const OUT = resolve(arg('out', DEFAULT_OUT));
const files = [
    {
        file: 'urlGrammar.js',
        exportName: 'URL_GRAMMAR',
        doc: '**THE URL PARAMETER GRAMMAR OF THE TWO LAB PAGES**, per page and per '
            + 'parameter: which reader and which writer own it, its default (measured by '
            + 'calling the reader on an EMPTY search), how ABSENCE is spelled (measured by '
            + 'calling the writer at the defaults), its value codec, the retired parameters '
            + 'with the refusal each one RUNS, and the glossary terms that define it.',
        value: buildUrlGrammar(),
    },
    {
        file: 'catalogue.js',
        exportName: 'CATALOGUE',
        doc: '**THE GENERATION CATALOGUE** — per biome: the boot items, the pass-2 '
            + 'templates with their parameter schemas, the EXCLUDED rows with the '
            + 'measurement that excluded them, the biome\'s DEFAULT element spec, and every '
            + 'skeleton kind this substrate offers with both the codec\'s defaults and the '
            + 'binding\'s EFFECTIVE ones. Plus the ELEMENT heads, their `needs` and their '
            + 'parameters.',
        value: buildCatalogue(),
    },
    {
        file: 'refusals.js',
        exportName: 'REFUSALS',
        doc: '**THE REFUSAL VOCABULARY** — one row per name a run can refuse BY, with '
            + 'where it fires, which channel surfaces it, its own sentence QUOTED from the '
            + 'source, and whether it came from a LIST CONSTANT or from a declared literal '
            + 'scan. `findings` is where the two disagree.',
        value: buildRefusals(),
    },
].map((f) => ({ ...f, text: moduleText(f) }));

if (flag('check')) {
    let bad = 0;
    for (const f of files) {
        const path = join(OUT, f.file);
        const onDisk = existsSync(path) ? readFileSync(path, 'utf8') : null;
        if (onDisk === f.text) { console.log(`PASS: ${f.file} is what the code says`); continue; }
        bad += 1;
        console.log(`FAIL: ${f.file} DIFFERS from what the code says`);
        if (onDisk === null) { console.log('  (the file does not exist)'); continue; }
        const a = onDisk.split('\n');
        const b = f.text.split('\n');
        let shown = 0;
        for (let i = 0; i < Math.max(a.length, b.length) && shown < 20; i += 1) {
            if (a[i] === b[i]) continue;
            console.log(`  line ${i + 1}\n    on disk: ${a[i] ?? '(none)'}\n    the code: ${b[i] ?? '(none)'}`);
            shown += 1;
        }
        if (a.length !== b.length) console.log(`  (${a.length} lines on disk, ${b.length} from the code)`);
    }
    console.log(bad === 0
        ? `\nALL ${files.length} GENERATED MODULES MATCH THE CODE`
        : `\n${bad} GENERATED MODULE(S) DIFFER — run the generator with no --check`);
    process.exit(bad === 0 ? 0 : 1);
}

mkdirSync(OUT, { recursive: true });
for (const f of files) {
    writeFileSync(join(OUT, f.file), f.text);
    console.log(`wrote ${join(OUT, f.file)} (${f.text.split('\n').length} lines)`);
}
const g = files[0].value;
const c = files[1].value;
const r = files[2].value;
console.log(`\nurlGrammar: ${g.pages.length} pages, `
    + `${g.pages.map((p) => `${p.id} ${p.params.length}`).join(' · ')} parameters, `
    + `${g.retired.length} retired, ${g.codecs.length} codecs`);
console.log(`catalogue:  ${c.biomes.length} biomes, `
    + `${c.biomes.map((b) => `${b.id} ${b.templates.length}t/${b.excluded.length}x/${b.skeletonKinds.length}k`).join(' · ')}, `
    + `${c.elements.length} element heads`);
console.log(`refusals:   ${r.rows.length} rows over ${r.sources.length} sources `
    + `(${r.rows.filter((x) => x.kind === 'constant').length} from a constant, `
    + `${r.rows.filter((x) => x.kind !== 'constant').length} literal-scanned; `
    + `${r.rows.filter((x) => !x.named).length} unnamed), `
    + `${r.enums.length} enums, ${r.findings.length} FINDING(S)`);
for (const f of r.findings) console.log(`  FINDING [${f.source}] ${f.name}`);

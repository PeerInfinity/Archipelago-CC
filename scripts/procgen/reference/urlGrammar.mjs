/**
 * reference/urlGrammar — **TABLE 1: THE URL PARAMETER GRAMMAR OF THE TWO LAB
 * PAGES**, per page and per parameter.
 *
 * ⛓ Split out of `generate-procgen-reference.mjs` unchanged (P3b, D0). The
 * three provenances are the generator's: `import` (the value IS the reader's
 * own answer, MEASURED by calling it), `scan` (a declared regex over a NAMED
 * region) and `declared` (this file said so — and every one is CHECKED).
 */

import { regionOf, allMatches, src } from './lib.mjs';
import { M, SOURCES } from './sources.mjs';

/** ⛓ THE PARAMETER PATTERNS — every way this tree names a URL key. */
export const PARAM_PATTERNS = Object.freeze([
    Object.freeze({ id: 'get', re: /\bq\.get\('([a-zA-Z]+)'\)/g, mode: 'read' }),
    Object.freeze({ id: 'set', re: /\bq\.set\('([a-zA-Z]+)'/g, mode: 'write' }),
    Object.freeze({ id: 'delete', re: /\bq\.delete\('([a-zA-Z]+)'\)/g, mode: 'delete' }),
    Object.freeze({ id: 'intParam', re: /\bintParam\(q, '([a-zA-Z]+)'/g, mode: 'read' }),
    Object.freeze({ id: 'int', re: /\bint\('([a-zA-Z]+)'/g, mode: 'read' }),
    Object.freeze({ id: 'writeInt', re: /\bwriteInt\(q, '([a-zA-Z]+)'/g, mode: 'write' }),
]);

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
        codec: 'parseElementSpec — `head[;key=value]…`, `+` between heads is a CHOICE '
            + '(one `pick`), and a value may be a SUBSET of the declared domain written '
            + '`key=v1|v2|v3` (ONE draw over those members; a single value is a PIN and '
            + 'spends none)',
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
    /**
     * ⛓ ARC 5, SLICE 1 — the WATCH page reads these now too (⚖ ruling 1); the
     * maze lab has since it existed. ⛔ ONE row per parameter across both pages,
     * so the terms name what the parameter IS rather than which page asked.
     */
    width: { field: { watch: 'size.width', lab: 'width' }, codec: 'intParam', terms: ['room-size', 'skeleton'] },
    height: { field: { watch: 'size.height', lab: 'height' }, codec: 'intParam', terms: ['room-size', 'skeleton'] },
    fill: { field: { watch: 'fill', lab: null }, codec: 'fillByName', terms: ['room-fill', 'level'] },
    tape: { field: { watch: 'tape', lab: null }, codec: 'a path to a tape JSON', terms: ['tape'] },
    /**
     * ⛓⛓⛓ R9 SLICE 2 (⚖ ruling 10) — the SEQUENCE, beside the single tape. A
     * comma list of tape paths, bare fixture names, or CHAIN IDS (a headline
     * expands to its segments through `director.PAGE_CHAINS`); the windows
     * play on ONE game state, no reload.
     */
    tapes: {
        field: { watch: 'tapes', lab: null },
        codec: 'director.parseTapesParam (a comma list; absent is null, empty is [])',
        terms: ['tape', 'window'],
    },
    side: { field: { watch: 'side', lab: null }, codec: 'a lower-cased enum', terms: ['seedling-differential'] },
    speed: { field: { watch: 'speed', lab: null }, codec: 'Number()', terms: ['playback-speed', 'view-setting'] },
    layers: { field: { watch: 'layers', lab: null }, codec: 'parseLayersParam (a comma list)', terms: ['overlay-layer'] },
    attackhold: { field: { watch: 'attackHold', lab: null }, codec: 'parseAttackHold', terms: ['attack-hold', 'view-setting'] },
    level: { field: { watch: 'level', lab: null }, codec: 'Number()', terms: ['staged-level', 'boot-items'] },
    boot: { field: { watch: 'boot', lab: null }, codec: 'a JSON boot block', terms: ['boot-items'] },
    goals: { field: { watch: 'goals', lab: null }, codec: 'a goal list', terms: ['solver'] },
    name: { field: { watch: 'name', lab: null }, codec: 'a string', terms: ['tape-name', 'tape'] },
    solve: { field: { watch: 'solve', lab: null }, codec: 'the literal `1`', terms: ['solver'] },
    tick: { field: { watch: 'tick', lab: null }, codec: 'readViewParams (a whole tick index)', terms: ['tick', 'view-setting'] },
    shot: { field: { watch: 'shot', lab: null }, codec: 'the literal `1`', terms: ['screenshot-flag', 'browser-row'] },
    directed: { field: { watch: null, lab: null }, codec: 'RETIRED — refuses by name', terms: ['directive', 'directed-attempt'] },
    budgetms: { field: { watch: null, lab: null }, codec: 'RETIRED — warns and is ignored', terms: ['wall-clock-budget', 'tick-budget', 'determinism'] },
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
        ...(await import('../../../frontend/modules/seedlingDemo/watchSolve.js')).readSolveParams(''),
        ...(await import('../../../frontend/modules/seedlingDemo/watchManual.js')).readViewParams(''),
        tape: null,
        tapes: null,
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

export function buildUrlGrammar() {
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

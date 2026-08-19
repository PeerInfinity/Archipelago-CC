/**
 * reference/refusals — **TABLE 3: THE REFUSAL VOCABULARY** — one row per name a
 * run can refuse BY, with where it fires, which channel surfaces it, its own
 * sentence QUOTED from the source, and whether it came from a LIST CONSTANT or
 * from a declared literal scan. `findings` is where the two disagree.
 *
 * ⛓ Split out of `generate-procgen-reference.mjs` unchanged (P3b, D0).
 */

import { regionOf, stringRunAt, allMatches, src } from './lib.mjs';
import { M, SOURCES } from './sources.mjs';

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
        /** ⛓⛓ ITS AXIS IS THE ELEMENT **PATH**, NOT THIS FILE — the constant's
         *  own docblock says so and names the three it declares for modules
         *  one door over. So a declared name the scan finds firing in ANOTHER
         *  scanned source is published as a SPAN, not as a finding; a declared
         *  name firing NOWHERE is still a finding, which is the half that keeps
         *  this from being a licence to declare anything. (P5 — before it, the
         *  three spans were three permanent findings that said the same true
         *  thing about the list every time it was generated.) */
        spansModules: true,
        channel: '`summary.elementInfo.refused` on `watch.html`; '
            + '`generate-seedling-level.mjs --json` `elementInfo.refused`',
    },
    {
        id: 'require-directive',
        title: 'The `?require=` directive (the ITEM vocabulary)',
        kind: 'constant',
        constant: 'REQUIRE_DIRECTIVE_REFUSALS',
        names: M.elementSpec.REQUIRE_DIRECTIVE_REFUSALS,
        file: SOURCES.elementSpec,
        region: /^export function resolveRequireDirective\(/,
        regionName: 'elementSpec.resolveRequireDirective',
        channel: '`summary.require.refused` on `watch.html`; the CLI exits 6',
    },
    {
        id: 'maze-require-directive',
        title: 'The `?require=` directive (the AREA-GRAPH SYMBOL vocabulary)',
        kind: 'constant',
        constant: 'MAZE_REQUIRE_REFUSALS',
        names: M.maze.MAZE_REQUIRE_REFUSALS,
        file: SOURCES.maze,
        region: /^export function requireOutcome\(/,
        regionName: 'procgenMaze.requireOutcome',
        channel: '`summary.require.refused` on `lab.html`; `generate-maze-level.mjs` exits 6',
    },
    {
        id: 'area-graph',
        title: 'The AREA GRAPH itself',
        kind: 'constant',
        constant: 'REASONS',
        names: Object.values(M.areaGraph.REASONS),
        file: SOURCES.areaGraph,
        region: /^export const REASONS = Object\.freeze\(\{/,
        regionName: 'areaGraph.REASONS',
        pattern: REASON_TABLE_RE,
        channel: '`buildAreaGraph(...).refused.reason` → `summary.areaGraph.refused` on both pages',
    },
    {
        id: 'seedling-area-binding',
        title: 'The SEEDLING area binding',
        kind: 'constant',
        constant: 'SEEDLING_AREA_REFUSALS',
        names: M.seedling.SEEDLING_AREA_REFUSALS,
        file: SOURCES.seedling,
        regionName: 'procgenSeedling.js (the whole module)',
        channel: '`summary.areas.refused` / `summary.elementInfo.refused` on `watch.html`',
    },
    {
        id: 'maze-area-binding',
        title: 'The MAZE area + element binding',
        kind: 'constant',
        constant: 'MAZE_REFUSALS',
        names: M.maze.MAZE_REFUSALS,
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

export function buildRefusals() {
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

    const spans = [];
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
                /**
                 * ⛓⛓ A SOURCE THAT DECLARES `spansModules` HAS SAID SO IN ITS
                 * OWN DOCBLOCK: its axis is a mechanism, not a file, and a
                 * declared name raised one module over is the list working as
                 * designed. That is a SPAN, published beside the source rather
                 * than as a finding. ⛔ A declared name firing NOWHERE is still
                 * a finding under either flag — which is what stops
                 * `spansModules` from being a licence to declare anything.
                 */
                if (s.spansModules && elsewhere.length) {
                    spans.push({ source: s.id, constant: s.constant, name, firesIn: elsewhere });
                    continue;
                }
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
            spansModules: Boolean(s.spansModules),
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
        /** ⛓ Where a `spansModules` census key's names are actually raised —
         *  the fact the three permanent findings used to carry. */
        spans: spans.sort((a, b) => a.name.localeCompare(b.name)),
        patterns: {
            literal: String(REFUSAL_LITERAL_RE),
            template: String(REFUSAL_TEMPLATE_RE),
            reasonTable: String(REASON_TABLE_RE),
        },
    };
}

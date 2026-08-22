/**
 * reference/instruments — **TABLE 5: THE INSTRUMENTS INDEX, ASKED OF THE
 * DIRECTORY** (PROCGEN DOCS · P3b).
 *
 * ⛓ ONE ROW PER `scripts/procgen/*.mjs`. `architecture.md` carried a hand-typed
 * sentence naming a dozen of them; there are 221, and a list a human keeps is a
 * list that is wrong the day somebody adds a probe.
 *
 *   the DIRECTORY LISTING  the rows — a file on disk that is not in the module
 *                          fails `--check`, which is the non-vacuity gate
 *   the leading DOCBLOCK   the one-liner
 *   a DECLARED argv scan   the flags it accepts
 *   a scan of the 18 docs  which document cites it (and which cites a script
 *                          that is NOT on disk — a finding)
 *
 * ── ⛔ THE TWO SCANS THAT COULD HAVE LIED ──────────────────────────────
 *
 * **The docblock.** 201 of the 221 files open with a `/** … *\/` block, 19 with
 * a run of `//` lines, and 4 put their comment AFTER their imports. A scan that
 * only saw the first shape would have reported twenty files as undocumented —
 * a false finding about somebody's code, which is exactly what P3a's ternary
 * lesson forbids. So the rule is: the file's HEADER is everything before its
 * first executable line (blank lines, `#!`, comments and `import`/`export`
 * lines are all header), and the docblock is the first comment block in it.
 *
 * **The flags.** `--enable-features=` and `--use-angle=` are the two most
 * common `--x=` literals in this directory and NEITHER is a flag of any script:
 * they are Chrome launch arguments. So a flag is only counted where the script
 * READS ARGV for it — `arg('x')`/`flag('x')` over a local helper,
 * `process.argv.includes('--x')`, or `startsWith('--x=')` — and the `--x=`
 * literals inside the docblock's own `Run:` block are published separately as
 * what the file DOCUMENTS. The two disagreeing is a fact about the file, not a
 * fact this table gets to hide.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';

import { REPO, firstSentence, src } from './lib.mjs';
import { M } from './sources.mjs';

export const SCRIPT_DIR = 'scripts/procgen';
const DOC_DIR = 'docs/json/developer/procgen';

/** ⛓ THE INSTRUMENT LIST ITSELF — `architecture.md` § *The ledger, the
 *  step-through and the instruments* points at the generated section now. */
export const INSTRUMENTS_DOC = `${DOC_DIR}/architecture.md`;

/**
 * ⛓⛓ THE FLAG PATTERNS — PUBLISHED, because a table of "what this accepts" is
 * only as good as the regex behind it. Each one is a script READING ARGV
 * DIRECTLY.
 */
export const FLAG_PATTERNS = Object.freeze([
    Object.freeze({ id: 'includes', re: /\bincludes\(\s*'--([a-zA-Z][a-zA-Z0-9-]*)'/g }),
    Object.freeze({ id: 'startsWith', re: /startsWith\(\s*[`']--([a-zA-Z][a-zA-Z0-9-]*)=/g }),
]);

/**
 * ⛓⛓⛓ …AND THE HELPERS EACH FILE DEFINES FOR ITSELF, FOUND RATHER THAN
 * LISTED.
 *
 * ⛔ THE FIRST CUT LISTED THREE NAMES — `arg`, `flag`, `num` — and the
 * SPOT-CHECK killed it: `generate-seedling-level.mjs` also defines `has()` and
 * `list()`, so the table said it does not accept `--families=`, `--templates=`,
 * `--json` or `--cost`, four flags its own `Run:` block shows a reader typing.
 * A hand list of helper names is the same defect as a hand list of anything
 * else in this directory.
 *
 * So a helper is DISCOVERED: a top-level `const <name> = (<param>…) =>` whose
 * next few lines mention both `argv` and a `--${…}` template. Then every
 * `<name>('x')` call in the file is a flag.
 */
export const HELPER_DECL_RE = /^\s*(?:export )?const ([a-zA-Z][a-zA-Z0-9]*) = (?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>)/gm;

/** ⛓ The local name a file gives `process.argv` — `args`, `argv`, … A helper
 *  written over one of these never mentions `argv` itself. */
export const ARGV_ALIAS_RE = /const ([a-zA-Z][a-zA-Z0-9]*) = process\.argv\b/g;
const HELPER_WINDOW = 400;

/** ⛓ `import { arg, flag } from './reference/lib.mjs'` — a named import from a
 *  RELATIVE module. */
const RELATIVE_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*'(\.[^']*)'/g;

export function argvHelpersIn(text, { file = null } = {}) {
    const decls = allOf2(text, HELPER_DECL_RE)
        .map((m) => ({ name: m[1], window: text.slice(m.index, m.index + HELPER_WINDOW) }));
    const aliases = allOf2(text, ARGV_ALIAS_RE).map((m) => m[1]);
    const readsArgv = new RegExp(`\\bargv\\b${aliases.map((a) => `|\\b${a}\\b`).join('')}`);
    /** ⛓ …and LOOKS one up: a `--` literal, or one of the four ways this tree
     *  searches an argument list. `const has = (flag) => argv.includes(flag);`
     *  names no `--` at all — the caller supplies it. */
    const looksUp = /--\$\{|--'|--"|\.includes\(|\.indexOf\(|\.find\(|startsWith\(/;
    const found = new Set();
    for (const d of decls) {
        if (readsArgv.test(d.window) && looksUp.test(d.window)) found.add(d.name);
    }
    /**
     * ⛓⛓⛓ …TO A FIXED POINT, which is P3a's projection lesson in this file's
     * spelling. `const num = (name, fallback) => Number(arg(name, fallback));`
     * never mentions `argv` — it delegates — so the first cut lost every
     * numeric flag in the directory (`--count=`, `--seed=`, `--tries=`,
     * `--k=`, `--cellbudget=`). A helper that CALLS a helper IS one.
     */
    /**
     * ⛓⛓ …AND ONE LEVEL ACROSS FILES. `generate-procgen-reference.mjs` reads
     * `--check` and `--out=` through `arg`/`flag` IMPORTED from
     * `reference/lib.mjs`, so nothing in its own text declares a helper and
     * the table said it takes no flags — about the very file that writes the
     * table. A named import from a RELATIVE module counts as a helper when
     * that module declares it as one. ⛔ One level, deliberately: a helper
     * imported through two modules is not a shape this directory has.
     */
    if (file) {
        for (const m of allOf2(text, RELATIVE_IMPORT_RE)) {
            const target = resolvePath(dirname(file), m[2]);
            if (!existsSync(target)) continue;
            const theirs = new Set(argvHelpersIn(readFileSync(target, 'utf8')));
            for (const name of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop())) {
                if (theirs.has(name)) found.add(name);
            }
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const d of decls) {
            if (found.has(d.name)) continue;
            for (const h of found) {
                if (!new RegExp(`\\b${h}\\(`).test(d.window)) continue;
                found.add(d.name);
                changed = true;
                break;
            }
        }
    }
    return [...found].sort();
}

const allOf2 = (text, re) => {
    const out = [];
    const r = new RegExp(re.source, re.flags);
    let m = r.exec(text);
    while (m) { out.push(m); m = r.exec(text); }
    return out;
};

/**
 * ⛓ What the file's own `Run:` / `Usage:` block SHOWS a reader typing.
 *
 * ⛔⛔ THE TRAILING DELIMITER IS A LOOKAHEAD, AND IT HAS TO BE (R9 slice 10).
 * It used to be a consuming `[=\s]`, which requires a character AFTER the flag
 * name — and the LAST flag in a usage block has none: the captured text ends
 * where the docblock does. ⇒ every instrument whose usage block's final line
 * ended in a bare flag reported that flag as UNDOCUMENTED, silently, in the
 * generated index. Measured by swapping two usage lines in
 * `census-seedling-campaign.mjs` and watching which of the two disappeared: the
 * one that moved to the end, both times. `(?=[=\s]|$)` consumes nothing and
 * accepts end-of-text, so a flag is documented wherever it is written.
 */
const DOCUMENTED_FLAG_RE = /--([a-zA-Z][a-zA-Z0-9-]*)(?=[=\s]|$)/g;

const allOf = (text, re) => {
    const out = [];
    const r = new RegExp(re.source, re.flags);
    let m = r.exec(text);
    while (m) { out.push(m[1]); m = r.exec(text); }
    return out;
};

/* ══════════════════════════════════════════════════════════════════════
 * THE HEADER AND ITS DOCBLOCK
 * ══════════════════════════════════════════════════════════════════════ */

/** Everything before the first EXECUTABLE line. */
export function headerOf(text) {
    const out = [];
    let inBlock = false;
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (inBlock) { out.push(line); if (t.includes('*/')) inBlock = false; continue; }
        if (t === '' || t.startsWith('#!') || t.startsWith('//')) { out.push(line); continue; }
        if (t.startsWith('/*')) { out.push(line); if (!t.includes('*/')) inBlock = true; continue; }
        if (/^(import|export)\b/.test(t) || /^[)}\]];?$/.test(t) || /^['"]/.test(t)) {
            out.push(line);
            continue;
        }
        break;
    }
    return out.join('\n');
}

/** The first comment block in a header, as plain text, with its style. */
export function docblockOf(header) {
    const block = /\/\*\*?([\s\S]*?)\*\//.exec(header);
    if (block) {
        return {
            style: 'block',
            text: block[1].split('\n').map((l) => l.replace(/^\s*\*ims?/, '')
                .replace(/^\s*\*\s?/, '')).join('\n').trim(),
        };
    }
    const line = /(?:^|\n)((?:[ \t]*\/\/[^\n]*\n)+)/.exec(header);
    if (line) {
        return {
            style: 'line',
            text: line[1].split('\n').map((l) => l.replace(/^\s*\/\/\s?/, '')).join('\n').trim(),
        };
    }
    return null;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE BUILDER
 * ══════════════════════════════════════════════════════════════════════ */

const NO_PREFIX = 'no prefix';
const categoryOf = (file) => (/^([a-z]+)-/.exec(file) ?? [])[1] ?? NO_PREFIX;

/**
 * ⛓⛓ A script THIS DIRECTORY owns, named by a doc — with its extension, so a
 * sentence about "the census" is not mistaken for a citation of a file.
 *
 * ⛔ THE LOOKBEHIND IS THE WHOLE POINT AND THE FIRST CUT DID NOT HAVE IT: a
 * bare `\b…\.mjs\b` reported THIRTEEN scripts as *cited by a doc but not on
 * disk*, and every single one was a false finding — `CC/scripts/jta-stats/
 * driver.mjs`, `frontend/modules/seedlingDemo/fixtures/regenerate-r1-tapes
 * .mjs`, `test/planner.test.mjs` and the GLOB `dump-*-byteidentity.mjs` are
 * not files this directory is missing. A citation counts when it is a bare
 * name or carries THIS directory's path, and nothing else.
 */
const CITE_RE = /(?<![\w/*.-])(?:scripts\/procgen\/)?([a-z][a-zA-Z0-9-]*\.mjs)\b/g;

/**
 * ⛓⛓ A CITATION A DOCUMENT MARKS AS **NEVER WRITTEN** IS NOT A CITATION OF A
 * FILE — it is a citation of a PLAN, and the two are different facts about a
 * document (PROCGEN DOCS · P5).
 *
 * ⛔ The marker exists because the alternative was worse. `seedling-bot.md`'s
 * R7-close table names `plan-seedling-segment.mjs --from <AP-path-step>` as a
 * horizon that was superseded before anybody wrote it, and this scan called it
 * a DEAD citation. The smaller edit by line count was to delete the `.mjs` from
 * the row — which would have deleted the exact command a reader would type if
 * M2 ever ships, to satisfy a tool. So the ROW keeps its spelling and says
 * `(never written)`, and the scan reads that: a marked citation is dropped
 * before either direction of the table sees it, and the count of them is
 * published so a marker cannot quietly hide a real dead citation.
 *
 * ⚠ WITHIN 120 CHARACTERS AND ON THE SAME LINE. A marker further away than
 * that would be a sentence about something else.
 */
const NEVER_WRITTEN_RE = /\(never written\)/;
const NEVER_WRITTEN_WINDOW = 120;

/** ⛓ Every path in the repo with this basename — `node_modules`, `.git` and
 *  the build output are not part of the tree a doc could mean. */
function findEverywhere(root, basename, rel = '', out = []) {
    const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results',
        'playwright-report', '.venv', '__pycache__', 'NewDocs']);
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
        if (SKIP.has(e.name)) continue;
        const next = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) findEverywhere(root, basename, next, out);
        else if (e.name === basename) out.push(next);
    }
    return out.sort();
}

/** ⛓ The glossary terms this table is about — declared, and CHECKED. */
export const INSTRUMENT_TERMS = Object.freeze([
    'browser-row', 'census', 'sweep', 'yield-table', 'byte-identity', 'determinism',
]);

export function buildInstruments() {
    for (const t of INSTRUMENT_TERMS) {
        if (!M.glossary.termById(t)) {
            throw new Error('generate-procgen-reference: INSTRUMENT_TERMS names '
                + `${JSON.stringify(t)}, which the GLOSSARY does not define`);
        }
    }
    const names = readdirSync(join(REPO, SCRIPT_DIR))
        .filter((f) => f.endsWith('.mjs')).sort();
    /**
     * ⛓⛓ THE DOCS AS THEIR AUTHORS WROTE THEM — every GENERATED REGION is cut
     * out before the citation scan. ⛔ Otherwise the generator cites itself:
     * its own marker names `generate-procgen-reference.mjs`, so the moment a
     * doc grows a region that file becomes "cited by two more documents", and
     * a table that changes because it was written is a fixed point, not a
     * measurement.
     */
    const docs = readdirSync(join(REPO, DOC_DIR)).filter((f) => f.endsWith('.md')).sort()
        .map((f) => ({
            file: `${DOC_DIR}/${f}`,
            text: src(`${DOC_DIR}/${f}`)
                .replace(/<!-- GENERATED:[\s\S]*?END -->/g, ''),
        }));

    /* ⛓ WHICH DOC CITES WHICH SCRIPT — built once, both directions at once. */
    const citedBy = new Map();
    const markedNeverWritten = new Map();
    for (const d of docs) {
        const cited = new Set();
        for (const m of allOf2(d.text, CITE_RE)) {
            const after = d.text.slice(m.index + m[0].length,
                m.index + m[0].length + NEVER_WRITTEN_WINDOW).split('\n')[0];
            if (NEVER_WRITTEN_RE.test(after)) {
                if (!markedNeverWritten.has(m[1])) markedNeverWritten.set(m[1], []);
                if (!markedNeverWritten.get(m[1]).includes(d.file)) {
                    markedNeverWritten.get(m[1]).push(d.file);
                }
                continue;
            }
            cited.add(m[1]);
        }
        for (const name of cited) {
            if (!citedBy.has(name)) citedBy.set(name, []);
            citedBy.get(name).push(d.file);
        }
    }

    const findings = [];
    const rows = names.map((file) => {
        const text = src(`${SCRIPT_DIR}/${file}`);
        const doc = docblockOf(headerOf(text));
        if (!doc) {
            findings.push({
                name: file,
                severity: 'no docblock',
                what: `\`${SCRIPT_DIR}/${file}\` opens with no comment at all — neither a `
                    + '`/** */` block nor a run of `//` lines before its first executable '
                    + 'line. Every other instrument in this directory says what it is in its '
                    + 'first sentence; this row has nothing to say and the table prints that '
                    + 'rather than an empty cell.',
            });
        }
        const flags = new Set();
        const how = new Map();
        const helpers = argvHelpersIn(text, { file: join(REPO, SCRIPT_DIR, file) });
        const patterns = [
            ...FLAG_PATTERNS,
            ...helpers.map((h) => ({
                id: h,
                /** ⛓ `--` OPTIONAL: `flag('source')` and `flag('--source')` are
                 *  both this directory's spelling, and the second one is how
                 *  every `indexOf(name)` helper is called. */
                re: new RegExp(`\\b${h}\\(\\s*'(?:--)?([a-zA-Z][a-zA-Z0-9-]*)'`, 'g'),
            })),
        ];
        for (const p of patterns) {
            for (const name of allOf(text, p.re)) {
                if (name === 'name' || name === 'n') continue;
                flags.add(name);
                if (!how.has(name)) how.set(name, []);
                if (!how.get(name).includes(p.id)) how.get(name).push(p.id);
            }
        }
        /* ⛓ the `Run:` / `Usage:` block of the docblock — what the file SHOWS */
        const runBlock = doc
            ? (/(?:^|\n)\s*(?:Run|Usage|USAGE|RUN):([\s\S]*?)(?:\n\s*\n|$)/.exec(doc.text)
                ?? [])[1] ?? ''
            : '';
        const documented = [...new Set(allOf(runBlock, DOCUMENTED_FLAG_RE))].sort();
        return {
            file,
            path: `${SCRIPT_DIR}/${file}`,
            category: categoryOf(file),
            oneLiner: doc ? firstSentence(doc.text) : null,
            docblockStyle: doc?.style ?? null,
            argvHelpers: helpers,
            flags: [...flags].sort().map((name) => ({ name, how: how.get(name).sort() })),
            documentedFlags: documented,
            /** ⛓ A BROWSER ROW — it drives a real page, so it costs a browser
             *  and cannot run where one is not installed. */
            browser: /from '(?:@playwright\/test|playwright)'/.test(text),
            citedBy: (citedBy.get(file) ?? []).sort(),
        };
    });

    /* ⛓⛓ THE OTHER DIRECTION: a script a DOC cites that is NOT in this
     * directory. ⛔ And the finding says WHERE IT IS instead — "the doc names a
     * script with no path and it lives two directories over" and "a reader
     * following this lands nowhere" are different facts, and only the second
     * one is a dead citation. Four of the five here are the first. */
    const onDisk = new Set(readdirSync(join(REPO, SCRIPT_DIR)));
    for (const [name, where] of [...citedBy].sort()) {
        if (onDisk.has(name)) continue;
        const elsewhere = findEverywhere(REPO, name);
        findings.push({
            name,
            severity: elsewhere.length
                ? 'cited without a path; it lives elsewhere in the tree'
                : 'cited by a doc, NOWHERE in the tree',
            what: `\`${name}\` is named in [${where.join(', ')}] and there is no such file in `
                + `\`${SCRIPT_DIR}/\`. `
                + (elsewhere.length
                    ? `It IS in the tree, at [${elsewhere.join(', ')}] — so the citation is `
                        + 'a bare file name whose directory the reader has to guess.'
                    : 'It is nowhere in this repository: the citation is DEAD — renamed, '
                        + 'removed, or never written.')
                + ' ⛔ Reported, not fixed.',
        });
    }

    const categories = [...new Set(rows.map((r) => r.category))].sort().map((id) => ({
        id,
        count: rows.filter((r) => r.category === id).length,
        browser: rows.filter((r) => r.category === id && r.browser).length,
    }));

    return {
        terms: [...INSTRUMENT_TERMS].sort(),
        dir: SCRIPT_DIR,
        rows,
        categories,
        findings,
        /** ⛓ Every citation a document MARKED `(never written)` — published so
         *  the marker cannot quietly retire a real dead citation. */
        neverWritten: [...markedNeverWritten].sort()
            .map(([name, where]) => ({ name, citedBy: where.sort() })),
        counts: {
            files: rows.length,
            withDocblock: rows.filter((r) => r.oneLiner).length,
            blockStyle: rows.filter((r) => r.docblockStyle === 'block').length,
            lineStyle: rows.filter((r) => r.docblockStyle === 'line').length,
            browser: rows.filter((r) => r.browser).length,
            withFlags: rows.filter((r) => r.flags.length).length,
            cited: rows.filter((r) => r.citedBy.length).length,
        },
        patterns: {
            flags: FLAG_PATTERNS.map((p) => `${p.id}: ${String(p.re)}`),
            helperDecl: `${String(HELPER_DECL_RE)} — then \`<helper>('x')\`, within `
                + `${HELPER_WINDOW} characters of a mention of both \`argv\` and a `
                + '`--${…}` template',
            documented: String(DOCUMENTED_FLAG_RE),
            cite: String(CITE_RE),
            neverWritten: `${String(NEVER_WRITTEN_RE)} within ${NEVER_WRITTEN_WINDOW} `
                + 'characters after a citation, on the same line — the citation is then of a '
                + 'PLAN and is dropped from both directions of the table',
        },
        docblockRule: 'the file\'s HEADER is everything before its first executable line '
            + '(blank lines, `#!`, comments and `import`/`export` lines are header), and the '
            + 'docblock is the FIRST comment block in it — a `/** */` block or a run of `//` '
            + 'lines. The one-liner is the first SENTENCE of its first paragraph.',
        flagRule: 'a flag is counted where the script READS ARGV for it. A `--x=` literal '
            + 'alone is not enough: `--enable-features=` and `--use-angle=` are the two '
            + 'commonest in this directory and both are Chrome launch arguments. What the '
            + 'file\'s own `Run:` block shows is published separately as `documentedFlags`.',
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE MARKDOWN REGION — `architecture.md` § *The ledger, the step-through and
 * the instruments*
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛓ A PARAGRAPH, NOT THE TABLE. 221 rows do not belong in a narrative
 * document: what belongs there is HOW MANY there are, of what kinds, and where
 * the full index is. The table itself is on the reference page, which can
 * filter it.
 */

export function instrumentsMarkdown(v) {
    const cats = v.categories.slice()
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
        .map((c) => `${c.id === NO_PREFIX ? c.id : `\`${c.id}-\``} ${c.count}`
            + `${c.browser ? ` (${c.browser} browser)` : ''}`);
    return [
        `**${v.counts.files} instruments** live in \`${v.dir}/\`, by prefix: ${cats.join(' · ')}.`,
        '',
        `${v.counts.browser} of them drive a real browser; ${v.counts.withFlags} accept at `
        + `least one \`--flag\`; ${v.counts.cited} are cited by one of these documents; and `
        + `${v.counts.files - v.counts.withDocblock} `
        + `open${v.counts.files - v.counts.withDocblock === 1 ? 's' : ''} with no comment at `
        + 'all.',
        '',
        'One row each — the one-liner from the file\'s own docblock, the flags it reads out '
        + 'of `argv`, whether it needs a browser, and which document cites it — is on the '
        + '[reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/'
        + 'reference.html#section-instruments), which can filter them.',
    ].join('\n');
}

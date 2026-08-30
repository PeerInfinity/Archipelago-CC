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

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
    DOCUMENTED_FLAG_RE, FLAG_PATTERNS, HELPER_DECL_RE, HELPER_WINDOW, allOf2, argvHelpersIn,
    docblockOf, documentedFlagsIn, flagsIn, headerOf, inheritedFlagsIn,
} from '../argvScan.js';
import { REPO, firstSentence, src } from './lib.mjs';
import { M } from './sources.mjs';

export const SCRIPT_DIR = 'scripts/procgen';
const DOC_DIR = 'docs/json/developer/procgen';

/** ⛓ THE INSTRUMENT LIST ITSELF — `architecture.md` § *The ledger, the
 *  step-through and the instruments* points at the generated section now. */
export const INSTRUMENTS_DOC = `${DOC_DIR}/architecture.md`;




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
/**
 * ⛓⛓⛓ R9 SLICE 13 — **AND `(retired)` JOINS `(never written)`, FOR THE SAME
 * ARGUMENT ONE TENSE OVER.**
 *
 * The paragraph above says the marker exists because deleting a `.mjs` from a
 * doc row "to satisfy a tool" was the worse edit. A RETIREMENT is that argument
 * in the past tense: `plan-seedling-r7-act2.mjs` was deleted in this slice
 * (dead `--check` since `706886397`, reach = 0 gates / 0 tests / 0 modules), and
 * the doc that RECORDS the retirement has to be able to name the file it
 * retired. Without this the tree would be choosing between an accurate history
 * and a clean scan.
 *
 * ⛔ AND THE FIELD IS NO LONGER CALLED `neverWritten`, because a field of that
 * name holding a file that WAS written would be exactly the true-sentence-about-
 * the-wrong-subject failure this repo keeps recording (traps 566, 573). It is
 * `unresolvedByDesign`: a citation the tree deliberately does not resolve,
 * whichever tense it is in. It is still PUBLISHED and still pinned, so a marker
 * cannot quietly retire a real dead citation.
 */
const NEVER_WRITTEN_RE = /\((?:never written|retired)\)/;
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
        const abs = join(REPO, SCRIPT_DIR, file);
        const helpers = argvHelpersIn(text, { file: abs });
        const flags = flagsIn(text, { file: abs });
        /* ⛓ the `Run:` / `Usage:` block of the docblock — what the file SHOWS */
        const documented = documentedFlagsIn(doc ? doc.text : '');
        return {
            file,
            path: `${SCRIPT_DIR}/${file}`,
            category: categoryOf(file),
            oneLiner: doc ? firstSentence(doc.text) : null,
            docblockStyle: doc?.style ?? null,
            argvHelpers: helpers,
            flags,
            documentedFlags: documented,
            /** ⛓⛓ R9 slice P4a — the flags this file accepts because a module
             *  it IMPORTS parses them (§48.13 item 2). `--wait-for-box=` lives
             *  in `boxLock.js` and `--help` in `argvHelp.js`; the table names
             *  both the acceptor and the parse site. */
            inheritedFlags: inheritedFlagsIn(text, { file: abs }),
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
        /** ⛓ Every citation a document MARKED `(never written)` or `(retired)` —
         *  published so the marker cannot quietly retire a real dead citation. */
        unresolvedByDesign: [...markedNeverWritten].sort()
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
            unresolvedByDesign: `${String(NEVER_WRITTEN_RE)} within ${NEVER_WRITTEN_WINDOW} `
                + 'characters after a citation, on the same line — the citation is then of a '
                + 'PLAN or of a RETIRED instrument, and is dropped from both directions of '
                + 'the table',
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

/** ⛓ The inherited flags, tallied off the rows — `[flag, parse site, count]`,
 *  commonest first. Nothing here is typed. */
function inheritedTally(v) {
    const tally = new Map();
    for (const r of v.rows) {
        for (const f of r.inheritedFlags ?? []) {
            const k = `${f.name}\u0000${f.from}`;
            tally.set(k, (tally.get(k) ?? 0) + 1);
        }
    }
    return [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k, n]) => [...k.split('\u0000'), n]);
}

export function instrumentsMarkdown(v) {
    const cats = v.categories.slice()
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
        .map((c) => `${c.id === NO_PREFIX ? c.id : `\`${c.id}-\``} ${c.count}`
            + `${c.browser ? ` (${c.browser} browser)` : ''}`);
    return [
        `**${v.counts.files} instruments** live in \`${v.dir}/\`, by prefix: ${cats.join(' · ')}.`,
        '',
        `${v.counts.browser} of them drive a real browser; ${v.counts.withFlags} accept at `
        + `least one \`--flag\` OF THEIR OWN; ${v.counts.cited} are cited by one of these `
        + 'documents; and '
        + `${v.counts.files - v.counts.withDocblock} `
        + `open${v.counts.files - v.counts.withDocblock === 1 ? 's' : ''} with no comment at `
        + 'all.',
        '',
        /**
         * ⛓⛓ R9 SLICE P4a — **AND THE INHERITED FLAGS, WITH THEIR PARSE SITE**
         * (§48.13 item 2 / §50.11 item 2). "Where a flag is parsed" and "what a
         * file accepts" are two different true statements; the table used to
         * carry only the first, so ninety-six instruments accepted
         * `--wait-for-box=` and the index said none of them did. Every number
         * in this sentence is counted off the rows.
         */
        `Each also accepts what a module it IMPORTS parses: ${inheritedTally(v)
            .map(([flag, from, n]) => `\`--${flag}\` (${n}, in \`${from}\`)`).join(' · ')}. `
        + 'Those are listed per row with the parse site named, so the table says what a file '
        + 'ACCEPTS without losing where the parse lives.',
        '',
        'One row each — the one-liner from the file\'s own docblock, the flags it reads out '
        + 'of `argv`, whether it needs a browser, and which document cites it — is on the '
        + '[reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/'
        + 'reference.html#section-instruments), which can filter them.',
    ].join('\n');
}

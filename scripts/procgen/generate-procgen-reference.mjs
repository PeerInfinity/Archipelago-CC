#!/usr/bin/env node
/**
 * generate-procgen-reference — **THE REFERENCE TABLES, GENERATED FROM THE CODE
 * THEY DESCRIBE** (PROCGEN DOCS · P3a, extended by P3b).
 *
 * ⛓ THIS FILE IS A DRIVER. Every builder lives in `scripts/procgen/reference/`
 * — one module per table, over the shared machinery in `reference/lib.mjs`
 * (the region rule, the string-run reader, the deterministic serialiser, the
 * module emitter). P3a had all three builders in here and the file was 1162
 * lines; P3b adds three more tables, so the split came FIRST, as a pure move
 * (`--check` green with the three modules byte-identical).
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
import { join, resolve } from 'node:path';

import {
    DEFAULT_OUT, REPO, arg, findMarkdownRegion, flag, moduleText, spliceMarkdownRegion,
} from './reference/lib.mjs';
import { buildUrlGrammar } from './reference/urlGrammar.mjs';
import { buildCatalogue } from './reference/catalogue.mjs';
import { buildRefusals } from './reference/refusals.mjs';
import { REGISTRY_DOC, buildRegistry, registryMarkdown } from './reference/registry.mjs';
import {
    INSTRUMENTS_DOC, buildInstruments, instrumentsMarkdown,
} from './reference/instruments.mjs';

import { INDEX_DOC, buildDocsIndex, docsIndexMarkdown } from './reference/docsIndex.mjs';
/**
 * ⛓ R9 slice 12d (⚖ ruling 38 (1)): the campaign chain's table. The one
 * place the whole chain was written out for a human, kept current BY HAND
 * since slice 6 — now derived from the chain's one declaration, the tapes'
 * own tick counts and the committed route frontier.
 */
import {
    CAMPAIGN_DOC, buildCampaignChain, campaignChainMarkdown,
} from './reference/campaignChain.mjs';

const REGISTRY = await buildRegistry();
const INSTRUMENTS = buildInstruments();
const DOCS_INDEX = buildDocsIndex();
const CAMPAIGN_CHAIN = await buildCampaignChain();

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
    {
        file: 'registry.js',
        exportName: 'REGISTRY',
        doc: '**THE SUBSTRATE-REGISTRY CAPABILITY MATRIX** — one column per entry '
            + '`substrateRegistry.getAll()` returns (in REGISTRATION order, which is the '
            + 'order the generator imports the libraries that self-register them) and one '
            + 'row per field an entry CARRIES, grouped by the `###` heading of '
            + '`substrate-registry.md` that documents it. `findings` is where an entry and '
            + 'that document disagree.',
        value: REGISTRY,
    },
    {
        file: 'instruments.js',
        exportName: 'INSTRUMENTS',
        doc: '**THE INSTRUMENTS INDEX** — one row per `scripts/procgen/*.mjs`: its category '
            + '(the file-name prefix), the one-liner from its own leading docblock, the '
            + 'flags it reads out of `argv` (found through the helpers each file defines for '
            + 'itself), whether it drives a browser, and which of the procgen documents cite '
            + 'it. `findings` holds the files with no docblock and the citations that point '
            + 'at no file here.',
        value: INSTRUMENTS,
    },
    {
        file: 'docsIndex.js',
        exportName: 'DOCS_INDEX',
        doc: '**THE PROCGEN DOCUMENTATION INDEX** — one row per `.md` in '
            + '`docs/json/developer/procgen/` (README excepted, since it is the file the '
            + 'index goes in) with its own H1, its own first paragraph and its word count, '
            + 'in the reading order README declares; plus one row per page under '
            + '`frontend/modules/procgenDocs/`, which are not `.md` files at all.',
        value: DOCS_INDEX,
    },
].map((f) => ({ ...f, text: moduleText(f) }));

/**
 * ⛓⛓ THE MARKDOWN GENERATED REGIONS (P3b, D1). A `.md` people read on GitHub
 * keeps its prose; only the text between the two markers is written, and
 * `--check` diffs a region exactly as it diffs a module.
 */
const regions = [
    {
        file: REGISTRY_DOC,
        table: 'substrate-capability-matrix',
        body: registryMarkdown(REGISTRY),
    },
    {
        file: INSTRUMENTS_DOC,
        table: 'procgen-instruments',
        body: instrumentsMarkdown(INSTRUMENTS),
    },
    {
        file: INDEX_DOC,
        table: 'procgen-docs-index',
        body: docsIndexMarkdown(DOCS_INDEX),
    },
    {
        file: CAMPAIGN_DOC,
        table: 'campaign-chain',
        body: campaignChainMarkdown(CAMPAIGN_CHAIN),
    },
].map((r) => ({ ...r, path: join(REPO, r.file) }));

/** ⛔ A region whose markers are missing or duplicated REFUSES BY NAME rather
 *  than being skipped — a skipped region is a table nothing gates. */
function regionBody(r) {
    return findMarkdownRegion(readFileSync(r.path, 'utf8'), r.table, { what: r.file }).body;
}

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
    for (const r of regions) {
        let onDisk = null;
        try {
            onDisk = regionBody(r);
        } catch (e) {
            bad += 1;
            console.log(`FAIL: ${r.file} — ${e.message}`);
            continue;
        }
        if (onDisk === r.body) {
            console.log(`PASS: ${r.file} § GENERATED:${r.table} is what the code says`);
            continue;
        }
        bad += 1;
        console.log(`FAIL: ${r.file} § GENERATED:${r.table} DIFFERS from what the code says`);
        const a = onDisk.split('\n');
        const b = r.body.split('\n');
        let shown = 0;
        for (let i = 0; i < Math.max(a.length, b.length) && shown < 20; i += 1) {
            if (a[i] === b[i]) continue;
            console.log(`  region line ${i + 1}\n    on disk: ${a[i] ?? '(none)'}\n`
                + `    the code: ${b[i] ?? '(none)'}`);
            shown += 1;
        }
        if (a.length !== b.length) {
            console.log(`  (${a.length} region lines on disk, ${b.length} from the code)`);
        }
    }
    console.log(bad === 0
        ? `\nALL ${files.length} GENERATED MODULES AND ${regions.length} MARKDOWN `
            + `REGION${regions.length === 1 ? '' : 'S'} MATCH THE CODE`
        : `\n${bad} GENERATED MODULE(S)/REGION(S) DIFFER — run the generator with no --check`);
    process.exit(bad === 0 ? 0 : 1);
}

/**
 * ⛔ EVERY REGION'S MARKERS ARE VALIDATED BEFORE ANY FILE IS WRITTEN. The
 * mutant that deleted README's BEGIN marker refused correctly — but only
 * AFTER the six modules and the two earlier regions had been written, which
 * is a half-done run somebody has to reason about. A refusal that costs
 * nothing is a refusal that can be trusted.
 */
for (const r of regions) regionBody(r);

mkdirSync(OUT, { recursive: true });
for (const f of files) {
    writeFileSync(join(OUT, f.file), f.text);
    console.log(`wrote ${join(OUT, f.file)} (${f.text.split('\n').length} lines)`);
}
for (const r of regions) {
    const before = readFileSync(r.path, 'utf8');
    const after = spliceMarkdownRegion(before, r.table, r.body, { what: r.file });
    if (after !== before) writeFileSync(r.path, after);
    console.log(`${after === before ? 'unchanged' : 'wrote'} ${r.file} `
        + `§ GENERATED:${r.table} (${r.body.split('\n').length} lines)`);
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
console.log(`registry:   ${REGISTRY.columns.length} entries `
    + `(${REGISTRY.columns.map((c) => c.id).join(', ')}), ${REGISTRY.rows.length} fields over `
    + `${REGISTRY.groups.length} groups, ${REGISTRY.libraries.filter((l) => !l.loadable).length} `
    + `library/libraries NOT loadable headless, ${REGISTRY.findings.length} FINDING(S)`);
for (const f of REGISTRY.findings) console.log(`  FINDING [registry] ${f.name} — ${f.severity}`);
console.log(`instruments: ${INSTRUMENTS.counts.files} files over `
    + `${INSTRUMENTS.categories.length} categories, ${INSTRUMENTS.counts.browser} browser rows, `
    + `${INSTRUMENTS.counts.withFlags} with flags, ${INSTRUMENTS.counts.cited} cited by a doc, `
    + `${INSTRUMENTS.findings.length} FINDING(S)`);
for (const f of INSTRUMENTS.findings) {
    console.log(`  FINDING [instruments] ${f.name} — ${f.severity}`);
}
console.log(`docsIndex:  ${DOCS_INDEX.counts.docs} documents (`
    + `${DOCS_INDEX.counts.words.toLocaleString('en-US')} words) + `
    + `${DOCS_INDEX.counts.pages} pages`);

#!/usr/bin/env node
/**
 * generate-tutorial-docs — writes the user guide `.md` of every READY tutorial
 * that names one (`doc`; an in-progress tutorial's guide is not written until
 * it is ready), and the generated lists in the Tutorial panel's own doc
 * (MODULE_DOC: the tutorials by track, and the panels deliberately given no
 * tutorial — ⚖ the user, 2026-10-10), from the tutorial data
 * (`frontend/modules/tutorials/content/`). The Tutorial panel reads the same
 * data, so the guide and the panel cannot disagree. (⚖ the user, 2026-10-10:
 * the guided tour's `.md` is GENERATED from the tutorial data.)
 *
 * ⛓ WHEN TO RUN IT: after editing any tutorial's text. The pin
 * (`frontend/modules/tutorials/tutorials.test.js`) regenerates in memory and
 * fails when a committed guide differs, so a hand edit to the `.md` — or a
 * tutorial edit that skipped this step — is caught by the unit tests.
 *
 * Run:
 *     node scripts/tutorials/generate-tutorial-docs.mjs          # write
 *     node scripts/tutorials/generate-tutorial-docs.mjs --check  # exit 1 on drift
 *     node scripts/tutorials/generate-tutorial-docs.mjs --help   # print usage, write nothing
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from '../procgen/argvHelp.js';
import { TUTORIALS } from '../../frontend/modules/tutorials/content/index.js';
import { NO_TUTORIAL } from '../../frontend/modules/tutorials/content/coverage.js';
import { tutorialMarkdown } from '../../frontend/modules/tutorials/tutorialMarkdown.js';
import { TRACKS, validateTutorial } from '../../frontend/modules/tutorials/tutorialShape.js';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const MODULE_DOC = 'docs/json/user/modules/tutorials.md';
export const LIST_BEGIN = '<!-- BEGIN GENERATED tutorial lists (scripts/tutorials/generate-tutorial-docs.mjs; edit the tutorial data, not this) -->';
export const LIST_END = '<!-- END GENERATED tutorial lists -->';

/** `[{ doc, text }]` — every guide the READY tutorials declare, as it should read. */
export function renderGuides(entries = TUTORIALS) {
    return entries.filter((e) => e.tutorial.doc && e.tutorial.status === 'ready').map(({ source, tutorial }) => {
        validateTutorial(tutorial);
        return { doc: tutorial.doc, text: tutorialMarkdown(tutorial, source) };
    });
}

function entryLine(t) {
    const guide = t.doc && t.status === 'ready'
        ? ` ([guide](${posix.relative(posix.dirname(MODULE_DOC), t.doc)}))` : '';
    return `- **${t.title}**${guide} — ${t.summary} \`?tutorial=${t.id}\``;
}

/** The generated lists in MODULE_DOC, between LIST_BEGIN and LIST_END (exclusive). */
export function renderModuleLists(entries = TUTORIALS, noTutorial = NO_TUTORIAL) {
    const all = entries.map((e) => e.tutorial);
    const out = [];
    const section = (title, list) => {
        if (!list.length) return;
        out.push(`### ${title}`, '', ...list.map(entryLine), '');
    };
    for (const [key, track] of Object.entries(TRACKS)) {
        if (track.collapsed) continue;
        section(track.title, all.filter((t) => t.track === key && t.status === 'ready'));
    }
    const drafts = all.filter((t) => t.status === 'in-progress' && !TRACKS[t.track].collapsed);
    if (drafts.length) {
        out.push('### In progress', '', 'Written, but not working all the way through yet. The panel lists these in a '
            + 'collapsed section and marks the step where each one stops.', '', ...drafts.map(entryLine), '');
    }
    section(`${TRACKS.developer.title} (a collapsed section in the panel)`, all.filter((t) => TRACKS[t.track].collapsed));
    out.push('### Panels with no tutorial', '', 'These panels are deliberately left out of the tutorials:', '',
        '| Panel | Why |', '|---|---|',
        ...Object.values(noTutorial).map(({ title, why }) => `| ${title} | ${why} |`), '');
    return out.join('\n');
}

/** MODULE_DOC with its generated lists replaced by what the data says now. */
export function renderModuleDoc(current) {
    const a = current.indexOf(LIST_BEGIN);
    const b = current.indexOf(LIST_END);
    if (a < 0 || b < a) throw new Error(`${MODULE_DOC}: the ${LIST_BEGIN} … ${LIST_END} markers are missing`);
    return `${current.slice(0, a + LIST_BEGIN.length)}\n\n${renderModuleLists()}\n${current.slice(b)}`;
}

/** Every generated file: the guides, then MODULE_DOC. */
export function renderAll() {
    const moduleDoc = { doc: MODULE_DOC, text: renderModuleDoc(readFileSync(join(REPO, MODULE_DOC), 'utf8')) };
    return [...renderGuides(), moduleDoc];
}

function main(argv) {
    const guides = renderAll();
    if (argv.includes('--check')) {
        const drift = guides.filter(({ doc, text }) => {
            try { return readFileSync(join(REPO, doc), 'utf8') !== text; } catch { return true; }
        });
        for (const { doc } of drift) console.error(`DRIFT: ${doc} differs from what the generator writes — run it without --check.`);
        if (drift.length) process.exit(1);
        console.log(`OK: ${guides.length} generated tutorial doc(s) current.`);
        return;
    }
    for (const { doc, text } of guides) {
        writeFileSync(join(REPO, doc), text);
        console.log(`wrote ${doc}`);
    }
}

argvHelp(import.meta.url);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));

#!/usr/bin/env node
/**
 * generate-tutorial-docs — writes the user guide `.md` of every tutorial that
 * names one (`doc`), from the tutorial's own data
 * (`frontend/modules/tutorials/content/`). The Tutorial panel reads the same
 * data, so the guide and the panel cannot disagree. (⚖ the user, 2026-10-10:
 * the guided tour's `.md` is GENERATED from the tutorial data.)
 *
 * ⛓ WHEN TO RUN IT: after editing any tutorial's text. The pin
 * (`frontend/modules/tutorials/generated.test.js`) regenerates in memory and
 * fails when a committed guide differs, so a hand edit to the `.md` — or a
 * tutorial edit that skipped this step — is caught by the unit tests.
 *
 * Run:
 *     node scripts/tutorials/generate-tutorial-docs.mjs          # write
 *     node scripts/tutorials/generate-tutorial-docs.mjs --check  # exit 1 on drift
 *     node scripts/tutorials/generate-tutorial-docs.mjs --help   # print usage, write nothing
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from '../procgen/argvHelp.js';
import { TUTORIALS } from '../../frontend/modules/tutorials/content/index.js';
import { tutorialMarkdown } from '../../frontend/modules/tutorials/tutorialMarkdown.js';
import { validateTutorial } from '../../frontend/modules/tutorials/tutorialShape.js';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `[{ doc, text }]` — every guide the tutorials declare, as it should read. */
export function renderGuides(entries = TUTORIALS) {
    return entries.filter((e) => e.tutorial.doc).map(({ source, tutorial }) => {
        validateTutorial(tutorial);
        return { doc: tutorial.doc, text: tutorialMarkdown(tutorial, source) };
    });
}

function main(argv) {
    const guides = renderGuides();
    if (argv.includes('--check')) {
        const drift = guides.filter(({ doc, text }) => {
            try { return readFileSync(join(REPO, doc), 'utf8') !== text; } catch { return true; }
        });
        for (const { doc } of drift) console.error(`DRIFT: ${doc} differs from what the generator writes — run it without --check.`);
        if (drift.length) process.exit(1);
        console.log(`OK: ${guides.length} tutorial guide(s) current.`);
        return;
    }
    for (const { doc, text } of guides) {
        writeFileSync(join(REPO, doc), text);
        console.log(`wrote ${doc}`);
    }
}

argvHelp(import.meta.url);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));

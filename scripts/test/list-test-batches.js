#!/usr/bin/env node

/**
 * Print the in-app test batches as a JSON array, for a CI matrix.
 *
 *   node scripts/test/list-test-batches.js --on-push   # what test-templates.yml runs per push
 *   node scripts/test/list-test-batches.js --on-push --changed=<file>
 *                                                      # …less the `pushPaths` batches no pushed path hits
 *   node scripts/test/list-test-batches.js --manual    # the `manual: true` batches (`all` in the manual workflow)
 *   node scripts/test/list-test-batches.js --dispatchable  # what test-substrates-manual.yml accepts by name
 *   node scripts/test/list-test-batches.js             # every batch
 *
 * The source is frontend/modules/tests/testBatches.js (`manual: true`,
 * `pushPaths`), so a new batch joins (or stays off) push by its own
 * definition — the workflow carries no hand list to forget.
 *
 * ⛓ ci-manual-moves — `--changed=<file>`: the pushed paths, one per line, or
 * the single word `ALL`. A batch with `pushPaths` is kept when a path hits its
 * globs or the derived import closure (`scripts/procgen/ciPathFilter.js`) of
 * the test files that register its categories and of the runner's own entries.
 * ⛔ FAIL-OPEN: `ALL`, an
 * unreadable file or a filter that cannot be derived keeps the batch.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
    TEST_BATCHES, listBatchNames, listManualBatches, listOnPushBatches, listPathFilteredBatches,
} from '../../frontend/modules/tests/testBatches.js';

const REPO = join(import.meta.dirname, '..', '..');
const TEST_CASE_DIRS = ['frontend/modules/tests/testCases', 'frontend/modules/tests/testCases-manual',
    'frontend/modules/tests/testCases-wip'];

const args = process.argv.slice(2);
const changedArg = args.find((a) => a.startsWith('--changed='));
const flags = args.filter((a) => a !== changedArg);
if (flags.length > 1 || (changedArg && flags[0] !== '--on-push')) {
    console.error('list-test-batches: one flag at most (--on-push [--changed=<file>] | --manual | --dispatchable)');
    process.exit(2);
}
const [flag] = flags;
const dispatchable = () => [...listManualBatches(), ...listPathFilteredBatches()];
const pick = { '--on-push': listOnPushBatches, '--manual': listManualBatches, '--dispatchable': dispatchable,
    undefined: listBatchNames }[flag];
if (!pick) {
    console.error(`list-test-batches: unknown flag '${flag}' (--on-push | --manual | --dispatchable)`);
    process.exit(2);
}

/**
 * The in-app runner's own entries, whose closure every batch's rows run
 * through: `npm test`'s script (read from package.json), the Playwright spec it
 * drives and the page-side test module.
 */
function runnerEntries() {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
    const npmTest = (/scripts\/[\w./-]+\.m?js/.exec(pkg.scripts?.test ?? '') ?? [])[0];
    if (!npmTest) throw new Error('package.json `test` names no scripts/ entry');
    return [npmTest, 'test_json/e2e/app.spec.js', 'frontend/modules/tests/index.js'];
}

/** The test files that register any of `categories` — derived, never typed. */
function registeringFiles(categories) {
    const out = [];
    for (const dir of TEST_CASE_DIRS) {
        let names = [];
        try { names = readdirSync(join(REPO, dir)); } catch { continue; }
        for (const f of names.filter((n) => n.endsWith('.js')).sort()) {
            const text = readFileSync(join(REPO, dir, f), 'utf8');
            if (categories.some((c) => text.includes(`'${c}'`) || text.includes(`"${c}"`))) out.push(`${dir}/${f}`);
        }
    }
    return out;
}

async function filterByChanged(names) {
    let changed = null;
    try {
        const text = readFileSync(changedArg.slice('--changed='.length), 'utf8');
        if (text.trim() !== 'ALL') changed = text.split('\n').filter((l) => l.trim());
    } catch (e) {
        console.error(`# path filter: ${changedArg} unreadable (${e.message}) — every batch kept`);
    }
    if (changed === null) return names;
    const { closureFilter, pathFilterHits } = await import('../procgen/ciPathFilter.js');
    return names.filter((name) => {
        const batch = TEST_BATCHES[name];
        if (!batch.pushPaths) return true;
        try {
            const entries = [...registeringFiles(batch.categories), ...runnerEntries()];
            const hits = pathFilterHits({ filter: closureFilter({ declared: batch.pushPaths, entries, repo: REPO }),
                changed });
            console.error(`# path filter: batch ${name} — ${hits.length ? `RUNS: ${hits.length} of ${changed.length} `
                + `changed path(s) hit it (${hits.slice(0, 5).join(', ')}${hits.length > 5 ? ', …' : ''})`
                : `SKIPPED: none of ${changed.length} changed path(s) is in its pushPaths or the import closure of `
                + `${entries.length} entry file(s)`}`);
            return hits.length > 0;
        } catch (e) {
            console.error(`# path filter: batch ${name} — filter not derivable (${e.message}); kept`);
            return true;
        }
    });
}

const names = changedArg ? await filterByChanged(pick()) : pick();
console.log(JSON.stringify(names));

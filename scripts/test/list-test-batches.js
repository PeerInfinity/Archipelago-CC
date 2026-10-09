#!/usr/bin/env node

/**
 * Print the in-app test batches as a JSON array, for a CI matrix.
 *
 *   node scripts/test/list-test-batches.js --on-push   # what test-templates.yml runs per push
 *   node scripts/test/list-test-batches.js --manual    # what test-substrates-manual.yml accepts
 *   node scripts/test/list-test-batches.js             # every batch
 *
 * The source is frontend/modules/tests/testBatches.js (`manual: true`), so a
 * new batch joins (or stays off) push by its own definition — the workflow
 * carries no hand list to forget.
 */

import {
    listBatchNames, listManualBatches, listOnPushBatches,
} from '../../frontend/modules/tests/testBatches.js';

const [flag, ...rest] = process.argv.slice(2);
if (rest.length) {
    console.error('list-test-batches: one flag at most (--on-push | --manual)');
    process.exit(2);
}
const pick = { '--on-push': listOnPushBatches, '--manual': listManualBatches, undefined: listBatchNames }[flag];
if (!pick) {
    console.error(`list-test-batches: unknown flag '${flag}' (--on-push | --manual)`);
    process.exit(2);
}
console.log(JSON.stringify(pick()));

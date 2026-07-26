/**
 * Test batches — named subsets of the in-app roster, selected with
 * `?testBatch=<name>` (see run-tests.js `--batch`).
 *
 * WHY: the in-app runner races the whole roster against one wall-clock budget
 * (AUTO_START_TIMEOUT_MS in testLogic.js). test-substrates outgrew it — three
 * real-time omsi bot walks were ~70% of the suite's 540 s, so a slow machine
 * pushed the run past the cap and the tail never ran. Batching splits the
 * roster so each half fits its budget with room to spare.
 *
 * A batch selects whole CATEGORIES, never individual ids: a category is a
 * property of the test's own registration, so a batch definition cannot drift
 * away from a renamed or deleted test the way an id list would.
 *
 * The default batch absorbs every category no other batch claims. That is the
 * important property: a NEW test category nobody thought about still RUNS
 * (in the default batch) instead of silently belonging to no batch and never
 * executing. Forgetting to classify costs you speed, never coverage.
 */

export const TEST_BATCHES = Object.freeze({
    fast: Object.freeze({
        description:
            'Everything except the real-time bot walks. The whole roster minus '
            + 'the omsi bot legs runs in roughly two and a half minutes.',
        // The default batch: claims every category not listed by another batch.
        isDefault: true,
        categories: Object.freeze([]),
    }),
    'bot-walks': Object.freeze({
        description:
            'The real-time bot walks. These drive an actual game loop at human '
            + 'pace across loop resets, so they are minutes each BY DESIGN — '
            + 'omsi-bot-multi-reset-walk alone is over half the full suite. They '
            + 'are the only real-time coverage of a bot walk, which is why they '
            + 'are quarantined rather than sped up: an Instant variant cannot '
            + 'witness a real-time defect.',
        categories: Object.freeze(['Omsi bot walks']),
    }),
});

/** The batch that claims categories no other batch lists. */
export function getDefaultBatchName() {
    const found = Object.keys(TEST_BATCHES).find((name) => TEST_BATCHES[name].isDefault);
    if (!found) throw new Error('testBatches: no batch is marked isDefault');
    return found;
}

/**
 * Categories explicitly claimed by a non-default batch. Throws if two batches
 * claim the same category — that would make batch membership order-dependent,
 * and a test would run twice or (worse) be quietly dropped from one run.
 */
function claimedCategories() {
    const owner = new Map();
    for (const [name, batch] of Object.entries(TEST_BATCHES)) {
        if (batch.isDefault) continue;
        for (const category of batch.categories) {
            if (owner.has(category)) {
                throw new Error(
                    `testBatches: category '${category}' is claimed by both `
                    + `'${owner.get(category)}' and '${name}'`
                );
            }
            owner.set(category, name);
        }
    }
    return owner;
}

/**
 * Does `category` belong to `batchName`?
 *
 * Unknown category + default batch => true, deliberately: that is the
 * "nobody classified this yet, so run it" path described above.
 */
export function categoryInBatch(category, batchName) {
    const batch = TEST_BATCHES[batchName];
    if (!batch) throw new Error(`testBatches: unknown batch '${batchName}'`);
    if (!batch.isDefault) return batch.categories.includes(category);
    return !claimedCategories().has(category);
}

/** Names of all defined batches, for error messages and tooling. */
export function listBatchNames() {
    return Object.keys(TEST_BATCHES);
}

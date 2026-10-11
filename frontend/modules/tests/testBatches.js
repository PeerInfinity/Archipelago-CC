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
 * ONE exception, per ROW: a row of a MANUAL batch's category may carry
 * `"batch": "<on-push batch>"` in the substrates config
 * (frontend/test-configs/playwright_tests_config-substrates.json) — the
 * SMOKE row that keeps one cheap boot-and-move of a manual substrate on push,
 * so a shared-code change that breaks its loading is still caught. That is
 * the only use the module accepts (batchOfTest() refuses any other), at most
 * one per manual batch (assertRowOverrides()), and dropping one is deleting
 * that one line of config.
 *
 * MANUAL batches (`manual: true`) never run on push; CI enumerates the
 * on-push batches from this table (scripts/test/list-test-batches.mjs), not
 * from a hand list in the workflow.
 *
 * The default batch absorbs every category no other batch claims. That is the
 * important property: a NEW test category nobody thought about still RUNS
 * (in the default batch) instead of silently belonging to no batch and never
 * executing. Forgetting to classify costs you speed, never coverage.
 */

export const TEST_BATCHES = Object.freeze({
    fast: Object.freeze({
        description:
            'Everything no other batch claims, plus each manual batch\'s one '
            + 'smoke row. CI runs it on push (test-templates.yml, one matrix '
            + 'job per on-push batch); its time is in each run\'s results file, '
            + 'not here.',
        // The default batch: claims every category not listed by another batch.
        isDefault: true,
        categories: Object.freeze([]),
    }),
    'seedling-js': Object.freeze({
        description:
            'The Seedling JS/wasm runtime rows: real game boots and bot/solver '
            + 'walks, the costliest on-push category, so they get a budget of '
            + 'their own instead of starving the tail of fast. On push.',
        categories: Object.freeze(['Seedling JS runtime']),
    }),
    apworld: Object.freeze({
        description:
            'The apworld editor rows. Over half of the substrate roster, so '
            + 'they get a budget of their own; on push, as its own matrix job.',
        categories: Object.freeze(['apworldEditor']),
    }),
    'bot-walks': Object.freeze({
        description:
            'The real-time bot walks. These drive an actual game loop at human '
            + 'pace across loop resets, so they are minutes each BY DESIGN — '
            + 'omsi-bot-multi-reset-walk alone is over half the full suite. They '
            + 'are the only real-time coverage of a bot walk, which is why they '
            + 'are quarantined rather than sped up: an Instant variant cannot '
            + 'witness a real-time defect. Manual (test-substrates-manual.yml).',
        manual: true,
        categories: Object.freeze(['Omsi bot walks']),
    }),
    noiz2sa: Object.freeze({
        description:
            'The noiz2sa (bulletml-dodge) substrate rows. Manual by the user\'s '
            + 'ruling (2026-10-09); one smoke row stays on push via its config '
            + '`batch` field.',
        manual: true,
        categories: Object.freeze(['noiz2saSubstrate']),
    }),
    runner: Object.freeze({
        description:
            'The runner substrate rows (runnerDemo + Runner block modes). Manual '
            + 'by the user\'s ruling (2026-10-09); one smoke row stays on push via '
            + 'its config `batch` field.',
        manual: true,
        categories: Object.freeze(['runnerDemo', 'Runner block modes']),
    }),
    tutorials: Object.freeze({
        description:
            'The Tutorial panel rows and one walk row per tutorial (each tutorial '
            + 'played with Do it and graded by its first-failing-step ratchet). '
            + 'Manual by the user\'s ruling (2026-10-10, "manual for now"); one '
            + 'smoke row stays on push via its config `batch` field.',
        manual: true,
        categories: Object.freeze(['Tutorials', 'Tutorial walks']),
    }),
    'tutorials-procgen': Object.freeze({
        description:
            'The Procgen track\'s tutorial walk rows: each generates a world, '
            + 'loads it and plays it to the end (or to its recorded first failing '
            + 'step). Split from tutorials on 2026-10-10, when the walks reached '
            + '81 % of that batch\'s budget. Manual, like tutorials.',
        manual: true,
        categories: Object.freeze(['Tutorial walks: procgen']),
    }),
    'tutorials-tracker': Object.freeze({
        description:
            'The Tracking track\'s tutorial walk rows (ALTTP seed 1, loaded fresh '
            + 'by each). Split from tutorials on 2026-10-10, when its span reached '
            + '88 % of that batch\'s budget with the tracker walks in it. Manual, '
            + 'like tutorials.',
        manual: true,
        categories: Object.freeze(['Tutorial walks: tracker']),
    }),
});

/** The batch that claims categories no other batch lists. */
export function getDefaultBatchName() {
    const found = Object.keys(TEST_BATCHES).find((name) => TEST_BATCHES[name].isDefault);
    if (!found) throw new Error('testBatches: no batch is marked isDefault');
    if (TEST_BATCHES[found].manual) {
        // The default batch is where unclassified categories land; a manual
        // default would quietly take them off push.
        throw new Error(`testBatches: the default batch '${found}' is marked manual`);
    }
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

function requireBatch(batchName) {
    const batch = TEST_BATCHES[batchName];
    if (!batch) throw new Error(`testBatches: unknown batch '${batchName}'`);
    return batch;
}

/** The batch a CATEGORY belongs to, ignoring any per-row override. */
export function batchOfCategory(category) {
    return claimedCategories().get(category) ?? getDefaultBatchName();
}

/**
 * Does `category` belong to `batchName`?
 *
 * Unknown category + default batch => true, deliberately: that is the
 * "nobody classified this yet, so run it" path described above.
 */
export function categoryInBatch(category, batchName) {
    requireBatch(batchName);
    return batchOfCategory(category) === batchName;
}

/**
 * The ONE batch a row belongs to: its config `batch` override when it has one,
 * otherwise its category's batch. The override is accepted only as a smoke
 * row — a row of a MANUAL batch's category moved to an ON-PUSH batch — and is
 * refused otherwise, naming the row, so the field cannot become a second,
 * id-based way to classify tests.
 */
export function batchOfTest(test) {
    const own = batchOfCategory(test.category);
    if (test.batch === undefined || test.batch === null) return own;
    const target = requireBatchForRow(test);
    if (!TEST_BATCHES[own].manual) {
        throw new Error(
            `testBatches: row '${test.id}' overrides its batch to '${test.batch}', but its `
            + `category '${test.category}' is in the on-push batch '${own}' — a row override `
            + 'is only for a manual batch\'s smoke row'
        );
    }
    if (target.manual) {
        throw new Error(
            `testBatches: row '${test.id}' overrides its batch to the manual batch `
            + `'${test.batch}' — a smoke row override must name an on-push batch`
        );
    }
    return test.batch;
}

function requireBatchForRow(test) {
    const batch = TEST_BATCHES[test.batch];
    if (!batch) {
        throw new Error(`testBatches: row '${test.id}' names unknown batch '${test.batch}'`);
    }
    return batch;
}

/** Does this row (`{id, category, batch?}`) run in `batchName`? */
export function testInBatch(test, batchName) {
    requireBatch(batchName);
    return batchOfTest(test) === batchName;
}

/**
 * Refuse a roster in which a manual batch has more than one smoke row (the
 * ruling is ONE cheap row per manual substrate). Also validates every override
 * through batchOfTest(). Returns Map<manualBatch, rowId>.
 */
export function assertRowOverrides(tests) {
    const smoke = new Map();
    for (const test of tests) {
        if (test.batch === undefined || test.batch === null) continue;
        batchOfTest(test);
        const manual = batchOfCategory(test.category);
        if (smoke.has(manual)) {
            throw new Error(
                `testBatches: manual batch '${manual}' has two smoke rows, `
                + `'${smoke.get(manual)}' and '${test.id}' — keep exactly one`
            );
        }
        smoke.set(manual, test.id);
    }
    return smoke;
}

/** Names of all defined batches, for error messages and tooling. */
export function listBatchNames() {
    return Object.keys(TEST_BATCHES);
}

/** The batches CI runs on push — every batch not marked `manual`. */
export function listOnPushBatches() {
    return listBatchNames().filter((name) => !TEST_BATCHES[name].manual);
}

/** The batches that run only on demand (test-substrates-manual.yml). */
export function listManualBatches() {
    return listBatchNames().filter((name) => TEST_BATCHES[name].manual);
}

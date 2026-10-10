import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    TEST_BATCHES, assertRowOverrides, batchOfTest, categoryInBatch, getDefaultBatchName,
    listBatchNames, listManualBatches, listOnPushBatches, testInBatch,
} from './testBatches.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The enabled substrate rows (id, category, batch override), read off the config — not typed. */
function substrateRows() {
    const config = JSON.parse(readFileSync(
        join(REPO, 'frontend/test-configs/playwright_tests_config-substrates.json'), 'utf8'));
    return Object.values(config.tests)
        .filter((t) => t.enabled ?? config.defaultEnabledState);
}

/** Import a copy of testBatches.js with `from` replaced by `to`. */
async function patchedModule(from, to) {
    const source = readFileSync(join(REPO, 'frontend/modules/tests/testBatches.js'), 'utf8');
    const patched = source.replace(from, to);
    expect(patched, `patch target not found: ${from}`).not.toBe(source);
    const url = `data:text/javascript;base64,${Buffer.from(patched).toString('base64')}`;
    return import(/* @vite-ignore */ url);
}

describe('testBatches', () => {
    it('fast is the default batch', () => {
        expect(getDefaultBatchName()).toBe('fast');
    });

    it('apworld claims apworldEditor, and fast no longer does', () => {
        expect(listBatchNames()).toContain('apworld');
        expect(categoryInBatch('apworldEditor', 'apworld')).toBe(true);
        expect(categoryInBatch('apworldEditor', 'fast')).toBe(false);
        expect(categoryInBatch('Omsi substrate', 'apworld')).toBe(false);
    });

    it('bot-walks still claims the omsi bot walks', () => {
        expect(categoryInBatch('Omsi bot walks', 'bot-walks')).toBe(true);
        expect(categoryInBatch('Omsi bot walks', 'fast')).toBe(false);
    });

    it('an unclassified category runs in the default batch, and only there', () => {
        const nobody = 'a category nobody classified';
        expect(categoryInBatch(nobody, 'fast')).toBe(true);
        expect(categoryInBatch(nobody, 'apworld')).toBe(false);
        expect(categoryInBatch(nobody, 'bot-walks')).toBe(false);
    });

    it('every enabled substrate row lands in exactly one batch', () => {
        const rows = substrateRows();
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            const owners = listBatchNames().filter((b) => testInBatch(row, b));
            expect(owners, row.id).toHaveLength(1);
        }
        // Each batch selects at least one row of the live roster.
        for (const batch of listBatchNames()) {
            expect(rows.some((r) => testInBatch(r, batch)), batch).toBe(true);
        }
    });

    it('seedling-js claims the Seedling JS runtime rows, on push', () => {
        expect(categoryInBatch('Seedling JS runtime', 'seedling-js')).toBe(true);
        expect(categoryInBatch('Seedling JS runtime', 'fast')).toBe(false);
        expect(listOnPushBatches()).toContain('seedling-js');
    });

    it('noiz2sa and runner claim their categories, and fast no longer does', () => {
        expect(categoryInBatch('noiz2saSubstrate', 'noiz2sa')).toBe(true);
        expect(categoryInBatch('runnerDemo', 'runner')).toBe(true);
        expect(categoryInBatch('Runner block modes', 'runner')).toBe(true);
        for (const c of ['noiz2saSubstrate', 'runnerDemo', 'Runner block modes']) {
            expect(categoryInBatch(c, 'fast'), c).toBe(false);
        }
    });

    it('tutorials claims the Tutorial panel rows and the walk rows, and fast no longer does', () => {
        for (const c of ['Tutorials', 'Tutorial walks']) {
            expect(categoryInBatch(c, 'tutorials'), c).toBe(true);
            expect(categoryInBatch(c, 'fast'), c).toBe(false);
        }
    });

    describe('manual vs on push', () => {
        it('the user\'s manual batches are manual (rulings 2026-09-27, 2026-10-09, 2026-10-10)', () => {
            expect(listManualBatches()).toEqual(expect.arrayContaining(['bot-walks', 'noiz2sa', 'runner', 'tutorials']));
        });

        it('on push = every batch not marked manual, the default among them', () => {
            const manual = new Set(listManualBatches());
            expect(listOnPushBatches()).toEqual(listBatchNames().filter((b) => !manual.has(b)));
            expect(listOnPushBatches()).toEqual(expect.arrayContaining(['fast', 'seedling-js', 'apworld']));
            expect(listOnPushBatches()).toContain(getDefaultBatchName());
            for (const b of listManualBatches()) expect(listOnPushBatches()).not.toContain(b);
        });

        it('a manual default batch is refused (unclassified categories would leave push)', async () => {
            const m = await patchedModule(
                'isDefault: true,', 'isDefault: true,\n        manual: true,');
            expect(() => m.getDefaultBatchName()).toThrow(/default batch 'fast' is marked manual/);
        });
    });

    describe('smoke rows (the per-row config `batch` override)', () => {
        it('each manual batch with live rows keeps at most one smoke row on push; noiz2sa, runner and tutorials exactly one', () => {
            const smoke = assertRowOverrides(substrateRows());
            for (const b of ['noiz2sa', 'runner', 'tutorials']) expect(smoke.has(b), b).toBe(true);
            for (const [manual, id] of smoke) {
                expect(TEST_BATCHES[manual].manual, manual).toBe(true);
                const row = substrateRows().find((r) => r.id === id);
                expect(testInBatch(row, manual), id).toBe(false);
                expect(TEST_BATCHES[batchOfTest(row)].manual, id).toBeFalsy();
            }
        });

        it('the smoke override wins over the category', () => {
            const row = { id: 'x', category: 'noiz2saSubstrate', batch: 'fast' };
            expect(testInBatch(row, 'fast')).toBe(true);
            expect(testInBatch(row, 'noiz2sa')).toBe(false);
            expect(testInBatch({ id: 'y', category: 'noiz2saSubstrate' }, 'noiz2sa')).toBe(true);
        });

        it('an override on an on-push category is refused', () => {
            expect(() => batchOfTest({ id: 'x', category: 'apworldEditor', batch: 'fast' }))
                .toThrow(/row 'x'.*on-push batch 'apworld'/);
        });

        it('an override INTO a manual batch is refused', () => {
            expect(() => batchOfTest({ id: 'x', category: 'noiz2saSubstrate', batch: 'runner' }))
                .toThrow(/manual batch 'runner'/);
        });

        it('an override naming an unknown batch is refused', () => {
            expect(() => batchOfTest({ id: 'x', category: 'noiz2saSubstrate', batch: 'nope' }))
                .toThrow(/unknown batch 'nope'/);
        });

        it('two smoke rows for one manual batch are refused', () => {
            expect(() => assertRowOverrides([
                { id: 'a', category: 'runnerDemo', batch: 'fast' },
                { id: 'b', category: 'Runner block modes', batch: 'seedling-js' },
            ])).toThrow(/'runner' has two smoke rows, 'a' and 'b'/);
        });
    });

    it('an unknown batch name throws', () => {
        expect(() => categoryInBatch('apworldEditor', 'no-such-batch')).toThrow(/unknown batch/);
    });

    describe('the collision guard', () => {
        // TEST_BATCHES is frozen, so the guard is asked of a copy of the
        // module whose apworld batch also claims a category bot-walks owns.
        it('throws naming both batches when two batches claim one category', async () => {
            const patched = await patchedModule(
                "categories: Object.freeze(['apworldEditor']),",
                "categories: Object.freeze(['apworldEditor', 'Omsi bot walks']),",
            );
            expect(() => patched.categoryInBatch('Omsi substrate', 'fast'))
                .toThrow(/'Omsi bot walks' is claimed by both 'apworld' and 'bot-walks'/);
        });
    });

    it('the batch table is frozen', () => {
        expect(Object.isFrozen(TEST_BATCHES)).toBe(true);
        expect(Object.isFrozen(TEST_BATCHES.apworld.categories)).toBe(true);
    });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    TEST_BATCHES, categoryInBatch, getDefaultBatchName, listBatchNames,
} from './testBatches.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The enabled substrate rows' categories, read off the config — not typed. */
function substrateCategories() {
    const config = JSON.parse(readFileSync(
        join(REPO, 'frontend/test-configs/playwright_tests_config-substrates.json'), 'utf8'));
    return Object.values(config.tests)
        .filter((t) => t.enabled ?? config.defaultEnabledState)
        .map((t) => t.category);
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
        const categories = substrateCategories();
        expect(categories.length).toBeGreaterThan(0);
        for (const category of categories) {
            const owners = listBatchNames().filter((b) => categoryInBatch(category, b));
            expect(owners, category).toHaveLength(1);
        }
        // Each batch selects at least one row of the live roster.
        for (const batch of listBatchNames()) {
            expect(categories.some((c) => categoryInBatch(c, batch)), batch).toBe(true);
        }
    });

    it('an unknown batch name throws', () => {
        expect(() => categoryInBatch('apworldEditor', 'no-such-batch')).toThrow(/unknown batch/);
    });

    describe('the collision guard', () => {
        // TEST_BATCHES is frozen, so the guard is asked of a copy of the
        // module whose apworld batch also claims a category bot-walks owns.
        it('throws naming both batches when two batches claim one category', async () => {
            const source = readFileSync(join(REPO, 'frontend/modules/tests/testBatches.js'), 'utf8');
            const doubled = source.replace(
                "categories: Object.freeze(['apworldEditor']),",
                "categories: Object.freeze(['apworldEditor', 'Omsi bot walks']),",
            );
            expect(doubled).not.toBe(source);
            const url = `data:text/javascript;base64,${Buffer.from(doubled).toString('base64')}`;
            const patched = await import(/* @vite-ignore */ url);
            expect(() => patched.categoryInBatch('Omsi substrate', 'fast'))
                .toThrow(/'Omsi bot walks' is claimed by both 'bot-walks' and 'apworld'/);
        });
    });

    it('the batch table is frozen', () => {
        expect(Object.isFrozen(TEST_BATCHES)).toBe(true);
        expect(Object.isFrozen(TEST_BATCHES.apworld.categories)).toBe(true);
    });
});

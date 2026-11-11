/**
 * The body of the C4 setup-file probes (`contentPreloadSetup.test.js` in the
 * default tier, `contentPreloadSetup.slow.test.js` in the slow tier): a fixture
 * registry entry declaring a COMMITTED pack as its default, registered at
 * COLLECTION time (as a substrate library's import registers its entry), must
 * find that pack preloaded — at collection already, and when the tests run —
 * which only the `setupFiles` hook (`scripts/test/vitestDefaultContentSetup.js`)
 * does.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { parseRegistry } from '../contentPacks/contentPacks.js';
import {
    DEFAULT_CONTENT_PACK_FIELD, defaultContentPreloadCalls, defaultContentSetOf, preloadedDefaultContentPacks,
    resetDefaultContentCache,
} from './worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function defineSetupProbe(tier) {
    const [pack] = parseRegistry(JSON.parse(readFileSync(join(ROOT, 'frontend/packs/packs.json'), 'utf8'))).packs;
    const id = `c4-setup-probe-${tier}`;
    // Collection time: the hook's beforeAll has not run yet.
    substrateRegistry.entries.set(id, { id, [DEFAULT_CONTENT_PACK_FIELD]: pack });
    // A world built while the file is collected (before any beforeAll) finds it too.
    const atCollection = preloadedDefaultContentPacks();
    afterAll(() => {
        substrateRegistry.entries.delete(id);
        resetDefaultContentCache();
    });
    describe(`⛓ C4 the ${tier} tier's setupFiles hook preloads the default packs before the tests run`, () => {
        it(`a pack an entry declared at collection (${pack}) is preloaded, and the set builds synchronously`, () => {
            expect(defaultContentPreloadCalls()).toBeGreaterThanOrEqual(1);
            expect(preloadedDefaultContentPacks()).toContain(pack);
            expect(defaultContentSetOf([pack]).ids).toEqual([pack]);
            expect(atCollection).toContain(pack);
        });
    });
}

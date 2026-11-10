/**
 * ⛓ CONTENT SETS C4 — the default tier's `setupFiles` hook is reached
 * (`contentPreloadSetupProbe.js`), and every vitest config names the hook.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEFAULT_CONTENT_PACK_FIELD } from './worldContent.js';
import { defineSetupProbe } from './contentPreloadSetupProbe.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HOOK = 'scripts/test/vitestDefaultContentSetup.js';

defineSetupProbe('default');

describe('⛓ C4 every vitest config runs the hook', () => {
    const configs = readFileSync(join(ROOT, 'package.json'), 'utf8').match(/vitest[.a-z]*\.config\.js/g) ?? [];
    const all = [...new Set(['vitest.config.js', ...configs])];
    it('the configs package.json runs, and the default one, each list the hook in setupFiles', () => {
        expect(all.length).toBeGreaterThan(1);
        for (const cfg of all) {
            const text = readFileSync(join(ROOT, cfg), 'utf8');
            expect(text, cfg).toMatch(new RegExp(`setupFiles: \\[[^\\]]*'${HOOK.replace(/[.]/g, '\\.')}'`));
        }
    });
    it('the hook asks the registry about the field worldContent names', () => {
        // ⛔ Read, not imported: importing the hook module would register its beforeAll HERE, and the
        //   probe above would pass with no setupFiles at all (measured).
        const hook = readFileSync(join(ROOT, HOOK), 'utf8');
        expect(hook).toContain(`export const SETUP_DEFAULT_PACK_FIELD = '${DEFAULT_CONTENT_PACK_FIELD}';`);
    });
});

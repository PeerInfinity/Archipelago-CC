/**
 * The hoisted readback comparison (EDITOR INTEGRATION M1; plan §17.2.5).
 *
 * ⛔ THE FIRST ROW IS THE MODULE'S WHOLE REASON FOR EXISTING. It was hoisted
 * out of `watchWasm.js` so `flashPanel/seedlingLevelSetDelivery.js` could stop
 * restating it, and that is only true while this file imports NOTHING — one
 * import and the bundle cost the restatement was avoiding comes straight back.
 * A source assertion is the only thing that can see that; the behaviour rows
 * below are green either way.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { READBACK_FIELDS, levelSetDisagreement } from './levelSetDisagreement.js';
import { levelSetDisagreement as viaWatchWasm } from './watchWasm.js';
import { readbackDisagreement } from '../flashPanel/seedlingLevelSetDelivery.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'levelSetDisagreement.js'), 'utf8');

describe('levelSetDisagreement — the hoist', () => {
    it('imports NOTHING — the property that makes it importable from the bundle', () => {
        const imports = SOURCE.split('\n')
            .filter((l) => /^\s*(import\b|export\s+(\*|\{)[^=]*\bfrom\b)/.test(l));
        expect(imports).toEqual([]);
    });

    it('is the SAME function both former restatements now use', () => {
        // watchWasm re-exports it (watchViewer.js and watchWasm.test.js keep
        // their spelling); the delivery imports it and re-exports it as
        // `readbackDisagreement`. Two aliases, one implementation.
        expect(viaWatchWasm).toBe(levelSetDisagreement);
        expect(readbackDisagreement).toBe(levelSetDisagreement);
    });

    /**
     * ⛔⛔ THE ROW THAT WOULD HAVE CAUGHT THE HOIST'S OWN DEFECT, and it is a
     * source row because nothing in node can drive the call site.
     *
     * `watchWasm.js` was first written as a bare `export { levelSetDisagreement }
     * from './levelSetDisagreement.js';` — which creates NO LOCAL BINDING. But
     * `shipToWasm` CALLS the function itself. `node --check` was happy; every
     * row in this file was happy, because they import the SYMBOL and the
     * re-export resolves; and the page threw `levelSetDisagreement is not
     * defined` the instant a level set mounted. Only
     * `check-seedling-wasm-pages.mjs`'s GENERATE arm drives that path, and it
     * cost four browser runs and a bisect to attribute.
     *
     * So: a module that CALLS a hoisted symbol must IMPORT it, not merely
     * re-export it. The same trap was made and caught by reading in
     * `flashPanel/seedlingLevelSetDelivery.js` an hour earlier.
     */
    it('every module that CALLS this function also IMPORTS it — a bare re-export has no local binding', () => {
        const bare = /export\s*\{[^}]*\}\s*from\s*['"][^'"]*levelSetDisagreement\.js['"]/;
        for (const rel of ['./watchWasm.js', '../flashPanel/seedlingLevelSetDelivery.js']) {
            const src = readFileSync(join(HERE, rel), 'utf8');
            const calls = /levelSetDisagreement\s*\(|readbackDisagreement\s*\(/.test(src);
            if (!calls) continue;
            expect(bare.test(src), `${rel} re-exports without importing, and it CALLS the function`)
                .toBe(false);
            expect(/^import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*levelSetDisagreement\.js['"]/m.test(src),
                `${rel} must IMPORT the symbol it calls`).toBe(true);
        }
    });

    it('⚠ and that scan is NOT vacuous — it sees the bare form when one is there', () => {
        const bare = /export\s*\{[^}]*\}\s*from\s*['"][^'"]*levelSetDisagreement\.js['"]/;
        expect(bare.test("export { levelSetDisagreement } from './levelSetDisagreement.js';")).toBe(true);
        expect(bare.test("import { levelSetDisagreement } from './levelSetDisagreement.js';")).toBe(false);
    });

    it('names the FIELD that disagrees, never just "the readback disagrees"', () => {
        const sent = { set_id: 'seedling-ap-record-abcd1234', rooms: new Array(116), start: { level: 0 } };
        expect(levelSetDisagreement(sent, null)).toMatch(/answered nothing/);
        expect(levelSetDisagreement(sent, { error: 'chunk 1 of 9 missing' }))
            .toMatch(/level-set error: "chunk 1 of 9 missing"/);
        expect(levelSetDisagreement(sent, { active: 'seedling-vanilla-record-1040ace1', table_levels: 116, start_level: 0 }))
            .toBe('active seedling-vanilla-record-1040ace1 ≠ seedling-ap-record-abcd1234');
        expect(levelSetDisagreement(sent, { active: sent.set_id, table_levels: 9, start_level: 0 }))
            .toBe('table_levels 9 ≠ 116');
        expect(levelSetDisagreement(sent, { active: sent.set_id, table_levels: 116, start_level: 7 }))
            .toBe('start_level 7 ≠ 0');
        expect(levelSetDisagreement(sent, { active: sent.set_id, table_levels: 116, start_level: 0 })).toBeNull();
    });

    it('declares the three fields it compares', () => {
        expect(READBACK_FIELDS).toEqual(['active', 'table_levels', 'start_level']);
        for (const f of READBACK_FIELDS) expect(SOURCE).toContain(`back.${f}`);
    });
});

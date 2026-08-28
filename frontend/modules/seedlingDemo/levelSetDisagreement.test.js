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

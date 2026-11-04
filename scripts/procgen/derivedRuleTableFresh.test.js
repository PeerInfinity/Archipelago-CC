/**
 * ⛓ GUARD 3 ON PUSH (session tile-rules-automation-r-a3; js-16's condition 1 for keeping the shared/ submodule's files in
 * `engineMd5`): the committed derived-rule table is FRESH against its inputs — the committed maze preset's world payloads
 * and the CONTENT of the certifier's import closure (a `shared/` gitlink bump that touches a closure file changes it; one
 * that misses the closure does not). Default tier, so it runs in the JavaScript Unit Tests shards on a push to ANY branch,
 * including a gitlink-only push (the workflow's `frontend/**` path filter takes the gitlink). The failure IS the recipe.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readDerivedRuleTable, tableStaleness, MAZE_PRESET, REGEN_RECIPE } from './seedlingDerivedRuleTable.js';

describe('the committed derived-rule table is fresh against its inputs', () => {
    it('payloadMd5 and engineMd5 match (else: regenerate it — the message says how)', () => {
        const table = readDerivedRuleTable();
        expect(table.rows.length).toBeGreaterThan(0);
        const stale = tableStaleness(table, JSON.parse(readFileSync(MAZE_PRESET, 'utf8')));
        expect(stale, stale.join('\n')).toEqual([]);
    });
    it('the recipe a bump slice runs alone names the probe, the write, the same-packet commit and the review rule', () => {
        expect(REGEN_RECIPE).toMatch(/gh workflow run seedling-probe\.yml/);
        expect(REGEN_RECIPE).toMatch(/make-seedling-playthrough-rules\.mjs/);
        expect(REGEN_RECIPE).toMatch(/COMMIT THE TABLE IN THE SAME PACKET/);
        expect(REGEN_RECIPE).toMatch(/VERDICTS move.*designer review before js-16 slots it/s);
    });
});

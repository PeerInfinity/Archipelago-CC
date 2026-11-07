/**
 * The event-layer BINDING witnesses (slice rules-sharedbinding-witnesses; rules-4's R-A3 ruling (c): "re-admit only with
 * a GAME witness for the binding"). The game half is `fixtures/binding-witness/oracle.json`
 * (`probe-seedling-cleartag.mjs --set=bindings --repeat=8 --record`, the default build); these rows hold the node half
 * against it: each witness asks the compiled layer's OWN binding, its committed tape replays to the game's stream with
 * exactly the bound event written, and the ledger (`scripts/procgen/seedling-binding-witnesses.json`) is what the tapes
 * and the recording derive (`plan-seedling-binding-witness.mjs --check` re-solves the tapes as well).
 *
 * ── MUTATIONS (predicted, then run) ──
 *   m1 a witness's `event` names another event of the layer → "asks the layer's own binding" reds (bindingMismatches).
 *   m2 one recorded run's `writes.bound` gains another event → "the ledger is what the recording derives" reds (7/8).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { compactTicks } from './fidelityStepOff.js';
import { BINDING_WITNESSES, bindingMismatches, eventLayerFlags, splitWrites } from './fidelityBindings.js';
import { ledgerEntry, tapeFile, LEDGER_FILE, ORACLE_FILE } from '../../../scripts/procgen/plan-seedling-binding-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const AP1 = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const ORACLE = JSON.parse(readFileSync(ORACLE_FILE, 'utf8'));
const LEDGER = JSON.parse(readFileSync(LEDGER_FILE, 'utf8'));
const LAYER = eventLayerFlags(AP1);
const SRC = atlasLevelSource();

describe('the binding witnesses', () => {
    it('splitWrites separates the layer\'s events from writes it binds to nothing', () => {
        const layer = new Map([['63:1', { name: 'E' }]]);
        expect(splitWrites([{ level: 61, tag: 1 }, { level: 63, tag: 1 }], layer)).toEqual({ bound: ['E'], unbound: ['61:1'] });
        expect(splitWrites(null, layer)).toEqual({ bound: [], unbound: [] });
    });
    it(`the recording is the default build, ${ORACLE.repeat} runs per arm`, () => {
        expect(ORACLE.build).toBe('seedling_bot_ap_p4g');
        expect(ORACLE.repeat).toBe(8);
        expect(ORACLE.arms.length).toBe(BINDING_WITNESSES.length * 3 * 8);
    });
    for (const w of BINDING_WITNESSES) {
        it(`${w.key}: asks the layer's own binding of "${w.event}"`, () => {
            expect(bindingMismatches(w, AP1)).toEqual([]);
            expect(bindingMismatches({ ...w, event: 'another' }, AP1)).toHaveLength(1);
        });
        it(`${w.key}: the committed tape replays to the game's stream, writing exactly "${w.event}" of the layer`, () => {
            const m = runTape(parseTape(JSON.parse(readFileSync(tapeFile(w), 'utf8'))), { levelSource: SRC });
            expect(splitWrites(m.earnedClears, LAYER).bound).toEqual([w.event]);
            const { why, entry } = ledgerEntry(w, tapeFile(w), ORACLE, { solveTicks: compactTicks(m.ticks) });
            expect(why).toEqual([]);
            expect(LEDGER.witnesses.find((e) => e.event === w.event)).toEqual(entry);
        });
    }
    it('a run whose game wrote another event of the layer fails the ledger (m2)', () => {
        const w = BINDING_WITNESSES[0];
        const bad = structuredClone(ORACLE);
        bad.arms.find((a) => a.arm === `${w.key}-solve`).writes.bound.push('another');
        expect(ledgerEntry(w, tapeFile(w), bad).why.join(' ')).toMatch(/solve passed 7\/8 runs/);
    });
});

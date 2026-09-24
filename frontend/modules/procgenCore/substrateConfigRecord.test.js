/**
 * procgenCore/substrateConfigRecord — **THE RECORDED CONFIG, ASKED OF THE
 * REGISTRY AND OF THE COMPILE** (APWORLD SUBSTRATE CHANGE R6b).
 *
 * ⛔ No substrate is named here: every population is read off the registry —
 * the declarers of `applyPipelineConfig` (the law's population) and of
 * `recordablePipelineConfig` (the slot's), and, for the writer rows, the zone
 * content sources among them. The accepted keys are the entry's own declared
 * `pipelineConfigKeys`, never typed here.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { PIPELINE_CONFIG_KEYS_SLOT, RECORDABLE_CONFIG_HOOK } from './substrateConfigRecord.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const ENTRIES = substrateRegistry.getAll();
const APPLIERS = ENTRIES.filter((e) => typeof e.applyPipelineConfig === 'function');
const RECORDERS = ENTRIES.filter((e) => typeof e[RECORDABLE_CONFIG_HOOK] === 'function');
const bytes = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** ⛓ Put every applier back at its own defaults (module state outlives a row). */
const resetAll = () => { for (const e of APPLIERS) e.applyPipelineConfig({}); };
afterEach(resetAll);

describe('⛓⛓ the declaration — every applier names its keys; every recorder answers a subset, as a fixed point', () => {
    it('the populations are the law\'s, and neither is vacuous', () => {
        expect(APPLIERS.length).toBeGreaterThan(0);
        expect(RECORDERS.length).toBeGreaterThan(0);
        // ⛓ a recorder with nothing to install would record a config nothing reads
        for (const e of RECORDERS) expect(typeof e.applyPipelineConfig, e.id).toBe('function');
    });

    it.each(APPLIERS.map((e) => [e.id, e]))('%s declares `pipelineConfigKeys` — the keys applyPipelineConfig reads',
        (_id, entry) => {
            const keys = entry[PIPELINE_CONFIG_KEYS_SLOT];
            expect(Array.isArray(keys), 'no pipelineConfigKeys').toBe(true);
            expect(keys.length).toBeGreaterThan(0);
            expect(keys.every((k) => typeof k === 'string' && k !== '')).toBe(true);
            expect(new Set(keys).size).toBe(keys.length);
            expect(Object.isFrozen(keys)).toBe(true);
        });

    it.each(RECORDERS.map((e) => [e.id, e]))('%s answers a plain JSON object whose keys are a subset of its '
        + 'pipelineConfigKeys', (_id, entry) => {
        entry.applyPipelineConfig({});
        const answer = entry[RECORDABLE_CONFIG_HOOK]();
        expect(answer && typeof answer === 'object' && !Array.isArray(answer)).toBe(true);
        expect(JSON.parse(bytes(answer))).toEqual(answer);
        const accepted = new Set(entry[PIPELINE_CONFIG_KEYS_SLOT]);
        expect(Object.keys(answer).filter((k) => !accepted.has(k))).toEqual([]);
        // ⛓ recorded, not elided: the defaults are exactly what a read-back cannot know
        expect(Object.keys(answer).length).toBeGreaterThan(0);
    });

    it.each(RECORDERS.map((e) => [e.id, e]))('%s: installing its own answer reproduces the answer (a fixed point)',
        (_id, entry) => {
            entry.applyPipelineConfig({});
            const answer = entry[RECORDABLE_CONFIG_HOOK]();
            entry.applyPipelineConfig(clone(answer));
            expect(entry[RECORDABLE_CONFIG_HOOK]()).toEqual(answer);
            entry.applyPipelineConfig(clone(entry[RECORDABLE_CONFIG_HOOK]()));
            expect(bytes(entry[RECORDABLE_CONFIG_HOOK]())).toBe(bytes(answer));
        });
});

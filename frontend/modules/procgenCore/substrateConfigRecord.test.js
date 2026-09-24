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
import { arrangeShuffledSpiral, buildRulesJson } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    PIPELINE_CONFIG_KEYS_SLOT, RECORDABLE_CONFIG_HOOK, SUBSTRATE_CONFIGS_KEY, recordableConfigsFor, recordedConfigOf,
} from './substrateConfigRecord.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const ENTRIES = substrateRegistry.getAll();
const APPLIERS = ENTRIES.filter((e) => typeof e.applyPipelineConfig === 'function');
const RECORDERS = ENTRIES.filter((e) => typeof e[RECORDABLE_CONFIG_HOOK] === 'function');
const isZoneSource = (e) => typeof e.extractZoneRules === 'function' && Number(e.zoneCount) > 0;
const bytes = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** ⛓ Put every applier back at its own defaults (module state outlives a row). */
const resetAll = () => { for (const e of APPLIERS) e.applyPipelineConfig({}); };
afterEach(resetAll);

/** ⛓ A one-source spiral world of `id` (`quota` regions, started on it), compiled. */
function oneSourceWorld(id, { procgenMetadata, quota = 1 } = {}) {
    const { grid, startCell, stats } = arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: 1,
        growthParams: { substrateQuotas: { [id]: quota }, assumeBidirectional: true, startSubstrate: id },
    });
    const pm = procgenMetadata === undefined ? { driver: 'shuffled-spiral', stop_reason: stats.stopReason } : procgenMetadata;
    return { grid, rules: buildRulesJson(grid, { startCell, seed: 1, ...(pm ? { procgenMetadata: pm } : {}) }) };
}

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

describe('⛓⛓ the writer — `procgen_metadata.substrate_configs`, for the declarers the grid REALISED', () => {
    const recordingSources = RECORDERS.filter(isZoneSource);
    const silentSource = ENTRIES.find((e) => isZoneSource(e) && typeof e[RECORDABLE_CONFIG_HOOK] !== 'function'
        && typeof e.applyPipelineConfig !== 'function');

    it('the writer populations are not vacuous (derived)', () => {
        expect(recordingSources.length).toBeGreaterThan(0);
        expect(silentSource, 'a zone source that records nothing').toBeDefined();
    });

    it.each(recordingSources.map((e) => [e.id, e]))('a world that realised %s gains exactly its record, equal to '
        + 'the installed config', (id, entry) => {
        const { grid, rules } = oneSourceWorld(id);
        const realised = new Set([...grid.allRegions()].map((r) => r.substrate));
        const want = Object.fromEntries(RECORDERS.filter((e) => realised.has(e.id))
            .map((e) => [e.id, e[RECORDABLE_CONFIG_HOOK]()]));
        expect(Object.keys(want)).toContain(id);
        expect(rules.procgen_metadata[SUBSTRATE_CONFIGS_KEY]).toEqual(want);
        expect(recordedConfigOf(rules, id)).toEqual(entry[RECORDABLE_CONFIG_HOOK]());
        // ⛓ the record sits beside the caller's fields and the derived ones, which are unchanged
        expect(Object.keys(rules.procgen_metadata))
            .toEqual(['driver', 'stop_reason', 'region_count', 'grid_dims', SUBSTRATE_CONFIGS_KEY]);
    });

    it.each(recordingSources.map((e) => [e.id]))('⛔ byte-inert without procgenMetadata: a %s world carries no '
        + 'procgen_metadata at all', (id) => {
        const { rules } = oneSourceWorld(id, { procgenMetadata: null });
        expect(Object.hasOwn(rules, 'procgen_metadata')).toBe(false);
        expect(bytes(rules)).not.toContain(SUBSTRATE_CONFIGS_KEY);
    });

    it('⛔ a world that realised no declaring source gains nothing — the key ABSENT, not `{}`', () => {
        // ⛓ two regions: a lone side-exit zone world has no portal to validate
        const { grid, rules } = oneSourceWorld(silentSource.id, { quota: 2 });
        const realised = new Set([...grid.allRegions()].map((r) => r.substrate));
        expect(RECORDERS.some((e) => realised.has(e.id)), 'premise: no recorder realised').toBe(false);
        expect(Object.hasOwn(rules.procgen_metadata, SUBSTRATE_CONFIGS_KEY)).toBe(false);
        expect(recordedConfigOf(rules, recordingSources[0].id)).toBeNull();
    });

    it('⛔ a caller that brings its own `substrate_configs` is refused — two writers of one block', () => {
        const id = recordingSources[0].id;
        expect(() => oneSourceWorld(id, { procgenMetadata: { driver: 'x', [SUBSTRATE_CONFIGS_KEY]: {} } }))
            .toThrow(SUBSTRATE_CONFIGS_KEY);
    });

    it('recordableConfigsFor asks only the ids it is handed, deep-copies, and answers null for none', () => {
        const e = recordingSources[0];
        const got = recordableConfigsFor([silentSource.id, e.id], (id) => substrateRegistry.get(id));
        expect(Object.keys(got)).toEqual([e.id]);
        got[e.id].__mutated = true;
        expect(e[RECORDABLE_CONFIG_HOOK]()).not.toHaveProperty('__mutated');
        expect(recordableConfigsFor([silentSource.id], (id) => substrateRegistry.get(id))).toBeNull();
        expect(recordableConfigsFor([], (id) => substrateRegistry.get(id))).toBeNull();
        expect(() => recordableConfigsFor(['x'], () => ({ [RECORDABLE_CONFIG_HOOK]: () => [1] }))).toThrow('plain object');
    });

    it('recordedConfigOf reads the record by id and ignores anything that is not an object', () => {
        const doc = { procgen_metadata: { [SUBSTRATE_CONFIGS_KEY]: { a: { k: 1 }, b: [1], c: null } } };
        expect(recordedConfigOf(doc, 'a')).toEqual({ k: 1 });
        expect(recordedConfigOf(doc, 'b')).toBeNull();
        expect(recordedConfigOf(doc, 'c')).toBeNull();
        expect(recordedConfigOf(doc, 'd')).toBeNull();
        expect(recordedConfigOf({}, 'a')).toBeNull();
        expect(recordedConfigOf(null, 'a')).toBeNull();
    });
});

// Stepped-spiral Part 3 — the JtA ② content dataset seam.
//
// Covers the two Phase-B gates that live in-process (the toolchain roundtrip is
// scripts/procgen/verify-jta-locations-roundtrip.mjs JTA_RT_PIPELINE, the in-app
// solve+play is scripts/procgen/verify-jta-dataset-pipeline-preset.mjs):
//   - a dataset world drives the config seam (① installs from config, ②
//     materialises the editable document, carriage lands), byte-identical to the
//     globals-installed monolith;
//   - Phase-B gate (d): a hand-edit to the envelope's content document restamps
//     to a NEW dataset_id, invalidates the downstream regions/compile, and a
//     resume regenerates against the edit — giving a fresh Pass-B cache entry /
//     save slot (a fresh solve) rather than poisoning the old one.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Registers the jta substrate (emitsSpiralContent + the config seam) on import.
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import { generateJtaDataset } from '../jtaSubstrateWrapper/generateDataset.js';
import { cacheKey } from '../jtaBalance/hostGlue.js';
import { arrangeShuffledSpiral, buildRulesJson } from './procgenPipelineEngine.js';
import {
    newSpiralEnvelope, runSpiralToStep, resumeSpiralEnvelope,
    serializeSpiralEnvelope, deserializeSpiralEnvelope, detectSpiralCompleted,
} from './spiralSteps.js';
import {
    setJtaDataset, setJtaEmitZoneLocations, setJtaGoalZone, setJtaPerkShuffleSeed,
} from '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const QUOTA = 4;
const GOAL_ZONE = QUOTA - 1;

let dataset;
function jtaConfig(datasetDoc) {
    return {
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: 1,
        regionParams: {},
        growthParams: {
            substrateQuotas: { jta: QUOTA }, assumeBidirectional: true, startSubstrate: 'jta',
            substrateConfig: {
                jta: { datasetDoc, emitZoneLocations: true, goalZone: GOAL_ZONE, perkShuffleSeed: null },
            },
        },
        hazardOpts: null,
    };
}

beforeAll(() => {
    const profile = JSON.parse(fs.readFileSync(
        path.join(repoRoot, 'CC/scripts/jta-stats/results/vanilla-profile.json'), 'utf8')).static;
    const vanilla = JSON.parse(fs.readFileSync(
        path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json'), 'utf8'));
    dataset = generateJtaDataset({ seed: 1, profile, vanilla, params: { zoneCount: QUOTA } }).dataset;
});

describe('spiral ② content dataset seam', () => {
    it('① installs the dataset from config and ② materialises it onto the envelope', async () => {
        // Reset globals so the ONLY dataset source is config (the seam).
        setJtaDataset(null); setJtaEmitZoneLocations(false); setJtaGoalZone(null);
        const env = await runSpiralToStep(newSpiralEnvelope({
            config: jtaConfig(dataset), compileIn: { seed: 1, completionConditionItem: 'Victory' },
        }));
        expect(env.content?.dataset_id).toBe(dataset.dataset_id);
        // Single full-doc carrier + a ref on every jta region.
        const regions = [...env.regions.grid.allRegions()];
        expect(regions.filter((r) => r.playable_payload?.jta_dataset)).toHaveLength(1);
        expect(regions.filter((r) => r.playable_payload?.jta_dataset_ref)).toHaveLength(QUOTA);
    });

    it('config seam is byte-identical to the globals-installed monolith', async () => {
        // Monolith: install via globals, arrange + compile.
        setJtaDataset(dataset); setJtaEmitZoneLocations(true); setJtaGoalZone(GOAL_ZONE); setJtaPerkShuffleSeed(null);
        const m = arrangeShuffledSpiral(jtaConfig(dataset));
        const mono = buildRulesJson(m.grid, {
            startCell: m.startCell, seed: 1, completionConditionItem: 'Victory',
            procgenMetadata: { driver: 'shuffled-spiral', stop_reason: m.stats.stopReason },
        });
        // Pipeline: reset globals, drive purely from config.
        setJtaDataset(null); setJtaEmitZoneLocations(false); setJtaGoalZone(null);
        const env = await runSpiralToStep(newSpiralEnvelope({
            config: jtaConfig(dataset), compileIn: { seed: 1, completionConditionItem: 'Victory' },
        }));
        expect(JSON.stringify(env.compile.rulesJson)).toBe(JSON.stringify(mono));
    });

    it('gate (d): editing env.content restamps a new id, invalidates downstream, and resumes fresh', async () => {
        setJtaDataset(null); setJtaEmitZoneLocations(false); setJtaGoalZone(null);
        const env = await runSpiralToStep(newSpiralEnvelope({
            config: jtaConfig(dataset), compileIn: { seed: 1, completionConditionItem: 'Victory' },
        }));
        const originalId = env.content.dataset_id;
        const originalRules = JSON.stringify(env.compile.rulesJson);

        // Serialize → hand-edit the content document → deserialize (the edit
        // altitude: the serialized envelope, per plan §4).
        const ser = JSON.parse(JSON.stringify(serializeSpiralEnvelope(env)));
        ser.content.zones[0].tasks[0].cost_multiplier = 4321;
        const edited = deserializeSpiralEnvelope(ser);

        // A real edit → new dataset_id (content hash rewritten).
        expect(edited.content.dataset_id).not.toBe(originalId);
        // Downstream cleared so the walk re-runs from ③ regions.
        expect(edited.regions).toBeNull();
        expect(edited.compile).toBeNull();
        expect(detectSpiralCompleted(edited)).toBe(1); // last contiguous = ② content

        // Fresh solve: a different (seed, dataset_id) Pass-B cache entry / save slot.
        expect(cacheKey('seed1', edited.content.dataset_id)).not.toBe(cacheKey('seed1', originalId));

        // Resume regenerates regions + compile against the edited dataset.
        await resumeSpiralEnvelope(edited);
        expect(edited.compile?.rulesJson).toBeTruthy();
        expect(JSON.stringify(edited.compile.rulesJson)).not.toBe(originalRules);
    });

    it('an unchanged content round-trip restamps to the SAME id (idempotent)', async () => {
        setJtaDataset(null); setJtaEmitZoneLocations(false); setJtaGoalZone(null);
        const env = await runSpiralToStep(newSpiralEnvelope({
            config: jtaConfig(dataset), compileIn: { seed: 1, completionConditionItem: 'Victory' },
        }));
        const id = env.content.dataset_id;
        const rt = deserializeSpiralEnvelope(JSON.parse(JSON.stringify(serializeSpiralEnvelope(env))));
        expect(rt.content.dataset_id).toBe(id);
        expect(rt.regions).not.toBeNull(); // unchanged → downstream preserved
    });
});
